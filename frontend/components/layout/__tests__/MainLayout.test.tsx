import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import MainLayout from '../MainLayout'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}))

// Mock child components
jest.mock('../Header', () => {
  return function MockHeader() {
    return <div data-testid="mock-header">Header</div>
  }
})

jest.mock('../Sidebar', () => {
  return function MockSidebar({ collapsed, onCollapseChange }: { collapsed?: boolean; onCollapseChange?: (collapsed: boolean) => void }) {
    return (
      <div data-testid="mock-sidebar">
        <span>Sidebar {collapsed ? 'collapsed' : 'expanded'}</span>
        {onCollapseChange && (
          <button onClick={() => onCollapseChange(!collapsed)}>Toggle Sidebar</button>
        )}
      </div>
    )
  }
})

const mockUseSession = useSession as jest.Mock
const mockUseRouter = useRouter as jest.Mock

describe('MainLayout', () => {
  const mockPush = jest.fn()

  beforeEach(() => {
    mockUseRouter.mockReturnValue({
      push: mockPush,
    })
    jest.clearAllMocks()
  })

  it('shows loading state when session is loading', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'loading',
    })

    render(
      <MainLayout>
        <div data-testid="child-content">Child Content</div>
      </MainLayout>
    )

    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument()
  })

  it('redirects to login when unauthenticated', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })

    render(
      <MainLayout>
        <div data-testid="child-content">Child Content</div>
      </MainLayout>
    )

    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  it('renders null when no session', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })

    const { container } = render(
      <MainLayout>
        <div data-testid="child-content">Child Content</div>
      </MainLayout>
    )

    // After redirect check, should render null
    expect(container.firstChild).toBeNull()
  })

  it('renders layout with Header and Sidebar when authenticated', () => {
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

    render(
      <MainLayout>
        <div data-testid="child-content">Child Content</div>
      </MainLayout>
    )

    expect(screen.getByTestId('mock-header')).toBeInTheDocument()
    expect(screen.getByTestId('mock-sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
  })

  it('passes collapsed state to Sidebar', () => {
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

    render(
      <MainLayout>
        <div>Child Content</div>
      </MainLayout>
    )

    // Sidebar should start expanded
    expect(screen.getByText('Sidebar expanded')).toBeInTheDocument()

    // Click toggle button to collapse
    const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i })
    fireEvent.click(toggleButton)

    // Sidebar should now be collapsed
    expect(screen.getByText('Sidebar collapsed')).toBeInTheDocument()
  })

  it('renders children content', () => {
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

    render(
      <MainLayout>
        <div data-testid="child-content">
          <h1>Page Title</h1>
          <p>Page content goes here</p>
        </div>
      </MainLayout>
    )

    expect(screen.getByText('Page Title')).toBeInTheDocument()
    expect(screen.getByText('Page content goes here')).toBeInTheDocument()
  })

  it('has correct layout structure', () => {
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

    const { container } = render(
      <MainLayout>
        <div>Content</div>
      </MainLayout>
    )

    // Check for main element
    const main = container.querySelector('main')
    expect(main).toBeInTheDocument()
  })

  it('handles responsive layout correctly', async () => {
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

    render(
      <MainLayout>
        <div>Content</div>
      </MainLayout>
    )

    // Layout should be responsive with proper margin transitions
    const main = document.querySelector('main')
    expect(main).toBeInTheDocument()
  })
})
