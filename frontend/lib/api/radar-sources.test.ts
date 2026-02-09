/**
 * Radar Sources API Client Tests
 *
 * Story 8.1: 同业采集源管理
 */

import {
  getRadarSources,
  getRadarSource,
  createRadarSource,
  updateRadarSource,
  deleteRadarSource,
  toggleRadarSourceActive,
  testRadarSourceCrawl,
  getRadarSourceStats,
  RadarSource,
  CreateRadarSourceData,
  UpdateRadarSourceData,
} from './radar-sources'

// Mock the apiFetch utility
jest.mock('../utils/api', () => ({
  apiFetch: jest.fn(),
}))

const mockApiFetch = jest.requireMock('../utils/api').apiFetch

describe('Radar Sources API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getRadarSources', () => {
    it('should fetch all radar sources', async () => {
      const mockSources: RadarSource[] = [
        {
          id: 'source-1',
          source: '杭州银行金融科技',
          category: 'industry',
          url: 'https://tech.hzbank.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 */6 * * *',
          lastCrawlStatus: 'success',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-02-07T10:00:00Z',
        },
        {
          id: 'source-2',
          source: '宁波银行招聘',
          category: 'industry',
          url: 'https://recruit.nbcb.com',
          type: 'recruitment',
          isActive: false,
          crawlSchedule: '0 3 * * *',
          lastCrawlStatus: 'failed',
          createdAt: '2026-01-15T00:00:00Z',
          updatedAt: '2026-02-06T15:00:00Z',
        },
      ]

      mockApiFetch.mockResolvedValue(mockSources)

      const result = await getRadarSources()

      expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/radar-sources?')
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockSources)
      expect(result.total).toBe(2)
    })

    it('should fetch sources with category filter', async () => {
      const mockSources: RadarSource[] = [
        {
          id: 'source-1',
          source: '杭州银行金融科技',
          category: 'industry',
          url: 'https://tech.hzbank.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 */6 * * *',
          lastCrawlStatus: 'success',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-02-07T10:00:00Z',
        },
      ]

      mockApiFetch.mockResolvedValue(mockSources)

      const result = await getRadarSources({ category: 'industry' })

      expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/radar-sources?category=industry')
      expect(result.data).toEqual(mockSources)
    })

    it('should fetch sources with isActive filter', async () => {
      const mockSources: RadarSource[] = [
        {
          id: 'source-1',
          source: '杭州银行金融科技',
          category: 'industry',
          url: 'https://tech.hzbank.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 */6 * * *',
          lastCrawlStatus: 'success',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-02-07T10:00:00Z',
        },
      ]

      mockApiFetch.mockResolvedValue(mockSources)

      const result = await getRadarSources({ isActive: true })

      expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/radar-sources?isActive=true')
      expect(result.data).toEqual(mockSources)
    })

    it('should fetch sources with multiple filters', async () => {
      const mockSources: RadarSource[] = []

      mockApiFetch.mockResolvedValue(mockSources)

      const result = await getRadarSources({ category: 'industry', isActive: true })

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('category=industry')
      )
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('isActive=true')
      )
    })
  })

  describe('getRadarSource', () => {
    it('should fetch single radar source', async () => {
      const mockSource: RadarSource = {
        id: 'source-1',
        source: '杭州银行金融科技',
        category: 'industry',
        url: 'https://tech.hzbank.com',
        type: 'website',
        peerName: '杭州银行',
        isActive: true,
        crawlSchedule: '0 */6 * * *',
        crawlConfig: {
          titleSelector: 'h1.article-title',
          contentSelector: 'div.content',
        },
        lastCrawlStatus: 'success',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-02-07T10:00:00Z',
      }

      mockApiFetch.mockResolvedValue({
        success: true,
        data: mockSource,
      })

      const result = await getRadarSource('source-1')

      expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/radar-sources/source-1')
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockSource)
    })

    it('should throw error when source not found', async () => {
      mockApiFetch.mockRejectedValue(new Error('Source not found'))

      await expect(getRadarSource('invalid-id')).rejects.toThrow('Source not found')
    })
  })

  describe('createRadarSource', () => {
    it('should create new radar source', async () => {
      const createData: CreateRadarSourceData = {
        source: 'New Source',
        category: 'industry',
        url: 'https://example.com',
        type: 'website',
        peerName: 'Test Peer',
        isActive: true,
        crawlSchedule: '0 */6 * * *',
        crawlConfig: {
          titleSelector: 'h1',
          contentSelector: 'article',
        },
      }

      const mockResponse = {
        id: 'new-source-id',
        ...createData,
        lastCrawlStatus: 'pending',
        createdAt: '2026-02-08T00:00:00Z',
        updatedAt: '2026-02-08T00:00:00Z',
      }

      mockApiFetch.mockResolvedValue({
        success: true,
        data: mockResponse,
        message: 'Radar source created successfully',
      })

      const result = await createRadarSource(createData)

      expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/radar-sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createData),
      })
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockResponse)
    })

    it('should create source with minimal data', async () => {
      const createData: CreateRadarSourceData = {
        source: 'Minimal Source',
        category: 'tech',
        url: 'https://minimal.com',
        type: 'website',
      }

      mockApiFetch.mockResolvedValue({
        success: true,
        data: { id: 'minimal-id', ...createData },
      })

      await createRadarSource(createData)

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(createData),
        })
      )
    })

    it('should throw error when creation fails', async () => {
      mockApiFetch.mockRejectedValue(new Error('Validation error'))

      await expect(
        createRadarSource({
          source: 'Invalid',
          category: 'industry',
          url: 'not-a-url',
          type: 'website',
        })
      ).rejects.toThrow('Validation error')
    })
  })

  describe('updateRadarSource', () => {
    it('should update existing radar source', async () => {
      const updateData: UpdateRadarSourceData = {
        source: 'Updated Source Name',
        crawlSchedule: '0 */12 * * *',
      }

      const mockResponse = {
        id: 'source-1',
        source: 'Updated Source Name',
        category: 'industry',
        url: 'https://tech.hzbank.com',
        type: 'website',
        isActive: true,
        crawlSchedule: '0 */12 * * *',
        lastCrawlStatus: 'success',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-02-08T10:00:00Z',
      }

      mockApiFetch.mockResolvedValue({
        success: true,
        data: mockResponse,
        message: 'Radar source updated successfully',
      })

      const result = await updateRadarSource('source-1', updateData)

      expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/radar-sources/source-1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })
      expect(result.success).toBe(true)
      expect(result.data.source).toBe('Updated Source Name')
    })

    it('should update crawlConfig', async () => {
      const updateData: UpdateRadarSourceData = {
        crawlConfig: {
          titleSelector: 'h2.new-title',
          contentSelector: 'div.new-content',
          maxPages: 5,
        },
      }

      mockApiFetch.mockResolvedValue({
        success: true,
        data: { id: 'source-1', ...updateData },
      })

      await updateRadarSource('source-1', updateData)

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(updateData),
        })
      )
    })

    it('should throw error when source not found', async () => {
      mockApiFetch.mockRejectedValue(new Error('Source not found'))

      await expect(
        updateRadarSource('invalid-id', { source: 'New Name' })
      ).rejects.toThrow('Source not found')
    })
  })

  describe('deleteRadarSource', () => {
    it('should delete radar source', async () => {
      mockApiFetch.mockResolvedValue(undefined)

      await deleteRadarSource('source-1')

      expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/radar-sources/source-1', {
        method: 'DELETE',
      })
    })

    it('should throw error when deletion fails', async () => {
      mockApiFetch.mockRejectedValue(new Error('Cannot delete active source'))

      await expect(deleteRadarSource('source-1')).rejects.toThrow('Cannot delete active source')
    })
  })

  describe('toggleRadarSourceActive', () => {
    it('should toggle source active status', async () => {
      const mockResponse = {
        id: 'source-1',
        source: 'Test Source',
        category: 'industry',
        url: 'https://example.com',
        type: 'website',
        isActive: false,
        crawlSchedule: '0 */6 * * *',
        lastCrawlStatus: 'success',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-02-08T10:00:00Z',
      }

      mockApiFetch.mockResolvedValue({
        success: true,
        data: mockResponse,
        message: 'Radar source disabled successfully',
      })

      const result = await toggleRadarSourceActive('source-1')

      expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/radar-sources/source-1/toggle', {
        method: 'PATCH',
      })
      expect(result.success).toBe(true)
      expect(result.data.isActive).toBe(false)
    })

    it('should enable disabled source', async () => {
      mockApiFetch.mockResolvedValue({
        success: true,
        data: { id: 'source-1', isActive: true },
        message: 'Radar source enabled successfully',
      })

      const result = await toggleRadarSourceActive('source-1')

      expect(result.data.isActive).toBe(true)
    })
  })

  describe('testRadarSourceCrawl', () => {
    it('should trigger test crawl for source', async () => {
      const mockResponse = {
        success: true,
        data: {
          sourceId: 'source-1',
          source: 'Test Source',
          url: 'https://example.com',
          status: 'success',
          message: 'Test crawl completed successfully',
          result: {
            title: 'Test Article',
            summary: 'Test summary',
            contentPreview: 'Test content preview',
            publishDate: '2026-02-07T10:00:00Z',
            author: 'Test Author',
            duration: 1234,
          },
        },
      }

      mockApiFetch.mockResolvedValue(mockResponse)

      const result = await testRadarSourceCrawl('source-1')

      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/admin/radar-sources/source-1/test-crawl',
        { method: 'POST' }
      )
      expect(result.success).toBe(true)
      expect(result.data.status).toBe('success')
    })

    it('should return error when test crawl fails', async () => {
      const mockResponse = {
        success: false,
        data: {
          sourceId: 'source-1',
          source: 'Test Source',
          url: 'https://example.com',
          status: 'failed',
          message: 'Connection timeout',
          error: 'Connection timeout',
          result: null,
        },
      }

      mockApiFetch.mockResolvedValue(mockResponse)

      const result = await testRadarSourceCrawl('source-1')

      expect(result.success).toBe(false)
      expect(result.data.status).toBe('failed')
    })

    it('should throw error when source not found', async () => {
      mockApiFetch.mockRejectedValue(new Error('Source not found'))

      await expect(testRadarSourceCrawl('invalid-id')).rejects.toThrow('Source not found')
    })
  })

  describe('getRadarSourceStats', () => {
    it('should fetch statistics by category', async () => {
      const mockStats = {
        success: true,
        data: {
          tech: { total: 5, active: 3, inactive: 2 },
          industry: { total: 10, active: 8, inactive: 2 },
          compliance: { total: 3, active: 2, inactive: 1 },
        },
      }

      mockApiFetch.mockResolvedValue(mockStats)

      const result = await getRadarSourceStats()

      expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/radar-sources/stats/by-category')
      expect(result.success).toBe(true)
      expect(result.data.industry.total).toBe(10)
      expect(result.data.tech.active).toBe(3)
    })

    it('should handle empty stats', async () => {
      mockApiFetch.mockResolvedValue({
        success: true,
        data: {
          tech: { total: 0, active: 0, inactive: 0 },
          industry: { total: 0, active: 0, inactive: 0 },
          compliance: { total: 0, active: 0, inactive: 0 },
        },
      })

      const result = await getRadarSourceStats()

      expect(result.data.industry.total).toBe(0)
    })
  })

  describe('API Error Handling', () => {
    it('should handle network errors', async () => {
      mockApiFetch.mockRejectedValue(new Error('Network error'))

      await expect(getRadarSources()).rejects.toThrow('Network error')
    })

    it('should handle server errors', async () => {
      mockApiFetch.mockRejectedValue(new Error('Internal server error'))

      await expect(getRadarSource('source-1')).rejects.toThrow('Internal server error')
    })

    it('should handle unauthorized errors', async () => {
      mockApiFetch.mockRejectedValue(new Error('Unauthorized'))

      await expect(createRadarSource({
        source: 'Test',
        category: 'industry',
        url: 'https://example.com',
        type: 'website',
      })).rejects.toThrow('Unauthorized')
    })
  })
})
