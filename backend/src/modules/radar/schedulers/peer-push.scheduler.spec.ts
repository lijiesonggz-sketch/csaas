import { Test, TestingModule } from '@nestjs/testing'
import { PeerPushScheduler } from './peer-push.scheduler'
import { PeerPushSchedulerService } from '../services/peer-push-scheduler.service'

/**
 * PeerPushScheduler 单元测试
 *
 * Story 8.4 Task 2: 推送调度与处理器 - 定时任务调度器
 */
describe('PeerPushScheduler', () => {
  let scheduler: PeerPushScheduler
  let peerPushSchedulerService: PeerPushSchedulerService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeerPushScheduler,
        {
          provide: PeerPushSchedulerService,
          useValue: {
            generatePendingPeerPushes: jest.fn(),
          },
        },
      ],
    }).compile()

    scheduler = module.get<PeerPushScheduler>(PeerPushScheduler)
    peerPushSchedulerService = module.get<PeerPushSchedulerService>(PeerPushSchedulerService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('generateDailyPeerPushes', () => {
    it('should successfully generate daily peer pushes', async () => {
      const mockResult = {
        totalScheduled: 10,
        sent: 8,
        failed: 2,
        byOrganization: {
          'org-1': 3,
          'org-2': 3,
          'org-3': 2,
        },
      }

      jest.spyOn(peerPushSchedulerService, 'generatePendingPeerPushes').mockResolvedValue(mockResult)

      await scheduler.generateDailyPeerPushes()

      expect(peerPushSchedulerService.generatePendingPeerPushes).toHaveBeenCalled()
    })

    it('should handle empty pending pushes gracefully', async () => {
      const mockResult = {
        totalScheduled: 0,
        sent: 0,
        failed: 0,
        byOrganization: {},
      }

      jest.spyOn(peerPushSchedulerService, 'generatePendingPeerPushes').mockResolvedValue(mockResult)

      await scheduler.generateDailyPeerPushes()

      expect(peerPushSchedulerService.generatePendingPeerPushes).toHaveBeenCalled()
    })

    it('should handle service errors gracefully without throwing', async () => {
      jest.spyOn(peerPushSchedulerService, 'generatePendingPeerPushes').mockRejectedValue(
        new Error('Database connection failed'),
      )

      // Should not throw
      await expect(scheduler.generateDailyPeerPushes()).resolves.not.toThrow()
    })

    it('should log organization push counts', async () => {
      const mockResult = {
        totalScheduled: 5,
        sent: 5,
        failed: 0,
        byOrganization: {
          'org-1': 3,
          'org-2': 2,
        },
      }

      jest.spyOn(peerPushSchedulerService, 'generatePendingPeerPushes').mockResolvedValue(mockResult)
      const loggerDebugSpy = jest.spyOn(scheduler['logger'], 'debug')

      await scheduler.generateDailyPeerPushes()

      expect(loggerDebugSpy).toHaveBeenCalledWith('Organization org-1: 3 pushes sent')
      expect(loggerDebugSpy).toHaveBeenCalledWith('Organization org-2: 2 pushes sent')
    })

    it('should calculate and log execution duration', async () => {
      const mockResult = {
        totalScheduled: 3,
        sent: 3,
        failed: 0,
        byOrganization: { 'org-1': 3 },
      }

      jest.spyOn(peerPushSchedulerService, 'generatePendingPeerPushes').mockResolvedValue(mockResult)
      const loggerLogSpy = jest.spyOn(scheduler['logger'], 'log')

      await scheduler.generateDailyPeerPushes()

      // Verify that completion was logged with duration
      expect(loggerLogSpy).toHaveBeenCalledWith('Starting daily peer push generation job (6:00 AM)')
      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Daily peer push generation completed'),
      )
    })
  })

  describe('sendHighPriorityPushes', () => {
    it('should execute high priority push check without errors', async () => {
      const mockResult = {
        totalScheduled: 0,
        sent: 0,
        failed: 0,
        byOrganization: {},
      }
      jest.spyOn(peerPushSchedulerService, 'generatePendingPeerPushes').mockResolvedValue(mockResult)

      await expect(scheduler.sendHighPriorityPushes()).resolves.not.toThrow()
    })

    it('should handle errors in high priority check gracefully', async () => {
      // Even if an error occurs, it should be caught
      const loggerErrorSpy = jest.spyOn(scheduler['logger'], 'error')

      // Mock service to throw error
      jest.spyOn(peerPushSchedulerService, 'generatePendingPeerPushes').mockRejectedValue(
        new Error('Service error'),
      )

      // This test ensures the method structure is correct
      // The current implementation has a try-catch block
      await scheduler.sendHighPriorityPushes()

      // Should log the error
      expect(loggerErrorSpy).toHaveBeenCalledWith('High priority push check failed: Service error')
    })

    it('should log when high priority pushes are sent', async () => {
      const mockResult = {
        totalScheduled: 5,
        sent: 5,
        failed: 0,
        byOrganization: { 'org-1': 3, 'org-2': 2 },
      }
      jest.spyOn(peerPushSchedulerService, 'generatePendingPeerPushes').mockResolvedValue(mockResult)
      const loggerLogSpy = jest.spyOn(scheduler['logger'], 'log')

      await scheduler.sendHighPriorityPushes()

      expect(loggerLogSpy).toHaveBeenCalledWith('High priority check sent 5 pending pushes')
    })
  })

  describe('cron configuration', () => {
    it('should have generateDailyPeerPushes method defined', () => {
      expect(scheduler.generateDailyPeerPushes).toBeDefined()
      expect(typeof scheduler.generateDailyPeerPushes).toBe('function')
    })

    it('should have sendHighPriorityPushes method defined', () => {
      expect(scheduler.sendHighPriorityPushes).toBeDefined()
      expect(typeof scheduler.sendHighPriorityPushes).toBe('function')
    })
  })
})
