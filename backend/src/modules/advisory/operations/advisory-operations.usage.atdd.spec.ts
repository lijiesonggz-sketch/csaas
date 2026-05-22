export {}

const serviceModulePath = './advisory-operations.service'

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

const knownEventNames = [
  'thinktank.workflow.started',
  'thinktank.workflow.start_failed',
  'thinktank.workflow.completed',
  'thinktank.quick_consult.started',
  'thinktank.quick_consult.completed',
  'thinktank.quick_consult.failed',
  'thinktank.party_mode.budget_exceeded',
  'thinktank.party_mode.advisor_failed',
]

const eventDetails = (overrides: Record<string, unknown> = {}) => ({
  event_name: 'thinktank.workflow.started',
  event_version: 1,
  tenant_id: tenantId,
  actor_id: actorId,
  subject_type: 'workflow',
  subject_id: 'session-problem-solving-1',
  outcome: 'success',
  occurred_at: '2026-05-21T10:00:00.000Z',
  correlation_id: 'correlation-usage-1',
  privacy_classification: 'operational',
  workflow_type: 'problem-solving',
  ...overrides,
})

const auditLog = (
  id: string,
  details: Record<string, unknown> | null,
  overrides: Partial<AuditLogRow> = {},
): AuditLogRow => ({
  id,
  tenantId: tenantId,
  userId: actorId,
  entityType: 'ThinkTankEvent',
  entityId: typeof details?.subject_id === 'string' ? details.subject_id : null,
  details,
  createdAt: new Date('2026-05-21T10:00:00.000Z'),
  ...overrides,
})

const createAuditLogSource = (rows: AuditLogRow[]) => ({
  findThinkTankUsageEvents: jest.fn().mockResolvedValue(rows),
})

const instantiateService = async (rows: AuditLogRow[]) => {
  const { AdvisoryOperationsService } = await import(serviceModulePath)
  const auditLogSource = createAuditLogSource(rows)

  return {
    service: new AdvisoryOperationsService(auditLogSource as never),
    auditLogSource,
  }
}

