import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { RadarSourceService } from './radar-source.service'
import { RadarSource } from '../../../database/entities/radar-source.entity'
import { CrawlerService } from './crawler.service'
import { RadarSourceSchedulerService } from './radar-source-scheduler.service'
import { CrawlerLogService } from './crawler-log.service'

/**
 * RadarSourceService Unit Tests
 *
 * Story 8.1: 同业采集源管理
 */
describe('RadarSourceService', () => {
  let service: RadarSourceService
  let repository: Repository<RadarSource>
  let crawlerService: CrawlerService
  let schedulerService: RadarSourceSchedulerService
  let crawlerLogService: CrawlerLogService

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    })),
  }

  const mockCrawlerService = {
    crawlWebsitePreview: jest.fn(),
  }

  const mockSchedulerService = {
    scheduleCrawlerJob: jest.fn(),
    removeCrawlerJob: jest.fn(),
    rescheduleCrawlerJob: jest.fn(),
  }

  const mockCrawlerLogService = {
    getSourceStats: jest.fn(),
    getConsecutiveFailures: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RadarSourceService,
        {
          provide: getRepositoryToken(RadarSource),
          useValue: mockRepository,
        },
        {
          provide: CrawlerService,
          useValue: mockCrawlerService,
        },
        {
          provide: RadarSourceSchedulerService,
          useValue: mockSchedulerService,
        },
        {
          provide: CrawlerLogService,
          useValue: mockCrawlerLogService,
        },
      ],
    }).compile()

    service = module.get<RadarSourceService>(RadarSourceService)
    repository = module.get<Repository<RadarSource>>(getRepositoryToken(RadarSource))
    crawlerService = module.get<CrawlerService>(CrawlerService)
    schedulerService = module.get<RadarSourceSchedulerService>(RadarSourceSchedulerService)
    crawlerLogService = module.get<CrawlerLogService>(CrawlerLogService)

    jest.clearAllMocks()
  })

  describe('create', () => {
    it('should create a radar source with category=industry for peer crawler', async () => {
      const createData = {
        source: '杭州银行金融科技',
        category: 'industry' as const,
        url: 'https://example.com',
        type: 'website' as const,
        crawlSchedule: '0 */6 * * *',
        crawlConfig: {
          titleSelector: 'h1',
          contentSelector: 'article',
        },
        isActive: true,
      }

      const savedSource = {
        id: 'test-id',
        ...createData,
        lastCrawlStatus: 'pending',
        isActive: true,
      }

      mockRepository.create.mockReturnValue(savedSource)
      mockRepository.save.mockResolvedValue(savedSource)

      const result = await service.create(createData)

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createData,
        isActive: true,
        crawlSchedule: '0 */6 * * *',
        lastCrawlStatus: 'pending',
      })
      expect(mockRepository.save).toHaveBeenCalledWith(savedSource)
      expect(result).toEqual(savedSource)
    })

    it('should schedule crawler job when isActive=true', async () => {
      const createData = {
        source: 'Test Source',
        category: 'industry' as const,
        url: 'https://example.com',
        type: 'website' as const,
        isActive: true,
      }

      const savedSource = {
        id: 'test-id',
        ...createData,
        lastCrawlStatus: 'pending',
        crawlSchedule: '0 3 * * *',
      }

      mockRepository.create.mockReturnValue(savedSource)
      mockRepository.save.mockResolvedValue(savedSource)

      await service.create(createData)

      expect(mockSchedulerService.scheduleCrawlerJob).toHaveBeenCalledWith(savedSource)
    })
  })

  describe('update', () => {
    it('should reschedule job when crawlSchedule changes', async () => {
      const existingSource = {
        id: 'test-id',
        source: 'Test Source',
        category: 'industry',
        url: 'https://example.com',
        type: 'website',
        crawlSchedule: '0 3 * * *',
        isActive: true,
        lastCrawlStatus: 'pending',
      }

      mockRepository.findOne.mockResolvedValue(existingSource)
      mockRepository.save.mockResolvedValue({
        ...existingSource,
        crawlSchedule: '0 */6 * * *',
      })

      await service.update('test-id', { crawlSchedule: '0 */6 * * *' })

      expect(mockSchedulerService.rescheduleCrawlerJob).toHaveBeenCalledWith(
        expect.any(Object),
        '0 3 * * *',
        true,
      )
    })
  })

  describe('delete', () => {
    it('should remove crawler job when deleting source', async () => {
      const existingSource = {
        id: 'test-id',
        source: 'Test Source',
        category: 'industry',
        url: 'https://example.com',
        type: 'website',
        crawlSchedule: '0 3 * * *',
        isActive: true,
        lastCrawlStatus: 'pending',
      }

      mockRepository.findOne.mockResolvedValue(existingSource)
      mockRepository.remove.mockResolvedValue(existingSource)

      await service.delete('test-id')

      expect(mockSchedulerService.removeCrawlerJob).toHaveBeenCalledWith('test-id')
    })
  })

  describe('testCrawl', () => {
    it('should return preview data without saving to RawContent', async () => {
      const source: RadarSource = {
        id: 'test-id',
        source: 'Test Source',
        category: 'industry',
        url: 'https://example.com',
        type: 'website',
        isActive: true,
        crawlSchedule: '0 3 * * *',
        lastCrawlStatus: 'pending',
        crawlConfig: {
          titleSelector: 'h1',
          contentSelector: 'article',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const crawlResult = {
        title: 'Test Article',
        summary: 'Test summary',
        fullContent: 'Test content'.repeat(100),
        url: 'https://example.com',
        publishDate: new Date(),
        author: 'Test Author',
      }

      mockCrawlerService.crawlWebsitePreview.mockResolvedValue(crawlResult)
      mockRepository.findOne.mockResolvedValue(source)
      mockRepository.save.mockResolvedValue(source)

      const result = await service.testCrawl(source)

      expect(mockCrawlerService.crawlWebsitePreview).toHaveBeenCalledWith(
        source.source,
        source.category,
        source.url,
        {
          contentType: source.type,
          peerName: source.peerName,
          crawlConfig: source.crawlConfig,
        },
      )
      expect(result.success).toBe(true)
      expect(result.title).toBe(crawlResult.title)
      expect(result.contentPreview).toBe(crawlResult.fullContent.substring(0, 500))
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })

    it('should update lastCrawlStatus to failed when crawl fails', async () => {
      const source: RadarSource = {
        id: 'test-id',
        source: 'Test Source',
        category: 'industry',
        url: 'https://example.com',
        type: 'website',
        isActive: true,
        crawlSchedule: '0 3 * * *',
        lastCrawlStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockCrawlerService.crawlWebsitePreview.mockRejectedValue(new Error('Network error'))
      mockRepository.findOne.mockResolvedValue(source)
      mockRepository.save.mockResolvedValue(source)

      const result = await service.testCrawl(source)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lastCrawlStatus: 'failed',
          lastCrawlError: 'Network error',
        }),
      )
    })
  })

  describe('checkAndAutoDisable', () => {
    it('should auto-disable source after 3 consecutive failures', async () => {
      const source: RadarSource = {
        id: 'test-id',
        source: 'Test Source',
        category: 'industry',
        url: 'https://example.com',
        type: 'website',
        isActive: true,
        crawlSchedule: '0 3 * * *',
        lastCrawlStatus: 'failed',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockRepository.findOne.mockResolvedValue(source)
      mockRepository.save.mockResolvedValue({ ...source, isActive: false })

      const result = await service.checkAndAutoDisable('test-id', 3)

      expect(result).toBe(true)
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
          lastCrawlError: '自动禁用：连续失败 3 次',
        }),
      )
      expect(mockSchedulerService.removeCrawlerJob).toHaveBeenCalledWith('test-id')
    })

    it('should not disable source if less than 3 consecutive failures', async () => {
      const result = await service.checkAndAutoDisable('test-id', 2)

      expect(result).toBe(false)
      expect(mockRepository.findOne).not.toHaveBeenCalled()
    })
  })

  describe('findAll', () => {
    it('should filter by category=industry for peer crawler sources', async () => {
      const sources = [
        {
          id: '1',
          source: '杭州银行',
          category: 'industry',
          url: 'https://example1.com',
          type: 'website',
          isActive: true,
        },
        {
          id: '2',
          source: '宁波银行',
          category: 'industry',
          url: 'https://example2.com',
          type: 'wechat',
          isActive: true,
        },
      ]

      mockRepository.createQueryBuilder.mockReturnValue({
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(sources),
      })

      const result = await service.findAll('industry')

      expect(result).toEqual(sources)
    })
  })
})
