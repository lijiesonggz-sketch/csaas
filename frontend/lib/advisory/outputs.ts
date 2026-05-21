import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import { normalizeThinkTankCheckpointWarning, type ThinkTankCheckpointWarning } from './checkpoints'
import { readAdvisoryMessage, unwrapAdvisoryEnvelope } from './envelope'

export const THINKTANK_OUTPUT_LOAD_FAILED_MESSAGE = '暂时无法加载报告草稿，请稍后重试。'
export const THINKTANK_OUTPUT_APPEND_FAILED_MESSAGE = '暂时无法更新报告草稿，请稍后重试。'
export const THINKTANK_OUTPUT_COMPLETE_FAILED_MESSAGE = '暂时无法完成报告草稿，请稍后重试。'
export const THINKTANK_OUTPUT_EXPORT_FAILED_MESSAGE =
  '报告导出失败，请重试；如果仍失败，请检查网络或联系管理员。'
export const THINKTANK_OUTPUT_RATING_REQUIRED_MESSAGE = '请选择 1 到 5 分后再提交。'
export const THINKTANK_OUTPUT_FAVORITE_REQUIRED_MESSAGE = '请选择收藏或取消收藏后再提交。'
export const THINKTANK_OUTPUT_ID_REQUIRED_MESSAGE = '暂时无法确认报告，请重新打开后再试。'
export const THINKTANK_OUTPUT_RATING_FAILED_MESSAGE = '暂时无法提交报告评分，请稍后重试。'
export const THINKTANK_OUTPUT_FAVORITE_FAILED_MESSAGE = '暂时无法更新收藏状态，请稍后重试。'
export const THINKTANK_OUTPUT_STATE_LOAD_FAILED_MESSAGE =
  '暂时无法加载报告状态，请稍后重试。'

export type ThinkTankOutputExportFormat = 'markdown' | 'pdf'

export interface ThinkTankOutputExportDownloadResult {
  fileName: string
  format: ThinkTankOutputExportFormat
  contentType: string
}

export interface ThinkTankWorkflowOutputSection {
  id: string
  stepIndex: number
  heading: string
  contentMarkdown: string
  aiLabel: string
  metadata: Record<string, unknown>
  createdAt?: string
}

export interface ThinkTankWorkflowOutput {
  id: string
  sessionId?: string
  workflowKey: string
  status: 'draft' | 'completed'
  title: string
  summary: string
  contentMarkdown: string
  sections: ThinkTankWorkflowOutputSection[]
  aiLabelMetadata: Record<string, unknown>
  metadata: Record<string, unknown>
  assetState?: ThinkTankOutputAssetState
}

export interface ThinkTankOutputAssetState {
  outputId: string
  rating: number | null
  feedbackTextPresent: boolean
  isFavorited: boolean
  updatedAt: string | null
}

export interface ThinkTankOutputAssetStateResult {
  sessionId: string
  assetState: ThinkTankOutputAssetState
}

export interface ThinkTankOutputRatingInput {
  outputId?: string
  rating: number
  feedbackText?: string
}

export interface ThinkTankOutputFavoriteInput {
  outputId?: string
  isFavorited: boolean
}

export interface ThinkTankWorkflowOutputResult {
  sessionId: string
  output: ThinkTankWorkflowOutput
  checkpointWarning?: ThinkTankCheckpointWarning
}

export interface ThinkTankWorkflowOutputAppendInput {
  stepIndex: number
  stepLabel?: string
  contentMarkdown: string
  sourceMessageId?: string
  providerMetadata?: Record<string, unknown>
  aiLabelMetadata?: Record<string, unknown>
}

export interface ThinkTankWorkflowOutputAppendResult extends ThinkTankWorkflowOutputResult {
  section?: ThinkTankWorkflowOutputSection
  appendedSection?: ThinkTankWorkflowOutputSection
}

export interface ThinkTankWorkflowOutputCompleteInput {
  outcome: string
}

export interface ThinkTankWorkflowOutputFetchOptions {
  outputId?: string
}

