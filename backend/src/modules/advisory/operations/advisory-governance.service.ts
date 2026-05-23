import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { UserRole } from '../../../database/entities/user.entity'
import { AuditLogService } from '../../audit/audit-log.service'
import { getThinkTankEventKind } from '../events/thinktank-event-registry'
import {
  THINKTANK_EVENT_VERSION,
  ThinkTankEventName,
  ThinkTankEventOutcome,
  ThinkTankPrivacyClassification,
  assertNoRawSensitiveThinkTankKeys,
} from '../events/thinktank-event-contract'
import {
  AdvisoryGovernanceActorGroup,
  AdvisoryGovernanceAppliedFilters,
  AdvisoryGovernanceAuditLogRow,
  AdvisoryGovernanceAuditLogSource,
  AdvisoryGovernanceComplianceIssue,
  AdvisoryGovernanceDashboard,
  AdvisoryGovernanceEventTypeGroup,
  AdvisoryGovernanceExportedOutput,
  AdvisoryGovernanceFreshness,
  AdvisoryGovernanceGroupBy,
  AdvisoryGovernanceInstrumentationGap,
  AdvisoryGovernanceOutcomeGroup,
  AdvisoryGovernanceQuery,
  AdvisoryGovernanceSummary,
  AdvisoryGovernanceWorkflowGroup,
  THINKTANK_GOVERNANCE_EVENT_NAMES,
} from './advisory-governance.types'

const DEFAULT_WINDOW_DAYS = 30
const MAX_WINDOW_DAYS = 90
const FRESHNESS_DELAY_HOURS = 48
const GOVERNANCE_EVENT_NAME_SET = new Set<string>(THINKTANK_GOVERNANCE_EVENT_NAMES)
const GOVERNANCE_OUTCOME_SET = new Set<string>(Object.values(ThinkTankEventOutcome))
const REQUIRED_EVENT_FIELDS = [
  'event_name',
  'event_version',
  'tenant_id',
  'actor_id',
  'subject_type',
  'subject_id',
  'outcome',
  'occurred_at',
  'correlation_id',
  'privacy_classification',
] as const

interface NormalizedGovernanceFilters {
  tenantId: string
  dateFrom: Date
  dateTo: Date
  workflowType: string | null
  actorId: string | null
  eventType: string | null
  outcome: string | null
  groupBy: AdvisoryGovernanceGroupBy[]
  appliedFilters: AdvisoryGovernanceAppliedFilters
}

interface NormalizedGovernanceEvent {
  auditLogId: string
  eventName: ThinkTankEventName
  eventAt: Date
  actorId: string
  outcome: string
  workflowKey: string | null
  subjectId: string
  outputId: string | null
  aiLabelMetadataPresent: boolean | null
}

interface EventTypeAccumulator {
  eventName: string
  count: number
  successCount: number
  failureCount: number
  deniedCount: number
  blockedCount: number
  partialCount: number
  latestEventAt: Date | null
}

interface CountAccumulator {
  count: number
  latestEventAt: Date | null
}

interface ActorAccumulator extends CountAccumulator {
  actorId: string
  deniedCount: number
  exportedOutputCount: number
}

interface WorkflowAccumulator extends CountAccumulator {
  workflowKey: string
  deniedCount: number
  exportedOutputCount: number
}

@Injectable()
export class AdvisoryGovernanceService {
  constructor(
    @Inject(AuditLogService)
    private readonly auditLogSource: AdvisoryGovernanceAuditLogSource,
  ) {}

  async getGovernanceReview(query: AdvisoryGovernanceQuery): Promise<AdvisoryGovernanceDashboard> {
    const filters = this.normalizeFilters(query)
    const now = query.now ?? new Date()
    const generatedAt = now.toISOString()

    let rows: AdvisoryGovernanceAuditLogRow[]
    try {
      rows = await this.auditLogSource.findThinkTankGovernanceEvents({
        tenantId: filters.tenantId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        eventNames: THINKTANK_GOVERNANCE_EVENT_NAMES,
      })
    } catch {
      return this.buildUnavailableDashboard(filters.appliedFilters, generatedAt)
    }

    return this.aggregateRows(rows, filters, now, generatedAt)
  }

