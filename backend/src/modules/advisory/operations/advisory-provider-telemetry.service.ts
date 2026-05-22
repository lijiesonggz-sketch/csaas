import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { AuditLogService } from '../../audit/audit-log.service'
import { getThinkTankEventKind } from '../events/thinktank-event-registry'
import {
  THINKTANK_EVENT_VERSION,
  ThinkTankEventName,
  ThinkTankPrivacyClassification,
  assertNoRawSensitiveThinkTankKeys,
} from '../events/thinktank-event-contract'
import {
  AdvisoryProviderTelemetryAppliedFilters,
  AdvisoryProviderTelemetryAuditLogRow,
  AdvisoryProviderTelemetryAuditLogSource,
  AdvisoryProviderTelemetryCacheSummary,
  AdvisoryProviderTelemetryDashboard,
  AdvisoryProviderTelemetryExperience,
  AdvisoryProviderTelemetryExperienceGroup,
  AdvisoryProviderTelemetryFreshness,
  AdvisoryProviderTelemetryGroupBy,
  AdvisoryProviderTelemetryGroupMetrics,
  AdvisoryProviderTelemetryInstrumentationGap,
  AdvisoryProviderTelemetryMeasurementStatus,
  AdvisoryProviderTelemetryProviderGroup,
  AdvisoryProviderTelemetryQuery,
  AdvisoryProviderTelemetrySummary,
  AdvisoryProviderTelemetryTokenSummary,
  AdvisoryProviderTelemetryWorkflowGroup,
  THINKTANK_PROVIDER_TELEMETRY_EVENT_NAMES,
} from './advisory-provider-telemetry.types'

const DEFAULT_WINDOW_DAYS = 30
const MAX_WINDOW_DAYS = 90
const FRESHNESS_DELAY_HOURS = 48
const PROVIDER_TELEMETRY_EVENT_NAME_SET = new Set<string>(THINKTANK_PROVIDER_TELEMETRY_EVENT_NAMES)
const REQUIRED_EVENT_FIELDS = [
  'tenant_id',
  'actor_id',
  'subject_type',
  'subject_id',
  'outcome',
  'occurred_at',
  'correlation_id',
  'privacy_classification',
] as const

interface NormalizedProviderTelemetryFilters {
  tenantId: string
  dateFrom: Date
  dateTo: Date
  workflowType: string | null
  groupBy: AdvisoryProviderTelemetryGroupBy[]
  appliedFilters: AdvisoryProviderTelemetryAppliedFilters
}

interface NormalizedProviderTelemetryEvent {
  eventName: ThinkTankEventName
  eventAt: Date
  provider: string
  workflowKey: string | null
  experience: AdvisoryProviderTelemetryExperience
  latencyMs: number | null
  estimatedTokens: number
  estimatedCost: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  errorCategory: string | null
  status: string | null
  cacheStatus: 'hit' | 'miss' | 'bypass' | null
  cachedInputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  cacheEligibleInputTokens: number
  errorCode: string | null
}

interface ProviderTelemetryMetricsAccumulator {
  terminalCalls: number
  successfulCalls: number
  failedCalls: number
  retryEvents: number
  timeoutFailures: number
  estimatedTokens: number
  estimatedCost: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  latencyMs: number[]
  cacheHits: number
  cacheMisses: number
  cacheBypasses: number
}

@Injectable()
export class AdvisoryProviderTelemetryService {
  constructor(
    @Inject(AuditLogService)
    private readonly auditLogSource: AdvisoryProviderTelemetryAuditLogSource,
  ) {}

  async getProviderTelemetry(
    query: AdvisoryProviderTelemetryQuery,
  ): Promise<AdvisoryProviderTelemetryDashboard> {
    const filters = this.normalizeFilters(query)
    const now = query.now ?? new Date()
    const generatedAt = now.toISOString()

    let rows: AdvisoryProviderTelemetryAuditLogRow[]
    try {
      rows = await this.auditLogSource.findThinkTankProviderTelemetryEvents({
        tenantId: filters.tenantId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        eventNames: THINKTANK_PROVIDER_TELEMETRY_EVENT_NAMES,
      })
    } catch {
      return this.buildUnavailableDashboard(filters.appliedFilters, generatedAt)
    }

    return this.aggregateRows(rows, filters, now, generatedAt)
  }

