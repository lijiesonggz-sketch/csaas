import { Test, TestingModule } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { Queue, Job } from 'bullmq'
import { AIAnalysisProcessor } from './ai-analysis.processor'
import { AIAnalysisService } from '../services/ai-analysis.service'
import { RawContentService } from '../services/raw-content.service'
import { AnalyzedContentService } from '../services/analyzed-content.service'
import { Repository } from 'typeorm'
import { getRepositoryToken } from '@nestjs/typeorm'
import { RawContent } from '../../../database/entities/raw-content.entity'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'

/**
 * AIAnalysisProcessor - Compliance Playbook Tests (Story 4.2 - Phase 2.2)
 *
 * 测试异步剧本生成流程
 */
describe('AIAnalysisProcessor - Compliance Playbook (Phase 2.2)', () => {
  let processor: AIAnalysisProcessor
  let aiAnalysisService: AIAnalysisService
  let rawContentService: RawContentService
  let pushScheduleQueue: Queue
  let playbookQueue: Queue

  const mockRawContent: Partial<RawContent> = {
    id: 'raw-content-uuid',
    title: '数据安全违规处罚案例',
    url: 'https://example.com/penalty',
    publishDate: new Date('2026-01-30'),
    fullContent: '某银行因数据安全管理不到位，被处以50万元罚款',
    organizationId: 'org-123',
    category: 'compliance',
    status: 'pending',
  }

  const mockAnalyzedContent: Partial<AnalyzedContent> = {
    id: 'analyzed-uuid',
    contentId: 'raw-content-uuid',
    tags: [],
    keywords: [],
    categories: [],
    targetAudience: 'IT部门',
    aiSummary: '测试摘要',
    roiAnalysis: null,
    relevanceScore: null,
    practiceDescription: null,
    estimatedCost: null,
    implementationPeriod: null,
    technicalEffect: null,
    complianceAnalysis: {
      complianceRiskCategory: '数据安全',
      penaltyCase: '某银行因数据安全管理不到位，被处以50万元罚款',
      policyRequirements: null,
      remediationSuggestions: '建立完善的数据分类分级制度',
      relatedWeaknessCategories: ['数据安全'],
    },
    aiModel: 'qwen-turbo',
    tokensUsed: 1000,
    status: 'success',
    analyzedAt: new Date(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIAnalysisProcessor,
        {
          provide: getRepositoryToken(RawContent),
          useValue: {
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
          provide: AIAnalysisService,
          useValue: {
            analyzeWithCache: jest.fn(),
            generateCompliancePlaybook: jest.fn(),
          },
        },
        {
          provide: RawContentService,
          useValue: {
            findById: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: AnalyzedContentService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: getQueueToken('radar-push'),
          useValue: {
            add: jest.fn(),
          },
        },
        {
          provide: getQueueToken('radar-playbook-generation'),
          useValue: {
            add: jest.fn(),
          },
        },
      ],
    }).compile()

    processor = module.get<AIAnalysisProcessor>(AIAnalysisProcessor)
    aiAnalysisService = module.get<AIAnalysisService>(AIAnalysisService)
    rawContentService = module.get<RawContentService>(RawContentService)
    pushScheduleQueue = module.get<Queue>(getQueueToken('radar-push'))
    playbookQueue = module.get<Queue>(getQueueToken('radar-playbook-generation'))
  })

  describe('Task 2.2: 异步剧本生成流程', () => {
    it('should create playbook generation job for compliance content', async () => {
      // Arrange
      const jobData = {
        contentId: 'raw-content-uuid',
        category: 'compliance' as const,
        priority: 'high' as const,
      }

      const job = {
        data: jobData,
        attemptsMade: 0,
      } as Job<typeof jobData>

      jest.spyOn(rawContentService, 'findById').mockResolvedValue(mockRawContent as RawContent)
      jest.spyOn(rawContentService, 'updateStatus').mockResolvedValue(undefined)
      jest
        .spyOn(aiAnalysisService, 'analyzeWithCache')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)
      jest.spyOn(playbookQueue, 'add').mockResolvedValue({} as any)
      jest.spyOn(pushScheduleQueue, 'add').mockResolvedValue({} as any)

      // Act
      const result = await processor.process(job)

      // Assert
      expect(result.success).toBe(true)
      expect(playbookQueue.add).toHaveBeenCalledWith(
        'generate-playbook',
        {
          contentId: 'raw-content-uuid',
          analyzedContentId: 'analyzed-uuid',
        },
        {
          priority: 1, // compliance = high priority
          jobId: 'playbook-raw-content-uuid',
        },
      )
      expect(pushScheduleQueue.add).toHaveBeenCalled()
    })

    it('should NOT create playbook job for non-compliance content', async () => {
      // Arrange
      const jobData = {
        contentId: 'raw-content-uuid',
        category: 'tech' as const,
        priority: 'normal' as const,
      }

      const job = {
        data: jobData,
        attemptsMade: 0,
      } as Job<typeof jobData>

      jest.spyOn(rawContentService, 'findById').mockResolvedValue(mockRawContent as RawContent)
      jest.spyOn(rawContentService, 'updateStatus').mockResolvedValue(undefined)
      jest
        .spyOn(aiAnalysisService, 'analyzeWithCache')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)
      jest.spyOn(playbookQueue, 'add').mockResolvedValue({} as any)
      jest.spyOn(pushScheduleQueue, 'add').mockResolvedValue({} as any)

      // Act
      const result = await processor.process(job)

      // Assert
      expect(result.success).toBe(true)
      expect(playbookQueue.add).not.toHaveBeenCalled()
      expect(pushScheduleQueue.add).toHaveBeenCalled()
    })

    it('should handle compliance content analysis failure gracefully', async () => {
      // Arrange
      const jobData = {
        contentId: 'raw-content-uuid',
        category: 'compliance' as const,
        priority: 'high' as const,
      }

      const job = {
        data: jobData,
        attemptsMade: 0,
      } as Job<typeof jobData>

      jest.spyOn(rawContentService, 'findById').mockResolvedValue(mockRawContent as RawContent)
      jest.spyOn(rawContentService, 'updateStatus').mockResolvedValue(undefined)
      jest
        .spyOn(aiAnalysisService, 'analyzeWithCache')
        .mockRejectedValue(new Error('AI service unavailable'))

      // Act & Assert
      await expect(processor.process(job)).rejects.toThrow()
      expect(rawContentService.updateStatus).toHaveBeenCalledWith('raw-content-uuid', 'failed')
    })

    it('should create playbook job with correct priority', async () => {
      // Arrange - Test all radar types
      const testCases = [
        { category: 'compliance' as const, expectedPriority: 1 },
        { category: 'industry' as const, expectedPriority: 2 },
        { category: 'tech' as const, expectedPriority: 3 },
      ]

      for (const testCase of testCases) {
        // Reset mocks
        jest.clearAllMocks()

        const jobData = {
          contentId: 'raw-content-uuid',
          category: testCase.category,
          priority: 'normal' as const,
        }

        const job = {
          data: jobData,
          attemptsMade: 0,
        } as Job<typeof jobData>

        jest
          .spyOn(rawContentService, 'findById')
          .mockResolvedValue({ ...mockRawContent, category: testCase.category } as any)
        jest.spyOn(rawContentService, 'updateStatus').mockResolvedValue(undefined)
        jest
          .spyOn(aiAnalysisService, 'analyzeWithCache')
          .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

        const addMock = jest.spyOn(playbookQueue, 'add').mockResolvedValue({} as any)
        jest.spyOn(pushScheduleQueue, 'add').mockResolvedValue({} as any)

        // Act
        await processor.process(job)

        // Assert - only compliance should create playbook job
        if (testCase.category === 'compliance') {
          expect(addMock).toHaveBeenCalledWith(
            'generate-playbook',
            expect.any(Object),
            expect.objectContaining({
              priority: testCase.expectedPriority,
            }),
          )
        } else {
          expect(addMock).not.toHaveBeenCalled()
        }
      }
    })

    it('should handle playbook queue creation failure', async () => {
      // Arrange
      const jobData = {
        contentId: 'raw-content-uuid',
        category: 'compliance' as const,
        priority: 'high' as const,
      }

      const job = {
        data: jobData,
        attemptsMade: 0,
      } as Job<typeof jobData>

      jest.spyOn(rawContentService, 'findById').mockResolvedValue(mockRawContent as RawContent)
      jest.spyOn(rawContentService, 'updateStatus').mockResolvedValue(undefined)
      jest
        .spyOn(aiAnalysisService, 'analyzeWithCache')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)
      jest.spyOn(pushScheduleQueue, 'add').mockResolvedValue({} as any)

      // Mock playbook queue failure
      jest.spyOn(playbookQueue, 'add').mockRejectedValue(new Error('Queue unavailable'))

      // Act & Assert - Should still complete successfully, push queue should be created
      await expect(processor.process(job)).resolves.toEqual({
        success: true,
        analyzedContentId: 'analyzed-uuid',
        tokensUsed: 1000,
      })
    })
  })

  describe('Async Playbook Generation Flow', () => {
    it('should trigger playbook generation after AI analysis', async () => {
      // Arrange
      const jobData = {
        contentId: 'raw-content-uuid',
        category: 'compliance' as const,
        priority: 'high' as const,
      }

      const job = {
        data: jobData,
        attemptsMade: 0,
      } as Job<typeof jobData>

      const playbookQueueAddSpy = jest.spyOn(playbookQueue, 'add').mockResolvedValue({} as any)

      jest.spyOn(rawContentService, 'findById').mockResolvedValue(mockRawContent as RawContent)
      jest.spyOn(rawContentService, 'updateStatus').mockResolvedValue(undefined)
      jest
        .spyOn(aiAnalysisService, 'analyzeWithCache')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)
      jest.spyOn(pushScheduleQueue, 'add').mockResolvedValue({} as any)

      // Act
      await processor.process(job)

      // Assert
      expect(playbookQueueAddSpy).toHaveBeenCalledTimes(1)
      expect(playbookQueueAddSpy).toHaveBeenCalledWith(
        'generate-playbook',
        {
          contentId: 'raw-content-uuid',
          analyzedContentId: 'analyzed-uuid',
        },
        {
          priority: 1,
          jobId: 'playbook-raw-content-uuid',
        },
      )
    })

    it('should continue with push scheduling even if playbook generation fails', async () => {
      // Arrange
      const jobData = {
        contentId: 'raw-content-uuid',
        category: 'compliance' as const,
        priority: 'high' as const,
      }

      const job = {
        data: jobData,
        attemptsMade: 0,
      } as Job<typeof jobData>

      jest.spyOn(rawContentService, 'findById').mockResolvedValue(mockRawContent as RawContent)
      jest.spyOn(rawContentService, 'updateStatus').mockResolvedValue(undefined)
      jest
        .spyOn(aiAnalysisService, 'analyzeWithCache')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      // Mock playbook queue failure
      jest.spyOn(playbookQueue, 'add').mockRejectedValue(new Error('Playbook queue error'))

      const pushQueueAddSpy = jest.spyOn(pushScheduleQueue, 'add').mockResolvedValue({} as any)

      // Act
      const result = await processor.process(job)

      // Assert - Should still create push schedule job
      expect(result.success).toBe(true)
      expect(pushQueueAddSpy).toHaveBeenCalled()
    })
  })

  describe('Status Management', () => {
    it('should update RawContent status through analysis lifecycle', async () => {
      // Arrange
      const jobData = {
        contentId: 'raw-content-uuid',
        category: 'compliance' as const,
        priority: 'high' as const,
      }

      const job = {
        data: jobData,
        attemptsMade: 0,
      } as Job<typeof jobData>

      const updateStatusSpy = jest
        .spyOn(rawContentService, 'updateStatus')
        .mockResolvedValue(undefined)

      jest.spyOn(rawContentService, 'findById').mockResolvedValue(mockRawContent as RawContent)
      jest
        .spyOn(aiAnalysisService, 'analyzeWithCache')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)
      jest.spyOn(playbookQueue, 'add').mockResolvedValue({} as any)
      jest.spyOn(pushScheduleQueue, 'add').mockResolvedValue({} as any)

      // Act
      await processor.process(job)

      // Assert
      expect(updateStatusSpy).toHaveBeenCalledWith('raw-content-uuid', 'analyzing')
      expect(updateStatusSpy).toHaveBeenCalledWith('raw-content-uuid', 'analyzed')
      expect(updateStatusSpy).toHaveBeenCalledTimes(2)
    })

    it('should update status to failed on analysis error', async () => {
      // Arrange
      const jobData = {
        contentId: 'raw-content-uuid',
        category: 'compliance' as const,
        priority: 'high' as const,
      }

      const job = {
        data: jobData,
        attemptsMade: 0,
      } as Job<typeof jobData>

      const updateStatusSpy = jest
        .spyOn(rawContentService, 'updateStatus')
        .mockResolvedValue(undefined)

      jest.spyOn(rawContentService, 'findById').mockResolvedValue(mockRawContent as RawContent)
      jest
        .spyOn(aiAnalysisService, 'analyzeWithCache')
        .mockRejectedValue(new Error('AI analysis failed'))

      // Act & Assert
      await expect(processor.process(job)).rejects.toThrow()
      expect(updateStatusSpy).toHaveBeenCalledWith('raw-content-uuid', 'failed')
    })
  })
})