  private aggregateRows(
    rows: AdvisoryGovernanceAuditLogRow[],
    filters: NormalizedGovernanceFilters,
    now: Date,
    generatedAt: string,
  ): AdvisoryGovernanceDashboard {
    const gaps: AdvisoryGovernanceInstrumentationGap[] = []
    const complianceIssues: AdvisoryGovernanceComplianceIssue[] = []
    const byEventType = new Map<string, EventTypeAccumulator>()
    const byOutcome = new Map<string, CountAccumulator>()
    const byActor = new Map<string, ActorAccumulator>()
    const byWorkflow = new Map<string, WorkflowAccumulator>()
    const exportedOutputs: AdvisoryGovernanceExportedOutput[] = []
    let latestEventAt: Date | null = null
    let trustedEvents = 0
    let deniedActions = 0
    let exportedOutputCount = 0
    let exportsMissingAiLabelMetadata = 0
    let malformedEvents = 0

    for (const row of rows) {
      if (row.tenantId !== filters.tenantId) continue

      const previousGapCount = gaps.length
      const normalized = this.normalizeRow(row, filters, now, gaps)
      if (!normalized) {
        if (gaps.length > previousGapCount) malformedEvents += 1
        continue
      }

      trustedEvents += 1
      latestEventAt = this.maxDate(latestEventAt, normalized.eventAt)
      if (normalized.outcome === 'denied') deniedActions += 1
      this.addEventType(byEventType, normalized)
      this.addOutcome(byOutcome, normalized)
      this.addActor(byActor, normalized)
      this.addWorkflow(byWorkflow, normalized)

      if (normalized.eventName === ThinkTankEventName.OutputExported) {
        exportedOutputCount += 1
        const exportSummary = this.toExportedOutput(normalized)
        exportedOutputs.push(exportSummary)
        if (!exportSummary.aiLabelMetadataPresent) {
          exportsMissingAiLabelMetadata += 1
          const owner = this.resolveOwner(normalized.eventName)
          complianceIssues.push({
            id: `missing-ai-label-${exportSummary.outputId}`,
            severity: 'high',
            issueType: 'missing_ai_label_metadata',
            reason: 'missing_ai_label_metadata',
            auditLogId: normalized.auditLogId,
            outputId: exportSummary.outputId,
            eventName: normalized.eventName,
            owningArea: owner.owningArea,
            owningFeatureArea: owner.owningArea,
            owningStory: owner.owningStory,
            message: 'AI label metadata missing for exported output evidence.',
          })
          gaps.push({
            auditLogId: normalized.auditLogId,
            eventName: normalized.eventName,
            reason: 'missing_ai_label_metadata',
            owner: owner.owningArea,
            owningArea: owner.owningArea,
            owningFeatureArea: owner.owningArea,
            owningStory: owner.owningStory,
            count: 1,
          })
        }
      }
    }

    const freshness = this.resolveFreshness(latestEventAt, now, gaps)
    if (freshness.status === 'delayed' && this.isTelemetryStale(latestEventAt, now)) {
      gaps.push({
        reason: 'telemetry_delayed',
        owner: 'audit_logging',
        owningArea: 'audit logging',
        owningFeatureArea: 'audit logging',
        owningStory: 'Story 1.4 event contract',
        source: 'audit_logs',
        latestEventAt: freshness.latestEventAt,
      })
    }
    const measurementStatus = freshness.status
    const summary = this.toSummary({
      measurementStatus,
      trustedEvents,
      malformedEvents,
      deniedActions,
      exportedOutputCount,
      exportsMissingAiLabelMetadata,
      complianceIssueCount: complianceIssues.length,
    })

    return {
      generatedAt,
      appliedFilters: filters.appliedFilters,
      summary,
      byEventType: this.shouldIncludeGroup(filters, 'eventType')
        ? this.toEventTypeGroups(byEventType, measurementStatus)
        : [],
      byOutcome: this.shouldIncludeGroup(filters, 'outcome')
        ? this.toOutcomeGroups(byOutcome, measurementStatus)
        : [],
      byActor: this.shouldIncludeGroup(filters, 'actor')
        ? this.toActorGroups(byActor, measurementStatus)
        : [],
      byWorkflow: this.shouldIncludeGroup(filters, 'workflow')
        ? this.toWorkflowGroups(byWorkflow, measurementStatus)
        : [],
      exportedOutputs: exportedOutputs.sort((left, right) =>
        left.outputId.localeCompare(right.outputId),
      ),
      complianceIssues,
      instrumentationGaps: gaps,
      freshness,
    }
  }

