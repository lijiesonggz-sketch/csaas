import { apiFetch } from '../utils/api'

export type TaxonomyRolloutState =
  | 'legacy-primary'
  | 'it04-on-new-interface'
  | 'domain-shadow'
  | 'domain-compare'
  | 'domain-primary'
  | 'legacy-off'

export type TaxonomyRolloutMutableTargetState =
  | 'domain-shadow'
  | 'domain-compare'
  | 'domain-primary'

export type TaxonomyRolloutRetirementRollbackTargetState = 'domain-primary'

export interface TaxonomyRolloutPolicyListItem {
  id: string | null
  l1Code: string
  rolloutState: TaxonomyRolloutState
  allowLegacyFallback: boolean
  killSwitchEnabled: boolean
  activeClassifierVersion: string | null
  primaryThreshold: number
  shadowWindowDays: number
  stateChangedAt: string | null
  stateAllowsPrimary: boolean
  stateAllowsLegacyFallback: boolean
  hasRetirementEvidence: boolean
}

export interface TaxonomyRolloutPolicyDetail extends TaxonomyRolloutPolicyListItem {
  mappingOwner: string
  rulebookOwner: string
  benchmarkOwner: string
  gateApprover: string
  rollbackApprover: string
  cutoverThresholdsJson: Record<string, unknown>
  retirementThresholdsJson: Record<string, unknown>
  retirementEvidenceJson: {
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
  updatedAt: string | null
}

export interface TaxonomyRolloutPolicySummary {
  l1Code: string
  rolloutState: TaxonomyRolloutState
  allowLegacyFallback: boolean
  killSwitchEnabled: boolean
  activeClassifierVersion: string | null
  primaryThreshold: number
  shadowWindowDays: number
  stateChangedAt: string | null
}

export interface TaxonomyRolloutBenchmarkGate {
  gateStatus: 'PASS' | 'FAIL'
  metrics?: {
    fullChainHitRate?: number
    fallbackTriggerRate?: number
    highRiskFalseNegativeRate?: number
    taxonomyPrecision?: number
    taxonomyRecall?: number
  }
  sourceTier?: string | null
  sourceMode?: string | null
}

export interface TaxonomyRolloutRuntimeMetrics {
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

export interface TaxonomyRolloutGateGuidance {
  canaryPercentage: number
  errorBudget: number
  rollbackPath: string
}

export interface TaxonomyRolloutGateDecision {
  l1Code: string
  currentState: TaxonomyRolloutState
  targetState: TaxonomyRolloutMutableTargetState
  allowed: boolean
  gateStatus: 'PASS' | 'FAIL'
  blockingReasons: string[]
  benchmarkGate: TaxonomyRolloutBenchmarkGate
  metrics: TaxonomyRolloutRuntimeMetrics
  rolloutGuidance: TaxonomyRolloutGateGuidance
  recommendedNextAction: string
  policySummary: TaxonomyRolloutPolicySummary
}

export interface EvaluateTaxonomyRolloutGateRequest {
  l1Code: string
  targetState: TaxonomyRolloutMutableTargetState
}

export interface TaxonomyRolloutTransitionResult {
  l1Code: string
  previousState: TaxonomyRolloutState
  targetState: TaxonomyRolloutMutableTargetState
  stateChangedAt: string | null
  operator: string | null
  auditSummary: {
    updatedBy: string | null
    releaseId?: string | null
    rollbackPath: string
  }
  policySummary: TaxonomyRolloutPolicySummary
}

export interface TransitionTaxonomyRolloutStateRequest extends EvaluateTaxonomyRolloutGateRequest {
  releaseId?: string | null
}

export interface TaxonomyRolloutRetirementPrerequisites {
  cutoverTierPassed: boolean
  observationWindowPassed: boolean
  killSwitchDrillPassed: boolean
  rollbackVerified: boolean
  reclassifyReady: boolean
  backfillReady: boolean
}

export interface TaxonomyRolloutPhysicalCleanupDecision {
  allowed: boolean
  blockingReasons: string[]
}

export interface TaxonomyRolloutRetirementLatestExecution {
  lastLegacyOffAt?: string | null
  lastLegacyOffReleaseId?: string | null
  lastSmokeVerifiedAt?: string | null
  lastRollbackVerifiedAt?: string | null
  lastRetirementReportPath?: string | null
}

export interface TaxonomyRolloutRetirementReadiness {
  l1Code: string
  currentState: TaxonomyRolloutState
  targetState: 'legacy-off'
  allowed: boolean
  gateStatus: 'PASS' | 'FAIL'
  prerequisites: TaxonomyRolloutRetirementPrerequisites
  blockingReasons: string[]
  metrics: TaxonomyRolloutRuntimeMetrics
  rolloutGuidance: TaxonomyRolloutGateGuidance
  recommendedNextAction: string
  cleanupReadiness: TaxonomyRolloutPhysicalCleanupDecision
  latestExecution: TaxonomyRolloutRetirementLatestExecution
  policySummary: TaxonomyRolloutPolicySummary
}

export interface EvaluateTaxonomyRolloutRetirementRequest {
  l1Code: string
}

export interface ExecuteTaxonomyRolloutRetirementRequest {
  l1Code: string
  releaseId: string
  confirmationText: string
}

export interface TaxonomyRolloutRetirementExecutionResult {
  l1Code: string
  previousState: TaxonomyRolloutState
  targetState: 'legacy-off'
  stateChangedAt: string | null
  operator: string | null
  smokeVerification: {
    passed: boolean
    checkedAt: string | null
    reason?: string
  }
  reportPath: string | null
  finalFallbackRate: number
  cleanupReadiness: TaxonomyRolloutPhysicalCleanupDecision
  rollbackReadiness: {
    verified: boolean
    path: string
  }
  auditSummary: {
    updatedBy: string | null
    releaseId: string
    rollbackPath: string
  }
  policySummary: TaxonomyRolloutPolicySummary
}

export interface RollbackTaxonomyRolloutRetirementRequest {
  l1Code: string
  targetState?: TaxonomyRolloutRetirementRollbackTargetState
  confirmationText: string
  restoreLegacyFallback?: boolean
}

export interface TaxonomyRolloutRetirementRollbackResult {
  l1Code: string
  previousState: TaxonomyRolloutState
  targetState: TaxonomyRolloutRetirementRollbackTargetState
  stateChangedAt: string | null
  operator: string | null
  legacyFallbackRestored: boolean
  rollbackPath: string
  reportPath: string | null
  evidenceSummary: {
    lastRollbackVerifiedAt: string | null
    lastRetirementReportPath: string | null
  }
  auditSummary: {
    updatedBy: string | null
    rollbackPath: string
  }
  policySummary: TaxonomyRolloutPolicySummary
}

export async function fetchRolloutPolicies(): Promise<TaxonomyRolloutPolicyListItem[]> {
  return apiFetch<TaxonomyRolloutPolicyListItem[]>(
    '/api/admin/knowledge-graph/taxonomy-rollout/policies'
  )
}

export async function fetchRolloutPolicyByL1Code(
  l1Code: string
): Promise<TaxonomyRolloutPolicyDetail> {
  return apiFetch<TaxonomyRolloutPolicyDetail>(
    `/api/admin/knowledge-graph/taxonomy-rollout/policies/${l1Code}`
  )
}

export async function evaluateRolloutGate(
  payload: EvaluateTaxonomyRolloutGateRequest
): Promise<TaxonomyRolloutGateDecision> {
  return apiFetch<TaxonomyRolloutGateDecision>(
    '/api/admin/knowledge-graph/taxonomy-rollout/gates/evaluate',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )
}

export async function transitionRolloutState(
  payload: TransitionTaxonomyRolloutStateRequest
): Promise<TaxonomyRolloutTransitionResult> {
  return apiFetch<TaxonomyRolloutTransitionResult>(
    '/api/admin/knowledge-graph/taxonomy-rollout/transitions',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )
}

export async function evaluateRetirementDryRun(
  payload: EvaluateTaxonomyRolloutRetirementRequest
): Promise<TaxonomyRolloutRetirementReadiness> {
  return apiFetch<TaxonomyRolloutRetirementReadiness>(
    '/api/admin/knowledge-graph/taxonomy-rollout/retirement/dry-run',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )
}

export async function executeTaxonomyRetirement(
  payload: ExecuteTaxonomyRolloutRetirementRequest
): Promise<TaxonomyRolloutRetirementExecutionResult> {
  return apiFetch<TaxonomyRolloutRetirementExecutionResult>(
    '/api/admin/knowledge-graph/taxonomy-rollout/retirement/execute',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )
}

export async function rollbackTaxonomyRetirement(
  payload: RollbackTaxonomyRolloutRetirementRequest
): Promise<TaxonomyRolloutRetirementRollbackResult> {
  return apiFetch<TaxonomyRolloutRetirementRollbackResult>(
    '/api/admin/knowledge-graph/taxonomy-rollout/retirement/rollback',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )
}

export function buildTaxonomyRetirementReportUrl(
  reportPath: string | null | undefined
): string | null {
  const normalizedReportPath = reportPath?.trim()
  if (!normalizedReportPath) return null

  const normalizedSlashes = normalizedReportPath.replace(/\\/g, '/')
  if (
    !/^\/?reports\/taxonomy-retirement\/[^/]+\.json$/i.test(normalizedSlashes) &&
    !/^taxonomy-retirement\/[^/]+\.json$/i.test(normalizedSlashes)
  ) {
    return null
  }

  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '')
  return `${baseUrl}/api/admin/knowledge-graph/taxonomy-rollout/retirement/report?path=${encodeURIComponent(normalizedReportPath)}`
}
