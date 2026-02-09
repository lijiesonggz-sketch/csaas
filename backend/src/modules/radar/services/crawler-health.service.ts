import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, MoreThan, Between } from 'typeorm'
import { CrawlerLog } from '../../../database/entities/crawler-log.entity'
import { PeerCrawlerTask } from '../../../database/entities/peer-crawler-task.entity'
import { RadarSource } from '../../../database/entities/radar-source.entity'

/**
 * CrawlerHealthService
 *
 * 爬虫健康度监控服务
 * 计算整体健康状态、24小时统计、连续失败检测等
 *
 * Story 8.5: 爬虫健康度监控与告警
 */
@Injectable()
export class CrawlerHealthService {
  private readonly logger = new Logger(CrawlerHealthService.name)

  constructor(
    @InjectRepository(CrawlerLog)
    private readonly crawlerLogRepository: Repository<CrawlerLog>,
    @InjectRepository(PeerCrawlerTask)
    private readonly peerCrawlerTaskRepository: Repository<PeerCrawlerTask>,
    @InjectRepository(RadarSource)
    private readonly radarSourceRepository: Repository<RadarSource>,
  ) {}

  /**
   * 计算爬虫整体健康度
   * @returns 健康状态: healthy | warning | critical
   */
  async calculateHealth(): Promise<'healthy' | 'warning' | 'critical'> {
    const last24hStats = await this.getLast24hStats()
    const recentFailures = await this.getRecentConsecutiveFailures()

    // 成功率 < 80% 或连续失败 > 5次 → critical
    if (last24hStats.successRate < 0.8 || recentFailures > 5) {
      return 'critical'
    }

    // 成功率 < 90% 或 24小时无成功采集 → warning
    if (last24hStats.successRate < 0.9 || last24hStats.successCount === 0) {
      return 'warning'
    }

    return 'healthy'
  }

  /**
   * 获取健康度详细信息
   */
  async getHealthDetails(): Promise<{
    overallStatus: 'healthy' | 'warning' | 'critical'
    sources: {
      total: number
      active: number
      inactive: number
    }
    recentTasks: {
      completed: number
      failed: number
      pending: number
    }
    last24h: {
      crawlCount: number
      successRate: number
      newContentCount: number
    }
  }> {
    const [overallStatus, sourceStats, taskStats, last24hStats] = await Promise.all([
      this.calculateHealth(),
      this.getSourceStats(),
      this.getRecentTaskStats(),
      this.getLast24hStats(),
    ])

    return {
      overallStatus,
      sources: sourceStats,
      recentTasks: taskStats,
      last24h: {
        crawlCount: last24hStats.totalCount,
        successRate: last24hStats.successRate,
        newContentCount: last24hStats.successCount,
      },
    }
  }

  /**
   * 获取采集源统计
   */
  private async getSourceStats(): Promise<{
    total: number
    active: number
    inactive: number
  }> {
    const [total, active] = await Promise.all([
      this.radarSourceRepository.count(),
      this.radarSourceRepository.count({ where: { isActive: true } }),
    ])

    return {
      total,
      active,
      inactive: total - active,
    }
  }

  /**
   * 获取最近任务统计
   */
  private async getRecentTaskStats(): Promise<{
    completed: number
    failed: number
    pending: number
  }> {
    const [completed, failed, pending] = await Promise.all([
      this.peerCrawlerTaskRepository.count({ where: { status: 'completed' } }),
      this.peerCrawlerTaskRepository.count({ where: { status: 'failed' } }),
      this.peerCrawlerTaskRepository.count({ where: { status: 'pending' } }),
    ])

    return { completed, failed, pending }
  }

  /**
   * 获取24小时统计
   */
  async getLast24hStats(): Promise<{
    totalCount: number
    successCount: number
    failedCount: number
    successRate: number
  }> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const logs = await this.crawlerLogRepository.find({
      where: {
        crawledAt: MoreThan(since),
      },
      order: {
        crawledAt: 'DESC',
      },
    })

    const totalCount = logs.length
    const successCount = logs.filter((log) => log.status === 'success').length
    const failedCount = totalCount - successCount
    const successRate = totalCount > 0 ? successCount / totalCount : 0

