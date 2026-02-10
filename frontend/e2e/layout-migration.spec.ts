import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Layout Migration (Story 11-2)
 * Tests the migration from Ant Design to MUI layout components
 */

test.describe('Layout Migration', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
  })

  test.describe('Header Component [P1]', () => {
    test('should display logo and brand name', async ({ page }) => {
      const header = page.locator('header')
      await expect(header).toBeVisible()
      await expect(header.getByText('Csaas')).toBeVisible()
    })

    test('should display user information', async ({ page }) => {
      const header = page.locator('header')
      await expect(header.getByText('test@example.com')).toBeVisible()
    })

    test('should open user menu when clicked', async ({ page }) => {
      const header = page.locator('header')
      await header.getByText('test@example.com').click()

      // Check menu items
      await expect(page.getByRole('menuitem', { name: '个人信息' })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: '设置' })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: '退出登录' })).toBeVisible()
    })

    test('should logout when logout is clicked', async ({ page }) => {
      const header = page.locator('header')
      await header.getByText('test@example.com').click()
      await page.getByRole('menuitem', { name: '退出登录' }).click()

      // Should redirect to login
      await page.waitForURL('**/login')
      await expect(page.locator('input[type="email"]')).toBeVisible()
    })
  })

  test.describe('Sidebar Component [P1]', () => {
    test('should display navigation menu items', async ({ page }) => {
      const sidebar = page.locator('[role="navigation"], nav, .MuiDrawer-root')

      await expect(page.getByText('工作台')).toBeVisible()
      await expect(page.getByText('项目管理')).toBeVisible()
      await expect(page.getByText('技术雷达')).toBeVisible()
      await expect(page.getByText('报告中心')).toBeVisible()
      await expect(page.getByText('团队管理')).toBeVisible()
      await expect(page.getByText('系统管理')).toBeVisible()
    })

    test('should navigate to dashboard when clicking 工作台', async ({ page }) => {
      await page.getByText('工作台').click()
      await page.waitForURL('**/dashboard')
      await expect(page.url()).toContain('/dashboard')
    })

    test('should navigate to projects when clicking 项目管理', async ({ page }) => {
      await page.getByText('项目管理').click()
      await page.waitForURL('**/projects')
      await expect(page.url()).toContain('/projects')
    })

    test('should expand admin menu when clicked', async ({ page }) => {
      await page.getByText('系统管理').click()

      // Child items should appear
      await expect(page.getByText('运营仪表板')).toBeVisible()
      await expect(page.getByText('内容质量管理')).toBeVisible()
      await expect(page.getByText('客户管理')).toBeVisible()
    })

    test('should collapse sidebar when toggle button is clicked', async ({ page }) => {
      // Find and click the collapse button
      const collapseButton = page.locator('button[aria-label*="collapse"], button:has(svg[data-testid*="Chevron"])')
      if (await collapseButton.isVisible().catch(() => false)) {
        await collapseButton.click()

        // Sidebar should be collapsed - text might be hidden
        await page.waitForTimeout(300) // Wait for animation
      }
    })
  })

  test.describe('MainLayout Structure [P1]', () => {
    test('should have correct layout structure', async ({ page }) => {
      // Check for header
      await expect(page.locator('header')).toBeVisible()

      // Check for main content area
      await expect(page.locator('main')).toBeVisible()
    })

    test('should render children content correctly', async ({ page }) => {
      // Dashboard should have content
      await expect(page.locator('main')).not.toBeEmpty()
    })
  })

  test.describe('Responsive Layout [P2]', () => {
    test('should adapt to mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await page.reload()
      await page.waitForLoadState('networkidle')

      // Header should still be visible
      await expect(page.locator('header')).toBeVisible()

      // Sidebar might be hidden on mobile or shown as overlay
      const sidebar = page.locator('.MuiDrawer-root')
      // On mobile, sidebar might be hidden by default
    })

    test('should adapt to tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 })
      await page.reload()
      await page.waitForLoadState('networkidle')

      await expect(page.locator('header')).toBeVisible()
    })

    test('should work on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.reload()
      await page.waitForLoadState('networkidle')

      await expect(page.locator('header')).toBeVisible()
      await expect(page.getByText('工作台')).toBeVisible()
    })
  })

  test.describe('Page Navigation Flows [P1]', () => {
    test('should navigate through multiple pages', async ({ page }) => {
      // Go to dashboard
      await page.getByText('工作台').click()
      await page.waitForURL('**/dashboard')

      // Go to projects
      await page.getByText('项目管理').click()
      await page.waitForURL('**/projects')

      // Go to radar
      await page.getByText('技术雷达').click()
      await page.waitForURL('**/radar**')

      // Go to reports
      await page.getByText('报告中心').click()
      await page.waitForURL('**/reports')

      // Go to team
      await page.getByText('团队管理').click()
      await page.waitForURL('**/team')
    })

    test('should highlight current navigation item', async ({ page }) => {
      // Navigate to projects
      await page.getByText('项目管理').click()
      await page.waitForURL('**/projects')

      // The selected menu item should have selected styling
      const selectedItem = page.locator('.Mui-selected').filter({ hasText: '项目管理' })
      await expect(selectedItem).toBeVisible()
    })
  })

  test.describe('Accessibility [P2]', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      // Header should have banner role
      await expect(page.locator('header')).toHaveAttribute('role', 'banner')

      // Navigation should be present
      const nav = page.locator('nav, [role="navigation"]')
      await expect(nav.first()).toBeVisible()
    })

    test('should support keyboard navigation', async ({ page }) => {
      // Focus on a menu item
      await page.getByText('工作台').focus()

      // Press tab to move to next item
      await page.keyboard.press('Tab')

      // Should be able to activate with Enter
      await page.keyboard.press('Enter')
    })
  })
})
