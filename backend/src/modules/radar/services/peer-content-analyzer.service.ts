import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'

import { RawContent } from '../../../database/entities/raw-content.entity'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'
import { Alert } from '../../../database/entities/alert.entity'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'
import {
  QualityValidationService,
  FullValidationReport,
} from '../../quality-validation/quality-validation.service'
import {
  ResultAggregatorService,
  AggregationOutput,
} from '../../result-aggregation/result-aggregator.service'
import { ValidationResult } from '../../quality-validation/validators/consistency.validator'
import { AIUsageService } from '../../admin/cost-optimization/ai-usage.service'
import { AIUsageTaskType } from '../../../database/entities/ai-usage-log.entity'

/**
 * Peer Content Analysis Result
 */
export interface PeerContentAnalysisResult {
  practiceDescription: string
  estimatedCost: string
  implementationPeriod: string
  technicalEffect: string
  keyTechnologies: string[]
  applicableScenarios: string
  categories: string[]
  keywords: string[]
  tags: string[]
  targetAudience: string
  aiSummary: string
}

/**
 * PeerContentAnalyzerService
 *
 * Story 8.3: 同业内容三模型AI分析
 *
 * 使用三模型共识机制分析同业内容，提取高质量的技术方案、成本、效果信息
 */
@Injectable()
export class PeerContentAnalyzerService {
  private readonly logger = new Logger(PeerContentAnalyzerService.name)
  private readonly ANALYSIS_TIMEOUT = 30000 // 30秒超时

  constructor(
    private readonly aiOrchestrator: AIOrchestrator,
    private readonly qualityValidationService: QualityValidationService,
    private readonly resultAggregatorService: ResultAggregatorService,
    @InjectRepository(AnalyzedContent)
    private readonly analyzedContentRepository: Repository<AnalyzedContent>,
    @InjectRepository(RawContent)
    private readonly rawContentRepository: Repository<RawContent>,
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
    @InjectQueue('radar-push-generation')
    private readonly pushGenerationQueue: Queue,
    private readonly aiUsageService: AIUsageService,
  ) {}

  /**
   * 分析同业内容（供 Processor 调用）
   *
   * @param rawContentId - RawContent ID
   * @returns AnalyzedContent 记录
   */
  async analyzePeerContent(rawContentId: string): Promise<AnalyzedContent> {
    this.logger.log(`Starting peer content analysis for RawContent: ${rawContentId}`)

    // 1. 加载 RawContent
    const rawContent = await this.rawContentRepository.findOne({
      where: { id: rawContentId },
    })
    if (!rawContent) {
      throw new Error(`RawContent not found: ${rawContentId}`)
    }

    // 2. 并行调用三模型
    const modelResults = await this.callThreeModels(rawContent.fullContent)

    // 检查是否所有模型都失败
    const successfulModels = [modelResults.gpt4, modelResults.claude, modelResults.tongyi].filter(
      (r) => r !== null,
    )
    if (successfulModels.length === 0) {
      throw new Error('All models failed, cannot create AnalyzedContent')
    }

    // 3. 准备验证结果
    const validationInput: ValidationResult = {
      gpt4: modelResults.gpt4,
      claude: modelResults.claude,
      domestic: modelResults.tongyi,
    }

    // 4. 执行质量验证
    const validationReport = await this.qualityValidationService.validateQuality(validationInput)

    // 5. 确定置信度等级
    const confidenceLevel = this.determineConfidenceLevel(
      validationReport.overallScore,
      validationReport.confidenceLevel,
    )

    // 6. 处理低置信度情况
    if (confidenceLevel === 'low') {
      this.logger.warn(
        `Low confidence detected for RawContent ${rawContentId}, score: ${validationReport.overallScore}`,
      )
      return this.handleLowConfidence(
        rawContentId,
        rawContent,
        validationReport,
        modelResults,
      )
    }

    // 7. 聚合结果
    const aggregatedResult = await this.aggregateResults(
      rawContentId,
      modelResults,
      validationReport,
    )

    // 8. 创建 AnalyzedContent 记录
    const analyzedContent = await this.createAnalyzedContent(
      rawContentId,
      rawContent,
      aggregatedResult,
      modelResults,
      confidenceLevel,
      validationReport,
    )

    // 9. 触发推送生成任务（Story 8.4）
    await this.triggerPushGeneration(analyzedContent.id)

    this.logger.log(
      `Peer content analysis completed: ${analyzedContent.id}, confidence: ${confidenceLevel}`,
    )

    return analyzedContent
  }

