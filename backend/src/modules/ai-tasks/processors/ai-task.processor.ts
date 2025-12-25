import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AI_TASK_QUEUE } from '../constants/queue.constants'
import { AITaskJobData, AITaskJobResult } from '../interfaces/queue-job.interface'
import { AITask, TaskStatus } from '../../../database/entities/ai-task.entity'
import { AIGenerationEvent } from '../../../database/entities/ai-generation-event.entity'
import { AICostTracking } from '../../../database/entities/ai-cost-tracking.entity'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'
import { TasksGateway } from '../gateways/tasks.gateway'
import { CostMonitoringService } from '../services/cost-monitoring.service'

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
    private readonly aiOrchestrator: AIOrchestrator,
    private readonly tasksGateway: TasksGateway,
    private readonly costMonitoring: CostMonitoringService,
  ) {
    super()
  }

  async process(job: Job<AITaskJobData>): Promise<AITaskJobResult> {
    const { taskId, type, input, model } = job.data
    this.logger.log(`Processing AI task ${taskId}, type: ${type}, model: ${model}`)

    const startTime = Date.now()

    try {
      // 发送进度：0% - 任务开始
      this.tasksGateway.emitTaskProgress({
        taskId,
        progress: 0,
        message: '任务已开始处理',
        currentStep: 'initializing',
      })

      // 更新任务状态为 PROCESSING
      await this.aiTaskRepo.update(taskId, {
        status: TaskStatus.PROCESSING,
      })

      // 发送进度：10% - 准备调用AI
      this.tasksGateway.emitTaskProgress({
        taskId,
        progress: 10,
        message: '正在准备AI请求',
        currentStep: 'preparing',
      })

      // 记录生成事件 - 开始
      const event = this.eventRepo.create({
        taskId,
        model,
        input,
      })
      await this.eventRepo.save(event)

      // 发送进度：30% - 调用AI中
      this.tasksGateway.emitTaskProgress({
        taskId,
        progress: 30,
        message: `正在调用${model}模型生成内容`,
        currentStep: 'generating',
        estimatedTimeMs: 20000, // 预估20秒
      })

      // 调用AI Orchestrator生成响应
      const prompt = this.buildPrompt(type, input)
      const aiResponse = await this.aiOrchestrator.generate(
        {
          prompt: prompt.prompt,
          systemPrompt: prompt.systemPrompt,
          temperature: 0.7,
          maxTokens: 2000,
        },
        model,
      )

      const executionTimeMs = Date.now() - startTime

      // 发送进度：70% - AI生成完成，保存结果
      this.tasksGateway.emitTaskProgress({
        taskId,
        progress: 70,
        message: 'AI生成完成，正在保存结果',
        currentStep: 'saving',
      })

      // 更新生成事件 - 完成
      await this.eventRepo.update(event.id, {
        output: { content: aiResponse.content, metadata: aiResponse.metadata } as any,
        executionTimeMs,
      })

      // 记录成本
      await this.costRepo.save({
        taskId,
        model: aiResponse.model as any,
        tokens: aiResponse.tokens.total,
        cost: aiResponse.cost,
      } as any)

      // 发送进度：90% - 更新任务状态
      this.tasksGateway.emitTaskProgress({
        taskId,
        progress: 90,
        message: '正在更新任务状态',
        currentStep: 'finalizing',
      })

      // 更新任务状态为 COMPLETED
      await this.aiTaskRepo.update(taskId, {
        status: TaskStatus.COMPLETED,
        result: { content: aiResponse.content } as any,
        completedAt: new Date(),
      })

      this.logger.log(
        `AI task ${taskId} completed in ${executionTimeMs}ms, tokens: ${aiResponse.tokens.total}, cost: $${aiResponse.cost.toFixed(4)}`,
      )

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
          const projectAlert =
            await this.costMonitoring.checkProjectCostAlert(job.data.projectId)
          if (projectAlert) {
            await this.costMonitoring.sendCostAlert(projectAlert)
          }
        }
      } catch (alertError) {
        // 告警失败不应该影响任务完成
        this.logger.error(
          `Cost alert check failed for task ${taskId}: ${alertError.message}`,
        )
      }

      // 发送完成事件：100%
      this.tasksGateway.emitTaskCompleted({
        taskId,
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

      // 记录失败事件
      await this.eventRepo.save({
        taskId,
        model,
        input,
        errorMessage: error.message,
        executionTimeMs: Date.now() - startTime,
      })

      // 发送失败事件
      this.tasksGateway.emitTaskFailed({
        taskId,
        error: error.message,
        failedAt: new Date(),
      })

      throw error
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
        return {
          systemPrompt:
            'You are an expert at creating concise, accurate summaries. Focus on key points and main ideas.',
          prompt: `Please summarize the following text:\n\n${input.text}`,
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
          systemPrompt:
            'You are a data analyst. Provide insightful analysis with clear reasoning.',
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
