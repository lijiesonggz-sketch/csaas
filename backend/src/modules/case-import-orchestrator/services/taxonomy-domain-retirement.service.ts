import * as fs from 'fs'
import * as path from 'path'
import { Injectable, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ComplianceCase } from '../../../database/entities/compliance-case.entity'
import type { KgTaxonomyDomainRolloutState } from '../../../database/entities/kg-taxonomy-domain-rollout-policy.entity'
import { KgTaxonomyDomainRolloutPolicy } from '../../../database/entities/kg-taxonomy-domain-rollout-policy.entity'
import { ComplianceCaseBackfillService } from './compliance-case-backfill.service'
import { ComplianceCaseReclassificationService } from './compliance-case-reclassification.service'
import { TaxonomyDomainGateService } from './taxonomy-domain-gate.service'
import { resolveWorkspaceArtifactPath } from './taxonomy-benchmark.runner'
import {
  DomainRolloutPolicyService,
  mergeRetirementEvidence,
  validateRolloutTransition,
  type DomainRetirementEvidence,
  type DomainRolloutPolicySnapshot,
} from './taxonomy-classification/domain-rollout-policy.service'
import type { TaxonomyClassificationResult } from './taxonomy-classification/contracts/classification-result.contract'

export type DomainRetirementPrerequisites = {
  cutoverTierPassed: boolean
  observationWindowPassed: boolean
  killSwitchDrillPassed: boolean
  rollbackVerified: boolean
  reclassifyReady: boolean
  backfillReady: boolean
}

export type DomainRetirementReadiness = {
  l1Code: string
  currentState: KgTaxonomyDomainRolloutState
  targetState: 'legacy-off'
  allowed: boolean
  gateStatus: 'PASS' | 'FAIL'
  prerequisites: DomainRetirementPrerequisites
  blockingReasons: string[]
  metrics: {
    totalRuns: number
    fallbackCount: number
    unknownCount: number
    manualCorrectionCount: number
    fallbackRate: number
    unknownRate: number
    manualCorrectionRate: number
    errorBudgetConsumed: number
    observationWindowDays: number
  }
  rolloutGuidance: {
    canaryPercentage: number
    errorBudget: number
    rollbackPath: string
  }
}

export type DomainSmokeVerification = {
  passed: boolean
  checkedAt: string | null
  reason?: string
}

export type DomainRetirementReport = {
  affectedDomains: string[]
  gateResults: {
    legacyOff: 'PASS' | 'FAIL'
    cleanup: 'READY' | 'DEFERRED'
  }
  finalFallbackRate: number
  rollbackReadiness: {
    verified: boolean
    path: string
  }
  smokeVerification: DomainSmokeVerification
  blockingReasons: string[]
  reportPath: string | null
}

export type DomainRetirementRollbackResult = {
  l1Code: string
  previousState: KgTaxonomyDomainRolloutState
  targetState: 'domain-primary'
  legacyFallbackRestored: boolean
  rollbackPath: string
  reportPath: string | null
  evidenceSummary: {
    lastRollbackVerifiedAt: string | null
    lastRetirementReportPath: string | null
  }
}

export type DomainRetirementDryRunDecision = DomainRetirementReadiness & {
  cleanupReadiness: DomainPhysicalCleanupDecision
}

export type DomainRetirementReportFile = {
  fileName: string
  content: string
}

export type DomainPhysicalCleanupDecision = {
  allowed: boolean
  blockingReasons: string[]
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-')
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '-')
}

const RETIREMENT_REPORT_PUBLIC_PREFIX = '/reports/taxonomy-retirement/'

function resolveRetirementReportDirectory(): string {
  return path.join(
    resolveWorkspaceArtifactPath('_bmad-output/test-artifacts').resolvedPath,
    'taxonomy-retirement',
  )
}

function toPublicRetirementReportPath(fileName: string): string {
  return `${RETIREMENT_REPORT_PUBLIC_PREFIX}${fileName}`
}

