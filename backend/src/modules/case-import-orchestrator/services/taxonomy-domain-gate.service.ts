import * as fs from 'fs'
import * as path from 'path'
import { Injectable, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, MoreThanOrEqual, Repository } from 'typeorm'
import { ComplianceCaseClassificationRun } from '../../../database/entities/compliance-case-classification-run.entity'
import { ComplianceCase } from '../../../database/entities/compliance-case.entity'
import type {
  KgTaxonomyDomainRolloutState,
  KgTaxonomyDomainRolloutThresholds,
} from '../../../database/entities/kg-taxonomy-domain-rollout-policy.entity'
import { KgTaxonomyDomainRolloutPolicy } from '../../../database/entities/kg-taxonomy-domain-rollout-policy.entity'
import {
  DEFAULT_CUTOVER_THRESHOLDS,
  DEFAULT_RETIREMENT_THRESHOLDS,
  DomainRolloutPolicyService,
  type DomainRolloutPolicySnapshot,
  mergeRetirementEvidence,
  validateRolloutTransition,
} from './taxonomy-classification/domain-rollout-policy.service'
import { resolveWorkspaceArtifactPath } from './taxonomy-benchmark.runner'

type BenchmarkGroupSummary = {
  gateStatus?: 'PASS' | 'FAIL'
  metrics?: {
    fullChainHitRate?: number
    fallbackTriggerRate?: number
    highRiskFalseNegativeRate?: number
    taxonomyPrecision?: number
    taxonomyRecall?: number
  }
}

export type TaxonomyBenchmarkGateResult = BenchmarkGroupSummary & {
  sourceTier: string | null
  sourceMode: string | null
}

type TaxonomyBenchmarkMachineSummary = {
  generatedAt?: string
  reportId?: string
  domains?: string[]
  mode?: string
  classifierVersion?: string | null
  gateStatus?: 'PASS' | 'FAIL'
  metrics?: BenchmarkGroupSummary['metrics']
  groups?: Record<string, Record<string, Record<string, BenchmarkGroupSummary>>>
}

type ReadLatestBenchmarkSummaryArgs = {
  l1Code: string
  activeClassifierVersion?: string | null
  minimumGeneratedAt?: Date | null
}

export type TaxonomyDomainRuntimeMetrics = {
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

export type TaxonomyDomainReadinessDecision = {
  l1Code: string
  currentState: KgTaxonomyDomainRolloutState
  targetState: KgTaxonomyDomainRolloutState
  allowed: boolean
  gateStatus: 'PASS' | 'FAIL'
  blockingReasons: string[]
  benchmarkGate: TaxonomyBenchmarkGateResult
  metrics: TaxonomyDomainRuntimeMetrics
  rolloutGuidance: {
    canaryPercentage: number
    errorBudget: number
    rollbackPath: string
  }
  recommendedNextAction: string
}

function toRate(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0
  }

  return Number((numerator / denominator).toFixed(4))
}

function parseBenchmarkGeneratedAt(summary: TaxonomyBenchmarkMachineSummary): Date | null {
  if (!summary.generatedAt) {
    return null
  }

  const generatedAt = new Date(summary.generatedAt)
  return Number.isNaN(generatedAt.getTime()) ? null : generatedAt
}

function readLatestBenchmarkSummary(
  args: ReadLatestBenchmarkSummaryArgs,
): TaxonomyBenchmarkMachineSummary | null {
  const reportDir = resolveWorkspaceArtifactPath('_bmad-output/test-artifacts').resolvedPath

  if (!fs.existsSync(reportDir)) {
    return null
  }

  const expectedClassifierVersion = args.activeClassifierVersion?.trim() ?? null
  const minimumGeneratedAtMs = args.minimumGeneratedAt?.getTime() ?? null
  const candidates = fs
    .readdirSync(reportDir)
    .filter((entry) => entry.endsWith('.json') && entry.includes('summary'))
    .map((entry) => path.join(reportDir, entry))
    .sort((left, right) => {
      return fs.statSync(right).mtime.getTime() - fs.statSync(left).mtime.getTime()
    })

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(
        fs.readFileSync(candidate, 'utf8'),
      ) as TaxonomyBenchmarkMachineSummary
      const generatedAt = parseBenchmarkGeneratedAt(parsed)

      if (
        parsed &&
        parsed.reportId === 'taxonomy-benchmark' &&
        parsed.mode === 'dual-path-compare' &&
        parsed.domains?.includes(args.l1Code) &&
        parsed.groups?.[args.l1Code] &&
        parsed.metrics &&
        generatedAt &&
        (minimumGeneratedAtMs === null || generatedAt.getTime() >= minimumGeneratedAtMs) &&
        (!expectedClassifierVersion || parsed.classifierVersion === expectedClassifierVersion)
      ) {
        return parsed
      }
    } catch {
      continue
    }
  }

  return null
}

