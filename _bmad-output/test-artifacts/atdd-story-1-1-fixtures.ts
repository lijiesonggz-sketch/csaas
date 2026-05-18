/**
 * ATDD fixtures for Story 1.1: Register ThinkTank Module Entry.
 *
 * These fixtures describe the expected access policy and audit payloads before
 * implementation exists.
 */

export type AdvisoryRole = 'admin' | 'consultant' | 'client_pm' | 'respondent' | undefined

export const allowedThinkTankRoles: Exclude<AdvisoryRole, undefined>[] = [
  'admin',
  'consultant',
  'client_pm',
]

export const deniedThinkTankRoles: AdvisoryRole[] = ['respondent', undefined]

export const mockTenant = {
  id: '660e8400-e29b-41d4-a716-446655440000',
  name: 'CSAAS Test Tenant',
}

export const createAdvisoryUser = (role: AdvisoryRole) => ({
  id: '770e8400-e29b-41d4-a716-446655440000',
  email: role ? `${role}@example.com` : 'missing-role@example.com',
  name: role ? `${role} user` : 'missing role user',
  role,
})

export const expectedOpenedAudit = {
  action: 'READ',
  entityType: 'ThinkTankAccess',
  entityId: 'thinktank',
  details: {
    eventName: 'thinktank.access.opened',
    outcome: 'success',
    module: 'thinktank',
  },
}

export const expectedDeniedAudit = {
  action: 'ACCESS_DENIED',
  entityType: 'ThinkTankAccess',
  entityId: 'thinktank',
  details: {
    eventName: 'thinktank.access.denied',
    outcome: 'denied',
    module: 'thinktank',
    reason: 'role_not_allowed',
  },
}

export const expectedAccessResponse = {
  data: {
    allowed: true,
    module: 'thinktank',
  },
}

export const advisoryDeniedMessage = '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。'

export const advisoryAuthorizedMessage =
  'ThinkTank 模块已启用入口，完整咨询工作台将在后续版本开放。'

export const forbiddenWorkspaceLabels = [
  '新建咨询会话',
  '会话列表',
  '对话工作区',
  '文档抽屉',
  '运行工作流',
]
