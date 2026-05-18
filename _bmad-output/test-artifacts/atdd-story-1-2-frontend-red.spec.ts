/**
 * ATDD RED - Story 1.2: ThinkTank tenant admin configuration UI
 *
 * TDD RED PHASE: All tests use test.skip().
 * These tests intentionally describe the expected frontend behavior before the
 * admin screen, proxy routes, and config-aware access UI are implemented.
 *
 * Selector policy: project rules prohibit adding production-only data-testid.
 * Tests use accessible roles, labels, and visible text.
 */

import {
  advisoryModuleMessages,
  csaasRoles,
  expectedAdminConfigResponse,
  frontendAdminRoute,
  frontendAdvisoryRoute,
  roleLabels,
} from './atdd-story-1-2-fixtures'

interface RenderedUi {
  getByText: (text: string | RegExp) => unknown
  queryByText: (text: string | RegExp) => unknown
  getByRole: (role: string, options?: { name?: string | RegExp }) => {
    click?: () => Promise<void> | void
    getAttribute?: (name: string) => string | null
  }
  getByLabelText: (text: string | RegExp) => {
    click?: () => Promise<void> | void
    checked?: boolean
  }
}

interface FrontendAdminSubject {
  renderSidebar: (options: { role: string; backendAccessAllowed?: boolean }) => RenderedUi
  renderAdminPage: (options: {
    role: string
    config?: typeof expectedAdminConfigResponse.data
    loading?: boolean
  }) => RenderedUi
  renderAdvisoryPage: (options: {
    accessState: 'allowed' | 'denied' | 'disabled' | 'loading'
    message?: string
  }) => RenderedUi
  submitAdminConfig: (input: {
    enabled: boolean
    allowedRoles: string[]
    privacyConfirmed: boolean
  }) => Promise<void>
  navigationCalls: () => string[]
  apiCalls: () => Array<{ method: string; path: string; body?: Record<string, unknown> }>
}

describe('Story 1.2 ATDD RED - ThinkTank admin frontend and access UI', () => {
  const createSubject = (): FrontendAdminSubject => {
    throw new Error(
      'RED PHASE: frontend/admin/advisory screen, admin proxy routes, and config-aware access UI are not implemented yet',
    )
  }

  test.skip('[P1][1.2-FE-001] should show ThinkTank config admin navigation only for admins', () => {
    const subject = createSubject()

    expect(subject.renderSidebar({ role: 'admin' }).getByText('ThinkTank 配置')).toBeTruthy()
    expect(subject.renderSidebar({ role: 'consultant' }).queryByText('ThinkTank 配置')).toBeNull()
  })

  test.skip('[P1][1.2-FE-002] should navigate admins to /admin/advisory from the admin sidebar entry', async () => {
    const subject = createSubject()
    const ui = subject.renderSidebar({ role: 'admin' })

    await ui.getByRole('button', { name: 'ThinkTank 配置' }).click?.()

    expect(subject.navigationCalls()).toContain(frontendAdminRoute)
  })

  test.skip('[P0][1.2-FE-003] should render module status, role binding, 90-day retention, privacy, and latest audit summary', () => {
    const subject = createSubject()

    const ui = subject.renderAdminPage({
      role: 'admin',
      config: expectedAdminConfigResponse.data,
    })

    expect(ui.getByText('ThinkTank 配置')).toBeTruthy()
    expect(ui.getByRole('switch', { name: /启用 ThinkTank/ }).getAttribute?.('aria-checked')).toBe(
      'true',
    )
    expect(ui.getByText(/90\s*天/)).toBeTruthy()
    expect(ui.getByText(advisoryModuleMessages.privacyConfirmation)).toBeTruthy()
    expect(ui.getByText('thinktank.module.enabled')).toBeTruthy()
    for (const role of csaasRoles) {
      expect(ui.getByLabelText(roleLabels[role])).toBeTruthy()
    }
  })

  test.skip('[P0][1.2-FE-004] should save enabled state and role binding through the admin proxy without tenant id in the body', async () => {
    const subject = createSubject()

    await subject.submitAdminConfig({
      enabled: true,
      allowedRoles: ['admin', 'consultant', 'client_pm'],
      privacyConfirmed: true,
    })

    expect(subject.apiCalls()).toContainEqual({
      method: 'PUT',
      path: '/api/advisory/admin/module-config',
      body: {
        enabled: true,
        allowedRoles: ['admin', 'consultant', 'client_pm'],
        dataRetentionDays: 90,
        privacyConfirmed: true,
      },
    })
    expect(subject.apiCalls()[0].body).not.toHaveProperty('tenantId')
  })

  test.skip('[P1][1.2-FE-005] should require an accessible confirmation dialog before disabling ThinkTank', async () => {
    const subject = createSubject()
    const ui = subject.renderAdminPage({
      role: 'admin',
      config: expectedAdminConfigResponse.data,
    })

    await ui.getByRole('switch', { name: /启用 ThinkTank/ }).click?.()

    expect(ui.getByRole('dialog', { name: /停用 ThinkTank/ })).toBeTruthy()
    expect(ui.getByText(advisoryModuleMessages.disabled)).toBeTruthy()

    await ui.getByRole('button', { name: /确认停用/ }).click?.()

    expect(subject.apiCalls()).toContainEqual(
      expect.objectContaining({
        method: 'PUT',
        path: '/api/advisory/admin/module-config',
        body: expect.objectContaining({ enabled: false }),
      }),
    )
  })

  test.skip('[P0][1.2-FE-006] should render a clear disabled state on /advisory when the backend denies disabled tenant access', () => {
    const subject = createSubject()

    const ui = subject.renderAdvisoryPage({
      accessState: 'disabled',
      message: advisoryModuleMessages.disabled,
    })

    expect(ui.getByText(advisoryModuleMessages.disabled)).toBeTruthy()
    expect(ui.queryByText('运行工作流')).toBeNull()
  })

  test.skip('[P0][1.2-FE-007] should keep backend access authoritative for direct /advisory route access', () => {
    const subject = createSubject()

    const ui = subject.renderAdvisoryPage({
      accessState: 'denied',
      message: advisoryModuleMessages.roleDenied,
    })

    expect(ui.getByText(advisoryModuleMessages.roleDenied)).toBeTruthy()
    expect(subject.apiCalls()).toContainEqual({
      method: 'GET',
      path: '/api/advisory/access',
    })
  })

  test.skip('[P1][1.2-FE-008] should reduce navigation noise when backend access says ThinkTank is unavailable', () => {
    const subject = createSubject()

    const ui = subject.renderSidebar({
      role: 'consultant',
      backendAccessAllowed: false,
    })

    expect(ui.queryByText('ThinkTank')).toBeNull()
  })

  test.skip('[P2][1.2-FE-009] should expose loading and audit-delay states without showing marketing copy', () => {
    const subject = createSubject()

    const ui = subject.renderAdminPage({
      role: 'admin',
      loading: true,
    })

    expect(ui.getByText(/正在加载 ThinkTank 配置/)).toBeTruthy()
    expect(ui.getByText(advisoryModuleMessages.auditDelayed)).toBeTruthy()
    expect(ui.queryByText(/开启企业智能新篇章/)).toBeNull()
  })

  test.skip('[P1][1.2-FE-010] should expose documented frontend routes for admin config and advisory access', () => {
    expect(frontendAdminRoute).toBe('/admin/advisory')
    expect(frontendAdvisoryRoute).toBe('/advisory')
  })
})
