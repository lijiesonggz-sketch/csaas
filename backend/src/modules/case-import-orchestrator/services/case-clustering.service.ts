import { forwardRef, Inject, Injectable, Logger, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CaseControlMap } from '../../../database/entities/case-control-map.entity'
import { CaseControlMapSource } from '../../../database/entities/case-control-map.entity'
import {
  ComplianceCase,
  ComplianceCaseControlPointDraft,
} from '../../../database/entities/compliance-case.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { CaseClusteringChainService } from './case-clustering-chain.service'
import { CaseThemeIntelligenceService } from './case-theme-intelligence.service'
import { ComplianceCaseClassificationRunService } from './compliance-case-classification-run.service'
import { DomainRolloutPolicyService } from './taxonomy-classification/domain-rollout-policy.service'
import { LegacyCaseThemeFallbackService } from './legacy-case-theme-fallback.service'

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
  // New chain statistics
  chainMappedCaseCount: number
  chainMapCount: number
  fallbackToOldChainCount: number
}

@Injectable()
export class CaseClusteringService {
  private readonly logger = new Logger(CaseClusteringService.name)

  constructor(
    @InjectRepository(ComplianceCase)
    private readonly complianceCaseRepository: Repository<ComplianceCase>,
    @InjectRepository(ControlPoint)
    private readonly controlPointRepository: Repository<ControlPoint>,
    @InjectRepository(CaseControlMap)
    private readonly caseControlMapRepository: Repository<CaseControlMap>,
    private readonly caseThemeIntelligenceService: CaseThemeIntelligenceService,
    @Inject(forwardRef(() => CaseClusteringChainService))
    private readonly caseClusteringChainService: CaseClusteringChainService,
    @Optional()
    private readonly classificationRunService?: ComplianceCaseClassificationRunService,
    @Optional()
    private readonly domainRolloutPolicyService?: DomainRolloutPolicyService,
    @Optional()
    private readonly legacyCaseThemeFallbackService?: LegacyCaseThemeFallbackService,
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
    // New chain counters
    let chainMappedCaseCount = 0
    let chainMapCount = 0
    let fallbackToOldChainCount = 0

    for (const caseRecord of cases) {
      // --- New chain: try FAILURE_MODE_CHAIN first ---
      let usedNewChain = false
      const legacyFallbackAllowed = await this.shouldAllowLegacyFallback(
        caseRecord.caseId,
        caseRecord.l1Code,
      )

      if (caseRecord.l2Code) {
        try {
          const chainResult = await this.caseClusteringChainService.mapCaseToControlPoints(caseRecord)

          if (!chainResult.shouldFallback && chainResult.autoMappedCount > 0) {
            chainMappedCaseCount += 1
            chainMapCount += chainResult.autoMappedCount
            usedNewChain = true
          } else if (!legacyFallbackAllowed) {
            usedNewChain = true
            caseRecord.candidateControlPoints = [
              {
                controlName: caseRecord.l2Code,
                sourceTheme: caseRecord.l2Code,
                confidenceScore: 0,
                reason:
                  '当前域 rollout policy 禁止 legacy fallback，且 new chain 无可执行控制候选',
              },
            ]
          }
        } catch (error) {
          this.logger.warn(`New chain failed for case ${caseRecord.caseId}, falling back: ${error?.message}`)
          if (!legacyFallbackAllowed) {
            usedNewChain = true
            caseRecord.candidateControlPoints = [
              {
                controlName: caseRecord.l2Code,
                sourceTheme: caseRecord.l2Code,
                confidenceScore: 0,
                reason:
                  '当前域 rollout policy 禁止 legacy fallback，new chain 异常已保留待人工确认',
              },
            ]
          }
        }
      }

      // --- Old chain (fallback) ---
      if (!usedNewChain && legacyFallbackAllowed) {
        fallbackToOldChainCount += 1

        if (!this.legacyCaseThemeFallbackService) {
          this.logger.warn(
            `Legacy case-theme fallback service is not configured for case ${caseRecord.caseId}; skipping old-chain processing.`,
          )
        } else {
          const sourceText = [caseRecord.caseFacts, caseRecord.penaltyReason]
            .filter((value): value is string => Boolean(value))
            .join('；')
          const fallbackResult =
            await this.legacyCaseThemeFallbackService.processLegacyFallback({
              l1Code: caseRecord.l1Code,
              violationThemes: caseRecord.violationThemes ?? [],
              sourceText,
              controlPoints,
              allowLegacyFallback: legacyFallbackAllowed,
            })

          for (const mapping of fallbackResult.autoMappings) {
            await this.upsertCaseControlMap(
              caseRecord.caseId,
              mapping.controlId,
              mapping.confidenceScore,
              mapping.source,
            )
          }

          if (fallbackResult.autoMappings.some((mapping) => mapping.source === 'RULE')) {
            ruleMappedCaseCount += 1
            ruleMapCount += fallbackResult.autoMappings.filter(
              (mapping) => mapping.source === 'RULE',
            ).length
          }

          if (fallbackResult.llmTriggered) {
            llmTriggeredCaseCount += 1
          }

          if (fallbackResult.llmAssisted) {
            llmAssistedRuleCaseCount += 1
            llmAssistedRuleMapCount += fallbackResult.autoMappings.filter(
              (mapping) => mapping.source === 'LLM_ASSISTED_RULE',
            ).length
          }

          if (fallbackResult.llmFallbackUsed) {
            llmFallbackCaseCount += 1
            llmFallbackMapCount += fallbackResult.autoMappings.filter(
              (mapping) => mapping.source === 'LLM_FALLBACK',
            ).length
          }

          if (fallbackResult.unmapped) {
            llmUnmappedCaseCount += 1
            unmappedCaseCount += 1
          }

          caseRecord.normalizedThemes = fallbackResult.normalizedThemes
          caseRecord.candidateControlPoints = fallbackResult.candidateControlPoints
        }
      } else if (!usedNewChain && !legacyFallbackAllowed) {
        caseRecord.candidateControlPoints =
          caseRecord.candidateControlPoints ?? [
            {
              controlName: caseRecord.l2Code ?? '待人工确认',
              sourceTheme:
                caseRecord.l2Code ??
                caseRecord.violationThemes?.[0] ??
                '待人工确认',
              confidenceScore: 0,
              reason: '当前域 rollout policy 禁止 legacy fallback，等待人工确认',
            },
          ]
      }

      caseRecord.clusteredAt = new Date()
      caseRecord.status = 'clustered'

      await this.complianceCaseRepository.save(caseRecord)
      processedCount += 1
    }

    // Clear chain cache after batch completes
    this.caseClusteringChainService.clearCache()

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
      chainMappedCaseCount,
      chainMapCount,
      fallbackToOldChainCount,
    }
  }

  async upsertCaseControlMap(
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

  private async shouldAllowLegacyFallback(
    caseId: string,
    l1Code: string | null,
  ): Promise<boolean> {
    if (!this.domainRolloutPolicyService) {
      this.logger.warn(
        `Domain rollout policy service is not configured for case ${caseId}; defaulting clustering fallback to legacy-compatible mode.`,
      )
      return true
    }

    if (l1Code) {
      return this.domainRolloutPolicyService.shouldAllowLegacyFallback(l1Code)
    }

    if (!this.classificationRunService) {
      throw new Error(
        'Classification run service is required when clustering evaluates cases without latest l1Code context.',
      )
    }

    const latestRun = await this.classificationRunService.findLatestRun(caseId)
    const policySnapshot = latestRun?.decisionTraceJson?.[
      'policySnapshot'
    ] as Record<string, unknown> | undefined

    if (policySnapshot?.['allowLegacyFallback'] !== undefined) {
      return Boolean(policySnapshot['allowLegacyFallback'])
    }

    if (latestRun?.l1Code) {
      return this.domainRolloutPolicyService.shouldAllowLegacyFallback(
        latestRun.l1Code,
      )
    }

    this.logger.warn(
      `Latest classification run for case ${caseId} is missing both l1Code and rollout policy snapshot; defaulting clustering fallback to legacy-compatible mode.`,
    )
    return true
  }
}
