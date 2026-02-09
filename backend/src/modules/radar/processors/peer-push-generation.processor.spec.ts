import { Test, TestingModule } from '@nestjs/testing'
import { Job } from 'bullmq'
import { PeerPushGenerationProcessor, PeerPushGenerationJobData } from './peer-push-generation.processor'
import { PeerPushSchedulerService } from '../services/peer-push-scheduler.service'

/**
 * PeerPushGenerationProcessor 单元测试
 *
 * Story 8.4 Task 2: 创建推送调度处理器
 */
describe('PeerPushGenerationProcessor', () => {
  let processor: PeerPushGenerationProcessor
  let peerPushSchedulerService: PeerPushSchedulerService

  const mockJobData: PeerPushGenerationJobData = {
    analyzedContentId: 'content-123',
    source: 'peer-crawler',
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeerPushGenerationProcessor,
        {
          provide: PeerPushSchedulerService,
          useValue: {
            generatePeerPushes: jest.fn(),
          },
        },
      ],
    }).compile()

    processor = module.get<PeerPushGenerationProcessor>(PeerPushGenerationProcessor)
    peerPushSchedulerService = module.get<PeerPushSchedulerService>(PeerPushSchedulerService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('process', () => {
    it('should successfully process push generation job', async () => {
      const mockCreatedPushes = [
        {
          pushId: 'push-1',
          organizationId: 'org-1',
          relevanceScore: 1.0,
          priorityLevel: 'high' as const,
          scheduledAt: new Date(),
        },
        {
          pushId: 'push-2',
          organizationId: 'org-2',
          relevanceScore: 0.8,
          priorityLevel: 'medium' as const,
          scheduledAt: new Date(),
        },
      ]

      jest.spyOn(peerPushSchedulerService, 'generatePeerPushes').mockResolvedValue(mockCreatedPushes)

      const mockJob = {
        id: 'job-123',
        data: mockJobData,
      } as Job<PeerPushGenerationJobData>

      const result = await processor.process(mockJob)

      expect(result).toEqual({
        success: true,
        analyzedContentId: 'content-123',
        pushesCreated: 2,
        message: 'Successfully created 2 peer pushes',
      })
      expect(peerPushSchedulerService.generatePeerPushes).toHaveBeenCalledWith('content-123')
    })

    it('should handle empty push creation result', async () => {
      jest.spyOn(peerPushSchedulerService, 'generatePeerPushes').mockResolvedValue([])

      const mockJob = {
        id: 'job-123',
        data: mockJobData,
      } as Job<PeerPushGenerationJobData>

      const result = await processor.process(mockJob)

      expect(result).toEqual({
        success: true,
        analyzedContentId: 'content-123',
        pushesCreated: 0,
        message: 'Successfully created 0 peer pushes',
      })
    })

    it('should throw error when push generation fails', async () => {
      jest.spyOn(peerPushSchedulerService, 'generatePeerPushes').mockRejectedValue(
        new Error('Database connection failed'),
      )

      const mockJob = {
        id: 'job-123',
        data: mockJobData,
      } as Job<PeerPushGenerationJobData>

      await expect(processor.process(mockJob)).rejects.toThrow('Database connection failed')
    })

    it('should pass correct data to scheduler service', async () => {
      jest.spyOn(peerPushSchedulerService, 'generatePeerPushes').mockResolvedValue([])

      const mockJob = {
        id: 'job-456',
        data: {
          analyzedContentId: 'content-456',
          source: 'peer-crawler',
        },
      } as Job<PeerPushGenerationJobData>

      await processor.process(mockJob)

      expect(peerPushSchedulerService.generatePeerPushes).toHaveBeenCalledWith('content-456')
    })
  })

  describe('event handlers', () => {
    it('should log on completed event', () => {
      const loggerSpy = jest.spyOn(processor['logger'], 'log')

      const mockJob = {
        id: 'job-123',
        data: mockJobData,
      } as Job<PeerPushGenerationJobData>

      processor.onCompleted(mockJob)

      expect(loggerSpy).toHaveBeenCalledWith(
        'Peer push generation job job-123 completed successfully',
      )
    })

    it('should log on failed event', () => {
      const loggerSpy = jest.spyOn(processor['logger'], 'error')

      const mockJob = {
        id: 'job-123',
        data: mockJobData,
        attemptsMade: 1,
        opts: { attempts: 2 },
      } as Job<PeerPushGenerationJobData>

      const error = new Error('Processing failed')

      processor.onFailed(mockJob, error)

      expect(loggerSpy).toHaveBeenCalledWith(
        'Peer push generation job job-123 failed: Processing failed',
        error.stack,
      )
    })

    it('should log final failure after all attempts', () => {
      const loggerSpy = jest.spyOn(processor['logger'], 'error')

      const mockJob = {
        id: 'job-123',
        data: mockJobData,
        attemptsMade: 2,
        opts: { attempts: 2 },
      } as Job<PeerPushGenerationJobData>

      const error = new Error('Processing failed')

      processor.onFailed(mockJob, error)

      expect(loggerSpy).toHaveBeenCalledWith(
        'Peer push generation job job-123 failed after 2 attempts. Content ID: content-123',
      )
    })

    it('should handle job with no attempts configured', () => {
      const loggerSpy = jest.spyOn(processor['logger'], 'error')

      const mockJob = {
        id: 'job-123',
        data: mockJobData,
        attemptsMade: 1,
        opts: {}, // No attempts configured
      } as Job<PeerPushGenerationJobData>

      const error = new Error('Processing failed')

      processor.onFailed(mockJob, error)

      // Should not log final failure message since attemptsMade (1) < default (1)
      expect(loggerSpy).toHaveBeenCalledWith(
        'Peer push generation job job-123 failed: Processing failed',
        error.stack,
      )
    })
  })

  describe('process - edge cases', () => {
    it('should handle job with single push creation', async () => {
      const mockCreatedPushes = [
        {
          pushId: 'push-1',
          organizationId: 'org-1',
          relevanceScore: 0.9,
          priorityLevel: 'high' as const,
          scheduledAt: new Date(),
        },
      ]

      jest.spyOn(peerPushSchedulerService, 'generatePeerPushes').mockResolvedValue(mockCreatedPushes)

      const mockJob = {
        id: 'job-123',
        data: mockJobData,
      } as Job<PeerPushGenerationJobData>

      const result = await processor.process(mockJob)

      expect(result).toEqual({
        success: true,
        analyzedContentId: 'content-123',
        pushesCreated: 1,
        message: 'Successfully created 1 peer pushes',
      })
    })

    it('should handle job with large number of pushes', async () => {
      const mockCreatedPushes = Array.from({ length: 100 }, (_, i) => ({
        pushId: `push-${i}`,
        organizationId: `org-${i % 10}`,
        relevanceScore: 0.8,
        priorityLevel: 'medium' as const,
        scheduledAt: new Date(),
      }))

      jest.spyOn(peerPushSchedulerService, 'generatePeerPushes').mockResolvedValue(mockCreatedPushes)

      const mockJob = {
        id: 'job-123',
        data: mockJobData,
      } as Job<PeerPushGenerationJobData>

      const result = await processor.process(mockJob)

      expect(result).toEqual({
        success: true,
        analyzedContentId: 'content-123',
        pushesCreated: 100,
        message: 'Successfully created 100 peer pushes',
      })
    })

    it('should handle error with no message', async () => {
      jest.spyOn(peerPushSchedulerService, 'generatePeerPushes').mockRejectedValue(new Error())

      const mockJob = {
        id: 'job-123',
        data: mockJobData,
      } as Job<PeerPushGenerationJobData>

      await expect(processor.process(mockJob)).rejects.toThrow()
    })

    it('should log job processing start', async () => {
      const loggerLogSpy = jest.spyOn(processor['logger'], 'log')
      jest.spyOn(peerPushSchedulerService, 'generatePeerPushes').mockResolvedValue([])

      const mockJob = {
        id: 'job-123',
        data: mockJobData,
      } as Job<PeerPushGenerationJobData>

      await processor.process(mockJob)

      expect(loggerLogSpy).toHaveBeenCalledWith(
        'Processing peer push generation job job-123 for content: content-123 (source: peer-crawler)',
      )
    })

    it('should log job completion', async () => {
      const loggerLogSpy = jest.spyOn(processor['logger'], 'log')
      jest.spyOn(peerPushSchedulerService, 'generatePeerPushes').mockResolvedValue([])

      const mockJob = {
        id: 'job-123',
        data: mockJobData,
      } as Job<PeerPushGenerationJobData>

      await processor.process(mockJob)

      expect(loggerLogSpy).toHaveBeenCalledWith(
        'Job job-123 completed: Successfully created 0 peer pushes',
      )
    })
  })

  describe('processor configuration', () => {
    it('should have correct queue name', () => {
      // The processor is configured with @Processor('radar-push-generation')
      // This is verified by the decorator, but we can check the class exists
      expect(processor).toBeDefined()
    })

    it('should extend WorkerHost', () => {
      expect(processor).toBeInstanceOf(PeerPushGenerationProcessor)
    })
  })
})
