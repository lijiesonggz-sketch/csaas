import { apiFetch } from '../utils/api'

export type ControlPointType = 'governance' | 'preventive' | 'detective' | 'corrective'
export type ControlPointRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type ControlPointStatus = 'ACTIVE' | 'INACTIVE'
export type ControlPointOriginType =
  | 'case_derived'
  | 'regulation_derived'
  | 'both'
  | 'candidate'
  | 'manual'
export type ControlPointMaturityLevel = 'hard' | 'draft-hard' | 'candidate' | 'retired'
export type ApplicableSector = '银行' | '证券' | '保险' | '基金' | '期货' | '通用'
export type EvidenceRequiredLevel = 'OPTIONAL' | 'RECOMMENDED' | 'REQUIRED'
export type EvidenceFrequency =
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'ANNUALLY'
  | 'EVENT_TRIGGERED'
export type EvidenceSamplingRequirement = 'FULL' | 'SAMPLING' | 'KEY_SAMPLE'
export type QuestionItemType = 'YES_NO' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'RATING' | 'TEXT'
export type QuestionItemStatus = 'ACTIVE' | 'INACTIVE'
export type RemediationPriority = 'HIGH' | 'MEDIUM' | 'LOW'
export type RemediationEffort = 'LOW' | 'MEDIUM' | 'HIGH'
export type RemediationStatus = 'ACTIVE' | 'INACTIVE'
export type ControlPackItemRole = 'INCLUDE' | 'REFERENCE' | 'MONITOR'
export type ClauseControlMappingType = 'direct' | 'supporting' | 'interpretive'
export type MapReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface ControlPointRecord {
  controlId: string
  controlCode: string
  controlName: string
  controlDesc?: string | null
  aliases?: string[] | null
  keywords?: string[] | null
  canonicalTheme?: string | null
  l1Code: string
  l2Code: string
  controlFamily: string
  controlType: ControlPointType
  mandatoryDefault: boolean
  riskLevelDefault: ControlPointRiskLevel
  ownerRoleHint?: string[] | null
  status: ControlPointStatus
  createdAt: string
  updatedAt: string
  originType?: ControlPointOriginType | null
  maturityLevel?: ControlPointMaturityLevel | null
  authoritativeScore?: number | null
  applicableSector?: ApplicableSector[]
  sectorRequirements?: Record<string, Record<string, unknown>> | null
  authorityProfileJson?: {
    has_source_basis?: boolean
    has_applicability_scope?: boolean
    has_control_activity?: boolean
    has_expected_evidence?: boolean
    has_human_review?: boolean
    has_case_validation?: boolean
  } | null
}

export interface ControlPointListParams {
  page?: number
  limit?: number
  status?: ControlPointStatus
  keyword?: string
  l1Code?: string
  l2Code?: string
  controlFamily?: string
  originType?: ControlPointOriginType | ControlPointOriginType[]
  maturityLevel?: ControlPointMaturityLevel | ControlPointMaturityLevel[]
  applicableSector?: ApplicableSector | ApplicableSector[]
  failureModeId?: string
}

export interface ControlPointsPage {
  items: ControlPointRecord[]
  total: number
  page: number
  limit: number
}

export interface CreateControlPointPayload {
  controlCode: string
  controlName: string
  controlDesc?: string | null
  aliases?: string[] | null
  keywords?: string[] | null
  canonicalTheme?: string | null
  l1Code: string
  l2Code: string
  controlFamily: string
  controlType: ControlPointType
  mandatoryDefault: boolean
  riskLevelDefault: ControlPointRiskLevel
  ownerRoleHint?: string[] | null
  status?: ControlPointStatus
}

export type UpdateControlPointPayload = Partial<CreateControlPointPayload>

export interface UpdateControlPointStatusPayload {
  status: ControlPointStatus
}

export interface EvidenceTypeSummary {
  evidenceId: string
  evidenceCode: string
  evidenceName: string
  evidenceDesc?: string | null
  evidenceCategory?: string | null
  status?: string | null
  autoCollectable?: boolean
}

export interface EvidenceTypesPage {
  items: EvidenceTypeSummary[]
  total: number
  page: number
  limit: number
}

