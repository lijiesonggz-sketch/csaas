import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '../login/page'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  usePathname: jest.fn(() => '/login'),
}))

// Mock message utility
jest.mock('@/lib/message', () => ({
  message: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

import { message } from '@/lib/message'

describe('LoginPage', () => {
  const mockPush = jest.fn()
  const mockSignIn = signIn as jest.MockedFunction<typeof signIn>

  beforeEach(() => {
    jest.clearAllMocks()
    window.history.replaceState({}, '', '/login')
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/login',
      query: {},
      asPath: '/login',
    })
  })

  describe('Form Rendering', () => {
    it('should render login form with all fields', () => {
      render(<LoginPage />)

      // Check page title
      expect(screen.getByText('欢迎回来')).toBeInTheDocument()

      // Check email input
      expect(screen.getByLabelText('邮箱')).toBeInTheDocument()

      // Check password input
      expect(screen.getByLabelText('密码')).toBeInTheDocument()

      // Check submit button
      expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument()

      // Check register link
      expect(screen.getByText('还没有账号？')).toBeInTheDocument()
      expect(screen.getByText('立即注册')).toBeInTheDocument()
    })

    it('should have link to register page', () => {
      render(<LoginPage />)

      const registerLink = screen.getByText('立即注册')
      expect(registerLink).toHaveAttribute('href', '/register')
    })

    it('should remove credential query params without prefilling the form', async () => {
      window.history.replaceState(
        {},
        '',
        '/login?email=admin%40test.com&password=admin123&callbackUrl=%2Fdashboard'
      )

      render(<LoginPage />)

      await waitFor(() => {
        expect(window.location.search).toBe('?callbackUrl=%2Fdashboard')
      })

      expect(screen.getByLabelText('邮箱')).toHaveValue('')
      expect(screen.getByLabelText('密码')).toHaveValue('')
    })
  })

  describe('Form Validation', () => {
    it('should show error when email is empty', async () => {
      render(<LoginPage />)

      const emailInput = screen.getByLabelText('邮箱')
      const submitButton = screen.getByRole('button', { name: '登录' })

      // Focus and blur without entering value
      fireEvent.focus(emailInput)
      fireEvent.blur(emailInput)

      await waitFor(() => {
        expect(screen.getByText('请输入邮箱')).toBeInTheDocument()
      })

      // Try to submit
      fireEvent.click(submitButton)

      // signIn should not be called
      expect(mockSignIn).not.toHaveBeenCalled()
    })

    it('should show error when email format is invalid', async () => {
      render(<LoginPage />)

      const emailInput = screen.getByLabelText('邮箱')

      // Enter invalid email
      await userEvent.type(emailInput, 'invalid-email')
      fireEvent.blur(emailInput)

      await waitFor(() => {
        expect(screen.getByText('请输入有效的邮箱地址')).toBeInTheDocument()
      })
    })

    it('should show error when password is empty', async () => {
      render(<LoginPage />)

      const passwordInput = screen.getByLabelText('密码')
      const submitButton = screen.getByRole('button', { name: '登录' })

      // Focus and blur without entering value
      fireEvent.focus(passwordInput)
      fireEvent.blur(passwordInput)

      await waitFor(() => {
        expect(screen.getByText('请输入密码')).toBeInTheDocument()
      })

      // Try to submit
      fireEvent.click(submitButton)

      // signIn should not be called
      expect(mockSignIn).not.toHaveBeenCalled()
    })

    it('should clear error when valid email is entered', async () => {
      render(<LoginPage />)

      const emailInput = screen.getByLabelText('邮箱')

      // Enter invalid email and blur
      await userEvent.type(emailInput, 'invalid')
      fireEvent.blur(emailInput)

      await waitFor(() => {
        expect(screen.getByText('请输入有效的邮箱地址')).toBeInTheDocument()
      })

      // Clear and enter valid email
      await userEvent.clear(emailInput)
      await userEvent.type(emailInput, 'test@example.com')

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText('请输入有效的邮箱地址')).not.toBeInTheDocument()
      })
    })
  })

  describe('Form Submission', () => {
    it('should call signIn with credentials when form is valid', async () => {
      mockSignIn.mockResolvedValue({ ok: true, error: null, url: null, status: 200 })

      render(<LoginPage />)

      const emailInput = screen.getByLabelText('邮箱')
      const passwordInput = screen.getByLabelText('密码')
      const submitButton = screen.getByRole('button', { name: '登录' })

      // Fill in valid credentials
      await userEvent.type(emailInput, 'test@example.com')
      await userEvent.type(passwordInput, 'password123')

      // Submit form
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('credentials', {
          email: 'test@example.com',
          password: 'password123',
          redirect: false,
        })
      })
    })

    it('should show success message and redirect on successful login', async () => {
      mockSignIn.mockResolvedValue({ ok: true, error: null, url: null, status: 200 })

      render(<LoginPage />)

      const emailInput = screen.getByLabelText('邮箱')
      const passwordInput = screen.getByLabelText('密码')
      const submitButton = screen.getByRole('button', { name: '登录' })

      await userEvent.type(emailInput, 'test@example.com')
      await userEvent.type(passwordInput, 'password123')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(message.success).toHaveBeenCalledWith('登录成功!')
      })

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })

    it('should show error message when login fails', async () => {
      mockSignIn.mockResolvedValue({
        ok: false,
        error: 'Invalid credentials',
        url: null,
        status: 401,
      })

      render(<LoginPage />)

      const emailInput = screen.getByLabelText('邮箱')
      const passwordInput = screen.getByLabelText('密码')
      const submitButton = screen.getByRole('button', { name: '登录' })

      await userEvent.type(emailInput, 'test@example.com')
      await userEvent.type(passwordInput, 'wrongpassword')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
      })
    })

    it('should show error message when signIn throws exception', async () => {
      mockSignIn.mockRejectedValue(new Error('Network error'))

      render(<LoginPage />)

      const emailInput = screen.getByLabelText('邮箱')
      const passwordInput = screen.getByLabelText('密码')
      const submitButton = screen.getByRole('button', { name: '登录' })

      await userEvent.type(emailInput, 'test@example.com')
      await userEvent.type(passwordInput, 'password123')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('登录失败，请重试')).toBeInTheDocument()
      })
    })

    it('should disable submit button while loading', async () => {
      mockSignIn.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<LoginPage />)

      const emailInput = screen.getByLabelText('邮箱')
      const passwordInput = screen.getByLabelText('密码')
      const submitButton = screen.getByRole('button', { name: '登录' })

      await userEvent.type(emailInput, 'test@example.com')
      await userEvent.type(passwordInput, 'password123')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(submitButton).toBeDisabled()
      })
    })
  })

  describe('Password Visibility', () => {
    it('should toggle password visibility when clicking visibility button', async () => {
      render(<LoginPage />)

      const passwordInput = screen.getByLabelText('密码') as HTMLInputElement

      // Initially password should be hidden
      expect(passwordInput.type).toBe('password')

      // Find and click the visibility toggle button
      const visibilityButton = screen
        .getByRole('button', { name: '' })
        .closest('div.relative')
        ?.querySelector('button[type="button"]') as HTMLElement
      fireEvent.click(visibilityButton)

      // Password should now be visible
      expect(passwordInput.type).toBe('text')

      // Click again to hide
      fireEvent.click(visibilityButton)
      expect(passwordInput.type).toBe('password')
    })
  })

  describe('shadcn/ui Components', () => {
    it('should use Card component', () => {
      render(<LoginPage />)

      // Card should be present
      const card = document.querySelector('.border')
      expect(card).toBeInTheDocument()
    })

    it('should have form inputs', () => {
      render(<LoginPage />)

      // Inputs should be present
      const inputs = document.querySelectorAll('input[type="email"], input[type="password"]')
      expect(inputs.length).toBeGreaterThanOrEqual(2)
    })

    it('should have proper background', () => {
      render(<LoginPage />)

      // The outer div should have background
      const container = document.querySelector('.bg-\\[\\#FEFDFB\\]')
      expect(container).toBeInTheDocument()
    })
  })
})
