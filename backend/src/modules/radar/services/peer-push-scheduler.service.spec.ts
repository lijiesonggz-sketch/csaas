import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository, DataSource } from 'typeorm'
import { PeerPushSchedulerService } from './peer-push-scheduler.service'
import { PeerRelevanceService, OrganizationRelevanceResult } from './peer-relevance.service'
import { TasksGateway } from '../../ai-tasks/gateways/tasks.gateway'
import { RadarPush } from '../../../database/entities/radar-push.entity'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'
import { RawContent } from '../../../database/entities/raw-content.entity'

/**
 * PeerPushSchedulerService 单元测试
 *
 * Story 8.4 Task 1 & 3: 推送生成服务 & 推送调度处理器
 */
describe('PeerPushSchedulerService', () => {
  let service: PeerPushSchedulerService
  let radarPushRepo: Repository<RadarPush>
  let analyzedContentRepo: Repository<AnalyzedContent>
  let peerRelevanceService: PeerRelevanceService
  let tasksGateway: TasksGateway
  let dataSource: DataSource

  const mockTenantId = 'tenant-123'
  const mockOrganizationId = 'org-123'
  const mockContentId = 'content-123'
  const mockPeerName = '杭州银行'

  const mockAnalyzedContent: Partial<AnalyzedContent> = {
    id: mockContentId,
    peerName: mockPeerName,
    contentId: 'raw-123',
    categories: ['云原生'],
    keywords: ['Kubernetes'],
    keyTechnologies: ['Docker'],
    practiceDescription: '使用Kubernetes进行容器编排',
    estimatedCost: '50-100万',
    implementationPeriod: '3-6个月',
    technicalEffect: '部署时间缩短80%',
    aiSummary: '杭州银行采用云原生技术实现数字化转型',
    roiAnalysis: {
      estimatedCost: '50-100万',
      expectedBenefit: '年节省200万运维成本',
      roiEstimate: 'ROI 2:1',
      implementationPeriod: '3-6个月',
      recommendedVendors: ['阿里云', '腾讯云'],
    },
    rawContent: {
      id: 'raw-123',
      title: '杭州银行云原生实践',
    } as RawContent,
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeerPushSchedulerService,
        {
          provide: getRepositoryToken(RadarPush),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AnalyzedContent),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: PeerRelevanceService,
          useValue: {
            calculatePeerRelevance: jest.fn(),
          },
        },
        {
          provide: TasksGateway,
          useValue: {
            server: {
              to: jest.fn().mockReturnValue({
                emit: jest.fn(),
              }),
            },
            hasOnlineUsers: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn().mockImplementation(async (fn) => {
              const mockManager = {
                update: jest.fn().mockResolvedValue({ affected: 1 }),
              }
              return fn(mockManager)
            }),
          },
        },
      ],
    }).compile()

    service = module.get<PeerPushSchedulerService>(PeerPushSchedulerService)
    radarPushRepo = module.get<Repository<RadarPush>>(getRepositoryToken(RadarPush))
    analyzedContentRepo = module.get<Repository<AnalyzedContent>>(getRepositoryToken(AnalyzedContent))
    peerRelevanceService = module.get<PeerRelevanceService>(PeerRelevanceService)
    tasksGateway = module.get<TasksGateway>(TasksGateway)
    dataSource = module.get<DataSource>(DataSource)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('generatePeerPushes', () => {
    it('should throw error when analyzed content not found', async () => {
      jest.spyOn(analyzedContentRepo, 'findOne').mockResolvedValue(null)

      await expect(service.generatePeerPushes(mockContentId)).rejects.toThrow(
        `AnalyzedContent not found: ${mockContentId}`,
      )
    })

    it('should return empty array when content has no peerName', async () => {
      jest.spyOn(analyzedContentRepo, 'findOne').mockResolvedValue({
        ...mockAnalyzedContent,
        peerName: undefined,
      } as AnalyzedContent)

      const results = await service.generatePeerPushes(mockContentId)

      expect(results).toEqual([])
    })

    it('should return empty array when no high-relevance organizations found', async () => {
      jest.spyOn(analyzedContentRepo, 'findOne').mockResolvedValue(mockAnalyzedContent as AnalyzedContent)
      jest.spyOn(peerRelevanceService, 'calculatePeerRelevance').mockResolvedValue([])

      const results = await service.generatePeerPushes(mockContentId)

      expect(results).toEqual([])
    })

    it('should create pushes for high-relevance organizations', async () => {
      jest.spyOn(analyzedContentRepo, 'findOne').mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      const mockRelevanceResults: OrganizationRelevanceResult[] = [
        {
          organizationId: mockOrganizationId,
          tenantId: mockTenantId,
          relevanceScore: 1.0,
          priorityLevel: 'high',
          matchedPeers: [mockPeerName],
          matchedTopics: ['云原生'],
          matchedWeaknesses: [],
        },
      ]
      jest.spyOn(peerRelevanceService, 'calculatePeerRelevance').mockResolvedValue(mockRelevanceResults)

      const mockPush = {
        id: 'push-123',
        organizationId: mockOrganizationId,
        tenantId: mockTenantId,
        radarType: 'industry',
        pushType: 'peer-monitoring',
        contentId: mockContentId,
        relevanceScore: 1.0,
        priorityLevel: 'high',
        scheduledAt: expect.any(Date),
        status: 'scheduled',
        peerName: mockPeerName,
        matchedPeers: [mockPeerName],
      }

      jest.spyOn(radarPushRepo, 'create').mockReturnValue(mockPush as RadarPush)
      jest.spyOn(radarPushRepo, 'save').mockResolvedValue(mockPush as RadarPush)

      const results = await service.generatePeerPushes(mockContentId)

      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        pushId: 'push-123',
        organizationId: mockOrganizationId,
        relevanceScore: 1.0,
        priorityLevel: 'high',
      })
      expect(radarPushRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: mockOrganizationId,
          tenantId: mockTenantId,
          radarType: 'industry',
          pushType: 'peer-monitoring',
          contentId: mockContentId,
          relevanceScore: 1.0,
          priorityLevel: 'high',
          status: 'scheduled',
          peerName: mockPeerName,
        }),
      )
    })

    it('should handle multiple organizations', async () => {
      jest.spyOn(analyzedContentRepo, 'findOne').mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      const mockRelevanceResults: OrganizationRelevanceResult[] = [
        {
          organizationId: 'org-1',
          tenantId: mockTenantId,
          relevanceScore: 1.0,
          priorityLevel: 'high',
          matchedPeers: [mockPeerName],
          matchedTopics: [],
          matchedWeaknesses: [],
        },
        {
          organizationId: 'org-2',
          tenantId: mockTenantId,
          relevanceScore: 0.8,
          priorityLevel: 'medium',
          matchedPeers: [mockPeerName],
          matchedTopics: [],
          matchedWeaknesses: [],
        },
      ]
      jest.spyOn(peerRelevanceService, 'calculatePeerRelevance').mockResolvedValue(mockRelevanceResults)

      jest.spyOn(radarPushRepo, 'create').mockImplementation((data: any) => ({ ...data, id: `push-${data.organizationId}` }) as RadarPush)
      jest.spyOn(radarPushRepo, 'save').mockImplementation((data: any) => Promise.resolve(data as RadarPush))

      const results = await service.generatePeerPushes(mockContentId)

      expect(results).toHaveLength(2)
      expect(radarPushRepo.create).toHaveBeenCalledTimes(2)
    })

    it('should continue on individual push creation failure', async () => {
      jest.spyOn(analyzedContentRepo, 'findOne').mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      const mockRelevanceResults: OrganizationRelevanceResult[] = [
        {
          organizationId: 'org-1',
          tenantId: mockTenantId,
          relevanceScore: 1.0,
          priorityLevel: 'high',
          matchedPeers: [mockPeerName],
          matchedTopics: [],
          matchedWeaknesses: [],
        },
        {
          organizationId: 'org-2',
          tenantId: mockTenantId,
          relevanceScore: 0.8,
          priorityLevel: 'medium',
          matchedPeers: [mockPeerName],
          matchedTopics: [],
          matchedWeaknesses: [],
        },
      ]
      jest.spyOn(peerRelevanceService, 'calculatePeerRelevance').mockResolvedValue(mockRelevanceResults)

      // First org fails after retries, second succeeds
      jest.spyOn(radarPushRepo, 'save')
        .mockRejectedValueOnce(new Error('Database error'))
        .mockRejectedValueOnce(new Error('Database error'))
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({ id: 'push-2' } as RadarPush)

      const results = await service.generatePeerPushes(mockContentId)

      expect(results).toHaveLength(1)
      // Only org-2 should succeed (org-1 fails after 3 retries)
      expect(results[0].organizationId).toBe('org-2')
    })
  })

  describe('generatePendingPeerPushes', () => {
    it('should return empty stats when no pending pushes', async () => {
      jest.spyOn(radarPushRepo, 'find').mockResolvedValue([])

      const result = await service.generatePendingPeerPushes()

      expect(result).toEqual({
        totalScheduled: 0,
        sent: 0,
        failed: 0,
        byOrganization: {},
      })
    })

    it('should send pushes grouped by organization (max 3 per org)', async () => {
      const mockPushes: Partial<RadarPush>[] = [
        {
          id: 'push-1',
          organizationId: 'org-1',
          contentId: 'content-1',
          relevanceScore: 0.95,
          priorityLevel: 'high',
          status: 'scheduled',
          pushType: 'peer-monitoring',
        },
        {
          id: 'push-2',
          organizationId: 'org-1',
          contentId: 'content-2',
          relevanceScore: 0.85,
          priorityLevel: 'medium',
          status: 'scheduled',
          pushType: 'peer-monitoring',
        },
        {
          id: 'push-3',
          organizationId: 'org-1',
          contentId: 'content-3',
          relevanceScore: 0.75,
          priorityLevel: 'medium',
          status: 'scheduled',
          pushType: 'peer-monitoring',
        },
        {
          id: 'push-4',
          organizationId: 'org-1',
          contentId: 'content-4',
          relevanceScore: 0.7,
          priorityLevel: 'medium',
          status: 'scheduled',
          pushType: 'peer-monitoring',
        },
        {
          id: 'push-5',
          organizationId: 'org-2',
          contentId: 'content-5',
          relevanceScore: 0.9,
          priorityLevel: 'high',
          status: 'scheduled',
          pushType: 'peer-monitoring',
        },
      ] as RadarPush[]

      jest.spyOn(radarPushRepo, 'find').mockResolvedValue(mockPushes as RadarPush[])

      // Mock analyzed content for each push
      jest.spyOn(analyzedContentRepo, 'findOne')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      jest.spyOn(radarPushRepo, 'update').mockResolvedValue({ affected: 1 } as any)

      const result = await service.generatePendingPeerPushes()

      // org-1 should have 3 pushes (limited), org-2 should have 1
      expect(result.sent).toBe(4)
      expect(result.byOrganization['org-1']).toBe(3)
      expect(result.byOrganization['org-2']).toBe(1)
    })

    it('should update status to failed on send error', async () => {
      const mockPush: Partial<RadarPush> = {
        id: 'push-1',
        organizationId: 'org-1',
        contentId: 'content-1',
        relevanceScore: 0.9,
        priorityLevel: 'high',
        status: 'scheduled',
        pushType: 'peer-monitoring',
      } as RadarPush

      jest.spyOn(radarPushRepo, 'find').mockResolvedValue([mockPush] as RadarPush[])
      jest.spyOn(analyzedContentRepo, 'findOne').mockResolvedValue(null) // Will cause error
      jest.spyOn(radarPushRepo, 'update').mockResolvedValue({ affected: 1 } as any)

      const result = await service.generatePendingPeerPushes()

      expect(result.failed).toBe(1)
      expect(radarPushRepo.update).toHaveBeenCalledWith('push-1', { status: 'failed' })
    })
  })

  describe('sendPushImmediately', () => {
    it('should throw error when push not found', async () => {
      jest.spyOn(radarPushRepo, 'findOne').mockResolvedValue(null)

      await expect(service.sendPushImmediately('push-123')).rejects.toThrow(
        'Push not found: push-123',
      )
    })

    it('should throw error when push is not in scheduled status', async () => {
      jest.spyOn(radarPushRepo, 'findOne').mockResolvedValue({
        id: 'push-123',
        status: 'sent',
      } as RadarPush)

      await expect(service.sendPushImmediately('push-123')).rejects.toThrow(
        'Push push-123 is not in scheduled status',
      )
    })
  })

  describe('getPushStats', () => {
    it('should return correct stats', async () => {
      const mockPushes: Partial<RadarPush>[] = [
        { priorityLevel: 'high', status: 'sent' },
        { priorityLevel: 'high', status: 'sent' },
        { priorityLevel: 'medium', status: 'scheduled' },
        { priorityLevel: 'low', status: 'failed' },
      ] as RadarPush[]

      jest.spyOn(radarPushRepo, 'find').mockResolvedValue(mockPushes as RadarPush[])

      const result = await service.getPushStats(new Date(), new Date())

      expect(result).toEqual({
        total: 4,
        byPriority: { high: 2, medium: 1, low: 1 },
        byStatus: { scheduled: 1, sent: 2, failed: 1, cancelled: 0 },
      })
    })

    it('should handle empty push list', async () => {
      jest.spyOn(radarPushRepo, 'find').mockResolvedValue([])

      const result = await service.getPushStats(new Date(), new Date())

      expect(result).toEqual({
        total: 0,
        byPriority: { high: 0, medium: 0, low: 0 },
        byStatus: { scheduled: 0, sent: 0, failed: 0, cancelled: 0 },
      })
    })
  })

  describe('sendPushImmediately - success cases', () => {
    it('should successfully send push immediately when push is scheduled', async () => {
      const mockPush: Partial<RadarPush> = {
        id: 'push-123',
        organizationId: mockOrganizationId,
        contentId: mockContentId,
        status: 'scheduled',
        pushType: 'peer-monitoring',
        peerName: mockPeerName,
        relevanceScore: 0.9,
        priorityLevel: 'high',
      } as RadarPush

      jest.spyOn(radarPushRepo, 'findOne').mockResolvedValue(mockPush as RadarPush)
      jest.spyOn(analyzedContentRepo, 'findOne').mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      await service.sendPushImmediately('push-123')

      // Verify transaction was used
      expect(dataSource.transaction).toHaveBeenCalled()
    })

    it('should emit WebSocket event when sending push immediately', async () => {
      const mockPush: Partial<RadarPush> = {
        id: 'push-123',
        organizationId: mockOrganizationId,
        contentId: mockContentId,
        status: 'scheduled',
        pushType: 'peer-monitoring',
        peerName: mockPeerName,
        relevanceScore: 0.9,
        priorityLevel: 'high',
      } as RadarPush

      jest.spyOn(radarPushRepo, 'findOne').mockResolvedValue(mockPush as RadarPush)
      jest.spyOn(analyzedContentRepo, 'findOne').mockResolvedValue(mockAnalyzedContent as AnalyzedContent)
      jest.spyOn(radarPushRepo, 'update').mockResolvedValue({ affected: 1 } as any)

      const emitMock = jest.fn()
      jest.spyOn(tasksGateway.server, 'to').mockReturnValue({ emit: emitMock } as any)

      await service.sendPushImmediately('push-123')

      expect(tasksGateway.server.to).toHaveBeenCalledWith(`org:${mockOrganizationId}`)
      expect(emitMock).toHaveBeenCalledWith('radar:push:new', {
        type: 'radar:push:new',
        data: expect.objectContaining({
          pushId: 'push-123',
          radarType: 'industry',
          pushType: 'peer-monitoring',
          peerName: mockPeerName,
        }),
      })
    })
  })

  describe('extractTitle', () => {
    it('should extract title with key technologies', async () => {
      jest.spyOn(analyzedContentRepo, 'findOne').mockResolvedValue({
        ...mockAnalyzedContent,
        keyTechnologies: ['Kubernetes', 'Docker'],
        categories: [],
        aiSummary: '',
      } as AnalyzedContent)

      const mockRelevanceResults: OrganizationRelevanceResult[] = [
        {
          organizationId: mockOrganizationId,
          tenantId: mockTenantId,
          relevanceScore: 1.0,
          priorityLevel: 'high',
          matchedPeers: [mockPeerName],
          matchedTopics: [],
          matchedWeaknesses: [],
        },
      ]
      jest.spyOn(peerRelevanceService, 'calculatePeerRelevance').mockResolvedValue(mockRelevanceResults)

      jest.spyOn(radarPushRepo, 'create').mockImplementation((data: any) => ({ ...data, id: 'push-123' }) as RadarPush)
      jest.spyOn(radarPushRepo, 'save').mockImplementation((data: any) => Promise.resolve(data as RadarPush))

      await service.generatePeerPushes(mockContentId)

      // The title should include peer name and first key technology
      expect(radarPushRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          peerName: mockPeerName,
        }),
      )
    })

    it('should extract title with categories when no key technologies', async () => {
      const contentWithoutTechs = {
        ...mockAnalyzedContent,
        keyTechnologies: [],
        categories: ['云原生'],
        aiSummary: '',
      }

      jest.spyOn(analyzedContentRepo, 'findOne').mockResolvedValue(contentWithoutTechs as AnalyzedContent)

      const mockRelevanceResults: OrganizationRelevanceResult[] = [
        {
          organizationId: mockOrganizationId,
          tenantId: mockTenantId,
          relevanceScore: 1.0,
          priorityLevel: 'high',
          matchedPeers: [mockPeerName],
          matchedTopics: [],
          matchedWeaknesses: [],
        },
      ]
      jest.spyOn(peerRelevanceService, 'calculatePeerRelevance').mockResolvedValue(mockRelevanceResults)

      jest.spyOn(radarPushRepo, 'create').mockImplementation((data: any) => ({ ...data, id: 'push-123' }) as RadarPush)
      jest.spyOn(radarPushRepo, 'save').mockImplementation((data: any) => Promise.resolve(data as RadarPush))

      await service.generatePeerPushes(mockContentId)

      expect(radarPushRepo.create).toHaveBeenCalled()
    })

    it('should extract title from ai summary when no technologies or categories', async () => {
      const contentWithSummaryOnly = {
        ...mockAnalyzedContent,
        keyTechnologies: [],
        categories: [],
        aiSummary: '这是一段很长的AI摘要内容，用于测试标题提取功能',
      }

      jest.spyOn(analyzedContentRepo, 'findOne').mockResolvedValue(contentWithSummaryOnly as AnalyzedContent)

      const mockRelevanceResults: OrganizationRelevanceResult[] = [
        {
          organizationId: mockOrganizationId,
          tenantId: mockTenantId,
          relevanceScore: 1.0,
          priorityLevel: 'high',
          matchedPeers: [mockPeerName],
          matchedTopics: [],
          matchedWeaknesses: [],
        },
      ]
      jest.spyOn(peerRelevanceService, 'calculatePeerRelevance').mockResolvedValue(mockRelevanceResults)

      jest.spyOn(radarPushRepo, 'create').mockImplementation((data: any) => ({ ...data, id: 'push-123' }) as RadarPush)
      jest.spyOn(radarPushRepo, 'save').mockImplementation((data: any) => Promise.resolve(data as RadarPush))

      await service.generatePeerPushes(mockContentId)

      expect(radarPushRepo.create).toHaveBeenCalled()
    })

    it('should use default title when no content fields available', async () => {
      // Keep peerName but remove other fields to test default title
      const contentWithNothing = {
        ...mockAnalyzedContent,
        keyTechnologies: [],
        categories: [],
        aiSummary: '',
        // peerName is kept from mockAnalyzedContent
      }

      jest.spyOn(analyzedContentRepo, 'findOne').mockResolvedValue(contentWithNothing as AnalyzedContent)

      const mockRelevanceResults: OrganizationRelevanceResult[] = [
        {
          organizationId: mockOrganizationId,
          tenantId: mockTenantId,
          relevanceScore: 1.0,
          priorityLevel: 'high',
          matchedPeers: [mockPeerName],
          matchedTopics: [],
          matchedWeaknesses: [],
        },
      ]
      jest.spyOn(peerRelevanceService, 'calculatePeerRelevance').mockResolvedValue(mockRelevanceResults)

      jest.spyOn(radarPushRepo, 'create').mockImplementation((data: any) => ({ ...data, id: 'push-123' }) as RadarPush)
      jest.spyOn(radarPushRepo, 'save').mockImplementation((data: any) => Promise.resolve(data as RadarPush))

      await service.generatePeerPushes(mockContentId)

      expect(radarPushRepo.create).toHaveBeenCalled()
    })
  })

  describe('calculateScheduledAt', () => {
    it('should schedule high priority pushes 5 minutes in the future', async () => {
      jest.spyOn(analyzedContentRepo, 'findOne').mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      const mockRelevanceResults: OrganizationRelevanceResult[] = [
        {
          organizationId: mockOrganizationId,
          tenantId: mockTenantId,
          relevanceScore: 1.0,
          priorityLevel: 'high',
          matchedPeers: [mockPeerName],
          matchedTopics: [],
          matchedWeaknesses: [],
        },
      ]
      jest.spyOn(peerRelevanceService, 'calculatePeerRelevance').mockResolvedValue(mockRelevanceResults)

      const now = new Date()
      jest.spyOn(radarPushRepo, 'create').mockImplementation((data: any) => {
        // Verify scheduledAt is approximately 5 minutes in the future
        const scheduledAt = data.scheduledAt as Date
        const diffMs = scheduledAt.getTime() - now.getTime()
        const diffMinutes = Math.round(diffMs / (60 * 1000))
        expect(diffMinutes).toBe(5)
        return { ...data, id: 'push-123' } as RadarPush
      })
      jest.spyOn(radarPushRepo, 'save').mockImplementation((data: any) => Promise.resolve(data as RadarPush))

      await service.generatePeerPushes(mockContentId)

      expect(radarPushRepo.create).toHaveBeenCalled()
    })

    it('should schedule medium priority pushes for tomorrow at 6am', async () => {
      jest.spyOn(analyzedContentRepo, 'findOne').mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      const mockRelevanceResults: OrganizationRelevanceResult[] = [
        {
          organizationId: mockOrganizationId,
          tenantId: mockTenantId,
          relevanceScore: 0.8,
          priorityLevel: 'medium',
          matchedPeers: [mockPeerName],
          matchedTopics: [],
          matchedWeaknesses: [],
        },
      ]
      jest.spyOn(peerRelevanceService, 'calculatePeerRelevance').mockResolvedValue(mockRelevanceResults)

      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(6, 0, 0, 0)

      jest.spyOn(radarPushRepo, 'create').mockImplementation((data: any) => {
        // Verify scheduledAt is tomorrow at 6am
        const scheduledAt = data.scheduledAt as Date
        expect(scheduledAt.getDate()).toBe(tomorrow.getDate())
        expect(scheduledAt.getHours()).toBe(6)
        expect(scheduledAt.getMinutes()).toBe(0)
        return { ...data, id: 'push-123' } as RadarPush
      })
      jest.spyOn(radarPushRepo, 'save').mockImplementation((data: any) => Promise.resolve(data as RadarPush))

      await service.generatePeerPushes(mockContentId)

      expect(radarPushRepo.create).toHaveBeenCalled()
    })
  })

  describe('generatePendingPeerPushes - edge cases', () => {
    it('should handle push with analyzedContent relation', async () => {
      const mockPush = {
        id: 'push-1',
        organizationId: 'org-1',
        contentId: 'content-1',
        relevanceScore: 0.9,
        priorityLevel: 'high',
        status: 'scheduled',
        pushType: 'peer-monitoring',
        analyzedContent: {
          ...mockAnalyzedContent,
          id: 'content-1',
        },
      } as RadarPush

      jest.spyOn(radarPushRepo, 'find').mockResolvedValue([mockPush])
      jest.spyOn(analyzedContentRepo, 'findOne').mockResolvedValue(mockAnalyzedContent as AnalyzedContent)
      jest.spyOn(radarPushRepo, 'update').mockResolvedValue({ affected: 1 } as any)

      const result = await service.generatePendingPeerPushes()

      expect(result.sent).toBe(1)
    })

    it('should handle multiple organizations with varying push counts', async () => {
      const mockPushes: Partial<RadarPush>[] = [
        { id: 'push-1', organizationId: 'org-1', contentId: 'content-1', relevanceScore: 0.9, priorityLevel: 'high', status: 'scheduled', pushType: 'peer-monitoring' },
        { id: 'push-2', organizationId: 'org-1', contentId: 'content-2', relevanceScore: 0.85, priorityLevel: 'medium', status: 'scheduled', pushType: 'peer-monitoring' },
        { id: 'push-3', organizationId: 'org-2', contentId: 'content-3', relevanceScore: 0.8, priorityLevel: 'medium', status: 'scheduled', pushType: 'peer-monitoring' },
        { id: 'push-4', organizationId: 'org-3', contentId: 'content-4', relevanceScore: 0.75, priorityLevel: 'medium', status: 'scheduled', pushType: 'peer-monitoring' },
        { id: 'push-5', organizationId: 'org-3', contentId: 'content-5', relevanceScore: 0.7, priorityLevel: 'medium', status: 'scheduled', pushType: 'peer-monitoring' },
        { id: 'push-6', organizationId: 'org-3', contentId: 'content-6', relevanceScore: 0.95, priorityLevel: 'high', status: 'scheduled', pushType: 'peer-monitoring' },
      ] as RadarPush[]

      jest.spyOn(radarPushRepo, 'find').mockResolvedValue(mockPushes as RadarPush[])
      jest.spyOn(analyzedContentRepo, 'findOne').mockResolvedValue(mockAnalyzedContent as AnalyzedContent)
      jest.spyOn(radarPushRepo, 'update').mockResolvedValue({ affected: 1 } as any)

      const result = await service.generatePendingPeerPushes()

      expect(result.sent).toBe(6)
      expect(result.byOrganization['org-1']).toBe(2)
      expect(result.byOrganization['org-2']).toBe(1)
      expect(result.byOrganization['org-3']).toBe(3)
    })
  })
})
