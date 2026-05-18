import { Injectable } from '@nestjs/common'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AuditLogService } from '../../audit/audit-log.service'
import {
  AdvisoryAdminService,
  THINKTANK_MODULE_DISABLED_MESSAGE,
  THINKTANK_MODULE_KEY,
} from '../admin/advisory-admin.service'
export { THINKTANK_MODULE_KEY } from '../admin/advisory-admin.service'

export const THINKTANK_ACCESS_ENTITY_TYPE = 'ThinkTankAccess'
export const THINKTANK_ACCESS_DENIED_MESSAGE = '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。'

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

export interface AdvisoryAccessEvaluation {
  allowed: boolean
  reason?: 'module_disabled' | 'role_not_allowed' | 'missing_role'
  message?: string
}

@Injectable()
export class AdvisoryAccessService {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly advisoryAdminService: AdvisoryAdminService,
  ) {}

  async evaluateAccess(
    user: Partial<AdvisoryAccessUser> | null | undefined,
    tenantId: string,
  ): Promise<AdvisoryAccessEvaluation> {
    const config = await this.advisoryAdminService.getEffectiveModuleConfig(tenantId)

    if (!config.enabled) {
      return {
        allowed: false,
        reason: 'module_disabled',
        message: THINKTANK_MODULE_DISABLED_MESSAGE,
      }
    }

    const role = typeof user?.role === 'string' ? user.role : null
    if (!role) {
      return {
        allowed: false,
        reason: 'missing_role',
        message: THINKTANK_ACCESS_DENIED_MESSAGE,
      }
    }

    if (!config.allowedRoles.includes(role as UserRole)) {
      return {
        allowed: false,
        reason: 'role_not_allowed',
        message: THINKTANK_ACCESS_DENIED_MESSAGE,
      }
    }

    return { allowed: true }
  }

  canAccessThinkTank(
    user: Partial<AdvisoryAccessUser> | null | undefined,
    allowedRoles: UserRole[] = [],
  ): boolean {
    return typeof user?.role === 'string' && allowedRoles.includes(user.role as UserRole)
  }

  getDeniedReason(user: Partial<AdvisoryAccessUser> | null | undefined): string {
    return user?.role ? 'role_not_allowed' : 'missing_role'
  }

  async assertThinkTankModuleAvailable(user: AdvisoryAccessUser, tenantId: string): Promise<void> {
    await this.advisoryAdminService.assertThinkTankModuleAvailable(user, tenantId)
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
