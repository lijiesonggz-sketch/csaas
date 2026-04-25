import { Injectable, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import {
  KG_TAXONOMY_DOMAIN_ROLLOUT_STATES,
  KgTaxonomyDomainRolloutPolicy,
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

function resolveDefaultRolloutState(
  l1Code: string,
): KgTaxonomyDomainRolloutState {
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
  const domainCodes =
    options?.domainCodes ?? listRuntimeReadyTaxonomyDomainCodes()
  const classifierVersion =
    options?.activeClassifierVersion ?? TAXONOMY_CLASSIFIER_VERSION

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
    throw new Error(
      `Cannot skip rollout states from ${currentState} to ${targetState}`,
    )
  }
}

export function stateAllowsPrimaryPath(
  rolloutState: KgTaxonomyDomainRolloutState,
): boolean {
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
    rolloutState:
      policy.rolloutState ?? resolveDefaultRolloutState(policy.l1Code),
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
    activeClassifierVersion:
      policy.activeClassifierVersion ?? TAXONOMY_CLASSIFIER_VERSION,
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

function effectiveAllowLegacyFallback(
  policy: DomainRolloutPolicySnapshot,
): boolean {
  return policy.rolloutState !== 'legacy-off' && policy.allowLegacyFallback
}

@Injectable()
export class DomainRolloutPolicyService {
  constructor(
    @Optional()
    @InjectRepository(KgTaxonomyDomainRolloutPolicy)
    private readonly rolloutPolicyRepository?: Repository<KgTaxonomyDomainRolloutPolicy>,
  ) {}

  async listPolicies(): Promise<DomainRolloutPolicySnapshot[]> {
    if (!this.rolloutPolicyRepository) {
      throw new Error(
        'Domain rollout policy repository is required for control-plane reads.',
      )
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
      throw new Error(
        'Domain rollout policy repository is required for control-plane reads.',
      )
    }

    const entity = await this.rolloutPolicyRepository.findOne({
      where: { l1Code },
    })

    if (!entity) {
      throw new Error(`No rollout policy configured for domain ${l1Code}.`)
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
    const policy =
      args.policy ?? (await this.getPolicyForDomain(args.l1Code))
    const primaryExecutability =
      args.primaryExecutability ?? defaultPrimaryExecutability()
    const stateAllowsPrimary = stateAllowsPrimaryPath(policy.rolloutState)

    if (policy.killSwitchEnabled) {
      return {
        policy,
        rolloutState: policy.rolloutState,
        stateAllowsPrimary,
        pathDecision: effectiveAllowLegacyFallback(policy) ? 'LEGACY_FALLBACK' : 'ABSTAIN',
        failureSemantic: effectiveAllowLegacyFallback(policy)
          ? 'LEGACY_FALLBACK_TRIGGERED'
          : buildNonPrimaryFailureSemantic(args, primaryExecutability) ??
            'LEGACY_FALLBACK_TRIGGERED',
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
        failureSemantic:
          failureSemantic ?? 'LEGACY_FALLBACK_TRIGGERED',
        primaryExecutability,
        reason: stateAllowsPrimary
          ? 'fallback-authorized-by-policy'
          : 'state-prefers-legacy',
      }
    }

    return {
      policy,
      rolloutState: policy.rolloutState,
      stateAllowsPrimary,
      pathDecision:
        args.classifierResult.pathDecision === 'UNCLASSIFIED'
          ? 'UNCLASSIFIED'
          : 'ABSTAIN',
      failureSemantic,
      primaryExecutability,
      reason: stateAllowsPrimary
        ? 'fallback-disallowed-by-policy'
        : 'state-disallows-primary-and-fallback',
    }
  }

  private toSnapshot(
    policy: KgTaxonomyDomainRolloutPolicy,
  ): DomainRolloutPolicySnapshot {
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
