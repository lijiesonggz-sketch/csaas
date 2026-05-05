import { apiFetch, clearTokenCache, getAuthToken } from '../utils/api'

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

export type TaxonomyRolloutRecoveryOperation = 'reclassify' | 'backfill'

export interface ReclassifyTaxonomyCasesRequest {
  l1Code: string
  batchId?: string | null
  caseIds?: string[]
  classifierVersion?: string | null
  shadowOnly?: boolean
  dryRun: boolean
  confirmationText?: string | null
}

export interface BackfillTaxonomyCasesRequest {
  l1Code: string
  batchId?: string | null
  caseIds?: string[]
  classifierVersion?: string | null
  shadowOnly?: boolean
  dryRun: boolean
  confirmationText?: string | null
}

export interface TaxonomyRolloutRecoveryResult {
  operation: TaxonomyRolloutRecoveryOperation
  l1Code: string
  dryRun: boolean
  shadowOnly?: boolean
  processedCount: number
  affectedDomains: string[]
  latestPointerUpdated: boolean
  classifierVersion: string | null
  summary?: string | null
  reportPath?: string | null
  auditId?: string | null
  scope?: {
    batchId?: string | null
    caseIds?: string[] | null
    l1Code?: string | null
    shadowOnly?: boolean | null
  }
  backfillSummary?: {
    requestedCount?: number
    resetCount?: number
    skippedReviewedCount?: number
    rollbackCompatible?: boolean
    [key: string]: unknown
  }
  auditSummary?: {
    updatedBy?: string | null
    outcome?: string | null
    auditId?: string | null
    [key: string]: unknown
  }
}

export type TaxonomyRolloutReportType =
  | 'retirement'
  | 'rollback'
  | 'reclassify'
  | 'backfill'
  | 'smoke'
  | 'evidence'
  | string

export interface TaxonomyRolloutReportHistoryItem {
  id: string
  l1Code: string
  type: TaxonomyRolloutReportType
  status?: string | null
  outcome?: string | null
  createdAt?: string | null
  occurredAt?: string | null
  summary?: string | null
  reportPath?: string | null
  evidenceLink?: string | null
  auditId?: string | null
}

export interface FetchTaxonomyRolloutReportsRequest {
  l1Code?: string | null
  page: number
  limit: number
  dateFrom?: string | null
  dateTo?: string | null
}

export interface TaxonomyRolloutReportHistoryResponse {
  items: TaxonomyRolloutReportHistoryItem[]
  page: number
  limit: number
  total: number
  hasNextPage?: boolean
}