function resolveBenchmarkSummaryCutoff(policy: DomainRolloutPolicySnapshot): Date {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - policy.shadowWindowDays)

  if (
    policy.updatedAt &&
    !Number.isNaN(policy.updatedAt.getTime()) &&
    policy.updatedAt.getTime() > cutoff.getTime()
  ) {
    return new Date(policy.updatedAt)
  }

  return cutoff
}

function normalizeThresholds(
  value: KgTaxonomyDomainRolloutThresholds,
  defaults: KgTaxonomyDomainRolloutThresholds,
): KgTaxonomyDomainRolloutThresholds {
  return {
    ...defaults,
    ...value,
  }
}

@Injectable()
export class TaxonomyDomainGateService {
  constructor(
    @Optional()
    private readonly domainRolloutPolicyService?: DomainRolloutPolicyService,
    @Optional()
    @InjectRepository(KgTaxonomyDomainRolloutPolicy)
    private readonly rolloutPolicyRepository?: Repository<KgTaxonomyDomainRolloutPolicy>,
    @Optional()
    @InjectRepository(ComplianceCaseClassificationRun)
    private readonly classificationRunRepository?: Repository<ComplianceCaseClassificationRun>,
    @Optional()
    @InjectRepository(ComplianceCase)
    private readonly complianceCaseRepository?: Repository<ComplianceCase>,
  ) {}

  async summarizeWindow(
    l1Code: string,
    observationWindowDays: number,
    windowStartOverride?: Date | null,
  ): Promise<TaxonomyDomainRuntimeMetrics> {
    if (!this.classificationRunRepository || !this.complianceCaseRepository) {
      return {
        totalRuns: 0,
        fallbackCount: 0,
        unknownCount: 0,
        manualCorrectionCount: 0,
        fallbackRate: 0,
        unknownRate: 0,
        manualCorrectionRate: 0,
        errorBudgetConsumed: 0,
        observationWindowDays,
      }
    }

    const computedWindowStart = new Date()
    computedWindowStart.setDate(computedWindowStart.getDate() - observationWindowDays)
    const windowStart =
      windowStartOverride &&
      !Number.isNaN(windowStartOverride.getTime()) &&
      windowStartOverride.getTime() > computedWindowStart.getTime()
        ? windowStartOverride
        : computedWindowStart

    const runs = await this.classificationRunRepository.find({
      where: {
        l1Code,
        createdAt: MoreThanOrEqual(windowStart),
      },
      order: {
        createdAt: 'DESC',
      },
    })

    const fallbackCount = runs.filter((run) => run.pathDecision === 'LEGACY_FALLBACK').length
    const unknownCount = runs.filter(
      (run) => run.pathDecision === 'ABSTAIN' || run.pathDecision === 'UNCLASSIFIED',
    ).length
    const caseIds = [...new Set(runs.map((run) => run.caseId))]
    const manualCorrectionCount =
      caseIds.length === 0
        ? 0
        : await this.complianceCaseRepository.count({
            where: {
              caseId: In(caseIds),
              humanReviewed: true,
              reviewedAt: MoreThanOrEqual(windowStart),
            },
          })

    const totalRuns = runs.length
    const fallbackRate = toRate(fallbackCount, totalRuns)
    const unknownRate = toRate(unknownCount, totalRuns)
    const manualCorrectionRate = toRate(manualCorrectionCount, totalRuns)

    return {
      totalRuns,
      fallbackCount,
      unknownCount,
      manualCorrectionCount,
      fallbackRate,
      unknownRate,
      manualCorrectionRate,
      errorBudgetConsumed: Number(
        Math.max(fallbackRate, unknownRate, manualCorrectionRate).toFixed(4),
      ),
      observationWindowDays,
    }
  }

