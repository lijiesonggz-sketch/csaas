import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { PeerPushSchedulerService } from '../services/peer-push-scheduler.service'

/**
 * Peer Push Generation Job Data
 */
export interface PeerPushGenerationJobData {
  /** 已分析内容ID */
  analyzedContentId: string
  /** 任务来源 */
  source: 'peer-crawler'
}

/**
 * PeerPushGenerationProcessor
 *
 * BullMQ处理器，处理同业推送生成任务
 *
 * 队列: radar-push-generation
 * 任务类型: generate-peer-push
 *
 * Story 8.4: 同业动态推送生成
 * 集成点: Story 8.3 在 PeerContentAnalyzerService 中将任务加入此队列
 */
@Processor('radar-push-generation', {
  concurrency: 3, // 并发处理3个任务
})
export class PeerPushGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(PeerPushGenerationProcessor.name)

  constructor(
    private readonly peerPushSchedulerService: PeerPushSchedulerService,
  ) {
    super()
  }

  /**
   * 处理推送生成任务
   *
   * @param job BullMQ Job
   */
  async process(job: Job<PeerPushGenerationJobData>): Promise<{
    success: boolean
    analyzedContentId: string
    pushesCreated: number
    message: string
  }> {
    const { analyzedContentId, source } = job.data

    this.logger.log(
      `Processing peer push generation job ${job.id} for content: ${analyzedContentId} (source: ${source})`,
    )

    try {
      // 调用推送调度服务生成推送
      const createdPushes = await this.peerPushSchedulerService.generatePeerPushes(
        analyzedContentId,
      )

      const result = {
        success: true,
        analyzedContentId,
        pushesCreated: createdPushes.length,
        message: `Successfully created ${createdPushes.length} peer pushes`,
      }

      this.logger.log(`Job ${job.id} completed: ${result.message}`)

      return result
    } catch (error) {
      this.logger.error(
        `Job ${job.id} failed for content ${analyzedContentId}: ${error.message}`,
        error.stack,
      )

      // 重新抛出错误，让 BullMQ 处理重试
      throw error
    }
  }

  /**
   * 任务完成事件
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job<PeerPushGenerationJobData>) {
    this.logger.log(`Peer push generation job ${job.id} completed successfully`)
  }

  /**
   * 任务失败事件
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job<PeerPushGenerationJobData>, error: Error) {
    this.logger.error(
      `Peer push generation job ${job.id} failed: ${error.message}`,
      error.stack,
    )

    // 记录失败统计
    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      this.logger.error(
        `Peer push generation job ${job.id} failed after ${job.attemptsMade} attempts. ` +
          `Content ID: ${job.data.analyzedContentId}`,
      )
    }
  }

}