  private normalizeRow(
    row: AdvisoryGovernanceAuditLogRow,
    filters: NormalizedGovernanceFilters,
    now: Date,
    gaps: AdvisoryGovernanceInstrumentationGap[],
  ): NormalizedGovernanceEvent | null {
    const details = this.recordOrNull(row.details)
    if (!this.isCandidateInWindow(row, details, filters)) return null

    if (!details) {
      this.addGap(gaps, row.id, null, 'missing_event_details', 'audit_logging')
      return null
    }

    const eventNameText = this.readString(details.event_name) ?? this.readString(details.eventName)
    try {
      assertNoRawSensitiveThinkTankKeys(details)
    } catch {
      this.addGap(
        gaps,
        row.id,
        eventNameText ? this.redactUnknownEventName(eventNameText) : null,
        'privacy_unsafe_payload',
        'privacy_boundary',
      )
      return null
    }

    const fieldIssue = this.findContractFieldIssue(details)
    if (fieldIssue) {
      this.addGap(
        gaps,
        row.id,
        eventNameText ? this.redactUnknownEventName(eventNameText) : null,
        fieldIssue.reason,
        'story_1_4_event_contract',
        { field: fieldIssue.field },
      )
      return null
    }

    const camelOptionalField = this.findCamelOnlyOptionalField(details)
    if (camelOptionalField) {
      this.addGap(
        gaps,
        row.id,
        eventNameText ? this.redactUnknownEventName(eventNameText) : null,
        'event_contract_shape_mismatch',
        'story_1_4_event_contract',
        { field: camelOptionalField },
      )
      return null
    }

    if (!eventNameText || !GOVERNANCE_EVENT_NAME_SET.has(eventNameText)) {
      if (eventNameText && getThinkTankEventKind(eventNameText)) {
        return null
      }
      this.addGap(
        gaps,
        row.id,
        eventNameText ? this.redactUnknownEventName(eventNameText) : null,
        'unknown_event_name',
        'story_1_4_event_contract',
      )
      return null
    }

    const eventName = eventNameText as ThinkTankEventName
    const eventVersion = details.event_version
    if (eventVersion !== THINKTANK_EVENT_VERSION) {
      this.addGap(gaps, row.id, eventName, 'event_version_mismatch', 'story_1_4_event_contract', {
        expectedVersion: THINKTANK_EVENT_VERSION,
        actualVersion: this.safeDiagnosticValue(eventVersion),
      })
      return null
    }

    const eventAt = this.parseEventDate(details.occurred_at ?? details.occurredAt)
    if (!eventAt) {
      this.addGap(gaps, row.id, eventName, 'invalid_occurred_at', 'story_1_4_event_contract')
      return null
    }
    if (eventAt > now) {
      this.addGap(gaps, row.id, eventName, 'future_occurred_at', 'story_1_4_event_contract')
      return null
    }
    if (eventAt < filters.dateFrom || eventAt > filters.dateTo) return null

    const privacyClassification = this.readString(details.privacy_classification)
    if (privacyClassification !== ThinkTankPrivacyClassification.Operational) {
      this.addGap(
        gaps,
        row.id,
        eventName,
        'privacy_classification_not_operational',
        'story_1_4_event_contract',
      )
      return null
    }

    const eventTenantId = this.readString(details.tenant_id)
    if (eventTenantId !== filters.tenantId) {
      this.addGap(gaps, row.id, eventName, 'tenant_mismatch', 'story_1_4_event_contract')
      return null
    }

    const actorId = this.readString(details.actor_id) as string
    const outcome = this.readString(details.outcome) as string
    if (!GOVERNANCE_OUTCOME_SET.has(outcome)) {
      this.addGap(gaps, row.id, eventName, 'unknown_outcome', 'story_1_4_event_contract')
      return null
    }
    const workflowKey = this.safeDimensionValue(this.readWorkflowKey(details))
    if (filters.actorId && actorId !== filters.actorId) return null
    if (filters.eventType && eventName !== filters.eventType) return null
    if (filters.outcome && outcome !== filters.outcome) return null
    if (filters.workflowType && workflowKey !== filters.workflowType) return null

    return {
      auditLogId: row.id,
      eventName,
      eventAt,
      actorId: this.safeActorId(actorId),
      outcome: this.safeOutcome(outcome),
      workflowKey,
      subjectId: this.safeSubjectId(this.readString(details.subject_id) as string),
      outputId: this.readOutputId(details, row),
      aiLabelMetadataPresent: this.readAiLabelMetadataPresent(details),
    }
  }

