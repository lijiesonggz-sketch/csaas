import { Injectable, Optional } from '@nestjs/common'
import type {
  CaseControlMapSource,
} from '../../../database/entities/case-control-map.entity'
import type {
  ComplianceCaseControlPointDraft,
} from '../../../database/entities/compliance-case.entity'
import type { ControlPoint } from '../../../database/entities/control-point.entity'
import { CaseThemeIntelligenceService } from './case-theme-intelligence.service'
import { DomainRolloutPolicyService } from './taxonomy-classification/domain-rollout-policy.service'
import {
  normalizeViolationThemes,
  scoreThemeAgainstControl,
} from './case-theme.utils'

type LegacyFallbackCandidate = {
  controlId: string
  controlCode: string
  controlName: string
  controlDesc: string | null
  canonicalTheme: string | null
  aliases: string[] | null
  keywords: string[] | null
}

export type LegacyFallbackResolution = {
  allowed: boolean
  mode: 'legacy-compatible' | 'legacy-off'
  reason: string
}

export type LegacyFallbackMapInstruction = {
  controlId: string
  confidenceScore: number
  source: Extract<CaseControlMapSource, 'RULE' | 'LLM_ASSISTED_RULE' | 'LLM_FALLBACK'>
}

export type LegacyFallbackProcessResult = LegacyFallbackResolution & {
  normalizedThemes: string[]
  autoMappings: LegacyFallbackMapInstruction[]
  candidateControlPoints: ComplianceCaseControlPointDraft[]
  llmCandidates: LegacyFallbackCandidate[]
  llmTriggered: boolean
  llmAssisted: boolean
  llmFallbackUsed: boolean
  unmapped: boolean
}

@Injectable()
export class LegacyCaseThemeFallbackService {
  private static readonly AUTO_MAP_THRESHOLD = 0.55

  constructor(
    @Optional()
    private readonly domainRolloutPolicyService?: DomainRolloutPolicyService,
    @Optional()
    private readonly caseThemeIntelligenceService?: CaseThemeIntelligenceService,
  ) {}

  async resolve(args: {
    l1Code: string | null
    normalizedThemes: string[]
  }): Promise<LegacyFallbackResolution> {
    if (!args.l1Code) {
      return {
        allowed: true,
        mode: 'legacy-compatible',
        reason: 'domain-context-missing',
      }
    }

    if (!this.domainRolloutPolicyService) {
      return {
        allowed: true,
        mode: 'legacy-compatible',
        reason: 'policy-service-unavailable',
      }
    }

    const allowLegacyFallback =
      await this.domainRolloutPolicyService.shouldAllowLegacyFallback(
        args.l1Code,
      )

    return allowLegacyFallback
      ? {
          allowed: true,
          mode: 'legacy-compatible',
          reason: 'policy-allows-legacy-fallback',
        }
      : {
          allowed: false,
          mode: 'legacy-off',
          reason: `domain ${args.l1Code} is already in legacy-off or has legacy fallback disabled`,
        }
  }

