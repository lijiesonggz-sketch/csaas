import 'reflect-metadata'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { RadarPushController } from './radar-push.controller'
import { RadarPush } from '../../../database/entities/radar-push.entity'
import { QueryPushHistoryDto } from '../dto/push-history.dto'
import { NotFoundException } from '@nestjs/common'
import { OrganizationGuard } from '../../organizations/guards/organization.guard'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { AuditInterceptor } from '../../../common/interceptors/audit.interceptor'

describe('RadarPushController', () => {
  let controller: RadarPushController

  const mockRepo = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
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

      const result = await controller.getPushHistory('tenant-123', 'org-123', query)

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
        where: { tenantId: 'tenant-123' },
        order: {
          priorityLevel: 'DESC',
          relevanceScore: 'DESC',
          scheduledAt: 'DESC',
        },
        skip: 0,
        take: 20,
        relations: ['analyzedContent', 'analyzedContent.rawContent', 'analyzedContent.tags'],
        relationLoadStrategy: 'join',
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
          radarType: 'tech',
          relevanceScore: '0.95',
          priorityLevel: 'high',
          scheduledAt: new Date('2024-01-15T10:00:00.000Z'),
          isRead: false,
          readAt: null,
          analyzedContent: {
            aiSummary: 'Test summary',
            categories: ['security'],
            targetAudience: 'developers',
            roiAnalysis: { score: 0.8 },
            tags: [{ name: 'tag1' }, { name: 'tag2' }],
            rawContent: {
              title: 'Test Push',
              summary: 'Raw summary',
              fullContent: 'Full content',
              url: 'https://example.com',
              publishDate: new Date('2024-01-15T09:00:00.000Z'),
              source: 'Test Source',
            },
          },
        },
      ]
      const mockTotal = 1

      mockRepo.findAndCount.mockResolvedValue([mockPushes, mockTotal])

      const result = await controller.getPushHistory('tenant-123', 'org-123', query)

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
        where: { tenantId: 'tenant-123', radarType: 'tech' },
        order: {
          priorityLevel: 'DESC',
          relevanceScore: 'DESC',
          scheduledAt: 'DESC',
        },
        skip: 0,
        take: 20,
        relations: ['analyzedContent', 'analyzedContent.rawContent', 'analyzedContent.tags'],
        relationLoadStrategy: 'join',
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

      const result = await controller.getPushHistory('tenant-123', 'org-123', query)

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
        where: { tenantId: 'tenant-123' },
        order: {
          priorityLevel: 'DESC',
          relevanceScore: 'DESC',
          scheduledAt: 'DESC',
        },
        skip: 20,
        take: 10,
        relations: ['analyzedContent', 'analyzedContent.rawContent', 'analyzedContent.tags'],
        relationLoadStrategy: 'join',
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

      await controller.getPushHistory('tenant-123', 'org-123', query)

      expect(mockRepo.findAndCount).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123', radarType: 'industry' },
        order: {
          priorityLevel: 'DESC',
          relevanceScore: 'DESC',
          scheduledAt: 'DESC',
        },
        skip: 0,
        take: 20,
        relations: ['analyzedContent', 'analyzedContent.rawContent', 'analyzedContent.tags'],
        relationLoadStrategy: 'join',
      })
    })

    it('should transform priority levels correctly', async () => {
      const query: QueryPushHistoryDto = {}
      const mockPushes = [
        {
          id: 'push-1',
          radarType: 'tech',
          relevanceScore: '0.95',
          priorityLevel: 'high',
          scheduledAt: new Date('2024-01-15T10:00:00.000Z'),
          isRead: false,
          readAt: null,
          analyzedContent: {
            rawContent: {
              title: 'High Priority',
            },
          },
        },
        {
          id: 'push-2',
          radarType: 'tech',
          relevanceScore: '0.75',
          priorityLevel: 'medium',
          scheduledAt: new Date('2024-01-15T10:00:00.000Z'),
          isRead: false,
          readAt: null,
          analyzedContent: {
            rawContent: {
              title: 'Medium Priority',
            },
          },
        },
        {
          id: 'push-3',
          radarType: 'tech',
          relevanceScore: '0.55',
          priorityLevel: 'low',
          scheduledAt: new Date('2024-01-15T10:00:00.000Z'),
          isRead: false,
          readAt: null,
          analyzedContent: {
            rawContent: {
              title: 'Low Priority',
            },
          },
        },
      ]
      const mockTotal = 3

      mockRepo.findAndCount.mockResolvedValue([mockPushes, mockTotal])

      const result = await controller.getPushHistory('tenant-123', 'org-123', query)

      expect(result.data[0].priorityLevel).toBe(1)
      expect(result.data[1].priorityLevel).toBe(2)
      expect(result.data[2].priorityLevel).toBe(3)
    })

    it('should handle missing analyzedContent gracefully', async () => {
      const query: QueryPushHistoryDto = {}
      const mockPushes = [
        {
          id: 'push-1',
          radarType: 'tech',
          relevanceScore: '0.95',
          priorityLevel: 'high',
          scheduledAt: new Date('2024-01-15T10:00:00.000Z'),
          isRead: false,
          readAt: null,
          analyzedContent: null,
        },
      ]
      const mockTotal = 1

      mockRepo.findAndCount.mockResolvedValue([mockPushes, mockTotal])

      const result = await controller.getPushHistory('tenant-123', 'org-123', query)

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
      })
    })
  })

  describe('GET /api/radar/pushes/:id', () => {
    it('should return push detail', async () => {
      const pushId = 'push-123'
      const mockPush = {
        id: pushId,
        tenantId: 'tenant-123',
        radarType: 'tech',
        relevanceScore: '0.95',
        priorityLevel: 'high',
        scheduledAt: new Date('2024-01-15T10:00:00.000Z'),
        isRead: false,
        readAt: null,
        analyzedContent: {
          aiSummary: 'Test summary',
          categories: ['security'],
          targetAudience: 'developers',
          roiAnalysis: { score: 0.8 },
          tags: [{ name: 'tag1' }],
          rawContent: {
            title: 'Test Push',
            summary: 'Raw summary',
            fullContent: 'Full content',
            url: 'https://example.com',
            publishDate: new Date('2024-01-15T09:00:00.000Z'),
            source: 'Test Source',
          },
        },
      }

      mockRepo.findOne.mockResolvedValue(mockPush)

      const result = await controller.getPushDetail('tenant-123', pushId)

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
      })
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: pushId, tenantId: 'tenant-123' },
        relations: ['analyzedContent', 'analyzedContent.rawContent', 'analyzedContent.tags'],
      })
    })

    it('should throw NotFoundException if push not found', async () => {
      const pushId = 'non-existent'

      mockRepo.findOne.mockResolvedValue(null)

      await expect(controller.getPushDetail('tenant-123', pushId)).rejects.toThrow(
        NotFoundException,
      )
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: pushId, tenantId: 'tenant-123' },
        relations: ['analyzedContent', 'analyzedContent.rawContent', 'analyzedContent.tags'],
      })
    })
  })

  describe('PATCH /api/radar/pushes/:id/read', () => {
    it('should mark push as read', async () => {
      const pushId = 'push-123'
      const mockPush = {
        id: pushId,
        tenantId: 'tenant-123',
        title: 'Test Push',
      }

      mockRepo.findOne.mockResolvedValue(mockPush)

      const result = await controller.markAsRead('tenant-123', pushId)

      expect(result).toEqual({
        success: true,
        message: 'Mark as read functionality will be implemented in Story 5.4',
      })
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: pushId, tenantId: 'tenant-123' },
      })
    })

    it('should throw NotFoundException if push not found', async () => {
      const pushId = 'non-existent'

      mockRepo.findOne.mockResolvedValue(null)

      await expect(controller.markAsRead('tenant-123', pushId)).rejects.toThrow(
        NotFoundException,
      )
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: pushId, tenantId: 'tenant-123' },
      })
    })
  })

  describe('Multi-tenant isolation', () => {
    it('should always filter by tenantId in getPushHistory', async () => {
      const query: QueryPushHistoryDto = { radarType: 'tech' }
      mockRepo.findAndCount.mockResolvedValue([[], 0])

      await controller.getPushHistory('tenant-456', 'org-123', query)

      const callArgs = mockRepo.findAndCount.mock.calls[0][0]
      expect(callArgs.where.tenantId).toBe('tenant-456')
    })

    it('should always filter by tenantId in getPushDetail', async () => {
      mockRepo.findOne.mockResolvedValue(null)

      await expect(controller.getPushDetail('tenant-789', 'push-123')).rejects.toThrow()

      const callArgs = mockRepo.findOne.mock.calls[0][0]
      expect(callArgs.where.tenantId).toBe('tenant-789')
    })

    it('should always filter by tenantId in markAsRead', async () => {
      mockRepo.findOne.mockResolvedValue(null)

      await expect(controller.markAsRead('tenant-999', 'push-123')).rejects.toThrow()

      const callArgs = mockRepo.findOne.mock.calls[0][0]
      expect(callArgs.where.tenantId).toBe('tenant-999')
    })
  })
})
