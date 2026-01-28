import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import * as crypto from 'crypto'

import { RawContent } from '../../../database/entities/raw-content.entity'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'
import { Tag } from '../../../database/entities/tag.entity'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'
import { TagService } from './tag.service'
import { AnalyzedContentService } from './analyzed-content.service'

/**
 * AIAnalysisService - AI 分析服务
 *
 * Story 2.2: 使用通义千问 AI 智能分析推送内容的相关性
 *
 * 核心功能：
 * - analyze: AI 分析原始内容，提取标签、关键词、目标受众、AI 摘要
 * - analyzeWithCache: 带缓存的 AI 分析（24 小时 TTL）
 * - extractTags: 从 AI 响应中提取并创建标签
 *
 * 设计原则：
 * - 使用通义千问单模型（成本约为 GPT-4 的 1/10）
 * - Redis 缓存 AI 结果（24 小时 TTL）
 * - 失败重试机制（5 分钟后重试 1 次）
 * - 记录 Token 消耗用于成本监控
 */
@Injectable()
export class AIAnalysisService {
  private readonly logger = new Logger(AIAnalysisService.name)
  private readonly CACHE_TTL = 24 * 60 * 60 // 24 小时
  private readonly CACHE_KEY_PREFIX = 'radar:ai:analysis:'

  constructor(
    @InjectRepository(RawContent)
    private readonly rawContentRepo: Repository<RawContent>,
    @InjectQueue('radar:crawler')
    private readonly crawlerQueue: Queue,
    private readonly aiOrchestrator: AIOrchestrator,
    private readonly tagService: TagService,
    private readonly analyzedContentService: AnalyzedContentService,
  ) {}