function resolveRetirementReportPath(reportPath: string): string {
  const trimmedReportPath = reportPath.trim()
  if (!trimmedReportPath) {
    throw new Error('Retirement report path is required.')
  }

  const reportDir = resolveRetirementReportDirectory()
  const resolvedReportDir = path.resolve(reportDir)
  const slashNormalizedPath = trimmedReportPath.replace(/\\/g, '/')
  const publicPrefixWithoutLeadingSlash = RETIREMENT_REPORT_PUBLIC_PREFIX.slice(1)
  const fileName = slashNormalizedPath.startsWith(RETIREMENT_REPORT_PUBLIC_PREFIX)
    ? path.posix.basename(slashNormalizedPath)
    : slashNormalizedPath.startsWith(publicPrefixWithoutLeadingSlash)
      ? path.posix.basename(slashNormalizedPath)
      : path.isAbsolute(trimmedReportPath)
        ? null
        : path.posix.basename(slashNormalizedPath)

  const resolvedReportPath = fileName
    ? path.resolve(reportDir, fileName)
    : path.resolve(trimmedReportPath)

  if (
    resolvedReportPath !== resolvedReportDir &&
    !resolvedReportPath.startsWith(`${resolvedReportDir}${path.sep}`)
  ) {
    throw new Error('Retirement report path is outside the allowed report directory.')
  }

  if (!path.basename(resolvedReportPath).endsWith('.json')) {
    throw new Error('Retirement report path must reference a JSON report.')
  }

  return resolvedReportPath
}

function isAssignedOwner(value: string | null | undefined): boolean {
  return Boolean(value && value !== 'unassigned')
}

function normalizeBoolean(value: unknown): boolean {
  return value === true
}

function isInfraUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /(ECONN|ETIMEDOUT|timeout|connection|network|database|socket|refused|unavailable)/i.test(
    message,
  )
}

const MIN_OBSERVATION_RUNS = 10
const MAX_UNKNOWN_RATE = 0.03
const MAX_MANUAL_CORRECTION_RATE = 0.1

@Injectable()
export class DomainRetirementPrerequisiteVerifierService {
  constructor(
    @Optional()
    private readonly domainRolloutPolicyService?: DomainRolloutPolicyService,
    @Optional()
    private readonly complianceCaseReclassificationService?: ComplianceCaseReclassificationService,
    @Optional()
    private readonly complianceCaseBackfillService?: ComplianceCaseBackfillService,
    @Optional()
    @InjectRepository(ComplianceCase)
    private readonly complianceCaseRepository?: Repository<ComplianceCase>,
  ) {}

  async verifyPrerequisites(args: {
    l1Code: string
    gateDecision: Awaited<ReturnType<TaxonomyDomainGateService['evaluateDomainReadiness']>>
  }): Promise<DomainRetirementPrerequisites> {
    const policy = await this.resolvePolicy(args.l1Code)
    const evidence = policy?.retirementEvidenceJson

    return {
      cutoverTierPassed:
        Boolean(evidence?.lastCutoverAt) || args.gateDecision.currentState === 'domain-primary',
      observationWindowPassed:
        args.gateDecision.metrics.totalRuns >= MIN_OBSERVATION_RUNS &&
        args.gateDecision.metrics.fallbackRate <= args.gateDecision.rolloutGuidance.errorBudget &&
        args.gateDecision.metrics.unknownRate <= MAX_UNKNOWN_RATE &&
        args.gateDecision.metrics.manualCorrectionRate <= MAX_MANUAL_CORRECTION_RATE,
      killSwitchDrillPassed:
        normalizeBoolean(await this.simulateKillSwitchDrill(policy)) ||
        Boolean(evidence?.lastKillSwitchDrillAt),
      rollbackVerified:
        this.hasRollbackMetadata(policy) && (await this.hasRollbackExecutionSurface(args.l1Code)),
      reclassifyReady: await this.canDryRunReclassify(args.l1Code),
      backfillReady: await this.canDryRunBackfill(args.l1Code),
    }
  }

  private async resolvePolicy(l1Code: string): Promise<DomainRolloutPolicySnapshot | null> {
    if (!this.domainRolloutPolicyService) {
      return null
    }

    try {
      return await this.domainRolloutPolicyService.getPolicyForDomain(l1Code)
    } catch {
      return null
    }
  }

