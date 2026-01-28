import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq'
import { Logger, Inject } from '@nestjs/common'
import { Job } from 'bullmq'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AI_TASK_QUEUE } from '../constants/queue.constants'
import { AITaskJobData, AITaskJobResult } from '../interfaces/queue-job.interface'
import {
  AITask,
  TaskStatus,
  GenerationStage,
  AITaskType,
} from '../../../database/entities/ai-task.entity'
import { AIGenerationEvent } from '../../../database/entities/ai-generation-event.entity'
import { AICostTracking } from '../../../database/entities/ai-cost-tracking.entity'
import { Project } from '../../../database/entities/project.entity'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'
import { TasksGateway } from '../gateways/tasks.gateway'
import { CostMonitoringService } from '../services/cost-monitoring.service'
import { generateActionPlanPrompt } from '../prompts/action-plan.prompt'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'
import { ClusteringGenerator } from '../../ai-generation/generators/clustering.generator'
import { MatrixGenerator } from '../../ai-generation/generators/matrix.generator'
import { QuestionnaireGenerator } from '../../ai-generation/generators/questionnaire.generator'
import { StandardInterpretationGenerator } from '../../ai-generation/generators/standard-interpretation.generator'
import { QualityValidationService } from '../../quality-validation/quality-validation.service'
import { ResultAggregatorService } from '../../result-aggregation/result-aggregator.service'

/**
 * 将AI模型enum映射到进度字段名
 */
function getModelProgressField(model: string): string {
  switch (model) {
    case AIModel.GPT4:
      return 'gpt4'
    case AIModel.CLAUDE:
      return 'claude'
    case AIModel.DOMESTIC:
      return 'domestic'
    default:
      return 'current'
  }
}

@Processor(AI_TASK_QUEUE, {
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000,
  },
})
export class AITaskProcessor extends WorkerHost {
  private readonly logger = new Logger(AITaskProcessor.name)

  constructor(
    @InjectRepository(AITask)
    private readonly aiTaskRepo: Repository<AITask>,
    @InjectRepository(AIGenerationEvent)
    private readonly eventRepo: Repository<AIGenerationEvent>,
    @InjectRepository(AICostTracking)
    private readonly costRepo: Repository<AICostTracking>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    private readonly aiOrchestrator: AIOrchestrator,
    private readonly tasksGateway: TasksGateway,
    private readonly costMonitoring: CostMonitoringService,
    private readonly clusteringGenerator: ClusteringGenerator,
    private readonly matrixGenerator: MatrixGenerator,
    private readonly questionnaireGenerator: QuestionnaireGenerator,
    private readonly standardInterpretationGenerator: StandardInterpretationGenerator,
    private readonly qualityValidation: QualityValidationService,
    private readonly resultAggregator: ResultAggregatorService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super()
  }

