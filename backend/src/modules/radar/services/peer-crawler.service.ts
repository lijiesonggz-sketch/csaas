import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue, Job } from 'bullmq'
import * as cheerio from 'cheerio'
import { PeerCrawlerTask } from '../../../database/entities/peer-crawler-task.entity'
import { RadarSource } from '../../../database/entities/radar-source.entity'
import { RawContent } from '../../../database/entities/raw-content.entity'
import { PeerCrawlerTaskRepository } from '../../../database/repositories/peer-crawler-task.repository'
import { CrawlerService } from './crawler.service'
import { RawContentService } from './raw-content.service'
import { CrawlerLogService } from './crawler-log.service'
import { RadarSourceService } from './radar-source.service'

/**
 * PeerCrawlerJobData - 同业采集任务数据结构
 */
export interface PeerCrawlerJobData {
  type: 'peer-crawl'
  taskId: string
  sourceId: string
  peerName: string
  tenantId: string
  targetUrl: string
  crawlConfig: {
    selector?: string
    listSelector?: string
    titleSelector?: string
    contentSelector?: string
    dateSelector?: string
    authorSelector?: string
    paginationPattern?: string
    maxPages?: number
  }
  retryCount: number
}

/**
 * PeerCrawlerService
 *
 * 同业采集任务的核心服务
 *
 * Story 8.2: 同业采集任务调度与执行
 */
@Injectable()
export class PeerCrawlerService {
  private readonly logger = new Logger(PeerCrawlerService.name)

  constructor(
    private readonly peerCrawlerTaskRepository: PeerCrawlerTaskRepository,
    @InjectRepository(RawContent)
    private readonly rawContentRepository: Repository<RawContent>,
    private readonly crawlerService: CrawlerService,
    private readonly rawContentService: RawContentService,
    private readonly crawlerLogService: CrawlerLogService,
    private readonly radarSourceService: RadarSourceService,
    @InjectQueue('radar-crawler')
    private readonly crawlQueue: Queue,
    @InjectQueue('radar-ai-analysis')
    private readonly aiAnalysisQueue: Queue,
  ) {}

  /**
   * 创建采集任务
   * 将任务记录到数据库并加入队列
   */
  async createTask(source: RadarSource, tenantId: string = 'default'): Promise<PeerCrawlerTask> {
    // 创建任务记录
    const task = await this.peerCrawlerTaskRepository.create({
      sourceId: source.id,
      peerName: source.peerName || source.source,
      tenantId,
      sourceType: source.type,
      targetUrl: source.url,
      status: 'pending',
    })

    // 构建Job数据
    const jobData: PeerCrawlerJobData = {
      type: 'peer-crawl',
      taskId: task.id,
      sourceId: source.id,
      peerName: source.peerName || source.source,
      tenantId,
      targetUrl: source.url,
      crawlConfig: source.crawlConfig || {},
      retryCount: 0,
    }

    // 加入队列（使用jobId避免重复）
    const jobId = `peer-${source.id}-${Date.now()}`
    await this.crawlQueue.add('peer-crawl', jobData, {
      jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000, // 2s, 4s, 8s
      },
    })

    this.logger.log(`Created peer crawler task: ${task.id} for source ${source.source}`)

