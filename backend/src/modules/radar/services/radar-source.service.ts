import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { RadarSource } from '../../../database/entities/radar-source.entity'
import { CrawlerService } from './crawler.service'
import { RawContent } from '../../../database/entities/raw-content.entity'
import { RadarSourceSchedulerService } from './radar-source-scheduler.service'
import { CrawlerLogService } from './crawler-log.service'

/**
 * RadarSourceService - 雷达信息源管理服务
 *
 * Story 3.1: 配置行业雷达信息源
 *
 * 核心功能：
 * - CRUD 操作：创建、读取、更新、删除信息源
 * - 启用/禁用控制：toggleActive
 * - 按类别查询：getActiveSourcesByCategory
 * - 更新爬取状态：updateCrawlStatus
 */
@Injectable()
export class RadarSourceService {
  private readonly logger = new Logger(RadarSourceService.name)

  constructor(
    @InjectRepository(RadarSource)
    private readonly radarSourceRepository: Repository<RadarSource>,
    private readonly crawlerService: CrawlerService,
    private readonly schedulerService: RadarSourceSchedulerService,
    private readonly crawlerLogService: CrawlerLogService,
  ) {}

  /**
   * 查询所有信息源
   * @param category - 可选的类别筛选
   * @param isActive - 可选的启用状态筛选
   * @returns RadarSource[]
   */
  async findAll(
    category?: 'tech' | 'industry' | 'compliance',
    isActive?: boolean,
  ): Promise<RadarSource[]> {
    const where: any = {}

    if (category) {
      where.category = category
    }

    if (isActive !== undefined) {
      where.isActive = isActive
    }

    return this.radarSourceRepository.find({
      where,
      order: { createdAt: 'DESC' },
    })
  }

  /**
   * 通过 ID 查找信息源
   * @param id - 信息源 ID
   * @returns RadarSource
   * @throws NotFoundException
   */
  async findById(id: string): Promise<RadarSource> {
    const source = await this.radarSourceRepository.findOne({
      where: { id },
    })

    if (!source) {
      throw new NotFoundException(`RadarSource with ID ${id} not found`)
    }

    return source
  }

  /**
   * 创建新的信息源
   * @param data - 信息源数据
   * @returns RadarSource
   */
  async create(data: {
    source: string
    category: 'tech' | 'industry' | 'compliance'
    url: string
    type: 'wechat' | 'recruitment' | 'conference' | 'website'
    peerName?: string
    isActive?: boolean
    crawlSchedule?: string
    crawlConfig?: {
      selector?: string
      listSelector?: string
      titleSelector?: string
      contentSelector?: string
      dateSelector?: string
      authorSelector?: string
      paginationPattern?: string
      maxPages?: number
    }
  }): Promise<RadarSource> {
    const radarSource = this.radarSourceRepository.create({
      ...data,
      isActive: data.isActive ?? true,
      crawlSchedule: data.crawlSchedule ?? '0 3 * * *',
      lastCrawlStatus: 'pending',
    })

    const saved = await this.radarSourceRepository.save(radarSource)
    this.logger.log(`Created new radar source: ${saved.source} (${saved.id})`)

    // Story 8.1: 如果启用，添加到调度队列
    if (saved.isActive) {
      await this.schedulerService.scheduleCrawlerJob(saved)
    }

    return saved
  }

  /**
   * 更新信息源
   * @param id - 信息源 ID
   * @param data - 更新数据
   * @returns RadarSource
   */
  async update(
    id: string,
    data: {
      source?: string
      url?: string
      type?: 'wechat' | 'recruitment' | 'conference' | 'website'
      peerName?: string
      isActive?: boolean
      crawlSchedule?: string
      crawlConfig?: {
        selector?: string
        listSelector?: string
        titleSelector?: string
        contentSelector?: string
        dateSelector?: string
        authorSelector?: string
        paginationPattern?: string
        maxPages?: number
      }
    },
  ): Promise<RadarSource> {
    const source = await this.findById(id)

    // 记录旧值用于判断是否需要重新调度
    const oldSchedule = source.crawlSchedule
    const wasActive = source.isActive

    Object.assign(source, data)

    const updated = await this.radarSourceRepository.save(source)
    this.logger.log(`Updated radar source: ${updated.source} (${updated.id})`)

    // Story 8.1: 如果调度时间或启用状态变更，重新调度
    await this.schedulerService.rescheduleCrawlerJob(updated, oldSchedule, wasActive)

    return updated
  }

