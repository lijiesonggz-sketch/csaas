import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import {
  AITask,
  AITaskType,
  GenerationStage,
  TaskProgressDetails,
  TaskStatus,
} from '../../database/entities/ai-task.entity'
import { AI_TASK_QUEUE, AITaskJobType } from './constants/queue.constants'
import { AITaskJobData } from './interfaces/queue-job.interface'
import { AIModel } from '../../database/entities/ai-generation-event.entity'
import { AIGenerationResult } from '../../database/entities/ai-generation-result.entity'
import { CreateAITaskDto } from './dto/create-ai-task.dto'

@Injectable()
export class AITasksService {
  private readonly logger = new Logger(AITasksService.name)
  private static readonly STANDARD_INTERPRETATION_STALE_MS = 20 * 60 * 1000
  private static readonly QUESTIONNAIRE_STALE_MS = 20 * 60 * 1000

  constructor(
    @InjectRepository(AITask)
    private readonly aiTaskRepo: Repository<AITask>,
    @InjectRepository(AIGenerationResult)
    private readonly generationResultRepo: Repository<AIGenerationResult>,
    @InjectQueue(AI_TASK_QUEUE)
    private readonly aiTaskQueue: Queue<AITaskJobData>,
  ) {}

  async createTask(dto: CreateAITaskDto, userId: string): Promise<AITask> {
    // 创建任务记录
    const task = this.aiTaskRepo.create({
      projectId: dto.projectId,
      type: dto.type as any, // Type will be validated by DTO
      input: dto.input,
      status: TaskStatus.PENDING,
      priority: dto.priority || 1,
    })

    await this.aiTaskRepo.save(task)
    this.logger.log(`Created AI task ${task.id}`)

    // 添加到队列
    // 对于clustering/matrix/questionnaire类型，不设置model参数（让Processor使用对应的Generator进行三模型并行）
    // 对于其他类型，使用dto.model或默认第一模型槽位（当前配置为 DeepSeek）
    const isMultiModelTask = [
      'clustering',
      'matrix',
      'questionnaire',
      'standard_interpretation',
      'standard_related_search',
      'standard_version_compare',
      'standard_cross_compare',
    ].includes(dto.type)

    const jobData: AITaskJobData = {
      taskId: task.id,
      projectId: dto.projectId,
      type: dto.type,
      input: dto.input,
      model: isMultiModelTask ? undefined : dto.model || AIModel.GPT4,
      priority: dto.priority,
      userId,
    }

    await this.aiTaskQueue.add(AITaskJobType.PROCESS_TASK, jobData, {
      priority: dto.priority,
      attempts: 1,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    })

    this.logger.log(`Added task ${task.id} to queue`)

    return this.normalizeQuestionnaireTask(task)
  }