  private normalizeFilters(query: AdvisoryGovernanceQuery): NormalizedGovernanceFilters {
    const now = query.now ?? new Date()
    const dateTo = this.normalizeDate(query.dateTo, 'to') ?? now
    const dateFrom =
      this.normalizeDate(query.dateFrom, 'from') ?? this.daysBefore(dateTo, DEFAULT_WINDOW_DAYS)
    const currentTenantId = this.readString(query.currentTenantId)
    const requestedTenantId = this.readString(query.tenantId)
    const actorTenantId = this.readString(query.actor?.tenantId)
    const scopedTenantId = currentTenantId ?? actorTenantId
    const tenantId = scopedTenantId ?? (requestedTenantId === 'current' ? null : requestedTenantId)
    const workflowType = this.normalizeDimensionFilter(query.workflowType, 'workflowType')
    const actorId = this.normalizeDimensionFilter(query.actorId, 'actorId')
    const eventType = this.normalizeEventTypeFilter(query.eventType)
    const outcome = this.normalizeOutcomeFilter(query.outcome)
    const groupBy = this.normalizeGroupBy(query.groupBy)
    const actorRole = this.readString(query.actor?.role)

    if (!tenantId) {
      throw new BadRequestException('tenantId is required for ThinkTank governance review.')
    }
    if (actorRole !== UserRole.ADMIN) {
      throw new ForbiddenException('当前账号无权查看 ThinkTank 治理审计数据。')
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
      workflowType,
      actorId,
      eventType,
      outcome,
      groupBy,
      appliedFilters: {
        tenantId,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
        ...(workflowType ? { workflowType } : {}),
        ...(actorId ? { actorId } : {}),
        ...(eventType ? { eventType } : {}),
        ...(outcome ? { outcome } : {}),
        ...(groupBy.length ? { groupBy } : {}),
      },
    }
  }

  private buildUnavailableDashboard(
    appliedFilters: AdvisoryGovernanceAppliedFilters,
    generatedAt: string,
  ): AdvisoryGovernanceDashboard {
    return {
      generatedAt,
      appliedFilters,
      summary: this.toSummary({
        measurementStatus: 'unavailable',
        trustedEvents: 0,
        malformedEvents: 0,
        deniedActions: 0,
        exportedOutputCount: 0,
        exportsMissingAiLabelMetadata: 0,
        complianceIssueCount: 0,
      }),
      byEventType: [],
      byOutcome: [],
      byActor: [],
      byWorkflow: [],
      exportedOutputs: [],
      complianceIssues: [],
      instrumentationGaps: [
        {
          reason: 'governance_source_unavailable',
          source: 'audit_logs',
          owner: 'audit_logging',
          owningArea: 'audit logging',
          owningFeatureArea: 'audit logging',
          owningStory: 'Story 1.4 event contract',
          message: 'Audit log source unavailable for governance review.',
        },
      ],
      freshness: {
        source: 'audit_logs',
        status: 'unavailable',
        latestEventAt: null,
        description:
          'Governance review source is unavailable. No trusted governance measurements are available.',
      },
    }
  }

  private toSummary(input: {
    measurementStatus: AdvisoryGovernanceSummary['measurementStatus']
    trustedEvents: number
    malformedEvents: number
    deniedActions: number
    exportedOutputCount: number
    exportsMissingAiLabelMetadata: number
    complianceIssueCount: number
  }): AdvisoryGovernanceSummary {
    const totalEvents = input.trustedEvents + input.malformedEvents
    const unavailable = input.measurementStatus === 'unavailable'
    return {
      measurementStatus: input.measurementStatus,
      totalEvents,
      trustedEvents: input.trustedEvents,
      malformedEvents: input.malformedEvents,
      deniedActions: input.deniedActions,
      exportedOutputs: input.exportedOutputCount,
      exportsMissingAiLabelMetadata: input.exportsMissingAiLabelMetadata,
      complianceIssueCount: input.complianceIssueCount,
      trustedEventRate: unavailable ? null : this.rate(input.trustedEvents, totalEvents),
      exportsMissingAiLabelRate: unavailable
        ? null
        : this.rate(input.exportsMissingAiLabelMetadata, input.exportedOutputCount),
    }
  }