    return task
  }

  /**
   * 执行采集任务
   * 由Processor调用
   */
  async executeTask(jobData: PeerCrawlerJobData): Promise<{
    success: boolean
    rawContentId?: string
    error?: string
  }> {
    const { taskId, sourceId, peerName, tenantId, targetUrl, crawlConfig, retryCount } = jobData

    this.logger.log(`Executing peer crawler task: ${taskId} - ${targetUrl}`)

    try {
      // 更新任务状态为运行中
      await this.peerCrawlerTaskRepository.updateTaskStatus(taskId, 'running')

      // 获取RadarSource以获取source名称
      const source = await this.radarSourceService.findById(sourceId)

      // 执行爬取
      const crawlResult = await this.crawlerService.crawlWebsitePreview(
        source.source,
        'industry',
        targetUrl,
        {
          contentType: source.type,
          peerName: source.peerName,
          crawlConfig,
        },
      )

      // 解析内容
      const parsedContent = this.parseContent(crawlResult.fullContent || '', crawlConfig)

      // 创建RawContent记录
      const rawContentData = {
        source: 'peer-crawler',
        category: 'industry' as const,
        title: crawlResult.title || parsedContent.title || 'Untitled',
        summary: crawlResult.summary,
        fullContent: crawlResult.fullContent || parsedContent.content,
        url: targetUrl,
        publishDate: crawlResult.publishDate,
        author: crawlResult.author || parsedContent.author,
        contentType: 'article' as const,
        peerName: peerName,
        organizationId: null as string | null,
      }

      const rawContent = await this.rawContentService.create(rawContentData)

      // 更新任务状态为完成
      await this.peerCrawlerTaskRepository.updateTaskStatus(taskId, 'completed', {
        crawlResult: {
          title: rawContentData.title,
          content: rawContentData.fullContent.substring(0, 500), // 存储摘要
          publishDate: rawContentData.publishDate?.toISOString(),
          author: rawContentData.author || undefined,
          url: targetUrl,
        },
        rawContentId: rawContent.id,
      })

      // 更新RadarSource状态
      await this.radarSourceService.updateCrawlStatus(sourceId, 'success')

      // 记录成功日志
      await this.crawlerLogService.logSuccess(source.source, 'industry', targetUrl, 1)

      // 触发AI分析任务（Story 8.3集成点）
      await this.triggerAIAnalysis(rawContent.id, taskId, peerName, tenantId)

      this.logger.log(`Peer crawler task completed: ${taskId}, RawContent: ${rawContent.id}`)

      return {
        success: true,
        rawContentId: rawContent.id,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      this.logger.error(`Peer crawler task failed: ${taskId} - ${errorMessage}`, error.stack)

      // 计算新的重试次数
      const newRetryCount = retryCount + 1

      // 更新重试次数
      await this.peerCrawlerTaskRepository.incrementRetryCount(taskId)

      // 更新任务状态为失败
      await this.peerCrawlerTaskRepository.updateTaskStatus(taskId, 'failed', {
        errorMessage,
        retryCount: newRetryCount,
      })

      // 获取RadarSource
      let sourceName = 'unknown'
      try {
        const source = await this.radarSourceService.findById(sourceId)
        sourceName = source.source

        // 更新RadarSource状态
        await this.radarSourceService.updateCrawlStatus(sourceId, 'failed', errorMessage)

        // 记录失败日志
        await this.crawlerLogService.logFailure(sourceName, 'industry', targetUrl, errorMessage, newRetryCount)
      } catch (e) {
        this.logger.warn(`Failed to update source status for ${sourceId}: ${e.message}`)
      }

      // 如果重试次数达到上限，触发告警（Story 8.5集成点）
      if (newRetryCount >= 3) {
        await this.handleMaxRetriesReached(taskId, sourceId, sourceName, errorMessage)
      }

      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * 根据选择器解析内容
   */
  parseContent(
    html: string,
    crawlConfig: {
      titleSelector?: string
      contentSelector?: string
      dateSelector?: string
      authorSelector?: string
    },
  ): {
    title: string
    content: string
    author: string | null
  } {
    const $ = cheerio.load(html)

    // 使用自定义选择器或回退到默认选择器
    const title = crawlConfig.titleSelector
      ? $(crawlConfig.titleSelector).first().text().trim()
      : $('h1').first().text().trim() ||
        $('title').text().trim() ||
        'Untitled'

    const content = crawlConfig.contentSelector
      ? $(crawlConfig.contentSelector).text().trim()
      : $('article').text().trim() ||
        $('.article-content').text().trim() ||
        $('.post-content').text().trim() ||
        $('.content').text().trim() ||
        $('main').text().trim() ||
        html

    const author = crawlConfig.authorSelector
      ? $(crawlConfig.authorSelector).first().text().trim()
      : $('.author').first().text().trim() ||
        $('meta[name="author"]').attr('content') ||
        null

    return {
      title,
      content: content.replace(/\s+/g, ' ').trim(),
      author,
    }
  }

  /**
   * 触发AI分析任务
   * Story 8.3集成点
   */
  private async triggerAIAnalysis(rawContentId: string, taskId: string, peerName?: string, tenantId?: string): Promise<void> {
    try {
      await this.aiAnalysisQueue.add('analyze-peer-content', {
        type: 'peer-content-analysis',
        rawContentId,
        peerName: peerName || '未知机构',
        content: '', // 将在processor中从RawContent加载
        tenantId: tenantId || 'default',
        sourceTaskId: taskId,
      })

      this.logger.log(`Triggered peer content AI analysis for RawContent: ${rawContentId}`)
    } catch (error) {
      this.logger.error(`Failed to trigger AI analysis: ${error.message}`)
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 处理最大重试次数达到的情况
   * Story 8.5集成点 - 触发告警
   */
  private async handleMaxRetriesReached(
    taskId: string,
    sourceId: string,
    sourceName: string,
    errorMessage: string,
  ): Promise<void> {
    this.logger.warn(`Max retries reached for task ${taskId}, triggering alert`)

    // 检查是否需要自动禁用
    try {
      const consecutiveFailures = await this.crawlerLogService.getConsecutiveFailures(sourceName)
      const wasAutoDisabled = await this.radarSourceService.checkAndAutoDisable(
        sourceId,
        consecutiveFailures + 1,
      )

      if (wasAutoDisabled) {
        this.logger.warn(`Source ${sourceName} was auto-disabled after ${consecutiveFailures + 1} consecutive failures`)
      }

      // TODO: Story 8.5 - 创建告警记录
      // await this.alertService.createAlert({
      //   type: 'crawler',
      //   severity: 'high',
      //   title: `同业采集任务失败: ${sourceName}`,
      //   message: `任务ID: ${taskId}, 错误: ${errorMessage}`,
      //   sourceId,
      //   taskId,
      // })
    } catch (error) {
      this.logger.error(`Failed to handle max retries: ${error.message}`)
    }
  }

  /**
   * 批量创建采集任务
   * 由Scheduler调用
   */
  async createTasksForSources(sources: RadarSource[], tenantId: string = 'default'): Promise<PeerCrawlerTask[]> {
    const tasks: PeerCrawlerTask[] = []

    for (const source of sources) {
      try {
        // 检查是否已有待处理的任务
        const existingTasks = await this.peerCrawlerTaskRepository.findTasksBySourceId(source.id, {
          where: { status: 'pending' },
        })

        if (existingTasks.length === 0) {
          const task = await this.createTask(source, tenantId)
          tasks.push(task)
        } else {
          this.logger.log(`Skipping source ${source.source}, pending task already exists`)
        }
      } catch (error) {
        this.logger.error(`Failed to create task for source ${source.source}: ${error.message}`)
      }
    }

    return tasks
  }

  /**
   * 获取任务统计
   */
  async getTaskStats(tenantId: string): Promise<{
    total: number
    pending: number
    running: number
    completed: number
    failed: number
  }> {
    const [total, pending, running, completed, failed] = await Promise.all([
      this.peerCrawlerTaskRepository.countTasks(tenantId),
      this.peerCrawlerTaskRepository.countTasks(tenantId, { status: 'pending' }),
      this.peerCrawlerTaskRepository.countTasks(tenantId, { status: 'running' }),
      this.peerCrawlerTaskRepository.countTasks(tenantId, { status: 'completed' }),
      this.peerCrawlerTaskRepository.countTasks(tenantId, { status: 'failed' }),
    ])

    return {
      total,
      pending,
      running,
      completed,
      failed,
    }
  }
}
