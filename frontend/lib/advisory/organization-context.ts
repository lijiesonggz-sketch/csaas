import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import { readAdvisoryMessage, unwrapAdvisoryEnvelope } from './envelope'

export const ORGANIZATION_CONTEXT_NAME_MAX_LENGTH = 500
export const ORGANIZATION_CONTEXT_OPTIONAL_FIELD_MAX_LENGTH = 200
export const ORGANIZATION_CONTEXT_NAME_REQUIRED_MESSAGE = '企业名称必填。'
export const ORGANIZATION_CONTEXT_NAME_TOO_LONG_MESSAGE = '企业名称不能超过 500 个字符。'
export const ORGANIZATION_CONTEXT_SAVE_FAILED_MESSAGE = '暂时无法保存企业背景，请稍后重试。'
export const ORGANIZATION_CONTEXT_LOAD_FAILED_MESSAGE = '暂时无法加载企业背景，请稍后重试。'

const ORGANIZATION_CONTEXT_SKIP_STORAGE_PREFIX = 'thinktank:organization-context-skip'

export interface OrganizationContextCompleteness {
  requiredFieldsComplete: boolean
  missingFields: string[]
  updatedAt: string | null
}

export interface OrganizationContextEmpty {
  context: null
  completenessScore: 0
  completeness: OrganizationContextCompleteness
  appliedToPrompts: false
}

export interface OrganizationContextSaved {
  id: string
  organizationName: string
  industry: string | null
  size: string | null
  completenessScore: number
  completeness: OrganizationContextCompleteness
  appliedToPrompts: boolean
}

export type OrganizationContextState = OrganizationContextEmpty | OrganizationContextSaved

export interface SaveOrganizationContextInput {
  organizationName: string
  industry?: string
  size?: string
}

export async function fetchOrganizationContext(): Promise<OrganizationContextState> {
  const headers = await getAuthHeadersAsync()
  const response = await fetch('/api/advisory/organization-context', {
    method: 'GET',
    headers,
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(readAdvisoryMessage(body) ?? ORGANIZATION_CONTEXT_LOAD_FAILED_MESSAGE)
  }

  return normalizeOrganizationContextState(
    unwrapAdvisoryEnvelope<OrganizationContextState>(body),
    ORGANIZATION_CONTEXT_LOAD_FAILED_MESSAGE
  )
}

export async function saveOrganizationContext(
  input: SaveOrganizationContextInput
): Promise<OrganizationContextSaved> {
  const payload = normalizeSavePayload(input)
  const headers = await getAuthHeadersAsync()
  const response = await fetch('/api/advisory/organization-context', {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(readAdvisoryMessage(body) ?? ORGANIZATION_CONTEXT_SAVE_FAILED_MESSAGE)
  }

  const data = normalizeOrganizationContextState(
    unwrapAdvisoryEnvelope<OrganizationContextState>(body),
    ORGANIZATION_CONTEXT_SAVE_FAILED_MESSAGE
  )
  if (!isSavedOrganizationContext(data)) {
    throw new Error(ORGANIZATION_CONTEXT_SAVE_FAILED_MESSAGE)
  }

  return data
}

export function isOrganizationContextUsable(
  context: OrganizationContextState | null | undefined
): context is OrganizationContextSaved {
  return Boolean(
    context &&
    isSavedOrganizationContext(context) &&
    context.organizationName.trim().length > 0 &&
    context.completeness.requiredFieldsComplete
  )
}

export function readOrganizationContextSkip(userIdentity?: string | null): boolean {
  if (typeof window === 'undefined') return false
  const key = buildSkipStorageKey(userIdentity)
  if (!key) return false

  try {
    return window.sessionStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function writeOrganizationContextSkip(userIdentity?: string | null): void {
  if (typeof window === 'undefined') return
  const key = buildSkipStorageKey(userIdentity)
  if (!key) return

  try {
    window.sessionStorage.setItem(key, '1')
  } catch {
    // Skip state is local UI convenience; failing storage should not block the workspace.
  }
}

function normalizeSavePayload(input: SaveOrganizationContextInput) {
  const organizationName = normalizeRequiredOrganizationName(input.organizationName)
  const industry = normalizeOptionalField(input.industry, '行业')
  const size = normalizeOptionalField(input.size, '规模')

  return {
    organizationName,
    ...(industry ? { industry } : {}),
    ...(size ? { size } : {}),
  }
}

function normalizeRequiredOrganizationName(value: unknown): string {
  const text = normalizeOptionalText(value)
  if (!text) {
    throw new Error(ORGANIZATION_CONTEXT_NAME_REQUIRED_MESSAGE)
  }
  if (text.length > ORGANIZATION_CONTEXT_NAME_MAX_LENGTH) {
    throw new Error(ORGANIZATION_CONTEXT_NAME_TOO_LONG_MESSAGE)
  }

  return text
}

function normalizeOptionalField(value: unknown, label: string): string | undefined {
  const text = normalizeOptionalText(value)
  if (!text) return undefined
  if (text.length > ORGANIZATION_CONTEXT_OPTIONAL_FIELD_MAX_LENGTH) {
    throw new Error(`${label}不能超过 ${ORGANIZATION_CONTEXT_OPTIONAL_FIELD_MAX_LENGTH} 个字符。`)
  }

  return text
}

function normalizeOrganizationContextState(
  value: unknown,
  fallbackMessage: string
): OrganizationContextState {
  if (!value || typeof value !== 'object') {
    throw new Error(fallbackMessage)
  }

  const record = value as Record<string, unknown>
  if (record.context === null) {
    return {
      context: null,
      completenessScore: 0,
      completeness: normalizeCompleteness(record.completeness),
      appliedToPrompts: false,
    }
  }

  const id = normalizeOptionalText(record.id) ?? normalizeOptionalText(record.contextId)
  const organizationName = normalizeOptionalText(record.organizationName)
  if (!id || !organizationName) {
    throw new Error(fallbackMessage)
  }

  return {
    id,
    organizationName,
    industry: normalizeNullableText(record.industry),
    size: normalizeNullableText(record.size),
    completenessScore: normalizeCompletenessScore(record.completenessScore),
    completeness: normalizeCompleteness(record.completeness),
    appliedToPrompts: record.appliedToPrompts === true,
  }
}

function normalizeCompleteness(value: unknown): OrganizationContextCompleteness {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

  return {
    requiredFieldsComplete: record.requiredFieldsComplete === true,
    missingFields: normalizeMissingFields(record.missingFields),
    updatedAt: normalizeNullableText(record.updatedAt),
  }
}

function normalizeCompletenessScore(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(Math.round(value), 0), 100)
    : 0
}

function normalizeMissingFields(value: unknown): string[] {
  return (Array.isArray(value) ? value : [])
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 3)
}

function isSavedOrganizationContext(
  value: OrganizationContextState
): value is OrganizationContextSaved {
  return 'organizationName' in value
}

function normalizeNullableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = normalizeOrganizationContextText(value)
  return text && hasVisibleText(text) ? text : undefined
}

function buildSkipStorageKey(userIdentity?: string | null): string {
  const identity = normalizeOptionalText(userIdentity)
  return identity ? `${ORGANIZATION_CONTEXT_SKIP_STORAGE_PREFIX}:${identity}` : ''
}

function hasVisibleText(value: string): boolean {
  return normalizeOrganizationContextText(value).length > 0
}

function normalizeOrganizationContextText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\p{C}+/gu, '')
    .trim()
}
