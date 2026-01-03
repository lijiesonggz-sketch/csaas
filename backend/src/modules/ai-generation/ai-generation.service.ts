import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SummaryGenerator, SummaryGenerationInput } from './generators/summary.generator'
import {
  ClusteringGenerator,
  ClusteringGenerationInput,
} from './generators/clustering.generator'
import { MatrixGenerator, MatrixGenerationInput, MatrixGenerationOutput } from './generators/matrix.generator'
import {
  QuestionnaireGenerator,
  QuestionnaireGenerationInput,
} from './generators/questionnaire.generator'
import {
  ActionPlanGenerator,
  ActionPlanGenerationInput,
} from './generators/action-plan.generator'
import { QualityValidationService } from '../quality-validation/quality-validation.service'
import { ResultAggregatorService } from '../result-aggregation/result-aggregator.service'
import { TasksGateway } from '../ai-tasks/gateways/tasks.gateway'
import { AITask, AITaskType, TaskStatus } from '../../database/entities/ai-task.entity'
import { Project, ProjectStatus } from '../../database/entities/project.entity'
import { User, UserRole } from '../../database/entities/user.entity'
import { SurveyResponse } from '../../database/entities/survey-response.entity'
import { ReviewStatus } from '../../database/entities/ai-generation-result.entity'

export interface GenerationRequest {
  taskId: string
  generationType: AITaskType
  input: any // 不同类型的生成任务有不同的输入结构
  projectId?: string // 可选的项目ID，如果提供则使用该项目，否则使用默认项目
}

export interface GenerationResponse {
  taskId: string
  selectedResult: Record<string, any>
  selectedModel: string
  confidenceLevel: string
  qualityScores: {
    structural: number
    semantic: number
    detail: number
  }
}

/**
 * AI生成服务
 * 统一的AI生成接口，负责调度不同的生成器
 */
@Injectable()
export class AIGenerationService {
  private readonly logger = new Logger(AIGenerationService.name)

