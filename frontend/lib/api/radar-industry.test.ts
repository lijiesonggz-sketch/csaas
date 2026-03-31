/**
 * Industry Radar API Client Tests
 * Story 3.3 - Phase 1 Task 1.3: 创建行业雷达API客户端方法
 *
 * 测试目标：验证行业雷达API方法的正确性
 */

import {
  getIndustryPushes,
  getIndustryPushDetail,
  markIndustryPushAsRead,
  getWatchedPeers,
} from './radar'
import { apiFetch } from '../utils/api'

// Mock apiFetch
jest.mock('../utils/api', () => ({
  apiFetch: jest.fn(),
}))

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>

describe('Industry Radar API Client', () => {
  const radarContext = (sourceRoute: string, sourceRecordId: string) => ({
    controlId: null,
    matchedControls: [],
    sourceModule: 'radar' as const,
    sourceRecordId,
    sourceRoute,
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getIndustryPushes', () => {
    it('should fetch industry pushes with organizationId', async () => {
      const mockResponse = {
        data: [
          {
            ...radarContext('/radar/industry', 'industry-push-1'),
            pushId: 'industry-push-1',
            radarType: 'industry',
            title: '某银行数字化转型实践',
            peerName: '某城商行',
            practiceDescription: '实践描述...',
            relevanceScore: 0.95,
            priorityLevel: 1,
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      }

      mockApiFetch.mockResolvedValue(mockResponse)

      const result = await getIndustryPushes('org-123')

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/radar/pushes')
      )
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('radarType=industry')
      )
      expect(result.data).toHaveLength(1)
      expect(result.data[0].radarType).toBe('industry')
    })

    it('should support filter parameter for watched peers', async () => {
      const mockResponse = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }

      mockApiFetch.mockResolvedValue(mockResponse)

      await getIndustryPushes('org-123', { filter: 'watched' })

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('filter=watched')
      )
    })

    it('should support filterByScale parameter', async () => {
      const mockResponse = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }

      mockApiFetch.mockResolvedValue(mockResponse)

      await getIndustryPushes('org-123', { filterByScale: true })

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('filterByScale=true')
      )
    })

    it('should support filterByRegion parameter', async () => {
      const mockResponse = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }

      mockApiFetch.mockResolvedValue(mockResponse)

      await getIndustryPushes('org-123', { filterByRegion: true })

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('filterByRegion=true')
      )
    })

    it('should support pagination parameters', async () => {
      const mockResponse = {
        data: [],
        pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
      }

      mockApiFetch.mockResolvedValue(mockResponse)

      await getIndustryPushes('org-123', { page: 2, limit: 10 })

      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2')
      )
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10')
      )
    })
  })

  describe('getIndustryPushDetail', () => {
    it('should fetch industry push detail by pushId', async () => {
      const mockPush = {
        ...radarContext('/radar/industry', 'industry-push-1'),
        pushId: 'industry-push-1',
        radarType: 'industry',
        title: '某银行数字化转型实践',
        peerName: '某城商行',
        practiceDescription: '完整的实践描述内容...',
        estimatedCost: '500-1000万元',
        implementationPeriod: '6-12个月',
        technicalEffect: '系统性能提升50%',
        fullContent: '完整内容...',
        relevanceScore: 0.95,
        priorityLevel: 1,
        weaknessCategories: ['数字化转型'],
        url: 'https://example.com',
        publishDate: '2024-01-15',
        source: '金融科技媒体',
        tags: ['数字化', '转型'],
        targetAudience: '金融机构IT总监',
        isRead: false,
      }

      mockApiFetch.mockResolvedValue(mockPush)

      const result = await getIndustryPushDetail('industry-push-1')

      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/radar/pushes/industry-push-1'
      )
      expect(result.pushId).toBe('industry-push-1')
      expect(result.peerName).toBe('某城商行')
      expect(result.practiceDescription).toBeDefined()
    })
  })

  describe('markIndustryPushAsRead', () => {
    it('should mark industry push as read', async () => {
      mockApiFetch.mockResolvedValue(undefined)

      await markIndustryPushAsRead('industry-push-1')

      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/radar/pushes/industry-push-1/read',
        { method: 'PATCH' }
      )
    })

    it('should throw error if marking fails', async () => {
      mockApiFetch.mockRejectedValue(new Error('Not Found'))

      await expect(markIndustryPushAsRead('invalid-id')).rejects.toThrow(
        'Not Found'
      )
    })
  })

  describe('getWatchedPeers', () => {
    it('should fetch watched peers for organization', async () => {
      const mockWatchedPeers = [
        { id: 'peer-1', peerName: '中国银行', institutionType: '国有大行', industry: 'banking' },
        { id: 'peer-2', peerName: '招商银行', institutionType: '股份制银行', industry: 'banking' },
      ]

      mockApiFetch.mockResolvedValue(mockWatchedPeers)

      const result = await getWatchedPeers('org-123')

      expect(mockApiFetch).toHaveBeenCalledWith(
        '/radar/watched-peers?organizationId=org-123'
      )
      expect(result).toHaveLength(2)
      expect(result[0].peerName).toBe('中国银行')
    })

    it('should return empty array if no watched peers', async () => {
      const mockResponse: any[] = []

      mockApiFetch.mockResolvedValue(mockResponse)

      const result = await getWatchedPeers('org-123')

      expect(result).toHaveLength(0)
    })
  })
})
