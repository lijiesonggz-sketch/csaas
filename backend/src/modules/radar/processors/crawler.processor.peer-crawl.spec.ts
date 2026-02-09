import { Test, TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { CrawlerProcessor, RadarCrawlJobData } from './crawler.processor'
import { CrawlerService } from '../services/crawler.service'
import { CrawlerLogService } from '../services/crawler-log.service'
import { RadarSourceService } from '../services/radar-source.service'
import { PeerCrawlerService, PeerCrawlerJobData } from '../services/peer-crawler.service'

/**
 * CrawlerProcessor Peer-Crawl Extension Unit Tests
 *
 * Story 8.2: 同业采集任务调度与执行
 */
describe('CrawlerProcessor - PeerCrawl Extension', () => {
  let processor: CrawlerProcessor
  let crawlerService: CrawlerService
  let crawlerLogService: CrawlerLogService
  let radarSourceService: RadarSourceService
  let peerCrawlerService: PeerCrawlerService

  const mockCrawlerService = {
    crawlWebsite: jest.fn(),
  }

  const mockCrawlerLogService = {
    getConsecutiveFailures: jest.fn(),
  }

  const mockRadarSourceService = {
    updateCrawlStatus: jest.fn(),
    checkAndAutoDisable: jest.fn(),
  }

  const mockPeerCrawlerService = {
    executeTask: jest.fn(),
  }

  const mockAiAnalysisQueue = {
    add: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrawlerProcessor,
        {
          provide: CrawlerService,
          useValue: mockCrawlerService,
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
          provide: PeerCrawlerService,
          useValue: mockPeerCrawlerService,
        },
        {
          provide: 'BullQueue_radar-ai-analysis',
          useValue: mockAiAnalysisQueue,
        },
      ],
    }).compile()

    processor = module.get<CrawlerProcessor>(CrawlerProcessor)
    crawlerService = module.get<CrawlerService>(CrawlerService)
    crawlerLogService = module.get<CrawlerLogService>(CrawlerLogService)
    radarSourceService = module.get<RadarSourceService>(RadarSourceService)
    peerCrawlerService = module.get<PeerCrawlerService>(PeerCrawlerService)

    // Suppress logger output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation()
    jest.spyOn(Logger.prototype, 'error').mockImplementation()
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()

    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(processor).toBeDefined()
  })

  describe('process - peer-crawl job detection', () => {
    it('should detect and process peer-crawl job', async () => {
      const peerCrawlJobData: PeerCrawlerJobData = {
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

      const mockJob = {
        id: 'job-1',
        data: peerCrawlJobData,
        attemptsMade: 0,
      } as Job<PeerCrawlerJobData>

      mockPeerCrawlerService.executeTask.mockResolvedValue({
        success: true,
        rawContentId: 'raw-1',
      })

      const result = await processor.process(mockJob)

      expect(mockPeerCrawlerService.executeTask).toHaveBeenCalledWith({
        ...peerCrawlJobData,
        retryCount: 0,
      })
      expect(result).toEqual({
        success: true,
        rawContentId: 'raw-1',
      })
    })

    it('should process regular crawl job', async () => {
      const regularJobData = {
        source: 'GARTNER',
        category: 'tech' as const,
        url: 'https://gartner.com/article',
        sourceId: 'source-1',
      }

      const mockJob = {
        id: 'job-1',
        data: regularJobData,
        attemptsMade: 0,
      } as Job<typeof regularJobData>

      mockCrawlerService.crawlWebsite.mockResolvedValue({
        id: 'content-1',
        source: 'GARTNER',
        category: 'tech',
      })
      mockRadarSourceService.updateCrawlStatus.mockResolvedValue(undefined)

      const result = await processor.process(mockJob as Job<RadarCrawlJobData>)

      expect(mockCrawlerService.crawlWebsite).toHaveBeenCalledWith('GARTNER', 'tech', regularJobData.url, 0)
      expect(mockPeerCrawlerService.executeTask).not.toHaveBeenCalled()
      expect(result).toEqual({
        success: true,
        contentId: 'content-1',
      })
    })

    it('should handle peer-crawl job with all config options', async () => {
      const peerCrawlJobData: PeerCrawlerJobData = {
        type: 'peer-crawl',
        taskId: 'task-1',
        sourceId: 'source-1',
        peerName: '宁波银行',
        tenantId: 'tenant-1',
        targetUrl: 'https://example.com/articles',
        crawlConfig: {
          selector: '.article-list',
          listSelector: '.article-item',
          titleSelector: '.article-title',
          contentSelector: '.article-body',
          dateSelector: '.publish-date',
          authorSelector: '.author-name',
          paginationPattern: '?page={page}',
          maxPages: 5,
        },
        retryCount: 1,
      }

      const mockJob = {
        id: 'job-1',
        data: peerCrawlJobData,
        attemptsMade: 1,
      } as Job<PeerCrawlerJobData>

      mockPeerCrawlerService.executeTask.mockResolvedValue({
        success: true,
        rawContentId: 'raw-1',
      })

      await processor.process(mockJob)

      expect(mockPeerCrawlerService.executeTask).toHaveBeenCalledWith({
        ...peerCrawlJobData,
        retryCount: 1,
      })
    })
  })

  describe('processPeerCrawlJob', () => {
    it('should execute peer crawl job successfully', async () => {
      const peerCrawlJobData: PeerCrawlerJobData = {
        type: 'peer-crawl',
        taskId: 'task-1',
        sourceId: 'source-1',
        peerName: '杭州银行',
        tenantId: 'tenant-1',
        targetUrl: 'https://example.com',
        crawlConfig: {},
        retryCount: 0,
      }

      const mockJob = {
        id: 'job-1',
        data: peerCrawlJobData,
        attemptsMade: 0,
      } as Job<PeerCrawlerJobData>

      mockPeerCrawlerService.executeTask.mockResolvedValue({
        success: true,
        rawContentId: 'raw-1',
      })

      const result = await processor.process(mockJob)

      expect(result.success).toBe(true)
      expect(result.rawContentId).toBe('raw-1')
    })

    it('should throw error on failure when attemptsMade < 2', async () => {
      const peerCrawlJobData: PeerCrawlerJobData = {
        type: 'peer-crawl',
        taskId: 'task-1',
        sourceId: 'source-1',
        peerName: '杭州银行',
        tenantId: 'tenant-1',
        targetUrl: 'https://example.com',
        crawlConfig: {},
        retryCount: 0,
      }

      const mockJob = {
        id: 'job-1',
        data: peerCrawlJobData,
        attemptsMade: 0,
      } as Job<PeerCrawlerJobData>

      mockPeerCrawlerService.executeTask.mockResolvedValue({
        success: false,
        error: 'Network error',
      })

      await expect(processor.process(mockJob)).rejects.toThrow('Network error')
    })

    it('should not throw on final attempt failure', async () => {
      const peerCrawlJobData: PeerCrawlerJobData = {
        type: 'peer-crawl',
        taskId: 'task-1',
        sourceId: 'source-1',
        peerName: '杭州银行',
        tenantId: 'tenant-1',
        targetUrl: 'https://example.com',
        crawlConfig: {},
        retryCount: 0,
      }

      const mockJob = {
        id: 'job-1',
        data: peerCrawlJobData,
        attemptsMade: 2,
      } as Job<PeerCrawlerJobData>

      mockPeerCrawlerService.executeTask.mockResolvedValue({
        success: false,
        error: 'Persistent error',
      })

      const result = await processor.process(mockJob)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Persistent error')
    })

    it('should use BullMQ retry count', async () => {
      const peerCrawlJobData: PeerCrawlerJobData = {
        type: 'peer-crawl',
        taskId: 'task-1',
        sourceId: 'source-1',
        peerName: '杭州银行',
        tenantId: 'tenant-1',
        targetUrl: 'https://example.com',
        crawlConfig: {},
        retryCount: 0,
      }

      const mockJob = {
        id: 'job-1',
        data: peerCrawlJobData,
        attemptsMade: 1,
      } as Job<PeerCrawlerJobData>

      mockPeerCrawlerService.executeTask.mockResolvedValue({
        success: true,
        rawContentId: 'raw-1',
      })

      await processor.process(mockJob)

      expect(mockPeerCrawlerService.executeTask).toHaveBeenCalledWith(
        expect.objectContaining({
          retryCount: 1, // Should use attemptsMade from BullMQ
        }),
      )
    })
  })

  describe('isPeerCrawlJob type guard', () => {
    it('should correctly identify peer-crawl jobs', async () => {
      const peerCrawlJobData: PeerCrawlerJobData = {
        type: 'peer-crawl',
        taskId: 'task-1',
        sourceId: 'source-1',
        peerName: '杭州银行',
        tenantId: 'tenant-1',
        targetUrl: 'https://example.com',
        crawlConfig: {},
        retryCount: 0,
      }

      const mockJob = {
        id: 'job-1',
        data: peerCrawlJobData,
        attemptsMade: 0,
      } as Job<PeerCrawlerJobData>

      mockPeerCrawlerService.executeTask.mockResolvedValue({
        success: true,
        rawContentId: 'raw-1',
      })

      await processor.process(mockJob)

      expect(mockPeerCrawlerService.executeTask).toHaveBeenCalled()
      expect(mockCrawlerService.crawlWebsite).not.toHaveBeenCalled()
    })

    it('should not treat regular jobs as peer-crawl', async () => {
      const regularJobData = {
        source: 'GARTNER',
        category: 'tech' as const,
        url: 'https://gartner.com/article',
      }

      const mockJob = {
        id: 'job-1',
        data: regularJobData,
        attemptsMade: 0,
      } as Job<typeof regularJobData>

      mockCrawlerService.crawlWebsite.mockResolvedValue({
        id: 'content-1',
        source: 'GARTNER',
        category: 'tech',
      })

      await processor.process(mockJob as Job<RadarCrawlJobData>)

      expect(mockCrawlerService.crawlWebsite).toHaveBeenCalled()
      expect(mockPeerCrawlerService.executeTask).not.toHaveBeenCalled()
    })

    it('should handle job with undefined type field', async () => {
      const jobDataWithoutType = {
        source: 'GARTNER',
        category: 'tech' as const,
        url: 'https://gartner.com/article',
      }

      const mockJob = {
        id: 'job-1',
        data: jobDataWithoutType,
        attemptsMade: 0,
      } as Job<typeof jobDataWithoutType>

      mockCrawlerService.crawlWebsite.mockResolvedValue({
        id: 'content-1',
        source: 'GARTNER',
        category: 'tech',
      })

      await processor.process(mockJob as Job<RadarCrawlJobData>)

      expect(mockCrawlerService.crawlWebsite).toHaveBeenCalled()
      expect(mockPeerCrawlerService.executeTask).not.toHaveBeenCalled()
    })
  })

  describe('peer-crawl with different source types', () => {
    it('should handle website peer crawl', async () => {
      const peerCrawlJobData: PeerCrawlerJobData = {
        type: 'peer-crawl',
        taskId: 'task-1',
        sourceId: 'source-1',
        peerName: '杭州银行',
        tenantId: 'tenant-1',
        targetUrl: 'https://example.com',
        crawlConfig: {
          selector: '.news-list',
        },
        retryCount: 0,
      }

      const mockJob = {
        id: 'job-1',
        data: peerCrawlJobData,
        attemptsMade: 0,
      } as Job<PeerCrawlerJobData>

      mockPeerCrawlerService.executeTask.mockResolvedValue({
        success: true,
        rawContentId: 'raw-1',
      })

      await processor.process(mockJob)

      expect(mockPeerCrawlerService.executeTask).toHaveBeenCalledWith(
        expect.objectContaining({
          targetUrl: 'https://example.com',
          crawlConfig: { selector: '.news-list' },
        }),
      )
    })

    it('should handle wechat peer crawl', async () => {
      const peerCrawlJobData: PeerCrawlerJobData = {
        type: 'peer-crawl',
        taskId: 'task-2',
        sourceId: 'source-2',
        peerName: '宁波银行',
        tenantId: 'tenant-1',
        targetUrl: 'https://mp.weixin.qq.com/s/article',
        crawlConfig: {
          contentSelector: '#js_content',
        },
        retryCount: 0,
      }

      const mockJob = {
        id: 'job-2',
        data: peerCrawlJobData,
        attemptsMade: 0,
      } as Job<PeerCrawlerJobData>

      mockPeerCrawlerService.executeTask.mockResolvedValue({
        success: true,
        rawContentId: 'raw-2',
      })

      await processor.process(mockJob)

      expect(mockPeerCrawlerService.executeTask).toHaveBeenCalledWith(
        expect.objectContaining({
          targetUrl: 'https://mp.weixin.qq.com/s/article',
          crawlConfig: { contentSelector: '#js_content' },
        }),
      )
    })

    it('should handle recruitment peer crawl', async () => {
      const peerCrawlJobData: PeerCrawlerJobData = {
        type: 'peer-crawl',
        taskId: 'task-3',
        sourceId: 'source-3',
        peerName: '招商银行',
        tenantId: 'tenant-1',
        targetUrl: 'https://careers.cmbchina.com',
        crawlConfig: {
          listSelector: '.job-listing',
        },
        retryCount: 0,
      }

      const mockJob = {
        id: 'job-3',
        data: peerCrawlJobData,
        attemptsMade: 0,
      } as Job<PeerCrawlerJobData>

      mockPeerCrawlerService.executeTask.mockResolvedValue({
        success: true,
        rawContentId: 'raw-3',
      })

      await processor.process(mockJob)

      expect(mockPeerCrawlerService.executeTask).toHaveBeenCalled()
    })

    it('should handle conference peer crawl', async () => {
      const peerCrawlJobData: PeerCrawlerJobData = {
        type: 'peer-crawl',
        taskId: 'task-4',
        sourceId: 'source-4',
        peerName: '工商银行',
        tenantId: 'tenant-1',
        targetUrl: 'https://events.icbc.com.cn',
        crawlConfig: {
          dateSelector: '.event-date',
        },
        retryCount: 0,
      }

      const mockJob = {
        id: 'job-4',
        data: peerCrawlJobData,
        attemptsMade: 0,
      } as Job<PeerCrawlerJobData>

      mockPeerCrawlerService.executeTask.mockResolvedValue({
        success: true,
        rawContentId: 'raw-4',
      })

      await processor.process(mockJob)

      expect(mockPeerCrawlerService.executeTask).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle peer crawler service errors', async () => {
      const peerCrawlJobData: PeerCrawlerJobData = {
        type: 'peer-crawl',
        taskId: 'task-1',
        sourceId: 'source-1',
        peerName: '杭州银行',
        tenantId: 'tenant-1',
        targetUrl: 'https://example.com',
        crawlConfig: {},
        retryCount: 0,
      }

      const mockJob = {
        id: 'job-1',
        data: peerCrawlJobData,
        attemptsMade: 0,
      } as Job<PeerCrawlerJobData>

      mockPeerCrawlerService.executeTask.mockRejectedValue(new Error('Service error'))

      await expect(processor.process(mockJob)).rejects.toThrow('Service error')
    })

    it('should handle missing job data gracefully', async () => {
      const mockJob = {
        id: 'job-1',
        data: null,
        attemptsMade: 0,
      } as unknown as Job<RadarCrawlJobData>

      // Should return error result instead of throwing
      const result = await processor.process(mockJob)
      expect(result).toEqual({
        success: false,
        error: 'Invalid job data',
      })
    })
  })

  describe('logging', () => {
    it('should log peer crawl job processing', async () => {
      const peerCrawlJobData: PeerCrawlerJobData = {
        type: 'peer-crawl',
        taskId: 'task-1',
        sourceId: 'source-1',
        peerName: '杭州银行',
        tenantId: 'tenant-1',
        targetUrl: 'https://example.com',
        crawlConfig: {},
        retryCount: 0,
      }

      const mockJob = {
        id: 'job-1',
        data: peerCrawlJobData,
        attemptsMade: 0,
      } as Job<PeerCrawlerJobData>

      mockPeerCrawlerService.executeTask.mockResolvedValue({
        success: true,
        rawContentId: 'raw-1',
      })

      const logSpy = jest.spyOn(Logger.prototype, 'log')

      await processor.process(mockJob)

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Processing peer crawl job'),
      )
    })

    it('should log with attempt number', async () => {
      const peerCrawlJobData: PeerCrawlerJobData = {
        type: 'peer-crawl',
        taskId: 'task-1',
        sourceId: 'source-1',
        peerName: '杭州银行',
        tenantId: 'tenant-1',
        targetUrl: 'https://example.com',
        crawlConfig: {},
        retryCount: 0,
      }

      const mockJob = {
        id: 'job-1',
        data: peerCrawlJobData,
        attemptsMade: 2,
      } as Job<PeerCrawlerJobData>

      mockPeerCrawlerService.executeTask.mockResolvedValue({
        success: true,
        rawContentId: 'raw-1',
      })

      const logSpy = jest.spyOn(Logger.prototype, 'log')

      await processor.process(mockJob)

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attempt 3'),
      )
    })
  })
})
