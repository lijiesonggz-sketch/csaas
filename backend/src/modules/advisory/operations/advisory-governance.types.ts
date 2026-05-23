import { AuditLog } from '../../../database/entities/audit-log.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { THINKTANK_GOVERNANCE_EVENT_NAMES } from '../events/thinktank-governance-events'

export { THINKTANK_GOVERNANCE_EVENT_NAMES }

export type AdvisoryGovernanceMeasurementStatus = 'fresh' | 'delayed' | 'unavailable'
export type AdvisoryGovernanceGroupBy = 'eventType' | 'outcome' | 'actor' | 'workflow'
export type AdvisoryGovernanceComplianceStatus = 'compliant' | 'compliance_issue'
export type AdvisoryGovernanceComplianceSeverity = 'high' | 'medium' | 'low'

export interface AdvisoryGovernanceActor {
  id: string
  role?: UserRole | string | null
  tenantId?: string | null
  organizationId?: string | null
}

export interface AdvisoryGovernanceQuery {
  tenantId?: string | null
  currentTenantId?: string | null
  dateFrom?: string | Date | null
  dateTo?: string | Date | null
  workflowType?: string | null
  actorId?: string | null
  eventType?: string | null
  outcome?: string | null
  groupBy?: readonly AdvisoryGovernanceGroupBy[] | null
  actor?: AdvisoryGovernanceActor | null
  now?: Date
}

export interface AdvisoryGovernanceEventQuery {
  tenantId: string
  dateFrom: Date
  dateTo: Date
  eventNames: readonly string[]
  workflowType?: string | null
  actorId?: string | null
  eventType?: string | null
  outcome?: string | null
}

export type AdvisoryGovernanceAuditLogRow = Pick<
  AuditLog,
  'id' | 'tenantId' | 'userId' | 'entityType' | 'entityId' | 'details' | 'createdAt'
>

export interface AdvisoryGovernanceAuditLogSource {
  findThinkTankGovernanceEvents(
    query: AdvisoryGovernanceEventQuery,
  ): Promise<AdvisoryGovernanceAuditLogRow[]>
}

export interface AdvisoryGovernanceAppliedFilters {
  tenantId: string
  dateFrom: string
  dateTo: string
  workflowType?: string
  actorId?: string
  eventType?: string
  outcome?: string
  groupBy?: AdvisoryGovernanceGroupBy[]
}

export interface AdvisoryGovernanceInstrumentationGap {
  auditLogId?: string
  eventName?: string | null
  reason: string
  owner?: string
  owningArea?: string
  owningFeatureArea?: string
  owningStory?: string
  source?: string
  expectedVersion?: number
  actualVersion?: unknown
  latestEventAt?: string | null
  count?: number | null
  field?: string
  message?: string
}

export interface AdvisoryGovernanceFreshness {
  source: 'audit_logs'
  status: AdvisoryGovernanceMeasurementStatus
  latestEventAt: string | null
  description: string
}

export interface AdvisoryGovernanceSummary {
  measurementStatus: AdvisoryGovernanceMeasurementStatus
  totalEvents: number
  trustedEvents: number
  malformedEvents: number
  deniedActions: number
  exportedOutputs: number
  exportsMissingAiLabelMetadata: number
  complianceIssueCount: number
  trustedEventRate: number | null
  exportsMissingAiLabelRate: number | null
}

export interface AdvisoryGovernanceEventTypeGroup {
  eventName: string
  eventType: string
  label: string
  count: number
  successCount: number
  failureCount: number
  deniedCount: number
  blockedCount: number
  partialCount: number
  latestEventAt: string | null
  owningArea: string
  owningFeatureArea: string
  owningStory: string
  measurementStatus: AdvisoryGovernanceMeasurementStatus
}

export interface AdvisoryGovernanceOutcomeGroup {
  outcome: string
  label: string
  count: number
  latestEventAt: string | null
  measurementStatus: AdvisoryGovernanceMeasurementStatus
}

export interface AdvisoryGovernanceActorGroup {
  actorId: string
  label: string
  count: number
  deniedCount: number
  exportedOutputCount: number
  latestEventAt: string | null
  measurementStatus: AdvisoryGovernanceMeasurementStatus
}

export interface AdvisoryGovernanceWorkflowGroup {
  workflowKey: string
  workflowLabel: string
  count: number
  deniedCount: number
  exportedOutputCount: number
  latestEventAt: string | null
  measurementStatus: AdvisoryGovernanceMeasurementStatus
}

export interface AdvisoryGovernanceExportedOutput {
  outputId: string
  eventName: string
  occurredAt: string
  workflowKey: string | null
  aiLabelMetadataPresent: boolean
  complianceStatus: AdvisoryGovernanceComplianceStatus
  owningArea: string
  owningStory: string
}

export interface AdvisoryGovernanceComplianceIssue {
  id: string
  severity: AdvisoryGovernanceComplianceSeverity
  issueType: string
  reason: string
  auditLogId?: string
  outputId?: string
  eventName?: string
  owningArea: string
  owningFeatureArea: string
  owningStory: string
  message: string
}

export interface AdvisoryGovernanceDashboard {
  generatedAt: string
  appliedFilters: AdvisoryGovernanceAppliedFilters
  summary: AdvisoryGovernanceSummary
  byEventType: AdvisoryGovernanceEventTypeGroup[]
  byOutcome: AdvisoryGovernanceOutcomeGroup[]
  byActor: AdvisoryGovernanceActorGroup[]
  byWorkflow: AdvisoryGovernanceWorkflowGroup[]
  exportedOutputs: AdvisoryGovernanceExportedOutput[]
  complianceIssues: AdvisoryGovernanceComplianceIssue[]
  instrumentationGaps: AdvisoryGovernanceInstrumentationGap[]
  freshness: AdvisoryGovernanceFreshness
}