  private aggregateRows(
    rows: AdvisoryProviderTelemetryAuditLogRow[],
    filters: NormalizedProviderTelemetryFilters,
    now: Date,
    generatedAt: string,
  ): AdvisoryProviderTelemetryDashboard {
    const gaps: AdvisoryProviderTelemetryInstrumentationGap[] = []
    const summaryMetrics = this.createMetricsAccumulator()
    const workflowMetrics = new Map<string, ProviderTelemetryMetricsAccumulator>()
    const experienceMetrics = new Map<string, ProviderTelemetryMetricsAccumulator>()
    const providerMetrics = new Map<string, ProviderTelemetryMetricsAccumulator>()
    const cache = this.createCacheSummary()
    let latestEventAt: Date | null = null

    for (const row of rows) {
      if (row.tenantId !== filters.tenantId) continue

      const normalized = this.normalizeRow(row, filters, now, gaps)
      if (!normalized) continue

      if (filters.workflowType && normalized.workflowKey !== filters.workflowType) {
        continue
      }

      latestEventAt = this.maxDate(latestEventAt, normalized.eventAt)
      this.applyMetrics(summaryMetrics, normalized)
      this.applyMetrics(this.metricsFor(providerMetrics, normalized.provider), normalized)

      const workflowKey = normalized.workflowKey ?? 'unknown'
      this.applyMetrics(this.metricsFor(workflowMetrics, workflowKey), normalized)
      this.applyMetrics(this.metricsFor(experienceMetrics, normalized.experience), normalized)
      this.applyCacheSummary(cache, normalized)
    }

    const freshness = this.resolveFreshness(latestEventAt, now, gaps)
    if (freshness.status === 'delayed' && this.isTelemetryStale(latestEventAt, now)) {
      gaps.push({
        reason: 'telemetry_delayed',
        owner: 'provider_gateway',
        source: 'audit_logs',
        latestEventAt: freshness.latestEventAt,
      })
    }

    const measurementStatus = freshness.status
    return {
      generatedAt,
      appliedFilters: filters.appliedFilters,
      summary: this.toSummary(summaryMetrics, measurementStatus),
      byWorkflow: this.shouldIncludeGroup(filters, 'workflow')
        ? this.toWorkflowGroups(workflowMetrics, measurementStatus)
        : [],
      byExperience: this.shouldIncludeGroup(filters, 'experience')
        ? this.toExperienceGroups(experienceMetrics, measurementStatus)
        : [],
      byProvider: this.shouldIncludeGroup(filters, 'provider')
        ? this.toProviderGroups(providerMetrics, measurementStatus)
        : [],
      cache,
      instrumentationGaps: gaps,
      freshness,
    }
  }