    return {
      totalCount,
      successCount,
      failedCount,
      successRate,
    }
  }

  /**
   * 获取最近的连续失败次数
   * 检查所有采集源的连续失败情况，返回最大值
   */
  async getRecentConsecutiveFailures(): Promise<number> {
    // 获取所有采集源
    const sources = await this.radarSourceRepository.find({
      select: ['source'],
    })

    let maxConsecutiveFailures = 0

    for (const { source } of sources) {
      const logs = await this.crawlerLogRepository.find({
        where: { source },
        order: { crawledAt: 'DESC' },
        take: 10,
      })

      let consecutiveFailures = 0
      for (const log of logs) {
        if (log.status === 'failed') {
          consecutiveFailures++
        } else {
          break
        }
      }

      if (consecutiveFailures > maxConsecutiveFailures) {
        maxConsecutiveFailures = consecutiveFailures
      }
    }

    return maxConsecutiveFailures
  }

  /**
   * 获取指定采集源的连续失败次数
   */
  async getConsecutiveFailuresForSource(source: string): Promise<number> {
    const logs = await this.crawlerLogRepository.find({
      where: { source },
      order: { crawledAt: 'DESC' },
      take: 10,
    })

    let consecutiveFailures = 0
    for (const log of logs) {
      if (log.status === 'failed') {
        consecutiveFailures++
      } else {
        break
      }
    }

    return consecutiveFailures
  }

  /**
   * 获取采集统计
   * 用于统计页面展示
   */
  async getCrawlerStats(days: number = 30): Promise<{
    successRateTrend: { date: string; rate: number }[]
    sourceComparison: { peerName: string; success: number; failed: number }[]
    contentTypeDistribution: { type: string; count: number }[]
  }> {
    const [successRateTrend, sourceComparison, contentTypeDistribution] = await Promise.all([
      this.getSuccessRateTrend(days),
      this.getSourceComparison(),
      this.getContentTypeDistribution(days),
    ])

    return {
      successRateTrend,
      sourceComparison,
      contentTypeDistribution,
    }
  }

  /**
   * 获取成功率趋势（最近N天）
   */
  private async getSuccessRateTrend(days: number): Promise<{ date: string; rate: number }[]> {
    const result: { date: string; rate: number }[] = []
    const today = new Date()

    for (let i = days - 1; i >= 0; i--) {
      // Create a new date for each iteration to avoid mutation issues
      const targetDate = new Date(today)
      targetDate.setDate(targetDate.getDate() - i)

      // Extract date string before modifying time
      const dateStr = targetDate.toISOString().split('T')[0]

      // Create separate Date objects for start and end of day
      const startOfDay = new Date(targetDate)
      startOfDay.setHours(0, 0, 0, 0)

      const endOfDay = new Date(targetDate)
      endOfDay.setHours(23, 59, 59, 999)

      const logs = await this.crawlerLogRepository.find({
        where: {
          crawledAt: Between(startOfDay, endOfDay),
        },
      })

      const total = logs.length
      const success = logs.filter((log) => log.status === 'success').length
      const rate = total > 0 ? Math.round((success / total) * 100) : 0

      result.push({ date: dateStr, rate })
    }

    return result
  }

  /**
   * 获取各采集源的成功/失败对比
   */
  private async getSourceComparison(): Promise<{ peerName: string; success: number; failed: number }[]> {
    const sources = await this.radarSourceRepository.find({
      select: ['source', 'peerName'],
    })

    const result: { peerName: string; success: number; failed: number }[] = []

    for (const source of sources) {
      const logs = await this.crawlerLogRepository.find({
        where: { source: source.source },
      })

      const success = logs.filter((log) => log.status === 'success').length
      const failed = logs.filter((log) => log.status === 'failed').length

      result.push({
        peerName: source.peerName || source.source,
        success,
        failed,
      })
    }

    return result
  }

  /**
   * 获取内容类型分布
   */
  private async getContentTypeDistribution(days: number): Promise<{ type: string; count: number }[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // 获取成功的采集记录
    const logs = await this.crawlerLogRepository.find({
      where: {
        crawledAt: MoreThan(since),
        status: 'success',
      },
    })

    // 按类别统计
    const categoryCount: Record<string, number> = {}
    for (const log of logs) {
      const category = log.category || 'unknown'
      categoryCount[category] = (categoryCount[category] || 0) + log.itemsCollected
    }

    // 转换为数组格式
    const typeMap: Record<string, string> = {
      tech: '技术文章',
      industry: '行业资讯',
      compliance: '合规动态',
      unknown: '其他',
    }

    return Object.entries(categoryCount).map(([type, count]) => ({
      type: typeMap[type] || type,
      count,
    }))
  }
}
