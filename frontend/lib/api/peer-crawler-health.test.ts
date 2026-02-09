/**
 * Peer Crawler Health API Tests
 *
 * Story 8.5: 爬虫健康度监控与告警
 */

import {
  getCrawlerHealth,
  getCrawlerTasks,
  getCrawlerStats,
} from './peer-crawler-health'

// Mock the apiFetch utility
jest.mock('../utils/api', () => ({
  apiFetch: jest.fn(),
}))

const mockApiFetch = jest.requireMock('../utils/api').apiFetch

describe('Peer Crawler Health API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getCrawlerHealth', () => {
    it('should fetch crawler health data', async () => {
      // Arrange
      const mockHealth = {
        success: true,
        data: {
          overallStatus: 'healthy' as const,
          sources: { total: 10, active: 8, inactive: 2 },
          recentTasks: { completed: 50, failed: 5, pending: 3 },
          last24h: { crawlCount: 20, successRate: 0.95, newContentCount: 18 },
        },
      }
      mockApiFetch.mockResolvedValue(mockHealth)

      // Act
      const result = await getCrawlerHealth()

      // Assert
      expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/peer-crawler/health')
      expect(result).toEqual(mockHealth)
    })
  })

  describe('getCrawlerTasks', () => {
    it('should fetch tasks without filters', async () => {
      // Arrange
      const mockTasks = {
        success: true,
        data: [],
        total: 0,
      }
      mockApiFetch.mockResolvedValue(mockTasks)

      // Act
      const result = await getCrawlerTasks()

      // Assert
      expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/peer-crawler/tasks?')
      expect(result).toEqual(mockTasks)
    })

    it('should fetch tasks with filters', async () => {
      // Arrange
      const mockTasks = {
        success: true,
        data: [{ id: '1', status: 'completed' }],
        total: 1,
      }
      mockApiFetch.mockResolvedValue(mockTasks)

      // Act
      const result = await getCrawlerTasks({
        status: 'failed',
        peerName: 'Test Corp',
        limit: 10,
        offset: 20,
      })

      // Assert
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/peer-crawler/tasks?')
      )
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=failed')
      )
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('peerName=Test+Corp')
      )
      expect(result).toEqual(mockTasks)
    })

    it('should fetch tasks with date range', async () => {
      // Arrange
      const mockTasks = {
        success: true,
        data: [],
        total: 0,
      }
      mockApiFetch.mockResolvedValue(mockTasks)

      // Act
      const result = await getCrawlerTasks({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      })

      // Assert
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('startDate=2024-01-01')
      )
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('endDate=2024-01-31')
      )
    })
  })

  describe('getCrawlerStats', () => {
    it('should fetch stats with default days', async () => {
      // Arrange
      const mockStats = {
        success: true,
        data: {
          successRateTrend: [],
          sourceComparison: [],
          contentTypeDistribution: [],
        },
      }
      mockApiFetch.mockResolvedValue(mockStats)

      // Act
      const result = await getCrawlerStats()

      // Assert
      expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/peer-crawler/stats?')
      expect(result).toEqual(mockStats)
    })

    it('should fetch stats with custom days', async () => {
      // Arrange
      const mockStats = {
        success: true,
        data: {
          successRateTrend: [{ date: '2024-01-01', rate: 95 }],
          sourceComparison: [{ peerName: 'Test', success: 10, failed: 2 }],
          contentTypeDistribution: [{ type: '技术文章', count: 50 }],
        },
      }
      mockApiFetch.mockResolvedValue(mockStats)

      // Act
      const result = await getCrawlerStats(7)

      // Assert
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/admin/peer-crawler/stats?days=7'
      )
      expect(result).toEqual(mockStats)
    })
  })
})
