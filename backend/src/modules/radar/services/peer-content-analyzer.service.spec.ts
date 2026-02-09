import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { BullModule, getQueueToken } from '@nestjs/bullmq'
import { Queue } from 'bullmq'

import { PeerContentAnalyzerService, PeerContentAnalysisResult } from './peer-content-analyzer.service'
import { RawContent } from '../../../database/entities/raw-content.entity'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'
import { Alert } from '../../../database/entities/alert.entity'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'
import { QualityValidationService, FullValidationReport } from '../../quality-validation/quality-validation.service'
import { ResultAggregatorService, AggregationOutput } from '../../result-aggregation/result-aggregator.service'
import { AIUsageService } from '../../admin/cost-optimization/ai-usage.service'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'
import { AIUsageTaskType } from '../../../database/entities/ai-usage-log.entity'

describe('PeerContentAnalyzerService', () => {
  let service: PeerContentAnalyzerService
  let rawContentRepository: jest.Mocked<Repository<RawContent>>
  let analyzedContentRepository: jest.Mocked<Repository<AnalyzedContent>>
  let alertRepository: jest.Mocked<Repository<Alert>>
  let aiOrchestrator: jest.Mocked<AIOrchestrator>
  let qualityValidationService: jest.Mocked<QualityValidationService>
  let resultAggregatorService: jest.Mocked<ResultAggregatorService>
  let pushGenerationQueue: jest.Mocked<Queue>
  let aiUsageService: jest.Mocked<AIUsageService>

  const mockRawContent: RawContent = {
    id: 'raw-content-1',
    source: 'peer-crawler',
    category: 'industry',
    title: '杭州银行容器化改造实践',
    summary: '杭州银行于2025年启动容器化改造项目',
    fullContent: '杭州银行采用Kubernetes实现容器化部署，部署时间从2小时缩短到10分钟。',
    url: 'https://example.com/article',
    publishDate: new Date('2025-01-01'),
    author: '张三',
    contentHash: 'abc123',
    status: 'pending',
    organizationId: null,
    contentType: 'article',
    peerName: '杭州银行',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockModelResult: PeerContentAnalysisResult = {
    practiceDescription: '杭州银行采用Kubernetes实现容器化部署',
    estimatedCost: '100-200万',
    implementationPeriod: '6-12个月',
    technicalEffect: '部署时间从2小时缩短到10分钟',
    keyTechnologies: ['Kubernetes', 'Docker'],
    applicableScenarios: '金融核心系统容器化',
    categories: ['云原生', '容器化'],
    keywords: ['Kubernetes', 'Docker', '容器'],
    tags: ['云原生', '杭州银行'],
    targetAudience: 'IT总监、架构师',
    aiSummary: '杭州银行通过Kubernetes实现容器化部署',
  }

  const mockValidationReport: FullValidationReport = {
    qualityScores: {
      structural: 0.95,
      semantic: 0.88,
      detail: 0.75,
    },
    consistencyReport: {
      structuralScore: 0.95,
      semanticScore: 0.88,
      detailScore: 0.75,
      overallScore: 0.87,
      agreements: ['Field practiceDescription: All models agree'],
      disagreements: [],
      highRiskDisagreements: [],
    },
    overallScore: 0.87,
    confidenceLevel: 'HIGH',
    passed: true,
  }

  const mockAggregationOutput: AggregationOutput = {
    selectedResult: mockModelResult,
    selectedModel: 'gpt4' as any,
    confidenceLevel: 'HIGH' as any,
    qualityScores: {
      structural: 0.95,
      semantic: 0.88,
      detail: 0.75,
    },
    consistencyReport: {
      agreements: ['Field practiceDescription: All models agree'],
      disagreements: [],
      highRiskDisagreements: [],
    },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        BullModule.registerQueue({
          name: 'radar-push-generation',
        }),
      ],
      providers: [
        PeerContentAnalyzerService,
        {
          provide: getRepositoryToken(RawContent),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AnalyzedContent),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Alert),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: AIOrchestrator,
          useValue: {
            generate: jest.fn(),
          },
        },
        {
          provide: QualityValidationService,
          useValue: {
            validateQuality: jest.fn(),
          },
        },
        {
          provide: ResultAggregatorService,
          useValue: {
            aggregate: jest.fn(),
          },
        },
        {
          provide: AIUsageService,
          useValue: {
            logAIUsage: jest.fn(),
          },
        },
        {
          provide: getQueueToken('radar-push-generation'),
          useValue: {
            add: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<PeerContentAnalyzerService>(PeerContentAnalyzerService)
    rawContentRepository = module.get(getRepositoryToken(RawContent))
    analyzedContentRepository = module.get(getRepositoryToken(AnalyzedContent))
    alertRepository = module.get(getRepositoryToken(Alert))
    aiOrchestrator = module.get(AIOrchestrator)
    qualityValidationService = module.get(QualityValidationService)
    resultAggregatorService = module.get(ResultAggregatorService)
    pushGenerationQueue = module.get(getQueueToken('radar-push-generation'))
    aiUsageService = module.get(AIUsageService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('analyzePeerContent', () => {
    it('should analyze peer content with high confidence (AC1, AC2, AC3)', async () => {
      // Arrange
      rawContentRepository.findOne.mockResolvedValue(mockRawContent)

      // Mock all three models returning successful results
      aiOrchestrator.generate
        .mockResolvedValueOnce({
          content: JSON.stringify(mockModelResult),
          tokens: { prompt: 1000, completion: 500, total: 1500 },
          model: 'gpt-4',
          cost: 0.05,
        })
        .mockResolvedValueOnce({
          content: JSON.stringify(mockModelResult),
          tokens: { prompt: 1000, completion: 500, total: 1500 },
          model: 'claude-3',
          cost: 0.04,
        })
        .mockResolvedValueOnce({
          content: JSON.stringify(mockModelResult),
          tokens: { prompt: 1000, completion: 500, total: 1500 },
          model: 'qwen-max',
          cost: 0.02,
        })

      qualityValidationService.validateQuality.mockResolvedValue(mockValidationReport)
      resultAggregatorService.aggregate.mockResolvedValue(mockAggregationOutput)

      const mockAnalyzedContent: Partial<AnalyzedContent> = {
        id: 'analyzed-1',
        contentId: mockRawContent.id,
        confidence: 'high',
        overallSimilarity: 0.87,
        qualityScores: mockValidationReport.qualityScores,
        selectedModel: 'gpt4',
        reviewStatus: 'approved',
      }

      analyzedContentRepository.create.mockReturnValue(mockAnalyzedContent as AnalyzedContent)
      analyzedContentRepository.save.mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      // Act
      const result = await service.analyzePeerContent(mockRawContent.id)

      // Assert
      expect(rawContentRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockRawContent.id },
      })

      // Verify three models were called (AC1)
      expect(aiOrchestrator.generate).toHaveBeenCalledTimes(3)

      // Verify quality validation was called (AC2)
      expect(qualityValidationService.validateQuality).toHaveBeenCalledWith({
        gpt4: expect.any(Object),
        claude: expect.any(Object),
        domestic: expect.any(Object),
      })

      // Verify high confidence result (AC3)
      expect(result.confidence).toBe('high')
      expect(result.overallSimilarity).toBe(0.87)
      expect(result.reviewStatus).toBe('approved')

      // Verify push generation was triggered (optional, queue may not be available in tests)
      // Queue verification skipped due to BullMQ connection requirements
    })

    it('should handle low confidence and create review alert (AC4)', async () => {
      // Arrange
      rawContentRepository.findOne.mockResolvedValue(mockRawContent)

      const lowConfidenceValidationReport: FullValidationReport = {
        qualityScores: {
          structural: 0.7,
          semantic: 0.6,
          detail: 0.5,
        },
        consistencyReport: {
          structuralScore: 0.7,
          semanticScore: 0.6,
          detailScore: 0.5,
          overallScore: 0.65,
          agreements: [],
          disagreements: ['Field estimatedCost: gpt4=100万, tongyi=200万'],
          highRiskDisagreements: [],
        },
        overallScore: 0.65,
        confidenceLevel: 'LOW',
        passed: false,
      }

      // Mock models returning different results (causing low confidence)
      const differentResult = { ...mockModelResult, estimatedCost: '200-300万' }

      aiOrchestrator.generate
        .mockResolvedValueOnce({
          content: JSON.stringify(mockModelResult),
          tokens: { prompt: 1000, completion: 500, total: 1500 },
          model: 'gpt-4',
          cost: 0.05,
        })
        .mockResolvedValueOnce({
          content: JSON.stringify(differentResult),
          tokens: { prompt: 1000, completion: 500, total: 1500 },
          model: 'claude-3',
          cost: 0.04,
        })
        .mockResolvedValueOnce({
          content: JSON.stringify(mockModelResult),
          tokens: { prompt: 1000, completion: 500, total: 1500 },
          model: 'qwen-max',
          cost: 0.02,
        })

      qualityValidationService.validateQuality.mockResolvedValue(lowConfidenceValidationReport)

      const mockAnalyzedContent: Partial<AnalyzedContent> = {
        id: 'analyzed-2',
        contentId: mockRawContent.id,
        confidence: 'low',
        overallSimilarity: 0.65,
        selectedModel: 'tongyi',
        reviewStatus: 'pending',
        discrepancies: ['Field estimatedCost: gpt4=100万, tongyi=200万'],
      }

      analyzedContentRepository.create.mockReturnValue(mockAnalyzedContent as AnalyzedContent)
      analyzedContentRepository.save.mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      const mockAlert: Partial<Alert> = {
        id: 'alert-1',
        alertType: 'peer_content_review',
        severity: 'medium',
      }

      alertRepository.create.mockReturnValue(mockAlert as Alert)
      alertRepository.save.mockResolvedValue(mockAlert as Alert)

      // Act
      const result = await service.analyzePeerContent(mockRawContent.id)

      // Assert
      expect(result.confidence).toBe('low')
      expect(result.reviewStatus).toBe('pending')
      expect(result.discrepancies).toContain('Field estimatedCost: gpt4=100万, tongyi=200万')

      // Verify alert was created (AC4)
      expect(alertRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        alertType: 'peer_content_review',
        severity: 'medium',
        status: 'unresolved',
      }))
      expect(alertRepository.save).toHaveBeenCalled()
    })

    it('should throw error when RawContent not found', async () => {
      // Arrange
      rawContentRepository.findOne.mockResolvedValue(null)

      // Act & Assert
      await expect(service.analyzePeerContent('non-existent-id')).rejects.toThrow(
        'RawContent not found: non-existent-id',
      )
    })

    it('should handle single model failure and continue with remaining models', async () => {
      // Arrange
      rawContentRepository.findOne.mockResolvedValue(mockRawContent)

      // GPT-4 fails, Claude and Tongyi succeed
      aiOrchestrator.generate
        .mockRejectedValueOnce(new Error('GPT-4 timeout'))
        .mockResolvedValueOnce({
          content: JSON.stringify(mockModelResult),
          tokens: { prompt: 1000, completion: 500, total: 1500 },
          model: 'claude-3',
          cost: 0.04,
        })
        .mockResolvedValueOnce({
          content: JSON.stringify(mockModelResult),
          tokens: { prompt: 1000, completion: 500, total: 1500 },
          model: 'qwen-max',
          cost: 0.02,
        })

      const mediumConfidenceReport: FullValidationReport = {
        qualityScores: {
          structural: 0.9,
          semantic: 0.85,
          detail: 0.7,
        },
        consistencyReport: {
          structuralScore: 0.9,
          semanticScore: 0.85,
          detailScore: 0.7,
          overallScore: 0.83,
          agreements: ['Field practiceDescription: All models agree'],
          disagreements: [],
          highRiskDisagreements: [],
        },
        overallScore: 0.83,
        confidenceLevel: 'MEDIUM',
        passed: true,
      }

      qualityValidationService.validateQuality.mockResolvedValue(mediumConfidenceReport)
      resultAggregatorService.aggregate.mockResolvedValue({
        ...mockAggregationOutput,
        selectedModel: 'claude' as any,
        confidenceLevel: 'MEDIUM' as any,
      })

      const mockAnalyzedContent: Partial<AnalyzedContent> = {
        id: 'analyzed-3',
        contentId: mockRawContent.id,
        confidence: 'medium',
        overallSimilarity: 0.83,
        selectedModel: 'claude',
        reviewStatus: 'approved',
      }

      analyzedContentRepository.create.mockReturnValue(mockAnalyzedContent as AnalyzedContent)
      analyzedContentRepository.save.mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      // Act
      const result = await service.analyzePeerContent(mockRawContent.id)

      // Assert
      expect(result.confidence).toBe('medium')
      expect(result.selectedModel).toBe('claude')
    })

    it('should fallback to Tongyi when all models have low confidence', async () => {
      // Arrange
      rawContentRepository.findOne.mockResolvedValue(mockRawContent)

      // All models return different results
      aiOrchestrator.generate
        .mockResolvedValueOnce({
          content: JSON.stringify({ ...mockModelResult, estimatedCost: '100万' }),
          tokens: { prompt: 1000, completion: 500, total: 1500 },
          model: 'gpt-4',
          cost: 0.05,
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({ ...mockModelResult, estimatedCost: '200万' }),
          tokens: { prompt: 1000, completion: 500, total: 1500 },
          model: 'claude-3',
          cost: 0.04,
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({ ...mockModelResult, estimatedCost: '300万' }),
          tokens: { prompt: 1000, completion: 500, total: 1500 },
          model: 'qwen-max',
          cost: 0.02,
        })

      const lowConfidenceReport: FullValidationReport = {
        qualityScores: {
          structural: 0.8,
          semantic: 0.7,
          detail: 0.5,
        },
        consistencyReport: {
          structuralScore: 0.8,
          semanticScore: 0.7,
          detailScore: 0.5,
          overallScore: 0.68,
          agreements: [],
          disagreements: [
            'Field estimatedCost: gpt4=100万, claude=200万, tongyi=300万',
          ],
          highRiskDisagreements: [],
        },
        overallScore: 0.68,
        confidenceLevel: 'LOW',
        passed: false,
      }

      qualityValidationService.validateQuality.mockResolvedValue(lowConfidenceReport)

      const mockAnalyzedContent: Partial<AnalyzedContent> = {
        id: 'analyzed-4',
        contentId: mockRawContent.id,
        confidence: 'low',
        overallSimilarity: 0.68,
        selectedModel: 'tongyi',
        reviewStatus: 'pending',
        discrepancies: ['Field estimatedCost: gpt4=100万, claude=200万, tongyi=300万'],
      }

      analyzedContentRepository.create.mockReturnValue(mockAnalyzedContent as AnalyzedContent)
      analyzedContentRepository.save.mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      alertRepository.create.mockReturnValue({ id: 'alert-2' } as Alert)
      alertRepository.save.mockResolvedValue({ id: 'alert-2' } as Alert)

      // Act
      const result = await service.analyzePeerContent(mockRawContent.id)

      // Assert
      expect(result.confidence).toBe('low')
      expect(result.selectedModel).toBe('tongyi') // Fallback to Tongyi
      expect(result.reviewStatus).toBe('pending')
    })
  })

  describe('AI usage logging', () => {
    it('should log AI usage for each successful model call', async () => {
      // Arrange
      rawContentRepository.findOne.mockResolvedValue(mockRawContent)

      aiOrchestrator.generate
        .mockResolvedValueOnce({
          content: JSON.stringify(mockModelResult),
          tokens: { prompt: 1000, completion: 500, total: 1500 },
          model: 'gpt-4',
          cost: 0.05,
        })
        .mockResolvedValueOnce({
          content: JSON.stringify(mockModelResult),
          tokens: { prompt: 1000, completion: 500, total: 1500 },
          model: 'claude-3',
          cost: 0.04,
        })
        .mockResolvedValueOnce({
          content: JSON.stringify(mockModelResult),
          tokens: { prompt: 1000, completion: 500, total: 1500 },
          model: 'qwen-max',
          cost: 0.02,
        })

      qualityValidationService.validateQuality.mockResolvedValue(mockValidationReport)
      resultAggregatorService.aggregate.mockResolvedValue(mockAggregationOutput)

      analyzedContentRepository.create.mockReturnValue({ id: 'analyzed-5' } as AnalyzedContent)
      analyzedContentRepository.save.mockResolvedValue({ id: 'analyzed-5' } as AnalyzedContent)

      // Act
      await service.analyzePeerContent(mockRawContent.id)

      // Assert
      expect(aiUsageService.logAIUsage).toHaveBeenCalledTimes(3)
      expect(aiUsageService.logAIUsage).toHaveBeenCalledWith(expect.objectContaining({
        organizationId: 'system',
        taskType: AIUsageTaskType.INDUSTRY_ANALYSIS,
      }))
    })

    it('should continue analysis even if AI usage logging fails', async () => {
      // Arrange
      rawContentRepository.findOne.mockResolvedValue(mockRawContent)

      aiOrchestrator.generate
        .mockResolvedValueOnce({
          content: JSON.stringify(mockModelResult),
          tokens: { prompt: 1000, completion: 500, total: 1500 },
          model: 'gpt-4',
          cost: 0.05,
        })
        .mockResolvedValueOnce({
          content: JSON.stringify(mockModelResult),
          tokens: { prompt: 1000, completion: 500, total: 1500 },
          model: 'claude-3',
          cost: 0.04,
        })
        .mockResolvedValueOnce({
          content: JSON.stringify(mockModelResult),
          tokens: { prompt: 1000, completion: 500, total: 1500 },
          model: 'qwen-max',
          cost: 0.02,
        })

      qualityValidationService.validateQuality.mockResolvedValue(mockValidationReport)
      resultAggregatorService.aggregate.mockResolvedValue(mockAggregationOutput)

      analyzedContentRepository.create.mockReturnValue({ id: 'analyzed-6' } as AnalyzedContent)
      analyzedContentRepository.save.mockResolvedValue({ id: 'analyzed-6' } as AnalyzedContent)

      aiUsageService.logAIUsage.mockRejectedValue(new Error('Logging service unavailable'))

      // Act & Assert - should not throw
      await expect(service.analyzePeerContent(mockRawContent.id)).resolves.not.toThrow()
    })
  })

  describe('Edge cases', () => {
    it('should handle all models failing', async () => {
      // Arrange
      rawContentRepository.findOne.mockResolvedValue(mockRawContent)

      // All models fail
      aiOrchestrator.generate
        .mockRejectedValueOnce(new Error('GPT-4 timeout'))
        .mockRejectedValueOnce(new Error('Claude timeout'))
        .mockRejectedValueOnce(new Error('Tongyi timeout'))

      // Act & Assert
      await expect(service.analyzePeerContent(mockRawContent.id)).rejects.toThrow(
        'All models failed, cannot create AnalyzedContent',
      )
    })

    it('should handle invalid JSON in AI response', async () => {
      // Arrange
      rawContentRepository.findOne.mockResolvedValue(mockRawContent)

      aiOrchestrator.generate
        .mockResolvedValueOnce({
          content: 'Invalid JSON response',
          tokens: { prompt: 1000, completion: 500, total: 1500 },
          model: 'gpt-4',
          cost: 0.05,
        })
        .mockResolvedValueOnce({
          content: JSON.stringify(mockModelResult),
          tokens: { prompt: 1000, completion: 500, total: 1500 },
          model: 'claude-3',
          cost: 0.04,
        })
        .mockResolvedValueOnce({
          content: JSON.stringify(mockModelResult),
          tokens: { prompt: 1000, completion: 500, total: 1500 },
          model: 'qwen-max',
          cost: 0.02,
        })

      const mediumConfidenceReport: FullValidationReport = {
        qualityScores: {
          structural: 0.9,
          semantic: 0.85,
          detail: 0.7,
        },
        consistencyReport: {
          structuralScore: 0.9,
          semanticScore: 0.85,
          detailScore: 0.7,
          overallScore: 0.83,
          agreements: ['Field practiceDescription: All models agree'],
          disagreements: [],
          highRiskDisagreements: [],
        },
        overallScore: 0.83,
        confidenceLevel: 'MEDIUM',
        passed: true,
      }

      qualityValidationService.validateQuality.mockResolvedValue(mediumConfidenceReport)
      resultAggregatorService.aggregate.mockResolvedValue({
        ...mockAggregationOutput,
        selectedModel: 'claude' as any,
      })

      analyzedContentRepository.create.mockReturnValue({ id: 'analyzed-7' } as AnalyzedContent)
      analyzedContentRepository.save.mockResolvedValue({ id: 'analyzed-7' } as AnalyzedContent)

      // Act
      const result = await service.analyzePeerContent(mockRawContent.id)

      // Assert
      expect(result).toBeDefined()
      expect(aiOrchestrator.generate).toHaveBeenCalledTimes(3)
    })
  })
})
