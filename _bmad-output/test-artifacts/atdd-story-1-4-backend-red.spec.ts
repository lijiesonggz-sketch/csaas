import {
  expectedStory14AuditEvents,
  expectedStory14TelemetryEvents,
  story14ActorId,
  story14CorrelationId,
  story14RawSensitivePayload,
  story14SubjectId,
  story14TenantId,
} from './atdd-story-1-4-fixtures'

describe('Story 1.4 Audit and Telemetry Event Foundation ATDD (RED)', () => {
  test.skip('[P0][1.4-CONTRACT-001] normalizes every required ThinkTank event contract field', async () => {
    // RED: module does not exist before Story 1.4 implementation.
    const {
      THINKTANK_EVENT_VERSION,
      ThinkTankEventName,
      ThinkTankEventOutcome,
      ThinkTankPrivacyClassification,
      normalizeThinkTankEvent,
    } = await import('../../backend/src/modules/advisory/events/thinktank-event-contract')

    const event = normalizeThinkTankEvent({
      eventName: ThinkTankEventName.AccessOpened,
      tenantId: story14TenantId,
      actorId: story14ActorId,
      subjectType: 'module',
      subjectId: story14SubjectId,
      outcome: ThinkTankEventOutcome.Success,
      privacyClassification: ThinkTankPrivacyClassification.Operational,
      correlationId: story14CorrelationId,
      optional: {
        workflowType: 'brainstorming',
        provider: 'glm-5.1',
        latencyMs: 123,
        estimatedTokens: 456,
        estimatedCost: 0.78,
        cacheStatus: 'miss',
      },
    })

    expect(event).toMatchObject({
      event_name: 'thinktank.access.opened',
      event_version: THINKTANK_EVENT_VERSION,
      tenant_id: story14TenantId,
      actor_id: story14ActorId,
      subject_type: 'module',
      subject_id: story14SubjectId,
      outcome: 'success',
      occurred_at: expect.any(String),
      correlation_id: story14CorrelationId,
      privacy_classification: 'operational',
      workflow_type: 'brainstorming',
      provider: 'glm-5.1',
      latency_ms: 123,
      estimated_tokens: 456,
      estimated_cost: 0.78,
      cache_status: 'miss',
    })
  })

  test.skip('[P0][1.4-REGISTRY-001] exposes the exact initial audit and telemetry registry', async () => {
    // RED: registry module does not exist before Story 1.4 implementation.
    const {
      THINKTANK_AUDIT_EVENT_NAMES,
      THINKTANK_TELEMETRY_EVENT_NAMES,
      assertThinkTankEventRegistered,
    } = await import('../../backend/src/modules/advisory/events/thinktank-event-registry')

    expect(THINKTANK_AUDIT_EVENT_NAMES).toEqual(expectedStory14AuditEvents)
    expect(THINKTANK_TELEMETRY_EVENT_NAMES).toEqual(expectedStory14TelemetryEvents)

    expect(() =>
      assertThinkTankEventRegistered('thinktank.access.opened', 'audit'),
    ).not.toThrow()
    expect(() =>
      assertThinkTankEventRegistered('thinktank.provider.call_completed', 'telemetry'),
    ).not.toThrow()
    expect(() => assertThinkTankEventRegistered('thinktank.access.opened', 'telemetry')).toThrow(
      /event kind/i,
    )
    expect(() => assertThinkTankEventRegistered('thinktank.unknown', 'audit')).toThrow(
      /unknown/i,
    )
  })

  test.skip('[P0][1.4-PRIVACY-001] rejects raw sensitive content keys by default', async () => {
    // RED: validation helper does not exist before Story 1.4 implementation.
    const { ThinkTankEventName, ThinkTankEventOutcome, normalizeThinkTankEvent } = await import(
      '../../backend/src/modules/advisory/events/thinktank-event-contract'
    )

    expect(() =>
      normalizeThinkTankEvent({
        eventName: ThinkTankEventName.AccessDenied,
        tenantId: story14TenantId,
        actorId: story14ActorId,
        subjectType: 'module',
        subjectId: story14SubjectId,
        outcome: ThinkTankEventOutcome.Denied,
        privacyClassification: 'operational',
        correlationId: story14CorrelationId,
        metadata: story14RawSensitivePayload,
      }),
    ).toThrow(/raw sensitive/i)
  })

  test.skip('[P0][1.4-EMIT-001] persists access events through AuditLogService with canonical snake_case details', async () => {
    // RED: AdvisoryEventService does not exist before Story 1.4 implementation.
    const { AuditAction } = await import('../../backend/src/database/entities/audit-log.entity')
    const { AdvisoryEventService } = await import(
      '../../backend/src/modules/advisory/events/advisory-event.service'
    )
    const auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
      logStrict: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    }
    const service = new AdvisoryEventService(auditLogService)

    await service.emitAudit({
      eventName: 'thinktank.access.opened',
      tenantId: story14TenantId,
      actorId: story14ActorId,
      subjectType: 'module',
      subjectId: story14SubjectId,
      outcome: 'success',
      privacyClassification: 'operational',
      correlationId: story14CorrelationId,
      audit: {
        action: AuditAction.READ,
        entityType: 'ThinkTankAccess',
        entityId: null,
        organizationId: story14TenantId,
      },
      metadata: { module: 'thinktank' },
    })

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: story14ActorId,
        tenantId: story14TenantId,
        action: AuditAction.READ,
        entityType: 'ThinkTankAccess',
        entityId: null,
        details: expect.objectContaining({
          event_name: 'thinktank.access.opened',
          event_version: expect.any(Number),
          tenant_id: story14TenantId,
          actor_id: story14ActorId,
          subject_type: 'module',
          subject_id: story14SubjectId,
          outcome: 'success',
          occurred_at: expect.any(String),
          correlation_id: story14CorrelationId,
          privacy_classification: 'operational',
          module: 'thinktank',
        }),
      }),
    )
  })

  test.skip('[P0][1.4-CURRENT-001] current access/admin emitters include contract fields and no raw content', async () => {
    // RED: current services still call AuditLogService directly and use legacy details.eventName.
    const { UserRole } = await import('../../backend/src/database/entities/user.entity')
    const { AuditAction } = await import('../../backend/src/database/entities/audit-log.entity')
    const { AdvisoryAccessService } = await import(
      '../../backend/src/modules/advisory/access/advisory-access.service'
    )
    const { AdvisoryAdminService } = await import(
      '../../backend/src/modules/advisory/admin/advisory-admin.service'
    )

    const eventService = {
      emitAudit: jest.fn().mockResolvedValue(undefined),
      emitAuditStrict: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    }
    const adminRepository = {
      findByModuleKey: jest.fn().mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440014',
        tenantId: story14TenantId,
        moduleKey: 'thinktank',
        enabled: false,
        allowedRoles: [],
        dataRetentionDays: 365,
        privacyConfirmedAt: null,
        privacyConfirmedBy: null,
        createdBy: null,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      updateForTenant: jest.fn().mockImplementation(async (_tenantId, id, input) => ({
        id,
        tenantId: story14TenantId,
        moduleKey: 'thinktank',
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    }
    const auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
      logStrict: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      findRecentByEventNames: jest.fn().mockResolvedValue([]),
    }

    const adminService = new AdvisoryAdminService(adminRepository as never, auditLogService as never)
    const accessService = new AdvisoryAccessService(auditLogService as never, adminService)

    await accessService.recordAccessOpened({
      user: { id: story14ActorId, role: UserRole.ADMIN, organizationId: story14TenantId },
      tenantId: story14TenantId,
    })

    await adminService.updateModuleConfig(
      story14TenantId,
      { id: story14ActorId, role: UserRole.ADMIN, organizationId: story14TenantId },
      {
        enabled: true,
        allowedRoles: [UserRole.ADMIN],
        dataRetentionDays: 365,
        privacyConfirmed: true,
      },
    )

    const accessDetails = auditLogService.log.mock.calls[0][0].details
    expect(accessDetails).toEqual(
      expect.objectContaining({
        event_name: 'thinktank.access.opened',
        event_version: expect.any(Number),
        tenant_id: story14TenantId,
        actor_id: story14ActorId,
        subject_type: 'module',
        subject_id: story14SubjectId,
        outcome: 'success',
        correlation_id: expect.any(String),
        privacy_classification: 'operational',
      }),
    )

    const adminDetails = auditLogService.logStrict.mock.calls[0][0].details
    expect(adminDetails).toEqual(
      expect.objectContaining({
        event_name: 'thinktank.module.enabled',
        event_version: expect.any(Number),
        tenant_id: story14TenantId,
        actor_id: story14ActorId,
        subject_type: 'module_config',
        outcome: 'success',
        correlation_id: expect.any(String),
        privacy_classification: 'operational',
      }),
    )

    for (const details of [accessDetails, adminDetails]) {
      for (const rawKey of Object.keys(story14RawSensitivePayload)) {
        expect(details).not.toHaveProperty(rawKey)
      }
    }
    expect(auditLogService.log.mock.calls[0][0].action).toBe(AuditAction.READ)
  })

  test.skip('[P1][1.4-RETENTION-001] enforces ThinkTank audit retention >= 180 days without weakening existing 365-day default', async () => {
    // RED: retention constants and lower-bound guard do not exist before Story 1.4 implementation.
    const {
      THINKTANK_AUDIT_RETENTION_DAYS,
      normalizeThinkTankAuditRetentionDays,
    } = await import('../../backend/src/modules/advisory/events/thinktank-audit-retention')

    expect(THINKTANK_AUDIT_RETENTION_DAYS).toBeGreaterThanOrEqual(180)
    expect(THINKTANK_AUDIT_RETENTION_DAYS).toBeGreaterThanOrEqual(365)
    expect(() => normalizeThinkTankAuditRetentionDays(90)).toThrow(/180/)
    expect(normalizeThinkTankAuditRetentionDays(180)).toBe(180)
    expect(normalizeThinkTankAuditRetentionDays(undefined)).toBe(THINKTANK_AUDIT_RETENTION_DAYS)
  })
})