  async process(job: Job<AITaskJobData>): Promise<AITaskJobResult> {
    const { taskId, type, input, model, projectId } = job.data
    this.logger.log(`Processing AI task ${taskId}, type: ${type}, model: ${model}`)

    const startTime = Date.now()
    const modelField = getModelProgressField(model) // 获取对应的进度字段名

    // 更新job进度以防止stalled（每30秒至少更新一次）
    const keepAliveInterval = setInterval(() => {
      job.updateProgress(Math.random()).catch((err) => {
        this.logger.warn(`Failed to update job progress: ${err.message}`)
      })
    }, 25000) // 25秒更新一次，小于默认的30秒stalledInterval

    try {
      // 处理 documentIds - 从项目 metadata 加载完整文档
      const processedInput = { ...input }
      if (input.documentIds && projectId) {
        this.logger.log(`Loading ${input.documentIds.length} documents from project ${projectId}`)
        const project = await this.projectRepo.findOne({
          where: { id: projectId },
          select: ['metadata'],
        })

        if (project?.metadata?.uploadedDocuments) {
          const allDocs = project.metadata.uploadedDocuments as any[]
          const documents = input.documentIds
            .map((docId: string) => allDocs.find((doc: any) => doc.id === docId))
            .filter((doc: any) => doc)

          if (documents.length === input.documentIds.length) {
            processedInput.documents = documents
            delete processedInput.documentIds
            this.logger.log(`Successfully loaded ${documents.length} documents`)
          } else {
            throw new Error(
              `Failed to load all documents: found ${documents.length} of ${input.documentIds.length}`,
            )
          }
        } else {
          throw new Error('Project has no uploadedDocuments in metadata')
        }
      }

      // 发送进度：0% - 任务开始
      this.tasksGateway.emitTaskProgress({
        taskId,
        progress: 0,
        message: '任务已开始处理',
        currentStep: 'initializing',
      })

      // 更新任务状态为 PROCESSING
      const progressData: any = {}
      progressData[modelField] = { status: 'preparing', message: '正在准备AI请求' }

      await this.aiTaskRepo.update(taskId, {
        status: TaskStatus.PROCESSING,
        generationStage: GenerationStage.PENDING,
        progressDetails: progressData,
      })

      // 发送进度：10% - 准备调用AI
      this.tasksGateway.emitTaskProgress({
        taskId,
        progress: 10,
        message: '正在准备AI请求',
        currentStep: 'preparing',
      })

      // ✅ 只在 model 存在时记录生成事件（clustering/matrix/questionnaire 的 model 为 undefined）
      let event
      if (model) {
        event = this.eventRepo.create({
          taskId,
          model,
          input: processedInput,
        })
        await this.eventRepo.save(event)
      }

      // 更新进度：开始生成
      const generatingProgress: any = {}
      if (model) {
        generatingProgress[modelField] = {
          status: 'generating',
          message: `正在调用${model}模型生成内容`,
          startTime: new Date().toISOString(),
        }
      }

      await this.aiTaskRepo.update(taskId, {
        generationStage: GenerationStage.GENERATING_MODELS,
        progressDetails: generatingProgress,
      })

      // 发送进度：30% - 调用AI中
      this.tasksGateway.emitTaskProgress({
        taskId,
        progress: 30,
        message: `正在调用AI模型生成内容`,
        currentStep: 'generating',
        estimatedTimeMs: 20000, // 预估20秒
      })

      let aiResponse: any
      let executionTimeMs: number

      // ✅ 特殊处理：clustering类型使用ClusteringGenerator（三模型并行）
      if (type === 'clustering') {
        this.logger.log(`Using ClusteringGenerator for three-model parallel processing`)

        // 准备输入
        const clusteringInput = {
          documents: processedInput.documents,
          temperature: 0.7,
          maxTokens: processedInput.maxTokens || 60000,
        }

        // 调用ClusteringGenerator.generate()（三模型并行）
        this.logger.log(`Step 1/3: Generating clustering results with 3 models...`)
        const clusteringResults = await this.clusteringGenerator.generate(
          clusteringInput,
          taskId, // 传递taskId，用于记录AI生成事件
          (progress) => {
            // 更新任务进度
            this.logger.debug(`Clustering progress: ${JSON.stringify(progress)}`)
            this.tasksGateway.emitTaskProgress({
              taskId,
              progress: 30 + (progress.details ? 30 : 0), // 30%-60%
              message: progress.details?.message || `正在${progress.model || '多'}模型生成`,
              currentStep: 'generating',
            })
          },
        )

        // Step 2: 质量验证
        this.logger.log(`Step 2/3: Validating quality of 3 models...`)
        const validationReport = await this.qualityValidation.validateQuality({
          gpt4: clusteringResults.gpt4,
          claude: clusteringResults.claude,
          domestic: clusteringResults.domestic,
        })

        this.logger.log(
          `Quality validation completed: overall=${validationReport.overallScore.toFixed(4)}, confidence=${validationReport.confidenceLevel}, passed=${validationReport.passed}`,
        )

        // Step 3: 结果聚合
        this.logger.log(`Step 3/3: Aggregating best result from 3 models...`)
        const aggregationOutput = await this.resultAggregator.aggregate({
          taskId,
          generationType: AITaskType.CLUSTERING,
          gpt4Result: clusteringResults.gpt4,
          claudeResult: clusteringResults.claude,
          domesticResult: clusteringResults.domestic,
          validationReport,
        })

        this.logger.log(
          `Aggregation completed: selected=${aggregationOutput.selectedModel}, confidence=${aggregationOutput.confidenceLevel}`,
        )

        executionTimeMs = Date.now() - startTime

        // 更新进度：所有三个模型都完成
        const modelProgress: any = {
          gpt4: {
            status: 'completed',
            message: '✅ 完成',
            tokens: 0, // ClusteringGenerator不返回token信息
            cost: 0,
          },
          claude: {
            status: 'completed',
            message: '✅ 完成',
            tokens: 0,
            cost: 0,
          },
          domestic: {
            status: 'completed',
            message: '✅ 完成',
            tokens: 0,
            cost: 0,
          },
        }

        await this.aiTaskRepo.update(taskId, {
          generationStage: GenerationStage.COMPLETED,
          progressDetails: modelProgress,
        })

        // 构造响应（只返回聚合后的最佳结果）
        const finalResult = {
          ...aggregationOutput.selectedResult,
          // 添加taskId供后续使用（如生成矩阵）
          taskId,
          // 添加质量分数和置信度信息
          qualityScores: aggregationOutput.qualityScores,
          confidenceLevel: aggregationOutput.confidenceLevel,
          selectedModel: aggregationOutput.selectedModel,
          // 添加一致性报告
          consistencyReport: aggregationOutput.consistencyReport,
        }

        aiResponse = {
          content: JSON.stringify(finalResult),
          metadata: {
            type: 'clustering',
            selectedModel: aggregationOutput.selectedModel,
            confidenceLevel: aggregationOutput.confidenceLevel,
            models: ['gpt4', 'claude', 'domestic'],
            timestamp: new Date().toISOString(),
          },
          tokens: { total: 0 },
          cost: 0,
        }

        // 记录聚合后的事件
        await this.eventRepo.save({
          taskId,
          model: aggregationOutput.selectedModel as any,
          input: clusteringInput,
          output: { content: JSON.stringify(finalResult) } as any,
          executionTimeMs,
        })

        this.logger.log(
          `Clustering workflow completed in ${executionTimeMs}ms: 3 models generated → validated → aggregated to ${aggregationOutput.selectedModel}`,
        )
      } else if (type === 'matrix') {
        // ✅ 特殊处理：matrix类型使用MatrixGenerator（三模型并行）
        this.logger.log(`Using MatrixGenerator for three-model parallel processing`)

        // 检查是否提供了clusteringTaskId
        if (!processedInput.clusteringTaskId) {
          throw new Error('clusteringTaskId is required for matrix generation')
        }

        // 从数据库获取聚类结果
        this.logger.log(`Fetching clustering result: ${processedInput.clusteringTaskId}`)
        const clusteringTask = await this.aiTaskRepo.findOne({
          where: { id: processedInput.clusteringTaskId },
        })

        if (!clusteringTask || !clusteringTask.result) {
          throw new Error(
            `Clustering task ${processedInput.clusteringTaskId} not found or has no result`,
          )
        }

        // 解析聚类结果
        let clusteringResult: any
        if (typeof clusteringTask.result === 'string') {
          // 如果 result 是 JSON 字符串，先解析
          const parsed = JSON.parse(clusteringTask.result)
          // parsed.content 可能是 JSON 字符串，需要再次解析
          if (typeof parsed.content === 'string') {
            clusteringResult = JSON.parse(parsed.content)
          } else {
            clusteringResult = parsed.content || parsed
          }
        } else {
          // result 已经是对象
          const resultObj = clusteringTask.result as any
          if (resultObj.content) {
            // result.content 可能是 JSON 字符串或对象
            if (typeof resultObj.content === 'string') {
              clusteringResult = JSON.parse(resultObj.content)
            } else {
              clusteringResult = resultObj.content
            }
          } else {
            // 没有 content 字段，直接使用 result
            clusteringResult = resultObj
          }
        }
        this.logger.log(
          `Loaded clustering result with ${clusteringResult.categories?.length || 0} categories`,
        )

        // 准备输入
        const matrixInput = {
          clusteringResult,
          temperature: 0.7,
          maxTokens: 60000,
        }

        // 调用MatrixGenerator.generate()（三模型并行）
        this.logger.log(`Step 1/3: Generating matrix results with 3 models...`)
        const matrixResults = await this.matrixGenerator.generate(matrixInput)

        // Step 2: 质量验证
        this.logger.log(`Step 2/3: Validating quality of 3 models...`)
        const validationReport = await this.qualityValidation.validateQuality({
          gpt4: matrixResults.gpt4,
          claude: matrixResults.claude,
          domestic: matrixResults.domestic,
        })

        this.logger.log(
          `Quality validation completed: overall=${validationReport.overallScore.toFixed(4)}, confidence=${validationReport.confidenceLevel}, passed=${validationReport.passed}`,
        )

        // Step 3: 结果聚合
        this.logger.log(`Step 3/3: Aggregating best result from 3 models...`)
        const aggregationOutput = await this.resultAggregator.aggregate({
          taskId,
          generationType: AITaskType.MATRIX,
          gpt4Result: matrixResults.gpt4,
          claudeResult: matrixResults.claude,
          domesticResult: matrixResults.domestic,
          validationReport,
        })

        this.logger.log(
          `Aggregation completed: selected=${aggregationOutput.selectedModel}, confidence=${aggregationOutput.confidenceLevel}`,
        )

        executionTimeMs = Date.now() - startTime

        // 更新进度：所有三个模型都完成
        const modelProgress: any = {
          gpt4: {
            status: 'completed',
            message: '✅ 完成',
            tokens: 0,
            cost: 0,
          },
          claude: {
            status: 'completed',
            message: '✅ 完成',
            tokens: 0,
            cost: 0,
          },
          domestic: {
            status: 'completed',
            message: '✅ 完成',
            tokens: 0,
            cost: 0,
          },
        }

        await this.aiTaskRepo.update(taskId, {
          generationStage: GenerationStage.COMPLETED,
          progressDetails: modelProgress,
        })

        // 构造响应（只返回聚合后的最佳结果）
        const finalResult = {
          ...aggregationOutput.selectedResult,
          taskId,
          qualityScores: aggregationOutput.qualityScores,
          confidenceLevel: aggregationOutput.confidenceLevel,
          selectedModel: aggregationOutput.selectedModel,
          consistencyReport: aggregationOutput.consistencyReport,
        }

        aiResponse = {
          content: JSON.stringify(finalResult),
          metadata: {
            type: 'matrix',
            selectedModel: aggregationOutput.selectedModel,
            confidenceLevel: aggregationOutput.confidenceLevel,
            models: ['gpt4', 'claude', 'domestic'],
            timestamp: new Date().toISOString(),
          },
          tokens: { total: 0 },
          cost: 0,
        }

        // 记录聚合后的事件
        await this.eventRepo.save({
          taskId,
          model: aggregationOutput.selectedModel as any,
          input: matrixInput,
          output: { content: JSON.stringify(finalResult) } as any,
          executionTimeMs,
        })

        this.logger.log(
          `Matrix workflow completed in ${executionTimeMs}ms: 3 models generated → validated → aggregated to ${aggregationOutput.selectedModel}`,
        )
      } else if (type === 'questionnaire') {
        // ✅ 特殊处理：questionnaire类型使用QuestionnaireGenerator（三模型并行）
        this.logger.log(`Using QuestionnaireGenerator for three-model parallel processing`)

        // 检查是否提供了matrixTaskId
        if (!processedInput.matrixTaskId) {
          throw new Error('matrixTaskId is required for questionnaire generation')
        }

        // 从数据库获取矩阵结果
        this.logger.log(`Fetching matrix result: ${processedInput.matrixTaskId}`)
        const matrixTask = await this.aiTaskRepo.findOne({
          where: { id: processedInput.matrixTaskId },
        })

        if (!matrixTask || !matrixTask.result) {
          throw new Error(`Matrix task ${processedInput.matrixTaskId} not found or has no result`)
        }

        // 解析矩阵结果
        let matrixResult: any
        if (typeof matrixTask.result === 'string') {
          // 如果 result 是 JSON 字符串，先解析
          const parsed = JSON.parse(matrixTask.result)
          // parsed.content 可能是 JSON 字符串，需要再次解析
          if (typeof parsed.content === 'string') {
            matrixResult = JSON.parse(parsed.content)
          } else {
            matrixResult = parsed.content || parsed
          }
        } else {
          // result 已经是对象
          const resultObj = matrixTask.result as any
          if (resultObj.content) {
            // result.content 可能是 JSON 字符串或对象
            if (typeof resultObj.content === 'string') {
              matrixResult = JSON.parse(resultObj.content)
            } else {
              matrixResult = resultObj.content
            }
          } else {
            // 没有 content 字段，直接使用 result
            matrixResult = resultObj
          }
        }
        this.logger.log(`Loaded matrix result with ${matrixResult.matrix?.length || 0} clusters`)

        // ✅ 初始化聚类生成状态
        const totalClusters = matrixResult.matrix.length
        const clusterStatus = {
          totalClusters,
          completedClusters: [] as string[],
          failedClusters: [] as string[],
          pendingClusters: matrixResult.matrix.map((c: any) => c.cluster_id),
          clusterProgress: {} as Record<string, any>,
        }

        // 初始化所有聚类的状态
        matrixResult.matrix.forEach((cluster: any) => {
          clusterStatus.clusterProgress[cluster.cluster_id] = {
            clusterId: cluster.cluster_id,
            clusterName: cluster.cluster_name,
            status: 'pending',
            questionsGenerated: 0,
            questionsExpected: 5,
          }
        })

        await this.aiTaskRepo.update(taskId, {
          clusterGenerationStatus: clusterStatus,
        })

        // 准备输入
        const questionnaireInput = {
          matrixResult,
          temperature: 0.7,
          maxTokens: 8000,
        }

        // 调用QuestionnaireGenerator.generate()（三模型并行）
        this.logger.log(`Step 1/3: Generating questionnaire results with 3 models...`)
        const questionnaireResults = await this.questionnaireGenerator.generate(
          questionnaireInput,
          // 传入进度回调函数
          async (progress) => {
            this.logger.debug(`Questionnaire progress: ${JSON.stringify(progress)}`)
            // 计算进度百分比：假设生成占60%，验证占20%，聚合占20%
            const percentage = 30 + Math.floor((progress.current / progress.total) * 60)

            // ✅ 更新聚类生成状态
            if (progress.currentClusterId) {
              const currentCluster = clusterStatus.clusterProgress[progress.currentClusterId]
              if (currentCluster) {
                currentCluster.status = 'generating'
                currentCluster.startedAt = new Date().toISOString()
              }

              // 更新已完成的聚类
              if (progress.current > 1) {
                const prevClusterIndex = progress.current - 2
                if (prevClusterIndex >= 0 && prevClusterIndex < matrixResult.matrix.length) {
                  const prevCluster = matrixResult.matrix[prevClusterIndex]
                  const prevClusterStatus = clusterStatus.clusterProgress[prevCluster.cluster_id]
                  if (prevClusterStatus && prevClusterStatus.status !== 'completed') {
                    prevClusterStatus.status = 'completed'
                    prevClusterStatus.questionsGenerated = 5
                    prevClusterStatus.completedAt = new Date().toISOString()
                    clusterStatus.completedClusters.push(prevCluster.cluster_id)
                  }
                }
              }

              await this.aiTaskRepo.update(taskId, {
                clusterGenerationStatus: clusterStatus,
              })
            }

            this.tasksGateway.emitTaskProgress({
              taskId,
              progress: percentage,
              message: progress.message || `正在生成问卷 (${progress.current}/${progress.total})`,
              currentStep: 'generating',
            })
          },
        )

        // ✅ 标记所有聚类为已完成
        Object.values(clusterStatus.clusterProgress).forEach((cp: any) => {
          if (cp.status !== 'completed') {
            cp.status = 'completed'
            cp.questionsGenerated = 5
            cp.completedAt = new Date().toISOString()
            if (!clusterStatus.completedClusters.includes(cp.clusterId)) {
              clusterStatus.completedClusters.push(cp.clusterId)
            }
          }
        })

        // Step 2: 质量验证
        this.logger.log(`Step 2/3: Validating quality of 3 models...`)
        this.tasksGateway.emitTaskProgress({
          taskId,
          progress: 90,
          message: '正在进行质量验证...',
          currentStep: 'validating',
        })
        const validationReport = await this.qualityValidation.validateQuality({
          gpt4: questionnaireResults.gpt4,
          claude: questionnaireResults.claude,
          domestic: questionnaireResults.domestic,
        })

        this.logger.log(
          `Quality validation completed: overall=${validationReport.overallScore.toFixed(4)}, confidence=${validationReport.confidenceLevel}, passed=${validationReport.passed}`,
        )

        // Step 3: 结果聚合
        this.logger.log(`Step 3/3: Aggregating best result from 3 models...`)
        this.tasksGateway.emitTaskProgress({
          taskId,
          progress: 95,
          message: '正在聚合最佳结果...',
          currentStep: 'aggregating',
        })
        const aggregationOutput = await this.resultAggregator.aggregate({
          taskId,
          generationType: AITaskType.QUESTIONNAIRE,
          gpt4Result: questionnaireResults.gpt4,
          claudeResult: questionnaireResults.claude,
          domesticResult: questionnaireResults.domestic,
          validationReport,
        })

        this.logger.log(
          `Aggregation completed: selected=${aggregationOutput.selectedModel}, confidence=${aggregationOutput.confidenceLevel}`,
        )

        executionTimeMs = Date.now() - startTime

        // 更新进度：所有三个模型都完成
        const modelProgress: any = {
          gpt4: {
            status: 'completed',
            message: '✅ 完成',
            tokens: 0,
            cost: 0,
          },
          claude: {
            status: 'completed',
            message: '✅ 完成',
            tokens: 0,
            cost: 0,
          },
          domestic: {
            status: 'completed',
            message: '✅ 完成',
            tokens: 0,
            cost: 0,
          },
        }

        await this.aiTaskRepo.update(taskId, {
          generationStage: GenerationStage.COMPLETED,
          progressDetails: modelProgress,
          clusterGenerationStatus: clusterStatus, // ✅ 保存最终状态
        })

        // 构造响应（只返回聚合后的最佳结果）
        const finalResult = {
          ...aggregationOutput.selectedResult,
          taskId,
          qualityScores: aggregationOutput.qualityScores,
          confidenceLevel: aggregationOutput.confidenceLevel,
          selectedModel: aggregationOutput.selectedModel,
          consistencyReport: aggregationOutput.consistencyReport,
        }

        aiResponse = {
          content: JSON.stringify(finalResult),
          metadata: {
            type: 'questionnaire',
            selectedModel: aggregationOutput.selectedModel,
            confidenceLevel: aggregationOutput.confidenceLevel,
            models: ['gpt4', 'claude', 'domestic'],
            timestamp: new Date().toISOString(),
          },
          tokens: { total: 0 },
          cost: 0,
        }

        // 记录聚合后的事件
        await this.eventRepo.save({
          taskId,
          model: aggregationOutput.selectedModel as any,
          input: questionnaireInput,
          output: { content: JSON.stringify(finalResult) } as any,
          executionTimeMs,
        })

        this.logger.log(
          `Questionnaire workflow completed in ${executionTimeMs}ms: 3 models generated → validated → aggregated to ${aggregationOutput.selectedModel}`,
        )
      } else if (
        type === 'standard_interpretation' ||
        type === 'standard_related_search' ||
        type === 'standard_version_compare'
      ) {
        // 标准解读相关任务：使用三模型并行处理
        this.logger.log(
          `Using StandardInterpretationGenerator for three-model parallel processing: ${type}`,
        )

        let generatorResults
        if (type === 'standard_interpretation') {
          // 检查是否使用两阶段模式
          const useTwoPhaseMode = processedInput.useTwoPhaseMode === true
          const batchSize = processedInput.batchSize || 10

          this.logger.log(
            `Standard interpretation mode: ${useTwoPhaseMode ? 'TWO-PHASE (batch size=' + batchSize + ')' : 'ONE-PASS'}, interpretationMode: ${processedInput.interpretationMode || 'enterprise'}`,
          )

          if (useTwoPhaseMode) {
            // 两阶段模式：先提取条款清单，再批量解读（确保100%条款覆盖）
            this.logger.log(`[Phase 1/2] Starting clause extraction and batch interpretation...`)

            generatorResults =
              await this.standardInterpretationGenerator.generateBatchInterpretation({
                standardDocument: processedInput.standardDocument,
                interpretationMode: processedInput.interpretationMode || 'enterprise',
                batchSize: batchSize,
                temperature: 0.7,
                maxTokens: 30000,
                onProgress: (progress) => {
                  this.logger.log(
                    `[Batch ${progress.batch || 0}/${progress.totalBatches || '?'}] ${progress.message || 'Processing...'}`,
                  )
                },
              })

            this.logger.log(`[Phase 2/2] Batch interpretation completed`)
          } else {
            // 一次性模式：直接解读（AI自己选择重要条款）
            this.logger.log(`Using one-pass interpretation mode (AI will select important clauses)`)
            generatorResults = await this.standardInterpretationGenerator.generateInterpretation({
              standardDocument: processedInput.standardDocument,
              interpretationMode: processedInput.interpretationMode || 'enterprise',
              temperature: 0.7,
              maxTokens: 30000,
            })
          }
        } else if (type === 'standard_related_search') {
          // 搜索关联标准 - 加载解读结果
          let interpretationResult = null
          if (processedInput.interpretationTaskId) {
            this.logger.log(
              `Loading interpretation result from task: ${processedInput.interpretationTaskId}`,
            )
            const interpretationTask = await this.aiTaskRepo.findOne({
              where: { id: processedInput.interpretationTaskId },
            })

            if (interpretationTask?.result) {
              // 从聚合结果中提取选中模型的结果
              const resultData = interpretationTask.result as any
              interpretationResult = {
                key_requirements: resultData.key_requirements || [],
                overview: resultData.overview || {},
                key_terms: resultData.key_terms || [],
              }
              this.logger.log(
                `Loaded interpretation result with ${interpretationResult.key_requirements.length} requirements`,
              )
            } else {
              this.logger.warn(
                `Interpretation task ${processedInput.interpretationTaskId} has no result, will use standard content only`,
              )
            }
          }

          generatorResults = await this.standardInterpretationGenerator.searchRelatedStandards({
            standardDocument: processedInput.standardDocument,
            interpretationResult,
            temperature: 0.7,
            maxTokens: 10000,
          })
        } else if (type === 'standard_version_compare') {
          // 版本比对
          generatorResults = await this.standardInterpretationGenerator.compareVersions({
            oldVersion: processedInput.oldVersion,
            newVersion: processedInput.newVersion,
            temperature: 0.7,
            maxTokens: 12000,
          })
        }

        // Step 2: 质量验证
        this.logger.log(`Step 2/3: Validating quality of 3 models for ${type}...`)
        const validationReport = await this.qualityValidation.validateQuality({
          gpt4: generatorResults.gpt4,
          claude: generatorResults.claude,
          domestic: generatorResults.domestic,
        })

        this.logger.log(
          `Quality validation completed: overall=${validationReport.overallScore.toFixed(4)}, confidence=${validationReport.confidenceLevel}, passed=${validationReport.passed}`,
        )

        // Step 3: 结果聚合
        this.logger.log(`Step 3/3: Aggregating best result from 3 models for ${type}...`)
        const aggregationOutput = await this.resultAggregator.aggregate({
          taskId,
          generationType: type as any,
          gpt4Result: generatorResults.gpt4,
          claudeResult: generatorResults.claude,
          domesticResult: generatorResults.domestic,
          validationReport,
        })

        this.logger.log(
          `Aggregation completed: selected=${aggregationOutput.selectedModel}, confidence=${aggregationOutput.confidenceLevel}`,
        )

        executionTimeMs = Date.now() - startTime

        // 更新进度：所有三个模型都完成
        const modelProgress: any = {
          gpt4: {
            status: 'completed',
            message: '✅ 完成',
            tokens: 0,
            cost: 0,
          },
          claude: {
            status: 'completed',
            message: '✅ 完成',
            tokens: 0,
            cost: 0,
          },
          domestic: {
            status: 'completed',
            message: '✅ 完成',
            tokens: 0,
            cost: 0,
          },
        }

        await this.aiTaskRepo.update(taskId, {
          generationStage: GenerationStage.COMPLETED,
          progressDetails: modelProgress,
        })

        // 构造响应（只返回聚合后的最佳结果）
        const finalResult = {
          ...aggregationOutput.selectedResult,
          taskId,
          qualityScores: aggregationOutput.qualityScores,
          confidenceLevel: aggregationOutput.confidenceLevel,
          selectedModel: aggregationOutput.selectedModel,
          consistencyReport: aggregationOutput.consistencyReport,
        }

        aiResponse = {
          content: JSON.stringify(finalResult),
          metadata: {
            type: type,
            selectedModel: aggregationOutput.selectedModel,
            confidenceLevel: aggregationOutput.confidenceLevel,
            models: ['gpt4', 'claude', 'domestic'],
            timestamp: new Date().toISOString(),
          },
          tokens: { total: 0 },
          cost: 0,
        }

        // 记录聚合后的事件
        await this.eventRepo.save({
          taskId,
          model: aggregationOutput.selectedModel as any,
          input: processedInput,
          output: { content: JSON.stringify(finalResult) } as any,
          executionTimeMs,
        })

        this.logger.log(
          `${type} workflow completed in ${executionTimeMs}ms: 3 models generated → validated → aggregated to ${aggregationOutput.selectedModel}`,
        )
      } else {
        // 其他类型：使用原有的单模型逻辑
        const prompt = this.buildPrompt(type, processedInput)
        aiResponse = await this.aiOrchestrator.generate(
          {
            prompt: prompt.prompt,
            systemPrompt: prompt.systemPrompt,
            temperature: 0.7,
            maxTokens: 30000, // 设置为30000以支持大型JSON数据生成（聚类、矩阵等）
          },
          model,
        )

        executionTimeMs = Date.now() - startTime
      }

      // 发送进度：70% - AI生成完成，保存结果
      this.tasksGateway.emitTaskProgress({
        taskId,
        progress: 70,
        message: 'AI生成完成，正在保存结果',
        currentStep: 'saving',
      })

      // ✅ clustering/matrix/questionnaire/standard_*类型已经在前面记录了三个模型的事件，这里跳过
      const isMultiModelTask = [
        'clustering',
        'matrix',
        'questionnaire',
        'standard_interpretation',
        'standard_related_search',
        'standard_version_compare',
      ].includes(type)
      if (!isMultiModelTask && event) {
        // 更新生成事件 - 完成
        await this.eventRepo.update(event.id, {
          output: { content: aiResponse.content, metadata: aiResponse.metadata } as any,
          executionTimeMs,
        })

        // 记录成本
        await this.costRepo.save({
          taskId,
          model: model, // 使用job.data中的enum值，而不是aiResponse.model
          tokens: aiResponse.tokens.total,
          cost: aiResponse.cost,
        } as any)
      }

      // 发送进度：90% - 更新任务状态
      this.tasksGateway.emitTaskProgress({
        taskId,
        progress: 90,
        message: '正在更新任务状态',
        currentStep: 'finalizing',
      })

      // 更新任务状态为 COMPLETED
      let completedProgress: any

      if (isMultiModelTask) {
        // 多模型类型：保留三模型进度信息
        completedProgress = {
          gpt4: { status: 'completed', message: '✅ 完成' },
          claude: { status: 'completed', message: '✅ 完成' },
          domestic: { status: 'completed', message: '✅ 完成' },
        }
      } else {
        // 其他类型：使用单模型进度
        completedProgress = {}
        completedProgress[modelField] = {
          status: 'completed',
          message: '✅ 完成',
          duration_ms: executionTimeMs,
          tokens: aiResponse.tokens.total,
          cost: aiResponse.cost,
        }
      }

      // 根据任务类型决定如何保存result
      let resultData: any
      if (isMultiModelTask) {
        // 多模型类型: content是JSON字符串，需要解析成对象保存
        resultData = JSON.parse(aiResponse.content as string)
      } else {
        // 其他类型: 保持原有格式 {content: "..."}
        resultData = { content: aiResponse.content }
      }

      await this.aiTaskRepo.update(taskId, {
        status: TaskStatus.COMPLETED,
        generationStage: GenerationStage.COMPLETED,
        result: resultData,
        completedAt: new Date(),
        progressDetails: completedProgress,
      })

      // ✅ 根据任务类型输出不同的日志
      if (isMultiModelTask) {
        this.logger.log(
          `AI task ${taskId} (${type}) completed in ${executionTimeMs}ms with 3 models (GPT-4, Claude, Domestic)`,
        )
      } else {
        this.logger.log(
          `AI task ${taskId} completed in ${executionTimeMs}ms, tokens: ${aiResponse.tokens.total}, cost: $${aiResponse.cost.toFixed(4)}`,
        )
      }

      // 检查成本告警
      try {
        // 检查任务成本是否异常
        const taskAlert = await this.costMonitoring.checkTaskCostAlert(
          taskId,
          job.data.projectId || 'unknown',
        )
        if (taskAlert) {
          await this.costMonitoring.sendCostAlert(taskAlert)
        }

        // 检查项目总成本是否超过阈值
        if (job.data.projectId) {
          const projectAlert = await this.costMonitoring.checkProjectCostAlert(job.data.projectId)
          if (projectAlert) {
            await this.costMonitoring.sendCostAlert(projectAlert)
          }
        }
      } catch (alertError) {
        // 告警失败不应该影响任务完成
        this.logger.error(`Cost alert check failed for task ${taskId}: ${alertError.message}`)
      }

      // 发送完成事件：100%
      this.tasksGateway.emitTaskCompleted({
        taskId,
        type,
        status: 'completed',
        message: 'AI任务处理完成',
        result: { content: aiResponse.content },
        executionTimeMs,
        cost: aiResponse.cost,
      })

      // 发送内部事件供AssessmentEventListener监听
      this.eventEmitter.emit('task:completed', {
        taskId,
        type,
        status: 'completed',
        result: { content: aiResponse.content },
        executionTimeMs,
        cost: aiResponse.cost,
      })

      return {
        taskId,
        output: { content: aiResponse.content },
        tokens: aiResponse.tokens.total,
        cost: aiResponse.cost,
        executionTimeMs,
      }
    } catch (error) {
      this.logger.error(`AI task ${taskId} failed: ${error.message}`, error.stack)

      // 更新任务状态为 FAILED
      await this.aiTaskRepo.update(taskId, {
        status: TaskStatus.FAILED,
        errorMessage: error.message,
      })

      // 记录失败事件（只在model存在时）
      if (model) {
        await this.eventRepo.save({
          taskId,
          model,
          input,
          errorMessage: error.message,
          executionTimeMs: Date.now() - startTime,
        })
      }

      // 发送失败事件
      this.tasksGateway.emitTaskFailed({
        taskId,
        error: error.message,
        failedAt: new Date(),
      })

      throw error
    } finally {
      // 清理keep-alive定时器
      clearInterval(keepAliveInterval)
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Job ${job.id} is now active`)
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed successfully`)
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed with error: ${error.message}`)
  }

  /**
   * Build prompt based on task type
   */
  private buildPrompt(
    type: string,
    input: Record<string, any>,
  ): { prompt: string; systemPrompt: string } {
    switch (type) {
      case 'summary':
        // 综述生成 - 使用详细的 prompt 模板
        return {
          systemPrompt:
            '你是一名资深IT咨询师，专注于IT标准的成熟度评估。请对以下IT标准文档进行综述，并重点分析多个文档之间的关系、冲突和差异。',
          prompt: `**输入标准文档**：
${input.standardDocument || input.text || ''}

**CRITICAL: 你必须直接输出纯JSON格式，不要包含任何解释、注释、markdown代码块或其他文本。只输出JSON对象本身。**

**输出要求**：
1. **结构要求**：必须输出JSON格式，包含以下字段：
   {
     "title": "标准名称（如果是多个文档，请用综述性的标题，如"XX领域数据安全管理办法综述"）",
     "overview": "标准总体描述（200-300字）",
     "key_areas": [
       {
         "name": "关键领域1",
         "description": "描述（50-100字）",
         "importance": "HIGH/MEDIUM/LOW"
       }
     ],
     "scope": "标准适用范围",
     "key_requirements": ["核心要求1", "核心要求2"],
     "compliance_level": "合规级别说明",
     "document_comparison": {
       "relationships": "说明文档之间的关系（如：补充关系、并行关系、层级关系等，200-300字）",
       "conflicts": [
         {
           "topic": "冲突或差异的主题",
           "description": "详细描述冲突内容，包括具体要求的对比（100-200字）",
           "severity": "HIGH/MEDIUM/LOW",
           "documents_involved": ["文档A名称", "文档B名称"]
         }
       ],
       "similarities": [
         {
           "topic": "相同或相似的主题",
           "description": "描述相似之处（50-100字）"
         }
       ]
     }
   }

2. **文档对比分析要求（重要）**：
   - **识别文档关系**：分析输入的多个文档之间的关系
     * 是否有层级关系（如上位法vs下位法）
     * 是否有领域分工（如银行业vs保险业）
     * 是否有互补关系

   - **找出冲突和差异**：
     * **时间要求冲突**：如日志存档，一个要求半年，一个要求三个月
     * **标准要求冲突**：如密码长度要求不同
     * **流程要求差异**：如审批流程的层级不同
     * **责任主体差异**：如某个岗位的职责范围不同
     * 按严重程度标记：HIGH（完全冲突）、MEDIUM（差异较大）、LOW（细微差异）

   - **找出相似之处**：
     * 共同的管理原则
     * 相似的控制措施
     * 一致的目标要求

3. **内容要求**：
   - 提炼标准的核心目标和价值主张
   - 识别5-8个关键领域
   - 每个关键领域包含简短描述和重要性评级
   - 核心要求不超过10条，每条不超过50字
   - **重点：document_comparison字段必须详细、准确**

4. **风格要求**：
   - 使用专业术语，面向IT专业人士
   - 简洁明了，避免冗余
   - 保持中立客观，不加主观评价
   - 使用中文输出

**注意**：
- 直接输出JSON对象，不要使用markdown代码块标记
- 不要在JSON前后添加任何解释性文字
- 第一个字符必须是左花括号，最后一个字符必须是右花括号
- 确保JSON格式完全正确，可以被标准JSON解析器解析
- **如果输入包含多个文档，必须详细分析它们之间的关系、冲突和相似之处**`,
        }

      case 'clustering':
        // 聚类生成 - 使用详细的 prompt 模板
        const documents = input.documents || []
        const documentsText = documents
          .map(
            (doc: any, index: number) =>
              `**文档${index + 1} - ID: ${doc.id}**
**文档名称**: ${doc.name}
**文档内容**:
${doc.content}

---`,
          )
          .join('\n\n')

        return {
          systemPrompt:
            '你是一名资深IT咨询师，专注于跨标准的条款聚类分析。请对以下多个标准文档进行三层结构的智能聚类分析，将相似的要求合并到同一类别中。',
          prompt: `**输入多个标准文档**：
${documentsText}

**重要提示**：请严格按照JSON格式输出，不要添加任何注释或markdown标记。确保JSON完整且格式正确。

**输出要求**：
1. **三层结构要求**：必须输出完整的JSON格式（不要截断）：
   {
     "categories": [
       {
         "id": "category_1",
         "name": "安全管理体系",
         "description": "组织层面的安全管理框架、策略制定、角色职责等管理类要求",
         "clusters": [...]
       }
     ],
     "clustering_logic": "整体聚类逻辑说明",
     "coverage_summary": {
       "by_document": {},
       "overall": {
         "total_clauses": 173,
         "clustered_clauses": 171,
         "coverage_rate": 0.988
       }
     }
   }

2. **三层结构说明**：
   - **第一层 - Categories（大归类）**：按照安全领域或管理维度划分的高层分类，例如"安全管理体系"、"技术安全控制"、"物理安全"、"人员安全"等。通常3-6个大类。
   - **第二层 - Clusters（聚类条目）**：每个大类下的具体控制要求合并。这是聚类的核心层，将不同文档中相似的条款合并到一起。
   - **第三层 - Clauses（条款）**：每个聚类下来自不同文档的原始条款，带文档溯源信息。

3. **聚类要求**：
   - **第一层数量**：生成3-6个大归类（Categories）
   - **跨文档合并相似要求**：如果多个文档有相似的条款，应该归入同一个聚类
   - 确保**100%覆盖**所有文档的所有条款
   - **聚类描述必须详细**：每个cluster的description字段必须详细描述（150-300字）

4. **条款溯源**：
   - source_document_id: 文档ID
   - source_document_name: 文档名称
   - clause_id: 条款编号
   - clause_text: 条款内容摘要（80-150字）
   - rationale: 说明为什么归入此聚类（30-80字）
   - importance: HIGH/MEDIUM/LOW
   - risk_level: HIGH/MEDIUM/LOW

**注意**：
- 严格输出JSON格式，不要添加任何额外的解释或注释
- 聚类的核心价值是"合并相似要求"
- **不要过度限制聚类数量**：根据条款的实际相似性自然聚合`,
        }

      case 'standard_interpretation':
        // 标准解读生成
        return {
          systemPrompt:
            '你是一名IT标准解读专家。请对以下标准进行深度解读，帮助用户全面理解标准的要求和实施方法。',
          prompt: `**标准文档**：
${input.standardDocument.name}

${input.standardDocument.content.substring(0, 15000)}

**解读要求**：
1. 概述：标准的制定背景、适用范围、核心目标
2. 关键术语：标准中的重要术语和定义
3. 关键要求：逐条解读标准的关键要求（按条款编号组织）
4. 实施指引：如何落地实施该标准，包含实施步骤、注意事项、最佳实践

**输出格式**（严格遵循以下JSON格式）：
\`\`\`json
{
  "overview": {
    "background": "标准制定背景",
    "scope": "适用范围",
    "core_objectives": ["核心目标1", "核心目标2"],
    "target_audience": ["目标受众1", "目标受众2"]
  },
  "key_terms": [
    {
      "term": "术语名称",
      "definition": "术语定义",
      "explanation": "详细解释"
    }
  ],
  "key_requirements": [
    {
      "clause_id": "条款编号",
      "clause_text": "条款内容",
      "interpretation": "解读说明",
      "compliance_criteria": ["合规标准1", "合规标准2"],
      "priority": "HIGH/MEDIUM/LOW"
    }
  ],
  "implementation_guidance": {
    "preparation": ["准备工作1", "准备工作2"],
    "implementation_steps": [
      {
        "phase": "阶段名称",
        "steps": ["步骤1", "步骤2"]
      }
    ],
    "best_practices": ["最佳实践1", "最佳实践2"],
    "common_pitfalls": ["常见误区1", "常见误区2"],
    "timeline_estimate": "预估时间",
    "resource_requirements": "所需资源说明"
  }
}
\`\`\`

**CRITICAL: 你必须直接输出纯JSON格式，不要包含任何解释、注释、markdown代码块或其他文本。只输出JSON对象本身。**`,
        }

