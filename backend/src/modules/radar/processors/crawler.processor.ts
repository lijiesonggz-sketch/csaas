import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue, Job } from 'bullmq'
import { CrawlerService } from '../services/crawler.service'

/**
 * 爬虫任务数据结构
 */
export interface CrawlerJobData {
  source: string
  category: 'tech' | 'industry' | 'compliance'
  url: string
}

/**
 * CrawlerProcessor
 *
 * 处理爬虫队列任务
 *
 * Story 2.1: 爬虫和文件导入机制
 */
@Processor('radar-crawler', {
  concurrency: 5, // 并发数
})
export class CrawlerProcessor extends WorkerHost {
  private readonly logger = new Logger(CrawlerProcessor.name)

  constructor(
    private readonly crawlerService: CrawlerService,
    @InjectQueue('radar-ai-analysis')
    private readonly aiAnalysisQueue: Queue,
  ) {
    super()
  }

  /**
   * 处理爬虫任务
   */
  async process(job: Job<CrawlerJobData>): Promise<any> {
    const { source, category, url } = job.data

    this.logger.log(`Processing crawler job: ${source} - ${url} (Attempt ${job.attemptsMade + 1})`)

    try {
      // 执行爬虫（CrawlerService内部会触发AI分析任务）
      const rawContent = await this.crawlerService.crawlWebsite(
        source,
        category,
        url,
        job.attemptsMade, // 传递重试次数
      )

      this.logger.log(`Crawler job completed: ${source} - ${url}`)

      return {
        success: true,
        contentId: rawContent.id,
      }
    } catch (error) {
      this.logger.error(
        `Crawler job failed: ${source} - ${url} (Attempt ${job.attemptsMade + 1})`,
        error.stack,
      )

      // BullMQ会自动重试（根据配置最多3次）
      // attemptsMade从0开始，所以当attemptsMade < 2时还可以重试
      if (job.attemptsMade < 2) {
        throw error // 触发重试
      }

      return {
        success: false,
        error: error.message,
      }
    }
  }
}
