import { Injectable, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import {
  KG_TAXONOMY_DOMAIN_ROLLOUT_STATES,
  KgTaxonomyDomainRolloutPolicy,
  type KgTaxonomyDomainRetirementEvidence,
  type KgTaxonomyDomainRolloutState,
  type KgTaxonomyDomainRolloutThresholds,
} from '../../../../database/entities/kg-taxonomy-domain-rollout-policy.entity'
import type {
  TaxonomyClassificationResult,
  TaxonomyFailureSemantic,
  TaxonomyPathDecision,
} from './contracts/classification-result.contract'
import { listRuntimeReadyTaxonomyDomainCodes } from './profiles/domain-registry'
import { TAXONOMY_CLASSIFIER_VERSION } from './taxonomy-classifier.service'

export type DomainRolloutPolicyOwnership = {
  mappingOwner: string
  rulebookOwner: string
  benchmarkOwner: string
  gateApprover: string
  rollbackApprover: string
}

export type DomainRetirementEvidence = {
  lastCutoverAt: string | null
  lastCutoverReleaseId: string | null
  lastLegacyOffAt: string | null
  lastLegacyOffReleaseId: string | null
  lastKillSwitchDrillAt: string | null
  lastRollbackVerifiedAt: string | null
  lastReclassifyVerifiedAt: string | null
  lastBackfillVerifiedAt: string | null
  lastSmokeVerifiedAt: string | null
  lastRetirementReportPath: string | null
}

export type TaxonomyRolloutReadinessSummary = {
  stateAllowsPrimary: boolean
  stateAllowsLegacyFallback: boolean
  hasRetirementEvidence: boolean
}

export type DomainRolloutPolicySnapshot = {
  id: string | null
  l1Code: string
  rolloutState: KgTaxonomyDomainRolloutState
  allowLegacyFallback: boolean
  primaryThreshold: number
  shadowWindowDays: number
  cutoverThresholdsJson: KgTaxonomyDomainRolloutThresholds
  retirementThresholdsJson: KgTaxonomyDomainRolloutThresholds
  killSwitchEnabled: boolean
  activeClassifierVersion: string | null
  stateChangedAt: Date | null
  retirementEvidenceJson: DomainRetirementEvidence
  updatedAt: Date | null
  updatedBy: string | null
} & DomainRolloutPolicyOwnership

export type PrimaryExecutabilitySnapshot = {
  failureModeCount: number
  controlCandidateCount: number
  isExecutable: boolean
  reason:
    | 'READY'
    | 'NO_PRIMARY_CLASSIFICATION'
    | 'NO_FAILURE_MODE'
    | 'NO_CONTROL_CANDIDATE'
    | 'CHAIN_QUERY_FAILED'
}

export type ResolvePolicyDecisionArgs = {
  l1Code: string
  classifierResult: TaxonomyClassificationResult
  primaryExecutability?: PrimaryExecutabilitySnapshot | null
  policy?: DomainRolloutPolicySnapshot | null
}

export type ResolvePolicyDecisionResult = {
  policy: DomainRolloutPolicySnapshot
  rolloutState: KgTaxonomyDomainRolloutState
  stateAllowsPrimary: boolean
  pathDecision: TaxonomyPathDecision
  failureSemantic: TaxonomyFailureSemantic | null
  primaryExecutability: PrimaryExecutabilitySnapshot
  reason: string
}

export const DEFAULT_POLICY_OWNER = 'unassigned'

export const DEFAULT_CUTOVER_THRESHOLDS: KgTaxonomyDomainRolloutThresholds = {
  canaryPercentage: 10,
  errorBudget: 0.02,
  benchmarkGate: 'cutover',
  rollbackPath: 'Enable kill switch and revert rollout state to legacy-primary',
}

export const DEFAULT_RETIREMENT_THRESHOLDS: KgTaxonomyDomainRolloutThresholds = {
  fallbackRateMax: 0.05,
  unknownRateMax: 0.03,
  manualCorrectionRateMax: 0.1,
  rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
}

export const DEFAULT_RETIREMENT_EVIDENCE: DomainRetirementEvidence = {
  lastCutoverAt: null,
  lastCutoverReleaseId: null,
  lastLegacyOffAt: null,
  lastLegacyOffReleaseId: null,
  lastKillSwitchDrillAt: null,
  lastRollbackVerifiedAt: null,
  lastReclassifyVerifiedAt: null,
  lastBackfillVerifiedAt: null,
  lastSmokeVerifiedAt: null,
  lastRetirementReportPath: null,
}

const PRIMARY_ENABLED_STATES = new Set<KgTaxonomyDomainRolloutState>([
  'it04-on-new-interface',
  'domain-primary',
  'legacy-off',
])

const FALLBACK_ALLOWED_FAILURES = new Set<TaxonomyFailureSemantic>([
  'LOW_CONFIDENCE',
  'NO_MATCH',
  'MAPPING_MISSING',
  'ENGINE_ERROR',
  'LEGACY_FALLBACK_TRIGGERED',
  'PENDING_RECLASSIFY',
  'UNSUPPORTED_DOMAIN',
])

export function normalizePolicyOwnership(
  policy: Partial<DomainRolloutPolicyOwnership>,
): DomainRolloutPolicyOwnership {
  return {
    mappingOwner: policy.mappingOwner ?? DEFAULT_POLICY_OWNER,
    rulebookOwner: policy.rulebookOwner ?? DEFAULT_POLICY_OWNER,
    benchmarkOwner: policy.benchmarkOwner ?? DEFAULT_POLICY_OWNER,
    gateApprover: policy.gateApprover ?? DEFAULT_POLICY_OWNER,
    rollbackApprover: policy.rollbackApprover ?? DEFAULT_POLICY_OWNER,
  }
}

export function normalizeRetirementEvidence(
  evidence?: KgTaxonomyDomainRetirementEvidence | DomainRetirementEvidence | null,
): DomainRetirementEvidence {
  return {
    ...DEFAULT_RETIREMENT_EVIDENCE,
    ...(evidence ?? {}),
  }
}

export function mergeRetirementEvidence(
  current: KgTaxonomyDomainRetirementEvidence | DomainRetirementEvidence | null | undefined,
  patch: Partial<DomainRetirementEvidence>,
): DomainRetirementEvidence {
  return {
    ...normalizeRetirementEvidence(current),
    ...patch,
  }
}

function resolveDefaultRolloutState(l1Code: string): KgTaxonomyDomainRolloutState {
  if (l1Code === 'IT04') {
    return 'it04-on-new-interface'
  }
  if (l1Code === 'IT07') {
    return 'domain-compare'
  }
  return 'legacy-primary'
}

export function createBootstrapDomainRolloutPolicies(options?: {
  domainCodes?: string[]
  activeClassifierVersion?: string | null
}): DomainRolloutPolicySnapshot[] {
  const domainCodes = options?.domainCodes ?? listRuntimeReadyTaxonomyDomainCodes()
  const classifierVersion = options?.activeClassifierVersion ?? TAXONOMY_CLASSIFIER_VERSION

  return domainCodes.map((l1Code) => ({
    id: null,
    l1Code,
    rolloutState: resolveDefaultRolloutState(l1Code),
    allowLegacyFallback: true,
    primaryThreshold: l1Code === 'IT07' ? 0.78 : l1Code === 'IT04' ? 0.7 : 0.72,
    shadowWindowDays: 14,
    cutoverThresholdsJson: { ...DEFAULT_CUTOVER_THRESHOLDS },
    retirementThresholdsJson: { ...DEFAULT_RETIREMENT_THRESHOLDS },
    killSwitchEnabled: false,
    activeClassifierVersion: classifierVersion,
    stateChangedAt: null,
    retirementEvidenceJson: normalizeRetirementEvidence(),
    updatedAt: null,
    updatedBy: null,
    ...normalizePolicyOwnership({}),
  }))
}

export function validateRolloutTransition(
  currentState: KgTaxonomyDomainRolloutState,
  targetState: KgTaxonomyDomainRolloutState,
): void {
  const currentIndex = KG_TAXONOMY_DOMAIN_ROLLOUT_STATES.indexOf(currentState)
  const targetIndex = KG_TAXONOMY_DOMAIN_ROLLOUT_STATES.indexOf(targetState)

  if (currentIndex === -1 || targetIndex === -1) {
    throw new Error('Unknown rollout state')
  }

  if (currentIndex === targetIndex) {
    return
  }

  if (targetIndex < currentIndex) {
    return
  }

  if (targetIndex - currentIndex > 1) {
    throw new Error(`Cannot skip rollout states from ${currentState} to ${targetState}`)
  }
}

export function stateAllowsPrimaryPath(rolloutState: KgTaxonomyDomainRolloutState): boolean {
  return PRIMARY_ENABLED_STATES.has(rolloutState)
}

function normalizeThresholds(
  value: KgTaxonomyDomainRolloutThresholds | null | undefined,
  defaults: KgTaxonomyDomainRolloutThresholds,
): KgTaxonomyDomainRolloutThresholds {
  return {
    ...defaults,
    ...(value ?? {}),
  }
}

function normalizePolicySnapshot(
  policy: Partial<DomainRolloutPolicySnapshot> & {
    l1Code: string
  },
): DomainRolloutPolicySnapshot {
  return {
    id: policy.id ?? null,
    l1Code: policy.l1Code,
    rolloutState: policy.rolloutState ?? resolveDefaultRolloutState(policy.l1Code),
    allowLegacyFallback: policy.allowLegacyFallback ?? true,
    primaryThreshold: policy.primaryThreshold ?? 0.7,
    shadowWindowDays: policy.shadowWindowDays ?? 14,
    cutoverThresholdsJson: normalizeThresholds(
      policy.cutoverThresholdsJson,
      DEFAULT_CUTOVER_THRESHOLDS,
    ),
    retirementThresholdsJson: normalizeThresholds(
      policy.retirementThresholdsJson,
      DEFAULT_RETIREMENT_THRESHOLDS,
    ),
    killSwitchEnabled: policy.killSwitchEnabled ?? false,
    activeClassifierVersion: policy.activeClassifierVersion ?? TAXONOMY_CLASSIFIER_VERSION,
    stateChangedAt: policy.stateChangedAt ?? null,
    retirementEvidenceJson: normalizeRetirementEvidence(policy.retirementEvidenceJson),
    updatedAt: policy.updatedAt ?? null,
    updatedBy: policy.updatedBy ?? null,
    ...normalizePolicyOwnership(policy),
  }
}

function defaultPrimaryExecutability(): PrimaryExecutabilitySnapshot {
  return {
    failureModeCount: 0,
    controlCandidateCount: 0,
    isExecutable: false,
    reason: 'NO_PRIMARY_CLASSIFICATION',
  }
}

function buildNonPrimaryFailureSemantic(
  args: ResolvePolicyDecisionArgs,
  executability: PrimaryExecutabilitySnapshot,
): TaxonomyFailureSemantic | null {
  if (
    args.classifierResult.pathDecision === 'PRIMARY_CHAIN' &&
    args.classifierResult.l2Code &&
    !executability.isExecutable
  ) {
    switch (executability.reason) {
      case 'CHAIN_QUERY_FAILED':
        return 'ENGINE_ERROR'
      case 'NO_FAILURE_MODE':
      case 'NO_CONTROL_CANDIDATE':
        return 'MAPPING_MISSING'
      default:
        return 'MAPPING_MISSING'
    }
  }

  return args.classifierResult.failureSemantics ?? null
}

function effectiveAllowLegacyFallback(policy: DomainRolloutPolicySnapshot): boolean {
  return policy.rolloutState !== 'legacy-off' && policy.allowLegacyFallback
}

export function hasRetirementEvidence(
  evidence?: KgTaxonomyDomainRetirementEvidence | DomainRetirementEvidence | null,
): boolean {
  return Object.values(normalizeRetirementEvidence(evidence)).some((value) =>
    typeof value === 'string' ? value.trim().length > 0 : value !== null,
  )
}

@Injectable()
export class DomainRolloutPolicyService {
  constructor(
    @Optional()
    @InjectRepository(KgTaxonomyDomainRolloutPolicy)
    private readonly rolloutPolicyRepository?: Repository<KgTaxonomyDomainRolloutPolicy>,
  ) {}

  /** @deprecated Prefer findAll() for read-only UI/API flows with bootstrap fallback. */
  async listPolicies(): Promise<DomainRolloutPolicySnapshot[]> {
    if (!this.rolloutPolicyRepository) {
      throw new Error('Domain rollout policy repository is required for control-plane reads.')
    }

    const policies = await this.rolloutPolicyRepository.find({
      order: {
        l1Code: 'ASC',
      },
    })

    if (policies.length === 0) {
      throw new Error('No domain rollout policies found in the control plane.')
    }

    return policies.map((policy) => this.toSnapshot(policy))
  }

  async getPolicyForDomain(l1Code: string): Promise<DomainRolloutPolicySnapshot> {
    if (!this.rolloutPolicyRepository) {
      throw new Error('Domain rollout policy repository is required for control-plane reads.')
    }

    const entity = await this.rolloutPolicyRepository.findOne({
      where: { l1Code },
    })

    if (!entity) {
      throw new Error(`No rollout policy configured for domain ${l1Code}.`)
    }

    return this.toSnapshot(entity)
  }

  async getOrCreatePolicyForDomain(l1Code: string): Promise<DomainRolloutPolicySnapshot> {
    if (!this.rolloutPolicyRepository) {
      throw new Error('Domain rollout policy repository is required for control-plane reads.')
    }

    const existing = await this.rolloutPolicyRepository.findOne({
      where: { l1Code },
    })

    if (existing) {
      return this.toSnapshot(existing)
    }

    const bootstrapPolicy = this.findBootstrapPolicy(l1Code)
    if (!bootstrapPolicy) {
      throw new Error(`No rollout policy configured for domain ${l1Code}.`)
    }

    const created = this.rolloutPolicyRepository.create({
      l1Code: bootstrapPolicy.l1Code,
      rolloutState: bootstrapPolicy.rolloutState,
      allowLegacyFallback: bootstrapPolicy.allowLegacyFallback,
      primaryThreshold: bootstrapPolicy.primaryThreshold.toFixed(4),
      shadowWindowDays: bootstrapPolicy.shadowWindowDays,
      cutoverThresholdsJson: bootstrapPolicy.cutoverThresholdsJson,
      retirementThresholdsJson: bootstrapPolicy.retirementThresholdsJson,
      killSwitchEnabled: bootstrapPolicy.killSwitchEnabled,
      activeClassifierVersion: bootstrapPolicy.activeClassifierVersion,
      stateChangedAt: bootstrapPolicy.stateChangedAt ?? new Date(),
      retirementEvidenceJson: bootstrapPolicy.retirementEvidenceJson,
      mappingOwner: bootstrapPolicy.mappingOwner,
      rulebookOwner: bootstrapPolicy.rulebookOwner,
      benchmarkOwner: bootstrapPolicy.benchmarkOwner,
      gateApprover: bootstrapPolicy.gateApprover,
      rollbackApprover: bootstrapPolicy.rollbackApprover,
      updatedBy: bootstrapPolicy.updatedBy,
    })

    const saved = await this.rolloutPolicyRepository.save(created)
    return this.toSnapshot(saved)
  }

  async findAll(): Promise<DomainRolloutPolicySnapshot[]> {
    const bootstrapPolicies = createBootstrapDomainRolloutPolicies()
    if (!this.rolloutPolicyRepository) {
      return bootstrapPolicies
    }

    const policies = await this.rolloutPolicyRepository.find({
      order: { l1Code: 'ASC' },
    })

    if (policies.length === 0) {
      return bootstrapPolicies
    }

    return this.mergePoliciesWithBootstrap(
      policies.map((policy) => this.toSnapshot(policy)),
      bootstrapPolicies,
    )
  }

  async findByL1Code(l1Code: string): Promise<DomainRolloutPolicySnapshot | null> {
    if (!this.rolloutPolicyRepository) {
      return this.findBootstrapPolicy(l1Code)
    }

    const entity = await this.rolloutPolicyRepository.findOne({
      where: { l1Code },
    })

    if (!entity) {
      return this.findBootstrapPolicy(l1Code)
    }

    return this.toSnapshot(entity)
  }

  async shouldAllowLegacyFallback(l1Code: string | null): Promise<boolean> {
    if (!l1Code) {
      return true
    }

    const policy = await this.getPolicyForDomain(l1Code)
    return effectiveAllowLegacyFallback(policy)
  }

  async resolvePolicyDecision(
    args: ResolvePolicyDecisionArgs,
  ): Promise<ResolvePolicyDecisionResult> {
    const policy = args.policy ?? (await this.getPolicyForDomain(args.l1Code))
    const primaryExecutability = args.primaryExecutability ?? defaultPrimaryExecutability()
    const stateAllowsPrimary = stateAllowsPrimaryPath(policy.rolloutState)

    if (policy.killSwitchEnabled) {
      return {
        policy,
        rolloutState: policy.rolloutState,
        stateAllowsPrimary,
        pathDecision: effectiveAllowLegacyFallback(policy) ? 'LEGACY_FALLBACK' : 'ABSTAIN',
        failureSemantic: effectiveAllowLegacyFallback(policy)
          ? 'LEGACY_FALLBACK_TRIGGERED'
          : (buildNonPrimaryFailureSemantic(args, primaryExecutability) ??
            'LEGACY_FALLBACK_TRIGGERED'),
        primaryExecutability,
        reason: 'kill-switch-enabled',
      }
    }

    const isClassifierPrimaryCandidate =
      args.classifierResult.pathDecision === 'PRIMARY_CHAIN' &&
      args.classifierResult.l1Code === policy.l1Code &&
      args.classifierResult.l2Code !== null &&
      args.classifierResult.failureSemantics === null &&
      args.classifierResult.confidenceScore >= policy.primaryThreshold

    if (stateAllowsPrimary && isClassifierPrimaryCandidate && primaryExecutability.isExecutable) {
      return {
        policy,
        rolloutState: policy.rolloutState,
        stateAllowsPrimary,
        pathDecision: 'PRIMARY_CHAIN',
        failureSemantic: null,
        primaryExecutability,
        reason: 'primary-path-authorized',
      }
    }

    const failureSemantic =
      buildNonPrimaryFailureSemantic(args, primaryExecutability) ??
      (stateAllowsPrimary ? null : 'LEGACY_FALLBACK_TRIGGERED')

    if (
      effectiveAllowLegacyFallback(policy) &&
      (FALLBACK_ALLOWED_FAILURES.has(
        (failureSemantic ?? 'LEGACY_FALLBACK_TRIGGERED') as TaxonomyFailureSemantic,
      ) ||
        !stateAllowsPrimary)
    ) {
      return {
        policy,
        rolloutState: policy.rolloutState,
        stateAllowsPrimary,
        pathDecision: 'LEGACY_FALLBACK',
        failureSemantic: failureSemantic ?? 'LEGACY_FALLBACK_TRIGGERED',
        primaryExecutability,
        reason: stateAllowsPrimary ? 'fallback-authorized-by-policy' : 'state-prefers-legacy',
      }
    }

    return {
      policy,
      rolloutState: policy.rolloutState,
      stateAllowsPrimary,
      pathDecision:
        args.classifierResult.pathDecision === 'UNCLASSIFIED' ? 'UNCLASSIFIED' : 'ABSTAIN',
      failureSemantic,
      primaryExecutability,
      reason: stateAllowsPrimary
        ? 'fallback-disallowed-by-policy'
        : 'state-disallows-primary-and-fallback',
    }
  }

  getReadinessSummary(
    policy: Pick<
      DomainRolloutPolicySnapshot,
      'rolloutState' | 'allowLegacyFallback' | 'retirementEvidenceJson'
    >,
  ): TaxonomyRolloutReadinessSummary {
    const stateAllowsPrimary = stateAllowsPrimaryPath(policy.rolloutState)

    return {
      stateAllowsPrimary,
      stateAllowsLegacyFallback: policy.rolloutState !== 'legacy-off' && policy.allowLegacyFallback,
      hasRetirementEvidence: hasRetirementEvidence(policy.retirementEvidenceJson),
    }
  }

  private findBootstrapPolicy(l1Code: string): DomainRolloutPolicySnapshot | null {
    return createBootstrapDomainRolloutPolicies().find((p) => p.l1Code === l1Code) ?? null
  }

  private mergePoliciesWithBootstrap(
    policies: DomainRolloutPolicySnapshot[],
    bootstrapPolicies: DomainRolloutPolicySnapshot[],
  ): DomainRolloutPolicySnapshot[] {
    const policiesByCode = new Map(policies.map((policy) => [policy.l1Code, policy] as const))
    const bootstrapCodes = new Set(bootstrapPolicies.map((policy) => policy.l1Code))
    const extras = policies.filter((policy) => !bootstrapCodes.has(policy.l1Code))

    return [
      ...bootstrapPolicies.map(
        (bootstrapPolicy) => policiesByCode.get(bootstrapPolicy.l1Code) ?? bootstrapPolicy,
      ),
      ...extras.sort((left, right) => left.l1Code.localeCompare(right.l1Code)),
    ]
  }

  private toSnapshot(policy: KgTaxonomyDomainRolloutPolicy): DomainRolloutPolicySnapshot {
    return normalizePolicySnapshot({
      id: policy.id,
      l1Code: policy.l1Code,
      rolloutState: policy.rolloutState,
      allowLegacyFallback: policy.allowLegacyFallback,
      primaryThreshold: Number(policy.primaryThreshold),
      shadowWindowDays: policy.shadowWindowDays,
      cutoverThresholdsJson: policy.cutoverThresholdsJson ?? undefined,
      retirementThresholdsJson: policy.retirementThresholdsJson ?? undefined,
      killSwitchEnabled: policy.killSwitchEnabled,
      activeClassifierVersion: policy.activeClassifierVersion,
      stateChangedAt: policy.stateChangedAt,
      retirementEvidenceJson: normalizeRetirementEvidence(policy.retirementEvidenceJson),
      mappingOwner: policy.mappingOwner ?? undefined,
      rulebookOwner: policy.rulebookOwner ?? undefined,
      benchmarkOwner: policy.benchmarkOwner ?? undefined,
      gateApprover: policy.gateApprover ?? undefined,
      rollbackApprover: policy.rollbackApprover ?? undefined,
      updatedAt: policy.updatedAt,
      updatedBy: policy.updatedBy,
    })
  }
}
