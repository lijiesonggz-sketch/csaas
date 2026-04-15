import { apiFetch } from '../utils/api'

export type ObligationType = 'MANDATORY' | 'PROHIBITIVE' | 'RECOMMENDED'
export type ObligationStatus = 'ACTIVE' | 'INACTIVE'
export type ObligationCoverage = 'FULL' | 'PARTIAL'
export type ApplicableSector = '银行' | '证券' | '保险' | '基金' | '期货' | '通用'
export type ControlPointOriginType =
  | 'case_derived'
  | 'regulation_derived'
  | 'both'
  | 'candidate'
  | 'manual'
  | (string & {})

export interface ObligationSummary {
  obligationId: string
  obligationCode: string
  obligationText: string
  obligationType: ObligationType
  applicableSector: ApplicableSector[]
  status: ObligationStatus
  createdAt?: string
  updatedAt?: string
}

export interface RegulationClauseSummary {
  clauseId: string
  sourceId: string
  clauseCode: string
  articleNo?: string | null
  sectionPath?: string | null
  clauseText: string
  clauseSummary?: string | null
  mandatoryLevel?: string | null
  keywords?: string[] | null
}

export interface ObligationDetail extends ObligationSummary {
  clause: {
    clauseId: string
    clauseCode: string
    articleNo?: string | null
    sectionPath?: string | null
    clauseText: string
    clauseSummary?: string | null
    source?: {
      sourceId: string
      sourceCode: string
      sourceName: string
      sourceLevel?: string | null
      authorityName?: string | null
    } | null
  } | null
  controlMaps: Array<{
    id: string
    controlId: string
    controlCode: string
    controlName: string
    coverage: ObligationCoverage
    originType?: string | null
    maturityLevel?: string | null
    authoritativeScore?: number | null
  }>
}

export interface ObligationCoverageBlindSpot {
  obligationId: string
  obligationCode: string
  obligationText: string
  obligationType: ObligationType
  applicableSector: ApplicableSector[]
  clause: {
    clauseId: string
    clauseCode: string
    articleNo?: string | null
    clauseSummary?: string | null
  } | null
  source: {
    sourceId: string
    sourceCode: string
    sourceName: string
  } | null
}

export interface ObligationCoverageAnalysis {
  totals: {
    obligations: number
    covered: number
    uncovered: number
    coverageRate: number
  }
  originDistribution: Record<ControlPointOriginType, number>
  sectorCoverage: Array<{
    sector: ApplicableSector
    obligations: number
    covered: number
    coverageRate: number
  }>
  blindSpots: ObligationCoverageBlindSpot[]
}

export interface ObligationsPage {
  items: ObligationSummary[]
  total: number
  page: number
  limit: number
}

export interface RegulationClausesPage {
  items: RegulationClauseSummary[]
  total: number
  page: number
  limit: number
}

export interface ObligationListParams {
  page?: number
  limit?: number
  obligationType?: ObligationType
  status?: ObligationStatus
  applicableSector?: ApplicableSector
  keyword?: string
}

export interface RegulationClauseSearchParams {
  page?: number
  limit?: number
  keyword?: string
  sourceId?: string
  mandatoryLevel?: string
}

export interface CreateObligationPayload {
  clauseId: string
  obligationCode: string
  obligationText: string
  obligationType: ObligationType
  applicableSector?: ApplicableSector[]
  status?: ObligationStatus
}

export interface UpdateObligationPayload {
  obligationText?: string
  obligationType?: ObligationType
  applicableSector?: ApplicableSector[]
  status?: ObligationStatus
}

export interface CreateObligationControlMapPayload {
  controlId: string
  coverage: ObligationCoverage
  notes?: string | null
}

function buildQueryString(params: Record<string, string | number | undefined>) {
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

function extractSourceAbbreviation(clauseCode: string) {
  const match = clauseCode.match(/^CLAUSE-([A-Z0-9]+)-/)
  return match?.[1] ?? 'GEN'
}

function normalizeArticleNo(articleNo?: string | null) {
  const normalized = articleNo?.trim().replace(/[^\d.]/g, '')
  return normalized && normalized.length > 0 ? normalized : '00'
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const NO_STORE: RequestInit = { cache: 'no-store' }

export function suggestObligationCode(input: {
  clauseCode: string
  articleNo?: string | null
  existingCodes: string[]
}) {
  const sourceAbbreviation = extractSourceAbbreviation(input.clauseCode)
  const articleNo = normalizeArticleNo(input.articleNo)
  const pattern = new RegExp(
    `^OBL-${escapeRegExp(sourceAbbreviation)}-${escapeRegExp(articleNo)}-(\\d{2})$`,
  )

  const serials = input.existingCodes
    .map((code) => pattern.exec(code)?.[1])
    .filter((value): value is string => Boolean(value))
    .map((value) => Number(value))

  const nextSerial = serials.length > 0 ? Math.max(...serials) + 1 : 1
  return `OBL-${sourceAbbreviation}-${articleNo}-${String(nextSerial).padStart(2, '0')}`
}

export function listObligations(params: ObligationListParams = {}) {
  const queryString = buildQueryString({
    page: params.page,
    limit: params.limit,
    obligationType: params.obligationType,
    status: params.status,
    applicableSector: params.applicableSector,
    keyword: params.keyword,
  })

  return apiFetch(
    `/api/admin/knowledge-graph/obligations${queryString}`,
    NO_STORE,
  ) as Promise<ObligationsPage>
}

export function getObligation(obligationId: string) {
  return apiFetch(
    `/api/admin/knowledge-graph/obligations/${obligationId}`,
    NO_STORE,
  ) as Promise<ObligationDetail>
}

export function getObligationCoverageAnalysis() {
  return apiFetch(
    '/api/admin/knowledge-graph/obligations/coverage-analysis',
    NO_STORE,
  ) as Promise<ObligationCoverageAnalysis>
}

export function searchRegulationClauses(params: RegulationClauseSearchParams = {}) {
  const queryString = buildQueryString({
    page: params.page,
    limit: params.limit,
    keyword: params.keyword,
    sourceId: params.sourceId,
    mandatoryLevel: params.mandatoryLevel,
  })

  return apiFetch(
    `/api/admin/knowledge-graph/regulation-clauses${queryString}`,
    NO_STORE,
  ) as Promise<RegulationClausesPage>
}

export function createObligation(payload: CreateObligationPayload) {
  return apiFetch('/api/admin/knowledge-graph/obligations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<ObligationSummary>
}

export function updateObligation(obligationId: string, payload: UpdateObligationPayload) {
  return apiFetch(`/api/admin/knowledge-graph/obligations/${obligationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<ObligationSummary>
}

export function createObligationControlMap(
  obligationId: string,
  payload: CreateObligationControlMapPayload,
) {
  return apiFetch(`/api/admin/knowledge-graph/obligations/${obligationId}/control-maps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<{ id: string; controlId: string; coverage: ObligationCoverage }>
}

export function deleteObligationControlMap(obligationId: string, mapId: string) {
  return apiFetch(
    `/api/admin/knowledge-graph/obligations/${obligationId}/control-maps/${mapId}`,
    {
      method: 'DELETE',
    },
  ) as Promise<{ success: true; id: string }>
}
