import { apiFetch } from '../utils/api'

export type FailureModeCategory =
  | 'DEFINITION_ERROR'
  | 'MAPPING_ERROR'
  | 'MISSING_CONTROL'
  | 'TIMELINESS_FAILURE'
  | 'INTEGRITY_FAILURE'
  | 'UNAUTHORIZED_ACTION'
  | 'FALSIFICATION'

export type FailureModeStatus = 'ACTIVE' | 'INACTIVE'
export type FailureModeControlRelevance = 'PRIMARY' | 'SECONDARY'

export interface FailureModeSummary {
  failureModeId: string
  failureModeCode: string
  name: string
  description?: string | null
  category: FailureModeCategory
  status: FailureModeStatus
  createdAt?: string
  updatedAt?: string
}

export interface FailureModeDetail extends FailureModeSummary {
  taxonomyMaps: Array<{
    id: string
    l2Code: string
    l2Name: string | null
    notes?: string | null
  }>
  controlMaps: Array<{
    id: string
    controlId: string
    controlCode: string
    controlName: string
    relevance: FailureModeControlRelevance
    maturityLevel?: string | null
    authoritativeScore?: number | null
  }>
}

export interface FailureModeListResponse {
  items: FailureModeSummary[]
  total: number
  page: number
  limit: number
}

export interface FailureModeListParams {
  page?: number
  limit?: number
  category?: FailureModeCategory
  status?: FailureModeStatus
  keyword?: string
}

export interface CreateFailureModePayload {
  failureModeCode: string
  name: string
  description?: string | null
  category: FailureModeCategory
  status?: FailureModeStatus
}

export interface UpdateFailureModePayload {
  failureModeCode?: string
  name?: string
  description?: string | null
  category?: FailureModeCategory
  status?: FailureModeStatus
}

export interface CreateTaxonomyFailureModeMapPayload {
  l2Code: string
  notes?: string | null
}

export interface CreateFailureModeControlMapPayload {
  controlId: string
  relevance: FailureModeControlRelevance
  notes?: string | null
}

export interface TaxonomyTreeNode {
  l1Code: string
  l1Name: string
  sortOrder: number
  children: Array<{
    l2Code: string
    l2Name: string
    l1Code: string
    sortOrder?: number
    status?: string
  }>
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

const NO_STORE: RequestInit = { cache: 'no-store' }

export function listFailureModes(params: FailureModeListParams = {}) {
  const queryString = buildQueryString({
    page: params.page,
    limit: params.limit,
    category: params.category,
    status: params.status,
    keyword: params.keyword,
  })

  return apiFetch(`/api/admin/knowledge-graph/failure-modes${queryString}`, NO_STORE) as Promise<FailureModeListResponse>
}

export function getFailureMode(failureModeId: string) {
  return apiFetch(`/api/admin/knowledge-graph/failure-modes/${failureModeId}`, NO_STORE) as Promise<FailureModeDetail>
}

export function createFailureMode(payload: CreateFailureModePayload) {
  return apiFetch('/api/admin/knowledge-graph/failure-modes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<FailureModeSummary>
}

export function updateFailureMode(failureModeId: string, payload: UpdateFailureModePayload) {
  return apiFetch(`/api/admin/knowledge-graph/failure-modes/${failureModeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<FailureModeSummary>
}

export function createFailureModeTaxonomyMap(
  failureModeId: string,
  payload: CreateTaxonomyFailureModeMapPayload,
) {
  return apiFetch(`/api/admin/knowledge-graph/failure-modes/${failureModeId}/taxonomy-maps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<{ id: string; l2Code: string; notes?: string | null }>
}

export function deleteFailureModeTaxonomyMap(failureModeId: string, mapId: string) {
  return apiFetch(`/api/admin/knowledge-graph/failure-modes/${failureModeId}/taxonomy-maps/${mapId}`, {
    method: 'DELETE',
  }) as Promise<{ success: true; id: string }>
}

export function createFailureModeControlMap(
  failureModeId: string,
  payload: CreateFailureModeControlMapPayload,
) {
  return apiFetch(`/api/admin/knowledge-graph/failure-modes/${failureModeId}/control-maps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<{ id: string; controlId: string; relevance: FailureModeControlRelevance }>
}

export function deleteFailureModeControlMap(failureModeId: string, mapId: string) {
  return apiFetch(`/api/admin/knowledge-graph/failure-modes/${failureModeId}/control-maps/${mapId}`, {
    method: 'DELETE',
  }) as Promise<{ success: true; id: string }>
}

export function getTaxonomyTree() {
  return apiFetch('/api/admin/knowledge-graph/taxonomy/tree?status=ACTIVE', NO_STORE) as Promise<TaxonomyTreeNode[]>
}

