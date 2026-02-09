import { Test, TestingModule } from '@nestjs/testing'
import { PeerCrawlerHealthController, CrawlerHealthDto, CrawlerStatsDto, PeerCrawlerTaskDto } from './peer-crawler-health.controller'
import { CrawlerHealthService } from '../services/crawler-health.service'
import { PeerCrawlerTaskRepository } from '../../../database/repositories/peer-crawler-task.repository'
import { PeerCrawlerTask } from '../../../database/entities/peer-crawler-task.entity'

describe('PeerCrawlerHealthController', () => {
  let controller: PeerCrawlerHealthController
  let crawlerHealthService: CrawlerHealthService
  let peerCrawlerTaskRepository: PeerCrawlerTaskRepository

  const mockCrawlerHealthService = {
    getHealthDetails: jest.fn(),
    getCrawlerStats: jest.fn(),
  }

  const mockRepository = {
    findAndCount: jest.fn(),
  }

  const mockPeerCrawlerTaskRepository = {
    repository: mockRepository,
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PeerCrawlerHealthController],
      providers: [
        {
          provide: CrawlerHealthService,
          useValue: mockCrawlerHealthService,
        },
        {
          provide: PeerCrawlerTaskRepository,
          useValue: mockPeerCrawlerTaskRepository,
        },
      ],
    }).compile()

    controller = module.get<PeerCrawlerHealthController>(PeerCrawlerHealthController)
    crawlerHealthService = module.get<CrawlerHealthService>(CrawlerHealthService)
    peerCrawlerTaskRepository = module.get<PeerCrawlerTaskRepository>(PeerCrawlerTaskRepository)

    jest.clearAllMocks()
  })

  describe('getHealth', () => {
    it('should return health details', async () => {
      // Arrange
      const mockHealth: CrawlerHealthDto = {
        overallStatus: 'healthy',
        sources: { total: 10, active: 8, inactive: 2 },
        recentTasks: { completed: 50, failed: 5, pending: 3 },
        last24h: { crawlCount: 20, successRate: 0.95, newContentCount: 18 },
      }
      mockCrawlerHealthService.getHealthDetails.mockResolvedValue(mockHealth)

      // Act
      const result = await controller.getHealth()

      // Assert
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockHealth)
      expect(mockCrawlerHealthService.getHealthDetails).toHaveBeenCalled()
    })
  })

  describe('getTasks', () => {
    it('should return tasks with default pagination', async () => {
      // Arrange
      const mockTasks = [
        {
          id: 'task-1',
          sourceId: 'source-1',
          peerName: 'Test Corp',
          tenantId: 'tenant-1',
          sourceType: 'website',
          targetUrl: 'https://example.com',
          status: 'completed',
          crawlResult: { title: 'Test' },
          rawContentId: 'raw-1',
          retryCount: 0,
          errorMessage: null,
          startedAt: new Date(),
          completedAt: new Date(),
          createdAt: new Date(),
        },
      ]
      mockRepository.findAndCount.mockResolvedValue([mockTasks, 1])

      // Act - pass explicit values since DefaultValuePipe doesn't work in unit tests
      const result = await controller.getTasks(undefined, undefined, undefined, undefined, 20, 0)

      // Assert
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          order: { createdAt: 'DESC' },
          take: 20,
          skip: 0,
        }),
      )
    })

    it('should filter by status', async () => {
      // Arrange
      mockRepository.findAndCount.mockResolvedValue([[], 0])

      // Act
      await controller.getTasks('failed')

      // Assert
      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'failed' },
        }),
      )
    })

    it('should filter by peerName', async () => {
      // Arrange
      mockRepository.findAndCount.mockResolvedValue([[], 0])

      // Act
      await controller.getTasks(undefined, 'Test Corp')

      // Assert
      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { peerName: 'Test Corp' },
        }),
      )
    })

    it('should filter by date range', async () => {
      // Arrange
      mockRepository.findAndCount.mockResolvedValue([[], 0])

      // Act
      await controller.getTasks(undefined, undefined, '2024-01-01', '2024-01-31')

      // Assert
      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.any(Object),
          }),
        }),
      )
    })
  })

  describe('getStats', () => {
    it('should return stats with default days', async () => {
      // Arrange
      const mockStats: CrawlerStatsDto = {
        successRateTrend: [{ date: '2024-01-01', rate: 95 }],
        sourceComparison: [{ peerName: 'Test Corp', success: 10, failed: 2 }],
        contentTypeDistribution: [{ type: '技术文章', count: 50 }],
      }
      mockCrawlerHealthService.getCrawlerStats.mockResolvedValue(mockStats)

      // Act - pass explicit value since DefaultValuePipe doesn't work in unit tests
      const result = await controller.getStats(30)

      // Assert
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockStats)
      expect(mockCrawlerHealthService.getCrawlerStats).toHaveBeenCalledWith(30)
    })

    it('should return stats with custom days', async () => {
      // Arrange
      const mockStats: CrawlerStatsDto = {
        successRateTrend: [],
        sourceComparison: [],
        contentTypeDistribution: [],
      }
      mockCrawlerHealthService.getCrawlerStats.mockResolvedValue(mockStats)

      // Act
      const result = await controller.getStats(7)

      // Assert
      expect(result.success).toBe(true)
      expect(mockCrawlerHealthService.getCrawlerStats).toHaveBeenCalledWith(7)
    })
  })
})
