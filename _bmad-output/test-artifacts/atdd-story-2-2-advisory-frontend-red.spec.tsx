import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import AdvisoryPage from '@/app/advisory/page'
import MainLayout from '@/components/layout/MainLayout'
import { fetchThinkTankAccess } from '@/lib/advisory/access'
import { useRadarUnreadCount } from '@/lib/hooks/useRadarUnreadCount'
import {
  installStory22MatchMedia,
  story22AuthenticatedSession,
  story22DeniedAccess,
  story22DesktopAccess,
  story22DisabledTenantAccess,
  story22LandmarkLabels,
  story22StateCopy,
} from './atdd-story-2-2-advisory-fixtures'

expect.extend(toHaveNoViolations)

jest.mock('@/lib/advisory/access', () => ({
  canAccessThinkTank: jest.fn(() => true),
  fetchThinkTankAccess: jest.fn(),
  THINKTANK_ACCESS_DENIED_MESSAGE: '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。',
}))

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: story22AuthenticatedSession,
    status: 'authenticated',
  })),
  signOut: jest.fn(),
}))

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/advisory',
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock('@/lib/hooks/useRadarUnreadCount', () => ({
  useRadarUnreadCount: jest.fn(),
}))

describe('Story 2.2 Advisory accessibility baseline ATDD (RED)', () => {
  const mockFetchThinkTankAccess = fetchThinkTankAccess as jest.MockedFunction<
    typeof fetchThinkTankAccess
  >
  const mockUseRadarUnreadCount = useRadarUnreadCount as jest.MockedFunction<
    typeof useRadarUnreadCount
  >

  beforeEach(() => {
    jest.clearAllMocks()
    mockPush.mockReset()
    installStory22MatchMedia(true)
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1440,
    })
    mockUseRadarUnreadCount.mockReturnValue({ unreadCount: 0 })
  })

  it.skip('[P0][2.2-A11Y-001] exposes a keyboard-visible skip link targeting the single MainLayout main landmark', async () => {
    const user = userEvent.setup()

    render(
      <MainLayout>
        <section aria-label={story22LandmarkLabels.conversationRegion}>Advisory content</section>
      </MainLayout>,
    )

    await user.tab()

    const skipLink = screen.getByRole('link', { name: '跳到主内容' })
    expect(skipLink).toHaveFocus()
    expect(skipLink).toHaveAttribute('href', '#main-content')
    expect(document.querySelectorAll('main#main-content')).toHaveLength(1)
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
  })

  it.skip('[P0][2.2-A11Y-002] renders authorized advisory landmarks and state regions with stable accessible names', async () => {
    mockFetchThinkTankAccess.mockResolvedValue(story22DesktopAccess)

    render(<AdvisoryPage />)

    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: story22LandmarkLabels.conversationRegion }),
      ).toBeInTheDocument()
    })

    expect(
      screen.getByRole('complementary', { name: story22LandmarkLabels.workflowSidebar }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: story22LandmarkLabels.workflowNav }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('complementary', { name: story22LandmarkLabels.documentDrawer }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status', { name: /thinktank 已启用/i })).toHaveTextContent(
      story22StateCopy.enabled,
    )
    expect(screen.getByRole('status', { name: /暂无活动会话/i })).toHaveTextContent(
      story22StateCopy.noActiveSession,
    )
    expect(screen.getByRole('status', { name: /等待开始咨询/i })).toHaveTextContent(
      story22StateCopy.emptyConversation,
    )
  })

  it.skip('[P0][2.2-A11Y-003] uses consistent live-region semantics for loading, denied, desktop-required, and empty states', async () => {
    mockFetchThinkTankAccess.mockReturnValueOnce(new Promise(() => {}))
    const loadingRender = render(<AdvisoryPage />)

    expect(screen.getByRole('status')).toHaveTextContent(story22StateCopy.accessLoading)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')

    loadingRender.unmount()
    mockFetchThinkTankAccess.mockResolvedValueOnce(story22DeniedAccess)
    render(<AdvisoryPage />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(story22DeniedAccess.message)
    })

    mockFetchThinkTankAccess.mockResolvedValueOnce(story22DisabledTenantAccess)
    render(<AdvisoryPage />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(story22DisabledTenantAccess.message)
    })
  })

  it.skip('[P0][2.2-A11Y-004] preserves keyboard focus when the desktop viewport gate changes state', async () => {
    const media = installStory22MatchMedia(true)
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue(story22DesktopAccess)

    render(<AdvisoryPage />)

    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: story22LandmarkLabels.conversationRegion }),
      ).toBeInTheDocument()
    })

    await user.tab()
    expect(screen.getByRole('link', { name: '跳到主内容' })).toHaveFocus()

    act(() => {
      media.setDesktop(false)
    })

    expect(screen.getByRole('status')).toHaveTextContent(story22StateCopy.desktopRequired)
    expect(document.body).toContainElement(document.activeElement)
  })

  it.skip('[P1][2.2-A11Y-005] keeps unavailable workflow and document drawer affordances non-misleading', async () => {
    mockFetchThinkTankAccess.mockResolvedValue(story22DesktopAccess)

    render(<AdvisoryPage />)

    await waitFor(() => {
      expect(
        screen.getByRole('navigation', { name: story22LandmarkLabels.workflowNav }),
      ).toBeInTheDocument()
    })

    const workflowNav = screen.getByRole('navigation', { name: story22LandmarkLabels.workflowNav })
    ;['结构化咨询', '研究分析', '问题解决'].forEach((label) => {
      expect(within(workflowNav).queryByRole('button', { name: new RegExp(label) })).toBeNull()
      expect(within(workflowNav).queryByRole('link', { name: new RegExp(label) })).toBeNull()
      expect(screen.getByText(label).closest('li')).not.toHaveAttribute('tabindex')
    })

    const drawerButton = screen.getByRole('button', { name: '展开咨询文档抽屉' })
    expect(drawerButton).toBeDisabled()
    expect(drawerButton).toHaveAccessibleDescription(story22StateCopy.drawerUnavailable)
  })

  it.skip('[P0][2.2-A11Y-006] has no axe blocking violations across authorized, loading, denied, and desktop-required states', async () => {
    mockFetchThinkTankAccess.mockResolvedValue(story22DesktopAccess)
    const authorized = render(<AdvisoryPage />)

    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: story22LandmarkLabels.conversationRegion }),
      ).toBeInTheDocument()
    })
    expect(await axe(authorized.container)).toHaveNoViolations()

    authorized.unmount()
    mockFetchThinkTankAccess.mockReturnValueOnce(new Promise(() => {}))
    const loading = render(<AdvisoryPage />)
    expect(await axe(loading.container)).toHaveNoViolations()

    loading.unmount()
    mockFetchThinkTankAccess.mockResolvedValueOnce(story22DeniedAccess)
    const denied = render(<AdvisoryPage />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(await axe(denied.container)).toHaveNoViolations()

    denied.unmount()
    installStory22MatchMedia(false)
    mockFetchThinkTankAccess.mockResolvedValueOnce(story22DesktopAccess)
    const desktopRequired = render(<AdvisoryPage />)
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(story22StateCopy.desktopRequired)
    })
    expect(await axe(desktopRequired.container)).toHaveNoViolations()
  })
})
