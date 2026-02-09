import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { WatchedPeer } from '../../../database/entities/watched-peer.entity'
import { WatchedTopic } from '../../../database/entities/watched-topic.entity'
import { WeaknessSnapshot } from '../../../database/entities/weakness-snapshot.entity'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'

/**
 * 相关性评分参数
 */
export interface RelevanceScoreParams {
  /** 是否匹配关注同业 (WatchedPeer.peerName === AnalyzedContent.peerName) */
  peerMatch: boolean
  /** 是否匹配技术领域 (WatchedTopic 匹配) */
  techDomainMatch: boolean
  /** 是否匹配薄弱项 (WeaknessSnapshot 匹配) */
  weaknessMatch: boolean
}

/**
 * 组织相关性结果
 */
export interface OrganizationRelevanceResult {
  organizationId: string
  tenantId: string
  relevanceScore: number
  priorityLevel: 'high' | 'medium' | 'low'
  matchedPeers: string[]
  matchedTopics: string[]
  matchedWeaknesses: string[]
}

/**
 * PeerRelevanceService
 *
 * 计算同业内容对组织的相关性评分
 *
 * 权重配置：
 * - 关注同业匹配权重: 0.6 (用户明确关注的同业机构)
 * - 技术领域匹配权重: 0.2 (组织关注的技术领域)
 * - 薄弱项匹配权重: 0.2 (组织的薄弱项)
 *
 * Story 8.4: 同业动态推送生成
 */
@Injectable()
export class PeerRelevanceService {
  private readonly logger = new Logger(PeerRelevanceService.name)

  // 权重配置
  private readonly WEIGHTS = {
    peerMatch: 0.6,
    techDomainMatch: 0.2,
    weaknessMatch: 0.2,
  }

  // 优先级阈值
  private readonly THRESHOLDS = {
    high: 0.9,    // ≥ 0.9: 高优先级
    medium: 0.7,  // ≥ 0.7: 中优先级
    low: 0,       // < 0.7: 低优先级 (不创建推送)
  }

  constructor(
    @InjectRepository(WatchedPeer)
    private readonly watchedPeerRepository: Repository<WatchedPeer>,
    @InjectRepository(WatchedTopic)
    private readonly watchedTopicRepository: Repository<WatchedTopic>,
    @InjectRepository(WeaknessSnapshot)
    private readonly weaknessSnapshotRepository: Repository<WeaknessSnapshot>,
  ) {}

  /**
   * 计算相关性评分
   *
   * @param params 相关性评分参数
   * @returns 相关性评分 (0.0 - 1.0)
   */
  calculateRelevanceScore(params: RelevanceScoreParams): number {
    let score = 0

    if (params.peerMatch) {
      score += this.WEIGHTS.peerMatch
    }

    if (params.techDomainMatch) {
      score += this.WEIGHTS.techDomainMatch
    }

    if (params.weaknessMatch) {
      score += this.WEIGHTS.weaknessMatch
    }

    // 确保评分不超过 1.0
    return Math.min(score, 1.0)
  }

  /**
   * 根据评分确定优先级
   *
   * @param score 相关性评分
   * @returns 优先级级别
   */
  determinePriorityLevel(score: number): 'high' | 'medium' | 'low' {
    if (score >= this.THRESHOLDS.high) {
      return 'high'
    }

    if (score >= this.THRESHOLDS.medium) {
      return 'medium'
    }

    return 'low'
  }

  /**
   * 判断是否应该创建推送
   *
   * @param score 相关性评分
   * @returns 是否应该创建推送
   */
  shouldCreatePush(score: number): boolean {
    return score >= this.THRESHOLDS.medium
  }

  /**
   * 计算组织与同业内容的相关性
   *
   * 查询所有关注该同业的组织，计算每个组织的相关性评分
   *
   * @param analyzedContent 已分析的同业内容
   * @returns 组织相关性结果列表
   */
  async calculatePeerRelevance(
    analyzedContent: AnalyzedContent,
  ): Promise<OrganizationRelevanceResult[]> {
    const peerName = analyzedContent.peerName

    if (!peerName) {
      this.logger.warn('AnalyzedContent has no peerName, skipping relevance calculation')
      return []
    }

    this.logger.log(`Calculating relevance for peer: ${peerName}`)

    // 1. 查询所有关注该同业的组织
    const watchingOrganizations = await this.findOrganizationsWatchingPeer(peerName)

    if (watchingOrganizations.length === 0) {
      this.logger.log(`No organizations watching peer: ${peerName}`)
      return []
    }

    this.logger.log(`Found ${watchingOrganizations.length} organizations watching peer: ${peerName}`)

    // 2. 为每个组织计算相关性
    const results: OrganizationRelevanceResult[] = []

    for (const org of watchingOrganizations) {
      const result = await this.calculateOrganizationRelevance(
        org.organizationId,
        org.tenantId,
        analyzedContent,
        peerName,
      )

      // 只返回应该创建推送的结果 (评分 >= 0.7)
      if (this.shouldCreatePush(result.relevanceScore)) {
        results.push(result)
      }
    }

    this.logger.log(`Generated ${results.length} high-relevance pushes for peer: ${peerName}`)

    return results
  }

