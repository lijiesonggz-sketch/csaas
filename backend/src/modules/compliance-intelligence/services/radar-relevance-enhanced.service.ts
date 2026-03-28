import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PackResolverService } from '../../applicability-engine/services/pack-resolver.service'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'
import { ControlGapInputService } from '../../survey/control-gap-input.service'
import type { ControlGapInputItemDto } from '../../survey/dto/control-gap-input.dto'
import {
  CalculateRadarRelevanceDto,
  RadarRelevanceMatchedCaseDto,
  RadarRelevanceMatchedClauseDto,
  RadarRelevanceMatchedControlDto,
  RadarRelevancePriority,
  RadarRelevanceResponseDto,
  RadarRelevanceSuggestedCheckDto,
  enrichRadarResponseWithContext,
} from '../dto/radar-relevance.dto'
import { ControlExplainService } from './control-explain.service'

type GapLevel = 'LOW' | 'MEDIUM' | 'HIGH'

type ExplainResult = Awaited<ReturnType<ControlExplainService['getControlExplain']>>

type ScoredControlMatch = {
  score: number
  control: RadarRelevanceMatchedControlDto
  matchedCases: RadarRelevanceMatchedCaseDto[]
  matchedClauses: RadarRelevanceMatchedClauseDto[]
  suggestedChecks: RadarRelevanceSuggestedCheckDto[]
}

type TextSignal = {
  score: number
  matchedTerms: string[]
}

type GapContext = Pick<
  ControlGapInputItemDto,
  'controlId' | 'currentStatus' | 'gapLevel' | 'riskHints' | 'missingAnswers' | 'questionIds'
>

const GENERIC_SUFFIXES = ['控制点', '控制', '管理', '要求', '案例', '条款', '治理']
const HIGH_PRIORITY_THRESHOLD = 0.85
const MEDIUM_PRIORITY_THRESHOLD = 0.4

@Injectable()
export class RadarRelevanceEnhancedService {
  constructor(
    @InjectRepository(AnalyzedContent)
    private readonly analyzedContentRepository: Repository<AnalyzedContent>,
    private readonly packResolverService: PackResolverService,
    private readonly controlExplainService: ControlExplainService,
    private readonly controlGapInputService: ControlGapInputService,
  ) {}

  async calculateRadarRelevance(
    input: CalculateRadarRelevanceDto,
  ): Promise<RadarRelevanceResponseDto> {
    const analyzedContent = await this.analyzedContentRepository.findOne({
      where: [{ id: input.contentId }, { contentId: input.contentId }],
      relations: ['rawContent', 'tags'],
    })

    if (!analyzedContent) {
      throw new NotFoundException(`Analyzed content ${input.contentId} not found`)
    }

    const resolvedControlSet = await this.packResolverService.resolveByOrganizationId(
      input.organizationId,
    )
    const gapContexts = input.surveyResponseId
      ? await this.loadGapContexts(input.surveyResponseId, input.organizationId)
      : new Map<string, GapContext>()
    const contentHaystack = this.buildContentHaystack(analyzedContent)

    const explainResults = await Promise.all(
      resolvedControlSet.controls.map(async (control) => ({
        controlId: control.controlId,
        explain: await this.controlExplainService.getControlExplain(control.controlId, {
          organizationId: input.organizationId,
        }),
      })),
    )

    const scoredMatches = explainResults
      .map(({ controlId, explain }) =>
        this.scoreControlMatch(contentHaystack, explain, gapContexts.get(controlId)),
      )
      .filter((match): match is ScoredControlMatch => Boolean(match))
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.control.controlCode.localeCompare(right.control.controlCode),
      )

    if (scoredMatches.length === 0) {
      return {
        relevanceScore: 0,
        priority: 'LOW',
        controlId: null,
        matchedControls: [],
        matchedCases: [],
        matchedClauses: [],
        suggestedChecks: [],
        sourceModule: 'radar',
        sourceRecordId: input.contentId,
        sourceRoute: `/radar/compliance/${input.contentId}`,
      }
    }

    const matchedCases = this.uniqueByKey(
      scoredMatches.flatMap((match) => match.matchedCases),
      (item) => `${item.controlId}:${item.caseId}`,
    )
    const matchedClauses = this.uniqueByKey(
      scoredMatches.flatMap((match) => match.matchedClauses),
      (item) => `${item.controlId}:${item.clauseId}`,
    )
    const relevanceScore = this.roundScore(
      Math.min(1, scoredMatches[0].score + Math.min(0.1, (scoredMatches.length - 1) * 0.05)),
    )
    const suggestedChecks = this.uniqueByKey(
      scoredMatches.flatMap((match) => match.suggestedChecks),
      (item) =>
        [
          item.controlId,
          item.checkType,
          item.sourceId ?? '',
          item.sourceCode ?? '',
          item.title,
        ].join(':'),
    )

