import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BullModule } from '@nestjs/bullmq'
import { ConfigModule } from '@nestjs/config'
import * as fs from 'fs/promises'
import * as path from 'path'
import { RadarModule } from '../src/modules/radar/radar.module'
import { RawContent } from '../src/database/entities/raw-content.entity'
import { CrawlerLog } from '../src/database/entities/crawler-log.entity'
import { RawContentService } from '../src/modules/radar/services/raw-content.service'
import { CrawlerLogService } from '../src/modules/radar/services/crawler-log.service'
import { FileWatcherService } from '../src/modules/radar/services/file-watcher.service'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

describe('Radar Crawler and File Import (e2e)', () => {
  let app: INestApplication
  let rawContentService: RawContentService
  let crawlerLogService: CrawlerLogService
  let fileWatcherService: FileWatcherService
  let rawContentRepo: Repository<RawContent>
  let crawlerLogRepo: Repository<CrawlerLog>

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          username: process.env.DB_USERNAME || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_NAME || 'csaas_test',
          entities: [RawContent, CrawlerLog],
          synchronize: true,
        }),
        BullModule.forRoot({
          connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
          },
        }),
        RadarModule,
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    rawContentService = moduleFixture.get<RawContentService>(RawContentService)
    crawlerLogService =
      moduleFixture.get<CrawlerLogService>(CrawlerLogService)
    fileWatcherService =
      moduleFixture.get<FileWatcherService>(FileWatcherService)
    rawContentRepo = moduleFixture.get<Repository<RawContent>>(
      getRepositoryToken(RawContent),
    )
    crawlerLogRepo = moduleFixture.get<Repository<CrawlerLog>>(
      getRepositoryToken(CrawlerLog),
    )
  })

  afterAll(async () => {
    await app.close()
  })

  afterEach(async () => {
    // Clean up test data
    await rawContentRepo.delete({})
    await crawlerLogRepo.delete({})
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

    it('should find pending content', async () => {
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

      expect(pending.length).toBe(2)
      expect(pending[0].status).toBe('pending')
      expect(pending[1].status).toBe('pending')
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

      expect(logs.length).toBe(1)
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

      expect(logs.length).toBe(1)
      expect(logs[0].status).toBe('failed')
      expect(logs[0].errorMessage).toBe('Network error')
      expect(logs[0].retryCount).toBe(2)
    })

    it('should calculate success rate', async () => {
      await crawlerLogService.logSuccess('GARTNER', 'tech', 'https://example.com/1', 1)
      await crawlerLogService.logSuccess('GARTNER', 'tech', 'https://example.com/2', 1)
      await crawlerLogService.logSuccess('GARTNER', 'tech', 'https://example.com/3', 1)
      await crawlerLogService.logFailure(
        'GARTNER',
        'tech',
        'https://example.com/4',
        'Error',
        1,
      )

      const successRate = await crawlerLogService.getSuccessRate('GARTNER')

      expect(successRate).toBe(75) // 3/4 = 75%
    })
  })

  describe('File Import', () => {
    it('should extract title from markdown', () => {
      const content = '# Test Title\n\nContent here'
      const title = fileWatcherService.extractTitle(content)

      expect(title).toBe('Test Title')
    })

    it('should return default title if no heading', () => {
      const content = 'Content without heading'
      const title = fileWatcherService.extractTitle(content)

      expect(title).toBe('Untitled')
    })
  })
})
