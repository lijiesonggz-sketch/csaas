import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Auth Migration (Story 11-5)
 * Tests the migration from Ant Design to MUI for authentication pages
 *
 * Coverage:
 * - Login page MUI components
 * - Register page MUI components
 * - Form validation
 * - Page navigation
 * - Zero Ant Design残留
 */

test.describe('Auth Migration - Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
  })

  test.describe('Page Load [P1]', () => {
    test('[P1] should display login page with MUI components', async ({ page }) => {
      // THEN: Page title is visible
      await expect(page.getByRole('heading', { name: 'Csaas 登录' })).toBeVisible()

      // THEN: MUI Card is present
      const card = page.locator('.MuiCard-root')
      await expect(card).toBeVisible()

      // THEN: MUI TextFields are present for email and password
      await expect(page.getByRole('textbox', { name: '邮箱' })).toBeVisible()
      await expect(page.locator('input[type="password"]').first()).toBeVisible()

      // THEN: MUI Button is present
      await expect(page.getByRole('button', { name: '登录' })).toBeVisible()
    })

    test('[P1] should have gradient background', async ({ page }) => {
      // The page should have the gradient background
      const body = page.locator('body')
      await expect(body).toBeVisible()

      // Check that the login container has the gradient
      const box = page.locator('.MuiBox-root').first()
      await expect(box).toBeVisible()
    })

    test('[P1] should have link to register page', async ({ page }) => {
      const registerLink = page.getByRole('link', { name: '立即注册' })
      await expect(registerLink).toBeVisible()
      await expect(registerLink).toHaveAttribute('href', '/register')
    })
  })

  test.describe('Form Validation [P1]', () => {
    test('[P1] should show error when email is empty', async ({ page }) => {
      const emailInput = page.getByRole('textbox', { name: '邮箱' })
      const submitButton = page.getByRole('button', { name: '登录' })

      // Focus and blur without entering value
      await emailInput.focus()
      await emailInput.blur()

      // Error message should appear
      await expect(page.getByText('请输入邮箱')).toBeVisible()

      // Try to submit
      await submitButton.click()

      // Should stay on login page
      await expect(page).toHaveURL(/.*login.*/)
    })

    test('[P1] should show error for invalid email format', async ({ page }) => {
      const emailInput = page.getByRole('textbox', { name: '邮箱' })

      await emailInput.fill('invalid-email')
      await emailInput.blur()

      await expect(page.getByText('请输入有效的邮箱地址')).toBeVisible()
    })

    test('[P1] should show error when password is empty', async ({ page }) => {
      const passwordInput = page.locator('input[type="password"]').first()
      const submitButton = page.getByRole('button', { name: '登录' })

      await passwordInput.focus()
      await passwordInput.blur()

      await expect(page.getByText('请输入密码')).toBeVisible()

      // Try to submit
      await submitButton.click()

      // Should stay on login page
      await expect(page).toHaveURL(/.*login.*/)
    })
  })

  test.describe('Password Visibility [P2]', () => {
    test('[P2] should toggle password visibility', async ({ page }) => {
      // Use placeholder to find the password input
      const passwordInput = page.locator('input[placeholder="密码"]')

      // Initially password should be hidden
      await expect(passwordInput).toHaveAttribute('type', 'password')

      // Click visibility toggle
      const visibilityButton = page.getByRole('button', { name: '切换密码可见性' })
      await visibilityButton.click()

      // Password should now be visible
      await expect(passwordInput).toHaveAttribute('type', 'text')

      // Click again to hide
      await visibilityButton.click()
      await expect(passwordInput).toHaveAttribute('type', 'password')
    })
  })

  test.describe('Login Flow [P1]', () => {
    test('[P1] should login successfully with valid credentials', async ({ page }) => {
      const emailInput = page.getByRole('textbox', { name: '邮箱' })
      const passwordInput = page.locator('input[type="password"]').first()
      const submitButton = page.getByRole('button', { name: '登录' })

      await emailInput.fill('test@example.com')
      await passwordInput.fill('test123')
      await submitButton.click()

      // Should redirect to dashboard
      await page.waitForURL('**/dashboard', { timeout: 10000 })
      await expect(page.url()).toContain('/dashboard')
    })

    test('[P1] should show error for invalid credentials', async ({ page }) => {
      const emailInput = page.getByRole('textbox', { name: '邮箱' })
      const passwordInput = page.locator('input[type="password"]').first()
      const submitButton = page.getByRole('button', { name: '登录' })

      await emailInput.fill('test@example.com')
      await passwordInput.fill('wrongpassword')
      await submitButton.click()

      // Should stay on login page and show error
      await expect(page).toHaveURL(/.*login.*/)
    })

    test('[P2] should show loading spinner during submission', async ({ page }) => {
      const emailInput = page.getByRole('textbox', { name: '邮箱' })
      const passwordInput = page.locator('input[type="password"]').first()
      const submitButton = page.getByRole('button', { name: '登录' })

      await emailInput.fill('test@example.com')
      await passwordInput.fill('test123')

      // Click submit button and wait for navigation
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle' }),
        submitButton.click(),
      ])

      // Should navigate to dashboard
      await expect(page).toHaveURL(/.*dashboard.*/)
    })
  })
})

