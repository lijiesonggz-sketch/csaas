import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import { normalizeThinkTankCheckpointWarning, type ThinkTankCheckpointWarning } from './checkpoints'
import { readAdvisoryMessage, unwrapAdvisoryEnvelope } from './envelope'

export const THINKTANK_WORKFLOW_START_FAILED_MESSAGE =
  '暂时无法启动该 ThinkTank 工作流，请稍后重试或选择其他工作流。'
export const THINKTANK_EMPTY_MESSAGE_MESSAGE = '请输入你的回答后再提交。'
export const THINKTANK_MESSAGE_TOO_LONG_MESSAGE = '内容过长，请精简到 5000 字符以内。'
export const THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE =
  '暂时无法生成 ThinkTank 顾问回复，请稍后重试。'
export const THINKTANK_MESSAGE_MAX_LENGTH = 5000
const EXPECTED_THINKTANK_WORKFLOW_KEYS = [
  'brainstorming',
  'domain-research',
  'market-research',
  'product-brief',
  'prd',
  'problem-solving',
  'design-thinking',
  'storytelling',
] as const

export interface ThinkTankWorkflowCatalogItem {
  key: string
  displayName: string
  canonicalName: string
  scenarioLabel: string
  description?: string
  sourcePath?: string
}

export interface ThinkTankWorkflowCatalogResult {
  workflows: ThinkTankWorkflowCatalogItem[]
}

export interface ThinkTankWorkflowCurrentStep {
  index: number
  label: string
  sourceRef?: string
  isFinal?: boolean
  isFinalStep?: boolean
  totalSteps?: number
}

export interface ThinkTankWorkflowLaunchResult {
  sessionId: string
  workflow: ThinkTankWorkflowCatalogItem
  status: 'active'
  sourceRefs: string[]
  firstPrompt: string
  currentStep: ThinkTankWorkflowCurrentStep
  checkpointWarning?: ThinkTankCheckpointWarning
}

export interface ThinkTankWorkflowLaunchOptions {
  quickConsultContextId?: string
  acceptedRecommendationId?: string
  acceptedRecommendation?: boolean
  manualChoice?: boolean
  manualChoiceKind?: 'workflow' | 'method'
  manualChoiceId?: string
  manualChoiceLabel?: string
}

export type ThinkTankMethodCatalogStatus = 'available' | 'degraded'

export interface ThinkTankManualBrowseWorkflow {
  workflowKey: string
  displayName: string
  scenarioLabel: string
  description?: string
  expectedDuration?: string
  sourceRefs: string[]
}

export interface ThinkTankManualMethodChoice {
  id: string
  workflowKey: string
  methodName: string
  category?: string
  phase?: string
  description?: string
}

export interface ThinkTankManualBrowseCatalog {
  workflows: ThinkTankManualBrowseWorkflow[]
  methodChoices: ThinkTankManualMethodChoice[]
  methodCatalogStatus: ThinkTankMethodCatalogStatus
  recoverableMessage?: string
}

export interface ThinkTankManualBrowseCatalogOptions {
  quickConsultContextId?: string
}

export interface ThinkTankDecisionOption {
  key?: string
  action: string
  label: string
  shortcut?: string
  enabled: boolean
  description?: string
}

export interface ThinkTankConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'expert'
  content: string
  sequence?: number
  workflowKey?: string
  stepIndex?: number
  decisionOptions?: ThinkTankDecisionOption[]
  metadata?: Record<string, unknown>
  providerMetadata?: Record<string, unknown>
}

export interface ThinkTankSessionMessagesResult {
  sessionId: string
  currentStep: ThinkTankWorkflowCurrentStep
  messages: ThinkTankConversationMessage[]
}

export interface ThinkTankSessionMessageStreamChunk {
  index: number
  delta: string
  done: boolean
  provider?: string
  model?: string
  latencyMs?: number
  finishReason?: string
}

export interface ThinkTankSessionMessageSubmitInput {
  content: string
  decisionAction?: string
}

export interface ThinkTankSessionMessageSubmitResult extends ThinkTankSessionMessagesResult {
  assistantMessage: ThinkTankConversationMessage
  stream: ThinkTankSessionMessageStreamChunk[]
  decisionOptions: ThinkTankDecisionOption[]
  checkpointWarning?: ThinkTankCheckpointWarning
}