export interface ControlPointEvidence {
  id: string
  evidenceId: string
  evidenceCode: string
  evidenceName: string
  evidenceDesc?: string | null
  evidenceCategory?: string | null
  status?: string | null
  requiredLevel: EvidenceRequiredLevel
  frequency?: EvidenceFrequency | null
  ownerRole?: string | null
  samplingRequirement?: EvidenceSamplingRequirement | null
  notes?: string | null
}

export interface ControlPointEvidenceResponse {
  controlId: string
  evidences: ControlPointEvidence[]
}

export interface SearchEvidenceTypeParams {
  page?: number
  limit?: number
  keyword?: string
}

export interface CreateControlEvidenceMapPayload {
  controlId: string
  evidenceId: string
  requiredLevel?: EvidenceRequiredLevel
  frequency?: EvidenceFrequency | null
  ownerRole?: string | null
  samplingRequirement?: EvidenceSamplingRequirement | null
  notes?: string | null
}

export interface QuestionItemRecord {
  questionId: string
  controlId?: string
  questionCode: string
  questionText: string
  questionType: QuestionItemType
  answerSchema?: Record<string, unknown> | null
  scoringRule?: Record<string, unknown> | null
  required?: boolean
  status?: QuestionItemStatus
}

export interface QuestionItemsResponse {
  controlId: string
  questions: QuestionItemRecord[]
}

export interface QuestionItemsPage {
  items: QuestionItemRecord[]
  total: number
  page: number
  limit: number
}

export interface SearchQuestionItemParams {
  page?: number
  limit?: number
  controlId?: string
  keyword?: string
}

export interface CreateQuestionItemPayload {
  controlId: string
  questionCode: string
  questionText: string
  questionType: QuestionItemType
  roleHint?: string[] | null
  answerSchema?: Record<string, unknown> | null
  scoringRule?: Record<string, unknown> | null
  applicableTags?: string[] | null
  required?: boolean
  status?: QuestionItemStatus
}

export type UpdateQuestionItemPayload = Partial<CreateQuestionItemPayload>

export interface RemediationActionRecord {
  actionId: string
  controlId?: string
  actionCode: string
  actionTitle: string
  actionDesc?: string | null
  priorityDefault?: RemediationPriority | null
  effortLevel?: RemediationEffort | null
  expectedBenefit?: string | null
  outputTemplate?: Record<string, unknown> | null
  status?: RemediationStatus
}

export interface RemediationsResponse {
  controlId: string
  remediations: RemediationActionRecord[]
}

export interface CreateRemediationActionPayload {
  controlId: string
  actionCode: string
  actionTitle: string
  actionDesc?: string | null
  priorityDefault?: RemediationPriority
  effortLevel?: RemediationEffort | null
  expectedBenefit?: string | null
  ownerRoleHint?: string[] | null
  outputTemplate?: Record<string, unknown> | null
  status?: RemediationStatus
}

export type UpdateRemediationActionPayload = Partial<CreateRemediationActionPayload>

export interface ControlPackItemRecord {
  id: string
  packId: string
  packCode: string
  packName?: string | null
  packType?: string | null
  packVersion?: string | null
  itemRole?: ControlPackItemRole
  priority?: number | null
}

export interface ControlPackItemsPage {
  items: ControlPackItemRecord[]
  total: number
  page: number
  limit: number
}

export interface ControlPointPackLinksResponse {
  controlId: string
  items: ControlPackItemRecord[]
}

export interface ControlPackCatalogItem {
  packId: string
  packCode: string
  packName?: string | null
  packType?: string | null
  packVersion?: string | null
}

export interface CreateControlPackItemPayload {
  packId: string
  controlId: string
  itemRole?: ControlPackItemRole
  priority?: number
}

export interface RegulatoryLinkObligation {
  id: string
  obligationId: string
  obligationCode: string
  obligationText: string
  obligationType?: string | null
  coverage?: string | null
  linkSource: 'obligation'
  clause?: {
    clauseId?: string
    clauseCode?: string
    articleNo?: string | null
  } | null
}

