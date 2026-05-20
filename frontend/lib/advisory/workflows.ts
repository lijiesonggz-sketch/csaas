import { getAuthHeadersAsync } from '@/lib/utils/jwt'
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
  workflowKey: string
): Promise<ThinkTankWorkflowLaunchResult> {
  const headers = await getAuthHeadersAsync()
  const response = await fetch(
    `/api/advisory/workflows/${encodeURIComponent(workflowKey)}/launch`,
    {
      method: 'POST',
      headers,
      cache: 'no-store',
    }
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

  return data
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
