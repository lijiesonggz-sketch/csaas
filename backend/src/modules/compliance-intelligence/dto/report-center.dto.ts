import type {
  ReportCenterSortBy,
  ReportCenterSortOrder,
  ReportCenterStatus,
} from './report-center-query.dto'
import type { ControlReportGapLevel } from './compile-control-report.dto'

export interface ReportCenterProjectSummaryDto {
  clientName: string | null
  standardName: string | null
  projectStatus: string
}

export interface ReportCenterGapHighlightDto {
  clusterId: string
  clusterName: string
  gap: number
}

export interface ReportCenterGapSummaryDto {
  overallMaturity: number | null
  overallGrade: string | null
  topShortcomings: ReportCenterGapHighlightDto[]
}

export interface ReportCenterRiskSummaryDto {
  conflictSeverity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH'
  conflictCount: number
  topRiskClusters: string[]
}

export interface ReportCenterAvailableActionsDto {
  viewReport: boolean
}

export interface ReportCenterItemDto {
  projectId: string
  projectName: string
  organizationId: string | null
  reportId: string | null
  reportStatus: ReportCenterStatus
  latestSurveyResponseId: string | null
  generatedAt: string | null
  updatedAt: string
  projectSummary: ReportCenterProjectSummaryDto
  gapSummary: ReportCenterGapSummaryDto
  riskSummary: ReportCenterRiskSummaryDto
  emptyStateReason: string | null
  availableActions: ReportCenterAvailableActionsDto
}

export interface ReportCenterSummaryDto {
  totalItems: number
  readyCount: number
  notReadyCount: number
  failedCount: number
}

export interface ReportCenterFiltersAppliedDto {
  projectId?: string
  status?: ReportCenterStatus[]
  dateFrom?: string
  dateTo?: string
  sortBy: ReportCenterSortBy
  sortOrder: ReportCenterSortOrder
}

export interface ReportCenterListResponseDto {
  items: ReportCenterItemDto[]
  summary: ReportCenterSummaryDto
  filtersApplied: ReportCenterFiltersAppliedDto
}

export interface RemediationPriorityItemDto {
  rank: number
  controlId: string
  remediationActionId: string | null
  controlCode: string
  controlName: string
  l1Code: string
  l1Name: string
  l2Code: string
  l2Name: string
  riskLevel: ControlReportGapLevel
  difficultyLevel: 'low' | 'medium' | 'high' | 'unknown'
  priorityScore: number
  statusLabel: string
  title: string
  description: string | null
  expectedBenefit: string | null
}

export interface RemediationPriorityListDto {
  reportId: string
  items: RemediationPriorityItemDto[]
}
