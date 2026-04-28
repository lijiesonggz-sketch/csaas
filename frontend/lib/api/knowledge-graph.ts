import { apiFetch, clearTokenCache, getAuthToken } from '../utils/api'
import type { FailureModeCategory, FailureModeControlRelevance } from './failure-modes'
import type { ObligationType, ObligationCoverage } from './obligations'

export interface TaxonomyTreeL2 {
  l2Code: string
  l2Name: string
  failureModeCount: number
}

export interface TaxonomyTreeL1 {
  l1Code: string
  l1Name: string
  children: TaxonomyTreeL2[]
}

export interface ReasoningChainFailureMode {
  failureModeId: string
  failureModeCode: string
  name: string
  category: FailureModeCategory
  controlPointCount: number
}

export interface ReasoningChainControlPoint {
  controlId: string
  controlCode: string
  controlName: string
  maturityLevel: string
  authoritativeScore: number
  originType: string
  failureModeRelevance: FailureModeControlRelevance
  failureModeId: string
}

export interface ReasoningChainObligation {
  obligationId: string
  obligationCode: string
  obligationText: string
  obligationType: ObligationType
  controlId: string
  coverage: ObligationCoverage
}

export interface ReasoningChainData {
  taxonomy: {
    l1Code: string
    l1Name: string
    l2Code: string
    l2Name: string
  }
  failureModes: ReasoningChainFailureMode[]
  controlPoints: ReasoningChainControlPoint[]
  obligations: ReasoningChainObligation[]
}

export interface RegulationSourceSummary {
  sourceId: string
  sourceCode: string
  sourceName: string
  sourceLevel?: string | null
  authorityName?: string | null
  sourceStatus?: string | null
  clauseCount?: number
  obligationCount?: number
  controlPointCount?: number
}

export interface RegulationSourcePage {
  items: RegulationSourceSummary[]
  total: number
  page: number
  limit: number
}

export interface RegulationGraphClause {
  clauseId: string
  clauseCode: string
  articleNo?: string | null
  sectionPath?: string | null
  clauseText: string
  clauseSummary?: string | null
  mandatoryLevel?: string | null
  obligationCount: number
  controlPointCount: number
}

export interface RegulationGraphObligation {
  obligationId: string
  obligationCode: string
  obligationText: string
  obligationType: ObligationType
  applicableSector: string[]
  clauseId: string
  clauseCode: string
  clauseSummary?: string | null
  controlPointCount: number
}

export interface RegulationGraphControlPoint {
  edgeId: string
  controlId: string
  controlCode: string
  controlName: string
  maturityLevel?: string | null
  authoritativeScore?: number | null
  originType?: string | null
  applicableSector: string[]
  coverage: ObligationCoverage
  obligationId: string
  obligationCode: string
  clauseId: string
  clauseCode: string
}

export interface RegulationGraphData {
  source: Required<
    Pick<
      RegulationSourceSummary,
      'sourceId' | 'sourceCode' | 'sourceName' | 'sourceLevel' | 'authorityName'
    >
  > & {
    clauseCount: number
    obligationCount: number
    controlPointCount: number
  }
  clauses: RegulationGraphClause[]
  obligations: RegulationGraphObligation[]
  controlPoints: RegulationGraphControlPoint[]
}

export interface TaxonomyGovernanceDomainSummary {
  l1Code: string
  l1Name: string
  catalogL2Count: number
  runtimeProfileCount: number
  rulebookEntryCount: number
  mappingSourceVersion: string | null
  rulebookVersion: string | null
  fallbackBucket: string | null
  readinessStage: string | null
}

export interface TaxonomyGovernanceSummary {
  generatedAt: string
  sourceVersion: string | null
  domains: TaxonomyGovernanceDomainSummary[]
}

export interface TaxonomyRuntimeProfileImportResult {
  sourceVersion: string
  importedRowCount: number
  cacheRefreshed: boolean
  replacedSnapshot: boolean
}

function buildQueryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') return
    query.append(key, String(value))
  })
  const queryString = query.toString()
  return queryString ? `?${queryString}` : ''
}

/**
 * 获取 IT 分类树
 */
export async function getTaxonomyTree(): Promise<TaxonomyTreeL1[]> {
  const response = await apiFetch('/api/admin/knowledge-graph/taxonomy/tree', {
    cache: 'no-store',
  })
  return response
}

/**
 * 获取完整推理链路数据
 * @param l2Code IT L2 分类代码（如 "IT04-02"）
 */
export async function getReasoningChain(l2Code: string): Promise<ReasoningChainData> {
  const response = await apiFetch(`/api/admin/knowledge-graph/reasoning-chain/${l2Code}`, {
    cache: 'no-store',
  })
  return response
}

export async function listRegulationSources(params?: {
  page?: number
  limit?: number
  keyword?: string
  sourceStatus?: string
}): Promise<RegulationSourcePage> {
  const queryString = buildQueryString({
    page: params?.page,
    limit: params?.limit,
    keyword: params?.keyword,
    sourceStatus: params?.sourceStatus,
  })
  return apiFetch(`/api/admin/knowledge-graph/regulation-sources${queryString}`, {
    cache: 'no-store',
  }) as Promise<RegulationSourcePage>
}

export async function getRegulationGraph(sourceId: string): Promise<RegulationGraphData> {
  return apiFetch(`/api/admin/knowledge-graph/regulation-graph/${sourceId}`, {
    cache: 'no-store',
  }) as Promise<RegulationGraphData>
}

export async function getTaxonomyGovernanceSummary(): Promise<TaxonomyGovernanceSummary> {
  return apiFetch('/api/admin/knowledge-graph/taxonomy-governance/summary', {
    cache: 'no-store',
  }) as Promise<TaxonomyGovernanceSummary>
}

export async function importTaxonomyRuntimeProfile(
  file: File,
  sourceVersion: string
): Promise<TaxonomyRuntimeProfileImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('sourceVersion', sourceVersion)

  return apiFetch('/api/admin/knowledge-graph/taxonomy-governance/runtime-profile/import', {
    method: 'POST',
    body: formData,
  }) as Promise<TaxonomyRuntimeProfileImportResult>
}

export async function exportTaxonomyRuntimeProfile(): Promise<void> {
  const requestUrl = `${process.env.NEXT_PUBLIC_API_URL || ''}/api/admin/knowledge-graph/taxonomy-governance/runtime-profile/export`
  const headers = new Headers()
  const token = await getAuthToken()

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response = await fetch(requestUrl, {
    method: 'GET',
    headers,
  })

  if (response.status === 401) {
    clearTokenCache()
    const refreshedToken = await getAuthToken(true)

    if (refreshedToken && refreshedToken !== token) {
      headers.set('Authorization', `Bearer ${refreshedToken}`)
      response = await fetch(requestUrl, {
        method: 'GET',
        headers,
      })
    }
  }

  if (!response.ok) {
    throw new Error('导出 Runtime Profile 失败')
  }

  const blob = await response.blob()
  const contentDisposition = response.headers.get('content-disposition') ?? ''
  const fileNameMatch = contentDisposition.match(/filename=\"?([^"]+)\"?/)
  const fileName = fileNameMatch?.[1] ?? 'taxonomy-runtime-profile.csv'
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(anchor)
}