  private normalizeRow(
    row: AdvisoryProviderTelemetryAuditLogRow,
    filters: NormalizedProviderTelemetryFilters,
    now: Date,
    gaps: AdvisoryProviderTelemetryInstrumentationGap[],
  ): NormalizedProviderTelemetryEvent | null {
    const details = this.recordOrNull(row.details)
    if (!this.isCandidateInWindow(row, details, filters)) {
      return null
    }

    if (!details) {
      gaps.push({ auditLogId: row.id, reason: 'missing_event_details', owner: 'provider_gateway' })
      return null
    }

    const eventNameText = this.readString(details.event_name) ?? this.readString(details.eventName)
    try {
      assertNoRawSensitiveThinkTankKeys(details)
    } catch {
      gaps.push({
        auditLogId: row.id,
        eventName: eventNameText ? this.redactUnknownEventName(eventNameText) : undefined,
        reason: 'privacy_unsafe_payload',
        owner: 'privacy_boundary',
      })
      return null
    }

    if (!eventNameText) {
      gaps.push({ auditLogId: row.id, reason: 'missing_event_name', owner: 'provider_gateway' })
      return null
    }

    if (!PROVIDER_TELEMETRY_EVENT_NAME_SET.has(eventNameText)) {
      if (getThinkTankEventKind(eventNameText)) {
        return null
      }
      gaps.push({
        auditLogId: row.id,
        eventName: this.redactUnknownEventName(eventNameText),
        reason: 'unknown_event_name',
        owner: 'story_1_4_event_contract',
      })
      return null
    }

    const eventName = eventNameText as ThinkTankEventName
    const eventVersion = details.event_version ?? details.eventVersion
    if (eventVersion === undefined || eventVersion === null) {
      gaps.push({
        auditLogId: row.id,
        eventName,
        reason: 'missing_event_version',
        owner: 'story_1_4_event_contract',
      })
      return null
    }

    if (eventVersion !== THINKTANK_EVENT_VERSION) {
      gaps.push({
        auditLogId: row.id,
        eventName,
        reason: 'event_version_mismatch',
        owner: 'story_1_4_event_contract',
        expectedVersion: THINKTANK_EVENT_VERSION,
        actualVersion: this.safeDiagnosticValue(eventVersion),
      })
      return null
    }

    const eventAt = this.parseEventDate(details.occurred_at ?? details.occurredAt)
    if (!eventAt) {
      gaps.push({
        auditLogId: row.id,
        eventName,
        reason: 'invalid_occurred_at',
        owner: 'story_1_4_event_contract',
      })
      return null
    }

    if (eventAt > now) {
      gaps.push({
        auditLogId: row.id,
        eventName,
        reason: 'future_occurred_at',
        owner: 'story_1_4_event_contract',
      })
      return null
    }

    if (eventAt < filters.dateFrom || eventAt > filters.dateTo) {
      return null
    }

    const privacyClassification =
      this.readString(details.privacy_classification) ??
      this.readString(details.privacyClassification)
    if (privacyClassification !== ThinkTankPrivacyClassification.Operational) {
      gaps.push({
        auditLogId: row.id,
        eventName,
        reason: 'privacy_classification_not_operational',
        owner: 'story_1_4_event_contract',
      })
      return null
    }

    const missingField = this.findMissingRequiredField(details)
    if (missingField) {
      gaps.push({
        auditLogId: row.id,
        eventName,
        reason: 'missing_required_field',
        owner: 'story_1_4_event_contract',
        field: missingField,
      })
      return null
    }

    const eventTenantId = this.readString(details.tenant_id) ?? this.readString(details.tenantId)
    if (eventTenantId !== filters.tenantId) {
      gaps.push({
        auditLogId: row.id,
        eventName,
        reason: 'tenant_mismatch',
        owner: 'story_1_4_event_contract',
      })
      return null
    }

    const rawProvider = this.readString(details.provider)
    const provider = this.safeDimensionValue(rawProvider)
    if (!rawProvider) {
      gaps.push({
        auditLogId: row.id,
        eventName,
        reason: 'missing_provider',
        owner: 'provider_gateway',
      })
    }
    if (rawProvider && !provider) {
      gaps.push({
        auditLogId: row.id,
        eventName,
        reason: 'invalid_provider_metadata',
        owner: 'provider_gateway',
      })
      return null
    }

    const rawWorkflowKey = this.readWorkflowKey(details)
    const workflowKey = this.safeDimensionValue(rawWorkflowKey)
    if (!workflowKey) {
      gaps.push({
        auditLogId: row.id,
        eventName,
        reason: rawWorkflowKey ? 'invalid_grouping_metadata' : 'missing_grouping_metadata',
        owner: this.resolveGroupingOwner(details),
      })
      if (rawWorkflowKey) return null
    }
    const cacheStatus = this.resolveCacheStatus(eventName, details)
    if (!this.isCacheStatusConsistent(eventName, cacheStatus)) {
      gaps.push({
        auditLogId: row.id,
        eventName,
        reason: 'cache_status_event_mismatch',
        owner: 'provider_gateway',
      })
      return null
    }

    return {
      eventName,
      eventAt,
      provider: provider ?? 'unknown',
      workflowKey,
      experience: this.resolveExperience(details, workflowKey),
      latencyMs: this.readNonNegativeNumber(details.latency_ms ?? details.latencyMs),
      estimatedTokens: this.readNonNegativeNumber(details.estimated_tokens) ?? 0,
      estimatedCost: this.readNonNegativeNumber(details.estimated_cost) ?? 0,
      inputTokens: this.readNonNegativeNumber(details.input_tokens) ?? 0,
      outputTokens: this.readNonNegativeNumber(details.output_tokens) ?? 0,
      totalTokens:
        this.readNonNegativeNumber(details.total_tokens) ??
        this.readNonNegativeNumber(details.estimated_tokens) ??
        0,
      errorCategory:
        this.readString(details.error_category) ?? this.readString(details.errorCategory),
      status: this.readString(details.status),
      cacheStatus,
      cachedInputTokens: this.readNonNegativeNumber(details.cached_input_tokens) ?? 0,
      cacheReadInputTokens: this.readNonNegativeNumber(details.cache_read_input_tokens) ?? 0,
      cacheCreationInputTokens:
        this.readNonNegativeNumber(details.cache_creation_input_tokens) ?? 0,
      cacheEligibleInputTokens:
        this.readNonNegativeNumber(details.cache_eligible_input_tokens) ?? 0,
      errorCode:
        this.readString(details.error_code) ??
        this.readString(details.errorCode) ??
        this.readStatusCode(details.status_code ?? details.statusCode),
    }
  }

