import { apiFetch } from '../utils/api'

export type ComplianceCaseStatus =
  | 'pending'
  | 'extracted'
  | 'clustered'
  | 'reviewed'
  | 'active'
  | 'inactive'

export type MapReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type CaseControlRelationType = 'VIOLATES' | 'RELATED' | 'SUPPORTS'
export type CaseControlMapSource = 'RULE' | 'LLM_ASSISTED_RULE' | 'LLM_FALLBACK' | 'MANUAL'

export interface ComplianceCaseSummary {
  caseId: string
  caseCode: string
  regulatorCode: string | null
  caseTitle: string | null
  sourceOrg: string | null
  penalizedPerson: string | null
  industry: string | null
  region: string | null
  caseDate: string | null
  authorityName: string | null
  penaltyType: string[] | null
  caseFacts: string | null
  penaltyReason: string | null
  rawSourceUrl: string | null
  rawContentId: string | null
  l1Code: string | null
  l2Code: string | null
  confidenceScore: string | null
  importBatchId: string | null
  status: ComplianceCaseStatus
  humanReviewed: boolean
  reviewedBy: string | null
  reviewedAt: string | null
  extractedAt?: string | null
  clusteredAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface ComplianceCaseClauseCandidate {
  clauseId: string
  clauseCode: string
  summary: string | null
  matchedKeywords: string[]
  confidenceScore: number
}

export interface ComplianceCaseControlPointCandidate {
  controlName: string
  sourceTheme: string
  confidenceScore: number
  reason: string
}

export interface ComplianceCaseControlMapDraft {
  id: string
  controlId: string
  controlCode?: string
  controlName?: string
  relationType: CaseControlRelationType
  reviewStatus: MapReviewStatus
  confidenceScore: string | null
  source: CaseControlMapSource
}

export interface ComplianceCaseExtractionResult {
  caseId: string
  caseCode: string
  status: ComplianceCaseStatus
  violationThemes: string[]
  clauseCandidates: ComplianceCaseClauseCandidate[]
  extractedAt: string | null
}

export interface ComplianceCaseClusteringResult {
  caseId: string
  caseCode: string
  status: ComplianceCaseStatus
  normalizedThemes: string[]
  candidateControlPoints: ComplianceCaseControlPointCandidate[]
  clusteredAt: string | null
  humanReviewed: boolean
  reviewedBy: string | null
  reviewedAt: string | null
  caseControlMapDrafts: ComplianceCaseControlMapDraft[]
}

export interface ComplianceCasesPage {
  items: ComplianceCaseSummary[]
  total: number
  page: number
  limit: number
}

export interface ComplianceCaseListParams {
  page?: number
  limit?: number
  batchId?: string
  regulatorCode?: string
  status?: ComplianceCaseStatus
  keyword?: string
}

export interface ComplianceCaseImportPayload {
  file: File
  regulatorCode: string
  batchId?: string
}

export interface ComplianceCaseImportJobResult {
  jobId: string
  batchId: string
  fileName: string
  regulatorCode: string
  status: 'queued'
}

export interface ManualCaseControlMappingPayload {
  controlId: string
  relationType?: CaseControlRelationType
  confidenceScore?: number
}

export interface ComplianceCaseHumanReviewPayload {
  approvedMapIds?: string[]
  rejectedMapIds?: string[]
  manualMappings?: ManualCaseControlMappingPayload[]
}

export interface ComplianceCaseHumanReviewResult {
  caseId: string
  status: 'reviewed'
  humanReviewed: true
  reviewedBy: string
  reviewedAt: string
  approvedCount: number
  rejectedCount: number
  manualMappingCount: number
}

export interface ControlPointSummary {
  controlId: string
  controlCode: string
  controlName: string
  controlDesc: string | null
  aliases?: string[] | null
  keywords?: string[] | null
  canonicalTheme?: string | null
  l1Code: string
  l2Code: string
  controlFamily: string
  controlType: string
  mandatoryDefault: boolean
  riskLevelDefault: string
  ownerRoleHint: string[] | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface ControlPointSearchParams {
  page?: number
  limit?: number
  status?: string
  keyword?: string
}

export interface ControlPointsPage {
  items: ControlPointSummary[]
  total: number
  page: number
  limit: number
}

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') {
      return
    }
    query.append(key, String(value))
  })

  const queryString = query.toString()
  return queryString ? `?${queryString}` : ''
}

const NO_STORE_REQUEST: RequestInit = {
  cache: 'no-store',
}

export async function getComplianceCases(
  params: ComplianceCaseListParams = {},
): Promise<ComplianceCasesPage> {
  const queryString = buildQueryString({
    page: params.page,
    limit: params.limit,
    batchId: params.batchId,
    regulatorCode: params.regulatorCode,
    status: params.status,
    keyword: params.keyword,
  })

  return apiFetch(`/api/admin/knowledge-graph/compliance-cases${queryString}`, NO_STORE_REQUEST)
}

export async function enqueueComplianceCaseImport(
  payload: ComplianceCaseImportPayload,
): Promise<ComplianceCaseImportJobResult> {
  const formData = new FormData()
  formData.append('file', payload.file)
  formData.append('regulatorCode', payload.regulatorCode)

  if (payload.batchId) {
    formData.append('batchId', payload.batchId)
  }

  return apiFetch('/api/admin/knowledge-graph/cases/import', {
    method: 'POST',
    body: formData,
  })
}

export async function getComplianceCaseExtraction(
  caseId: string,
): Promise<ComplianceCaseExtractionResult> {
  return apiFetch(
    `/api/admin/knowledge-graph/compliance-cases/${caseId}/extraction`,
    NO_STORE_REQUEST,
  )
}

export async function getComplianceCaseClustering(
  caseId: string,
): Promise<ComplianceCaseClusteringResult> {
  return apiFetch(
    `/api/admin/knowledge-graph/compliance-cases/${caseId}/clustering`,
    NO_STORE_REQUEST,
  )
}

export async function submitComplianceCaseHumanReview(
  caseId: string,
  payload: ComplianceCaseHumanReviewPayload,
): Promise<ComplianceCaseHumanReviewResult> {
  return apiFetch(`/api/admin/knowledge-graph/compliance-cases/${caseId}/human-review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export async function searchControlPoints(
  params: ControlPointSearchParams = {},
): Promise<ControlPointsPage> {
  const queryString = buildQueryString({
    page: params.page,
    limit: params.limit,
    status: params.status,
    keyword: params.keyword,
  })

  return apiFetch(`/api/admin/knowledge-graph/control-points${queryString}`, NO_STORE_REQUEST)
}
