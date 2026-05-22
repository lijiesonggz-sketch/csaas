import { AdvisoryOperationsService } from './advisory-operations.service'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const alternateTenantId = '111e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const dateFrom = '2026-05-01T00:00:00.000Z'
const dateTo = '2026-05-22T23:59:59.999Z'

type AuditLogRow = {
  id: string
  tenantId: string | null
  userId: string
  entityType: string
  entityId: string | null
  details: Record<string, unknown> | null
  createdAt: Date
}

function eventDetails(overrides: Record<string, unknown> = {}) {
  return {
    event_name: 'thinktank.workflow.started',
    event_version: 1,
    tenant_id: tenantId,
    actor_id: actorId,
    subject_type: 'workflow',
    subject_id: 'session-1',
    outcome: 'success',
    occurred_at: '2026-05-21T10:00:00.000Z',
    correlation_id: 'correlation-1',
    privacy_classification: 'operational',
    workflow_type: 'problem-solving',
    ...overrides,
  }
}

function auditLog(
  id: string,
  details: Record<string, unknown> | null,
  overrides: Partial<AuditLogRow> = {},
): AuditLogRow {
  return {
    id,
    tenantId,
    userId: actorId,
    entityType: 'ThinkTankWorkflowSession',
    entityId: typeof details?.subject_id === 'string' ? details.subject_id : null,
    details,
    createdAt: new Date('2026-05-21T10:00:00.000Z'),
    ...overrides,
  }
}

function createService(rows: AuditLogRow[]) {
  const auditLogSource = {
    findThinkTankUsageEvents: jest.fn().mockResolvedValue(rows),
  }

  return {
    service: new AdvisoryOperationsService(auditLogSource),
    auditLogSource,
  }
}