  private async simulateKillSwitchDrill(
    policy: DomainRolloutPolicySnapshot | null,
  ): Promise<boolean> {
    if (!policy || !this.domainRolloutPolicyService) {
      return false
    }

    const simulatedResult: TaxonomyClassificationResult = {
      l1Code: policy.l1Code,
      l2Code: `${policy.l1Code}-SIMULATED`,
      l2Name: `${policy.l1Code} simulated`,
      confidenceScore: policy.primaryThreshold + 0.05,
      scoreGap: 0.1,
      score: 0.9,
      decisionSource: 'hybrid',
      failureSemantics: null,
      matchedSignals: ['kill-switch-drill'],
      matchedPhrases: ['kill-switch-drill'],
      matchedTokens: ['kill-switch-drill'],
      pathDecision: 'PRIMARY_CHAIN',
      classifierVersion: policy.activeClassifierVersion ?? 'taxonomy-classifier',
      mappingVersion: policy.activeClassifierVersion ?? 'taxonomy-classifier',
      rulebookVersion: policy.activeClassifierVersion ?? 'taxonomy-classifier',
      classifiedAt: new Date().toISOString(),
    }

    const decision = await this.domainRolloutPolicyService.resolvePolicyDecision({
      l1Code: policy.l1Code,
      classifierResult: simulatedResult,
      primaryExecutability: {
        failureModeCount: 1,
        controlCandidateCount: 1,
        isExecutable: true,
        reason: 'READY',
      },
      // Simulated drill uses in-memory policy override only; no repository write path.
      policy: {
        ...policy,
        killSwitchEnabled: true,
      },
    })

    return decision.pathDecision !== 'PRIMARY_CHAIN'
  }

  private hasRollbackMetadata(policy: DomainRolloutPolicySnapshot | null): boolean {
    if (!policy) {
      return false
    }

    return (
      isAssignedOwner(policy.rollbackApprover) &&
      typeof policy.retirementThresholdsJson.rollbackPath === 'string' &&
      String(policy.retirementThresholdsJson.rollbackPath).trim().length > 0
    )
  }

  private async hasRollbackExecutionSurface(l1Code: string): Promise<boolean> {
    const [reclassifyReady, backfillReady] = await Promise.all([
      this.canDryRunReclassify(l1Code),
      this.canDryRunBackfill(l1Code),
    ])

    return reclassifyReady && backfillReady
  }

  private async findScopedCaseIds(l1Code: string): Promise<string[]> {
    if (!this.complianceCaseRepository) {
      return []
    }

    const cases = await this.complianceCaseRepository.find({
      where: {
        l1Code,
      },
      order: {
        createdAt: 'ASC',
      },
      take: 5,
    })

    return cases.map((caseRecord) => caseRecord.caseId)
  }

  private async canDryRunReclassify(l1Code: string): Promise<boolean> {
    if (!this.complianceCaseReclassificationService) {
      return false
    }

    const caseIds = await this.findScopedCaseIds(l1Code)
    if (caseIds.length === 0) {
      return true
    }

    try {
      await this.complianceCaseReclassificationService.reclassify({
        caseIds,
        l1Code,
        shadowOnly: true,
        dryRun: true,
      })
      return true
    } catch {
      return false
    }
  }

  private async canDryRunBackfill(l1Code: string): Promise<boolean> {
    if (!this.complianceCaseBackfillService) {
      return false
    }

    const caseIds = await this.findScopedCaseIds(l1Code)
    if (caseIds.length === 0) {
      return true
    }

    try {
      const report = await this.complianceCaseBackfillService.backfill({
        caseIds,
        l1Code,
        includeRetirementReadiness: true,
        dryRun: true,
      })
      return report.resetCount > 0 && report.skippedMissingBatchCount === 0
    } catch {
      return false
    }
  }
}

@Injectable()
export class DomainLegacyPathManagerService {
  constructor(
    @Optional()
    private readonly domainRolloutPolicyService?: DomainRolloutPolicyService,
    @Optional()
    @InjectRepository(KgTaxonomyDomainRolloutPolicy)
    private readonly rolloutPolicyRepository?: Repository<KgTaxonomyDomainRolloutPolicy>,
  ) {}

