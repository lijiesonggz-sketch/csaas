import { Test, TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { getQueueToken } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { CrawlerProcessor } from './crawler.processor'
import { CrawlerService } from '../services/crawler.service'
import { CrawlerLogService } from '../services/crawler-log.service'
import { RadarSourceService } from '../services/radar-source.service'
import { PeerCrawlerService } from '../services/peer-crawler.service'

describe('CrawlerProcessor Story 2.1 Regular Crawl Coverage', () => {
  let processor: CrawlerProcessor

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
          provide: getQueueToken('radar-ai-analysis'),
          useValue: mockAiAnalysisQueue,
        },
      ],
    }).compile()

    processor = module.get<CrawlerProcessor>(CrawlerProcessor)

    jest.spyOn(Logger.prototype, 'log').mockImplementation()
    jest.spyOn(Logger.prototype, 'error').mockImplementation()
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()

    jest.clearAllMocks()
  })

  it('marks the source as successful when a regular crawl job completes', async () => {
    const mockJob = {
      id: 'job-1',
      data: {
        source: 'GARTNER',
        category: 'tech',
        url: 'https://example.com/article',
        sourceId: 'source-1',
      },
      attemptsMade: 0,
    } as Job<any>

    mockCrawlerService.crawlWebsite.mockResolvedValue({
      id: 'content-1',
      source: 'GARTNER',
      category: 'tech',
    })

    const result = await processor.process(mockJob)

    expect(mockCrawlerService.crawlWebsite).toHaveBeenCalledWith(
      'GARTNER',
      'tech',
      'https://example.com/article',
      0,
    )
    expect(mockRadarSourceService.updateCrawlStatus).toHaveBeenCalledWith('source-1', 'success')
    expect(mockCrawlerLogService.getConsecutiveFailures).not.toHaveBeenCalled()
    expect(result).toEqual({
      success: true,
      contentId: 'content-1',
    })
  })

  it('rethrows retryable failures so BullMQ can perform Story 2.1 backoff retries', async () => {
    const mockJob = {
      id: 'job-2',
      data: {
        source: 'IDC',
        category: 'tech',
        url: 'https://example.com/failure',
        sourceId: 'source-2',
      },
      attemptsMade: 1,
    } as Job<any>

    mockCrawlerService.crawlWebsite.mockRejectedValue(new Error('Network error'))

    await expect(processor.process(mockJob)).rejects.toThrow('Network error')

    expect(mockRadarSourceService.updateCrawlStatus).toHaveBeenCalledWith(
      'source-2',
      'failed',
      'Network error',
    )
    expect(mockCrawlerLogService.getConsecutiveFailures).not.toHaveBeenCalled()
    expect(mockRadarSourceService.checkAndAutoDisable).not.toHaveBeenCalled()
  })

  it('returns a failed result on the final attempt and evaluates auto-disable state', async () => {
    const mockJob = {
      id: 'job-3',
      data: {
        source: '信通院',
        category: 'tech',
        url: 'https://example.com/still-failing',
        sourceId: 'source-3',
      },
      attemptsMade: 2,
    } as Job<any>

    mockCrawlerService.crawlWebsite.mockRejectedValue(new Error('Still failing'))
    mockCrawlerLogService.getConsecutiveFailures.mockResolvedValue(2)
    mockRadarSourceService.checkAndAutoDisable.mockResolvedValue(true)

    const result = await processor.process(mockJob)

    expect(mockRadarSourceService.updateCrawlStatus).toHaveBeenCalledWith(
      'source-3',
      'failed',
      'Still failing',
    )
    expect(mockCrawlerLogService.getConsecutiveFailures).toHaveBeenCalledWith('信通院')
    expect(mockRadarSourceService.checkAndAutoDisable).toHaveBeenCalledWith('source-3', 3)
    expect(result).toEqual({
      success: false,
      error: 'Still failing',
    })
  })
})
