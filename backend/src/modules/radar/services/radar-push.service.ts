import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { RadarPush } from '../../../database/entities/radar-push.entity'
import {
  QueryPushHistoryDto,
  PushHistoryResponseDto,
  PushHistoryItemDto,
} from '../dto/push-history.dto'

/**
 * RadarPushService - 推送历史管理服务
 *
 * Story 5.4: 推送历史查看 - Task 1.2
 *
 * 核心功能：
 * - 查询推送历史（支持多维度筛选和分页）
 * - 标记推送为已读
 * - 获取未读推送数量
 */
@Injectable()
export class RadarPushService {
  private readonly logger = new Logger(RadarPushService.name)

  constructor(
    @InjectRepository(RadarPush)
    private readonly radarPushRepo: Repository<RadarPush>,
  ) {}

  /**
   * 获取推送历史列表
   *
   * AC 2-7: 支持多维度筛选和分页
   * - 雷达类型筛选
   * - 时间范围筛选
   * - 相关性筛选
   * - 分页加载
   *
   * @param tenantId - 租户ID（多租户隔离）
   * @param organizationId - 组织ID（多租户隔离）
   * @param query - 查询参数
   * @returns 推送历史列表和分页信息
   */
  async getPushHistory(
    tenantId: string,
    organizationId: string,
    query: QueryPushHistoryDto,
  ): Promise<PushHistoryResponseDto> {
    // MEDIUM-3 修复: 添加输入验证
    if (!tenantId || tenantId.trim() === '') {
      throw new Error('Tenant ID is required')
    }

    if (!organizationId || organizationId.trim() === '') {
      throw new Error('Organization ID is required')
    }

    const { page = 1, limit = 20, radarType, timeRange, startDate, endDate, relevance } = query

    // 验证分页参数
    if (page < 1 || limit < 1 || limit > 50) {
      throw new Error('Invalid pagination parameters')
    }

    this.logger.debug(`getPushHistory: tenant=${tenantId}, org=${organizationId}, query=${JSON.stringify(query)}`)

    // 构建查询
    const queryBuilder = this.radarPushRepo
      .createQueryBuilder('push')
      .leftJoinAndSelect('push.analyzedContent', 'analyzed')
      .leftJoinAndSelect('analyzed.rawContent', 'raw')
      .where('push.tenantId = :tenantId', { tenantId })
      .andWhere('push.organizationId = :organizationId', { organizationId })
      .andWhere("push.status = 'sent'") // 只查询已发送的推送

    // 雷达类型筛选
    if (radarType) {
      queryBuilder.andWhere('push.radarType = :radarType', { radarType })
    }

    // 时间范围筛选
    if (timeRange && timeRange !== 'all') {
      const intervalMap = {
        '7d': '7 days',
        '30d': '30 days',
        '90d': '90 days',
      }
      const interval = intervalMap[timeRange]
      if (interval) {
        queryBuilder.andWhere(`push.sentAt >= NOW() - INTERVAL '${interval}'`)
      }
    }

    // 自定义日期范围筛选
    if (startDate) {
      queryBuilder.andWhere('push.sentAt >= :startDate', { startDate })
    }
    if (endDate) {
      queryBuilder.andWhere('push.sentAt <= :endDate', { endDate })
    }

    // 相关性筛选
    if (relevance && relevance !== 'all') {
      if (relevance === 'high') {
        queryBuilder.andWhere('push.relevanceScore >= :minScore', { minScore: 0.9 })
      } else if (relevance === 'medium') {
        queryBuilder.andWhere(
          'push.relevanceScore >= :minScore AND push.relevanceScore < :maxScore',
          { minScore: 0.7, maxScore: 0.9 },
        )
      } else if (relevance === 'low') {
        queryBuilder.andWhere('push.relevanceScore < :maxScore', { maxScore: 0.7 })
      }
    }

    // 排序：按 sentAt 倒序（最新的在前）
    queryBuilder.orderBy('push.sentAt', 'DESC')

    // 分页
    queryBuilder.skip((page - 1) * limit).take(limit)

    // 执行查询
    const [pushes, total] = await queryBuilder.getManyAndCount()

    this.logger.log(`Found ${pushes.length} pushes, total: ${total}`)

    // 转换为响应格式
    const data: PushHistoryItemDto[] = pushes.map((push) => this.transformPushToDto(push))

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * 标记推送为已读
   *
   * AC 8: 已读状态管理
   * - 更新 isRead=true
   * - 记录 readAt 时间戳
   * - 验证组织隔离
   *
   * @param pushId - 推送记录ID
   * @param userId - 用户ID（预留，当前未使用）
   * @param tenantId - 租户ID（用于多租户隔离）
   * @param organizationId - 组织ID（用于多租户隔离）
   */
  async markAsRead(pushId: string, userId: string, tenantId: string, organizationId: string): Promise<void> {
    // MEDIUM-3 修复: 添加输入验证
    if (!pushId || pushId.trim() === '') {
      throw new Error('Push ID is required')
    }

    if (!tenantId || tenantId.trim() === '') {
      throw new Error('Tenant ID is required')
    }

    if (!organizationId || organizationId.trim() === '') {
      throw new Error('Organization ID is required')
    }

    // 验证UUID格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(pushId)) {
      throw new NotFoundException('Push not found')
    }

    this.logger.debug(`markAsRead: pushId=${pushId}, userId=${userId}, tenant=${tenantId}, org=${organizationId}`)

    // 增加租户和组织过滤，确保只能标记本租户本组织的推送
    const push = await this.radarPushRepo.findOne({
      where: {
        id: pushId,
        tenantId,
        organizationId, // 多租户隔离
      },
    })

    if (!push) {
      throw new NotFoundException('Push not found')
    }

    // 如果已经标记为已读，则跳过更新
    if (push.isRead) {
      this.logger.debug(`Push ${pushId} already marked as read`)
      return
    }

    await this.radarPushRepo.update(pushId, {
      isRead: true,
      readAt: new Date(),
    })

    this.logger.log(`Push ${pushId} marked as read`)
  }

