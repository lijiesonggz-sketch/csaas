import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PushSchedulerService } from './push-scheduler.service'
import { RadarPush } from '../../../database/entities/radar-push.entity'

describe('PushSchedulerService - Industry Radar (Story 3.2 Task 2.3)', () => {
  let service: PushSchedulerService
  let radarPushRepo: Repository<RadarPush>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushSchedulerService,
        {
          provide: getRepositoryToken(RadarPush),
          useValue: {
            find: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<PushSchedulerService>(PushSchedulerService)
    radarPushRepo = module.get<Repository<RadarPush>>(getRepositoryToken(RadarPush))
  })

  describe('groupByOrganization - Industry Radar Limits', () => {
    it('should limit industry radar pushes to 2 per organization', () => {
      // Arrange: 创建3条同一组织的行业雷达推送
      const pushes = [
        {
          id: 'push-1',
          organizationId: 'org-1',
          radarType: 'industry',
          relevanceScore: 0.95,
          priorityLevel: 'high',
        },
        {
          id: 'push-2',
          organizationId: 'org-1',
          radarType: 'industry',
          relevanceScore: 0.90,
          priorityLevel: 'high',
        },
        {
          id: 'push-3',
          organizationId: 'org-1',
          radarType: 'industry',
          relevanceScore: 0.85,
          priorityLevel: 'medium',
        },
      ] as RadarPush[]

      // Act: 按组织分组，行业雷达最多2条
      const grouped = service.groupByOrganization(pushes, 2)

      // Assert: 验证每个组织最多2条
      expect(grouped.size).toBe(1)
      expect(grouped.get('org-1')).toHaveLength(2)
      expect(grouped.get('org-1')[0].id).toBe('push-1') // 最高优先级
      expect(grouped.get('org-1')[1].id).toBe('push-2') // 第二高优先级
    })

    it('should handle multiple organizations with 2 pushes limit', () => {
      // Arrange: 多个组织，每个组织3条推送
      const pushes = [
        { id: 'push-1', organizationId: 'org-1', radarType: 'industry', relevanceScore: 0.95 },
        { id: 'push-2', organizationId: 'org-1', radarType: 'industry', relevanceScore: 0.90 },
        { id: 'push-3', organizationId: 'org-1', radarType: 'industry', relevanceScore: 0.85 },
        { id: 'push-4', organizationId: 'org-2', radarType: 'industry', relevanceScore: 0.92 },
        { id: 'push-5', organizationId: 'org-2', radarType: 'industry', relevanceScore: 0.88 },
        { id: 'push-6', organizationId: 'org-2', radarType: 'industry', relevanceScore: 0.80 },
      ] as RadarPush[]

      // Act
      const grouped = service.groupByOrganization(pushes, 2)

      // Assert
      expect(grouped.size).toBe(2)
      expect(grouped.get('org-1')).toHaveLength(2)
      expect(grouped.get('org-2')).toHaveLength(2)
    })

    it('should allow less than 2 pushes if organization has fewer', () => {
      // Arrange: 组织只有1条推送
      const pushes = [
        { id: 'push-1', organizationId: 'org-1', radarType: 'industry', relevanceScore: 0.95 },
      ] as RadarPush[]

      // Act
      const grouped = service.groupByOrganization(pushes, 2)

      // Assert
      expect(grouped.size).toBe(1)
      expect(grouped.get('org-1')).toHaveLength(1)
    })
  })

  describe('getPendingPushes - Industry Radar', () => {
    it('should fetch pending industry radar pushes', async () => {
      // Arrange
      const mockPushes = [
        {
          id: 'push-1',
          radarType: 'industry',
          status: 'scheduled',
          scheduledAt: new Date('2026-01-29T08:00:00Z'),
          relevanceScore: 0.95,
          priorityLevel: 'high',
        },
      ] as RadarPush[]

      jest.spyOn(radarPushRepo, 'find').mockResolvedValue(mockPushes)

      // Act
      const result = await service.getPendingPushes('industry')

      // Assert
      expect(result).toEqual(mockPushes)
      expect(radarPushRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            radarType: 'industry',
            status: 'scheduled',
          }),
        }),
      )
    })
  })
})
