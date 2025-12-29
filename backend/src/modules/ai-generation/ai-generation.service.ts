import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SummaryGenerator, SummaryGenerationInput } from './generators/summary.generator'
import {
  ClusteringGenerator,
  ClusteringGenerationInput,
} from './generators/clustering.generator'
import { MatrixGenerator, MatrixGenerationInput } from './generators/matrix.generator'
import {
  QuestionnaireGenerator,
  QuestionnaireGenerationInput,
} from './generators/questionnaire.generator'
import { QualityValidationService } from '../quality-validation/quality-validation.service'
import { ResultAggregatorService } from '../result-aggregation/result-aggregator.service'
import { TasksGateway } from '../ai-tasks/gateways/tasks.gateway'
import { AITask, AITaskType, TaskStatus } from '../../database/entities/ai-task.entity'
import { Project, ProjectStatus } from '../../database/entities/project.entity'
import { User, UserRole } from '../../database/entities/user.entity'

export interface GenerationRequest {
  taskId: string
  generationType: AITaskType
  input: any // 不同类型的生成任务有不同的输入结构
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
    private readonly summaryGenerator: SummaryGenerator,
    private readonly clusteringGenerator: ClusteringGenerator,
    private readonly matrixGenerator: MatrixGenerator,
    private readonly questionnaireGenerator: QuestionnaireGenerator,
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
        throw new Error('Action plan generation not yet implemented')

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
      await this.ensureTaskExists(request.taskId, request.generationType, input)

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
      await this.ensureTaskExists(request.taskId, request.generationType, input)

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

      const { gpt4, claude, domestic } = await this.clusteringGenerator.generate(input)

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
        `Clustering generation completed: confidence=${response.confidenceLevel}, model=${response.selectedModel}, clusters=${response.selectedResult.clusters?.length || 0}`,
      )

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
      await this.ensureTaskExists(request.taskId, request.generationType, input)

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
    const input = request.input as QuestionnaireGenerationInput
    const startTime = Date.now()

    try {
      // 0. 确保AITask存在
      await this.ensureTaskExists(request.taskId, request.generationType, input)

      // 发送初始进度
      this.tasksGateway.emitTaskProgress({
        taskId: request.taskId,
        progress: 0,
        message: '任务已创建，准备生成调研问卷...',
        currentStep: '初始化',
      })

      // 1. 调用三模型生成
      this.tasksGateway.emitTaskProgress({
        taskId: request.taskId,
        progress: 10,
        message: '正在调用三个AI模型并行生成问卷...',
        currentStep: '模型生成',
      })

      const { gpt4, claude, domestic } = await this.questionnaireGenerator.generate(input)

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
   * 获取任务的最终结果
   */
  async getFinalResult(taskId: string): Promise<Record<string, any> | null> {
    return this.resultAggregator.getFinalResult(taskId)
  }

  /**
   * 确保AITask存在，如果不存在则创建
   */
  private async ensureTaskExists(
    taskId: string,
    taskType: AITaskType,
    input: any,
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

    // 3. 确保有默认project（或创建一个）
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

    // 4. 创建AITask
    this.logger.log(`Creating AITask ${taskId} with type ${taskType}`)
    const newTask = this.aiTaskRepository.create({
      id: taskId,
      projectId: defaultProject.id,
      type: taskType,
      status: TaskStatus.PROCESSING,
      input,
      priority: 1,
      progress: 0,
    })
    await this.aiTaskRepository.save(newTask)
  }
}
