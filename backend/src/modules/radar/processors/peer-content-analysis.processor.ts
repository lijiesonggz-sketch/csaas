import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'

import { PeerContentAnalyzerService } from '../services/peer-content-analyzer.service'

/**
 * Peer Content Analysis Job Data
 */
export interface PeerContentAnalysisJob {
  type: 'peer-content-analysis'
  rawContentId: string    // RawContent.id (来自 Story 8.2)
  peerName: string        // 同业机构名称
  content: string         // 需要分析的原始内容
  tenantId: string        // 租户ID
  retryCount?: number     // 当前重试次数
}

/**
 * PeerContentAnalysisProcessor
 *
 * Story 8.3: 同业内容三模型AI分析处理器
 *
 * 监听 'radar-ai-analysis' 队列，处理同业内容分析任务
 */
@Processor('radar-ai-analysis', {
  concurrency: 3, // 与现有AI分析任务共享配置
})
export class PeerContentAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(PeerContentAnalysisProcessor.name)

  constructor(
    private readonly peerContentAnalyzerService: PeerContentAnalyzerService,
  ) {
    super()
  }

  /**
   * 处理同业内容分析任务
   */
  async process(job: Job<PeerContentAnalysisJob>): Promise<{
    success: boolean
    analyzedContentId?: string
    confidence?: 'high' | 'medium' | 'low'
    error?: string
  }> {
    const { rawContentId, peerName, tenantId } = job.data

    this.logger.log(`Processing peer content analysis: rawContentId=${rawContentId}, peerName=${peerName}, tenantId=${tenantId}`)

    try {
      // 调用 PeerContentAnalyzerService 执行分析
      const analyzedContent = await this.peerContentAnalyzerService.analyzePeerContent(rawContentId)

      this.logger.log(
        `Peer content analysis completed: analyzedContentId=${analyzedContent.id}, confidence=${analyzedContent.confidence}`,
      )

      return {
        success: true,
        analyzedContentId: analyzedContent.id,
        confidence: analyzedContent.confidence,
      }
    } catch (error) {
      this.logger.error(`Peer content analysis failed: rawContentId=${rawContentId}`, error.stack)

      // 如果是第一次失败，BullMQ 会自动重试
      if (job.attemptsMade < 2) {
        this.logger.warn(`Task will be retried: rawContentId=${rawContentId}`)
        throw error
      }

      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * 任务完成事件
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job<PeerContentAnalysisJob>, result: {
    success: boolean
    analyzedContentId?: string
    confidence?: 'high' | 'medium' | 'low'
    error?: string
  }) {
    const { rawContentId, peerName } = job.data

    if (result.success) {
      this.logger.log(
        `Peer content analysis job completed: rawContentId=${rawContentId}, peerName=${peerName}, analyzedContentId=${result.analyzedContentId}, confidence=${result.confidence}`,
      )
    } else {
      this.logger.error(
        `Peer content analysis job failed: rawContentId=${rawContentId}, error=${result.error}`,
      )
    }
  }

  /**
   * 任务失败事件
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job<PeerContentAnalysisJob>, error: Error) {
    this.logger.error(
      `Peer content analysis job failed: rawContentId=${job.data.rawContentId}, error=${error.message}`,
    )
  }
}