  async disableDomainLegacyPath(
    l1Code: string,
    expectedRolloutState: KgTaxonomyDomainRolloutState = 'legacy-off',
  ): Promise<void> {
    if (!this.domainRolloutPolicyService || !this.rolloutPolicyRepository) {
      return
    }

    const policy = await this.domainRolloutPolicyService.getPolicyForDomain(l1Code)
    if (policy.rolloutState !== expectedRolloutState) {
      throw new Error(
        `Domain ${l1Code} legacy fallback update blocked: expected ${expectedRolloutState}, got ${policy.rolloutState}.`,
      )
    }

    const updateResult = await this.rolloutPolicyRepository.update(
      { l1Code, rolloutState: expectedRolloutState },
      {
        allowLegacyFallback: false,
      },
    )

    if (updateResult.affected !== 1) {
      throw new Error(
        `Domain ${l1Code} legacy fallback update blocked: rollout state changed before retirement execution could be persisted.`,
      )
    }

    const updated = await this.rolloutPolicyRepository.findOne({ where: { l1Code } })
    if (!updated || updated.rolloutState !== expectedRolloutState || updated.allowLegacyFallback) {
      throw new Error(`Domain ${l1Code} still allows legacy fallback after retirement execution.`)
    }
  }

  async restoreDomainLegacyPath(
    l1Code: string,
    allowLegacyFallback: boolean,
    expectedRolloutState?: KgTaxonomyDomainRolloutState,
  ): Promise<void> {
    if (!this.rolloutPolicyRepository) {
      return
    }

    const updateResult = await this.rolloutPolicyRepository.update(
      expectedRolloutState ? { l1Code, rolloutState: expectedRolloutState } : { l1Code },
      {
        allowLegacyFallback,
      },
    )

    if (expectedRolloutState && updateResult.affected !== 1) {
      throw new Error(
        `Domain ${l1Code} legacy fallback restore blocked: rollout state changed before fallback could be restored.`,
      )
    }
  }
}

@Injectable()
export class DomainRetirementSmokeVerifierService {
  constructor(
    @Optional()
    private readonly domainRolloutPolicyService?: DomainRolloutPolicyService,
    @Optional()
    private readonly taxonomyDomainGateService?: TaxonomyDomainGateService,
    @Optional()
    private readonly complianceCaseReclassificationService?: ComplianceCaseReclassificationService,
    @Optional()
    private readonly complianceCaseBackfillService?: ComplianceCaseBackfillService,
    @Optional()
    @InjectRepository(ComplianceCase)
    private readonly complianceCaseRepository?: Repository<ComplianceCase>,
  ) {}

  async verifyDomainSmoke(l1Code: string): Promise<DomainSmokeVerification> {
    const checkedAt = new Date().toISOString()

    if (
      !this.domainRolloutPolicyService ||
      !this.taxonomyDomainGateService ||
      !this.complianceCaseReclassificationService ||
      !this.complianceCaseBackfillService ||
      !this.complianceCaseRepository
    ) {
      return {
        passed: false,
        checkedAt,
      }
    }

    try {
      const cases = await this.complianceCaseRepository.find({
        where: {
          l1Code,
        },
        order: {
          createdAt: 'ASC',
        },
        take: 5,
      })
      const caseIds = cases.map((caseRecord) => caseRecord.caseId)

      if (caseIds.length === 0) {
        return {
          passed: false,
          checkedAt,
        }
      }

      const [legacyFallbackAllowed, metrics, reclassifyReport, backfillReport] = await Promise.all([
        this.domainRolloutPolicyService.shouldAllowLegacyFallback(l1Code),
        this.domainRolloutPolicyService
          .getPolicyForDomain(l1Code)
          .then((policy) =>
            this.taxonomyDomainGateService!.summarizeWindow(l1Code, policy.shadowWindowDays),
          ),
        this.complianceCaseReclassificationService.reclassify({
          caseIds,
          l1Code,
          shadowOnly: true,
          dryRun: true,
        }),
        this.complianceCaseBackfillService.backfill({
          caseIds,
          l1Code,
          includeRetirementReadiness: true,
          dryRun: true,
        }),
      ])

      return {
        passed:
          !legacyFallbackAllowed &&
          metrics.totalRuns > 0 &&
          reclassifyReport.caseCount > 0 &&
          backfillReport.rollbackCompatible,
        checkedAt,
      }
    } catch (infraError) {
      if (isInfraUnavailableError(infraError)) {
        const message = infraError instanceof Error ? infraError.message : String(infraError)
        return {
          passed: false,
          checkedAt,
          reason: `smoke-check-unavailable: ${message}`,
        }
      }

      const message = infraError instanceof Error ? infraError.message : String(infraError)
      return {
        passed: false,
        checkedAt,
        reason: `smoke-check-failed: ${message}`,
      }
    }
  }
}

