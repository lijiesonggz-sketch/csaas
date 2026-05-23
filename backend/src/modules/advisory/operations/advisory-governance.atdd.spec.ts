export {}

import {
  THINKTANK_EVENT_VERSION,
  ThinkTankEventName,
  ThinkTankPrivacyClassification,
  ThinkTankSubjectType,
} from '../events/thinktank-event-contract'
import { UserRole } from '../../../database/entities/user.entity'

const serviceModulePath = './advisory-governance.service'
const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const otherTenantId = '111e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const dateFrom = '2026-05-01T00:00:00.000Z'
const dateTo = '2026-05-22T23:59:59.999Z'

type AuditRow = {
  id: string
  tenantId: string | null
  userId: string
  entityType: string
  entityId: string | null
  details: Record<string, unknown> | null
  createdAt: Date
}

function governanceEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_name: ThinkTankEventName.WorkflowStarted,
    event_version: THINKTANK_EVENT_VERSION,
    tenant_id: tenantId,
    actor_id: actorId,
    subject_type: ThinkTankSubjectType.Workflow,
    subject_id: 'workflow-1',
    outcome: 'success',
    occurred_at: '2026-05-21T10:00:00.000Z',
    correlation_id: 'corr-1',
    privacy_classification: ThinkTankPrivacyClassification.Operational,
    workflow_type: 'problem-solving',
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
    entityType: 'ThinkTankEvent',
    entityId: typeof details?.subject_id === 'string' ? details.subject_id : id,
    details,
    createdAt: new Date('2026-05-21T10:00:00.000Z'),
    ...overrides,
  }
}

async function createService(options: { rows?: AuditRow[]; error?: Error } = {}) {
  const { AdvisoryGovernanceService } = await import(serviceModulePath)
  const auditLogSource = {
    findThinkTankGovernanceEvents: jest.fn().mockImplementation(() => {
      if (options.error) throw options.error
      return Promise.resolve(options.rows ?? [])
    }),
  }

  return {
    service: new AdvisoryGovernanceService(auditLogSource),
    auditLogSource,
  }
}

