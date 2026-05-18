import { Injectable } from '@nestjs/common'
import { AuditAction, AuditLog } from '../../../database/entities/audit-log.entity'
import { AuditLogService } from '../../audit/audit-log.service'
import {
  ThinkTankEventInput,
  ThinkTankEventName,
  ThinkTankEventOutcome,
  ThinkTankPrivacyClassification,
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

@Injectable()
export class AdvisoryEventService {
  constructor(private readonly auditLogService: AuditLogService) {}

  async emitAudit(input: AdvisoryAuditEventInput): Promise<void> {
    await this.auditLogService.log(this.toAuditLogInput(input))
  }

  async emitAuditStrict(input: AdvisoryAuditEventInput): Promise<AuditLog> {
    return this.auditLogService.logStrict(this.toAuditLogInput(input))
  }

  private toAuditLogInput(input: AdvisoryAuditEventInput): Partial<AuditLog> {
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