export interface RegulatoryLinkClause {
  id: string
  clauseId: string
  clauseCode: string
  articleNo?: string | null
  sectionPath?: string | null
  clauseText: string
  clauseSummary?: string | null
  mandatoryLevel?: string | null
  mappingType?: ClauseControlMappingType | null
  reviewStatus?: MapReviewStatus | null
  confidenceScore?: number | string | null
  linkSource: 'clause'
  source?: {
    sourceId?: string
    sourceCode?: string
    sourceName?: string
    sourceLevel?: string | null
    authorityName?: string | null
  } | null
}

export interface RegulatoryLinkCase {
  caseId?: string
  caseCode?: string
  caseTitle?: string
  relationType?: string | null
  confidenceScore?: string | null
}

export interface ControlPointRegulatoryLinksResponse {
  controlId: string
  obligations: RegulatoryLinkObligation[]
  clauses: RegulatoryLinkClause[]
  cases: RegulatoryLinkCase[]
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

export interface RegulationClausesPage {
  items: RegulationClauseSummary[]
  total: number
  page: number
  limit: number
}

export interface SearchRegulationClauseParams {
  page?: number
  limit?: number
  keyword?: string
  sourceId?: string
  mandatoryLevel?: string
}

export interface CreateClauseControlMapPayload {
  clauseId: string
  controlId: string
  mappingType: ClauseControlMappingType
  confidenceScore?: number | null
  reviewStatus?: MapReviewStatus
  reviewerId?: string | null
  notes?: string | null
}

const NO_STORE: RequestInit = { cache: 'no-store' }

function appendQueryValue(query: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null || value === '') {
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item) => appendQueryValue(query, key, item))
    return
  }

  query.append(key, String(value))
}

function buildQueryString(
  params: Record<string, string | number | boolean | string[] | undefined | null>,
) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => appendQueryValue(query, key, value))

  const queryString = query.toString()
  return queryString ? `?${queryString}` : ''
}

export function listControlPoints(params: ControlPointListParams = {}) {
  const queryString = buildQueryString({
    page: params.page,
    limit: params.limit,
    status: params.status,
    keyword: params.keyword,
    l1Code: params.l1Code,
    l2Code: params.l2Code,
    controlFamily: params.controlFamily,
    originType: params.originType,
    maturityLevel: params.maturityLevel,
    applicableSector: params.applicableSector,
    failureModeId: params.failureModeId,
  })

  return apiFetch(`/api/admin/knowledge-graph/control-points${queryString}`, NO_STORE) as Promise<
    ControlPointsPage
  >
}

export function getControlPoint(controlId: string) {
  return apiFetch(
    `/api/admin/knowledge-graph/control-points/${encodeURIComponent(controlId)}`,
    NO_STORE,
  ) as Promise<ControlPointRecord>
}

