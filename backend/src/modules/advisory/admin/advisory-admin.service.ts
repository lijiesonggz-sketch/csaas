import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import { AuditAction, AuditLog } from '../../../database/entities/audit-log.entity'
import { AdvisoryModuleConfig } from '../../../database/entities/advisory-module-config.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AuditLogService } from '../../audit/audit-log.service'
import { AdvisoryEventService } from '../events/advisory-event.service'
import {
  ThinkTankEventName,
  ThinkTankEventOutcome,
  ThinkTankPrivacyClassification,
  ThinkTankSubjectType,
} from '../events/thinktank-event-contract'
import { AdvisoryModuleConfigRepository } from './advisory-module-config.repository'
import { UpdateAdvisoryModuleConfigDto } from './dto/update-advisory-module-config.dto'

export const THINKTANK_MODULE_KEY = 'thinktank'
export const THINKTANK_MODULE_CONFIG_ENTITY_TYPE = 'ThinkTankModuleConfig'
export const THINKTANK_MODULE_DISABLED_MESSAGE = 'ThinkTank 当前未在本租户启用，请联系管理员开通。'

const DEFAULT_RETENTION_DAYS = 90
const CONFIG_AUDIT_EVENT_NAMES = [
  ThinkTankEventName.ModuleEnabled,
  ThinkTankEventName.ModuleDisabled,
  ThinkTankEventName.RoleAccessUpdated,
] as const
const VALID_ROLE_ORDER = [
  UserRole.ADMIN,
  UserRole.CONSULTANT,
  UserRole.CLIENT_PM,
  UserRole.RESPONDENT,
] as const

export interface AdvisoryModuleConfigActor {
  id: string
  role?: UserRole | string | null
  tenantId?: string | null
  organizationId?: string | null
}

export interface AdvisoryModuleAuditSummary {
  eventName: string
  actorUserId: string | null
  changedSetting: string | null
  oldValue: unknown
  newValue: unknown
  occurredAt: string
}

export interface AdvisoryModuleConfigResponse {
  id: string
  tenantId: string
  moduleKey: string
  enabled: boolean
  allowedRoles: UserRole[]
  dataRetentionDays: number
  privacyConfirmedAt: string | null
  privacyConfirmedBy: string | null
  latestAuditSummary: AdvisoryModuleAuditSummary[]
}

export interface AdvisoryEffectiveModuleConfig {
  enabled: boolean
  allowedRoles: UserRole[]
}

@Injectable()
export class AdvisoryAdminService {
  constructor(
    private readonly configRepository: AdvisoryModuleConfigRepository,
    private readonly auditLogService: AuditLogService,
    private readonly advisoryEventService: AdvisoryEventService,
  ) {}

  async getModuleConfig(tenantId: string): Promise<AdvisoryModuleConfigResponse> {
    const config = await this.getOrCreateConfig(tenantId)
    return this.toResponse(config)
  }

  async getEffectiveModuleConfig(tenantId: string): Promise<AdvisoryEffectiveModuleConfig> {
    const config = await this.configRepository.findByModuleKey(tenantId, THINKTANK_MODULE_KEY)

    if (!config) {
      return {
        enabled: false,
        allowedRoles: [],
      }
    }

    return {
      enabled: config.enabled,
      allowedRoles: this.normalizeAllowedRoles(config.allowedRoles),
    }
  }

  async updateModuleConfig(
    tenantId: string,
    actor: AdvisoryModuleConfigActor,
    dto: UpdateAdvisoryModuleConfigDto,
  ): Promise<AdvisoryModuleConfigResponse> {
    const config = await this.getOrCreateConfig(tenantId)
    const previousEnabled = config.enabled
    const previousAllowedRoles = this.normalizeAllowedRoles(config.allowedRoles)
    const nextAllowedRoles = this.normalizeAllowedRoles(dto.allowedRoles)
    const privacyConfirmedAt = dto.privacyConfirmed
      ? (config.privacyConfirmedAt ?? new Date())
      : config.privacyConfirmedAt
    const privacyConfirmedBy = dto.privacyConfirmed
      ? (config.privacyConfirmedBy ?? actor.id)
      : config.privacyConfirmedBy

    const saved = await this.configRepository.updateForTenant(tenantId, config.id, {
      moduleKey: THINKTANK_MODULE_KEY,
      enabled: dto.enabled,
      allowedRoles: nextAllowedRoles,
      dataRetentionDays: dto.dataRetentionDays ?? DEFAULT_RETENTION_DAYS,
      privacyConfirmedAt,
      privacyConfirmedBy,
      createdBy: config.createdBy ?? actor.id,
      updatedBy: actor.id,
    })

    if (!saved) {
      throw new ForbiddenException('当前租户无权修改该 ThinkTank 模块配置。')
    }

    if (previousEnabled !== saved.enabled) {
      await this.logConfigChange(
        saved,
        actor,
        saved.enabled ? ThinkTankEventName.ModuleEnabled : ThinkTankEventName.ModuleDisabled,
        'enabled',
        previousEnabled,
        saved.enabled,
      )
    }

    if (!this.rolesEqual(previousAllowedRoles, saved.allowedRoles)) {
      await this.logConfigChange(
        saved,
        actor,
        ThinkTankEventName.RoleAccessUpdated,
        'allowedRoles',
        previousAllowedRoles,
        saved.allowedRoles,
      )
    }

    return this.toResponse(saved)
  }

