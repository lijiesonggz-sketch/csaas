import { Test, TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue, Job } from 'bullmq'
import { PeerCrawlerService, PeerCrawlerJobData } from './peer-crawler.service'
import { PeerCrawlerTaskRepository } from '../../../database/repositories/peer-crawler-task.repository'
import { RawContent } from '../../../database/entities/raw-content.entity'
import { CrawlerService } from './crawler.service'
import { RawContentService } from './raw-content.service'
import { CrawlerLogService } from './crawler-log.service'
import { RadarSourceService } from './radar-source.service'
import { RadarSource } from '../../../database/entities/radar-source.entity'
import { PeerCrawlerTask } from '../../../database/entities/peer-crawler-task.entity'

/**
 * PeerCrawlerService Unit Tests
 *
 * Story 8.2: 同业采集任务调度与执行
 */
describe('PeerCrawlerService', () => {
  let service: PeerCrawlerService
  let peerCrawlerTaskRepository: PeerCrawlerTaskRepository
  let rawContentRepository: Repository<RawContent>
  let crawlerService: CrawlerService
  let rawContentService: RawContentService
  let crawlerLogService: CrawlerLogService
  let radarSourceService: RadarSourceService
  let crawlQueue: Queue
  let aiAnalysisQueue: Queue

  const mockPeerCrawlerTaskRepository = {
    create: jest.fn(),
    updateTaskStatus: jest.fn(),
    incrementRetryCount: jest.fn(),
    findTasksBySourceId: jest.fn(),
    countTasks: jest.fn(),
  }

  const mockRawContentRepository = {
    create: jest.fn(),
    save: jest.fn(),
  }

  const mockCrawlerService = {
    crawlWebsitePreview: jest.fn(),
  }

  const mockRawContentService = {
    create: jest.fn(),
  }

  const mockCrawlerLogService = {
    logSuccess: jest.fn(),
    logFailure: jest.fn(),
    getConsecutiveFailures: jest.fn(),
  }

  const mockRadarSourceService = {
    findById: jest.fn(),
    updateCrawlStatus: jest.fn(),
    checkAndAutoDisable: jest.fn(),
  }

  const mockCrawlQueue = {
    add: jest.fn(),
  }

  const mockAiAnalysisQueue = {
    add: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeerCrawlerService,
        {
          provide: PeerCrawlerTaskRepository,
          useValue: mockPeerCrawlerTaskRepository,
        },
        {
          provide: getRepositoryToken(RawContent),
          useValue: mockRawContentRepository,
        },
        {
          provide: CrawlerService,
          useValue: mockCrawlerService,
        },
        {
          provide: RawContentService,
          useValue: mockRawContentService,
        },
        {
          provide: CrawlerLogService,
          useValue: mockCrawlerLogService,
        },
        {
          provide: RadarSourceService,
          useValue: mockRadarSourceService,
        },
        {
          provide: 'BullQueue_radar-crawler',
          useValue: mockCrawlQueue,
        },
        {
          provide: 'BullQueue_radar-ai-analysis',
          useValue: mockAiAnalysisQueue,
        },
      ],
    }).compile()

    service = module.get<PeerCrawlerService>(PeerCrawlerService)
    peerCrawlerTaskRepository = module.get<PeerCrawlerTaskRepository>(PeerCrawlerTaskRepository)
    rawContentRepository = module.get<Repository<RawContent>>(getRepositoryToken(RawContent))
    crawlerService = module.get<CrawlerService>(CrawlerService)
    rawContentService = module.get<RawContentService>(RawContentService)
    crawlerLogService = module.get<CrawlerLogService>(CrawlerLogService)
    radarSourceService = module.get<RadarSourceService>(RadarSourceService)
    crawlQueue = module.get<Queue>('BullQueue_radar-crawler')
    aiAnalysisQueue = module.get<Queue>('BullQueue_radar-ai-analysis')

    // Suppress logger output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation()
    jest.spyOn(Logger.prototype, 'error').mockImplementation()
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()

    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('createTask', () => {
    it('should create task and add to queue', async () => {
      const source: RadarSource = {
        id: 'source-1',
        source: '杭州银行金融科技',
        category: 'industry',
        url: 'https://example.com',
        type: 'website',
        isActive: true,
        crawlSchedule: '0 */4 * * *',
        crawlConfig: {
          titleSelector: 'h1',
          contentSelector: 'article',
        },
        lastCrawlStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const createdTask: PeerCrawlerTask = {
        id: 'task-1',
        sourceId: source.id,
        peerName: source.source,
        tenantId: 'default',
        sourceType: source.type,
        targetUrl: source.url,
        status: 'pending',
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        crawlResult: null,
        rawContentId: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
      }

      mockPeerCrawlerTaskRepository.create.mockResolvedValue(createdTask)
      mockCrawlQueue.add.mockResolvedValue({ id: 'job-1' })

      const result = await service.createTask(source)

      expect(mockPeerCrawlerTaskRepository.create).toHaveBeenCalledWith({
        sourceId: source.id,
        peerName: source.source,
        tenantId: 'default',
        sourceType: source.type,
        targetUrl: source.url,
        status: 'pending',
      })

      expect(mockCrawlQueue.add).toHaveBeenCalledWith(
        'peer-crawl',
        expect.objectContaining({
          type: 'peer-crawl',
          taskId: 'task-1',
          sourceId: source.id,
          peerName: source.source,
          tenantId: 'default',
          targetUrl: source.url,
          crawlConfig: source.crawlConfig,
          retryCount: 0,
        }),
        expect.objectContaining({
          jobId: expect.stringMatching(/^peer-source-1-\d+$/),
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        }),
      )

      expect(result).toEqual(createdTask)
    })

    it('should create task with custom tenantId', async () => {
      const source: RadarSource = {
        id: 'source-1',
        source: '杭州银行',
        category: 'industry',
        url: 'https://example.com',
        type: 'website',
        isActive: true,
        crawlSchedule: '0 */4 * * *',
        lastCrawlStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const createdTask: PeerCrawlerTask = {
        id: 'task-1',
        sourceId: source.id,
        peerName: source.source,
        tenantId: 'tenant-123',
        sourceType: source.type,
        targetUrl: source.url,
        status: 'pending',
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        crawlResult: null,
        rawContentId: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
      }

      mockPeerCrawlerTaskRepository.create.mockResolvedValue(createdTask)
      mockCrawlQueue.add.mockResolvedValue({ id: 'job-1' })

      const result = await service.createTask(source, 'tenant-123')

      expect(mockPeerCrawlerTaskRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
        }),
      )
      expect(result.tenantId).toBe('tenant-123')
    })

    it('should use peerName from source if available', async () => {
      const source: RadarSource = {
        id: 'source-1',
        source: '杭州银行官方',
        peerName: '杭州银行',
        category: 'industry',
        url: 'https://example.com',
        type: 'website',
        isActive: true,
        crawlSchedule: '0 */4 * * *',
        lastCrawlStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const createdTask: PeerCrawlerTask = {
        id: 'task-1',
        sourceId: source.id,
        peerName: '杭州银行',
        tenantId: 'default',
        sourceType: source.type,
        targetUrl: source.url,
        status: 'pending',
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        crawlResult: null,
        rawContentId: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
      }

      mockPeerCrawlerTaskRepository.create.mockResolvedValue(createdTask)
      mockCrawlQueue.add.mockResolvedValue({ id: 'job-1' })

      await service.createTask(source)

      expect(mockPeerCrawlerTaskRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          peerName: '杭州银行',
        }),
      )
    })

    it('should handle empty crawlConfig', async () => {
      const source: RadarSource = {
        id: 'source-1',
        source: '杭州银行',
        category: 'industry',
        url: 'https://example.com',
        type: 'website',
        isActive: true,
        crawlSchedule: '0 */4 * * *',
        crawlConfig: undefined,
        lastCrawlStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const createdTask: PeerCrawlerTask = {
        id: 'task-1',
        sourceId: source.id,
        peerName: source.source,
        tenantId: 'default',
        sourceType: source.type,
        targetUrl: source.url,
        status: 'pending',
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        crawlResult: null,
        rawContentId: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
      }

      mockPeerCrawlerTaskRepository.create.mockResolvedValue(createdTask)
      mockCrawlQueue.add.mockResolvedValue({ id: 'job-1' })

      await service.createTask(source)

      expect(mockCrawlQueue.add).toHaveBeenCalledWith(
        'peer-crawl',
        expect.objectContaining({
          crawlConfig: {},
        }),
        expect.any(Object),
      )
    })
  })

  describe('executeTask', () => {
    const mockJobData: PeerCrawlerJobData = {
      type: 'peer-crawl',
      taskId: 'task-1',
      sourceId: 'source-1',
      peerName: '杭州银行',
      tenantId: 'tenant-1',
      targetUrl: 'https://example.com',
      crawlConfig: {
        titleSelector: 'h1',
        contentSelector: 'article',
      },
      retryCount: 0,
    }

    const mockSource: RadarSource = {
      id: 'source-1',
      source: '杭州银行官方',
      category: 'industry',
      url: 'https://example.com',
      type: 'website',
      isActive: true,
      crawlSchedule: '0 */4 * * *',
      lastCrawlStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    it('should execute task successfully', async () => {
      const crawlResult = {
        title: 'Test Article',
        summary: 'Test summary',
        fullContent: '<article>Test content</article>',
        url: 'https://example.com',
        publishDate: new Date('2026-01-23'),
        author: 'Test Author',
      }

      const rawContent: RawContent = {
        id: 'raw-1',
        source: 'peer-crawler',
        category: 'industry',
        title: 'Test Article',
        summary: 'Test summary',
        fullContent: '<article>Test content</article>',
        url: 'https://example.com',
        publishDate: new Date('2026-01-23'),
        author: 'Test Author',
        contentHash: 'hash-123',
        status: 'pending',
        organizationId: null,
        contentType: 'article',
        peerName: '杭州银行',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockRadarSourceService.findById.mockResolvedValue(mockSource)
      mockCrawlerService.crawlWebsitePreview.mockResolvedValue(crawlResult)
      mockRawContentService.create.mockResolvedValue(rawContent)
      mockPeerCrawlerTaskRepository.updateTaskStatus.mockResolvedValue({
        id: 'task-1',
        status: 'completed',
      })
      mockRadarSourceService.updateCrawlStatus.mockResolvedValue(undefined)
      mockCrawlerLogService.logSuccess.mockResolvedValue(undefined)
      mockAiAnalysisQueue.add.mockResolvedValue({ id: 'ai-job-1' })

      const result = await service.executeTask(mockJobData)

      expect(result.success).toBe(true)
      expect(result.rawContentId).toBe('raw-1')

      expect(mockPeerCrawlerTaskRepository.updateTaskStatus).toHaveBeenCalledWith(
        'task-1',
        'running',
      )

      expect(mockCrawlerService.crawlWebsitePreview).toHaveBeenCalledWith(
        mockSource.source,
        'industry',
        mockJobData.targetUrl,
        {
          contentType: mockSource.type,
          peerName: mockSource.peerName,
          crawlConfig: mockJobData.crawlConfig,
        },
      )

      expect(mockRawContentService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'peer-crawler',
          category: 'industry',
          title: 'Test Article',
          summary: 'Test summary',
          fullContent: '<article>Test content</article>',
          url: mockJobData.targetUrl,
          publishDate: crawlResult.publishDate,
          author: 'Test Author',
          contentType: 'article',
          peerName: '杭州银行',
          organizationId: null,
        }),
      )

      expect(mockPeerCrawlerTaskRepository.updateTaskStatus).toHaveBeenCalledWith(
        'task-1',
        'completed',
        expect.objectContaining({
          crawlResult: expect.objectContaining({
            title: 'Test Article',
            url: mockJobData.targetUrl,
          }),
          rawContentId: 'raw-1',
        }),
      )

      expect(mockRadarSourceService.updateCrawlStatus).toHaveBeenCalledWith('source-1', 'success')
      expect(mockCrawlerLogService.logSuccess).toHaveBeenCalledWith(
        mockSource.source,
        'industry',
        mockJobData.targetUrl,
        1,
      )

      expect(mockAiAnalysisQueue.add).toHaveBeenCalledWith(
        'analyze-peer-content',
        expect.objectContaining({
          type: 'peer-content-analysis',
          rawContentId: 'raw-1',
          sourceTaskId: 'task-1',
          peerName: '杭州银行',
          tenantId: 'tenant-1',
        }),
      )
    })

    it('should use parsed content when crawl result has no fullContent', async () => {
      const crawlResult = {
        title: '',
        summary: '',
        fullContent: '',
        url: 'https://example.com',
      }

      const rawContent: RawContent = {
        id: 'raw-1',
        source: 'peer-crawler',
        category: 'industry',
        title: 'Parsed Title',
        summary: '',
        fullContent: 'Parsed content from HTML',
        url: 'https://example.com',
        publishDate: null,
        author: null,
        contentHash: 'hash-123',
        status: 'pending',
        organizationId: null,
        contentType: 'article',
        peerName: '杭州银行',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockRadarSourceService.findById.mockResolvedValue(mockSource)
      mockCrawlerService.crawlWebsitePreview.mockResolvedValue(crawlResult)
      mockRawContentService.create.mockResolvedValue(rawContent)
      mockPeerCrawlerTaskRepository.updateTaskStatus.mockResolvedValue({
        id: 'task-1',
        status: 'completed',
      })
      mockRadarSourceService.updateCrawlStatus.mockResolvedValue(undefined)
      mockCrawlerLogService.logSuccess.mockResolvedValue(undefined)
      mockAiAnalysisQueue.add.mockResolvedValue({ id: 'ai-job-1' })

      // Mock parseContent to return parsed content
      const parseContentSpy = jest.spyOn(service, 'parseContent').mockReturnValue({
        title: 'Parsed Title',
        content: 'Parsed content from HTML',
        author: null,
      })

      await service.executeTask(mockJobData)

      expect(parseContentSpy).toHaveBeenCalledWith('', mockJobData.crawlConfig)
      expect(mockRawContentService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Parsed Title',
          fullContent: 'Parsed content from HTML',
        }),
      )

      parseContentSpy.mockRestore()
    })

    it('should handle task execution failure', async () => {
      const error = new Error('Network timeout')

      mockPeerCrawlerTaskRepository.updateTaskStatus.mockResolvedValue({
        id: 'task-1',
        status: 'running',
      })
      mockRadarSourceService.findById.mockResolvedValue(mockSource)
      mockCrawlerService.crawlWebsitePreview.mockRejectedValue(error)
      mockPeerCrawlerTaskRepository.incrementRetryCount.mockResolvedValue(undefined)
      mockPeerCrawlerTaskRepository.updateTaskStatus.mockResolvedValue({
        id: 'task-1',
        status: 'failed',
      })
      mockRadarSourceService.updateCrawlStatus.mockResolvedValue(undefined)
      mockCrawlerLogService.logFailure.mockResolvedValue(undefined)

      const result = await service.executeTask(mockJobData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network timeout')

      expect(mockPeerCrawlerTaskRepository.incrementRetryCount).toHaveBeenCalledWith('task-1')
      expect(mockPeerCrawlerTaskRepository.updateTaskStatus).toHaveBeenCalledWith(
        'task-1',
        'failed',
        expect.objectContaining({
          errorMessage: 'Network timeout',
          retryCount: 1,
        }),
      )

      expect(mockRadarSourceService.updateCrawlStatus).toHaveBeenCalledWith(
        'source-1',
        'failed',
        'Network timeout',
      )

      expect(mockCrawlerLogService.logFailure).toHaveBeenCalledWith(
        mockSource.source,
        'industry',
        mockJobData.targetUrl,
        'Network timeout',
        1, // newRetryCount = retryCount + 1
      )
    })

    it('should handle non-Error exceptions', async () => {
      mockPeerCrawlerTaskRepository.updateTaskStatus.mockResolvedValue({
        id: 'task-1',
        status: 'running',
      })
      mockRadarSourceService.findById.mockResolvedValue(mockSource)
      mockCrawlerService.crawlWebsitePreview.mockRejectedValue('String error')
      mockPeerCrawlerTaskRepository.incrementRetryCount.mockResolvedValue(undefined)
      mockPeerCrawlerTaskRepository.updateTaskStatus.mockResolvedValue({
        id: 'task-1',
        status: 'failed',
      })
      mockRadarSourceService.updateCrawlStatus.mockResolvedValue(undefined)
      mockCrawlerLogService.logFailure.mockResolvedValue(undefined)

      const result = await service.executeTask(mockJobData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('String error')
    })

    it('should trigger max retries handler when retryCount >= 2', async () => {
      const jobDataWithRetries: PeerCrawlerJobData = {
        ...mockJobData,
        retryCount: 2,
      }

      mockPeerCrawlerTaskRepository.updateTaskStatus.mockResolvedValue({
        id: 'task-1',
        status: 'running',
      })
      mockRadarSourceService.findById.mockResolvedValue(mockSource)
      mockCrawlerService.crawlWebsitePreview.mockRejectedValue(new Error('Persistent error'))
      mockPeerCrawlerTaskRepository.incrementRetryCount.mockResolvedValue(undefined)
      mockPeerCrawlerTaskRepository.updateTaskStatus.mockResolvedValue({
        id: 'task-1',
        status: 'failed',
      })
      mockRadarSourceService.updateCrawlStatus.mockResolvedValue(undefined)
      mockCrawlerLogService.logFailure.mockResolvedValue(undefined)
      mockCrawlerLogService.getConsecutiveFailures.mockResolvedValue(2)
      mockRadarSourceService.checkAndAutoDisable.mockResolvedValue(true)

      await service.executeTask(jobDataWithRetries)

      expect(mockCrawlerLogService.getConsecutiveFailures).toHaveBeenCalledWith(mockSource.source)
      expect(mockRadarSourceService.checkAndAutoDisable).toHaveBeenCalledWith('source-1', 3)
    })

    it('should handle failure in source status update gracefully', async () => {
      mockPeerCrawlerTaskRepository.updateTaskStatus.mockResolvedValue({
        id: 'task-1',
        status: 'running',
      })
      mockRadarSourceService.findById.mockResolvedValue(mockSource)
      mockCrawlerService.crawlWebsitePreview.mockRejectedValue(new Error('Crawl error'))
      mockPeerCrawlerTaskRepository.incrementRetryCount.mockResolvedValue(undefined)
      mockPeerCrawlerTaskRepository.updateTaskStatus.mockResolvedValue({
        id: 'task-1',
        status: 'failed',
      })
      // Simulate failure in updating source status
      mockRadarSourceService.findById.mockRejectedValueOnce(new Error('DB error'))

      const result = await service.executeTask(mockJobData)

      expect(result.success).toBe(false)
      // Should not throw even if source status update fails
    })

    it('should handle AI analysis queue failure gracefully', async () => {
      const crawlResult = {
        title: 'Test Article',
        summary: 'Test summary',
        fullContent: '<article>Test content</article>',
        url: 'https://example.com',
        publishDate: new Date('2026-01-23'),
      }

      const rawContent: RawContent = {
        id: 'raw-1',
        source: 'peer-crawler',
        category: 'industry',
        title: 'Test Article',
        summary: 'Test summary',
        fullContent: '<article>Test content</article>',
        url: 'https://example.com',
        publishDate: new Date('2026-01-23'),
        author: null,
        contentHash: 'hash-123',
        status: 'pending',
        organizationId: null,
        contentType: 'article',
        peerName: '杭州银行',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockRadarSourceService.findById.mockResolvedValue(mockSource)
      mockCrawlerService.crawlWebsitePreview.mockResolvedValue(crawlResult)
      mockRawContentService.create.mockResolvedValue(rawContent)
      mockPeerCrawlerTaskRepository.updateTaskStatus.mockResolvedValue({
        id: 'task-1',
        status: 'completed',
      })
      mockRadarSourceService.updateCrawlStatus.mockResolvedValue(undefined)
      mockCrawlerLogService.logSuccess.mockResolvedValue(undefined)
      // Simulate AI queue failure
      mockAiAnalysisQueue.add.mockRejectedValue(new Error('Queue error'))

      const result = await service.executeTask(mockJobData)

      // Should still succeed even if AI analysis fails
      expect(result.success).toBe(true)
      expect(result.rawContentId).toBe('raw-1')
    })
  })

  describe('parseContent', () => {
    it('should parse content with custom selectors', () => {
      const html = `
        <html>
          <body>
            <h1 class="custom-title">Custom Title</h1>
            <div class="custom-content">Custom content here</div>
            <span class="custom-author">John Doe</span>
          </body>
        </html>
      `

      const result = service.parseContent(html, {
        titleSelector: '.custom-title',
        contentSelector: '.custom-content',
        authorSelector: '.custom-author',
      })

      expect(result.title).toBe('Custom Title')
      expect(result.content).toBe('Custom content here')
      expect(result.author).toBe('John Doe')
    })

    it('should fallback to default selectors when custom selectors not provided', () => {
      const html = `
        <html>
          <head><title>Page Title</title></head>
          <body>
            <h1>Article Title</h1>
            <article>Article content</article>
            <span class="author">Jane Smith</span>
          </body>
        </html>
      `

      const result = service.parseContent(html, {})

      expect(result.title).toBe('Article Title')
      expect(result.content).toBe('Article content')
      expect(result.author).toBe('Jane Smith')
    })

    it('should fallback to title tag when h1 not present', () => {
      const html = `
        <html>
          <head><title>Page Title</title></head>
          <body>
            <div class="content">Content here</div>
          </body>
        </html>
      `

      const result = service.parseContent(html, {})

      expect(result.title).toBe('Page Title')
    })

    it('should fallback to article-content class', () => {
      const html = `
        <html>
          <body>
            <h1>Title</h1>
            <div class="article-content">Article content here</div>
          </body>
        </html>
      `

      const result = service.parseContent(html, {})

      expect(result.content).toBe('Article content here')
    })

    it('should fallback to post-content class', () => {
      const html = `
        <html>
          <body>
            <h1>Title</h1>
            <div class="post-content">Post content here</div>
          </body>
        </html>
      `

      const result = service.parseContent(html, {})

      expect(result.content).toBe('Post content here')
    })

    it('should fallback to content class', () => {
      const html = `
        <html>
          <body>
            <h1>Title</h1>
            <div class="content">Generic content here</div>
          </body>
        </html>
      `

      const result = service.parseContent(html, {})

      expect(result.content).toBe('Generic content here')
    })

    it('should fallback to main element', () => {
      const html = `
        <html>
          <body>
            <h1>Title</h1>
            <main>Main content here</main>
          </body>
        </html>
      `

      const result = service.parseContent(html, {})

      expect(result.content).toBe('Main content here')
    })

    it('should fallback to full HTML when no content selectors match', () => {
      const html = `
        <html>
          <body>
            <h1>Title</h1>
            <div>No matching classes</div>
          </body>
        </html>
      `

      const result = service.parseContent(html, {})

      expect(result.title).toBe('Title')
      expect(result.content).toContain('No matching classes')
    })

    it('should fallback to meta author tag', () => {
      const html = `
        <html>
          <head>
            <meta name="author" content="Meta Author">
          </head>
          <body>
            <h1>Title</h1>
            <article>Content</article>
          </body>
        </html>
      `

      const result = service.parseContent(html, {})

      expect(result.author).toBe('Meta Author')
    })

    it('should return null author when no author found', () => {
      const html = `
        <html>
          <body>
            <h1>Title</h1>
            <article>Content</article>
          </body>
        </html>
      `

      const result = service.parseContent(html, {})

      expect(result.author).toBeNull()
    })

    it('should return Untitled when no title found', () => {
      const html = `
        <html>
          <body>
            <div>Content without title</div>
          </body>
        </html>
      `

      const result = service.parseContent(html, {})

      expect(result.title).toBe('Untitled')
    })

    it('should normalize whitespace in content', () => {
      const html = `
        <html>
          <body>
            <h1>Title</h1>
            <article>
              Content   with    multiple
              spaces and    newlines
            </article>
          </body>
        </html>
      `

      const result = service.parseContent(html, {})

      expect(result.content).toBe('Content with multiple spaces and newlines')
    })

    it('should handle empty HTML', () => {
      const result = service.parseContent('', {})

      expect(result.title).toBe('Untitled')
      expect(result.content).toBe('')
      expect(result.author).toBeNull()
    })

    it('should handle HTML with only whitespace', () => {
      const result = service.parseContent('   \n\t   ', {})

      expect(result.title).toBe('Untitled')
      expect(result.content).toBe('')
    })

    it('should parse date with custom selector', () => {
      const html = `
        <html>
          <body>
            <h1>Title</h1>
            <article>Content</article>
            <time class="publish-date">2026-01-23</time>
          </body>
        </html>
      `

      const result = service.parseContent(html, {
        dateSelector: '.publish-date',
      })

      // dateSelector is not used in the current implementation
      // but the method signature accepts it for future use
      expect(result.title).toBe('Title')
      expect(result.content).toBe('Content')
    })
  })

  describe('createTasksForSources', () => {
    it('should create tasks for multiple sources', async () => {
      const sources: RadarSource[] = [
        {
          id: 'source-1',
          source: '杭州银行',
          category: 'industry',
          url: 'https://example1.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 */4 * * *',
          lastCrawlStatus: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'source-2',
          source: '宁波银行',
          category: 'industry',
          url: 'https://example2.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 */4 * * *',
          lastCrawlStatus: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const tasks: PeerCrawlerTask[] = [
        {
          id: 'task-1',
          sourceId: 'source-1',
          peerName: '杭州银行',
          tenantId: 'tenant-1',
          sourceType: 'website',
          targetUrl: 'https://example1.com',
          status: 'pending',
          retryCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          crawlResult: null,
          rawContentId: null,
          errorMessage: null,
          startedAt: null,
          completedAt: null,
        },
        {
          id: 'task-2',
          sourceId: 'source-2',
          peerName: '宁波银行',
          tenantId: 'tenant-1',
          sourceType: 'website',
          targetUrl: 'https://example2.com',
          status: 'pending',
          retryCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          crawlResult: null,
          rawContentId: null,
          errorMessage: null,
          startedAt: null,
          completedAt: null,
        },
      ]

      mockPeerCrawlerTaskRepository.findTasksBySourceId.mockResolvedValue([])
      mockPeerCrawlerTaskRepository.create.mockResolvedValueOnce(tasks[0]).mockResolvedValueOnce(tasks[1])

      const result = await service.createTasksForSources(sources, 'tenant-1')

      expect(result).toHaveLength(2)
      expect(result[0].peerName).toBe('杭州银行')
      expect(result[1].peerName).toBe('宁波银行')
    })

    it('should skip sources with pending tasks', async () => {
      const sources: RadarSource[] = [
        {
          id: 'source-1',
          source: '杭州银行',
          category: 'industry',
          url: 'https://example1.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 */4 * * *',
          lastCrawlStatus: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'source-2',
          source: '宁波银行',
          category: 'industry',
          url: 'https://example2.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 */4 * * *',
          lastCrawlStatus: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const existingTask: PeerCrawlerTask = {
        id: 'existing-task',
        sourceId: 'source-1',
        peerName: '杭州银行',
        tenantId: 'tenant-1',
        sourceType: 'website',
        targetUrl: 'https://example1.com',
        status: 'pending',
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        crawlResult: null,
        rawContentId: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
      }

      mockPeerCrawlerTaskRepository.findTasksBySourceId.mockResolvedValueOnce([existingTask]).mockResolvedValueOnce([])

      const newTask: PeerCrawlerTask = {
        id: 'task-2',
        sourceId: 'source-2',
        peerName: '宁波银行',
        tenantId: 'tenant-1',
        sourceType: 'website',
        targetUrl: 'https://example2.com',
        status: 'pending',
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        crawlResult: null,
        rawContentId: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
      }

      mockPeerCrawlerTaskRepository.create.mockResolvedValueOnce(newTask)

      const result = await service.createTasksForSources(sources, 'tenant-1')

      expect(result).toHaveLength(1)
      expect(result[0].peerName).toBe('宁波银行')
    })

    it('should handle errors for individual sources', async () => {
      const sources: RadarSource[] = [
        {
          id: 'source-1',
          source: '杭州银行',
          category: 'industry',
          url: 'https://example1.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 */4 * * *',
          lastCrawlStatus: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'source-2',
          source: '宁波银行',
          category: 'industry',
          url: 'https://example2.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 */4 * * *',
          lastCrawlStatus: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      mockPeerCrawlerTaskRepository.findTasksBySourceId
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce([])

      const newTask: PeerCrawlerTask = {
        id: 'task-2',
        sourceId: 'source-2',
        peerName: '宁波银行',
        tenantId: 'tenant-1',
        sourceType: 'website',
        targetUrl: 'https://example2.com',
        status: 'pending',
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        crawlResult: null,
        rawContentId: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
      }

      mockPeerCrawlerTaskRepository.create.mockResolvedValueOnce(newTask)

      const result = await service.createTasksForSources(sources, 'tenant-1')

      // Should continue with second source even if first fails
      expect(result).toHaveLength(1)
      expect(result[0].peerName).toBe('宁波银行')
    })

    it('should handle empty sources array', async () => {
      const result = await service.createTasksForSources([])

      expect(result).toEqual([])
    })
  })

  describe('getTaskStats', () => {
    it('should return task statistics', async () => {
      mockPeerCrawlerTaskRepository.countTasks
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(10) // pending
        .mockResolvedValueOnce(5) // running
        .mockResolvedValueOnce(80) // completed
        .mockResolvedValueOnce(5) // failed

      const result = await service.getTaskStats('tenant-1')

      expect(result).toEqual({
        total: 100,
        pending: 10,
        running: 5,
        completed: 80,
        failed: 5,
      })

      expect(mockPeerCrawlerTaskRepository.countTasks).toHaveBeenCalledWith('tenant-1')
      expect(mockPeerCrawlerTaskRepository.countTasks).toHaveBeenCalledWith('tenant-1', { status: 'pending' })
      expect(mockPeerCrawlerTaskRepository.countTasks).toHaveBeenCalledWith('tenant-1', { status: 'running' })
      expect(mockPeerCrawlerTaskRepository.countTasks).toHaveBeenCalledWith('tenant-1', { status: 'completed' })
      expect(mockPeerCrawlerTaskRepository.countTasks).toHaveBeenCalledWith('tenant-1', { status: 'failed' })
    })

    it('should handle zero counts', async () => {
      mockPeerCrawlerTaskRepository.countTasks.mockResolvedValue(0)

      const result = await service.getTaskStats('tenant-1')

      expect(result).toEqual({
        total: 0,
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
      })
    })
  })
})
