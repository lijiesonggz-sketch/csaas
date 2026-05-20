export type ThinkTankEventKind = 'audit' | 'telemetry'

export const THINKTANK_AUDIT_EVENT_NAMES = [
  'thinktank.access.opened',
  'thinktank.access.denied',
  'thinktank.module.enabled',
  'thinktank.module.disabled',
  'thinktank.role_access.updated',
  'thinktank.workflow.started',
  'thinktank.workflow.start_failed',
  'thinktank.workflow.completed',
  'thinktank.quick_consult.started',
  'thinktank.quick_consult.completed',
  'thinktank.quick_consult.failed',
  'thinktank.method_browse.failed',
  'thinktank.output.exported',
  'thinktank.session.deleted',
  'thinktank.output.deleted',
] as const

export const THINKTANK_TELEMETRY_EVENT_NAMES = [
  'thinktank.provider.call_completed',
  'thinktank.provider.call_failed',
  'thinktank.provider.call_retried',
  'thinktank.prompt_cache.hit',
  'thinktank.prompt_cache.miss',
  'thinktank.recommendation.feedback_submitted',
  'thinktank.output.rating_submitted',
  'thinktank.output.favorite_updated',
  'thinktank.context_compression.executed',
  'thinktank.context_compression.deferred',
  'thinktank.party_mode.budget_exceeded',
  'thinktank.party_mode.advisor_failed',
] as const

export type ThinkTankAuditEventName = (typeof THINKTANK_AUDIT_EVENT_NAMES)[number]
export type ThinkTankTelemetryEventName = (typeof THINKTANK_TELEMETRY_EVENT_NAMES)[number]
export type ThinkTankRegisteredEventName = ThinkTankAuditEventName | ThinkTankTelemetryEventName

const auditEventNames = new Set<string>(THINKTANK_AUDIT_EVENT_NAMES)
const telemetryEventNames = new Set<string>(THINKTANK_TELEMETRY_EVENT_NAMES)

export function getThinkTankEventKind(eventName: string): ThinkTankEventKind | null {
  if (auditEventNames.has(eventName)) return 'audit'
  if (telemetryEventNames.has(eventName)) return 'telemetry'
  return null
}

export function assertThinkTankEventRegistered(
  eventName: string,
  expectedKind?: ThinkTankEventKind,
): asserts eventName is ThinkTankRegisteredEventName {
  const actualKind = getThinkTankEventKind(eventName)

  if (!actualKind) {
    throw new Error(`Unknown ThinkTank event name: ${eventName}`)
  }

  if (expectedKind && actualKind !== expectedKind) {
    throw new Error(
      `ThinkTank event kind mismatch: ${eventName} is ${actualKind}, not ${expectedKind}`,
    )
  }
}
