export {}

import {
  THINKTANK_EVENT_VERSION,
  ThinkTankEventName,
  ThinkTankPrivacyClassification,
  ThinkTankSubjectType,
} from '../events/thinktank-event-contract'

const serviceModulePath = './advisory-provider-telemetry.service'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const otherTenantId = '111e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const dateFrom = '2026-05-01T00:00:00.000Z'
const dateTo = '2026-05-22T23:59:59.999Z'
const providerEventNames = [
  ThinkTankEventName.ProviderCallCompleted,
  ThinkTankEventName.ProviderCallFailed,
  ThinkTankEventName.ProviderCallRetried,
  ThinkTankEventName.PromptCacheHit,
  ThinkTankEventName.PromptCacheMiss,
]

type AuditRow = {
  id: string
  tenantId: string | null
  userId: string
  entityType: string
  entityId: string | null
  details: Record<string, unknown> | null
  createdAt: Date
}

function telemetry(overrides: Record<string, unknown> = {}) {
  return {
    event_name: ThinkTankEventName.ProviderCallCompleted,
    event_version: THINKTANK_EVENT_VERSION,
    tenant_id: tenantId,
    actor_id: actorId,
    subject_type: ThinkTankSubjectType.ProviderCall,
    subject_id: 'provider-call-1',
    outcome: 'success',
    occurred_at: '2026-05-21T10:00:00.000Z',
    correlation_id: 'correlation-1',
    privacy_classification: ThinkTankPrivacyClassification.Operational,
    provider: 'zhipu-glm',
    workflow_type: 'problem-solving',
    latency_ms: 100,
    estimated_tokens: 10,
    estimated_cost: 0.01,
    ...overrides,
  }
}

function auditLog(
  id: string,
  details: Record<string, unknown> | null,
  overrides: Partial<AuditRow> = {},
): AuditRow {
  return {
    id,
    tenantId,
    userId: actorId,
    entityType: 'ThinkTankProviderTelemetry',
    entityId: typeof details?.subject_id === 'string' ? details.subject_id : null,
    details,
    createdAt: new Date('2026-05-21T10:00:00.000Z'),
    ...overrides,
  }
}

async function createService(rows: AuditRow[]) {
  const { AdvisoryProviderTelemetryService } = await import(serviceModulePath)
  const auditLogSource = {
    findThinkTankProviderTelemetryEvents: jest.fn().mockResolvedValue(rows),
  }

  return {
    service: new AdvisoryProviderTelemetryService(auditLogSource),
    auditLogSource,
  }
}