export async function fetchThinkTankSessionOutput(
  sessionId: string,
  options: ThinkTankWorkflowOutputFetchOptions = {}
): Promise<ThinkTankWorkflowOutputResult> {
  const headers = await getAuthHeadersAsync()
  const params = new URLSearchParams()
  if (options.outputId?.trim()) {
    params.set('outputId', options.outputId.trim())
  }
  const queryString = params.toString()
  const response = await fetch(
    `/api/advisory/sessions/${encodeURIComponent(sessionId)}/output${
      queryString ? `?${queryString}` : ''
    }`,
    {
      headers,
      cache: 'no-store',
    }
  )
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(readAdvisoryMessage(body) ?? THINKTANK_OUTPUT_LOAD_FAILED_MESSAGE)
  }

  return normalizeOutputResult(body, THINKTANK_OUTPUT_LOAD_FAILED_MESSAGE)
}

export async function appendThinkTankOutputSection(
  sessionId: string,
  input: ThinkTankWorkflowOutputAppendInput
): Promise<ThinkTankWorkflowOutputAppendResult> {
  const headers = await getAuthHeadersAsync()
  const response = await fetch(
    `/api/advisory/sessions/${encodeURIComponent(sessionId)}/output/sections`,
    {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stepIndex: input.stepIndex,
        stepLabel: input.stepLabel,
        contentMarkdown: input.contentMarkdown,
        sourceMessageId: input.sourceMessageId,
        providerMetadata: toSafeProviderMetadata(input.providerMetadata ?? {}),
      }),
      cache: 'no-store',
    }
  )
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(readAdvisoryMessage(body) ?? THINKTANK_OUTPUT_APPEND_FAILED_MESSAGE)
  }

  const data = normalizeOutputResult(body, THINKTANK_OUTPUT_APPEND_FAILED_MESSAGE)
  const envelope = unwrapAdvisoryEnvelope<Partial<ThinkTankWorkflowOutputAppendResult>>(body)
  const section = normalizeSection(envelope?.section ?? envelope?.appendedSection)

  return {
    ...data,
    ...(section ? { section, appendedSection: section } : {}),
  }
}

export async function completeThinkTankSessionOutput(
  sessionId: string,
  input: ThinkTankWorkflowOutputCompleteInput
): Promise<ThinkTankWorkflowOutputResult> {
  const headers = await getAuthHeadersAsync()
  const response = await fetch(
    `/api/advisory/sessions/${encodeURIComponent(sessionId)}/output/complete`,
    {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ outcome: input.outcome }),
      cache: 'no-store',
    }
  )
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(readAdvisoryMessage(body) ?? THINKTANK_OUTPUT_COMPLETE_FAILED_MESSAGE)
  }

  return normalizeOutputResult(body, THINKTANK_OUTPUT_COMPLETE_FAILED_MESSAGE)
}

export async function rateThinkTankSessionOutput(
  sessionId: string,
  input: ThinkTankOutputRatingInput
): Promise<ThinkTankOutputAssetStateResult> {
  const rating = normalizeRatingInput(input.rating)
  const outputId = normalizeOutputIdInput(input.outputId)
  const headers = await getAuthHeadersAsync()
  const response = await fetch(
    `/api/advisory/sessions/${encodeURIComponent(sessionId)}/output/rating`,
    {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        outputId,
        rating,
        ...(input.feedbackText?.trim() ? { feedbackText: input.feedbackText.trim() } : {}),
      }),
      cache: 'no-store',
    }
  )
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(readAdvisoryMessage(body) ?? THINKTANK_OUTPUT_RATING_FAILED_MESSAGE)
  }

  return normalizeAssetStateResult(body, THINKTANK_OUTPUT_RATING_FAILED_MESSAGE)
}

export async function updateThinkTankOutputFavorite(
  sessionId: string,
  input: ThinkTankOutputFavoriteInput
): Promise<ThinkTankOutputAssetStateResult> {
  const isFavorited = normalizeFavoriteInput(input.isFavorited)
  const outputId = normalizeOutputIdInput(input.outputId)
  const headers = await getAuthHeadersAsync()
  const response = await fetch(
    `/api/advisory/sessions/${encodeURIComponent(sessionId)}/output/favorite`,
    {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        outputId,
        isFavorited,
      }),
      cache: 'no-store',
    }
  )
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(readAdvisoryMessage(body) ?? THINKTANK_OUTPUT_FAVORITE_FAILED_MESSAGE)
  }

  return normalizeAssetStateResult(body, THINKTANK_OUTPUT_FAVORITE_FAILED_MESSAGE)
}