  private normalizeFilters(
    query: AdvisoryProviderTelemetryQuery,
  ): NormalizedProviderTelemetryFilters {
    const now = query.now ?? new Date()
    const dateTo = this.normalizeDate(query.dateTo, 'to') ?? now
    const dateFrom =
      this.normalizeDate(query.dateFrom, 'from') ?? this.daysBefore(dateTo, DEFAULT_WINDOW_DAYS)
    const currentTenantId = this.readString(query.currentTenantId)
    const requestedTenantId = this.readString(query.tenantId)
    const actorTenantId = this.readString(query.actor?.tenantId)
    const scopedTenantId = currentTenantId ?? actorTenantId
    const tenantId = scopedTenantId ?? (requestedTenantId === 'current' ? null : requestedTenantId)
    const workflowType = this.readString(query.workflowType)
    const normalizedWorkflowType = workflowType && workflowType !== 'all' ? workflowType : null
    const groupBy = this.normalizeGroupBy(query.groupBy)

    if (!tenantId) {
      throw new BadRequestException('tenantId is required for ThinkTank provider telemetry.')
    }

    if (
      scopedTenantId &&
      requestedTenantId &&
      requestedTenantId !== 'current' &&
      requestedTenantId !== scopedTenantId
    ) {
      throw new ForbiddenException('当前账号无权查看其他租户的 ThinkTank 运营数据。')
    }

    if (dateFrom > dateTo) {
      throw new BadRequestException('dateFrom must be before dateTo.')
    }
    if (dateTo.getTime() - dateFrom.getTime() > MAX_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
      throw new BadRequestException(`date window must not exceed ${MAX_WINDOW_DAYS} days.`)
    }

    return {
      tenantId,
      dateFrom,
      dateTo,
      workflowType: normalizedWorkflowType,
      groupBy,
      appliedFilters: {
        tenantId,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
        ...(normalizedWorkflowType ? { workflowType: normalizedWorkflowType } : {}),
        ...(groupBy.length ? { groupBy } : {}),
      },
    }
  }

  private applyMetrics(
    metrics: ProviderTelemetryMetricsAccumulator,
    event: NormalizedProviderTelemetryEvent,
  ): void {
    if (event.eventName === ThinkTankEventName.ProviderCallCompleted) {
      metrics.terminalCalls += 1
      metrics.successfulCalls += 1
      this.applyProviderCallMeasures(metrics, event)
      return
    }

    if (event.eventName === ThinkTankEventName.ProviderCallFailed) {
      metrics.terminalCalls += 1
      metrics.failedCalls += 1
      if (this.isTimeoutFailure(event)) metrics.timeoutFailures += 1
      this.applyProviderCallMeasures(metrics, event)
      return
    }

    if (event.eventName === ThinkTankEventName.ProviderCallRetried) {
      metrics.retryEvents += 1
      return
    }

    if (event.eventName === ThinkTankEventName.PromptCacheHit) {
      metrics.cacheHits += 1
      return
    }

    if (event.cacheStatus === 'bypass') {
      metrics.cacheBypasses += 1
      return
    }

    metrics.cacheMisses += 1
  }

