import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import { readAdvisoryMessage, unwrapAdvisoryEnvelope } from './envelope'

export type AdvisoryOperationsFreshnessStatus = 'fresh' | 'delayed' | 'unavailable'

export interface AdvisoryOperationsUsageFilters {
  tenantId?: string
  dateFrom?: string
  dateTo?: string
  workflowType?: string
}

export type AdvisoryProviderTelemetryGroupBy = 'workflow' | 'experience' | 'provider'

export interface AdvisoryProviderTelemetryFilters extends AdvisoryOperationsUsageFilters {
  groupBy?: AdvisoryProviderTelemetryGroupBy[]
}

export type AdvisoryQualityFeedbackGroupBy = 'workflow' | 'recommendationType' | 'tenant' | 'time'
export type AdvisoryQualityFeedbackTimeBucket = 'day' | 'week' | 'month'

export interface AdvisoryQualityFeedbackFilters extends AdvisoryOperationsUsageFilters {
  recommendationType?: string
  groupBy?: AdvisoryQualityFeedbackGroupBy[]
  timeBucket?: AdvisoryQualityFeedbackTimeBucket
}

export interface AdvisoryOperationsFilterOption {
  id?: string
  key?: string
  name?: string
  label?: string
}

export interface AdvisoryOperationsMetrics {
  quickConsultVolume: number
  structuredWorkflowStarts: number
  completions: number
  incompleteSessions: number
  completionRate: number | null
  partyModeUsage: number
}

export interface AdvisoryOperationsWorkflowDrilldown {
  starts: number
  completions: number
  startFailures: number
  incompleteSessions: number
}

export interface AdvisoryOperationsWorkflowUsage {
  workflowKey: string
  workflowLabel: string
  trendPeriod: string
  starts: number
  completions: number
  startFailures: number
  incompleteSessions: number
  completionRate: number | null
  lowCompletion: boolean
  drilldown: AdvisoryOperationsWorkflowDrilldown
}

export interface AdvisoryOperationsInstrumentationGap {
  eventName: string | null
  reason: string
  owningArea: string
  count: number
}

export interface AdvisoryOperationsUsageView {
  generatedAt: string | null
  filters: {
    selected: Required<AdvisoryOperationsUsageFilters>
    tenants: AdvisoryOperationsFilterOption[]
    workflowTypes: AdvisoryOperationsFilterOption[]
  }
  freshness: {
    source: string
    status: AdvisoryOperationsFreshnessStatus
    latestEventAt: string | null
    description: string
  }
  metrics: AdvisoryOperationsMetrics | null
  workflowUsage: AdvisoryOperationsWorkflowUsage[]
  instrumentationGaps: AdvisoryOperationsInstrumentationGap[]
}

export interface AdvisoryProviderTelemetryMetrics {
  terminalCalls: number
  successfulCalls: number
  failedCalls: number
  retryEvents: number
  errorRate: number | null
  timeoutRate: number | null
  estimatedTokens: number
  estimatedCost: number
  averageLatencyMs: number | null
  p95LatencyMs: number | null
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheHits: number
  cacheMisses: number
  cacheBypasses: number
  cacheHitRate: number | null
}

export interface AdvisoryProviderTelemetryGroup extends AdvisoryProviderTelemetryMetrics {
  key: string
  label: string
  scopeLabel: 'workflow' | 'experience' | 'provider'
  measurementStatus: AdvisoryOperationsFreshnessStatus
}

export interface AdvisoryProviderTelemetryThresholdBreach {
  id: string
  metric: string
  actualValue: string
  thresholdValue: string
  tenantId: string
  affectedScope: string
  workflowType: string
  timeWindow: string
  severity: 'warning'
  message: string
}

export interface AdvisoryProviderTelemetryView {
  generatedAt: string | null
  filters: {
    selected: Required<AdvisoryProviderTelemetryFilters>
  }
  freshness: {
    source: string
    status: AdvisoryOperationsFreshnessStatus
    latestEventAt: string | null
    description: string
  }
  metrics: AdvisoryProviderTelemetryMetrics | null
  byWorkflow: AdvisoryProviderTelemetryGroup[]
  byExperience: AdvisoryProviderTelemetryGroup[]
  byProvider: AdvisoryProviderTelemetryGroup[]
  thresholdBreaches: AdvisoryProviderTelemetryThresholdBreach[]
  instrumentationGaps: AdvisoryOperationsInstrumentationGap[]
}

export interface AdvisoryQualityFeedbackMetrics {
  totalRatings: number
  averageRating: number | null
  lowRatingCount: number
  lowRatingRate: number | null
  recommendationRatingCount: number
  recommendationAverageRating: number | null
  recommendationLowRatingRate: number | null
  reportRatingCount: number
  reportAverageRating: number | null
  reportLowRatingRate: number | null
  feedbackTextPresentCount: number
  feedbackTextWithheldCount: number
  feedbackTextUnavailableReason: string | null
}

export type AdvisoryQualityRatingDistribution = Record<1 | 2 | 3 | 4 | 5, number>

export interface AdvisoryQualityFeedbackGroup {
  key: string
  label: string
  tenantId: string
  ratingCount: number
  averageRating: number | null
  lowRatingRate: number | null
  feedbackTextPresentCount: number
  feedbackTextWithheldCount: number
  measurementStatus: AdvisoryOperationsFreshnessStatus
}

export interface AdvisoryQualityRecommendationTypeGroup extends AdvisoryQualityFeedbackGroup {
  workflowKey: string | null
}

export interface AdvisoryQualityLowQualityTrend {
  id: string
  workflowLabel: string
  recommendationLabel: string
  tenantId: string
  trendDirection: 'up' | 'down' | 'flat' | 'insufficient_data'
  currentLowRatingRate: number | null
  previousLowRatingRate: number | null
  sampleSize: number
  severity: 'warning'
}

export interface AdvisoryQualityFeedbackView {
  generatedAt: string | null
  filters: {
    selected: Required<AdvisoryQualityFeedbackFilters>
  }
  freshness: {
    source: string
    status: AdvisoryOperationsFreshnessStatus
    latestEventAt: string | null
    description: string
  }
  metrics: AdvisoryQualityFeedbackMetrics | null
  ratingDistribution: {
    recommendation: AdvisoryQualityRatingDistribution
    report: AdvisoryQualityRatingDistribution
  }
  feedbackText: {
    presentCount: number
    withheldCount: number
    unavailableReason: string | null
  }
  byWorkflow: AdvisoryQualityFeedbackGroup[]
  byRecommendationType: AdvisoryQualityRecommendationTypeGroup[]
  lowQualityTrends: AdvisoryQualityLowQualityTrend[]
  instrumentationGaps: AdvisoryOperationsInstrumentationGap[]
}

