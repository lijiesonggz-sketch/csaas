import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PeerPushSchedulerService } from '../services/peer-push-scheduler.service'

/**
 * PeerPushScheduler
 *
 * 同业推送定时任务调度器
 *
 * 定时任务：
 * - 每日早上6点生成并发送待处理的同业动态推送
 *
 * Story 8.4: 同业动态推送生成
 */
@Injectable()
export class PeerPushScheduler {
  private readonly logger = new Logger(PeerPushScheduler.name)

  constructor(
    private readonly peerPushSchedulerService: PeerPushSchedulerService,
  ) {}

  /**
   * 每日早上6点生成同业动态推送
   *
   * 查询所有 status='scheduled' 的同业推送
   * 按 organizationId 分组，每个组织最多推送 3 条
   * 通过 WebSocket 发送 'radar:push:new' 事件
   * 更新 RadarPush.status='sent'
   */
  @Cron('0 6 * * *', {
    name: 'generateDailyPeerPushes',
    timeZone: 'Asia/Shanghai',
  })
  async generateDailyPeerPushes(): Promise<void> {
    this.logger.log('Starting daily peer push generation job (6:00 AM)')

    const startTime = Date.now()

    try {
      const result = await this.peerPushSchedulerService.generatePendingPeerPushes()

      const duration = Date.now() - startTime

      this.logger.log(
        `Daily peer push generation completed in ${duration}ms. ` +
          `Total scheduled: ${result.totalScheduled}, ` +
          `Sent: ${result.sent}, ` +
          `Failed: ${result.failed}`,
      )

      // 记录每个组织的推送数量
      for (const [orgId, count] of Object.entries(result.byOrganization)) {
        this.logger.debug(`Organization ${orgId}: ${count} pushes sent`)
      }
    } catch (error) {
      this.logger.error(
        `Daily peer push generation failed: ${error.message}`,
        error.stack,
      )
      // 不重新抛出错误，避免影响其他定时任务
    }
  }

  /**
   * 每5分钟检查并发送高优先级推送
   *
   * 高优先级推送 (priorityLevel='high') 需要立即发送
   * 此方法确保高优先级推送能被及时处理
   */
  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'sendHighPriorityPushes',
  })
  async sendHighPriorityPushes(): Promise<void> {
    this.logger.debug('Checking for high priority peer pushes')

    try {
      // 调用 generatePendingPeerPushes 处理所有到期的推送
      // 包括高优先级推送（它们被安排在5分钟后发送）
      const result = await this.peerPushSchedulerService.generatePendingPeerPushes()

      if (result.sent > 0) {
        this.logger.log(`High priority check sent ${result.sent} pending pushes`)
      }
    } catch (error) {
      this.logger.error(`High priority push check failed: ${error.message}`)
    }
  }
}