  async assertThinkTankModuleAvailable(
    user: AdvisoryModuleConfigActor,
    tenantId: string,
  ): Promise<void> {
    const config = await this.getEffectiveModuleConfig(tenantId)

    if (!config.enabled) {
      throw new ForbiddenException(THINKTANK_MODULE_DISABLED_MESSAGE)
    }

    const role = typeof user.role === 'string' ? user.role : null
    if (!role || !config.allowedRoles.includes(role as UserRole)) {
      throw new ForbiddenException('当前账号暂无 ThinkTank 访问权限，请联系管理员开通。')
    }
  }

  private async getOrCreateConfig(tenantId: string): Promise<AdvisoryModuleConfig> {
    const existing = await this.configRepository.findByModuleKey(tenantId, THINKTANK_MODULE_KEY)

    if (existing) return existing

    try {
      return await this.configRepository.createForTenant(tenantId, {
        moduleKey: THINKTANK_MODULE_KEY,
        enabled: false,
        allowedRoles: [],
        dataRetentionDays: DEFAULT_RETENTION_DAYS,
        privacyConfirmedAt: null,
        privacyConfirmedBy: null,
        createdBy: null,
        updatedBy: null,
      })
    } catch (error) {
      if (!this.isUniqueConstraintViolation(error)) {
        throw error
      }

      const racedConfig = await this.configRepository.findByModuleKey(
        tenantId,
        THINKTANK_MODULE_KEY,
      )
      if (racedConfig) return racedConfig

      throw error
    }
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
  }

  private normalizeAllowedRoles(roles: unknown): UserRole[] {
    if (!Array.isArray(roles)) {
      throw new BadRequestException('allowedRoles must be an array of CSAAS roles')
    }

    const invalidRoles = roles.filter((role) => !VALID_ROLE_ORDER.includes(role as UserRole))
    if (invalidRoles.length) {
      throw new BadRequestException(`allowedRoles contains unsupported role: ${invalidRoles[0]}`)
    }

    return VALID_ROLE_ORDER.filter((role) => roles.includes(role))
  }

  private rolesEqual(left: UserRole[], right: UserRole[]): boolean {
    if (left.length !== right.length) return false
    return left.every((role, index) => role === right[index])
  }

  private async logConfigChange(
    config: AdvisoryModuleConfig,
    actor: AdvisoryModuleConfigActor,
    eventName: (typeof CONFIG_AUDIT_EVENT_NAMES)[number],
    changedSetting: 'enabled' | 'allowedRoles',
    oldValue: unknown,
    newValue: unknown,
  ): Promise<void> {
    await this.advisoryEventService.emitAuditStrict({
      eventName,
      tenantId: config.tenantId,
      actorId: actor.id,
      subjectType: ThinkTankSubjectType.ModuleConfig,
      subjectId: config.id,
      outcome: ThinkTankEventOutcome.Success,
      privacyClassification: ThinkTankPrivacyClassification.Operational,
      audit: {
        action: AuditAction.UPDATE,
        entityType: THINKTANK_MODULE_CONFIG_ENTITY_TYPE,
        entityId: config.id,
        organizationId: actor.organizationId ?? null,
      },
      changes: {
        [changedSetting]: {
          oldValue,
          newValue,
        },
      },
      metadata: {
        module: THINKTANK_MODULE_KEY,
        changedSetting,
        oldValue,
        newValue,
      },
    })
  }

  private async toResponse(config: AdvisoryModuleConfig): Promise<AdvisoryModuleConfigResponse> {
    const latestAuditSummary = await this.findLatestAuditSummary(config.tenantId)

    return {
      id: config.id,
      tenantId: config.tenantId,
      moduleKey: config.moduleKey,
      enabled: config.enabled,
      allowedRoles: this.normalizeAllowedRoles(config.allowedRoles),
      dataRetentionDays: config.dataRetentionDays,
      privacyConfirmedAt: config.privacyConfirmedAt?.toISOString() ?? null,
      privacyConfirmedBy: config.privacyConfirmedBy,
      latestAuditSummary,
    }
  }

  private async findLatestAuditSummary(tenantId: string): Promise<AdvisoryModuleAuditSummary[]> {
    const logs = await this.auditLogService.findRecentByEventNames(
      tenantId,
      [...CONFIG_AUDIT_EVENT_NAMES],
      5,
    )

    return logs.map((log) => this.toAuditSummary(log))
  }

  private toAuditSummary(log: AuditLog): AdvisoryModuleAuditSummary {
    const details = log.details ?? {}
    return {
      eventName: this.readString(details.event_name) ?? this.readString(details.eventName) ?? '',
      actorUserId: log.userId ?? null,
      changedSetting:
        this.readString(details.changed_setting) ?? this.readString(details.changedSetting),
      oldValue: details.old_value ?? details.oldValue ?? null,
      newValue: details.new_value ?? details.newValue ?? null,
      occurredAt:
        this.readString(details.occurred_at) ??
        this.readString(details.occurredAt) ??
        log.createdAt?.toISOString() ??
        new Date().toISOString(),
    }
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }
}
