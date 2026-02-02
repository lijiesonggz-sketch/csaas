import { Test, TestingModule } from '@nestjs/testing'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { getQueueToken } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { Repository } from 'typeorm'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Logger } from '@nestjs/common'

import { PlaybookGenerationProcessor } from './playbook-generation.processor'
import { AIAnalysisService } from '../services/ai-analysis.service'
import { RawContentService } from '../services/raw-content.service'
import { AnalyzedContentService } from '../services/analyzed-content.service'
import { RawContent } from '../../../database/entities/raw-content.entity'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'
import { RadarPush } from '../../../database/entities/radar-push.entity'

/**
 * PlaybookGenerationProcessor Tests (Story 4.2 - Phase 2.2)
 *
 * 测试异步剧本生成Worker
 */
describe('PlaybookGenerationProcessor', () => {
  let processor: PlaybookGenerationProcessor
  let aiAnalysisService: AIAnalysisService
  let analyzedContentService: AnalyzedContentService
  let rawContentService: RawContentService
  let radarPushRepository: Repository<RadarPush>

  const mockRawContent: Partial<RawContent> = {
    id: 'raw-content-uuid',
    title: '数据安全违规处罚案例',
    url: 'https://example.com/penalty',
    publishDate: new Date('2026-01-30'),
    fullContent: '某银行因数据安全管理不到位，被处以50万元罚款',
    organizationId: 'org-123',
    category: 'compliance',
    status: 'analyzed',
  }

  const mockAnalyzedContent: Partial<AnalyzedContent> = {
    id: 'analyzed-uuid',
    contentId: 'raw-content-uuid',
    complianceAnalysis: {
      complianceRiskCategory: '数据安全',
      penaltyCase: '某银行因数据安全管理不到位，被处以50万元罚款',
      policyRequirements: null,
      remediationSuggestions: '建立完善的数据分类分级制度',
      relatedWeaknessCategories: ['数据安全'],
    },
  }

  const mockRadarPush: Partial<RadarPush> = {
    id: 'push-uuid',
    contentId: 'raw-content-uuid',
    radarType: 'compliance',
    status: 'scheduled',
    playbookStatus: 'ready',
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaybookGenerationProcessor,
        {
          provide: getRepositoryToken(RawContent),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AnalyzedContent),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RadarPush),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: AIAnalysisService,
          useValue: {
            generateCompliancePlaybook: jest.fn(),
          },
        },
        {
          provide: RawContentService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: AnalyzedContentService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: getQueueToken('radar-crawler'),
          useValue: {
            client: Promise.resolve({
              get: jest.fn(),
              setex: jest.fn(),
            }),
          },
        },
      ],
    }).compile()

    processor = module.get<PlaybookGenerationProcessor>(PlaybookGenerationProcessor)
    aiAnalysisService = module.get<AIAnalysisService>(AIAnalysisService)
    analyzedContentService = module.get<AnalyzedContentService>(AnalyzedContentService)
    rawContentService = module.get<RawContentService>(RawContentService)
    radarPushRepository = module.get<Repository<RadarPush>>(getRepositoryToken(RadarPush))
  })

  describe('Async Playbook Generation', () => {
    it('should be defined', () => {
      expect(processor).toBeDefined()
    })

    it('should generate playbook and update RadarPush status to ready', async () => {
      // Arrange
      const jobData = {
        contentId: 'raw-content-uuid',
        analyzedContentId: 'analyzed-uuid',
      }

      const job = {
        data: jobData,
        attemptsMade: 0,
      } as Job<typeof jobData>

      const mockPlaybook = {
        checklistItems: [
          {
            id: 'item-1',
            text: '检查数据安全制度',
            category: '数据安全',
            checked: false,
            order: 1,
          },
        ],
        solutions: [
          {
            name: '升级安全系统',
            estimatedCost: 50000,
            expectedBenefit: 200000,
            roiScore: 7,
            implementationTime: '2个月',
          },
        ],
        reportTemplate: '合规自查报告',
        policyReference: [],
        generatedAt: new Date(),
      }

      jest.spyOn(rawContentService, 'findById').mockResolvedValue(mockRawContent as RawContent)
      jest
        .spyOn(analyzedContentService, 'findById')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)
      jest
        .spyOn(aiAnalysisService, 'generateCompliancePlaybook')
        .mockResolvedValue(mockPlaybook as any)
      jest.spyOn(radarPushRepository, 'findOne').mockResolvedValue(mockRadarPush as RadarPush)
      const updateSpy = jest.spyOn(radarPushRepository, 'update').mockResolvedValue(undefined)

      // Act
      await processor.process(job)

      // Assert
      expect(aiAnalysisService.generateCompliancePlaybook).toHaveBeenCalledWith(
        mockAnalyzedContent,
        mockRawContent,
      )
      expect(updateSpy).toHaveBeenCalledTimes(2) // generating → ready
      expect(updateSpy).toHaveBeenNthCalledWith(
        1,
        { contentId: 'raw-content-uuid' },
        {
          playbookStatus: 'generating',
        },
      )
      expect(updateSpy).toHaveBeenNthCalledWith(
        2,
        { contentId: 'raw-content-uuid' },
        {
          playbookStatus: 'ready',
        },
      )
    })

    it('should update status to failed on playbook generation error', async () => {
      // Arrange
      const jobData = {
        contentId: 'raw-content-uuid',
        analyzedContentId: 'analyzed-uuid',
      }

      const job = {
        data: jobData,
        attemptsMade: 0,
      } as Job<typeof jobData>

      jest.spyOn(rawContentService, 'findById').mockResolvedValue(mockRawContent as RawContent)
      jest
        .spyOn(analyzedContentService, 'findById')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)
      jest
        .spyOn(aiAnalysisService, 'generateCompliancePlaybook')
        .mockRejectedValue(new Error('AI service unavailable'))
      jest.spyOn(radarPushRepository, 'findOne').mockResolvedValue(mockRadarPush as RadarPush)
      const updateSpy = jest.spyOn(radarPushRepository, 'update').mockResolvedValue(undefined)

      // Act
      await processor.process(job)

      // Assert
      expect(updateSpy).toHaveBeenCalledWith(
        { contentId: 'raw-content-uuid' },
        {
          playbookStatus: 'failed',
        },
      )
    })

    it('should handle missing RadarPush gracefully', async () => {
      // Arrange
      const jobData = {
        contentId: 'raw-content-uuid',
        analyzedContentId: 'analyzed-uuid',
      }

      const job = {
        data: jobData,
        attemptsMade: 0,
      } as Job<typeof jobData>

      const mockPlaybook = {
        checklistItems: [],
        solutions: [],
        reportTemplate: 'Template',
        policyReference: [],
        generatedAt: new Date(),
      }

      jest.spyOn(rawContentService, 'findById').mockResolvedValue(mockRawContent as RawContent)
      jest
        .spyOn(analyzedContentService, 'findById')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)
      jest
        .spyOn(aiAnalysisService, 'generateCompliancePlaybook')
        .mockResolvedValue(mockPlaybook as any)
      jest.spyOn(radarPushRepository, 'findOne').mockResolvedValue(null)
      const updateSpy = jest.spyOn(radarPushRepository, 'update').mockResolvedValue(undefined)

      // Act
      await processor.process(job)

      // Assert - Should not throw, but log warning
      expect(updateSpy).not.toHaveBeenCalled()
    })

    it('should handle missing content gracefully', async () => {
      // Arrange
      const jobData = {
        contentId: 'non-existent-uuid',
        analyzedContentId: 'analyzed-uuid',
      }

      const job = {
        data: jobData,
        attemptsMade: 0,
      } as Job<typeof jobData>

      jest.spyOn(rawContentService, 'findById').mockResolvedValue(null)
      jest.spyOn(aiAnalysisService, 'generateCompliancePlaybook')

      // Act & Assert - Should return gracefully (not throw)
      await expect(processor.process(job)).resolves.toBeUndefined()
      expect(aiAnalysisService.generateCompliancePlaybook).not.toHaveBeenCalled()
    })

    it('should handle missing analyzedContent gracefully', async () => {
      // Arrange
      const jobData = {
        contentId: 'raw-content-uuid',
        analyzedContentId: 'non-existent-uuid',
      }

      const job = {
        data: jobData,
        attemptsMade: 0,
      } as Job<typeof jobData>

      jest.spyOn(rawContentService, 'findById').mockResolvedValue(mockRawContent as RawContent)
      jest.spyOn(analyzedContentService, 'findById').mockResolvedValue(null)
      jest.spyOn(aiAnalysisService, 'generateCompliancePlaybook')

      // Act & Assert - Should return gracefully (not throw)
      await expect(processor.process(job)).resolves.toBeUndefined()
      expect(aiAnalysisService.generateCompliancePlaybook).not.toHaveBeenCalled()
    })
  })

  describe('Status Transitions', () => {
    it('should transition status from ready to generating to ready', async () => {
      // Arrange
      const jobData = {
        contentId: 'raw-content-uuid',
        analyzedContentId: 'analyzed-uuid',
      }

      const job = {
        data: jobData,
        attemptsMade: 0,
      } as Job<typeof jobData>

      const mockPlaybook = {
        checklistItems: [
          {
            id: 'item-1',
            text: '检查项1',
            category: '数据安全',
            checked: false,
            order: 1,
          },
          {
            id: 'item-2',
            text: '检查项2',
            category: '数据安全',
            checked: false,
            order: 2,
          },
          {
            id: 'item-3',
            text: '检查项3',
            category: '数据安全',
            checked: false,
            order: 3,
          },
          {
            id: 'item-4',
            text: '检查项4',
            category: '数据安全',
            checked: false,
            order: 4,
          },
          {
            id: 'item-5',
            text: '检查项5',
            category: '数据安全',
            checked: false,
            order: 5,
          },
        ],
        solutions: [],
        reportTemplate: 'Template',
        policyReference: [],
        generatedAt: new Date(),
      }

      jest.spyOn(rawContentService, 'findById').mockResolvedValue(mockRawContent as RawContent)
      jest
        .spyOn(analyzedContentService, 'findById')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)
      jest
        .spyOn(aiAnalysisService, 'generateCompliancePlaybook')
        .mockResolvedValue(mockPlaybook as any)
      jest.spyOn(radarPushRepository, 'findOne').mockResolvedValue(mockRadarPush as RadarPush)
      const updateSpy = jest.spyOn(radarPushRepository, 'update').mockResolvedValue(undefined)

      // Act
      await processor.process(job)

      // Assert
      expect(updateSpy).toHaveBeenCalledTimes(2)
      expect(updateSpy).toHaveBeenNthCalledWith(
        1,
        { contentId: 'raw-content-uuid' },
        {
          playbookStatus: 'generating',
        },
      )
      expect(updateSpy).toHaveBeenNthCalledWith(
        2,
        { contentId: 'raw-content-uuid' },
        {
          playbookStatus: 'ready',
        },
      )
    })

    it('should transition status from ready to generating to failed on error', async () => {
      // Arrange
      const jobData = {
        contentId: 'raw-content-uuid',
        analyzedContentId: 'analyzed-uuid',
      }

      const job = {
        data: jobData,
        attemptsMade: 0,
      } as Job<typeof jobData>

      jest.spyOn(rawContentService, 'findById').mockResolvedValue(mockRawContent as RawContent)
      jest
        .spyOn(analyzedContentService, 'findById')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)
      jest
        .spyOn(aiAnalysisService, 'generateCompliancePlaybook')
        .mockRejectedValue(new Error('Playbook generation failed'))
      jest.spyOn(radarPushRepository, 'findOne').mockResolvedValue(mockRadarPush as RadarPush)
      const updateSpy = jest.spyOn(radarPushRepository, 'update').mockResolvedValue(undefined)

      // Act
      await processor.process(job)

      // Assert
      expect(updateSpy).toHaveBeenCalledTimes(2) // generating → failed
      expect(updateSpy).toHaveBeenNthCalledWith(
        1,
        { contentId: 'raw-content-uuid' },
        {
          playbookStatus: 'generating',
        },
      )
      expect(updateSpy).toHaveBeenNthCalledWith(
        2,
        { contentId: 'raw-content-uuid' },
        {
          playbookStatus: 'failed',
        },
      )
    })
  })

  describe('Error Handling', () => {
    it('should log errors without throwing', async () => {
      // Arrange
      const jobData = {
        contentId: 'raw-content-uuid',
        analyzedContentId: 'analyzed-uuid',
      }

      const job = {
        data: jobData,
        attemptsMade: 0,
      } as Job<typeof jobData>

      jest.spyOn(rawContentService, 'findById').mockResolvedValue(mockRawContent as RawContent)
      jest
        .spyOn(analyzedContentService, 'findById')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)
      jest
        .spyOn(aiAnalysisService, 'generateCompliancePlaybook')
        .mockRejectedValue(new Error('AI failure'))
      jest.spyOn(radarPushRepository, 'findOne').mockResolvedValue(mockRadarPush as RadarPush)
      jest.spyOn(radarPushRepository, 'update').mockResolvedValue(undefined)

      // Act & Assert - Should not throw
      await expect(processor.process(job)).resolves.toBeUndefined()
    })

    it('should handle database update errors gracefully', async () => {
      // Arrange
      const jobData = {
        contentId: 'raw-content-uuid',
        analyzedContentId: 'analyzed-uuid',
      }

      const job = {
        data: jobData,
        attemptsMade: 0,
      } as Job<typeof jobData>

      const mockPlaybook = {
        checklistItems: [
          {
            id: 'item-1',
            text: '检查项1',
            category: '数据安全',
            checked: false,
            order: 1,
          },
          {
            id: 'item-2',
            text: '检查项2',
            category: '数据安全',
            checked: false,
            order: 2,
          },
          {
            id: 'item-3',
            text: '检查项3',
            category: '数据安全',
            checked: false,
            order: 3,
          },
          {
            id: 'item-4',
            text: '检查项4',
            category: '数据安全',
            checked: false,
            order: 4,
          },
          {
            id: 'item-5',
            text: '检查项5',
            category: '数据安全',
            checked: false,
            order: 5,
          },
        ],
        solutions: [],
        reportTemplate: 'Template',
        policyReference: [],
        generatedAt: new Date(),
      }

      jest.spyOn(rawContentService, 'findById').mockResolvedValue(mockRawContent as RawContent)
      jest
        .spyOn(analyzedContentService, 'findById')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)
      jest
        .spyOn(aiAnalysisService, 'generateCompliancePlaybook')
        .mockResolvedValue(mockPlaybook as any)
      jest.spyOn(radarPushRepository, 'findOne').mockResolvedValue(mockRadarPush as RadarPush)
      jest
        .spyOn(radarPushRepository, 'update')
        .mockRejectedValue(new Error('Database connection lost'))

      // Act & Assert - Should not throw despite DB error
      await expect(processor.process(job)).resolves.toBeUndefined()
    })
  })
})
