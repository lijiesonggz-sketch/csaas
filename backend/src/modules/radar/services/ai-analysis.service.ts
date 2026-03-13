import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import * as crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'

import { RawContent } from '../../../database/entities/raw-content.entity'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'
import { Tag } from '../../../database/entities/tag.entity'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'
import { TagService } from './tag.service'
import { AnalyzedContentService } from './analyzed-content.service'
import { CompliancePlaybook } from '../../../database/entities/compliance-playbook.entity'
import { AIUsageService } from '../../admin/cost-optimization/ai-usage.service'
import { AIUsageTaskType } from '../../../database/entities/ai-usage-log.entity'

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

  // 缓存统计（Story 4.2 - AC 2）
  private cacheStats = {
    hits: 0,
    misses: 0,
  }

  constructor(
    @InjectRepository(RawContent)
    private readonly rawContentRepo: Repository<RawContent>,
    @InjectQueue('radar-crawler')
    private readonly crawlerQueue: Queue,
    private readonly aiOrchestrator: AIOrchestrator,
    private readonly tagService: TagService,
    private readonly analyzedContentService: AnalyzedContentService,
    private readonly aiUsageService: AIUsageService,
  ) {}

  /**
   * AI 分析原始内容（带缓存）
   *
   * @param rawContent - 原始内容
   * @param category - 内容分类（tech/industry/compliance）
   * @returns AI 分析结果
   */
  async analyzeWithCache(rawContent: RawContent, category: string): Promise<AnalyzedContent> {
    // 1. 计算内容哈希
    const contentHash = this.calculateContentHash(rawContent)
    // Include organizationId in cache key for multi-tenant isolation
    const orgPrefix = rawContent.organizationId || 'public'
    const cacheKey = `${this.CACHE_KEY_PREFIX}${orgPrefix}:${contentHash}`

    // 2. 获取 Redis 客户端（通过 BullMQ Queue）
    const redisClient = await this.crawlerQueue.client

    // 3. 检查缓存 - 只使用有效的缓存（必须有 id 且状态为 success）
    const cachedResult = await redisClient.get(cacheKey)
    if (cachedResult) {
      const parsed = JSON.parse(cachedResult)
      // 验证缓存数据完整性：必须有 id 且状态为 success
      if (parsed && parsed.id && parsed.status === 'success') {
        this.logger.log(`Cache hit for content ${contentHash} (org: ${orgPrefix})`)
        // Story 4.2 - AC 2: 缓存命中率监控
        this.cacheStats.hits++
        return parsed
      } else {
        this.logger.warn(`Cache hit for content ${contentHash} but data incomplete (missing id or not success), re-analyzing`)
        // 删除无效缓存
        await redisClient.del(cacheKey)
      }
    }

    // Story 4.2 - AC 2: 缓存未命中计数
    this.cacheStats.misses++

    // 4. 执行 AI 分析
    const result = await this.analyze(rawContent, category)

    // 5. 只缓存成功的分析结果（有 id 且状态为 success）
    if (result && result.id && result.status === 'success') {
      await redisClient.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result))
    } else {
      this.logger.warn(`Analysis result incomplete, not caching: contentId=${rawContent.id}, hasId=${!!result?.id}, status=${result?.status}`)
    }

    return result
  }

  /**
   * AI 分析原始内容
   *
   * @param rawContent - 原始内容
   * @param category - 内容分类
   * @returns AI 分析结果
   */
  async analyze(rawContent: RawContent, category: string): Promise<AnalyzedContent> {
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
          maxTokens: 5000, // 设置最大token数
          // 合规雷达强制返回JSON格式
          ...(category === 'compliance' && { responseFormat: { type: 'json_object' } }),
        },
        AIModel.DOMESTIC, // 使用通义千问
      )

      // Story 7.4: Log AI usage for cost tracking
      try {
        const taskType = this.getTaskTypeByCategory(category)
        await this.aiUsageService.logAIUsage({
          organizationId: rawContent.organizationId,
          taskType,
          inputTokens: aiResponse.tokens.prompt,
          outputTokens: aiResponse.tokens.completion,
          modelName: aiResponse.model,
          requestId: rawContent.id,
        })
      } catch (error) {
        // Don't fail the analysis if logging fails
        this.logger.warn(`Failed to log AI usage for content ${rawContent.id}`, error)
      }

      // 3. 解析 AI 响应
      const parsedResult = this.parseAIResponse(aiResponse.content)

      // 4. 创建或查找标签
      const tags = await this.createOrFindTags(parsedResult.tags)

      // 5. 创建 AnalyzedContent 记录
      const analyzedContent = await this.analyzedContentService.create({
        contentId: rawContent.id,
        tags,
        keywords: parsedResult.keywords,
        categories: parsedResult.categories,
        targetAudience: parsedResult.targetAudience,
        aiSummary: parsedResult.aiSummary,
        roiAnalysis: null, // Story 2.3 will calculate this
        relevanceScore: null, // Story 2.3 will calculate this
        // 行业雷达特定字段 (Story 3.2)
        practiceDescription: parsedResult.practiceDescription || null,
        estimatedCost: parsedResult.estimatedCost || null,
        implementationPeriod: parsedResult.implementationPeriod || null,
        technicalEffect: parsedResult.technicalEffect || null,
        // 合规雷达特定字段 (Story 4.1)
        ...(parsedResult.complianceAnalysis
          ? { complianceAnalysis: parsedResult.complianceAnalysis }
          : {}),
        aiModel: aiResponse.model,
        tokensUsed: aiResponse.tokens.total,
        status: 'success',
        analyzedAt: new Date(),
      } as any)

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
重要提示: 必须返回完整的JSON对象,不要只返回文本摘要。必须确保complianceRiskCategory字段有值。

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
        return `你是一位资深的金融IT技术专家。请分析以下同业技术实践案例,提取结构化信息。

输入内容将包含:
- 标题
- 来源
- 同业机构名称(如果已提取)
- 正文内容

请以JSON格式返回结果,包含以下字段:
- practiceDescription: 技术实践场景描述(100-200字,聚焦技术方案和实施过程)
- estimatedCost: 投入成本(如"50-100万"、"约80万",如果未提及则返回null)
- implementationPeriod: 实施周期(如"3-6个月"、"历时半年",如果未提及则返回null)
- technicalEffect: 技术效果(如"部署时间从2小时缩短到10分钟",如果未提及则返回null)
- categories: 技术分类标签数组(如["云原生", "容器化", "DevOps"])
- keywords: 关键词数组(如["Kubernetes", "Docker", "微服务"])
- tags: 标签数组(技术领域、同业机构等)
- targetAudience: 目标受众(如:IT总监、架构师)
- aiSummary: 简洁的摘要(200字以内)

示例输出格式:
{
  "practiceDescription": "杭州银行于2025年启动容器化改造项目,采用Kubernetes作为容器编排平台,实现应用的快速部署和弹性伸缩。项目分三期实施,首期完成核心业务系统容器化,建立CI/CD流水线。",
  "estimatedCost": "120万",
  "implementationPeriod": "6个月",
  "technicalEffect": "应用部署时间从2小时缩短到10分钟,运维效率提升60%,资源利用率提升40%",
  "categories": ["云原生", "容器化", "DevOps"],
  "keywords": ["Kubernetes", "Docker", "微服务", "CI/CD"],
  "tags": ["云原生", "杭州银行", "容器化"],
  "targetAudience": "IT总监、架构师",
  "aiSummary": "杭州银行通过容器化改造实现应用快速部署,显著提升运维效率和资源利用率"
}

注意事项:
1. practiceDescription必须聚焦技术方案和实施过程,避免泛泛而谈
2. 成本、周期、效果如果文中未明确提及,返回null而不是猜测
3. categories和keywords要准确反映技术领域
4. 如果内容中提到同业机构名称,务必包含在tags中`

      case 'compliance':
        return `你是一位资深的金融合规专家。请分析以下合规雷达内容,提取结构化信息。

【重要】必须返回完整的JSON对象,不要只返回文本摘要。必须确保complianceRiskCategory字段有值。

输入内容将包含:
- 标题
- 来源(监管机构)
- 正文内容
- 类型(处罚通报/政策征求意见)

请以JSON格式返回结果,包含以下字段:
- complianceRiskCategory: 合规风险类别(必填,如"数据安全"、"网络安全"、"反洗钱"、"消费者权益保护"、"信息披露违规"、"内控缺陷"、"治理架构")
- penaltyCase: 处罚案例描述(如果type为penalty,包含被处罚机构、原因、金额、政策依据,如果type为policy_draft则返回null)
- policyRequirements: 政策主要要求(如果type为policy_draft,包含政策关键要求,如果type为penalty则返回null)
- remediationSuggestions: 整改建议或应对措施(针对处罚或政策要求的建议,不能为空)
- relatedWeaknessCategories: 关联的薄弱项类别数组(如["数据安全", "网络与信息安全", "个人信息保护", "内控体系", "治理架构"])
- categories: 技术分类标签数组
- keywords: 关键词数组
- tags: 标签数组(合规标签、监管机构等)
- targetAudience: 目标受众(如:合规部门、IT部门、管理层)
- aiSummary: 简洁的摘要(200字以内)

处罚通报示例输出格式:
{
  "complianceRiskCategory": "数据安全",
  "penaltyCase": "某银行因数据安全管理不到位,违反《银行业金融机构数据治理指引》,被处以50万元罚款。该行在客户敏感信息保护、数据访问控制等方面存在缺陷。",
  "policyRequirements": null,
  "remediationSuggestions": "1. 建立完善的数据分类分级制度;2. 加强数据访问控制和权限管理;3. 定期开展数据安全审计;4. 提升员工数据安全意识",
  "relatedWeaknessCategories": ["数据安全", "个人信息保护", "安全治理"],
  "categories": ["合规", "数据安全"],
  "keywords": ["数据治理", "信息安全", "监管处罚"],
  "tags": ["数据安全法", "银保监会", "数据治理"],
  "targetAudience": "合规部门、IT部门、管理层",
  "aiSummary": "银保监会对某银行数据安全违规行为处以50万元罚款,暴露该行在敏感信息保护和访问控制方面的不足。"
}

政策征求意见示例输出格式:
{
  "complianceRiskCategory": "网络安全",
  "penaltyCase": null,
  "policyRequirements": "金融机构应当建立健全网络安全防护体系,包括:1. 网络分区管理;2. 安全监测预警;3. 应急响应机制;4. 供应链安全管理。要求于2026年12月前完成整改。",
  "remediationSuggestions": "1. 评估现有网络安全防护体系的差距;2. 制定网络分区管理方案;3. 部署安全监测工具;4. 建立应急响应预案;5. 加强供应商安全管理",
  "relatedWeaknessCategories": ["网络与信息安全", "安全运营"],
  "categories": ["合规", "网络安全"],
  "keywords": ["网络安全", "监管要求", "合规管理"],
  "tags": ["网络安全法", "人民银行", "合规"],
  "targetAudience": "合规部门、IT部门",
  "aiSummary": "人民银行发布金融机构网络安全管理新规征求意见稿,要求建立完善的网络分区、监测预警和应急响应体系。"
}

注意事项:
1. 根据内容类型(penalty/policy_draft)返回相应字段,另一类型返回null
2. complianceRiskCategory要准确识别合规风险领域
3. remediationSuggestions要具体可操作
4. relatedWeaknessCategories要映射到系统中的薄弱项类别
5. categories和keywords要准确反映合规和技术领域
6. 如果文中提到监管机构,务必包含在tags中`

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
${rawContent.peerName ? `同业机构：${rawContent.peerName}\n` : ''}

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
    practiceDescription?: string | null
    estimatedCost?: string | null
    implementationPeriod?: string | null
    technicalEffect?: string | null
    complianceAnalysis?: {
      complianceRiskCategory?: string
      penaltyCase?: string
      policyRequirements?: string
      remediationSuggestions?: string
      relatedWeaknessCategories?: string[]
    } | null
  } {
    try {
      // 尝试解析 JSON
      const parsed = JSON.parse(aiResponse)

      // Code Review Fix #2: 验证行业雷达字段类型
      const validateStringField = (value: any): string | null => {
        if (value === null || value === undefined) return null
        if (typeof value === 'string') return value
        // 如果是其他类型，转换为字符串
        this.logger.warn(`Field type mismatch, converting to string: ${typeof value}`)
        return String(value)
      }

      // Story 4.1: 验证合规雷达字段
      const validateComplianceAnalysis = (value: any): any => {
        if (!value || typeof value !== 'object') return null

        return {
          complianceRiskCategory: validateStringField(value.complianceRiskCategory),
          penaltyCase: validateStringField(value.penaltyCase),
          policyRequirements: validateStringField(value.policyRequirements),
          remediationSuggestions: validateStringField(value.remediationSuggestions),
          relatedWeaknessCategories: Array.isArray(value.relatedWeaknessCategories)
            ? value.relatedWeaknessCategories
            : [],
        }
      }

      return {
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        categories: Array.isArray(parsed.categories) ? parsed.categories : [],
        targetAudience: parsed.targetAudience || null,
        aiSummary: parsed.aiSummary || null,
        // 行业雷达特定字段 (Story 3.2) - 添加类型验证
        practiceDescription: validateStringField(parsed.practiceDescription),
        estimatedCost: validateStringField(parsed.estimatedCost),
        implementationPeriod: validateStringField(parsed.implementationPeriod),
        technicalEffect: validateStringField(parsed.technicalEffect),
        // 合规雷达特定字段 (Story 4.1)
        complianceAnalysis: validateComplianceAnalysis(parsed),
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
        practiceDescription: null,
        estimatedCost: null,
        implementationPeriod: null,
        technicalEffect: null,
        complianceAnalysis: null,
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
  private getROIAnalysisPrompt(rawContent: RawContent, weaknessCategory?: string): string {
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
      const analyzedContent = await this.analyzedContentService.findById(contentId)
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
        // Story 4.2 - AC 2: 缓存命中率监控
        this.cacheStats.hits++
        return JSON.parse(cachedResult)
      }

      // Story 4.2 - AC 2: 缓存未命中计数
      this.cacheStats.misses++

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
      this.logger.error(`ROI analysis failed for content ${contentId}`, error.stack)
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
      if (!parsed.estimatedCost || !parsed.expectedBenefit || !parsed.roiEstimate) {
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

  /**
   * 生成合规应对剧本 (Story 4.2 - Task 2.1)
   *
   * @param analyzedContent - AI分析结果
   * @param rawContent - 原始内容
   * @returns 合规应对剧本（不含数据库字段）
   */
  async generateCompliancePlaybook(
    analyzedContent: AnalyzedContent,
    rawContent: RawContent,
  ): Promise<
    Omit<CompliancePlaybook, 'id' | 'pushId' | 'createdAt'> & {
      generatedAt: Date
    }
  > {
    const cacheKey = `radar:compliance:playbook:${rawContent.id}`
    const redisClient = await this.crawlerQueue.client

    // 1. 检查缓存
    const cached = await redisClient.get(cacheKey)
    if (cached) {
      this.logger.log(`Playbook cache hit for ${rawContent.id}`)
      // Story 4.2 - AC 2: 缓存命中率监控
      this.cacheStats.hits++
      return JSON.parse(cached)
    }

    // Story 4.2 - AC 2: 缓存未命中计数
    this.cacheStats.misses++

    // 2. 调用AI生成
    let playbook: Omit<CompliancePlaybook, 'id' | 'pushId' | 'createdAt'> & {
      generatedAt: Date
    }
    try {
      const prompt = this.getCompliancePlaybookPrompt(rawContent, analyzedContent)
      const aiResponse = await this.aiOrchestrator.generate(
        {
          systemPrompt: prompt,
          prompt: this.formatContent(rawContent),
          temperature: 0.3,
        },
        AIModel.DOMESTIC,
      )

      // 3. 验证AI响应
      const validatedPlaybook = this.validatePlaybookStructure(JSON.parse(aiResponse.content))

      playbook = {
        ...validatedPlaybook,
        organizationId: rawContent.organizationId,
        generatedAt: new Date(),
      }

      // 4. 保存到缓存（TTL=7天）
      await redisClient.setex(cacheKey, 7 * 24 * 60 * 60, JSON.stringify(playbook))

      return playbook
    } catch (error) {
      // 5. 降级策略：返回默认剧本
      this.logger.error(`Failed to generate playbook: ${error.message}`)
      return this.getDefaultPlaybook(analyzedContent, rawContent)
    }
  }

  /**
   * Schema验证：验证剧本结构 (Story 4.2)
   */
  private validatePlaybookStructure(
    playbook: any,
  ): Omit<CompliancePlaybook, 'id' | 'pushId' | 'createdAt' | 'generatedAt'> {
    if (!playbook.checklistItems || !Array.isArray(playbook.checklistItems)) {
      throw new Error('Invalid playbook structure: missing checklistItems')
    }
    if (playbook.checklistItems.length < 5 || playbook.checklistItems.length > 10) {
      throw new Error('Checklist items must be 5-10 items')
    }

    // 验证每个checklistItem包含必需字段
    playbook.checklistItems.forEach((item: any) => {
      if (!item.id || !item.text || !item.category) {
        throw new Error('Invalid checklist item: missing required fields')
      }
      // 生成UUID v4如果缺失
      if (!item.id) {
        item.id = uuidv4()
      }
    })

    return playbook
  }

  /**
   * 获取合规应对剧本Prompt (Story 4.2)
   */
  private getCompliancePlaybookPrompt(
    rawContent: RawContent,
    analyzedContent: AnalyzedContent,
  ): string {
    return `你是一位资深的金融合规专家。请为以下合规内容生成应对剧本。

原始内容：
标题：${rawContent.title}
${rawContent.summary ? `摘要：${rawContent.summary}\n` : ''}
正文：${rawContent.fullContent}

AI分析结果：
合规风险类别：${analyzedContent.complianceAnalysis?.complianceRiskCategory}
整改建议：${analyzedContent.complianceAnalysis?.remediationSuggestions}

请以JSON格式返回应对剧本，包含以下字段：
- checklistItems: 自查清单数组（5-10项），每项包含：
  * id: UUID v4格式
  * text: 检查项描述（具体、可操作）
  * category: 检查项分类（与合规风险类别一致）
  * checked: 是否已勾选（默认false）
  * order: 显示顺序（1-10）
- solutions: 整改方案数组（2-3个），每项包含：
  * name: 方案名称
  * estimatedCost: 预计投入成本（数字，单位：元）
  * expectedBenefit: 预期收益（数字，包含避免罚款金额，单位：元）
  * roiScore: ROI评分（0-10分）
  * implementationTime: 实施周期（如"2个月"、"6周"）
- reportTemplate: 完整的汇报文本模板（供用户填写自查结果）
- policyReference: 相关法律法规链接数组（如有多条）

示例输出格式：
{
  "checklistItems": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "text": "审查当前数据安全管理制度是否完善",
      "category": "数据安全",
      "checked": false,
      "order": 1
    },
    ...
  ],
  "solutions": [
    {
      "name": "升级数据访问控制系统",
      "estimatedCost": 500000,
      "expectedBenefit": 2000000,
      "roiScore": 7,
      "implementationTime": "2个月"
    }
  ],
  "reportTemplate": "合规自查报告\\n\\n一、自查情况\\n...",
  "policyReference": ["https://example.com/law1", "https://example.com/law2"]
}

注意事项：
1. checklistItems必须是5-10项
2. 每个检查项要具体、可操作、可验证
3. solutions的ROI评分应根据(避免罚款-投入)/投入计算
4. reportTemplate要提供完整的汇报模板框架
5. 如果内容中提到相关法律法规，务必包含在policyReference中`
  }

  /**
   * 生成默认剧本降级策略 (Story 4.2)
   */
  private getDefaultPlaybook(
    analyzedContent: AnalyzedContent,
    rawContent: RawContent,
  ): Omit<CompliancePlaybook, 'id' | 'pushId' | 'createdAt'> & {
    generatedAt: Date
  } {
    const category = analyzedContent.complianceAnalysis?.complianceRiskCategory || '合规'

    return {
      organizationId: rawContent.organizationId,
      checklistItems: [
        {
          id: uuidv4(),
          text: `审查当前${category}管理制度`,
          category,
          checked: false,
          order: 1,
        },
        {
          id: uuidv4(),
          text: analyzedContent.complianceAnalysis?.remediationSuggestions || '制定整改计划',
          category,
          checked: false,
          order: 2,
        },
        {
          id: uuidv4(),
          text: `开展${category}培训`,
          category,
          checked: false,
          order: 3,
        },
        {
          id: uuidv4(),
          text: '建立相关控制机制',
          category,
          checked: false,
          order: 4,
        },
        {
          id: uuidv4(),
          text: '定期开展审计检查',
          category,
          checked: false,
          order: 5,
        },
      ],
      solutions: [
        {
          name: '基础合规加固',
          estimatedCost: 50000,
          expectedBenefit: 200000,
          roiScore: this.calculateComplianceROI({
            estimatedCost: 50000,
            expectedBenefit: 200000,
          }),
          implementationTime: '1个月',
        },
        {
          name: '完善管理制度',
          estimatedCost: 30000,
          expectedBenefit: 150000,
          roiScore: this.calculateComplianceROI({
            estimatedCost: 30000,
            expectedBenefit: 150000,
          }),
          implementationTime: '2周',
        },
        {
          name: '人员培训与意识提升',
          estimatedCost: 20000,
          expectedBenefit: 100000,
          roiScore: this.calculateComplianceROI({
            estimatedCost: 20000,
            expectedBenefit: 100000,
          }),
          implementationTime: '持续进行',
        },
      ],
      reportTemplate: `合规自查报告

一、自查背景
根据${analyzedContent.complianceAnalysis?.complianceRiskCategory || '合规要求'}，对现有${category}管理情况进行自查。

二、自查内容
（请根据实际情况填写）

三、发现问题
（请根据实际情况填写）

四、整改计划
（请根据实际情况填写）

五、整改完成情况
（请根据实际情况填写）

自查人：__________
日期：__________`,
      policyReference: [],
      generatedAt: new Date(),
    }
  }

  /**
   * 计算合规整改方案ROI (Story 4.2 - Task 3.1)
   *
   * @param solution - 整改方案
   * @returns ROI评分 (0-10)
   */
  calculateComplianceROI(solution: { estimatedCost: number; expectedBenefit: number }): number {
    const { estimatedCost, expectedBenefit } = solution

    // 输入验证
    if (!estimatedCost || estimatedCost <= 0) {
      throw new Error('Invalid estimated cost')
    }

    // ROI计算
    const roi = (expectedBenefit - estimatedCost) / estimatedCost

    // ROI评分映射 (0-10)
    // Story 4.2要求：ROI>5→9-10分, 3-5→7-8分, 1-3→5-6分, <1→1-4分
    if (roi >= 5) {
      return Math.min(10, 9 + (roi - 5)) // 9-10
    } else if (roi >= 3) {
      return 7 + Math.min(roi - 3, 2) // 7-8 (roi为3时得7分，5时得9分但已进入上一个分支)
    } else if (roi >= 1) {
      return 5 + Math.min(roi - 1, 2) * 2 // 5-6 (roi为1时得5分，3时得9分但已进入上一个分支)
    } else {
      return Math.max(1, roi * 4) // 1-4
    }
  }

  /**
   * 计算合规内容相关性评分 (Story 4.2 - AC 1)
   *
   * 相关性评分算法：薄弱项匹配权重0.5 + 关注领域匹配权重0.3 + 关注同业匹配权重0.2
   * 评分阈值：≥0.9高相关, 0.7-0.9中相关, <0.7低相关
   * policy_draft类型自动标注高优先级
   *
   * @param analyzedContent - AI分析结果
   * @param organizationWeaknesses - 组织薄弱项列表
   * @param organizationFocusAreas - 组织关注领域列表
   * @param organizationPeerBanks - 组织关注同业列表
   * @returns 相关性评分 (0-1) 和 相关性等级
   */
  calculateComplianceRelevance(
    analyzedContent: AnalyzedContent,
    organizationWeaknesses: string[] = [],
    organizationFocusAreas: string[] = [],
    organizationPeerBanks: string[] = [],
  ): {
    score: number
    level: 'high' | 'medium' | 'low'
    details: {
      weaknessMatch: number
      focusAreaMatch: number
      peerBankMatch: number
      matchedWeaknesses: string[]
      matchedFocusAreas: string[]
    }
  } {
    const complianceAnalysis = analyzedContent.complianceAnalysis
    if (!complianceAnalysis) {
      return {
        score: 0,
        level: 'low',
        details: {
          weaknessMatch: 0,
          focusAreaMatch: 0,
          peerBankMatch: 0,
          matchedWeaknesses: [],
          matchedFocusAreas: [],
        },
      }
    }

    // 1. 薄弱项匹配（权重0.5）
    const relatedWeaknessCategories = complianceAnalysis.relatedWeaknessCategories || []
    const matchedWeaknesses = relatedWeaknessCategories.filter((weakness) =>
      organizationWeaknesses.includes(weakness),
    )
    const weaknessMatchScore =
      organizationWeaknesses.length > 0
        ? matchedWeaknesses.length / organizationWeaknesses.length
        : 0

    // 2. 关注领域匹配（权重0.3）
    const categories = analyzedContent.categories || []
    const matchedFocusAreas = categories.filter((category) =>
      organizationFocusAreas.includes(category),
    )
    const focusAreaMatchScore =
      organizationFocusAreas.length > 0
        ? matchedFocusAreas.length / organizationFocusAreas.length
        : 0

    // 3. 关注同业匹配（权重0.2）- 对于合规雷达，这部分权重较低
    // 因为合规风险通常与同业无关，更多关注监管要求
    const tags = analyzedContent.tags?.map((tag) => tag.name) || []
    const peerBankMatchScore = 0 // 合规雷达暂不计算同业匹配

    // 4. 计算总分（对于合规雷达，由于peerBankMatch=0，重新归一化权重）
    // 原始权重：薄弱项0.5 + 关注领域0.3 + 关注同业0.2 = 1.0
    // 合规雷达：薄弱项0.5 + 关注领域0.3 = 0.8，需要归一化到1.0
    const normalizedScore =
      weaknessMatchScore * 0.5 + focusAreaMatchScore * 0.3 > 0
        ? (weaknessMatchScore * 0.5 + focusAreaMatchScore * 0.3) / 0.8
        : 0

    // 5. 确定相关性等级
    let level: 'high' | 'medium' | 'low'
    if (normalizedScore >= 0.9) {
      level = 'high'
    } else if (normalizedScore >= 0.7) {
      level = 'medium'
    } else {
      level = 'low'
    }

    return {
      score: Math.round(normalizedScore * 1000) / 1000, // 保留3位小数
      level,
      details: {
        weaknessMatch: weaknessMatchScore, // 不舍入，保留原始分数
        focusAreaMatch: focusAreaMatchScore, // 不舍入，保留原始分数
        peerBankMatch: 0,
        matchedWeaknesses,
        matchedFocusAreas,
      },
    }
  }

  /**
   * 获取缓存命中率统计 (Story 4.2 - AC 2)
   *
   * @returns 缓存统计信息（命中率、命中次数、未命中次数）
   */
  getCacheStats(): {
    hitRate: number
    hits: number
    misses: number
    totalRequests: number
  } {
    const totalRequests = this.cacheStats.hits + this.cacheStats.misses
    const hitRate = totalRequests > 0 ? this.cacheStats.hits / totalRequests : 0

    return {
      hitRate: Math.round(hitRate * 1000) / 1000, // 保留3位小数
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
      totalRequests,
    }
  }

  /**
   * Map category to AI usage task type (Story 7.4)
   *
   * @param category - Content category
   * @returns AI usage task type
   */
  private getTaskTypeByCategory(category: string): AIUsageTaskType {
    switch (category) {
      case 'tech':
        return AIUsageTaskType.TECH_ANALYSIS
      case 'industry':
        return AIUsageTaskType.INDUSTRY_ANALYSIS
      case 'compliance':
        return AIUsageTaskType.COMPLIANCE_ANALYSIS
      default:
        return AIUsageTaskType.TECH_ANALYSIS // Default fallback
    }
  }

  /**
   * 重置缓存统计 (Story 4.2 - AC 2)
   * 用于定期重置计数器或测试目的
   */
  resetCacheStats(): void {
    this.cacheStats = {
      hits: 0,
      misses: 0,
    }
    this.logger.log('Cache stats reset')
  }
}
