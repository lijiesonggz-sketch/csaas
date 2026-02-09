import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, LessThanOrEqual, MoreThanOrEqual, Between, DataSource } from 'typeorm'
import { RadarPush } from '../../../database/entities/radar-push.entity'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'
import { PeerRelevanceService, OrganizationRelevanceResult } from './peer-relevance.service'
import { TasksGateway } from '../../ai-tasks/gateways/tasks.gateway'

/**
 * 同业推送创建结果
 */
export interface PeerPushCreationResult {
  pushId: string
  organizationId: string
  relevanceScore: number
  priorityLevel: 'high' | 'medium' | 'low'
  scheduledAt: Date
}

/**
 * WebSocket 推送事件数据
 */
export interface PeerMonitoringPushEventData {
  pushId: string
  radarType: 'industry'
  pushType: 'peer-monitoring'
  peerName: string
  peerLogo?: string
  title: string
  summary: string
  practiceDescription: string
  estimatedCost: string | null
  implementationPeriod: string | null
  technicalEffect: string | null
  relevanceScore: number
  priorityLevel: 'high' | 'medium' | 'low'
  sentAt: string
}

/**
 * PeerPushSchedulerService
 *
 * 同业推送调度核心服务
 *
 * 职责：
 * 1. 基于AI分析结果生成个性化的同业动态推送
 * 2. 计算组织与内容的相关性
 * 3. 创建 RadarPush 记录
 * 4. 调度推送发送
 * 5. 通过 WebSocket 发送推送
 *
 * Story 8.4: 同业动态推送生成
 */
@Injectable()
export class PeerPushSchedulerService {
  private readonly logger = new Logger(PeerPushSchedulerService.name)

  constructor(
    @InjectRepository(RadarPush)
    private readonly radarPushRepository: Repository<RadarPush>,
    @InjectRepository(AnalyzedContent)
    private readonly analyzedContentRepository: Repository<AnalyzedContent>,
    private readonly peerRelevanceService: PeerRelevanceService,
    private readonly tasksGateway: TasksGateway,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 生成同业推送
   *
   * 基于已分析的同业内容，为关注该同业的组织生成推送
   *
   * @param analyzedContentId 已分析内容ID
   * @returns 创建的推送列表
   */
  async generatePeerPushes(analyzedContentId: string): Promise<PeerPushCreationResult[]> {
    this.logger.log(`Generating peer pushes for analyzed content: ${analyzedContentId}`)

    // 1. 获取已分析内容
    const analyzedContent = await this.analyzedContentRepository.findOne({
      where: { id: analyzedContentId },
      relations: ['rawContent'],
    })

    if (!analyzedContent) {
      this.logger.error(`AnalyzedContent not found: ${analyzedContentId}`)
      throw new Error(`AnalyzedContent not found: ${analyzedContentId}`)
    }

    if (!analyzedContent.peerName) {
      this.logger.warn(`AnalyzedContent ${analyzedContentId} has no peerName, skipping`)
      return []
    }

    // 2. 计算相关性
    const relevanceResults = await this.peerRelevanceService.calculatePeerRelevance(
      analyzedContent,
    )

    if (relevanceResults.length === 0) {
      this.logger.log(`No high-relevance organizations found for content: ${analyzedContentId}`)
      return []
    }

    // 3. 为每个高相关性组织创建推送（带重试机制）
    const createdPushes: PeerPushCreationResult[] = []

    for (const result of relevanceResults) {
      try {
        const push = await this.createRadarPushWithRetry(analyzedContent, result)
        createdPushes.push({
          pushId: push.id,
          organizationId: result.organizationId,
          relevanceScore: result.relevanceScore,
          priorityLevel: result.priorityLevel,
          scheduledAt: push.scheduledAt,
        })
      } catch (error) {
        this.logger.error(
          `Failed to create push for organization ${result.organizationId} after retries: ${error.message}`,
        )
        // 记录失败但继续处理其他组织
      }
    }

    this.logger.log(
      `Created ${createdPushes.length} peer pushes for content: ${analyzedContentId}`,
    )

    return createdPushes
  }

  /**
   * 创建 RadarPush 记录
   *
   * @param analyzedContent 已分析内容
   * @param relevanceResult 相关性结果
   * @returns 创建的 RadarPush
   */
  private async createRadarPush(
    analyzedContent: AnalyzedContent,
    relevanceResult: OrganizationRelevanceResult,
  ): Promise<RadarPush> {
    // 根据优先级确定调度时间
    const scheduledAt = this.calculateScheduledAt(relevanceResult.priorityLevel)

    const radarPush = this.radarPushRepository.create({
      organizationId: relevanceResult.organizationId,
      tenantId: relevanceResult.tenantId,
      radarType: 'industry',
      pushType: 'peer-monitoring',
      contentId: analyzedContent.id,
      relevanceScore: relevanceResult.relevanceScore,
      priorityLevel: relevanceResult.priorityLevel,
      scheduledAt,
      status: 'scheduled',
      peerName: analyzedContent.peerName,
      matchedPeers: relevanceResult.matchedPeers,
    })

    const saved = await this.radarPushRepository.save(radarPush)

    this.logger.debug(
      `Created RadarPush ${saved.id} for org ${relevanceResult.organizationId} ` +
        `with score ${relevanceResult.relevanceScore}`,
    )

    return saved
  }

  /**
   * 创建 RadarPush 记录（带重试机制）
   *
   * @param analyzedContent 已分析内容
   * @param relevanceResult 相关性结果
   * @param maxRetries 最大重试次数
   * @returns 创建的 RadarPush
   */
  private async createRadarPushWithRetry(
    analyzedContent: AnalyzedContent,
    relevanceResult: OrganizationRelevanceResult,
    maxRetries: number = 3,
  ): Promise<RadarPush> {
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.createRadarPush(analyzedContent, relevanceResult)
      } catch (error) {
        lastError = error as Error
        this.logger.warn(
          `Attempt ${attempt}/${maxRetries} failed to create push for org ${relevanceResult.organizationId}: ${lastError.message}`,
        )

        if (attempt < maxRetries) {
          // 指数退避: 100ms, 200ms, 400ms
          const delay = Math.pow(2, attempt - 1) * 100
          await this.sleep(delay)
        }
      }
    }

