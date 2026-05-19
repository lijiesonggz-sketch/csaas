import { render, screen, waitFor } from '@testing-library/react'
import AdvisoryPage from '@/app/advisory/page'
import { fetchThinkTankAccess } from '@/lib/advisory/access'
import {
  installStory21MatchMedia,
  story21AuthenticatedSession,
  story21ConversationEmptyState,
  story21DeniedAccess,
  story21DesktopAccess,
  story21DesktopRequiredMessage,
  story21DisabledTenantAccess,
  story21DocumentDrawerCollapsedText,
  story21ExpectedShellRegions,
  story21WorkspaceHeading,
} from './atdd-story-2-1-advisory-fixtures'

jest.mock('@/lib/advisory/access', () => ({
  fetchThinkTankAccess: jest.fn(),
  canAccessThinkTank: jest.fn(() => true),
  THINKTANK_ACCESS_DENIED_MESSAGE: '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。',
}))

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: story21AuthenticatedSession,
    status: 'authenticated',
  })),
  signOut: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/advisory'),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}))

jest.mock('@/lib/hooks/useRadarUnreadCount', () => ({
  useRadarUnreadCount: jest.fn(() => ({ unreadCount: 0 })),
}))

describe('Story 2.1 Desktop Advisory Workspace Shell ATDD (RED)', () => {
  const mockFetchThinkTankAccess = fetchThinkTankAccess as jest.MockedFunction<
    typeof fetchThinkTankAccess
  >

  beforeEach(() => {
    jest.clearAllMocks()
    installStory21MatchMedia(true)
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 })
  })

  test.skip('[P0][2.1-SHELL-001] authorized desktop users see the CSAAS frame and full advisory workspace shell', async () => {
    mockFetchThinkTankAccess.mockResolvedValue(story21DesktopAccess)

    render(<AdvisoryPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: story21WorkspaceHeading })).toBeInTheDocument()
    })

    expect(screen.getByRole(story21ExpectedShellRegions.globalBanner)).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: story21ExpectedShellRegions.globalNavigationName }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('complementary', {
        name: story21ExpectedShellRegions.advisorySidebarName,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', {
        name: story21ExpectedShellRegions.conversationWorkspaceName,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: story21ExpectedShellRegions.collapsedDocumentDrawerButtonName,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(story21ConversationEmptyState)).toBeInTheDocument()
    expect(screen.getByText(story21DocumentDrawerCollapsedText)).toBeInTheDocument()
    expect(screen.queryByText('咨询工作台暂未开放')).not.toBeInTheDocument()
  })

  test.skip('[P0][2.1-SHELL-002] narrow viewports show the desktop-required state and do not render broken shell columns', async () => {
    installStory21MatchMedia(false)
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 900 })
    mockFetchThinkTankAccess.mockResolvedValue(story21DesktopAccess)

    render(<AdvisoryPage />)

    await waitFor(() => {
      expect(screen.getByText(story21DesktopRequiredMessage)).toBeInTheDocument()
    })

    expect(
      screen.queryByRole('region', {
        name: story21ExpectedShellRegions.conversationWorkspaceName,
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('complementary', {
        name: story21ExpectedShellRegions.advisorySidebarName,
      }),
    ).not.toBeInTheDocument()
  })

  test.skip('[P1][2.1-SHELL-003] denied and disabled tenant states remain friendly alerts and do not leak workspace UI', async () => {
    mockFetchThinkTankAccess.mockResolvedValueOnce(story21DeniedAccess)
    const deniedRender = render(<AdvisoryPage />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(story21DeniedAccess.message)
    })
    expect(
      screen.queryByRole('region', {
        name: story21ExpectedShellRegions.conversationWorkspaceName,
      }),
    ).not.toBeInTheDocument()

    deniedRender.unmount()
    mockFetchThinkTankAccess.mockResolvedValueOnce(story21DisabledTenantAccess)
    render(<AdvisoryPage />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(story21DisabledTenantAccess.message)
    })
    expect(
      screen.queryByRole('button', {
        name: story21ExpectedShellRegions.collapsedDocumentDrawerButtonName,
      }),
    ).not.toBeInTheDocument()
  })
})

