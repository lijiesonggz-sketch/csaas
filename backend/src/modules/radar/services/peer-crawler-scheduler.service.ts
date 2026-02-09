import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PeerCrawlerService } from './peer-crawler.service'
import { RadarSourceService } from './radar-source.service'
import { PeerCrawlerTaskRepository } from '../../../database/repositories/peer-crawler-task.repository'

/**
 * PeerCrawlerScheduler
 *
 * 同业采集任务的定时调度器
 *
 * Story 8.2: 同业采集任务调度与执行
 */
@Injectable()
export class PeerCrawlerScheduler {
  private readonly logger = new Logger(PeerCrawlerScheduler.name)

  constructor(
    private readonly peerCrawlerService: PeerCrawlerService,
    private readonly radarSourceService: RadarSourceService,
    private readonly peerCrawlerTaskRepository: PeerCrawlerTaskRepository,
  ) {}

  /**
   * 每4小时检查一次，为需要采集的同业创建任务
   * 复用 Story 8.1 建立的 RadarSource 配置
   */
  @Cron('0 */4 * * *')
  async schedulePeerCrawling(): Promise<void> {
    this.logger.log('Starting scheduled peer crawling check...')

    try {
      // 查询所有活跃的 RadarSource（category='industry'）
      const sources = await this.radarSourceService.getActiveSourcesByCategory('industry')

      this.logger.log(`Found ${sources.length} active industry sources`)

      let scheduledCount = 0
      for (const source of sources) {
        // 检查是否需要采集（基于 crawlSchedule 和 lastCrawledAt）
        if (this.shouldCrawl(source)) {
          try {
            // 使用 source 中的 tenantId（如果存在），否则使用默认值
            const tenantId = (source as any).tenantId || 'default'
            await this.peerCrawlerService.createTask(source, tenantId)
            scheduledCount++
          } catch (error) {
            this.logger.error(`Failed to create task for source ${source.source}: ${error.message}`)
          }
        }
      }

      this.logger.log(`Scheduled ${scheduledCount} peer crawler tasks`)
    } catch (error) {
      this.logger.error('Failed to schedule peer crawling:', error.stack)
    }
  }

  /**
   * 判断采集源是否需要执行采集
   */
  private shouldCrawl(source: {
    lastCrawledAt?: Date | null
    crawlSchedule: string
  }): boolean {
    // 如果从未采集过，立即采集
    if (!source.lastCrawledAt) {
      return true
    }

    // 解析cron表达式获取间隔（简化处理）
    const intervalMs = this.parseCronToMs(source.crawlSchedule)
    const nextCrawlTime = new Date(source.lastCrawledAt.getTime() + intervalMs)

    return new Date() >= nextCrawlTime
  }

  /**
   * 将cron表达式转换为毫秒间隔（简化版）
   * 支持常见的cron模式
   */
  private parseCronToMs(cronExpression: string): number {
    // 默认24小时
    const defaultMs = 24 * 60 * 60 * 1000

    try {
      const parts = cronExpression.split(' ')
      if (parts.length !== 5 && parts.length !== 6) {
        return defaultMs
      }

      // 每N小时: "0 */4 * * *" - 优先检查，因为包含 */ 模式
      if (parts[1].startsWith('*/')) {
        const hours = parseInt(parts[1].replace('*/', ''))
        if (!isNaN(hours)) {
          return hours * 60 * 60 * 1000
        }
      }

      // 每小时执行: "0 * * * *"
      if (parts[1] === '*' && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
        return 60 * 60 * 1000 // 1小时
      }

      // 每天执行: "0 3 * * *" (凌晨3点)
      if (parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
        return 24 * 60 * 60 * 1000 // 24小时
      }

      // 每周执行: "0 3 * * 1" (周一凌晨3点)
      if (parts[2] === '*' && parts[3] === '*' && parts[4] !== '*') {
        return 7 * 24 * 60 * 60 * 1000 // 7天
      }

      // 每月执行: "0 3 1 * *" (每月1号凌晨3点)
      if (parts[2] === '1' && parts[3] === '*') {
        return 30 * 24 * 60 * 60 * 1000 // 30天
      }

      return defaultMs
    } catch {
      return defaultMs
    }
  }

  /**
   * 手动触发所有同业采集
   * 用于测试或紧急采集
   */
  async triggerManualCrawl(tenantId?: string): Promise<{
    scheduled: number
    sources: string[]
  }> {
    this.logger.log('Triggering manual peer crawling...')

    const sources = await this.radarSourceService.getActiveSourcesByCategory('industry')
    const tasks = await this.peerCrawlerService.createTasksForSources(sources, tenantId)

    return {
      scheduled: tasks.length,
      sources: tasks.map(t => t.peerName),
    }
  }

  /**
   * 获取调度器状态
   */
  async getSchedulerStatus(): Promise<{
    lastCheck: Date
    activeSources: number
    pendingTasks: number
  }> {
    const sources = await this.radarSourceService.getActiveSourcesByCategory('industry')
    const pendingTasks = await this.peerCrawlerTaskRepository.findPendingTasks()

    return {
      lastCheck: new Date(),
      activeSources: sources.length,
      pendingTasks: pendingTasks.length,
    }
  }
}
