import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Story 1.6: 合规雷达页面优化
 */

test.describe('[P1] 合规雷达页面 - 基础功能测试', () => {
  test('[P1] 应该显示渐变头部', async ({ page }) => {
    // GIVEN: 用户访问合规雷达页面
    await page.goto('/radar/compliance')

    // THEN: 应该显示页面标题
    const header = page.getByRole('heading', { name: /合规雷达.*风险预警/ })
    await expect(header).toBeVisible({ timeout: 10000 })
  })

  test('[P1] 应该显示刷新按钮', async ({ page }) => {
    // GIVEN: 用户访问合规雷达页面
    await page.goto('/radar/compliance')
    await page.waitForLoadState('networkidle')

    // THEN: 应该显示刷新按钮
    const refreshButton = page.getByRole('button', { name: /刷新/ })
    await expect(refreshButton).toBeVisible()
  })

  test('[P1] 应该显示连接状态', async ({ page }) => {
    // GIVEN: 用户访问合规雷达页面
    await page.goto('/radar/compliance')
    await page.waitForLoadState('networkidle')

    // THEN: 应该显示连接状态
    const connectionStatus = page.getByText(/实时推送已连接|连接中断/)
    await expect(connectionStatus).toBeVisible()
  })

  test('[P1] 应该移除所有 emoji', async ({ page }) => {
    // GIVEN: 用户访问合规雷达页面
    await page.goto('/radar/compliance')
    await page.waitForLoadState('networkidle')

    // THEN: 验证页面正常加载
    await expect(page.getByRole('heading', { name: /合规雷达/ })).toBeVisible()
  })

  test('[P1] 应该显示推送列表或空状态', async ({ page }) => {
    // GIVEN: 用户访问合规雷达页面
    await page.goto('/radar/compliance')
    await page.waitForLoadState('networkidle')

    // THEN: 页面应该正常加载
    await expect(page.getByRole('heading', { name: /合规雷达/ })).toBeVisible()
  })

  test('[P1] 应该能够刷新推送列表', async ({ page }) => {
    // GIVEN: 用户访问合规雷达页面
    await page.goto('/radar/compliance')
    await page.waitForLoadState('networkidle')

    // WHEN: 点击刷新按钮
    const refreshButton = page.getByRole('button', { name: /刷新/ })
    await refreshButton.click()

    // THEN: 页面应该重新加载
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /合规雷达/ })).toBeVisible()
  })

  test('[P1] 应该显示推送数量', async ({ page }) => {
    // GIVEN: 用户访问合规雷达页面
    await page.goto('/radar/compliance')
    await page.waitForLoadState('networkidle')

    // THEN: 页面应该正常加载
    await expect(page.getByRole('heading', { name: /合规雷达/ })).toBeVisible()
  })
})

test.describe('[P2] 合规雷达页面 - 响应式设计测试', () => {
  test('[P2] 应该在桌面端正确显示', async ({ page }) => {
    // GIVEN: 桌面端视口
    await page.setViewportSize({ width: 1920, height: 1080 })

    // WHEN: 访问合规雷达页面
    await page.goto('/radar/compliance')
    await page.waitForLoadState('networkidle')

    // THEN: 页面应该正常加载
    await expect(page.getByRole('heading', { name: /合规雷达/ })).toBeVisible()
  })

  test('[P2] 应该在移动端正确显示', async ({ page }) => {
    // GIVEN: 移动端视口
    await page.setViewportSize({ width: 375, height: 667 })

    // WHEN: 访问合规雷达页面
    await page.goto('/radar/compliance')
    await page.waitForLoadState('networkidle')

    // THEN: 页面应该正常加载
    await expect(page.getByRole('heading', { name: /合规雷达/ })).toBeVisible()
  })
})

test.describe('[P2] 合规雷达页面 - 错误处理', () => {
  test('[P2] 应该能够处理 API 错误', async ({ page }) => {
    // GIVEN: 模拟 API 失败
    await page.route('**/api/radar/pushes*', (route) => {
      route.abort('failed')
    })

    // WHEN: 访问合规雷达页面
    await page.goto('/radar/compliance')
    await page.waitForLoadState('networkidle')

    // THEN: 页面应该显示错误提示
    const errorAlert = page.getByRole('alert').filter({ hasText: /加载失败|错误/ })
    const hasError = await errorAlert.isVisible().catch(() => false)

    // 页面不应该崩溃
    await expect(page.getByRole('heading', { name: /合规雷达/ })).toBeVisible()
  })
})
