import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, In } from 'typeorm'
import { PushLog } from '../../../database/entities/push-log.entity'
import { RadarPush } from '../../../database/entities/radar-push.entity'

/**
 * PushLogService - 推送日志服务
 *
 * Story 2.3: 推送系统与调度
 * Story 3.2: 行业雷达推送 - Task 3.3
 *
 * 核心功能：
 * - logSuccess: 记录推送成功日志
 * - logFailure: 记录推送失败日志（含错误信息）
 * - calculateSuccessRate: 计算推送成功率（目标≥98%）
 *
 * 使用场景：
 * 1. 推送成功 → logSuccess(pushId)
 * 2. 推送失败 → logFailure(pushId, errorMessage, retryCount)
 * 3. 监控推送质量 → calculateSuccessRate(organizationId, radarType)
 */
@Injectable()
export class PushLogService {
  private readonly logger = new Logger(PushLogService.name)

  constructor(
    @InjectRepository(PushLog)
    private readonly pushLogRepo: Repository<PushLog>,
    @InjectRepository(RadarPush)
    private readonly radarPushRepo: Repository<RadarPush>,
  ) {}

  /**
   * 记录推送成功日志
   *
   * @param pushId - 推送记录ID
   */
  async logSuccess(pushId: string): Promise<void> {
    await this.pushLogRepo.save({
      pushId,
      status: 'success',
      errorMessage: null,
      retryCount: 0,
    })

    this.logger.log(`Logged success for push ${pushId}`)
  }

  /**
   * 记录推送失败日志
   *
   * AC 5: 推送失败处理
   * - 标记status='failed'
   * - 记录失败原因到PushLog表
   *
   * @param pushId - 推送记录ID
   * @param errorMessage - 失败原因
   * @param retryCount - 重试次数（默认0）
   */
  async logFailure(pushId: string, errorMessage: string, retryCount: number = 0): Promise<void> {
    await this.pushLogRepo.save({
      pushId,
      status: 'failed',
      errorMessage,
      retryCount,
    })

    this.logger.error(`Logged failure for push ${pushId}: ${errorMessage} (retry: ${retryCount})`)
  }

  /**
   * 计算推送成功率
   *
   * AC 5: 推送成功率 = 成功数 / 总数，必须 ≥ 98%
   *
   * @param organizationId - 组织ID（可选，用于按组织统计）
   * @param radarType - 雷达类型（可选，用于按类型统计）
   * @param startDate - 开始日期（可选，用于时间范围统计）
   * @param endDate - 结束日期（可选，用于时间范围统计）
   * @returns 成功率（0.00 - 1.00）
   */
  async calculateSuccessRate(
    organizationId?: string,
    radarType?: 'tech' | 'industry' | 'compliance',
    startDate?: Date,
    endDate?: Date,
  ): Promise<number> {
    // 构建查询条件
    const whereConditions: any = {}

    if (organizationId || radarType || startDate || endDate) {
      // 需要关联RadarPush表来过滤
      const pushQuery = this.radarPushRepo.createQueryBuilder('push')

      if (organizationId) {
        pushQuery.andWhere('push.organizationId = :organizationId', { organizationId })
      }

      if (radarType) {
        pushQuery.andWhere('push.radarType = :radarType', { radarType })
      }

      if (startDate) {
        pushQuery.andWhere('push.createdAt >= :startDate', { startDate })
      }

      if (endDate) {
        pushQuery.andWhere('push.createdAt <= :endDate', { endDate })
      }

      const pushIds = (await pushQuery.select('push.id').getRawMany()).map((row) => row.push_id)

      // Code Review Fix #1: 如果没有匹配的pushIds，直接返回0，避免查询错误
      if (pushIds.length === 0) {
        this.logger.log('No pushes found matching the filter criteria')
        return 0
      }

      // 使用In操作符确保查询正确
      whereConditions.pushId = In(pushIds)
    }

    // 统计总数和成功数
    const [totalCount, successCount] = await Promise.all([
      this.pushLogRepo.count({ where: whereConditions }),
      this.pushLogRepo.count({ where: { ...whereConditions, status: 'success' } }),
    ])

    if (totalCount === 0) {
      return 0
    }

    const successRate = successCount / totalCount

    this.logger.log(
      `Success rate: ${(successRate * 100).toFixed(2)}% (${successCount}/${totalCount})`,
    )

    return successRate
  }
}
