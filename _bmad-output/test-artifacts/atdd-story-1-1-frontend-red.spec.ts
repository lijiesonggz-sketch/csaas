/**
 * ATDD RED - Story 1.1: ThinkTank navigation and entry placeholder
 *
 * TDD RED PHASE: All tests use test.skip().
 * These tests will fail until Sidebar ThinkTank registration and
 * frontend/app/advisory route are implemented.
 */

import {
  advisoryAuthorizedMessage,
  advisoryDeniedMessage,
  allowedThinkTankRoles,
  createAdvisoryUser,
  forbiddenWorkspaceLabels,
} from './atdd-story-1-1-fixtures'

interface RenderedUi {
  getByText: (text: string | RegExp) => unknown
  queryByText: (text: string | RegExp) => unknown
  getByRole: (role: string, options?: { name?: string | RegExp }) => {
    click?: () => Promise<void> | void
    getAttribute?: (name: string) => string | null
  }
}

interface FrontendSubject {
  renderSidebar: (options: {
    role: ReturnType<typeof createAdvisoryUser>['role']
    collapsed?: boolean
  }) => RenderedUi
  renderAdvisoryPage: (options: {
    accessState: 'loading' | 'allowed' | 'denied'
  }) => RenderedUi
  navigationCalls: () => string[]
}

describe('Story 1.1 ATDD RED - ThinkTank frontend entry', () => {
  const createSubject = (): FrontendSubject => {
    throw new Error(
      'RED PHASE: Sidebar ThinkTank item and frontend/app/advisory page are not implemented yet',
    )
  }

  test.skip('[P1][1.1-UI-001] should show ThinkTank navigation for allowed roles', () => {
    const subject = createSubject()

    for (const role of allowedThinkTankRoles) {
      const ui = subject.renderSidebar({ role })
      expect(ui.getByText('ThinkTank')).toBeTruthy()
    }
  })

  test.skip('[P0][1.1-UI-002] should hide ThinkTank navigation for respondent role', () => {
    const subject = createSubject()

    const ui = subject.renderSidebar({ role: 'respondent' })

    expect(ui.queryByText('ThinkTank')).toBeNull()
  })

  test.skip('[P1][1.1-UI-003] should navigate to /advisory when ThinkTank item is selected', async () => {
    const subject = createSubject()
    const ui = subject.renderSidebar({ role: 'consultant' })

    await ui.getByRole('button', { name: 'ThinkTank' }).click?.()

    expect(subject.navigationCalls()).toContain('/advisory')
  })

  test.skip('[P2][1.1-UI-004] should keep ThinkTank available in collapsed sidebar for allowed roles', () => {
    const subject = createSubject()

    const ui = subject.renderSidebar({ role: 'client_pm', collapsed: true })
    const button = ui.getByRole('button', { name: /ThinkTank/i })

    expect(button.getAttribute?.('title')).toBe('ThinkTank')
  })

  test.skip('[P1][1.1-UI-005] should show loading state while /advisory access is checked', () => {
    const subject = createSubject()

    const ui = subject.renderAdvisoryPage({ accessState: 'loading' })

    expect(ui.getByText(/正在验证 ThinkTank 访问权限/)).toBeTruthy()
  })

  test.skip('[P1][1.1-UI-006] should render a minimal authorized placeholder after access succeeds', () => {
    const subject = createSubject()

    const ui = subject.renderAdvisoryPage({ accessState: 'allowed' })

    expect(ui.getByText('ThinkTank')).toBeTruthy()
    expect(ui.getByText(advisoryAuthorizedMessage)).toBeTruthy()
  })

  test.skip('[P1][1.1-UI-007] should not expose full advisory workspace controls in the placeholder', () => {
    const subject = createSubject()

    const ui = subject.renderAdvisoryPage({ accessState: 'allowed' })

    for (const label of forbiddenWorkspaceLabels) {
      expect(ui.queryByText(label)).toBeNull()
    }
  })

  test.skip('[P0][1.1-UI-008] should render a friendly authorization message when backend returns denied', () => {
    const subject = createSubject()

    const ui = subject.renderAdvisoryPage({ accessState: 'denied' })

    expect(ui.getByText(advisoryDeniedMessage)).toBeTruthy()
    expect(ui.queryByText('运行工作流')).toBeNull()
  })
})