  private addEventType(
    groups: Map<string, EventTypeAccumulator>,
    event: NormalizedGovernanceEvent,
  ): void {
    let group = groups.get(event.eventName)
    if (!group) {
      group = {
        eventName: event.eventName,
        count: 0,
        successCount: 0,
        failureCount: 0,
        deniedCount: 0,
        blockedCount: 0,
        partialCount: 0,
        latestEventAt: null,
      }
      groups.set(event.eventName, group)
    }
    group.count += 1
    group.latestEventAt = this.maxDate(group.latestEventAt, event.eventAt)
    if (event.outcome === 'success') group.successCount += 1
    else if (event.outcome === 'failure') group.failureCount += 1
    else if (event.outcome === 'denied') group.deniedCount += 1
    else if (event.outcome === 'blocked') group.blockedCount += 1
    else if (event.outcome === 'partial') group.partialCount += 1
  }

  private addOutcome(
    groups: Map<string, CountAccumulator>,
    event: NormalizedGovernanceEvent,
  ): void {
    const group = this.countGroup(groups, event.outcome)
    group.count += 1
    group.latestEventAt = this.maxDate(group.latestEventAt, event.eventAt)
  }

  private addActor(groups: Map<string, ActorAccumulator>, event: NormalizedGovernanceEvent): void {
    let group = groups.get(event.actorId)
    if (!group) {
      group = {
        actorId: event.actorId,
        count: 0,
        deniedCount: 0,
        exportedOutputCount: 0,
        latestEventAt: null,
      }
      groups.set(event.actorId, group)
    }
    group.count += 1
    if (event.outcome === 'denied') group.deniedCount += 1
    if (event.eventName === ThinkTankEventName.OutputExported) group.exportedOutputCount += 1
    group.latestEventAt = this.maxDate(group.latestEventAt, event.eventAt)
  }

  private addWorkflow(
    groups: Map<string, WorkflowAccumulator>,
    event: NormalizedGovernanceEvent,
  ): void {
    const workflowKey = event.workflowKey ?? 'unknown'
    let group = groups.get(workflowKey)
    if (!group) {
      group = {
        workflowKey,
        count: 0,
        deniedCount: 0,
        exportedOutputCount: 0,
        latestEventAt: null,
      }
      groups.set(workflowKey, group)
    }
    group.count += 1
    if (event.outcome === 'denied') group.deniedCount += 1
    if (event.eventName === ThinkTankEventName.OutputExported) group.exportedOutputCount += 1
    group.latestEventAt = this.maxDate(group.latestEventAt, event.eventAt)
  }

  private toEventTypeGroups(
    groups: Map<string, EventTypeAccumulator>,
    measurementStatus: AdvisoryGovernanceSummary['measurementStatus'],
  ): AdvisoryGovernanceEventTypeGroup[] {
    return [...groups.values()]
      .map((group) => {
        const owner = this.resolveOwner(group.eventName)
        return {
          eventName: group.eventName,
          eventType: group.eventName,
          label: group.eventName,
          count: group.count,
          successCount: group.successCount,
          failureCount: group.failureCount,
          deniedCount: group.deniedCount,
          blockedCount: group.blockedCount,
          partialCount: group.partialCount,
          latestEventAt: group.latestEventAt?.toISOString() ?? null,
          owningArea: owner.owningArea,
          owningFeatureArea: owner.owningArea,
          owningStory: owner.owningStory,
          measurementStatus,
        }
      })
      .sort((left, right) => left.eventName.localeCompare(right.eventName))
  }

  private toOutcomeGroups(
    groups: Map<string, CountAccumulator>,
    measurementStatus: AdvisoryGovernanceSummary['measurementStatus'],
  ): AdvisoryGovernanceOutcomeGroup[] {
    return [...groups.entries()]
      .map(([outcome, group]) => ({
        outcome,
        label: outcome,
        count: group.count,
        latestEventAt: group.latestEventAt?.toISOString() ?? null,
        measurementStatus,
      }))
      .sort((left, right) => left.outcome.localeCompare(right.outcome))
  }

