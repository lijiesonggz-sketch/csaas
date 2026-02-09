import { Test, TestingModule } from '@nestjs/testing'
import { CrawlerService } from './crawler.service'
import { RawContentService } from './raw-content.service'
import { CrawlerLogService } from './crawler-log.service'
import { Logger } from '@nestjs/common'

// Mock Crawlee
const mockCrawlerRun = jest.fn()
jest.mock('crawlee', () => ({
  CheerioCrawler: jest.fn().mockImplementation((options) => ({
    run: mockCrawlerRun.mockImplementation(async (urls) => {
      // Simulate crawler execution
      if (options.requestHandler) {
        const cheerio = require('cheerio')
        const mockHtml = `
          <html>
            <head>
              <meta name="description" content="Test summary">
              <meta property="og:title" content="OG Title">
            </head>
            <body>
              <h1>Test Article</h1>
              <article class="content">Test article content with custom selector</article>
              <time datetime="2026-01-23">2026-01-23</time>
              <span class="author">Test Author</span>
              <span class="custom-title">Custom Title</span>
              <div class="custom-content">Custom content text</div>
              <span class="custom-date">2026-02-15</span>
              <span class="custom-author">Custom Author</span>
            </body>
          </html>
        `
        const $ = cheerio.load(mockHtml)
        await options.requestHandler({
          $,
          request: { url: urls[0] || 'https://example.com/article' },
        })
      }
    }),
  })),
}))

/**
 * CrawlerService Story 8.1 Tests
 *
 * Story 8.1: 同业采集源管理
 * - crawlWebsitePreview (预览模式，不保存)
 * - parseArticleWithCustomSelectors (自定义选择器)
 */
