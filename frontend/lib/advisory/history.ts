import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import { readAdvisoryMessage, unwrapAdvisoryEnvelope } from './envelope'
import type { ThinkTankOutputAssetState } from './outputs'
import type { ThinkTankWorkflowCurrentStep } from './workflows'

export const THINKTANK_HISTORY_LOAD_FAILED_MESSAGE = '暂时无法加载 ThinkTank 历史记录，请稍后重试。'
export const THINKTANK_HISTORY_SEARCH_FAILED_MESSAGE =
  '暂时无法搜索 ThinkTank 历史记录，请稍后重试。'

export type ThinkTankHistoryType = 'all' | 'session' | 'output'
export type ThinkTankHistoryStatus = 'all' | 'active' | 'completed' | 'draft'
export type ThinkTankHistoryOpenTarget = 'resume-session' | 'view-session' | 'view-output'

export interface ThinkTankHistoryQuery {
  q?: string
  type?: ThinkTankHistoryType
  workflowKey?: string
  status?: ThinkTankHistoryStatus
  from?: string
  to?: string
  page?: number
  limit?: number
}

export interface ThinkTankHistoryItem {
  id: string
  resultType: 'session' | 'output'
  sessionId: string
  outputId?: string
  workflowKey: string
  workflowType: string
  title: string
  summary: string
  status: 'active' | 'completed' | 'draft'
  lastStep?: ThinkTankWorkflowCurrentStep
  timestamp: string
  openTarget: ThinkTankHistoryOpenTarget
  assetState?: ThinkTankOutputAssetState
}

export interface ThinkTankHistoryResult {
  items: ThinkTankHistoryItem[]
  meta: {
    page: number
    limit: number
    total: number
  }
}

export async function fetchThinkTankSessionHistory(
  query: ThinkTankHistoryQuery = {}
): Promise<ThinkTankHistoryResult> {
  return fetchHistoryEndpoint(
    `/api/advisory/sessions/history${buildHistoryQueryString(query)}`,
    THINKTANK_HISTORY_LOAD_FAILED_MESSAGE
  )
}

export async function searchThinkTankHistory(
  query: ThinkTankHistoryQuery
): Promise<ThinkTankHistoryResult> {
  return fetchHistoryEndpoint(
    `/api/advisory/sessions/search${buildHistoryQueryString(query)}`,
    THINKTANK_HISTORY_SEARCH_FAILED_MESSAGE
  )
}

async function fetchHistoryEndpoint(
  url: string,
  fallbackMessage: string
): Promise<ThinkTankHistoryResult> {
  const headers = await getAuthHeadersAsync()
  const response = await fetch(url, {
    headers,
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(readAdvisoryMessage(body) ?? fallbackMessage)
  }

  return normalizeHistoryResult(body, fallbackMessage)
}

function buildHistoryQueryString(query: ThinkTankHistoryQuery): string {
  const params = new URLSearchParams()
  const appendText = (key: keyof ThinkTankHistoryQuery) => {
    const value = query[key]
    if (typeof value === 'string' && value.trim()) {
      params.set(key, value.trim())
    }
  }
  const appendNumber = (key: keyof ThinkTankHistoryQuery) => {
    const value = query[key]
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      params.set(key, String(Math.trunc(value)))
    }
  }

  appendText('q')
  appendText('type')
  appendText('workflowKey')
  appendText('status')
  appendText('from')
  appendText('to')
  appendNumber('page')
  appendNumber('limit')

  const value = params.toString()
  return value ? `?${value}` : ''
}

function normalizeHistoryResult(body: unknown, fallbackMessage: string): ThinkTankHistoryResult {
  const data = unwrapAdvisoryEnvelope<Partial<ThinkTankHistoryResult>>(body)
  const items = (Array.isArray(data?.items) ? data.items : [])
    .map(normalizeHistoryItem)
    .filter((item): item is ThinkTankHistoryItem => Boolean(item))
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
  const meta = normalizeHistoryMeta(data?.meta, items.length)

  if (!data || (!Array.isArray(data.items) && !data.meta)) {
    throw new Error(fallbackMessage)
  }

  return { items, meta }
}

