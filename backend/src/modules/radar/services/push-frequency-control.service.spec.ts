import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PushFrequencyControlService } from './push-frequency-control.service'
import { RadarPush } from '../../../database/entities/radar-push.entity'

/**
 * PushFrequencyControlService 单元测试
 *
 * Story 2.3 Task 4.1b: PushFrequencyControlService 单元测试
 *
 * 测试场景：
 * 1. 去重检查正确工作
 * 2. 频率限制正确工作
 * 3. 强制插入逻辑正确
 * 4. 推送统计功能正确
 */
describe('PushFrequencyControlService', () => {
  let service: PushFrequencyControlService
  let radarPushRepo: Repository<RadarPush>

  const mockScheduledAt = new Date('2026-01-31T17:00:00Z')

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushFrequencyControlService,
        {
          provide: getRepositoryToken(RadarPush),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<PushFrequencyControlService>(PushFrequencyControlService)
    radarPushRepo = module.get<Repository<RadarPush>>(getRepositoryToken(RadarPush))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('checkPushAllowed', () => {
    it('应该允许创建推送（无重复，未达限制）', async () => {
      // Arrange
      jest.spyOn(radarPushRepo, 'findOne').mockResolvedValue(null) // 无重复
      jest.spyOn(radarPushRepo, 'count').mockResolvedValue(3) // 仅3条

      // Act
      const result = await service.checkPushAllowed('org-123', 'content-123', mockScheduledAt)

      // Assert
      expect(result.allowed).toBe(true)
      expect(result.reason).toBeUndefined()
      expect(result.lowestPush).toBeUndefined()
    })

    it('应该拒绝重复推送（同一contentId）', async () => {
      // Arrange
      jest.spyOn(radarPushRepo, 'findOne').mockResolvedValue({
        id: 'existing-push',
        contentId: 'content-123',
      } as RadarPush)

      // Act
      const result = await service.checkPushAllowed('org-123', 'content-123', mockScheduledAt)

      // Assert
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Duplicate push')
    })

    it('应该拒绝推送（已达5条限制）', async () => {
      // Arrange
      jest.spyOn(radarPushRepo, 'findOne')
        .mockResolvedValueOnce(null) // 去重检查通过
        .mockResolvedValueOnce({
          // 返回最低分推送
          id: 'lowest-push',
          relevanceScore: 0.9,
        } as RadarPush)

      jest.spyOn(radarPushRepo, 'count').mockResolvedValue(5) // 已达5条

      // Act
      const result = await service.checkPushAllowed('org-123', 'content-123', mockScheduledAt)

      // Assert
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Push limit reached')
      expect(result.lowestPush).toBeDefined()
      expect(result.lowestPush.relevanceScore).toBe(0.9)
    })
  })

  describe('forceInsertPush', () => {
    it('应该删除最低分推送并插入新推送', async () => {
      // Arrange
      const lowestPush = {
        id: 'lowest-push',
        relevanceScore: 0.9,
      } as RadarPush

      const newPush = {
        organizationId: 'org-123',
        contentId: 'content-123',
        relevanceScore: 0.95,
        status: 'scheduled',
      } as Partial<RadarPush>

      jest.spyOn(radarPushRepo, 'findOne').mockResolvedValue(lowestPush)
      jest.spyOn(radarPushRepo, 'delete').mockResolvedValue(undefined)
      jest.spyOn(radarPushRepo, 'save').mockResolvedValue(newPush as RadarPush)

      // Act
      const result = await service.forceInsertPush('org-123', mockScheduledAt, newPush)

      // Assert
      expect(radarPushRepo.delete).toHaveBeenCalledWith('lowest-push')
      expect(radarPushRepo.save).toHaveBeenCalledWith(newPush)
      expect(result.relevanceScore).toBe(0.95)
    })
  })

  describe('getPushStats', () => {
    it('应该返回正确的推送统计', async () => {
      // Arrange
      jest.spyOn(radarPushRepo, 'count')
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(5) // scheduled
        .mockResolvedValueOnce(4) // sent
        .mockResolvedValueOnce(1) // failed

      // Act
      const stats = await service.getPushStats('org-123', mockScheduledAt)

      // Assert
      expect(stats).toEqual({
        total: 10,
        scheduled: 5,
        sent: 4,
        failed: 1,
      })
    })
  })
})