export async function fetchThinkTankOutputAssetState(
  sessionId: string,
  options: { outputId: string }
): Promise<ThinkTankOutputAssetStateResult> {
  const outputId = normalizeOutputIdInput(options.outputId)
  const headers = await getAuthHeadersAsync()
  const response = await fetch(
    `/api/advisory/sessions/${encodeURIComponent(sessionId)}/output/state?outputId=${encodeURIComponent(outputId)}`,
    {
      headers,
      cache: 'no-store',
    }
  )
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(readAdvisoryMessage(body) ?? THINKTANK_OUTPUT_STATE_LOAD_FAILED_MESSAGE)
  }

  return normalizeAssetStateResult(body, THINKTANK_OUTPUT_STATE_LOAD_FAILED_MESSAGE)
}

export async function downloadThinkTankSessionOutput(
  sessionId: string,
  format: ThinkTankOutputExportFormat
): Promise<ThinkTankOutputExportDownloadResult> {
  const headers = await getAuthHeadersAsync()
  const response = await fetch(
    `/api/advisory/sessions/${encodeURIComponent(sessionId)}/output/export?format=${format}`,
    {
      headers,
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    throw new Error(
      (await readExportErrorMessage(response)) ?? THINKTANK_OUTPUT_EXPORT_FAILED_MESSAGE
    )
  }

  const blob = await response.blob()
  const contentType = response.headers.get('Content-Type') ?? blob.type
  const fileName =
    readFileNameFromContentDisposition(response.headers.get('Content-Disposition')) ??
    buildFallbackExportFileName(sessionId, format)
  const downloadUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = downloadUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 0)

  return {
    fileName,
    format,
    contentType,
  }
}

export const fetchThinkTankWorkflowOutput = fetchThinkTankSessionOutput
export const appendThinkTankWorkflowOutputSection = appendThinkTankOutputSection

function normalizeOutputResult(
  body: unknown,
  fallbackMessage: string
): ThinkTankWorkflowOutputResult {
  const data = unwrapAdvisoryEnvelope<Partial<ThinkTankWorkflowOutputResult>>(body)
  const output = normalizeOutput(data?.output)

  if (!data?.sessionId || !output) {
    throw new Error(fallbackMessage)
  }

  return {
    sessionId: data.sessionId,
    output,
    checkpointWarning: normalizeThinkTankCheckpointWarning(data.checkpointWarning),
  }
}

function normalizeOutput(value: unknown): ThinkTankWorkflowOutput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const output = value as Partial<ThinkTankWorkflowOutput>
  if (
    !output.id ||
    !output.workflowKey ||
    !output.status ||
    !output.title ||
    !Array.isArray(output.sections) ||
    !output.aiLabelMetadata ||
    typeof output.aiLabelMetadata !== 'object'
  ) {
    return null
  }
  if (
    output.aiLabelMetadata.visible_label !== '[AI Generated]' &&
    output.aiLabelMetadata.visibleLabel !== '[AI Generated]'
  ) {
    return null
  }

  return {
    id: output.id,
    sessionId: output.sessionId,
    workflowKey: output.workflowKey,
    status: output.status,
    title: output.title,
    summary: output.summary ?? '',
    contentMarkdown: output.contentMarkdown ?? '',
    sections: output.sections
      .map(normalizeSection)
      .filter(Boolean) as ThinkTankWorkflowOutputSection[],
    aiLabelMetadata: output.aiLabelMetadata,
    metadata: output.metadata ?? {},
    ...(normalizeAssetState(output.assetState, output.id)
      ? {
          assetState: normalizeAssetState(
            output.assetState,
            output.id
          ) as ThinkTankOutputAssetState,
        }
      : {}),
  }
}

function normalizeAssetStateResult(
  body: unknown,
  fallbackMessage: string
): ThinkTankOutputAssetStateResult {
  const data = unwrapAdvisoryEnvelope<Partial<ThinkTankOutputAssetStateResult>>(body)
  const assetState = normalizeAssetState(data?.assetState)

  if (!data?.sessionId || !assetState) {
    throw new Error(fallbackMessage)
  }

  return {
    sessionId: data.sessionId,
    assetState,
  }
}

function normalizeAssetState(
  value: unknown,
  fallbackOutputId?: string
): ThinkTankOutputAssetState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Partial<ThinkTankOutputAssetState>
  const outputId =
    typeof record.outputId === 'string' && record.outputId.trim()
      ? record.outputId.trim()
      : fallbackOutputId
  if (!outputId) return null
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

function normalizeRatingInput(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 5) {
    throw new Error(THINKTANK_OUTPUT_RATING_REQUIRED_MESSAGE)
  }

  return value as number
}

