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

describe('PushProcessor - Industry Radar Push Send (Story 3.2 Task 3.2)', () => {
  let processor: PushProcessor
  let pushSchedulerService: PushSchedulerService
  let tasksGateway: TasksGateway
  let weaknessSnapshotRepo: Repository<WeaknessSnapshot>

  let emitSpy: jest.SpyInstance

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

    // 监听emit调用
    emitSpy = jest.spyOn(tasksGateway.server, 'emit')
  })

  describe('sendPushViaWebSocket - Industry Radar Fields (AC 4)', () => {
    it('should include all industry radar fields in WebSocket event', async () => {
      // Arrange
      const mockPush = {
        id: 'push-1',
        organizationId: 'org-1',
        radarType: 'industry',
        relevanceScore: 0.95,
        priorityLevel: 'high',
        analyzedContent: {
          id: 'content-1',
          aiSummary: '杭州银行容器化改造实践',
          // 行业雷达特定字段 (Story 3.2 Phase 1)
          practiceDescription: '杭州银行于2025年启动容器化改造项目，采用Kubernetes作为核心编排平台',
          estimatedCost: '120万',
          implementationPeriod: '6个月',
          technicalEffect: '应用部署时间从2小时缩短到10分钟，运维效率提升60%',
          categories: ['云原生', '容器化'],
          keywords: ['Kubernetes', 'Docker'],
          targetAudience: 'IT总监',
          tags: [],
          rawContent: {
            id: 'raw-1',
            title: '杭州银行容器化改造实践',
            summary: '杭州银行容器化案例',
            url: 'https://example.com/case',
            source: '金融科技周刊',
            publishDate: new Date('2025-06-15'),
            // 行业雷达特定字段 (Story 3.1)
            peerName: '杭州银行',
            contentType: 'article',
          },
        },
      } as RadarPush

      jest.spyOn(pushSchedulerService, 'getPendingPushes').mockResolvedValue([mockPush])
      jest
        .spyOn(pushSchedulerService, 'groupByOrganization')
        .mockReturnValue(new Map([['org-1', [mockPush]]]))
      jest.spyOn(weaknessSnapshotRepo, 'find').mockResolvedValue([])

      const job = {
        id: 'job-1',
        data: { radarType: 'industry' },
      } as Job<{ radarType: 'industry' }>

      // Act
      await processor.process(job)

      // Assert: 验证WebSocket事件包含所有行业雷达字段
      expect(emitSpy).toHaveBeenCalledWith(
        'radar:push:new',
        expect.objectContaining({
          pushId: 'push-1',
          radarType: 'industry',
          title: '杭州银行容器化改造实践',
          summary: '杭州银行容器化改造实践',
          relevanceScore: 0.95,
          priorityLevel: 1, // high = 1
          // 行业雷达特定字段
          peerName: '杭州银行',
          practiceDescription: '杭州银行于2025年启动容器化改造项目，采用Kubernetes作为核心编排平台',
          estimatedCost: '120万',
          implementationPeriod: '6个月',
          technicalEffect: '应用部署时间从2小时缩短到10分钟，运维效率提升60%',
          // 通用字段
          url: 'https://example.com/case',
          source: '金融科技周刊',
          targetAudience: 'IT总监',
          timestamp: expect.any(String),
        }),
      )
    })

    it('should handle null optional fields in industry radar push', async () => {
      // Arrange: 测试可选字段为null的情况
      const mockPush = {
        id: 'push-1',
        organizationId: 'org-1',
        radarType: 'industry',
        relevanceScore: 0.85,
        priorityLevel: 'medium',
        analyzedContent: {
          aiSummary: '技术实践案例',
          practiceDescription: '某银行技术实践',
          estimatedCost: null, // 可选字段
          implementationPeriod: null,
          technicalEffect: null,
          categories: [],
          tags: [],
          rawContent: {
            title: '技术实践案例',
            peerName: '某银行',
            contentType: 'article',
          },
        },
      } as RadarPush

      jest.spyOn(pushSchedulerService, 'getPendingPushes').mockResolvedValue([mockPush])
      jest
        .spyOn(pushSchedulerService, 'groupByOrganization')
        .mockReturnValue(new Map([['org-1', [mockPush]]]))
      jest.spyOn(weaknessSnapshotRepo, 'find').mockResolvedValue([])

      const job = {
        id: 'job-1',
        data: { radarType: 'industry' },
      } as Job<{ radarType: 'industry' }>

      // Act
      await processor.process(job)

      // Assert: 验证null字段正确传递
      expect(emitSpy).toHaveBeenCalledWith(
        'radar:push:new',
        expect.objectContaining({
          peerName: '某银行',
          practiceDescription: '某银行技术实践',
          estimatedCost: null,
          implementationPeriod: null,
          technicalEffect: null,
        }),
      )
    })

    it('should handle different contentType values in industry radar', async () => {
      // Arrange: 测试不同的contentType
      const contentTypes: Array<'article' | 'recruitment' | 'conference'> = [
        'article',
        'recruitment',
        'conference',
      ]

      for (const contentType of contentTypes) {
        const mockPush = {
          id: `push-${contentType}`,
          organizationId: 'org-1',
          radarType: 'industry',
          relevanceScore: 0.9,
          priorityLevel: 'high',
          analyzedContent: {
            aiSummary: `${contentType} summary`,
            practiceDescription: '实践描述',
            tags: [],
            rawContent: {
              title: `${contentType} title`,
              peerName: '招商银行',
              contentType,
            },
          },
        } as RadarPush

        jest.spyOn(pushSchedulerService, 'getPendingPushes').mockResolvedValue([mockPush])
        jest
          .spyOn(pushSchedulerService, 'groupByOrganization')
          .mockReturnValue(new Map([['org-1', [mockPush]]]))
        jest.spyOn(weaknessSnapshotRepo, 'find').mockResolvedValue([])

        const job = {
          id: `job-${contentType}`,
          data: { radarType: 'industry' },
        } as Job<{ radarType: 'industry' }>

        emitSpy.mockClear()

        // Act
        await processor.process(job)

        // Assert
        expect(emitSpy).toHaveBeenCalledWith(
          'radar:push:new',
          expect.objectContaining({
            peerName: '招商银行',
            contentType,
          }),
        )
      }
    })

    it('should not include industry fields for tech radar', async () => {
      // Arrange: 验证技术雷达不包含行业雷达字段
      const mockPush = {
        id: 'push-tech-1',
        organizationId: 'org-1',
        radarType: 'tech',
        relevanceScore: 0.95,
        priorityLevel: 'high',
        analyzedContent: {
          aiSummary: 'Tech radar summary',
          tags: [],
          rawContent: {
            title: 'Tech article',
            category: 'tech',
          },
        },
      } as RadarPush

      jest.spyOn(pushSchedulerService, 'getPendingPushes').mockResolvedValue([mockPush])
      jest
        .spyOn(pushSchedulerService, 'groupByOrganization')
        .mockReturnValue(new Map([['org-1', [mockPush]]]))
      jest.spyOn(weaknessSnapshotRepo, 'find').mockResolvedValue([])

      const job = {
        id: 'job-tech-1',
        data: { radarType: 'tech' },
      } as Job<{ radarType: 'tech' }>

      // Act
      await processor.process(job)

      // Assert: 技术雷达不应该有peerName字段
      const emittedEvent = emitSpy.mock.calls[0][1]
      expect(emittedEvent.radarType).toBe('tech')
      expect(emittedEvent.peerName).toBeUndefined()
      expect(emittedEvent.practiceDescription).toBeUndefined()
    })
  })

  describe('Push Status Updates (AC 4)', () => {
    it('should mark push as sent after successful WebSocket send', async () => {
      // Arrange
      const mockPush = {
        id: 'push-1',
        organizationId: 'org-1',
        radarType: 'industry',
        relevanceScore: 0.95,
        priorityLevel: 'high',
        analyzedContent: {
          aiSummary: 'Summary',
          practiceDescription: 'Practice',
          tags: [],
          rawContent: {
            title: 'Title',
            peerName: '杭州银行',
          },
        },
      } as RadarPush

      jest.spyOn(pushSchedulerService, 'getPendingPushes').mockResolvedValue([mockPush])
      jest
        .spyOn(pushSchedulerService, 'groupByOrganization')
        .mockReturnValue(new Map([['org-1', [mockPush]]]))
      jest.spyOn(weaknessSnapshotRepo, 'find').mockResolvedValue([])

      const job = {
        id: 'job-1',
        data: { radarType: 'industry' },
      } as Job<{ radarType: 'industry' }>

      // Act
      await processor.process(job)

      // Assert: 验证推送被标记为已发送
      expect(pushSchedulerService.markAsSent).toHaveBeenCalledWith('push-1')
      expect(pushSchedulerService.markAsFailed).not.toHaveBeenCalled()
    })
  })
})