  async processLegacyFallback(args: {
    l1Code: string | null
    violationThemes: string[]
    sourceText: string
    controlPoints: ControlPoint[]
    allowLegacyFallback?: boolean
  }): Promise<LegacyFallbackProcessResult> {
    const resolution =
      args.allowLegacyFallback !== undefined
        ? args.allowLegacyFallback
          ? {
              allowed: true,
              mode: 'legacy-compatible' as const,
              reason: 'policy-allows-legacy-fallback',
            }
          : {
              allowed: false,
              mode: 'legacy-off' as const,
              reason: `domain ${args.l1Code ?? 'unknown'} is already in legacy-off or has legacy fallback disabled`,
            }
        : await this.resolve({
            l1Code: args.l1Code,
            normalizedThemes: args.violationThemes,
          })

    const normalizedThemes = normalizeViolationThemes(args.violationThemes ?? [])

    if (!resolution.allowed) {
      return {
        ...resolution,
        normalizedThemes,
        autoMappings: [],
        candidateControlPoints: [],
        llmCandidates: [],
        llmTriggered: false,
        llmAssisted: false,
        llmFallbackUsed: false,
        unmapped: true,
      }
    }

    let ruleMatchResult = this.applyRuleMatching(
      normalizedThemes,
      args.controlPoints,
      'RULE',
    )
    let llmTriggered = false
    let llmAssisted = false
    let llmFallbackUsed = false
    let unmapped = false

    if (
      ruleMatchResult.autoMappings.length === 0 &&
      this.caseThemeIntelligenceService
    ) {
      llmTriggered = true
      const llmSuggestion =
        await this.caseThemeIntelligenceService.suggestMappings({
          sourceText: args.sourceText,
          violationThemes: args.violationThemes ?? [],
          normalizedThemes,
          candidateControls: ruleMatchResult.llmCandidates,
        })

      let nextNormalizedThemes = normalizedThemes
      if (llmSuggestion?.normalizedThemes?.length) {
        nextNormalizedThemes = Array.from(
          new Set(llmSuggestion.normalizedThemes),
        )
        ruleMatchResult = this.applyRuleMatching(
          nextNormalizedThemes,
          args.controlPoints,
          'LLM_ASSISTED_RULE',
        )
        llmAssisted = ruleMatchResult.autoMappings.length > 0
      }

      if (ruleMatchResult.autoMappings.length === 0) {
        if (llmSuggestion?.recommendedMappings?.length) {
          llmFallbackUsed = true
          ruleMatchResult = {
            ...ruleMatchResult,
            autoMappings: llmSuggestion.recommendedMappings.map((mapping) => ({
              controlId: mapping.controlId,
              confidenceScore: mapping.confidenceScore,
              source: 'LLM_FALLBACK' as const,
            })),
            candidateControlPoints: [],
          }
        } else {
          unmapped = true
        }
      }

      return {
        ...resolution,
        normalizedThemes: nextNormalizedThemes,
        autoMappings: ruleMatchResult.autoMappings,
        candidateControlPoints: ruleMatchResult.candidateControlPoints,
        llmCandidates: ruleMatchResult.llmCandidates,
        llmTriggered,
        llmAssisted,
        llmFallbackUsed,
        unmapped,
      }
    }

    return {
      ...resolution,
      normalizedThemes,
      autoMappings: ruleMatchResult.autoMappings,
      candidateControlPoints: ruleMatchResult.candidateControlPoints,
      llmCandidates: ruleMatchResult.llmCandidates,
      llmTriggered,
      llmAssisted,
      llmFallbackUsed,
      unmapped: unmapped || ruleMatchResult.autoMappings.length === 0,
    }
  }

  private applyRuleMatching(
    normalizedThemes: string[],
    controlPoints: ControlPoint[],
    source: Extract<CaseControlMapSource, 'RULE' | 'LLM_ASSISTED_RULE'>,
  ): {
    autoMappings: LegacyFallbackMapInstruction[]
    candidateControlPoints: ComplianceCaseControlPointDraft[]
    llmCandidates: LegacyFallbackCandidate[]
  } {
    const autoMappings: LegacyFallbackMapInstruction[] = []
    const candidateControlPoints: ComplianceCaseControlPointDraft[] = []
    const llmCandidateMap = new Map<
      string,
      LegacyFallbackCandidate & { score: number }
    >()

    for (const theme of normalizedThemes) {
      const rankedMatches = controlPoints
        .map((controlPoint) => ({
          controlPoint,
          ...scoreThemeAgainstControl(theme, controlPoint),
        }))
        .filter((match) => match.score > 0)
        .sort((left, right) => right.score - left.score)

      for (const match of rankedMatches.slice(0, 5)) {
        const existing = llmCandidateMap.get(match.controlPoint.controlId)
        if (!existing || match.score > existing.score) {
          llmCandidateMap.set(match.controlPoint.controlId, {
            controlId: match.controlPoint.controlId,
            controlCode: match.controlPoint.controlCode,
            controlName: match.controlPoint.controlName,
            controlDesc: match.controlPoint.controlDesc ?? null,
            canonicalTheme: match.controlPoint.canonicalTheme ?? null,
            aliases: match.controlPoint.aliases ?? null,
            keywords: match.controlPoint.keywords ?? null,
            score: match.score,
          })
        }
      }

      const bestMatch = rankedMatches[0]

      if (
        bestMatch &&
        bestMatch.score >= LegacyCaseThemeFallbackService.AUTO_MAP_THRESHOLD
      ) {
        autoMappings.push({
          controlId: bestMatch.controlPoint.controlId,
          confidenceScore: bestMatch.score,
          source,
        })
        continue
      }

      candidateControlPoints.push({
        controlName: theme,
        sourceTheme: theme,
        confidenceScore: bestMatch ? Number(bestMatch.score.toFixed(2)) : 0.45,
        reason: bestMatch
          ? `匹配到候选控制点 ${bestMatch.controlPoint.controlCode} 但置信度不足：${bestMatch.reason}`
          : '未匹配到现有控制点',
      })
    }

    const llmCandidates = Array.from(llmCandidateMap.values())
      .sort((left, right) => right.score - left.score)
      .slice(0, 8)
      .map(({ score: _score, ...candidate }) => candidate)

    return {
      autoMappings,
      candidateControlPoints,
      llmCandidates,
    }
  }
}