  /**
   * 删除信息源
   * @param id - 信息源 ID
   */
  async delete(id: string): Promise<void> {
    const source = await this.findById(id)

    // Story 8.1: 从调度队列中移除
    await this.schedulerService.removeCrawlerJob(id)

    await this.radarSourceRepository.remove(source)
    this.logger.log(`Deleted radar source: ${source.source} (${id})`)
  }

  /**
   * 切换信息源启用状态
   * @param id - 信息源 ID
   * @returns RadarSource
   */
  async toggleActive(id: string): Promise<RadarSource> {
    const source = await this.findById(id)

    source.isActive = !source.isActive

    const updated = await this.radarSourceRepository.save(source)
    this.logger.log(
      `Toggled radar source active status: ${updated.source} (${updated.id}) -> ${updated.isActive}`,
    )

    return updated
  }

  /**
   * 获取指定类别的所有启用的信息源
   * 用于爬虫调度器
   *
   * @param category - 雷达类别
   * @returns RadarSource[]
   */
  async getActiveSourcesByCategory(
    category: 'tech' | 'industry' | 'compliance',
  ): Promise<RadarSource[]> {
    return this.radarSourceRepository.find({
      where: {
        category,
        isActive: true,
      },
      order: {
        createdAt: 'ASC',
      },
    })
  }

  /**
   * 更新爬取状态
   * 爬虫执行后调用此方法更新状态
   *
   * @param id - 信息源 ID
   * @param status - 爬取状态
   * @param error - 错误信息（可选）
   */
  async updateCrawlStatus(id: string, status: 'success' | 'failed', error?: string): Promise<void> {
    const source = await this.findById(id)

    source.lastCrawledAt = new Date()
    source.lastCrawlStatus = status
    source.lastCrawlError = error || null

    await this.radarSourceRepository.save(source)
    this.logger.log(`Updated crawl status for ${source.source} (${id}): ${status}`)
  }

  /**
   * 获取需要爬取的信息源
   * 根据 crawlSchedule 和 lastCrawledAt 判断
   * 简化版本：返回所有启用的信息源
   *
   * @param category - 雷达类别
   * @returns RadarSource[]
   */
  async getSourcesDueForCrawl(
    category: 'tech' | 'industry' | 'compliance',
  ): Promise<RadarSource[]> {
    // 简化实现：返回所有启用的信息源
    // 实际生产环境可以根据 cron 表达式和 lastCrawledAt 进行更精确的判断
    return this.getActiveSourcesByCategory(category)
  }

  /**
   * 批量创建信息源
   * 用于数据初始化
   *
   * @param sources - 信息源数据数组
   * @returns RadarSource[]
   */
  async createMany(
    sources: Array<{
      source: string
      category: 'tech' | 'industry' | 'compliance'
      url: string
      type: 'wechat' | 'recruitment' | 'conference' | 'website'
      peerName?: string
      isActive?: boolean
      crawlSchedule?: string
      crawlConfig?: {
        selector?: string
        listSelector?: string
        titleSelector?: string
        contentSelector?: string
        dateSelector?: string
        authorSelector?: string
        paginationPattern?: string
        maxPages?: number
      }
    }>,
  ): Promise<RadarSource[]> {
    const radarSources = sources.map((data) =>
      this.radarSourceRepository.create({
        ...data,
        isActive: data.isActive ?? true,
        crawlSchedule: data.crawlSchedule ?? '0 3 * * *',
        lastCrawlStatus: 'pending',
      }),
    )

    const saved = await this.radarSourceRepository.save(radarSources)
    this.logger.log(`Created ${saved.length} radar sources`)

    return saved
  }