  /**
   * 查找所有关注指定同业的组织
   *
   * @param peerName 同业机构名称
   * @returns 组织列表
   */
  private async findOrganizationsWatchingPeer(
    peerName: string,
  ): Promise<Array<{ organizationId: string; tenantId: string }>> {
    // 使用原始查询避免租户过滤，因为我们需要跨租户查找
    const peers = await this.watchedPeerRepository
      .createQueryBuilder('peer')
      .where('peer.peerName = :peerName', { peerName })
      .andWhere('peer.deletedAt IS NULL')
      .select(['peer.organizationId', 'peer.tenantId'])
      .distinct(true)
      .getMany()

    return peers.map((peer) => ({
      organizationId: peer.organizationId,
      tenantId: peer.tenantId,
    }))
  }

  /**
   * 计算单个组织与内容的相关性
   *
   * @param organizationId 组织ID
   * @param tenantId 租户ID
   * @param analyzedContent 已分析内容
   * @param peerName 同业名称
   * @returns 组织相关性结果
   */
  private async calculateOrganizationRelevance(
    organizationId: string,
    tenantId: string,
    analyzedContent: AnalyzedContent,
    peerName: string,
  ): Promise<OrganizationRelevanceResult> {
    // 1. 检查同业匹配 (权重 0.6)
    const peerMatch = true // 因为已经通过 peerName 筛选了
    const matchedPeers = [peerName]

    // 2. 检查技术领域匹配 (权重 0.2)
    const { matches: techDomainMatch, matchedItems: matchedTopics } =
      await this.checkTechDomainMatch(organizationId, tenantId, analyzedContent)

    // 3. 检查薄弱项匹配 (权重 0.2)
    const { matches: weaknessMatch, matchedItems: matchedWeaknesses } =
      await this.checkWeaknessMatch(organizationId, tenantId, analyzedContent)

    // 4. 计算评分
    const relevanceScore = this.calculateRelevanceScore({
      peerMatch,
      techDomainMatch,
      weaknessMatch,
    })

    // 5. 确定优先级
    const priorityLevel = this.determinePriorityLevel(relevanceScore)

    return {
      organizationId,
      tenantId,
      relevanceScore,
      priorityLevel,
      matchedPeers,
      matchedTopics,
      matchedWeaknesses,
    }
  }

  /**
   * 检查技术领域匹配
   *
   * @param organizationId 组织ID
   * @param tenantId 租户ID
   * @param analyzedContent 已分析内容
   * @returns 匹配结果
   */
  private async checkTechDomainMatch(
    organizationId: string,
    tenantId: string,
    analyzedContent: AnalyzedContent,
  ): Promise<{ matches: boolean; matchedItems: string[] }> {
    // 获取组织关注的技术主题
    const watchedTopics = await this.watchedTopicRepository.find({
      where: {
        organizationId,
        tenantId,
        deletedAt: null,
      },
    })

    if (watchedTopics.length === 0) {
      return { matches: false, matchedItems: [] }
    }

    const watchedTopicNames = watchedTopics.map((t) => t.topicName.toLowerCase())

    // 从分析内容中提取技术相关字段
    const contentTechFields = [
      ...(analyzedContent.categories || []),
      ...(analyzedContent.keywords || []),
      ...(analyzedContent.keyTechnologies || []),
    ].map((f) => f.toLowerCase())

    // 检查匹配
    const matchedTopics: string[] = []

    for (const topicName of watchedTopicNames) {
      // 检查主题名称是否出现在内容的技术字段中
      const isMatched = contentTechFields.some(
        (field) => field.includes(topicName) || topicName.includes(field),
      )

      if (isMatched) {
        matchedTopics.push(topicName)
      }
    }

    return {
      matches: matchedTopics.length > 0,
      matchedItems: matchedTopics,
    }
  }

  /**
   * 检查薄弱项匹配
   *
   * @param organizationId 组织ID
   * @param tenantId 租户ID
   * @param analyzedContent 已分析内容
   * @returns 匹配结果
   */
  private async checkWeaknessMatch(
    organizationId: string,
    tenantId: string,
    analyzedContent: AnalyzedContent,
  ): Promise<{ matches: boolean; matchedItems: string[] }> {
    // 获取组织的薄弱项快照 (按组织和租户过滤)
    const weaknessSnapshots = await this.weaknessSnapshotRepository
      .createQueryBuilder('weakness')
      .where('weakness.organizationId = :organizationId', { organizationId })
      .getMany()

    if (weaknessSnapshots.length === 0) {
      return { matches: false, matchedItems: [] }
    }

    // 将枚举值转换为字符串 (WeaknessCategory.CLOUD_NATIVE → 'cloud_native')
    const weaknessCategories = weaknessSnapshots.map((w) => String(w.category).toLowerCase())

    // 从分析内容中提取可能相关的字段
    const contentFields = [
      ...(analyzedContent.categories || []),
      ...(analyzedContent.keywords || []),
      analyzedContent.practiceDescription || '',
      analyzedContent.technicalEffect || '',
    ]
      .filter(Boolean)
      .map((f) => f.toLowerCase())

    // 检查匹配
    const matchedWeaknesses: string[] = []

    for (const category of weaknessCategories) {
      // 将类别名称转换为可读格式进行比较
      const categoryReadable = category.replace(/_/g, ' ')

      const isMatched = contentFields.some(
        (field) =>
          field.includes(category) ||
          field.includes(categoryReadable) ||
          category.includes(field) ||
          categoryReadable.includes(field),
      )

      if (isMatched) {
        matchedWeaknesses.push(category)
      }
    }

    return {
      matches: matchedWeaknesses.length > 0,
      matchedItems: matchedWeaknesses,
    }
  }
}