  async evaluateDomainReadiness(args: {
    l1Code: string
    currentState?: KgTaxonomyDomainRolloutState
    targetState: KgTaxonomyDomainRolloutState
  }): Promise<TaxonomyDomainReadinessDecision> {
    const policy = await this.resolvePolicy(args.l1Code)
    const currentState = args.currentState ?? policy.rolloutState
    const targetState = args.targetState
    const cutoverThresholds = normalizeThresholds(
      policy.cutoverThresholdsJson,
      DEFAULT_CUTOVER_THRESHOLDS,
    )
    const retirementThresholds = normalizeThresholds(
      policy.retirementThresholdsJson,
      DEFAULT_RETIREMENT_THRESHOLDS,
    )
    const metrics = await this.summarizeWindow(
      args.l1Code,
      policy.shadowWindowDays,
      targetState === 'legacy-off' ? this.resolveRetirementObservationStart(policy) : null,
    )
    const summary = readLatestBenchmarkSummary({
      l1Code: args.l1Code,
      activeClassifierVersion: policy.activeClassifierVersion,
      minimumGeneratedAt: resolveBenchmarkSummaryCutoff(policy),
    })
    const benchmarkGate = this.resolveBenchmarkGate(summary, args.l1Code)
    const blockingReasons: string[] = []

    if (metrics.totalRuns === 0) {
      blockingReasons.push('observation window has no runtime evidence')
    }

    if (targetState === 'legacy-off' && !policy.retirementEvidenceJson?.lastCutoverAt) {
      blockingReasons.push(
        'retirement gate requires cutover evidence before evaluating post-cutover observation window',
      )
    }

    try {
      validateRolloutTransition(currentState, targetState)
    } catch (error) {
      blockingReasons.push(error instanceof Error ? error.message : String(error))
    }

    if (
      (targetState === 'domain-compare' || targetState === 'domain-primary') &&
      benchmarkGate.gateStatus !== 'PASS'
    ) {
      blockingReasons.push('benchmark gate is not PASS for target domain')
    }

    const configuredErrorBudget = Number(cutoverThresholds.errorBudget ?? 0)
    if (
      (targetState === 'domain-compare' || targetState === 'domain-primary') &&
      configuredErrorBudget > 0 &&
      metrics.errorBudgetConsumed > configuredErrorBudget
    ) {
      blockingReasons.push('runtime error budget exceeds cutover threshold')
    }

    if (targetState === 'legacy-off' && currentState !== 'domain-primary') {
      blockingReasons.push('domain must reach domain-primary before requesting legacy-off')
    }

    if (
      targetState === 'legacy-off' &&
      metrics.fallbackRate > Number(retirementThresholds.fallbackRateMax ?? 0.05)
    ) {
      blockingReasons.push('fallback rate exceeds retirement threshold')
    }

    if (
      targetState === 'legacy-off' &&
      metrics.unknownRate > Number(retirementThresholds.unknownRateMax ?? 0.03)
    ) {
      blockingReasons.push('unknown rate exceeds retirement threshold')
    }

    if (
      targetState === 'legacy-off' &&
      metrics.manualCorrectionRate > Number(retirementThresholds.manualCorrectionRateMax ?? 0.1)
    ) {
      blockingReasons.push('manual correction rate exceeds retirement threshold')
    }

    const allowed = blockingReasons.length === 0
    const rollbackPath = String(
      targetState === 'legacy-off'
        ? (retirementThresholds.rollbackPath ??
            'Enable kill switch and revert rollout state to domain-primary')
        : (cutoverThresholds.rollbackPath ?? 'Enable kill switch and revert rollout state'),
    )

    return {
      l1Code: args.l1Code,
      currentState,
      targetState,
      allowed,
      gateStatus: allowed ? 'PASS' : 'FAIL',
      blockingReasons,
      benchmarkGate,
      metrics,
      rolloutGuidance: {
        canaryPercentage: Number(cutoverThresholds.canaryPercentage ?? 0),
        errorBudget: Number(cutoverThresholds.errorBudget ?? 0),
        rollbackPath,
      },
      recommendedNextAction: this.buildRecommendedNextAction({
        l1Code: args.l1Code,
        targetState,
        allowed,
        rollbackPath,
      }),
    }
  }

