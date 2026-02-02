import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { getQueueToken } from '@nestjs/bullmq'
import { Repository } from 'typeorm'
import { Queue } from 'bullmq'

import { AIAnalysisService } from './ai-analysis.service'
import { RawContent } from '../../../database/entities/raw-content.entity'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'
import { TagService } from './tag.service'
import { AnalyzedContentService } from './analyzed-content.service'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'

/**
 * AIAnalysisService - ROI分析功能单元测试 (Story 2.4)
 *
 * 测试范围：
 * - analyzeROI() 成功场景
 * - Redis缓存命中
 * - AI API失败降级
 * - parseROIResponse() 边界情况
 */
describe('AIAnalysisService - ROI Analysis (Story 2.4)', () => {
  let service: AIAnalysisService
  let rawContentRepo: Repository<RawContent>
  let analyzedContentService: AnalyzedContentService
  let aiOrchestrator: AIOrchestrator
  let crawlerQueue: Queue
  let redisClient: any

  // Mock数据
  const mockRawContent: Partial<RawContent> = {
    id: 'raw-content-1',
    title: '零信任架构在金融行业的应用',
    summary: '介绍零信任架构的实施方案和成本收益分析',
    fullContent: '详细内容...',
    source: '金融科技周刊',
    publishDate: new Date('2024-01-15'),
    url: 'https://example.com/article',
    organizationId: 'org-123',
  }

  const mockAnalyzedContent: Partial<AnalyzedContent> = {
    id: 'analyzed-content-1',
    contentId: 'raw-content-1',
    tags: [],
    keywords: ['零信任', '安全架构'],
    categories: ['安全'],
    targetAudience: 'IT总监',
    aiSummary: '零信任架构实施方案',
    roiAnalysis: null,
    relevanceScore: null,
    aiModel: 'qwen-turbo',
    tokensUsed: 1500,
    status: 'success',
    analyzedAt: new Date(),
  }

  const mockROIAnalysis = {
    estimatedCost: '50-100万',
    expectedBenefit: '年节省200万运维成本 + 提升系统可用性',
    roiEstimate: 'ROI 2:1',
    implementationPeriod: '3-6个月',
    recommendedVendors: ['阿里云', '腾讯云', '华为云'],
  }

  const mockAIResponse = {
    content: JSON.stringify(mockROIAnalysis),
    model: 'qwen-turbo',
    tokens: {
      prompt: 1000,
      completion: 500,
      total: 1500,
    },
    cost: 0.003, // 添加 cost 字段
  }

  beforeEach(async () => {
    // Mock Redis客户端
    redisClient = {
      get: jest.fn(),
      setex: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIAnalysisService,
        {
          provide: getRepositoryToken(RawContent),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getQueueToken('radar:crawler'),
          useValue: {
            client: Promise.resolve(redisClient),
          },
        },
        {
          provide: AIOrchestrator,
          useValue: {
            generate: jest.fn(),
          },
        },
        {
          provide: TagService,
          useValue: {
            findOrCreate: jest.fn(),
          },
        },
        {
          provide: AnalyzedContentService,
          useValue: {
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<AIAnalysisService>(AIAnalysisService)
    rawContentRepo = module.get<Repository<RawContent>>(getRepositoryToken(RawContent))
    analyzedContentService = module.get<AnalyzedContentService>(AnalyzedContentService)
    aiOrchestrator = module.get<AIOrchestrator>(AIOrchestrator)
    crawlerQueue = module.get<Queue>(getQueueToken('radar:crawler'))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('analyzeROI', () => {
    it('应该成功分析ROI并返回结果', async () => {
      // Arrange
      jest
        .spyOn(analyzedContentService, 'findById')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)
      jest.spyOn(rawContentRepo, 'findOne').mockResolvedValue(mockRawContent as RawContent)
      redisClient.get.mockResolvedValue(null) // 缓存未命中
      jest.spyOn(aiOrchestrator, 'generate').mockResolvedValue(mockAIResponse)
      jest.spyOn(analyzedContentService, 'update').mockResolvedValue(undefined)

      // Act
      const result = await service.analyzeROI('analyzed-content-1', '数据安全')

      // Assert
      expect(result).toEqual(mockROIAnalysis)
      expect(analyzedContentService.findById).toHaveBeenCalledWith('analyzed-content-1')
      expect(rawContentRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'raw-content-1' },
      })
      expect(redisClient.get).toHaveBeenCalledWith('radar:roi:org-123:analyzed-content-1:数据安全')
      expect(aiOrchestrator.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: '',
          temperature: 0.3,
        }),
        AIModel.DOMESTIC,
      )
      expect(redisClient.setex).toHaveBeenCalledWith(
        'radar:roi:org-123:analyzed-content-1:数据安全',
        7 * 24 * 60 * 60, // 7天TTL
        JSON.stringify(mockROIAnalysis),
      )
      expect(analyzedContentService.update).toHaveBeenCalledWith('analyzed-content-1', {
        roiAnalysis: mockROIAnalysis,
      })
    })

    it('应该从Redis缓存中返回结果', async () => {
      // Arrange
      jest
        .spyOn(analyzedContentService, 'findById')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)
      jest.spyOn(rawContentRepo, 'findOne').mockResolvedValue(mockRawContent as RawContent)
      redisClient.get.mockResolvedValue(JSON.stringify(mockROIAnalysis)) // 缓存命中

      // Act
      const result = await service.analyzeROI('analyzed-content-1')

      // Assert
      expect(result).toEqual(mockROIAnalysis)
      expect(redisClient.get).toHaveBeenCalledWith('radar:roi:org-123:analyzed-content-1:general')
      expect(aiOrchestrator.generate).not.toHaveBeenCalled() // 不应调用AI
      expect(analyzedContentService.update).not.toHaveBeenCalled() // 不应更新数据库
    })

    it('应该在AnalyzedContent不存在时抛出错误', async () => {
      // Arrange
      jest.spyOn(analyzedContentService, 'findById').mockResolvedValue(null)

      // Act & Assert
      await expect(service.analyzeROI('non-existent-id')).rejects.toThrow(
        'AnalyzedContent not found: non-existent-id',
      )
    })

    it('应该在RawContent不存在时抛出错误', async () => {
      // Arrange
      jest
        .spyOn(analyzedContentService, 'findById')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)
      jest.spyOn(rawContentRepo, 'findOne').mockResolvedValue(null)

      // Act & Assert
      await expect(service.analyzeROI('analyzed-content-1')).rejects.toThrow(
        'RawContent not found: raw-content-1',
      )
    })

    it('应该在AI API失败时抛出错误', async () => {
      // Arrange
      jest
        .spyOn(analyzedContentService, 'findById')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)
      jest.spyOn(rawContentRepo, 'findOne').mockResolvedValue(mockRawContent as RawContent)
      redisClient.get.mockResolvedValue(null)
      jest.spyOn(aiOrchestrator, 'generate').mockRejectedValue(new Error('AI API timeout'))

      // Act & Assert
      await expect(service.analyzeROI('analyzed-content-1')).rejects.toThrow('AI API timeout')
    })
  })

  describe('parseROIResponse', () => {
    it('应该成功解析有效的JSON响应', () => {
      // Arrange
      const validResponse = JSON.stringify(mockROIAnalysis)

      // Act
      const result = (service as any).parseROIResponse(validResponse)

      // Assert
      expect(result).toEqual(mockROIAnalysis)
    })

    it('应该在缺少必填字段时返回降级结果', () => {
      // Arrange
      const incompleteResponse = JSON.stringify({
        estimatedCost: '50-100万',
        // 缺少 expectedBenefit 和 roiEstimate
      })

      // Act
      const result = (service as any).parseROIResponse(incompleteResponse)

      // Assert
      expect(result).toEqual({
        estimatedCost: '需进一步评估',
        expectedBenefit: '需进一步评估',
        roiEstimate: '需进一步评估',
        implementationPeriod: '需进一步评估',
        recommendedVendors: [],
      })
    })

    it('应该在JSON解析失败时返回降级结果', () => {
      // Arrange
      const invalidResponse = 'This is not JSON'

      // Act
      const result = (service as any).parseROIResponse(invalidResponse)

      // Assert
      expect(result).toEqual({
        estimatedCost: '需进一步评估',
        expectedBenefit: '需进一步评估',
        roiEstimate: '需进一步评估',
        implementationPeriod: '需进一步评估',
        recommendedVendors: [],
      })
    })

    it('应该为可选字段提供默认值', () => {
      // Arrange
      const minimalResponse = JSON.stringify({
        estimatedCost: '50-100万',
        expectedBenefit: '年节省200万',
        roiEstimate: 'ROI 2:1',
        // 缺少 implementationPeriod 和 recommendedVendors
      })

      // Act
      const result = (service as any).parseROIResponse(minimalResponse)

      // Assert
      expect(result).toEqual({
        estimatedCost: '50-100万',
        expectedBenefit: '年节省200万',
        roiEstimate: 'ROI 2:1',
        implementationPeriod: '需进一步评估',
        recommendedVendors: [],
      })
    })
  })

  describe('getROIAnalysisPrompt', () => {
    it('应该生成包含薄弱项的Prompt', () => {
      // Act
      const prompt = (service as any).getROIAnalysisPrompt(mockRawContent, '数据安全')

      // Assert
      expect(prompt).toContain('零信任架构在金融行业的应用')
      expect(prompt).toContain('介绍零信任架构的实施方案和成本收益分析')
      expect(prompt).toContain('关联薄弱项：数据安全')
      expect(prompt).toContain('estimatedCost')
      expect(prompt).toContain('expectedBenefit')
      expect(prompt).toContain('roiEstimate')
      expect(prompt).toContain('implementationPeriod')
      expect(prompt).toContain('recommendedVendors')
    })

    it('应该生成不包含薄弱项的Prompt', () => {
      // Act
      const prompt = (service as any).getROIAnalysisPrompt(mockRawContent)

      // Assert
      expect(prompt).toContain('零信任架构在金融行业的应用')
      expect(prompt).not.toContain('关联薄弱项')
    })
  })
})
