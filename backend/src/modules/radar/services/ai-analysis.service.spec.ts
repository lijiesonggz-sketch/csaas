import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { getQueueToken } from '@nestjs/bullmq'
import { Repository } from 'typeorm'
import { Queue } from 'bullmq'

import { AIAnalysisService } from './ai-analysis.service'
import { RawContent } from '../../../database/entities/raw-content.entity'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'
import { Tag } from '../../../database/entities/tag.entity'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'
import { TagService } from './tag.service'
import { AnalyzedContentService } from './analyzed-content.service'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'

describe('AIAnalysisService', () => {
  let service: AIAnalysisService
  let rawContentRepo: Repository<RawContent>
  let crawlerQueue: Queue
  let aiOrchestrator: AIOrchestrator
  let tagService: TagService
  let analyzedContentService: AnalyzedContentService
  let redisClient: any

  // Mock Redis client
  const mockRedisClient = {
    get: jest.fn(),
    setex: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
  }

  // Mock Queue
  const mockQueue = {
    client: Promise.resolve(mockRedisClient),
    add: jest.fn(),
  }

  // Mock RawContent
  const mockRawContent: Partial<RawContent> = {
    id: 'raw-content-1',
    title: 'Kubernetes 零信任架构实践',
    url: 'https://example.com/k8s-zero-trust',
    summary: '本文介绍了在 Kubernetes 环境下实施零信任架构的最佳实践',
    fullContent: '详细内容...',
    source: 'GARTNER',
    publishDate: new Date('2024-01-15'),
    category: 'tech',
    status: 'pending',
  }

  // Mock AI Response
  const mockAIResponse = {
    content: JSON.stringify({
      tags: ['云原生', 'Kubernetes', '零信任'],
      keywords: ['容器编排', '微服务', '安全架构'],
      categories: ['基础设施', '安全'],
      targetAudience: 'IT总监、架构师',
      aiSummary: '本文介绍了零信任架构在云原生环境下的实施方案...',
    }),
    model: 'qwen-turbo',
    tokens: {
      prompt: 500,
      completion: 200,
      total: 700,
    },
    cost: 0.007,
  }

  // Mock Tags
  const mockTags: Partial<Tag>[] = [
    { id: 'tag-1', name: '云原生', tagType: 'tech' },
    { id: 'tag-2', name: 'Kubernetes', tagType: 'tech' },
    { id: 'tag-3', name: '零信任', tagType: 'tech' },
  ]

  // Mock AnalyzedContent
  const mockAnalyzedContent: Partial<AnalyzedContent> = {
    id: 'analyzed-1',
    contentId: 'raw-content-1',
    tags: mockTags as Tag[],
    keywords: ['容器编排', '微服务', '安全架构'],
    categories: ['基础设施', '安全'],
    targetAudience: 'IT总监、架构师',
    aiSummary: '本文介绍了零信任架构在云原生环境下的实施方案...',
    roiAnalysis: null,
    relevanceScore: null,
    aiModel: 'qwen-turbo',
    tokensUsed: 700,
    status: 'success',
    analyzedAt: new Date(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIAnalysisService,
        {
          provide: getRepositoryToken(RawContent),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getQueueToken('radar:crawler'),
          useValue: mockQueue,
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
            create: jest.fn(),
            findByContentId: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<AIAnalysisService>(AIAnalysisService)
    rawContentRepo = module.get<Repository<RawContent>>(
      getRepositoryToken(RawContent),
    )
    crawlerQueue = module.get<Queue>(getQueueToken('radar:crawler'))
    aiOrchestrator = module.get<AIOrchestrator>(AIOrchestrator)
    tagService = module.get<TagService>(TagService)
    analyzedContentService = module.get<AnalyzedContentService>(
      AnalyzedContentService,
    )

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('analyze', () => {
    it('1. AI分析成功 - 正常流程', async () => {
      // Arrange
      jest.spyOn(aiOrchestrator, 'generate').mockResolvedValue(mockAIResponse)
      jest
        .spyOn(tagService, 'findOrCreate')
        .mockImplementation(async (name: string) => {
          return mockTags.find((t) => t.name === name) as Tag
        })
      jest
        .spyOn(analyzedContentService, 'create')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      // Act
      const result = await service.analyze(
        mockRawContent as RawContent,
        'tech',
      )

      // Assert
      expect(result).toBeDefined()
      expect(result.id).toBe('analyzed-1')
      expect(result.status).toBe('success')
      expect(result.tokensUsed).toBe(700)
      expect(result.tags).toHaveLength(3)
      expect(aiOrchestrator.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('金融IT技术专家'),
          prompt: expect.stringContaining('Kubernetes'),
          temperature: 0.3,
        }),
        AIModel.DOMESTIC,
      )
      expect(tagService.findOrCreate).toHaveBeenCalledTimes(3)
      expect(analyzedContentService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          contentId: 'raw-content-1',
          status: 'success',
          tokensUsed: 700,
        }),
      )
    })

    it('3. 标签创建 - 新标签自动创建', async () => {
      // Arrange
      const newTag: Partial<Tag> = {
        id: 'tag-new',
        name: '新技术标签',
        tagType: 'tech',
      }
      jest.spyOn(aiOrchestrator, 'generate').mockResolvedValue({
        ...mockAIResponse,
        content: JSON.stringify({
          tags: ['新技术标签'],
          keywords: [],
          categories: [],
          targetAudience: 'IT总监',
          aiSummary: '测试摘要',
        }),
      })
      jest.spyOn(tagService, 'findOrCreate').mockResolvedValue(newTag as Tag)
      jest
        .spyOn(analyzedContentService, 'create')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      // Act
      await service.analyze(mockRawContent as RawContent, 'tech')

      // Assert
      expect(tagService.findOrCreate).toHaveBeenCalledWith('新技术标签', 'tech')
    })

    it('4. 标签去重 - 相同名称的标签复用', async () => {
      // Arrange
      const duplicateTagResponse = {
        ...mockAIResponse,
        content: JSON.stringify({
          tags: ['云原生', '云原生', 'Kubernetes'], // 重复标签
          keywords: [],
          categories: [],
          targetAudience: 'IT总监',
          aiSummary: '测试摘要',
        }),
      }
      jest
        .spyOn(aiOrchestrator, 'generate')
        .mockResolvedValue(duplicateTagResponse)
      jest
        .spyOn(tagService, 'findOrCreate')
        .mockResolvedValue(mockTags[0] as Tag)
      jest
        .spyOn(analyzedContentService, 'create')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      // Act
      await service.analyze(mockRawContent as RawContent, 'tech')

      // Assert
      // findOrCreate 应该被调用3次（即使有重复）
      expect(tagService.findOrCreate).toHaveBeenCalledTimes(3)
    })

    it('5. 通义千问API超时 - 5分钟超时处理', async () => {
      // Arrange
      jest
        .spyOn(aiOrchestrator, 'generate')
        .mockRejectedValue(new Error('Request timeout after 300000ms'))

      // Act & Assert
      await expect(
        service.analyze(mockRawContent as RawContent, 'tech'),
      ).rejects.toThrow('Request timeout')
    })

    it('6. 无效RawContent - 缺少必填字段', async () => {
      // Arrange
      const invalidRawContent: Partial<RawContent> = {
        id: 'invalid-1',
        title: '', // 空标题
        url: '',
        fullContent: '',
      }

      jest.spyOn(aiOrchestrator, 'generate').mockResolvedValue(mockAIResponse)

      // Act
      const result = await service.analyze(
        invalidRawContent as RawContent,
        'tech',
      )

      // Assert - 应该仍然调用AI，但内容为空
      expect(aiOrchestrator.generate).toHaveBeenCalled()
    })

    it('7. 大文本内容 - >10000字的处理', async () => {
      // Arrange
      const largeContent: Partial<RawContent> = {
        ...mockRawContent,
        fullContent: 'A'.repeat(15000), // 15000字符
      }

      jest.spyOn(aiOrchestrator, 'generate').mockResolvedValue(mockAIResponse)
      jest
        .spyOn(tagService, 'findOrCreate')
        .mockResolvedValue(mockTags[0] as Tag)
      jest
        .spyOn(analyzedContentService, 'create')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      // Act
      const result = await service.analyze(largeContent as RawContent, 'tech')

      // Assert
      expect(result).toBeDefined()
      expect(aiOrchestrator.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('A'.repeat(100)), // 验证大文本被传递
        }),
        AIModel.DOMESTIC,
      )
    })

    it('8. Token超限 - 超过2000 tokens的处理', async () => {
      // Arrange
      const highTokenResponse = {
        ...mockAIResponse,
        tokens: {
          prompt: 1500,
          completion: 800,
          total: 2300, // 超过2000
        },
      }
      jest
        .spyOn(aiOrchestrator, 'generate')
        .mockResolvedValue(highTokenResponse)
      jest
        .spyOn(tagService, 'findOrCreate')
        .mockResolvedValue(mockTags[0] as Tag)
      jest
        .spyOn(analyzedContentService, 'create')
        .mockResolvedValue({
          ...mockAnalyzedContent,
          tokensUsed: 2300,
        } as AnalyzedContent)

      // Act
      const result = await service.analyze(
        mockRawContent as RawContent,
        'tech',
      )

      // Assert
      expect(result.tokensUsed).toBe(2300)
      expect(analyzedContentService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tokensUsed: 2300,
        }),
      )
    })

    it('9. AI响应解析失败 - 无效JSON格式', async () => {
      // Arrange
      const invalidJSONResponse = {
        ...mockAIResponse,
        content: 'This is not a valid JSON', // 无效JSON
      }
      jest
        .spyOn(aiOrchestrator, 'generate')
        .mockResolvedValue(invalidJSONResponse)
      jest
        .spyOn(analyzedContentService, 'create')
        .mockResolvedValue({
          ...mockAnalyzedContent,
          tags: [],
          keywords: [],
          categories: [],
          targetAudience: null,
          aiSummary: null,
        } as AnalyzedContent)

      // Act
      const result = await service.analyze(
        mockRawContent as RawContent,
        'tech',
      )

      // Assert - 应该降级处理，返回空结果
      expect(analyzedContentService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: [],
          keywords: [],
          categories: [],
        }),
      )
    })

    it('10. 并发分析 - 多个分析任务同时进行', async () => {
      // Arrange
      const content1 = { ...mockRawContent, id: 'content-1' }
      const content2 = { ...mockRawContent, id: 'content-2' }
      const content3 = { ...mockRawContent, id: 'content-3' }

      jest.spyOn(aiOrchestrator, 'generate').mockResolvedValue(mockAIResponse)
      jest
        .spyOn(tagService, 'findOrCreate')
        .mockResolvedValue(mockTags[0] as Tag)
      jest
        .spyOn(analyzedContentService, 'create')
        .mockImplementation(async (data) => {
          return {
            ...mockAnalyzedContent,
            contentId: data.contentId,
          } as AnalyzedContent
        })

      // Act - 并发执行3个分析任务
      const results = await Promise.all([
        service.analyze(content1 as RawContent, 'tech'),
        service.analyze(content2 as RawContent, 'tech'),
        service.analyze(content3 as RawContent, 'tech'),
      ])

      // Assert
      expect(results).toHaveLength(3)
      expect(results[0].contentId).toBe('content-1')
      expect(results[1].contentId).toBe('content-2')
      expect(results[2].contentId).toBe('content-3')
      expect(aiOrchestrator.generate).toHaveBeenCalledTimes(3)
    })
  })

  describe('analyzeWithCache', () => {
    it('2. 缓存命中 - 相同contentHash直接返回', async () => {
      // Arrange
      const cachedResult = JSON.stringify(mockAnalyzedContent)
      mockRedisClient.get.mockResolvedValue(cachedResult)

      // Act
      const result = await service.analyzeWithCache(
        mockRawContent as RawContent,
        'tech',
      )

      // Assert
      expect(result).toBeDefined()
      expect(result.id).toBe('analyzed-1')
      expect(mockRedisClient.get).toHaveBeenCalled()
      expect(aiOrchestrator.generate).not.toHaveBeenCalled() // 不应该调用AI
    })

    it('缓存未命中 - 执行AI分析并缓存结果', async () => {
      // Arrange
      mockRedisClient.get.mockResolvedValue(null) // 缓存未命中
      jest.spyOn(aiOrchestrator, 'generate').mockResolvedValue(mockAIResponse)
      jest
        .spyOn(tagService, 'findOrCreate')
        .mockResolvedValue(mockTags[0] as Tag)
      jest
        .spyOn(analyzedContentService, 'create')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      // Act
      const result = await service.analyzeWithCache(
        mockRawContent as RawContent,
        'tech',
      )

      // Assert
      expect(result).toBeDefined()
      expect(mockRedisClient.get).toHaveBeenCalled()
      expect(aiOrchestrator.generate).toHaveBeenCalled()
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        expect.stringContaining('radar:ai:analysis:'),
        86400, // 24小时
        expect.any(String),
      )
    })
  })

  describe('getPromptByCategory', () => {
    it('应该根据分类返回不同的prompt', async () => {
      // Arrange
      jest.spyOn(aiOrchestrator, 'generate').mockResolvedValue(mockAIResponse)
      jest
        .spyOn(tagService, 'findOrCreate')
        .mockResolvedValue(mockTags[0] as Tag)
      jest
        .spyOn(analyzedContentService, 'create')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      // Act - 测试不同分类
      await service.analyze(mockRawContent as RawContent, 'tech')
      const techPrompt = (aiOrchestrator.generate as jest.Mock).mock.calls[0][0]
        .systemPrompt

      await service.analyze(mockRawContent as RawContent, 'industry')
      const industryPrompt = (aiOrchestrator.generate as jest.Mock).mock
        .calls[1][0].systemPrompt

      await service.analyze(mockRawContent as RawContent, 'compliance')
      const compliancePrompt = (aiOrchestrator.generate as jest.Mock).mock
        .calls[2][0].systemPrompt

      // Assert
      expect(techPrompt).toContain('技术趋势')
      expect(industryPrompt).toContain('同业机构')
      expect(compliancePrompt).toContain('监管政策')
    })
  })

  describe('calculateContentHash', () => {
    it('相同内容应该生成相同的hash', async () => {
      // Arrange
      const content1 = { ...mockRawContent }
      const content2 = { ...mockRawContent }

      mockRedisClient.get.mockResolvedValue(null)
      jest.spyOn(aiOrchestrator, 'generate').mockResolvedValue(mockAIResponse)
      jest
        .spyOn(tagService, 'findOrCreate')
        .mockResolvedValue(mockTags[0] as Tag)
      jest
        .spyOn(analyzedContentService, 'create')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      // Act
      await service.analyzeWithCache(content1 as RawContent, 'tech')
      await service.analyzeWithCache(content2 as RawContent, 'tech')

      // Assert
      const call1Key = mockRedisClient.get.mock.calls[0][0]
      const call2Key = mockRedisClient.get.mock.calls[1][0]
      expect(call1Key).toBe(call2Key) // 相同内容应该生成相同的缓存key
    })

    it('不同内容应该生成不同的hash', async () => {
      // Arrange
      const content1 = { ...mockRawContent, title: 'Title 1' }
      const content2 = { ...mockRawContent, title: 'Title 2' }

      mockRedisClient.get.mockResolvedValue(null)
      jest.spyOn(aiOrchestrator, 'generate').mockResolvedValue(mockAIResponse)
      jest
        .spyOn(tagService, 'findOrCreate')
        .mockResolvedValue(mockTags[0] as Tag)
      jest
        .spyOn(analyzedContentService, 'create')
        .mockResolvedValue(mockAnalyzedContent as AnalyzedContent)

      // Act
      await service.analyzeWithCache(content1 as RawContent, 'tech')
      await service.analyzeWithCache(content2 as RawContent, 'tech')

      // Assert
      const call1Key = mockRedisClient.get.mock.calls[0][0]
      const call2Key = mockRedisClient.get.mock.calls[1][0]
      expect(call1Key).not.toBe(call2Key) // 不同内容应该生成不同的缓存key
    })
  })
})
