import { Injectable } from '@nestjs/common'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AuditLogService } from '../../audit/audit-log.service'

export const THINKTANK_MODULE_KEY = 'thinktank'
export const THINKTANK_ACCESS_ENTITY_TYPE = 'ThinkTankAccess'

const THINKTANK_ALLOWED_ROLES = new Set<string>([
  UserRole.ADMIN,
  UserRole.CONSULTANT,
  UserRole.CLIENT_PM,
])

export interface AdvisoryAccessUser {
  id: string
  role?: UserRole | string | null
  tenantId?: string | null
  organizationId?: string | null
}

interface AdvisoryAccessAuditContext {
  user: AdvisoryAccessUser
  tenantId?: string | null
  reason?: string
}

@Injectable()
export class AdvisoryAccessService {
  constructor(private readonly auditLogService: AuditLogService) {}

  canAccessThinkTank(user: Partial<AdvisoryAccessUser> | null | undefined): boolean {
    return typeof user?.role === 'string' && THINKTANK_ALLOWED_ROLES.has(user.role)
  }

  getDeniedReason(user: Partial<AdvisoryAccessUser> | null | undefined): string {
    return user?.role ? 'role_not_allowed' : 'missing_role'
  }

  async recordAccessOpened(context: AdvisoryAccessAuditContext): Promise<void> {
    await this.auditLogService.log({
      userId: context.user.id,
      organizationId: context.user.organizationId ?? null,
      tenantId: context.tenantId ?? context.user.tenantId ?? null,
      action: AuditAction.READ,
      entityType: THINKTANK_ACCESS_ENTITY_TYPE,
      entityId: null,
      changes: null,
      details: {
        eventName: 'thinktank.access.opened',
        outcome: 'success',
        module: THINKTANK_MODULE_KEY,
        occurredAt: new Date().toISOString(),
      },
    })
  }

  async recordAccessDenied(context: AdvisoryAccessAuditContext): Promise<void> {
    await this.auditLogService.log({
      userId: context.user.id,
      organizationId: context.user.organizationId ?? null,
      tenantId: context.tenantId ?? context.user.tenantId ?? null,
      action: AuditAction.ACCESS_DENIED,
      entityType: THINKTANK_ACCESS_ENTITY_TYPE,
      entityId: null,
      changes: null,
      details: {
        eventName: 'thinktank.access.denied',
        outcome: 'denied',
        module: THINKTANK_MODULE_KEY,
        reason: context.reason ?? this.getDeniedReason(context.user),
        occurredAt: new Date().toISOString(),
      },
    })
  }
}
