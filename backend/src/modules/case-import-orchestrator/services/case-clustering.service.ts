import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CaseControlMap } from '../../../database/entities/case-control-map.entity'
import { CaseControlMapSource } from '../../../database/entities/case-control-map.entity'
import {
  ComplianceCase,
  ComplianceCaseControlPointDraft,
} from '../../../database/entities/compliance-case.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { CaseThemeIntelligenceService } from './case-theme-intelligence.service'
import {
  normalizeViolationThemes,
  scoreThemeAgainstControl,
} from './case-theme.utils'

export type CaseClusteringBatchResult = {
  batchId: string
  processedCount: number
  skippedCount: number
  ruleMappedCaseCount: number
  llmTriggeredCaseCount: number
  llmAssistedRuleCaseCount: number
  llmFallbackCaseCount: number
  llmUnmappedCaseCount: number
  unmappedCaseCount: number
  ruleMapCount: number
  llmAssistedRuleMapCount: number
  llmFallbackMapCount: number
}

@Injectable()
export class CaseClusteringService {
  private static readonly AUTO_MAP_THRESHOLD = 0.55

  constructor(
    @InjectRepository(ComplianceCase)
    private readonly complianceCaseRepository: Repository<ComplianceCase>,
    @InjectRepository(ControlPoint)
    private readonly controlPointRepository: Repository<ControlPoint>,
    @InjectRepository(CaseControlMap)
    private readonly caseControlMapRepository: Repository<CaseControlMap>,
    private readonly caseThemeIntelligenceService: CaseThemeIntelligenceService,
  ) {}

  async clusterBatch(batchId: string): Promise<CaseClusteringBatchResult> {
    const cases = await this.complianceCaseRepository.find({
      where: {
        importBatchId: batchId,
        status: 'extracted',
      },
      order: {
        createdAt: 'ASC',
      },
    })
    const controlPoints = await this.controlPointRepository.find({
      where: {
        status: 'ACTIVE',
      },
      take: 200,
      order: {
        updatedAt: 'DESC',
      },
    })

    let processedCount = 0
    let ruleMappedCaseCount = 0
    let llmTriggeredCaseCount = 0
    let llmAssistedRuleCaseCount = 0
    let llmFallbackCaseCount = 0
    let llmUnmappedCaseCount = 0
    let unmappedCaseCount = 0
    let ruleMapCount = 0
    let llmAssistedRuleMapCount = 0
    let llmFallbackMapCount = 0

    for (const caseRecord of cases) {
      const sourceText = [caseRecord.caseFacts, caseRecord.penaltyReason]
        .filter((value): value is string => Boolean(value))
        .join('；')
      let normalizedThemes = normalizeViolationThemes(caseRecord.violationThemes ?? [])
      let ruleMatchResult = await this.applyRuleMatching(
        caseRecord.caseId,
        normalizedThemes,
        controlPoints,
        'RULE',
      )

      if (ruleMatchResult.autoMappedCount > 0) {
        ruleMappedCaseCount += 1
        ruleMapCount += ruleMatchResult.autoMappedCount
      }

      if (ruleMatchResult.autoMappedCount === 0) {
        llmTriggeredCaseCount += 1
        const llmSuggestion = await this.caseThemeIntelligenceService.suggestMappings({
          sourceText,
          violationThemes: caseRecord.violationThemes ?? [],
          normalizedThemes,
          candidateControls: ruleMatchResult.llmCandidates,
        })

        if (llmSuggestion?.normalizedThemes?.length) {
          normalizedThemes = Array.from(new Set(llmSuggestion.normalizedThemes))
          ruleMatchResult = await this.applyRuleMatching(
            caseRecord.caseId,
            normalizedThemes,
            controlPoints,
            'LLM_ASSISTED_RULE',
          )
        }

        if (ruleMatchResult.autoMappedCount > 0) {
          llmAssistedRuleCaseCount += 1
          llmAssistedRuleMapCount += ruleMatchResult.autoMappedCount
        } else if (llmSuggestion?.recommendedMappings?.length) {
          for (const mapping of llmSuggestion.recommendedMappings) {
            await this.upsertCaseControlMap(
              caseRecord.caseId,
              mapping.controlId,
              mapping.confidenceScore,
              'LLM_FALLBACK',
            )
          }

          llmFallbackCaseCount += 1
          llmFallbackMapCount += llmSuggestion.recommendedMappings.length
          ruleMatchResult = {
            ...ruleMatchResult,
            autoMappedCount: llmSuggestion.recommendedMappings.length,
            candidateControlPoints: [],
          }
        } else {
          llmUnmappedCaseCount += 1
          unmappedCaseCount += 1
        }
      }

      caseRecord.normalizedThemes = normalizedThemes
      caseRecord.candidateControlPoints = ruleMatchResult.candidateControlPoints
      caseRecord.clusteredAt = new Date()
      caseRecord.status = 'clustered'

      await this.complianceCaseRepository.save(caseRecord)
      processedCount += 1
    }

    return {
      batchId,
      processedCount,
      skippedCount: 0,
      ruleMappedCaseCount,
      llmTriggeredCaseCount,
      llmAssistedRuleCaseCount,
      llmFallbackCaseCount,
      llmUnmappedCaseCount,
      unmappedCaseCount,
      ruleMapCount,
      llmAssistedRuleMapCount,
      llmFallbackMapCount,
    }
  }

  private async applyRuleMatching(
    caseId: string,
    normalizedThemes: string[],
    controlPoints: ControlPoint[],
    source: Extract<CaseControlMapSource, 'RULE' | 'LLM_ASSISTED_RULE'>,
  ): Promise<{
    autoMappedCount: number
    candidateControlPoints: ComplianceCaseControlPointDraft[]
    llmCandidates: Array<{
      controlId: string
      controlCode: string
      controlName: string
      controlDesc: string | null
      canonicalTheme: string | null
      aliases: string[] | null
      keywords: string[] | null
    }>
  }> {
    let autoMappedCount = 0
    const candidateControlPoints: ComplianceCaseControlPointDraft[] = []
    const llmCandidateMap = new Map<
      string,
      {
        controlId: string
        controlCode: string
        controlName: string
        controlDesc: string | null
        canonicalTheme: string | null
        aliases: string[] | null
        keywords: string[] | null
        score: number
      }
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

      if (bestMatch && bestMatch.score >= CaseClusteringService.AUTO_MAP_THRESHOLD) {
        await this.upsertCaseControlMap(
          caseId,
          bestMatch.controlPoint.controlId,
          bestMatch.score,
          source,
        )
        autoMappedCount += 1
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
      autoMappedCount,
      candidateControlPoints,
      llmCandidates,
    }
  }

  private async upsertCaseControlMap(
    caseId: string,
    controlId: string,
    score: number,
    source: CaseControlMapSource,
  ): Promise<void> {
    const existing = await this.caseControlMapRepository.findOne({
      where: { caseId, controlId },
    })

    if (existing) {
      existing.reviewStatus = 'PENDING'
      existing.relationType = 'VIOLATES'
      existing.confidenceScore = score.toFixed(4)
      existing.source = source
      await this.caseControlMapRepository.save(existing)
      return
    }

    const entity = this.caseControlMapRepository.create({
      caseId,
      controlId,
      relationType: 'VIOLATES',
      reviewStatus: 'PENDING',
      confidenceScore: score.toFixed(4),
      source,
    })

    await this.caseControlMapRepository.save(entity)
  }
}
