import type { CompileControlReportResponseDto } from './compile-control-report.dto'
import type {
  ReportCenterGapSummaryDto,
  ReportCenterProjectSummaryDto,
  ReportCenterRiskSummaryDto,
} from './report-center.dto'

export type ReportPdfJobStatus = 'queued' | 'rendering' | 'ready' | 'failed'

export interface ReportPdfJobDto {
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

export interface ReportPdfQueueJobData {
  pdfJobId: string
}

export interface ReportPdfRenderContext {
  reportId: string
  projectName: string
  generatedAt: string
  projectSummary: ReportCenterProjectSummaryDto
  gapSummary: ReportCenterGapSummaryDto
  riskSummary: ReportCenterRiskSummaryDto
  sections: CompileControlReportResponseDto['sections']
}
