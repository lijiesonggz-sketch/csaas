import { Test, TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { getRepositoryToken } from '@nestjs/typeorm'
import { getQueueToken } from '@nestjs/bullmq'
import * as fs from 'fs/promises'
import * as path from 'path'
import { RawContent } from '../src/database/entities/raw-content.entity'
import { CrawlerLog } from '../src/database/entities/crawler-log.entity'
import { RawContentService } from '../src/modules/radar/services/raw-content.service'
import { CrawlerLogService } from '../src/modules/radar/services/crawler-log.service'
import { FileWatcherService } from '../src/modules/radar/services/file-watcher.service'

type UpdateResult = { affected: number }

class InMemoryRawContentRepository {
  private items: RawContent[] = []
  private sequence = 1

  create(data: Partial<RawContent>): RawContent {
    const now = new Date()
    return {
      id: data.id ?? `raw-content-${this.sequence++}`,
      source: data.source ?? 'unknown',
      category: (data.category ?? 'tech') as RawContent['category'],
      title: data.title ?? 'Untitled',
      summary: data.summary ?? null,
      fullContent: data.fullContent ?? '',
      url: data.url ?? null,
      publishDate: data.publishDate ?? null,
      author: data.author ?? null,
      contentHash: data.contentHash ?? '',
      status: (data.status ?? 'pending') as RawContent['status'],
      organizationId: data.organizationId ?? null,
      contentType: data.contentType,
      peerName: data.peerName,
      complianceData: data.complianceData,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
    }
  }

  async save(entity: RawContent): Promise<RawContent> {
    const existingIndex = this.items.findIndex((item) => item.id === entity.id)
    const nextEntity = {
      ...entity,
      updatedAt: new Date(),
    }

    if (existingIndex >= 0) {
      this.items[existingIndex] = nextEntity
    } else {
      this.items.push(nextEntity)
    }

    return nextEntity
  }

  async findOne(options: { where: Partial<RawContent> }): Promise<RawContent | null> {
    return (
      this.items.find((item) =>
        Object.entries(options.where).every(([key, value]) => item[key as keyof RawContent] === value),
      ) ?? null
    )
  }

  async find(options?: {
    where?: Partial<RawContent>
    order?: Record<string, 'ASC' | 'DESC'>
    take?: number
  }): Promise<RawContent[]> {
    let results = [...this.items]

    if (options?.where) {
      results = results.filter((item) =>
        Object.entries(options.where ?? {}).every(
          ([key, value]) => item[key as keyof RawContent] === value,
        ),
      )
    }

    if (options?.order?.createdAt) {
      const direction = options.order.createdAt
      results.sort((left, right) =>
        direction === 'ASC'
          ? left.createdAt.getTime() - right.createdAt.getTime()
          : right.createdAt.getTime() - left.createdAt.getTime(),
      )
    }

    if (typeof options?.take === 'number') {
      results = results.slice(0, options.take)
    }

    return results
  }

  async update(id: string, patch: Partial<RawContent>): Promise<UpdateResult> {
    const item = this.items.find((entry) => entry.id === id)
    if (!item) {
      return { affected: 0 }
    }

    Object.assign(item, patch, { updatedAt: new Date() })
    return { affected: 1 }
  }

  clear() {
    this.items = []
  }

  all(): RawContent[] {
    return [...this.items]
  }
}

class InMemoryCrawlerLogRepository {
  private items: CrawlerLog[] = []
  private sequence = 1

  create(data: Partial<CrawlerLog>): CrawlerLog {
    return {
      id: data.id ?? `crawler-log-${this.sequence++}`,
      contentId: data.contentId ?? null,
      source: data.source ?? 'unknown',
      category: (data.category ?? 'tech') as CrawlerLog['category'],
      url: data.url ?? '',
      status: (data.status ?? 'failed') as CrawlerLog['status'],
      itemsCollected: data.itemsCollected ?? 0,
      errorMessage: data.errorMessage ?? null,
      crawlDuration: data.crawlDuration ?? 0,
      retryCount: data.retryCount ?? 0,
      crawledAt: data.crawledAt ?? new Date(),
      createdAt: data.createdAt ?? new Date(),
    }
  }

  async save(entity: CrawlerLog): Promise<CrawlerLog> {
    this.items.push(entity)
    return entity
  }

  async find(options?: {
    where?: Partial<CrawlerLog>
    order?: Record<string, 'ASC' | 'DESC'>
    take?: number
  }): Promise<CrawlerLog[]> {
    let results = [...this.items]

    if (options?.where) {
      results = results.filter((item) =>
        Object.entries(options.where ?? {}).every(
          ([key, value]) => item[key as keyof CrawlerLog] === value,
        ),
      )
    }

    if (options?.order?.crawledAt) {
      const direction = options.order.crawledAt
      results.sort((left, right) =>
        direction === 'ASC'
          ? left.crawledAt.getTime() - right.crawledAt.getTime()
          : right.crawledAt.getTime() - left.crawledAt.getTime(),
      )
    }

    if (typeof options?.take === 'number') {
      results = results.slice(0, options.take)
    }

    return results
  }

  clear() {
    this.items = []
  }
}

describe('Radar Crawler and File Import (e2e-like)', () => {
  let moduleRef: TestingModule
  let rawContentService: RawContentService
  let crawlerLogService: CrawlerLogService
  let fileWatcherService: FileWatcherService
  let rawContentRepository: InMemoryRawContentRepository
  let crawlerLogRepository: InMemoryCrawlerLogRepository
  let aiAnalysisQueue: { add: jest.Mock }
  let tempRoot: string

  beforeEach(async () => {
    rawContentRepository = new InMemoryRawContentRepository()
    crawlerLogRepository = new InMemoryCrawlerLogRepository()
    aiAnalysisQueue = {
      add: jest.fn().mockResolvedValue({ id: 'queue-job-1' }),
    }

    moduleRef = await Test.createTestingModule({
      providers: [
        RawContentService,
        CrawlerLogService,
        FileWatcherService,
        {
          provide: getRepositoryToken(RawContent),
          useValue: rawContentRepository,
        },
        {
          provide: getRepositoryToken(CrawlerLog),
          useValue: crawlerLogRepository,
        },
        {
          provide: getQueueToken('radar-ai-analysis'),
          useValue: aiAnalysisQueue,
        },
      ],
    }).compile()

    rawContentService = moduleRef.get<RawContentService>(RawContentService)
    crawlerLogService = moduleRef.get<CrawlerLogService>(CrawlerLogService)
    fileWatcherService = moduleRef.get<FileWatcherService>(FileWatcherService)

    jest.spyOn(Logger.prototype, 'log').mockImplementation()
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()
    jest.spyOn(Logger.prototype, 'error').mockImplementation()

    tempRoot = path.join(
      process.cwd(),
      'test-results',
      `radar-crawler-e2e-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    )
    await fs.mkdir(tempRoot, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true })
    await moduleRef.close()
    rawContentRepository.clear()
    crawlerLogRepository.clear()
    jest.restoreAllMocks()
  })

  describe('RawContent CRUD', () => {
    it('should create raw content with hash', async () => {
      const contentData = {
        source: 'GARTNER',
        category: 'tech' as const,
        title: 'Test Article',
        summary: 'Test summary',
        fullContent: 'Test content',
        url: 'https://example.com/test',
        publishDate: new Date('2026-01-23'),
        author: 'Test Author',
        organizationId: null,
      }

      const result = await rawContentService.create(contentData)

      expect(result.id).toBeDefined()
      expect(result.contentHash).toBeDefined()
      expect(result.status).toBe('pending')
      expect(result.source).toBe('GARTNER')
      expect(result.category).toBe('tech')
    })

    it('should find pending content in creation order', async () => {
      await rawContentService.create({
        source: 'GARTNER',
        category: 'tech',
        title: 'Test 1',
        summary: null,
        fullContent: 'Content 1',
        url: 'https://example.com/1',
        publishDate: null,
        author: null,
        organizationId: null,
      })

      await rawContentService.create({
        source: 'IDC',
        category: 'tech',
        title: 'Test 2',
        summary: null,
        fullContent: 'Content 2',
        url: 'https://example.com/2',
        publishDate: null,
        author: null,
        organizationId: null,
      })

      const pending = await rawContentService.findPending()

      expect(pending).toHaveLength(2)
      expect(pending[0].title).toBe('Test 1')
      expect(pending[1].title).toBe('Test 2')
    })

    it('should update content status', async () => {
      const content = await rawContentService.create({
        source: 'GARTNER',
        category: 'tech',
        title: 'Test',
        summary: null,
        fullContent: 'Content',
        url: 'https://example.com/test',
        publishDate: null,
        author: null,
        organizationId: null,
      })

      await rawContentService.updateStatus(content.id, 'analyzing')

      const updated = await rawContentService.findById(content.id)
      expect(updated?.status).toBe('analyzing')
    })
  })

  describe('CrawlerLog', () => {
    it('should log successful crawl', async () => {
      await crawlerLogService.logSuccess('GARTNER', 'tech', 'https://example.com', 5)

      const logs = await crawlerLogService.getRecentLogs('GARTNER', 10)

      expect(logs).toHaveLength(1)
      expect(logs[0].status).toBe('success')
      expect(logs[0].itemsCollected).toBe(5)
    })

    it('should log failed crawl', async () => {
      await crawlerLogService.logFailure(
        'GARTNER',
        'tech',
        'https://example.com',
        'Network error',
        2,
      )

      const logs = await crawlerLogService.getRecentLogs('GARTNER', 10)

      expect(logs).toHaveLength(1)
      expect(logs[0].status).toBe('failed')
      expect(logs[0].errorMessage).toBe('Network error')
      expect(logs[0].retryCount).toBe(2)
    })

    it('should calculate success rate', async () => {
      await crawlerLogService.logSuccess('GARTNER', 'tech', 'https://example.com/1', 1)
      await crawlerLogService.logSuccess('GARTNER', 'tech', 'https://example.com/2', 1)
      await crawlerLogService.logSuccess('GARTNER', 'tech', 'https://example.com/3', 1)
      await crawlerLogService.logFailure('GARTNER', 'tech', 'https://example.com/4', 'Error', 1)

      const successRate = await crawlerLogService.getSuccessRate('GARTNER')

      expect(successRate).toBe(75)
    })
  })

  describe('File Import', () => {
    it('should process a markdown file, persist RawContent, enqueue AI analysis, and move the file to processed', async () => {
      const filePath = path.join(tempRoot, 'article.md')
      await fs.writeFile(
        filePath,
        `---
source: "GARTNER"
category: "tech"
url: "https://example.com/article"
publishDate: "2026-01-29"
author: "Test Author"
---

# Test Article

${'This is a valid markdown article for Story 2.1 file import verification. '.repeat(4)}
`,
      )

      await fileWatcherService.processFile(filePath)

      const pending = await rawContentService.findPending()
      const processedPath = path.join(tempRoot, 'processed', 'article.md')

      expect(pending).toHaveLength(1)
      expect(pending[0]).toMatchObject({
        source: 'GARTNER',
        category: 'tech',
        title: 'Test Article',
        status: 'pending',
      })
      expect(aiAnalysisQueue.add).toHaveBeenCalledWith('analyze-content', {
        contentId: pending[0].id,
      })
      await expect(fs.access(processedPath)).resolves.toBeUndefined()
    })

    it('should move invalid markdown files to failed with an error log', async () => {
      const filePath = path.join(tempRoot, 'invalid.md')
      await fs.writeFile(
        filePath,
        `---
source: "GARTNER"
---

# Invalid Article

${'This file is intentionally invalid because it has no category in frontmatter. '.repeat(3)}
`,
      )

      await fileWatcherService.processFile(filePath)

      const failedPath = path.join(tempRoot, 'failed', 'invalid.md')
      const errorLogPath = path.join(tempRoot, 'failed', 'invalid.md.error.txt')

      expect(await rawContentService.findPending()).toHaveLength(0)
      expect(aiAnalysisQueue.add).not.toHaveBeenCalled()
      await expect(fs.access(failedPath)).resolves.toBeUndefined()
      await expect(fs.access(errorLogPath)).resolves.toBeUndefined()
    })

    it('should extract title from markdown', () => {
      const content = '# Test Title\n\nContent here'
      const title = fileWatcherService.extractTitle(content)

      expect(title).toBe('Test Title')
    })
  })
})
