import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, LessThanOrEqual } from 'typeorm'
import { RadarPush } from '../../../database/entities/radar-push.entity'
import { PushPreference } from '../../../database/entities/push-preference.entity'

/**
 * PushSchedulerService - 推送调度服务
 *
 * Story 2.3: 推送系统与调度 - Phase 3 Task 3.1
 * Story 3.2: 行业雷达推送调度 - Task 2.3
 *
 * 核心功能：
 * - getPendingPushes: 获取待推送的内容（status='scheduled' 且 scheduledAt <= now）
 * - groupByOrganization: 按组织分组，每个组织最多5条（技术雷达）或2条（行业雷达）
 * - markAsSent: 标记推送为已发送
 * - markAsFailed: 标记推送为失败
 *
 * 调度逻辑：
 * - 技术雷达: 每周五17:00，每个组织最多5条
 * - 行业雷达: 每日9:00，每个组织最多2条 (Story 3.2)
 * - 合规雷达: 每日9:00，每个组织最多5条
 */
@Injectable()
export class PushSchedulerService {
  private readonly logger = new Logger(PushSchedulerService.name)

  constructor(
    @InjectRepository(RadarPush)
    private readonly radarPushRepo: Repository<RadarPush>,
    @InjectRepository(PushPreference)
    private readonly pushPreferenceRepo: Repository<PushPreference>,
  ) {}

  /**
   * 获取待推送的内容
   *
   * AC 7: 推送调度
   * - 查询 status='scheduled' 且 scheduledAt <= now 的推送记录
   * - 按 priorityLevel (high > medium > low) 和 relevanceScore 降序排序
   *
   * @param radarType - 雷达类型 (tech/industry/compliance)
   * @returns 待推送的记录列表
   */
  async getPendingPushes(radarType: 'tech' | 'industry' | 'compliance'): Promise<RadarPush[]> {
    const now = new Date()

    this.logger.log(
      `Fetching pending pushes for ${radarType} radar (scheduledAt <= ${now.toISOString()})`,
    )

    const pushes = await this.radarPushRepo.find({
      where: {
        radarType,
        status: 'scheduled',
        scheduledAt: LessThanOrEqual(now),
      },
      relations: ['analyzedContent', 'analyzedContent.rawContent', 'analyzedContent.tags'],
      order: {
        // 优先级排序: high > medium > low
        priorityLevel: 'DESC',
        relevanceScore: 'DESC',
      },
    })

    this.logger.log(`Found ${pushes.length} pending pushes for ${radarType} radar`)

    return pushes
  }

  /**
   * 按组织分组推送，每个组织最多N条
   *
   * AC 6: 推送去重与频率控制
   * Story 3.2 Task 2.3: 行业雷达每个组织最多2条/天
   * - 技术雷达: 每个组织最多5条
   * - 行业雷达: 每个组织最多2条
   * - 合规雷达: 每个组织最多5条
   *
   * @param pushes - 待推送的记录列表
   * @param maxPerOrg - 每个组织最多推送数量（默认5）
   * @returns Map<organizationId, RadarPush[]>
   */
  groupByOrganization(pushes: RadarPush[], maxPerOrg: number = 5): Map<string, RadarPush[]> {
    const grouped = new Map<string, RadarPush[]>()

    for (const push of pushes) {
      const orgId = push.organizationId

      if (!grouped.has(orgId)) {
        grouped.set(orgId, [])
      }

      const orgPushes = grouped.get(orgId)

      // 限制每个组织最多5条
      if (orgPushes.length < maxPerOrg) {
        orgPushes.push(push)
      } else {
        this.logger.debug(
          `Organization ${orgId} already has ${maxPerOrg} pushes, skipping push ${push.id}`,
        )
      }
    }

    this.logger.log(
      `Grouped ${pushes.length} pushes into ${grouped.size} organizations (max ${maxPerOrg} per org)`,
    )

    return grouped
  }

  /**
   * 标记推送为已发送
   *
   * AC 7: 推送调度
   * - 更新 status='sent'
   * - 记录 sentAt 时间戳
   *
   * @param pushId - 推送记录ID
   */
  async markAsSent(pushId: string): Promise<void> {
    await this.radarPushRepo.update(pushId, {
      status: 'sent',
      sentAt: new Date(),
    })

    this.logger.log(`Marked push ${pushId} as sent`)
  }

  /**
   * 标记推送为失败
   *
   * AC 7: 推送调度
   * - 更新 status='failed'
   * - 记录失败原因（可选）
   *
   * @param pushId - 推送记录ID
   * @param reason - 失败原因（可选）
   */
  async markAsFailed(pushId: string, reason?: string): Promise<void> {
    await this.radarPushRepo.update(pushId, {
      status: 'failed',
    })

    this.logger.error(`Marked push ${pushId} as failed${reason ? `: ${reason}` : ''}`)
  }

  /**
   * 获取推送统计信息
   *
   * @param organizationId - 组织ID
   * @param radarType - 雷达类型
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @returns 推送统计
   */
  async getPushStats(
    organizationId: string,
    radarType: 'tech' | 'industry' | 'compliance',
    startDate: Date,
    endDate: Date,
  ): Promise<{
    total: number
    sent: number
    failed: number
    pending: number
  }> {
    const [total, sent, failed, pending] = await Promise.all([
      this.radarPushRepo.count({
        where: {
          organizationId,
          radarType,
          scheduledAt: LessThanOrEqual(endDate),
        },
      }),
      this.radarPushRepo.count({
        where: {
          organizationId,
          radarType,
          status: 'sent',
          sentAt: LessThanOrEqual(endDate),
        },
      }),
      this.radarPushRepo.count({
        where: {
          organizationId,
          radarType,
          status: 'failed',
          scheduledAt: LessThanOrEqual(endDate),
        },
      }),
      this.radarPushRepo.count({
        where: {
          organizationId,
          radarType,
          status: 'scheduled',
          scheduledAt: LessThanOrEqual(endDate),
        },
      }),
    ])

    return { total, sent, failed, pending }
  }