function normalizeHistoryItem(value: unknown): ThinkTankHistoryItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const id = normalizeNonEmptyText(record.id)
  const resultType = normalizeResultType(record.resultType)
  const sessionId = normalizeNonEmptyText(record.sessionId)
  const workflowKey = normalizeWorkflowKey(record.workflowKey)
  const workflowType = normalizeNonEmptyText(record.workflowType)
  const title = normalizeNonEmptyText(record.title)
  const summary = normalizeNonEmptyText(record.summary) ?? ''
  const status = normalizeHistoryStatus(record.status)
  const timestamp = normalizeIsoDate(record.timestamp)
  const openTarget = normalizeOpenTarget(record.openTarget)
  if (
    !id ||
    !resultType ||
    !sessionId ||
    !workflowKey ||
    !workflowType ||
    !title ||
    !status ||
    !timestamp ||
    !openTarget
  ) {
    return null
  }

  return {
    id,
    resultType,
    sessionId,
    ...(normalizeNonEmptyText(record.outputId)
      ? { outputId: normalizeNonEmptyText(record.outputId) }
      : {}),
    workflowKey,
    workflowType,
    title,
    summary,
    status,
    ...(normalizeCurrentStep(record.lastStep)
      ? { lastStep: normalizeCurrentStep(record.lastStep) }
      : {}),
    timestamp,
    openTarget,
    ...(normalizeAssetState(record.assetState, normalizeNonEmptyText(record.outputId) ?? id)
      ? {
          assetState: normalizeAssetState(
            record.assetState,
            normalizeNonEmptyText(record.outputId) ?? id
          ) as ThinkTankOutputAssetState,
        }
      : {}),
  }
}

function normalizeAssetState(
  value: unknown,
  fallbackOutputId: string
): ThinkTankOutputAssetState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Partial<ThinkTankOutputAssetState>
  const outputId = normalizeNonEmptyText(record.outputId) ?? fallbackOutputId
  const rating =
    Number.isInteger(record.rating) &&
    (record.rating as number) >= 1 &&
    (record.rating as number) <= 5
      ? (record.rating as number)
      : null
  const updatedAt = normalizeIsoDate(record.updatedAt)

  return {
    outputId,
    rating,
    feedbackTextPresent: record.feedbackTextPresent === true,
    isFavorited: record.isFavorited === true,
    updatedAt,
  }
}

function normalizeCurrentStep(value: unknown): ThinkTankWorkflowCurrentStep | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const index = normalizeNonNegativeNumber(record.index)
  const label = normalizeNonEmptyText(record.label)
  if (index === null || !label) return undefined
  const sourceRef = normalizeSafeSourceRef(record.sourceRef)

  return {
    index,
    label,
    ...(sourceRef ? { sourceRef } : {}),
  }
}

function normalizeSafeSourceRef(value: unknown): string | undefined {
  const sourceRef = normalizeNonEmptyText(value)
  if (!sourceRef || /(_bmad|prompt|content|[\\/])/i.test(sourceRef)) return undefined
  return sourceRef
}

function normalizeHistoryMeta(
  value: unknown,
  fallbackTotal: number
): ThinkTankHistoryResult['meta'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { page: 1, limit: 20, total: fallbackTotal }
  }
  const record = value as Record<string, unknown>

  return {
    page: normalizePositiveNumber(record.page) ?? 1,
    limit: normalizePositiveNumber(record.limit) ?? 20,
    total: normalizeNonNegativeNumber(record.total) ?? fallbackTotal,
  }
}

function normalizeResultType(value: unknown): ThinkTankHistoryItem['resultType'] | null {
  return value === 'session' || value === 'output' ? value : null
}

function normalizeHistoryStatus(value: unknown): ThinkTankHistoryItem['status'] | null {
  return value === 'active' || value === 'completed' || value === 'draft' ? value : null
}

function normalizeOpenTarget(value: unknown): ThinkTankHistoryOpenTarget | null {
  return value === 'resume-session' || value === 'view-session' || value === 'view-output'
    ? value
    : null
}

function normalizeWorkflowKey(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()

  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) ? normalized : undefined
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function normalizeNonEmptyText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizePositiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.trunc(value) : null
}

function normalizeNonNegativeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : null
}