  private toActorGroups(
    groups: Map<string, ActorAccumulator>,
    measurementStatus: AdvisoryGovernanceSummary['measurementStatus'],
  ): AdvisoryGovernanceActorGroup[] {
    return [...groups.values()]
      .map((group) => ({
        actorId: group.actorId,
        label: group.actorId,
        count: group.count,
        deniedCount: group.deniedCount,
        exportedOutputCount: group.exportedOutputCount,
        latestEventAt: group.latestEventAt?.toISOString() ?? null,
        measurementStatus,
      }))
      .sort((left, right) => left.actorId.localeCompare(right.actorId))
  }

  private toWorkflowGroups(
    groups: Map<string, WorkflowAccumulator>,
    measurementStatus: AdvisoryGovernanceSummary['measurementStatus'],
  ): AdvisoryGovernanceWorkflowGroup[] {
    return [...groups.values()]
      .map((group) => ({
        workflowKey: group.workflowKey,
        workflowLabel: this.toLabel(group.workflowKey),
        count: group.count,
        deniedCount: group.deniedCount,
        exportedOutputCount: group.exportedOutputCount,
        latestEventAt: group.latestEventAt?.toISOString() ?? null,
        measurementStatus,
      }))
      .sort((left, right) => left.workflowKey.localeCompare(right.workflowKey))
  }

  private toExportedOutput(event: NormalizedGovernanceEvent): AdvisoryGovernanceExportedOutput {
    const owner = this.resolveOwner(event.eventName)
    const outputId = event.outputId ?? event.subjectId
    const aiLabelMetadataPresent = event.aiLabelMetadataPresent === true
    return {
      outputId,
      eventName: event.eventName,
      occurredAt: event.eventAt.toISOString(),
      workflowKey: event.workflowKey,
      aiLabelMetadataPresent,
      complianceStatus: aiLabelMetadataPresent ? 'compliant' : 'compliance_issue',
      owningArea: owner.owningArea,
      owningStory: owner.owningStory,
    }
  }

  private resolveFreshness(
    latestEventAt: Date | null,
    now: Date,
    gaps: AdvisoryGovernanceInstrumentationGap[],
  ): AdvisoryGovernanceFreshness {
    if (!latestEventAt) {
      return {
        source: 'audit_logs',
        status: 'delayed',
        latestEventAt: null,
        description: 'No trusted governance events were found for this operational window.',
      }
    }
    if (gaps.length > 0) {
      return {
        source: 'audit_logs',
        status: 'delayed',
        latestEventAt: latestEventAt.toISOString(),
        description: 'Governance review contains instrumentation gaps. Treat results as partial.',
      }
    }
    if (this.isTelemetryStale(latestEventAt, now)) {
      return {
        source: 'audit_logs',
        status: 'delayed',
        latestEventAt: latestEventAt.toISOString(),
        description: 'Governance review is delayed. Treat these events as stale.',
      }
    }
    return {
      source: 'audit_logs',
      status: 'fresh',
      latestEventAt: latestEventAt.toISOString(),
      description: `Governance review is current through ${latestEventAt.toISOString()}.`,
    }
  }

  private addGap(
    gaps: AdvisoryGovernanceInstrumentationGap[],
    auditLogId: string,
    eventName: string | null,
    reason: string,
    ownerKey: string,
    extra: Partial<AdvisoryGovernanceInstrumentationGap> = {},
  ): void {
    const safeEventName = eventName ? this.redactUnknownEventName(eventName) : null
    const owner = this.resolveOwner(safeEventName ?? ownerKey)
    gaps.push({
      auditLogId,
      eventName: safeEventName,
      reason,
      owner: owner.owningArea,
      owningArea: owner.owningArea,
      owningFeatureArea: owner.owningArea,
      owningStory: owner.owningStory,
      ...extra,
    })
  }