type JsonRecord = Record<string, unknown>

const DEFAULT_SELECTED_FILTERS = {
  tenantId: 'current',
  dateFrom: '',
  dateTo: '',
  workflowType: 'all',
}

const DEFAULT_PROVIDER_SELECTED_FILTERS: Required<AdvisoryProviderTelemetryFilters> = {
  ...DEFAULT_SELECTED_FILTERS,
  groupBy: ['workflow', 'experience', 'provider'],
}

const DEFAULT_QUALITY_SELECTED_FILTERS: Required<AdvisoryQualityFeedbackFilters> = {
  ...DEFAULT_SELECTED_FILTERS,
  recommendationType: 'all',
  groupBy: ['workflow', 'recommendationType'],
  timeBucket: 'day',
}

const PROVIDER_TELEMETRY_THRESHOLDS = {
  averageLatencyMs: 3000,
  p95LatencyMs: 5000,
  errorRate: 5,
  timeoutRate: 2,
  cacheHitRate: 80,
  quickConsultCostPerCall: 2,
  workflowCostPerCall: 10,
  partyModeCostPerCall: 10,
}

export async function fetchAdvisoryOperationsUsage(
  filters: AdvisoryOperationsUsageFilters = {}
): Promise<AdvisoryOperationsUsageView> {
  const headers = await getAuthHeadersAsync()
  const query = buildOperationsUsageQuery(filters)
  const response = await fetch(`/api/advisory/admin/operations/usage${query}`, {
    headers,
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)
  const data = unwrapAdvisoryEnvelope<unknown>(body)

  if (!response.ok && !data) {
    throw new Error(
      readAdvisoryMessage(body) ?? 'Usage data unavailable. No trusted measurements are available.'
    )
  }

  if (!data) {
    throw new Error('Usage data unavailable. No trusted measurements are available.')
  }

  return normalizeAdvisoryOperationsUsage(data)
}

export async function fetchAdvisoryProviderTelemetry(
  filters: AdvisoryProviderTelemetryFilters = {}
): Promise<AdvisoryProviderTelemetryView> {
  const headers = await getAuthHeadersAsync()
  const query = buildProviderTelemetryQuery(filters)
  const response = await fetch(`/api/advisory/admin/operations/provider-telemetry${query}`, {
    headers,
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)
  const data = unwrapAdvisoryEnvelope<unknown>(body)
  const errorMessage = sanitizeOperationalText(
    readAdvisoryMessage(body),
    'Provider telemetry unavailable. No trusted measurements are available.'
  )

  if (!response.ok && !data) {
    throw new Error(errorMessage)
  }

  if (!response.ok && !looksLikeProviderTelemetryData(data)) {
    throw new Error(errorMessage)
  }

  if (!data) {
    throw new Error('Provider telemetry unavailable. No trusted measurements are available.')
  }

  return normalizeAdvisoryProviderTelemetry(data)
}

export async function fetchAdvisoryQualityFeedback(
  filters: AdvisoryQualityFeedbackFilters = {}
): Promise<AdvisoryQualityFeedbackView> {
  const headers = await getAuthHeadersAsync()
  const query = buildQualityFeedbackQuery(filters)
  const response = await fetch(`/api/advisory/admin/operations/quality-feedback${query}`, {
    headers,
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)
  const data = unwrapAdvisoryEnvelope<unknown>(body)
  const errorMessage = sanitizeQualityOperationalText(
    readAdvisoryMessage(body),
    'Quality feedback unavailable. No trusted measurements are available.'
  )

  if (!response.ok && !data) {
    throw new Error(errorMessage)
  }

  if (!response.ok && !looksLikeQualityFeedbackData(data)) {
    throw new Error(errorMessage)
  }

  if (!data) {
    throw new Error('Quality feedback unavailable. No trusted measurements are available.')
  }

  return normalizeAdvisoryQualityFeedback(data)
}

export function normalizeAdvisoryOperationsUsage(data: unknown): AdvisoryOperationsUsageView {
  const record = asRecord(data)
  const generatedAt = readString(record.generatedAt)
  const selected = normalizeSelectedFilters(record)
  const workflowUsage = normalizeWorkflowUsage(record)

  return {
    generatedAt,
    filters: {
      selected,
      tenants: normalizeTenants(record, selected.tenantId),
      workflowTypes: normalizeWorkflowTypes(record, workflowUsage),
    },
    freshness: normalizeFreshness(record),
    metrics: normalizeMetrics(record),
    workflowUsage,
    instrumentationGaps: normalizeInstrumentationGaps(record),
  }
}

export function normalizeAdvisoryProviderTelemetry(data: unknown): AdvisoryProviderTelemetryView {
  const record = asRecord(data)
  const selected = normalizeProviderSelectedFilters(record)
  const freshness = normalizeProviderFreshness(record)
  const measurementStatus = readFreshnessStatus(
    asRecord(record.summary).measurementStatus,
    freshness.status
  )
  const unavailable = freshness.status === 'unavailable' || measurementStatus === 'unavailable'
  const metrics = unavailable ? null : normalizeProviderMetrics(record)
  const byWorkflow = unavailable ? [] : normalizeProviderWorkflowGroups(record)
  const byExperience = unavailable ? [] : normalizeProviderExperienceGroups(record)
  const byProvider = unavailable ? [] : normalizeProviderProviderGroups(record)
  const thresholdBreaches =
    metrics === null
      ? []
      : buildProviderThresholdBreaches({
          selected,
          metrics,
          byWorkflow,
          byExperience,
          byProvider,
        })

  return {
    generatedAt: readString(record.generatedAt),
    filters: { selected },
    freshness,
    metrics,
    byWorkflow,
    byExperience,
    byProvider,
    thresholdBreaches,
    instrumentationGaps: normalizeInstrumentationGaps(record),
  }
}

export function normalizeAdvisoryQualityFeedback(data: unknown): AdvisoryQualityFeedbackView {
  const record = asRecord(data)
  const selected = normalizeQualitySelectedFilters(record)
  const freshness = normalizeQualityFreshness(record)
  const summary = asRecord(record.summary)
  const measurementStatus = readFreshnessStatus(summary.measurementStatus, freshness.status)
  const unavailable = freshness.status === 'unavailable' || measurementStatus === 'unavailable'
  const metrics = unavailable ? null : normalizeQualityMetrics(record)
  const byWorkflow = unavailable
    ? []
    : normalizeQualityWorkflowGroups(record).filter((group) =>
        matchesSelectedTenant(group.tenantId, selected.tenantId)
      )
  const byRecommendationType = unavailable
    ? []
    : normalizeQualityRecommendationTypeGroups(record).filter((group) =>
        matchesSelectedTenant(group.tenantId, selected.tenantId)
      )
  const lowQualityTrends = unavailable
    ? []
    : normalizeQualityLowQualityTrends(record).filter((trend) =>
        matchesSelectedTenant(trend.tenantId, selected.tenantId)
      )

  return {
    generatedAt: readString(record.generatedAt),
    filters: { selected },
    freshness,
    metrics,
    ratingDistribution: {
      recommendation: unavailable
        ? emptyRatingDistribution()
        : normalizeRatingDistribution(asRecord(summary.recommendationRatings).distribution),
      report: unavailable
        ? emptyRatingDistribution()
        : normalizeRatingDistribution(
            asRecord(summary.reportRatings).distribution ??
              asRecord(summary.outputRatings).distribution
          ),
    },
    feedbackText: {
      presentCount: readNumber(summary.feedbackTextPresentCount),
      withheldCount: readNumber(summary.feedbackTextWithheldCount),
      unavailableReason: sanitizeOptionalQualityText(
        readString(summary.feedbackTextUnavailableReason)
      ),
    },
    byWorkflow,
    byRecommendationType,
    lowQualityTrends,
    instrumentationGaps: normalizeQualityInstrumentationGaps(record),
  }
}

function buildOperationsUsageQuery(filters: AdvisoryOperationsUsageFilters) {
  const params = new URLSearchParams()
  appendIfPresent(params, 'tenantId', filters.tenantId)
  appendIfPresent(params, 'dateFrom', filters.dateFrom)
  appendIfPresent(params, 'dateTo', filters.dateTo)
  appendIfPresent(params, 'workflowType', filters.workflowType)
  const query = params.toString()
  return query ? `?${query}` : ''
}

function buildProviderTelemetryQuery(filters: AdvisoryProviderTelemetryFilters) {
  const params = new URLSearchParams()
  appendIfPresent(params, 'tenantId', filters.tenantId)
  appendIfPresent(params, 'dateFrom', filters.dateFrom)
  appendIfPresent(params, 'dateTo', filters.dateTo)
  appendIfPresent(params, 'workflowType', filters.workflowType)

  const groupBy = normalizeGroupBy(filters.groupBy)
  if (groupBy.length) params.set('groupBy', groupBy.join(','))

  const query = params.toString()
  return query ? `?${query}` : ''
}

function buildQualityFeedbackQuery(filters: AdvisoryQualityFeedbackFilters) {
  const params = new URLSearchParams()
  appendIfPresent(params, 'tenantId', filters.tenantId)
  appendIfPresent(params, 'dateFrom', filters.dateFrom)
  appendIfPresent(params, 'dateTo', filters.dateTo)
  appendIfPresent(params, 'workflowType', filters.workflowType)
  appendIfPresent(params, 'recommendationType', filters.recommendationType)

  const groupBy = normalizeQualityGroupBy(filters.groupBy)
  if (groupBy.length) params.set('groupBy', groupBy.join(','))
  if (filters.timeBucket) params.set('timeBucket', filters.timeBucket)

  const query = params.toString()
  return query ? `?${query}` : ''
}

function appendIfPresent(params: URLSearchParams, key: string, value: string | undefined) {
  if (value && value.trim() && value.trim() !== 'current') params.set(key, value.trim())
}

function normalizeSelectedFilters(record: JsonRecord): Required<AdvisoryOperationsUsageFilters> {
  const filters = asRecord(record.filters)
  const selected = asRecord(filters.selected)
  const applied = asRecord(record.appliedFilters)

  return {
    tenantId:
      readString(selected.tenantId) ??
      readString(applied.tenantId) ??
      DEFAULT_SELECTED_FILTERS.tenantId,
    dateFrom: toDateInput(readString(selected.dateFrom) ?? readString(applied.dateFrom)),
    dateTo: toDateInput(readString(selected.dateTo) ?? readString(applied.dateTo)),
    workflowType:
      readString(selected.workflowType) ??
      readString(applied.workflowType) ??
      DEFAULT_SELECTED_FILTERS.workflowType,
  }
}

function normalizeProviderSelectedFilters(
  record: JsonRecord
): Required<AdvisoryProviderTelemetryFilters> {
  const filters = asRecord(record.filters)
  const selected = asRecord(filters.selected)
  const applied = asRecord(record.appliedFilters)

  return {
    tenantId:
      readString(selected.tenantId) ??
      readString(applied.tenantId) ??
      DEFAULT_PROVIDER_SELECTED_FILTERS.tenantId,
    dateFrom: toDateInput(readString(selected.dateFrom) ?? readString(applied.dateFrom)),
    dateTo: toDateInput(readString(selected.dateTo) ?? readString(applied.dateTo)),
    workflowType:
      readString(selected.workflowType) ??
      readString(applied.workflowType) ??
      DEFAULT_PROVIDER_SELECTED_FILTERS.workflowType,
    groupBy:
      normalizeGroupBy(selected.groupBy).length > 0
        ? normalizeGroupBy(selected.groupBy)
        : normalizeGroupBy(applied.groupBy).length > 0
          ? normalizeGroupBy(applied.groupBy)
          : DEFAULT_PROVIDER_SELECTED_FILTERS.groupBy,
  }
}

function normalizeQualitySelectedFilters(
  record: JsonRecord
): Required<AdvisoryQualityFeedbackFilters> {
  const filters = asRecord(record.filters)
  const selected = asRecord(filters.selected)
  const applied = asRecord(record.appliedFilters)

  return {
    tenantId:
      readString(selected.tenantId) ??
      readString(applied.tenantId) ??
      DEFAULT_QUALITY_SELECTED_FILTERS.tenantId,
    dateFrom: toDateInput(readString(selected.dateFrom) ?? readString(applied.dateFrom)),
    dateTo: toDateInput(readString(selected.dateTo) ?? readString(applied.dateTo)),
    workflowType:
      readString(selected.workflowType) ??
      readString(applied.workflowType) ??
      DEFAULT_QUALITY_SELECTED_FILTERS.workflowType,
    recommendationType:
      readString(selected.recommendationType) ??
      readString(applied.recommendationType) ??
      DEFAULT_QUALITY_SELECTED_FILTERS.recommendationType,
    groupBy:
      normalizeQualityGroupBy(selected.groupBy).length > 0
        ? normalizeQualityGroupBy(selected.groupBy)
        : normalizeQualityGroupBy(applied.groupBy).length > 0
          ? normalizeQualityGroupBy(applied.groupBy)
          : DEFAULT_QUALITY_SELECTED_FILTERS.groupBy,
    timeBucket:
      normalizeQualityTimeBucket(selected.timeBucket) ??
      normalizeQualityTimeBucket(applied.timeBucket) ??
      DEFAULT_QUALITY_SELECTED_FILTERS.timeBucket,
  }
}

function normalizeTenants(record: JsonRecord, selectedTenantId: string) {
  const filters = asRecord(record.filters)
  const tenantOptions = Array.isArray(filters.tenants) ? filters.tenants : []
  const tenants = tenantOptions.map((item) => {
    const option = asRecord(item)
    const id = readString(option.id) ?? selectedTenantId
    return {
      id,
      name: readString(option.name) ?? id,
    }
  })

  return tenants.length ? tenants : [{ id: selectedTenantId, name: selectedTenantId }]
}

function normalizeWorkflowTypes(
  record: JsonRecord,
  workflowUsage: AdvisoryOperationsWorkflowUsage[]
) {
  const filters = asRecord(record.filters)
  const selected = normalizeSelectedFilters(record)
  const workflowOptions = Array.isArray(filters.workflowTypes) ? filters.workflowTypes : []
  const normalized = workflowOptions.map((item) => {
    const option = asRecord(item)
    const key = readString(option.key) ?? 'all'
    return {
      key,
      label: sanitizeOperationalText(readString(option.label), key),
    }
  })

  if (normalized.length) {
    if (
      selected.workflowType !== 'all' &&
      !normalized.some((workflow) => workflow.key === selected.workflowType)
    ) {
      normalized.push({ key: selected.workflowType, label: toWorkflowLabel(selected.workflowType) })
    }
    return normalized
  }

  return [
    { key: 'all', label: 'All workflows' },
    ...workflowUsage.map((workflow) => ({
      key: workflow.workflowKey,
      label: workflow.workflowLabel,
    })),
  ]
}

function normalizeFreshness(record: JsonRecord): AdvisoryOperationsUsageView['freshness'] {
  const freshness = asRecord(record.freshness)
  const status = readFreshnessStatus(freshness.status)
  return {
    source: readString(freshness.source) ?? 'audit_logs',
    status,
    latestEventAt: readString(freshness.latestEventAt) ?? readString(freshness.lastEventAt),
    description: sanitizeOperationalText(
      readString(freshness.description) ?? readString(freshness.message),
      status === 'fresh' ? 'Telemetry is current.' : 'No trusted measurements are available.'
    ),
  }
}

function normalizeProviderFreshness(
  record: JsonRecord
): AdvisoryProviderTelemetryView['freshness'] {
  const freshness = asRecord(record.freshness)
  const status = readFreshnessStatus(freshness.status)
  return {
    source: readString(freshness.source) ?? 'audit_logs',
    status,
    latestEventAt: readString(freshness.latestEventAt) ?? readString(freshness.lastEventAt),
    description: sanitizeOperationalText(
      readString(freshness.description) ?? readString(freshness.message),
      status === 'fresh'
        ? 'Provider telemetry is current.'
        : 'Provider telemetry unavailable. No trusted measurements are available.'
    ),
  }
}

function normalizeQualityFreshness(record: JsonRecord): AdvisoryQualityFeedbackView['freshness'] {
  const freshness = asRecord(record.freshness)
  const status = readFreshnessStatus(freshness.status)
  return {
    source: readString(freshness.source) ?? 'quality_feedback',
    status,
    latestEventAt: readString(freshness.latestEventAt) ?? readString(freshness.lastEventAt),
    description: sanitizeQualityOperationalText(
      readString(freshness.description) ?? readString(freshness.message),
      status === 'fresh'
        ? 'Quality feedback is current.'
        : 'Quality feedback unavailable. No trusted measurements are available.'
    ),
  }
}

function normalizeMetrics(record: JsonRecord): AdvisoryOperationsMetrics | null {
  if (record.metrics === null) return null

  const summary = asRecord(record.summary)
  const measurementStatus = readString(summary.measurementStatus)
  const freshnessStatus = readString(asRecord(record.freshness).status)
  if (measurementStatus === 'unavailable' || freshnessStatus === 'unavailable') return null

  const metrics = asRecord(record.metrics)
  if (Object.keys(metrics).length) {
    return {
      quickConsultVolume: readNumber(metrics.quickConsultVolume),
      structuredWorkflowStarts: readNumber(metrics.structuredWorkflowStarts),
      completions: readNumber(metrics.completions),
      incompleteSessions: readNumber(metrics.incompleteSessions),
      completionRate: normalizePercent(metrics.completionRate),
      partyModeUsage: readNumber(metrics.partyModeUsage),
    }
  }

  if (!Object.keys(summary).length) return null
  const quickConsult = asRecord(summary.quickConsult)
  const workflows = asRecord(summary.workflows)
  const partyMode = asRecord(summary.partyMode)
  const totalMeasured =
    readNumber(quickConsult.volume) +
    readNumber(workflows.started) +
    readNumber(workflows.completed) +
    readNumber(workflows.incomplete) +
    readNumber(partyMode.budgetExceeded) +
    readNumber(partyMode.advisorFailed)
  if (measurementStatus === 'delayed' && totalMeasured === 0) return null

  return {
    quickConsultVolume: readNumber(quickConsult.volume),
    structuredWorkflowStarts: readNumber(workflows.started),
    completions: readNumber(workflows.completed),
    incompleteSessions: readNumber(workflows.incomplete),
    completionRate: normalizePercent(workflows.completionRate),
    partyModeUsage: readNumber(partyMode.budgetExceeded) + readNumber(partyMode.advisorFailed),
  }
}

function normalizeProviderMetrics(record: JsonRecord): AdvisoryProviderTelemetryMetrics | null {
  const summary = asRecord(record.summary)
  if (!Object.keys(summary).length) return null

  const measurementStatus = readString(summary.measurementStatus)
  const freshnessStatus = readString(asRecord(record.freshness).status)
  if (measurementStatus === 'unavailable' || freshnessStatus === 'unavailable') return null

  const cache = asRecord(record.cache)
  const tokens = asRecord(summary.tokens)
  const terminalCalls = readNumber(summary.terminalCalls)

  if ((measurementStatus === 'delayed' || freshnessStatus === 'delayed') && terminalCalls === 0) {
    return null
  }

  return {
    terminalCalls,
    successfulCalls: readNumber(summary.successfulCalls),
    failedCalls: readNumber(summary.failedCalls),
    retryEvents: readNumber(summary.retryEvents),
    errorRate: normalizePercent(summary.errorRate),
    timeoutRate: normalizePercent(summary.timeoutRate),
    estimatedTokens: readNumber(summary.estimatedTokens),
    estimatedCost: readNumber(summary.estimatedCost),
    averageLatencyMs: readNullableNumber(asRecord(summary.latency).averageMs),
    p95LatencyMs: readNullableNumber(asRecord(summary.latency).p95Ms),
    inputTokens: readNumber(tokens.input),
    outputTokens: readNumber(tokens.output),
    totalTokens: readNumber(tokens.total),
    cacheHits: readNumber(cache.hits),
    cacheMisses: readNumber(cache.misses),
    cacheBypasses: readNumber(cache.bypasses),
    cacheHitRate: normalizePercent(cache.hitRate),
  }
}

function normalizeQualityMetrics(record: JsonRecord): AdvisoryQualityFeedbackMetrics | null {
  const summary = asRecord(record.summary)
  if (!Object.keys(summary).length) return null

  const measurementStatus = readString(summary.measurementStatus)
  const freshnessStatus = readString(asRecord(record.freshness).status)
  if (measurementStatus === 'unavailable' || freshnessStatus === 'unavailable') return null

  const recommendation = asRecord(summary.recommendationRatings)
  const report = Object.keys(asRecord(summary.reportRatings)).length
    ? asRecord(summary.reportRatings)
    : asRecord(summary.outputRatings)
  const totalRatings = readNumber(summary.totalRatings)

  if ((measurementStatus === 'delayed' || freshnessStatus === 'delayed') && totalRatings === 0) {
    return null
  }

  return {
    totalRatings,
    averageRating: readNullableNumber(summary.averageRating),
    lowRatingCount: readNumber(summary.lowRatingCount),
    lowRatingRate: normalizePercent(summary.lowRatingRate),
    recommendationRatingCount: readNumber(recommendation.sampleSize ?? recommendation.count),
    recommendationAverageRating: readNullableNumber(recommendation.averageRating),
    recommendationLowRatingRate: normalizePercent(
      recommendation.lowRatingRate ?? recommendation.lowQualityRate
    ),
    reportRatingCount: readNumber(report.sampleSize ?? report.count),
    reportAverageRating: readNullableNumber(report.averageRating),
    reportLowRatingRate: normalizePercent(report.lowRatingRate ?? report.lowQualityRate),
    feedbackTextPresentCount: readNumber(summary.feedbackTextPresentCount),
    feedbackTextWithheldCount: readNumber(summary.feedbackTextWithheldCount),
    feedbackTextUnavailableReason: sanitizeOptionalQualityText(
      readString(summary.feedbackTextUnavailableReason)
    ),
  }
}

function normalizeWorkflowUsage(record: JsonRecord): AdvisoryOperationsWorkflowUsage[] {
  const rawWorkflows = Array.isArray(record.workflowUsage)
    ? record.workflowUsage
    : Array.isArray(record.usageByWorkflowType)
      ? record.usageByWorkflowType
      : []

  return rawWorkflows.map((item) => {
    const workflow = asRecord(item)
    const workflowKey = readString(workflow.workflowKey) ?? 'unknown'
    return {
      workflowKey,
      workflowLabel: sanitizeOperationalText(
        readString(workflow.workflowLabel),
        toWorkflowLabel(workflowKey)
      ),
      trendPeriod: normalizeTrendPeriod(workflow.trendPeriod),
      starts: readNumber(workflow.starts),
      completions: readNumber(workflow.completions),
      startFailures: readNumber(workflow.startFailures),
      incompleteSessions: readNumber(workflow.incompleteSessions),
      completionRate: normalizePercent(workflow.completionRate),
      lowCompletion: Boolean(workflow.lowCompletion),
      drilldown: normalizeDrilldown(workflow.drilldown),
    }
  })
}

function normalizeProviderWorkflowGroups(record: JsonRecord): AdvisoryProviderTelemetryGroup[] {
  const groups = Array.isArray(record.byWorkflow) ? record.byWorkflow : []
  return groups.map((item) => {
    const group = asRecord(item)
    const key = sanitizeGroupKey(readString(group.workflowKey), 'unknown-workflow')
    return {
      ...normalizeProviderGroupMetrics(group),
      key,
      label: sanitizeOperationalText(readString(group.workflowLabel), toWorkflowLabel(key)),
      scopeLabel: 'workflow',
      measurementStatus: readFreshnessStatus(group.measurementStatus),
    }
  })
}

function normalizeProviderExperienceGroups(record: JsonRecord): AdvisoryProviderTelemetryGroup[] {
  const groups = Array.isArray(record.byExperience) ? record.byExperience : []
  return groups.map((item) => {
    const group = asRecord(item)
    const key = sanitizeGroupKey(readString(group.experience), 'unknown-experience')
    return {
      ...normalizeProviderGroupMetrics(group),
      key,
      label: sanitizeOperationalText(readString(group.experienceLabel), toExperienceLabel(key)),
      scopeLabel: 'experience',
      measurementStatus: readFreshnessStatus(group.measurementStatus),
    }
  })
}

function normalizeProviderProviderGroups(record: JsonRecord): AdvisoryProviderTelemetryGroup[] {
  const groups = Array.isArray(record.byProvider) ? record.byProvider : []
  return groups.map((item) => {
    const group = asRecord(item)
    const key = sanitizeGroupKey(readString(group.provider), 'unknown-provider')
    return {
      ...normalizeProviderGroupMetrics(group),
      key,
      label: sanitizeOperationalText(readString(group.provider), 'Unknown provider'),
      scopeLabel: 'provider',
      measurementStatus: readFreshnessStatus(group.measurementStatus),
    }
  })
}

function normalizeQualityWorkflowGroups(record: JsonRecord): AdvisoryQualityFeedbackGroup[] {
  const groups = Array.isArray(record.byWorkflow) ? record.byWorkflow : []
  return groups.map((item) => {
    const group = asRecord(item)
    const key = sanitizeQualityGroupKey(readString(group.workflowKey), 'unknown-workflow')
    return {
      key,
      label: sanitizeQualityOperationalText(readString(group.workflowLabel), toWorkflowLabel(key)),
      tenantId: sanitizeQualityOperationalText(readString(group.tenantId), 'current'),
      ratingCount: readNumber(group.ratingCount ?? group.sampleSize ?? group.count),
      averageRating: readNullableNumber(group.averageRating),
      lowRatingRate: normalizePercent(group.lowRatingRate ?? group.lowQualityRate),
      feedbackTextPresentCount: readNumber(group.feedbackTextPresentCount),
      feedbackTextWithheldCount: readNumber(group.feedbackTextWithheldCount),
      measurementStatus: readFreshnessStatus(group.measurementStatus),
    }
  })
}

function normalizeQualityRecommendationTypeGroups(
  record: JsonRecord
): AdvisoryQualityRecommendationTypeGroup[] {
  const groups = Array.isArray(record.byRecommendationType) ? record.byRecommendationType : []
  return groups.map((item) => {
    const group = asRecord(item)
    const key = sanitizeQualityGroupKey(
      readString(group.recommendationType),
      'unknown-recommendation'
    )
    return {
      key,
      label: sanitizeQualityOperationalText(
        readString(group.recommendationLabel),
        toWorkflowLabel(key)
      ),
      workflowKey: sanitizeOptionalQualityText(readString(group.workflowKey)),
      tenantId: sanitizeQualityOperationalText(readString(group.tenantId), 'current'),
      ratingCount: readNumber(group.ratingCount ?? group.sampleSize ?? group.count),
      averageRating: readNullableNumber(group.averageRating),
      lowRatingRate: normalizePercent(group.lowRatingRate ?? group.lowQualityRate),
      feedbackTextPresentCount: readNumber(group.feedbackTextPresentCount),
      feedbackTextWithheldCount: readNumber(group.feedbackTextWithheldCount),
      measurementStatus: readFreshnessStatus(group.measurementStatus),
    }
  })
}

function normalizeQualityLowQualityTrends(record: JsonRecord): AdvisoryQualityLowQualityTrend[] {
  const trends = Array.isArray(record.lowQualityTrends) ? record.lowQualityTrends : []
  return trends.map((item, index) => {
    const trend = asRecord(item)
    return {
      id:
        sanitizeOptionalQualityText(readString(trend.id)) ??
        `quality-trend-${String(index + 1).padStart(2, '0')}`,
      workflowLabel: sanitizeQualityOperationalText(
        readString(trend.workflowLabel) ?? readString(trend.workflowKey),
        'Unknown Workflow'
      ),
      recommendationLabel: sanitizeQualityOperationalText(
        readString(trend.recommendationLabel) ?? readString(trend.recommendationType),
        'Unknown recommendation'
      ),
      tenantId: sanitizeQualityOperationalText(readString(trend.tenantId), 'current'),
      trendDirection: normalizeTrendDirection(trend.trendDirection ?? trend.direction),
      currentLowRatingRate: normalizePercent(
        trend.currentLowRatingRate ?? trend.currentLowQualityRate
      ),
      previousLowRatingRate: normalizePercent(
        trend.previousLowRatingRate ?? trend.previousLowQualityRate
      ),
      sampleSize: readNumber(trend.sampleSize),
      severity: 'warning',
    }
  })
}

function normalizeProviderGroupMetrics(group: JsonRecord): AdvisoryProviderTelemetryMetrics {
  const tokens = asRecord(group.tokens)
  const cacheHits = readNumber(group.cacheHits)
  const cacheMisses = readNumber(group.cacheMisses)
  const cacheBypasses = readNumber(group.cacheBypasses)
  return {
    terminalCalls: readNumber(group.terminalCalls),
    successfulCalls: readNumber(group.successfulCalls),
    failedCalls: readNumber(group.failedCalls),
    retryEvents: readNumber(group.retryEvents),
    errorRate: normalizePercent(group.errorRate),
    timeoutRate: normalizePercent(group.timeoutRate),
    estimatedTokens: readNumber(group.estimatedTokens),
    estimatedCost: readNumber(group.estimatedCost),
    averageLatencyMs: readNullableNumber(asRecord(group.latency).averageMs),
    p95LatencyMs: readNullableNumber(asRecord(group.latency).p95Ms),
    inputTokens: readNumber(tokens.input),
    outputTokens: readNumber(tokens.output),
    totalTokens: readNumber(tokens.total),
    cacheHits,
    cacheMisses,
    cacheBypasses,
    cacheHitRate: calculateCacheHitRate(cacheHits, cacheMisses),
  }
}

function normalizeTrendPeriod(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return sanitizeOperationalText(value.trim(), 'Selected range')
  }
  const period = asRecord(value)
  const dateFrom = toDateInput(readString(period.dateFrom))
  const dateTo = toDateInput(readString(period.dateTo))
  if (dateFrom || dateTo) return `${dateFrom || '-'} to ${dateTo || '-'}`
  return 'Selected range'
}

function normalizeDrilldown(value: unknown): AdvisoryOperationsWorkflowDrilldown {
  if (Array.isArray(value)) {
    return value.reduce(
      (total, item) => {
        const row = asRecord(item)
        return {
          starts: total.starts + readNumber(row.starts),
          completions: total.completions + readNumber(row.completions),
          startFailures: total.startFailures + readNumber(row.startFailures),
          incompleteSessions: total.incompleteSessions + readNumber(row.incompleteSessions),
        }
      },
      { starts: 0, completions: 0, startFailures: 0, incompleteSessions: 0 }
    )
  }

  const drilldown = asRecord(value)
  return {
    starts: readNumber(drilldown.starts),
    completions: readNumber(drilldown.completions),
    startFailures: readNumber(drilldown.startFailures),
    incompleteSessions: readNumber(drilldown.incompleteSessions),
  }
}

function buildProviderThresholdBreaches({
  selected,
  metrics,
  byWorkflow,
  byExperience,
  byProvider,
}: {
  selected: Required<AdvisoryProviderTelemetryFilters>
  metrics: AdvisoryProviderTelemetryMetrics
  byWorkflow: AdvisoryProviderTelemetryGroup[]
  byExperience: AdvisoryProviderTelemetryGroup[]
  byProvider: AdvisoryProviderTelemetryGroup[]
}): AdvisoryProviderTelemetryThresholdBreach[] {
  const timeWindow = normalizeProviderTimeWindow(selected)
  const base = {
    tenantId: selected.tenantId,
    workflowType: selected.workflowType,
    timeWindow,
  }
  const breaches: AdvisoryProviderTelemetryThresholdBreach[] = []

  collectThresholdBreaches(breaches, {
    ...base,
    scopeId: 'summary',
    affectedScope: 'All provider calls',
    metrics,
    costPerCallThreshold: PROVIDER_TELEMETRY_THRESHOLDS.workflowCostPerCall,
  })

  for (const group of [...byWorkflow, ...byExperience, ...byProvider]) {
    collectThresholdBreaches(breaches, {
      ...base,
      scopeId: `${group.scopeLabel}-${group.key}`,
      affectedScope: group.label,
      metrics: group,
      costPerCallThreshold: costThresholdForGroup(group),
    })
  }

  return breaches
}

function collectThresholdBreaches(
  breaches: AdvisoryProviderTelemetryThresholdBreach[],
  options: {
    tenantId: string
    workflowType: string
    timeWindow: string
    scopeId: string
    affectedScope: string
    metrics: AdvisoryProviderTelemetryMetrics
    costPerCallThreshold: number | null
  }
) {
  addUpperThresholdBreach(breaches, options, {
    metric: 'P95 latency',
    actual: options.metrics.p95LatencyMs,
    threshold: PROVIDER_TELEMETRY_THRESHOLDS.p95LatencyMs,
    unit: ' ms',
  })
  addUpperThresholdBreach(breaches, options, {
    metric: 'Average latency',
    actual: options.metrics.averageLatencyMs,
    threshold: PROVIDER_TELEMETRY_THRESHOLDS.averageLatencyMs,
    unit: ' ms',
  })
  addUpperThresholdBreach(breaches, options, {
    metric: 'Error rate',
    actual: options.metrics.errorRate,
    threshold: PROVIDER_TELEMETRY_THRESHOLDS.errorRate,
    unit: '%',
  })
  addUpperThresholdBreach(breaches, options, {
    metric: 'Timeout rate',
    actual: options.metrics.timeoutRate,
    threshold: PROVIDER_TELEMETRY_THRESHOLDS.timeoutRate,
    unit: '%',
  })

  if (
    options.metrics.cacheHitRate !== null &&
    options.metrics.cacheHits + options.metrics.cacheMisses > 0 &&
    options.metrics.cacheHitRate < PROVIDER_TELEMETRY_THRESHOLDS.cacheHitRate
  ) {
    pushBreach(breaches, options, {
      metric: 'Cache hit rate',
      actualValue: `${formatNumber(options.metrics.cacheHitRate)}%`,
      thresholdValue: `${PROVIDER_TELEMETRY_THRESHOLDS.cacheHitRate}% minimum`,
    })
  }

  if (options.costPerCallThreshold && options.metrics.terminalCalls > 0) {
    const costPerCall = options.metrics.estimatedCost / options.metrics.terminalCalls
    if (costPerCall > options.costPerCallThreshold) {
      pushBreach(breaches, options, {
        metric: 'Estimated cost per call',
        actualValue: formatCost(costPerCall),
        thresholdValue: formatCost(options.costPerCallThreshold),
      })
    }
  }
}

function addUpperThresholdBreach(
  breaches: AdvisoryProviderTelemetryThresholdBreach[],
  options: {
    tenantId: string
    workflowType: string
    timeWindow: string
    scopeId: string
    affectedScope: string
  },
  threshold: {
    metric: string
    actual: number | null
    threshold: number
    unit: string
  }
) {
  if (threshold.actual === null || threshold.actual <= threshold.threshold) return
  pushBreach(breaches, options, {
    metric: threshold.metric,
    actualValue: `${formatNumber(threshold.actual)}${threshold.unit}`,
    thresholdValue: `${formatNumber(threshold.threshold)}${threshold.unit}`,
  })
}

function pushBreach(
  breaches: AdvisoryProviderTelemetryThresholdBreach[],
  options: {
    tenantId: string
    workflowType: string
    timeWindow: string
    scopeId: string
    affectedScope: string
  },
  values: {
    metric: string
    actualValue: string
    thresholdValue: string
  }
) {
  const id = `${options.scopeId}-${values.metric.toLowerCase().replace(/\s+/g, '-')}`
  breaches.push({
    id,
    metric: values.metric,
    actualValue: values.actualValue,
    thresholdValue: values.thresholdValue,
    tenantId: options.tenantId,
    affectedScope: options.affectedScope,
    workflowType: options.workflowType,
    timeWindow: options.timeWindow,
    severity: 'warning',
    message: `${values.metric} breach: ${values.actualValue} exceeds ${values.thresholdValue} for ${options.tenantId} on ${options.affectedScope} with workflow type ${options.workflowType} during ${options.timeWindow}.`,
  })
}

function costThresholdForGroup(group: AdvisoryProviderTelemetryGroup): number | null {
  if (group.scopeLabel === 'experience' && group.key === 'quick_consult') {
    return PROVIDER_TELEMETRY_THRESHOLDS.quickConsultCostPerCall
  }
  if (group.scopeLabel === 'experience' && group.key === 'party_mode') {
    return PROVIDER_TELEMETRY_THRESHOLDS.partyModeCostPerCall
  }
  if (group.scopeLabel === 'workflow') {
    return PROVIDER_TELEMETRY_THRESHOLDS.workflowCostPerCall
  }
  return null
}

function normalizeProviderTimeWindow(filters: Required<AdvisoryProviderTelemetryFilters>) {
  if (filters.dateFrom || filters.dateTo)
    return `${filters.dateFrom || '-'} to ${filters.dateTo || '-'}`
  return 'Selected range'
}

function normalizeInstrumentationGaps(record: JsonRecord): AdvisoryOperationsInstrumentationGap[] {
  const gaps = Array.isArray(record.instrumentationGaps) ? record.instrumentationGaps : []
  return gaps.map((item) => {
    const gap = asRecord(item)
    return {
      eventName: sanitizeOptionalOperationalText(readString(gap.eventName)),
      reason: sanitizeOperationalText(readString(gap.reason), 'unknown_gap'),
      owningArea: sanitizeOperationalText(
        readString(gap.owningArea) ?? readString(gap.owner),
        'ThinkTank instrumentation'
      ),
      count: readNumber(gap.count) || 1,
    }
  })
}

function normalizeQualityInstrumentationGaps(
  record: JsonRecord
): AdvisoryOperationsInstrumentationGap[] {
  const gaps = Array.isArray(record.instrumentationGaps) ? record.instrumentationGaps : []
  return gaps.map((item) => {
    const gap = asRecord(item)
    return {
      eventName: sanitizeOptionalQualityText(readString(gap.eventName)),
      reason: sanitizeQualityOperationalText(readString(gap.reason), 'unknown_gap'),
      owningArea: sanitizeQualityOperationalText(
        readString(gap.owningArea) ?? readString(gap.owner),
        'ThinkTank instrumentation'
      ),
      count: readNumber(gap.count) || 1,
    }
  })
}

function normalizeGroupBy(value: unknown): AdvisoryProviderTelemetryGroupBy[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  const allowed = new Set<AdvisoryProviderTelemetryGroupBy>(['workflow', 'experience', 'provider'])

  return raw
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item): item is AdvisoryProviderTelemetryGroupBy =>
      allowed.has(item as AdvisoryProviderTelemetryGroupBy)
    )
}

