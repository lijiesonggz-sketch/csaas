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

      // TODO: 实际调用AI API（下一步实现）
      // 这里先模拟一个简单的处理
      const mockOutput = {
        result: `Mock AI response for ${type}`,
        timestamp: new Date().toISOString(),
      }
      const mockTokens = 1000
      const mockCost = 0.02

      const executionTimeMs = Date.now() - startTime

      // 更新生成事件 - 完成
      await this.eventRepo.update(event.id, {
        output: mockOutput as any,
        executionTimeMs,
      })

      // 记录成本
      await this.costRepo.save({
        taskId,
        model,
        tokens: mockTokens,
        cost: mockCost,
      } as any)

      // 更新任务状态为 COMPLETED
      await this.aiTaskRepo.update(taskId, {
        status: TaskStatus.COMPLETED,
        result: mockOutput as any,
        completedAt: new Date(),
      })

      this.logger.log(`AI task ${taskId} completed in ${executionTimeMs}ms`)

      return {
        taskId,
        output: mockOutput,
        tokens: mockTokens,
        cost: mockCost,
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
}
