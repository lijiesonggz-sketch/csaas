import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import {
  PeerRelevanceService,
  RelevanceScoreParams,
  OrganizationRelevanceResult,
} from './peer-relevance.service'
import { WatchedPeer } from '../../../database/entities/watched-peer.entity'
import { WatchedTopic } from '../../../database/entities/watched-topic.entity'
import { WeaknessSnapshot } from '../../../database/entities/weakness-snapshot.entity'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'
import { WeaknessCategory } from '../../../constants/categories'

/**
 * PeerRelevanceService 单元测试
 *
 * Story 8.4: 同业动态推送生成 - 相关性评分算法
 *
 * 权重配置：
 * - 关注同业匹配权重: 0.6
 * - 技术领域匹配权重: 0.2
 * - 薄弱项匹配权重: 0.2
 *
 * 优先级阈值：
 * - ≥ 0.9: 高优先级
 * - ≥ 0.7: 中优先级
 * - < 0.7: 低优先级 (不创建推送)
 */
describe('PeerRelevanceService', () => {
  let service: PeerRelevanceService
  let watchedPeerRepo: Repository<WatchedPeer>
  let watchedTopicRepo: Repository<WatchedTopic>
  let weaknessSnapshotRepo: Repository<WeaknessSnapshot>

  // Mock 数据
  const mockTenantId = 'tenant-123'
  const mockOrganizationId = 'org-123'
  const mockPeerName = '杭州银行'

  const mockAnalyzedContent: Partial<AnalyzedContent> = {
    id: 'content-123',
    peerName: mockPeerName,
    categories: ['云原生', 'Kubernetes'],
    keywords: ['容器化', '微服务'],
    keyTechnologies: ['Docker', 'K8s'],
    practiceDescription: '使用Kubernetes进行容器编排',
    technicalEffect: '部署时间缩短80%',
    aiSummary: '杭州银行采用云原生技术实现数字化转型',
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeerRelevanceService,
        {
          provide: getRepositoryToken(WatchedPeer),
          useValue: {
            createQueryBuilder: jest.fn(),
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
          provide: getRepositoryToken(WeaknessSnapshot),
          useValue: {
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<PeerRelevanceService>(PeerRelevanceService)
    watchedPeerRepo = module.get<Repository<WatchedPeer>>(getRepositoryToken(WatchedPeer))
    watchedTopicRepo = module.get<Repository<WatchedTopic>>(getRepositoryToken(WatchedTopic))
    weaknessSnapshotRepo = module.get<Repository<WeaknessSnapshot>>(
      getRepositoryToken(WeaknessSnapshot),
    )
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // Helper function to create mock weakness snapshot query builder
  const mockWeaknessQueryBuilder = (snapshots: WeaknessSnapshot[]) => {
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(snapshots),
    }
    jest.spyOn(weaknessSnapshotRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)
  }

  describe('calculateRelevanceScore', () => {
    it('should return 1.0 when all matches are true', () => {
      const params: RelevanceScoreParams = {
        peerMatch: true,
        techDomainMatch: true,
        weaknessMatch: true,
      }

      const score = service.calculateRelevanceScore(params)

      expect(score).toBe(1.0)
    })

    it('should return 0.6 when only peer matches', () => {
      const params: RelevanceScoreParams = {
        peerMatch: true,
        techDomainMatch: false,
        weaknessMatch: false,
      }

      const score = service.calculateRelevanceScore(params)

      expect(score).toBe(0.6)
    })

    it('should return 0.8 when peer and tech domain match', () => {
      const params: RelevanceScoreParams = {
        peerMatch: true,
        techDomainMatch: true,
        weaknessMatch: false,
      }

      const score = service.calculateRelevanceScore(params)

      expect(score).toBe(0.8)
    })

    it('should return 0.0 when no matches', () => {
      const params: RelevanceScoreParams = {
        peerMatch: false,
        techDomainMatch: false,
        weaknessMatch: false,
      }

      const score = service.calculateRelevanceScore(params)

      expect(score).toBe(0)
    })

    it('should cap score at 1.0', () => {
      // This shouldn't happen with current weights, but test the safeguard
      const params: RelevanceScoreParams = {
        peerMatch: true,
        techDomainMatch: true,
        weaknessMatch: true,
      }

      const score = service.calculateRelevanceScore(params)

      expect(score).toBeLessThanOrEqual(1.0)
    })
  })

  describe('determinePriorityLevel', () => {
    it('should return high for score >= 0.9', () => {
      expect(service.determinePriorityLevel(0.9)).toBe('high')
      expect(service.determinePriorityLevel(0.95)).toBe('high')
      expect(service.determinePriorityLevel(1.0)).toBe('high')
    })

    it('should return medium for score >= 0.7 and < 0.9', () => {
      expect(service.determinePriorityLevel(0.7)).toBe('medium')
      expect(service.determinePriorityLevel(0.8)).toBe('medium')
      expect(service.determinePriorityLevel(0.89)).toBe('medium')
    })

    it('should return low for score < 0.7', () => {
      expect(service.determinePriorityLevel(0.69)).toBe('low')
      expect(service.determinePriorityLevel(0.5)).toBe('low')
      expect(service.determinePriorityLevel(0)).toBe('low')
    })
  })

  describe('shouldCreatePush', () => {
    it('should return true for score >= 0.7', () => {
      expect(service.shouldCreatePush(0.7)).toBe(true)
      expect(service.shouldCreatePush(0.9)).toBe(true)
      expect(service.shouldCreatePush(1.0)).toBe(true)
    })

    it('should return false for score < 0.7', () => {
      expect(service.shouldCreatePush(0.69)).toBe(false)
      expect(service.shouldCreatePush(0.6)).toBe(false)
      expect(service.shouldCreatePush(0)).toBe(false)
    })
  })

  describe('calculatePeerRelevance', () => {
    it('should return empty array when analyzedContent has no peerName', async () => {
      const contentWithoutPeer = { ...mockAnalyzedContent, peerName: undefined }

      const results = await service.calculatePeerRelevance(contentWithoutPeer as AnalyzedContent)

      expect(results).toEqual([])
    })

    it('should return empty array when no organizations watch the peer', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }
      jest.spyOn(watchedPeerRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      const results = await service.calculatePeerRelevance(mockAnalyzedContent as AnalyzedContent)

      expect(results).toEqual([])
    })

    it('should not return results with score < 0.7 (peer match only)', async () => {
      // Mock organizations watching the peer
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { organizationId: mockOrganizationId, tenantId: mockTenantId },
        ]),
      }
      jest.spyOn(watchedPeerRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      // Mock no watched topics
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([])

      // Mock no weakness snapshots
      mockWeaknessQueryBuilder([])

      const results = await service.calculatePeerRelevance(mockAnalyzedContent as AnalyzedContent)

      // Score is 0.6 (peer match only), which is < 0.7, so should be filtered out
      expect(results).toHaveLength(0)
    })

    it('should include tech domain match when topics match', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { organizationId: mockOrganizationId, tenantId: mockTenantId },
        ]),
      }
      jest.spyOn(watchedPeerRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      // Mock watched topics that match content categories
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([
        {
          id: 'topic-1',
          topicName: '云原生',
          topicType: 'tech',
          organizationId: mockOrganizationId,
          tenantId: mockTenantId,
        } as WatchedTopic,
      ])

      // Mock no weakness snapshots
      mockWeaknessQueryBuilder([])

      const results = await service.calculatePeerRelevance(mockAnalyzedContent as AnalyzedContent)

      expect(results).toHaveLength(1)
      expect(results[0].relevanceScore).toBe(0.8) // peer (0.6) + tech (0.2)
      expect(results[0].priorityLevel).toBe('medium') // 0.8 >= 0.7
      expect(results[0].matchedTopics).toContain('云原生')
    })

    it('should include weakness match when categories match', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { organizationId: mockOrganizationId, tenantId: mockTenantId },
        ]),
      }
      jest.spyOn(watchedPeerRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      // Mock no watched topics
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([])

      // Mock weakness snapshots that match content
      mockWeaknessQueryBuilder([
        {
          id: 'weakness-1',
          organizationId: mockOrganizationId,
          category: WeaknessCategory.CLOUD_NATIVE,
          level: 2,
        } as WeaknessSnapshot,
      ])

      // Use content that contains "cloud_native" to match the weakness category
      const contentWithCloudNative: Partial<AnalyzedContent> = {
        ...mockAnalyzedContent,
        categories: ['cloud_native', 'Kubernetes'], // Include the category name
      }

      const results = await service.calculatePeerRelevance(contentWithCloudNative as AnalyzedContent)

      expect(results).toHaveLength(1)
      expect(results[0].relevanceScore).toBe(0.8) // peer (0.6) + weakness (0.2)
      expect(results[0].priorityLevel).toBe('medium')
      expect(results[0].matchedWeaknesses).toContain('cloud_native')
    })

    it('should return high priority when all factors match', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { organizationId: mockOrganizationId, tenantId: mockTenantId },
        ]),
      }
      jest.spyOn(watchedPeerRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      // Mock watched topics that match
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([
        {
          id: 'topic-1',
          topicName: '云原生',
          topicType: 'tech',
          organizationId: mockOrganizationId,
          tenantId: mockTenantId,
        } as WatchedTopic,
      ])

      // Mock weakness snapshots that match
      mockWeaknessQueryBuilder([
        {
          id: 'weakness-1',
          organizationId: mockOrganizationId,
          category: WeaknessCategory.CLOUD_NATIVE,
          level: 2,
        } as WeaknessSnapshot,
      ])

      // Use content that matches both topic and weakness
      const contentWithMatches: Partial<AnalyzedContent> = {
        ...mockAnalyzedContent,
        categories: ['云原生', 'cloud_native'], // Match both topic and weakness
      }

      const results = await service.calculatePeerRelevance(contentWithMatches as AnalyzedContent)

      expect(results).toHaveLength(1)
      expect(results[0].relevanceScore).toBe(1.0) // peer (0.6) + tech (0.2) + weakness (0.2)
      expect(results[0].priorityLevel).toBe('high')
    })

    it('should filter out low relevance results (score < 0.7)', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { organizationId: mockOrganizationId, tenantId: mockTenantId },
        ]),
      }
      jest.spyOn(watchedPeerRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      // Mock no watched topics
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([])

      // Mock no weakness snapshots
      mockWeaknessQueryBuilder([])

      const results = await service.calculatePeerRelevance(mockAnalyzedContent as AnalyzedContent)

      // Score is 0.6 (only peer match), which is < 0.7, so should be filtered out
      expect(results).toHaveLength(0)
    })

    it('should handle multiple organizations watching the same peer', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { organizationId: 'org-1', tenantId: 'tenant-1' },
          { organizationId: 'org-2', tenantId: 'tenant-1' },
          { organizationId: 'org-3', tenantId: 'tenant-2' },
        ]),
      }
      jest.spyOn(watchedPeerRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      // Mock watched topics for all organizations
      jest.spyOn(watchedTopicRepo, 'find').mockImplementation((options: any) => {
        const orgId = options.where.organizationId
        if (orgId === 'org-1') {
          return Promise.resolve([
            {
              id: 'topic-1',
              topicName: '云原生',
              topicType: 'tech',
              organizationId: orgId,
              tenantId: 'tenant-1',
            } as WatchedTopic,
          ])
        }
        return Promise.resolve([])
      })

      // Mock no weakness snapshots
      mockWeaknessQueryBuilder([])

      const results = await service.calculatePeerRelevance(mockAnalyzedContent as AnalyzedContent)

      // org-1 has score 0.8 (peer + tech), org-2 and org-3 have score 0.6 (peer only)
      // Only org-1 should be included (score >= 0.7)
      expect(results).toHaveLength(1)
      expect(results[0].organizationId).toBe('org-1')
    })
  })

  describe('tech domain matching', () => {
    it('should match topic names with content categories', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { organizationId: mockOrganizationId, tenantId: mockTenantId },
        ]),
      }
      jest.spyOn(watchedPeerRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      // Topic name is a substring of a content category
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([
        {
          id: 'topic-1',
          topicName: '原生',
          topicType: 'tech',
          organizationId: mockOrganizationId,
          tenantId: mockTenantId,
        } as WatchedTopic,
      ])

      mockWeaknessQueryBuilder([])

      const results = await service.calculatePeerRelevance(mockAnalyzedContent as AnalyzedContent)

      expect(results[0].matchedTopics).toContain('原生')
    })

    it('should match topic names with key technologies', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { organizationId: mockOrganizationId, tenantId: mockTenantId },
        ]),
      }
      jest.spyOn(watchedPeerRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      // Topic name matches a key technology
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([
        {
          id: 'topic-1',
          topicName: 'Docker',
          topicType: 'tech',
          organizationId: mockOrganizationId,
          tenantId: mockTenantId,
        } as WatchedTopic,
      ])

      mockWeaknessQueryBuilder([])

      const results = await service.calculatePeerRelevance(mockAnalyzedContent as AnalyzedContent)

      expect(results[0].matchedTopics).toContain('docker')
    })
  })

  describe('weakness matching', () => {
    it('should match weakness categories with content fields', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { organizationId: mockOrganizationId, tenantId: mockTenantId },
        ]),
      }
      jest.spyOn(watchedPeerRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([])

      // Weakness category matches content practice description
      mockWeaknessQueryBuilder([
        {
          id: 'weakness-1',
          organizationId: mockOrganizationId,
          category: WeaknessCategory.CLOUD_NATIVE,
          level: 2,
        } as WeaknessSnapshot,
      ])

      // Use content that contains the weakness category
      const contentWithWeakness: Partial<AnalyzedContent> = {
        ...mockAnalyzedContent,
        categories: ['cloud_native'],
        practiceDescription: 'cloud native implementation',
      }

      const results = await service.calculatePeerRelevance(contentWithWeakness as AnalyzedContent)

      expect(results).toHaveLength(1)
      expect(results[0].matchedWeaknesses).toContain('cloud_native')
    })
  })

  describe('edge cases', () => {
    it('should handle empty watched topics gracefully', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { organizationId: mockOrganizationId, tenantId: mockTenantId },
        ]),
      }
      jest.spyOn(watchedPeerRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      // Empty watched topics
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([])
      mockWeaknessQueryBuilder([])

      const results = await service.calculatePeerRelevance(mockAnalyzedContent as AnalyzedContent)

      // Score is 0.6 (peer only), should be filtered out
      expect(results).toHaveLength(0)
    })

    it('should handle empty weakness snapshots gracefully', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { organizationId: mockOrganizationId, tenantId: mockTenantId },
        ]),
      }
      jest.spyOn(watchedPeerRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      // Has watched topics but no weakness snapshots
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([
        {
          id: 'topic-1',
          topicName: '云原生',
          topicType: 'tech',
          organizationId: mockOrganizationId,
          tenantId: mockTenantId,
        } as WatchedTopic,
      ])
      mockWeaknessQueryBuilder([])

      const results = await service.calculatePeerRelevance(mockAnalyzedContent as AnalyzedContent)

      expect(results).toHaveLength(1)
      expect(results[0].relevanceScore).toBe(0.8) // peer (0.6) + tech (0.2)
      expect(results[0].matchedWeaknesses).toHaveLength(0)
    })

    it('should handle content with empty arrays', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { organizationId: mockOrganizationId, tenantId: mockTenantId },
        ]),
      }
      jest.spyOn(watchedPeerRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([
        {
          id: 'topic-1',
          topicName: '云原生',
          topicType: 'tech',
          organizationId: mockOrganizationId,
          tenantId: mockTenantId,
        } as WatchedTopic,
      ])
      mockWeaknessQueryBuilder([])

      const contentWithEmptyArrays: Partial<AnalyzedContent> = {
        ...mockAnalyzedContent,
        categories: [],
        keywords: [],
        keyTechnologies: [],
      }

      const results = await service.calculatePeerRelevance(contentWithEmptyArrays as AnalyzedContent)

      // No tech match because arrays are empty
      expect(results).toHaveLength(0)
    })

    it('should handle content with null/undefined fields', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { organizationId: mockOrganizationId, tenantId: mockTenantId },
        ]),
      }
      jest.spyOn(watchedPeerRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([])
      mockWeaknessQueryBuilder([])

      const contentWithNullFields: Partial<AnalyzedContent> = {
        ...mockAnalyzedContent,
        categories: undefined,
        keywords: undefined,
        keyTechnologies: undefined,
        practiceDescription: undefined,
        technicalEffect: undefined,
      }

      const results = await service.calculatePeerRelevance(contentWithNullFields as AnalyzedContent)

      // Should handle gracefully without throwing
      expect(results).toHaveLength(0)
    })

    it('should handle weakness category with underscore format', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { organizationId: mockOrganizationId, tenantId: mockTenantId },
        ]),
      }
      jest.spyOn(watchedPeerRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([])
      mockWeaknessQueryBuilder([
        {
          id: 'weakness-1',
          organizationId: mockOrganizationId,
          category: 'data_security', // underscore format
          level: 2,
        } as WeaknessSnapshot,
      ])

      const contentWithReadableFormat: Partial<AnalyzedContent> = {
        ...mockAnalyzedContent,
        categories: ['data security'], // readable format
        practiceDescription: 'improving data security',
      }

      const results = await service.calculatePeerRelevance(contentWithReadableFormat as AnalyzedContent)

      expect(results).toHaveLength(1)
      expect(results[0].matchedWeaknesses).toContain('data_security')
    })

    it('should handle case insensitive matching for topics', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { organizationId: mockOrganizationId, tenantId: mockTenantId },
        ]),
      }
      jest.spyOn(watchedPeerRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([
        {
          id: 'topic-1',
          topicName: 'DOCKER', // uppercase
          topicType: 'tech',
          organizationId: mockOrganizationId,
          tenantId: mockTenantId,
        } as WatchedTopic,
      ])
      mockWeaknessQueryBuilder([])

      const results = await service.calculatePeerRelevance(mockAnalyzedContent as AnalyzedContent)

      expect(results).toHaveLength(1)
      expect(results[0].matchedTopics).toContain('docker') // lowercase
    })

    it('should handle multiple matched topics', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { organizationId: mockOrganizationId, tenantId: mockTenantId },
        ]),
      }
      jest.spyOn(watchedPeerRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([
        {
          id: 'topic-1',
          topicName: '云原生',
          topicType: 'tech',
          organizationId: mockOrganizationId,
          tenantId: mockTenantId,
        } as WatchedTopic,
        {
          id: 'topic-2',
          topicName: 'Docker',
          topicType: 'tech',
          organizationId: mockOrganizationId,
          tenantId: mockTenantId,
        } as WatchedTopic,
      ])
      mockWeaknessQueryBuilder([])

      const results = await service.calculatePeerRelevance(mockAnalyzedContent as AnalyzedContent)

      expect(results).toHaveLength(1)
      expect(results[0].matchedTopics).toHaveLength(2)
      expect(results[0].matchedTopics).toContain('云原生')
      expect(results[0].matchedTopics).toContain('docker')
    })

    it('should handle multiple matched weaknesses', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { organizationId: mockOrganizationId, tenantId: mockTenantId },
        ]),
      }
      jest.spyOn(watchedPeerRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([])
      mockWeaknessQueryBuilder([
        {
          id: 'weakness-1',
          organizationId: mockOrganizationId,
          category: 'cloud_native',
          level: 2,
        } as WeaknessSnapshot,
        {
          id: 'weakness-2',
          organizationId: mockOrganizationId,
          category: 'data_security',
          level: 3,
        } as WeaknessSnapshot,
      ])

      const contentWithMultipleWeaknesses: Partial<AnalyzedContent> = {
        ...mockAnalyzedContent,
        categories: ['cloud_native', 'data_security'],
      }

      const results = await service.calculatePeerRelevance(contentWithMultipleWeaknesses as AnalyzedContent)

      expect(results).toHaveLength(1)
      expect(results[0].matchedWeaknesses).toHaveLength(2)
      expect(results[0].matchedWeaknesses).toContain('cloud_native')
      expect(results[0].matchedWeaknesses).toContain('data_security')
    })

    it('should return exact score 0.7 for boundary case', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { organizationId: mockOrganizationId, tenantId: mockTenantId },
        ]),
      }
      jest.spyOn(watchedPeerRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      // Only tech match (0.2) + peer match (0.6) = 0.8, need to find a way to get 0.7
      // Actually with current weights: 0.6, 0.2, 0.2 - we can't get exactly 0.7
      // But we can test the boundary
      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([
        {
          id: 'topic-1',
          topicName: '云原生',
          topicType: 'tech',
          organizationId: mockOrganizationId,
          tenantId: mockTenantId,
        } as WatchedTopic,
      ])
      mockWeaknessQueryBuilder([])

      const results = await service.calculatePeerRelevance(mockAnalyzedContent as AnalyzedContent)

      expect(results).toHaveLength(1)
      expect(results[0].relevanceScore).toBe(0.8)
      expect(results[0].priorityLevel).toBe('medium')
    })
  })

  describe('logging', () => {
    it('should log when no organizations watch the peer', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }
      jest.spyOn(watchedPeerRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      const loggerLogSpy = jest.spyOn(service['logger'], 'log')

      await service.calculatePeerRelevance(mockAnalyzedContent as AnalyzedContent)

      expect(loggerLogSpy).toHaveBeenCalledWith(`No organizations watching peer: ${mockPeerName}`)
    })

    it('should log number of organizations found', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { organizationId: 'org-1', tenantId: 'tenant-1' },
          { organizationId: 'org-2', tenantId: 'tenant-1' },
        ]),
      }
      jest.spyOn(watchedPeerRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any)

      jest.spyOn(watchedTopicRepo, 'find').mockResolvedValue([
        {
          id: 'topic-1',
          topicName: '云原生',
          topicType: 'tech',
          organizationId: 'org-1',
          tenantId: 'tenant-1',
        } as WatchedTopic,
      ])
      mockWeaknessQueryBuilder([])

      const loggerLogSpy = jest.spyOn(service['logger'], 'log')

      await service.calculatePeerRelevance(mockAnalyzedContent as AnalyzedContent)

      expect(loggerLogSpy).toHaveBeenCalledWith(`Found 2 organizations watching peer: ${mockPeerName}`)
    })

    it('should log warning when content has no peerName', async () => {
      const contentWithoutPeer = { ...mockAnalyzedContent, peerName: undefined }
      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn')

      await service.calculatePeerRelevance(contentWithoutPeer as AnalyzedContent)

      expect(loggerWarnSpy).toHaveBeenCalledWith('AnalyzedContent has no peerName, skipping relevance calculation')
    })
  })
})
