import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { AuditLogService } from '../../audit/audit-log.service'
import { getThinkTankEventKind } from '../events/thinktank-event-registry'
import {
  THINKTANK_EVENT_VERSION,
  ThinkTankEventName,
} from '../events/thinktank-event-contract'
import {
  AdvisoryOperationsAppliedFilters,
  AdvisoryOperationsAuditLogRow,
  AdvisoryOperationsAuditLogSource,
  AdvisoryOperationsFreshness,
  AdvisoryOperationsInstrumentationGap,
  AdvisoryOperationsMeasurementStatus,
  AdvisoryOperationsSummary,
  AdvisoryOperationsUsageDashboard,
  AdvisoryOperationsUsageQuery,
  AdvisoryOperationsWorkflowUsage,
  THINKTANK_USAGE_EVENT_NAMES,
} from './advisory-operations.types'

const LOW_COMPLETION_THRESHOLD = 0.5
const DEFAULT_WINDOW_DAYS = 30
const FRESHNESS_DELAY_HOURS = 48
const USAGE_EVENT_NAME_SET = new Set<string>(THINKTANK_USAGE_EVENT_NAMES)

interface WorkflowAccumulator {
  workflowKey: string
  startedSessionIds: Set<string>
  completedSessionIds: Set<string>
  startFailedSessionIds: Set<string>
  eventCounts: Record<string, number>
}

interface NormalizedUsageEvent {
  eventName: string
  eventAt: Date
  workflowKey: string | null
  subjectId: string | null
}

interface NormalizedUsageFilters {
  tenantId: string
  dateFrom: Date
  dateTo: Date
  workflowType: string | null
  appliedFilters: AdvisoryOperationsAppliedFilters
}

@Injectable()
export class AdvisoryOperationsService {
  constructor(
    @Inject(AuditLogService)
    private readonly auditLogSource: AdvisoryOperationsAuditLogSource,
  ) {}

  async getUsageDashboard(
    query: AdvisoryOperationsUsageQuery,
  ): Promise<AdvisoryOperationsUsageDashboard> {
    const filters = this.normalizeFilters(query)
    const generatedAt = (query.now ?? new Date()).toISOString()

    let rows: AdvisoryOperationsAuditLogRow[]
    try {
      rows = await this.auditLogSource.findThinkTankUsageEvents({
        tenantId: filters.tenantId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        eventNames: THINKTANK_USAGE_EVENT_NAMES,
      })
    } catch {
      return this.buildUnavailableDashboard(filters.appliedFilters, generatedAt)
    }

    return this.aggregateRows(rows, filters, query.now ?? new Date(), generatedAt)
  }