describe('Story 6.2 Provider Telemetry Aggregation backend ATDD', () => {
  test('[P0][6.2-UNIT-001][AC1,AC3] deterministically aggregates fake provider completed failed and retried telemetry', async () => {
    const rows = [
      auditLog(
        'completed-1',
        telemetry({
          subject_id: 'call-1',
          correlation_id: 'corr-1',
          latency_ms: 1200,
          estimated_tokens: 140,
          input_tokens: 100,
          output_tokens: 40,
          total_tokens: 140,
          estimated_cost: 0.21,
        }),
      ),
      auditLog(
        'completed-2',
        telemetry({
          subject_id: 'call-2',
          correlation_id: 'corr-2',
          latency_ms: 600,
          estimated_tokens: 80,
          input_tokens: 60,
          output_tokens: 20,
          total_tokens: 80,
          estimated_cost: 0.14,
        }),
      ),
      auditLog(
        'failed-timeout',
        telemetry({
          event_name: ThinkTankEventName.ProviderCallFailed,
          outcome: 'failure',
          subject_id: 'call-3',
          correlation_id: 'corr-3',
          latency_ms: 900,
          estimated_tokens: 130,
          input_tokens: 90,
          output_tokens: 40,
          total_tokens: 130,
          estimated_cost: 0.2,
          error_category: 'timeout',
          status: 'timeout',
        }),
      ),
      auditLog(
        'retried-1',
        telemetry({
          event_name: ThinkTankEventName.ProviderCallRetried,
          outcome: 'partial',
          subject_id: 'call-3',
          correlation_id: 'corr-3',
          latency_ms: 200,
          retry_attempt: 1,
          max_attempts: 2,
          retryable: true,
          error_category: 'provider',
        }),
      ),
      auditLog('foreign-tenant', telemetry({ subject_id: 'call-foreign' }), {
        tenantId: otherTenantId,
      }),
    ]
    const { service, auditLogSource } = await createService(rows)

    const result = await service.getProviderTelemetry({
      tenantId,
      dateFrom,
      dateTo,
      now: new Date('2026-05-22T17:40:00.000Z'),
    })

    expect(auditLogSource.findThinkTankProviderTelemetryEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        dateFrom: new Date(dateFrom),
        dateTo: new Date(dateTo),
        eventNames: expect.arrayContaining(providerEventNames),
      }),
    )
    expect(result.summary).toEqual(
      expect.objectContaining({
        terminalCalls: 3,
        successfulCalls: 2,
        failedCalls: 1,
        retryEvents: 1,
        errorRate: 0.3333,
        timeoutRate: 0.3333,
        estimatedTokens: 350,
        estimatedCost: 0.55,
      }),
    )
    expect(result.summary.latency).toEqual(expect.objectContaining({ averageMs: 900, p95Ms: 1200 }))
    expect(result.summary.tokens).toEqual({ input: 250, output: 100, total: 350, estimated: 350 })
    expect(result.byProvider).toEqual([
      expect.objectContaining({ provider: 'zhipu-glm', terminalCalls: 3, retryEvents: 1 }),
    ])
  })

  test('[P0][6.2-UNIT-001B][AC1] treats HTTP 408 provider failures as timeout failures', async () => {
    const rows = [
      auditLog(
        'failed-408',
        telemetry({
          event_name: ThinkTankEventName.ProviderCallFailed,
          outcome: 'failure',
          subject_id: 'call-408',
          correlation_id: 'corr-408',
          error_category: 'provider',
          status: 'failed',
          error_code: 'THINKTANK_PROVIDER_408',
        }),
      ),
    ]
    const { service } = await createService(rows)

    const result = await service.getProviderTelemetry({
      tenantId,
      dateFrom,
      dateTo,
      now: new Date('2026-05-22T17:40:00.000Z'),
    })

    expect(result.summary).toEqual(
      expect.objectContaining({
        terminalCalls: 1,
        failedCalls: 1,
        errorRate: 1,
        timeoutRate: 1,
      }),
    )
  })

  test('[P0][6.2-UNIT-002][AC1,AC3] computes cache usage without double counting provider tokens or cost', async () => {
    const rows = [
      auditLog(
        'provider-with-cache-status',
        telemetry({
          subject_id: 'call-cache-1',
          correlation_id: 'corr-cache-1',
          cache_status: 'hit',
          estimated_tokens: 180,
          input_tokens: 120,
          output_tokens: 60,
          total_tokens: 180,
          estimated_cost: 0.24,
        }),
      ),
      auditLog(
        'cache-hit',
        telemetry({
          event_name: ThinkTankEventName.PromptCacheHit,
          subject_id: 'cache-1',
          correlation_id: 'corr-cache-1',
          cache_status: 'hit',
          estimated_tokens: 999,
          estimated_cost: 9.99,
          cached_input_tokens: 120,
        }),
      ),
      auditLog(
        'cache-miss',
        telemetry({
          event_name: ThinkTankEventName.PromptCacheMiss,
          subject_id: 'cache-2',
          correlation_id: 'corr-cache-2',
          cache_status: 'miss',
          estimated_tokens: 999,
          estimated_cost: 9.99,
          cache_eligible_input_tokens: 80,
        }),
      ),
      auditLog(
        'cache-bypass',
        telemetry({
          event_name: ThinkTankEventName.PromptCacheMiss,
          subject_id: 'cache-3',
          correlation_id: 'corr-cache-3',
          cache_status: 'bypass',
          estimated_tokens: 999,
          estimated_cost: 9.99,
          cache_bypass_reason: 'provider_metadata_absent',
        }),
      ),
      auditLog(
        'cache-hit-mismatch',
        telemetry({
          event_name: ThinkTankEventName.PromptCacheHit,
          subject_id: 'cache-4',
          correlation_id: 'corr-cache-4',
          cache_status: 'miss',
        }),
      ),
    ]
    const { service } = await createService(rows)

    const result = await service.getProviderTelemetry({
      tenantId,
      dateFrom,
      dateTo,
      now: new Date('2026-05-22T17:40:00.000Z'),
    })

    expect(result.summary.estimatedTokens).toBe(180)
    expect(result.summary.estimatedCost).toBe(0.24)
    expect(result.cache).toEqual(
      expect.objectContaining({
        hits: 1,
        misses: 1,
        bypasses: 1,
        totalLookups: 3,
        hitRate: 0.3333,
        cachedInputTokens: 120,
      }),
    )
    expect(result.instrumentationGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          auditLogId: 'cache-hit-mismatch',
          reason: 'cache_status_event_mismatch',
        }),
      ]),
    )
  })

  test('[P0][6.2-UNIT-003][AC1] groups metrics by workflow Quick Consult Party Mode and provider from safe metadata', async () => {
    const rows = [
      auditLog(
        'workflow-provider',
        telemetry({
          subject_id: 'call-workflow',
          correlation_id: 'corr-workflow',
          workflow_type: 'domain-research',
          provider: 'zhipu-glm',
        }),
      ),
      auditLog(
        'quick-provider',
        telemetry({
          subject_id: 'quick-1',
          subject_type: ThinkTankSubjectType.QuickConsult,
          correlation_id: 'corr-quick',
          workflow_type: 'quick-consult',
          provider: 'zhipu-glm',
          quick_consult: true,
        }),
      ),
      auditLog(
        'party-provider',
        telemetry({
          subject_id: 'party-1',
          subject_type: ThinkTankSubjectType.Session,
          correlation_id: 'corr-party',
          workflow_type: 'party-mode',
          provider: 'anthropic-claude',
          party_mode_message: true,
        }),
      ),
    ]
    const { service } = await createService(rows)

    const result = await service.getProviderTelemetry({
      tenantId,
      dateFrom,
      dateTo,
      groupBy: ['workflow', 'experience', 'provider'],
      now: new Date('2026-05-22T17:40:00.000Z'),
    })

    expect(result.byWorkflow).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ workflowKey: 'domain-research', terminalCalls: 1 }),
        expect.objectContaining({ workflowKey: 'quick-consult', terminalCalls: 1 }),
        expect.objectContaining({ workflowKey: 'party-mode', terminalCalls: 1 }),
      ]),
    )
    expect(result.byExperience).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ experience: 'workflow', terminalCalls: 1 }),
        expect.objectContaining({ experience: 'quick_consult', terminalCalls: 1 }),
        expect.objectContaining({ experience: 'party_mode', terminalCalls: 1 }),
      ]),
    )
    expect(result.byProvider).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: 'zhipu-glm', terminalCalls: 2 }),
        expect.objectContaining({ provider: 'anthropic-claude', terminalCalls: 1 }),
      ]),
    )
    expect(result.instrumentationGaps).toEqual([])

    const providerOnly = await service.getProviderTelemetry({
      tenantId,
      dateFrom,
      dateTo,
      groupBy: ['provider'],
      now: new Date('2026-05-22T17:40:00.000Z'),
    })

    expect(providerOnly.byProvider).toEqual(
      expect.arrayContaining([expect.objectContaining({ provider: 'zhipu-glm' })]),
    )
    expect(providerOnly.byWorkflow).toEqual([])
    expect(providerOnly.byExperience).toEqual([])
  })

  test('[P0][6.2-UNIT-004][AC2] rejects unknown unversioned malformed wrong version and privacy unsafe rows as instrumentation gaps', async () => {
    const rawSecret = 'PRIVATE_PROMPT_DO_NOT_RENDER'
    const rows = [
      auditLog(
        'valid-provider',
        telemetry({ subject_id: 'valid-call', correlation_id: 'corr-valid' }),
      ),
      auditLog('unknown-event', telemetry({ event_name: 'thinktank.provider.unknown' })),
      auditLog('missing-version', telemetry({ event_version: undefined })),
      auditLog('wrong-version', telemetry({ event_version: 999 })),
      auditLog('wrong-version-sensitive', telemetry({ event_version: { prompt: rawSecret } })),
      auditLog('bad-date', telemetry({ occurred_at: 'not-a-date' })),
      auditLog('future-date', telemetry({ occurred_at: '2027-01-01T00:00:00.000Z' })),
      auditLog(
        'non-operational',
        telemetry({ privacy_classification: ThinkTankPrivacyClassification.Restricted }),
      ),
      auditLog('missing-required', telemetry({ correlation_id: undefined })),
      auditLog('raw-sensitive', telemetry({ prompt: rawSecret })),
      auditLog('tenant-mismatch', telemetry({ tenant_id: otherTenantId })),
      auditLog('unsafe-provider-value', telemetry({ provider: rawSecret })),
      auditLog('unsafe-workflow-value', telemetry({ workflow_type: rawSecret })),
      auditLog('empty-details', null),
    ]
    const { service } = await createService(rows)

    const result = await service.getProviderTelemetry({
      tenantId,
      dateFrom,
      dateTo,
      now: new Date('2026-05-22T17:40:00.000Z'),
    })

    expect(result.summary.terminalCalls).toBe(1)
    expect(result.instrumentationGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ auditLogId: 'unknown-event', reason: 'unknown_event_name' }),
        expect.objectContaining({ auditLogId: 'missing-version', reason: 'missing_event_version' }),
        expect.objectContaining({
          auditLogId: 'wrong-version',
          reason: 'event_version_mismatch',
          expectedVersion: THINKTANK_EVENT_VERSION,
          actualVersion: 999,
        }),
        expect.objectContaining({
          auditLogId: 'wrong-version-sensitive',
          reason: 'privacy_unsafe_payload',
        }),
        expect.objectContaining({ auditLogId: 'bad-date', reason: 'invalid_occurred_at' }),
        expect.objectContaining({ auditLogId: 'future-date', reason: 'future_occurred_at' }),
        expect.objectContaining({
          auditLogId: 'non-operational',
          reason: 'privacy_classification_not_operational',
        }),
        expect.objectContaining({
          auditLogId: 'missing-required',
          reason: 'missing_required_field',
        }),
        expect.objectContaining({ auditLogId: 'raw-sensitive', reason: 'privacy_unsafe_payload' }),
        expect.objectContaining({ auditLogId: 'tenant-mismatch', reason: 'tenant_mismatch' }),
        expect.objectContaining({
          auditLogId: 'unsafe-provider-value',
          reason: 'invalid_provider_metadata',
        }),
        expect.objectContaining({
          auditLogId: 'unsafe-workflow-value',
          reason: 'invalid_grouping_metadata',
        }),
        expect.objectContaining({ auditLogId: 'empty-details', reason: 'missing_event_details' }),
      ]),
    )
    expect(JSON.stringify(result)).not.toContain(rawSecret)
  })

  test('[P1][6.2-UNIT-005][AC2] surfaces delayed freshness and source unavailable states instead of trusted zero-only metrics', async () => {
    const stale = await createService([
      auditLog('stale-provider', telemetry({ occurred_at: '2026-05-01T08:00:00.000Z' }), {
        createdAt: new Date('2026-05-01T08:00:00.000Z'),
      }),
    ])

    await expect(
      stale.service.getProviderTelemetry({
        tenantId,
        dateFrom,
        dateTo,
        now: new Date('2026-05-22T17:40:00.000Z'),
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({ measurementStatus: 'delayed' }),
        freshness: expect.objectContaining({
          source: 'audit_logs',
          status: 'delayed',
          latestEventAt: '2026-05-01T08:00:00.000Z',
        }),
        instrumentationGaps: expect.arrayContaining([
          expect.objectContaining({ reason: 'telemetry_delayed' }),
        ]),
      }),
    )

    const { AdvisoryProviderTelemetryService } = await import(serviceModulePath)
    const unavailableSource = {
      findThinkTankProviderTelemetryEvents: jest
        .fn()
        .mockRejectedValue(new Error('audit_logs unavailable')),
    }
    const unavailable = new AdvisoryProviderTelemetryService(unavailableSource)
    const result = await unavailable.getProviderTelemetry({
      tenantId,
      dateFrom,
      dateTo,
      now: new Date('2026-05-22T17:40:00.000Z'),
    })

    expect(result.summary.measurementStatus).toBe('unavailable')
    expect(result.summary.errorRate).toBeNull()
    expect(result.summary.timeoutRate).toBeNull()
    expect(result.freshness).toEqual(
      expect.objectContaining({ source: 'audit_logs', status: 'unavailable' }),
    )
    expect(result.instrumentationGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'telemetry_source_unavailable', source: 'audit_logs' }),
      ]),
    )
  })

  test('[P0][6.2-UNIT-006][AC2] enforces service-level tenant scope and maximum query window before reading rows', async () => {
    const { service, auditLogSource } = await createService([])

    await expect(
      service.getProviderTelemetry({
        actor: { id: actorId, tenantId },
        tenantId: otherTenantId,
        dateFrom,
        dateTo,
      }),
    ).rejects.toThrow('无权查看其他租户')

    await expect(
      service.getProviderTelemetry({
        tenantId,
        dateFrom: '2026-01-01',
        dateTo: '2026-05-22',
      }),
    ).rejects.toThrow(/90 days/i)

    expect(auditLogSource.findThinkTankProviderTelemetryEvents).not.toHaveBeenCalled()
  })
})