function normalizeQualityGroupBy(value: unknown): AdvisoryQualityFeedbackGroupBy[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  const allowed = new Set<AdvisoryQualityFeedbackGroupBy>([
    'workflow',
    'recommendationType',
    'tenant',
    'time',
  ])

  return raw
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item): item is AdvisoryQualityFeedbackGroupBy =>
      allowed.has(item as AdvisoryQualityFeedbackGroupBy)
    )
}

function normalizeQualityTimeBucket(value: unknown): AdvisoryQualityFeedbackTimeBucket | undefined {
  if (value === 'day' || value === 'week' || value === 'month') return value
  return undefined
}

function normalizeRatingDistribution(value: unknown): AdvisoryQualityRatingDistribution {
  const distribution = asRecord(value)
  return {
    1: readNumber(distribution['1']),
    2: readNumber(distribution['2']),
    3: readNumber(distribution['3']),
    4: readNumber(distribution['4']),
    5: readNumber(distribution['5']),
  }
}

function emptyRatingDistribution(): AdvisoryQualityRatingDistribution {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
}

function normalizeTrendDirection(value: unknown): 'up' | 'down' | 'flat' | 'insufficient_data' {
  if (value === 'up' || value === 'down' || value === 'flat' || value === 'insufficient_data') {
    return value
  }
  return 'insufficient_data'
}

