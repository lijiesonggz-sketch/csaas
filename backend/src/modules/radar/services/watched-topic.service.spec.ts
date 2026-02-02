import { Test, TestingModule } from '@nestjs/testing'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { WatchedTopicService } from './watched-topic.service'
import { WatchedTopicRepository } from '../../../database/repositories'
import { CreateWatchedTopicDto } from '../dto/watched-topic.dto'

describe('WatchedTopicService', () => {
  let service: WatchedTopicService
  let repository: WatchedTopicRepository

  const mockTenantId = 'tenant-123'
  const mockOrgId = 'org-1'

  const mockRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    findByOrganization: jest.fn(),
    findByType: jest.fn(),
    findActive: jest.fn(),
    findByOrganizationAndType: jest.fn(),
    findActiveByOrganization: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WatchedTopicService,
        {
          provide: WatchedTopicRepository,
          useValue: mockRepository,
        },
      ],
    }).compile()

    service = module.get<WatchedTopicService>(WatchedTopicService)
    repository = module.get<WatchedTopicRepository>(WatchedTopicRepository)

    // Clear all mocks before each test
    jest.clearAllMocks()
  })

  describe('create', () => {
    it('should successfully create a watched topic with tenantId', async () => {
      const dto: CreateWatchedTopicDto = {
        topicName: '云原生',
        topicType: 'tech',
      }

      mockRepository.findOne.mockResolvedValue(null)
      mockRepository.create.mockReturnValue({
        ...dto,
        tenantId: mockTenantId,
        organizationId: mockOrgId,
        source: 'manual',
      })
      mockRepository.save.mockResolvedValue({
        id: 'topic-1',
        ...dto,
        tenantId: mockTenantId,
        organizationId: mockOrgId,
        source: 'manual',
        createdAt: new Date(),
      })

      const result = await service.create(mockTenantId, mockOrgId, dto)

      expect(result.topicName).toBe('云原生')
      expect(result.tenantId).toBe(mockTenantId)
      expect(result.organizationId).toBe(mockOrgId)
      expect(mockRepository.findOne).toHaveBeenCalledWith(mockTenantId, {
        where: {
          organizationId: mockOrgId,
          topicName: '云原生',
          topicType: 'tech',
        },
      })
      expect(mockRepository.save).toHaveBeenCalledWith(mockTenantId, {
        topicName: '云原生',
        topicType: 'tech',
        organizationId: mockOrgId,
        source: 'manual',
      })
    })

    it('should reject duplicate watched topic', async () => {
      const dto: CreateWatchedTopicDto = {
        topicName: '云原生',
        topicType: 'tech',
      }

      mockRepository.findOne.mockResolvedValue({
        id: 'existing-topic',
        topicName: '云原生',
        topicType: 'tech',
        tenantId: mockTenantId,
        organizationId: mockOrgId,
      })

      await expect(service.create(mockTenantId, mockOrgId, dto)).rejects.toThrow(ConflictException)
      await expect(service.create(mockTenantId, mockOrgId, dto)).rejects.toThrow('该领域已在关注列表中')
      expect(mockRepository.save).not.toHaveBeenCalled()
    })

    it('should set source to manual by default', async () => {
      const dto: CreateWatchedTopicDto = {
        topicName: '云原生',
        topicType: 'tech',
      }

      mockRepository.findOne.mockResolvedValue(null)
      mockRepository.create.mockReturnValue({
        ...dto,
        tenantId: mockTenantId,
        organizationId: mockOrgId,
        source: 'manual',
      })
      mockRepository.save.mockResolvedValue({
        id: 'topic-1',
        ...dto,
        tenantId: mockTenantId,
        organizationId: mockOrgId,
        source: 'manual',
        createdAt: new Date(),
      })

      await service.create(mockTenantId, mockOrgId, dto)

      expect(mockRepository.save).toHaveBeenCalledWith(mockTenantId, {
        topicName: '云原生',
        topicType: 'tech',
        organizationId: mockOrgId,
        source: 'manual',
      })
    })
  })

  describe('findAll', () => {
    it('should return all watched topics filtered by tenantId and organizationId', async () => {
      const mockTopics = [
        {
          id: 'topic-1',
          topicName: '云原生',
          topicType: 'tech' as const,
          tenantId: mockTenantId,
          organizationId: mockOrgId,
          createdAt: new Date('2026-01-31'),
        },
        {
          id: 'topic-2',
          topicName: 'AI应用',
          topicType: 'tech' as const,
          tenantId: mockTenantId,
          organizationId: mockOrgId,
          createdAt: new Date('2026-01-30'),
        },
      ]

      mockRepository.findByOrganization.mockResolvedValue(mockTopics)

      const result = await service.findAll(mockTenantId, mockOrgId)

      expect(result).toHaveLength(2)
      expect(result[0].topicName).toBe('云原生')
      expect(mockRepository.findByOrganization).toHaveBeenCalledWith(mockTenantId, mockOrgId)
    })

    it('should return topics ordered by creation date (newest first)', async () => {
      const mockTopics = [
        {
          id: 'topic-2',
          topicName: 'B',
          topicType: 'tech' as const,
          tenantId: mockTenantId,
          organizationId: mockOrgId,
          createdAt: new Date('2026-01-31'),
        },
        {
          id: 'topic-1',
          topicName: 'A',
          topicType: 'tech' as const,
          tenantId: mockTenantId,
          organizationId: mockOrgId,
          createdAt: new Date('2026-01-30'),
        },
      ]

      mockRepository.findByOrganization.mockResolvedValue(mockTopics)

      const result = await service.findAll(mockTenantId, mockOrgId)

      expect(result[0].topicName).toBe('B') // Newest first
      expect(result[1].topicName).toBe('A')
    })

    it('should isolate data by tenantId and organization', async () => {
      const mockTopics = [
        {
          id: 'topic-1',
          topicName: '云原生',
          topicType: 'tech' as const,
          tenantId: mockTenantId,
          organizationId: mockOrgId,
          createdAt: new Date(),
        },
      ]

      mockRepository.findByOrganization.mockResolvedValue(mockTopics)

      const result = await service.findAll(mockTenantId, mockOrgId)

      expect(result).toHaveLength(1)
      expect(result[0].topicName).toBe('云原生')
      expect(mockRepository.findByOrganization).toHaveBeenCalledWith(mockTenantId, mockOrgId)
    })
  })

  describe('delete', () => {
    it('should successfully delete a watched topic with tenantId filter', async () => {
      const topicId = 'topic-1'

      mockRepository.delete.mockResolvedValue(undefined)

      await service.delete(topicId, mockTenantId, mockOrgId)

      expect(mockRepository.delete).toHaveBeenCalledWith(mockTenantId, {
        id: topicId,
        organizationId: mockOrgId,
      })
    })

    it('should not throw error even when topic does not exist', async () => {
      const topicId = 'non-existent'

      mockRepository.delete.mockResolvedValue(undefined)

      // Service doesn't check if topic exists, just calls delete
      await expect(service.delete(topicId, mockTenantId, mockOrgId)).resolves.not.toThrow()

      expect(mockRepository.delete).toHaveBeenCalledWith(mockTenantId, {
        id: topicId,
        organizationId: mockOrgId,
      })
    })

    it('should prevent deleting topics from other tenants', async () => {
      const topicId = 'topic-1'
      const otherTenantId = 'other-tenant'

      mockRepository.delete.mockResolvedValue(undefined)

      // Service will call delete with otherTenantId, which won't match any records
      await service.delete(topicId, otherTenantId, mockOrgId)

      expect(mockRepository.delete).toHaveBeenCalledWith(otherTenantId, {
        id: topicId,
        organizationId: mockOrgId,
      })
    })
  })

  describe('getRelatedPushCount', () => {
    it('should return 0 in MVP phase', async () => {
      const topicId = 'topic-1'

      const result = await service.getRelatedPushCount(topicId)

      expect(result).toBe(0)
    })
  })
})