    throw lastError || new Error('Failed to create push after retries')
  }

  /**
   * 延迟辅助函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * 计算调度时间
   *
   * - 高优先级: 立即调度 (5分钟后)
   * - 中优先级: 延迟到次日早上6点
   *
   * @param priorityLevel 优先级
   * @returns 调度时间
   */
  private calculateScheduledAt(priorityLevel: 'high' | 'medium' | 'low'): Date {
    const now = new Date()

    if (priorityLevel === 'high') {
      // 高优先级：5分钟后发送
      return new Date(now.getTime() + 5 * 60 * 1000)
    }

    // 中优先级：次日早上6点
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(6, 0, 0, 0)

    return tomorrow
  }

  /**
   * 生成待发送的同业推送
   *
   * 每日定时任务调用，发送所有 scheduled 状态的推送
   *
   * @returns 发送结果统计
   */
  async generatePendingPeerPushes(): Promise<{
    totalScheduled: number
    sent: number
    failed: number
    byOrganization: Record<string, number>
  }> {
    this.logger.log('Generating pending peer pushes')

    // 1. 查询所有待发送的同业推送 (scheduledAt <= now)
    const now = new Date()
    const pendingPushes = await this.radarPushRepository.find({
      where: {
        status: 'scheduled',
        pushType: 'peer-monitoring',
        scheduledAt: LessThanOrEqual(now),
      },
      relations: ['analyzedContent'],
      order: {
        relevanceScore: 'DESC',
      },
    })

    if (pendingPushes.length === 0) {
      this.logger.log('No pending peer pushes to send')
      return {
        totalScheduled: 0,
        sent: 0,
        failed: 0,
        byOrganization: {},
      }
    }

    this.logger.log(`Found ${pendingPushes.length} pending peer pushes`)

    // 2. 按组织分组，每组织最多3条
    const groupedPushes = this.groupByOrganization(pendingPushes)

    // 3. 发送推送
    let sent = 0
    let failed = 0
    const byOrganization: Record<string, number> = {}

    for (const [organizationId, pushes] of Object.entries(groupedPushes)) {
      byOrganization[organizationId] = 0

      // 每组织最多3条
      const limitedPushes = pushes.slice(0, 3)

      for (const push of limitedPushes) {
        try {
          await this.sendPush(push)
          sent++
          byOrganization[organizationId]++
        } catch (error) {
          this.logger.error(`Failed to send push ${push.id}: ${error.message}`)
          failed++

          // 更新状态为失败
          await this.radarPushRepository.update(push.id, {
            status: 'failed',
          })
        }
      }
    }

    this.logger.log(`Sent ${sent} peer pushes, ${failed} failed`)

    return {
      totalScheduled: pendingPushes.length,
      sent,
      failed,
      byOrganization,
    }
  }

  /**
   * 按组织分组推送
   *
   * @param pushes 推送列表
   * @returns 分组后的推送
   */
  private groupByOrganization(pushes: RadarPush[]): Record<string, RadarPush[]> {
    const grouped: Record<string, RadarPush[]> = {}

    for (const push of pushes) {
      if (!grouped[push.organizationId]) {
        grouped[push.organizationId] = []
      }
      grouped[push.organizationId].push(push)
    }

    return grouped
  }

  /**
   * 发送单个推送
   *
   * @param push RadarPush 记录
   */
  private async sendPush(push: RadarPush): Promise<void> {
    // 1. 获取关联的分析内容
    const analyzedContent = await this.analyzedContentRepository.findOne({
      where: { id: push.contentId },
    })

    if (!analyzedContent) {
      throw new Error(`AnalyzedContent not found: ${push.contentId}`)
    }

    // 2. 构建推送事件数据
    const eventData: PeerMonitoringPushEventData = {
      pushId: push.id,
      radarType: 'industry',
      pushType: 'peer-monitoring',
      peerName: push.peerName || analyzedContent.peerName || 'Unknown',
      // TODO: peerLogo 当前未在数据模型中存储，未来可从 PeerRegistry 或 RadarSource 获取
      peerLogo: undefined,
      title: this.extractTitle(analyzedContent),
      summary: analyzedContent.aiSummary || '',
      practiceDescription: analyzedContent.practiceDescription || '',
      estimatedCost: analyzedContent.estimatedCost,
      implementationPeriod: analyzedContent.implementationPeriod,
      technicalEffect: analyzedContent.technicalEffect,
      relevanceScore: push.relevanceScore,
      priorityLevel: push.priorityLevel,
      sentAt: new Date().toISOString(),
    }

    // 3. 使用事务确保 WebSocket 发送和数据库更新的一致性
    await this.dataSource.transaction(async (manager) => {
      // 3a. 先更新数据库状态为发送中
      await manager.update(RadarPush, push.id, {
        status: 'sent',
        sentAt: new Date(),
      })

      // 3b. 检查组织是否有在线用户
      const hasOnlineUsers = this.tasksGateway.hasOnlineUsers(push.organizationId)

      if (hasOnlineUsers) {
        // 3c. 通过 WebSocket 发送
        this.tasksGateway.server.to(`org:${push.organizationId}`).emit('radar:push:new', {
          type: 'radar:push:new',
          data: eventData,
        })
        this.logger.debug(`Sent peer push ${push.id} to organization ${push.organizationId} (online users detected)`)
      } else {
        this.logger.debug(`Organization ${push.organizationId} has no online users, push ${push.id} marked as sent but not delivered via WebSocket`)
      }
    })
  }

  /**
   * 从分析内容中提取标题
   *
   * @param analyzedContent 已分析内容
   * @returns 标题
   */
  private extractTitle(analyzedContent: AnalyzedContent): string {
    // 优先使用同业名称 + 技术关键词
    const peerName = analyzedContent.peerName || '同业机构'

    if (analyzedContent.keyTechnologies && analyzedContent.keyTechnologies.length > 0) {
      return `${peerName} - ${analyzedContent.keyTechnologies[0]}实践`
    }

    if (analyzedContent.categories && analyzedContent.categories.length > 0) {
      return `${peerName} - ${analyzedContent.categories[0]}`
    }

    // 回退到 AI 摘要的前50个字符
    if (analyzedContent.aiSummary) {
      return `${peerName} - ${analyzedContent.aiSummary.substring(0, 50)}...`
    }

    return `${peerName} - 同业动态`
  }

  /**
   * 发送推送给指定组织 (用于立即发送高优先级推送)
   *
   * @param pushId 推送ID
   */
  async sendPushImmediately(pushId: string): Promise<void> {
    const push = await this.radarPushRepository.findOne({
      where: { id: pushId },
      relations: ['analyzedContent'],
    })

    if (!push) {
      throw new Error(`Push not found: ${pushId}`)
    }

    if (push.status !== 'scheduled') {
      throw new Error(`Push ${pushId} is not in scheduled status`)
    }

    await this.sendPush(push)

    this.logger.log(`Sent push ${pushId} immediately`)
  }

  /**
   * 获取推送统计
   *
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @returns 统计信息
   */
  async getPushStats(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    total: number
    byPriority: Record<string, number>
    byStatus: Record<string, number>
  }> {
    const pushes = await this.radarPushRepository.find({
      where: {
        pushType: 'peer-monitoring',
        createdAt: Between(startDate, endDate),
      },
    })

    const byPriority: Record<string, number> = { high: 0, medium: 0, low: 0 }
    const byStatus: Record<string, number> = {
      scheduled: 0,
      sent: 0,
      failed: 0,
      cancelled: 0,
    }

    for (const push of pushes) {
      byPriority[push.priorityLevel] = (byPriority[push.priorityLevel] || 0) + 1
      byStatus[push.status] = (byStatus[push.status] || 0) + 1
    }

    return {
      total: pushes.length,
      byPriority,
      byStatus,
    }
  }
}
