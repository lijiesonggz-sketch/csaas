import { Test, TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { PeerCrawlerScheduler } from './peer-crawler-scheduler.service'
import { PeerCrawlerService } from './peer-crawler.service'
import { RadarSourceService } from './radar-source.service'
import { PeerCrawlerTaskRepository } from '../../../database/repositories/peer-crawler-task.repository'
import { RadarSource } from '../../../database/entities/radar-source.entity'

/**
 * PeerCrawlerScheduler Unit Tests
 *
 * Story 8.2: 同业采集任务调度与执行
 */
describe('PeerCrawlerScheduler', () => {
  let scheduler: PeerCrawlerScheduler
  let peerCrawlerService: PeerCrawlerService
  let radarSourceService: RadarSourceService
  let peerCrawlerTaskRepository: PeerCrawlerTaskRepository

  const mockPeerCrawlerService = {
    createTask: jest.fn(),
    createTasksForSources: jest.fn(),
  }

  const mockRadarSourceService = {
    getActiveSourcesByCategory: jest.fn(),
  }

  const mockPeerCrawlerTaskRepository = {
    findPendingTasks: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeerCrawlerScheduler,
        {
          provide: PeerCrawlerService,
          useValue: mockPeerCrawlerService,
        },
        {
          provide: RadarSourceService,
          useValue: mockRadarSourceService,
        },
        {
          provide: PeerCrawlerTaskRepository,
          useValue: mockPeerCrawlerTaskRepository,
        },
      ],
    }).compile()

    scheduler = module.get<PeerCrawlerScheduler>(PeerCrawlerScheduler)
    peerCrawlerService = module.get<PeerCrawlerService>(PeerCrawlerService)
    radarSourceService = module.get<RadarSourceService>(RadarSourceService)
    peerCrawlerTaskRepository = module.get<PeerCrawlerTaskRepository>(PeerCrawlerTaskRepository)

    // Suppress logger output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation()
    jest.spyOn(Logger.prototype, 'error').mockImplementation()
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()

    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(scheduler).toBeDefined()
  })

  describe('schedulePeerCrawling', () => {
    it('should schedule tasks for sources that need crawling', async () => {
      const sources: RadarSource[] = [
        {
          id: 'source-1',
          source: '杭州银行',
          category: 'industry',
          url: 'https://example1.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 */4 * * *',
          lastCrawledAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
          lastCrawlStatus: 'success',
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
          lastCrawledAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          lastCrawlStatus: 'success',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      mockRadarSourceService.getActiveSourcesByCategory.mockResolvedValue(sources)
      mockPeerCrawlerService.createTask.mockResolvedValue({ id: 'task-1' })

      await scheduler.schedulePeerCrawling()

      // Only source-1 should be scheduled (5 hours > 4 hours interval)
      expect(mockPeerCrawlerService.createTask).toHaveBeenCalledTimes(1)
      expect(mockPeerCrawlerService.createTask).toHaveBeenCalledWith(sources[0], 'default')
    })

    it('should schedule tasks for all sources when never crawled', async () => {
      const sources: RadarSource[] = [
        {
          id: 'source-1',
          source: '杭州银行',
          category: 'industry',
          url: 'https://example1.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 */4 * * *',
          lastCrawledAt: null,
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
          lastCrawledAt: null,
          lastCrawlStatus: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      mockRadarSourceService.getActiveSourcesByCategory.mockResolvedValue(sources)
      mockPeerCrawlerService.createTask.mockResolvedValue({ id: 'task-1' })

      await scheduler.schedulePeerCrawling()

      expect(mockPeerCrawlerService.createTask).toHaveBeenCalledTimes(2)
    })

    it('should handle empty sources list', async () => {
      mockRadarSourceService.getActiveSourcesByCategory.mockResolvedValue([])

      await scheduler.schedulePeerCrawling()

      expect(mockPeerCrawlerService.createTask).not.toHaveBeenCalled()
    })

    it('should handle errors when creating individual tasks', async () => {
      const sources: RadarSource[] = [
        {
          id: 'source-1',
          source: '杭州银行',
          category: 'industry',
          url: 'https://example1.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 */4 * * *',
          lastCrawledAt: null,
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
          lastCrawledAt: null,
          lastCrawlStatus: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      mockRadarSourceService.getActiveSourcesByCategory.mockResolvedValue(sources)
      mockPeerCrawlerService.createTask
        .mockRejectedValueOnce(new Error('Failed to create task'))
        .mockResolvedValueOnce({ id: 'task-2' })

      await scheduler.schedulePeerCrawling()

      // Should continue with second source even if first fails
      expect(mockPeerCrawlerService.createTask).toHaveBeenCalledTimes(2)
    })

    it('should handle general scheduling errors', async () => {
      mockRadarSourceService.getActiveSourcesByCategory.mockRejectedValue(
        new Error('Database error'),
      )

      await scheduler.schedulePeerCrawling()

      // Should not throw, just log error
      expect(mockPeerCrawlerService.createTask).not.toHaveBeenCalled()
    })

    it('should support different crawl schedules', async () => {
      const sources: RadarSource[] = [
        {
          id: 'source-1',
          source: 'Hourly Source',
          category: 'industry',
          url: 'https://example1.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 * * * *', // Every hour
          lastCrawledAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          lastCrawlStatus: 'success',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'source-2',
          source: 'Daily Source',
          category: 'industry',
          url: 'https://example2.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 3 * * *', // Daily at 3am
          lastCrawledAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          lastCrawlStatus: 'success',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      mockRadarSourceService.getActiveSourcesByCategory.mockResolvedValue(sources)
      mockPeerCrawlerService.createTask.mockResolvedValue({ id: 'task-1' })

      await scheduler.schedulePeerCrawling()

      // Both should be scheduled (hourly: 2 hours > 1 hour, daily: 25 hours > 24 hours)
      expect(mockPeerCrawlerService.createTask).toHaveBeenCalledTimes(2)
    })
  })

  describe('triggerManualCrawl', () => {
    it('should trigger manual crawl for all active sources', async () => {
      const sources: RadarSource[] = [
        {
          id: 'source-1',
          source: '杭州银行',
          category: 'industry',
          url: 'https://example1.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 */4 * * *',
          lastCrawledAt: new Date(),
          lastCrawlStatus: 'success',
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
          lastCrawledAt: new Date(),
          lastCrawlStatus: 'success',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const tasks = [
        { id: 'task-1', peerName: '杭州银行' },
        { id: 'task-2', peerName: '宁波银行' },
      ]

      mockRadarSourceService.getActiveSourcesByCategory.mockResolvedValue(sources)
      mockPeerCrawlerService.createTasksForSources.mockResolvedValue(tasks)

      const result = await scheduler.triggerManualCrawl('tenant-1')

      expect(result.scheduled).toBe(2)
      expect(result.sources).toEqual(['杭州银行', '宁波银行'])
      expect(mockPeerCrawlerService.createTasksForSources).toHaveBeenCalledWith(
        sources,
        'tenant-1',
      )
    })

    it('should handle manual crawl without tenantId', async () => {
      const sources: RadarSource[] = [
        {
          id: 'source-1',
          source: '杭州银行',
          category: 'industry',
          url: 'https://example1.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 */4 * * *',
          lastCrawledAt: new Date(),
          lastCrawlStatus: 'success',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      mockRadarSourceService.getActiveSourcesByCategory.mockResolvedValue(sources)
      mockPeerCrawlerService.createTasksForSources.mockResolvedValue([{ id: 'task-1', peerName: '杭州银行' }])

      const result = await scheduler.triggerManualCrawl()

      expect(result.scheduled).toBe(1)
      expect(mockPeerCrawlerService.createTasksForSources).toHaveBeenCalledWith(
        sources,
        undefined,
      )
    })

    it('should return empty result when no sources', async () => {
      mockRadarSourceService.getActiveSourcesByCategory.mockResolvedValue([])
      mockPeerCrawlerService.createTasksForSources.mockResolvedValue([])

      const result = await scheduler.triggerManualCrawl()

      expect(result.scheduled).toBe(0)
      expect(result.sources).toEqual([])
    })
  })

  describe('getSchedulerStatus', () => {
    it('should return scheduler status', async () => {
      const sources: RadarSource[] = [
        { id: 'source-1' } as RadarSource,
        { id: 'source-2' } as RadarSource,
      ]

      const pendingTasks = [
        { id: 'task-1' },
        { id: 'task-2' },
        { id: 'task-3' },
      ]

      mockRadarSourceService.getActiveSourcesByCategory.mockResolvedValue(sources)
      mockPeerCrawlerTaskRepository.findPendingTasks.mockResolvedValue(pendingTasks)

      const result = await scheduler.getSchedulerStatus()

      expect(result.activeSources).toBe(2)
      expect(result.pendingTasks).toBe(3)
      expect(result.lastCheck).toBeInstanceOf(Date)
    })

    it('should handle zero pending tasks', async () => {
      mockRadarSourceService.getActiveSourcesByCategory.mockResolvedValue([])
      mockPeerCrawlerTaskRepository.findPendingTasks.mockResolvedValue([])

      const result = await scheduler.getSchedulerStatus()

      expect(result.activeSources).toBe(0)
      expect(result.pendingTasks).toBe(0)
    })
  })

  describe('parseCronToMs', () => {
    it('should parse hourly cron expression', async () => {
      const sources: RadarSource[] = [
        {
          id: 'source-1',
          source: 'Test',
          category: 'industry',
          url: 'https://example.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 * * * *', // Every hour
          lastCrawledAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          lastCrawlStatus: 'success',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      mockRadarSourceService.getActiveSourcesByCategory.mockResolvedValue(sources)
      mockPeerCrawlerService.createTask.mockResolvedValue({ id: 'task-1' })

      await scheduler.schedulePeerCrawling()

      expect(mockPeerCrawlerService.createTask).toHaveBeenCalled()
    })

    it('should parse daily cron expression', async () => {
      const sources: RadarSource[] = [
        {
          id: 'source-1',
          source: 'Test',
          category: 'industry',
          url: 'https://example.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 3 * * *', // Daily at 3am
          lastCrawledAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          lastCrawlStatus: 'success',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      mockRadarSourceService.getActiveSourcesByCategory.mockResolvedValue(sources)
      mockPeerCrawlerService.createTask.mockResolvedValue({ id: 'task-1' })

      await scheduler.schedulePeerCrawling()

      expect(mockPeerCrawlerService.createTask).toHaveBeenCalled()
    })

    it('should parse weekly cron expression', async () => {
      const sources: RadarSource[] = [
        {
          id: 'source-1',
          source: 'Test',
          category: 'industry',
          url: 'https://example.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 3 * * 1', // Weekly on Monday
          lastCrawledAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
          lastCrawlStatus: 'success',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      mockRadarSourceService.getActiveSourcesByCategory.mockResolvedValue(sources)
      mockPeerCrawlerService.createTask.mockResolvedValue({ id: 'task-1' })

      await scheduler.schedulePeerCrawling()

      expect(mockPeerCrawlerService.createTask).toHaveBeenCalled()
    })

    it('should parse monthly cron expression', async () => {
      const sources: RadarSource[] = [
        {
          id: 'source-1',
          source: 'Test',
          category: 'industry',
          url: 'https://example.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 3 1 * *', // Monthly on 1st
          lastCrawledAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // 31 days ago
          lastCrawlStatus: 'success',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      mockRadarSourceService.getActiveSourcesByCategory.mockResolvedValue(sources)
      mockPeerCrawlerService.createTask.mockResolvedValue({ id: 'task-1' })

      await scheduler.schedulePeerCrawling()

      expect(mockPeerCrawlerService.createTask).toHaveBeenCalled()
    })

    it('should handle invalid cron expression with default', async () => {
      const sources: RadarSource[] = [
        {
          id: 'source-1',
          source: 'Test',
          category: 'industry',
          url: 'https://example.com',
          type: 'website',
          isActive: true,
          crawlSchedule: 'invalid-cron',
          lastCrawledAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          lastCrawlStatus: 'success',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      mockRadarSourceService.getActiveSourcesByCategory.mockResolvedValue(sources)
      mockPeerCrawlerService.createTask.mockResolvedValue({ id: 'task-1' })

      await scheduler.schedulePeerCrawling()

      // Should use default 24 hours, so 25 hours > 24 hours triggers crawl
      expect(mockPeerCrawlerService.createTask).toHaveBeenCalled()
    })

    it('should handle malformed cron expression parts', async () => {
      const sources: RadarSource[] = [
        {
          id: 'source-1',
          source: 'Test',
          category: 'industry',
          url: 'https://example.com',
          type: 'website',
          isActive: true,
          crawlSchedule: 'invalid', // Not enough parts
          lastCrawledAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
          lastCrawlStatus: 'success',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      mockRadarSourceService.getActiveSourcesByCategory.mockResolvedValue(sources)
      mockPeerCrawlerService.createTask.mockResolvedValue({ id: 'task-1' })

      await scheduler.schedulePeerCrawling()

      expect(mockPeerCrawlerService.createTask).toHaveBeenCalled()
    })

    it('should parse */4 hours expression', async () => {
      const sources: RadarSource[] = [
        {
          id: 'source-1',
          source: 'Test',
          category: 'industry',
          url: 'https://example.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 */4 * * *', // Every 4 hours
          lastCrawledAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
          lastCrawlStatus: 'success',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      mockRadarSourceService.getActiveSourcesByCategory.mockResolvedValue(sources)
      mockPeerCrawlerService.createTask.mockResolvedValue({ id: 'task-1' })

      await scheduler.schedulePeerCrawling()

      expect(mockPeerCrawlerService.createTask).toHaveBeenCalled()
    })

    it('should not schedule when interval has not passed', async () => {
      const sources: RadarSource[] = [
        {
          id: 'source-1',
          source: 'Test',
          category: 'industry',
          url: 'https://example.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 */4 * * *', // Every 4 hours
          lastCrawledAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago (not enough)
          lastCrawlStatus: 'success',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      mockRadarSourceService.getActiveSourcesByCategory.mockResolvedValue(sources)

      await scheduler.schedulePeerCrawling()

      expect(mockPeerCrawlerService.createTask).not.toHaveBeenCalled()
    })
  })
})
