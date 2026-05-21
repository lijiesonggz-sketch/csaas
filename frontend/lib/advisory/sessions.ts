import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import { normalizeThinkTankCheckpointWarning, type ThinkTankCheckpointWarning } from './checkpoints'
import { readAdvisoryMessage, unwrapAdvisoryEnvelope } from './envelope'
import type {
  ThinkTankConversationMessage,
  ThinkTankWorkflowCatalogItem,
  ThinkTankWorkflowCurrentStep,
} from './workflows'
import type { ThinkTankWorkflowOutput } from './outputs'

export const THINKTANK_UNFINISHED_SESSIONS_LOAD_FAILED_MESSAGE =
  '暂时无法加载未完成的 ThinkTank 会话，请稍后重试。'
export const THINKTANK_RESUME_SESSION_FAILED_MESSAGE =
  '暂时无法恢复该 ThinkTank 会话，请稍后重试。'

export type ThinkTankResumeCheckpointSource = 'hot' | 'cold' | 'fallback'

export interface ThinkTankUnfinishedSessionCard {
  sessionId: string
  workflowKey: string
  workflowType: string
  title: string
  lastStep: ThinkTankWorkflowCurrentStep
  status: 'active'
  statusSummary: string
  lastActivityAt: string
  checkpointSource: ThinkTankResumeCheckpointSource
}

export interface ThinkTankUnfinishedSessionsResult {
  sessions: ThinkTankUnfinishedSessionCard[]
}

export interface ThinkTankRecoveryMessage {
  title: string
  content: string
  lastStep: string
  keyConclusions: string[]
  actions: Array<{ key: 'continue' | 'review-document'; label: string }>
}

export interface ThinkTankResumeSessionResult {
  session: ThinkTankUnfinishedSessionCard
  messages: ThinkTankConversationMessage[]
  output: ThinkTankWorkflowOutput | null
  checkpointSource: ThinkTankResumeCheckpointSource
  recoveryMessage: ThinkTankRecoveryMessage
  recoveredState: {
    lastStep: string
    messageCount: number
    outputSectionCount: number
    recoveredFrom: 'checkpoint' | 'persisted-state'
  }
  missingState: string[]
  checkpointWarning?: ThinkTankCheckpointWarning
}

export function toWorkflowLaunchFromResume(
  result: ThinkTankResumeSessionResult
): {
  sessionId: string
  workflow: ThinkTankWorkflowCatalogItem
  status: 'active'
  sourceRefs: string[]
  firstPrompt: string
  currentStep: ThinkTankWorkflowCurrentStep
  checkpointWarning?: ThinkTankCheckpointWarning
} {
  return {
    sessionId: result.session.sessionId,
    workflow: {
      key: result.session.workflowKey,
      displayName: result.session.workflowType,
      canonicalName: result.session.workflowType,
      scenarioLabel: result.session.statusSummary,
      sourcePath: `workflow:${result.session.workflowKey}`,
    },
    status: 'active',
    sourceRefs: [`workflow:${result.session.workflowKey}`],
    firstPrompt: `已恢复 ${result.session.workflowType} 会话。`,
    currentStep: result.session.lastStep,
    ...(result.checkpointWarning ? { checkpointWarning: result.checkpointWarning } : {}),
  }
}

export async function fetchThinkTankUnfinishedSessions(): Promise<ThinkTankUnfinishedSessionsResult> {
  const headers = await getAuthHeadersAsync()
  const response = await fetch('/api/advisory/sessions/unfinished', {
    headers,
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      readAdvisoryMessage(body) ?? THINKTANK_UNFINISHED_SESSIONS_LOAD_FAILED_MESSAGE
    )
  }

  const data = unwrapAdvisoryEnvelope<Partial<ThinkTankUnfinishedSessionsResult>>(body)
  const sessions = (Array.isArray(data?.sessions) ? data.sessions : [])
    .map(normalizeUnfinishedSessionCard)
    .filter((session): session is ThinkTankUnfinishedSessionCard => Boolean(session))
    .sort(
      (left, right) =>
        new Date(right.lastActivityAt).getTime() - new Date(left.lastActivityAt).getTime()
    )

  return { sessions }
}