@Injectable()
export class DomainRetirementReleaseGuardService {
  async evaluateCleanupReadiness(args: {
    l1Code: string
    currentReleaseId: string
    isFirstNonIt04PrimaryDomain: boolean
    retiredAt: string | null
    stableWindowDays: number
    lastCutoverAt: string | null
    lastCutoverReleaseId: string | null
  }): Promise<DomainPhysicalCleanupDecision> {
    const blockingReasons: string[] = []
    const cutoverAt = args.lastCutoverAt ? new Date(args.lastCutoverAt) : null

    if (
      args.l1Code !== 'IT04' &&
      args.isFirstNonIt04PrimaryDomain &&
      args.lastCutoverReleaseId === args.currentReleaseId
    ) {
      blockingReasons.push(
        'first non-IT04 domain cannot ship physical cleanup in the same release as first domain-primary cutover',
      )
    }

    if (!cutoverAt || Number.isNaN(cutoverAt.getTime())) {
      blockingReasons.push('domain-primary stable window cannot be verified')
    } else {
      const stableWindowEnd = new Date(cutoverAt)
      stableWindowEnd.setDate(stableWindowEnd.getDate() + Math.max(args.stableWindowDays, 1))

      if (stableWindowEnd.getTime() > Date.now()) {
        blockingReasons.push('domain-primary stable window has not elapsed')
      }
    }

    if (!args.retiredAt) {
      blockingReasons.push('physical cleanup requires a completed legacy-off retirement first')
    }

    return {
      allowed: blockingReasons.length === 0,
      blockingReasons,
    }
  }
}

@Injectable()
export class TaxonomyDomainRetirementService {
  constructor(
    @Optional()
    private readonly taxonomyDomainGateService?: TaxonomyDomainGateService,
    @Optional()
    private readonly prerequisiteVerifier?: DomainRetirementPrerequisiteVerifierService,
    @Optional()
    private readonly legacyPathManager?: DomainLegacyPathManagerService,
    @Optional()
    private readonly smokeVerifier?: DomainRetirementSmokeVerifierService,
    @Optional()
    private readonly releaseGuard?: DomainRetirementReleaseGuardService,
    @Optional()
    private readonly domainRolloutPolicyService?: DomainRolloutPolicyService,
    @Optional()
    @InjectRepository(KgTaxonomyDomainRolloutPolicy)
    private readonly rolloutPolicyRepository?: Repository<KgTaxonomyDomainRolloutPolicy>,
  ) {}

  async evaluateRetirementReadiness(args: { l1Code: string }): Promise<DomainRetirementReadiness> {
    if (!this.taxonomyDomainGateService || !this.prerequisiteVerifier) {
      throw new Error('Retirement readiness requires gate service and prerequisite verifier.')
    }

    const gateDecision = await this.taxonomyDomainGateService.evaluateDomainReadiness({
      l1Code: args.l1Code,
      targetState: 'legacy-off',
    })
    const prerequisites = await this.prerequisiteVerifier.verifyPrerequisites({
      l1Code: args.l1Code,
      gateDecision,
    })

    const prerequisiteBlockingReasons = this.mapPrerequisiteBlockingReasons(prerequisites)
    const blockingReasons = [...gateDecision.blockingReasons, ...prerequisiteBlockingReasons]
    const allowed = gateDecision.allowed && prerequisiteBlockingReasons.length === 0

    return {
      l1Code: args.l1Code,
      currentState: gateDecision.currentState,
      targetState: 'legacy-off',
      allowed,
      gateStatus: allowed ? 'PASS' : 'FAIL',
      prerequisites,
      blockingReasons,
      metrics: gateDecision.metrics,
      rolloutGuidance: gateDecision.rolloutGuidance,
    }
  }