  /**
   * 统计今天已发送的推送数量 (Story 4.2 - AC 4)
   *
   * @param organizationId - 组织ID
   * @param radarType - 雷达类型
   * @param today - 今天的日期（可选，默认为当前日期）
   * @returns 今天已发送的推送数量
   */
  async countTodayPushes(
    organizationId: string,
    radarType: 'tech' | 'industry' | 'compliance',
    today: Date = new Date(),
  ): Promise<number> {
    // 计算今天的时间范围（00:00:00 到 23:59:59）
    const startOfDay = new Date(today)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(today)
    endOfDay.setHours(23, 59, 59, 999)

    // 统计今天已发送的推送数量
    const count = await this.radarPushRepo.count({
      where: {
        organizationId,
        radarType,
        status: 'sent',
        sentAt: {
          $gte: startOfDay,
          $lte: endOfDay,
        } as any,
      },
    })

    this.logger.log(`Organization ${organizationId} has sent ${count} ${radarType} pushes today`)

    return count
  }

  /**
   * 降级超过限制的推送到次日9:00 (Story 4.2 - AC 4)
   *
   * @param pushes - 待推送列表
   * @param limit - 最大推送数量限制
   * @param today - 今天的日期（可选，默认为当前日期）
   */
  async downgradeExcessPushes(
    pushes: RadarPush[],
    limit: number,
    today: Date = new Date(),
  ): Promise<void> {
    if (pushes.length <= limit) {
      // 没有超过限制，无需降级
      return
    }

    // 找出超过限制的推送
    const excessPushes = pushes.slice(limit)

    if (excessPushes.length === 0) {
      return
    }

    // 计算次日9:00的时间
    const tomorrow9am = new Date(today)
    tomorrow9am.setDate(tomorrow9am.getDate() + 1)
    tomorrow9am.setHours(9, 0, 0, 0)

    this.logger.log(
      `Downgrading ${excessPushes.length} excess pushes to ${tomorrow9am.toISOString()}`,
    )

    // 批量更新推送时间到次日9:00
    for (const push of excessPushes) {
      await this.radarPushRepo.update(push.id, {
        scheduledAt: tomorrow9am,
      })

      this.logger.debug(`Push ${push.id} downgraded to ${tomorrow9am.toISOString()}`)
    }
  }

  /**
   * 检查当前时间是否在推送时段内 (Story 5.3 - AC 5)
   *
   * @param preference - 推送偏好设置
   * @param now - 当前时间
   * @returns 是否在时段内
   */
  isWithinPushWindow(preference: PushPreference, now: Date): boolean {
    const { pushStartTime, pushEndTime } = preference

    // 防御性编程: 空值检查
    if (!pushStartTime || !pushEndTime) {
      this.logger.warn(`PushPreference has invalid time range`)
      return true // 默认允许推送，避免阻塞
    }

    const currentTime = this.formatTime(now)

    // 处理跨午夜时段（如 22:00-08:00）
    if (pushStartTime > pushEndTime) {
      return currentTime >= pushStartTime || currentTime <= pushEndTime
    }
    return currentTime >= pushStartTime && currentTime <= pushEndTime
  }

  /**
   * 格式化时间为 HH:mm 字符串
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  /**
   * 综合检查推送限制 (Story 5.3 - AC 5)
   *
   * - 检查时段限制 (合规雷达跳过)
   * - 检查当日推送数量限制
   * - 如超出限制，调用 downgradeExcessPushes 延迟推送
   */
  async checkPushLimitsAndFilter(
    pushes: RadarPush[],
    organizationId: string,
    radarType: 'tech' | 'industry' | 'compliance',
    now: Date = new Date(),
  ): Promise<RadarPush[]> {
    // 1. 获取组织推送偏好
    const preference = await this.pushPreferenceRepo.findOne({
      where: { organizationId },
    })

    // 如果未配置，使用默认值允许推送
    if (!preference) {
      return pushes
    }

    // 2. 时段检查 (合规雷达跳过)
    if (radarType !== 'compliance') {
      if (!this.isWithinPushWindow(preference, now)) {
        this.logger.log(
          `Organization ${organizationId} outside push window (${preference.pushStartTime}-${preference.pushEndTime}), delaying all pushes`,
        )
        // 所有推送延迟到下个时段
        await this.downgradeExcessPushes(pushes, 0, now)
        return []
      }
    }

    // 3. 数量限制检查
    const todayCount = await this.countTodayPushes(organizationId, radarType, now)
    const remainingLimit = Math.max(0, preference.dailyPushLimit - todayCount)

    if (remainingLimit === 0) {
      this.logger.log(
        `Organization ${organizationId} reached daily limit (${preference.dailyPushLimit}), delaying all pushes`,
      )
      // 所有推送延迟到次日
      await this.downgradeExcessPushes(pushes, 0, now)
      return []
    }

    // 4. 如果超出剩余限制，只发送允许的数量，其余延迟
    if (pushes.length > remainingLimit) {
      this.logger.log(
        `Organization ${organizationId} pushes (${pushes.length}) exceed remaining limit (${remainingLimit}), downgrading excess`,
      )
      await this.downgradeExcessPushes(pushes, remainingLimit, now)
      return pushes.slice(0, remainingLimit)
    }

    return pushes
  }
}
