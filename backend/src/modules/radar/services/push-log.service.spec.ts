import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PushLogService } from './push-log.service'
import { PushLog } from '../../../database/entities/push-log.entity'
import { RadarPush } from '../../../database/entities/radar-push.entity'

describe('PushLogService - Story 3.2 Task 3.3', () => {
  let service: PushLogService
  let pushLogRepo: Repository<PushLog>
  let radarPushRepo: Repository<RadarPush>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushLogService,
        {
          provide: getRepositoryToken(PushLog),
          useValue: {
            save: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RadarPush),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<PushLogService>(PushLogService)
    pushLogRepo = module.get<Repository<PushLog>>(getRepositoryToken(PushLog))
    radarPushRepo = module.get<Repository<RadarPush>>(getRepositoryToken(RadarPush))
  })

  describe('logSuccess', () => {
    it('should create success log for push', async () => {
      // Arrange
      const pushId = 'push-123'
      const mockLog = {
        id: 'log-1',
        pushId,
        status: 'success',
        errorMessage: null,
        retryCount: 0,
      } as PushLog

      jest.spyOn(pushLogRepo, 'save').mockResolvedValue(mockLog)

      // Act
      await service.logSuccess(pushId)

      // Assert
      expect(pushLogRepo.save).toHaveBeenCalledWith({
        pushId,
        status: 'success',
        errorMessage: null,
        retryCount: 0,
      })
    })
  })

  describe('logFailure', () => {
    it('should create failed log with error message', async () => {
      // Arrange
      const pushId = 'push-123'
      const errorMessage = 'WebSocket connection failed'
      const mockLog = {
        id: 'log-1',
        pushId,
        status: 'failed',
        errorMessage,
        retryCount: 0,
      } as PushLog

      jest.spyOn(pushLogRepo, 'save').mockResolvedValue(mockLog)

      // Act
      await service.logFailure(pushId, errorMessage)

      // Assert
      expect(pushLogRepo.save).toHaveBeenCalledWith({
        pushId,
        status: 'failed',
        errorMessage,
        retryCount: 0,
      })
    })

    it('should handle retry count in failed log', async () => {
      // Arrange
      const pushId = 'push-123'
      const errorMessage = 'Retry failed'
      const retryCount = 1

      jest.spyOn(pushLogRepo, 'save').mockResolvedValue({} as PushLog)

      // Act
      await service.logFailure(pushId, errorMessage, retryCount)

      // Assert
      expect(pushLogRepo.save).toHaveBeenCalledWith({
        pushId,
        status: 'failed',
        errorMessage,
        retryCount,
      })
    })
  })

  describe('calculateSuccessRate', () => {
    it('should calculate success rate correctly', async () => {
      // Arrange: 100个推送，98个成功，2个失败
      // Mock query builder
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ push_id: 'push-1' }, { push_id: 'push-2' }]),
      }
      jest.spyOn(radarPushRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      jest.spyOn(pushLogRepo, 'count').mockImplementation(async (options: any) => {
        if (options.where.status === 'success') {
          return 98
        }
        return 100 // 总数
      })

      // Act
      const successRate = await service.calculateSuccessRate('org-1', 'industry')

      // Assert
      expect(successRate).toBe(0.98) // 98%
    })

    it('should return 1.0 when all pushes succeed', async () => {
      // Arrange: 100个推送，全部成功
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ push_id: 'push-1' }]),
      }
      jest.spyOn(radarPushRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      jest.spyOn(pushLogRepo, 'count').mockImplementation(async (options: any) => {
        if (options.where.status === 'success') {
          return 100
        }
        return 100
      })

      // Act
      const successRate = await service.calculateSuccessRate('org-1', 'tech')

      // Assert
      expect(successRate).toBe(1.0) // 100%
    })

    it('should return 0 when no pushes exist', async () => {
      // Arrange: 没有推送记录
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      }
      jest.spyOn(radarPushRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      jest.spyOn(pushLogRepo, 'count').mockResolvedValue(0)

      // Act
      const successRate = await service.calculateSuccessRate('org-1', 'compliance')

      // Assert
      expect(successRate).toBe(0)
    })

    it('should meet 98% success rate requirement', async () => {
      // Arrange: 边界情况 - 正好98%
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ push_id: 'push-1' }]),
      }
      jest.spyOn(radarPushRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      jest.spyOn(pushLogRepo, 'count').mockImplementation(async (options: any) => {
        if (options.where.status === 'success') {
          return 98
        }
        return 100
      })

      // Act
      const successRate = await service.calculateSuccessRate('org-1', 'industry')

      // Assert: AC 5要求成功率≥98%
      expect(successRate).toBeGreaterThanOrEqual(0.98)
    })
  })
})