  async evaluateRetirementDryRun(args: {
    l1Code: string
  }): Promise<DomainRetirementDryRunDecision> {
    if (!this.domainRolloutPolicyService) {
      throw new Error('Retirement dry-run requires policy service.')
    }

    const readiness = await this.evaluateRetirementReadiness(args)
    const policy = await this.domainRolloutPolicyService.getPolicyForDomain(args.l1Code)
    const lastReleaseId = policy.retirementEvidenceJson.lastLegacyOffReleaseId

    if (policy.retirementEvidenceJson.lastLegacyOffAt && lastReleaseId) {
      return {
        ...readiness,
        cleanupReadiness: await this.evaluatePhysicalCleanup({
          l1Code: args.l1Code,
          currentReleaseId: lastReleaseId,
        }),
      }
    }

    return {
      ...readiness,
      cleanupReadiness: {
        allowed: false,
        blockingReasons: ['physical cleanup requires a completed legacy-off retirement first'],
      },
    }
  }

  async evaluatePhysicalCleanup(args: {
    l1Code: string
    currentReleaseId: string
  }): Promise<DomainPhysicalCleanupDecision> {
    if (!this.releaseGuard || !this.domainRolloutPolicyService) {
      throw new Error('Physical cleanup evaluation requires release guard and policy service.')
    }

    const policy = await this.domainRolloutPolicyService.getPolicyForDomain(args.l1Code)
    const policies = await this.domainRolloutPolicyService.listPolicies()
    const nonIt04Cutovers = policies
      .filter((candidate) => {
        if (candidate.l1Code === 'IT04') {
          return false
        }
        const cutoverAt = candidate.retirementEvidenceJson.lastCutoverAt
        if (typeof cutoverAt !== 'string') {
          return false
        }
        return !Number.isNaN(Date.parse(cutoverAt))
      })
      .sort((left, right) => {
        const leftTs = Date.parse(left.retirementEvidenceJson.lastCutoverAt as string)
        const rightTs = Date.parse(right.retirementEvidenceJson.lastCutoverAt as string)
        return leftTs - rightTs
      })
    const stableWindowDays = Number(
      policy.retirementThresholdsJson.stableWindowDays ?? policy.shadowWindowDays ?? 14,
    )

    return this.releaseGuard.evaluateCleanupReadiness({
      l1Code: args.l1Code,
      currentReleaseId: args.currentReleaseId,
      isFirstNonIt04PrimaryDomain: nonIt04Cutovers[0]?.l1Code === args.l1Code,
      retiredAt: policy.retirementEvidenceJson.lastLegacyOffAt,
      stableWindowDays,
      lastCutoverAt: policy.retirementEvidenceJson.lastCutoverAt,
      lastCutoverReleaseId: policy.retirementEvidenceJson.lastCutoverReleaseId,
    })
  }

  async executeRetirement(args: {
    l1Code: string
    releaseId: string
    updatedBy?: string | null
    dryRun?: boolean
  }): Promise<DomainRetirementReport> {
    if (!this.taxonomyDomainGateService || !this.domainRolloutPolicyService) {
      throw new Error('Retirement execution requires gate service and policy service.')
    }

    const readiness = await this.evaluateRetirementReadiness({
      l1Code: args.l1Code,
    })

    if (!readiness.allowed) {
      throw new Error(`Retirement blocked: ${readiness.blockingReasons.join('; ')}`)
    }

    if (args.dryRun) {
      const cleanupDecision: DomainPhysicalCleanupDecision = {
        allowed: false,
        blockingReasons: ['physical cleanup requires a completed legacy-off retirement first'],
      }

      return this.buildRetirementReport({
        l1Code: args.l1Code,
        readiness,
        cleanupDecision,
        smokeVerification: {
          passed: false,
          checkedAt: null,
        },
        reportPath: null,
      })
    }

    const policyBeforeRetirement = await this.domainRolloutPolicyService.getPolicyForDomain(
      args.l1Code,
    )

    if (!this.smokeVerifier) {
      throw new Error('Retirement execution requires smoke verifier to be configured.')
    }

    await this.taxonomyDomainGateService.transitionRolloutState({
      l1Code: args.l1Code,
      targetState: 'legacy-off',
      updatedBy: args.updatedBy ?? null,
      releaseId: args.releaseId,
    })
    try {
      await this.legacyPathManager?.disableDomainLegacyPath(args.l1Code, 'legacy-off')

      const smokeVerification = await this.smokeVerifier.verifyDomainSmoke(args.l1Code)

      if (!smokeVerification.passed) {
        throw new Error(
          smokeVerification.reason
            ? `retirement smoke verification failed: ${smokeVerification.reason}`
            : 'retirement smoke verification failed',
        )
      }

      const cleanupDecision = await this.evaluatePhysicalCleanup({
        l1Code: args.l1Code,
        currentReleaseId: args.releaseId,
      })
      const report = this.buildRetirementReport({
        l1Code: args.l1Code,
        readiness,
        cleanupDecision,
        smokeVerification,
        reportPath: null,
      })
      const reportPath = await this.writeRetirementReport(args.l1Code, report, args.releaseId)
      await this.persistRetirementEvidence(args.l1Code, {
        lastSmokeVerifiedAt: smokeVerification.checkedAt,
        lastRetirementReportPath: reportPath,
      })

      return {
        ...report,
        reportPath,
      }
    } catch (error) {
      await this.taxonomyDomainGateService.transitionRolloutState({
        l1Code: args.l1Code,
        targetState: policyBeforeRetirement.rolloutState,
        updatedBy: args.updatedBy ?? null,
      })
      await this.legacyPathManager?.restoreDomainLegacyPath(
        args.l1Code,
        policyBeforeRetirement.allowLegacyFallback,
        policyBeforeRetirement.rolloutState,
      )
      if (this.rolloutPolicyRepository) {
        const restoreResult = await this.rolloutPolicyRepository.update(
          { l1Code: args.l1Code, rolloutState: policyBeforeRetirement.rolloutState },
          {
            retirementEvidenceJson: policyBeforeRetirement.retirementEvidenceJson,
            ...(policyBeforeRetirement.stateChangedAt
              ? { stateChangedAt: policyBeforeRetirement.stateChangedAt }
              : {}),
          },
        )
        if (restoreResult.affected !== 1) {
          throw new Error(
            `Retirement compensation failed for domain ${args.l1Code}: rollout policy changed before evidence could be restored.`,
          )
        }
      }
      throw error
    }
  }

