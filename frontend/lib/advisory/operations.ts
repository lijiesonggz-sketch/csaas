import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import { readAdvisoryMessage, unwrapAdvisoryEnvelope } from './envelope'

export type AdvisoryOperationsFreshnessStatus = 'fresh' | 'delayed' | 'unavailable'

export interface AdvisoryOperationsUsageFilters {
  tenantId?: string
  dateFrom?: string
  dateTo?: string
  workflowType?: string
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

type JsonRecord = Record<string, unknown>

const DEFAULT_SELECTED_FILTERS = {
  tenantId: 'current',
  dateFrom: '',
  dateTo: '',
  workflowType: 'all',
}

export async function fetchAdvisoryOperationsUsage(
  filters: AdvisoryOperationsUsageFilters = {},
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
      readAdvisoryMessage(body) ?? 'Usage data unavailable. No trusted measurements are available.',
    )
  }

  if (!data) {
    throw new Error('Usage data unavailable. No trusted measurements are available.')
  }

  return normalizeAdvisoryOperationsUsage(data)
}

export function normalizeAdvisoryOperationsUsage(
  data: unknown,
): AdvisoryOperationsUsageView {
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

function buildOperationsUsageQuery(filters: AdvisoryOperationsUsageFilters) {
  const params = new URLSearchParams()
  appendIfPresent(params, 'tenantId', filters.tenantId)
  appendIfPresent(params, 'dateFrom', filters.dateFrom)
  appendIfPresent(params, 'dateTo', filters.dateTo)
  appendIfPresent(params, 'workflowType', filters.workflowType)
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
  workflowUsage: AdvisoryOperationsWorkflowUsage[],
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
      (status === 'fresh'
        ? 'Telemetry is current.'
        : 'No trusted measurements are available.'),
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
        toWorkflowLabel(workflowKey),
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
      { starts: 0, completions: 0, startFailures: 0, incompleteSessions: 0 },
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

function normalizeInstrumentationGaps(record: JsonRecord): AdvisoryOperationsInstrumentationGap[] {
  const gaps = Array.isArray(record.instrumentationGaps) ? record.instrumentationGaps : []
  return gaps.map((item) => {
    const gap = asRecord(item)
    return {
      eventName: sanitizeOptionalOperationalText(readString(gap.eventName)),
      reason: readString(gap.reason) ?? 'unknown_gap',
      owningArea: sanitizeOperationalText(
        readString(gap.owningArea) ?? readString(gap.owner),
        'ThinkTank instrumentation',
      ),
      count: readNumber(gap.count) || 1,
    }
  })
}

function readFreshnessStatus(value: unknown): AdvisoryOperationsFreshnessStatus {
  return value === 'fresh' || value === 'delayed' || value === 'unavailable'
    ? value
    : 'unavailable'
}

function normalizePercent(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const numeric = readNumber(value)
  if (!Number.isFinite(numeric)) return null
  return Math.round((numeric <= 1 ? numeric * 100 : numeric) * 100) / 100
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

function sanitizeOptionalOperationalText(value: string | null): string | null {
  if (!value) return null
  return containsRawSensitiveText(value) ? null : value
}

function sanitizeOperationalText(value: string | null, fallback: string): string {
  if (!value || containsRawSensitiveText(value)) return fallback
  return value
}

function containsRawSensitiveText(value: string): boolean {
  return /PRIVATE_|raw[_\s-]*(conversation|content|prompt|report|feedback)|conversation|prompt|report|feedback/i.test(
    value,
  )
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {}
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