  private aggregateRows(
    rows: AdvisoryOperationsAuditLogRow[],
    filters: NormalizedUsageFilters,
    now: Date,
    generatedAt: string,
  ): AdvisoryOperationsUsageDashboard {
    const gaps: AdvisoryOperationsInstrumentationGap[] = []
    const workflows = new Map<string, WorkflowAccumulator>()
    const quickConsult = { started: 0, completed: 0, failed: 0, volume: 0 }
    const partyMode = { budgetExceeded: 0, advisorFailed: 0 }
    let workflowStarts = 0
    let workflowCompletions = 0
    let workflowStartFailures = 0
    let latestEventAt: Date | null = null

    for (const row of rows) {
      if (!this.rowMatchesTenant(row, filters.tenantId)) continue

      const normalized = this.normalizeRow(row, filters, now, gaps)
      if (!normalized) continue

      if (filters.workflowType && normalized.workflowKey !== filters.workflowType) {
        continue
      }

      latestEventAt = this.maxDate(latestEventAt, normalized.eventAt)

      switch (normalized.eventName) {
        case ThinkTankEventName.WorkflowStarted:
          if (
            this.addUnique(
              this.workflowFor(workflows, normalized.workflowKey).startedSessionIds,
              this.eventIdentity(row, normalized),
            )
          ) {
            workflowStarts += 1
          }
          this.incrementEventCount(workflows, normalized.workflowKey, normalized.eventName)
          break
        case ThinkTankEventName.WorkflowCompleted:
          if (
            this.addUnique(
              this.workflowFor(workflows, normalized.workflowKey).completedSessionIds,
              this.eventIdentity(row, normalized),
            )
          ) {
            workflowCompletions += 1
          }
          this.incrementEventCount(workflows, normalized.workflowKey, normalized.eventName)
          break
        case ThinkTankEventName.WorkflowStartFailed:
          if (
            this.addUnique(
              this.workflowFor(workflows, normalized.workflowKey).startFailedSessionIds,
              this.eventIdentity(row, normalized),
            )
          ) {
            workflowStartFailures += 1
          }
          this.incrementEventCount(workflows, normalized.workflowKey, normalized.eventName)
          break
        case ThinkTankEventName.QuickConsultStarted:
          quickConsult.started += 1
          quickConsult.volume += 1
          break
        case ThinkTankEventName.QuickConsultCompleted:
          quickConsult.completed += 1
          break
        case ThinkTankEventName.QuickConsultFailed:
          quickConsult.failed += 1
          break
        case ThinkTankEventName.PartyModeBudgetExceeded:
          partyMode.budgetExceeded += 1
          break
        case ThinkTankEventName.PartyModeAdvisorFailed:
          partyMode.advisorFailed += 1
          break
      }
    }

    const usageByWorkflowType = [...workflows.values()]
      .map((workflow) => this.toWorkflowUsage(workflow, filters.appliedFilters, gaps))
      .sort((left, right) => left.workflowKey.localeCompare(right.workflowKey))
    const lowCompletionWorkflows = usageByWorkflowType.filter((workflow) => workflow.lowCompletion)
    const freshness = this.resolveFreshness(latestEventAt, now, gaps)

    if (freshness.status === 'delayed' && this.isTelemetryStale(latestEventAt, now)) {
      gaps.push({
        reason: 'telemetry_delayed',
        owner: 'thinktank_instrumentation',
        source: 'audit_logs',
        latestEventAt: freshness.latestEventAt,
      })
    }

    const measurementStatus = freshness.status
    const workflowCompletionRate =
      measurementStatus === 'fresh' && workflowStarts > 0
        ? this.rate(workflowCompletions, workflowStarts)
        : null
    const summary: AdvisoryOperationsSummary = {
      quickConsult,
      workflows: {
        started: workflowStarts,
        completed: workflowCompletions,
        startFailed: workflowStartFailures,
        incomplete: Math.max(workflowStarts - workflowCompletions, 0),
        completionRate: workflowCompletionRate,
      },
      partyMode,
      measurementStatus,
    }

    return {
      generatedAt,
      appliedFilters: filters.appliedFilters,
      summary,
      usageByWorkflowType,
      lowCompletionWorkflows,
      instrumentationGaps: gaps,
      freshness,
    }
  }

