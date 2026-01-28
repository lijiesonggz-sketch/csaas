import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, Between } from 'typeorm'
import { RadarPush } from '../../../database/entities/radar-push.entity'
import { PUSH_FREQUENCY_CONFIG } from '../config/relevance.config'

/**
 * PushFrequencyControlService - 推送频率控制服务
 *
 * Story 2.3: 推送系统与调度 - Task 2.6
 *
 * 核心逻辑：
 * 1. 推送去重：同一scheduledAt时间段内，同一contentId只推送一次
 * 2. 推送限制：每个组织在同一scheduledAt时间段内最多5条推送
 * 3. 优先级排序：按priorityLevel（high > medium > low）和relevanceScore降序排序
 *
 * AC 6: 推送去重与频率控制
 */
@Injectable()
export class PushFrequencyControlService {
  private readonly logger = new Logger(PushFrequencyControlService.name)

  constructor(
    @InjectRepository(RadarPush)
    private readonly radarPushRepo: Repository<RadarPush>,
  ) {}

  /**
   * 检查是否允许创建推送
   *
   * AC 6: 推送去重与频率控制
   * - 同一scheduledAt时间段内是否已有相同contentId的推送
   * - 该组织在同一scheduledAt时间段内已有推送数量是否≥5条
   *
   * @param organizationId - 组织ID
   * @param contentId - 内容ID
   * @param scheduledAt - 计划推送时间
   * @returns { allowed: boolean, reason?: string, lowestPush?: RadarPush }
   */
  async checkPushAllowed(
    organizationId: string,
    contentId: string,
    scheduledAt: Date,
  ): Promise<{
    allowed: boolean
    reason?: string
    lowestPush?: RadarPush
  }> {
    // 标准化scheduledAt时间（忽略毫秒，使用时间范围查询）
    const scheduledStart = new Date(scheduledAt)
    scheduledStart.setMilliseconds(0)
    const scheduledEnd = new Date(scheduledStart)
    scheduledEnd.setSeconds(scheduledEnd.getSeconds() + 1)

    // 1. 检查去重：同一scheduledAt时间段内是否已有相同contentId的推送
    const existingPush = await this.radarPushRepo.findOne({
      where: {
        organizationId,
        contentId,
        scheduledAt: Between(scheduledStart, scheduledEnd),
      },
    })

    if (existingPush) {
      this.logger.debug(
        `Duplicate push detected: organizationId=${organizationId}, contentId=${contentId}, scheduledAt=${scheduledAt.toISOString()}`,
      )
      return {
        allowed: false,
        reason: `Duplicate push for content ${contentId} in scheduledAt ${scheduledAt.toISOString()}`,
      }
    }

    // 2. 检查推送数量限制
    const existingPushCount = await this.radarPushRepo.count({
      where: {
        organizationId,
        scheduledAt: Between(scheduledStart, scheduledEnd),
        status: 'scheduled',
      },
    })

    if (existingPushCount >= PUSH_FREQUENCY_CONFIG.MAX_PUSHES_PER_SCHEDULE) {
      // 获取relevanceScore最低的推送
      const lowestPush = await this.radarPushRepo.findOne({
        where: {
          organizationId,
          scheduledAt: Between(scheduledStart, scheduledEnd),
          status: 'scheduled',
        },
        order: {
          relevanceScore: 'ASC',
        },
      })

      this.logger.debug(
        `Push limit reached (${PUSH_FREQUENCY_CONFIG.MAX_PUSHES_PER_SCHEDULE}/${PUSH_FREQUENCY_CONFIG.MAX_PUSHES_PER_SCHEDULE}): organizationId=${organizationId}, lowestScore=${lowestPush?.relevanceScore}`,
      )

      return {
        allowed: false,
        reason: `Push limit reached (${PUSH_FREQUENCY_CONFIG.MAX_PUSHES_PER_SCHEDULE}), lowest push: ${lowestPush.id} (score: ${lowestPush.relevanceScore})`,
        lowestPush,
      }
    }

    return { allowed: true }
  }

  /**
   * 强制插入高优先级推送（删除最低优先级推送）
   *
   * AC 6: 如果该组织在同一scheduledAt时间段内已有≥5条推送，
   * 仅保留relevanceScore最高的5条，删除relevanceScore较低的推送记录
   *
   * @param organizationId - 组织ID
   * @param scheduledAt - 计划推送时间
   * @param newPush - 新推送记录（未保存）
   * @returns 保存后的新推送记录
   */
  async forceInsertPush(
    organizationId: string,
    scheduledAt: Date,
    newPush: Partial<RadarPush>,
  ): Promise<RadarPush> {
    // 标准化scheduledAt时间
    const scheduledStart = new Date(scheduledAt)
    scheduledStart.setMilliseconds(0)
    const scheduledEnd = new Date(scheduledStart)
    scheduledEnd.setSeconds(scheduledEnd.getSeconds() + 1)

    // 找到relevanceScore最低的推送并删除
    const lowestPush = await this.radarPushRepo.findOne({
      where: {
        organizationId,
        scheduledAt: Between(scheduledStart, scheduledEnd),
        status: 'scheduled',
      },
      order: {
        relevanceScore: 'ASC',
      },
    })

    if (lowestPush) {
      await this.radarPushRepo.delete(lowestPush.id)
      this.logger.log(
        `Deleted lowest push ${lowestPush.id} (score: ${lowestPush.relevanceScore}) to make room for new push (score: ${newPush.relevanceScore})`,
      )
    }

    // 保存新推送
    const savedPush = await this.radarPushRepo.save(newPush)
    this.logger.log(
      `Force inserted new push ${savedPush.id} (score: ${savedPush.relevanceScore})`,
    )

    return savedPush
  }

  /**
   * 获取组织在指定时间段的推送统计
   *
   * @param organizationId - 组织ID
   * @param scheduledAt - 计划推送时间
   * @returns 推送统计信息
   */
  async getPushStats(
    organizationId: string,
    scheduledAt: Date,
  ): Promise<{
    total: number
    scheduled: number
    sent: number
    failed: number
  }> {
    const [total, scheduled, sent, failed] = await Promise.all([
      this.radarPushRepo.count({
        where: { organizationId, scheduledAt },
      }),
      this.radarPushRepo.count({
        where: { organizationId, scheduledAt, status: 'scheduled' },
      }),
      this.radarPushRepo.count({
        where: { organizationId, scheduledAt, status: 'sent' },
      }),
      this.radarPushRepo.count({
        where: { organizationId, scheduledAt, status: 'failed' },
      }),
    ])

    return { total, scheduled, sent, failed }
  }
}
