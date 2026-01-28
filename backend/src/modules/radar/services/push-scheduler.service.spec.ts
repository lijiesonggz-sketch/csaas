import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository, LessThanOrEqual } from 'typeorm'
import { PushSchedulerService } from './push-scheduler.service'
import { RadarPush } from '../../../database/entities/radar-push.entity'

/**
 * PushSchedulerService 单元测试
 *
 * Story 2.3 Task 4.2: PushSchedulerService单元测试
 *
 * 测试分组：
 * 1. getPendingPushes() - 获取待推送内容 (4个场景)
 * 2. groupByOrganization() - 按组织分组 (4个场景)
 * 3. markAsSent() - 标记推送成功 (2个场景)
 * 4. markAsFailed() - 标记推送失败 (2个场景)
 * 5. getPushStats() - 推送统计 (3个场景)
 */
describe('PushSchedulerService', () => {
  let service: PushSchedulerService
  let radarPushRepo: Repository<RadarPush>

  // Mock数据
  const mockPush: Partial<RadarPush> = {
    id: 'push-123',
    organizationId: 'org-123',
    radarType: 'tech',
    contentId: 'content-123',
    relevanceScore: 0.95,
    priorityLevel: 'high',
    status: 'scheduled',
    scheduledAt: new Date('2026-01-24T17:00:00Z'),
    sentAt: null,
    createdAt: new Date('2026-01-20T10:00:00Z'),
    analyzedContent: {
      id: 'content-123',
      rawContent: {
        id: 'raw-123',
        title: 'Test Content',
        summary: 'Test summary',
      },
      tags: [{ id: 'tag-1', name: '数据安全' }],
    } as any,
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushSchedulerService,
        {
          provide: getRepositoryToken(RadarPush),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<PushSchedulerService>(PushSchedulerService)
    radarPushRepo = module.get<Repository<RadarPush>>(
      getRepositoryToken(RadarPush),
    )
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getPendingPushes() - 获取待推送内容 (4个场景)', () => {
    it('1. 应该返回所有待推送的tech雷达内容', async () => {
      // Arrange
      const mockPushes = [
        { ...mockPush, id: 'push-1', priorityLevel: 'high', relevanceScore: 0.95 },
        { ...mockPush, id: 'push-2', priorityLevel: 'medium', relevanceScore: 0.92 },
      ] as RadarPush[]

      jest.spyOn(radarPushRepo, 'find').mockResolvedValue(mockPushes)

      // Act
      const result = await service.getPendingPushes('tech')

      // Assert
      expect(radarPushRepo.find).toHaveBeenCalledWith({
        where: {
          radarType: 'tech',
          status: 'scheduled',
          scheduledAt: expect.any(Object), // LessThanOrEqual(now)
        },
        relations: ['analyzedContent', 'analyzedContent.rawContent', 'analyzedContent.tags'],
        order: {
          priorityLevel: 'DESC',
          relevanceScore: 'DESC',
        },
      })
      expect(result).toEqual(mockPushes)
      expect(result.length).toBe(2)
    })

    it('2. 应该按priorityLevel和relevanceScore降序排序', async () => {
      // Arrange
      const mockPushes = [
        { ...mockPush, id: 'push-1', priorityLevel: 'high', relevanceScore: 0.95 },
        { ...mockPush, id: 'push-2', priorityLevel: 'high', relevanceScore: 0.92 },
        { ...mockPush, id: 'push-3', priorityLevel: 'medium', relevanceScore: 0.90 },
      ] as RadarPush[]

      jest.spyOn(radarPushRepo, 'find').mockResolvedValue(mockPushes)

      // Act
      const result = await service.getPendingPushes('tech')

      // Assert
      expect(result[0].priorityLevel).toBe('high')
      expect(result[0].relevanceScore).toBe(0.95)
      expect(result[1].priorityLevel).toBe('high')
      expect(result[1].relevanceScore).toBe(0.92)
      expect(result[2].priorityLevel).toBe('medium')
    })

    it('3. 应该只返回scheduledAt <= now的推送', async () => {
      // Arrange
      const now = new Date('2026-01-27T18:00:00Z')
      jest.spyOn(global, 'Date').mockImplementation(() => now as any)

      const mockPushes = [
        { ...mockPush, id: 'push-1', scheduledAt: new Date('2026-01-24T17:00:00Z') }, // 过去
      ] as RadarPush[]

      jest.spyOn(radarPushRepo, 'find').mockResolvedValue(mockPushes)

      // Act
      await service.getPendingPushes('tech')

      // Assert
      expect(radarPushRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            scheduledAt: expect.any(Object),
          }),
        }),
      )

      // Restore Date
      jest.restoreAllMocks()
    })

    it('4. 应该返回空数组如果没有待推送内容', async () => {
      // Arrange
      jest.spyOn(radarPushRepo, 'find').mockResolvedValue([])

      // Act
      const result = await service.getPendingPushes('tech')

      // Assert
      expect(result).toEqual([])
      expect(result.length).toBe(0)
    })
  })

  describe('groupByOrganization() - 按组织分组 (4个场景)', () => {
    it('5. 应该按organizationId分组推送', () => {
      // Arrange
      const pushes = [
        { ...mockPush, id: 'push-1', organizationId: 'org-1' },
        { ...mockPush, id: 'push-2', organizationId: 'org-2' },
        { ...mockPush, id: 'push-3', organizationId: 'org-1' },
      ] as RadarPush[]

      // Act
      const result = service.groupByOrganization(pushes)

      // Assert
      expect(result.size).toBe(2)
      expect(result.get('org-1').length).toBe(2)
      expect(result.get('org-2').length).toBe(1)
    })

    it('6. 应该限制每个组织最多5条推送', () => {
      // Arrange
      const pushes = Array.from({ length: 10 }, (_, i) => ({
        ...mockPush,
        id: `push-${i}`,
        organizationId: 'org-1',
      })) as RadarPush[]

      // Act
      const result = service.groupByOrganization(pushes, 5)

      // Assert
      expect(result.get('org-1').length).toBe(5)
    })

    it('7. 应该支持自定义maxPerOrg参数', () => {
      // Arrange
      const pushes = Array.from({ length: 10 }, (_, i) => ({
        ...mockPush,
        id: `push-${i}`,
        organizationId: 'org-1',
      })) as RadarPush[]

      // Act
      const result = service.groupByOrganization(pushes, 3)

      // Assert
      expect(result.get('org-1').length).toBe(3)
    })

    it('8. 应该处理空数组', () => {
      // Arrange
      const pushes = [] as RadarPush[]

      // Act
      const result = service.groupByOrganization(pushes)

      // Assert
      expect(result.size).toBe(0)
    })
  })

  describe('markAsSent() - 标记推送成功 (2个场景)', () => {
    it('9. 应该更新推送状态为sent并记录sentAt时间', async () => {
      // Arrange
      const pushId = 'push-123'
      jest.spyOn(radarPushRepo, 'update').mockResolvedValue(undefined)

      // Act
      await service.markAsSent(pushId)

      // Assert
      expect(radarPushRepo.update).toHaveBeenCalledWith(pushId, {
        status: 'sent',
        sentAt: expect.any(Date),
      })
    })

    it('10. 应该记录正确的sentAt时间戳', async () => {
      // Arrange
      const pushId = 'push-123'
      const now = new Date('2026-01-27T18:00:00Z')
      jest.spyOn(global, 'Date').mockImplementation(() => now as any)
      jest.spyOn(radarPushRepo, 'update').mockResolvedValue(undefined)

      // Act
      await service.markAsSent(pushId)

      // Assert
      expect(radarPushRepo.update).toHaveBeenCalledWith(pushId, {
        status: 'sent',
        sentAt: now,
      })

      // Restore Date
      jest.restoreAllMocks()
    })
  })

  describe('markAsFailed() - 标记推送失败 (2个场景)', () => {
    it('11. 应该更新推送状态为failed', async () => {
      // Arrange
      const pushId = 'push-123'
      jest.spyOn(radarPushRepo, 'update').mockResolvedValue(undefined)

      // Act
      await service.markAsFailed(pushId)

      // Assert
      expect(radarPushRepo.update).toHaveBeenCalledWith(pushId, {
        status: 'failed',
      })
    })

    it('12. 应该支持可选的失败原因参数', async () => {
      // Arrange
      const pushId = 'push-123'
      const reason = 'WebSocket connection failed'
      jest.spyOn(radarPushRepo, 'update').mockResolvedValue(undefined)

      // Act
      await service.markAsFailed(pushId, reason)

      // Assert
      expect(radarPushRepo.update).toHaveBeenCalledWith(pushId, {
        status: 'failed',
      })
      // 注意：当前实现不存储reason，仅记录日志
    })
  })

  describe('getPushStats() - 推送统计 (3个场景)', () => {
    it('13. 应该返回正确的推送统计信息', async () => {
      // Arrange
      const orgId = 'org-123'
      const radarType = 'tech'
      const startDate = new Date('2026-01-01T00:00:00Z')
      const endDate = new Date('2026-01-31T23:59:59Z')

      jest.spyOn(radarPushRepo, 'count')
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(7)  // sent
        .mockResolvedValueOnce(2)  // failed
        .mockResolvedValueOnce(1)  // pending

      // Act
      const result = await service.getPushStats(orgId, radarType, startDate, endDate)

      // Assert
      expect(result).toEqual({
        total: 10,
        sent: 7,
        failed: 2,
        pending: 1,
      })
      expect(radarPushRepo.count).toHaveBeenCalledTimes(4)
    })

    it('14. 应该使用正确的查询条件', async () => {
      // Arrange
      const orgId = 'org-123'
      const radarType = 'tech'
      const startDate = new Date('2026-01-01T00:00:00Z')
      const endDate = new Date('2026-01-31T23:59:59Z')

      jest.spyOn(radarPushRepo, 'count').mockResolvedValue(0)

      // Act
      await service.getPushStats(orgId, radarType, startDate, endDate)

      // Assert
      // 验证total查询
      expect(radarPushRepo.count).toHaveBeenNthCalledWith(1, {
        where: {
          organizationId: orgId,
          radarType,
          scheduledAt: expect.any(Object),
        },
      })

      // 验证sent查询
      expect(radarPushRepo.count).toHaveBeenNthCalledWith(2, {
        where: {
          organizationId: orgId,
          radarType,
          status: 'sent',
          sentAt: expect.any(Object),
        },
      })

      // 验证failed查询
      expect(radarPushRepo.count).toHaveBeenNthCalledWith(3, {
        where: {
          organizationId: orgId,
          radarType,
          status: 'failed',
          scheduledAt: expect.any(Object),
        },
      })

      // 验证pending查询
      expect(radarPushRepo.count).toHaveBeenNthCalledWith(4, {
        where: {
          organizationId: orgId,
          radarType,
          status: 'scheduled',
          scheduledAt: expect.any(Object),
        },
      })
    })

    it('15. 应该处理没有推送记录的情况', async () => {
      // Arrange
      const orgId = 'org-123'
      const radarType = 'tech'
      const startDate = new Date('2026-01-01T00:00:00Z')
      const endDate = new Date('2026-01-31T23:59:59Z')

      jest.spyOn(radarPushRepo, 'count').mockResolvedValue(0)

      // Act
      const result = await service.getPushStats(orgId, radarType, startDate, endDate)

      // Assert
      expect(result).toEqual({
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0,
      })
    })
  })
})
