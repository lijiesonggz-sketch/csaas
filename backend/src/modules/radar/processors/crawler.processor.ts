import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue, Job } from 'bullmq'
import { CrawlerService } from '../services/crawler.service'
import { CrawlerLogService } from '../services/crawler-log.service'
import { RadarSourceService } from '../services/radar-source.service'
import { PeerCrawlerService, PeerCrawlerJobData } from '../services/peer-crawler.service'

/**
 * 爬虫任务数据结构
 */
export interface CrawlerJobData {
  source: string
  category: 'tech' | 'industry' | 'compliance'
  url: string
  type?: 'wechat' | 'recruitment' | 'conference' | 'website'
  peerName?: string
  crawlConfig?: {
    selector?: string
    listSelector?: string
    titleSelector?: string
    contentSelector?: string
    dateSelector?: string
    authorSelector?: string
  }
  sourceId?: string
}

/**
 * 统一任务数据结构（支持普通爬虫和同业采集）
 */
export type RadarCrawlJobData = CrawlerJobData | PeerCrawlerJobData

/**
 * CrawlerProcessor
 *
 * 处理爬虫队列任务
 *
 * Story 2.1: 爬虫和文件导入机制
 * Story 8.2: 同业采集任务调度与执行
 */
@Processor('radar-crawler', {
  concurrency: 5, // 并发数
})
export class CrawlerProcessor extends WorkerHost {
  private readonly logger = new Logger(CrawlerProcessor.name)

  constructor(
    private readonly crawlerService: CrawlerService,
    private readonly crawlerLogService: CrawlerLogService,
    private readonly radarSourceService: RadarSourceService,
    private readonly peerCrawlerService: PeerCrawlerService,
    @InjectQueue('radar-ai-analysis')
    private readonly aiAnalysisQueue: Queue,
  ) {
    super()
  }

  /**
   * 处理爬虫任务
   * 支持两种类型的任务：
   * 1. 普通爬虫任务（CrawlerJobData）
   * 2. 同业采集任务（PeerCrawlerJobData）
   */
  async process(job: Job<RadarCrawlJobData>): Promise<any> {
    // 验证 job.data 是否存在
    if (!job || !job.data) {
      this.logger.error('Invalid job: job or job.data is null/undefined')
      return {
        success: false,
        error: 'Invalid job data',
      }
    }

    const jobData = job.data

    // 判断任务类型
    if (this.isPeerCrawlJob(jobData)) {
      return this.processPeerCrawlJob(job as Job<PeerCrawlerJobData>, jobData)
    } else {
      return this.processRegularCrawlJob(job as Job<CrawlerJobData>, jobData as CrawlerJobData)
    }
  }

  /**
   * 判断是否为同业采集任务
   */
  private isPeerCrawlJob(jobData: RadarCrawlJobData): jobData is PeerCrawlerJobData {
    return (jobData as PeerCrawlerJobData).type === 'peer-crawl'
  }

  /**
   * 处理同业采集任务
   * Story 8.2: 同业采集任务调度与执行
   */
  private async processPeerCrawlJob(
    job: Job<PeerCrawlerJobData>,
    jobData: PeerCrawlerJobData,
  ): Promise<any> {
    const { taskId, sourceId, targetUrl, retryCount } = jobData

    this.logger.log(
      `Processing peer crawl job: task=${taskId}, source=${sourceId}, url=${targetUrl} (Attempt ${job.attemptsMade + 1})`,
    )

    // 调用PeerCrawlerService执行任务
    const result = await this.peerCrawlerService.executeTask({
      ...jobData,
      retryCount: job.attemptsMade, // 使用BullMQ的重试次数
    })

    // 如果执行失败且未达到最大重试次数，抛出错误触发重试
    // 使用 job.opts.attempts 获取配置的最大重试次数，默认为3
    const maxAttempts = job.opts?.attempts ?? 3
    if (!result.success && job.attemptsMade < maxAttempts - 1) {
      throw new Error(result.error || 'Peer crawl task failed')
    }

    return result
  }

  /**
   * 处理普通爬虫任务
   */
  private async processRegularCrawlJob(
    job: Job<CrawlerJobData>,
    jobData: CrawlerJobData,
  ): Promise<any> {
    const { source, category, url } = jobData

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

      // Story 8.1: 更新信息源爬取状态为成功
      if (jobData.sourceId) {
        await this.radarSourceService.updateCrawlStatus(jobData.sourceId, 'success')
      }

      return {
        success: true,
        contentId: rawContent.id,
      }
    } catch (error) {
      this.logger.error(
        `Crawler job failed: ${source} - ${url} (Attempt ${job.attemptsMade + 1})`,
        error.stack,
      )

      // Story 8.1: 更新信息源爬取状态为失败
      if (jobData.sourceId) {
        await this.radarSourceService.updateCrawlStatus(jobData.sourceId, 'failed', error.message)
      }

      // BullMQ会自动重试（根据配置最多3次）
      // attemptsMade从0开始，所以当attemptsMade < 2时还可以重试
      if (job.attemptsMade < 2) {
        throw error // 触发重试
      }

      // Story 8.1: 检查是否需要自动禁用（连续失败3次）
      if (jobData.sourceId) {
        const consecutiveFailures = await this.crawlerLogService.getConsecutiveFailures(source)
        const wasAutoDisabled = await this.radarSourceService.checkAndAutoDisable(
          jobData.sourceId,
          consecutiveFailures + 1, // 加上当前这次失败
        )

        if (wasAutoDisabled) {
          this.logger.warn(
            `Source ${source} was auto-disabled after ${consecutiveFailures + 1} consecutive failures`,
          )
        }
      }

      return {
        success: false,
        error: error.message,
      }
    }
  }
}