  async transitionRolloutState(args: {
    l1Code: string
    targetState: KgTaxonomyDomainRolloutState
    updatedBy?: string | null
    releaseId?: string | null
  }): Promise<TaxonomyDomainReadinessDecision> {
    if (!this.domainRolloutPolicyService || !this.rolloutPolicyRepository) {
      throw new Error(
        'Rollout state transitions require both the domain rollout policy service and repository.',
      )
    }

    const currentPolicy = await this.domainRolloutPolicyService.getOrCreatePolicyForDomain(
      args.l1Code,
    )
    const decision = await this.evaluateDomainReadiness({
      l1Code: args.l1Code,
      currentState: currentPolicy.rolloutState,
      targetState: args.targetState,
    })

    if (!decision.allowed) {
      throw new Error(`Rollout transition blocked: ${decision.blockingReasons.join('; ')}`)
    }

    const stateChangedAt = new Date()
    const retirementEvidenceJson = mergeRetirementEvidence(
      currentPolicy.retirementEvidenceJson,
      args.targetState === 'domain-primary'
        ? {
            lastCutoverAt: stateChangedAt.toISOString(),
            lastCutoverReleaseId: args.releaseId ?? null,
          }
        : args.targetState === 'legacy-off'
          ? {
              lastLegacyOffAt: stateChangedAt.toISOString(),
              lastLegacyOffReleaseId: args.releaseId ?? null,
            }
          : {},
    )

    const updateResult = await this.rolloutPolicyRepository.update(
      {
        l1Code: args.l1Code,
        rolloutState: currentPolicy.rolloutState,
      },
      {
        rolloutState: args.targetState,
        stateChangedAt,
        retirementEvidenceJson,
        updatedBy: args.updatedBy ?? null,
      },
    )

    if (updateResult.affected !== 1) {
      throw new Error(
        `Rollout transition concurrency conflict for domain ${args.l1Code}: state changed before transition could be persisted.`,
      )
    }

    return decision
  }

  private async resolvePolicy(l1Code: string): Promise<DomainRolloutPolicySnapshot> {
    if (!this.domainRolloutPolicyService) {
      throw new Error(`No domain rollout policy service is available for ${l1Code}.`)
    }

    return this.domainRolloutPolicyService.getOrCreatePolicyForDomain(l1Code)
  }

  private resolveBenchmarkGate(
    summary: TaxonomyBenchmarkMachineSummary | null,
    l1Code: string,
  ): TaxonomyBenchmarkGateResult {
    if (!summary) {
      return { gateStatus: 'FAIL', sourceTier: null, sourceMode: null }
    }

    const domainGroups = summary.groups?.[l1Code]
    if (!domainGroups) {
      return { gateStatus: 'FAIL', sourceTier: null, sourceMode: null }
    }

    const preferredGroups: Array<[string, string]> = [
      ['tier-2-holdout', 'dual-path-compare'],
      ['tier-1-cutover', 'dual-path-compare'],
      ['tier-1-cutover', 'new-path'],
    ]

    for (const [tier, mode] of preferredGroups) {
      const group = domainGroups[tier]?.[mode]
      if (group) {
        return {
          ...group,
          sourceTier: tier,
          sourceMode: mode,
        }
      }
    }

    return {
      gateStatus: summary.gateStatus ?? 'FAIL',
      metrics: summary.metrics,
      sourceTier: null,
      sourceMode: summary.mode ?? null,
    }
  }

  private buildRecommendedNextAction(args: {
    l1Code: string
    targetState: KgTaxonomyDomainRolloutState
    allowed: boolean
    rollbackPath: string
  }): string {
    if (args.allowed) {
      return `Promote ${args.l1Code} to ${args.targetState} and keep monitoring rollback path ${args.rollbackPath}.`
    }

    return `Resolve blocking reasons before promoting ${args.l1Code} to ${args.targetState}.`
  }

  private resolveRetirementObservationStart(policy: DomainRolloutPolicySnapshot): Date | null {
    const lastCutoverAt = policy.retirementEvidenceJson?.lastCutoverAt
    if (!lastCutoverAt) {
      return null
    }

    const parsed = new Date(lastCutoverAt)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
}
