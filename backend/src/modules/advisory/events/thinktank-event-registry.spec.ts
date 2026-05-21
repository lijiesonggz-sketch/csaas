import {
  THINKTANK_AUDIT_EVENT_NAMES,
  THINKTANK_TELEMETRY_EVENT_NAMES,
  assertThinkTankEventRegistered,
} from './thinktank-event-registry'

describe('ThinkTank event registry', () => {
  it('exposes the exact initial audit event names owned by the registry', () => {
    expect(THINKTANK_AUDIT_EVENT_NAMES).toEqual([
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
    ])
  })

  it('exposes the exact initial telemetry event names owned by the registry', () => {
    expect(THINKTANK_TELEMETRY_EVENT_NAMES).toEqual([
      'thinktank.provider.call_completed',
      'thinktank.provider.call_failed',
      'thinktank.provider.call_retried',
      'thinktank.prompt_cache.hit',
      'thinktank.prompt_cache.miss',
      'thinktank.checkpoint.persistence_failed',
      'thinktank.recommendation.feedback_submitted',
      'thinktank.output.rating_submitted',
      'thinktank.output.favorite_updated',
      'thinktank.context_compression.executed',
      'thinktank.context_compression.deferred',
      'thinktank.party_mode.budget_exceeded',
      'thinktank.party_mode.advisor_failed',
    ])
  })

  it('fails closed for unknown event names and invalid kind/name pairings', () => {
    expect(() => assertThinkTankEventRegistered('thinktank.access.opened', 'audit')).not.toThrow()
    expect(() =>
      assertThinkTankEventRegistered('thinktank.provider.call_completed', 'telemetry'),
    ).not.toThrow()
    expect(() =>
      assertThinkTankEventRegistered('thinktank.checkpoint.persistence_failed', 'telemetry'),
    ).not.toThrow()
    expect(() => assertThinkTankEventRegistered('thinktank.access.opened', 'telemetry')).toThrow(
      /event kind/i,
    )
    expect(() => assertThinkTankEventRegistered('thinktank.unknown', 'audit')).toThrow(/unknown/i)
  })
})
