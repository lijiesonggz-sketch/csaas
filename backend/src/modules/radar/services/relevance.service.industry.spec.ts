import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository, DataSource } from 'typeorm'

import { RelevanceService } from './relevance.service'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'
import { RadarPush } from '../../../database/entities/radar-push.entity'
import { WeaknessSnapshot } from '../../../database/entities/weakness-snapshot.entity'
import { WatchedPeer } from '../../../database/entities/watched-peer.entity'
import { WatchedTopic } from '../../../database/entities/watched-topic.entity'
import { Organization } from '../../../database/entities/organization.entity'
import { RawContent } from '../../../database/entities/raw-content.entity'
import { PushFrequencyControlService } from './push-frequency-control.service'

/**
 * Story 3.2: 测试行业雷达相关性计算
 *
 * 测试场景:
 * 1. 同业匹配计算 (权重0.5)
 * 2. 薄弱项匹配计算 (权重0.3)
 * 3. 关注领域匹配计算 (权重0.2)
 * 4. 综合相关性评分计算
 * 5. 优先级判定 (high/medium/low)
 */
describe('RelevanceService - Industry Radar (Story 3.2)', () => {
  let service: RelevanceService
  let analyzedContentRepo: Repository<AnalyzedContent>
  let watchedPeerRepo: Repository<WatchedPeer>
  let watchedTopicRepo: Repository<WatchedTopic>
  let weaknessSnapshotRepo: Repository<WeaknessSnapshot>

  // Mock数据
  const mockOrganization: Organization = {
    id: 'org-123',
    name: '测试银行',
    radarActivated: true,
  } as Organization

  const mockRawContent: RawContent = {
    id: 'content-123',
    source: '杭州银行招聘',
    category: 'industry',
    title: '杭州银行容器化改造项目',
    peerName: '杭州银行',
    contentType: 'recruitment',
    fullContent: '容器化改造项目...',
  } as RawContent

  const mockAnalyzedContent: AnalyzedContent = {
    id: 'analyzed-123',
    contentId: 'content-123',
    rawContent: mockRawContent,
    categories: ['云原生', '容器化', 'DevOps'],
    keywords: ['Kubernetes', 'Docker', '微服务'],
    tags: [], // 添加tags字段
    practiceDescription: '杭州银行容器化改造项目',
    estimatedCost: '120万',
    implementationPeriod: '6个月',
    technicalEffect: '部署时间从2小时缩短到10分钟',
  } as AnalyzedContent

  const mockWatchedPeers: WatchedPeer[] = [
    {
      id: 'peer-1',
      peerName: '杭州银行',
      industry: 'banking',
      institutionType: '城商行',
      organizationId: 'org-123',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as WatchedPeer,
    {
      id: 'peer-2',
      peerName: '招商银行',
      industry: 'banking',
      institutionType: '股份制银行',
      organizationId: 'org-123',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as WatchedPeer,
  ]

  const mockWatchedTopics: WatchedTopic[] = [
    {
      id: 'topic-1',
      topicName: '云原生',
      topicType: 'tech',
      organizationId: 'org-123',
    } as WatchedTopic,
    {
      id: 'topic-2',
      topicName: '容器化',
      topicType: 'tech',
      organizationId: 'org-123',
    } as WatchedTopic,
  ]

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelevanceService,
        {
          provide: getRepositoryToken(AnalyzedContent),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RadarPush),
          useValue: {
            save: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WeaknessSnapshot),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WatchedPeer),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WatchedTopic),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Organization),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: PushFrequencyControlService,
          useValue: {
            checkPushAllowed: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<RelevanceService>(RelevanceService)
    analyzedContentRepo = module.get<Repository<AnalyzedContent>>(
      getRepositoryToken(AnalyzedContent),
    )
    watchedPeerRepo = module.get<Repository<WatchedPeer>>(getRepositoryToken(WatchedPeer))
    watchedTopicRepo = module.get<Repository<WatchedTopic>>(getRepositoryToken(WatchedTopic))
    weaknessSnapshotRepo = module.get<Repository<WeaknessSnapshot>>(
      getRepositoryToken(WeaknessSnapshot),
    )
  })

  describe('calculateIndustryRelevance', () => {
    it('应该计算同业完全匹配的相关性 (权重0.5)', async () => {
      // Arrange
      jest.spyOn(watchedPeerRepo, 'find').mockResolvedValue(mockWatchedPeers)
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([])
      jest.spyOn(weaknessSnapshotRepo, 'find').mockResolvedValue([])

      // Act
      const result = await service.calculateIndustryRelevance(mockAnalyzedContent, mockOrganization)

      // Assert
      expect(result.relevanceScore).toBeCloseTo(0.5, 2) // 同业匹配1.0 * 0.5
      expect(result.priorityLevel).toBe('low') // 0.5 < 0.7
      expect(result.matchedPeers).toEqual(['杭州银行']) // Story 5.2 Task 2.2
    })

    it('应该计算同业不匹配的相关性', async () => {
      // Arrange
      const nonMatchingContent = {
        ...mockAnalyzedContent,
        rawContent: {
          ...mockRawContent,
          title: '建设银行数字化转型', // 标题包含"建设银行"
          summary: '本文介绍建设银行的经验',
          peerName: '建设银行', // 不在关注列表中
        },
      }

      jest.spyOn(watchedPeerRepo, 'find').mockResolvedValue(mockWatchedPeers)
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([])
      jest.spyOn(weaknessSnapshotRepo, 'find').mockResolvedValue([])

      // Act
      const result = await service.calculateIndustryRelevance(
        nonMatchingContent as AnalyzedContent,
        mockOrganization,
      )

      // Assert
      expect(result.relevanceScore).toBe(0) // 同业不匹配
      expect(result.priorityLevel).toBe('low')
      expect(result.matchedPeers).toEqual([]) // Story 5.2 Task 2.2: 无匹配同业
    })

    it('应该计算关注领域匹配的相关性 (权重0.2)', async () => {
      // Arrange
      jest.spyOn(watchedPeerRepo, 'find').mockResolvedValue([]) // 无同业匹配
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue(mockWatchedTopics)
      jest.spyOn(weaknessSnapshotRepo, 'find').mockResolvedValue([])

      // Act
      const result = await service.calculateIndustryRelevance(mockAnalyzedContent, mockOrganization)

      // Assert
      // 2个关注领域匹配 / 2个总关注领域 = 1.0, 1.0 * 0.2 = 0.2
      expect(result.relevanceScore).toBeCloseTo(0.2, 2)
      expect(result.priorityLevel).toBe('low')
      expect(result.matchedPeers).toEqual([]) // Story 5.2 Task 2.2: 无匹配同业
    })

    it('应该计算综合相关性评分 (同业+薄弱项+领域)', async () => {
      // Arrange
      const mockWeaknesses: WeaknessSnapshot[] = [
        {
          id: 'weakness-1',
          category: 'cloud_native' as any,
          level: 1, // 高优先级
          organizationId: 'org-123',
        } as WeaknessSnapshot,
      ]

      jest.spyOn(watchedPeerRepo, 'find').mockResolvedValue(mockWatchedPeers)
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue(mockWatchedTopics)
      jest.spyOn(weaknessSnapshotRepo, 'find').mockResolvedValue(mockWeaknesses)

      // Act
      const result = await service.calculateIndustryRelevance(mockAnalyzedContent, mockOrganization)

      // Assert
      // 同业匹配: 1.0 * 0.5 = 0.5
      // 薄弱项匹配: ~0.8 * 0.3 = ~0.24
      // 领域匹配: 1.0 * 0.2 = 0.2
      // 总分: ~0.94
      expect(result.relevanceScore).toBeGreaterThanOrEqual(0.9)
      expect(result.priorityLevel).toBe('high') // >= 0.9
      expect(result.matchedPeers).toEqual(['杭州银行']) // Story 5.2 Task 2.2
    })

    it('应该正确判定优先级 - high (>= 0.9)', async () => {
      // Arrange
      const mockWeaknesses: WeaknessSnapshot[] = [
        {
          id: 'weakness-1',
          category: 'cloud_native' as any,
          level: 1,
          organizationId: 'org-123',
        } as WeaknessSnapshot,
      ]

      jest.spyOn(watchedPeerRepo, 'find').mockResolvedValue(mockWatchedPeers)
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue(mockWatchedTopics)
      jest.spyOn(weaknessSnapshotRepo, 'find').mockResolvedValue(mockWeaknesses)

      // Act
      const result = await service.calculateIndustryRelevance(mockAnalyzedContent, mockOrganization)

      // Assert
      expect(result.relevanceScore).toBeGreaterThanOrEqual(0.9)
      expect(result.priorityLevel).toBe('high')
      expect(result.matchedPeers).toEqual(['杭州银行']) // Story 5.2 Task 2.2
    })

    it('应该正确判定优先级 - medium (0.7-0.9)', async () => {
      // Arrange
      jest.spyOn(watchedPeerRepo, 'find').mockResolvedValue(mockWatchedPeers)
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue(mockWatchedTopics)
      jest.spyOn(weaknessSnapshotRepo, 'find').mockResolvedValue([])

      // Act
      const result = await service.calculateIndustryRelevance(mockAnalyzedContent, mockOrganization)

      // Assert
      // 0.5 + 0 + 0.2 = 0.7
      expect(result.relevanceScore).toBeGreaterThanOrEqual(0.7)
      expect(result.relevanceScore).toBeLessThan(0.9)
      expect(result.priorityLevel).toBe('medium')
      expect(result.matchedPeers).toEqual(['杭州银行']) // Story 5.2 Task 2.2
    })

    it('应该正确判定优先级 - low (< 0.7)', async () => {
      // Arrange
      jest.spyOn(watchedPeerRepo, 'find').mockResolvedValue([])
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue(mockWatchedTopics)
      jest.spyOn(weaknessSnapshotRepo, 'find').mockResolvedValue([])

      // Act
      const result = await service.calculateIndustryRelevance(mockAnalyzedContent, mockOrganization)

      // Assert
      expect(result.relevanceScore).toBeLessThan(0.7)
      expect(result.priorityLevel).toBe('low')
      expect(result.matchedPeers).toEqual([]) // Story 5.2 Task 2.2: 无匹配同业
    })

    it('应该处理没有peerName的内容 (旧逻辑)', async () => {
      // Arrange
      const contentWithoutPeer = {
        ...mockAnalyzedContent,
        rawContent: {
          ...mockRawContent,
          title: '技术趋势分析', // 标题不包含关注的同业
          summary: '云原生技术发展趋势', // 摘要也不包含
          peerName: null,
        },
      }

      jest.spyOn(watchedPeerRepo, 'find').mockResolvedValue(mockWatchedPeers)
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([])
      jest.spyOn(weaknessSnapshotRepo, 'find').mockResolvedValue([])

      // Act
      const result = await service.calculateIndustryRelevance(
        contentWithoutPeer as AnalyzedContent,
        mockOrganization,
      )

      // Assert
      expect(result.relevanceScore).toBe(0) // 无同业匹配
      expect(result.priorityLevel).toBe('low')
      expect(result.matchedPeers).toEqual([]) // Story 5.2 Task 2.2: 无匹配同业
    })

    // 新增测试: 混合策略 - 全文回退匹配
    it('应该使用全文回退匹配 (标题包含同业名称)', async () => {
      // Arrange
      const contentWithPeerInTitle = {
        ...mockAnalyzedContent,
        rawContent: {
          ...mockRawContent,
          title: '杭州银行数字化转型实践', // 标题包含"杭州银行"
          summary: '本文介绍了数字化转型的经验',
          peerName: null, // 结构化字段为空
        },
      }

      jest.spyOn(watchedPeerRepo, 'find').mockResolvedValue(mockWatchedPeers)
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([])
      jest.spyOn(weaknessSnapshotRepo, 'find').mockResolvedValue([])

      // Act
      const result = await service.calculateIndustryRelevance(
        contentWithPeerInTitle as AnalyzedContent,
        mockOrganization,
      )

      // Assert
      expect(result.relevanceScore).toBeCloseTo(0.5, 2) // 全文匹配成功: 1.0 * 0.5
      expect(result.priorityLevel).toBe('low')
    })

    it('应该使用全文回退匹配 (摘要包含同业名称)', async () => {
      // Arrange
      const contentWithPeerInSummary = {
        ...mockAnalyzedContent,
        rawContent: {
          ...mockRawContent,
          title: '城商行数字化案例分享',
          summary: '招商银行通过云原生架构实现了快速部署', // 摘要包含"招商银行"
          peerName: null, // 结构化字段为空
        },
      }

      jest.spyOn(watchedPeerRepo, 'find').mockResolvedValue(mockWatchedPeers)
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([])
      jest.spyOn(weaknessSnapshotRepo, 'find').mockResolvedValue([])

      // Act
      const result = await service.calculateIndustryRelevance(
        contentWithPeerInSummary as AnalyzedContent,
        mockOrganization,
      )

      // Assert
      expect(result.relevanceScore).toBeCloseTo(0.5, 2) // 全文匹配成功: 1.0 * 0.5
      expect(result.priorityLevel).toBe('low')
      expect(result.matchedPeers).toEqual(['招商银行']) // Story 5.2 Task 2.2: 全文匹配
    })

    it('应该优先使用结构化字段匹配 (精确匹配)', async () => {
      // Arrange
      const contentWithBothMatches = {
        ...mockAnalyzedContent,
        rawContent: {
          ...mockRawContent,
          title: '招商银行和杭州银行的对比', // 标题包含两个同业
          summary: '本文对比分析',
          peerName: '杭州银行', // 结构化字段指定"杭州银行"
        },
      }

      jest.spyOn(watchedPeerRepo, 'find').mockResolvedValue(mockWatchedPeers)
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([])
      jest.spyOn(weaknessSnapshotRepo, 'find').mockResolvedValue([])

      // Act
      const result = await service.calculateIndustryRelevance(
        contentWithBothMatches as AnalyzedContent,
        mockOrganization,
      )

      // Assert
      expect(result.relevanceScore).toBeCloseTo(0.5, 2) // 精确匹配成功
      expect(result.priorityLevel).toBe('low')
      expect(result.matchedPeers).toEqual(['杭州银行']) // Story 5.2 Task 2.2: 精确匹配优先
      // 注意: 应该使用结构化字段的"杭州银行"，而不是全文匹配的"招商银行"
    })

    it('应该避免误匹配相似名称', async () => {
      // Arrange
      const contentWithSimilarName = {
        ...mockAnalyzedContent,
        rawContent: {
          ...mockRawContent,
          title: '平安保险数字化转型案例', // 包含"平安保险"
          summary: '本文介绍平安保险的经验',
          peerName: null,
        },
      }

      const watchedPeersWithPingAn: WatchedPeer[] = [
        {
          id: 'peer-3',
          peerName: '平安银行', // 用户关注"平安银行"
          industry: 'banking',
          institutionType: '股份制银行',
          organizationId: 'org-123',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as WatchedPeer,
      ]

      jest.spyOn(watchedPeerRepo, 'find').mockResolvedValue(watchedPeersWithPingAn)
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([])
      jest.spyOn(weaknessSnapshotRepo, 'find').mockResolvedValue([])

      // Act
      const result = await service.calculateIndustryRelevance(
        contentWithSimilarName as AnalyzedContent,
        mockOrganization,
      )

      // Assert
      // "平安保险"不包含"平安银行"，应该不匹配
      expect(result.relevanceScore).toBe(0)
      expect(result.priorityLevel).toBe('low')
      expect(result.matchedPeers).toEqual([]) // Story 5.2 Task 2.2: 无匹配同业
    })

    it('应该匹配多个同业机构', async () => {
      // Arrange
      const contentWithMultiplePeers = {
        ...mockAnalyzedContent,
        rawContent: {
          ...mockRawContent,
          title: '杭州银行与招商银行的合作案例',
          summary: '两家银行在技术领域的合作',
          peerName: null,
        },
      }

      jest.spyOn(watchedPeerRepo, 'find').mockResolvedValue(mockWatchedPeers)
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([])
      jest.spyOn(weaknessSnapshotRepo, 'find').mockResolvedValue([])

      // Act
      const result = await service.calculateIndustryRelevance(
        contentWithMultiplePeers as AnalyzedContent,
        mockOrganization,
      )

      // Assert
      // 匹配到多个同业，但peerMatch仍然是1.0（二元匹配）
      expect(result.relevanceScore).toBeCloseTo(0.5, 2)
      expect(result.priorityLevel).toBe('low')
      expect(result.matchedPeers).toEqual(['杭州银行', '招商银行']) // Story 5.2 Task 2.2: 多同业匹配
    })

    it('应该处理空的关注列表', async () => {
      // Arrange
      jest.spyOn(watchedPeerRepo, 'find').mockResolvedValue([])
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([])
      jest.spyOn(weaknessSnapshotRepo, 'find').mockResolvedValue([])

      // Act
      const result = await service.calculateIndustryRelevance(mockAnalyzedContent, mockOrganization)

      // Assert
      expect(result.relevanceScore).toBe(0)
      expect(result.priorityLevel).toBe('low')
      expect(result.matchedPeers).toEqual([]) // Story 5.2 Task 2.2: 无关注同业
    })
  })
})
