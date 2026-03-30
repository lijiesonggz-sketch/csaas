import { apiFetch, getAuthToken } from '@/lib/utils/api'
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

export type ReportPdfJobStatus = 'queued' | 'rendering' | 'ready' | 'failed'

export interface ReportPdfJob {
  pdfJobId: string
  reportId: string
  status: ReportPdfJobStatus
  fileName: string | null
  fileSizeBytes: number | null
  downloadUrl: string | null
  errorSummary: string | null
  expiresAt: string
  startedAt: string | null
  completedAt: string | null
  failedAt: string | null
  createdAt: string
  updatedAt: string
}

export async function createReportPdfJob(reportId: string): Promise<ReportPdfJob> {
  return apiFetch<ReportPdfJob>(`/compliance-intelligence/report-center/${reportId}/pdf-jobs`, {
    method: 'POST',
  })
}

export async function getLatestReportPdfJob(reportId: string): Promise<ReportPdfJob | null> {
  return apiFetch<ReportPdfJob | null>(
    `/compliance-intelligence/report-center/${reportId}/pdf-jobs/latest`,
  )
}

export async function getReportPdfJob(reportId: string, pdfJobId: string): Promise<ReportPdfJob> {
  return apiFetch<ReportPdfJob>(
    `/compliance-intelligence/report-center/${reportId}/pdf-jobs/${pdfJobId}`,
  )
}

export async function downloadReportPdf(reportId: string, pdfJobId: string): Promise<void> {
  const token = await getAuthToken()
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || ''}/compliance-intelligence/report-center/${reportId}/pdf-jobs/${pdfJobId}/download`,
    {
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : undefined,
    },
  )

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'PDF 下载失败' }))
    const error = new Error(body.message || 'PDF 下载失败') as Error & { status?: number }
    error.status = response.status
    throw error
  }

  const blob = await response.blob()
  const contentDisposition = response.headers.get('Content-Disposition') ?? ''
  const fileNameMatch = contentDisposition.match(/filename="(.+?)"/i)
  const fileName = fileNameMatch?.[1] ?? `control-report-${reportId.slice(0, 8)}.pdf`
  const downloadUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = downloadUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(downloadUrl)
}