  private resolveOwner(eventName: string | null): { owningArea: string; owningStory: string } {
    if (eventName === ThinkTankEventName.OutputExported) {
      return { owningArea: 'output export', owningStory: 'Story 2.9 output export' }
    }
    if (
      eventName === ThinkTankEventName.AccessDenied ||
      eventName === ThinkTankEventName.AccessOpened
    ) {
      return { owningArea: 'role access control', owningStory: 'Story 1.4 event contract' }
    }
    if (
      eventName?.startsWith('thinktank.module.') ||
      eventName === ThinkTankEventName.RoleAccessUpdated
    ) {
      return { owningArea: 'module configuration', owningStory: 'Story 1.2 tenant module access' }
    }
    if (eventName?.startsWith('thinktank.workflow.')) {
      return { owningArea: 'workflow telemetry', owningStory: 'Story 3.4 workflow completion' }
    }
    if (eventName?.startsWith('thinktank.quick_consult.')) {
      return {
        owningArea: 'quick consult telemetry',
        owningStory: 'Story 3.1 quick consult intake',
      }
    }
    if (
      eventName?.startsWith('thinktank.provider.') ||
      eventName?.startsWith('thinktank.prompt_cache.')
    ) {
      return { owningArea: 'provider gateway', owningStory: 'Story 1.5 provider gateway' }
    }
    if (eventName?.includes('feedback') || eventName?.includes('rating')) {
      return { owningArea: 'quality feedback', owningStory: 'Story 6.4 quality feedback analysis' }
    }
    if (eventName === 'privacy_boundary') {
      return { owningArea: 'privacy boundary', owningStory: 'Story 1.4 event contract' }
    }
    return { owningArea: 'audit logging', owningStory: 'Story 1.4 event contract' }
  }

  private findContractFieldIssue(
    details: Record<string, unknown>,
  ): { field: string; reason: 'missing_required_field' | 'event_contract_shape_mismatch' } | null {
    for (const field of REQUIRED_EVENT_FIELDS) {
      if (this.hasContractFieldValue(details[field])) continue
      const camelKey = field.replace(/_([a-z])/g, (_match, char: string) => char.toUpperCase())
      if (this.hasContractFieldValue(details[camelKey])) {
        return { field, reason: 'event_contract_shape_mismatch' }
      }
      return { field, reason: 'missing_required_field' }
    }
    return null
  }

  private findCamelOnlyOptionalField(details: Record<string, unknown>): string | null {
    const optionalFields = [
      ['output_id', 'outputId'],
      ['ai_label_metadata_present', 'aiLabelMetadataPresent'],
      ['ai_label_metadata', 'aiLabelMetadata'],
      ['workflow_type', 'workflowType'],
      ['workflow_key', 'workflowKey'],
    ] as const
    for (const [snakeKey, camelKey] of optionalFields) {
      if (details[snakeKey] === undefined && details[camelKey] !== undefined) {
        return snakeKey
      }
    }
    return null
  }

  private hasContractFieldValue(value: unknown): boolean {
    if (typeof value === 'string') return Boolean(value.trim())
    return value !== null && value !== undefined
  }

  private readWorkflowKey(details: Record<string, unknown>): string | null {
    return (
      this.readString(details.workflow_type) ??
      this.readString(details.workflowType) ??
      this.readString(details.workflow_key) ??
      this.readString(details.workflowKey)
    )
  }

  private readOutputId(
    details: Record<string, unknown>,
    row: AdvisoryGovernanceAuditLogRow,
  ): string | null {
    const candidate =
      this.readString(details.output_id) ?? this.readString(details.subject_id) ?? row.entityId
    return this.safeOutputId(candidate)
  }

