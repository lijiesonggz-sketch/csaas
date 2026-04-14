import { apiFetch } from '@/lib/utils/api'

export type ControlDetailSourceModule = 'audit' | 'radar' | 'report'

export interface ControlDetailContext {
  organizationId: string
  controlId: string
  sourceModule: ControlDetailSourceModule
  sourceRecordId?: string
}

export interface ControlExplainClause {
  clauseCode?: string
  articleNo?: string
  clauseText?: string
}

export interface ControlExplainCase {
  caseCode?: string
  caseTitle?: string
}

export interface ControlExplainEvidence {
  evidenceCode?: string
  evidenceName?: string
  category?: string
  requiredLevel?: string
  description?: string
}

export interface ControlExplainQuestion {
  questionId?: string
  questionText?: string
  questionType?: string
  scoringRule?: string
  required?: boolean
}

export interface ControlExplainRemediation {
  remediationActionId?: string
  title?: string
  description?: string
  priority?: string
}

export interface ControlExplainGovernance {
  originType?: string | null
  maturityLevel?: string | null
  authoritativeScore?: number | null
  authorityProfile?: {
    has_source_basis?: boolean
    has_applicability_scope?: boolean
    has_control_activity?: boolean
    has_expected_evidence?: boolean
    has_human_review?: boolean
    has_case_validation?: boolean
  } | null
  applicableSector?: string[]
  sectorRequirements?: Record<string, Record<string, unknown>> | null
}

export interface ControlExplainFailureMode {
  failureModeId?: string
  failureModeCode?: string
  name?: string
  category?: string
  relevance?: string
}

export interface ControlExplainObligationClause {
  clauseId?: string
  clauseCode?: string
  articleNo?: string | null
}

export interface ControlExplainObligation {
  obligationId?: string
  obligationCode?: string
  obligationText?: string
  obligationType?: string | null
  coverage?: string | null
  clause?: ControlExplainObligationClause | null
}

export interface ControlExplainReasoningChain {
  l2?: {
    code?: string | null
    name?: string | null
  } | null
  cases?: Array<{
    caseCode?: string | null
    caseTitle?: string | null
  }>
  failureModes?: Array<{
    failureModeId?: string
    failureModeCode?: string
    name?: string
    relevance?: string
  }>
  selectedControl?: {
    controlId?: string
    controlCode?: string
    controlName?: string
    maturityLevel?: string | null
    authoritativeScore?: number | null
  } | null
  evidenceTypes?: Array<{
    evidenceId?: string
    evidenceCode?: string
    evidenceName?: string
    evidenceCategory?: string | null
    autoCollectable?: boolean
    requiredLevel?: string
    frequency?: string | null
  }>
}

export interface ControlExplainResponse {
  control: {
    controlId?: string
    controlCode: string
    controlName: string
    controlDesc?: string
    l1?: {
      code?: string | null
      name?: string | null
    }
    l2?: {
      code?: string | null
      name?: string | null
    }
  }
  governance?: ControlExplainGovernance | null
  applicabilityReason: string
  failureModes?: ControlExplainFailureMode[]
  obligations?: ControlExplainObligation[]
  reasoningChain?: ControlExplainReasoningChain | null
  clauses: ControlExplainClause[]
  cases: ControlExplainCase[]
  evidences: ControlExplainEvidence[]
  questions: ControlExplainQuestion[]
  remediations: ControlExplainRemediation[]
}

export interface ControlExplainErrorState {
  kind: 'permission' | 'generic'
  message: string
  retryable: boolean
  leakedDataKeys?: string[]
}

const REQUIRED_CONTEXT_ERROR = 'controlId and organizationId are required for control detail drawer'
const UNAVAILABLE_CONTROL_ERROR_PATTERN = /(control[_ -]?point|control).*(not found|removed|disabled)|\b(gone|removed|disabled)\b/i

export function buildControlExplainPath(input: {
  controlId: string
  organizationId: string
}): string {
  const controlId = input.controlId?.trim()
  const organizationId = input.organizationId?.trim()

  if (!controlId || !organizationId) {
    throw new Error(REQUIRED_CONTEXT_ERROR)
  }

  return `/compliance-intelligence/control-explain/${encodeURIComponent(controlId)}?organizationId=${encodeURIComponent(
    organizationId,
  )}`
}

export async function getControlExplain(input: {
  controlId: string
  organizationId: string
}): Promise<ControlExplainResponse> {
  const path = buildControlExplainPath(input)
  return apiFetch(path)
}

function isUnavailableControlError(status: number | undefined, message: string): boolean {
  if (status === 410) {
    return true
  }

  return status === 404 && UNAVAILABLE_CONTROL_ERROR_PATTERN.test(message)
}

export function normalizeControlExplainError(error: unknown): ControlExplainErrorState {
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: number }).status)
    : undefined
  const message = typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message?: string }).message)
    : ''

  if (status === 401 || status === 403) {
    return {
      kind: 'permission',
      message: '您没有权限查看该控制点详情',
      retryable: true,
      leakedDataKeys: [],
    }
  }

  if (isUnavailableControlError(status, message)) {
    return {
      kind: 'generic',
      message: '该控制点已移除或停用',
      retryable: false,
    }
  }

  if (message === REQUIRED_CONTEXT_ERROR) {
    return {
      kind: 'generic',
      message: '缺少控制点上下文，无法加载详情',
      retryable: false,
    }
  }

  return {
    kind: 'generic',
    message: '控制点详情加载失败，请重试',
    retryable: true,
  }
}