  /**
   * 获取未读推送数量
   *
   * AC 8: 已读状态管理
   * - 统计未读推送数量
   * - 用于导航徽章显示
   *
   * @param tenantId - 租户ID
   * @param organizationId - 组织ID
   * @returns 未读推送数量
   */
  async getUnreadCount(tenantId: string, organizationId: string): Promise<number> {
    // MEDIUM-3 修复: 添加输入验证
    if (!tenantId || tenantId.trim() === '') {
      throw new Error('Tenant ID is required')
    }

    if (!organizationId || organizationId.trim() === '') {
      throw new Error('Organization ID is required')
    }

    const count = await this.radarPushRepo.count({
      where: {
        tenantId,
        organizationId,
        status: 'sent',
        isRead: false,
      },
    })

    this.logger.log(`Unread count for tenant ${tenantId}, org ${organizationId}: ${count}`)
    return count
  }

  /**
   * 转换 RadarPush 实体为 DTO
   *
   * @param push - RadarPush 实体
   * @returns PushHistoryItemDto
   */
  private transformPushToDto(push: RadarPush): PushHistoryItemDto {
    const analyzed = push.analyzedContent
    const raw = analyzed?.rawContent

    // 计算相关性级别
    const relevanceLevel = this.getRelevanceLevel(parseFloat(push.relevanceScore as any))

    const dto: PushHistoryItemDto = {
      id: push.id,
      radarType: push.radarType,
      title: raw?.title || '',
      summary: analyzed?.aiSummary || raw?.summary || '',
      relevanceScore: parseFloat(push.relevanceScore as any) || 0,
      relevanceLevel,
      sentAt: push.sentAt?.toISOString() || '',
      readAt: push.readAt?.toISOString() || null,
      isRead: push.isRead || false,
      sourceName: raw?.source || undefined,
      sourceUrl: raw?.url || undefined,
      weaknessCategories: analyzed?.categories || undefined,
    }

    // 技术雷达特有字段
    if (push.radarType === 'tech' && analyzed?.roiAnalysis) {
      // ROI分析存在，但没有单一评分字段，使用相关性评分作为替代
      dto.roiScore = parseFloat(push.relevanceScore as any) || 0
    }

    // 行业雷达特有字段
    if (push.radarType === 'industry') {
      // 从 matchedPeers 获取同业机构名称
      if (push.matchedPeers && push.matchedPeers.length > 0) {
        dto.matchedPeers = push.matchedPeers
        dto.peerName = push.matchedPeers[0] // 主要同业机构
      }
    }

    // 合规雷达特有字段
    if (push.radarType === 'compliance') {
      // 从 priorityLevel 映射风险级别
      dto.riskLevel = push.priorityLevel as 'high' | 'medium' | 'low'
    }

    return dto
  }

  /**
   * 计算相关性级别
   *
   * @param score - 相关性评分（0.00-1.00）
   * @returns 相关性级别
   */
  private getRelevanceLevel(score: number): 'high' | 'medium' | 'low' {
    if (score >= 0.9) return 'high'
    if (score >= 0.7) return 'medium'
    return 'low'
  }
}