describe('Story 6.5 governance review backend ATDD (RED)', () => {
  it('[6.5-BE-001][P0][AC1] aggregates trusted governance events by tenant actor event outcome workflow and date without raw content', async () => {
    const rows = [
      auditLog(
        'opened',
        governanceEvent({
          event_name: ThinkTankEventName.AccessOpened,
          subject_type: ThinkTankSubjectType.Session,
          subject_id: 'session-1',
        }),
      ),
      auditLog(
        'denied',
        governanceEvent({
          event_name: ThinkTankEventName.AccessDenied,
          outcome: 'denied',
          subject_id: 'session-2',
        }),
      ),
      auditLog(
        'exported',
        governanceEvent({
          event_name: ThinkTankEventName.OutputExported,
          subject_type: ThinkTankSubjectType.Output,
          subject_id: 'output-1',
          output_id: 'output-1',
          ai_label_metadata_present: true,
        }),
      ),
      auditLog('foreign-row', governanceEvent({ subject_id: 'foreign' }), {
        tenantId: otherTenantId,
      }),
    ]
    const { service, auditLogSource } = await createService({ rows })

    const result = await service.getGovernanceReview({
      actor: { id: actorId, tenantId, role: UserRole.ADMIN },
      currentTenantId: tenantId,
      tenantId,
      dateFrom,
      dateTo,
      groupBy: ['eventType', 'outcome', 'actor', 'workflow'],
      now: new Date('2026-05-23T00:00:00.000Z'),
    })

    expect(auditLogSource.findThinkTankGovernanceEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        dateFrom: new Date(dateFrom),
        dateTo: new Date(dateTo),
      }),
    )
    expect(result.appliedFilters).toEqual(expect.objectContaining({ tenantId }))
    expect(result.summary).toEqual(
      expect.objectContaining({
        totalEvents: 3,
        trustedEvents: 3,
        deniedActions: 1,
        exportedOutputs: 1,
        measurementStatus: 'fresh',
      }),
    )
    expect(result.byEventType).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventName: ThinkTankEventName.OutputExported,
          count: 1,
          owningArea: expect.stringMatching(/export/i),
        }),
      ]),
    )
    expect(result.byOutcome).toEqual(
      expect.arrayContaining([expect.objectContaining({ outcome: 'denied', count: 1 })]),
    )
    expect(result.byActor).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actorId, count: 3, deniedCount: 1, exportedOutputCount: 1 }),
      ]),
    )
    expect(result.byWorkflow).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ workflowKey: 'problem-solving', count: 3 }),
      ]),
    )
    expect(JSON.stringify(result)).not.toMatch(
      /PRIVATE_|conversation|prompt|message|report content|provider payload|cache key|full profile/i,
    )
  })

  it('[6.5-BE-002][P0][AC2] reports exported-output AI label metadata presence and missing-label compliance issues', async () => {
    const { service } = await createService({
      rows: [
        auditLog(
          'export-ok',
          governanceEvent({
            event_name: ThinkTankEventName.OutputExported,
            subject_type: ThinkTankSubjectType.Output,
            subject_id: 'output-ok',
            output_id: 'output-ok',
            ai_label_metadata_present: true,
          }),
        ),
        auditLog(
          'export-missing',
          governanceEvent({
            event_name: ThinkTankEventName.OutputExported,
            subject_type: ThinkTankSubjectType.Output,
            subject_id: 'output-missing',
            output_id: 'output-missing',
            ai_label_metadata_present: false,
          }),
        ),
      ],
    })

    const result = await service.getGovernanceReview({
      actor: { id: actorId, tenantId, role: UserRole.ADMIN },
      currentTenantId: tenantId,
      tenantId,
      dateFrom,
      dateTo,
    })

    expect(result.exportedOutputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outputId: 'output-ok',
          aiLabelMetadataPresent: true,
          complianceStatus: 'compliant',
        }),
        expect.objectContaining({
          outputId: 'output-missing',
          aiLabelMetadataPresent: false,
          complianceStatus: 'compliance_issue',
        }),
      ]),
    )
    expect(result.summary.exportsMissingAiLabelMetadata).toBe(1)
    expect(result.complianceIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueType: 'missing_ai_label_metadata',
          eventName: ThinkTankEventName.OutputExported,
          owningArea: expect.stringMatching(/export|output/i),
        }),
      ]),
    )
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_|content|conversation|prompt|report/i)
  })

  it('[6.5-BE-003][P0][AC3,AC4] maps malformed missing and unsafe events to instrumentation gaps with owner and story evidence', async () => {
    const { service } = await createService({
      rows: [
        auditLog('wrong-version', governanceEvent({ event_version: 999 })),
        auditLog('missing-type', governanceEvent({ event_name: undefined })),
        auditLog('bad-date', governanceEvent({ occurred_at: 'not-a-date' })),
        auditLog('non-operational', governanceEvent({ privacy_classification: 'restricted' })),
        auditLog('tenant-mismatch', governanceEvent({ tenant_id: otherTenantId })),
        auditLog('unknown-event', governanceEvent({ event_name: 'thinktank.unknown.event' })),
        auditLog('unsafe', governanceEvent({ prompt: 'PRIVATE_PROMPT_DO_NOT_RENDER' })),
      ],
    })

    const result = await service.getGovernanceReview({
      actor: { id: actorId, tenantId, role: UserRole.ADMIN },
      currentTenantId: tenantId,
      tenantId,
      dateFrom,
      dateTo,
    })

    expect(result.summary.malformedEvents).toBe(7)
    expect(result.instrumentationGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          auditLogId: 'wrong-version',
          reason: 'event_version_mismatch',
          expectedVersion: THINKTANK_EVENT_VERSION,
        }),
        expect.objectContaining({
          auditLogId: 'missing-type',
          reason: 'missing_required_field',
          field: 'event_name',
        }),
        expect.objectContaining({ auditLogId: 'bad-date', reason: 'invalid_occurred_at' }),
        expect.objectContaining({
          auditLogId: 'non-operational',
          reason: 'privacy_classification_not_operational',
        }),
        expect.objectContaining({ auditLogId: 'tenant-mismatch', reason: 'tenant_mismatch' }),
        expect.objectContaining({
          auditLogId: 'unknown-event',
          reason: 'unknown_event_name',
          owningStory: expect.any(String),
        }),
        expect.objectContaining({ auditLogId: 'unsafe', reason: 'privacy_unsafe_payload' }),
      ]),
    )
    expect(JSON.stringify(result)).not.toMatch(
      /PRIVATE_|prompt|conversation|message|report|provider payload|cache key/i,
    )
  })

  it('[6.5-BE-004][P1][AC3,AC4] returns unavailable measurement with null derived rates and explicit audit_logs gap when audit source fails', async () => {
    const { service } = await createService({ error: new Error('audit_logs unavailable') })

    const result = await service.getGovernanceReview({
      actor: { id: actorId, tenantId, role: UserRole.ADMIN },
      currentTenantId: tenantId,
      tenantId,
      dateFrom,
      dateTo,
    })

    expect(result.summary.measurementStatus).toBe('unavailable')
    expect(result.summary.trustedEventRate).toBeNull()
    expect(result.summary.exportsMissingAiLabelRate).toBeNull()
    expect(result.byEventType).toEqual([])
    expect(result.byOutcome).toEqual([])
    expect(result.byActor).toEqual([])
    expect(result.byWorkflow).toEqual([])
    expect(result.exportedOutputs).toEqual([])
    expect(result.freshness).toEqual(
      expect.objectContaining({ source: 'audit_logs', status: 'unavailable' }),
    )
    expect(result.instrumentationGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'audit_logs',
          reason: 'governance_source_unavailable',
        }),
      ]),
    )
  })

  it('[6.5-BE-005][P0][AC1] rejects foreign tenant scope before querying audit logs', async () => {
    const { service, auditLogSource } = await createService()

    await expect(
      service.getGovernanceReview({
        actor: { id: actorId, tenantId, role: UserRole.ADMIN },
        currentTenantId: tenantId,
        tenantId: otherTenantId,
        dateFrom,
        dateTo,
      }),
    ).rejects.toThrow(/other tenant|无权查看其他租户/i)

    expect(auditLogSource.findThinkTankGovernanceEvents).not.toHaveBeenCalled()
  })

  it('[6.5-BE-006][P1][AC1,AC3] honors groupBy allowlist by returning only requested governance groups', async () => {
    const { service } = await createService({
      rows: [auditLog('workflow', governanceEvent())],
    })

    const result = await service.getGovernanceReview({
      actor: { id: actorId, tenantId, role: UserRole.ADMIN },
      currentTenantId: tenantId,
      tenantId,
      dateFrom,
      dateTo,
      groupBy: ['eventType'],
    })

    expect(result.byEventType).toHaveLength(1)
    expect(result.byOutcome).toEqual([])
    expect(result.byActor).toEqual([])
    expect(result.byWorkflow).toEqual([])
  })

  it('[6.5-BE-007][P0][AC1,AC4] rejects unsafe governance filters before audit read and never echoes raw filter content', async () => {
    const { service, auditLogSource } = await createService()

    await expect(
      service.getGovernanceReview({
        actor: { id: actorId, tenantId, role: UserRole.ADMIN },
        currentTenantId: tenantId,
        tenantId,
        dateFrom,
        dateTo,
        actorId: 'PRIVATE_CONVERSATION_DO_NOT_RENDER',
      }),
    ).rejects.toThrow(/invalid actorId/i)

    await expect(
      service.getGovernanceReview({
        actor: { id: actorId, tenantId, role: UserRole.ADMIN },
        currentTenantId: tenantId,
        tenantId,
        dateFrom,
        dateTo,
        eventType: 'thinktank.output.exported.prompt',
      }),
    ).rejects.toThrow(/invalid eventType/i)

    expect(auditLogSource.findThinkTankGovernanceEvents).not.toHaveBeenCalled()
  })

  it('[6.5-BE-008][P0][AC1,AC3,AC4] validates malformed candidates before applying business filters', async () => {
    const { service, auditLogSource } = await createService({
      rows: [
        auditLog(
          'trusted-match',
          governanceEvent({
            event_name: ThinkTankEventName.OutputExported,
            subject_type: ThinkTankSubjectType.Output,
            subject_id: 'output-filtered',
            output_id: 'output-filtered',
            ai_label_metadata_present: true,
          }),
        ),
        auditLog(
          'missing-outcome',
          governanceEvent({
            event_name: ThinkTankEventName.OutputExported,
            subject_type: ThinkTankSubjectType.Output,
            subject_id: 'output-malformed',
            output_id: 'output-malformed',
            outcome: undefined,
          }),
        ),
      ],
    })

    const result = await service.getGovernanceReview({
      actor: { id: actorId, tenantId, role: UserRole.ADMIN },
      currentTenantId: tenantId,
      tenantId,
      dateFrom,
      dateTo,
      actorId,
      eventType: ThinkTankEventName.OutputExported,
      outcome: 'success',
      workflowType: 'problem-solving',
    })

    const sourceQuery = auditLogSource.findThinkTankGovernanceEvents.mock.calls[0][0]
    expect(sourceQuery.actorId).toBeUndefined()
    expect(sourceQuery.eventType).toBeUndefined()
    expect(sourceQuery.outcome).toBeUndefined()
    expect(sourceQuery.workflowType).toBeUndefined()
    expect(result.summary.trustedEvents).toBe(1)
    expect(result.summary.malformedEvents).toBe(1)
    expect(result.instrumentationGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          auditLogId: 'missing-outcome',
          reason: 'missing_required_field',
          field: 'outcome',
        }),
      ]),
    )
  })

  it('[6.5-BE-009][P0][AC1,AC2,AC4] redacts unsafe output identifiers and diagnostic event names', async () => {
    const { service } = await createService({
      rows: [
        auditLog(
          'unsafe-output-id',
          governanceEvent({
            event_name: ThinkTankEventName.OutputExported,
            subject_type: ThinkTankSubjectType.Output,
            subject_id: 'output-safe-subject',
            output_id: 'PRIVATE_CONVERSATION_DO_NOT_RENDER',
            ai_label_metadata_present: false,
          }),
        ),
        auditLog(
          'unsafe-event-name-gap',
          governanceEvent({
            event_name: 'PRIVATE_PROMPT_DO_NOT_RENDER',
            actor_id: undefined,
          }),
        ),
        auditLog('camel-contract', {
          eventName: ThinkTankEventName.WorkflowStarted,
          eventVersion: THINKTANK_EVENT_VERSION,
          tenantId,
          actorId,
          subjectType: ThinkTankSubjectType.Workflow,
          subjectId: 'workflow-camel',
          outcome: 'success',
          occurredAt: '2026-05-21T10:00:00.000Z',
          correlationId: 'corr-camel',
          privacyClassification: ThinkTankPrivacyClassification.Operational,
          workflowType: 'problem-solving',
        }),
        auditLog(
          'camel-optional-contract',
          governanceEvent({
            outputId: 'output-camel-only',
          }),
        ),
        auditLog(
          'unknown-outcome',
          governanceEvent({
            outcome: 'acknowledged',
          }),
        ),
        auditLog(
          'message-output-id',
          governanceEvent({
            event_name: ThinkTankEventName.OutputExported,
            subject_type: ThinkTankSubjectType.Output,
            subject_id: 'output-safe-subject-2',
            output_id: 'message-full_profile-cache_key',
            ai_label_metadata_present: true,
          }),
        ),
      ],
    })

    const result = await service.getGovernanceReview({
      actor: { id: actorId, tenantId, role: UserRole.ADMIN },
      currentTenantId: tenantId,
      tenantId,
      dateFrom,
      dateTo,
    })

    expect(result.exportedOutputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outputId: 'redacted_output',
          complianceStatus: 'compliance_issue',
        }),
      ]),
    )
    expect(result.complianceIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outputId: 'redacted_output',
          message: 'AI label metadata missing for exported output evidence.',
        }),
      ]),
    )
    expect(result.instrumentationGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          auditLogId: 'unsafe-event-name-gap',
          eventName: 'unregistered_thinktank_event',
          reason: 'missing_required_field',
        }),
        expect.objectContaining({
          auditLogId: 'camel-contract',
          reason: 'event_contract_shape_mismatch',
          field: 'event_name',
        }),
        expect.objectContaining({
          auditLogId: 'camel-optional-contract',
          reason: 'event_contract_shape_mismatch',
          field: 'output_id',
        }),
        expect.objectContaining({
          auditLogId: 'unknown-outcome',
          reason: 'unknown_outcome',
        }),
      ]),
    )
    expect(JSON.stringify(result)).not.toMatch(
      /PRIVATE_|raw prompt|conversation|report content|full_profile|cache_key/i,
    )
  })

  it('[6.5-BE-010][P0][AC1] rejects non-admin or missing-role actors at the service boundary', async () => {
    const { service, auditLogSource } = await createService()

    await expect(
      service.getGovernanceReview({
        actor: { id: actorId, tenantId, role: UserRole.CONSULTANT },
        currentTenantId: tenantId,
        tenantId,
        dateFrom,
        dateTo,
      }),
    ).rejects.toThrow(/无权|governance|治理/i)
    await expect(
      service.getGovernanceReview({
        actor: { id: actorId, tenantId },
        currentTenantId: tenantId,
        tenantId,
        dateFrom,
        dateTo,
      }),
    ).rejects.toThrow(/无权|governance|治理/i)
    await expect(
      service.getGovernanceReview({
        currentTenantId: tenantId,
        tenantId,
        dateFrom,
        dateTo,
      }),
    ).rejects.toThrow(/无权|governance|治理/i)

    expect(auditLogSource.findThinkTankGovernanceEvents).not.toHaveBeenCalled()
  })

  it('[6.5-BE-011][P0][AC1,AC4] treats raw provider payload cache key and full profile keys as privacy unsafe gaps', async () => {
    const { service } = await createService({
      rows: [
        auditLog('raw-provider-payload', governanceEvent({ raw_provider_payload: 'secret' })),
        auditLog('cache-key', governanceEvent({ cacheKey: 'secret-cache-key' })),
        auditLog(
          'full-profile',
          governanceEvent({ full_profile: { email: 'operator@example.test' } }),
        ),
      ],
    })

    const result = await service.getGovernanceReview({
      actor: { id: actorId, tenantId, role: UserRole.ADMIN },
      currentTenantId: tenantId,
      tenantId,
      dateFrom,
      dateTo,
    })

    expect(result.summary.trustedEvents).toBe(0)
    expect(result.summary.malformedEvents).toBe(3)
    expect(result.instrumentationGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          auditLogId: 'raw-provider-payload',
          reason: 'privacy_unsafe_payload',
        }),
        expect.objectContaining({ auditLogId: 'cache-key', reason: 'privacy_unsafe_payload' }),
        expect.objectContaining({ auditLogId: 'full-profile', reason: 'privacy_unsafe_payload' }),
      ]),
    )
    expect(JSON.stringify(result)).not.toMatch(
      /provider payload|cache key|full profile|operator@example/i,
    )
  })
})
