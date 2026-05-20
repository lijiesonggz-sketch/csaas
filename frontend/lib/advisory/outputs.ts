import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import { readAdvisoryMessage, unwrapAdvisoryEnvelope } from './envelope'

export const THINKTANK_OUTPUT_LOAD_FAILED_MESSAGE = '暂时无法加载报告草稿，请稍后重试。'
export const THINKTANK_OUTPUT_APPEND_FAILED_MESSAGE = '暂时无法更新报告草稿，请稍后重试。'
export const THINKTANK_OUTPUT_COMPLETE_FAILED_MESSAGE = '暂时无法完成报告草稿，请稍后重试。'
export const THINKTANK_OUTPUT_EXPORT_FAILED_MESSAGE =
  '报告导出失败，请重试；如果仍失败，请检查网络或联系管理员。'

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
}

export interface ThinkTankWorkflowOutputResult {
  sessionId: string
  output: ThinkTankWorkflowOutput
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

export async function fetchThinkTankSessionOutput(
  sessionId: string
): Promise<ThinkTankWorkflowOutputResult> {
  const headers = await getAuthHeadersAsync()
  const response = await fetch(`/api/advisory/sessions/${encodeURIComponent(sessionId)}/output`, {
    headers,
    cache: 'no-store',
  })
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
  }
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

  return safe
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
