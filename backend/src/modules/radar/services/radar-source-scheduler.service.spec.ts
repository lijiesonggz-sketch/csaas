import { Test, TestingModule } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { RadarSourceSchedulerService } from './radar-source-scheduler.service'
import { RadarSource } from '../../../database/entities/radar-source.entity'
import { Logger } from '@nestjs/common'

/**
 * RadarSourceSchedulerService Unit Tests
 *
 * Story 8.1: 同业采集源管理 - 定时任务调度
 */
describe('RadarSourceSchedulerService', () => {
  let service: RadarSourceSchedulerService
  let crawlerQueue: Queue

  const mockQueue = {
    add: jest.fn(),
    getRepeatableJobs: jest.fn(),
    removeRepeatableByKey: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RadarSourceSchedulerService,
        {
          provide: getQueueToken('radar-crawler'),
          useValue: mockQueue,
        },
      ],
    }).compile()

    service = module.get<RadarSourceSchedulerService>(RadarSourceSchedulerService)
    crawlerQueue = module.get<Queue>(getQueueToken('radar-crawler'))

    // Suppress logger output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation()
    jest.spyOn(Logger.prototype, 'error').mockImplementation()

    jest.clearAllMocks()
  })

  describe('scheduleCrawlerJob', () => {
    it('should schedule a crawler job for active source', async () => {
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

      mockQueue.getRepeatableJobs.mockResolvedValue([])
      mockQueue.add.mockResolvedValue({ id: 'job-id' })

      await service.scheduleCrawlerJob(source)

      expect(mockQueue.removeRepeatableByKey).not.toHaveBeenCalled()
      expect(mockQueue.add).toHaveBeenCalledWith(
        'crawl-industry',
        {
          source: source.source,
          category: source.category,
          url: source.url,
          type: source.type,
          peerName: source.peerName,
          crawlConfig: source.crawlConfig,
        },
        {
          repeat: {
            pattern: source.crawlSchedule,
          },
          jobId: 'crawler-test-id',
        },
      )
    })

    it('should not schedule job for inactive source', async () => {
      const source: RadarSource = {
        id: 'test-id',
        source: 'Test Source',
        category: 'industry',
        url: 'https://example.com',
        type: 'website',
        isActive: false,
        crawlSchedule: '0 3 * * *',
        lastCrawlStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await service.scheduleCrawlerJob(source)

      expect(mockQueue.add).not.toHaveBeenCalled()
    })

    it('should remove existing job before scheduling new one', async () => {
      const source: RadarSource = {
        id: 'test-id',
        source: 'Test Source',
        category: 'industry',
        url: 'https://example.com',
        type: 'website',
        isActive: true,
        crawlSchedule: '0 */6 * * *',
        lastCrawlStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockQueue.getRepeatableJobs.mockResolvedValue([
        { id: 'crawler-test-id', key: 'existing-key' },
      ])
      mockQueue.add.mockResolvedValue({ id: 'job-id' })

      await service.scheduleCrawlerJob(source)

      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith('existing-key')
      expect(mockQueue.add).toHaveBeenCalled()
    })

    it('should throw error when queue add fails', async () => {
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

      mockQueue.getRepeatableJobs.mockResolvedValue([])
      mockQueue.add.mockRejectedValue(new Error('Queue error'))

      await expect(service.scheduleCrawlerJob(source)).rejects.toThrow('Queue error')
    })
  })

  describe('removeCrawlerJob', () => {
    it('should remove existing crawler job', async () => {
      mockQueue.getRepeatableJobs.mockResolvedValue([
        { id: 'crawler-test-id', key: 'job-key-123' },
      ])

      await service.removeCrawlerJob('test-id')

      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith('job-key-123')
    })

    it('should not throw error when job does not exist', async () => {
      mockQueue.getRepeatableJobs.mockResolvedValue([
        { id: 'other-job', key: 'other-key' },
      ])

      await service.removeCrawlerJob('test-id')

      expect(mockQueue.removeRepeatableByKey).not.toHaveBeenCalled()
    })

    it('should handle empty repeatable jobs list', async () => {
      mockQueue.getRepeatableJobs.mockResolvedValue([])

      await service.removeCrawlerJob('test-id')

      expect(mockQueue.removeRepeatableByKey).not.toHaveBeenCalled()
    })

    it('should throw error when getRepeatableJobs fails', async () => {
      mockQueue.getRepeatableJobs.mockRejectedValue(new Error('Redis error'))

      await expect(service.removeCrawlerJob('test-id')).rejects.toThrow('Redis error')
    })
  })

  describe('rescheduleCrawlerJob', () => {
    it('should remove job when source becomes inactive', async () => {
      const source: RadarSource = {
        id: 'test-id',
        source: 'Test Source',
        category: 'industry',
        url: 'https://example.com',
        type: 'website',
        isActive: false,
        crawlSchedule: '0 3 * * *',
        lastCrawlStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockQueue.getRepeatableJobs.mockResolvedValue([
        { id: 'crawler-test-id', key: 'job-key' },
      ])

      await service.rescheduleCrawlerJob(source, '0 3 * * *', true)

      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith('job-key')
      expect(mockQueue.add).not.toHaveBeenCalled()
    })

    it('should schedule job when source becomes active', async () => {
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

      mockQueue.getRepeatableJobs.mockResolvedValue([])
      mockQueue.add.mockResolvedValue({ id: 'job-id' })

      await service.rescheduleCrawlerJob(source, '0 3 * * *', false)

      expect(mockQueue.add).toHaveBeenCalled()
    })

    it('should reschedule when crawlSchedule changes', async () => {
      const source: RadarSource = {
        id: 'test-id',
        source: 'Test Source',
        category: 'industry',
        url: 'https://example.com',
        type: 'website',
        isActive: true,
        crawlSchedule: '0 */6 * * *',
        lastCrawlStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockQueue.getRepeatableJobs.mockResolvedValue([
        { id: 'crawler-test-id', key: 'old-key' },
      ])
      mockQueue.add.mockResolvedValue({ id: 'job-id' })

      await service.rescheduleCrawlerJob(source, '0 3 * * *', true)

      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith('old-key')
      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          repeat: {
            pattern: '0 */6 * * *',
          },
        }),
      )
    })

    it('should do nothing when no changes detected', async () => {
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

      await service.rescheduleCrawlerJob(source, '0 3 * * *', true)

      expect(mockQueue.add).not.toHaveBeenCalled()
      expect(mockQueue.removeRepeatableByKey).not.toHaveBeenCalled()
    })
  })

  describe('triggerImmediateCrawl', () => {
    it('should add immediate job to queue', async () => {
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
          maxPages: 5,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockQueue.add.mockResolvedValue({ id: 'immediate-job-id' })

      await service.triggerImmediateCrawl(source)

      expect(mockQueue.add).toHaveBeenCalledWith(
        'crawl-industry-immediate',
        {
          source: source.source,
          category: source.category,
          url: source.url,
          type: source.type,
          peerName: source.peerName,
          crawlConfig: source.crawlConfig,
        },
        expect.objectContaining({
          jobId: expect.stringContaining('immediate-test-id-'),
        }),
      )
    })

    it('should throw error when queue add fails', async () => {
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

      mockQueue.add.mockRejectedValue(new Error('Queue full'))

      await expect(service.triggerImmediateCrawl(source)).rejects.toThrow('Queue full')
    })
  })

  describe('getScheduledJobs', () => {
    it('should return list of scheduled jobs', async () => {
      const now = Date.now()
      mockQueue.getRepeatableJobs.mockResolvedValue([
        {
          id: 'job-1',
          name: 'crawl-industry',
          pattern: '0 3 * * *',
          next: now + 3600000,
        },
        {
          id: 'job-2',
          name: 'crawl-tech',
          pattern: '0 */6 * * *',
          next: now + 7200000,
        },
      ])

      const result = await service.getScheduledJobs()

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: 'job-1',
        name: 'crawl-industry',
        pattern: '0 3 * * *',
        nextExecution: now + 3600000,
      })
    })

    it('should return empty array when no jobs scheduled', async () => {
      mockQueue.getRepeatableJobs.mockResolvedValue([])

      const result = await service.getScheduledJobs()

      expect(result).toEqual([])
    })

    it('should handle null job id', async () => {
      mockQueue.getRepeatableJobs.mockResolvedValue([
        {
          id: null,
          name: 'crawl-industry',
          pattern: '0 3 * * *',
          next: Date.now(),
        },
      ])

      const result = await service.getScheduledJobs()

      expect(result[0].id).toBe('')
    })

    it('should return empty array when getRepeatableJobs fails', async () => {
      mockQueue.getRepeatableJobs.mockRejectedValue(new Error('Redis connection error'))

      const result = await service.getScheduledJobs()

      expect(result).toEqual([])
    })
  })
})