  /**
   * AI 分析原始内容（带缓存）
   *
   * @param rawContent - 原始内容
   * @param category - 内容分类（tech/industry/compliance）
   * @returns AI 分析结果
   */
  async analyzeWithCache(
    rawContent: RawContent,
    category: string,
  ): Promise<AnalyzedContent> {
    // 1. 计算内容哈希
    const contentHash = this.calculateContentHash(rawContent)
    // Include organizationId in cache key for multi-tenant isolation
    const orgPrefix = rawContent.organizationId || 'public'
    const cacheKey = `${this.CACHE_KEY_PREFIX}${orgPrefix}:${contentHash}`

    // 2. 获取 Redis 客户端（通过 BullMQ Queue）
    const redisClient = await this.crawlerQueue.client

    // 3. 检查缓存
    const cachedResult = await redisClient.get(cacheKey)
    if (cachedResult) {
      this.logger.log(`Cache hit for content ${contentHash} (org: ${orgPrefix})`)
      return JSON.parse(cachedResult)
    }

    // 4. 执行 AI 分析
    const result = await this.analyze(rawContent, category)

    // 5. 缓存结果
    await redisClient.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result))

    return result
  }

  /**
   * AI 分析原始内容
   *
   * @param rawContent - 原始内容
   * @param category - 内容分类
   * @returns AI 分析结果
   */
  async analyze(
    rawContent: RawContent,
    category: string,
  ): Promise<AnalyzedContent> {
    try {
      this.logger.log(`Analyzing content ${rawContent.id} (${category})`)

      // 1. 选择合适的 prompt
      const prompt = this.getPromptByCategory(category)

      // 2. 调用 AIOrchestrator，使用通义千问
      const aiResponse = await this.aiOrchestrator.generate(
        {
          systemPrompt: prompt,
          prompt: this.formatContent(rawContent),
          temperature: 0.3, // 较低温度，确保输出稳定
        },
        AIModel.DOMESTIC, // 使用通义千问
      )

      // 3. 解析 AI 响应
      const parsedResult = this.parseAIResponse(aiResponse.content)

      // 4. 创建或查找标签
      const tags = await this.createOrFindTags(parsedResult.tags)

      // 5. 创�� AnalyzedContent 记录
      const analyzedContent = await this.analyzedContentService.create({
        contentId: rawContent.id,
        tags,
        keywords: parsedResult.keywords,
        categories: parsedResult.categories,
        targetAudience: parsedResult.targetAudience,
        aiSummary: parsedResult.aiSummary,
        roiAnalysis: null, // Story 2.3 will calculate this
        relevanceScore: null, // Story 2.3 will calculate this
        aiModel: aiResponse.model,
        tokensUsed: aiResponse.tokens.total,
        status: 'success',
        analyzedAt: new Date(),
      })

      this.logger.log(
        `Analysis completed for content ${rawContent.id}, tokens: ${aiResponse.tokens.total}`,
      )

      return analyzedContent
    } catch (error) {
      this.logger.error(`AI analysis failed for content ${rawContent.id}`, error.stack)

      // 创建失败记录
      const failedContent = await this.analyzedContentService.create({
        contentId: rawContent.id,
        tags: [],
        keywords: [],
        categories: [],
        targetAudience: null,
        aiSummary: null,
        roiAnalysis: null,
        relevanceScore: null,
        aiModel: 'qwen-turbo',
        tokensUsed: 0,
        status: 'failed',
        errorMessage: error.message,
        analyzedAt: new Date(),
      })

      throw error
    }
  }

  /**
   * 根据分类获取 AI Prompt
   *
   * @param category - 内容分类
   * @returns AI Prompt
   */
  private getPromptByCategory(category: string): string {
    const basePrompt = `你是一位资深的金融IT技术专家。请分析以下内容，提取结构化信息。

请以 JSON 格式返回结果，包含以下字段：
- tags: 标签数组（技术领域、同业机构、合规标签等）
- keywords: 关键词数组（非结构化关键词）
- categories: 技术分类数组（更细粒度的分类）
- targetAudience: 目标受众（如：IT总监、架构师、开发团队）
- aiSummary: 简洁的摘要（200字以内）

示例输出格式：
{
  "tags": ["云原生", "Kubernetes", "零信任"],
  "keywords": ["容器编排", "微服务", "安全架构"],
  "categories": ["基础设施", "安全"],
  "targetAudience": "IT总监、架构师",
  "aiSummary": "本文介绍了零信任架构在云原生环境下的实施方案..."
}`

    switch (category) {
      case 'tech':
        return `${basePrompt}

特别关注：
- 技术趋势和成熟度
- 实施难度和成本
- 适用的金融场景`

      case 'industry':
        return `${basePrompt}

特别关注：
- 同业机构名称
- 实施案例和效果
- 可借鉴的最佳实践`

      case 'compliance':
        return `${basePrompt}

特别关注：
- 监管政策和法规
- 合规要求和处罚案例
- 应对措施和剧本`

      default:
        return basePrompt
    }
  }

  /**
   * 格式化内容为 AI 输入
   *
   * @param rawContent - 原始内容
   * @returns 格式化后的内容
   */
  private formatContent(rawContent: RawContent): string {
    return `
标题：${rawContent.title}

${rawContent.summary ? `摘要：${rawContent.summary}\n` : ''}

正文：
${rawContent.fullContent}

来源：${rawContent.source}
发布日期：${rawContent.publishDate || '未知'}
`
  }

  /**
   * 解析 AI 响应
   *
   * @param aiResponse - AI 响应内容
   * @returns 解析后的结果
   */
  private parseAIResponse(aiResponse: string): {
    tags: string[]
    keywords: string[]
    categories: string[]
    targetAudience: string
    aiSummary: string
  } {
    try {
      // 尝试解析 JSON
      const parsed = JSON.parse(aiResponse)

      return {
        tags: parsed.tags || [],
        keywords: parsed.keywords || [],
        categories: parsed.categories || [],
        targetAudience: parsed.targetAudience || null,
        aiSummary: parsed.aiSummary || null,
      }
    } catch (error) {
      this.logger.error('Failed to parse AI response as JSON', error.stack)

      // 降级：返回空结果
      return {
        tags: [],
        keywords: [],
        categories: [],
        targetAudience: null,
        aiSummary: null,
      }
    }
  }

  /**
   * 创建或查找标签
   *
   * @param tagNames - 标签名称数组
   * @returns 标签实体数组
   */
  private async createOrFindTags(tagNames: string[]): Promise<Tag[]> {
    const tags: Tag[] = []

    for (const name of tagNames) {
      const tag = await this.tagService.findOrCreate(name, 'tech')
      tags.push(tag)
    }

    return tags
  }

  /**
   * 计算内容哈希（用于缓存 key）
   *
   * @param rawContent - 原始内容
   * @returns 内容哈希
   */
  private calculateContentHash(rawContent: RawContent): string {
    const content = `${rawContent.title}|${rawContent.url}|${rawContent.publishDate}`
    return crypto.createHash('sha256').update(content).digest('hex')
  }

  /**
   * 获取ROI分析Prompt (Story 2.4)
   *
   * @param rawContent - 原始内容
   * @param weaknessCategory - 薄弱项类别 (如"数据安全")
   * @returns ROI分析Prompt
   */
  private getROIAnalysisPrompt(
    rawContent: RawContent,
    weaknessCategory?: string,
  ): string {
    return `你是一位资深的金融IT投资分析专家。请分析以下技术方案的投资回报率(ROI)。

技术方案：
标题：${rawContent.title}
摘要：${rawContent.summary}
${weaknessCategory ? `关联薄弱项：${weaknessCategory}` : ''}

请以JSON格式返回ROI分析结果，包含以下字段：
- estimatedCost: 预计投入成本（字符串，如"50-100万"）
- expectedBenefit: 预期收益（字符串，如"年节省200万运维成本"）
- roiEstimate: ROI估算（字符串，如"ROI 2:1"或"ROI 1:8"）
- implementationPeriod: 实施周期（字符串，如"3-6个月"）
- recommendedVendors: 推荐供应商（字符串数组，如["阿里云", "腾讯云", "华为云"]）

示例输出格式：
{
  "estimatedCost": "50-100万",
  "expectedBenefit": "年节省200万运维成本 + 提升系统可用性",
  "roiEstimate": "ROI 2:1",
  "implementationPeriod": "3-6个月",
  "recommendedVendors": ["阿里云", "腾讯云", "华为云"]
}

注意事项：
1. 成本估算要考虑中小金融机构的预算约束（年预算通常100-300万）
2. 收益要具体量化（避免罚款金额、节省成本、提升效率等）
3. ROI计算公式：(预期收益 - 投入成本) / 投入成本
4. 供应商推荐要有金融行业资质
5. 如果信息不足，标注"需进一步评估"
`
  }

  /**
   * 分析技术方案的ROI (Story 2.4)
   *
   * @param contentId - AnalyzedContent ID
   * @param weaknessCategory - 薄弱项类别（可选）
   * @returns ROI分析结果
   */
  async analyzeROI(
    contentId: string,
    weaknessCategory?: string,
  ): Promise<{
    estimatedCost: string
    expectedBenefit: string
    roiEstimate: string
    implementationPeriod: string
    recommendedVendors: string[]
  }> {
    try {
      // 1. 加载AnalyzedContent和RawContent
      const analyzedContent =
        await this.analyzedContentService.findById(contentId)
      if (!analyzedContent) {
        throw new Error(`AnalyzedContent not found: ${contentId}`)
      }

      const rawContent = await this.rawContentRepo.findOne({
        where: { id: analyzedContent.contentId },
      })
      if (!rawContent) {
        throw new Error(`RawContent not found: ${analyzedContent.contentId}`)
      }

      // 2. 检查Redis缓存（包含organizationId以支持多租户隔离）
      const orgId = rawContent.organizationId || 'public'
      const cacheKey = `radar:roi:${orgId}:${contentId}:${weaknessCategory || 'general'}`
      const redisClient = await this.crawlerQueue.client
      const cachedResult = await redisClient.get(cacheKey)

      if (cachedResult) {
        this.logger.log(`ROI cache hit for content ${contentId}`)
        return JSON.parse(cachedResult)
      }

      // 3. 调用通义千问API
      const prompt = this.getROIAnalysisPrompt(rawContent, weaknessCategory)
      const aiResponse = await this.aiOrchestrator.generate(
        {
          systemPrompt: '',
          prompt,
          temperature: 0.3,
        },
        AIModel.DOMESTIC,
      )

      // 4. 解析AI响应
      const roiAnalysis = this.parseROIResponse(aiResponse.content)

      // 5. 缓存结果（7天TTL）
      const CACHE_TTL = 7 * 24 * 60 * 60 // 7天
      await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(roiAnalysis))

      // 6. 更新AnalyzedContent
      await this.analyzedContentService.update(contentId, {
        roiAnalysis,
      })

      this.logger.log(
        `ROI analysis completed for content ${contentId}, tokens: ${aiResponse.tokens.total}`,
      )

      return roiAnalysis
    } catch (error) {
      this.logger.error(
        `ROI analysis failed for content ${contentId}`,
        error.stack,
      )
      throw error
    }
  }

  /**
   * 解析ROI分析响应 (Story 2.4)
   */
  private parseROIResponse(content: string): {
    estimatedCost: string
    expectedBenefit: string
    roiEstimate: string
    implementationPeriod: string
    recommendedVendors: string[]
  } {
    try {
      // 尝试解析JSON
      const parsed = JSON.parse(content)

      // 验证必填字段
      if (
        !parsed.estimatedCost ||
        !parsed.expectedBenefit ||
        !parsed.roiEstimate
      ) {
        throw new Error('Missing required ROI fields')
      }

      return {
        estimatedCost: parsed.estimatedCost,
        expectedBenefit: parsed.expectedBenefit,
        roiEstimate: parsed.roiEstimate,
        implementationPeriod: parsed.implementationPeriod || '需进一步评估',
        recommendedVendors: parsed.recommendedVendors || [],
      }
    } catch (error) {
      this.logger.error('Failed to parse ROI response', error.stack)

      // 降级策略：返回默认值
      return {
        estimatedCost: '需进一步评估',
        expectedBenefit: '需进一步评估',
        roiEstimate: '需进一步评估',
        implementationPeriod: '需进一步评估',
        recommendedVendors: [],
      }
    }
  }
}
