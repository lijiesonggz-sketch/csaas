import { act, render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import AdvisoryPage from '../page'
import { fetchThinkTankAccess } from '@/lib/advisory/access'
import { useRadarUnreadCount } from '@/lib/hooks/useRadarUnreadCount'

jest.mock('@/lib/advisory/access', () => ({
  canAccessThinkTank: jest.fn(() => true),
  fetchThinkTankAccess: jest.fn(),
  THINKTANK_ACCESS_DENIED_MESSAGE: '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。',
}))

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
  signOut: jest.fn(),
}))

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/advisory',
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock('@/lib/hooks/useRadarUnreadCount', () => ({
  useRadarUnreadCount: jest.fn(),
}))

describe('AdvisoryPage', () => {
  const mockFetchThinkTankAccess = fetchThinkTankAccess as jest.MockedFunction<
    typeof fetchThinkTankAccess
  >
  const mockUseSession = useSession as jest.Mock
  const mockUseRadarUnreadCount = useRadarUnreadCount as jest.MockedFunction<
    typeof useRadarUnreadCount
  >

  const installMatchMedia = (desktop: boolean) => {
    let matchesDesktop = desktop
    const listeners = new Map<string, Set<(event: MediaQueryListEvent) => void>>()
    const getListeners = (query: string) => {
      if (!listeners.has(query)) {
        listeners.set(query, new Set())
      }
      return listeners.get(query)!
    }
    const readMatches = (query: string) => {
      if (query.includes('1024px')) return matchesDesktop
      return false
    }

    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      get matches() {
        return readMatches(query)
      },
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
        if (event === 'change') getListeners(query).add(listener)
      }),
      removeEventListener: jest.fn(
        (event: string, listener: (event: MediaQueryListEvent) => void) => {
          if (event === 'change') getListeners(query).delete(listener)
        }
      ),
      dispatchEvent: jest.fn(),
    }))

    return {
      setDesktop(next: boolean) {
        matchesDesktop = next
        getListeners('(min-width: 1024px)').forEach((listener) => {
          listener({ matches: next, media: '(min-width: 1024px)' } as MediaQueryListEvent)
        })
      },
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockPush.mockReset()
    installMatchMedia(true)
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1440,
    })
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: 'ThinkTank Consultant',
          email: 'consultant@example.com',
          role: 'consultant',
          organizationId: 'org-123',
        },
      },
      status: 'authenticated',
    })
    mockUseRadarUnreadCount.mockReturnValue({ unreadCount: 0 })
  })

  it('renders a loading state while access is being verified', () => {
    mockFetchThinkTankAccess.mockReturnValue(new Promise(() => {}))

    render(<AdvisoryPage />)

    expect(screen.getByRole('status')).toHaveTextContent('正在验证 ThinkTank 访问权限')
  })

  it('renders the authorized desktop advisory workspace shell inside the CSAAS frame', async () => {
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    render(<AdvisoryPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'ThinkTank' })).toBeInTheDocument()
    })
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument()
    expect(
      screen.getByRole('complementary', { name: '咨询工作流导航' })
    ).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '咨询对话工作区' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: '咨询文档抽屉' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '展开咨询文档抽屉' })).toBeDisabled()
    expect(screen.getByText('选择一个工作流后，对话将在这里开始。')).toBeInTheDocument()
    expect(screen.getByText('文档')).toBeInTheDocument()
    expect(screen.queryByText('咨询工作台暂未开放')).not.toBeInTheDocument()
    expect(
      screen.queryByText('ThinkTank 模块已启用入口，完整咨询工作台将在后续版本开放。')
    ).not.toBeInTheDocument()
  })

  it('shows a desktop-required state below 1024px without rendering broken shell columns', async () => {
    installMatchMedia(false)
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 900,
    })
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    render(<AdvisoryPage />)

    await waitFor(() => {
      expect(screen.getByText('ThinkTank MVP 当前需要桌面端宽屏使用')).toBeInTheDocument()
    })
    expect(screen.queryByRole('region', { name: '咨询对话工作区' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('complementary', { name: '咨询工作流导航' })
    ).not.toBeInTheDocument()
  })

  it('updates the desktop gate when the 1024px media query changes', async () => {
    const media = installMatchMedia(true)
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    render(<AdvisoryPage />)

    await waitFor(() => {
      expect(screen.getByRole('region', { name: '咨询对话工作区' })).toBeInTheDocument()
    })

    act(() => {
      media.setDesktop(false)
    })

    expect(screen.getByText('ThinkTank MVP 当前需要桌面端宽屏使用')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '咨询对话工作区' })).not.toBeInTheDocument()
  })

  it('falls back to the desktop-required state when matchMedia is unavailable', async () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    render(<AdvisoryPage />)

    await waitFor(() => {
      expect(screen.getByText('ThinkTank MVP 当前需要桌面端宽屏使用')).toBeInTheDocument()
    })
  })

  it('renders a friendly authorization denied state', async () => {
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: false,
      module: 'thinktank',
      message: '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。',
    })

    render(<AdvisoryPage />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。'
      )
    })
    expect(
      screen.queryByRole('region', { name: '咨询对话工作区' })
    ).not.toBeInTheDocument()
  })

  it('renders a clear disabled tenant state', async () => {
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: false,
      module: 'thinktank',
      reason: 'module_disabled',
      message: 'ThinkTank 当前未在本租户启用，请联系管理员开通。',
    })

    render(<AdvisoryPage />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'ThinkTank 当前未在本租户启用，请联系管理员开通。'
      )
    })
    expect(screen.queryByRole('button', { name: '展开咨询文档抽屉' })).not.toBeInTheDocument()
  })
})