  private applyProviderCallMeasures(
    metrics: ProviderTelemetryMetricsAccumulator,
    event: NormalizedProviderTelemetryEvent,
  ): void {
    metrics.estimatedTokens += event.estimatedTokens
    metrics.estimatedCost += event.estimatedCost
    metrics.inputTokens += event.inputTokens
    metrics.outputTokens += event.outputTokens
    metrics.totalTokens += event.totalTokens
    if (event.latencyMs !== null) metrics.latencyMs.push(event.latencyMs)
  }

  private applyCacheSummary(
    cache: AdvisoryProviderTelemetryCacheSummary,
    event: NormalizedProviderTelemetryEvent,
  ): void {
    if (
      event.eventName !== ThinkTankEventName.PromptCacheHit &&
      event.eventName !== ThinkTankEventName.PromptCacheMiss
    ) {
      return
    }

    if (event.eventName === ThinkTankEventName.PromptCacheHit) {
      cache.hits += 1
    } else if (event.cacheStatus === 'bypass') {
      cache.bypasses += 1
    } else {
      cache.misses += 1
    }

    cache.totalLookups = cache.hits + cache.misses + cache.bypasses
    cache.hitRate = cache.totalLookups > 0 ? this.rate(cache.hits, cache.totalLookups) : null
    cache.cachedInputTokens += event.cachedInputTokens
    cache.cacheReadInputTokens += event.cacheReadInputTokens
    cache.cacheCreationInputTokens += event.cacheCreationInputTokens
    cache.cacheEligibleInputTokens += event.cacheEligibleInputTokens
  }

  private toSummary(
    metrics: ProviderTelemetryMetricsAccumulator,
    measurementStatus: AdvisoryProviderTelemetryMeasurementStatus,
  ): AdvisoryProviderTelemetrySummary {
    const tokens: AdvisoryProviderTelemetryTokenSummary = {
      input: metrics.inputTokens,
      output: metrics.outputTokens,
      total: metrics.totalTokens,
      estimated: metrics.estimatedTokens,
    }
    const unavailable = measurementStatus === 'unavailable'

    return {
      terminalCalls: metrics.terminalCalls,
      successfulCalls: metrics.successfulCalls,
      failedCalls: metrics.failedCalls,
      retryEvents: metrics.retryEvents,
      errorRate:
        unavailable || metrics.terminalCalls === 0
          ? null
          : this.rate(metrics.failedCalls, metrics.terminalCalls),
      timeoutRate:
        unavailable || metrics.terminalCalls === 0
          ? null
          : this.rate(metrics.timeoutFailures, metrics.terminalCalls),
      estimatedTokens: metrics.estimatedTokens,
      estimatedCost: this.roundMetric(metrics.estimatedCost),
      latency: this.toLatencySummary(metrics.latencyMs),
      tokens,
      measurementStatus,
    }
  }

  private toGroupMetrics(
    metrics: ProviderTelemetryMetricsAccumulator,
    measurementStatus: AdvisoryProviderTelemetryMeasurementStatus,
  ): AdvisoryProviderTelemetryGroupMetrics {
    return {
      ...this.toSummary(metrics, measurementStatus),
      cacheHits: metrics.cacheHits,
      cacheMisses: metrics.cacheMisses,
      cacheBypasses: metrics.cacheBypasses,
    }
  }

  private toWorkflowGroups(
    groups: Map<string, ProviderTelemetryMetricsAccumulator>,
    measurementStatus: AdvisoryProviderTelemetryMeasurementStatus,
  ): AdvisoryProviderTelemetryWorkflowGroup[] {
    return [...groups.entries()]
      .map(([workflowKey, metrics]) => ({
        workflowKey,
        workflowLabel: this.toLabel(workflowKey),
        ...this.toGroupMetrics(metrics, measurementStatus),
      }))
      .sort((left, right) => left.workflowKey.localeCompare(right.workflowKey))
  }

