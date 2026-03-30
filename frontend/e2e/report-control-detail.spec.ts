import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Story 7.3: 报告页面控制点详情抽屉集成
 */

test.describe('Story 7.3: 报告页面控制点详情抽屉', () => {
  test.beforeEach(async ({ page }) => {
    // 登录并导航到报告页面
    await page.goto('/login')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'Test123456!')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('AC1: 点击"查看详情"按钮应该打开控制点详情抽屉', async ({ page }) => {
    // GIVEN: 用户在报告页面
    await page.goto('/reports/test-report-id')
    await page.waitForLoadState('networkidle')

    // WHEN: 点击任意控制点的"查看详情"按钮
    const detailButton = page.getByRole('button', { name: '查看详情' }).first()
    await detailButton.click()

    // THEN: 应该打开控制点详情抽屉
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await expect(page.getByText('控制点详情')).toBeVisible()
  })

  test('AC2: 抽屉应该显示完整的控制点信息', async ({ page }) => {
    // GIVEN: 用户在报告页面
    await page.goto('/reports/test-report-id')
    await page.waitForLoadState('networkidle')

    // WHEN: 打开控制点详情抽屉
    await page.getByRole('button', { name: '查看详情' }).first().click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    // THEN: 应该显示控制点的基本信息
    const drawer = page.locator('[role="dialog"]')
    await expect(drawer.getByText('控制点编号')).toBeVisible()
    await expect(drawer.getByText('控制点名称')).toBeVisible()
    await expect(drawer.getByText('差距等级')).toBeVisible()

    // THEN: 应该显示控制点的详细描述
    await expect(drawer.getByText('控制要求')).toBeVisible()

    // THEN: 应该显示评估结果
    await expect(drawer.getByText('当前状态')).toBeVisible()
  })

  test('AC3: 抽屉应该支持关闭操作', async ({ page }) => {
    // GIVEN: 控制点详情抽屉已打开
    await page.goto('/reports/test-report-id')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '查看详情' }).first().click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    // WHEN: 点击关闭按钮
    const closeButton = page.locator('[role="dialog"]').getByRole('button', { name: /关闭|close/i })
    await closeButton.click()

    // THEN: 抽屉应该关闭
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()
  })

  test('AC4: 空态处理 - 无报告数据时应显示空态提示', async ({ page }) => {
    // GIVEN: 用户访问一个没有数据的报告
    await page.goto('/reports/empty-report-id')
    await page.waitForLoadState('networkidle')

    // THEN: 应该显示空态提示
    await expect(page.getByText('暂无报告数据')).toBeVisible()
    await expect(page.getByText('请先完成评估以生成控制报告')).toBeVisible()

    // THEN: 不应该显示"查看详情"按钮
    await expect(page.getByRole('button', { name: '查看详情' })).not.toBeVisible()
  })

  test('AC5: 错误处理 - API 失败时应显示错误信息', async ({ page }) => {
    // GIVEN: 模拟 API 失败
    await page.route('**/compliance-intelligence/report-center/*', route => {
      route.fulfill({ status: 500, body: 'Internal Server Error' })
    })

    // WHEN: 访问报告页面
    await page.goto('/reports/test-report-id')
    await page.waitForLoadState('networkidle')

    // THEN: 应该显示错误提示
    await expect(page.getByText(/加载报告失败|错误/i)).toBeVisible()
  })

  test('AC6: 加载状态 - 数据加载时应显示加载指示器', async ({ page }) => {
    // GIVEN: 模拟慢速 API
    await page.route('**/compliance-intelligence/report-center/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      await route.continue()
    })

    // WHEN: 访问报告页面
    await page.goto('/reports/test-report-id')

    // THEN: 应该显示加载指示器
    await expect(page.locator('.animate-spin')).toBeVisible()
  })
})
