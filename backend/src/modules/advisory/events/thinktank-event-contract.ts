import { randomUUID } from 'crypto'
import {
  ThinkTankEventKind,
  ThinkTankRegisteredEventName,
  assertThinkTankEventRegistered,
} from './thinktank-event-registry'

export const THINKTANK_EVENT_VERSION = 1

export enum ThinkTankEventName {
  AccessOpened = 'thinktank.access.opened',
  AccessDenied = 'thinktank.access.denied',
  ModuleEnabled = 'thinktank.module.enabled',
  ModuleDisabled = 'thinktank.module.disabled',
  RoleAccessUpdated = 'thinktank.role_access.updated',
  WorkflowStarted = 'thinktank.workflow.started',
  WorkflowStartFailed = 'thinktank.workflow.start_failed',
  WorkflowCompleted = 'thinktank.workflow.completed',
  QuickConsultStarted = 'thinktank.quick_consult.started',
  QuickConsultCompleted = 'thinktank.quick_consult.completed',
  QuickConsultFailed = 'thinktank.quick_consult.failed',
  OutputExported = 'thinktank.output.exported',
  SessionDeleted = 'thinktank.session.deleted',
  OutputDeleted = 'thinktank.output.deleted',
  ProviderCallCompleted = 'thinktank.provider.call_completed',
  ProviderCallFailed = 'thinktank.provider.call_failed',
  ProviderCallRetried = 'thinktank.provider.call_retried',
  PromptCacheHit = 'thinktank.prompt_cache.hit',
  PromptCacheMiss = 'thinktank.prompt_cache.miss',
  RecommendationFeedbackSubmitted = 'thinktank.recommendation.feedback_submitted',
  OutputRatingSubmitted = 'thinktank.output.rating_submitted',
  OutputFavoriteUpdated = 'thinktank.output.favorite_updated',
  ContextCompressionExecuted = 'thinktank.context_compression.executed',
  ContextCompressionDeferred = 'thinktank.context_compression.deferred',
  PartyModeBudgetExceeded = 'thinktank.party_mode.budget_exceeded',
  PartyModeAdvisorFailed = 'thinktank.party_mode.advisor_failed',
}

export enum ThinkTankEventOutcome {
  Success = 'success',
  Failure = 'failure',
  Denied = 'denied',
  Blocked = 'blocked',
  Partial = 'partial',
}

export enum ThinkTankSubjectType {
  Module = 'module',
  ModuleConfig = 'module_config',
  Workflow = 'workflow',
  QuickConsult = 'quick_consult',
  Session = 'session',
  Output = 'output',
  ProviderCall = 'provider_call',
}

export enum ThinkTankPrivacyClassification {
  Operational = 'operational',
  PersonalData = 'personal_data',
  SensitiveBusiness = 'sensitive_business',
  Restricted = 'restricted',
}

export enum ThinkTankCacheStatus {
  Hit = 'hit',
  Miss = 'miss',
  Bypass = 'bypass',
}

export enum ThinkTankErrorCategory {
  Provider = 'provider',
  Validation = 'validation',
  Permission = 'permission',
  Timeout = 'timeout',
  Unknown = 'unknown',
}

export interface ThinkTankEventOptionalInput {
  sessionId?: string
  outputId?: string
  workflowType?: string
  provider?: string
  latencyMs?: number
  estimatedTokens?: number
  estimatedCost?: number
  cacheStatus?: ThinkTankCacheStatus | string
  errorCategory?: ThinkTankErrorCategory | string
}

export interface ThinkTankEventInput {
  eventName: ThinkTankEventName | ThinkTankRegisteredEventName | string
  eventKind?: ThinkTankEventKind
  tenantId: string | null | undefined
  actorId: string | null | undefined
  subjectType: ThinkTankSubjectType | string | null | undefined
  subjectId: string | null | undefined
  outcome: ThinkTankEventOutcome | string
  privacyClassification: ThinkTankPrivacyClassification | string
  occurredAt?: Date | string
  correlationId?: string | null
  optional?: ThinkTankEventOptionalInput
  metadata?: Record<string, unknown>
}

export interface NormalizedThinkTankEvent extends Record<string, unknown> {
  event_name: ThinkTankRegisteredEventName
  event_version: number
  tenant_id: string
  actor_id: string
  subject_type: string
  subject_id: string
  outcome: string
  occurred_at: string
  correlation_id: string
  privacy_classification: string
}