  private toExperienceGroups(
    groups: Map<string, ProviderTelemetryMetricsAccumulator>,
    measurementStatus: AdvisoryProviderTelemetryMeasurementStatus,
  ): AdvisoryProviderTelemetryExperienceGroup[] {
    return [...groups.entries()]
      .map(([experience, metrics]) => ({
        experience: experience as AdvisoryProviderTelemetryExperience,
        ...this.toGroupMetrics(metrics, measurementStatus),
      }))
      .sort((left, right) => left.experience.localeCompare(right.experience))
  }

  private toProviderGroups(
    groups: Map<string, ProviderTelemetryMetricsAccumulator>,
    measurementStatus: AdvisoryProviderTelemetryMeasurementStatus,
  ): AdvisoryProviderTelemetryProviderGroup[] {
    return [...groups.entries()]
      .map(([provider, metrics]) => ({
        provider,
        ...this.toGroupMetrics(metrics, measurementStatus),
      }))
      .sort((left, right) => left.provider.localeCompare(right.provider))
  }

  private buildUnavailableDashboard(
    appliedFilters: AdvisoryProviderTelemetryAppliedFilters,
    generatedAt: string,
  ): AdvisoryProviderTelemetryDashboard {
    const summary = this.toSummary(this.createMetricsAccumulator(), 'unavailable')
    return {
      generatedAt,
      appliedFilters,
      summary,
      byWorkflow: [],
      byExperience: [],
      byProvider: [],
      cache: this.createCacheSummary(),
      instrumentationGaps: [
        {
          reason: 'telemetry_source_unavailable',
          source: 'audit_logs',
          owner: 'provider_gateway',
        },
      ],
      freshness: {
        source: 'audit_logs',
        status: 'unavailable',
        latestEventAt: null,
        description:
          'Provider telemetry source is unavailable. No trusted measurements are available.',
      },
    }
  }

  private resolveFreshness(
    latestEventAt: Date | null,
    now: Date,
    gaps: AdvisoryProviderTelemetryInstrumentationGap[],
  ): AdvisoryProviderTelemetryFreshness {
    if (!latestEventAt) {
      return {
        source: 'audit_logs',
        status: 'delayed',
        latestEventAt: null,
        description: 'No trusted provider telemetry events were found for this operational window.',
      }
    }

    if (gaps.length > 0) {
      return {
        source: 'audit_logs',
        status: 'delayed',
        latestEventAt: latestEventAt.toISOString(),
        description: 'Provider telemetry contains instrumentation gaps. Treat metrics as partial.',
      }
    }

    if (this.isTelemetryStale(latestEventAt, now)) {
      return {
        source: 'audit_logs',
        status: 'delayed',
        latestEventAt: latestEventAt.toISOString(),
        description: 'Provider telemetry is delayed. Treat these metrics as stale.',
      }
    }

    return {
      source: 'audit_logs',
      status: 'fresh',
      latestEventAt: latestEventAt.toISOString(),
      description: `Provider telemetry is current through ${latestEventAt.toISOString()}.`,
    }
  }

  private createMetricsAccumulator(): ProviderTelemetryMetricsAccumulator {
    return {
      terminalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      retryEvents: 0,
      timeoutFailures: 0,
      estimatedTokens: 0,
      estimatedCost: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      latencyMs: [],
      cacheHits: 0,
      cacheMisses: 0,
      cacheBypasses: 0,
    }
  }

  private createCacheSummary(): AdvisoryProviderTelemetryCacheSummary {
    return {
      hits: 0,
      misses: 0,
      bypasses: 0,
      totalLookups: 0,
      hitRate: null,
      cachedInputTokens: 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheEligibleInputTokens: 0,
    }
  }

  private metricsFor(
    groups: Map<string, ProviderTelemetryMetricsAccumulator>,
    key: string,
  ): ProviderTelemetryMetricsAccumulator {
    let metrics = groups.get(key)
    if (!metrics) {
      metrics = this.createMetricsAccumulator()
      groups.set(key, metrics)
    }
    return metrics
  }

