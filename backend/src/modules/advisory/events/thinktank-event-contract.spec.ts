import {
  THINKTANK_EVENT_VERSION,
  ThinkTankCacheStatus,
  ThinkTankErrorCategory,
  ThinkTankEventName,
  ThinkTankEventOutcome,
  ThinkTankPrivacyClassification,
  ThinkTankSubjectType,
  normalizeThinkTankEvent,
} from './thinktank-event-contract'

const tenantId = '660e8400-e29b-41d4-a716-446655440014'
const actorId = '770e8400-e29b-41d4-a716-446655440014'
const correlationId = '880e8400-e29b-41d4-a716-446655440014'

describe('ThinkTank event contract', () => {
  it('normalizes required and optional fields to canonical snake_case keys', () => {
    const event = normalizeThinkTankEvent({
      eventName: ThinkTankEventName.AccessOpened,
      eventKind: 'audit',
      tenantId,
      actorId,
      subjectType: ThinkTankSubjectType.Module,
      subjectId: 'thinktank',
      outcome: ThinkTankEventOutcome.Success,
      privacyClassification: ThinkTankPrivacyClassification.Operational,
      correlationId,
      optional: {
        sessionId: 'session-1',
        outputId: 'output-1',
        workflowType: 'brainstorming',
        provider: 'glm-5.1',
        latencyMs: 123,
        estimatedTokens: 456,
        estimatedCost: 0.78,
        cacheStatus: ThinkTankCacheStatus.Miss,
        errorCategory: ThinkTankErrorCategory.Provider,
      },
      metadata: {
        module: 'thinktank',
        changedSetting: 'enabled',
      },
    })

    expect(event).toMatchObject({
      event_name: 'thinktank.access.opened',
      event_version: THINKTANK_EVENT_VERSION,
      tenant_id: tenantId,
      actor_id: actorId,
      subject_type: 'module',
      subject_id: 'thinktank',
      outcome: 'success',
      occurred_at: expect.any(String),
      correlation_id: correlationId,
      privacy_classification: 'operational',
      session_id: 'session-1',
      output_id: 'output-1',
      workflow_type: 'brainstorming',
      provider: 'glm-5.1',
      latency_ms: 123,
      estimated_tokens: 456,
      estimated_cost: 0.78,
      cache_status: 'miss',
      error_category: 'provider',
      module: 'thinktank',
      changed_setting: 'enabled',
    })
  })

  it('generates a correlation id when one is not supplied', () => {
    const event = normalizeThinkTankEvent({
      eventName: ThinkTankEventName.AccessDenied,
      eventKind: 'audit',
      tenantId,
      actorId,
      subjectType: ThinkTankSubjectType.Module,
      subjectId: 'thinktank',
      outcome: ThinkTankEventOutcome.Denied,
      privacyClassification: ThinkTankPrivacyClassification.Operational,
    })

    expect(event.correlation_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('rejects missing required fields and unknown events', () => {
    expect(() =>
      normalizeThinkTankEvent({
        eventName: ThinkTankEventName.AccessOpened,
        eventKind: 'audit',
        tenantId: '',
        actorId,
        subjectType: ThinkTankSubjectType.Module,
        subjectId: 'thinktank',
        outcome: ThinkTankEventOutcome.Success,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
      }),
    ).toThrow(/tenant_id/i)

    expect(() =>
      normalizeThinkTankEvent({
        eventName: 'thinktank.unknown',
        eventKind: 'audit',
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.Module,
        subjectId: 'thinktank',
        outcome: ThinkTankEventOutcome.Success,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
      }),
    ).toThrow(/unknown/i)
  })

  it('rejects raw sensitive payload keys by default', () => {
    expect(() =>
      normalizeThinkTankEvent({
        eventName: ThinkTankEventName.AccessDenied,
        eventKind: 'audit',
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.Module,
        subjectId: 'thinktank',
        outcome: ThinkTankEventOutcome.Denied,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        metadata: {
          conversation: 'raw user conversation',
          prompt: 'raw prompt',
        },
      }),
    ).toThrow(/raw sensitive/i)
  })

  it('rejects unknown subject types', () => {
    expect(() =>
      normalizeThinkTankEvent({
        eventName: ThinkTankEventName.AccessOpened,
        eventKind: 'audit',
        tenantId,
        actorId,
        subjectType: 'unknown_subject',
        subjectId: 'thinktank',
        outcome: ThinkTankEventOutcome.Success,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
      }),
    ).toThrow(/subject_type/i)
  })

  it('rejects invalid telemetry numeric fields', () => {
    expect(() =>
      normalizeThinkTankEvent({
        eventName: ThinkTankEventName.ProviderCallCompleted,
        eventKind: 'telemetry',
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.ProviderCall,
        subjectId: 'call-1',
        outcome: ThinkTankEventOutcome.Success,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        optional: {
          latencyMs: -1,
        },
      }),
    ).toThrow(/latency_ms/i)

    expect(() =>
      normalizeThinkTankEvent({
        eventName: ThinkTankEventName.ProviderCallCompleted,
        eventKind: 'telemetry',
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.ProviderCall,
        subjectId: 'call-1',
        outcome: ThinkTankEventOutcome.Success,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        optional: {
          estimatedTokens: 1.5,
        },
      }),
    ).toThrow(/estimated_tokens/i)
  })

  it('rejects metadata that attempts to override reserved contract fields', () => {
    expect(() =>
      normalizeThinkTankEvent({
        eventName: ThinkTankEventName.AccessOpened,
        eventKind: 'audit',
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.Module,
        subjectId: 'thinktank',
        outcome: ThinkTankEventOutcome.Success,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        metadata: {
          tenantId: 'attacker-controlled-tenant',
        },
      }),
    ).toThrow(/reserved field/i)
  })

  it('rejects telemetry events when the caller declares the audit kind', () => {
    expect(() =>
      normalizeThinkTankEvent({
        eventName: ThinkTankEventName.ProviderCallCompleted,
        eventKind: 'audit',
        tenantId,
        actorId,
        subjectType: 'provider_call',
        subjectId: 'call-1',
        outcome: ThinkTankEventOutcome.Success,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
      }),
    ).toThrow(/event kind/i)
  })
})
