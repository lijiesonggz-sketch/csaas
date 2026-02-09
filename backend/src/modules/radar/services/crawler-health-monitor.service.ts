import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { CrawlerHealthService } from './crawler-health.service'
import { AlertService } from '../../admin/dashboard/alert.service'

/**
 * CrawlerHealthMonitorService
 *
 * 爬虫健康度监控与告警服务
 * 定时检查爬虫健康度并创建告警
 *
 * Story 8.5: 爬虫健康度监控与告警 - Task 2
 */
@Injectable()
export class CrawlerHealthMonitorService {
  private readonly logger = new Logger(CrawlerHealthMonitorService.name)

  constructor(
    private readonly crawlerHealthService: CrawlerHealthService,
    private readonly alertService: AlertService,
  ) {}

  /**
   * 定时检查爬虫健康度
   * 每5分钟执行一次
   */
  @Cron('*/5 * * * *')
  async monitorCrawlerHealth() {
    try {
      this.logger.log('Running crawler health monitoring...')

      const healthStatus = await this.crawlerHealthService.calculateHealth()
      const last24hStats = await this.crawlerHealthService.getLast24hStats()
      const consecutiveFailures = await this.crawlerHealthService.getRecentConsecutiveFailures()

      // 检查并创建告警
      await this.checkAndCreateAlerts(last24hStats, consecutiveFailures)

      this.logger.log(`Crawler health check completed: ${healthStatus}`)
    } catch (error) {
      this.logger.error(`Failed to monitor crawler health: ${error.message}`)
    }
  }

  /**
   * 检查并创建告警
   * 复用现有 AlertService
   */
  private async checkAndCreateAlerts(
    stats: { successRate: number; successCount: number },
    consecutiveFailures: number,
  ): Promise<void> {
    // 成功率 < 80% → high severity
    if (stats.successRate < 0.8) {
      await this.alertService.createAlert({
        alertType: 'crawler_failure',
        severity: 'high',
        message: `爬虫成功率低于80%: ${(stats.successRate * 100).toFixed(1)}%`,
        metadata: {
          successRate: stats.successRate,
          threshold: 0.8,
          alertReason: 'low_success_rate',
        },
      })
      this.logger.warn(`Created high severity alert: success rate ${(stats.successRate * 100).toFixed(1)}%`)
    }
    // 连续失败 > 5次 → high severity
    else if (consecutiveFailures > 5) {
      await this.alertService.createAlert({
        alertType: 'crawler_failure',
        severity: 'high',
        message: `爬虫连续失败${consecutiveFailures}次`,
        metadata: {
          consecutiveFailures,
          alertReason: 'consecutive_failures',
        },
      })
      this.logger.warn(`Created high severity alert: ${consecutiveFailures} consecutive failures`)
    }
    // 成功率 < 90% → medium severity
    else if (stats.successRate < 0.9) {
      await this.alertService.createAlert({
        alertType: 'crawler_failure',
        severity: 'medium',
        message: `爬虫成功率低于90%: ${(stats.successRate * 100).toFixed(1)}%`,
        metadata: {
          successRate: stats.successRate,
          threshold: 0.9,
          alertReason: 'low_success_rate',
        },
      })
      this.logger.warn(`Created medium severity alert: success rate ${(stats.successRate * 100).toFixed(1)}%`)
    }
    // 24小时无成功采集 → medium severity
    else if (stats.successCount === 0) {
      await this.alertService.createAlert({
        alertType: 'crawler_failure',
        severity: 'medium',
        message: '24小时内无成功采集记录',
        metadata: {
          successCount: stats.successCount,
          alertReason: 'no_successful_crawls',
        },
      })
      this.logger.warn('Created medium severity alert: no successful crawls in 24 hours')
    }
  }
}