function matchesSelectedTenant(groupTenantId: string, selectedTenantId: string): boolean {
  return selectedTenantId === 'current' || groupTenantId === selectedTenantId
}

function calculateCacheHitRate(hits: number, misses: number): number | null {
  const total = hits + misses
  if (total <= 0) return null
  return Math.round((hits / total) * 10000) / 100
}

function readFreshnessStatus(
  value: unknown,
  fallback: AdvisoryOperationsFreshnessStatus = 'unavailable'
): AdvisoryOperationsFreshnessStatus {
  return value === 'fresh' || value === 'delayed' || value === 'unavailable' ? value : fallback
}

function readNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizePercent(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const numeric = readNumber(value)
  if (!Number.isFinite(numeric)) return null
  return Math.round((numeric <= 1 ? numeric * 100 : numeric) * 100) / 100
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(Math.round(value * 100) / 100)
}

function formatCost(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(Math.round(value * 100) / 100)
}

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : ''
}

function toWorkflowLabel(value: string): string {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function toExperienceLabel(value: string): string {
  if (value === 'quick_consult') return 'Quick Consult'
  if (value === 'party_mode') return 'Party Mode'
  if (value === 'workflow') return 'Workflow'
  return toWorkflowLabel(value)
}

function sanitizeGroupKey(value: string | null, fallback: string): string {
  if (!value || containsRawSensitiveText(value)) return fallback
  return value
}

function sanitizeQualityGroupKey(value: string | null, fallback: string): string {
  if (!value || containsRawQualityText(value)) return fallback
  return value
}

function sanitizeOptionalOperationalText(value: string | null): string | null {
  if (!value) return null
  return containsRawSensitiveText(value) ? null : value
}

function sanitizeOptionalQualityText(value: string | null): string | null {
  if (!value) return null
  return containsRawQualityText(value) ? null : value
}

function sanitizeOperationalText(value: string | null, fallback: string): string {
  if (!value || containsRawSensitiveText(value)) return fallback
  return value
}

function sanitizeQualityOperationalText(value: string | null, fallback: string): string {
  if (!value || containsRawQualityText(value)) return fallback
  return value
}

function containsRawSensitiveText(value: string): boolean {
  return /PRIVATE_|raw[_\s-]*(conversation|content|prompt|report|feedback|provider|payload)|provider[_\s-]*(raw|payload)|cache[_\s-]*key|actor[_\s-]*id|user[_\s-]*id|conversation|prompt|report|feedback/i.test(
    value
  )
}

function containsRawQualityText(value: string): boolean {
  return /PRIVATE_|raw[_\s-]*(conversation|content|prompt|report|feedback|provider|payload)|provider[_\s-]*(raw|payload)|cache[_\s-]*key|actor[_\s-]*id|user[_\s-]*id|conversation|prompt|report content/i.test(
    value
  )
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {}
}

function looksLikeProviderTelemetryData(value: unknown): boolean {
  const record = asRecord(value)
  return (
    'summary' in record || 'freshness' in record || 'byWorkflow' in record || 'byProvider' in record
  )
}

function looksLikeQualityFeedbackData(value: unknown): boolean {
  const record = asRecord(value)
  return (
    'summary' in record ||
    'freshness' in record ||
    'byWorkflow' in record ||
    'byRecommendationType' in record
  )
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
