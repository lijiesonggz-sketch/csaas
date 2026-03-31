import 'reflect-metadata'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { RadarPushController } from './radar-push.controller'
import { RadarPush } from '../../../database/entities/radar-push.entity'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'
import { RawContent } from '../../../database/entities/raw-content.entity'
import { QueryPushHistoryDto } from '../dto/push-history.dto'
import { NotFoundException } from '@nestjs/common'
import { OrganizationGuard } from '../../organizations/guards/organization.guard'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { AuditInterceptor } from '../../../common/interceptors/audit.interceptor'
import { RadarPushService } from '../services/radar-push.service'
import { RadarRelevanceEnhancedService } from '../../compliance-intelligence/services/radar-relevance-enhanced.service'

describe('RadarPushController', () => {
  let controller: RadarPushController

  const mockRepo = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  }
  const mockAnalyzedContentRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  }
  const mockRawContentRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  }
  const mockRadarPushService = {
    getPushHistory: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    setBookmark: jest.fn(),
  }
  const mockRadarRelevanceEnhancedService = {
    calculateRadarRelevance: jest.fn(),
  }

  // Mock guards
  const mockGuard = {
    canActivate: jest.fn(() => true),
  }

  // Mock interceptor
  const mockInterceptor = {
    intercept: jest.fn((context, next) => next.handle()),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RadarPushController],
      providers: [
        {
          provide: getRepositoryToken(RadarPush),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(AnalyzedContent),
          useValue: mockAnalyzedContentRepo,
        },
        {
          provide: getRepositoryToken(RawContent),
          useValue: mockRawContentRepo,
        },
        {
          provide: RadarPushService,
          useValue: mockRadarPushService,
        },
        {
          provide: RadarRelevanceEnhancedService,
          useValue: mockRadarRelevanceEnhancedService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(TenantGuard)
      .useValue(mockGuard)
      .overrideGuard(OrganizationGuard)
      .useValue(mockGuard)
      .overrideInterceptor(AuditInterceptor)
      .useValue(mockInterceptor)
      .compile()

    controller = module.get<RadarPushController>(RadarPushController)

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('GET /api/radar/pushes', () => {
    it('should return push history with default pagination', async () => {
      const query: QueryPushHistoryDto = {}
      const mockPushes = []
      const mockTotal = 0

      mockRepo.findAndCount.mockResolvedValue([mockPushes, mockTotal])

      const result = await controller.getPushHistory('tenant-123', { organizationId: 'org-123', userId: 'user-123' }, query)

      expect(result).toEqual({
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      })
      expect(mockRepo.findAndCount).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123', organizationId: 'org-123' },
        order: {
          priorityLevel: 'DESC',
          relevanceScore: 'DESC',
          scheduledAt: 'DESC',
        },
        skip: 0,
        take: 20,
      })
    })

    it('should return push history with filters', async () => {
      const query: QueryPushHistoryDto = {
        radarType: 'tech',
        page: 1,
        limit: 20,
      }
      const mockPushes = [
        {
          id: 'push-1',
          contentId: 'analyzed-1',
          radarType: 'tech',
          relevanceScore: '0.95',
          priorityLevel: 'high',
          scheduledAt: new Date('2024-01-15T10:00:00.000Z'),
          isRead: false,
          readAt: null,
        },
      ]
      const mockTotal = 1
      mockAnalyzedContentRepo.find.mockResolvedValue([
        {
          id: 'analyzed-1',
          contentId: 'raw-1',
          aiSummary: 'Test summary',
          categories: ['security'],
          targetAudience: 'developers',
          roiAnalysis: { score: 0.8 },
          tags: [{ name: 'tag1' }, { name: 'tag2' }],
        },
      ])
      mockRawContentRepo.find.mockResolvedValue([
        {
          id: 'raw-1',
          title: 'Test Push',
          summary: 'Raw summary',
          fullContent: 'Full content',
          url: 'https://example.com',
          publishDate: new Date('2024-01-15T09:00:00.000Z'),
          source: 'Test Source',
        },
      ])

      mockRepo.findAndCount.mockResolvedValue([mockPushes, mockTotal])

      const result = await controller.getPushHistory('tenant-123', { organizationId: 'org-123', userId: 'user-123' }, query)

      expect(result).toEqual({
        data: [
          {
            pushId: 'push-1',
            radarType: 'tech',
            title: 'Test Push',
            summary: 'Test summary',
            fullContent: 'Full content',
            relevanceScore: 0.95,
            priorityLevel: 1,
            weaknessCategories: ['security'],
            url: 'https://example.com',
            publishDate: new Date('2024-01-15T09:00:00.000Z'),
            source: 'Test Source',
            tags: ['tag1', 'tag2'],
            targetAudience: 'developers',
            roiAnalysis: { score: 0.8 },
            isRead: false,
            readAt: null,
            controlId: null,
            matchedControls: [],
            sourceModule: 'radar',
            sourceRecordId: 'push-1',
            sourceRoute: '/radar/tech',
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      })
      expect(mockRepo.findAndCount).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123', radarType: 'tech', organizationId: 'org-123' },
        order: {
          priorityLevel: 'DESC',
          relevanceScore: 'DESC',
          scheduledAt: 'DESC',
        },
        skip: 0,
        take: 20,
      })
    })

    it('should handle pagination parameters', async () => {
      const query: QueryPushHistoryDto = {
        page: 3,
        limit: 10,
      }
      const mockPushes = []
      const mockTotal = 25

      mockRepo.findAndCount.mockResolvedValue([mockPushes, mockTotal])

      const result = await controller.getPushHistory('tenant-123', { organizationId: 'org-123', userId: 'user-123' }, query)

      expect(result).toEqual({
        data: [],
        pagination: {
          page: 3,
          limit: 10,
          total: 25,
          totalPages: 3,
        },
      })
      expect(mockRepo.findAndCount).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123', organizationId: 'org-123' },
        order: {
          priorityLevel: 'DESC',
          relevanceScore: 'DESC',
          scheduledAt: 'DESC',
        },
        skip: 20,
        take: 10,
      })
    })

    it('should filter by radarType and status', async () => {
      const query: QueryPushHistoryDto = {
        radarType: 'industry',
        page: 1,
        limit: 20,
      }
      const mockPushes = []
      const mockTotal = 0

      mockRepo.findAndCount.mockResolvedValue([mockPushes, mockTotal])

      await controller.getPushHistory('tenant-123', { organizationId: 'org-123', userId: 'user-123' }, query)

      expect(mockRepo.findAndCount).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123', radarType: 'industry', organizationId: 'org-123' },
        order: {
          priorityLevel: 'DESC',
          relevanceScore: 'DESC',
          scheduledAt: 'DESC',
        },
        skip: 0,
        take: 20,
      })
    })

    it('should transform priority levels correctly', async () => {
      const query: QueryPushHistoryDto = {}
      const mockPushes = [
        {
          id: 'push-1',
          contentId: 'analyzed-1',
          radarType: 'tech',
          relevanceScore: '0.95',
          priorityLevel: 'high',
          scheduledAt: new Date('2024-01-15T10:00:00.000Z'),
          isRead: false,
          readAt: null,
        },
        {
          id: 'push-2',
          contentId: 'analyzed-2',
          radarType: 'tech',
          relevanceScore: '0.75',
          priorityLevel: 'medium',
          scheduledAt: new Date('2024-01-15T10:00:00.000Z'),
          isRead: false,
          readAt: null,
        },
        {
          id: 'push-3',
          contentId: 'analyzed-3',
          radarType: 'tech',
          relevanceScore: '0.55',
          priorityLevel: 'low',
          scheduledAt: new Date('2024-01-15T10:00:00.000Z'),
          isRead: false,
          readAt: null,
        },
      ]
      const mockTotal = 3
      mockAnalyzedContentRepo.find.mockResolvedValue([])
      mockRawContentRepo.find.mockResolvedValue([])

      mockRepo.findAndCount.mockResolvedValue([mockPushes, mockTotal])

      const result = await controller.getPushHistory('tenant-123', { organizationId: 'org-123', userId: 'user-123' }, query)

      expect(result.data[0].priorityLevel).toBe(1)
      expect(result.data[1].priorityLevel).toBe(2)
      expect(result.data[2].priorityLevel).toBe(3)
    })

    it('should handle missing analyzedContent gracefully', async () => {
      const query: QueryPushHistoryDto = {}
      const mockPushes = [
        {
          id: 'push-1',
          contentId: 'missing-analyzed',
          radarType: 'tech',
          relevanceScore: '0.95',
          priorityLevel: 'high',
          scheduledAt: new Date('2024-01-15T10:00:00.000Z'),
          isRead: false,
          readAt: null,
        },
      ]
      const mockTotal = 1
      mockAnalyzedContentRepo.find.mockResolvedValue([])
      mockRawContentRepo.find.mockResolvedValue([])

      mockRepo.findAndCount.mockResolvedValue([mockPushes, mockTotal])

      const result = await controller.getPushHistory('tenant-123', { organizationId: 'org-123', userId: 'user-123' }, query)

      expect(result.data[0]).toEqual({
        pushId: 'push-1',
        radarType: 'tech',
        title: '',
        summary: '',
        fullContent: undefined,
        relevanceScore: 0.95,
        priorityLevel: 1,
        weaknessCategories: [],
        url: '',
        publishDate: new Date('2024-01-15T10:00:00.000Z'),
        source: '',
        tags: [],
        targetAudience: '',
        roiAnalysis: undefined,
        isRead: false,
        readAt: null,
        controlId: null,
        matchedControls: [],
        sourceModule: 'radar',
        sourceRecordId: 'push-1',
        sourceRoute: '/radar/tech',
      })
    })
  })

  describe('GET /api/radar/pushes/history', () => {
    it('should delegate history feed to RadarPushService', async () => {
      const query: QueryPushHistoryDto = {
        radarType: 'tech',
        timeRange: '30d',
        page: 1,
        limit: 20,
      }
      const serviceResponse = {
        data: [
          {
            id: 'push-1',
            radarType: 'tech',
            title: '历史推送',
            summary: '摘要',
            relevanceScore: 0.92,
            relevanceLevel: 'high',
            sentAt: '2026-03-31T00:00:00.000Z',
            readAt: null,
            isRead: false,
            isBookmarked: false,
            controlId: null,
            matchedControls: [],
            sourceModule: 'radar',
            sourceRecordId: 'push-1',
            sourceRoute: '/radar/tech',
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      }
      mockRadarPushService.getPushHistory.mockResolvedValue(serviceResponse)

      const result = await controller.getHistoryFeed(
        'tenant-123',
        { organizationId: 'org-123', userId: 'user-123' },
        query,
      )

      expect(result).toEqual(serviceResponse)
      expect(mockRadarPushService.getPushHistory).toHaveBeenCalledWith(
        'tenant-123',
        'org-123',
        query,
      )
    })
  })

  describe('GET /api/radar/pushes/unread-count', () => {
    it('should return unread count from RadarPushService', async () => {
      mockRadarPushService.getUnreadCount.mockResolvedValue(3)

      const result = await controller.getUnreadCount('tenant-123', {
        organizationId: 'org-123',
        userId: 'user-123',
      })

      expect(result).toEqual({ count: 3 })
      expect(mockRadarPushService.getUnreadCount).toHaveBeenCalledWith('tenant-123', 'org-123')
    })
  })

  describe('GET /api/radar/pushes/:id', () => {
    it('should return push detail', async () => {
      const pushId = 'push-123'
      const mockPush = {
        id: pushId,
        tenantId: 'tenant-123',
        contentId: 'analyzed-1',
        radarType: 'tech',
        relevanceScore: '0.95',
        priorityLevel: 'high',
        scheduledAt: new Date('2024-01-15T10:00:00.000Z'),
        isRead: false,
        readAt: null,
      }
      mockAnalyzedContentRepo.findOne.mockResolvedValue({
        id: 'analyzed-1',
        contentId: 'raw-1',
        aiSummary: 'Test summary',
        categories: ['security'],
        targetAudience: 'developers',
        roiAnalysis: { score: 0.8 },
        tags: [{ name: 'tag1' }],
      })
      mockRawContentRepo.findOne.mockResolvedValue({
        id: 'raw-1',
        title: 'Test Push',
        summary: 'Raw summary',
        fullContent: 'Full content',
        url: 'https://example.com',
        publishDate: new Date('2024-01-15T09:00:00.000Z'),
        source: 'Test Source',
      })
      mockRadarRelevanceEnhancedService.calculateRadarRelevance.mockResolvedValue({
        relevanceScore: 0.92,
        priority: 'HIGH',
        controlId: 'control-123',
        matchedControls: [
          {
            controlId: 'control-123',
            controlCode: 'CTRL-123',
            controlName: '测试控制点',
            reason: '命中控制语义：测试',
          },
        ],
        matchedCases: [],
        matchedClauses: [],
        suggestedChecks: [],
        sourceModule: 'radar',
        sourceRecordId: 'analyzed-1',
        sourceRoute: '/radar/compliance/analyzed-1',
      })

      mockRepo.findOne.mockResolvedValue(mockPush)

      const result = await controller.getPushDetail(
        'tenant-123',
        { organizationId: 'org-123', userId: 'user-123' },
        pushId,
      )

      expect(result).toEqual({
        pushId: 'push-123',
        radarType: 'tech',
        title: 'Test Push',
        summary: 'Test summary',
        fullContent: 'Full content',
        relevanceScore: 0.95,
        priorityLevel: 1,
        weaknessCategories: ['security'],
        url: 'https://example.com',
        publishDate: new Date('2024-01-15T09:00:00.000Z'),
        source: 'Test Source',
        tags: ['tag1'],
        targetAudience: 'developers',
        roiAnalysis: { score: 0.8 },
        isRead: false,
        readAt: null,
        controlId: 'control-123',
        matchedControls: [
          {
            controlId: 'control-123',
            controlName: '测试控制点',
            packSource: '命中控制语义：测试',
            priority: 'HIGH',
          },
        ],
        sourceModule: 'radar',
        sourceRecordId: 'push-123',
        sourceRoute: '/radar/tech',
      })
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: pushId, tenantId: 'tenant-123', organizationId: 'org-123' },
      })
    })

    it('should return explicit empty control context for compliance pushes', async () => {
      const pushId = 'push-compliance'
      const mockPush = {
        id: pushId,
        tenantId: 'tenant-123',
        contentId: 'analyzed-1',
        radarType: 'compliance',
        relevanceScore: '0.88',
        priorityLevel: 'medium',
        scheduledAt: new Date('2024-01-15T10:00:00.000Z'),
        isRead: false,
        readAt: null,
      }

      mockAnalyzedContentRepo.findOne.mockResolvedValue(null)
      mockRawContentRepo.findOne.mockResolvedValue(null)
      mockRepo.findOne.mockResolvedValue(mockPush)
      mockRadarRelevanceEnhancedService.calculateRadarRelevance.mockRejectedValue(
        new Error('relevance failed'),
      )

      const result = await controller.getPushDetail(
        'tenant-123',
        { organizationId: 'org-123', userId: 'user-123' },
        pushId,
      )

      expect(result).toMatchObject({
        controlId: null,
        matchedControls: [],
        sourceModule: 'radar',
        sourceRecordId: pushId,
        sourceRoute: '/radar/compliance',
      })
    })

    it('should throw NotFoundException if push not found', async () => {
      const pushId = 'non-existent'

      mockRepo.findOne.mockResolvedValue(null)

      await expect(
        controller.getPushDetail('tenant-123', { organizationId: 'org-123', userId: 'user-123' }, pushId),
      ).rejects.toThrow(NotFoundException)
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: pushId, tenantId: 'tenant-123', organizationId: 'org-123' },
      })
    })
  })

  describe('PATCH /api/radar/pushes/:id/read', () => {
    it('should mark push as read', async () => {
      const pushId = 'push-123'
      mockRadarPushService.markAsRead.mockResolvedValue(undefined)

      const result = await controller.markAsRead(
        'tenant-123',
        { organizationId: 'org-123', userId: 'user-123' },
        pushId,
      )

      expect(result).toEqual({ success: true })
      expect(mockRadarPushService.markAsRead).toHaveBeenCalledWith(
        pushId,
        'user-123',
        'tenant-123',
        'org-123',
      )
    })

    it('should throw NotFoundException if push not found', async () => {
      const pushId = 'non-existent'
      mockRadarPushService.markAsRead.mockRejectedValue(new NotFoundException('Push not found'))

      await expect(
        controller.markAsRead('tenant-123', { organizationId: 'org-123', userId: 'user-123' }, pushId),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('POST /api/radar/pushes/:id/bookmark', () => {
    it('should update bookmark status', async () => {
      mockRadarPushService.setBookmark.mockResolvedValue(true)

      const result = await controller.setBookmark(
        'tenant-123',
        { organizationId: 'org-123', userId: 'user-123' },
        'push-123',
        { bookmark: true },
      )

      expect(result).toEqual({
        pushId: 'push-123',
        isBookmarked: true,
      })
      expect(mockRadarPushService.setBookmark).toHaveBeenCalledWith(
        'push-123',
        'tenant-123',
        'org-123',
        true,
      )
    })
  })

  describe('Multi-tenant isolation', () => {
    it('should always filter by tenantId in getPushHistory', async () => {
      const query: QueryPushHistoryDto = { radarType: 'tech' }
      mockRepo.findAndCount.mockResolvedValue([[], 0])

      await controller.getPushHistory('tenant-456', { organizationId: 'org-123', userId: 'user-123' }, query)

      const callArgs = mockRepo.findAndCount.mock.calls[0][0]
      expect(callArgs.where.tenantId).toBe('tenant-456')
    })

    it('should always filter by tenantId in getPushDetail', async () => {
      mockRepo.findOne.mockResolvedValue(null)

      await expect(
        controller.getPushDetail('tenant-789', { organizationId: 'org-123', userId: 'user-123' }, 'push-123'),
      ).rejects.toThrow()

      const callArgs = mockRepo.findOne.mock.calls[0][0]
      expect(callArgs.where.tenantId).toBe('tenant-789')
    })

    it('should always filter by tenantId in markAsRead', async () => {
      mockRadarPushService.markAsRead.mockRejectedValue(new NotFoundException('Push not found'))

      await expect(
        controller.markAsRead('tenant-999', { organizationId: 'org-123', userId: 'user-123' }, 'push-123'),
      ).rejects.toThrow()

      expect(mockRadarPushService.markAsRead).toHaveBeenCalledWith(
        'push-123',
        'user-123',
        'tenant-999',
        'org-123',
      )
    })
  })
})
