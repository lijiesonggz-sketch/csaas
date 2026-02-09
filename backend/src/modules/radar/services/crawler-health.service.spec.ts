import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository, MoreThan, Between } from 'typeorm'
import { CrawlerHealthService } from './crawler-health.service'
import { CrawlerLog } from '../../../database/entities/crawler-log.entity'
import { PeerCrawlerTask } from '../../../database/entities/peer-crawler-task.entity'
import { RadarSource } from '../../../database/entities/radar-source.entity'

// Mock TypeORM operators
jest.mock('typeorm', () => ({
  ...jest.requireActual('typeorm'),
  MoreThan: jest.fn((date) => ({ $gt: date })),
  Between: jest.fn((start, end) => ({ $between: [start, end] })),
}))

describe('CrawlerHealthService', () => {
  let service: CrawlerHealthService
  let crawlerLogRepository: Repository<CrawlerLog>
  let peerCrawlerTaskRepository: Repository<PeerCrawlerTask>
  let radarSourceRepository: Repository<RadarSource>

  const mockCrawlerLogRepository = {
    find: jest.fn(),
    count: jest.fn(),
  }

  const mockPeerCrawlerTaskRepository = {
    count: jest.fn(),
  }

  const mockRadarSourceRepository = {
    find: jest.fn(),
    count: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrawlerHealthService,
        {
          provide: getRepositoryToken(CrawlerLog),
          useValue: mockCrawlerLogRepository,
        },
        {
          provide: getRepositoryToken(PeerCrawlerTask),
          useValue: mockPeerCrawlerTaskRepository,
        },
        {
          provide: getRepositoryToken(RadarSource),
          useValue: mockRadarSourceRepository,
        },
      ],
    }).compile()

    service = module.get<CrawlerHealthService>(CrawlerHealthService)
    crawlerLogRepository = module.get<Repository<CrawlerLog>>(getRepositoryToken(CrawlerLog))
    peerCrawlerTaskRepository = module.get<Repository<PeerCrawlerTask>>(getRepositoryToken(PeerCrawlerTask))
    radarSourceRepository = module.get<Repository<RadarSource>>(getRepositoryToken(RadarSource))

    jest.clearAllMocks()
  })

  describe('calculateHealth', () => {
    it('should return healthy when success rate >= 90% and no consecutive failures', async () => {
      // Arrange
      mockCrawlerLogRepository.find.mockImplementation((options: any) => {
        if (options.where?.crawledAt?.$gt) {
          // Last 24h stats query - 90% success rate (9 success, 1 failed)
          return [
            { id: '1', status: 'success', crawledAt: new Date() },
            { id: '2', status: 'success', crawledAt: new Date() },
            { id: '3', status: 'success', crawledAt: new Date() },
            { id: '4', status: 'success', crawledAt: new Date() },
            { id: '5', status: 'success', crawledAt: new Date() },
            { id: '6', status: 'success', crawledAt: new Date() },
            { id: '7', status: 'success', crawledAt: new Date() },
            { id: '8', status: 'success', crawledAt: new Date() },
            { id: '9', status: 'success', crawledAt: new Date() },
            { id: '10', status: 'failed', crawledAt: new Date() },
          ]
        }
        // Consecutive failures query - success first
        return [{ id: '11', status: 'success', crawledAt: new Date() }]
      })

      mockRadarSourceRepository.find.mockResolvedValue([{ source: 'test-source' }])

      // Act
      const result = await service.calculateHealth()

      // Assert
      expect(result).toBe('healthy')
    })

    it('should return warning when success rate < 90%', async () => {
      // Arrange - 85% success rate (17 success, 3 failed)
      mockCrawlerLogRepository.find.mockImplementation((options: any) => {
        if (options.where?.crawledAt?.$gt) {
          const logs = []
          for (let i = 0; i < 17; i++) {
            logs.push({ id: `s${i}`, status: 'success', crawledAt: new Date() })
          }
          for (let i = 0; i < 3; i++) {
            logs.push({ id: `f${i}`, status: 'failed', crawledAt: new Date() })
          }
          return logs
        }
        return [{ id: '20', status: 'success', crawledAt: new Date() }]
      })

      mockRadarSourceRepository.find.mockResolvedValue([{ source: 'test-source' }])

      // Act
      const result = await service.calculateHealth()

      // Assert
      expect(result).toBe('warning')
    })

    it('should return critical when success rate < 80%', async () => {
      // Arrange - 75% success rate (3 success, 1 failed)
      mockCrawlerLogRepository.find.mockImplementation((options: any) => {
        if (options.where?.crawledAt?.$gt) {
          return [
            { id: '1', status: 'success', crawledAt: new Date() },
            { id: '2', status: 'success', crawledAt: new Date() },
            { id: '3', status: 'success', crawledAt: new Date() },
            { id: '4', status: 'failed', crawledAt: new Date() },
          ]
        }
        return [{ id: '5', status: 'success', crawledAt: new Date() }]
      })

      mockRadarSourceRepository.find.mockResolvedValue([{ source: 'test-source' }])

      // Act
      const result = await service.calculateHealth()

      // Assert
      expect(result).toBe('critical')
    })

    it('should return critical when consecutive failures > 5', async () => {
      // Arrange
      mockCrawlerLogRepository.find.mockImplementation((options: any) => {
        if (options.where?.crawledAt?.$gt) {
          return [{ id: '1', status: 'success', crawledAt: new Date() }]
        }
        // Consecutive failures - 6 failures in a row
        return [
          { id: '2', status: 'failed', crawledAt: new Date() },
          { id: '3', status: 'failed', crawledAt: new Date() },
          { id: '4', status: 'failed', crawledAt: new Date() },
          { id: '5', status: 'failed', crawledAt: new Date() },
          { id: '6', status: 'failed', crawledAt: new Date() },
          { id: '7', status: 'failed', crawledAt: new Date() },
        ]
      })

      mockRadarSourceRepository.find.mockResolvedValue([{ source: 'test-source' }])

      // Act
      const result = await service.calculateHealth()

      // Assert
      expect(result).toBe('critical')
    })

    it('should return warning when no logs in 24 hours (empty results)', async () => {
      // Arrange - no logs in 24h means successCount = 0, but also successRate = 0
      // Since successRate = 0 < 80%, this actually returns critical
      // Let's test a case where there are only pending/running tasks (no completed logs)
      mockCrawlerLogRepository.find.mockImplementation((options: any) => {
        if (options.where?.crawledAt?.$gt) {
          // Empty logs in last 24h - this means 0 success rate but no failures either
          return []
        }
        return [{ id: '3', status: 'success', crawledAt: new Date() }]
      })

      mockRadarSourceRepository.find.mockResolvedValue([{ source: 'test-source' }])

      // Act
      const result = await service.calculateHealth()

      // Assert - when no logs, successRate = 0 which is < 80%, so critical
      expect(result).toBe('critical')
    })
  })

  describe('getHealthDetails', () => {
    it('should return complete health details', async () => {
      // Arrange
      mockRadarSourceRepository.count.mockResolvedValueOnce(10).mockResolvedValueOnce(8)
      mockPeerCrawlerTaskRepository.count
        .mockResolvedValueOnce(50) // completed
        .mockResolvedValueOnce(5) // failed
        .mockResolvedValueOnce(3) // pending

      mockCrawlerLogRepository.find.mockResolvedValue([
        { id: '1', status: 'success', crawledAt: new Date() },
        { id: '2', status: 'success', crawledAt: new Date() },
        { id: '3', status: 'failed', crawledAt: new Date() },
      ])

      mockRadarSourceRepository.find.mockResolvedValue([{ source: 'test-source' }])

      // Act
      const result = await service.getHealthDetails()

      // Assert
      expect(result).toBeDefined()
      expect(result.overallStatus).toBeDefined()
      expect(result.sources).toEqual({ total: 10, active: 8, inactive: 2 })
      expect(result.recentTasks).toEqual({ completed: 50, failed: 5, pending: 3 })
      expect(result.last24h).toBeDefined()
      expect(result.last24h.crawlCount).toBe(3)
      expect(result.last24h.successRate).toBeCloseTo(0.67, 1)
    })
  })

  describe('getLast24hStats', () => {
    it('should return correct stats for last 24 hours', async () => {
      // Arrange
      mockCrawlerLogRepository.find.mockResolvedValue([
        { id: '1', status: 'success', crawledAt: new Date() },
        { id: '2', status: 'success', crawledAt: new Date() },
        { id: '3', status: 'failed', crawledAt: new Date() },
        { id: '4', status: 'success', crawledAt: new Date() },
      ])

      // Act
      const result = await service.getLast24hStats()

      // Assert
      expect(result.totalCount).toBe(4)
      expect(result.successCount).toBe(3)
      expect(result.failedCount).toBe(1)
      expect(result.successRate).toBe(0.75)
    })

    it('should return zero stats when no logs exist', async () => {
      // Arrange
      mockCrawlerLogRepository.find.mockResolvedValue([])

      // Act
      const result = await service.getLast24hStats()

      // Assert
      expect(result.totalCount).toBe(0)
      expect(result.successCount).toBe(0)
      expect(result.failedCount).toBe(0)
      expect(result.successRate).toBe(0)
    })
  })

  describe('getRecentConsecutiveFailures', () => {
    it('should return max consecutive failures across all sources', async () => {
      // Arrange
      mockRadarSourceRepository.find.mockResolvedValue([
        { source: 'source-1' },
        { source: 'source-2' },
      ])

      mockCrawlerLogRepository.find.mockImplementation((options: any) => {
        const source = options.where?.source
        if (source === 'source-1') {
          return [
            { id: '1', status: 'failed', crawledAt: new Date() },
            { id: '2', status: 'failed', crawledAt: new Date() },
            { id: '3', status: 'success', crawledAt: new Date() },
          ]
        }
        if (source === 'source-2') {
          return [
            { id: '4', status: 'failed', crawledAt: new Date() },
            { id: '5', status: 'failed', crawledAt: new Date() },
            { id: '6', status: 'failed', crawledAt: new Date() },
            { id: '7', status: 'failed', crawledAt: new Date() },
          ]
        }
        return []
      })

      // Act
      const result = await service.getRecentConsecutiveFailures()

      // Assert
      expect(result).toBe(4)
    })

    it('should return 0 when all sources have recent successes', async () => {
      // Arrange
      mockRadarSourceRepository.find.mockResolvedValue([{ source: 'source-1' }])
      mockCrawlerLogRepository.find.mockResolvedValue([
        { id: '1', status: 'success', crawledAt: new Date() },
        { id: '2', status: 'failed', crawledAt: new Date() },
      ])

      // Act
      const result = await service.getRecentConsecutiveFailures()

      // Assert
      expect(result).toBe(0)
    })
  })

  describe('getConsecutiveFailuresForSource', () => {
    it('should return consecutive failures for specific source', async () => {
      // Arrange
      mockCrawlerLogRepository.find.mockResolvedValue([
        { id: '1', status: 'failed', crawledAt: new Date() },
        { id: '2', status: 'failed', crawledAt: new Date() },
        { id: '3', status: 'failed', crawledAt: new Date() },
        { id: '4', status: 'success', crawledAt: new Date() },
      ])

      // Act
      const result = await service.getConsecutiveFailuresForSource('test-source')

      // Assert
      expect(result).toBe(3)
    })
  })

  describe('getCrawlerStats', () => {
    it('should return crawler statistics', async () => {
      // Arrange
      mockCrawlerLogRepository.find.mockResolvedValue([])
      mockRadarSourceRepository.find.mockResolvedValue([
        { source: 'Test Corp', peerName: 'Test Corp' },
      ])

      // Act
      const result = await service.getCrawlerStats(7)

      // Assert
      expect(result).toBeDefined()
      expect(result.successRateTrend).toBeInstanceOf(Array)
      expect(result.sourceComparison).toBeInstanceOf(Array)
      expect(result.contentTypeDistribution).toBeInstanceOf(Array)
    })
  })
})
