import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSession, signOut } from 'next-auth/react'
import Header from '../Header'
import { useRadarUnreadCount } from '@/lib/hooks/useRadarUnreadCount'

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
  signOut: jest.fn(),
}))

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock the clearTokenCache function
jest.mock('@/lib/utils/api', () => ({
  clearTokenCache: jest.fn(),
}))

jest.mock('@/lib/hooks/useRadarUnreadCount', () => ({
  useRadarUnreadCount: jest.fn(() => ({
    unreadCount: 2,
    isLoading: false,
    error: null,
    refresh: jest.fn(),
  })),
}))

const mockUseSession = useSession as jest.Mock
const mockSignOut = signOut as jest.Mock
const mockUseRadarUnreadCount = useRadarUnreadCount as jest.Mock

describe('Header', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRadarUnreadCount.mockReturnValue({
      unreadCount: 2,
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    })
  })

  it('renders the logo', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })

    render(<Header />)

    expect(screen.getByText('CSAAS')).toBeInTheDocument()
  })

  it('renders user information when authenticated', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: 'Test User',
          email: 'test@example.com',
          role: 'consultant',
          organizationId: 'org-123',
        },
      },
      status: 'authenticated',
    })

    render(<Header />)

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('主咨询师')).toBeInTheDocument()
  })

  it('renders user email when name is not available', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          email: 'test@example.com',
          role: 'client_pm',
          organizationId: 'org-123',
        },
      },
      status: 'authenticated',
    })

    render(<Header />)

    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByText('企业PM')).toBeInTheDocument()
  })

  it('falls back to user email when the display name contains replacement characters', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: 'Radar���û�',
          email: 'radar-test@example.com',
          role: 'consultant',
          organizationId: 'org-123',
        },
      },
      status: 'authenticated',
    })

    render(<Header />)

    expect(screen.getByText('radar-test@example.com')).toBeInTheDocument()
    expect(screen.queryByText('Radar���û�')).not.toBeInTheDocument()
  })

  it('opens user menu when clicked', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: 'Test User',
          email: 'test@example.com',
          role: 'consultant',
          organizationId: 'org-123',
        },
      },
      status: 'authenticated',
    })

    render(<Header />)

    // Find the user button by looking for the display name
    const userButton = screen.getByText('Test User').closest('button')
    await userEvent.click(userButton!)

    // shadcn/ui DropdownMenu renders content in a portal
    // The items should be present after clicking
    await waitFor(() => {
      expect(screen.getByText('个人信息')).toBeInTheDocument()
      expect(screen.getByText('设置')).toBeInTheDocument()
      expect(screen.getByText('退出登录')).toBeInTheDocument()
    })
  })

  it('calls signOut when logout is clicked', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: 'Test User',
          email: 'test@example.com',
          role: 'consultant',
          organizationId: 'org-123',
        },
      },
      status: 'authenticated',
    })

    render(<Header />)

    const userButton = screen.getByText('Test User').closest('button')
    await userEvent.click(userButton!)

    const logoutButton = await screen.findByText('退出登录')
    await userEvent.click(logoutButton)

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/login' })
    })
  })

  it('does not render user section when not authenticated', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })

    render(<Header />)

    expect(screen.queryByText('Test User')).not.toBeInTheDocument()
  })

  it('renders menu toggle button when showMenuButton is true', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })

    const onMenuToggle = jest.fn()
    render(<Header showMenuButton={true} onMenuToggle={onMenuToggle} />)

    const menuButton = screen.getByRole('button', { name: /toggle menu/i })
    expect(menuButton).toBeInTheDocument()

    fireEvent.click(menuButton)
    expect(onMenuToggle).toHaveBeenCalled()
  })

  it('displays correct role labels', () => {
    const roles = [
      { role: 'consultant', label: '主咨询师' },
      { role: 'client_pm', label: '企业PM' },
      { role: 'respondent', label: '被调研者' },
      { role: 'unknown_role', label: 'unknown_role' },
    ]

    roles.forEach(({ role, label }) => {
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

      const { unmount } = render(<Header />)
      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    })
  })

  it('has correct header styling', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })

    render(<Header />)

    const header = screen.getByRole('banner')
    expect(header).toBeInTheDocument()
    expect(header).toHaveClass('h-16')
  })

  it('shows radar history entry with unread badge and navigates on click', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: 'Test User',
          email: 'test@example.com',
          role: 'consultant',
          organizationId: 'org-123',
        },
      },
      status: 'authenticated',
    })

    render(<Header />)

    const historyButton = screen.getByRole('button', { name: '推送历史' })
    expect(historyButton).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()

    fireEvent.click(historyButton)
    expect(mockPush).toHaveBeenCalledWith('/radar/history?orgId=org-123')
  })
})