    return enrichRadarResponseWithContext(
      {
        relevanceScore,
        priority: this.toPriority(relevanceScore),
        matchedControls: scoredMatches.map((match) => match.control),
        matchedCases,
        matchedClauses,
        suggestedChecks,
      },
      input.contentId,
    )
  }

  private async loadGapContexts(
    surveyResponseId: string,
    organizationId: string,
  ): Promise<Map<string, GapContext>> {
    const gapInput = await this.controlGapInputService.getControlGapInput(
      surveyResponseId,
      organizationId,
    )

    return new Map(gapInput.controls.map((control) => [control.controlId, control]))
  }

  private scoreControlMatch(
    contentHaystack: string,
    explain: ExplainResult,
    gapContext?: GapContext,
  ): ScoredControlMatch | null {
    const controlSignal = this.scoreTextSignal(contentHaystack, [
      explain.control.controlCode,
      explain.control.controlName,
      explain.control.controlDesc,
      explain.applicabilityReason,
    ])
    const matchedCases = explain.cases
      .map((item) => this.scoreCase(contentHaystack, explain.control.controlId, item))
      .filter((item): item is { score: number; value: RadarRelevanceMatchedCaseDto } =>
        Boolean(item),
      )
    const matchedClauses = explain.clauses
      .map((item) => this.scoreClause(contentHaystack, explain.control.controlId, item))
      .filter((item): item is { score: number; value: RadarRelevanceMatchedClauseDto } =>
        Boolean(item),
      )

    const caseScore = matchedCases.length
      ? this.roundScore(
          matchedCases.reduce((sum, item) => sum + item.score, 0) / matchedCases.length,
        )
      : 0
    const clauseScore = matchedClauses.length
      ? this.roundScore(
          matchedClauses.reduce((sum, item) => sum + item.score, 0) / matchedClauses.length,
        )
      : 0

    const evidenceSignal = controlSignal.score * 0.35 + caseScore * 0.3 + clauseScore * 0.2
    if (evidenceSignal <= 0) {
      return null
    }

    const score = this.roundScore(Math.min(1, evidenceSignal + this.gapBoost(gapContext?.gapLevel)))
    const priority = this.toPriority(score)
    const resolvedMatchedCases = matchedCases.map((item) => item.value)
    const resolvedMatchedClauses = matchedClauses.map((item) => item.value)

    return {
      score,
      control: {
        controlId: explain.control.controlId,
        controlCode: explain.control.controlCode,
        controlName: explain.control.controlName,
        reason: this.buildReason(
          explain,
          controlSignal,
          resolvedMatchedCases,
          resolvedMatchedClauses,
          gapContext?.gapLevel,
        ),
      },
      matchedCases: resolvedMatchedCases,
      matchedClauses: resolvedMatchedClauses,
      suggestedChecks: this.buildSuggestedChecks(
        explain,
        resolvedMatchedCases,
        resolvedMatchedClauses,
        gapContext,
        priority,
      ),
    }
  }

  private scoreCase(
    contentHaystack: string,
    controlId: string,
    item: Record<string, unknown>,
  ): { score: number; value: RadarRelevanceMatchedCaseDto } | null {
    const signal = this.scoreTextSignal(contentHaystack, [
      item.caseCode as string | undefined,
      item.caseTitle as string | undefined,
      item.sourceOrg as string | undefined,
      item.authorityName as string | undefined,
    ])

    if (signal.score <= 0) {
      return null
    }

    return {
      score: signal.score,
      value: {
        controlId,
        caseId: item.caseId as string,
        caseCode: item.caseCode as string,
        caseTitle: (item.caseTitle as string | null | undefined) ?? null,
        sourceOrg: (item.sourceOrg as string | null | undefined) ?? null,
        authorityName: (item.authorityName as string | null | undefined) ?? null,
      },
    }
  }

  private scoreClause(
    contentHaystack: string,
    controlId: string,
    item: Record<string, unknown>,
  ): { score: number; value: RadarRelevanceMatchedClauseDto } | null {
    const source = (item.source as Record<string, unknown> | undefined) ?? {}
    const signal = this.scoreTextSignal(contentHaystack, [
      item.clauseCode as string | undefined,
      item.articleNo as string | undefined,
      item.clauseSummary as string | undefined,
      item.clauseText as string | undefined,
      source.sourceName as string | undefined,
    ])

    if (signal.score <= 0) {
      return null
    }

    return {
      score: signal.score,
      value: {
        controlId,
        clauseId: item.clauseId as string,
        clauseCode: item.clauseCode as string,
        articleNo: (item.articleNo as string | null | undefined) ?? null,
        clauseSummary: (item.clauseSummary as string | null | undefined) ?? null,
        sourceName: (source.sourceName as string | null | undefined) ?? null,
      },
    }
  }

  private buildContentHaystack(content: AnalyzedContent): string {
    const pieces = [
      content.rawContent?.title,
      content.rawContent?.summary,
      content.rawContent?.fullContent,
      ...(content.categories ?? []),
      ...(content.tags?.map((tag) => tag.name) ?? []),
      content.complianceAnalysis?.complianceRiskCategory,
      content.complianceAnalysis?.penaltyCase,
      content.complianceAnalysis?.policyRequirements,
      content.complianceAnalysis?.remediationSuggestions,
      ...(content.complianceAnalysis?.relatedWeaknessCategories ?? []),
    ]

    return pieces
      .filter((value): value is string => Boolean(value))
      .map((value) => this.normalize(value))
      .join(' ')
  }

  private scoreTextSignal(
    contentHaystack: string,
    values: Array<string | null | undefined>,
  ): TextSignal {
    const terms = this.buildSearchTerms(values)
    if (terms.length === 0) {
      return { score: 0, matchedTerms: [] }
    }

    const matchedTerms = terms.filter((term) => contentHaystack.includes(term))
    if (matchedTerms.length === 0) {
      return { score: 0, matchedTerms: [] }
    }

    return {
      score: this.roundScore(matchedTerms.length / Math.min(2, terms.length)),
      matchedTerms: matchedTerms.slice(0, 4),
    }
  }

  private buildSearchTerms(values: Array<string | null | undefined>): string[] {
    const terms = new Set<string>()

    values
      .filter((value): value is string => Boolean(value))
      .forEach((value) => {
        const normalized = this.normalize(value)
        if (normalized.length >= 2) {
          this.expandTermVariants(normalized).forEach((term) => terms.add(term))
        }

        value
          .split(/[，。；：、,.;:()（）\[\]{}\/\\\s_-]+/)
          .map((part) => this.normalize(part))
          .filter((part) => part.length >= 2)
          .forEach((part) => {
            this.expandTermVariants(part).forEach((term) => terms.add(term))
          })
      })

    return Array.from(terms)
  }

  private expandTermVariants(term: string): string[] {
    const variants = new Set<string>([term])

    GENERIC_SUFFIXES.forEach((suffix) => {
      if (term.endsWith(suffix)) {
        const trimmed = term.slice(0, term.length - suffix.length)
        if (trimmed.length >= 2) {
          variants.add(trimmed)
        }
      }
    })

    return Array.from(variants)
  }

  private gapBoost(gapLevel?: GapLevel): number {
    switch (gapLevel) {
      case 'HIGH':
        return 0.15
      case 'MEDIUM':
        return 0.08
      case 'LOW':
        return 0.03
      default:
        return 0
    }
  }

  private buildReason(
    explain: ExplainResult,
    controlSignal: TextSignal,
    matchedCases: RadarRelevanceMatchedCaseDto[],
    matchedClauses: RadarRelevanceMatchedClauseDto[],
    gapLevel?: GapLevel,
  ): string {
    const parts: string[] = []

    if (controlSignal.matchedTerms.length > 0) {
      parts.push(`命中控制语义：${controlSignal.matchedTerms.join('、')}`)
    }

    if (matchedCases.length > 0) {
      parts.push(`命中案例：${matchedCases.map((item) => item.caseCode).join('、')}`)
    }

    if (matchedClauses.length > 0) {
      parts.push(`命中条款：${matchedClauses.map((item) => item.clauseCode).join('、')}`)
    }

    if (gapLevel) {
      parts.push(`当前差距等级：${gapLevel}`)
    }

    return parts.length > 0 ? parts.join('；') : explain.applicabilityReason
  }

  private buildSuggestedChecks(
    explain: ExplainResult,
    matchedCases: RadarRelevanceMatchedCaseDto[],
    matchedClauses: RadarRelevanceMatchedClauseDto[],
    gapContext: GapContext | undefined,
    priority: RadarRelevancePriority,
  ): RadarRelevanceSuggestedCheckDto[] {
    const gapDetail = this.buildGapDetail(gapContext)
    const suggestedChecks: RadarRelevanceSuggestedCheckDto[] = []

    const questionChecks = ((explain.questions as Array<Record<string, unknown>> | undefined) ?? [])
      .slice(0, 2)
      .map((item) => ({
        controlId: explain.control.controlId,
        controlCode: explain.control.controlCode,
        checkType: 'QUESTION' as const,
        sourceId: (item.questionId as string | null | undefined) ?? null,
        sourceCode: (item.questionCode as string | null | undefined) ?? null,
        title:
          (item.questionText as string | null | undefined) ??
          (item.questionCode as string | null | undefined) ??
          `复核控制点 ${explain.control.controlCode}`,
        detail: this.joinDetailParts(
          item.questionType ? `问题类型：${String(item.questionType)}` : null,
          typeof item.required === 'boolean' ? (item.required ? '必答项' : '选答项') : null,
          gapDetail,
        ),
        priority,
      }))
    suggestedChecks.push(...questionChecks)

    const remediationChecks = (
      (explain.remediations as Array<Record<string, unknown>> | undefined) ?? []
    )
      .slice(0, 2)
      .map((item) => ({
        controlId: explain.control.controlId,
        controlCode: explain.control.controlCode,
        checkType: 'REMEDIATION' as const,
        sourceId: (item.actionId as string | null | undefined) ?? null,
        sourceCode: (item.actionCode as string | null | undefined) ?? null,
        title:
          (item.actionTitle as string | null | undefined) ??
          (item.actionCode as string | null | undefined) ??
          `跟进控制点 ${explain.control.controlCode}`,
        detail: this.joinDetailParts(
          (item.actionDesc as string | null | undefined) ?? null,
          (item.expectedBenefit as string | null | undefined) ?? null,
          item.priorityDefault ? `默认优先级：${String(item.priorityDefault)}` : null,
          gapDetail,
        ),
        priority,
      }))
    suggestedChecks.push(...remediationChecks)

    if (suggestedChecks.length > 0) {
      return suggestedChecks
    }

    if (matchedClauses.length > 0) {
      suggestedChecks.push(
        ...matchedClauses.slice(0, 1).map((item) => ({
          controlId: explain.control.controlId,
          controlCode: explain.control.controlCode,
          checkType: 'CLAUSE' as const,
          sourceId: item.clauseId,
          sourceCode: item.clauseCode,
          title: item.clauseSummary ?? item.articleNo ?? item.clauseCode,
          detail: this.joinDetailParts(item.sourceName, gapDetail),
          priority,
        })),
      )
    }

    if (matchedCases.length > 0) {
      suggestedChecks.push(
        ...matchedCases.slice(0, 1).map((item) => ({
          controlId: explain.control.controlId,
          controlCode: explain.control.controlCode,
          checkType: 'CASE' as const,
          sourceId: item.caseId,
          sourceCode: item.caseCode,
          title: item.caseTitle ?? item.caseCode,
          detail: this.joinDetailParts(item.authorityName, item.sourceOrg, gapDetail),
          priority,
        })),
      )
    }

    return suggestedChecks
  }

  private buildGapDetail(gapContext?: GapContext): string | null {
    if (!gapContext) {
      return null
    }

    const riskHints = gapContext.riskHints ?? []
    const missingAnswers = gapContext.missingAnswers ?? []

    return this.joinDetailParts(
      gapContext.currentStatus ? `当前状态：${gapContext.currentStatus}` : null,
      gapContext.gapLevel ? `差距等级：${gapContext.gapLevel}` : null,
      riskHints.length > 0 ? `风险提示：${riskHints.join('；')}` : null,
      missingAnswers.length > 0 ? `缺失答案：${missingAnswers.length}` : null,
    )
  }

  private toPriority(score: number): RadarRelevancePriority {
    if (score >= HIGH_PRIORITY_THRESHOLD) {
      return 'HIGH'
    }

    if (score >= MEDIUM_PRIORITY_THRESHOLD) {
      return 'MEDIUM'
    }

    return 'LOW'
  }

  private normalize(value: string): string {
    return value.toLowerCase().replace(/\s+/g, '').trim()
  }

  private roundScore(value: number): number {
    return Math.round(value * 1000) / 1000
  }

  private uniqueByKey<T>(items: T[], keySelector: (item: T) => string): T[] {
    const seen = new Set<string>()

    return items.filter((item) => {
      const key = keySelector(item)
      if (seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
  }

  private joinDetailParts(...values: Array<string | null | undefined>): string | null {
    const parts = values.filter((value): value is string => Boolean(value))
    return parts.length > 0 ? parts.join('；') : null
  }
}
