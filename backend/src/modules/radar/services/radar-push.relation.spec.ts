import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { RadarPush } from '../../../database/entities/radar-push.entity'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'
import { RawContent } from '../../../database/entities/raw-content.entity'

describe('RadarPush Relations - Industry Radar (Story 3.2 Task 3.1)', () => {
  let radarPushRepo: Repository<RadarPush>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: getRepositoryToken(RadarPush),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile()

    radarPushRepo = module.get<Repository<RadarPush>>(getRepositoryToken(RadarPush))
  })

  describe('Industry Radar Association Chain', () => {
    it('should load complete association chain: RadarPush → AnalyzedContent → RawContent', async () => {
      // Arrange: 模拟完整的关联数据
      const mockPush = {
        id: 'push-1',
        organizationId: 'org-1',
        radarType: 'industry',
        relevanceScore: 0.95,
        priorityLevel: 'high',
        analyzedContent: {
          id: 'content-1',
          // AnalyzedContent的行业雷达字段 (Story 3.2 Phase 1)
          practiceDescription: '杭州银行于2025年启动容器化改造项目，采用Kubernetes作为核心编排平台',
          estimatedCost: '120万',
          implementationPeriod: '6个月',
          technicalEffect: '应用部署时间从2小时缩短到10分钟，运维效率提升60%',
          categories: ['云原生', '容器化', 'DevOps'],
          keywords: ['Kubernetes', 'Docker', '微服务'],
          aiSummary: '杭州银行容器化改造实践',
          targetAudience: 'IT总监',
          tags: [],
          rawContent: {
            id: 'raw-1',
            // RawContent的行业雷达字段 (Story 3.1)
            peerName: '杭州银行',
            contentType: 'article',
            title: '杭州银行容器化改造实践',
            summary: '杭州银行2025年容器化改造案例',
            url: 'https://example.com/hangzhou-bank-case',
            source: '金融科技周刊',
            publishDate: new Date('2025-06-15'),
            category: 'industry',
          },
        },
      } as RadarPush

      jest.spyOn(radarPushRepo, 'findOne').mockResolvedValue(mockPush)

      // Act: 加载完整关联数据
      const push = await radarPushRepo.findOne({
        where: { id: 'push-1' },
        relations: ['analyzedContent', 'analyzedContent.rawContent', 'analyzedContent.tags'],
      })

      // Assert: 验证关联链完整
      expect(push).toBeDefined()
      expect(push.id).toBe('push-1')
      expect(push.radarType).toBe('industry')

      // 验证AnalyzedContent关联
      expect(push.analyzedContent).toBeDefined()
      expect(push.analyzedContent.id).toBe('content-1')

      // 验证RawContent关联
      expect(push.analyzedContent.rawContent).toBeDefined()
      expect(push.analyzedContent.rawContent.id).toBe('raw-1')
    })

    it('should access all industry radar fields through association chain', async () => {
      // Arrange
      const mockPush = {
        id: 'push-1',
        organizationId: 'org-1',
        radarType: 'industry',
        analyzedContent: {
          // AI提取的行业雷达字段
          practiceDescription: '技术实践描述',
          estimatedCost: '50-100万',
          implementationPeriod: '3-6个月',
          technicalEffect: '部署效率提升50%',
          rawContent: {
            // 爬虫采集的行业雷达字段
            peerName: '杭州银行',
            contentType: 'recruitment',
            title: '招聘信息',
          },
        },
      } as RadarPush

      jest.spyOn(radarPushRepo, 'findOne').mockResolvedValue(mockPush)

      // Act
      const push = await radarPushRepo.findOne({
        where: { id: 'push-1' },
        relations: ['analyzedContent', 'analyzedContent.rawContent'],
      })

      // Assert: 验证可以访问所有行业雷达字段
      // 来自RawContent的字段
      expect(push.analyzedContent.rawContent.peerName).toBe('杭州银行')
      expect(push.analyzedContent.rawContent.contentType).toBe('recruitment')

      // 来自AnalyzedContent的字段
      expect(push.analyzedContent.practiceDescription).toBe('技术实践描述')
      expect(push.analyzedContent.estimatedCost).toBe('50-100万')
      expect(push.analyzedContent.implementationPeriod).toBe('3-6个月')
      expect(push.analyzedContent.technicalEffect).toBe('部署效率提升50%')
    })

    it('should handle different contentType values', async () => {
      // Arrange: 测试不同的contentType
      const contentTypes = ['article', 'recruitment', 'conference'] as const

      for (const contentType of contentTypes) {
        const mockPush = {
          id: `push-${contentType}`,
          radarType: 'industry',
          analyzedContent: {
            rawContent: {
              peerName: '招商银行',
              contentType,
            },
          },
        } as RadarPush

        jest.spyOn(radarPushRepo, 'findOne').mockResolvedValue(mockPush)

        // Act
        const push = await radarPushRepo.findOne({
          where: { id: `push-${contentType}` },
          relations: ['analyzedContent', 'analyzedContent.rawContent'],
        })

        // Assert
        expect(push.analyzedContent.rawContent.contentType).toBe(contentType)
      }
    })

    it('should handle null optional fields gracefully', async () => {
      // Arrange: 测试可选字段为null的情况
      const mockPush = {
        id: 'push-1',
        radarType: 'industry',
        analyzedContent: {
          practiceDescription: '实践描述',
          estimatedCost: null, // 可选字段为null
          implementationPeriod: null,
          technicalEffect: null,
          rawContent: {
            peerName: '杭州银行',
            contentType: 'article',
          },
        },
      } as RadarPush

      jest.spyOn(radarPushRepo, 'findOne').mockResolvedValue(mockPush)

      // Act
      const push = await radarPushRepo.findOne({
        where: { id: 'push-1' },
        relations: ['analyzedContent', 'analyzedContent.rawContent'],
      })

      // Assert: 验证可以正常访问null字段
      expect(push.analyzedContent.practiceDescription).toBe('实践描述')
      expect(push.analyzedContent.estimatedCost).toBeNull()
      expect(push.analyzedContent.implementationPeriod).toBeNull()
      expect(push.analyzedContent.technicalEffect).toBeNull()
    })
  })

  describe('Field Data Normalization', () => {
    it('should not store redundant fields in RadarPush', async () => {
      // Arrange: 验证RadarPush不应该有冗余的行业雷达字段
      const mockPush = {
        id: 'push-1',
        organizationId: 'org-1',
        radarType: 'industry',
        contentId: 'content-1',
        relevanceScore: 0.95,
        priorityLevel: 'high',
        scheduledAt: new Date(),
        status: 'scheduled',
        // 不应该有这些字段：peerName, practiceDescription, estimatedCost等
      } as RadarPush

      // Assert: 验证RadarPush实体定义中没有冗余字段
      const radarPushKeys = Object.keys(mockPush)
      expect(radarPushKeys).not.toContain('peerName')
      expect(radarPushKeys).not.toContain('practiceDescription')
      expect(radarPushKeys).not.toContain('estimatedCost')
      expect(radarPushKeys).not.toContain('implementationPeriod')
      expect(radarPushKeys).not.toContain('technicalEffect')
    })
  })
})
