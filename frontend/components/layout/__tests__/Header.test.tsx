import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useSession, signOut } from 'next-auth/react'
import Header from '../Header'

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
  signOut: jest.fn(),
}))

// Mock the clearTokenCache function
jest.mock('@/lib/utils/api', () => ({
  clearTokenCache: jest.fn(),
}))

const mockUseSession = useSession as jest.Mock
const mockSignOut = signOut as jest.Mock

describe('Header', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the logo', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })

    render(<Header />)

    expect(screen.getByText('Csaas')).toBeInTheDocument()
  })

  it('renders user information when authenticated', () => {
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
        },
      },
      status: 'authenticated',
    })

    render(<Header />)

    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByText('企业PM')).toBeInTheDocument()
  })

  it('opens user menu when clicked', () => {
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

    render(<Header />)

    const userButton = screen.getByText('Test User').closest('div[role="button"]') ||
                       screen.getByText('Test User').parentElement?.parentElement
    fireEvent.click(userButton!)

    expect(screen.getByText('个人信息')).toBeInTheDocument()
    expect(screen.getByText('设置')).toBeInTheDocument()
    expect(screen.getByText('退出登录')).toBeInTheDocument()
  })

  it('calls signOut when logout is clicked', async () => {
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

    render(<Header />)

    const userButton = screen.getByText('Test User').closest('div[role="button"]') ||
                       screen.getByText('Test User').parentElement?.parentElement
    fireEvent.click(userButton!)

    const logoutButton = await screen.findByText('退出登录')
    fireEvent.click(logoutButton)

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
          },
        },
        status: 'authenticated',
      })

      const { unmount } = render(<Header />)
      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    })
  })

  it('has correct AppBar styling', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })

    render(<Header />)

    const appBar = screen.getByRole('banner')
    expect(appBar).toBeInTheDocument()
  })
})