      case 'action_plan':
        // 改进措施生成 - 使用详细的 prompt 模板
        const targetMaturity = input.targetMaturity || 3.5
        const currentMaturity = 2.5 // 默认当前成熟度

        // 生成数据安全领域的主要聚类和改进措施
        const clusters = [
          {
            clusterName: '访问控制管理',
            clusterId: 'cluster_001',
            currentLevel: 2.0,
            targetLevel: targetMaturity,
            gap: targetMaturity - 2.0,
            priority: targetMaturity > 3.5 ? 'high' : ('medium' as 'high' | 'medium' | 'low'),
          },
          {
            clusterName: '数据保护',
            clusterId: 'cluster_002',
            currentLevel: 2.3,
            targetLevel: targetMaturity,
            gap: targetMaturity - 2.3,
            priority: targetMaturity > 4.0 ? 'high' : ('medium' as 'high' | 'medium' | 'low'),
          },
          {
            clusterName: '安全监控',
            clusterId: 'cluster_003',
            currentLevel: 1.8,
            targetLevel: targetMaturity,
            gap: targetMaturity - 1.8,
            priority: 'high' as 'high' | 'medium' | 'low',
          },
          {
            clusterName: '安全策略与制度',
            clusterId: 'cluster_004',
            currentLevel: 2.5,
            targetLevel: targetMaturity,
            gap: targetMaturity - 2.5,
            priority: 'medium' as 'high' | 'medium' | 'low',
          },
          {
            clusterName: '合规管理',
            clusterId: 'cluster_005',
            currentLevel: 2.2,
            targetLevel: targetMaturity,
            gap: targetMaturity - 2.2,
            priority: 'medium' as 'high' | 'medium' | 'low',
          },
          {
            clusterName: '安全培训与意识',
            clusterId: 'cluster_006',
            currentLevel: 2.0,
            targetLevel: targetMaturity,
            gap: targetMaturity - 2.0,
            priority: 'low' as 'high' | 'medium' | 'low',
          },
        ]

