import { Test, TestingModule } from '@nestjs/testing'
import { CrawlerService } from './crawler.service'
import { RawContentService } from './raw-content.service'
import { CrawlerLogService } from './crawler-log.service'
import { Logger } from '@nestjs/common'

// Mock Crawlee
const mockCrawlerRun = jest.fn()
jest.mock('crawlee', () => ({
  CheerioCrawler: jest.fn().mockImplementation((options) => ({
    run: mockCrawlerRun.mockImplementation(async () => {
      // Simulate crawler execution
      if (options.requestHandler) {
        const mockCheerio = {
          load: (html: string) => {
            const $ = require('cheerio').load(html)
            return $
          },
        }
        const mockHtml = `
          <html>
            <head><meta name="description" content="Test summary"></head>
            <body>
              <h1>Test Article</h1>
              <article>Test content</article>
              <time datetime="2026-01-23">2026-01-23</time>
              <span class="author">Test Author</span>
            </body>
          </html>
        `
        const $ = require('cheerio').load(mockHtml)
        await options.requestHandler({
          $,
          request: { url: 'https://example.com/article' },
        })
      }
    }),
  })),
}))

describe('CrawlerService', () => {
  let service: CrawlerService
  let rawContentService: RawContentService
  let crawlerLogService: CrawlerLogService

  const mockRawContentService = {
    create: jest.fn(),
  }

  const mockCrawlerLogService = {
    logSuccess: jest.fn(),
    logFailure: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrawlerService,
        {
          provide: RawContentService,
          useValue: mockRawContentService,
        },
        {
          provide: CrawlerLogService,
          useValue: mockCrawlerLogService,
        },
      ],
    }).compile()

    service = module.get<CrawlerService>(CrawlerService)
    rawContentService = module.get<RawContentService>(RawContentService)
    crawlerLogService = module.get<CrawlerLogService>(CrawlerLogService)

    // Suppress logger output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation()
    jest.spyOn(Logger.prototype, 'error').mockImplementation()

    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('crawlWebsite', () => {
    it('should crawl website and save content', async () => {
      const crawlData = {
        source: 'GARTNER',
        category: 'tech' as const,
        url: 'https://example.com/article',
      }

      const savedContent = {
        id: 'content-uuid',
        source: crawlData.source,
        category: crawlData.category,
        title: 'Test Article',
        summary: 'Test summary',
        fullContent: 'Test content',
        url: crawlData.url,
        publishDate: new Date(),
        author: 'Test Author',
        organizationId: null,
        status: 'pending' as const,
        contentHash: 'test-hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockRawContentService.create.mockResolvedValue(savedContent)

      const result = await service.crawlWebsite(
        crawlData.source,
        crawlData.category,
        crawlData.url,
      )

      expect(result).toEqual(savedContent)
      expect(mockRawContentService.create).toHaveBeenCalled()
      expect(mockCrawlerLogService.logSuccess).toHaveBeenCalledWith(
        crawlData.source,
        crawlData.category,
        crawlData.url,
        1,
      )
    })

    it('should log failure when crawl fails', async () => {
      const crawlData = {
        source: 'GARTNER',
        category: 'tech' as const,
        url: 'https://example.com/article',
      }

      const error = new Error('Network error')

      // Mock crawler to throw error
      mockCrawlerRun.mockRejectedValueOnce(error)

      await expect(
        service.crawlWebsite(crawlData.source, crawlData.category, crawlData.url),
      ).rejects.toThrow('Network error')

      expect(mockCrawlerLogService.logFailure).toHaveBeenCalledWith(
        crawlData.source,
        crawlData.category,
        crawlData.url,
        'Network error',
        0,
      )
    })
  })

  describe('parseArticle', () => {
    it('should parse article from HTML', () => {
      const html = `
        <html>
          <head>
            <meta name="description" content="Test summary">
          </head>
          <body>
            <h1>Test Article Title</h1>
            <article>
              <p>This is the article content.</p>
            </article>
            <time datetime="2026-01-23">January 23, 2026</time>
            <span class="author">John Doe</span>
          </body>
        </html>
      `

      const result = service.parseArticle(html)

      expect(result.title).toBe('Test Article Title')
      expect(result.summary).toBe('Test summary')
      expect(result.fullContent).toContain('This is the article content')
    })

    it('should handle missing elements gracefully', () => {
      const html = '<html><body><h1>Title Only</h1></body></html>'

      const result = service.parseArticle(html)

      expect(result.title).toBe('Title Only')
      expect(result.summary).toBeNull()
      expect(result.fullContent).toBeTruthy()
    })
  })
})
