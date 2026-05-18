import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditAction, AuditLog } from '../../../database/entities/audit-log.entity'
import { AdvisoryModuleConfig } from '../../../database/entities/advisory-module-config.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AuditLogService } from '../../audit/audit-log.service'
import { UpdateAdvisoryModuleConfigDto } from './dto/update-advisory-module-config.dto'

export const THINKTANK_MODULE_KEY = 'thinktank'
export const THINKTANK_MODULE_CONFIG_ENTITY_TYPE = 'ThinkTankModuleConfig'
export const THINKTANK_MODULE_DISABLED_MESSAGE = 'ThinkTank 当前未在本租户启用，请联系管理员开通。'

const DEFAULT_RETENTION_DAYS = 90
const CONFIG_AUDIT_EVENT_NAMES = [
  'thinktank.module.enabled',
  'thinktank.module.disabled',
  'thinktank.role_access.updated',
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
    @InjectRepository(AdvisoryModuleConfig)
    private readonly configRepository: Repository<AdvisoryModuleConfig>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getModuleConfig(tenantId: string): Promise<AdvisoryModuleConfigResponse> {
    const config = await this.getOrCreateConfig(tenantId)
    return this.toResponse(config)
  }

  async getEffectiveModuleConfig(tenantId: string): Promise<AdvisoryEffectiveModuleConfig> {
    const config = await this.configRepository.findOne({
      where: { tenantId, moduleKey: THINKTANK_MODULE_KEY },
    })

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

    config.tenantId = tenantId
    config.moduleKey = THINKTANK_MODULE_KEY
    config.enabled = dto.enabled
    config.allowedRoles = nextAllowedRoles
    config.dataRetentionDays = dto.dataRetentionDays ?? DEFAULT_RETENTION_DAYS
    config.updatedBy = actor.id

    if (!config.createdBy) {
      config.createdBy = actor.id
    }

    if (dto.privacyConfirmed) {
      config.privacyConfirmedAt = config.privacyConfirmedAt ?? new Date()
      config.privacyConfirmedBy = config.privacyConfirmedBy ?? actor.id
    }

    const saved = await this.configRepository.save(config)

    if (previousEnabled !== saved.enabled) {
      await this.logConfigChange(
        saved,
        actor,
        saved.enabled ? 'thinktank.module.enabled' : 'thinktank.module.disabled',
        'enabled',
        previousEnabled,
        saved.enabled,
      )
    }

    if (!this.rolesEqual(previousAllowedRoles, saved.allowedRoles)) {
      await this.logConfigChange(
        saved,
        actor,
        'thinktank.role_access.updated',
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
    const existing = await this.configRepository.findOne({
      where: { tenantId, moduleKey: THINKTANK_MODULE_KEY },
    })

    if (existing) return existing

    const config = this.configRepository.create({
      tenantId,
      moduleKey: THINKTANK_MODULE_KEY,
      enabled: false,
      allowedRoles: [],
      dataRetentionDays: DEFAULT_RETENTION_DAYS,
      privacyConfirmedAt: null,
      privacyConfirmedBy: null,
      createdBy: null,
      updatedBy: null,
    })

    return this.configRepository.save(config)
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
    await this.auditLogService.logStrict({
      userId: actor.id,
      organizationId: actor.organizationId ?? null,
      tenantId: config.tenantId,
      action: AuditAction.UPDATE,
      entityType: THINKTANK_MODULE_CONFIG_ENTITY_TYPE,
      entityId: config.id,
      changes: {
        [changedSetting]: {
          oldValue,
          newValue,
        },
      },
      details: {
        eventName,
        outcome: 'success',
        module: THINKTANK_MODULE_KEY,
        changedSetting,
        oldValue,
        newValue,
        occurredAt: new Date().toISOString(),
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
      eventName: this.readString(details.eventName) ?? '',
      actorUserId: log.userId ?? null,
      changedSetting: this.readString(details.changedSetting),
      oldValue: details.oldValue ?? null,
      newValue: details.newValue ?? null,
      occurredAt:
        this.readString(details.occurredAt) ??
        log.createdAt?.toISOString() ??
        new Date().toISOString(),
    }
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }
}