        // 生成每个聚类的改进措施 prompt
        const prompts = clusters.map((cluster) => generateActionPlanPrompt(cluster))

        return {
          systemPrompt:
            '你是一位资深的数据安全咨询专家，擅长基于CMMI成熟度模型为企业制定数据安全改进路线图。',
          prompt: `请基于以下目标成熟度为数据安全项目生成详细的改进措施。

**项目目标**:
- 当前整体成熟度: Level ${currentMaturity}
- 目标成熟度: Level ${targetMaturity}
- 差距: ${(targetMaturity - currentMaturity).toFixed(2)} 级

**需要改进的聚类领域**:
${clusters.map((c) => `- ${c.clusterName} (当前: ${c.currentLevel}, 目标: ${c.targetLevel}, 差距: ${c.gap.toFixed(2)}, 优先级: ${c.priority})`).join('\n')}

${prompts[0]}

请为每个聚类生成详细的改进措施，输出格式为JSON，包含所有必要字段（title, description, implementation_steps, timeline, resources_needed, risks, kpi_metrics等）。
`,
        }

      case 'code_generation':
        return {
          systemPrompt:
            'You are an expert software developer. Write clean, efficient, well-documented code following best practices.',
          prompt: `Generate code based on the following requirements:\n\n${input.requirements}`,
        }

      case 'code_review':
        return {
          systemPrompt:
            'You are an experienced code reviewer. Provide constructive feedback on code quality, potential bugs, and improvements.',
          prompt: `Review the following code:\n\n${input.code}`,
        }

      case 'translation':
        return {
          systemPrompt: `You are a professional translator. Translate accurately while preserving meaning and tone.`,
          prompt: `Translate the following text to ${input.targetLanguage}:\n\n${input.text}`,
        }

      case 'analysis':
        return {
          systemPrompt: 'You are a data analyst. Provide insightful analysis with clear reasoning.',
          prompt: `Analyze the following data:\n\n${JSON.stringify(input.data, null, 2)}`,
        }

      default:
        return {
          systemPrompt: 'You are a helpful AI assistant.',
          prompt: input.prompt || JSON.stringify(input),
        }
    }
  }
}