  private readAiLabelMetadataPresent(details: Record<string, unknown>): boolean | null {
    const direct = details.ai_label_metadata_present ?? details.aiLabelMetadataPresent
    if (
      details.aiLabelMetadataPresent !== undefined &&
      details.ai_label_metadata_present === undefined
    ) {
      return null
    }
    if (direct === true) return true
    if (direct === false) return false
    const metadata = this.recordOrNull(details.ai_label_metadata ?? details.aiLabelMetadata)
    if (!metadata) return null
    return (
      metadata.visible_label === '[AI Generated]' ||
      metadata.visibleLabel === '[AI Generated]' ||
      metadata.ai_generated === true ||
      metadata.aiGenerated === true
    )
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

  private normalizeAllFilter(value: unknown): string | null {
    const text = this.readString(value)
    return text && text !== 'all' && text !== 'current' ? text : null
  }

  private normalizeDimensionFilter(value: unknown, fieldName: string): string | null {
    const text = this.normalizeAllFilter(value)
    if (!text) return null
    if (!this.isSafeDimensionFilterText(text)) {
      throw new BadRequestException(`Invalid ${fieldName} filter.`)
    }
    return text
  }

  private normalizeEventTypeFilter(value: unknown): ThinkTankEventName | null {
    const text = this.normalizeDimensionFilter(value, 'eventType')
    if (!text) return null
    if (!GOVERNANCE_EVENT_NAME_SET.has(text)) {
      throw new BadRequestException('Invalid eventType filter.')
    }
    return text as ThinkTankEventName
  }

  private normalizeOutcomeFilter(value: unknown): string | null {
    const text = this.normalizeDimensionFilter(value, 'outcome')
    if (!text) return null
    if (!GOVERNANCE_OUTCOME_SET.has(text)) {
      throw new BadRequestException('Invalid outcome filter.')
    }
    return text
  }

  private normalizeGroupBy(
    value: readonly AdvisoryGovernanceGroupBy[] | null | undefined,
  ): AdvisoryGovernanceGroupBy[] {
    if (!value?.length) return ['eventType', 'outcome', 'actor', 'workflow']
    const allowed = new Set<AdvisoryGovernanceGroupBy>([
      'eventType',
      'outcome',
      'actor',
      'workflow',
    ])
    return [...new Set(value.filter((item) => allowed.has(item)))]
  }

  private shouldIncludeGroup(
    filters: NormalizedGovernanceFilters,
    group: AdvisoryGovernanceGroupBy,
  ): boolean {
    return filters.groupBy.includes(group)
  }

  private isCandidateInWindow(
    row: AdvisoryGovernanceAuditLogRow,
    details: Record<string, unknown> | null,
    filters: NormalizedGovernanceFilters,
  ): boolean {
    const occurredAt = this.parseEventDate(details?.occurred_at ?? details?.occurredAt)
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
    if (boundary === 'to') parsed.setUTCHours(23, 59, 59, 999)
    return parsed
  }

  private countGroup(groups: Map<string, CountAccumulator>, key: string): CountAccumulator {
    let group = groups.get(key)
    if (!group) {
      group = { count: 0, latestEventAt: null }
      groups.set(key, group)
    }
    return group
  }

  private safeActorId(value: string): string {
    return this.isSafeDiagnosticText(value) ? value : 'redacted_actor'
  }

  private safeSubjectId(value: string): string {
    return this.isSafeDiagnosticText(value) ? value : 'redacted_subject'
  }

  private safeOutputId(value: string | null): string | null {
    if (!value) return null
    return this.isSafeDiagnosticText(value) ? value : 'redacted_output'
  }

  private safeOutcome(value: string): string {
    return this.isSafeDiagnosticText(value) ? value : 'unknown'
  }

  private safeDimensionValue(value: string | null): string | null {
    if (!value || !this.isSafeDiagnosticText(value)) return null
    return value
  }

  private safeDiagnosticValue(value: unknown): unknown {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'boolean') return value
    if (typeof value === 'string' && this.isSafeDiagnosticText(value)) return value
    if (value === null || value === undefined) return value
    return `[${Array.isArray(value) ? 'array' : typeof value}]`
  }

  private redactUnknownEventName(eventName: string): string {
    return /^thinktank\.[a-z0-9_.-]{1,96}$/i.test(eventName) &&
      !/PRIVATE_|raw|conversation|prompt|report|feedback|content|message/i.test(eventName)
      ? eventName
      : 'unregistered_thinktank_event'
  }

  private isSafeDiagnosticText(value: string): boolean {
    return Boolean(
      value &&
      value.length <= 128 &&
      !/PRIVATE_|raw[_\s-]*(conversation|content|prompt|report|feedback|provider|payload)|provider[_\s-]*(raw|payload)|cache[_\s-]*key|full[_\s-]*profile|conversation|prompt|message|report content|feedback/i.test(
        value,
      ),
    )
  }

  private isSafeDimensionFilterText(value: string): boolean {
    return this.isSafeDiagnosticText(value) && /^[a-z0-9][a-z0-9_.:-]{0,127}$/i.test(value)
  }

  private recordOrNull(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
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

  private rate(numerator: number, denominator: number): number | null {
    if (denominator <= 0) return null
    return Math.round((numerator / denominator) * 10000) / 10000
  }

  private toLabel(value: string): string {
    return value
      .split(/[-_]/g)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ')
  }
}