describe('AdvisoryOperationsService', () => {
  it('counts known versioned events by tenant and date range', async () => {
    const rows = [
      auditLog('start-1', eventDetails({ event_name: 'thinktank.workflow.started', subject_id: 'session-1' })),
      auditLog('start-2', eventDetails({ event_name: 'thinktank.workflow.started', subject_id: 'session-2' })),
      auditLog('complete-1', eventDetails({ event_name: 'thinktank.workflow.completed', subject_id: 'session-1' })),
      auditLog('start-failed-1', eventDetails({ event_name: 'thinktank.workflow.start_failed', subject_id: 'session-3', outcome: 'failure' })),
      auditLog('quick-start-1', eventDetails({ event_name: 'thinktank.quick_consult.started', subject_type: 'quick_consult', subject_id: 'quick-1' })),
      auditLog('quick-complete-1', eventDetails({ event_name: 'thinktank.quick_consult.completed', subject_type: 'quick_consult', subject_id: 'quick-1' })),
      auditLog('quick-failed-1', eventDetails({ event_name: 'thinktank.quick_consult.failed', subject_type: 'quick_consult', subject_id: 'quick-2', outcome: 'failure' })),
      auditLog('party-budget-1', eventDetails({ event_name: 'thinktank.party_mode.budget_exceeded', subject_type: 'session' })),
      auditLog('party-advisor-1', eventDetails({ event_name: 'thinktank.party_mode.advisor_failed', subject_type: 'session' })),
      auditLog(
        'other-tenant',
        eventDetails({ event_name: 'thinktank.workflow.started', tenant_id: alternateTenantId }),
        { tenantId: alternateTenantId },
      ),
    ]
    const { service, auditLogSource } = createService(rows)

    const result = await service.getUsageDashboard({
      tenantId,
      dateFrom,
      dateTo,
      actor: { id: actorId, role: 'admin' },
      now: new Date('2026-05-22T16:12:12.000Z'),
    })

    expect(auditLogSource.findThinkTankUsageEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        dateFrom: new Date(dateFrom),
        dateTo: new Date(dateTo),
        eventNames: expect.arrayContaining([
          'thinktank.workflow.started',
          'thinktank.workflow.completed',
          'thinktank.quick_consult.started',
          'thinktank.quick_consult.completed',
        ]),
      }),
    )
    expect(result.appliedFilters).toEqual({ tenantId, dateFrom, dateTo })
    expect(result.summary.quickConsult).toEqual({ started: 1, completed: 1, failed: 1, volume: 1 })
    expect(result.summary.workflows).toEqual({
      started: 2,
      completed: 1,
      startFailed: 1,
      incomplete: 1,
      completionRate: 0.5,
    })
    expect(result.summary.partyMode).toEqual({ budgetExceeded: 1, advisorFailed: 1 })
    expect(result.usageByWorkflowType).toEqual([
      expect.objectContaining({
        workflowKey: 'problem-solving',
        starts: 2,
        completions: 1,
        startFailures: 1,
        incompleteSessions: 1,
        completionRate: 0.5,
      }),
    ])
    expect(result.instrumentationGaps).toEqual([])
    expect(result.freshness.status).toBe('fresh')
  })

  it('reports malformed and unknown rows as instrumentation gaps without turning them into zero success metrics', async () => {
    const rows = [
      auditLog('valid-start', eventDetails({ workflow_type: 'design-thinking' })),
      auditLog('unknown', eventDetails({ event_name: 'thinktank.workflow.mystery' })),
      auditLog('missing-version', eventDetails({ event_version: undefined })),
      auditLog('wrong-version', eventDetails({ event_version: 999 })),
      auditLog('bad-date', eventDetails({ occurred_at: 'not-a-date' })),
      auditLog('missing-workflow', eventDetails({ workflow_type: undefined })),
      auditLog('empty-details', null),
    ]
    const { service } = createService(rows)

    const result = await service.getUsageDashboard({
      tenantId,
      dateFrom,
      dateTo,
      now: new Date('2026-05-22T16:12:12.000Z'),
    })

    expect(result.summary.workflows.started).toBe(1)
    expect(result.summary.workflows.completed).toBe(0)
    expect(result.summary.workflows.completionRate).toBeNull()
    expect(result.freshness.status).toBe('delayed')
    expect(result.instrumentationGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ auditLogId: 'unknown', reason: 'unknown_event_name' }),
        expect.objectContaining({ auditLogId: 'missing-version', reason: 'missing_event_version' }),
        expect.objectContaining({ auditLogId: 'wrong-version', reason: 'event_version_mismatch' }),
        expect.objectContaining({ auditLogId: 'bad-date', reason: 'invalid_occurred_at' }),
        expect.objectContaining({ auditLogId: 'missing-workflow', reason: 'missing_workflow_identifier' }),
        expect.objectContaining({ auditLogId: 'empty-details', reason: 'missing_event_details' }),
      ]),
    )
  })

  it('does not trust mismatched details tenant ids or treat registered non-usage ThinkTank events as gaps', async () => {
    const rows = [
      auditLog(
        'forged-tenant',
        eventDetails({ event_name: 'thinktank.workflow.started', tenant_id: tenantId }),
        { tenantId: alternateTenantId },
      ),
      auditLog('provider-telemetry', eventDetails({ event_name: 'thinktank.provider.call_completed' })),
      auditLog('valid-start', eventDetails({ subject_id: 'session-valid' })),
    ]
    const { service } = createService(rows)

    const result = await service.getUsageDashboard({
      tenantId,
      dateFrom,
      dateTo,
      now: new Date('2026-05-22T16:12:12.000Z'),
    })

    expect(result.summary.workflows.started).toBe(1)
    expect(result.instrumentationGaps).toEqual([])
  })

  it('scopes malformed gap reporting to the selected operational window and redacts unsafe unknown event names', async () => {
    const rows = [
      auditLog(
        'old-bad-row',
        eventDetails({ event_name: 'thinktank.workflow.mystery', occurred_at: '2026-04-01T10:00:00.000Z' }),
        { createdAt: new Date('2026-04-01T10:00:00.000Z') },
      ),
      auditLog(
        'unsafe-unknown',
        eventDetails({
          event_name: 'thinktank.workflow.PRIVATE_PROMPT_DO_NOT_RENDER',
          occurred_at: '2026-05-21T10:00:00.000Z',
        }),
      ),
    ]
    const { service } = createService(rows)

    const result = await service.getUsageDashboard({
      tenantId,
      dateFrom,
      dateTo,
      now: new Date('2026-05-22T16:12:12.000Z'),
    })

    expect(result.instrumentationGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          auditLogId: 'unsafe-unknown',
          eventName: 'unregistered_thinktank_event',
          reason: 'unknown_event_name',
        }),
      ]),
    )
    expect(result.instrumentationGaps).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ auditLogId: 'old-bad-row' })]),
    )
    expect(JSON.stringify(result)).not.toContain('PRIVATE_PROMPT_DO_NOT_RENDER')
  })

  it('surfaces workflow completions without starts as instrumentation gaps', async () => {
    const rows = [
      auditLog(
        'complete-without-start',
        eventDetails({
          event_name: 'thinktank.workflow.completed',
          workflow_type: 'governance-review',
          subject_id: 'session-without-start',
        }),
      ),
    ]
    const { service } = createService(rows)

    const result = await service.getUsageDashboard({
      tenantId,
      dateFrom,
      dateTo,
      now: new Date('2026-05-22T16:12:12.000Z'),
    })

    expect(result.usageByWorkflowType).toEqual([
      expect.objectContaining({
        workflowKey: 'governance-review',
        starts: 0,
        completions: 1,
        completionRate: null,
      }),
    ])
    expect(result.instrumentationGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventName: 'thinktank.workflow.completed',
          reason: 'completion_without_start',
        }),
      ]),
    )
    expect(result.summary.measurementStatus).toBe('delayed')
  })

  it('flags low-completion workflows and never returns raw private content keys', async () => {
    const rows = [
      auditLog('domain-start-1', eventDetails({ workflow_type: 'domain-research', subject_id: 'domain-1', prompt: 'PRIVATE_PROMPT' })),
      auditLog('domain-start-2', eventDetails({ workflow_type: 'domain-research', subject_id: 'domain-2', message: 'PRIVATE_MESSAGE' })),
      auditLog('domain-start-3', eventDetails({ workflow_type: 'domain-research', subject_id: 'domain-3', content: 'PRIVATE_CONTENT' })),
      auditLog('domain-start-4', eventDetails({ workflow_type: 'domain-research', subject_id: 'domain-4' })),
      auditLog('domain-complete-1', eventDetails({ event_name: 'thinktank.workflow.completed', workflow_type: 'domain-research', subject_id: 'domain-1' })),
      auditLog('design-start-1', eventDetails({ workflow_type: 'design-thinking', subject_id: 'design-1' })),
      auditLog('design-complete-1', eventDetails({ event_name: 'thinktank.workflow.completed', workflow_type: 'design-thinking', subject_id: 'design-1' })),
    ]
    const { service } = createService(rows)

    const result = await service.getUsageDashboard({
      tenantId,
      dateFrom,
      dateTo,
      now: new Date('2026-05-22T16:12:12.000Z'),
    })

    expect(result.lowCompletionWorkflows).toEqual([
      expect.objectContaining({
        workflowKey: 'domain-research',
        trendPeriod: { dateFrom, dateTo },
        starts: 4,
        completions: 1,
        incompleteSessions: 3,
        completionRate: 0.25,
        threshold: 0.5,
        drilldown: expect.objectContaining({
          starts: 4,
          completions: 1,
          startFailures: 0,
          incompleteSessions: 3,
        }),
      }),
    ])
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_|prompt|message|content|conversation|report|feedback/i)
  })

  it('marks delayed or unavailable telemetry without presenting trusted zero-only measurements', async () => {
    const delayed = createService([
      auditLog(
        'stale-start',
        eventDetails({ occurred_at: '2026-05-01T08:00:00.000Z' }),
        { createdAt: new Date('2026-05-01T08:00:00.000Z') },
      ),
    ])

    await expect(
      delayed.service.getUsageDashboard({
        tenantId,
        dateFrom,
        dateTo,
        now: new Date('2026-05-22T16:12:12.000Z'),
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

    const sourceUnavailable = {
      findThinkTankUsageEvents: jest.fn().mockRejectedValue(new Error('audit_logs unavailable')),
    }
    const unavailable = new AdvisoryOperationsService(sourceUnavailable)
    const result = await unavailable.getUsageDashboard({ tenantId, dateFrom, dateTo })

    expect(result.summary.measurementStatus).toBe('unavailable')
    expect(result.summary.workflows.completionRate).toBeNull()
    expect(result.freshness).toEqual(
      expect.objectContaining({ source: 'audit_logs', status: 'unavailable' }),
    )
    expect(result.instrumentationGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'telemetry_source_unavailable', source: 'audit_logs' }),
      ]),
    )
  })
})
