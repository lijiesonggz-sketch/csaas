import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CrawlerLog } from '../../../database/entities/crawler-log.entity'

/**
 * CrawlerLogService
 *
 * 管理爬虫日志的记录和查询
 *
 * Story 2.1: 爬虫和文件导入机制
 */
@Injectable()
export class CrawlerLogService {
  constructor(
    @InjectRepository(CrawlerLog)
    private readonly crawlerLogRepository: Repository<CrawlerLog>,
  ) {}

  /**
   * 记录成功的爬虫任务
   */
  async logSuccess(
    source: string,
    category: 'tech' | 'industry' | 'compliance',
    url: string,
    itemsCollected: number,
  ): Promise<void> {
    const log = this.crawlerLogRepository.create({
      source,
      category,
      url,
      status: 'success',
      itemsCollected,
      errorMessage: null,
      retryCount: 0,
      crawledAt: new Date(),
      crawlDuration: 0,
    })

    await this.crawlerLogRepository.save(log)
  }

  /**
   * 记录失败的爬虫任务
   */
  async logFailure(
    source: string,
    category: 'tech' | 'industry' | 'compliance',
    url: string,
    errorMessage: string,
    retryCount: number,
  ): Promise<void> {
    const log = this.crawlerLogRepository.create({
      source,
      category,
      url,
      status: 'failed',
      itemsCollected: 0,
      errorMessage,
      retryCount,
      crawledAt: new Date(),
      crawlDuration: 0,
    })

    await this.crawlerLogRepository.save(log)
  }

  /**
   * 获取最近的日志
   */
  async getRecentLogs(source: string, limit: number = 10): Promise<CrawlerLog[]> {
    return await this.crawlerLogRepository.find({
      where: { source },
      order: { crawledAt: 'DESC' },
      take: limit,
    })
  }

  /**
   * 计算成功率
   */
  async getSuccessRate(source: string): Promise<number> {
    const logs = await this.crawlerLogRepository.find({
      where: { source },
    })

    if (logs.length === 0) {
      return 0
    }

    const successCount = logs.filter((log) => log.status === 'success').length
    return (successCount / logs.length) * 100
  }

  /**
   * 获取最近的连续失败次数
   * Story 8.1: 同业采集源管理 - 自动禁用逻辑
   *
   * @param source - 信息源名称
   * @returns 连续失败次数
   */
  async getConsecutiveFailures(source: string): Promise<number> {
    const logs = await this.crawlerLogRepository.find({
      where: { source },
      order: { crawledAt: 'DESC' },
      take: 10, // 检查最近10条记录
    })

    let consecutiveFailures = 0
    for (const log of logs) {
      if (log.status === 'failed') {
        consecutiveFailures++
      } else {
        // 遇到成功记录，停止计数
        break
      }
    }

    return consecutiveFailures
  }

  /**
   * 获取信息源统计信息
   * Story 8.1: 同业采集源管理 - 显示成功率
   *
   * @param source - 信息源名称
   * @returns 统计信息
   */
  async getSourceStats(source: string): Promise<{
    totalRuns: number
    successCount: number
    failureCount: number
    successRate: number
    consecutiveFailures: number
    lastCrawledAt: Date | null
  }> {
    const logs = await this.crawlerLogRepository.find({
      where: { source },
      order: { crawledAt: 'DESC' },
    })

    const totalRuns = logs.length
    const successCount = logs.filter((log) => log.status === 'success').length
    const failureCount = totalRuns - successCount
    const successRate = totalRuns > 0 ? (successCount / totalRuns) * 100 : 0

    // 计算连续失败次数
    let consecutiveFailures = 0
    for (const log of logs) {
      if (log.status === 'failed') {
        consecutiveFailures++
      } else {
        break
      }
    }

    return {
      totalRuns,
      successCount,
      failureCount,
      successRate,
      consecutiveFailures,
      lastCrawledAt: logs.length > 0 ? logs[0].crawledAt : null,
    }
  }
}