export async function resumeThinkTankSession(
  sessionId: string
): Promise<ThinkTankResumeSessionResult> {
  const headers = await getAuthHeadersAsync()
  const response = await fetch(`/api/advisory/sessions/${encodeURIComponent(sessionId)}/resume`, {
    method: 'POST',
    headers,
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(readAdvisoryMessage(body) ?? THINKTANK_RESUME_SESSION_FAILED_MESSAGE)
  }

  const data = unwrapAdvisoryEnvelope<Partial<ThinkTankResumeSessionResult>>(body)
  const session = normalizeUnfinishedSessionCard(data?.session)
  const recoveryMessage = normalizeRecoveryMessage(data?.recoveryMessage)
  const recoveredState = normalizeRecoveredState(data?.recoveredState)
  const checkpointSource = normalizeCheckpointSource(data?.checkpointSource)

  if (!session || !recoveryMessage || !recoveredState || !checkpointSource) {
    throw new Error(THINKTANK_RESUME_SESSION_FAILED_MESSAGE)
  }

  return {
    session,
    messages: normalizeMessages(data?.messages),
    output: normalizeOutput(data?.output),
    checkpointSource,
    recoveryMessage,
    recoveredState,
    missingState: normalizeMissingState(data?.missingState),
    checkpointWarning: normalizeThinkTankCheckpointWarning(data?.checkpointWarning),
  }
}

function normalizeUnfinishedSessionCard(value: unknown): ThinkTankUnfinishedSessionCard | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const sessionId = normalizeNonEmptyText(record.sessionId)
  const workflowKey = normalizeWorkflowKey(record.workflowKey)
  const workflowType =
    normalizeNonEmptyText(record.workflowType) ??
    normalizeNonEmptyText(record.workflowDisplayName)
  const title = normalizeNonEmptyText(record.title) ?? workflowType
  const lastStep = normalizeCurrentStep(record.lastStep ?? record.currentStep)
  const lastActivityAt =
    normalizeIsoDate(record.lastActivityAt) ?? normalizeIsoDate(record.lastUpdatedAt)
  const checkpointSource = normalizeCheckpointSource(record.checkpointSource) ?? 'fallback'
  const status = record.status === 'active' ? 'active' : null

  if (
    !sessionId ||
    !workflowKey ||
    !workflowType ||
    !title ||
    !lastStep ||
    !lastActivityAt ||
    !status
  ) {
    return null
  }

  return {
    sessionId,
    workflowKey,
    workflowType,
    title,
    lastStep,
    status,
    statusSummary: normalizeNonEmptyText(record.statusSummary) ?? '未完成 - 可继续',
    lastActivityAt,
    checkpointSource,
  }
}