  /**
   * 测试爬虫
   * 立即触发一次爬取，用于测试信息源配置
   * 测试采集的内容不保存到 RawContent（仅预览）
   *
   * Story 8.1: 同业采集源管理
   *
   * @param source - 信息源
   * @returns 预览数据（不保存）
   */
  async testCrawl(source: RadarSource): Promise<{
    success: boolean
    title?: string
    summary?: string | null
    contentPreview: string
    url: string
    publishDate?: Date | null
    author?: string | null
    duration: number
    error?: string
  }> {
    this.logger.log(`Testing crawl for source: ${source.source} (${source.id})`)
    const startTime = Date.now()

    try {
      // 调用爬虫服务进行爬取（预览模式，不保存）
      const result = await this.crawlerService.crawlWebsitePreview(
        source.source,
        source.category,
        source.url,
        {
          contentType: source.type,
          peerName: source.peerName,
          crawlConfig: source.crawlConfig,
        },
      )

      const duration = Date.now() - startTime

      // 更新最后爬取状态为成功
      await this.updateCrawlStatus(source.id, 'success')

      this.logger.log(`Test crawl successful for ${source.source}: ${result.title} (${duration}ms)`)

      return {
        success: true,
        title: result.title,
        summary: result.summary,
        contentPreview: result.fullContent?.substring(0, 500) || '',
        url: result.url,
        publishDate: result.publishDate,
        author: result.author,
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      // 更新最后爬取状态为失败（仅在 source.id 存在时）
      if (source.id) {
        try {
          await this.updateCrawlStatus(source.id, 'failed', errorMessage)
        } catch (updateError) {
          this.logger.warn(`Failed to update crawl status for ${source.source}: ${updateError.message}`)
        }
      }

      this.logger.error(`Test crawl failed for ${source.source}: ${errorMessage}`)

      return {
        success: false,
        contentPreview: '',
        url: source.url,
        duration,
        error: errorMessage,
      }
    }
  }

  /**
   * 检查并自动禁用连续失败的信息源
   * Story 8.1: 同业采集源管理 - 自动禁用逻辑
   *
   * @param sourceId - 信息源 ID
   * @param consecutiveFailures - 当前连续失败次数
   * @returns 是否被自动禁用
   */
  async checkAndAutoDisable(sourceId: string, consecutiveFailures: number): Promise<boolean> {
    const AUTO_DISABLE_THRESHOLD = 3

    if (consecutiveFailures >= AUTO_DISABLE_THRESHOLD) {
      const source = await this.findById(sourceId)

      if (source.isActive) {
        source.isActive = false
        source.lastCrawlError = `自动禁用：连续失败 ${consecutiveFailures} 次`
        await this.radarSourceRepository.save(source)

        // 从调度队列中移除
        await this.schedulerService.removeCrawlerJob(sourceId)

        this.logger.warn(
          `Auto-disabled radar source ${source.source} (${sourceId}) after ${consecutiveFailures} consecutive failures`,
        )

        // TODO: 发送告警通知管理员

        return true
      }
    }

    return false
  }

  /**
   * 获取信息源统计信息
   * Story 8.1: 同业采集源管理 - 显示成功率
   *
   * @param sourceId - 信息源 ID
   * @returns 统计信息
   */
  async getSourceStats(sourceId: string): Promise<{
    source: RadarSource
    totalRuns: number
    successCount: number
    failureCount: number
    successRate: number
    consecutiveFailures: number
    lastCrawledAt: Date | null
  }> {
    const source = await this.findById(sourceId)

    // 从 CrawlerLogService 获取统计信息
    const stats = await this.crawlerLogService.getSourceStats(source.source)

    return {
      source,
      totalRuns: stats.totalRuns,
      successCount: stats.successCount,
      failureCount: stats.failureCount,
      successRate: stats.successRate,
      consecutiveFailures: stats.consecutiveFailures,
      lastCrawledAt: stats.lastCrawledAt || source.lastCrawledAt,
    }
  }
}