  async rollbackRetirement(args: {
    l1Code: string
    targetState?: 'domain-primary'
    updatedBy?: string | null
    restoreLegacyFallback?: boolean
  }): Promise<DomainRetirementRollbackResult> {
    if (!this.domainRolloutPolicyService || !this.rolloutPolicyRepository) {
      throw new Error('Rollback requires policy service and repository.')
    }

    const policyBeforeRollback = await this.domainRolloutPolicyService.getPolicyForDomain(
      args.l1Code,
    )

    if (policyBeforeRollback.rolloutState !== 'legacy-off') {
      throw new Error(
        'Rollback blocked: domain is not in legacy-off and no retirement evidence is available',
      )
    }

    const targetState = args.targetState ?? 'domain-primary'
    if (targetState !== 'domain-primary') {
      throw new Error('Rollback blocked: retirement rollback target must be domain-primary')
    }

    validateRolloutTransition(policyBeforeRollback.rolloutState, targetState)

    const rollbackPath = String(
      policyBeforeRollback.retirementThresholdsJson.rollbackPath ??
        'Enable kill switch and revert rollout state to domain-primary',
    )

    const restoreLegacyFallback = args.restoreLegacyFallback ?? true
    const lastRollbackVerifiedAt = new Date().toISOString()
    const retirementEvidenceJson = mergeRetirementEvidence(
      policyBeforeRollback.retirementEvidenceJson,
      { lastRollbackVerifiedAt },
    )

    const updateResult = await this.rolloutPolicyRepository.update(
      {
        l1Code: args.l1Code,
        rolloutState: 'legacy-off',
      },
      {
        rolloutState: targetState,
        allowLegacyFallback: restoreLegacyFallback,
        stateChangedAt: new Date(),
        retirementEvidenceJson,
        updatedBy: args.updatedBy ?? null,
      },
    )

    if (updateResult.affected !== 1) {
      throw new Error(
        `Rollback blocked: concurrency conflict for domain ${args.l1Code}; rollout state changed before rollback could be persisted.`,
      )
    }

    const updatedPolicy = await this.domainRolloutPolicyService.getPolicyForDomain(args.l1Code)

    if (restoreLegacyFallback && !updatedPolicy.allowLegacyFallback) {
      throw new Error(
        `Rollback blocked: domain ${args.l1Code} did not restore legacy fallback after rollback.`,
      )
    }

    return {
      l1Code: args.l1Code,
      previousState: policyBeforeRollback.rolloutState,
      targetState: updatedPolicy.rolloutState as 'domain-primary',
      legacyFallbackRestored: updatedPolicy.allowLegacyFallback,
      rollbackPath,
      reportPath: policyBeforeRollback.retirementEvidenceJson.lastRetirementReportPath,
      evidenceSummary: {
        lastRollbackVerifiedAt,
        lastRetirementReportPath:
          policyBeforeRollback.retirementEvidenceJson.lastRetirementReportPath,
      },
    }
  }