function normalizeRecoveryMessage(value: unknown): ThinkTankRecoveryMessage | null {
  if (typeof value === 'string' && value.trim()) {
    return {
      title: '已恢复未完成会话',
      content: value.trim(),
      lastStep: '当前步骤',
      keyConclusions: [],
      actions: [
        { key: 'continue', label: '继续' },
        { key: 'review-document', label: '先查看文档' },
      ],
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const title = normalizeNonEmptyText(record.title) ?? '已恢复未完成会话'
  const content = normalizeNonEmptyText(record.content)
  const lastStep = normalizeNonEmptyText(record.lastStep) ?? '当前步骤'
  if (!content) return null

  return {
    title,
    content,
    lastStep,
    keyConclusions: normalizeTextList(record.keyConclusions).slice(0, 5),
    actions: [
      { key: 'continue', label: '继续' },
      { key: 'review-document', label: '先查看文档' },
    ],
  }
}

function normalizeRecoveredState(
  value: unknown
): ThinkTankResumeSessionResult['recoveredState'] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const lastStep = normalizeNonEmptyText(record.lastStep)
  const messageCount = normalizeNonNegativeNumber(record.messageCount)
  const outputSectionCount = normalizeNonNegativeNumber(record.outputSectionCount)
  const recoveredFrom =
    record.recoveredFrom === 'persisted-state' ? 'persisted-state' : 'checkpoint'

  if (!lastStep || messageCount === null || outputSectionCount === null) return null

  return {
    lastStep,
    messageCount,
    outputSectionCount,
    recoveredFrom,
  }
}

function normalizeMessages(value: unknown): ThinkTankConversationMessage[] {
  return (Array.isArray(value) ? value : [])
    .map((message): ThinkTankConversationMessage | null => {
      if (!message || typeof message !== 'object' || Array.isArray(message)) return null
      const record = message as Record<string, unknown>
      const id = normalizeNonEmptyText(record.id)
      const role = normalizeMessageRole(record.role)
      const content = normalizeNonEmptyText(record.content)
      if (!id || !role || !content) return null

      const normalized: ThinkTankConversationMessage = {
        id,
        role,
        content,
        decisionOptions: Array.isArray(record.decisionOptions)
          ? (record.decisionOptions as ThinkTankConversationMessage['decisionOptions'])
          : [],
        metadata: normalizeRecord(record.metadata),
        providerMetadata: normalizeRecord(record.providerMetadata),
      }
      const sequence = normalizeNonNegativeNumber(record.sequence)
      const workflowKey = normalizeWorkflowKey(record.workflowKey)
      const stepIndex = normalizeNonNegativeNumber(record.stepIndex)

      if (sequence !== null) normalized.sequence = sequence
      if (workflowKey) normalized.workflowKey = workflowKey
      if (stepIndex !== null) normalized.stepIndex = stepIndex

      return normalized
    })
    .filter((message): message is ThinkTankConversationMessage => Boolean(message))
}

function normalizeOutput(value: unknown): ThinkTankWorkflowOutput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const id = normalizeNonEmptyText(record.id)
  const workflowKey = normalizeWorkflowKey(record.workflowKey)
  const status = record.status === 'completed' ? 'completed' : record.status === 'draft' ? 'draft' : null
  const title = normalizeNonEmptyText(record.title)
  const aiLabelMetadata = normalizeRecord(record.aiLabelMetadata)
  if (!id || !workflowKey || !status || !title) return null

  return {
    id,
    sessionId: normalizeNonEmptyText(record.sessionId),
    workflowKey,
    status,
    title,
    summary: normalizeNonEmptyText(record.summary) ?? '',
    contentMarkdown: normalizeNonEmptyText(record.contentMarkdown) ?? '',
    sections: Array.isArray(record.sections) ? (record.sections as ThinkTankWorkflowOutput['sections']) : [],
    aiLabelMetadata:
      Object.keys(aiLabelMetadata).length > 0
        ? aiLabelMetadata
        : { visible_label: '[AI Generated]' },
    metadata: normalizeRecord(record.metadata),
  }
}

function normalizeCurrentStep(value: unknown): ThinkTankWorkflowCurrentStep | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const index = normalizeNonNegativeNumber(record.index)
  const label = normalizeNonEmptyText(record.label)
  if (index === null || !label) return null

  return {
    index,
    label,
    sourceRef: normalizeNonEmptyText(record.sourceRef),
  }
}

function normalizeCheckpointSource(value: unknown): ThinkTankResumeCheckpointSource | null {
  return value === 'hot' || value === 'cold' || value === 'fallback' ? value : null
}

function normalizeMessageRole(value: unknown): ThinkTankConversationMessage['role'] | null {
  return value === 'user' || value === 'assistant' || value === 'system' || value === 'expert'
    ? value
    : null
}

function normalizeMissingState(value: unknown): string[] {
  return normalizeTextList(value).filter((item) =>
    ['checkpoint', 'conversation', 'document'].includes(item)
  )
}

function normalizeTextList(value: unknown): string[] {
  return (Array.isArray(value) ? value : []).filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0
  )
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function normalizeNonNegativeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function normalizeNonEmptyText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeWorkflowKey(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()

  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) ? normalized : undefined
}