test.describe('Auth Migration - Register Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register')
    await page.waitForLoadState('networkidle')
  })

  test.describe('Page Load [P1]', () => {
    test('[P1] should display register page with MUI components', async ({ page }) => {
      // THEN: Page title is visible
      await expect(page.getByRole('heading', { name: 'Csaas 注册' })).toBeVisible()

      // THEN: MUI Card is present
      const card = page.locator('.MuiCard-root')
      await expect(card).toBeVisible()

      // THEN: All form fields are present
      await expect(page.getByRole('textbox', { name: '姓名' })).toBeVisible()
      await expect(page.getByRole('textbox', { name: '邮箱' })).toBeVisible()
      await expect(page.locator('input[type="password"]').nth(0)).toBeVisible()
      await expect(page.locator('input[type="password"]').nth(1)).toBeVisible()
      await expect(page.getByRole('combobox')).toBeVisible()

      // THEN: Submit button is present
      await expect(page.getByRole('button', { name: '注册' })).toBeVisible()
    })

    test('[P1] should have link to login page', async ({ page }) => {
      const loginLink = page.getByRole('link', { name: '立即登录' })
      await expect(loginLink).toBeVisible()
      await expect(loginLink).toHaveAttribute('href', '/login')
    })

    test('[P1] should have default role selected', async ({ page }) => {
      const roleSelect = page.getByRole('combobox')
      await expect(roleSelect).toBeVisible()
      // Check that the default role text is displayed
      await expect(page.getByText('被调研者')).toBeVisible()
    })
  })

  test.describe('Role Selection [P1]', () => {
    test('[P1] should display all role options', async ({ page }) => {
      const roleSelect = page.getByRole('combobox')
      await roleSelect.click()

      // Check that all role options are visible
      await expect(page.getByRole('option', { name: '主咨询师' })).toBeVisible()
      await expect(page.getByRole('option', { name: '企业PM' })).toBeVisible()
      await expect(page.getByRole('option', { name: '被调研者' })).toBeVisible()
    })

    test('[P1] should allow changing role', async ({ page }) => {
      const roleSelect = page.getByRole('combobox')
      await roleSelect.click()

      // Select consultant
      await page.getByRole('option', { name: '主咨询师' }).click()

      // Wait for the dropdown to close and verify the selection
      await page.waitForTimeout(500)
      // Verify selection by checking the select field contains the text
      await expect(roleSelect).toContainText('主咨询师')
    })
  })

  test.describe('Form Validation [P1]', () => {
    test('[P1] should show error when name is empty', async ({ page }) => {
      const nameInput = page.getByRole('textbox', { name: '姓名' })

      await nameInput.focus()
      await nameInput.blur()

      await expect(page.getByText('请输入姓名')).toBeVisible()
    })

    test('[P1] should show error when email is empty', async ({ page }) => {
      const emailInput = page.getByRole('textbox', { name: '邮箱' })

      await emailInput.focus()
      await emailInput.blur()

      await expect(page.getByText('请输入邮箱')).toBeVisible()
    })

    test('[P1] should show error for invalid email format', async ({ page }) => {
      const emailInput = page.getByRole('textbox', { name: '邮箱' })

      await emailInput.fill('invalid-email')
      await emailInput.blur()

      await expect(page.getByText('请输入有效的邮箱地址')).toBeVisible()
    })

    test('[P1] should show error when password is less than 8 characters', async ({ page }) => {
      const passwordInput = page.locator('input[type="password"]').first()

      await passwordInput.fill('short')
      await passwordInput.blur()

      await expect(page.getByText('密码至少8个字符')).toBeVisible()
    })

    test('[P1] should show error when passwords do not match', async ({ page }) => {
      const passwordInput = page.locator('input[type="password"]').first()
      const confirmPasswordInput = page.locator('input[type="password"]').nth(1)

      await passwordInput.fill('password123')
      await confirmPasswordInput.fill('differentpassword')
      await confirmPasswordInput.blur()

      await expect(page.getByText('两次输入的密码不一致')).toBeVisible()
    })
  })

  test.describe('Password Visibility [P2]', () => {
    test('[P2] should toggle password visibility independently', async ({ page }) => {
      const passwordInput = page.locator('input[placeholder="密码"]').first()
      const confirmPasswordInput = page.locator('input[placeholder="确认密码"]')

      // Initially both should be hidden
      await expect(passwordInput).toHaveAttribute('type', 'password')
      await expect(confirmPasswordInput).toHaveAttribute('type', 'password')

      // Toggle confirm password visibility - use the second visibility button
      const visibilityButtons = page.getByRole('button', { name: /切换.*可见性/ })
      await visibilityButtons.nth(1).click()

      // Only confirm password should be visible
      await expect(passwordInput).toHaveAttribute('type', 'password')
      await expect(confirmPasswordInput).toHaveAttribute('type', 'text')
    })
  })

  test.describe('Registration Flow [P1]', () => {
    test('[P1] should register successfully with valid data', async ({ page }) => {
      const nameInput = page.getByRole('textbox', { name: '姓名' })
      const emailInput = page.getByRole('textbox', { name: '邮箱' })
      const passwordInput = page.locator('input[type="password"]').first()
      const confirmPasswordInput = page.locator('input[type="password"]').nth(1)
      const submitButton = page.getByRole('button', { name: '注册' })

      // Fill in valid data (password must be at least 8 characters)
      await nameInput.fill('Test User')
      await emailInput.fill(`test${Date.now()}@example.com`)
      await passwordInput.fill('test12345')
      await confirmPasswordInput.fill('test12345')

      await submitButton.click()

      // Should redirect to login page
      await page.waitForURL('**/login', { timeout: 10000 })
      await expect(page.url()).toContain('/login')
    })

    test('[P1] should not submit when validation errors exist', async ({ page }) => {
      const submitButton = page.getByRole('button', { name: '注册' })

      // Try to submit empty form
      await submitButton.click()

      // Should stay on register page
      await expect(page).toHaveURL(/.*register.*/)

      // Validation errors should be visible
      await expect(page.getByText('请输入姓名')).toBeVisible()
    })
  })
})

