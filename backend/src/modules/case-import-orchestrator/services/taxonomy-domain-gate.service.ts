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

type TaxonomyBenchmarkMachineSummary = {
  generatedAt?: string
  reportId?: string
  domains?: string[]
  mode?: string
  classifierVersion?: string | null
  gateStatus?: 'PASS' | 'FAIL'
  metrics?: BenchmarkGroupSummary['metrics']
  groups?: Record<
    string,
    Record<string, Record<string, BenchmarkGroupSummary>>
  >
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
  currentState: KgTaxonomyDomainRolloutState
  targetState: KgTaxonomyDomainRolloutState
  allowed: boolean
  gateStatus: 'PASS' | 'FAIL'
  blockingReasons: string[]
  metrics: TaxonomyDomainRuntimeMetrics
  rolloutGuidance: {
    canaryPercentage: number
    errorBudget: number
    rollbackPath: string
  }
}

function toRate(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0
  }

  return Number((numerator / denominator).toFixed(4))
}

function parseBenchmarkGeneratedAt(
  summary: TaxonomyBenchmarkMachineSummary,
): Date | null {
  if (!summary.generatedAt) {
    return null
  }

  const generatedAt = new Date(summary.generatedAt)
  return Number.isNaN(generatedAt.getTime()) ? null : generatedAt
}

function readLatestBenchmarkSummary(
  args: ReadLatestBenchmarkSummaryArgs,
): TaxonomyBenchmarkMachineSummary | null {
  const reportDir = resolveWorkspaceArtifactPath(
    '_bmad-output/test-artifacts',
  ).resolvedPath

  if (!fs.existsSync(reportDir)) {
    return null
  }

  const expectedClassifierVersion =
    args.activeClassifierVersion?.trim() ?? null
  const minimumGeneratedAtMs = args.minimumGeneratedAt?.getTime() ?? null
  const candidates = fs
    .readdirSync(reportDir)
    .filter((entry) => entry.endsWith('.json') && entry.includes('summary'))
    .map((entry) => path.join(reportDir, entry))
    .sort((left, right) => {
      return (
        fs.statSync(right).mtime.getTime() - fs.statSync(left).mtime.getTime()
      )
    })

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8')) as TaxonomyBenchmarkMachineSummary
      const generatedAt = parseBenchmarkGeneratedAt(parsed)

      if (
        parsed &&
        parsed.reportId === 'taxonomy-benchmark' &&
        parsed.mode === 'dual-path-compare' &&
        parsed.domains?.includes(args.l1Code) &&
        parsed.groups?.[args.l1Code] &&
        parsed.metrics &&
        generatedAt &&
        (minimumGeneratedAtMs === null ||
          generatedAt.getTime() >= minimumGeneratedAtMs) &&
        (!expectedClassifierVersion ||
          parsed.classifierVersion === expectedClassifierVersion)
      ) {
        return parsed
      }
    } catch {
      continue
    }
  }

  return null
}

function resolveBenchmarkSummaryCutoff(
  policy: DomainRolloutPolicySnapshot,
): Date {
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

    const windowStart = new Date()
    windowStart.setDate(windowStart.getDate() - observationWindowDays)

    const runs = await this.classificationRunRepository.find({
      where: {
        l1Code,
        createdAt: MoreThanOrEqual(windowStart),
      },
      order: {
        createdAt: 'DESC',
      },
    })

    const fallbackCount = runs.filter(
      (run) => run.pathDecision === 'LEGACY_FALLBACK',
    ).length
    const unknownCount = runs.filter(
      (run) =>
        run.pathDecision === 'ABSTAIN' || run.pathDecision === 'UNCLASSIFIED',
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

    try {
      validateRolloutTransition(currentState, targetState)
    } catch (error) {
      blockingReasons.push(
        error instanceof Error ? error.message : String(error),
      )
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
      blockingReasons.push(
        'domain must reach domain-primary before requesting legacy-off',
      )
    }

    if (
      targetState === 'legacy-off' &&
      metrics.fallbackRate >
        Number(retirementThresholds.fallbackRateMax ?? 0.05)
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
      metrics.manualCorrectionRate >
        Number(retirementThresholds.manualCorrectionRateMax ?? 0.1)
    ) {
      blockingReasons.push(
        'manual correction rate exceeds retirement threshold',
      )
    }

    const allowed = blockingReasons.length === 0

    return {
      currentState,
      targetState,
      allowed,
      gateStatus: allowed ? 'PASS' : 'FAIL',
      blockingReasons,
      metrics,
      rolloutGuidance: {
        canaryPercentage: Number(cutoverThresholds.canaryPercentage ?? 0),
        errorBudget: Number(cutoverThresholds.errorBudget ?? 0),
        rollbackPath: String(
          cutoverThresholds.rollbackPath ??
            'Enable kill switch and revert rollout state',
        ),
      },
    }
  }

  async transitionRolloutState(args: {
    l1Code: string
    targetState: KgTaxonomyDomainRolloutState
    updatedBy?: string | null
  }): Promise<TaxonomyDomainReadinessDecision> {
    if (!this.domainRolloutPolicyService || !this.rolloutPolicyRepository) {
      throw new Error(
        'Rollout state transitions require both the domain rollout policy service and repository.',
      )
    }

    const currentPolicy = await this.domainRolloutPolicyService.getPolicyForDomain(
      args.l1Code,
    )
    const decision = await this.evaluateDomainReadiness({
      l1Code: args.l1Code,
      currentState: currentPolicy.rolloutState,
      targetState: args.targetState,
    })

    if (!decision.allowed) {
      throw new Error(
        `Rollout transition blocked: ${decision.blockingReasons.join('; ')}`,
      )
    }

    await this.rolloutPolicyRepository.update(
      { l1Code: args.l1Code },
      {
        rolloutState: args.targetState,
        updatedBy: args.updatedBy ?? null,
      },
    )

    return decision
  }

  private async resolvePolicy(
    l1Code: string,
  ): Promise<DomainRolloutPolicySnapshot> {
    if (!this.domainRolloutPolicyService) {
      throw new Error(
        `No domain rollout policy service is available for ${l1Code}.`,
      )
    }

    return this.domainRolloutPolicyService.getPolicyForDomain(l1Code)
  }

  private resolveBenchmarkGate(
    summary: TaxonomyBenchmarkMachineSummary | null,
    l1Code: string,
  ): BenchmarkGroupSummary {
    if (!summary) {
      return { gateStatus: 'FAIL' }
    }

    const domainGroups = summary.groups?.[l1Code]
    if (!domainGroups) {
      return { gateStatus: 'FAIL' }
    }

    return (
      domainGroups['tier-2-holdout']?.['dual-path-compare'] ??
      domainGroups['tier-1-cutover']?.['dual-path-compare'] ??
      domainGroups['tier-1-cutover']?.['new-path'] ??
      {
        gateStatus: summary.gateStatus ?? 'FAIL',
        metrics: summary.metrics,
      }
    )
  }
}
