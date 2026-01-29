import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { RadarSource } from '../../../database/entities/radar-source.entity'
import { CrawlerService } from './crawler.service'
import { RawContent } from '../../../database/entities/raw-content.entity'

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
    const query = this.radarSourceRepository.createQueryBuilder('source')

    if (category) {
      query.andWhere('source.category = :category', { category })
    }

    if (isActive !== undefined) {
      query.andWhere('source.isActive = :isActive', { isActive })
    }

    query.orderBy('source.createdAt', 'DESC')

    return query.getMany()
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
  }): Promise<RadarSource> {
    const radarSource = this.radarSourceRepository.create({
      ...data,
      isActive: data.isActive ?? true,
      crawlSchedule: data.crawlSchedule ?? '0 3 * * *',
      lastCrawlStatus: 'pending',
    })

    const saved = await this.radarSourceRepository.save(radarSource)
    this.logger.log(`Created new radar source: ${saved.source} (${saved.id})`)

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
    },
  ): Promise<RadarSource> {
    const source = await this.findById(id)

    Object.assign(source, data)

    const updated = await this.radarSourceRepository.save(source)
    this.logger.log(`Updated radar source: ${updated.source} (${updated.id})`)

    return updated
  }

  /**
   * 删除信息源
   * @param id - 信息源 ID
   */
  async delete(id: string): Promise<void> {
    const source = await this.findById(id)

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
  async updateCrawlStatus(
    id: string,
    status: 'success' | 'failed',
    error?: string,
  ): Promise<void> {
    const source = await this.findById(id)

    source.lastCrawledAt = new Date()
    source.lastCrawlStatus = status
    source.lastCrawlError = error || null

    await this.radarSourceRepository.save(source)
    this.logger.log(
      `Updated crawl status for ${source.source} (${id}): ${status}`,
    )
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
   *
   * @param source - 信息源
   * @returns RawContent - 爬取的内容
   */
  async testCrawl(source: RadarSource): Promise<RawContent> {
    this.logger.log(`Testing crawl for source: ${source.source} (${source.id})`)

    try {
      // 调用爬虫服务进行爬取
      const result = await this.crawlerService.crawlWebsite(
        source.source,
        source.category,
        source.url,
        0, // retryCount
        {
          contentType: source.type,
          peerName: source.peerName,
        },
      )

      // 更新最后爬取状态为成功
      await this.updateCrawlStatus(source.id, 'success')

      this.logger.log(
        `Test crawl successful for ${source.source}: ${result.title}`,
      )

      return result
    } catch (error) {
      // 更新最后爬取状态为失败
      await this.updateCrawlStatus(source.id, 'failed', error.message)

      this.logger.error(
        `Test crawl failed for ${source.source}: ${error.message}`,
      )

      throw error
    }
  }
}