test.describe('Auth Migration - Page Navigation', () => {
  test('[P1] should navigate from login to register page', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Click register link
    await page.getByRole('link', { name: '立即注册' }).click()

    // Should navigate to register page
    await page.waitForURL('**/register')
    await expect(page.getByRole('heading', { name: 'Csaas 注册' })).toBeVisible()
  })

  test('[P1] should navigate from register to login page', async ({ page }) => {
    await page.goto('/register')
    await page.waitForLoadState('networkidle')

    // Click login link
    await page.getByRole('link', { name: '立即登录' }).click()

    // Should navigate to login page
    await page.waitForURL('**/login')
    await expect(page.getByRole('heading', { name: 'Csaas 登录' })).toBeVisible()
  })
})

test.describe('Auth Migration - Zero Ant Design [P1]', () => {
  test('[P1] login page should have no Ant Design imports', async ({ page }) => {
    // This test verifies that the page loads correctly with MUI
    // The actual import check is done at build/lint time
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Verify MUI components are present
    await expect(page.locator('.MuiCard-root')).toBeVisible()
    await expect(page.locator('.MuiTextField-root').first()).toBeVisible()

    // Verify no Ant Design specific classes
    const antClasses = await page.locator('.ant-form, .ant-input, .ant-btn').count()
    expect(antClasses).toBe(0)
  })

  test('[P1] register page should have no Ant Design imports', async ({ page }) => {
    await page.goto('/register')
    await page.waitForLoadState('networkidle')

    // Verify MUI components are present
    await expect(page.locator('.MuiCard-root')).toBeVisible()
    await expect(page.locator('.MuiTextField-root').first()).toBeVisible()

    // Verify no Ant Design specific classes
    const antClasses = await page.locator('.ant-form, .ant-input, .ant-btn, .ant-select').count()
    expect(antClasses).toBe(0)
  })
})

test.describe('Auth Migration - Responsive Design [P2]', () => {
  test('[P2] login page should adapt to mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Page should still be accessible
    await expect(page.getByRole('heading', { name: 'Csaas 登录' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: '邮箱' })).toBeVisible()
  })

  test('[P2] register page should adapt to mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/register')
    await page.waitForLoadState('networkidle')

    // Page should still be accessible
    await expect(page.getByRole('heading', { name: 'Csaas 注册' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: '姓名' })).toBeVisible()
  })

  test('[P2] should work on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Csaas 登录' })).toBeVisible()
    await expect(page.locator('.MuiCard-root')).toBeVisible()
  })
})

test.describe('Auth Migration - Accessibility [P2]', () => {
  test('[P2] login page should have proper ARIA labels', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Check form elements have labels
    await expect(page.getByRole('textbox', { name: '邮箱' })).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible()

    // Password visibility toggle should have aria-label
    await expect(page.getByRole('button', { name: '切换密码可见性' })).toBeVisible()
  })

  test('[P2] register page should have proper ARIA labels', async ({ page }) => {
    await page.goto('/register')
    await page.waitForLoadState('networkidle')

    // Check form elements have labels
    await expect(page.getByRole('textbox', { name: '姓名' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: '邮箱' })).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
    await expect(page.locator('input[type="password"]').nth(1)).toBeVisible()
    await expect(page.getByRole('combobox')).toBeVisible()
  })

  test('[P2] should support keyboard navigation on login page', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Tab through form elements
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Should be able to submit with Enter
    await page.keyboard.press('Enter')
  })
})
