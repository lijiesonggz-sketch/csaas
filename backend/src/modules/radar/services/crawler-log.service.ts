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
}
