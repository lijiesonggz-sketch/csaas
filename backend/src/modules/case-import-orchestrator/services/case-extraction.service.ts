import { createHash } from 'crypto'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import {
  ComplianceCase,
  ComplianceCaseClauseCandidate,
} from '../../../database/entities/compliance-case.entity'
import { RegulationClause } from '../../../database/entities/regulation-clause.entity'
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
      const classificationOutcome = this.classifyAcrossRuntimeDomains(
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

  private classifyAcrossRuntimeDomains(
    caseRecord: ComplianceCase,
    sourceText: string,
  ): SelectedClassificationOutcome {
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

    const selectedAttempt = this.selectAttempt(attempts, supportedDomains)
    const normalizedFailureSemantic = this.normalizeFailureSemantic(
      selectedAttempt.result.failureSemantics,
    )
    const appendRunArgs: AppendClassificationRunArgs = {
      caseId: caseRecord.caseId,
      batchId: caseRecord.importBatchId,
      classifierVersion: selectedAttempt.result.classifierVersion,
      mappingVersion: selectedAttempt.result.mappingVersion,
      rulebookVersion: selectedAttempt.result.rulebookVersion,
      inputHash: this.buildInputHash(normalizedInput),
      normalizedInputJson: this.buildNormalizedInputSnapshot(normalizedInput),
      matchedSignals: [...selectedAttempt.result.matchedSignals],
      decisionTrace: this.buildDecisionTrace(
        attempts,
        selectedAttempt,
        normalizedFailureSemantic,
      ),
      l1Code: selectedAttempt.result.l1Code,
      l2Code: selectedAttempt.result.l2Code,
      confidenceScore:
        selectedAttempt.result.pathDecision === 'PRIMARY_CHAIN'
          ? selectedAttempt.result.confidenceScore
          : null,
      decisionSource: selectedAttempt.result.decisionSource,
      pathDecision: selectedAttempt.result.pathDecision,
      fallbackReason: normalizedFailureSemantic,
      classificationStatus: this.resolveClassificationStatus(
        selectedAttempt.result,
        normalizedFailureSemantic,
      ),
      classificationSource: this.resolveClassificationSource(
        selectedAttempt.result,
      ),
      classificationVersion: selectedAttempt.result.classifierVersion,
    }

    return {
      appendRunArgs,
      latestSnapshot: buildLatestClassificationSnapshot(appendRunArgs),
    }
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
    result: TaxonomyClassificationResult,
    normalizedFailureSemantic: AppendClassificationRunArgs['fallbackReason'],
  ): AppendClassificationRunArgs['classificationStatus'] {
    if (result.pathDecision === 'PRIMARY_CHAIN') {
      return 'SUCCEEDED'
    }

    if (result.pathDecision === 'LEGACY_FALLBACK') {
      return 'FALLBACK_APPLIED'
    }

    if (normalizedFailureSemantic === 'PENDING_RECLASSIFY') {
      return 'FAILED'
    }

    return 'ABSTAINED'
  }

  private resolveClassificationSource(
    result: TaxonomyClassificationResult,
  ): AppendClassificationRunArgs['classificationSource'] {
    if (result.pathDecision === 'LEGACY_FALLBACK') {
      return 'legacy-fallback'
    }

    if (result.pathDecision !== 'PRIMARY_CHAIN') {
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
    attempts: DomainClassificationAttempt[],
    selectedAttempt: DomainClassificationAttempt,
    normalizedFailureSemantic: AppendClassificationRunArgs['fallbackReason'],
  ): Record<string, unknown> {
    return {
      evaluatedDomains: attempts.map((attempt) => ({
        l1Code: attempt.l1Code,
        l2Code: attempt.result.l2Code,
        confidenceScore: attempt.result.confidenceScore,
        scoreGap: attempt.result.scoreGap,
        decisionSource: attempt.result.decisionSource,
        pathDecision: attempt.result.pathDecision,
        failureSemantics: attempt.result.failureSemantics,
      })),
      chosenDomain: selectedAttempt.l1Code,
      chosenL2Code: selectedAttempt.result.l2Code,
      chosenPathDecision: selectedAttempt.result.pathDecision,
      rootFailureSemantic: selectedAttempt.result.failureSemantics,
      normalizedFailureSemantic,
      tieBreakRule:
        selectedAttempt.result.pathDecision === 'PRIMARY_CHAIN'
          ? PRIMARY_SELECTION_RULE
          : TERMINAL_SELECTION_RULE,
    }
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