  async readRetirementReport(reportPath: string): Promise<DomainRetirementReportFile> {
    const resolvedReportPath = resolveRetirementReportPath(reportPath)
    const content = await fs.promises.readFile(resolvedReportPath, 'utf8')
    return {
      fileName: path.basename(resolvedReportPath),
      content,
    }
  }

  private mapPrerequisiteBlockingReasons(prerequisites: DomainRetirementPrerequisites): string[] {
    const reasons: string[] = []

    if (!prerequisites.cutoverTierPassed) {
      reasons.push('cutover tier has not passed')
    }
    if (!prerequisites.observationWindowPassed) {
      reasons.push('shadow/compare observation window has not been satisfied')
    }
    if (!prerequisites.killSwitchDrillPassed) {
      reasons.push('kill switch drill has not been verified')
    }
    if (!prerequisites.rollbackVerified) {
      reasons.push('rollback readiness has not been verified')
    }
    if (!prerequisites.reclassifyReady) {
      reasons.push('reclassify entrypoint is not ready')
    }
    if (!prerequisites.backfillReady) {
      reasons.push('backfill entrypoint is not ready')
    }

    return reasons
  }

  private buildRetirementReport(args: {
    l1Code: string
    readiness: DomainRetirementReadiness
    cleanupDecision: DomainPhysicalCleanupDecision
    smokeVerification: DomainSmokeVerification
    reportPath: string | null
  }): DomainRetirementReport {
    return {
      affectedDomains: [args.l1Code],
      gateResults: {
        legacyOff: args.readiness.allowed ? 'PASS' : 'FAIL',
        cleanup: args.cleanupDecision.allowed ? 'READY' : 'DEFERRED',
      },
      finalFallbackRate: args.readiness.metrics.fallbackRate,
      rollbackReadiness: {
        verified:
          args.readiness.prerequisites.rollbackVerified &&
          args.readiness.prerequisites.reclassifyReady &&
          args.readiness.prerequisites.backfillReady,
        path: args.readiness.rolloutGuidance.rollbackPath,
      },
      smokeVerification: args.smokeVerification,
      blockingReasons: [...args.readiness.blockingReasons, ...args.cleanupDecision.blockingReasons],
      reportPath: args.reportPath,
    }
  }

  private async writeRetirementReport(
    l1Code: string,
    report: DomainRetirementReport,
    releaseId: string,
  ): Promise<string> {
    const safeReleaseId = sanitizePathSegment(releaseId)
    const reportDir = resolveRetirementReportDirectory()
    await fs.promises.mkdir(reportDir, { recursive: true })

    const reportFileName = `retirement-${l1Code}-${safeReleaseId}-${formatTimestamp(new Date())}.json`
    const reportPath = path.join(reportDir, reportFileName)
    const publicReportPath = toPublicRetirementReportPath(reportFileName)

    await fs.promises.writeFile(
      reportPath,
      JSON.stringify(
        {
          ...report,
          reportPath: publicReportPath,
          releaseId,
        },
        null,
        2,
      ),
      'utf8',
    )

    return publicReportPath
  }

  private async persistRetirementEvidence(
    l1Code: string,
    patch: Partial<DomainRetirementEvidence>,
  ): Promise<void> {
    if (!this.domainRolloutPolicyService || !this.rolloutPolicyRepository) {
      return
    }

    const policy = await this.domainRolloutPolicyService.getPolicyForDomain(l1Code)

    const updateResult = await this.rolloutPolicyRepository.update(
      { l1Code, rolloutState: 'legacy-off' },
      {
        retirementEvidenceJson: mergeRetirementEvidence(policy.retirementEvidenceJson, patch),
      },
    )

    if (updateResult.affected !== 1) {
      throw new Error(
        `Retirement evidence update blocked for domain ${l1Code}: rollout state changed before evidence could be persisted.`,
      )
    }
  }
}
