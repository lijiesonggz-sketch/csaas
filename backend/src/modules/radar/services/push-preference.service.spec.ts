import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { BadRequestException } from '@nestjs/common'

import { PushPreferenceService } from './push-preference.service'
import { PushPreference } from '../../../database/entities/push-preference.entity'

// Mock repository
const mockPushPreferenceRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
})

describe('PushPreferenceService', () => {
  let service: PushPreferenceService
  let repo: jest.Mocked<Repository<PushPreference>>

  const mockTenantId = 'tenant-123'
  const mockOrgId = 'org-123'
  const mockPreference: Partial<PushPreference> = {
    id: 'pref-123',
    tenantId: mockTenantId,
    organizationId: mockOrgId,
    pushStartTime: '09:00',
    pushEndTime: '18:00',
    dailyPushLimit: 5,
    relevanceFilter: 'high_only',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushPreferenceService,
        {
          provide: getRepositoryToken(PushPreference),
          useFactory: mockPushPreferenceRepo,
        },
      ],
    }).compile()

    service = module.get<PushPreferenceService>(PushPreferenceService)
    repo = module.get(getRepositoryToken(PushPreference))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getOrCreatePreference', () => {
    it('应该返回已存在的配置', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(mockPreference as PushPreference)

      // Act
      const result = await service.getOrCreatePreference(mockTenantId, mockOrgId)

      // Assert
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { tenantId: mockTenantId, organizationId: mockOrgId },
      })
      expect(repo.create).not.toHaveBeenCalled()
      expect(result.organizationId).toBe(mockOrgId)
      expect(result.pushStartTime).toBe('09:00')
      expect(result.dailyPushLimit).toBe(5)
    })

    it('应该为不存在的组织创建默认配置', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(null)
      repo.create.mockReturnValue(mockPreference as PushPreference)
      repo.save.mockResolvedValue(mockPreference as PushPreference)

      // Act
      const result = await service.getOrCreatePreference(mockTenantId, mockOrgId)

      // Assert
      expect(repo.create).toHaveBeenCalledWith({
        tenantId: mockTenantId,
        organizationId: mockOrgId,
        pushStartTime: '09:00',
        pushEndTime: '18:00',
        dailyPushLimit: 5,
        relevanceFilter: 'high_only',
      })
      expect(repo.save).toHaveBeenCalled()
      expect(result.pushStartTime).toBe('09:00')
      expect(result.dailyPushLimit).toBe(5)
    })
  })

  describe('updatePreference', () => {
    it('应该成功更新推送时段', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(mockPreference as PushPreference)
      repo.save.mockResolvedValue({
        ...mockPreference,
        pushStartTime: '10:00',
        pushEndTime: '20:00',
      } as PushPreference)

      // Act
      const result = await service.updatePreference(mockTenantId, mockOrgId, {
        pushStartTime: '10:00',
        pushEndTime: '20:00',
      })

      // Assert
      expect(result.pushStartTime).toBe('10:00')
      expect(result.pushEndTime).toBe('20:00')
    })

    it('应该拒绝相同的开始和结束时间', async () => {
      // Act & Assert - 相同时间应该被拒绝
      await expect(
        service.updatePreference(mockTenantId, mockOrgId, {
          pushStartTime: '09:00',
          pushEndTime: '09:00',
        }),
      ).rejects.toThrow('开始时间必须早于结束时间')
    })

    it('应该验证时段跨度至少1小时', async () => {
      // Act & Assert
      await expect(
        service.updatePreference(mockTenantId, mockOrgId, {
          pushStartTime: '09:00',
          pushEndTime: '09:30',
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('应该正确处理跨午夜时段', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(mockPreference as PushPreference)
      repo.save.mockResolvedValue({
        ...mockPreference,
        pushStartTime: '22:00',
        pushEndTime: '08:00',
      } as PushPreference)

      // Act
      const result = await service.updatePreference(mockTenantId, mockOrgId, {
        pushStartTime: '22:00',
        pushEndTime: '08:00',
      })

      // Assert - 跨午夜时段应该被接受（22:00到次日08:00 = 10小时）
      expect(result.pushStartTime).toBe('22:00')
      expect(result.pushEndTime).toBe('08:00')
    })

    it('应该成功更新推送上限', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(mockPreference as PushPreference)
      repo.save.mockResolvedValue({
        ...mockPreference,
        dailyPushLimit: 10,
      } as PushPreference)

      // Act
      const result = await service.updatePreference(mockTenantId, mockOrgId, {
        dailyPushLimit: 10,
      })

      // Assert
      expect(result.dailyPushLimit).toBe(10)
    })

    it('应该成功更新相关性过滤', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(mockPreference as PushPreference)
      repo.save.mockResolvedValue({
        ...mockPreference,
        relevanceFilter: 'high_medium',
      } as PushPreference)

      // Act
      const result = await service.updatePreference(mockTenantId, mockOrgId, {
        relevanceFilter: 'high_medium',
      })

      // Assert
      expect(result.relevanceFilter).toBe('high_medium')
    })

    it('应该隔离不同租户和组织的配置', async () => {
      // Arrange
      const tenant1Org1Preference = { ...mockPreference, tenantId: 'tenant-1', organizationId: 'org-1' }
      const tenant1Org2Preference = { ...mockPreference, tenantId: 'tenant-1', organizationId: 'org-2', dailyPushLimit: 10 }

      repo.findOne
        .mockResolvedValueOnce(tenant1Org1Preference as PushPreference)
        .mockResolvedValueOnce(tenant1Org2Preference as PushPreference)

      // Act
      const result1 = await service.getOrCreatePreference('tenant-1', 'org-1')
      const result2 = await service.getOrCreatePreference('tenant-1', 'org-2')

      // Assert
      expect(result1.organizationId).toBe('org-1')
      expect(result2.organizationId).toBe('org-2')
      expect(result2.dailyPushLimit).toBe(10)
    })
  })

  describe('validateTimeRange', () => {
    it('应该接受正常时段（09:00-18:00）', () => {
      expect(() => {
        service.validateTimeRange('09:00', '18:00')
      }).not.toThrow()
    })

    it('应该接受跨午夜时段（22:00-08:00）', () => {
      expect(() => {
        service.validateTimeRange('22:00', '08:00')
      }).not.toThrow()
    })

    it('应该拒绝相同开始和结束时间', () => {
      expect(() => {
        service.validateTimeRange('09:00', '09:00')
      }).toThrow(BadRequestException)
    })

    it('应该拒绝小于1小时的时段跨度', () => {
      expect(() => {
        service.validateTimeRange('09:00', '09:30')
      }).toThrow('时段跨度至少 1 小时')
    })

    it('应该接受正好1小时的时段跨度', () => {
      expect(() => {
        service.validateTimeRange('09:00', '10:00')
      }).not.toThrow()
    })
  })
})
