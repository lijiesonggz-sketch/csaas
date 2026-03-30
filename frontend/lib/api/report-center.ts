import { apiFetch } from '@/lib/utils/api'
import type { ControlReportSectionDto } from '@/lib/types/report'

export type ReportCenterStatus =
  | 'not_ready'
  | 'ready_to_generate'
  | 'generating'
  | 'ready'
  | 'failed'

export interface ReportCenterGapHighlight {
  clusterId: string
  clusterName: string
  gap: number
}

export interface ReportCenterItem {
  projectId: string
  projectName: string
  organizationId: string | null
  reportId: string | null
  reportStatus: ReportCenterStatus
  latestSurveyResponseId: string | null
  generatedAt: string | null
  updatedAt: string
  projectSummary: {
    clientName: string | null
    standardName: string | null
    projectStatus: string
  }
  gapSummary: {
    overallMaturity: number | null
    overallGrade: string | null
    topShortcomings: ReportCenterGapHighlight[]
  }
  riskSummary: {
    conflictSeverity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH'
    conflictCount: number
    topRiskClusters: string[]
  }
  emptyStateReason: string | null
  availableActions: {
    viewReport: boolean
  }
}

export interface ReportCenterResponse {
  items: ReportCenterItem[]
  summary: {
    totalItems: number
    readyCount: number
    notReadyCount: number
    failedCount: number
  }
  filtersApplied: {
    projectId?: string
    status?: ReportCenterStatus[]
    dateFrom?: string
    dateTo?: string
    sortBy: 'updatedAt' | 'generatedAt' | 'projectName' | 'reportStatus'
    sortOrder: 'asc' | 'desc'
  }
}

export interface GetReportCenterParams {
  projectId?: string
  status?: ReportCenterStatus[]
  dateFrom?: string
  dateTo?: string
  sortBy?: 'updatedAt' | 'generatedAt' | 'projectName' | 'reportStatus'
  sortOrder?: 'asc' | 'desc'
}

export async function getReportCenter(
  params: GetReportCenterParams = {},
): Promise<ReportCenterResponse> {
  const searchParams = new URLSearchParams()

  if (params.projectId) {
    searchParams.set('projectId', params.projectId)
  }

  params.status?.forEach((status) => searchParams.append('status', status))

  if (params.dateFrom) {
    searchParams.set('dateFrom', params.dateFrom)
  }

  if (params.dateTo) {
    searchParams.set('dateTo', params.dateTo)
  }

  if (params.sortBy) {
    searchParams.set('sortBy', params.sortBy)
  }

  if (params.sortOrder) {
    searchParams.set('sortOrder', params.sortOrder)
  }

  const query = searchParams.toString()
  return apiFetch<ReportCenterResponse>(
    `/compliance-intelligence/report-center${query ? `?${query}` : ''}`,
  )
}

export interface ReportCenterDetailResponse {
  sections: ControlReportSectionDto[]
}

export async function getReportDetail(reportId: string): Promise<ReportCenterDetailResponse> {
  return apiFetch<ReportCenterDetailResponse>(`/compliance-intelligence/report-center/${reportId}`)
}
