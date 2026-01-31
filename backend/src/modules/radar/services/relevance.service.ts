import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, In, DataSource } from 'typeorm'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'
import { RadarPush } from '../../../database/entities/radar-push.entity'
import { WeaknessSnapshot } from '../../../database/entities/weakness-snapshot.entity'
import { WatchedTopic } from '../../../database/entities/watched-topic.entity'
import { WatchedPeer } from '../../../database/entities/watched-peer.entity'
import { Organization } from '../../../database/entities/organization.entity'
import {
  WeaknessCategory,
  getCategoryDisplayName as getWeaknessCategoryDisplayName,
} from '../../../constants/categories'
import { PushFrequencyControlService } from './push-frequency-control.service'
import {
  RELEVANCE_WEIGHTS,
  RELEVANCE_THRESHOLDS,
  PRIORITY_THRESHOLDS,
  TOPIC_MATCH_WEIGHTS,
  WEAKNESS_LEVEL_CONFIG,
  TIMEZONE_CONFIG,
  SCHEDULE_CONFIG,
} from '../config/relevance.config'

/**
 * RelevanceService - 相关性计算服务
 *
 * Story 2.3: 推送系统与调度 - Phase 2
 *
 * 核心功能：
 * - calculateRelevance: 计算内容与组织的相关性评分
 * - calculateWeaknessMatch: 计算薄弱项匹配度 (权重 0.6)
 * - calculateTopicMatch: 计算关注领域匹配度 (权重 0.4)
 * - calculatePriority: 根据相关性评分计算优先级
 * - getNextScheduledTime: 计算下次推送时间
 *
 * 相关性算法：
 * relevanceScore = (weaknessMatch * 0.6) + (topicMatch * 0.4)
 * - ≥ 0.9: 高相关 (创建推送)
 * - 0.7-0.9: 中相关 (不推送)
 * - < 0.7: 低相关 (不推送)
 *
 * 配置参数见: ../config/relevance.config.ts
 */

// UUID验证正则
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

@Injectable()
export class RelevanceService {
  private readonly logger = new Logger(RelevanceService.name)

