import { createHash } from 'crypto'
import { Injectable, Logger, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import {
  ComplianceCase,
  ComplianceCaseClauseCandidate,
} from '../../../database/entities/compliance-case.entity'
import { RegulationClause } from '../../../database/entities/regulation-clause.entity'
import { FailureModeService } from '../../knowledge-graph/services/failure-mode.service'
import { CaseClusteringChainService } from './case-clustering-chain.service'
import { ClassificationTelemetryService } from './classification-telemetry.service'
import {
  buildLatestClassificationSnapshot,
  ComplianceCaseClassificationRunService,
  type AppendClassificationRunArgs,
} from './compliance-case-classification-run.service'
import { RuntimeDomainSelectorService } from './runtime-domain-selector.service'
import { CaseThemeIntelligenceService } from './case-theme-intelligence.service'
import {
  extractViolationThemesFromText,
  isWeakTheme,
  tokenizeText,
} from './case-theme.utils'
import { CaseNormalizationService } from './taxonomy-classification/case-normalization.service'
import type {
  NormalizedTaxonomyClassificationInput,
  TaxonomyClassificationResult,
} from './taxonomy-classification/contracts/classification-result.contract'
import {
  DomainRolloutPolicyService,
  type PrimaryExecutabilitySnapshot,
  type ResolvePolicyDecisionResult,
} from './taxonomy-classification/domain-rollout-policy.service'
import { TaxonomyClassifierService } from './taxonomy-classification/taxonomy-classifier.service'

export type CaseExtractionBatchResult = {
  batchId: string
  processedCount: number
  skippedCount: number
}

type DomainClassificationAttempt = {
  l1Code: string
  result: TaxonomyClassificationResult
}

type SelectedClassificationOutcome = {
  appendRunArgs: AppendClassificationRunArgs
  latestSnapshot: ReturnType<typeof buildLatestClassificationSnapshot>
}

type EvaluatedDomainAttempt = DomainClassificationAttempt & {
  primaryExecutability: PrimaryExecutabilitySnapshot
  resolvedPolicyDecision: ResolvePolicyDecisionResult
}

const PRIMARY_SELECTION_RULE = 'confidenceScore-desc,scoreGap-desc,score-desc,registry-order'
const TERMINAL_SELECTION_RULE = 'failure-priority,confidenceScore-desc,registry-order'

@Injectable()
export class CaseExtractionService {
  private readonly logger = new Logger(CaseExtractionService.name)

  constructor(
    @InjectRepository(ComplianceCase)
    private readonly complianceCaseRepository: Repository<ComplianceCase>,
    @InjectRepository(RegulationClause)
    private readonly regulationClauseRepository: Repository<RegulationClause>,
    private readonly caseThemeIntelligenceService: CaseThemeIntelligenceService,
    private readonly taxonomyClassifierService: TaxonomyClassifierService,
    private readonly runtimeDomainSelectorService: RuntimeDomainSelectorService,
    private readonly classificationRunService: ComplianceCaseClassificationRunService,
    private readonly classificationTelemetryService: ClassificationTelemetryService,
    private readonly caseNormalizationService: CaseNormalizationService,
    @Optional()
    private readonly domainRolloutPolicyService?: DomainRolloutPolicyService,
    @Optional()
    private readonly failureModeService?: FailureModeService,
    @Optional()
    private readonly caseClusteringChainService?: CaseClusteringChainService,
  ) {}

  async extractBatch(batchId: string): Promise<CaseExtractionBatchResult> {
    const cases = await this.complianceCaseRepository.find({
      where: {
        importBatchId: batchId,
        status: 'pending',
      },
      order: {
        createdAt: 'ASC',
      },
    })

    let processedCount = 0

    for (const caseRecord of cases) {
      const sourceText = [caseRecord.penaltyReason, caseRecord.caseFacts]
        .filter((value): value is string => Boolean(value))
        .join('；')

      let violationThemes = extractViolationThemesFromText(sourceText)

      if (this.shouldUseLlmRefinement(violationThemes)) {
        const refinedThemes =
          await this.caseThemeIntelligenceService.refineViolationThemes(
            sourceText,
            violationThemes,
          )

        if (refinedThemes && refinedThemes.length > 0) {
          violationThemes = refinedThemes
        }
      }

      const clauseCandidates = await this.findClauseCandidates(
        sourceText,
        violationThemes,
      )
      const classificationOutcome = await this.classifyAcrossRuntimeDomains(
        caseRecord,
        sourceText,
      )
      const latestSnapshot = classificationOutcome.latestSnapshot

      caseRecord.violationThemes = violationThemes
      caseRecord.clauseCandidates = clauseCandidates
      caseRecord.l1Code = latestSnapshot.l1Code
      caseRecord.l2Code = latestSnapshot.l2Code
      caseRecord.confidenceScore = latestSnapshot.confidenceScore
      caseRecord.classificationSource = latestSnapshot.classificationSource
      caseRecord.classificationVersion = latestSnapshot.classificationVersion
      caseRecord.fallbackReason = latestSnapshot.fallbackReason
      caseRecord.extractedAt = new Date()
      caseRecord.status = 'extracted'

      await this.classificationRunService.appendRunAndRefreshLatest(
        classificationOutcome.appendRunArgs,
      )
      await this.complianceCaseRepository.save(caseRecord)

      try {
        await this.classificationTelemetryService.publishLatestSnapshotWritten({
          caseId: caseRecord.caseId,
          batchId: caseRecord.importBatchId,
          l1Code: latestSnapshot.l1Code,
          l2Code: latestSnapshot.l2Code,
          classificationSource: latestSnapshot.classificationSource,
          classificationVersion: latestSnapshot.classificationVersion,
          fallbackReason: latestSnapshot.fallbackReason,
          classificationStatus:
            classificationOutcome.appendRunArgs.classificationStatus,
          pathDecision: classificationOutcome.appendRunArgs.pathDecision,
        })
      } catch (error) {
        this.logger.warn(
          `Classification telemetry publish failed for case ${caseRecord.caseId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }

      processedCount += 1
    }

    return {
      batchId,
      processedCount,
      skippedCount: 0,
    }
  }

  private async classifyAcrossRuntimeDomains(
    caseRecord: ComplianceCase,
    sourceText: string,
  ): Promise<SelectedClassificationOutcome> {
    const normalizedInput = this.caseNormalizationService.normalize({
      rawText: sourceText,
      caseFacts: caseRecord.caseFacts,
      penaltyReason: caseRecord.penaltyReason,
    })
    const supportedDomains = this.runtimeDomainSelectorService.getSupportedDomains()

    if (supportedDomains.length === 0) {
      const fallbackAppendRunArgs: AppendClassificationRunArgs = {
        caseId: caseRecord.caseId,
        batchId: caseRecord.importBatchId,
        classifierVersion: 'runtime-domain-selector-unconfigured',
        mappingVersion: 'unconfigured',
        rulebookVersion: 'unconfigured',
        inputHash: this.buildInputHash(normalizedInput),
        normalizedInputJson: this.buildNormalizedInputSnapshot(normalizedInput),
        matchedSignals: [],
        decisionTrace: {
          evaluatedDomains: [],
          chosenDomain: null,
          chosenPathDecision: 'UNCLASSIFIED',
          rootFailureSemantic: 'UNSUPPORTED_DOMAIN',
          normalizedFailureSemantic: 'PENDING_RECLASSIFY',
          tieBreakRule: TERMINAL_SELECTION_RULE,
        },
        l1Code: null,
        l2Code: null,
        confidenceScore: null,
        decisionSource: 'none',
        pathDecision: 'UNCLASSIFIED',
        fallbackReason: 'PENDING_RECLASSIFY',
        classificationStatus: 'FAILED',
        classificationSource: 'none',
        classificationVersion: 'runtime-domain-selector-unconfigured',
      }

      return {
        appendRunArgs: fallbackAppendRunArgs,
        latestSnapshot: buildLatestClassificationSnapshot(fallbackAppendRunArgs),
      }
    }

    const attempts = supportedDomains.map((l1Code) => ({
      l1Code,
      result: this.taxonomyClassifierService.classifyCaseText({
        rawText: sourceText,
        caseFacts: caseRecord.caseFacts,
        penaltyReason: caseRecord.penaltyReason,
        preferredL1Code: l1Code,
      }),
    }))

    if (
      !this.domainRolloutPolicyService ||
      !this.failureModeService ||
      !this.caseClusteringChainService
    ) {
      throw new Error(
        'Rollout policy enforcement requires domain rollout policy, failure mode service, and case clustering chain service to be wired together.',
      )
    }

    const evaluatedAttempts = await Promise.all(
      attempts.map(async (attempt) => {
        const primaryExecutability = await this.evaluatePrimaryExecutability(
          attempt.result,
        )
        const resolvedPolicyDecision =
          await this.domainRolloutPolicyService!.resolvePolicyDecision({
            l1Code: attempt.l1Code,
            classifierResult: attempt.result,
            primaryExecutability,
          })

        return {
          ...attempt,
          primaryExecutability,
          resolvedPolicyDecision,
        } satisfies EvaluatedDomainAttempt
      }),
    )

    const selectedAttempt = this.selectResolvedAttempt(
      evaluatedAttempts,
      supportedDomains,
    )

    return this.buildSelectedClassificationOutcome({
      caseRecord,
      normalizedInput,
      attempts: evaluatedAttempts,
      selectedAttempt,
      resolvedPolicyDecision: selectedAttempt.resolvedPolicyDecision,
    })
  }

  private selectAttempt(
    attempts: DomainClassificationAttempt[],
    domainOrder: string[],
  ): DomainClassificationAttempt {
    const primaryAttempts = attempts
      .filter(
        (attempt) =>
          attempt.result.pathDecision === 'PRIMARY_CHAIN' &&
          attempt.result.l1Code !== null &&
          attempt.result.l2Code !== null,
      )
      .sort((left, right) => this.comparePrimaryAttempts(left, right, domainOrder))

    if (primaryAttempts.length > 0) {
      return primaryAttempts[0]
    }

    return [...attempts].sort((left, right) =>
      this.compareTerminalAttempts(left, right, domainOrder),
    )[0]
  }

  private comparePrimaryAttempts(
    left: DomainClassificationAttempt,
    right: DomainClassificationAttempt,
    domainOrder: string[],
  ): number {
    if (right.result.confidenceScore !== left.result.confidenceScore) {
      return right.result.confidenceScore - left.result.confidenceScore
    }

    if (right.result.scoreGap !== left.result.scoreGap) {
      return right.result.scoreGap - left.result.scoreGap
    }

    if (right.result.score !== left.result.score) {
      return right.result.score - left.result.score
    }

    return domainOrder.indexOf(left.l1Code) - domainOrder.indexOf(right.l1Code)
  }

  private compareTerminalAttempts(
    left: DomainClassificationAttempt,
    right: DomainClassificationAttempt,
    domainOrder: string[],
  ): number {
    const leftPriority = this.failurePriority(
      this.normalizeFailureSemantic(left.result.failureSemantics),
    )
    const rightPriority = this.failurePriority(
      this.normalizeFailureSemantic(right.result.failureSemantics),
    )

    if (rightPriority !== leftPriority) {
      return rightPriority - leftPriority
    }

    if (right.result.confidenceScore !== left.result.confidenceScore) {
      return right.result.confidenceScore - left.result.confidenceScore
    }

    return domainOrder.indexOf(left.l1Code) - domainOrder.indexOf(right.l1Code)
  }

  private selectResolvedAttempt(
    attempts: EvaluatedDomainAttempt[],
    domainOrder: string[],
  ): EvaluatedDomainAttempt {
    const primaryAttempts = attempts
      .filter(
        (attempt) =>
          attempt.resolvedPolicyDecision.pathDecision === 'PRIMARY_CHAIN' &&
          attempt.result.l1Code !== null &&
          attempt.result.l2Code !== null,
      )
      .sort((left, right) =>
        this.comparePrimaryAttempts(left, right, domainOrder),
      )

    if (primaryAttempts.length > 0) {
      return primaryAttempts[0]
    }

    const protectedAbstainAttempts = attempts
      .filter(
        (attempt) =>
          attempt.resolvedPolicyDecision.pathDecision === 'ABSTAIN' &&
          attempt.result.pathDecision === 'PRIMARY_CHAIN',
      )
      .sort((left, right) =>
        this.comparePrimaryAttempts(left, right, domainOrder),
      )

    if (protectedAbstainAttempts.length > 0) {
      return protectedAbstainAttempts[0]
    }

    return [...attempts].sort((left, right) =>
      this.compareResolvedTerminalAttempts(left, right, domainOrder),
    )[0]
  }

  private compareResolvedTerminalAttempts(
    left: EvaluatedDomainAttempt,
    right: EvaluatedDomainAttempt,
    domainOrder: string[],
  ): number {
    const decisionPriorityDiff =
      this.pathDecisionPriority(right.resolvedPolicyDecision.pathDecision) -
      this.pathDecisionPriority(left.resolvedPolicyDecision.pathDecision)

    if (decisionPriorityDiff !== 0) {
      return decisionPriorityDiff
    }

    const leftPriority = this.failurePriority(
      this.normalizeFailureSemantic(
        left.resolvedPolicyDecision.failureSemantic ??
          left.result.failureSemantics,
      ),
    )
    const rightPriority = this.failurePriority(
      this.normalizeFailureSemantic(
        right.resolvedPolicyDecision.failureSemantic ??
          right.result.failureSemantics,
      ),
    )

    if (rightPriority !== leftPriority) {
      return rightPriority - leftPriority
    }

    if (right.result.confidenceScore !== left.result.confidenceScore) {
      return right.result.confidenceScore - left.result.confidenceScore
    }

    return domainOrder.indexOf(left.l1Code) - domainOrder.indexOf(right.l1Code)
  }

  private pathDecisionPriority(
    pathDecision: AppendClassificationRunArgs['pathDecision'],
  ): number {
    switch (pathDecision) {
      case 'LEGACY_FALLBACK':
        return 2
      case 'ABSTAIN':
        return 1
      case 'UNCLASSIFIED':
      default:
        return 0
    }
  }

  private failurePriority(
    failureSemantic: AppendClassificationRunArgs['fallbackReason'],
  ): number {
    switch (failureSemantic) {
      case 'PENDING_RECLASSIFY':
        return 4
      case 'LOW_CONFIDENCE':
        return 3
      case 'NO_MATCH':
        return 2
      case 'LEGACY_FALLBACK_TRIGGERED':
        return 1
      case null:
      default:
        return 0
    }
  }

  private normalizeFailureSemantic(
    failureSemantic: TaxonomyClassificationResult['failureSemantics'],
  ): AppendClassificationRunArgs['fallbackReason'] {
    switch (failureSemantic) {
      case 'ENGINE_ERROR':
      case 'MAPPING_MISSING':
      case 'PENDING_RECLASSIFY':
      case 'UNSUPPORTED_DOMAIN':
        return 'PENDING_RECLASSIFY'
      case 'LOW_CONFIDENCE':
      case 'NO_MATCH':
      case 'LEGACY_FALLBACK_TRIGGERED':
        return failureSemantic
      case null:
      default:
        return null
    }
  }

  private resolveClassificationStatus(
    pathDecision: AppendClassificationRunArgs['pathDecision'],
    normalizedFailureSemantic: AppendClassificationRunArgs['fallbackReason'],
  ): AppendClassificationRunArgs['classificationStatus'] {
    if (pathDecision === 'PRIMARY_CHAIN') {
      return 'SUCCEEDED'
    }

    if (pathDecision === 'LEGACY_FALLBACK') {
      return 'FALLBACK_APPLIED'
    }

    if (normalizedFailureSemantic === 'PENDING_RECLASSIFY') {
      return 'FAILED'
    }

    return 'ABSTAINED'
  }

  private resolveClassificationSource(
    result: TaxonomyClassificationResult,
    pathDecision: AppendClassificationRunArgs['pathDecision'],
  ): AppendClassificationRunArgs['classificationSource'] {
    if (pathDecision === 'LEGACY_FALLBACK') {
      return 'legacy-fallback'
    }

    if (pathDecision !== 'PRIMARY_CHAIN') {
      return 'none'
    }

    if (result.decisionSource === 'rule') {
      return 'rule'
    }

    if (result.decisionSource === 'semantic') {
      return 'semantic'
    }

    if (result.decisionSource === 'hybrid') {
      return 'hybrid'
    }

    return 'none'
  }

  private buildDecisionTrace(
    attempts: Array<DomainClassificationAttempt | EvaluatedDomainAttempt>,
    selectedAttempt: DomainClassificationAttempt | EvaluatedDomainAttempt,
    normalizedFailureSemantic: AppendClassificationRunArgs['fallbackReason'],
  ): Record<string, unknown> {
    const selectedResolvedAttempt = this.isEvaluatedAttempt(selectedAttempt)
      ? selectedAttempt
      : null

    return {
      evaluatedDomains: attempts.map((attempt) => ({
        l1Code: attempt.l1Code,
        l2Code: attempt.result.l2Code,
        confidenceScore: attempt.result.confidenceScore,
        scoreGap: attempt.result.scoreGap,
        decisionSource: attempt.result.decisionSource,
        pathDecision: attempt.result.pathDecision,
        failureSemantics: attempt.result.failureSemantics,
        ...(this.isEvaluatedAttempt(attempt)
          ? {
              effectivePathDecision: attempt.resolvedPolicyDecision.pathDecision,
              rolloutState: attempt.resolvedPolicyDecision.rolloutState,
              allowLegacyFallback:
                attempt.resolvedPolicyDecision.policy.allowLegacyFallback,
              killSwitchEnabled:
                attempt.resolvedPolicyDecision.policy.killSwitchEnabled,
              primaryExecutability: attempt.primaryExecutability,
            }
          : {}),
      })),
      chosenDomain: selectedAttempt.l1Code,
      chosenL2Code: selectedAttempt.result.l2Code,
      chosenPathDecision:
        selectedResolvedAttempt?.resolvedPolicyDecision.pathDecision ??
        selectedAttempt.result.pathDecision,
      rootFailureSemantic:
        selectedResolvedAttempt?.resolvedPolicyDecision.failureSemantic ??
        selectedAttempt.result.failureSemantics,
      normalizedFailureSemantic,
      tieBreakRule:
        (
          selectedResolvedAttempt?.resolvedPolicyDecision.pathDecision ??
          selectedAttempt.result.pathDecision
        ) === 'PRIMARY_CHAIN'
          ? PRIMARY_SELECTION_RULE
          : TERMINAL_SELECTION_RULE,
      ...(selectedResolvedAttempt
        ? {
            rolloutState:
              selectedResolvedAttempt.resolvedPolicyDecision.rolloutState,
            killSwitchEnabled:
              selectedResolvedAttempt.resolvedPolicyDecision.policy
                .killSwitchEnabled,
            rolloutReason:
              selectedResolvedAttempt.resolvedPolicyDecision.reason,
            policySnapshot: {
              l1Code:
                selectedResolvedAttempt.resolvedPolicyDecision.policy.l1Code,
              rolloutState:
                selectedResolvedAttempt.resolvedPolicyDecision.policy
                  .rolloutState,
              allowLegacyFallback:
                selectedResolvedAttempt.resolvedPolicyDecision.policy
                  .allowLegacyFallback,
              primaryThreshold:
                selectedResolvedAttempt.resolvedPolicyDecision.policy
                  .primaryThreshold,
              shadowWindowDays:
                selectedResolvedAttempt.resolvedPolicyDecision.policy
                  .shadowWindowDays,
              activeClassifierVersion:
                selectedResolvedAttempt.resolvedPolicyDecision.policy
                  .activeClassifierVersion,
            },
            primaryExecutability:
              selectedResolvedAttempt.primaryExecutability,
          }
        : {}),
    }
  }

  private async evaluatePrimaryExecutability(
    result: TaxonomyClassificationResult,
  ): Promise<PrimaryExecutabilitySnapshot> {
    if (
      !this.failureModeService ||
      !this.caseClusteringChainService ||
      result.pathDecision !== 'PRIMARY_CHAIN' ||
      !result.l2Code
    ) {
      return {
        failureModeCount: 0,
        controlCandidateCount: 0,
        isExecutable: false,
        reason: 'NO_PRIMARY_CLASSIFICATION',
      }
    }

    try {
      const [failureModeResult, chainResult] = await Promise.all([
        this.failureModeService.findByL2Code(result.l2Code, {
          status: 'ACTIVE',
          limit: 50,
        }),
        this.caseClusteringChainService.resolveControlPointsByL2Code(
          result.l2Code,
        ),
      ])

      if (failureModeResult.items.length === 0) {
        return {
          failureModeCount: 0,
          controlCandidateCount: chainResult.total,
          isExecutable: false,
          reason: 'NO_FAILURE_MODE',
        }
      }

      if (chainResult.total === 0) {
        return {
          failureModeCount: failureModeResult.items.length,
          controlCandidateCount: 0,
          isExecutable: false,
          reason: 'NO_CONTROL_CANDIDATE',
        }
      }

      return {
        failureModeCount: failureModeResult.items.length,
        controlCandidateCount: chainResult.total,
        isExecutable: true,
        reason: 'READY',
      }
    } catch {
      return {
        failureModeCount: 0,
        controlCandidateCount: 0,
        isExecutable: false,
        reason: 'CHAIN_QUERY_FAILED',
      }
    }
  }

  private buildSelectedClassificationOutcome(args: {
    caseRecord: ComplianceCase
    normalizedInput: NormalizedTaxonomyClassificationInput
    attempts: Array<DomainClassificationAttempt | EvaluatedDomainAttempt>
    selectedAttempt: DomainClassificationAttempt | EvaluatedDomainAttempt
    resolvedPolicyDecision?: ResolvePolicyDecisionResult
  }): SelectedClassificationOutcome {
    const effectivePathDecision =
      args.resolvedPolicyDecision?.pathDecision ??
      args.selectedAttempt.result.pathDecision
    const normalizedFailureSemantic = this.normalizeFailureSemantic(
      args.resolvedPolicyDecision?.failureSemantic ??
        args.selectedAttempt.result.failureSemantics,
    )
    const appendRunArgs: AppendClassificationRunArgs = {
      caseId: args.caseRecord.caseId,
      batchId: args.caseRecord.importBatchId,
      classifierVersion: args.selectedAttempt.result.classifierVersion,
      mappingVersion: args.selectedAttempt.result.mappingVersion,
      rulebookVersion: args.selectedAttempt.result.rulebookVersion,
      inputHash: this.buildInputHash(args.normalizedInput),
      normalizedInputJson: this.buildNormalizedInputSnapshot(
        args.normalizedInput,
      ),
      matchedSignals: [...args.selectedAttempt.result.matchedSignals],
      decisionTrace: this.buildDecisionTrace(
        args.attempts,
        args.selectedAttempt,
        normalizedFailureSemantic,
      ),
      l1Code: args.selectedAttempt.result.l1Code,
      l2Code: args.selectedAttempt.result.l2Code,
      confidenceScore:
        effectivePathDecision === 'PRIMARY_CHAIN'
          ? args.selectedAttempt.result.confidenceScore
          : null,
      decisionSource: args.selectedAttempt.result.decisionSource,
      pathDecision: effectivePathDecision,
      fallbackReason: normalizedFailureSemantic,
      classificationStatus: this.resolveClassificationStatus(
        effectivePathDecision,
        normalizedFailureSemantic,
      ),
      classificationSource: this.resolveClassificationSource(
        args.selectedAttempt.result,
        effectivePathDecision,
      ),
      classificationVersion: args.selectedAttempt.result.classifierVersion,
    }

    return {
      appendRunArgs,
      latestSnapshot: buildLatestClassificationSnapshot(appendRunArgs),
    }
  }

  private isEvaluatedAttempt(
    attempt: DomainClassificationAttempt | EvaluatedDomainAttempt,
  ): attempt is EvaluatedDomainAttempt {
    return (
      'resolvedPolicyDecision' in attempt &&
      'primaryExecutability' in attempt
    )
  }

  private buildNormalizedInputSnapshot(
    normalizedInput: NormalizedTaxonomyClassificationInput,
  ): Record<string, unknown> {
    return {
      normalizedText: normalizedInput.normalizedText,
      normalizedTokens: normalizedInput.normalizedTokens,
      normalizedPhrases: normalizedInput.normalizedPhrases,
    }
  }

  private buildInputHash(
    normalizedInput: NormalizedTaxonomyClassificationInput,
  ): string {
    return createHash('sha256')
      .update(JSON.stringify(this.buildNormalizedInputSnapshot(normalizedInput)))
      .digest('hex')
  }

  private shouldUseLlmRefinement(violationThemes: string[]): boolean {
    if (violationThemes.length === 0) {
      return true
    }

    return violationThemes.every(
      (theme) => isWeakTheme(theme) || theme.length <= 4,
    )
  }

  private async findClauseCandidates(
    sourceText: string,
    violationThemes: string[],
  ): Promise<ComplianceCaseClauseCandidate[]> {
    const keywords = this.extractKeywords(`${sourceText} ${violationThemes.join(' ')}`)

    if (keywords.length === 0) {
      return []
    }

    const clauses = await this.regulationClauseRepository.find({
      take: 50,
      order: {
        updatedAt: 'DESC',
      },
    })

    return clauses
      .map((clause) => {
        const haystack = [
          clause.clauseCode,
          clause.clauseSummary,
          clause.clauseText,
          ...(clause.keywords ?? []),
        ]
          .filter((value): value is string => Boolean(value))
          .join(' ')

        const matchedKeywords = keywords.filter((keyword) =>
          haystack.includes(keyword),
        )

        if (matchedKeywords.length === 0) {
          return null
        }

        return {
          clauseId: clause.clauseId,
          clauseCode: clause.clauseCode,
          summary: clause.clauseSummary,
          matchedKeywords,
          confidenceScore: Number(
            Math.min(1, 0.35 + matchedKeywords.length * 0.15).toFixed(2),
          ),
        } satisfies ComplianceCaseClauseCandidate
      })
      .filter(
        (candidate): candidate is ComplianceCaseClauseCandidate => candidate !== null,
      )
      .sort(
        (left, right) =>
          right.matchedKeywords.length - left.matchedKeywords.length ||
          right.confidenceScore - left.confidenceScore,
      )
      .slice(0, 5)
  }

  private extractKeywords(text: string): string[] {
    return tokenizeText(text)
  }
}
