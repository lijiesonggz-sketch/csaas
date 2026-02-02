import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PushProcessor } from './push.processor'
import { PushSchedulerService } from '../services/push-scheduler.service'
import { AnalyzedContentService } from '../services/analyzed-content.service'
import { AIAnalysisService } from '../services/ai-analysis.service'
import { PushLogService } from '../services/push-log.service'
import { TasksGateway } from '../../ai-tasks/gateways/tasks.gateway'
import { RadarPush } from '../../../database/entities/radar-push.entity'
import { WeaknessSnapshot } from '../../../database/entities/weakness-snapshot.entity'
import { Job } from 'bullmq'

describe('PushProcessor - Industry Radar (Story 3.2 Task 2.3)', () => {
  let processor: PushProcessor
  let pushSchedulerService: PushSchedulerService
  let tasksGateway: TasksGateway
  let weaknessSnapshotRepo: Repository<WeaknessSnapshot>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushProcessor,
        {
          provide: PushSchedulerService,
          useValue: {
            getPendingPushes: jest.fn(),
            groupByOrganization: jest.fn(),
            markAsSent: jest.fn(),
            markAsFailed: jest.fn(),
          },
        },
        {
          provide: AnalyzedContentService,
          useValue: {},
        },
        {
          provide: AIAnalysisService,
          useValue: {},
        },
        {
          provide: PushLogService,
          useValue: {
            logSuccess: jest.fn(),
            logFailure: jest.fn(),
          },
        },
        {
          provide: TasksGateway,
          useValue: {
            server: {
              to: jest.fn().mockReturnThis(),
              emit: jest.fn(),
            },
          },
        },
        {
          provide: getRepositoryToken(WeaknessSnapshot),
          useValue: {
            find: jest.fn(),
          },
        },
      ],
    }).compile()

    processor = module.get<PushProcessor>(PushProcessor)
    pushSchedulerService = module.get<PushSchedulerService>(PushSchedulerService)
    tasksGateway = module.get<TasksGateway>(TasksGateway)
    weaknessSnapshotRepo = module.get<Repository<WeaknessSnapshot>>(
      getRepositoryToken(WeaknessSnapshot),
    )
  })

  describe('process - Industry Radar Push Limits', () => {
    it('should limit industry radar pushes to 2 per organization', async () => {
      // Arrange: 创建3条同一组织的行业雷达推送
      const mockPushes = [
        {
          id: 'push-1',
          organizationId: 'org-1',
          radarType: 'industry',
          relevanceScore: 0.95,
          priorityLevel: 'high',
          analyzedContent: {
            id: 'content-1',
            rawContent: { title: 'Test 1', url: 'http://test1.com' },
            aiSummary: 'Summary 1',
            tags: [],
          },
        },
        {
          id: 'push-2',
          organizationId: 'org-1',
          radarType: 'industry',
          relevanceScore: 0.9,
          priorityLevel: 'high',
          analyzedContent: {
            id: 'content-2',
            rawContent: { title: 'Test 2', url: 'http://test2.com' },
            aiSummary: 'Summary 2',
            tags: [],
          },
        },
        {
          id: 'push-3',
          organizationId: 'org-1',
          radarType: 'industry',
          relevanceScore: 0.85,
          priorityLevel: 'medium',
          analyzedContent: {
            id: 'content-3',
            rawContent: { title: 'Test 3', url: 'http://test3.com' },
            aiSummary: 'Summary 3',
            tags: [],
          },
        },
      ] as RadarPush[]

      const groupedPushes = new Map([['org-1', mockPushes.slice(0, 2)]]) // 只取前2条

      jest.spyOn(pushSchedulerService, 'getPendingPushes').mockResolvedValue(mockPushes)
      jest.spyOn(pushSchedulerService, 'groupByOrganization').mockReturnValue(groupedPushes)
      jest.spyOn(weaknessSnapshotRepo, 'find').mockResolvedValue([])

      const job = {
        id: 'job-1',
        data: { radarType: 'industry' },
      } as Job<{ radarType: 'industry' }>

      // Act
      await processor.process(job)

      // Assert: 验证groupByOrganization被调用时使用了maxPerOrg=2
      expect(pushSchedulerService.groupByOrganization).toHaveBeenCalledWith(mockPushes, 2)

      // 验证只发送了2条推送
      expect(pushSchedulerService.markAsSent).toHaveBeenCalledTimes(2)
      expect(pushSchedulerService.markAsSent).toHaveBeenCalledWith('push-1')
      expect(pushSchedulerService.markAsSent).toHaveBeenCalledWith('push-2')
    })

    it('should use maxPerOrg=5 for tech radar', async () => {
      // Arrange
      const mockPushes = [
        {
          id: 'push-1',
          organizationId: 'org-1',
          radarType: 'tech',
          analyzedContent: {
            rawContent: { title: 'Test' },
            tags: [],
          },
        },
      ] as RadarPush[]

      jest.spyOn(pushSchedulerService, 'getPendingPushes').mockResolvedValue(mockPushes)
      jest
        .spyOn(pushSchedulerService, 'groupByOrganization')
        .mockReturnValue(new Map([['org-1', mockPushes]]))
      jest.spyOn(weaknessSnapshotRepo, 'find').mockResolvedValue([])

      const job = {
        id: 'job-1',
        data: { radarType: 'tech' },
      } as Job<{ radarType: 'tech' }>

      // Act
      await processor.process(job)

      // Assert: 验证技术雷达使用maxPerOrg=5
      expect(pushSchedulerService.groupByOrganization).toHaveBeenCalledWith(mockPushes, 5)
    })

    it('should handle no pending pushes for industry radar', async () => {
      // Arrange
      jest.spyOn(pushSchedulerService, 'getPendingPushes').mockResolvedValue([])

      const job = {
        id: 'job-1',
        data: { radarType: 'industry' },
      } as Job<{ radarType: 'industry' }>

      // Act
      await processor.process(job)

      // Assert: 验证没有调用groupByOrganization
      expect(pushSchedulerService.groupByOrganization).not.toHaveBeenCalled()
      expect(pushSchedulerService.markAsSent).not.toHaveBeenCalled()
    })
  })
})