function normalizeFavoriteInput(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(THINKTANK_OUTPUT_FAVORITE_REQUIRED_MESSAGE)
  }

  return value
}

function normalizeOutputIdInput(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(THINKTANK_OUTPUT_ID_REQUIRED_MESSAGE)
  }

  return value.trim()
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function normalizeSection(value: unknown): ThinkTankWorkflowOutputSection | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const section = value as Partial<ThinkTankWorkflowOutputSection>
  if (!section.id || typeof section.stepIndex !== 'number' || !section.heading) return null

  return {
    id: section.id,
    stepIndex: section.stepIndex,
    heading: section.heading,
    contentMarkdown: section.contentMarkdown ?? '',
    aiLabel: section.aiLabel ?? '[AI Generated]',
    metadata: section.metadata ?? {},
    createdAt: section.createdAt,
  }
}

function toSafeProviderMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {}
  const copyText = (key: string) => {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) safe[key] = value.trim()
  }
  const copyNumber = (key: string) => {
    const value = metadata[key]
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) safe[key] = value
  }

  copyText('provider')
  copyText('model')
  copyNumber('latencyMs')
  copyNumber('inputTokens')
  copyNumber('outputTokens')
  copyNumber('totalTokens')
  copyNumber('estimatedCost')
  const cacheStatus = readCacheStatus(metadata.cacheStatus)
  const cacheStrategy = readCacheStrategy(metadata.cacheStrategy)
  const cacheKey = readCacheKey(metadata.cacheKey)
  const cacheBypassReason =
    cacheStatus === 'bypass' ? readCacheBypassReason(metadata.cacheBypassReason) : undefined
  if (cacheStatus) safe.cacheStatus = cacheStatus
  if (cacheStrategy) safe.cacheStrategy = cacheStrategy
  if (cacheKey) safe.cacheKey = cacheKey
  if (cacheBypassReason) safe.cacheBypassReason = cacheBypassReason
  copyNumber('cacheReadInputTokens')
  copyNumber('cacheCreationInputTokens')
  copyNumber('cachedInputTokens')
  copyNumber('cacheEligibleInputTokens')

  return safe
}

function readCacheStatus(value: unknown): 'hit' | 'miss' | 'bypass' | undefined {
  return value === 'hit' || value === 'miss' || value === 'bypass' ? value : undefined
}

function readCacheStrategy(
  value: unknown
): 'provider-auto' | 'anthropic-explicit' | 'disabled' | 'unsupported' | undefined {
  return value === 'provider-auto' ||
    value === 'anthropic-explicit' ||
    value === 'disabled' ||
    value === 'unsupported'
    ? value
    : undefined
}

function readCacheBypassReason(
  value: unknown
): 'disabled' | 'unsupported' | 'no_static_prompt' | 'provider_metadata_absent' | undefined {
  return value === 'disabled' ||
    value === 'unsupported' ||
    value === 'no_static_prompt' ||
    value === 'provider_metadata_absent'
    ? value
    : undefined
}

function readCacheKey(value: unknown): string | undefined {
  return typeof value === 'string' && /^[a-f0-9]{32}$/i.test(value.trim())
    ? value.trim().toLowerCase()
    : undefined
}

async function readExportErrorMessage(response: Response): Promise<string | null> {
  const text = await response.text().catch(() => '')
  if (!text) return null

  try {
    return readAdvisoryMessage(JSON.parse(text))
  } catch {
    return text.trim() || null
  }
}

function readFileNameFromContentDisposition(header: string | null): string | null {
  if (!header) return null

  const encodedMatch = header.match(/filename\*=UTF-8''([^;]+)/i)
  const quotedMatch = header.match(/filename="([^"]+)"/i)
  const rawMatch = header.match(/filename=([^;]+)/i)
  const value =
    decodeContentDispositionFileName(encodedMatch?.[1]) ?? quotedMatch?.[1] ?? rawMatch?.[1]

  return value ? sanitizeDownloadFileName(value) : null
}

function decodeContentDispositionFileName(value: string | undefined): string | null {
  if (!value) return null

  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

function sanitizeDownloadFileName(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  return sanitized || 'thinktank-report'
}

function buildFallbackExportFileName(
  sessionId: string,
  format: ThinkTankOutputExportFormat
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const extension = format === 'markdown' ? 'md' : 'pdf'
  const safeSessionId = sanitizeDownloadFileName(sessionId).slice(0, 48) || 'session'

  return `thinktank-report-${safeSessionId}-${timestamp}.${extension}`
}