  constructor(
    @InjectRepository(AnalyzedContent)
    private readonly analyzedContentRepo: Repository<AnalyzedContent>,
    @InjectRepository(RadarPush)
    private readonly radarPushRepo: Repository<RadarPush>,
    @InjectRepository(WeaknessSnapshot)
    private readonly weaknessSnapshotRepo: Repository<WeaknessSnapshot>,
    @InjectRepository(WatchedTopic)
    private readonly watchedTopicRepo: Repository<WatchedTopic>,
    @InjectRepository(WatchedPeer)
    private readonly watchedPeerRepo: Repository<WatchedPeer>,
    @InjectRepository(Organization)
    private readonly organizationRepo: Repository<Organization>,
    private readonly pushFrequencyControlService: PushFrequencyControlService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 计算内容与所有活跃组织的相关性
   *
   * AC 1: 相关性计算
   * - 加载 AnalyzedContent 和所有活跃组织的 WeaknessSnapshot、WatchedTopic
   * - 对每个组织计算相关性评分 (0-1)
   * - 薄弱项匹配权重 0.6，关注领域匹配权重 0.4
   *
   * AC 2: 创建推送记录
   * - 相关性评分 ≥ 0.9 时创建 RadarPush 记录
   *
   * @param contentId - AnalyzedContent ID
   */
  async calculateRelevance(contentId: string): Promise<void> {
    const startTime = Date.now()

    // 输入验证
    if (!contentId || !UUID_REGEX.test(contentId)) {
      this.logger.error(`Invalid contentId format: ${contentId}`)
      throw new Error(`Invalid contentId format: ${contentId}`)
    }

    this.logger.log(`Starting relevance calculation for content: ${contentId}`)

    // 1. 加载 AnalyzedContent
    const content = await this.analyzedContentRepo.findOne({
      where: { id: contentId },
      relations: ['tags', 'rawContent'],
    })

    if (!content) {
      this.logger.error(`AnalyzedContent not found: ${contentId}`)
      throw new Error(`AnalyzedContent not found: ${contentId}`)
    }

    if (content.status !== 'success') {
      this.logger.warn(
        `AnalyzedContent ${contentId} status is ${content.status}, skipping relevance calculation`,
      )
      return
    }

    this.logger.log(
      `Loaded content: ${content.rawContent?.title || 'Untitled'} (${content.categories.length} categories, ${content.tags.length} tags)`,
    )

    // 2. 获取所有活跃组织
    const organizations = await this.organizationRepo.find({
      where: { radarActivated: true },
    })

    this.logger.log(`Found ${organizations.length} active organizations`)

    // 3. 批量加载所有组织的薄弱项和关注领域（避免N+1查询）
    const orgIds = organizations.map((org) => org.id)


    const [allWeaknesses, allTopics] = await Promise.all([
      this.weaknessSnapshotRepo.find({
        where: { organizationId: In(orgIds) },
        order: { level: 'ASC' },
      }),
      this.watchedTopicRepo.find({
        where: { organizationId: In(orgIds) },
      }),
    ])

    // 按organizationId分组
    const weaknessByOrg = new Map<string, WeaknessSnapshot[]>()
    const topicsByOrg = new Map<string, WatchedTopic[]>()

    for (const weakness of allWeaknesses) {
      if (!weaknessByOrg.has(weakness.organizationId)) {
        weaknessByOrg.set(weakness.organizationId, [])
      }
      weaknessByOrg.get(weakness.organizationId).push(weakness)
    }

    for (const topic of allTopics) {
      if (!topicsByOrg.has(topic.organizationId)) {
        topicsByOrg.set(topic.organizationId, [])
      }
      topicsByOrg.get(topic.organizationId).push(topic)
    }


    // 4. 对每个组织计算相关性
    let pushesCreated = 0
    let failedOrganizations = 0

    for (const org of organizations) {
      try {
        // 4.1 获取该组织的薄弱项和关注领域
        const weaknesses = weaknessByOrg.get(org.id) || []
        const topics = topicsByOrg.get(org.id) || []

        this.logger.log(
          `Processing organization ${org.name}: ${weaknesses.length} weaknesses, ${topics.length} topics`,
        )

        // 3.2 计算薄弱项匹配度和关注领域匹配度
        const weaknessMatch = this.calculateWeaknessMatch(content, weaknesses)
        const topicMatch = this.calculateTopicMatch(content, topics)

        // 3.3 计算相关性评分
        const relevanceScore = weaknessMatch * RELEVANCE_WEIGHTS.WEAKNESS + topicMatch * RELEVANCE_WEIGHTS.TOPIC

        this.logger.debug(
          `Organization ${org.name}: weaknessMatch=${weaknessMatch.toFixed(2)}, topicMatch=${topicMatch.toFixed(2)}, relevanceScore=${relevanceScore.toFixed(2)}`,
        )

        // 3.4 仅创建高相关推送（≥0.9）
        if (relevanceScore >= RELEVANCE_THRESHOLDS.HIGH) {
          // 确定雷达类型（从 rawContent 的 category 字段）
          const radarType = (content.rawContent?.category ||
            'tech') as 'tech' | 'industry' | 'compliance'

          // 计算优先级
          const priorityLevel = this.calculatePriority(relevanceScore, radarType)

          // 计算下次推送时间
          const scheduledAt = this.getNextScheduledTime(radarType)

          // AC 6: 推送去重与频率控制（使用事务保护）
          const pushCreated = await this.createPushWithTransaction(
            org.id,
            org.name,
            content.id,
            radarType,
            relevanceScore,
            priorityLevel,
            scheduledAt,
          )

          if (pushCreated) {
            pushesCreated++
          }
        }
      } catch (error) {
        failedOrganizations++
        this.logger.error(
          `Failed to calculate relevance for organization ${org.name}:`,
          error.stack,
        )
        // 继续处理其他组织
      }
    }

    const executionTime = Date.now() - startTime

    this.logger.log(
      `Relevance calculation completed in ${executionTime}ms: ${pushesCreated} pushes created, ${failedOrganizations} organizations failed out of ${organizations.length} total`,
    )
  }

  /**
   * 计算薄弱项匹配度
   *
   * Task 2.2: 实现薄弱项匹配算法
   * - 支持完全匹配和模糊匹配
   * - 薄弱项 level 影响权重: level 1 (weight 1.0) → level 5 (weight 0.25)
   *
   * @param content - AI 分析内容
   * @param weaknesses - 组织的薄弱项快照
   * @returns 匹配度 (0-1)
   */
  private calculateWeaknessMatch(
    content: AnalyzedContent,
    weaknesses: WeaknessSnapshot[],
  ): number {
    if (weaknesses.length === 0) {
      return 0
    }

    let matchScore = 0

    for (const weakness of weaknesses) {
      // 获取薄弱项的中文显示名称（处理枚举值和AI分析结果的格式差异）
      const weaknessDisplayName = this.getCategoryDisplayName(weakness.category)

      // 检查 categories 是否包含薄弱项（支持完全匹配和模糊匹配）
      const categoryMatch = content.categories.some(
        (cat) =>
          cat === weaknessDisplayName ||
          cat.toLowerCase().includes(weaknessDisplayName.toLowerCase()) ||
          weaknessDisplayName.toLowerCase().includes(cat.toLowerCase()),
      )

      // 检查 tags 是否包含薄弱项
      const tagMatch = content.tags.some(
        (tag) =>
          tag.name === weaknessDisplayName ||
          tag.name.toLowerCase().includes(weaknessDisplayName.toLowerCase()) ||
          weaknessDisplayName.toLowerCase().includes(tag.name.toLowerCase()),
      )

      if (categoryMatch || tagMatch) {
        // 薄弱程度越高(level越低)，权重越大
        // level 1 → weight 1.0
        // level 2 → weight 0.75
        // level 3 → weight 0.5
        // level 4 → weight 0.25
        // level 5 → weight 0.0
        const weight = (WEAKNESS_LEVEL_CONFIG.MAX_LEVEL - weakness.level) / WEAKNESS_LEVEL_CONFIG.WEIGHT_DIVISOR
        matchScore = Math.max(matchScore, weight)

        this.logger.debug(
          `Weakness match found: ${weaknessDisplayName} (level ${weakness.level}, weight ${weight})`,
        )
      }
    }

    return matchScore
  }

  /**
   * 计算关注领域匹配度
   *
   * Task 2.3: 实现关注领域匹配算法
   * - 完全匹配: 权重 1.0
   * - 模糊匹配: 权重 0.7
   *
   * @param content - AI 分析内容
   * @param topics - 组织关注的主题
   * @returns 匹配度 (0-1)
   */
  private calculateTopicMatch(
    content: AnalyzedContent,
    topics: WatchedTopic[],
  ): number {
    if (topics.length === 0) {
      return 0
    }

    let maxScore = 0

    for (const topic of topics) {
      // 完全匹配（权重1.0）
      const exactTagMatch = content.tags.some(
        (tag) => tag.name.toLowerCase() === topic.topicName.toLowerCase(),
      )
      const exactCategoryMatch = content.categories.some(
        (cat) => cat.toLowerCase() === topic.topicName.toLowerCase(),
      )

      if (exactTagMatch || exactCategoryMatch) {
        maxScore = TOPIC_MATCH_WEIGHTS.EXACT
        this.logger.debug(`Exact topic match found: ${topic.topicName}`)
        break // 找到完全匹配，直接返回
      }

      // 模糊匹配（权重0.7）- 包含关系
      const fuzzyTagMatch = content.tags.some(
        (tag) =>
          tag.name.toLowerCase().includes(topic.topicName.toLowerCase()) ||
          topic.topicName.toLowerCase().includes(tag.name.toLowerCase()),
      )
      const fuzzyCategoryMatch = content.categories.some(
        (cat) =>
          cat.toLowerCase().includes(topic.topicName.toLowerCase()) ||
          topic.topicName.toLowerCase().includes(cat.toLowerCase()),
      )

      if (fuzzyTagMatch || fuzzyCategoryMatch) {
        maxScore = Math.max(maxScore, TOPIC_MATCH_WEIGHTS.FUZZY)
        this.logger.debug(`Fuzzy topic match found: ${topic.topicName}`)
      }
    }

    return maxScore
  }

  /**
   * 将 WeaknessCategory 枚举值转换为中文显示名称
   *
   * Task 2.2: 辅助方法 - 处理枚举值和 AI 分析结果的格式差异
   *
   * @param category - WeaknessCategory 枚举值
   * @returns 中文显示名称
   */
  private getCategoryDisplayName(category: string): string {
    // 使用 constants/categories.ts 中的映射函数
    return getWeaknessCategoryDisplayName(category as WeaknessCategory)
  }

  /**
   * 根据相关性评分计算优先级
   *
   * Task 2.5: 实现优先级计算
   * - compliance 优先级最高
   * - relevanceScore ≥ 0.95: high
   * - relevanceScore ≥ 0.9: medium
   * - relevanceScore < 0.9: low
   *
   * @param relevanceScore - 相关性评分 (0-1)
   * @param radarType - 雷达类型
   * @returns 优先级 (high/medium/low)
   */
  private calculatePriority(
    relevanceScore: number,
    radarType: 'tech' | 'industry' | 'compliance',
  ): 'high' | 'medium' | 'low' {
    // compliance 优先级最高
    if (radarType === 'compliance' && relevanceScore >= RELEVANCE_THRESHOLDS.HIGH) {
      return 'high'
    }

    // 其他雷达类型根据评分判断
    if (relevanceScore >= PRIORITY_THRESHOLDS.HIGH) {
      return 'high'
    }

    if (relevanceScore >= PRIORITY_THRESHOLDS.MEDIUM) {
      return 'medium'
    }

    return 'low'
  }

  /**
   * 计算下次推送时间
   *
   * Task 2.5: 实现推送时间计算
   * - tech: 每周五 17:00 (UTC+8)
   * - industry: 每周三 17:00 (UTC+8)
   * - compliance: 每日 9:00 (UTC+8)
   *
   * Code Review Fix #5: 时区处理说明
   * 注意：当前使用手动时区偏移计算，未来可考虑使用date-fns-tz库以更好地处理DST
   *
   * @param radarType - 雷达类型
   * @returns 下次推送时间（UTC时间）
   */
  private getNextScheduledTime(
    radarType: 'tech' | 'industry' | 'compliance',
  ): Date {
    // 使用UTC+8时区（中国标准时间）
    // 注意：中国不使用夏令时，因此偏移量固定为-480分钟
    const now = new Date()
    const chinaOffset = TIMEZONE_CONFIG.CHINA_OFFSET_MINUTES
    const localOffset = now.getTimezoneOffset() // 本地时区偏移（分钟）
    const offsetDiff = chinaOffset + localOffset // 需要调整的分钟数

    const config = SCHEDULE_CONFIG[radarType.toUpperCase() as keyof typeof SCHEDULE_CONFIG]

    if (config.DAY_OF_WEEK === null) {
      // 每日推送（合规雷达）
      const nextPush = new Date(now)
      nextPush.setHours(config.HOUR, 0, 0, 0)
      nextPush.setMinutes(nextPush.getMinutes() - offsetDiff) // 转换为UTC

      // 如果今天的推送时间已过，推到明天
      if (nextPush <= now) {
        nextPush.setDate(nextPush.getDate() + 1)
      }

      return nextPush
    } else {
      // 每周推送（技术雷达、行业雷达）
      const currentDay = now.getDay()
      const targetDay = config.DAY_OF_WEEK

      // 计算距离下次目标日期的天数
      let daysUntilNext = targetDay - currentDay

      // 如果目标日期是今天，检查时间是否已过
      if (daysUntilNext === 0) {
        const todayScheduledTime = new Date(now)
        todayScheduledTime.setHours(config.HOUR, 0, 0, 0)
        todayScheduledTime.setMinutes(todayScheduledTime.getMinutes() - offsetDiff)

        if (now >= todayScheduledTime) {
          // 今天的推送时间已过，推到下周
          daysUntilNext = 7
        }
      } else if (daysUntilNext < 0) {
        // 目标日期在本周已过，推到下周
        daysUntilNext += 7
      }

      const nextPush = new Date(now)
      nextPush.setDate(nextPush.getDate() + daysUntilNext)
      nextPush.setHours(config.HOUR, 0, 0, 0)
      nextPush.setMinutes(nextPush.getMinutes() - offsetDiff) // 转换为UTC

      return nextPush
    }
  }

  /**
   * 计算行业雷达相关性 (Story 3.2)
   *
   * 相关性算法:
   * - 同业匹配权重: 0.5 (关注的同业机构)
   * - 薄弱项匹配权重: 0.3 (组织的薄弱项)
   * - 关注领域匹配权重: 0.2 (组织关注的技术领域)
   *
   * Code Review Fix #7: 权重设计说明
   * 权重分配原因:
   * - 同业匹配(0.5): 用户明确关注的同业机构，优先级最高，直接学习标杆经验
   * - 薄弱项匹配(0.3): 同业案例能解决用户的薄弱项，实用价值高
   * - 关注领域(0.2): 用户感兴趣的技术领域，但不一定直接解决问题
   *
   * 优先级判定:
   * - relevanceScore >= 0.9: high (强烈推荐)
   * - relevanceScore >= 0.7: medium (值得关注)
   * - relevanceScore < 0.7: low (参考价值)
   *
   * @param content - AI分析内容
   * @param organization - 组织信息
   * @returns 相关性评分和优先级
   */
  async calculateIndustryRelevance(
    content: AnalyzedContent,
    organization: Organization,
  ): Promise<{
    relevanceScore: number
    priorityLevel: 'high' | 'medium' | 'low'
  }> {
    // 1. 同业匹配 (权重0.5) - 用户明确关注的同业机构
    const watchedPeers = await this.watchedPeerRepo.find({
      where: { organizationId: organization.id },
    })

    const peerName = content.rawContent?.peerName
    const peerMatch = peerName && watchedPeers.some((peer) => peer.peerName === peerName) ? 1.0 : 0.0

    this.logger.debug(
      `Peer match for ${peerName}: ${peerMatch} (${watchedPeers.length} watched peers)`,
    )

    // 2. 薄弱项匹配 (权重0.3) - 同业案例能解决用户的薄弱项
    const weaknesses = await this.weaknessSnapshotRepo.find({
      where: { organizationId: organization.id },
    })

    const weaknessMatch = this.calculateWeaknessMatch(content, weaknesses)

    this.logger.debug(
      `Weakness match: ${weaknessMatch} (${weaknesses.length} weaknesses)`,
    )

    // 3. 关注领域匹配 (权重0.2) - 用户感兴趣的技术领域
    const topics = await this.watchedTopicRepo.find({
      where: { organizationId: organization.id },
    })

    const topicMatch = this.calculateTopicMatch(content, topics)

    this.logger.debug(`Topic match: ${topicMatch} (${topics.length} topics)`)

    // 4. 计算最终评分 (加权求和)
    const relevanceScore = peerMatch * 0.5 + weaknessMatch * 0.3 + topicMatch * 0.2

    // 5. 确定优先级
    const priorityLevel =
      relevanceScore >= 0.9 ? 'high' : relevanceScore >= 0.7 ? 'medium' : 'low'

    this.logger.log(
      `Industry relevance for ${organization.name}: score=${relevanceScore.toFixed(2)}, priority=${priorityLevel}`,
    )

    return {
      relevanceScore: parseFloat(relevanceScore.toFixed(2)),
      priorityLevel,
    }
  }

  /**
   * 计算合规雷达相关性 (Story 4.1)
   *
   * 相关性算法:
   * - 薄弱项匹配权重: 0.5 (优先匹配用户薄弱项)
   * - 关注领域匹配权重: 0.3 (用户关注的技术领域)
   * - 关注同业匹配权重: 0.2 (合规相关同业处罚案例)
   *
   * 优先级判定:
   * - relevanceScore >= 0.9: high (强烈推荐)
   * - relevanceScore >= 0.7: medium (值得关注)
   * - relevanceScore < 0.7: low (参考价值)
   *
   * @param content - AI分析内容
   * @param organization - 组织信息
   * @returns 相关性评分和优先级
   */
  async calculateComplianceRelevance(
    content: AnalyzedContent,
    organization: Organization,
  ): Promise<{
    relevanceScore: number
    priorityLevel: 'high' | 'medium' | 'low'
  }> {
    // 1. 薄弱项匹配 (权重0.5) - 优先匹配用户薄弱项
    const weaknesses = await this.weaknessSnapshotRepo.find({
      where: { organizationId: organization.id },
    })

    let weaknessMatch = 0
    if (content.complianceAnalysis?.relatedWeaknessCategories) {
      for (const weakness of weaknesses) {
        const weaknessDisplayName = this.getCategoryDisplayName(weakness.category)

        // 检查complianceAnalysis中的relatedWeaknessCategories是否匹配
        const categoryMatch = content.complianceAnalysis.relatedWeaknessCategories.some(
          (cat) =>
            cat === weaknessDisplayName ||
            cat.toLowerCase().includes(weaknessDisplayName.toLowerCase()) ||
            weaknessDisplayName.toLowerCase().includes(cat.toLowerCase()),
        )

        if (categoryMatch) {
          // 薄弱程度越高(level越低)，权重越大
          const weight = (WEAKNESS_LEVEL_CONFIG.MAX_LEVEL - weakness.level) / WEAKNESS_LEVEL_CONFIG.WEIGHT_DIVISOR
          weaknessMatch = Math.max(weaknessMatch, weight)

          this.logger.debug(
            `Compliance weakness match found: ${weaknessDisplayName} (level ${weakness.level}, weight ${weight})`,
          )
        }
      }
    }

    this.logger.debug(`Compliance weakness match: ${weaknessMatch} (${weaknesses.length} weaknesses)`)

    // 2. 关注领域匹配 (权重0.3) - 用户感兴趣的技术领域
    const topics = await this.watchedTopicRepo.find({
      where: { organizationId: organization.id },
    })

    const topicMatch = this.calculateTopicMatch(content, topics)

    this.logger.debug(`Compliance topic match: ${topicMatch} (${topics.length} topics)`)

    // 3. 关注同业匹配 (权重0.2) - 合规相关同业处罚案例
    const watchedPeers = await this.watchedPeerRepo.find({
      where: { organizationId: organization.id },
    })

    let peerMatch = 0
    // 检查处罚案例中是否包含关注的同业机构名称
    if (content.complianceAnalysis?.penaltyCase) {
      for (const peer of watchedPeers) {
        if (content.complianceAnalysis.penaltyCase.includes(peer.peerName)) {
          peerMatch = 1.0
          this.logger.debug(`Compliance peer match found: ${peer.peerName}`)
          break
        }
      }
    }

    this.logger.debug(`Compliance peer match: ${peerMatch} (${watchedPeers.length} watched peers)`)

    // 4. 计算最终评分 (加权求和)
    const relevanceScore = weaknessMatch * 0.5 + topicMatch * 0.3 + peerMatch * 0.2

    // 5. 确定优先级
    const priorityLevel =
      relevanceScore >= 0.9 ? 'high' : relevanceScore >= 0.7 ? 'medium' : 'low'

    this.logger.log(
      `Compliance relevance for ${organization.name}: score=${relevanceScore.toFixed(2)}, priority=${priorityLevel}`,
    )

    return {
      relevanceScore: parseFloat(relevanceScore.toFixed(2)),
      priorityLevel,
    }
  }

  /**
   * 使用事务创建推送记录（避免并发竞态条件）
   *
   * @param organizationId - 组织ID
   * @param organizationName - 组织名称
   * @param contentId - 内容ID
   * @param radarType - 雷达类型
   * @param relevanceScore - 相关性评分
   * @param priorityLevel - 优先级
   * @param scheduledAt - 推送时间
   * @returns 是否成功创建推送
   */
  private async createPushWithTransaction(
    organizationId: string,
    organizationName: string,
    contentId: string,
    radarType: 'tech' | 'industry' | 'compliance',
    relevanceScore: number,
    priorityLevel: 'high' | 'medium' | 'low',
    scheduledAt: Date,
  ): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      // 在事务中检查推送是否允许
      const checkResult = await this.pushFrequencyControlService.checkPushAllowed(
        organizationId,
        contentId,
        scheduledAt,
      )

      if (!checkResult.allowed) {
        // 如果推送限制达到5条，检查是否可以替换最低score推送
        if (checkResult.lowestPush && relevanceScore > checkResult.lowestPush.relevanceScore) {
          // 强制插入（替换最低score推送）
          await this.pushFrequencyControlService.forceInsertPush(
            organizationId,
            scheduledAt,
            {
              organizationId,
              radarType,
              contentId,
              relevanceScore: parseFloat(relevanceScore.toFixed(2)),
              priorityLevel,
              scheduledAt,
              status: 'scheduled',
            },
          )

          await queryRunner.commitTransaction()

          this.logger.log(
            `Force inserted RadarPush for ${organizationName}: score=${relevanceScore.toFixed(2)}, replaced lowest (${checkResult.lowestPush.relevanceScore})`,
          )

          return true
        } else {
          // 重复推送或新score不够高，跳过
          await queryRunner.rollbackTransaction()

          this.logger.debug(
            `Push not allowed for ${organizationName}: ${checkResult.reason}`,
          )

          return false
        }
      } else {
        // 允许创建推送
        const radarPush = this.radarPushRepo.create({
          organizationId,
          radarType,
          contentId,
          relevanceScore: parseFloat(relevanceScore.toFixed(2)),
          priorityLevel,
          scheduledAt,
          status: 'scheduled',
        })

        await queryRunner.manager.save(radarPush)
        await queryRunner.commitTransaction()

        this.logger.log(
          `Created RadarPush for ${organizationName}: score=${relevanceScore.toFixed(2)}, priority=${priorityLevel}, scheduledAt=${scheduledAt.toISOString()}`,
        )

        return true
      }
    } catch (error) {
      await queryRunner.rollbackTransaction()
      this.logger.error(
        `Failed to create push for ${organizationName}:`,
        error.stack,
      )
      return false
    } finally {
      await queryRunner.release()
    }
  }
}
