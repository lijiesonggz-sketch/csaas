import { apiFetch } from '../utils/api'
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
  const response = await apiFetch(
    `/api/admin/knowledge-graph/reasoning-chain/${l2Code}`,
    {
      cache: 'no-store',
    }
  )
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
