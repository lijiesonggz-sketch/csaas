import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository, LessThanOrEqual, Between } from 'typeorm'
import { PushSchedulerService } from './push-scheduler.service'
import { RadarPush } from '../../../database/entities/radar-push.entity'

/**
 * PushSchedulerService - Compliance Radar Tests (Story 4.2 - Phase 4.1)
 *
 * 测试合规雷达推送调度扩展功能
 * - Task 4.1.1: 频率控制（每个组织最多3条/天）
 * - Task 4.1.2: 推送统计支持合规雷达
 * - Task 4.1.3: 优先级处理（合规雷达最高优先级）
 */
describe('PushSchedulerService - Compliance Radar (Phase 4.1)', () => {
  let service: PushSchedulerService
  let radarPushRepo: Repository<RadarPush>

  // Mock合规雷达推送数据
  const mockCompliancePush: Partial<RadarPush> = {
    id: 'push-compliance-123',
    organizationId: 'org-123',
    radarType: 'compliance',
    contentId: 'content-compliance-123',
    relevanceScore: 0.98,
    priorityLevel: 'high',
    status: 'scheduled',
    scheduledAt: new Date('2026-01-30T09:00:00Z'),
    sentAt: null,
    createdAt: new Date('2026-01-30T08:00:00Z'),
    playbookStatus: 'ready',
    analyzedContent: {
      id: 'content-compliance-123',
      rawContent: {
        id: 'raw-compliance-123',
        title: '数据安全违规处罚案例',
        summary: '某银行因数据安全管理不到位被处罚',
        category: 'compliance',
      } as any,
      tags: [{ id: 'tag-1', name: '数据安全' }],
      categories: ['数据安全'],
      complianceAnalysis: {
        complianceRiskCategory: '数据安全',
        penaltyCase: '某银行因数据安全管理不到位，被处以50万元罚款',
        policyRequirements: null,
        remediationSuggestions: '建立完善的数据分类分级制度',
        relatedWeaknessCategories: ['数据安全'],
      },
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
            count: jest.fn(),
            update: jest.fn(),
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

  describe('Task 4.1.1: 频率控制 - 合规雷达每个组织最多3条/天', () => {
    it('should get pending compliance pushes', async () => {
      // Arrange
      const mockPushes = [
        { ...mockCompliancePush, id: 'push-1', priorityLevel: 'high', relevanceScore: 0.98 },
        { ...mockCompliancePush, id: 'push-2', priorityLevel: 'high', relevanceScore: 0.95 },
        { ...mockCompliancePush, id: 'push-3', priorityLevel: 'medium', relevanceScore: 0.90 },
      ] as RadarPush[]

      jest.spyOn(radarPushRepo, 'find').mockResolvedValue(mockPushes)

      // Act
      const result = await service.getPendingPushes('compliance')

      // Assert
      expect(radarPushRepo.find).toHaveBeenCalledWith({
        where: {
          radarType: 'compliance',
          status: 'scheduled',
          scheduledAt: expect.any(Object),
        },
        relations: ['analyzedContent', 'analyzedContent.rawContent', 'analyzedContent.tags', 'compliancePlaybook'],
        order: {
          priorityLevel: 'DESC',
          relevanceScore: 'DESC',
        },
      })
      expect(result).toEqual(mockPushes)
      expect(result.length).toBe(3)
    })

    it('should group compliance pushes by organization with max 3 per org', () => {
      // Arrange
      const pushes = Array.from({ length: 10 }, (_, i) => ({
        ...mockCompliancePush,
        id: `push-${i}`,
        organizationId: 'org-1',
      })) as RadarPush[]

      // Act
      const result = service.groupByOrganization(pushes, 3)

      // Assert
      expect(result.get('org-1').length).toBe(3)
    })

    it('should limit compliance pushes to 3 per organization per day', () => {
      // Arrange
      const pushes = Array.from({ length: 8 }, (_, i) => ({
        ...mockCompliancePush,
        id: `push-${i}`,
        organizationId: 'org-1',
      })) as RadarPush[]

      // Act
      const result = service.groupByOrganization(pushes, 3)

      // Assert
      expect(result.get('org-1').length).toBe(3)
      expect(result.get('org-1')[0].id).toBe('push-0')
      expect(result.get('org-1')[1].id).toBe('push-1')
      expect(result.get('org-1')[2].id).toBe('push-2')
    })

    it('should handle empty compliance pushes array', () => {
      // Arrange
      const pushes = [] as RadarPush[]

      // Act
      const result = service.groupByOrganization(pushes, 3)

      // Assert
      expect(result.size).toBe(0)
    })
  })

  describe('Task 4.1.2: 推送统计支持合规雷达', () => {
    it('should return compliance radar push statistics', async () => {
      // Arrange
      const orgId = 'org-123'
      const radarType = 'compliance'
      const startDate = new Date('2026-01-01T00:00:00Z')
      const endDate = new Date('2026-01-31T23:59:59Z')

      jest.spyOn(radarPushRepo, 'count')
        .mockResolvedValueOnce(8) // total
        .mockResolvedValueOnce(6) // sent
        .mockResolvedValueOnce(1) // failed
        .mockResolvedValueOnce(1) // pending

      // Act
      const result = await service.getPushStats(orgId, radarType, startDate, endDate)

      // Assert
      expect(result).toEqual({
        total: 8,
        sent: 6,
        failed: 1,
        pending: 1,
      })
      expect(radarPushRepo.count).toHaveBeenCalledTimes(4)
    })

    it('should use correct query conditions for compliance radar', async () => {
      // Arrange
      const orgId = 'org-123'
      const radarType = 'compliance'
      const startDate = new Date('2026-01-01T00:00:00Z')
      const endDate = new Date('2026-01-31T23:59:59Z')

      jest.spyOn(radarPushRepo, 'count').mockResolvedValue(0)

      // Act
      await service.getPushStats(orgId, radarType, startDate, endDate)

      // Assert
      expect(radarPushRepo.count).toHaveBeenNthCalledWith(1, {
        where: {
          organizationId: orgId,
          radarType: 'compliance',
          scheduledAt: expect.any(Object),
        },
      })

      expect(radarPushRepo.count).toHaveBeenNthCalledWith(2, {
        where: {
          organizationId: orgId,
          radarType: 'compliance',
          status: 'sent',
          sentAt: expect.any(Object),
        },
      })
    })

    it('should handle no compliance push records', async () => {
      // Arrange
      const orgId = 'org-123'
      const radarType = 'compliance'
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

  describe('Task 4.1.3: 优先级处理 - 合规雷达最高优先级', () => {
    it('should sort compliance pushes by priorityLevel and relevanceScore', async () => {
      // Arrange
      const mockPushes = [
        { ...mockCompliancePush, id: 'push-1', priorityLevel: 'high', relevanceScore: 0.98 },
        { ...mockCompliancePush, id: 'push-2', priorityLevel: 'high', relevanceScore: 0.95 },
        { ...mockCompliancePush, id: 'push-3', priorityLevel: 'medium', relevanceScore: 0.92 },
      ] as RadarPush[]

      jest.spyOn(radarPushRepo, 'find').mockResolvedValue(mockPushes)

      // Act
      const result = await service.getPendingPushes('compliance')

      // Assert
      expect(result[0].priorityLevel).toBe('high')
      expect(result[0].relevanceScore).toBe(0.98)
      expect(result[1].priorityLevel).toBe('high')
      expect(result[1].relevanceScore).toBe(0.95)
      expect(result[2].priorityLevel).toBe('medium')
    })

    it('should mark compliance push as sent with timestamp', async () => {
      // Arrange
      const pushId = 'push-compliance-123'
      jest.spyOn(radarPushRepo, 'update').mockResolvedValue(undefined)

      // Act
      await service.markAsSent(pushId)

      // Assert
      expect(radarPushRepo.update).toHaveBeenCalledWith(pushId, {
        status: 'sent',
        sentAt: expect.any(Date),
      })
    })

    it('should mark compliance push as failed', async () => {
      // Arrange
      const pushId = 'push-compliance-123'
      const reason = 'Playbook generation failed'
      jest.spyOn(radarPushRepo, 'update').mockResolvedValue(undefined)

      // Act
      await service.markAsFailed(pushId, reason)

      // Assert
      expect(radarPushRepo.update).toHaveBeenCalledWith(pushId, {
        status: 'failed',
      })
    })
  })

  describe('Compliance Radar Specific Behavior', () => {
    it('should handle compliance pushes with playbookStatus', async () => {
      // Arrange
      const mockPushes = [
        {
          ...mockCompliancePush,
          id: 'push-1',
          playbookStatus: 'ready',
        },
        {
          ...mockCompliancePush,
          id: 'push-2',
          playbookStatus: 'generating',
        },
        {
          ...mockCompliancePush,
          id: 'push-3',
          playbookStatus: 'failed',
        },
      ] as RadarPush[]

      jest.spyOn(radarPushRepo, 'find').mockResolvedValue(mockPushes)

      // Act
      const result = await service.getPendingPushes('compliance')

      // Assert
      expect(result.length).toBe(3)
      expect(result[0].playbookStatus).toBe('ready')
      expect(result[1].playbookStatus).toBe('generating')
      expect(result[2].playbookStatus).toBe('failed')
    })

    it('should filter compliance pushes by scheduledAt', async () => {
      // Arrange
      const now = new Date('2026-01-30T09:00:00Z')
      jest.spyOn(global, 'Date').mockImplementation(() => now as any)

      const mockPushes = [
        {
          ...mockCompliancePush,
          id: 'push-1',
          scheduledAt: new Date('2026-01-30T08:00:00Z'), // Past
        },
      ] as RadarPush[]

      jest.spyOn(radarPushRepo, 'find').mockResolvedValue(mockPushes)

      // Act
      await service.getPendingPushes('compliance')

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
  })

  describe('AC 4: 推送降级逻辑 (Story 4.2)', () => {
    describe('countTodayPushes方法', () => {
      it('should count today sent pushes for organization', async () => {
        // Arrange
        const orgId = 'org-123'
        const radarType = 'compliance'
        const today = new Date('2026-01-30T12:00:00Z')

        jest.spyOn(radarPushRepo, 'count').mockResolvedValue(2)

        // Act
        const count = await service.countTodayPushes(orgId, radarType, today)

        // Assert
        expect(radarPushRepo.count).toHaveBeenCalledWith({
          where: expect.objectContaining({
            organizationId: orgId,
            radarType: radarType,
          }),
        })
        expect(count).toBe(2)
      })

      it('should return 0 when no pushes sent today', async () => {
        // Arrange
        const orgId = 'org-123'
        const radarType = 'compliance'
        const today = new Date('2026-01-30T12:00:00Z')

        jest.spyOn(radarPushRepo, 'count').mockResolvedValue(0)

        // Act
        const count = await service.countTodayPushes(orgId, radarType, today)

        // Assert
        expect(count).toBe(0)
      })
    })

    describe('downgradeExcessPushes方法', () => {
      it('should downgrade excess pushes to tomorrow 9:00 AM', async () => {
        // Arrange
        const today = new Date('2026-01-30T12:00:00Z')
        const pushes = [
          { id: 'push-1', organizationId: 'org-123' },
          { id: 'push-2', organizationId: 'org-123' },
          { id: 'push-3', organizationId: 'org-123' },
          { id: 'push-4', organizationId: 'org-123' }, // excess
        ] as RadarPush[]

        const limit = 3
        jest.spyOn(radarPushRepo, 'update').mockResolvedValue(undefined)

        // Act
        await service.downgradeExcessPushes(pushes, limit, today)

        // Assert
        expect(radarPushRepo.update).toHaveBeenCalledTimes(1) // Only 1 excess push

        // Verify scheduledAt is set to tomorrow 9:00 AM
        const updateCall = (radarPushRepo.update as jest.Mock).mock.calls[0]
        const updateData = updateCall[1]
        const scheduledAt = updateData.scheduledAt

        expect(scheduledAt).toBeInstanceOf(Date)
        expect(scheduledAt.getDate()).toBe(31) // Next day
        expect(scheduledAt.getHours()).toBe(9) // 9 AM
        expect(scheduledAt.getMinutes()).toBe(0)
      })

      it('should not downgrade any pushes when within limit', async () => {
        // Arrange
        const today = new Date('2026-01-30T12:00:00Z')
        const pushes = [
          { id: 'push-1', organizationId: 'org-123' },
          { id: 'push-2', organizationId: 'org-123' },
        ] as RadarPush[]

        const limit = 3
        const updateSpy = jest.spyOn(radarPushRepo, 'update').mockResolvedValue(undefined)

        // Act
        await service.downgradeExcessPushes(pushes, limit, today)

        // Assert
        expect(updateSpy).not.toHaveBeenCalled() // No excess pushes to downgrade
      })

      it('should downgrade multiple excess pushes', async () => {
        // Arrange
        const today = new Date('2026-01-30T12:00:00Z')
        const pushes = [
          { id: 'push-1' },
          { id: 'push-2' },
          { id: 'push-3' },
          { id: 'push-4' }, // excess
          { id: 'push-5' }, // excess
        ] as RadarPush[]

        const limit = 3
        jest.spyOn(radarPushRepo, 'update').mockResolvedValue(undefined)

        // Act
        await service.downgradeExcessPushes(pushes, limit, today)

        // Assert
        expect(radarPushRepo.update).toHaveBeenCalledTimes(2) // 2 excess pushes
      })

      it('should handle edge case with exactly limit number of pushes', async () => {
        // Arrange
        const today = new Date('2026-01-30T12:00:00Z')
        const pushes = [
          { id: 'push-1' },
          { id: 'push-2' },
          { id: 'push-3' },
        ] as RadarPush[]

        const limit = 3
        const updateSpy = jest.spyOn(radarPushRepo, 'update').mockResolvedValue(undefined)

        // Act
        await service.downgradeExcessPushes(pushes, limit, today)

        // Assert
        expect(updateSpy).not.toHaveBeenCalled() // Exactly at limit, no downgrade
      })
    })

    describe('推送频率控制端到端测试', () => {
      it('should enforce 3 pushes per day limit for compliance radar', async () => {
        // Arrange
        const orgId = 'org-123'
        const today = new Date('2026-01-30T12:00:00Z')

        // Simulate 3 already sent pushes today
        jest.spyOn(radarPushRepo, 'count').mockResolvedValue(3)

        const pendingPushes = [
          { id: 'push-4', organizationId: orgId },
        ] as RadarPush[]

        jest.spyOn(radarPushRepo, 'update').mockResolvedValue(undefined)

        // Act
        const todayCount = await service.countTodayPushes(orgId, 'compliance', today)
        await service.downgradeExcessPushes(pendingPushes, 3 - todayCount, today)

        // Assert
        expect(todayCount).toBe(3)
        // Should downgrade because already at limit
        expect(radarPushRepo.update).toHaveBeenCalled()
      })

      it('should allow push when under daily limit', async () => {
        // Arrange
        const orgId = 'org-123'
        const today = new Date('2026-01-30T12:00:00Z')

        // Simulate only 1 sent push today
        jest.spyOn(radarPushRepo, 'count').mockResolvedValue(1)

        const pendingPushes = [
          { id: 'push-2', organizationId: orgId },
          { id: 'push-3', organizationId: orgId },
        ] as RadarPush[]

        const updateSpy = jest.spyOn(radarPushRepo, 'update').mockResolvedValue(undefined)

        // Act
        const todayCount = await service.countTodayPushes(orgId, 'compliance', today)
        await service.downgradeExcessPushes(pendingPushes, 3 - todayCount, today)

        // Assert
        expect(todayCount).toBe(1)
        // Should not downgrade because under limit (1 + 2 = 3, which is exactly the limit)
        expect(updateSpy).not.toHaveBeenCalled()
      })
    })
  })
})
