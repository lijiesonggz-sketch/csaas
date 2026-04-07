import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'

type CandidateControlInput = {
  controlId: string
  controlCode: string
  controlName: string
  controlDesc?: string | null
  canonicalTheme?: string | null
  aliases?: string[] | null
  keywords?: string[] | null
}

export type CaseThemeMappingRecommendation = {
  controlId: string
  confidenceScore: number
  reason: string
}

type ExtractionRefinementResponse = {
  violationThemes: string[]
}

type ClusteringRefinementResponse = {
  normalizedThemes: string[]
  recommendedMappings: CaseThemeMappingRecommendation[]
}

@Injectable()
export class CaseThemeIntelligenceService {
  private readonly logger = new Logger(CaseThemeIntelligenceService.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly aiOrchestrator: AIOrchestrator,
  ) {}

  isEnabled(): boolean {
    const mode = (this.configService.get<string>('CASE_THEME_LLM_MODE') || 'fallback').toLowerCase()
    const explicitlyEnabled = this.configService.get<string>('CASE_THEME_LLM_ENABLED')
    const enabled =
      explicitlyEnabled === 'false' || explicitlyEnabled === '0'
        ? false
        : explicitlyEnabled === 'true' || explicitlyEnabled === '1'
          ? true
          : mode === 'fallback' || mode === 'assist'

    return enabled && this.aiOrchestrator.hasAvailableProvider()
  }

  async refineViolationThemes(
    sourceText: string,
    violationThemes: string[],
  ): Promise<string[] | null> {
    if (!this.isEnabled()) {
      return null
    }

    const prompt = [
      '请从处罚案例文本中提炼 1-5 个“违规行为短语”。',
      '要求：',
      '1. 只输出违规行为，不要输出主语、程序描述、法规引用语。',
      '2. 不能输出“你公司在...过程中”“根据《...》”“违反《...》”这类短语。',
      '3. 必须返回 JSON 对象。',
      '',
      `案例文本：${sourceText}`,
      `规则提取结果：${JSON.stringify(violationThemes)}`,
      '',
      '返回格式：{"violationThemes":["主题1","主题2"]}',
    ].join('\n')

    const parsed = await this.requestJson<ExtractionRefinementResponse>(prompt)
    if (!parsed || !Array.isArray(parsed.violationThemes)) {
      return null
    }

    return parsed.violationThemes
      .map((theme) => String(theme).trim())
      .filter((theme) => theme.length >= 2)
      .slice(0, 5)
  }

  async suggestMappings(params: {
    sourceText: string
    violationThemes: string[]
    normalizedThemes: string[]
    candidateControls: CandidateControlInput[]
  }): Promise<ClusteringRefinementResponse | null> {
    if (!this.isEnabled() || params.candidateControls.length === 0) {
      return null
    }

    const allowedControlIds = new Set(
      params.candidateControls.map((control) => control.controlId),
    )

    const prompt = [
      '你是金融监管处罚案例到控制点映射助手。',
      '请基于案例文本和候选控制点，完成两件事：',
      '1. 输出 1-5 个标准化匹配主题 normalizedThemes。',
      '2. 只允许从给定候选控制点中选择最相关的 controlId，输出 0-3 条 recommendedMappings。',
      '',
      '约束：',
      '1. 不能编造不存在的 controlId。',
      '2. normalizedThemes 不能是过程句或法规引用句。',
      '3. confidenceScore 必须是 0 到 1 的数字。',
      '4. 必须返回 JSON 对象。',
      '',
      `案例文本：${params.sourceText}`,
      `规则 violationThemes：${JSON.stringify(params.violationThemes)}`,
      `规则 normalizedThemes：${JSON.stringify(params.normalizedThemes)}`,
      `候选控制点：${JSON.stringify(params.candidateControls)}`,
      '',
      '返回格式：{"normalizedThemes":["主题1"],"recommendedMappings":[{"controlId":"...","confidenceScore":0.82,"reason":"..."}]}',
    ].join('\n')

    const parsed = await this.requestJson<ClusteringRefinementResponse>(prompt)
    if (!parsed) {
      return null
    }

    const normalizedThemes = Array.isArray(parsed.normalizedThemes)
      ? parsed.normalizedThemes.map((theme) => String(theme).trim()).filter((theme) => theme.length >= 2).slice(0, 5)
      : []

    const recommendedMappings = Array.isArray(parsed.recommendedMappings)
      ? parsed.recommendedMappings
          .map((mapping) => ({
            controlId: String(mapping.controlId).trim(),
            confidenceScore: Number(mapping.confidenceScore),
            reason: String(mapping.reason ?? '').trim(),
          }))
          .filter(
            (mapping) =>
              mapping.controlId.length > 0 &&
              allowedControlIds.has(mapping.controlId) &&
              Number.isFinite(mapping.confidenceScore) &&
              mapping.confidenceScore >= 0 &&
              mapping.confidenceScore <= 1,
          )
          .slice(0, 3)
      : []

    return {
      normalizedThemes,
      recommendedMappings,
    }
  }

  private async requestJson<T>(prompt: string): Promise<T | null> {
    try {
      const response = await this.aiOrchestrator.generate(
        {
          systemPrompt: '请严格返回 JSON 对象，不要输出 Markdown，不要输出额外解释。',
          prompt,
          temperature: 0.1,
          maxTokens: 3000,
          responseFormat: { type: 'json_object' },
        },
        AIModel.DOMESTIC,
      )

      return JSON.parse(response.content) as T
    } catch (error) {
      this.logger.warn(`Case theme LLM fallback failed: ${error instanceof Error ? error.message : String(error)}`)
      return null
    }
  }
}
