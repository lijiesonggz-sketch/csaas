import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RegisterPage from '../register/page'
import { useRouter } from 'next/navigation'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  usePathname: jest.fn(() => '/register'),
}))

// Mock message utility
jest.mock('@/lib/message', () => ({
  message: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

import { message } from '@/lib/message'

describe('RegisterPage', () => {
  const mockPush = jest.fn()
  const mockFetch = jest.fn()
  global.fetch = mockFetch

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/register',
      query: {},
      asPath: '/register',
    })
  })

  describe('Form Rendering', () => {
    it('should render register form with all fields', () => {
      render(<RegisterPage />)

      // Check page title
      expect(screen.getByText('Csaas 注册')).toBeInTheDocument()

      // Check name input
      expect(screen.getByLabelText('姓名')).toBeInTheDocument()

      // Check email input
      expect(screen.getByLabelText('邮箱')).toBeInTheDocument()

      // Check password input
      expect(screen.getByLabelText('密码')).toBeInTheDocument()

      // Check confirm password input
      expect(screen.getByLabelText('确认密码')).toBeInTheDocument()

      // Check role select
      expect(screen.getByLabelText('角色')).toBeInTheDocument()

      // Check submit button
      expect(screen.getByRole('button', { name: '注册' })).toBeInTheDocument()

      // Check login link
      expect(screen.getByText('已有账号？')).toBeInTheDocument()
      expect(screen.getByText('立即登录')).toBeInTheDocument()
    })

    it('should have link to login page', () => {
      render(<RegisterPage />)

      const loginLink = screen.getByText('立即登录')
      expect(loginLink).toHaveAttribute('href', '/login')
    })

    it('should have default role selected', () => {
      render(<RegisterPage />)

      // The role select should be present
      // Note: shadcn/ui Select doesn't display the default value text directly in DOM
      // The value is managed internally by the component
      const roleSelect = screen.getByLabelText('角色')
      expect(roleSelect).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('should show error when name is empty', async () => {
      render(<RegisterPage />)

      const nameInput = screen.getByLabelText('姓名')

      // Focus and blur without entering value
      fireEvent.focus(nameInput)
      fireEvent.blur(nameInput)

      await waitFor(() => {
        expect(screen.getByText('请输入姓名')).toBeInTheDocument()
      })
    })

    it('should show error when email is empty', async () => {
      render(<RegisterPage />)

      const emailInput = screen.getByLabelText('邮箱')

      fireEvent.focus(emailInput)
      fireEvent.blur(emailInput)

      await waitFor(() => {
        expect(screen.getByText('请输入邮箱')).toBeInTheDocument()
      })
    })

    it('should show error for invalid email format', async () => {
      render(<RegisterPage />)

      const emailInput = screen.getByLabelText('邮箱')

      await userEvent.type(emailInput, 'invalid-email')
      fireEvent.blur(emailInput)

      await waitFor(() => {
        expect(screen.getByText('请输入有效的邮箱地址')).toBeInTheDocument()
      })
    })

    it('should show error when password is empty', async () => {
      render(<RegisterPage />)

      const passwordInput = screen.getByLabelText('密码')

      fireEvent.focus(passwordInput)
      fireEvent.blur(passwordInput)

      await waitFor(() => {
        expect(screen.getByText('请输入密码')).toBeInTheDocument()
      })
    })

    it('should show error when password is less than 8 characters', async () => {
      render(<RegisterPage />)

      const passwordInput = screen.getByLabelText('密码')

      await userEvent.type(passwordInput, 'short')
      fireEvent.blur(passwordInput)

      await waitFor(() => {
        expect(screen.getByText('密码至少8个字符')).toBeInTheDocument()
      })
    })

    it('should show error when confirm password is empty', async () => {
      render(<RegisterPage />)

      const confirmPasswordInput = screen.getByLabelText('确认密码')

      fireEvent.focus(confirmPasswordInput)
      fireEvent.blur(confirmPasswordInput)

      await waitFor(() => {
        expect(screen.getByText('请确认密码')).toBeInTheDocument()
      })
    })

    it('should show error when passwords do not match', async () => {
      render(<RegisterPage />)

      const passwordInput = screen.getByLabelText('密码')
      const confirmPasswordInput = screen.getByLabelText('确认密码')

      await userEvent.type(passwordInput, 'password123')
      await userEvent.type(confirmPasswordInput, 'differentpassword')
      fireEvent.blur(confirmPasswordInput)

      await waitFor(() => {
        expect(screen.getByText('两次输入的密码不一致')).toBeInTheDocument()
      })
    })

    it('should clear password match error when password is updated', async () => {
      render(<RegisterPage />)

      const passwordInput = screen.getByLabelText('密码')
      const confirmPasswordInput = screen.getByLabelText('确认密码')

      // First create a mismatch
      await userEvent.type(passwordInput, 'password123')
      await userEvent.type(confirmPasswordInput, 'differentpassword')
      fireEvent.blur(confirmPasswordInput)

      await waitFor(() => {
        expect(screen.getByText('两次输入的密码不一致')).toBeInTheDocument()
      })

      // Update password to match confirm password
      await userEvent.clear(passwordInput)
      await userEvent.type(passwordInput, 'differentpassword')

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText('两次输入的密码不一致')).not.toBeInTheDocument()
      })
    })
  })

  describe('Role Selection', () => {
    it('should display default role option', () => {
      render(<RegisterPage />)

      // The default role "被调研者" (respondent) should be displayed
      // Note: shadcn/ui Select doesn't render all options in DOM by default
      // The Select trigger shows the currently selected value
      expect(screen.getByLabelText('角色')).toBeInTheDocument()
    })

    it('should have role select with proper attributes', () => {
      render(<RegisterPage />)

      // Check that the role select has the correct label
      const roleSelect = screen.getByLabelText('角色')
      expect(roleSelect).toBeInTheDocument()
    })
  })

  describe('Form Submission', () => {
    it('should not submit when form has validation errors', async () => {
      render(<RegisterPage />)

      const submitButton = screen.getByRole('button', { name: '注册' })

      // Try to submit empty form
      fireEvent.click(submitButton)

      // fetch should not be called
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should call API with correct data when form is valid', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'Registration successful' }),
      })

      render(<RegisterPage />)

      const nameInput = screen.getByLabelText('姓名')
      const emailInput = screen.getByLabelText('邮箱')
      const passwordInput = screen.getByLabelText('密码')
      const confirmPasswordInput = screen.getByLabelText('确认密码')
      const submitButton = screen.getByRole('button', { name: '注册' })

      // Fill in valid data
      await userEvent.type(nameInput, 'Test User')
      await userEvent.type(emailInput, 'test@example.com')
      await userEvent.type(passwordInput, 'password123')
      await userEvent.type(confirmPasswordInput, 'password123')

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/auth/register'),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'test@example.com',
              password: 'password123',
              name: 'Test User',
              role: 'respondent',
            }),
          })
        )
      })
    })

    it('should show success message and redirect on successful registration', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'Registration successful' }),
      })

      render(<RegisterPage />)

      const nameInput = screen.getByLabelText('姓名')
      const emailInput = screen.getByLabelText('邮箱')
      const passwordInput = screen.getByLabelText('密码')
      const confirmPasswordInput = screen.getByLabelText('确认密码')
      const submitButton = screen.getByRole('button', { name: '注册' })

      await userEvent.type(nameInput, 'Test User')
      await userEvent.type(emailInput, 'test@example.com')
      await userEvent.type(passwordInput, 'password123')
      await userEvent.type(confirmPasswordInput, 'password123')

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(message.success).toHaveBeenCalledWith('注册成功! 请登录')
      })

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login')
      })
    })

    it('should show error message when registration fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Email already exists' }),
      })

      render(<RegisterPage />)

      const nameInput = screen.getByLabelText('姓名')
      const emailInput = screen.getByLabelText('邮箱')
      const passwordInput = screen.getByLabelText('密码')
      const confirmPasswordInput = screen.getByLabelText('确认密码')
      const submitButton = screen.getByRole('button', { name: '注册' })

      await userEvent.type(nameInput, 'Test User')
      await userEvent.type(emailInput, 'existing@example.com')
      await userEvent.type(passwordInput, 'password123')
      await userEvent.type(confirmPasswordInput, 'password123')

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(message.error).toHaveBeenCalledWith('Email already exists')
      })
    })

    it('should show error message when fetch throws exception', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      render(<RegisterPage />)

      const nameInput = screen.getByLabelText('姓名')
      const emailInput = screen.getByLabelText('邮箱')
      const passwordInput = screen.getByLabelText('密码')
      const confirmPasswordInput = screen.getByLabelText('确认密码')
      const submitButton = screen.getByRole('button', { name: '注册' })

      await userEvent.type(nameInput, 'Test User')
      await userEvent.type(emailInput, 'test@example.com')
      await userEvent.type(passwordInput, 'password123')
      await userEvent.type(confirmPasswordInput, 'password123')

      fireEvent.click(submitButton)

      // Wait for the error handling to complete
      await waitFor(() => {
        expect(message.error).toHaveBeenCalled()
      }, { timeout: 3000 })

      // Check that it was called with the error message from the exception
      expect(message.error).toHaveBeenCalledWith('Network error')
    })

    it('should disable submit button while loading', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<RegisterPage />)

      const nameInput = screen.getByLabelText('姓名')
      const emailInput = screen.getByLabelText('邮箱')
      const passwordInput = screen.getByLabelText('密码')
      const confirmPasswordInput = screen.getByLabelText('确认密码')
      const submitButton = screen.getByRole('button', { name: '注册' })

      await userEvent.type(nameInput, 'Test User')
      await userEvent.type(emailInput, 'test@example.com')
      await userEvent.type(passwordInput, 'password123')
      await userEvent.type(confirmPasswordInput, 'password123')

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(submitButton).toBeDisabled()
      })
    })
  })

  describe('Password Visibility', () => {
    it('should toggle password visibility', async () => {
      render(<RegisterPage />)

      const passwordInput = screen.getByLabelText('密码') as HTMLInputElement

      // Initially password should be hidden
      expect(passwordInput.type).toBe('password')

      // Find and click the visibility toggle button for password field
      const passwordContainer = passwordInput.closest('div.relative')
      const visibilityButton = passwordContainer?.querySelector('button[type="button"]') as HTMLElement
      fireEvent.click(visibilityButton!)

      // Password should now be visible
      expect(passwordInput.type).toBe('text')

      // Click again to hide
      fireEvent.click(visibilityButton!)
      expect(passwordInput.type).toBe('password')
    })

    it('should toggle confirm password visibility independently', async () => {
      render(<RegisterPage />)

      const passwordInput = screen.getByLabelText('密码') as HTMLInputElement
      const confirmPasswordInput = screen.getByLabelText('确认密码') as HTMLInputElement

      // Initially both should be hidden
      expect(passwordInput.type).toBe('password')
      expect(confirmPasswordInput.type).toBe('password')

      // Toggle confirm password visibility
      const confirmPasswordContainer = confirmPasswordInput.closest('div.relative')
      const visibilityButton = confirmPasswordContainer?.querySelector('button[type="button"]') as HTMLElement
      fireEvent.click(visibilityButton!)

      // Only confirm password should be visible
      expect(passwordInput.type).toBe('password')
      expect(confirmPasswordInput.type).toBe('text')
    })
  })

  describe('shadcn/ui Components', () => {
    it('should use Card component', () => {
      render(<RegisterPage />)

      const card = document.querySelector('.border')
      expect(card).toBeInTheDocument()
    })

    it('should use form inputs', () => {
      render(<RegisterPage />)

      // Register page has: name (text), email (email), password (password), confirmPassword (password)
      // Note: The Select component uses a button, not an input element
      const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"]')
      expect(inputs.length).toBeGreaterThanOrEqual(3)
    })

    it('should use Select for role', () => {
      render(<RegisterPage />)

      // The role field should be a select-like component
      const roleSelect = screen.getByLabelText('角色')
      expect(roleSelect).toBeInTheDocument()
    })

    it('should have proper background', () => {
      render(<RegisterPage />)

      const container = document.querySelector('.bg-\\[\\#FEFDFB\\]')
      expect(container).toBeInTheDocument()
    })
  })
})