export interface TaxonomyRolloutApiError extends Error {
  status?: number
  code?: string
  auditId?: string
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

function extractTaxonomyRolloutError(body: unknown): {
  message: string
  code?: string
  auditId?: string
} {
  if (!body || typeof body !== 'object') return { message: 'API request failed' }

  const record = body as Record<string, unknown>
  const nestedError =
    record.error && typeof record.error === 'object'
      ? (record.error as Record<string, unknown>)
      : null
  const rawMessage = record.message ?? nestedError?.message
  const message = Array.isArray(rawMessage)
    ? rawMessage.join(' ')
    : typeof rawMessage === 'string' && rawMessage.trim()
      ? rawMessage
      : 'API request failed'
  const code =
    typeof record.code === 'string'
      ? record.code
      : typeof nestedError?.code === 'string'
        ? nestedError.code
        : undefined
  const auditId =
    typeof record.auditId === 'string'
      ? record.auditId
      : typeof nestedError?.auditId === 'string'
        ? nestedError.auditId
        : undefined

  return { message, code, auditId }
}

async function taxonomyRolloutRecoveryFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '')
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`
  const token = await getAuthToken()
  const headers = new Headers(options.headers)
  const isFormDataRequest = typeof FormData !== 'undefined' && options.body instanceof FormData

  if (!headers.has('Content-Type') && !isFormDataRequest) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response = await fetch(url, {
    ...options,
    headers,
  })

  if (response.status === 401 && token) {
    clearTokenCache()
    const refreshedToken = await getAuthToken(true)

    if (refreshedToken && refreshedToken !== token) {
      headers.set('Authorization', `Bearer ${refreshedToken}`)
      response = await fetch(url, {
        ...options,
        headers,
      })
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'API request failed' }))
    const details = extractTaxonomyRolloutError(body)
    const error = new Error(details.message) as TaxonomyRolloutApiError
    error.status = response.status
    error.code = details.code
    error.auditId = details.auditId
    throw error
  }

  if (response.status === 204) return null as T

  const result = await response.json()
  if (result?.success !== undefined && result?.data !== undefined) {
    return result.data as T
  }

  return result as T
}

export async function reclassifyTaxonomyCases(
  payload: ReclassifyTaxonomyCasesRequest
): Promise<TaxonomyRolloutRecoveryResult> {
  return taxonomyRolloutRecoveryFetch<TaxonomyRolloutRecoveryResult>(
    '/api/admin/knowledge-graph/taxonomy-rollout/reclassify',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )
}

export async function backfillTaxonomyCases(
  payload: BackfillTaxonomyCasesRequest
): Promise<TaxonomyRolloutRecoveryResult> {
  return taxonomyRolloutRecoveryFetch<TaxonomyRolloutRecoveryResult>(
    '/api/admin/knowledge-graph/taxonomy-rollout/backfill',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )
}

export async function fetchTaxonomyRolloutReports(
  query: FetchTaxonomyRolloutReportsRequest
): Promise<TaxonomyRolloutReportHistoryResponse> {
  const params = new URLSearchParams()
  params.set('page', String(query.page))
  params.set('limit', String(query.limit))

  const l1Code = query.l1Code?.trim().toUpperCase()
  if (l1Code) params.set('l1Code', l1Code)
  if (query.dateFrom?.trim()) params.set('dateFrom', query.dateFrom.trim())
  if (query.dateTo?.trim()) params.set('dateTo', query.dateTo.trim())

  return taxonomyRolloutRecoveryFetch<TaxonomyRolloutReportHistoryResponse>(
    `/api/admin/knowledge-graph/taxonomy-rollout/reports?${params.toString()}`
  )
}

function isAllowedTaxonomyRetirementReportPath(normalizedSlashes: string): boolean {
  return (
    /^\/?reports\/taxonomy-retirement\/[^/]+\.json$/i.test(normalizedSlashes) ||
    /^taxonomy-retirement\/[^/]+\.json$/i.test(normalizedSlashes)
  )
}

function isAllowedTaxonomyRecoveryReportPath(normalizedSlashes: string): boolean {
  return (
    /^\/?reports\/taxonomy-recovery\/(?:reclassify|backfill)\/[^/]+\.json$/i.test(
      normalizedSlashes
    ) || /^taxonomy-recovery\/(?:reclassify|backfill)\/[^/]+\.json$/i.test(normalizedSlashes)
  )
}

export function buildTaxonomyRolloutReportUrl(
  reportPath: string | null | undefined
): string | null {
  const normalizedReportPath = reportPath?.trim()
  if (!normalizedReportPath) return null

  const normalizedSlashes = normalizedReportPath.replace(/\\/g, '/')
  if (
    !isAllowedTaxonomyRetirementReportPath(normalizedSlashes) &&
    !isAllowedTaxonomyRecoveryReportPath(normalizedSlashes)
  ) {
    return null
  }

  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '')
  return `${baseUrl}/api/admin/knowledge-graph/taxonomy-rollout/retirement/report?path=${encodeURIComponent(normalizedReportPath)}`
}

export function buildTaxonomyRetirementReportUrl(
  reportPath: string | null | undefined
): string | null {
  const normalizedReportPath = reportPath?.trim()
  if (!normalizedReportPath) return null

  const normalizedSlashes = normalizedReportPath.replace(/\\/g, '/')
  if (!isAllowedTaxonomyRetirementReportPath(normalizedSlashes)) {
    return null
  }

  return buildTaxonomyRolloutReportUrl(normalizedReportPath)
}