  private shouldIncludeGroup(
    filters: NormalizedProviderTelemetryFilters,
    group: AdvisoryProviderTelemetryGroupBy,
  ): boolean {
    return filters.groupBy.length === 0 || filters.groupBy.includes(group)
  }

  private toLatencySummary(values: number[]) {
    if (!values.length) return { averageMs: null, p95Ms: null }
    const sorted = [...values].sort((left, right) => left - right)
    const total = sorted.reduce((sum, value) => sum + value, 0)
    const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
    return {
      averageMs: this.roundMetric(total / sorted.length),
      p95Ms: this.roundMetric(sorted[p95Index]),
    }
  }

  private resolveCacheStatus(
    eventName: ThinkTankEventName,
    details: Record<string, unknown>,
  ): 'hit' | 'miss' | 'bypass' | null {
    const cacheStatus =
      this.readString(details.cache_status) ?? this.readString(details.cacheStatus)
    if (cacheStatus === 'hit' || cacheStatus === 'miss' || cacheStatus === 'bypass') {
      return cacheStatus
    }
    if (eventName === ThinkTankEventName.PromptCacheHit) return 'hit'
    if (eventName === ThinkTankEventName.PromptCacheMiss) return 'miss'
    return null
  }

  private isCacheStatusConsistent(
    eventName: ThinkTankEventName,
    cacheStatus: 'hit' | 'miss' | 'bypass' | null,
  ): boolean {
    if (eventName === ThinkTankEventName.PromptCacheHit) {
      return cacheStatus === null || cacheStatus === 'hit'
    }
    if (eventName === ThinkTankEventName.PromptCacheMiss) {
      return cacheStatus === null || cacheStatus === 'miss' || cacheStatus === 'bypass'
    }
    return true
  }

  private resolveExperience(
    details: Record<string, unknown>,
    workflowKey: string | null,
  ): AdvisoryProviderTelemetryExperience {
    const subjectType =
      this.readString(details.subject_type) ?? this.readString(details.subjectType)
    const workflow = workflowKey?.toLowerCase() ?? ''

    if (
      subjectType === 'quick_consult' ||
      details.quick_consult === true ||
      workflow.includes('quick-consult') ||
      workflow.includes('quick_consult')
    ) {
      return 'quick_consult'
    }

    if (
      details.party_mode_message === true ||
      details.party_mode_integration === true ||
      workflow.includes('party-mode') ||
      workflow.includes('party_mode')
    ) {
      return 'party_mode'
    }

    return workflowKey ? 'workflow' : 'unknown'
  }

  private resolveGroupingOwner(details: Record<string, unknown>): string {
    const subjectType =
      this.readString(details.subject_type) ?? this.readString(details.subjectType)
    if (subjectType === 'quick_consult') return 'quick_consult_telemetry'
    if (details.party_mode_message === true || details.party_mode_integration === true) {
      return 'party_mode_telemetry'
    }
    return 'provider_gateway'
  }

  private readWorkflowKey(details: Record<string, unknown>): string | null {
    return (
      this.readString(details.workflow_type) ??
      this.readString(details.workflowType) ??
      this.readString(details.workflow_key) ??
      this.readString(details.workflowKey)
    )
  }

  private isTimeoutFailure(event: NormalizedProviderTelemetryEvent): boolean {
    return [event.errorCategory, event.status, event.errorCode]
      .filter((value): value is string => typeof value === 'string')
      .some((value) => {
        const normalized = value.toLowerCase()
        return (
          normalized.includes('timeout') ||
          normalized.includes('etimedout') ||
          normalized.endsWith('_408') ||
          normalized === '408'
        )
      })
  }

  private findMissingRequiredField(details: Record<string, unknown>): string | null {
    for (const field of REQUIRED_EVENT_FIELDS) {
      if (!this.readString(details[field])) return field
    }
    return null
  }

