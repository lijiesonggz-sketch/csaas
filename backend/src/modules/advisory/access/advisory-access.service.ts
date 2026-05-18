import { Injectable } from '@nestjs/common'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { UserRole } from '../../../database/entities/user.entity'
import {
  AdvisoryAdminService,
  THINKTANK_MODULE_DISABLED_MESSAGE,
  THINKTANK_MODULE_KEY,
} from '../admin/advisory-admin.service'
import {
  ThinkTankEventName,
  ThinkTankEventOutcome,
  ThinkTankPrivacyClassification,
  ThinkTankSubjectType,
} from '../events/thinktank-event-contract'
import { AdvisoryEventService } from '../events/advisory-event.service'
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
  correlationId?: string | null
}

export interface AdvisoryAccessEvaluation {
  allowed: boolean
  reason?: 'module_disabled' | 'role_not_allowed' | 'missing_role'
  message?: string
}

@Injectable()
export class AdvisoryAccessService {
  constructor(
    private readonly advisoryEventService: AdvisoryEventService,
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
    const tenantId = this.resolveTenantId(context)

    await this.advisoryEventService.emitAudit({
      eventName: ThinkTankEventName.AccessOpened,
      tenantId,
      actorId: context.user.id,
      subjectType: ThinkTankSubjectType.Module,
      subjectId: THINKTANK_MODULE_KEY,
      outcome: ThinkTankEventOutcome.Success,
      privacyClassification: ThinkTankPrivacyClassification.Operational,
      correlationId: context.correlationId,
      audit: {
        action: AuditAction.READ,
        entityType: THINKTANK_ACCESS_ENTITY_TYPE,
        entityId: null,
        organizationId: context.user.organizationId ?? null,
      },
      metadata: {
        module: THINKTANK_MODULE_KEY,
      },
    })
  }

  async recordAccessDenied(context: AdvisoryAccessAuditContext): Promise<void> {
    const tenantId = this.resolveTenantId(context)

    await this.advisoryEventService.emitAudit({
      eventName: ThinkTankEventName.AccessDenied,
      tenantId,
      actorId: context.user.id,
      subjectType: ThinkTankSubjectType.Module,
      subjectId: THINKTANK_MODULE_KEY,
      outcome: ThinkTankEventOutcome.Denied,
      privacyClassification: ThinkTankPrivacyClassification.Operational,
      correlationId: context.correlationId,
      audit: {
        action: AuditAction.ACCESS_DENIED,
        entityType: THINKTANK_ACCESS_ENTITY_TYPE,
        entityId: null,
        organizationId: context.user.organizationId ?? null,
      },
      metadata: {
        module: THINKTANK_MODULE_KEY,
        reason: context.reason ?? this.getDeniedReason(context.user),
      },
    })
  }

  private resolveTenantId(context: AdvisoryAccessAuditContext): string {
    const tenantId = context.tenantId ?? context.user.tenantId

    if (!tenantId) {
      throw new Error('ThinkTank access audit event requires tenant scope')
    }

    return tenantId
  }
}