  private normalizeRow(
    row: AdvisoryOperationsAuditLogRow,
    filters: NormalizedUsageFilters,
    now: Date,
    gaps: AdvisoryOperationsInstrumentationGap[],
  ): NormalizedUsageEvent | null {
    const details = this.recordOrNull(row.details)
    if (!this.isCandidateInWindow(row, details, filters)) {
      return null
    }

    if (!details) {
      gaps.push({ auditLogId: row.id, reason: 'missing_event_details', owner: 'thinktank_instrumentation' })
      return null
    }

    const eventName = this.readString(details.event_name) ?? this.readString(details.eventName)
    if (!eventName) {
      gaps.push({ auditLogId: row.id, reason: 'missing_event_name', owner: 'thinktank_instrumentation' })
      return null
    }

    if (!USAGE_EVENT_NAME_SET.has(eventName)) {
      if (getThinkTankEventKind(eventName)) {
        return null
      }
      gaps.push({
        auditLogId: row.id,
        eventName: this.redactUnknownEventName(eventName),
        reason: 'unknown_event_name',
        owner: 'thinktank_instrumentation',
      })
      return null
    }

    const eventVersion = details.event_version ?? details.eventVersion
    if (eventVersion === undefined || eventVersion === null) {
      gaps.push({ auditLogId: row.id, eventName, reason: 'missing_event_version', owner: 'story_1_4_event_contract' })
      return null
    }

    if (eventVersion !== THINKTANK_EVENT_VERSION) {
      gaps.push({
        auditLogId: row.id,
        eventName,
        reason: 'event_version_mismatch',
        owner: 'story_1_4_event_contract',
        expectedVersion: THINKTANK_EVENT_VERSION,
        actualVersion: eventVersion,
      })
      return null
    }

    const eventAt = this.parseEventDate(details.occurred_at ?? details.occurredAt)
    if (!eventAt) {
      gaps.push({ auditLogId: row.id, eventName, reason: 'invalid_occurred_at', owner: 'story_1_4_event_contract' })
      return null
    }

    if (eventAt < filters.dateFrom || eventAt > filters.dateTo) {
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

    const workflowKey =
      this.readString(details.workflow_type) ?? this.readString(details.workflowType)
    if (this.isWorkflowEvent(eventName) && !workflowKey) {
      gaps.push({
        auditLogId: row.id,
        eventName,
        reason: 'missing_workflow_identifier',
        owner: 'workflow_telemetry',
      })
      return null
    }

    return {
      eventName,
      eventAt,
      workflowKey,
      subjectId: this.readString(details.subject_id) ?? this.readString(details.subjectId),
    }
  }

  private normalizeFilters(query: AdvisoryOperationsUsageQuery): NormalizedUsageFilters {
    const now = query.now ?? new Date()
    const dateTo = this.normalizeDate(query.dateTo, 'to') ?? now
    const dateFrom =
      this.normalizeDate(query.dateFrom, 'from') ?? this.daysBefore(dateTo, DEFAULT_WINDOW_DAYS)
    const currentTenantId = this.readString(query.currentTenantId)
    const requestedTenantId = this.readString(query.tenantId)
    const actorTenantId = this.readString(query.actor?.tenantId)
    const tenantId =
      currentTenantId ?? (requestedTenantId === 'current' ? null : requestedTenantId) ?? actorTenantId
    const workflowType = this.readString(query.workflowType)
    const normalizedWorkflowType = workflowType && workflowType !== 'all' ? workflowType : null

    if (!tenantId) {
      throw new BadRequestException('tenantId is required for ThinkTank operations usage.')
    }

    if (
      currentTenantId &&
      requestedTenantId &&
      requestedTenantId !== 'current' &&
      requestedTenantId !== currentTenantId
    ) {
      throw new ForbiddenException('当前账号无权查看其他租户的 ThinkTank 运营数据。')
    }

    if (dateFrom > dateTo) {
      throw new BadRequestException('dateFrom must be before dateTo.')
    }

    return {
      tenantId,
      dateFrom,
      dateTo,
      workflowType: normalizedWorkflowType,
      appliedFilters: {
        tenantId,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
        ...(normalizedWorkflowType ? { workflowType: normalizedWorkflowType } : {}),
      },
    }
  }

  private toWorkflowUsage(
    workflow: WorkflowAccumulator,
    filters: AdvisoryOperationsAppliedFilters,
    gaps: AdvisoryOperationsInstrumentationGap[],
  ): AdvisoryOperationsWorkflowUsage {
    const starts = workflow.startedSessionIds.size
    const completions = workflow.completedSessionIds.size
    const startFailures = workflow.startFailedSessionIds.size
    const completionRate = starts > 0 ? this.rate(completions, starts) : null
    const incompleteSessions = Math.max(starts - completions, 0)

    if (starts === 0 && completions > 0) {
      gaps.push({
        eventName: ThinkTankEventName.WorkflowCompleted,
        reason: 'completion_without_start',
        owner: 'workflow_telemetry',
        count: completions,
      })
    }

    return {
      workflowKey: workflow.workflowKey,
      workflowLabel: this.toWorkflowLabel(workflow.workflowKey),
      trendPeriod: {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      },
      starts,
      completions,
      startFailures,
      incompleteSessions,
      completionRate,
      lowCompletion: completionRate !== null && completionRate < LOW_COMPLETION_THRESHOLD,
      threshold: LOW_COMPLETION_THRESHOLD,
      drilldown: {
        starts,
        completions,
        startFailures,
        incompleteSessions,
        eventCounts: workflow.eventCounts,
      },
    }
  }

  private buildUnavailableDashboard(
    appliedFilters: AdvisoryOperationsAppliedFilters,
    generatedAt: string,
  ): AdvisoryOperationsUsageDashboard {
    const summary: AdvisoryOperationsSummary = {
      quickConsult: { started: 0, completed: 0, failed: 0, volume: 0 },
      workflows: {
        started: 0,
        completed: 0,
        startFailed: 0,
        incomplete: 0,
        completionRate: null,
      },
      partyMode: { budgetExceeded: 0, advisorFailed: 0 },
      measurementStatus: 'unavailable',
    }

    return {
      generatedAt,
      appliedFilters,
      summary,
      usageByWorkflowType: [],
      lowCompletionWorkflows: [],
      instrumentationGaps: [
        {
          reason: 'telemetry_source_unavailable',
          source: 'audit_logs',
          owner: 'thinktank_instrumentation',
        },
      ],
      freshness: {
        source: 'audit_logs',
        status: 'unavailable',
        latestEventAt: null,
        description: 'Telemetry source is unavailable. No trusted measurements are available.',
      },
    }
  }

  private resolveFreshness(
    latestEventAt: Date | null,
    now: Date,
    gaps: AdvisoryOperationsInstrumentationGap[],
  ): AdvisoryOperationsFreshness {
    if (!latestEventAt) {
      return {
        source: 'audit_logs',
        status: 'delayed',
        latestEventAt: null,
        description: 'No trusted ThinkTank usage events were found for this operational window.',
      }
    }

    if (gaps.length > 0) {
      return {
        source: 'audit_logs',
        status: 'delayed',
        latestEventAt: latestEventAt.toISOString(),
        description: 'Usage telemetry contains instrumentation gaps. Treat metrics as partial.',
      }
    }

    if (this.isTelemetryStale(latestEventAt, now)) {
      return {
        source: 'audit_logs',
        status: 'delayed',
        latestEventAt: latestEventAt.toISOString(),
        description: 'Telemetry is delayed. Treat these metrics as stale.',
      }
    }

    return {
      source: 'audit_logs',
      status: 'fresh',
      latestEventAt: latestEventAt.toISOString(),
      description: `Telemetry is current through ${latestEventAt.toISOString()}.`,
    }
  }

  private rowMatchesTenant(row: AdvisoryOperationsAuditLogRow, tenantId: string): boolean {
    return row.tenantId === tenantId
  }

  private workflowFor(workflows: Map<string, WorkflowAccumulator>, workflowKey: string | null) {
    const key = workflowKey ?? 'unknown'
    let workflow = workflows.get(key)
    if (!workflow) {
      workflow = {
        workflowKey: key,
        startedSessionIds: new Set<string>(),
        completedSessionIds: new Set<string>(),
        startFailedSessionIds: new Set<string>(),
        eventCounts: {},
      }
      workflows.set(key, workflow)
    }
    return workflow
  }

  private incrementEventCount(
    workflows: Map<string, WorkflowAccumulator>,
    workflowKey: string | null,
    eventName: string,
  ): void {
    const workflow = this.workflowFor(workflows, workflowKey)
    workflow.eventCounts[eventName] = (workflow.eventCounts[eventName] ?? 0) + 1
  }

  private isWorkflowEvent(eventName: string): boolean {
    return (
      eventName === ThinkTankEventName.WorkflowStarted ||
      eventName === ThinkTankEventName.WorkflowCompleted ||
      eventName === ThinkTankEventName.WorkflowStartFailed
    )
  }

  private normalizeDate(value: string | Date | null | undefined, boundary: 'from' | 'to'): Date | null {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) throw new BadRequestException('Invalid date filter.')
      return value
    }

