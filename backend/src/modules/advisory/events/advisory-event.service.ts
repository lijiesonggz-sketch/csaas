import { Injectable, Logger } from '@nestjs/common'
import { AuditAction, AuditLog } from '../../../database/entities/audit-log.entity'
import { AuditLogService } from '../../audit/audit-log.service'
import {
  ThinkTankEventInput,
  ThinkTankEventName,
  ThinkTankEventOutcome,
  ThinkTankPrivacyClassification,
  assertNoRawSensitiveThinkTankKeys,
  normalizeThinkTankEvent,
} from './thinktank-event-contract'

interface AdvisoryEventAuditTarget {
  action: AuditAction
  entityType: string
  entityId?: string | null
  organizationId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export interface AdvisoryAuditEventInput extends Omit<
  ThinkTankEventInput,
  'eventKind' | 'eventName' | 'outcome' | 'privacyClassification'
> {
  eventName: ThinkTankEventName | string
  outcome: ThinkTankEventOutcome | string
  privacyClassification: ThinkTankPrivacyClassification | string
  audit: AdvisoryEventAuditTarget
  changes?: Record<string, unknown> | null
}

export interface AdvisoryTelemetryEventInput extends Omit<
  ThinkTankEventInput,
  'eventKind' | 'eventName' | 'outcome' | 'privacyClassification'
> {
  eventName: ThinkTankEventName | string
  outcome: ThinkTankEventOutcome | string
  privacyClassification: ThinkTankPrivacyClassification | string
  telemetry?: {
    entityType?: string
    organizationId?: string | null
    ipAddress?: string | null
    userAgent?: string | null
  }
}

@Injectable()
export class AdvisoryEventService {
  private readonly logger = new Logger(AdvisoryEventService.name)

  constructor(private readonly auditLogService: AuditLogService) {}

  async emitAudit(input: AdvisoryAuditEventInput): Promise<void> {
    try {
      await this.auditLogService.log(this.toAuditLogInput(input))
    } catch (error) {
      this.logger.error('Failed to prepare ThinkTank audit event', error)
    }
  }

  async emitAuditStrict(input: AdvisoryAuditEventInput): Promise<AuditLog> {
    return this.auditLogService.logStrict(this.toAuditLogInput(input))
  }

  async emitTelemetry(input: AdvisoryTelemetryEventInput): Promise<void> {
    const details = normalizeThinkTankEvent({
      ...input,
      eventKind: 'telemetry',
    })

    await this.auditLogService.log({
      userId: details.actor_id,
      organizationId: input.telemetry?.organizationId ?? null,
      tenantId: details.tenant_id,
      action: AuditAction.READ,
      entityType: input.telemetry?.entityType ?? 'ThinkTankProviderTelemetry',
      entityId: null,
      changes: null,
      details,
      ipAddress: input.telemetry?.ipAddress ?? null,
      userAgent: input.telemetry?.userAgent ?? null,
    })
  }

  private toAuditLogInput(input: AdvisoryAuditEventInput): Partial<AuditLog> {
    assertNoRawSensitiveThinkTankKeys(input.changes ?? {})

    const details = normalizeThinkTankEvent({
      ...input,
      eventKind: 'audit',
    })

    return {
      userId: details.actor_id,
      organizationId: input.audit.organizationId ?? null,
      tenantId: details.tenant_id,
      action: input.audit.action,
      entityType: input.audit.entityType,
      entityId: input.audit.entityId ?? null,
      changes: input.changes ?? null,
      details,
      ipAddress: input.audit.ipAddress ?? null,
      userAgent: input.audit.userAgent ?? null,
    }
  }
}
