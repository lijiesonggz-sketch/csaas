import { AuditLog } from '../../../database/entities/audit-log.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { ThinkTankEventName } from '../events/thinktank-event-contract'

export const THINKTANK_PROVIDER_TELEMETRY_EVENT_NAMES = [
  ThinkTankEventName.ProviderCallCompleted,
  ThinkTankEventName.ProviderCallFailed,
  ThinkTankEventName.ProviderCallRetried,
  ThinkTankEventName.PromptCacheHit,
  ThinkTankEventName.PromptCacheMiss,
] as const

export type ThinkTankProviderTelemetryEventName =
  (typeof THINKTANK_PROVIDER_TELEMETRY_EVENT_NAMES)[number]

export type AdvisoryProviderTelemetryMeasurementStatus = 'fresh' | 'delayed' | 'unavailable'

export type AdvisoryProviderTelemetryGroupBy = 'workflow' | 'experience' | 'provider'

export interface AdvisoryProviderTelemetryActor {
  id: string
  role?: UserRole | string | null
  tenantId?: string | null
  organizationId?: string | null
}

export interface AdvisoryProviderTelemetryQuery {
  tenantId?: string | null
  currentTenantId?: string | null
  dateFrom?: string | Date | null
  dateTo?: string | Date | null
  workflowType?: string | null
  groupBy?: readonly AdvisoryProviderTelemetryGroupBy[] | null
  actor?: AdvisoryProviderTelemetryActor | null
  now?: Date
}

export interface AdvisoryProviderTelemetryEventQuery {
  tenantId: string
  dateFrom: Date
  dateTo: Date
  eventNames: readonly string[]
}

export type AdvisoryProviderTelemetryAuditLogRow = Pick<
  AuditLog,
  'id' | 'tenantId' | 'userId' | 'entityType' | 'entityId' | 'details' | 'createdAt'
>

export interface AdvisoryProviderTelemetryAuditLogSource {
  findThinkTankProviderTelemetryEvents(
    query: AdvisoryProviderTelemetryEventQuery,
  ): Promise<AdvisoryProviderTelemetryAuditLogRow[]>
}

export interface AdvisoryProviderTelemetryAppliedFilters {
  tenantId: string
  dateFrom: string
  dateTo: string
  workflowType?: string
  groupBy?: AdvisoryProviderTelemetryGroupBy[]
}

export interface AdvisoryProviderTelemetryInstrumentationGap {
  auditLogId?: string
  eventName?: string
  reason: string
  owner?: string
  source?: string
  expectedVersion?: number
  actualVersion?: unknown
  latestEventAt?: string | null
  count?: number
  field?: string
}

export interface AdvisoryProviderTelemetryFreshness {
  source: 'audit_logs'
  status: AdvisoryProviderTelemetryMeasurementStatus
  latestEventAt: string | null
  description: string
}

export interface AdvisoryProviderTelemetryLatencySummary {
  averageMs: number | null
  p95Ms: number | null
}

export interface AdvisoryProviderTelemetryTokenSummary {
  input: number
  output: number
  total: number
  estimated: number
}

export interface AdvisoryProviderTelemetrySummary {
  terminalCalls: number
  successfulCalls: number
  failedCalls: number
  retryEvents: number
  errorRate: number | null
  timeoutRate: number | null
  estimatedTokens: number
  estimatedCost: number
  latency: AdvisoryProviderTelemetryLatencySummary
  tokens: AdvisoryProviderTelemetryTokenSummary
  measurementStatus: AdvisoryProviderTelemetryMeasurementStatus
}

export interface AdvisoryProviderTelemetryGroupMetrics extends AdvisoryProviderTelemetrySummary {
  cacheHits: number
  cacheMisses: number
  cacheBypasses: number
}

export interface AdvisoryProviderTelemetryWorkflowGroup extends AdvisoryProviderTelemetryGroupMetrics {
  workflowKey: string
  workflowLabel: string
}

export type AdvisoryProviderTelemetryExperience =
  | 'workflow'
  | 'quick_consult'
  | 'party_mode'
  | 'unknown'

export interface AdvisoryProviderTelemetryExperienceGroup extends AdvisoryProviderTelemetryGroupMetrics {
  experience: AdvisoryProviderTelemetryExperience
}

export interface AdvisoryProviderTelemetryProviderGroup extends AdvisoryProviderTelemetryGroupMetrics {
  provider: string
}

export interface AdvisoryProviderTelemetryCacheSummary {
  hits: number
  misses: number
  bypasses: number
  totalLookups: number
  hitRate: number | null
  cachedInputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  cacheEligibleInputTokens: number
}

export interface AdvisoryProviderTelemetryDashboard {
  generatedAt: string
  appliedFilters: AdvisoryProviderTelemetryAppliedFilters
  summary: AdvisoryProviderTelemetrySummary
  byWorkflow: AdvisoryProviderTelemetryWorkflowGroup[]
  byExperience: AdvisoryProviderTelemetryExperienceGroup[]
  byProvider: AdvisoryProviderTelemetryProviderGroup[]
  cache: AdvisoryProviderTelemetryCacheSummary
  instrumentationGaps: AdvisoryProviderTelemetryInstrumentationGap[]
  freshness: AdvisoryProviderTelemetryFreshness
}
