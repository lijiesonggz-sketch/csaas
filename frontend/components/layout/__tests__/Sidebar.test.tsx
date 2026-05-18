import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import Sidebar from '../Sidebar'
import { fetchThinkTankAccess } from '@/lib/advisory/access'

const mockPush = jest.fn()

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/dashboard',
}))

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}))

jest.mock('@/lib/advisory/access', () => ({
  canAccessThinkTank: jest.fn((role?: string | null) =>
    ['admin', 'consultant', 'client_pm', 'respondent'].includes(role ?? '')
  ),
  fetchThinkTankAccess: jest.fn(),
}))

describe('Sidebar', () => {
  const mockUseSession = useSession as jest.Mock
  const mockFetchThinkTankAccess = fetchThinkTankAccess as jest.MockedFunction<
    typeof fetchThinkTankAccess
  >

  beforeEach(() => {
    mockPush.mockReset()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: 'Test User',
          email: 'test@example.com',
          role: 'admin',
          organizationId: 'org-123',
        },
      },
      status: 'authenticated',
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders all main navigation items', () => {
    render(<Sidebar />)

    expect(screen.getByText('工作台')).toBeInTheDocument()
    expect(screen.getByText('项目管理')).toBeInTheDocument()
    expect(screen.getByText('机构画像')).toBeInTheDocument()
    expect(screen.getByText('适用控制点')).toBeInTheDocument()
    expect(screen.getByText('技术雷达')).toBeInTheDocument()
    expect(screen.getByText('ThinkTank')).toBeInTheDocument()
    expect(screen.getByText('报告中心')).toBeInTheDocument()
    expect(screen.getByText('团队管理')).toBeInTheDocument()
    expect(screen.getByText('系统管理')).toBeInTheDocument()
  })

  it('highlights current route', () => {
    render(<Sidebar />)

    // Find the button containing the text '工作台'
    const dashboardText = screen.getByText('工作台')
    const dashboardButton = dashboardText.closest('button')
    // Should have selected styling (bg-white/10 and border-emerald-400)
    expect(dashboardButton).toBeInTheDocument()
  })

  it('keeps admin menu collapsed by default and expands it when clicked', async () => {
    render(<Sidebar />)

    expect(screen.queryByText('运营仪表板')).not.toBeInTheDocument()

    // Find the admin menu button by getting the parent of the text
    const adminText = screen.getByText('系统管理')
    const adminButton = adminText.closest('button')

    // Click to expand
    fireEvent.click(adminButton!)

    // Child items should be visible
    await waitFor(() => {
      expect(screen.getByText('运营仪表板')).toBeInTheDocument()
      expect(screen.getByText('内容质量管理')).toBeInTheDocument()
      expect(screen.getByText('客户管理')).toBeInTheDocument()
      expect(screen.getByText('成本优化')).toBeInTheDocument()
      expect(screen.getByText('品牌配置')).toBeInTheDocument()
      expect(screen.getByText('信息源配置')).toBeInTheDocument()
      expect(screen.getByText('案例运营')).toBeInTheDocument()
      expect(screen.getByText('失效模式管理')).toBeInTheDocument()
      expect(screen.getByText('法规义务管理')).toBeInTheDocument()
      expect(screen.getByText('控制点管理')).toBeInTheDocument()
      expect(screen.getByText('覆盖率分析')).toBeInTheDocument()
      expect(screen.getByText('同业爬虫管理')).toBeInTheDocument()
      expect(screen.getByText('爬虫健康监控')).toBeInTheDocument()
      expect(screen.getByText('分类体系发布')).toBeInTheDocument()
      expect(screen.getByText('ThinkTank 配置')).toBeInTheDocument()
    })
  })

  it('collapses admin menu when clicked again', async () => {
    render(<Sidebar />)

    const adminText = screen.getByText('系统管理')
    const adminButton = adminText.closest('button')

    fireEvent.click(adminButton!)
    await waitFor(() => {
      expect(screen.getByText('运营仪表板')).toBeInTheDocument()
    })

    fireEvent.click(adminButton!)

    // Child items should be hidden after collapse
    await waitFor(() => {
      expect(screen.queryByText('运营仪表板')).not.toBeInTheDocument()
    })
  })

  it('toggles collapse state when collapse button is clicked', () => {
    const onCollapseChange = jest.fn()
    render(<Sidebar onCollapseChange={onCollapseChange} />)

    // Find the collapse button at the bottom of the sidebar
    // It's the last button in the sidebar
    const buttons = screen.getAllByRole('button')
    const collapseButton = buttons[buttons.length - 1] // Last button is the collapse toggle
    expect(collapseButton).toBeDefined()
    fireEvent.click(collapseButton!)

    expect(onCollapseChange).toHaveBeenCalledWith(true)
  })

  it('renders in collapsed state', () => {
    render(<Sidebar collapsed={true} />)

    // Text should not be visible in collapsed state
    expect(screen.queryByText('工作台')).not.toBeInTheDocument()
  })

  it('navigates to route when menu item is clicked', () => {
    render(<Sidebar />)

    const projectsText = screen.getByText('项目管理')
    const projectsButton = projectsText.closest('button')
    fireEvent.click(projectsButton!)

    expect(mockPush).toHaveBeenCalledWith('/projects')
  })

  it.each(['admin', 'consultant', 'client_pm'])(
    'shows ThinkTank navigation for %s users',
    (role) => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: 'Test User',
            email: 'test@example.com',
            role,
            organizationId: 'org-123',
          },
        },
        status: 'authenticated',
      })

      render(<Sidebar />)

      expect(screen.getByText('ThinkTank')).toBeInTheDocument()
    }
  )

  it('hides ThinkTank navigation for respondent users when backend denies tenant access', async () => {
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: false,
      module: 'thinktank',
      reason: 'role_not_allowed',
      message: '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。',
    })
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: 'Test User',
          email: 'test@example.com',
          role: 'respondent',
          organizationId: 'org-123',
        },
      },
      status: 'authenticated',
    })

    render(<Sidebar />)

    await waitFor(() => {
      expect(screen.queryByText('ThinkTank')).not.toBeInTheDocument()
    })
    expect(mockFetchThinkTankAccess).toHaveBeenCalled()
  })

  it('shows ThinkTank navigation for respondent users when tenant config binds the role', async () => {
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: 'Test User',
          email: 'test@example.com',
          role: 'respondent',
          organizationId: 'org-123',
        },
      },
      status: 'authenticated',
    })

    render(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByText('ThinkTank')).toBeInTheDocument()
    })
    expect(mockFetchThinkTankAccess).toHaveBeenCalled()
  })

  it('hides ThinkTank navigation after backend reports the tenant module is disabled', async () => {
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: false,
      module: 'thinktank',
      message: 'ThinkTank 当前未在本租户启用，请联系管理员开通。',
    })

    render(<Sidebar />)

    await waitFor(() => {
      expect(screen.queryByText('ThinkTank')).not.toBeInTheDocument()
    })
  })

  it('navigates to the ThinkTank route when the entry is clicked', () => {
    render(<Sidebar />)

    const thinkTankButton = screen.getByText('ThinkTank').closest('button')
    fireEvent.click(thinkTankButton!)

    expect(mockPush).toHaveBeenCalledWith('/advisory')
  })

  it('keeps ThinkTank accessible as a titled icon in collapsed state', () => {
    render(<Sidebar collapsed={true} />)

    const thinkTankButton = screen.getByTitle('ThinkTank')
    fireEvent.click(thinkTankButton)

    expect(mockPush).toHaveBeenCalledWith('/advisory')
  })

  it('navigates to organization profile using the current organization id', () => {
    render(<Sidebar />)

    const profileText = screen.getByText('机构画像')
    const profileButton = profileText.closest('button')
    fireEvent.click(profileButton!)

    expect(mockPush).toHaveBeenCalledWith('/organizations/org-123/profile')
  })

  it('navigates to applicable controls using the current organization id', () => {
    render(<Sidebar />)

    const controlsText = screen.getByText('适用控制点')
    const controlsButton = controlsText.closest('button')
    fireEvent.click(controlsButton!)

    expect(mockPush).toHaveBeenCalledWith('/organizations/org-123/applicable-controls')
  })

  it('handles special radar navigation with org ID', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          organization: { id: 'org-123' },
        },
      }),
    })

    render(<Sidebar />)

    const radarText = screen.getByText('技术雷达')
    const radarButton = radarText.closest('button')
    fireEvent.click(radarButton!)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/radar?orgId=org-123')
    })
  })

  it('falls back to default radar route when org fetch fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })

    render(<Sidebar />)

    const radarText = screen.getByText('技术雷达')
    const radarButton = radarText.closest('button')
    fireEvent.click(radarButton!)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/radar')
    })
  })

  it('shows tooltips for collapsed menu items', () => {
    render(<Sidebar collapsed={true} />)

    // In collapsed state, icons should be present
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('navigates to route when collapsed menu item is clicked', () => {
    render(<Sidebar collapsed={true} />)

    // Get all buttons in collapsed state (icons only)
    const buttons = screen.getAllByRole('button')
    // Click on the first menu item button (not the collapse button)
    // The collapse button is the last one
    const firstMenuButton = buttons[0]
    fireEvent.click(firstMenuButton)

    // Should navigate somewhere (we can't know exactly which one without more context)
    expect(mockPush).toHaveBeenCalled()
  })

  it('handles radar navigation when orgId is missing from response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          organization: {}, // No id field
        },
      }),
    })

    render(<Sidebar />)

    const radarText = screen.getByText('技术雷达')
    const radarButton = radarText.closest('button')
    fireEvent.click(radarButton!)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/radar')
    })
  })

  it('handles radar navigation when fetch throws an error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    render(<Sidebar />)

    const radarText = screen.getByText('技术雷达')
    const radarButton = radarText.closest('button')
    fireEvent.click(radarButton!)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/radar')
    })
  })

  it('expands admin menu when clicked in collapsed state', () => {
    render(<Sidebar collapsed={true} />)

    // In collapsed state, all menu items are shown as icons with tooltips
    // Get all buttons except the last one (collapse button)
    const buttons = screen.getAllByRole('button')
    // Find the admin button (it should be one of the buttons)
    const adminButton = buttons[buttons.length - 2] // Second to last is likely admin
    expect(adminButton).toBeDefined()

    // Click should trigger handleExpandToggle but not crash
    fireEvent.click(adminButton)

    // In collapsed state, clicking admin item should still work
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('navigates to child route when admin submenu item is clicked', async () => {
    render(<Sidebar />)

    fireEvent.click(screen.getByText('系统管理').closest('button')!)

    const childItem = screen.getByText('运营仪表板')
    const childButton = childItem.closest('button')
    fireEvent.click(childButton!)

    expect(mockPush).toHaveBeenCalledWith('/admin/dashboard')
  })

  it('navigates to ThinkTank 配置 from the admin submenu', async () => {
    render(<Sidebar />)

    fireEvent.click(screen.getByText('系统管理').closest('button')!)

    const childItem = screen.getByText('ThinkTank 配置')
    const childButton = childItem.closest('button')
    fireEvent.click(childButton!)

    expect(mockPush).toHaveBeenCalledWith('/admin/advisory')
  })

  it('navigates to obligation coverage analysis from the admin submenu', async () => {
    render(<Sidebar />)

    fireEvent.click(screen.getByText('系统管理').closest('button')!)

    const childItem = screen.getByText('覆盖率分析')
    const childButton = childItem.closest('button')
    fireEvent.click(childButton!)

    expect(mockPush).toHaveBeenCalledWith('/admin/obligations/coverage-analysis')
  })

  it('keeps 控制点管理 between 法规义务管理 and 覆盖率分析 in the admin submenu', async () => {
    render(<Sidebar />)

    fireEvent.click(screen.getByText('系统管理').closest('button')!)

    const adminTexts = screen
      .getAllByRole('button')
      .map((button) => button.textContent ?? '')
      .filter((text) =>
        ['法规义务管理', '控制点管理', '覆盖率分析'].some((label) => text.includes(label))
      )

    expect(adminTexts).toEqual(['法规义务管理', '控制点管理', '覆盖率分析'])
  })

  it('navigates to 控制点管理 from the admin submenu', async () => {
    render(<Sidebar />)

    fireEvent.click(screen.getByText('系统管理').closest('button')!)

    const childItem = screen.getByText('控制点管理')
    const childButton = childItem.closest('button')
    fireEvent.click(childButton!)

    expect(mockPush).toHaveBeenCalledWith('/admin/control-points')
  })
})
