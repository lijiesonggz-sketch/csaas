import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { PushSchedulerService } from '../services/push-scheduler.service'
import { AnalyzedContentService } from '../services/analyzed-content.service'
import { AIAnalysisService } from '../services/ai-analysis.service'
import { TasksGateway } from '../../ai-tasks/gateways/tasks.gateway'
import { RadarPush } from '../../../database/entities/radar-push.entity'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { WeaknessSnapshot } from '../../../database/entities/weakness-snapshot.entity'
import {
  WeaknessCategory,
  getCategoryDisplayName as getWeaknessCategoryDisplayName,
} from '../../../constants/categories'

/**
 * PushProcessor - 推送任务处理器
 *
 * Story 2.3: 推送系统与调度 - Phase 3 Task 3.2
 * Story 2.4: ROI分析集成 - Phase 2 Task 2.1
 *
 * 核心功能：
 * - 处理定时推送任务（tech/industry/compliance雷达）
 * - 按组织分组，每个组织最多5条推送
 * - 通过WebSocket发送推送通知
 * - 失败重试机制（5分钟后重试1次）
 * - ROI分析按需计算（Story 2.4）
 *
 * BullMQ队列名: 'radar:push'
 */
@Injectable()
@Processor('radar-push', {
  concurrency: 1, // 串行处理，避免并发问题
})
export class PushProcessor extends WorkerHost {
  private readonly logger = new Logger(PushProcessor.name)

  constructor(
    private readonly pushSchedulerService: PushSchedulerService,
    private readonly analyzedContentService: AnalyzedContentService,
    private readonly aiAnalysisService: AIAnalysisService,
    private readonly tasksGateway: TasksGateway,
    @InjectRepository(WeaknessSnapshot)
    private readonly weaknessSnapshotRepo: Repository<WeaknessSnapshot>,
  ) {
    super()
  }

  /**
   * 处理推送任务
   *
   * AC 7: 推送调度
   * - 获取待推送内容（status='scheduled' 且 scheduledAt <= now）
   * - 按组织分组，每个组织最多5条
   * - 通过WebSocket发送推送
   * - 更新推送状态（sent/failed）
   *
   * @param job - BullMQ任务
   */
  async process(job: Job<{ radarType: 'tech' | 'industry' | 'compliance' }>): Promise<void> {
    const { radarType } = job.data

    this.logger.log(`Starting push job for ${radarType} radar (jobId: ${job.id})`)

    try {
      // 1. 获取待推送内容
      const pushes = await this.pushSchedulerService.getPendingPushes(radarType)

      if (pushes.length === 0) {
        this.logger.log(`No pending pushes for ${radarType} radar`)
        return
      }

      // 2. 按组织分组，每个组织最多5条
      const groupedPushes = this.pushSchedulerService.groupByOrganization(pushes, 5)

      // 3. 发送推送
      let totalSent = 0
      let totalFailed = 0

      for (const [orgId, orgPushes] of groupedPushes) {
        this.logger.log(`Processing ${orgPushes.length} pushes for organization ${orgId}`)

        for (const push of orgPushes) {
          try {
            await this.sendPushViaWebSocket(push)
            await this.pushSchedulerService.markAsSent(push.id)
            totalSent++
          } catch (error) {
            this.logger.error(
              `Failed to send push ${push.id} to organization ${orgId}:`,
              error.stack,
            )
            await this.pushSchedulerService.markAsFailed(push.id, error.message)
            totalFailed++
          }
        }
      }

      this.logger.log(
        `Push job completed for ${radarType} radar: ${totalSent} sent, ${totalFailed} failed`,
      )
    } catch (error) {
      this.logger.error(`Push job failed for ${radarType} radar:`, error.stack)
      throw error // 触发BullMQ重试机制
    }
  }

  /**
   * 通过WebSocket发送推送通知
   *
   * AC 7: 推送调度
   * - 发送 radar:push:new 事件到组织房间
   * - 包含完整的推送信息：标题、摘要、相关性评分、优先级、关联薄弱项等
   * - Story 2.4: 按需计算ROI分析
   *
   * @param push - 推送记录
   */
  private async sendPushViaWebSocket(push: RadarPush): Promise<void> {
    const content = push.analyzedContent

    if (!content) {
      throw new Error(`AnalyzedContent not found for push ${push.id}`)
    }

    // 获取组织的薄弱项
    const weaknesses = await this.weaknessSnapshotRepo.find({
      where: { organizationId: push.organizationId },
    })

    // 计算匹配的薄弱项类别
    const matchedWeaknesses = weaknesses
      .filter((w) => {
        const displayName = this.getCategoryDisplayName(w.category)
        return (
          content.categories.includes(displayName) ||
          content.tags.some((tag) => tag.name === displayName)
        )
      })
      .map((w) => this.getCategoryDisplayName(w.category))

    // Story 2.4: 如果没有ROI分析且是技术雷达，触发ROI分析
    if (!content.roiAnalysis && push.radarType === 'tech') {
      try {
        const weaknessCategory = matchedWeaknesses[0] // 取第一个匹配的薄弱项
        content.roiAnalysis = await this.aiAnalysisService.analyzeROI(
          content.id,
          weaknessCategory,
        )
        this.logger.log(`ROI analysis completed for push ${push.id}`)
      } catch (error) {
        this.logger.warn(`ROI analysis failed for push ${push.id}`, error.message)
        // 继续推送，即使ROI分析失败
      }
    }

    // 发送WebSocket事件
    this.tasksGateway.server.to(`org:${push.organizationId}`).emit('radar:push:new', {
      pushId: push.id,
      radarType: push.radarType,
      title: content.rawContent?.title || 'Untitled',
      summary: content.aiSummary || content.rawContent?.summary || '',
      relevanceScore: push.relevanceScore,
      priorityLevel: this.mapPriorityToNumber(push.priorityLevel),
      // 扩展字段
      weaknessCategories: matchedWeaknesses, // 关联的薄弱项
      url: content.rawContent?.url, // 原文链接
      publishDate: content.rawContent?.publishDate, // 发布日期
      source: content.rawContent?.source, // 信息来源
      tags: content.tags.map((tag) => tag.name), // 标签列表
      targetAudience: content.targetAudience, // 目标受众
      roiAnalysis: content.roiAnalysis, // Story 2.4: ROI分析结果
      timestamp: new Date().toISOString(),
    })

    this.logger.log(
      `Sent radar:push:new to org:${push.organizationId} for push ${push.id} (${push.radarType})`,
    )
  }

  /**
   * 将优先级映射为数字（用于前端排序）
   */
  private mapPriorityToNumber(priorityLevel: string): 1 | 2 | 3 {
    switch (priorityLevel) {
      case 'high':
        return 1
      case 'medium':
        return 2
      case 'low':
        return 3
      default:
        return 2
    }
  }

  /**
   * 将 WeaknessCategory 枚举值转换为中文显示名称
   */
  private getCategoryDisplayName(category: string): string {
    return getWeaknessCategoryDisplayName(category as WeaknessCategory)
  }
}
