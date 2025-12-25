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
  ) {
    super()
  }

  async process(job: Job<AITaskJobData>): Promise<AITaskJobResult> {
    const { taskId, type, input, model } = job.data
    this.logger.log(`Processing AI task ${taskId}, type: ${type}, model: ${model}`)

    const startTime = Date.now()

    try {
      // 更新任务状态为 PROCESSING
      await this.aiTaskRepo.update(taskId, {
        status: TaskStatus.PROCESSING,
      })

      // 记录生成事件 - 开始
      const event = this.eventRepo.create({
        taskId,
        model,
        input,
      })
      await this.eventRepo.save(event)

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

      // 更新任务状态为 COMPLETED
      await this.aiTaskRepo.update(taskId, {
        status: TaskStatus.COMPLETED,
        result: { content: aiResponse.content } as any,
        completedAt: new Date(),
      })

      this.logger.log(
        `AI task ${taskId} completed in ${executionTimeMs}ms, tokens: ${aiResponse.tokens.total}, cost: $${aiResponse.cost.toFixed(4)}`,
      )

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