    const text = this.readString(value)
    if (!text) return null

    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text)
    const parsed = new Date(isDateOnly && boundary === 'to' ? `${text}T23:59:59.999Z` : text)
    if (isDateOnly && boundary === 'from') {
      return new Date(`${text}T00:00:00.000Z`)
    }
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Invalid date filter.')
    return parsed
  }

  private parseEventDate(value: unknown): Date | null {
    const text = this.readString(value)
    if (!text) return null
    const parsed = new Date(text)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  private isCandidateInWindow(
    row: AdvisoryOperationsAuditLogRow,
    details: Record<string, unknown> | null,
    filters: NormalizedUsageFilters,
  ): boolean {
    const occurredAt = this.parseEventDate(details?.occurred_at ?? details?.occurredAt)
    const candidateDate = occurredAt ?? row.createdAt
    return candidateDate >= filters.dateFrom && candidateDate <= filters.dateTo
  }

  private eventIdentity(row: AdvisoryOperationsAuditLogRow, event: NormalizedUsageEvent): string {
    return event.subjectId ?? row.entityId ?? row.id
  }

  private addUnique(values: Set<string>, value: string): boolean {
    if (values.has(value)) return false
    values.add(value)
    return true
  }

  private redactUnknownEventName(eventName: string): string {
    return /^thinktank\.[a-z0-9_.-]{1,96}$/i.test(eventName) &&
      !/PRIVATE_|raw|conversation|prompt|report|feedback|content|message/i.test(eventName)
      ? eventName
      : 'unregistered_thinktank_event'
  }

  private daysBefore(date: Date, days: number): Date {
    return new Date(date.getTime() - days * 24 * 60 * 60 * 1000)
  }

  private isTelemetryStale(latestEventAt: Date | null, now: Date): boolean {
    if (!latestEventAt) return true
    return now.getTime() - latestEventAt.getTime() > FRESHNESS_DELAY_HOURS * 60 * 60 * 1000
  }

  private maxDate(left: Date | null, right: Date): Date {
    return !left || right > left ? right : left
  }

  private rate(numerator: number, denominator: number): number {
    if (denominator <= 0) return 0
    return Math.round((numerator / denominator) * 10000) / 10000
  }

  private toWorkflowLabel(workflowKey: string): string {
    return workflowKey
      .split(/[-_]/g)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ')
  }

  private recordOrNull(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }
}