export async function fetchThinkTankWorkflows(): Promise<ThinkTankWorkflowCatalogResult> {
  const headers = await getAuthHeadersAsync()
  const response = await fetch('/api/advisory/workflows', {
    headers,
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(readAdvisoryMessage(body) ?? '暂时无法加载 ThinkTank 工作流目录，请稍后重试。')
  }

  const data = unwrapAdvisoryEnvelope<Partial<ThinkTankWorkflowCatalogResult>>(body)
  const workflows = Array.isArray(data?.workflows) ? data.workflows.map(normalizeWorkflow) : []

  if (!hasCompleteWorkflowCatalog(workflows)) {
    throw new Error('暂时无法加载 ThinkTank 工作流目录，请稍后重试。')
  }

  return {
    workflows,
  }
}

export async function launchThinkTankWorkflow(
  workflowKey: string,
  options: ThinkTankWorkflowLaunchOptions = {}
): Promise<ThinkTankWorkflowLaunchResult> {
  const headers = await getAuthHeadersAsync()
  const launchMetadata = normalizeWorkflowLaunchOptions(options)
  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      ...headers,
      ...(Object.keys(launchMetadata).length > 0 ? { 'Content-Type': 'application/json' } : {}),
    },
    cache: 'no-store',
  }
  if (Object.keys(launchMetadata).length > 0) {
    requestInit.body = JSON.stringify(launchMetadata)
  }
  const response = await fetch(
    `/api/advisory/workflows/${encodeURIComponent(workflowKey)}/launch`,
    requestInit
  )
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(readAdvisoryMessage(body) ?? THINKTANK_WORKFLOW_START_FAILED_MESSAGE)
  }

  const data = unwrapAdvisoryEnvelope<ThinkTankWorkflowLaunchResult>(body)
  if (!data?.sessionId || !data.workflow || !data.firstPrompt || !data.currentStep) {
    throw new Error(THINKTANK_WORKFLOW_START_FAILED_MESSAGE)
  }

  return data
}

export async function fetchThinkTankManualBrowseCatalog(
  options: ThinkTankManualBrowseCatalogOptions = {}
): Promise<ThinkTankManualBrowseCatalog> {
  const headers = await getAuthHeadersAsync()
  const quickConsultContextId = normalizeNonEmptyText(options.quickConsultContextId)
  const response = await fetch('/api/advisory/quick-consult/manual-browse', {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...(quickConsultContextId ? { quickConsultContextId } : {}),
    }),
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(readAdvisoryMessage(body) ?? '暂时无法加载可选方法，请稍后重试。')
  }

  return normalizeManualBrowseCatalog(unwrapAdvisoryEnvelope<ThinkTankManualBrowseCatalog>(body))
}