describe('Story 6.1 Usage and Completion Dashboard backend service (ATDD RED)', () => {
  test('[P0][6.1-UNIT-001][AC1,AC2] counts only known versioned ThinkTank events by tenant and date range', async () => {
    const rows = [
      auditLog('audit-workflow-start-1', eventDetails({ event_name: 'thinktank.workflow.started', subject_id: 'session-1' })),
      auditLog('audit-workflow-start-2', eventDetails({ event_name: 'thinktank.workflow.started', subject_id: 'session-2' })),
      auditLog('audit-workflow-complete-1', eventDetails({ event_name: 'thinktank.workflow.completed', subject_id: 'session-1' })),
      auditLog('audit-workflow-start-failed-1', eventDetails({ event_name: 'thinktank.workflow.start_failed', subject_id: 'session-3', outcome: 'failure' })),
      auditLog('audit-quick-start-1', eventDetails({ event_name: 'thinktank.quick_consult.started', subject_type: 'quick_consult', subject_id: 'quick-1' })),
      auditLog('audit-quick-start-2', eventDetails({ event_name: 'thinktank.quick_consult.started', subject_type: 'quick_consult', subject_id: 'quick-2' })),
      auditLog('audit-quick-complete-1', eventDetails({ event_name: 'thinktank.quick_consult.completed', subject_type: 'quick_consult', subject_id: 'quick-1' })),
      auditLog('audit-quick-failed-1', eventDetails({ event_name: 'thinktank.quick_consult.failed', subject_type: 'quick_consult', subject_id: 'quick-2', outcome: 'failure' })),
      auditLog('audit-party-budget-1', eventDetails({ event_name: 'thinktank.party_mode.budget_exceeded', subject_type: 'session', subject_id: 'session-1', outcome: 'blocked' })),
      auditLog('audit-party-advisor-1', eventDetails({ event_name: 'thinktank.party_mode.advisor_failed', subject_type: 'session', subject_id: 'session-1', outcome: 'partial' })),
      auditLog('audit-other-tenant', eventDetails({ event_name: 'thinktank.workflow.started', tenant_id: alternateTenantId }), { tenantId: alternateTenantId }),
    ]
    const { service, auditLogSource } = await instantiateService(rows)

    const result = await service.getUsageDashboard({
      tenantId,
      dateFrom,
      dateTo,
      actor: { id: actorId, role: 'admin' },
    })

    expect(auditLogSource.findThinkTankUsageEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        dateFrom: new Date(dateFrom),
        dateTo: new Date(dateTo),
        eventNames: expect.arrayContaining(knownEventNames),
      }),
    )
    expect(result.appliedFilters).toEqual({ tenantId, dateFrom, dateTo })
    expect(result.summary).toEqual(
      expect.objectContaining({
        quickConsult: expect.objectContaining({ started: 2, completed: 1, failed: 1, volume: 2 }),
        workflows: expect.objectContaining({
          started: 2,
          completed: 1,
          startFailed: 1,
          incomplete: 1,
          completionRate: 0.5,
        }),
        partyMode: expect.objectContaining({ budgetExceeded: 1, advisorFailed: 1 }),
      }),
    )
    expect(result.usageByWorkflowType).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workflowKey: 'problem-solving',
          starts: 2,
          completions: 1,
          incompleteSessions: 1,
          completionRate: 0.5,
        }),
      ]),
    )
    expect(result.instrumentationGaps).toEqual([])
  })

  test('[P0][6.1-UNIT-002][AC2,AC4] reports unknown, unversioned, wrong-version, and malformed rows as instrumentation gaps', async () => {
    const rows = [
      auditLog('audit-valid-start', eventDetails({ event_name: 'thinktank.workflow.started', workflow_type: 'design-thinking' })),
      auditLog('audit-unknown', eventDetails({ event_name: 'thinktank.workflow.mystery' })),
      auditLog('audit-missing-version', eventDetails({ event_version: undefined })),
      auditLog('audit-wrong-version', eventDetails({ event_version: 999 })),
      auditLog('audit-bad-date', eventDetails({ occurred_at: 'not-a-date' })),
      auditLog('audit-missing-workflow', eventDetails({ workflow_type: undefined, subject_type: 'workflow' })),
      auditLog('audit-empty-details', null),
    ]
    const { service } = await instantiateService(rows)

    const result = await service.getUsageDashboard({ tenantId, dateFrom, dateTo })

    expect(result.summary.workflows.started).toBe(1)
    expect(result.summary.workflows.completed).toBe(0)
    expect(result.summary.workflows.completionRate).toBeNull()
    expect(result.instrumentationGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ auditLogId: 'audit-unknown', reason: 'unknown_event_name', eventName: 'thinktank.workflow.mystery' }),
        expect.objectContaining({ auditLogId: 'audit-missing-version', reason: 'missing_event_version' }),
        expect.objectContaining({ auditLogId: 'audit-wrong-version', reason: 'event_version_mismatch', expectedVersion: 1, actualVersion: 999 }),
        expect.objectContaining({ auditLogId: 'audit-bad-date', reason: 'invalid_occurred_at' }),
        expect.objectContaining({ auditLogId: 'audit-missing-workflow', reason: 'missing_workflow_identifier' }),
        expect.objectContaining({ auditLogId: 'audit-empty-details', reason: 'missing_event_details' }),
      ]),
    )
    expect(result.freshness.status).not.toBe('fresh')
  })

  test('[P1][6.1-UNIT-003][AC3] flags low-completion workflows and exposes aggregate drilldown without raw private content', async () => {
    const rawConversation = 'RAW CUSTOMER CONVERSATION THAT MUST NEVER LEAVE AUDIT DETAILS'
    const rows = [
      auditLog('audit-domain-start-1', eventDetails({ event_name: 'thinktank.workflow.started', workflow_type: 'domain-research', subject_id: 'domain-session-1', prompt: rawConversation })),
      auditLog('audit-domain-start-2', eventDetails({ event_name: 'thinktank.workflow.started', workflow_type: 'domain-research', subject_id: 'domain-session-2', message: rawConversation })),
      auditLog('audit-domain-start-3', eventDetails({ event_name: 'thinktank.workflow.started', workflow_type: 'domain-research', subject_id: 'domain-session-3', content: rawConversation })),
      auditLog('audit-domain-start-4', eventDetails({ event_name: 'thinktank.workflow.started', workflow_type: 'domain-research', subject_id: 'domain-session-4' })),
      auditLog('audit-domain-complete-1', eventDetails({ event_name: 'thinktank.workflow.completed', workflow_type: 'domain-research', subject_id: 'domain-session-1' })),
      auditLog('audit-design-start-1', eventDetails({ event_name: 'thinktank.workflow.started', workflow_type: 'design-thinking', subject_id: 'design-session-1' })),
      auditLog('audit-design-complete-1', eventDetails({ event_name: 'thinktank.workflow.completed', workflow_type: 'design-thinking', subject_id: 'design-session-1' })),
    ]
    const { service } = await instantiateService(rows)

    const result = await service.getUsageDashboard({ tenantId, dateFrom, dateTo })

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
    expect(JSON.stringify(result)).not.toContain(rawConversation)
    expect(JSON.stringify(result)).not.toMatch(/prompt|message|content|conversation|raw_content/i)
  })

  test('[P1][6.1-UNIT-004][AC4] marks delayed telemetry as stale instead of presenting zero-only successful measurements', async () => {
    const staleRows = [
      auditLog(
        'audit-stale-start',
        eventDetails({ event_name: 'thinktank.workflow.started', occurred_at: '2026-05-01T08:00:00.000Z' }),
        { createdAt: new Date('2026-05-01T08:00:00.000Z') },
      ),
    ]
    const { service } = await instantiateService(staleRows)

    const result = await service.getUsageDashboard({
      tenantId,
      dateFrom,
      dateTo,
      now: new Date('2026-05-22T16:12:12.000Z'),
    })

    expect(result.freshness).toEqual(
      expect.objectContaining({
        source: 'audit_logs',
        status: 'delayed',
        latestEventAt: '2026-05-01T08:00:00.000Z',
      }),
    )
    expect(result.summary.measurementStatus).toBe('delayed')
    expect(result.instrumentationGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'telemetry_delayed', owner: 'thinktank_instrumentation' }),
      ]),
    )
  })

  test('[P1][6.1-UNIT-005][AC4] returns unavailable freshness when the audit event source cannot be read', async () => {
    const { AdvisoryOperationsService } = await import(serviceModulePath)
    const auditLogSource = {
      findThinkTankUsageEvents: jest.fn().mockRejectedValue(new Error('audit_logs unavailable')),
    }
    const service = new AdvisoryOperationsService(auditLogSource as never)

    const result = await service.getUsageDashboard({ tenantId, dateFrom, dateTo })

    expect(result.freshness).toEqual(
      expect.objectContaining({
        source: 'audit_logs',
        status: 'unavailable',
        description: expect.stringMatching(/unavailable|delayed|try again/i),
      }),
    )
    expect(result.summary.measurementStatus).toBe('unavailable')
    expect(result.summary.workflows.completionRate).toBeNull()
    expect(result.instrumentationGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'telemetry_source_unavailable', source: 'audit_logs' }),
      ]),
    )
  })
})