describe('CrawlerService - Story 8.1', () => {
  let service: CrawlerService

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

    // Suppress logger output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation()
    jest.spyOn(Logger.prototype, 'error').mockImplementation()

    jest.clearAllMocks()
  })

  describe('crawlWebsitePreview', () => {
    it('should crawl website in preview mode without saving', async () => {
      const crawlData = {
        source: 'Test Source',
        category: 'industry' as const,
        url: 'https://example.com/article',
      }

      const result = await service.crawlWebsitePreview(
        crawlData.source,
        crawlData.category,
        crawlData.url,
      )

      expect(result).toBeDefined()
      expect(result.title).toBe('Test Article')
      expect(result.fullContent).toContain('Test article content')
      expect(result.url).toBe('https://example.com/article')

      // Verify no data is saved to database
      expect(mockRawContentService.create).not.toHaveBeenCalled()
      expect(mockCrawlerLogService.logSuccess).not.toHaveBeenCalled()
    })

    it('should use custom selectors when crawlConfig provided', async () => {
      const crawlData = {
        source: 'Test Source',
        category: 'industry' as const,
        url: 'https://example.com/article',
        options: {
          contentType: 'website',
          peerName: 'Test Peer',
          crawlConfig: {
            titleSelector: '.custom-title',
            contentSelector: '.custom-content',
            dateSelector: '.custom-date',
            authorSelector: '.custom-author',
          },
        },
      }

      const result = await service.crawlWebsitePreview(
        crawlData.source,
        crawlData.category,
        crawlData.url,
        crawlData.options,
      )

      expect(result.title).toBe('Custom Title')
      expect(result.fullContent).toBe('Custom content text')
      expect(result.author).toBe('Custom Author')
      expect(result.publishDate).toEqual(new Date('2026-02-15'))
    })

    it('should handle missing custom selectors gracefully', async () => {
      const crawlData = {
        source: 'Test Source',
        category: 'industry' as const,
        url: 'https://example.com/article',
        options: {
          crawlConfig: {
            // Empty config - should fall back to defaults
          },
        },
      }

      const result = await service.crawlWebsitePreview(
        crawlData.source,
        crawlData.category,
        crawlData.url,
        crawlData.options,
      )

      // Should fall back to default selectors
      expect(result.title).toBe('Test Article')
      expect(result.fullContent).toBeTruthy()
    })

    it('should throw error when crawler fails', async () => {
      mockCrawlerRun.mockRejectedValueOnce(new Error('Network timeout'))

      await expect(
        service.crawlWebsitePreview('Test Source', 'industry', 'https://example.com'),
      ).rejects.toThrow('Network timeout')
    })

    it('should throw error when no content extracted', async () => {
      mockCrawlerRun.mockImplementationOnce(async () => {
        // Simulate crawler completing without extracting data
      })

      await expect(
        service.crawlWebsitePreview('Test Source', 'industry', 'https://example.com'),
      ).rejects.toThrow('Failed to extract content from page')
    })

    it('should pass correct headers with User-Agent rotation', async () => {
      const cheerioMock = jest.requireMock('crawlee')

      await service.crawlWebsitePreview('Test Source', 'industry', 'https://example.com')

      const crawlerConstructor = cheerioMock.CheerioCrawler
      expect(crawlerConstructor).toHaveBeenCalled()

      const callArgs = crawlerConstructor.mock.calls[0][0]
      expect(callArgs.preNavigationHooks).toBeDefined()
      expect(callArgs.preNavigationHooks.length).toBeGreaterThan(0)
    })

    it('should handle different content types', async () => {
      const result = await service.crawlWebsitePreview(
        'Test Source',
        'industry',
        'https://example.com',
        { contentType: 'recruitment' },
      )

      expect(result).toBeDefined()
      expect(result.title).toBe('Test Article')
    })

    it('should handle peerName in options', async () => {
      const result = await service.crawlWebsitePreview(
        'Test Source',
        'industry',
        'https://example.com',
        { peerName: '招商银行' },
      )

      expect(result).toBeDefined()
    })
  })

  describe('parseArticleWithCustomSelectors (via crawlWebsitePreview)', () => {
    it('should extract title using custom titleSelector', async () => {
      const result = await service.crawlWebsitePreview(
        'Test Source',
        'industry',
        'https://example.com',
        {
          crawlConfig: {
            titleSelector: '.custom-title',
          },
        },
      )

      expect(result.title).toBe('Custom Title')
    })

    it('should extract content using custom contentSelector', async () => {
      const result = await service.crawlWebsitePreview(
        'Test Source',
        'industry',
        'https://example.com',
        {
          crawlConfig: {
            contentSelector: '.custom-content',
          },
        },
      )

      expect(result.fullContent).toBe('Custom content text')
    })

    it('should extract date using custom dateSelector', async () => {
      const result = await service.crawlWebsitePreview(
        'Test Source',
        'industry',
        'https://example.com',
        {
          crawlConfig: {
            dateSelector: '.custom-date',
          },
        },
      )

      expect(result.publishDate).toEqual(new Date('2026-02-15'))
    })

    it('should extract author using custom authorSelector', async () => {
      const result = await service.crawlWebsitePreview(
        'Test Source',
        'industry',
        'https://example.com',
        {
          crawlConfig: {
            authorSelector: '.custom-author',
          },
        },
      )

      expect(result.author).toBe('Custom Author')
    })

    it('should return empty when custom selector not found', async () => {
      const result = await service.crawlWebsitePreview(
        'Test Source',
        'industry',
        'https://example.com',
        {
          crawlConfig: {
            titleSelector: '.non-existent-selector',
            contentSelector: '.non-existent-content',
          },
        },
      )

      // When custom selector is provided but not found, returns empty string
      expect(result.title).toBe('')
      expect(result.fullContent).toBe('')
    })

    it('should handle all custom selectors together', async () => {
      const result = await service.crawlWebsitePreview(
        'Test Source',
        'industry',
        'https://example.com',
        {
          crawlConfig: {
            titleSelector: '.custom-title',
            contentSelector: '.custom-content',
            dateSelector: '.custom-date',
            authorSelector: '.custom-author',
          },
        },
      )

      expect(result.title).toBe('Custom Title')
      expect(result.fullContent).toBe('Custom content text')
      expect(result.publishDate).toEqual(new Date('2026-02-15'))
      expect(result.author).toBe('Custom Author')
    })

    it('should clean up whitespace in content', async () => {
      const result = await service.crawlWebsitePreview(
        'Test Source',
        'industry',
        'https://example.com',
        {
          crawlConfig: {
            contentSelector: '.custom-content',
          },
        },
      )

      // Content should be trimmed and whitespace normalized
      expect(result.fullContent).toBe('Custom content text')
      // Verify no excessive whitespace (implementation uses replace(/\s+/g, ' '))
      expect(result.fullContent.trim()).toBe(result.fullContent)
    })

    it('should handle invalid date gracefully', async () => {
      // When date selector returns invalid date, publishDate should be null
      const result = await service.crawlWebsitePreview(
        'Test Source',
        'industry',
        'https://example.com',
        {
          crawlConfig: {
            dateSelector: '.custom-title', // This contains "Custom Title" which is not a valid date
          },
        },
      )

      // When date is invalid, publishDate should be null
      expect(result.publishDate).toBeNull()
    })
  })

  describe('Error Handling', () => {
    it('should handle crawler initialization errors', async () => {
      const cheerioMock = jest.requireMock('crawlee')
      cheerioMock.CheerioCrawler.mockImplementationOnce(() => {
        throw new Error('Failed to initialize crawler')
      })

      await expect(
        service.crawlWebsitePreview('Test Source', 'industry', 'https://example.com'),
      ).rejects.toThrow('Failed to initialize crawler')
    })

    it('should handle malformed URLs gracefully', async () => {
      mockCrawlerRun.mockRejectedValueOnce(new Error('Invalid URL'))

      await expect(
        service.crawlWebsitePreview('Test Source', 'industry', 'not-a-valid-url'),
      ).rejects.toThrow('Invalid URL')
    })

    it('should handle timeout errors', async () => {
      mockCrawlerRun.mockRejectedValueOnce(new Error('Request timeout'))

      await expect(
        service.crawlWebsitePreview('Test Source', 'industry', 'https://example.com'),
      ).rejects.toThrow('Request timeout')
    })
  })
})
