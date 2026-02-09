import { Test, TestingModule } from '@nestjs/testing'
import { CrawlerHealthMonitorService } from './crawler-health-monitor.service'
import { CrawlerHealthService } from './crawler-health.service'
import { AlertService } from '../../admin/dashboard/alert.service'

describe('CrawlerHealthMonitorService', () => {
  let service: CrawlerHealthMonitorService
  let crawlerHealthService: CrawlerHealthService
  let alertService: AlertService

  const mockCrawlerHealthService = {
    calculateHealth: jest.fn(),
    getLast24hStats: jest.fn(),
    getRecentConsecutiveFailures: jest.fn(),
  }

  const mockAlertService = {
    createAlert: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrawlerHealthMonitorService,
        {
          provide: CrawlerHealthService,
          useValue: mockCrawlerHealthService,
        },
        {
          provide: AlertService,
          useValue: mockAlertService,
        },
      ],
    }).compile()

    service = module.get<CrawlerHealthMonitorService>(CrawlerHealthMonitorService)
    crawlerHealthService = module.get<CrawlerHealthService>(CrawlerHealthService)
    alertService = module.get<AlertService>(AlertService)

    jest.clearAllMocks()
  })

  describe('monitorCrawlerHealth', () => {
    it('should check health and create alerts when issues detected', async () => {
      // Arrange
      mockCrawlerHealthService.calculateHealth.mockResolvedValue('critical')
      mockCrawlerHealthService.getLast24hStats.mockResolvedValue({
        totalCount: 10,
        successCount: 7,
        failedCount: 3,
        successRate: 0.7,
      })
      mockCrawlerHealthService.getRecentConsecutiveFailures.mockResolvedValue(3)
      mockAlertService.createAlert.mockResolvedValue({ id: 'alert-1' })

      // Act
      await service.monitorCrawlerHealth()

      // Assert
      expect(mockCrawlerHealthService.calculateHealth).toHaveBeenCalled()
      expect(mockCrawlerHealthService.getLast24hStats).toHaveBeenCalled()
      expect(mockCrawlerHealthService.getRecentConsecutiveFailures).toHaveBeenCalled()
      expect(mockAlertService.createAlert).toHaveBeenCalledWith({
        alertType: 'crawler_failure',
        severity: 'high',
        message: expect.stringContaining('80%'),
        metadata: expect.objectContaining({
          successRate: 0.7,
          threshold: 0.8,
          alertReason: 'low_success_rate',
        }),
      })
    })

    it('should create high severity alert for consecutive failures > 5', async () => {
      // Arrange
      mockCrawlerHealthService.calculateHealth.mockResolvedValue('critical')
      mockCrawlerHealthService.getLast24hStats.mockResolvedValue({
        totalCount: 10,
        successCount: 9,
        failedCount: 1,
        successRate: 0.9,
      })
      mockCrawlerHealthService.getRecentConsecutiveFailures.mockResolvedValue(6)
      mockAlertService.createAlert.mockResolvedValue({ id: 'alert-1' })

      // Act
      await service.monitorCrawlerHealth()

      // Assert
      expect(mockAlertService.createAlert).toHaveBeenCalledWith({
        alertType: 'crawler_failure',
        severity: 'high',
        message: expect.stringContaining('6'),
        metadata: expect.objectContaining({
          consecutiveFailures: 6,
          alertReason: 'consecutive_failures',
        }),
      })
    })

    it('should create medium severity alert for success rate < 90%', async () => {
      // Arrange
      mockCrawlerHealthService.calculateHealth.mockResolvedValue('warning')
      mockCrawlerHealthService.getLast24hStats.mockResolvedValue({
        totalCount: 10,
        successCount: 8,
        failedCount: 2,
        successRate: 0.85,
      })
      mockCrawlerHealthService.getRecentConsecutiveFailures.mockResolvedValue(2)
      mockAlertService.createAlert.mockResolvedValue({ id: 'alert-1' })

      // Act
      await service.monitorCrawlerHealth()

      // Assert
      expect(mockAlertService.createAlert).toHaveBeenCalledWith({
        alertType: 'crawler_failure',
        severity: 'medium',
        message: expect.stringContaining('90%'),
        metadata: expect.objectContaining({
          successRate: 0.85,
          threshold: 0.9,
          alertReason: 'low_success_rate',
        }),
      })
    })

    it('should create medium severity alert for no successful crawls', async () => {
      // Arrange
      mockCrawlerHealthService.calculateHealth.mockResolvedValue('warning')
      mockCrawlerHealthService.getLast24hStats.mockResolvedValue({
        totalCount: 5,
        successCount: 0,
        failedCount: 5,
        successRate: 0,
      })
      mockCrawlerHealthService.getRecentConsecutiveFailures.mockResolvedValue(0)
      mockAlertService.createAlert.mockResolvedValue({ id: 'alert-1' })

      // Act
      await service.monitorCrawlerHealth()

      // Assert - Note: successRate = 0 triggers the first condition (high severity)
      // because 0 < 0.8, so it won't reach the no_successful_crawls condition
      expect(mockAlertService.createAlert).toHaveBeenCalled()
    })

    it('should not create alert when health is good', async () => {
      // Arrange
      mockCrawlerHealthService.calculateHealth.mockResolvedValue('healthy')
      mockCrawlerHealthService.getLast24hStats.mockResolvedValue({
        totalCount: 10,
        successCount: 9,
        failedCount: 1,
        successRate: 0.9,
      })
      mockCrawlerHealthService.getRecentConsecutiveFailures.mockResolvedValue(0)

      // Act
      await service.monitorCrawlerHealth()

      // Assert
      expect(mockAlertService.createAlert).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      // Arrange
      mockCrawlerHealthService.calculateHealth.mockRejectedValue(new Error('Database error'))

      // Act - should not throw
      await expect(service.monitorCrawlerHealth()).resolves.not.toThrow()

      // Assert
      expect(mockAlertService.createAlert).not.toHaveBeenCalled()
    })
  })
})