export function createControlPoint(payload: CreateControlPointPayload) {
  return apiFetch('/api/admin/knowledge-graph/control-points', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<ControlPointRecord>
}

export function updateControlPoint(controlId: string, payload: UpdateControlPointPayload) {
  return apiFetch(`/api/admin/knowledge-graph/control-points/${encodeURIComponent(controlId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<ControlPointRecord>
}

export function updateControlPointStatus(
  controlId: string,
  payload: UpdateControlPointStatusPayload,
) {
  return apiFetch(
    `/api/admin/knowledge-graph/control-points/${encodeURIComponent(controlId)}/status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  ) as Promise<ControlPointRecord>
}

export function getControlPointEvidences(controlId: string) {
  return apiFetch(
    `/api/admin/knowledge-graph/control-points/${encodeURIComponent(controlId)}/evidences`,
    NO_STORE,
  ) as Promise<ControlPointEvidenceResponse>
}

export function searchEvidenceTypes(params: SearchEvidenceTypeParams = {}) {
  const queryString = buildQueryString({
    page: params.page ?? 1,
    limit: params.limit ?? 10,
    keyword: params.keyword,
  })

  return apiFetch(`/api/admin/knowledge-graph/evidence-types${queryString}`, NO_STORE) as Promise<
    EvidenceTypesPage
  >
}

export function createControlEvidenceMap(payload: CreateControlEvidenceMapPayload) {
  return apiFetch('/api/admin/knowledge-graph/control-evidence-maps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<ControlPointEvidence>
}

export function deleteControlEvidenceMap(id: string) {
  return apiFetch(`/api/admin/knowledge-graph/control-evidence-maps/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }) as Promise<{ success: true; id: string }>
}

export function getControlPointQuestions(controlId: string) {
  return apiFetch(
    `/api/admin/knowledge-graph/control-points/${encodeURIComponent(controlId)}/questions`,
    NO_STORE,
  ) as Promise<QuestionItemsResponse>
}

export function searchQuestionItems(params: SearchQuestionItemParams = {}) {
  const queryString = buildQueryString({
    page: params.page ?? 1,
    limit: params.limit ?? 10,
    controlId: params.controlId,
    keyword: params.keyword,
  })

  return apiFetch(`/api/admin/knowledge-graph/question-items${queryString}`, NO_STORE) as Promise<
    QuestionItemsPage
  >
}

export function createQuestionItem(payload: CreateQuestionItemPayload) {
  return apiFetch('/api/admin/knowledge-graph/question-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<QuestionItemRecord>
}

export function updateQuestionItem(questionId: string, payload: UpdateQuestionItemPayload) {
  return apiFetch(`/api/admin/knowledge-graph/question-items/${encodeURIComponent(questionId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<QuestionItemRecord>
}

export function getControlPointRemediations(controlId: string) {
  return apiFetch(
    `/api/admin/knowledge-graph/control-points/${encodeURIComponent(controlId)}/remediations`,
    NO_STORE,
  ) as Promise<RemediationsResponse>
}

export function createRemediationAction(payload: CreateRemediationActionPayload) {
  return apiFetch('/api/admin/knowledge-graph/remediation-actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<RemediationActionRecord>
}

export function updateRemediationAction(
  actionId: string,
  payload: UpdateRemediationActionPayload,
) {
  return apiFetch(`/api/admin/knowledge-graph/remediation-actions/${encodeURIComponent(actionId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<RemediationActionRecord>
}

export function listControlPackItems(params: {
  page?: number
  limit?: number
  packId?: string
  controlId?: string
  itemRole?: ControlPackItemRole
} = {}) {
  const queryString = buildQueryString({
    page: params.page,
    limit: params.limit,
    packId: params.packId,
    controlId: params.controlId,
    itemRole: params.itemRole,
  })

  return apiFetch(`/api/admin/knowledge-graph/control-pack-items${queryString}`, NO_STORE) as Promise<
    ControlPackItemsPage
  >
}

export function getControlPointPackLinks(controlId: string) {
  return apiFetch(
    `/api/admin/knowledge-graph/control-points/${encodeURIComponent(controlId)}/pack-links`,
    NO_STORE,
  ) as Promise<ControlPointPackLinksResponse>
}

export function listControlPackCatalog() {
  return apiFetch('/api/admin/knowledge-graph/control-packs', NO_STORE) as Promise<
    ControlPackCatalogItem[]
  >
}

export function createControlPackItem(payload: CreateControlPackItemPayload) {
  return apiFetch('/api/admin/knowledge-graph/control-pack-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<ControlPackItemRecord>
}

export function deleteControlPackItem(id: string) {
  return apiFetch(`/api/admin/knowledge-graph/control-pack-items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }) as Promise<{ success: true; id: string }>
}

export function getControlPointRegulatoryLinks(controlId: string) {
  return apiFetch(
    `/api/admin/knowledge-graph/control-points/${encodeURIComponent(controlId)}/regulatory-links`,
    NO_STORE,
  ) as Promise<ControlPointRegulatoryLinksResponse>
}

export function searchRegulationClauses(params: SearchRegulationClauseParams = {}) {
  const queryString = buildQueryString({
    page: params.page ?? 1,
    limit: params.limit ?? 10,
    keyword: params.keyword,
    sourceId: params.sourceId,
    mandatoryLevel: params.mandatoryLevel,
  })

  return apiFetch(`/api/admin/knowledge-graph/regulation-clauses${queryString}`, NO_STORE) as Promise<
    RegulationClausesPage
  >
}

export function createClauseControlMap(payload: CreateClauseControlMapPayload) {
  return apiFetch('/api/admin/knowledge-graph/clause-control-maps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<RegulatoryLinkClause>
}

export function deleteClauseControlMap(id: string) {
  return apiFetch(`/api/admin/knowledge-graph/clause-control-maps/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }) as Promise<{ success: true; id: string }>
}