  constructor(
    @InjectRepository(AITask)
    private readonly aiTaskRepository: Repository<AITask>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SurveyResponse)
    private readonly surveyResponseRepository: Repository<SurveyResponse>,
    private readonly summaryGenerator: SummaryGenerator,
    private readonly clusteringGenerator: ClusteringGenerator,
    private readonly matrixGenerator: MatrixGenerator,
    private readonly questionnaireGenerator: QuestionnaireGenerator,
    private readonly actionPlanGenerator: ActionPlanGenerator,
    private readonly qualityValidation: QualityValidationService,
    private readonly resultAggregator: ResultAggregatorService,
    private readonly tasksGateway: TasksGateway,
  ) {}

  /**
   * 执行AI生成任务
   * @param request 生成请求
   * @returns 生成响应
   */
  async generateContent(request: GenerationRequest): Promise<GenerationResponse> {
    this.logger.log(
      `Starting content generation: taskId=${request.taskId}, type=${request.generationType}`,
    )

    switch (request.generationType) {
      case AITaskType.SUMMARY:
        return this.generateSummary(request)

      case AITaskType.CLUSTERING:
        return this.generateClustering(request)

      case AITaskType.MATRIX:
        return this.generateMatrix(request)

      case AITaskType.QUESTIONNAIRE:
        return this.generateQuestionnaire(request)

      case AITaskType.ACTION_PLAN:
        return this.generateActionPlan(request)

      default:
        throw new Error(`Unknown generation type: ${request.generationType}`)
    }
  }

  /**
   * 生成综述
   */
  private async generateSummary(request: GenerationRequest): Promise<GenerationResponse> {
    const input = request.input as SummaryGenerationInput
    const startTime = Date.now()

    try {
      // 0. 确保AITask存在（创建或查找）
      await this.ensureTaskExists(request.taskId, request.generationType, input, request.projectId)

      // 发送初始进度
      this.tasksGateway.emitTaskProgress({
        taskId: request.taskId,
        progress: 0,
        message: '任务已创建，准备开始生成...',
        currentStep: '初始化',
      })

      // 1. 调用三模型生成
      this.tasksGateway.emitTaskProgress({
        taskId: request.taskId,
        progress: 10,
        message: '正在调用三个AI模型并行生成综述...',
        currentStep: '模型生成',
      })

      const { gpt4, claude, domestic } = await this.summaryGenerator.generate(input)

      this.tasksGateway.emitTaskProgress({
        taskId: request.taskId,
        progress: 60,
        message: '三模型生成完成，开始质量验证...',
        currentStep: '质量验证',
      })

      // 2. 质量验证
      const validationReport = await this.qualityValidation.validateQuality({
        gpt4,
        claude,
        domestic,
      })

      this.tasksGateway.emitTaskProgress({
        taskId: request.taskId,
        progress: 80,
        message: '质量验证完成，开始结果聚合...',
        currentStep: '结果聚合',
      })

      // 3. 结果聚合
      const aggregationOutput = await this.resultAggregator.aggregate({
        taskId: request.taskId,
        generationType: request.generationType,
        gpt4Result: gpt4,
        claudeResult: claude,
        domesticResult: domestic,
        validationReport,
      })

      // 4. 构建响应
      const response: GenerationResponse = {
        taskId: request.taskId,
        selectedResult: aggregationOutput.selectedResult,
        selectedModel: aggregationOutput.selectedModel,
        confidenceLevel: aggregationOutput.confidenceLevel,
        qualityScores: aggregationOutput.qualityScores,
      }

      this.logger.log(
        `Summary generation completed: confidence=${response.confidenceLevel}, model=${response.selectedModel}`,
      )

      // 更新数据库中的任务状态为completed
      await this.aiTaskRepository.update(
        { id: request.taskId },
        {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
        }
      )
      this.logger.log(`Updated task ${request.taskId} status to COMPLETED in database`)

      // 发送完成事件
      const executionTime = Date.now() - startTime
      this.tasksGateway.emitTaskCompleted({
        taskId: request.taskId,
        status: 'completed',
        message: '综述生成完成！',
        result: response,
        executionTimeMs: executionTime,
        cost: 0, // TODO: 从cost tracking获取实际成本
      })

      return response
    } catch (error) {
      // 更新数据库中的任务状态为failed
      await this.aiTaskRepository.update(
        { id: request.taskId },
        {
          status: TaskStatus.FAILED,
          completedAt: new Date(),
        }
      )
      this.logger.error(`Updated task ${request.taskId} status to FAILED in database`)

      // 发送失败事件
      const executionTime = Date.now() - startTime
      this.tasksGateway.emitTaskCompleted({
        taskId: request.taskId,
        status: 'failed',
        message: `生成失败: ${error.message}`,
        executionTimeMs: executionTime,
        cost: 0,
      })

      throw error
    }
  }

  /**
   * 生成聚类
   */
  private async generateClustering(request: GenerationRequest): Promise<GenerationResponse> {
    const input = request.input as ClusteringGenerationInput
    const startTime = Date.now()

    try {
      // 0. 确保AITask存在
      await this.ensureTaskExists(request.taskId, request.generationType, input, request.projectId)

      // 发送初始进度
      this.tasksGateway.emitTaskProgress({
        taskId: request.taskId,
        progress: 0,
        message: `任务已创建，准备对${input.documents.length}个文档进行聚类...`,
        currentStep: '初始化',
      })

      // 1. 调用三模型生成
      this.tasksGateway.emitTaskProgress({
        taskId: request.taskId,
        progress: 10,
        message: '正在调用三个AI模型并行生成聚类...',
        currentStep: '模型生成',
      })

      // 创建进度更新回调
      const onProgress = async (progress: {
        stage: string
        model?: string
        status: string
        details?: any
      }) => {
        // 更新AITask的progress_details
        try {
          await this.aiTaskRepository.update(request.taskId, {
            generationStage: progress.stage as any,
            progressDetails: progress.details || {
              validation_stage: 'pending',
              aggregation_stage: 'pending',
            },
          })
        } catch (error) {
          this.logger.warn(`Failed to update task progress: ${error.message}`)
        }
      }

      const { gpt4, claude, domestic } = await this.clusteringGenerator.generate(input, onProgress)

      this.tasksGateway.emitTaskProgress({
        taskId: request.taskId,
        progress: 60,
        message: '三模型生成完成，开始质量验证...',
        currentStep: '质量验证',
      })

      // 更新数据库状态为质量验证
      await this.aiTaskRepository.update(request.taskId, {
        generationStage: 'quality_validation' as any,
      })

      // 2. 质量验证
      const validationReport = await this.qualityValidation.validateQuality({
        gpt4,
        claude,
        domestic,
      })

      this.tasksGateway.emitTaskProgress({
        taskId: request.taskId,
        progress: 80,
        message: '质量验证完成，开始结果聚合...',
        currentStep: '结果聚合',
      })

      // 更新数据库状态为聚合
      await this.aiTaskRepository.update(request.taskId, {
        generationStage: 'aggregating' as any,
      })

      // 3. 结果聚合
      const aggregationOutput = await this.resultAggregator.aggregate({
        taskId: request.taskId,
        generationType: request.generationType,
        gpt4Result: gpt4,
        claudeResult: claude,
        domesticResult: domestic,
        validationReport,
      })

      // 4. 构建响应
      const response: GenerationResponse = {
        taskId: request.taskId,
        selectedResult: aggregationOutput.selectedResult,
        selectedModel: aggregationOutput.selectedModel,
        confidenceLevel: aggregationOutput.confidenceLevel,
        qualityScores: aggregationOutput.qualityScores,
      }

      this.logger.log(
        `Clustering generation completed: confidence=${response.confidenceLevel}, model=${response.selectedModel}, clusters=${response.selectedResult.clusters?.length || 0}`,
      )

      // 更新数据库中的任务状态为completed
      await this.aiTaskRepository.update(
        { id: request.taskId },
        {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
        }
      )
      this.logger.log(`Updated task ${request.taskId} status to COMPLETED in database`)

      // 发送完成事件
      const executionTime = Date.now() - startTime
      this.tasksGateway.emitTaskCompleted({
        taskId: request.taskId,
        status: 'completed',
        message: '聚类生成完成！',
        result: response,
        executionTimeMs: executionTime,
        cost: 0, // TODO: 从cost tracking获取实际成本
      })

      return response
    } catch (error) {
      // 更新数据库中的任务状态为failed
      await this.aiTaskRepository.update(
        { id: request.taskId },
        {
          status: TaskStatus.FAILED,
          completedAt: new Date(),
        }
      )
      this.logger.error(`Updated task ${request.taskId} status to FAILED in database`)

      // 发送失败事件
      const executionTime = Date.now() - startTime
      this.tasksGateway.emitTaskCompleted({
        taskId: request.taskId,
        status: 'failed',
        message: `聚类生成失败: ${error.message}`,
        executionTimeMs: executionTime,
        cost: 0,
      })

      throw error
    }
  }

  /**
   * 生成成熟度矩阵
   */
  private async generateMatrix(request: GenerationRequest): Promise<GenerationResponse> {
    const input = request.input as MatrixGenerationInput
    const startTime = Date.now()

    try {
      // 0. 确保AITask存在
      await this.ensureTaskExists(request.taskId, request.generationType, input, request.projectId)

      // 发送初始进度
      this.tasksGateway.emitTaskProgress({
        taskId: request.taskId,
        progress: 0,
        message: '任务已创建，准备生成成熟度矩阵...',
        currentStep: '初始化',
      })

      // 1. 调用三模型生成
      this.tasksGateway.emitTaskProgress({
        taskId: request.taskId,
        progress: 10,
        message: '正在调用三个AI模型并行生成成熟度矩阵...',
        currentStep: '模型生成',
      })

      const { gpt4, claude, domestic } = await this.matrixGenerator.generate(input)

      this.tasksGateway.emitTaskProgress({
        taskId: request.taskId,
        progress: 60,
        message: '三模型生成完成，开始质量验证...',
        currentStep: '质量验证',
      })

      // 2. 质量验证
      const validationReport = await this.qualityValidation.validateQuality({
        gpt4,
        claude,
        domestic,
      })

      this.tasksGateway.emitTaskProgress({
        taskId: request.taskId,
        progress: 80,
        message: '质量验证完成，开始结果聚合...',
        currentStep: '结果聚合',
      })

      // 3. 结果聚合
      const aggregationOutput = await this.resultAggregator.aggregate({
        taskId: request.taskId,
        generationType: request.generationType,
        gpt4Result: gpt4,
        claudeResult: claude,
        domesticResult: domestic,
        validationReport,
      })

      // 4. 构建响应
      const response: GenerationResponse = {
        taskId: request.taskId,
        selectedResult: aggregationOutput.selectedResult,
        selectedModel: aggregationOutput.selectedModel,
        confidenceLevel: aggregationOutput.confidenceLevel,
        qualityScores: aggregationOutput.qualityScores,
      }

      this.logger.log(
        `Matrix generation completed: confidence=${response.confidenceLevel}, model=${response.selectedModel}, rows=${response.selectedResult.matrix?.length || 0}`,
      )

      // 更新数据库中的任务状态为completed
      await this.aiTaskRepository.update(
        { id: request.taskId },
        {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
        }
      )
      this.logger.log(`Updated task ${request.taskId} status to COMPLETED in database`)

      // 发送完成事件
      const executionTime = Date.now() - startTime
      this.tasksGateway.emitTaskCompleted({
        taskId: request.taskId,
        status: 'completed',
        message: '成熟度矩阵生成完成！',
        result: response,
        executionTimeMs: executionTime,
        cost: 0, // TODO: 从cost tracking获取实际成本
      })

      return response
    } catch (error) {
      // 更新数据库中的任务状态为failed
      await this.aiTaskRepository.update(
        { id: request.taskId },
        {
          status: TaskStatus.FAILED,
          completedAt: new Date(),
        }
      )
      this.logger.error(`Updated task ${request.taskId} status to FAILED in database`)

      // 发送失败事件
      const executionTime = Date.now() - startTime
      this.tasksGateway.emitTaskCompleted({
        taskId: request.taskId,
        status: 'failed',
        message: `矩阵生成失败: ${error.message}`,
        executionTimeMs: executionTime,
        cost: 0,
      })

      throw error
    }
  }

  /**
   * 生成调研问卷
   */
  private async generateQuestionnaire(request: GenerationRequest): Promise<GenerationResponse> {
    const input = request.input as { matrixTaskId: string; temperature?: number; maxTokens?: number }
    const startTime = Date.now()

    try {
      // 0. 确保AITask存在
      await this.ensureTaskExists(request.taskId, request.generationType, input, request.projectId)

      // 发送初始进度
      this.tasksGateway.emitTaskProgress({
        taskId: request.taskId,
        progress: 0,
        message: '任务已创建，正在获取矩阵结果...',
        currentStep: '初始化',
      })

      // 1. 从数据库获取矩阵结果（避免HTTP请求体过大）
      const matrixResult = await this.getFinalResult(input.matrixTaskId)

      if (!matrixResult) {
        throw new Error(`Matrix result not found for task ${input.matrixTaskId}`)
      }

      this.logger.log(`Retrieved matrix result with ${matrixResult.matrix?.length || 0} clusters`)

      // 2. 构造问卷生成输入
      const questionnaireInput: QuestionnaireGenerationInput = {
        matrixResult: matrixResult as MatrixGenerationOutput,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
      }

      // 3. 调用三模型生成
      this.tasksGateway.emitTaskProgress({
        taskId: request.taskId,
        progress: 10,
        message: '正在调用三个AI模型并行生成问卷...',
        currentStep: '模型生成',
      })

      const { gpt4, claude, domestic } = await this.questionnaireGenerator.generate(questionnaireInput)

      this.tasksGateway.emitTaskProgress({
        taskId: request.taskId,
        progress: 60,
        message: '三模型生成完成，开始质量验证...',
        currentStep: '质量验证',
      })

      // 2. 质量验证
      const validationReport = await this.qualityValidation.validateQuality({
        gpt4,
        claude,
        domestic,
      })

      this.tasksGateway.emitTaskProgress({
        taskId: request.taskId,
        progress: 80,
        message: '质量验证完成，开始结果聚合...',
        currentStep: '结果聚合',
      })

      // 3. 结果聚合
      const aggregationOutput = await this.resultAggregator.aggregate({
        taskId: request.taskId,
        generationType: request.generationType,
        gpt4Result: gpt4,
        claudeResult: claude,
        domesticResult: domestic,
        validationReport,
      })

      // 4. 构建响应
      const response: GenerationResponse = {
        taskId: request.taskId,
        selectedResult: aggregationOutput.selectedResult,
        selectedModel: aggregationOutput.selectedModel,
        confidenceLevel: aggregationOutput.confidenceLevel,
        qualityScores: aggregationOutput.qualityScores,
      }

      this.logger.log(
        `Questionnaire generation completed: confidence=${response.confidenceLevel}, model=${response.selectedModel}, questions=${response.selectedResult.questionnaire?.length || 0}`,
      )

      // 更新数据库中的任务状态为completed
      await this.aiTaskRepository.update(
        { id: request.taskId },
        {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
        }
      )
      this.logger.log(`Updated task ${request.taskId} status to COMPLETED in database`)

      // 发送完成事件
      const executionTime = Date.now() - startTime
      this.tasksGateway.emitTaskCompleted({
        taskId: request.taskId,
        status: 'completed',
        message: '调研问卷生成完成！',
        result: response,
        executionTimeMs: executionTime,
        cost: 0, // TODO: 从cost tracking获取实际成本
      })

      return response
    } catch (error) {
      // 更新数据库中的任务状态为failed
      await this.aiTaskRepository.update(
        { id: request.taskId },
        {
          status: TaskStatus.FAILED,
          completedAt: new Date(),
        }
      )
      this.logger.error(`Updated task ${request.taskId} status to FAILED in database`)

      // 发送失败事件
      const executionTime = Date.now() - startTime
      this.tasksGateway.emitTaskCompleted({
        taskId: request.taskId,
        status: 'failed',
        message: `问卷生成失败: ${error.message}`,
        executionTimeMs: executionTime,
        cost: 0,
      })

      throw error
    }
  }

  /**
   * 生成落地措施
   */
  private async generateActionPlan(request: GenerationRequest): Promise<GenerationResponse> {
    const input = request.input as {
      matrixTaskId: string
      surveyResponseId: string
      temperature?: number
      maxTokens?: number
    }
    const startTime = Date.now()

    try {
      // 0. 确保AITask存在
      await this.ensureTaskExists(request.taskId, request.generationType, input, request.projectId)

      // 发送初始进度
      this.tasksGateway.emitTaskProgress({
        taskId: request.taskId,
        progress: 0,
        message: '任务已创建，正在获取矩阵和问卷填写结果...',
        currentStep: '初始化',
      })

      // 1. 从数据库获取矩阵结果和问卷填写结果
      const matrixResult = await this.getFinalResult(input.matrixTaskId)

      // 从SurveyResponse表获取用户填写的问卷答案
      const surveyResponse = await this.surveyResponseRepository.findOne({
        where: { id: input.surveyResponseId },
        relations: ['questionnaireTask'],
      })

      if (!matrixResult) {
        throw new Error(`Matrix result not found for task ${input.matrixTaskId}`)
      }

      if (!surveyResponse) {
        throw new Error(`Survey response not found: ${input.surveyResponseId}`)
      }

      if (surveyResponse.status !== 'submitted' && surveyResponse.status !== 'completed') {
        throw new Error(`Survey must be submitted before generating action plan. Current status: ${surveyResponse.status}`)
      }

      // 获取问卷模板（用于理解问题结构）
      const questionnaireResult = await this.getFinalResult(surveyResponse.questionnaireTaskId)

      if (!questionnaireResult) {
        throw new Error(`Questionnaire template not found for task ${surveyResponse.questionnaireTaskId}`)
      }

      // 合并问卷模板和用户答案，构造完整的问卷填写结果
      const questionnaireWithAnswers = {
        ...questionnaireResult,
        surveyResponse: {
          respondentName: surveyResponse.respondentName,
          respondentDepartment: surveyResponse.respondentDepartment,
          respondentPosition: surveyResponse.respondentPosition,
          answers: surveyResponse.answers,
          totalScore: surveyResponse.totalScore,
          maxScore: surveyResponse.maxScore,
          submittedAt: surveyResponse.submittedAt,
        },
      }

      this.logger.log(
        `Retrieved matrix result with ${matrixResult.matrix?.length || 0} clusters and survey response with ${Object.keys(surveyResponse.answers).length} answered questions`,
      )

      // 2. 构造落地措施生成输入（包含用户答案）
      const actionPlanInput: ActionPlanGenerationInput = {
        matrixResult: matrixResult as MatrixGenerationOutput,
        questionnaireResult: questionnaireWithAnswers as any,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
      }

      // 3. 调用三模型生成
      this.tasksGateway.emitTaskProgress({
        taskId: request.taskId,
        progress: 10,
        message: '正在调用三个AI模型并行生成落地措施...',
        currentStep: '模型生成',
      })

      const { gpt4, claude, domestic } = await this.actionPlanGenerator.generate(actionPlanInput)

      this.tasksGateway.emitTaskProgress({
        taskId: request.taskId,
        progress: 60,
        message: '三模型生成完成，开始质量验证...',
        currentStep: '质量验证',
      })

      // 4. 质量验证
      const validationReport = await this.qualityValidation.validateQuality({
        gpt4,
        claude,
        domestic,
      })

      this.tasksGateway.emitTaskProgress({
        taskId: request.taskId,
        progress: 80,
        message: '质量验证完成，开始结果聚合...',
        currentStep: '结果聚合',
      })

      // 5. 结果聚合
      const aggregationOutput = await this.resultAggregator.aggregate({
        taskId: request.taskId,
        generationType: request.generationType,
        gpt4Result: gpt4,
        claudeResult: claude,
        domesticResult: domestic,
        validationReport,
      })

      // 6. 构建响应
      const response: GenerationResponse = {
        taskId: request.taskId,
        selectedResult: aggregationOutput.selectedResult,
        selectedModel: aggregationOutput.selectedModel,
        confidenceLevel: aggregationOutput.confidenceLevel,
        qualityScores: aggregationOutput.qualityScores,
      }

      this.logger.log(
        `Action plan generation completed: confidence=${response.confidenceLevel}, model=${response.selectedModel}, actions=${response.selectedResult.action_plan?.length || 0}`,
      )

      // 更新数据库中的任务状态为completed
      await this.aiTaskRepository.update(
        { id: request.taskId },
        {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
        }
      )
      this.logger.log(`Updated task ${request.taskId} status to COMPLETED in database`)

      // 发送完成事件
      const executionTime = Date.now() - startTime
      this.tasksGateway.emitTaskCompleted({
        taskId: request.taskId,
        status: 'completed',
        message: '落地措施生成完成！',
        result: response,
        executionTimeMs: executionTime,
        cost: 0, // TODO: 从cost tracking获取实际成本
      })

      return response
    } catch (error) {
      // 更新数据库中的任务状态为failed
      await this.aiTaskRepository.update(
        { id: request.taskId },
        {
          status: TaskStatus.FAILED,
          completedAt: new Date(),
        }
      )
      this.logger.error(`Updated task ${request.taskId} status to FAILED in database`)

      // 发送失败事件
      const executionTime = Date.now() - startTime
      this.tasksGateway.emitTaskCompleted({
        taskId: request.taskId,
        status: 'failed',
        message: `落地措施生成失败: ${error.message}`,
        executionTimeMs: executionTime,
        cost: 0,
      })

      throw error
    }
  }

  /**
   * 获取任务的最终结果
   */
  async getFinalResult(taskId: string): Promise<Record<string, any> | null> {
    return this.resultAggregator.getFinalResult(taskId)
  }

  /**
   * 更新聚类结果（用户手工添加缺失条款）
   * @param taskId 任务ID
   * @param updatedCategories 更新后的categories（包含用户手工添加的条款）
   */
  async updateClusteringResult(taskId: string, updatedCategories: any[]): Promise<void> {
    this.logger.log(`Updating clustering result for task ${taskId}`)

    // 1. 获取现有的生成结果
    const result = await this.resultAggregator.getResultByTaskId(taskId)
    if (!result) {
      throw new Error(`Result not found for task ${taskId}`)
    }

    // 2. 解析现有的聚类结果
    const existingResult =
      typeof result.selectedResult === 'string'
        ? JSON.parse(result.selectedResult)
        : result.selectedResult

    // 3. 更新categories
    existingResult.categories = updatedCategories

    // 4. 重新计算覆盖率摘要
    const updatedCoverage = await this.recalculateCoverage(updatedCategories, result)

    // 5. 更新coverage_summary
    existingResult.coverage_summary = updatedCoverage

    // 6. 保存到数据库
    const updatedSelectedResult = JSON.stringify(existingResult)

    await this.resultAggregator.updateResultContent(
      result.id,
      updatedSelectedResult,
      ReviewStatus.MODIFIED, // 标记为已修改
    )

    this.logger.log(`Clustering result updated successfully for task ${taskId}`)
  }

  /**
   * 重新计算覆盖率（后端版本）
   */
  private async recalculateCoverage(
    categories: any[],
    result: any,
  ): Promise<{ by_document: Record<string, any>; overall: any }> {
    const byDocument: Record<string, any> = {}
    const taskId = result.taskId

    // 从ai_tasks表获取原始输入文档
    const task = await this.aiTaskRepository.findOne({
      where: { id: taskId },
    })

    if (!task || !task.input || !task.input.documents) {
      this.logger.warn(`Cannot recalculate coverage: task or input not found`)
      return result.selectedResult?.coverage_summary || { by_document: {}, overall: {} }
    }

    const documents = task.input.documents

    documents.forEach((doc: any) => {
      // 从聚类中提取该文档的所有条款
      const docClauses = categories
        .flatMap((cat: any) => cat.clusters || [])
        .flatMap((cluster: any) => cluster.clauses || [])
        .filter((clause: any) => clause.source_document_id === doc.id)

      // 统计文档实际条款数（去重）
      const allClauseMatches = doc.content.match(/第[一二三四五六七八九十百千]+条/g) || []
      const allClauseIds = [...new Set(allClauseMatches)] as string[]
      const actualClauseCount = allClauseIds.length

      // 统计唯一提取的条款（从聚类中）
      const uniqueClusteredIds = new Set<string>()
      docClauses.forEach((clause: any) => {
        uniqueClusteredIds.add(clause.clause_id)
      })

      // 过滤掉AI生成的、文档中不存在的条款
      const validClusteredIds = Array.from(uniqueClusteredIds).filter((id) =>
        allClauseIds.includes(id),
      )
      const finalClusteredCount = validClusteredIds.length

      // 找出缺失的条款
      const missingClauseIds = allClauseIds.filter((id) => !uniqueClusteredIds.has(id))

      byDocument[doc.id] = {
        total_clauses: actualClauseCount,
        clustered_clauses: finalClusteredCount,
        missing_clause_ids: missingClauseIds,
      }
    })

    const totalClauses = Object.values(byDocument).reduce(
      (sum: number, doc: any) => sum + doc.total_clauses,
      0,
    )
    const clusteredClauses = Object.values(byDocument).reduce(
      (sum: number, doc: any) => sum + doc.clustered_clauses,
      0,
    )

    return {
      by_document: byDocument,
      overall: {
        total_clauses: totalClauses,
        clustered_clauses: clusteredClauses,
        coverage_rate: totalClauses > 0 ? clusteredClauses / totalClauses : 0,
      },
    }
  }

  /**
   * 确保AITask存在，如果不存在则创建
   */
  private async ensureTaskExists(
    taskId: string,
    taskType: AITaskType,
    input: any,
    projectId?: string, // 可选的项目ID
  ): Promise<void> {
    // 1. 检查task是否已存在
    const existingTask = await this.aiTaskRepository.findOne({ where: { id: taskId } })
    if (existingTask) {
      this.logger.debug(`AITask ${taskId} already exists, skipping creation`)
      return
    }

    // 2. 确保有系统用户
    let systemUser = await this.userRepository.findOne({
      where: { email: 'system@csaas.local' },
    })

    if (!systemUser) {
      this.logger.log('Creating system user for AI tasks')
      systemUser = this.userRepository.create({
        email: 'system@csaas.local',
        passwordHash: 'N/A',
        name: 'System',
        role: UserRole.CONSULTANT,
      })
      await this.userRepository.save(systemUser)
    }

    // 3. 确定使用的项目ID
    let targetProjectId: string

    if (projectId) {
      // 如果提供了projectId，验证项目是否存在
      const providedProject = await this.projectRepository.findOne({
        where: { id: projectId },
      })

      if (providedProject) {
        targetProjectId = projectId
        this.logger.log(`Using provided project ${projectId} for task ${taskId}`)
      } else {
        this.logger.warn(`Provided project ${projectId} not found, falling back to default project`)
        // 回退到默认项目
        let defaultProject = await this.projectRepository.findOne({
          where: { name: 'Default Project' },
        })

        if (!defaultProject) {
          this.logger.log('Creating default project for AI tasks')
          defaultProject = this.projectRepository.create({
            name: 'Default Project',
            description: 'Auto-created default project for AI generation tasks',
            status: ProjectStatus.ACTIVE,
            ownerId: systemUser.id,
          })
          await this.projectRepository.save(defaultProject)
        }

        targetProjectId = defaultProject.id
      }
    } else {
      // 没有提供projectId，使用默认项目
      let defaultProject = await this.projectRepository.findOne({
        where: { name: 'Default Project' },
      })

      if (!defaultProject) {
        this.logger.log('Creating default project for AI tasks')
        defaultProject = this.projectRepository.create({
          name: 'Default Project',
          description: 'Auto-created default project for AI generation tasks',
          status: ProjectStatus.ACTIVE,
          ownerId: systemUser.id,
        })
        await this.projectRepository.save(defaultProject)
      }

      targetProjectId = defaultProject.id
    }

    // 4. 创建AITask
    this.logger.log(`Creating AITask ${taskId} with type ${taskType} and projectId ${targetProjectId}`)
    const newTask = this.aiTaskRepository.create({
      id: taskId,
      projectId: targetProjectId,
      type: taskType,
      status: TaskStatus.PROCESSING,
      input,
      priority: 1,
      progress: 0,
    })
    await this.aiTaskRepository.save(newTask)
  }
}
