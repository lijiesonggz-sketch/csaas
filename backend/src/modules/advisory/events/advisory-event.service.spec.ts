import { AuditAction, AuditLog } from '../../../database/entities/audit-log.entity'
import { AuditLogService } from '../../audit/audit-log.service'
import { AdvisoryEventService } from './advisory-event.service'

const tenantId = '660e8400-e29b-41d4-a716-446655440014'
const actorId = '770e8400-e29b-41d4-a716-446655440014'
const correlationId = '880e8400-e29b-41d4-a716-446655440014'

describe('AdvisoryEventService', () => {
  let auditLogService: jest.Mocked<Pick<AuditLogService, 'log' | 'logStrict'>>
  let service: AdvisoryEventService

  beforeEach(() => {
    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
      logStrict: jest.fn().mockResolvedValue({ id: 'audit-1' } as AuditLog),
    }
    service = new AdvisoryEventService(auditLogService as unknown as AuditLogService)
  })

  it('persists fail-safe audit events with canonical snake_case contract details', async () => {
    await service.emitAudit({
      eventName: 'thinktank.access.opened',
      tenantId,
      actorId,
      subjectType: 'module',
      subjectId: 'thinktank',
      outcome: 'success',
      privacyClassification: 'operational',
      correlationId,
      audit: {
        action: AuditAction.READ,
        entityType: 'ThinkTankAccess',
        entityId: null,
        organizationId: tenantId,
      },
      metadata: { module: 'thinktank' },
    })

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: actorId,
        organizationId: tenantId,
        tenantId,
        action: AuditAction.READ,
        entityType: 'ThinkTankAccess',
        entityId: null,
        changes: null,
        details: expect.objectContaining({
          event_name: 'thinktank.access.opened',
          event_version: expect.any(Number),
          tenant_id: tenantId,
          actor_id: actorId,
          subject_type: 'module',
          subject_id: 'thinktank',
          outcome: 'success',
          occurred_at: expect.any(String),
          correlation_id: correlationId,
          privacy_classification: 'operational',
          module: 'thinktank',
        }),
      }),
    )
    expect(auditLogService.logStrict).not.toHaveBeenCalled()
  })

  it('persists strict audit events through logStrict and returns the saved audit row', async () => {
    const saved = await service.emitAuditStrict({
      eventName: 'thinktank.module.enabled',
      tenantId,
      actorId,
      subjectType: 'module_config',
      subjectId: '550e8400-e29b-41d4-a716-446655440014',
      outcome: 'success',
      privacyClassification: 'operational',
      correlationId,
      audit: {
        action: AuditAction.UPDATE,
        entityType: 'ThinkTankModuleConfig',
        entityId: '550e8400-e29b-41d4-a716-446655440014',
        organizationId: tenantId,
      },
      changes: {
        enabled: {
          oldValue: false,
          newValue: true,
        },
      },
      metadata: {
        module: 'thinktank',
        changedSetting: 'enabled',
        oldValue: false,
        newValue: true,
      },
    })

    expect(saved).toEqual({ id: 'audit-1' })
    expect(auditLogService.logStrict).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: actorId,
        tenantId,
        action: AuditAction.UPDATE,
        entityType: 'ThinkTankModuleConfig',
        entityId: '550e8400-e29b-41d4-a716-446655440014',
        details: expect.objectContaining({
          event_name: 'thinktank.module.enabled',
          changed_setting: 'enabled',
          old_value: false,
          new_value: true,
          correlation_id: correlationId,
        }),
      }),
    )
    expect(auditLogService.log).not.toHaveBeenCalled()
  })

  it('rejects telemetry names in audit persistence', async () => {
    await expect(
      service.emitAudit({
        eventName: 'thinktank.provider.call_completed',
        tenantId,
        actorId,
        subjectType: 'provider_call',
        subjectId: 'call-1',
        outcome: 'success',
        privacyClassification: 'operational',
        audit: {
          action: AuditAction.READ,
          entityType: 'ThinkTankProviderCall',
          entityId: null,
        },
      }),
    ).rejects.toThrow(/event kind/i)
  })

  it('persists provider telemetry through the shared event contract without raw content', async () => {
    await service.emitTelemetry({
      eventName: 'thinktank.provider.call_completed',
      tenantId,
      actorId,
      subjectType: 'provider_call',
      subjectId: '990e8400-e29b-41d4-a716-446655440014',
      outcome: 'success',
      privacyClassification: 'operational',
      correlationId,
      optional: {
        provider: 'fake',
        latencyMs: 12,
        estimatedTokens: 19,
        estimatedCost: 0,
      },
      metadata: {
        status: 'completed',
        model: 'fake-thinktank-smoke',
        inputTokens: 12,
        outputTokens: 7,
        totalTokens: 19,
      },
    })

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: actorId,
        tenantId,
        action: AuditAction.READ,
        entityType: 'ThinkTankProviderTelemetry',
        entityId: null,
        details: expect.objectContaining({
          event_name: 'thinktank.provider.call_completed',
          event_version: expect.any(Number),
          tenant_id: tenantId,
          actor_id: actorId,
          subject_type: 'provider_call',
          subject_id: '990e8400-e29b-41d4-a716-446655440014',
          outcome: 'success',
          correlation_id: correlationId,
          privacy_classification: 'operational',
          provider: 'fake',
          latency_ms: 12,
          estimated_tokens: 19,
          estimated_cost: 0,
          status: 'completed',
          model: 'fake-thinktank-smoke',
          input_tokens: 12,
          output_tokens: 7,
          total_tokens: 19,
        }),
      }),
    )
    const details = auditLogService.log.mock.calls[0][0].details
    expect(details).not.toHaveProperty('messages')
    expect(details).not.toHaveProperty('prompt')
    expect(details).not.toHaveProperty('content')
    expect(details).not.toHaveProperty('report')
    expect(details).not.toHaveProperty('document')
    expect(details).not.toHaveProperty('enterpriseContext')
  })
})
