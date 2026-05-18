export const thinkTankModuleKey = 'thinktank' as const

export const tenantFixtures = {
  primaryTenantId: '660e8400-e29b-41d4-a716-446655440000',
  secondaryTenantId: '660e8400-e29b-41d4-a716-446655440999',
  adminUserId: '770e8400-e29b-41d4-a716-446655440000',
  consultantUserId: '770e8400-e29b-41d4-a716-446655440111',
  respondentUserId: '770e8400-e29b-41d4-a716-446655440222',
} as const

export const csaasRoles = ['admin', 'consultant', 'client_pm', 'respondent'] as const
export type CsaasRole = (typeof csaasRoles)[number]

export const roleLabels: Record<CsaasRole, string> = {
  admin: '管理员',
  consultant: '主咨询师',
  client_pm: '企业PM',
  respondent: '被调研者',
}

export const advisoryModuleMessages = {
  disabled: 'ThinkTank 当前未在本租户启用，请联系管理员开通。',
  roleDenied: '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。',
  privacyConfirmation: '确认 ThinkTank 对话历史不会用于模型训练。',
  auditDelayed: '审计摘要可能存在短暂延迟。',
} as const

export interface AdvisoryModuleConfigFixture {
  id: string
  tenantId: string
  moduleKey: typeof thinkTankModuleKey
  enabled: boolean
  allowedRoles: CsaasRole[]
  dataRetentionDays: number
  privacyConfirmedAt: string | null
  privacyConfirmedBy: string | null
  latestAuditSummary: Array<{
    eventName: string
    actorUserId: string
    changedSetting: string
    oldValue: unknown
    newValue: unknown
    occurredAt: string
  }>
}

export function createAdvisoryModuleConfig(
  overrides: Partial<AdvisoryModuleConfigFixture> = {},
): AdvisoryModuleConfigFixture {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    tenantId: tenantFixtures.primaryTenantId,
    moduleKey: thinkTankModuleKey,
    enabled: false,
    allowedRoles: [],
    dataRetentionDays: 90,
    privacyConfirmedAt: null,
    privacyConfirmedBy: null,
    latestAuditSummary: [],
    ...overrides,
  }
}

export function createUser(role: CsaasRole, overrides: Record<string, unknown> = {}) {
  return {
    id:
      role === 'admin'
        ? tenantFixtures.adminUserId
        : role === 'respondent'
          ? tenantFixtures.respondentUserId
          : tenantFixtures.consultantUserId,
    role,
    tenantId: tenantFixtures.primaryTenantId,
    organizationId: tenantFixtures.primaryTenantId,
    ...overrides,
  }
}

export const expectedAuditEvents = {
  moduleEnabled: 'thinktank.module.enabled',
  moduleDisabled: 'thinktank.module.disabled',
  roleAccessUpdated: 'thinktank.role_access.updated',
  accessOpened: 'thinktank.access.opened',
  accessDenied: 'thinktank.access.denied',
} as const

export const expectedAdminConfigResponse = {
  data: createAdvisoryModuleConfig({
    enabled: true,
    allowedRoles: ['admin', 'consultant', 'client_pm'],
    privacyConfirmedAt: '2026-05-19T02:56:00.000+08:00',
    privacyConfirmedBy: tenantFixtures.adminUserId,
    latestAuditSummary: [
      {
        eventName: expectedAuditEvents.moduleEnabled,
        actorUserId: tenantFixtures.adminUserId,
        changedSetting: 'enabled',
        oldValue: false,
        newValue: true,
        occurredAt: '2026-05-19T02:56:00.000+08:00',
      },
    ],
  }),
}

export const forbiddenRuntimeTables = [
  'workflow_sessions',
  'conversation_messages',
  'workflow_outputs',
  'workflow_checkpoints',
  'output_ratings',
  'organization_context',
] as const

export const adminBackendEndpoint = '/api/advisory/admin/module-config'
export const accessBackendEndpoint = '/api/advisory/access'
export const frontendAdminRoute = '/admin/advisory'
export const frontendAdvisoryRoute = '/advisory'