  private normalizeGroupBy(
    value: readonly AdvisoryProviderTelemetryGroupBy[] | null | undefined,
  ): AdvisoryProviderTelemetryGroupBy[] {
    if (!value?.length) return []
    const allowed = new Set<AdvisoryProviderTelemetryGroupBy>([
      'workflow',
      'experience',
      'provider',
    ])
    return [...new Set(value.filter((item) => allowed.has(item)))]
  }

  private normalizeDate(value: unknown, boundary: 'from' | 'to'): Date | null {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) throw new BadRequestException('Invalid date filter.')
      return value
    }
    if (Array.isArray(value) || (value && typeof value === 'object')) {
      throw new BadRequestException('Invalid date filter.')
    }

    const text = this.readString(value)
    if (!text) return null

    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text)
    const parsed = isDateOnly ? this.parseStrictDateOnly(text, boundary) : new Date(text)
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Invalid date filter.')
    return parsed
  }

  private isCandidateInWindow(
    row: AdvisoryProviderTelemetryAuditLogRow,
    details: Record<string, unknown> | null,
    filters: NormalizedProviderTelemetryFilters,
  ): boolean {
    const occurredAt = this.parseEventDateQuiet(details?.occurred_at ?? details?.occurredAt)
    return (
      (occurredAt !== null && occurredAt >= filters.dateFrom && occurredAt <= filters.dateTo) ||
      (row.createdAt >= filters.dateFrom && row.createdAt <= filters.dateTo)
    )
  }

  private parseEventDate(value: unknown): Date | null {
    const text = this.readString(value)
    if (!text) return null
    const parsed = new Date(text)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  private parseEventDateQuiet(value: unknown): Date | null {
    return this.parseEventDate(value)
  }

  private recordOrNull(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  private readNonNegativeNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
  }

  private readStatusCode(value: unknown): string | null {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599) {
      return String(value)
    }
    return this.readString(value)
  }

  private maxDate(left: Date | null, right: Date): Date {
    return !left || right > left ? right : left
  }

  private daysBefore(date: Date, days: number): Date {
    return new Date(date.getTime() - days * 24 * 60 * 60 * 1000)
  }

  private isTelemetryStale(latestEventAt: Date | null, now: Date): boolean {
    if (!latestEventAt) return true
    return now.getTime() - latestEventAt.getTime() > FRESHNESS_DELAY_HOURS * 60 * 60 * 1000
  }

  private rate(numerator: number, denominator: number): number {
    if (denominator <= 0) return 0
    return this.roundMetric(numerator / denominator, 4)
  }

  private roundMetric(value: number, precision = 4): number {
    const factor = Math.pow(10, precision)
    return Math.round(value * factor) / factor
  }

  private toLabel(value: string): string {
    return value
      .split(/[-_]/g)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ')
  }

  private redactUnknownEventName(eventName: string): string {
    return /^thinktank\.[a-z0-9_.-]{1,96}$/i.test(eventName) &&
      !/PRIVATE_|raw|conversation|prompt|report|feedback|content|message/i.test(eventName)
      ? eventName
      : 'unregistered_thinktank_event'
  }

  private safeDiagnosticValue(value: unknown): unknown {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'boolean') return value
    if (typeof value === 'string' && this.isSafeDiagnosticText(value)) return value
    if (value === null || value === undefined) return value
    return `[${Array.isArray(value) ? 'array' : typeof value}]`
  }

  private safeDimensionValue(value: string | null): string | null {
    if (!value || !this.isSafeDiagnosticText(value)) return null
    return /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value) ? value : null
  }

  private isSafeDiagnosticText(value: string): boolean {
    if (!value || value.length > 96) return false
    return !/PRIVATE_|raw|conversation|prompt|report|feedback|content|message/i.test(value)
  }

  private parseStrictDateOnly(value: string, boundary: 'from' | 'to'): Date {
    const [yearText, monthText, dayText] = value.split('-')
    const year = Number(yearText)
    const month = Number(monthText)
    const day = Number(dayText)
    const parsed = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, boundary === 'to' ? 999 : 0))
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new BadRequestException('Invalid date filter.')
    }
    if (boundary === 'to') {
      parsed.setUTCHours(23, 59, 59, 999)
    }
    return parsed
  }
}
