import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Job } from 'bullmq'

import { PushProcessor } from './push.processor'
import { PushSchedulerService } from '../services/push-scheduler.service'
import { AnalyzedContentService } from '../services/analyzed-content.service'
import { AIAnalysisService } from '../services/ai-analysis.service'
import { PushLogService } from '../services/push-log.service'
import { TasksGateway } from '../../ai-tasks/gateways/tasks.gateway'
import { WeaknessSnapshot } from '../../../database/entities/weakness-snapshot.entity'
import { RadarPush } from '../../../database/entities/radar-push.entity'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'
import { RawContent } from '../../../database/entities/raw-content.entity'
import { WeaknessCategory } from '../../../constants/categories'

/**
 * PushProcessor - ROI分析集成单元测试 (Story 2.4 - Phase 2)
 *
 * 测试范围：
 * - ROI分析触发逻辑
 * - WebSocket事件包含ROI字段
 * - ROI分析失败时推送仍然成功
 */
describe('PushProcessor - ROI Analysis Integration (Story 2.4)', () => {
  let processor: PushProcessor
  let pushSchedulerService: PushSchedulerService
  let analyzedContentService: AnalyzedContentService
  let aiAnalysisService: AIAnalysisService
  let tasksGateway: TasksGateway
  let weaknessSnapshotRepo: Repository<WeaknessSnapshot>

  // Mock数据
  const mockRawContent: Partial<RawContent> = {
    id: 'raw-1',
    title: '零信任架构实施方案',
    summary: '介绍零信任架构的实施方案',
    url: 'https://example.com/article',
    publishDate: new Date('2024-01-15'),
    source: '金融科技周刊',
  }

  const mockAnalyzedContent: Partial<AnalyzedContent> = {
    id: 'analyzed-1',
    contentId: 'raw-1',
    tags: [{ id: 'tag-1', name: '零信任', category: 'tech' } as any],
    keywords: ['零信任', '安全架构'],
    categories: ['数据安全'],
    targetAudience: 'IT总监',
    aiSummary: '零信任架构实施方案',
    roiAnalysis: null, // 初始没有ROI分析
    rawContent: mockRawContent as RawContent,
  }

  const mockROIAnalysis = {
    estimatedCost: '50-100万',
    expectedBenefit: '年节省200万运维成本',
    roiEstimate: 'ROI 2:1',
    implementationPeriod: '3-6个月',
    recommendedVendors: ['阿里云', '腾讯云'],
  }

  const mockRadarPush: Partial<RadarPush> = {
    id: 'push-1',
    organizationId: 'org-123',
    contentId: 'analyzed-1',
    radarType: 'tech',
    relevanceScore: 0.95,
    priorityLevel: 'high',
    status: 'scheduled',
    analyzedContent: mockAnalyzedContent as AnalyzedContent,
  }

  const mockWeaknessSnapshot: Partial<WeaknessSnapshot> = {
    id: 'weakness-1',
    organizationId: 'org-123',
    category: WeaknessCategory.DATA_SECURITY,
  }

  beforeEach(async () => {
    const mockTasksGateway = {
      server: {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      },
    }

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
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: AIAnalysisService,
          useValue: {
            analyzeROI: jest.fn(),
          },
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
          useValue: mockTasksGateway,
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
    analyzedContentService = module.get<AnalyzedContentService>(AnalyzedContentService)
    aiAnalysisService = module.get<AIAnalysisService>(AIAnalysisService)
    tasksGateway = module.get<TasksGateway>(TasksGateway)
    weaknessSnapshotRepo = module.get<Repository<WeaknessSnapshot>>(
      getRepositoryToken(WeaknessSnapshot),
    )
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('sendPushViaWebSocket - ROI Analysis Integration', () => {
    it('应该在没有ROI分析时触发ROI分析（技术雷达）', async () => {
      // Arrange
      const pushWithoutROI = {
        ...mockRadarPush,
        analyzedContent: {
          ...mockAnalyzedContent,
          roiAnalysis: null, // 明确设置为null
        } as AnalyzedContent,
      }
      jest
        .spyOn(weaknessSnapshotRepo, 'find')
        .mockResolvedValue([mockWeaknessSnapshot as WeaknessSnapshot])
      jest.spyOn(aiAnalysisService, 'analyzeROI').mockResolvedValue(mockROIAnalysis)

      // Act
      await (processor as any).sendPushViaWebSocket(pushWithoutROI)

      // Assert
      expect(aiAnalysisService.analyzeROI).toHaveBeenCalledWith('analyzed-1', '数据安全')
      expect(tasksGateway.server.to).toHaveBeenCalledWith('org:org-123')
      expect(tasksGateway.server.emit).toHaveBeenCalledWith(
        'radar:push:new',
        expect.objectContaining({
          pushId: 'push-1',
          radarType: 'tech',
          roiAnalysis: mockROIAnalysis,
        }),
      )
    })

    it('应该在已有ROI分析时跳过ROI分析', async () => {
      // Arrange
      const pushWithROI = {
        ...mockRadarPush,
        analyzedContent: {
          ...mockAnalyzedContent,
          roiAnalysis: mockROIAnalysis,
        },
      }
      jest
        .spyOn(weaknessSnapshotRepo, 'find')
        .mockResolvedValue([mockWeaknessSnapshot as WeaknessSnapshot])

      // Act
      await (processor as any).sendPushViaWebSocket(pushWithROI)

      // Assert
      expect(aiAnalysisService.analyzeROI).not.toHaveBeenCalled()
      expect(tasksGateway.server.emit).toHaveBeenCalledWith(
        'radar:push:new',
        expect.objectContaining({
          roiAnalysis: mockROIAnalysis,
        }),
      )
    })

    it('应该在非技术雷达时跳过ROI分析', async () => {
      // Arrange
      const industryPush = {
        ...mockRadarPush,
        radarType: 'industry' as const,
        analyzedContent: {
          ...mockAnalyzedContent,
          roiAnalysis: null,
        } as AnalyzedContent,
      }
      jest
        .spyOn(weaknessSnapshotRepo, 'find')
        .mockResolvedValue([mockWeaknessSnapshot as WeaknessSnapshot])

      // Act
      await (processor as any).sendPushViaWebSocket(industryPush)

      // Assert
      expect(aiAnalysisService.analyzeROI).not.toHaveBeenCalled()
      expect(tasksGateway.server.emit).toHaveBeenCalledWith(
        'radar:push:new',
        expect.objectContaining({
          radarType: 'industry',
          roiAnalysis: null,
        }),
      )
    })

    it('应该在ROI分析失败时继续推送', async () => {
      // Arrange
      const pushWithoutROI = {
        ...mockRadarPush,
        analyzedContent: {
          ...mockAnalyzedContent,
          roiAnalysis: null,
        } as AnalyzedContent,
      }
      jest
        .spyOn(weaknessSnapshotRepo, 'find')
        .mockResolvedValue([mockWeaknessSnapshot as WeaknessSnapshot])
      jest.spyOn(aiAnalysisService, 'analyzeROI').mockRejectedValue(new Error('AI API timeout'))

      // Act & Assert - 不应抛出错误
      await expect((processor as any).sendPushViaWebSocket(pushWithoutROI)).resolves.not.toThrow()

      expect(aiAnalysisService.analyzeROI).toHaveBeenCalled()
      expect(tasksGateway.server.emit).toHaveBeenCalledWith(
        'radar:push:new',
        expect.objectContaining({
          pushId: 'push-1',
          roiAnalysis: null, // ROI分析失败，但推送仍然成功
        }),
      )
    })

    it('应该在WebSocket事件中包含ROI分析字段', async () => {
      // Arrange
      const pushWithoutROI = {
        ...mockRadarPush,
        analyzedContent: {
          ...mockAnalyzedContent,
          roiAnalysis: null,
        } as AnalyzedContent,
      }
      jest
        .spyOn(weaknessSnapshotRepo, 'find')
        .mockResolvedValue([mockWeaknessSnapshot as WeaknessSnapshot])
      jest.spyOn(aiAnalysisService, 'analyzeROI').mockResolvedValue(mockROIAnalysis)

      // Act
      await (processor as any).sendPushViaWebSocket(pushWithoutROI)

      // Assert
      expect(tasksGateway.server.emit).toHaveBeenCalledWith(
        'radar:push:new',
        expect.objectContaining({
          pushId: 'push-1',
          radarType: 'tech',
          title: '零信任架构实施方案',
          summary: '零信任架构实施方案',
          relevanceScore: 0.95,
          priorityLevel: 1, // high -> 1
          weaknessCategories: ['数据安全'],
          url: 'https://example.com/article',
          publishDate: mockRawContent.publishDate,
          source: '金融科技周刊',
          tags: ['零信任'],
          targetAudience: 'IT总监',
          roiAnalysis: mockROIAnalysis,
          timestamp: expect.any(String),
        }),
      )
    })

    it('应该在没有匹配薄弱项时使用undefined作为weaknessCategory', async () => {
      // Arrange
      const pushWithoutROI = {
        ...mockRadarPush,
        analyzedContent: {
          ...mockAnalyzedContent,
          roiAnalysis: null,
        } as AnalyzedContent,
      }
      jest.spyOn(weaknessSnapshotRepo, 'find').mockResolvedValue([]) // 没有薄弱项
      jest.spyOn(aiAnalysisService, 'analyzeROI').mockResolvedValue(mockROIAnalysis)

      // Act
      await (processor as any).sendPushViaWebSocket(pushWithoutROI)

      // Assert
      expect(aiAnalysisService.analyzeROI).toHaveBeenCalledWith('analyzed-1', undefined)
    })
  })
})
