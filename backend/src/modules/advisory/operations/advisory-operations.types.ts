import { AuditLog } from '../../../database/entities/audit-log.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { ThinkTankEventName } from '../events/thinktank-event-contract'

export const THINKTANK_USAGE_EVENT_NAMES = [
  ThinkTankEventName.WorkflowStarted,
  ThinkTankEventName.WorkflowStartFailed,
  ThinkTankEventName.WorkflowCompleted,
  ThinkTankEventName.QuickConsultStarted,
  ThinkTankEventName.QuickConsultCompleted,
  ThinkTankEventName.QuickConsultFailed,
  ThinkTankEventName.PartyModeBudgetExceeded,
  ThinkTankEventName.PartyModeAdvisorFailed,
] as const

export type ThinkTankUsageEventName = (typeof THINKTANK_USAGE_EVENT_NAMES)[number]
export type AdvisoryOperationsMeasurementStatus = 'fresh' | 'delayed' | 'unavailable'

export interface AdvisoryOperationsActor {
  id: string
  role?: UserRole | string | null
  tenantId?: string | null
  organizationId?: string | null
}

export interface AdvisoryOperationsUsageQuery {
  tenantId?: string | null
  currentTenantId?: string | null
  dateFrom?: string | Date | null
  dateTo?: string | Date | null
  workflowType?: string | null
  actor?: AdvisoryOperationsActor | null
  now?: Date
}

export interface AdvisoryOperationsUsageEventQuery {
  tenantId: string
  dateFrom: Date
  dateTo: Date
  eventNames: readonly string[]
}

export type AdvisoryOperationsAuditLogRow = Pick<
  AuditLog,
  'id' | 'tenantId' | 'userId' | 'entityType' | 'entityId' | 'details' | 'createdAt'
>

export interface AdvisoryOperationsAuditLogSource {
  findThinkTankUsageEvents(
    query: AdvisoryOperationsUsageEventQuery,
  ): Promise<AdvisoryOperationsAuditLogRow[]>
}

export interface AdvisoryOperationsAppliedFilters {
  tenantId: string
  dateFrom: string
  dateTo: string
  workflowType?: string
}

export interface AdvisoryOperationsInstrumentationGap {
  auditLogId?: string
  eventName?: string
  reason: string
  owner?: string
  source?: string
  expectedVersion?: number
  actualVersion?: unknown
  latestEventAt?: string | null
  count?: number
}

export interface AdvisoryOperationsFreshness {
  source: 'audit_logs'
  status: AdvisoryOperationsMeasurementStatus
  latestEventAt: string | null
  description: string
}

export interface AdvisoryOperationsWorkflowDrilldown {
  starts: number
  completions: number
  startFailures: number
  incompleteSessions: number
  eventCounts: Record<string, number>
}

export interface AdvisoryOperationsWorkflowUsage {
  workflowKey: string
  workflowLabel: string
  trendPeriod: {
    dateFrom: string
    dateTo: string
  }
  starts: number
  completions: number
  startFailures: number
  incompleteSessions: number
  completionRate: number | null
  lowCompletion: boolean
  threshold: number
  drilldown: AdvisoryOperationsWorkflowDrilldown
}

export interface AdvisoryOperationsSummary {
  quickConsult: {
    started: number
    completed: number
    failed: number
    volume: number
  }
  workflows: {
    started: number
    completed: number
    startFailed: number
    incomplete: number
    completionRate: number | null
  }
  partyMode: {
    budgetExceeded: number
    advisorFailed: number
  }
  measurementStatus: AdvisoryOperationsMeasurementStatus
}

export interface AdvisoryOperationsUsageDashboard {
  generatedAt: string
  appliedFilters: AdvisoryOperationsAppliedFilters
  summary: AdvisoryOperationsSummary
  usageByWorkflowType: AdvisoryOperationsWorkflowUsage[]
  lowCompletionWorkflows: AdvisoryOperationsWorkflowUsage[]
  instrumentationGaps: AdvisoryOperationsInstrumentationGap[]
  freshness: AdvisoryOperationsFreshness
}