  /**
   * 并行调用三模型
   *
   * @param content - 需要分析的原始内容
   * @returns 三模型结果
   */
  private async callThreeModels(content: string): Promise<{
    gpt4: PeerContentAnalysisResult | null
    claude: PeerContentAnalysisResult | null
    tongyi: PeerContentAnalysisResult | null
  }> {
    this.logger.log('Calling three models in parallel...')

    const prompt = this.getAnalysisPrompt()

    // 并行调用三模型
    const [gpt4Result, claudeResult, tongyiResult] = await Promise.all([
      this.callModelWithTimeout('gpt4', prompt, content),
      this.callModelWithTimeout('claude', prompt, content),
      this.callModelWithTimeout('tongyi', prompt, content),
    ])

    const successfulCount = [gpt4Result, claudeResult, tongyiResult].filter(
      (r) => r !== null,
    ).length

    this.logger.log(`Model results: GPT-4=${gpt4Result ? 'OK' : 'FAIL'}, Claude=${claudeResult ? 'OK' : 'FAIL'}, Tongyi=${tongyiResult ? 'OK' : 'FAIL'} (${successfulCount}/3)`)

    return {
      gpt4: gpt4Result,
      claude: claudeResult,
      tongyi: tongyiResult,
    }
  }

  /**
   * 调用单个模型（带超时）
   */
  private async callModelWithTimeout(
    model: 'gpt4' | 'claude' | 'tongyi',
    prompt: string,
    content: string,
  ): Promise<PeerContentAnalysisResult | null> {
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), this.ANALYSIS_TIMEOUT)
    })

    const callPromise = this.callSingleModel(model, prompt, content)

    try {
      return await Promise.race([callPromise, timeoutPromise])
    } catch (error) {
      this.logger.warn(`${model} call failed or timed out: ${error.message}`)
      return null
    }
  }

  /**
   * 调用单个模型
   */
  private async callSingleModel(
    model: 'gpt4' | 'claude' | 'tongyi',
    prompt: string,
    content: string,
  ): Promise<PeerContentAnalysisResult | null> {
    try {
      const aiModel = model === 'gpt4' ? AIModel.GPT4 : model === 'claude' ? AIModel.CLAUDE : AIModel.DOMESTIC

      const response = await this.aiOrchestrator.generate(
        {
          systemPrompt: prompt,
          prompt: content,
          temperature: 0.3,
        },
        aiModel,
      )

      // 记录AI使用
      try {
        await this.aiUsageService.logAIUsage({
          organizationId: 'system', // 系统级任务，使用system作为组织ID
          taskType: AIUsageTaskType.INDUSTRY_ANALYSIS,
          inputTokens: response.tokens.prompt,
          outputTokens: response.tokens.completion,
          modelName: response.model,
        })
      } catch (error) {
        this.logger.warn(`Failed to log AI usage: ${error.message}`)
      }

      // 解析响应
      return this.parseAIResponse(response.content)
    } catch (error) {
      this.logger.error(`${model} model call failed: ${error.message}`)
      return null
    }
  }

  /**
   * 获取AI分析Prompt
   */
  private getAnalysisPrompt(): string {
    return `你是一位资深的金融IT技术专家。请分析以下同业技术实践内容，提取关键信息。

请提取以下字段（JSON格式）：
{
  "practiceDescription": "技术实践详细描述（100-200字，聚焦技术方案和实施过程）",
  "estimatedCost": "预估投入成本（如'100-200万'，未提及则填'未提及'）",
  "implementationPeriod": "实施周期（如'6-12个月'，未提及则填'未提及'）",
  "technicalEffect": "技术效果/收益描述（未提及则填'未提及'）",
  "keyTechnologies": ["关键技术1", "关键技术2"],
  "applicableScenarios": "适用场景描述",
  "categories": ["技术分类1", "技术分类2"],
  "keywords": ["关键词1", "关键词2"],
  "tags": ["标签1", "标签2"],
  "targetAudience": "目标受众（如：IT总监、架构师）",
  "aiSummary": "简洁的AI摘要（200字以内）"
}

注意：
1. 如果内容中未提及某字段，使用"未提及"
2. 成本和周期请尽可能提取具体数值或范围
3. 描述应简洁但包含关键信息
4. 确保返回有效的JSON格式`
  }

  /**
   * 解析AI响应
   */
  private parseAIResponse(content: string): PeerContentAnalysisResult | null {
    try {
      // 尝试提取JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        this.logger.warn('No JSON found in AI response')
        return null
      }

      const parsed = JSON.parse(jsonMatch[0])

      return {
        practiceDescription: parsed.practiceDescription || '未提及',
        estimatedCost: parsed.estimatedCost || '未提及',
        implementationPeriod: parsed.implementationPeriod || '未提及',
        technicalEffect: parsed.technicalEffect || '未提及',
        keyTechnologies: Array.isArray(parsed.keyTechnologies) ? parsed.keyTechnologies : [],
        applicableScenarios: parsed.applicableScenarios || '未提及',
        categories: Array.isArray(parsed.categories) ? parsed.categories : [],
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        targetAudience: parsed.targetAudience || 'IT总监、架构师',
        aiSummary: parsed.aiSummary || '',
      }
    } catch (error) {
      this.logger.error(`Failed to parse AI response: ${error.message}`)
      return null
    }
  }

  /**
   * 聚合结果并选择最佳结果
   */
  private async aggregateResults(
    rawContentId: string,
    modelResults: {
      gpt4: PeerContentAnalysisResult | null
      claude: PeerContentAnalysisResult | null
      tongyi: PeerContentAnalysisResult | null
    },
    validationReport: FullValidationReport,
  ): Promise<AggregationOutput> {
    this.logger.log('Aggregating model results...')

    // 使用 ResultAggregatorService 进行聚合
    const aggregationInput = {
      taskId: rawContentId,
      generationType: 'peer_content_analysis' as any,
      gpt4Result: modelResults.gpt4,
      claudeResult: modelResults.claude,
      domesticResult: modelResults.tongyi,
      validationReport,
    }

    return this.resultAggregatorService.aggregate(aggregationInput)
  }

  /**
   * 创建 AnalyzedContent 记录
   */
  private async createAnalyzedContent(
    rawContentId: string,
    rawContent: RawContent,
    aggregatedResult: AggregationOutput,
    modelResults: {
      gpt4: PeerContentAnalysisResult | null
      claude: PeerContentAnalysisResult | null
      tongyi: PeerContentAnalysisResult | null
    },
    confidenceLevel: 'high' | 'medium' | 'low',
    validationReport: FullValidationReport,
  ): Promise<AnalyzedContent> {
    this.logger.log('Creating AnalyzedContent record...')

    const selectedResult = aggregatedResult.selectedResult as PeerContentAnalysisResult

    const analyzedContent = this.analyzedContentRepository.create({
      contentId: rawContentId,
      peerName: rawContent.peerName || '未知机构',
      practiceDescription: selectedResult.practiceDescription,
      estimatedCost: selectedResult.estimatedCost === '未提及' ? null : selectedResult.estimatedCost,
      implementationPeriod: selectedResult.implementationPeriod === '未提及' ? null : selectedResult.implementationPeriod,
      technicalEffect: selectedResult.technicalEffect === '未提及' ? null : selectedResult.technicalEffect,
      keyTechnologies: selectedResult.keyTechnologies,
      applicableScenarios: selectedResult.applicableScenarios === '未提及' ? null : selectedResult.applicableScenarios,
      categories: selectedResult.categories,
      keywords: selectedResult.keywords,
      targetAudience: selectedResult.targetAudience,
      aiSummary: selectedResult.aiSummary,
      confidence: confidenceLevel,
      overallSimilarity: validationReport.overallScore,
      qualityScores: validationReport.qualityScores,
      modelResults: {
        gpt4: modelResults.gpt4 || undefined,
        claude: modelResults.claude || undefined,
        tongyi: modelResults.tongyi || undefined,
      },
      selectedModel: aggregatedResult.selectedModel.toLowerCase() as 'gpt4' | 'claude' | 'tongyi',
      reviewStatus: confidenceLevel === 'low' ? 'pending' : 'approved',
      aiModel: aggregatedResult.selectedModel,
      tokensUsed: 0, // 将在后续计算
      status: 'success',
      analyzedAt: new Date(),
    })

    return this.analyzedContentRepository.save(analyzedContent)
  }

  /**
   * 处理低置信度情况
   */
  private async handleLowConfidence(
    rawContentId: string,
    rawContent: RawContent,
    validationReport: FullValidationReport,
    modelResults: {
      gpt4: PeerContentAnalysisResult | null
      claude: PeerContentAnalysisResult | null
      tongyi: PeerContentAnalysisResult | null
    },
  ): Promise<AnalyzedContent> {
    this.logger.log('Handling low confidence case...')

    // 1. 记录差异点
    const discrepancies = validationReport.consistencyReport.disagreements

    // 2. 使用通义千问单模型结果作为降级方案
    const fallbackResult = modelResults.tongyi || modelResults.gpt4 || modelResults.claude

    if (!fallbackResult) {
      throw new Error('All models failed, cannot create AnalyzedContent')
    }

    // 3. 创建 AnalyzedContent 记录（pending_review 状态）
    const analyzedContent = this.analyzedContentRepository.create({
      contentId: rawContentId,
      peerName: rawContent.peerName || '未知机构',
      practiceDescription: fallbackResult.practiceDescription,
      estimatedCost: fallbackResult.estimatedCost === '未提及' ? null : fallbackResult.estimatedCost,
      implementationPeriod: fallbackResult.implementationPeriod === '未提及' ? null : fallbackResult.implementationPeriod,
      technicalEffect: fallbackResult.technicalEffect === '未提及' ? null : fallbackResult.technicalEffect,
      keyTechnologies: fallbackResult.keyTechnologies,
      applicableScenarios: fallbackResult.applicableScenarios === '未提及' ? null : fallbackResult.applicableScenarios,
      categories: fallbackResult.categories,
      keywords: fallbackResult.keywords,
      targetAudience: fallbackResult.targetAudience,
      aiSummary: fallbackResult.aiSummary,
      confidence: 'low',
      overallSimilarity: validationReport.overallScore,
      qualityScores: validationReport.qualityScores,
      modelResults: {
        gpt4: modelResults.gpt4 || undefined,
        claude: modelResults.claude || undefined,
        tongyi: modelResults.tongyi || undefined,
      },
      selectedModel: modelResults.tongyi ? 'tongyi' : modelResults.gpt4 ? 'gpt4' : 'claude',
      reviewStatus: 'pending',
      discrepancies,
      aiModel: 'tongyi-fallback',
      tokensUsed: 0,
      status: 'success',
      analyzedAt: new Date(),
    })

    const savedContent = await this.analyzedContentRepository.save(analyzedContent)

    // 4. 创建运营审核告警
    await this.createReviewAlert(savedContent, discrepancies)

    return savedContent
  }

  /**
   * 创建运营审核告警
   */
  private async createReviewAlert(
    analyzedContent: AnalyzedContent,
    discrepancies: string[],
  ): Promise<void> {
    try {
      const alert = this.alertRepository.create({
        alertType: 'peer_content_review' as any,
        severity: 'medium',
        message: `低置信度同业内容需要审核: ${analyzedContent.peerName}, 差异点: ${discrepancies.length}个`,
        status: 'unresolved',
        metadata: {
          analyzedContentId: analyzedContent.id,
          rawContentId: analyzedContent.contentId,
          peerName: analyzedContent.peerName,
          overallScore: analyzedContent.overallSimilarity,
          discrepancies,
        },
      })

      await this.alertRepository.save(alert)

      this.logger.log(`Created review alert for AnalyzedContent: ${analyzedContent.id}`)
    } catch (error) {
      this.logger.error(`Failed to create review alert: ${error.message}`)
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 确定置信度等级
   */
  private determineConfidenceLevel(
    overallScore: number,
    validationConfidence: 'HIGH' | 'MEDIUM' | 'LOW',
  ): 'high' | 'medium' | 'low' {
    // 映射验证服务的置信度到我们的格式
    switch (validationConfidence) {
      case 'HIGH':
        return 'high'
      case 'MEDIUM':
        return 'medium'
      case 'LOW':
        return 'low'
      default:
        return overallScore >= 0.85 ? 'high' : overallScore >= 0.75 ? 'medium' : 'low'
    }
  }

  /**
   * 触发推送生成任务（Story 8.4）
   */
  private async triggerPushGeneration(analyzedContentId: string): Promise<void> {
    try {
      await this.pushGenerationQueue.add('generate-peer-push', {
        analyzedContentId,
        source: 'peer-crawler',
      })

      this.logger.log(`Triggered push generation for AnalyzedContent: ${analyzedContentId}`)
    } catch (error) {
      this.logger.error(`Failed to trigger push generation: ${error.message}`)
      // 不抛出错误，避免影响主流程
    }
  }
}
