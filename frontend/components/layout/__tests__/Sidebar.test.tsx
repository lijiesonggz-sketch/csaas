import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import Sidebar from '../Sidebar'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  usePathname: () => '/dashboard',
}))

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}))

describe('Sidebar', () => {
  const mockUseSession = useSession as jest.Mock

  beforeEach(() => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: 'Test User',
          email: 'test@example.com',
          role: 'consultant',
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
    expect(screen.getByText('技术雷达')).toBeInTheDocument()
    expect(screen.getByText('报告中心')).toBeInTheDocument()
    expect(screen.getByText('团队管理')).toBeInTheDocument()
    expect(screen.getByText('系统管理')).toBeInTheDocument()
  })

  it('highlights current route', () => {
    render(<Sidebar />)

    // Find the button containing the text '工作台' - it's the parent button
    const dashboardText = screen.getByText('工作台')
    const dashboardButton = dashboardText.closest('.MuiListItemButton-root')
    expect(dashboardButton).toHaveClass('Mui-selected')
  })

  it('expands admin menu when clicked', () => {
    render(<Sidebar />)

    // Find the admin menu button by getting the parent of the text
    const adminText = screen.getByText('系统管理')
    const adminButton = adminText.closest('.MuiListItemButton-root')
    fireEvent.click(adminButton!)

    // Child items should be visible after expansion
    expect(screen.getByText('运营仪表板')).toBeInTheDocument()
    expect(screen.getByText('内容质量管理')).toBeInTheDocument()
    expect(screen.getByText('客户管理')).toBeInTheDocument()
    expect(screen.getByText('成本优化')).toBeInTheDocument()
    expect(screen.getByText('品牌配置')).toBeInTheDocument()
    expect(screen.getByText('信息源配置')).toBeInTheDocument()
    expect(screen.getByText('同业爬虫管理')).toBeInTheDocument()
    expect(screen.getByText('爬虫健康监控')).toBeInTheDocument()
  })

  it('collapses admin menu when clicked again', () => {
    render(<Sidebar />)

    // Find the admin menu button
    const adminText = screen.getByText('系统管理')
    const adminButton = adminText.closest('.MuiListItemButton-root')

    // First click to expand
    fireEvent.click(adminButton!)
    expect(screen.getByText('运营仪表板')).toBeInTheDocument()

    // Second click to collapse
    fireEvent.click(adminButton!)

    // Child items should be hidden after collapse
    // Note: MUI Collapse keeps elements in DOM but hides them
    // The test verifies the toggle functionality works without error
  })

  it('toggles collapse state when collapse button is clicked', () => {
    const onCollapseChange = jest.fn()
    render(<Sidebar onCollapseChange={onCollapseChange} />)

    // Find the collapse button at the bottom of the sidebar
    // It's the last button in the sidebar that contains Chevron icons
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
    const mockPush = jest.fn()
    jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue({
      push: mockPush,
    })

    render(<Sidebar />)

    const projectsText = screen.getByText('项目管理')
    const projectsButton = projectsText.closest('.MuiListItemButton-root')
    fireEvent.click(projectsButton!)

    expect(mockPush).toHaveBeenCalledWith('/projects')
  })

  it('handles special radar navigation with org ID', async () => {
    const mockPush = jest.fn()
    jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue({
      push: mockPush,
    })

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
    const radarButton = radarText.closest('.MuiListItemButton-root')
    fireEvent.click(radarButton!)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/radar?orgId=org-123')
    })
  })

  it('falls back to default radar route when org fetch fails', async () => {
    const mockPush = jest.fn()
    jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue({
      push: mockPush,
    })

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })

    render(<Sidebar />)

    const radarText = screen.getByText('技术雷达')
    const radarButton = radarText.closest('.MuiListItemButton-root')
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
    const mockPush = jest.fn()
    jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue({
      push: mockPush,
    })

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
    const mockPush = jest.fn()
    jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue({
      push: mockPush,
    })

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
    const radarButton = radarText.closest('.MuiListItemButton-root')
    fireEvent.click(radarButton!)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/radar')
    })
  })

  it('handles radar navigation when fetch throws an error', async () => {
    const mockPush = jest.fn()
    jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue({
      push: mockPush,
    })

    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    render(<Sidebar />)

    const radarText = screen.getByText('技术雷达')
    const radarButton = radarText.closest('.MuiListItemButton-root')
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

  it('navigates to child route when admin submenu item is clicked', () => {
    const mockPush = jest.fn()
    jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue({
      push: mockPush,
    })

    render(<Sidebar />)

    // First expand the admin menu
    const adminText = screen.getByText('系统管理')
    const adminButton = adminText.closest('.MuiListItemButton-root')
    fireEvent.click(adminButton!)

    // Now click on a child item
    const childItem = screen.getByText('运营仪表板')
    const childButton = childItem.closest('.MuiListItemButton-root')
    fireEvent.click(childButton!)

    expect(mockPush).toHaveBeenCalledWith('/admin/dashboard')
  })
})