const OUTCOME_VALUES = new Set<string>(Object.values(ThinkTankEventOutcome))
const PRIVACY_VALUES = new Set<string>(Object.values(ThinkTankPrivacyClassification))
const CACHE_VALUES = new Set<string>(Object.values(ThinkTankCacheStatus))
const ERROR_CATEGORY_VALUES = new Set<string>(Object.values(ThinkTankErrorCategory))
const RAW_SENSITIVE_KEYS = new Set([
  'conversation',
  'message',
  'messages',
  'prompt',
  'content',
  'rawcontent',
  'raw_content',
  'report',
  'document',
  'enterprisecontext',
  'enterprise_context',
  'attachments',
])
const RESERVED_METADATA_KEYS = new Set([
  'event_name',
  'event_version',
  'tenant_id',
  'actor_id',
  'subject_type',
  'subject_id',
  'outcome',
  'occurred_at',
  'correlation_id',
  'privacy_classification',
  'session_id',
  'output_id',
  'workflow_type',
  'provider',
  'latency_ms',
  'estimated_tokens',
  'estimated_cost',
  'cache_status',
  'error_category',
])

export function normalizeThinkTankEvent(input: ThinkTankEventInput): NormalizedThinkTankEvent {
  assertThinkTankEventRegistered(input.eventName, input.eventKind)
  assertNoRawSensitiveKeys(input.metadata ?? {})

  const outcome = requireEnumValue(input.outcome, OUTCOME_VALUES, 'outcome')
  const privacyClassification = requireEnumValue(
    input.privacyClassification,
    PRIVACY_VALUES,
    'privacy_classification',
  )
  const optional = normalizeOptionalFields(input.optional ?? {})
  const metadata = normalizeMetadata(input.metadata ?? {})

  return {
    event_name: input.eventName,
    event_version: THINKTANK_EVENT_VERSION,
    tenant_id: requireText(input.tenantId, 'tenant_id'),
    actor_id: requireText(input.actorId, 'actor_id'),
    subject_type: requireText(input.subjectType, 'subject_type'),
    subject_id: requireText(input.subjectId, 'subject_id'),
    outcome,
    occurred_at: normalizeOccurredAt(input.occurredAt),
    correlation_id: requireOptionalText(input.correlationId) ?? randomUUID(),
    privacy_classification: privacyClassification,
    ...optional,
    ...metadata,
  }
}

function normalizeOptionalFields(optional: ThinkTankEventOptionalInput): Record<string, unknown> {
  const normalized: Record<string, unknown> = {}

  assignIfDefined(normalized, 'session_id', optional.sessionId)
  assignIfDefined(normalized, 'output_id', optional.outputId)
  assignIfDefined(normalized, 'workflow_type', optional.workflowType)
  assignIfDefined(normalized, 'provider', optional.provider)
  assignIfDefined(normalized, 'latency_ms', optional.latencyMs)
  assignIfDefined(normalized, 'estimated_tokens', optional.estimatedTokens)
  assignIfDefined(normalized, 'estimated_cost', optional.estimatedCost)

  if (optional.cacheStatus !== undefined) {
    normalized.cache_status = requireEnumValue(optional.cacheStatus, CACHE_VALUES, 'cache_status')
  }

  if (optional.errorCategory !== undefined) {
    normalized.error_category = requireEnumValue(
      optional.errorCategory,
      ERROR_CATEGORY_VALUES,
      'error_category',
    )
  }

  return normalized
}

function normalizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => {
        const normalizedKey = toSnakeCase(key)
        if (RESERVED_METADATA_KEYS.has(normalizedKey)) {
          throw new Error(
            `ThinkTank event metadata cannot override reserved field: ${normalizedKey}`,
          )
        }
        return [normalizedKey, value]
      }),
  )
}

function assertNoRawSensitiveKeys(value: unknown, path: string[] = []): void {
  if (!value || typeof value !== 'object') return

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.replace(/[-_\s]/g, '').toLowerCase()
    if (RAW_SENSITIVE_KEYS.has(normalizedKey) || RAW_SENSITIVE_KEYS.has(toSnakeCase(key))) {
      throw new Error(
        `Raw sensitive ThinkTank event payload key is not allowed: ${[...path, key].join('.')}`,
      )
    }
    assertNoRawSensitiveKeys(child, [...path, key])
  }
}

function normalizeOccurredAt(value: Date | string | undefined): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('occurred_at must be a valid datetime')
    }
    return parsed.toISOString()
  }
  return new Date().toISOString()
}

function requireText(value: string | null | undefined, fieldName: string): string {
  const text = requireOptionalText(value)
  if (!text) {
    throw new Error(`ThinkTank event contract requires ${fieldName}`)
  }
  return text
}

function requireOptionalText(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function requireEnumValue(value: unknown, allowedValues: Set<string>, fieldName: string): string {
  if (typeof value !== 'string' || !allowedValues.has(value)) {
    throw new Error(`Invalid ThinkTank event ${fieldName}: ${String(value)}`)
  }
  return value
}

function assignIfDefined(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined) {
    target[key] = value
  }
}

function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase()
}
