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
import { AIUsageService } from '../../admin/cost-optimization/ai-usage.service'

/**
 * Story 3.2: 测试AI分析服务对行业雷达的支持
 *
 * 测试场景:
 * 1. 行业雷达提示词正确生成
 * 2. AI响应正确解析行业雷达字段
 * 3. AnalyzedContent正确保存行业雷达字段
 */
describe('AIAnalysisService - Industry Radar (Story 3.2)', () => {
  let service: AIAnalysisService
  let rawContentRepo: Repository<RawContent>
  let aiOrchestrator: AIOrchestrator
  let analyzedContentService: AnalyzedContentService
  let tagService: TagService
  let crawlerQueue: Queue

  // Mock数据
  const mockRawContent: RawContent = {
    id: 'test-content-id',
    source: '杭州银行招聘',
    category: 'industry',
    title: '杭州银行容器化改造项目',
    summary: '杭州银行启动容器化改造,采用Kubernetes平台',
    fullContent: `杭州银行于2025年启动容器化改造项目,采用Kubernetes作为容器编排平台。
项目投入约120万,历时6个月完成。
实施后,应用部署时间从2小时缩短到10分钟,运维效率提升60%。`,
    url: 'https://example.com/hangzhou-bank-k8s',
    publishDate: new Date('2025-01-15'),
    author: null,
    contentHash: 'test-hash',
    status: 'pending',
    organizationId: null,
    contentType: 'recruitment',
    peerName: '杭州银行',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockAIResponse = {
    content: JSON.stringify({
      practiceDescription:
        '杭州银行于2025年启动容器化改造项目,采用Kubernetes作为容器编排平台,实现应用的快速部署和弹性伸缩。项目分三期实施,首期完成核心业务系统容器化,建立CI/CD流水线。',
      estimatedCost: '120万',
      implementationPeriod: '6个月',
      technicalEffect: '应用部署时间从2小时缩短到10分钟,运维效率提升60%,资源利用率提升40%',
      categories: ['云原生', '容器化', 'DevOps'],
      keywords: ['Kubernetes', 'Docker', '微服务', 'CI/CD'],
      tags: ['云原生', '杭州银行', '容器化'],
      targetAudience: 'IT总监、架构师',
      aiSummary: '杭州银行通过容器化改造实现应用快速部署,显著提升运维效率和资源利用率',
    }),
    model: 'qwen-turbo',
    tokens: {
      prompt: 500,
      completion: 300,
      total: 800,
    },
    cost: 0.008, // 添加cost字段
  }

  const mockAnalyzedContent: AnalyzedContent = {
    id: 'test-analyzed-id',
    contentId: 'test-content-id',
    keywords: ['Kubernetes', 'Docker', '微服务', 'CI/CD'],
    categories: ['云原生', '容器化', 'DevOps'],
    targetAudience: 'IT总监、架构师',
    aiSummary: '杭州银行通过容器化改造实现应用快速部署,显著提升运维效率和资源利用率',
    roiAnalysis: null,
    relevanceScore: null,
    practiceDescription:
      '杭州银行于2025年启动容器化改造项目,采用Kubernetes作为容器编排平台,实现应用的快速部署和弹性伸缩。项目分三期实施,首期完成核心业务系统容器化,建立CI/CD流水线。',
    estimatedCost: '120万',
    implementationPeriod: '6个月',
    technicalEffect: '应用部署时间从2小时缩短到10分钟,运维效率提升60%,资源利用率提升40%',
    aiModel: 'qwen-turbo',
    tokensUsed: 800,
    status: 'success',
    errorMessage: null,
    analyzedAt: new Date(),
    createdAt: new Date(),
    tags: [],
    rawContent: mockRawContent,
  }

  beforeEach(async () => {
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
          provide: getQueueToken('radar-crawler'),
          useValue: {
            client: {
              get: jest.fn().mockResolvedValue(null),
              setex: jest.fn().mockResolvedValue('OK'),
            },
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
            findOrCreate: jest.fn().mockResolvedValue({ id: 'tag-id', name: 'test-tag' }),
          },
        },
        {
          provide: AnalyzedContentService,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: AIUsageService,
          useValue: {
            logAIUsage: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<AIAnalysisService>(AIAnalysisService)
    rawContentRepo = module.get<Repository<RawContent>>(getRepositoryToken(RawContent))
    aiOrchestrator = module.get<AIOrchestrator>(AIOrchestrator)
    analyzedContentService = module.get<AnalyzedContentService>(AnalyzedContentService)
    tagService = module.get<TagService>(TagService)
    crawlerQueue = module.get<Queue>(getQueueToken('radar-crawler'))
  })

  describe('analyze - Industry Radar', () => {
    it('应该使用行业雷达提示词分析内容', async () => {
      // Arrange
      jest.spyOn(aiOrchestrator, 'generate').mockResolvedValue(mockAIResponse)
      jest.spyOn(analyzedContentService, 'create').mockResolvedValue(mockAnalyzedContent)

      // Act
      await service.analyze(mockRawContent, 'industry')

      // Assert
      expect(aiOrchestrator.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('同业技术实践案例'),
          temperature: 0.3,
        }),
        AIModel.DOMESTIC,
      )
    })

    it('应该正确解析AI响应中的行业雷达字段', async () => {
      // Arrange
      jest.spyOn(aiOrchestrator, 'generate').mockResolvedValue(mockAIResponse)
      jest.spyOn(analyzedContentService, 'create').mockResolvedValue(mockAnalyzedContent)

      // Act
      await service.analyze(mockRawContent, 'industry')

      // Assert
      expect(analyzedContentService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          practiceDescription: expect.stringContaining('杭州银行于2025年启动容器化改造项目'),
          estimatedCost: '120万',
          implementationPeriod: '6个月',
          technicalEffect: expect.stringContaining('应用部署时间从2小时缩短到10分钟'),
        }),
      )
    })

    it('应该在格式化内容时包含peerName', async () => {
      // Arrange
      jest.spyOn(aiOrchestrator, 'generate').mockResolvedValue(mockAIResponse)
      jest.spyOn(analyzedContentService, 'create').mockResolvedValue(mockAnalyzedContent)

      // Act
      await service.analyze(mockRawContent, 'industry')

      // Assert
      expect(aiOrchestrator.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('同业机构：杭州银行'),
        }),
        AIModel.DOMESTIC,
      )
    })

    it('应该正确处理缺失的行业雷达字段', async () => {
      // Arrange
      const incompleteResponse = {
        ...mockAIResponse,
        content: JSON.stringify({
          practiceDescription: '技术实践描述',
          estimatedCost: null, // 成本未提及
          implementationPeriod: null, // 周期未提及
          technicalEffect: null, // 效果未提及
          categories: ['云原生'],
          keywords: ['Kubernetes'],
          tags: ['云原生'],
          targetAudience: 'IT总监',
          aiSummary: '摘要',
        }),
      }

      jest.spyOn(aiOrchestrator, 'generate').mockResolvedValue(incompleteResponse)
      jest.spyOn(analyzedContentService, 'create').mockResolvedValue(mockAnalyzedContent)

      // Act
      await service.analyze(mockRawContent, 'industry')

      // Assert
      expect(analyzedContentService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          practiceDescription: '技术实践描述',
          estimatedCost: null,
          implementationPeriod: null,
          technicalEffect: null,
        }),
      )
    })

    it('应该在AI响应解析失败时返回null值', async () => {
      // Arrange
      const invalidResponse = {
        ...mockAIResponse,
        content: 'invalid json',
      }

      jest.spyOn(aiOrchestrator, 'generate').mockResolvedValue(invalidResponse)
      jest.spyOn(analyzedContentService, 'create').mockResolvedValue(mockAnalyzedContent)

      // Act
      await service.analyze(mockRawContent, 'industry')

      // Assert
      expect(analyzedContentService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          practiceDescription: null,
          estimatedCost: null,
          implementationPeriod: null,
          technicalEffect: null,
        }),
      )
    })
  })

  describe('analyzeWithCache - Industry Radar', () => {
    it('应该缓存行业雷达分析结果', async () => {
      // Arrange
      jest.spyOn(aiOrchestrator, 'generate').mockResolvedValue(mockAIResponse)
      jest.spyOn(analyzedContentService, 'create').mockResolvedValue(mockAnalyzedContent)

      const redisClient = await crawlerQueue.client

      // Act
      await service.analyzeWithCache(mockRawContent, 'industry')

      // Assert
      expect(redisClient.setex).toHaveBeenCalledWith(
        expect.stringContaining('radar:ai:analysis:'),
        24 * 60 * 60, // 24小时TTL
        expect.any(String),
      )
    })

    it('应该从缓存中读取行业雷达分析结果', async () => {
      // Arrange
      const redisClient = await crawlerQueue.client
      jest.spyOn(redisClient, 'get').mockResolvedValue(JSON.stringify(mockAnalyzedContent))

      // Act
      const result = await service.analyzeWithCache(mockRawContent, 'industry')

      // Assert
      expect(result.practiceDescription).toBe(mockAnalyzedContent.practiceDescription)
      expect(result.estimatedCost).toBe(mockAnalyzedContent.estimatedCost)
      expect(result.implementationPeriod).toBe(mockAnalyzedContent.implementationPeriod)
      expect(result.technicalEffect).toBe(mockAnalyzedContent.technicalEffect)
      expect(aiOrchestrator.generate).not.toHaveBeenCalled()
    })
  })
})