  async getTask(taskId: string): Promise<AITask> {
    let task = await this.aiTaskRepo.findOne({
      where: { id: taskId },
    })

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`)
    }

    task = await this.markStaleQuestionnaireTaskFailed(task)
    task = await this.attachGenerationResultMetadata(task)

    return this.normalizeQuestionnaireTask(task)
  }

  private isStaleStandardInterpretationTask(task: AITask): boolean {
    if (task.type !== AITaskType.STANDARD_INTERPRETATION) {
      return false
    }

    if (task.status !== TaskStatus.PROCESSING) {
      return false
    }

    const details = task.progressDetails || {}
    const isBatchInterpretation =
      details.phase === 'interpretation' ||
      details.stage === 'interpreting_batches' ||
      typeof details.currentBatch === 'number'

    if (!isBatchInterpretation) {
      return false
    }

    const updatedAt = task.updatedAt ?? task.createdAt
    const updatedAtMs = updatedAt ? new Date(updatedAt).getTime() : NaN

    return (
      Number.isFinite(updatedAtMs) &&
      Date.now() - updatedAtMs >= AITasksService.STANDARD_INTERPRETATION_STALE_MS
    )
  }

  private normalizeQuestionnaireClusterStatus(status: any) {
    if (!status) {
      return status
    }

    const clusterProgress = status.clusterProgress || {}
    const normalizedProgress: Record<string, any> = {}
    const completedClusters: string[] = []
    const failedClusters: string[] = []
    const pendingClusters: string[] = []

    for (const [key, progress] of Object.entries(clusterProgress)) {
      const normalized = {
        ...(progress as any),
        clusterId: String((progress as any)?.clusterId || key),
      }
      normalizedProgress[normalized.clusterId] = normalized

      if (normalized.status === 'completed') {
        completedClusters.push(normalized.clusterId)
      } else if (normalized.status === 'failed') {
        failedClusters.push(normalized.clusterId)
      } else {
        pendingClusters.push(normalized.clusterId)
      }
    }

    if (Object.keys(normalizedProgress).length === 0) {
      return {
        ...status,
        completedClusters: Array.from(new Set(status.completedClusters || [])),
        failedClusters: Array.from(new Set(status.failedClusters || [])),
        pendingClusters: Array.from(new Set(status.pendingClusters || [])),
      }
    }

    return {
      ...status,
      totalClusters: status.totalClusters || Object.keys(normalizedProgress).length,
      completedClusters,
      failedClusters,
      pendingClusters,
      clusterProgress: normalizedProgress,
    }
  }

  private hasPersistedQuestionnaireResult(task: AITask): boolean {
    const result = task.result as any

    return Array.isArray(result?.questionnaire) && result.questionnaire.length > 0
  }

  private resetUnpersistedQuestionnaireClusterStatus(status: any) {
    const normalizedStatus = this.normalizeQuestionnaireClusterStatus(status)

    if (!normalizedStatus?.clusterProgress) {
      return normalizedStatus
    }

    const clusterProgress: Record<string, any> = {}

    for (const [key, progress] of Object.entries(normalizedStatus.clusterProgress)) {
      clusterProgress[key] = {
        ...(progress as any),
        status: 'pending',
        questionsGenerated: 0,
        error: undefined,
      }
    }

    return this.normalizeQuestionnaireClusterStatus({
      ...normalizedStatus,
      clusterProgress,
    })
  }

  private normalizeQuestionnaireTask(task: AITask): AITask {
    if (task.type !== AITaskType.QUESTIONNAIRE || !task.clusterGenerationStatus) {
      return task
    }

    const clusterGenerationStatus =
      task.status === TaskStatus.FAILED && !this.hasPersistedQuestionnaireResult(task)
        ? this.resetUnpersistedQuestionnaireClusterStatus(task.clusterGenerationStatus)
        : this.normalizeQuestionnaireClusterStatus(task.clusterGenerationStatus)

    return {
      ...task,
      clusterGenerationStatus,
    }
  }

  private async attachGenerationResultMetadata(task: AITask): Promise<AITask> {
    const generationResult = await this.generationResultRepo.findOne({
      where: { taskId: task.id },
      order: { updatedAt: 'DESC', createdAt: 'DESC' },
    })

    return this.mergeGenerationResultMetadata(task, generationResult)
  }

  private async attachGenerationResultMetadataToTasks(tasks: AITask[]): Promise<AITask[]> {
    const taskIds = tasks.map((task) => task.id)

    if (taskIds.length === 0) {
      return tasks
    }

    const generationResults = await this.generationResultRepo.find({
      where: { taskId: In(taskIds) },
      order: { updatedAt: 'DESC', createdAt: 'DESC' },
    })

    const latestByTaskId = new Map<string, AIGenerationResult>()
    for (const generationResult of generationResults) {
      if (!latestByTaskId.has(generationResult.taskId)) {
        latestByTaskId.set(generationResult.taskId, generationResult)
      }
    }

    return tasks.map((task) =>
      this.mergeGenerationResultMetadata(task, latestByTaskId.get(task.id)),
    )
  }

  private mergeGenerationResultMetadata(
    task: AITask,
    generationResult?: AIGenerationResult | null,
  ): AITask {
    if (!generationResult) {
      return task
    }

    const existingResult =
      task.result && typeof task.result === 'object' && !Array.isArray(task.result)
        ? task.result
        : null
    const baseResult = existingResult || generationResult.selectedResult

    if (!baseResult) {
      return task
    }

    return {
      ...task,
      result: {
        ...baseResult,
        ...(baseResult.qualityScores
          ? {}
          : generationResult.qualityScores
            ? { qualityScores: generationResult.qualityScores }
            : {}),
        ...(baseResult.consistencyReport
          ? {}
          : generationResult.consistencyReport
            ? { consistencyReport: generationResult.consistencyReport }
            : {}),
        ...(baseResult.coverageReport
          ? {}
          : generationResult.coverageReport
            ? { coverageReport: generationResult.coverageReport }
            : {}),
        ...(baseResult.selectedModel
          ? {}
          : generationResult.selectedModel
            ? { selectedModel: generationResult.selectedModel }
            : {}),
        ...(baseResult.confidenceLevel
          ? {}
          : generationResult.confidenceLevel
            ? { confidenceLevel: generationResult.confidenceLevel }
            : {}),
      },
    }
  }

  private isStaleQuestionnaireTask(task: AITask): boolean {
    if (task.type !== AITaskType.QUESTIONNAIRE) {
      return false
    }

    if (task.status !== TaskStatus.PROCESSING) {
      return false
    }

    const updatedAt = task.updatedAt ?? task.createdAt
    const updatedAtMs = updatedAt ? new Date(updatedAt).getTime() : NaN

    return (
      Number.isFinite(updatedAtMs) &&
      Date.now() - updatedAtMs >= AITasksService.QUESTIONNAIRE_STALE_MS
    )
  }

  private async markStaleQuestionnaireTaskFailed(task: AITask): Promise<AITask> {
    if (!this.isStaleQuestionnaireTask(task)) {
      return task
    }

    const now = new Date()
    const staleMinutes = Math.floor(AITasksService.QUESTIONNAIRE_STALE_MS / 60000)
    const errorMessage = `问卷生成任务已中断：后台执行进程停止或超过 ${staleMinutes} 分钟未更新进度，请继续生成或重新生成。`
    const clusterGenerationStatus = this.resetUnpersistedQuestionnaireClusterStatus(
      task.clusterGenerationStatus,
    )

    await this.aiTaskRepo.update(task.id, {
      status: TaskStatus.FAILED,
      generationStage: GenerationStage.FAILED,
      errorMessage,
      completedAt: now,
      clusterGenerationStatus,
    })

    this.logger.warn(
      `Marked stale questionnaire task ${task.id} as failed after no progress update since ${task.updatedAt}`,
    )

    return {
      ...task,
      status: TaskStatus.FAILED,
      generationStage: GenerationStage.FAILED,
      errorMessage,
      completedAt: now,
      clusterGenerationStatus,
    }
  }

  private async markStaleStandardInterpretationTaskFailed(task: AITask): Promise<AITask> {
    if (!this.isStaleStandardInterpretationTask(task)) {
      return task
    }

    const now = new Date()
    const staleMinutes = Math.floor(AITasksService.STANDARD_INTERPRETATION_STALE_MS / 60000)
    const errorMessage = `标准解读任务已中断：后台执行进程停止或超过 ${staleMinutes} 分钟未更新进度，请重新生成。`
    const progressDetails: TaskProgressDetails = {
      ...(task.progressDetails || {}),
      gpt4: {
        ...(task.progressDetails?.gpt4 || {}),
        status: 'failed',
        error: errorMessage,
        completed_at: now.toISOString(),
      },
      stageMessage: errorMessage,
    }

    await this.aiTaskRepo.update(task.id, {
      status: TaskStatus.FAILED,
      generationStage: GenerationStage.FAILED,
      errorMessage,
      completedAt: now,
      progressDetails,
    })

    this.logger.warn(
      `Marked stale standard interpretation task ${task.id} as failed after no progress update since ${task.updatedAt}`,
    )

    return {
      ...task,
      status: TaskStatus.FAILED,
      generationStage: GenerationStage.FAILED,
      errorMessage,
      completedAt: now,
      progressDetails,
    }
  }

  async getTaskStatus(taskId: string): Promise<{
    status: string
    stage: string
    progress: {
      gpt4?: { status: string; elapsed?: string; error?: string }
      claude?: { status: string; elapsed?: string; error?: string }
      domestic?: { status: string; elapsed?: string; error?: string }
      validation_stage?: string
      aggregation_stage?: string
      total_elapsed_ms?: number
      percentage?: number
    }
    message: string
    details?: {
      totalClauses?: number
      totalBatches?: number
      currentBatch?: number
      totalClusters?: number
      currentCluster?: number
      clusterName?: string
      phase?: 'extraction' | 'interpretation'
      stage?: string
      stageMessage?: string
    }
  }> {
    let task = await this.aiTaskRepo.findOne({
      where: { id: taskId },
    })

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`)
    }

    task = await this.markStaleStandardInterpretationTaskFailed(task)
    task = await this.markStaleQuestionnaireTaskFailed(task)

    // 计算总耗时
    const elapsed = Date.now() - new Date(task.createdAt).getTime()
    const elapsedMinutes = Math.floor(elapsed / 60000)

    // 解析progress_details
    const details = task.progressDetails || {}

    // 处理新的单模型进度格式（current字段）
    if (details.current && !details.gpt4 && !details.claude && !details.domestic) {
      // 将current字段映射到对应的模型字段
      // 从input中获取model信息（如果有的话）
      const inputModel = (task.input as any)?.model || AIModel.GPT4
      if (inputModel === AIModel.GPT4 || inputModel === 'GPT4') {
        details.gpt4 = details.current
      } else if (inputModel === AIModel.CLAUDE || inputModel === 'CLAUDE') {
        details.claude = details.current
      } else if (inputModel === AIModel.DOMESTIC || inputModel === 'DOMESTIC') {
        details.domestic = details.current
      } else {
        // 默认映射到gpt4
        details.gpt4 = details.current
      }
    }

    const formatModelProgress = (model: any) => {
      if (!model) return undefined

      let message = ''
      if (model.status === 'generating') {
        message = `⏳ 生成中 (${elapsedMinutes}分钟)`
      } else if (model.status === 'completed') {
        const duration = model.duration_ms ? `${(model.duration_ms / 1000).toFixed(1)}秒` : ''
        message = `✅ 完成${duration ? ` (${duration})` : ''}`
      } else if (model.status === 'failed') {
        message = `❌ 失败${model.error ? `: ${model.error}` : ''}`
      } else {
        message = `⏸️ 等待中`
      }

      return {
        status: model.status,
        message,
        error: model.error,
        duration_ms: model.duration_ms,
        tokens: model.tokens,
        cost: model.cost,
      }
    }

    const progress = {
      gpt4: formatModelProgress(details.gpt4),
      claude: formatModelProgress(details.claude),
      domestic: formatModelProgress(details.domestic),
      validation_stage: details.validation_stage || 'pending',
      aggregation_stage: details.aggregation_stage || 'pending',
      total_elapsed_ms: elapsed,
      percentage: details.percentage || 0,
    }

    // 构建详细进度信息（用于标准解读等两阶段任务）
    const detailsInfo = {
      totalClauses: details.totalClauses,
      totalBatches: details.totalBatches,
      currentBatch: details.currentBatch,
      totalClusters: details.totalClusters,
      currentCluster: details.currentCluster,
      clusterName: details.clusterName,
      phase: details.phase,
      stage: details.stage,
      stageMessage: details.stageMessage,
    }

    // 生成用户友好的状态消息
    let message = ''
    const stage = task.generationStage || 'pending'

    // 针对标准解读任务的特殊消息
    if (task.type === 'standard_interpretation') {
      if (task.status === TaskStatus.COMPLETED) {
        message = '✅ 标准解读完成'
      } else if (task.status === TaskStatus.FAILED) {
        message = `❌ 标准解读失败: ${task.errorMessage || '未知错误'}`
      } else if (details.totalClauses > 0 && details.phase === 'extraction') {
        message = `🔍 第一阶段：条款提取 - 共识别 ${details.totalClauses} 个条款`
      } else if (details.totalClauses > 0 && details.phase === 'interpretation') {
        message = `📊 第二阶段：批量解读 - 批次 ${details.currentBatch || 0}/${details.totalBatches || 0}`
      } else {
        message = details.stageMessage || '正在解读标准内容...'
      }
    } else {
      switch (stage) {
        case 'generating_models':
          if (details.stageMessage) {
            message = details.stageMessage
            break
          }
          const completedCount = Object.values(details).filter(
            (m: any) => m && m.status === 'completed',
          ).length
          message =
            task.type === 'matrix'
              ? `正在生成成熟度矩阵... (${completedCount}/3 模型完成)`
              : `正在生成聚类结果... (${completedCount}/3 模型完成)`
          break
        case 'quality_validation':
          message = '正在进行质量验证...'
          break
        case 'aggregating':
          message = '正在聚合最终结果...'
          break
        case 'completed':
          message = '✅ 任务完成'
          break
        case 'failed':
          message = `❌ 任务失败: ${task.errorMessage || '未知错误'}`
          break
        default:
          message = '任务准备中...'
      }
    }

    return {
      status: task.status,
      stage,
      progress,
      message,
      details: detailsInfo,
    }
  }

  async getTasksByProject(projectId: string): Promise<AITask[]> {
    const tasks = await this.aiTaskRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    })

    const currentTasks = await Promise.all(
      tasks.map((task) => this.markStaleQuestionnaireTaskFailed(task)),
    )
    const enrichedTasks = await this.attachGenerationResultMetadataToTasks(currentTasks)

    return enrichedTasks.map((task) => this.normalizeQuestionnaireTask(task))
  }

  async retryFailedTask(taskId: string): Promise<void> {
    const task = await this.getTask(taskId)

    if (task.status !== TaskStatus.FAILED) {
      throw new Error(`Task ${taskId} is not in failed state`)
    }

    // 重置任务状态
    await this.aiTaskRepo.update(taskId, {
      status: TaskStatus.PENDING,
      errorMessage: null,
    })

    // 重新添加到队列
    const jobData: AITaskJobData = {
      taskId: task.id,
      projectId: task.projectId,
      type: task.type,
      input: task.input,
      model: AIModel.GPT4, // TODO: 从任务历史中获取上次使用的模型；当前第一模型槽位为 DeepSeek
      priority: task.priority,
    }

    await this.aiTaskQueue.add(AITaskJobType.RETRY_FAILED, jobData, {
      priority: task.priority + 1, // 重试任务优先级提高
    })

    this.logger.log(`Retrying task ${taskId}`)
  }

  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.aiTaskQueue.getWaitingCount(),
      this.aiTaskQueue.getActiveCount(),
      this.aiTaskQueue.getCompletedCount(),
      this.aiTaskQueue.getFailedCount(),
    ])

    return {
      waiting,
      active,
      completed,
      failed,
    }
  }

  /**
   * 获取改进措施的详细列表（从 action_plan_measures 表）
   */
  async getActionPlanMeasures(taskId: string) {
    // 导入 ActionPlanMeasure 实体
    const { ActionPlanMeasure } = await import('../../database/entities/action-plan-measure.entity')

    const dataSource = this.aiTaskRepo.manager
    const measureRepo = dataSource.getRepository(ActionPlanMeasure)

    const measures = await measureRepo.find({
      where: { taskId },
      order: {
        priority: 'ASC',
        clusterName: 'ASC',
        sortOrder: 'ASC',
      },
    })

    return measures
  }

  /**
   * ✅ 获取问卷任务的聚类生成状态
   */
  async getClusterGenerationStatus(taskId: string) {
    const task = await this.getTask(taskId)

    if (task.type !== 'questionnaire') {
      throw new Error('该任务不是问卷生成任务')
    }

    if (!task.clusterGenerationStatus) {
      // 如果没有状态信息，返回默认状态
      return {
        totalClusters: 0,
        completedClusters: [],
        failedClusters: [],
        pendingClusters: [],
        clusterProgress: {},
      }
    }

    return this.normalizeQuestionnaireClusterStatus(task.clusterGenerationStatus)
  }

  /**
   * ✅ 继续生成问卷（从上次中断的位置）
   */
  async resumeQuestionnaireGeneration(taskId: string) {
    const task = await this.getTask(taskId)

    if (task.type !== 'questionnaire') {
      throw new Error('该任务不是问卷生成任务')
    }

    if (!task.clusterGenerationStatus) {
      throw new Error('该任务没有聚类生成状态信息，无法继续生成')
    }

    const status = this.normalizeQuestionnaireClusterStatus(task.clusterGenerationStatus)
    const pendingClusters = status.pendingClusters || []
    const failedClusters = status.failedClusters || []
    const hasPersistedQuestionnaire =
      Array.isArray((task.result as any)?.questionnaire) &&
      (task.result as any).questionnaire.length > 0

    // ✅ 合并待生成和失败的聚类
    const clustersToGenerate = hasPersistedQuestionnaire
      ? [...pendingClusters, ...failedClusters]
      : Object.keys(status.clusterProgress || {})

    if (clustersToGenerate.length === 0) {
      throw new Error('所有聚类已生成完成，无需继续')
    }

    this.logger.log(
      `Resuming questionnaire generation for task ${taskId}: ${clustersToGenerate.length} clusters remaining (pending: ${pendingClusters.length}, failed: ${failedClusters.length})`,
    )

    // 创建新的任务来生成剩余的聚类
    const newTask = this.aiTaskRepo.create({
      projectId: task.projectId,
      type: task.type,
      input: {
        ...task.input,
        resumeFromTaskId: taskId, // ✅ 标记这是从某个任务继续的
        targetClusters: clustersToGenerate, // ✅ 指定只生成这些聚类
      },
      status: TaskStatus.PENDING,
      priority: task.priority + 1, // ✅ 提高优先级
    })

    await this.aiTaskRepo.save(newTask)

    // 添加到队列
    const jobData: AITaskJobData = {
      taskId: newTask.id,
      projectId: newTask.projectId,
      type: newTask.type,
      input: newTask.input,
      model: undefined, // questionnaire类型使用三模型并行
      priority: newTask.priority,
      userId: undefined, // 继续生成不需要userId
    }

    await this.aiTaskQueue.add(AITaskJobType.PROCESS_TASK, jobData, {
      priority: newTask.priority,
      attempts: 1,
    })

    return {
      newTaskId: newTask.id,
      originalTaskId: taskId,
      clustersToGenerate, // ✅ 返回包括失败聚类的列表
      totalClusters: status.totalClusters,
      completedClusters: status.completedClusters,
      nextClusterId: clustersToGenerate[0],
      message: `继续生成 ${clustersToGenerate.length} 个聚类`,
    }
  }

  /**
   * ✅ 重新生成单个聚类的问题
   */
  async regenerateCluster(taskId: string, clusterId: string) {
    const task = await this.getTask(taskId)

    if (task.type !== 'questionnaire') {
      throw new Error('该任务不是问卷生成任务')
    }

    if (!task.clusterGenerationStatus) {
      throw new Error('该任务没有聚类生成状态信息')
    }

    const clusterProgress = task.clusterGenerationStatus.clusterProgress[clusterId]
    if (!clusterProgress) {
      throw new Error(`聚类 ${clusterId} 不存在`)
    }

    this.logger.log(`Regenerating cluster ${clusterId} for task ${taskId}`)

    // 创建新任务来重新生成该聚类
    const newTask = this.aiTaskRepo.create({
      projectId: task.projectId,
      type: task.type,
      input: {
        ...task.input,
        regenerateFromTaskId: taskId, // ✅ 标记这是重新生成
        targetClusters: [clusterId], // ✅ 只生成这一个聚类
        replaceMode: true, // ✅ 标记为替换模式
      },
      status: TaskStatus.PENDING,
      priority: task.priority + 2, // ✅ 重新生成优先级更高
    })

    await this.aiTaskRepo.save(newTask)

    // 添加到队列
    const jobData: AITaskJobData = {
      taskId: newTask.id,
      projectId: newTask.projectId,
      type: newTask.type,
      input: newTask.input,
      model: undefined,
      priority: newTask.priority,
      userId: undefined,
    }

    await this.aiTaskQueue.add(AITaskJobType.PROCESS_TASK, jobData, {
      priority: newTask.priority,
      attempts: 1,
    })

    return {
      newTaskId: newTask.id,
      originalTaskId: taskId,
      clusterId,
      clusterName: clusterProgress.clusterName,
      message: `正在重新生成聚类: ${clusterProgress.clusterName}`,
    }
  }
}
