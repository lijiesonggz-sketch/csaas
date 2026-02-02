import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'

import { AIAnalysisService } from '../services/ai-analysis.service'
import { RawContentService } from '../services/raw-content.service'

/**
 * AIAnalysisProcessor - AI 分析队列处理器
 *
 * Story 2.2: 处理 AI 分析任务
 *
 * 任务流程：
 * 1. 从队列中取出 contentId
 * 2. 加载 RawContent 数据
 * 3. 更新状态为 'analyzing'
 * 4. 调用 AIAnalysisService 分析内容
 * 5. 保存 AnalyzedContent 结果
 * 6. 更新状态为 'analyzed' 或 'failed'
 * 7. 触发推送调度任务（Story 2.3）
 *
 * 失败处理：
 * - 自动重试 1 次（5 分钟后）
 * - 记录错误日志
 * - 发送告警通知
 */
@Processor('radar-ai-analysis', {
  concurrency: 5, // 并发处理 5 个任务
})
export class AIAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(AIAnalysisProcessor.name)

  constructor(
    private readonly aiAnalysisService: AIAnalysisService,
    private readonly rawContentService: RawContentService,
    @InjectQueue('radar-push')
    private readonly pushScheduleQueue: Queue,
    @InjectQueue('radar-playbook-generation')
    private readonly playbookQueue: Queue,
  ) {
    super()
  }

  /**
   * 处理 AI 分析任务
   */
  async process(job: Job<AIAnalysisJobData>): Promise<AIAnalysisJobResult> {
    const { contentId, category, priority } = job.data

    this.logger.log(`开始处理 AI 分析任务: contentId=${contentId}, category=${category}`)

    try {
      // 1. 加载 RawContent
      const rawContent = await this.rawContentService.findById(contentId)
      if (!rawContent) {
        throw new Error(`RawContent not found: ${contentId}`)
      }

      // 2. 更新状态为 'analyzing'
      await this.rawContentService.updateStatus(contentId, 'analyzing')

      // 3. 调用 AI 分析服务
      const analysisResult = await this.aiAnalysisService.analyzeWithCache(rawContent, category)

      this.logger.log(
        `AI 分析完成: contentId=${contentId}, tags=${analysisResult.tags.length}, tokensUsed=${analysisResult.tokensUsed}`,
      )

      // 4. 更新状态为 'analyzed'
      await this.rawContentService.updateStatus(contentId, 'analyzed')

      // 5. 触发推送调度任务（Story 2.3）
      await this.pushScheduleQueue.add(
        'calculate-relevance',
        {
          analyzedContentId: analysisResult.id,
          category,
        },
        {
          priority: this.getPriority(category),
        },
      )

      // 6. 如果是合规雷达，异步生成剧本（Story 4.2 - Phase 2.2）
      if (category === 'compliance') {
        try {
          await this.playbookQueue.add(
            'generate-playbook',
            {
              contentId: contentId,
              analyzedContentId: analysisResult.id,
            },
            {
              priority: 1, // compliance highest priority
              jobId: `playbook-${contentId}`,
            },
          )
          this.logger.log(
            `合规剧本生成任务已创建: contentId=${contentId}, analyzedContentId=${analysisResult.id}`,
          )
        } catch (error) {
          this.logger.error(`创建合规剧本生成任务失败: contentId=${contentId}`, error.stack)
          // 不阻塞主流程，继续处理推送
        }
      }

      return {
        success: true,
        analyzedContentId: analysisResult.id,
        tokensUsed: analysisResult.tokensUsed,
      }
    } catch (error) {
      this.logger.error(`AI 分析失败: contentId=${contentId}`, error.stack)

      // 更新状态为 'failed'
      await this.rawContentService.updateStatus(contentId, 'failed').catch((err) => {
        this.logger.error(`更新状态失败: ${err.message}`)
      })

      // 如果是第一次失败，BullMQ 会自动重试（5 分钟后）
      if (job.attemptsMade < 1) {
        this.logger.warn(`任务将在 5 分钟后重试: contentId=${contentId}`)
        throw error // 抛出错误触发重试
      }

      // 第二次失败，发送告警
      this.logger.error(`AI 分析最终失败: contentId=${contentId}, 已达到最大重试次数`)
      await this.sendAlert({
        type: 'ai_analysis_failed',
        contentId,
        error: error.message,
        attempts: job.attemptsMade + 1,
      })

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
  onCompleted(job: Job<AIAnalysisJobData>, result: AIAnalysisJobResult) {
    const { contentId } = job.data

    if (result.success) {
      this.logger.log(
        `AI 分析任务完成: contentId=${contentId}, analyzedContentId=${result.analyzedContentId}`,
      )
    } else {
      this.logger.error(`AI 分析任务失败: contentId=${contentId}, error=${result.error}`)
    }
  }

  /**
   * 任务失败事件
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job<AIAnalysisJobData>, error: Error) {
    this.logger.error(`AI 分析任务失败: contentId=${job.data.contentId}`, error.stack)
  }

  /**
   * 获取推送优先级
   * compliance > industry > tech
   */
  private getPriority(category: string): number {
    switch (category) {
      case 'compliance':
        return 1 // 最高优先级
      case 'industry':
        return 2
      case 'tech':
        return 3
      default:
        return 5
    }
  }

  /**
   * 发送告警通知
   */
  private async sendAlert(alert: {
    type: string
    contentId: string
    error: string
    attempts: number
  }): Promise<void> {
    // TODO: 实现告警通知（Story 2.5 或 Epic 7）
    this.logger.warn(`TODO: 发送告警通知`, alert)
  }
}

/**
 * AI 分析任务数据
 */
export interface AIAnalysisJobData {
  contentId: string // RawContent ID
  category: 'tech' | 'industry' | 'compliance'
  priority?: 'high' | 'normal' | 'low'
}

/**
 * AI 分析任务结果
 */
export interface AIAnalysisJobResult {
  success: boolean
  analyzedContentId?: string
  tokensUsed?: number
  error?: string
}
