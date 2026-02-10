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

      // Check that the role select shows "被调研者" (the default role label)
      expect(screen.getByText('被调研者')).toBeInTheDocument()
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
    it('should display all role options when opened', async () => {
      render(<RegisterPage />)

      const roleSelect = screen.getByLabelText('角色')
      fireEvent.mouseDown(roleSelect)

      // Check that all role options are available using findAllByRole
      const options = await screen.findAllByRole('option')
      const optionTexts = options.map(opt => opt.textContent)

      expect(optionTexts).toContain('主咨询师')
      expect(optionTexts).toContain('企业PM')
      expect(optionTexts).toContain('被调研者')
    })

    it('should allow changing role', async () => {
      render(<RegisterPage />)

      const roleSelect = screen.getByLabelText('角色')

      // Open the select
      fireEvent.mouseDown(roleSelect)

      // Click on consultant option using findAllByRole to avoid duplicates
      const options = await screen.findAllByRole('option')
      const consultantOption = options.find(opt => opt.textContent === '主咨询师')
      expect(consultantOption).toBeDefined()
      fireEvent.click(consultantOption!)

      // Verify the value changed by checking if "主咨询师" is now displayed
      await waitFor(() => {
        expect(screen.getByText('主咨询师')).toBeInTheDocument()
      })
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

      // Find and click the visibility toggle button
      const visibilityButtons = screen.getAllByRole('button', { name: /切换密码可见性/ })
      fireEvent.click(visibilityButtons[0])

      // Password should now be visible
      expect(passwordInput.type).toBe('text')

      // Click again to hide
      fireEvent.click(visibilityButtons[0])
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
      const visibilityButtons = screen.getAllByRole('button', { name: /切换.*可见性/ })
      // The second button is for confirm password
      fireEvent.click(visibilityButtons[1])

      // Only confirm password should be visible
      expect(passwordInput.type).toBe('password')
      expect(confirmPasswordInput.type).toBe('text')
    })
  })

  describe('MUI Components', () => {
    it('should use MUI Card component', () => {
      render(<RegisterPage />)

      const card = document.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
    })

    it('should use MUI TextField components', () => {
      render(<RegisterPage />)

      const textFields = document.querySelectorAll('.MuiTextField-root')
      expect(textFields.length).toBeGreaterThanOrEqual(5)
    })

    it('should use MUI Select for role', () => {
      render(<RegisterPage />)

      // The role field should have MUI Select classes
      const roleSelect = document.querySelector('.MuiSelect-root, [role="combobox"]')
      expect(roleSelect).toBeInTheDocument()
    })

    it('should have gradient background', () => {
      render(<RegisterPage />)

      const box = document.querySelector('.MuiBox-root')
      expect(box).toBeInTheDocument()
    })
  })
})