export async function fetchThinkTankSessionMessages(
  sessionId: string
): Promise<ThinkTankSessionMessagesResult> {
  const headers = await getAuthHeadersAsync()
  const response = await fetch(`/api/advisory/sessions/${encodeURIComponent(sessionId)}/messages`, {
    headers,
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(readAdvisoryMessage(body) ?? '暂时无法加载 ThinkTank 会话消息，请稍后重试。')
  }

  const data = unwrapAdvisoryEnvelope<ThinkTankSessionMessagesResult>(body)
  if (!data?.sessionId || !data.currentStep || !Array.isArray(data.messages)) {
    throw new Error('暂时无法加载 ThinkTank 会话消息，请稍后重试。')
  }

  return data
}

export async function sendThinkTankSessionMessage(
  sessionId: string,
  input: ThinkTankSessionMessageSubmitInput
): Promise<ThinkTankSessionMessageSubmitResult> {
  const content = normalizeThinkTankMessageContent(input.content)
  const headers = await getAuthHeadersAsync()
  const response = await fetch(`/api/advisory/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content,
      decisionAction: input.decisionAction,
    }),
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(readAdvisoryMessage(body) ?? THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE)
  }

  const data = unwrapAdvisoryEnvelope<ThinkTankSessionMessageSubmitResult>(body)
  if (!data?.sessionId || !data.assistantMessage || !Array.isArray(data.stream)) {
    throw new Error(THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE)
  }

  return {
    ...data,
    checkpointWarning: normalizeThinkTankCheckpointWarning(data.checkpointWarning),
  }
}

function normalizeWorkflow(workflow: ThinkTankWorkflowCatalogItem): ThinkTankWorkflowCatalogItem {
  return {
    key: workflow.key,
    displayName: workflow.displayName,
    canonicalName: workflow.canonicalName || workflow.displayName,
    scenarioLabel: workflow.scenarioLabel,
    description: workflow.description,
    sourcePath: workflow.sourcePath,
  }
}

function normalizeWorkflowLaunchOptions(
  options: ThinkTankWorkflowLaunchOptions
): ThinkTankWorkflowLaunchOptions {
  const quickConsultContextId = normalizeNonEmptyText(options.quickConsultContextId)
  const acceptedRecommendationId = normalizeNonEmptyText(options.acceptedRecommendationId)
  const manualChoiceId = normalizeNonEmptyText(options.manualChoiceId)
  const manualChoiceLabel = normalizeNonEmptyText(options.manualChoiceLabel)

  if (options.manualChoice === true) {
    return {
      ...(quickConsultContextId ? { quickConsultContextId } : {}),
      manualChoice: true,
      ...(isManualChoiceKind(options.manualChoiceKind)
        ? { manualChoiceKind: options.manualChoiceKind }
        : {}),
      ...(manualChoiceId ? { manualChoiceId } : {}),
      ...(manualChoiceLabel ? { manualChoiceLabel } : {}),
    }
  }

  return {
    ...(quickConsultContextId ? { quickConsultContextId } : {}),
    ...(acceptedRecommendationId ? { acceptedRecommendationId } : {}),
    ...(options.acceptedRecommendation === true ? { acceptedRecommendation: true } : {}),
  }
}

function normalizeManualBrowseCatalog(value: unknown): ThinkTankManualBrowseCatalog {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const workflows = (Array.isArray(record.workflows) ? record.workflows : [])
    .map(normalizeManualBrowseWorkflow)
    .filter((workflow): workflow is ThinkTankManualBrowseWorkflow => Boolean(workflow))
  const methodChoices = (Array.isArray(record.methodChoices) ? record.methodChoices : [])
    .map(normalizeManualMethodChoice)
    .filter((method): method is ThinkTankManualMethodChoice => Boolean(method))
  const methodCatalogStatus = record.methodCatalogStatus === 'degraded' ? 'degraded' : 'available'
  const recoverableMessage = normalizeNonEmptyText(record.recoverableMessage)

  return {
    workflows,
    methodChoices,
    methodCatalogStatus,
    ...(recoverableMessage ? { recoverableMessage } : {}),
  }
}

function normalizeManualBrowseWorkflow(value: unknown): ThinkTankManualBrowseWorkflow | null {
  if (!value || typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  const workflowKey = normalizeWorkflowKey(record.workflowKey)
  const displayName = normalizeNonEmptyText(record.displayName)
  const scenarioLabel = normalizeNonEmptyText(record.scenarioLabel)
  if (!workflowKey || !displayName || !scenarioLabel) return null

  return {
    workflowKey,
    displayName,
    scenarioLabel,
    description: normalizeNonEmptyText(record.description),
    expectedDuration: normalizeNonEmptyText(record.expectedDuration),
    sourceRefs: normalizeManualSourceRefs(record.sourceRefs),
  }
}

function normalizeManualMethodChoice(value: unknown): ThinkTankManualMethodChoice | null {
  if (!value || typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  const id = normalizeMethodChoiceId(record.id)
  const workflowKey = normalizeWorkflowKey(record.workflowKey)
  const methodName = normalizeNonEmptyText(record.methodName)
  if (!id || !workflowKey || !methodName) return null

  return {
    id,
    workflowKey,
    methodName,
    category: normalizeNonEmptyText(record.category),
    phase: normalizeNonEmptyText(record.phase),
    description: normalizeNonEmptyText(record.description),
  }
}

function hasCompleteWorkflowCatalog(workflows: ThinkTankWorkflowCatalogItem[]): boolean {
  const keys = new Set(workflows.map((workflow) => workflow.key))

  return (
    workflows.length === EXPECTED_THINKTANK_WORKFLOW_KEYS.length &&
    EXPECTED_THINKTANK_WORKFLOW_KEYS.every((key) => keys.has(key))
  )
}

function normalizeThinkTankMessageContent(content: string): string {
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error(THINKTANK_EMPTY_MESSAGE_MESSAGE)
  }

  const normalized = content.trim()
  if (normalized.length > THINKTANK_MESSAGE_MAX_LENGTH) {
    throw new Error(THINKTANK_MESSAGE_TOO_LONG_MESSAGE)
  }

  return normalized
}

function normalizeNonEmptyText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeWorkflowKey(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()

  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) ? normalized : undefined
}

function normalizeMethodChoiceId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()

  return /^method:[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)
    ? normalized
    : undefined
}

function normalizeManualSourceRefs(value: unknown): string[] {
  return (Array.isArray(value) ? value : [])
    .filter((sourceRef): sourceRef is string => typeof sourceRef === 'string')
    .map((sourceRef) => sourceRef.trim())
    .filter((sourceRef) => /^workflow:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sourceRef))
    .filter((sourceRef) => !/[\\/]|_bmad|prompt|content/i.test(sourceRef))
    .slice(0, 4)
}

function isManualChoiceKind(value: unknown): value is 'workflow' | 'method' {
  return value === 'workflow' || value === 'method'
}
