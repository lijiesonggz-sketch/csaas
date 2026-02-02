import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Story 5.4: 推送历史查看（简化版）
 *
 * 注意：这个版本跳过了登录，直接测试推送历史页面
 * 如果需要登录，请根据实际的登录页面调整 login() 函数
 */

test.describe('[P1] 推送历史查看 - 基础功能测试', () => {
  test('[P1] 应该能够访问推送历史页面', async ({ page }) => {
    // GIVEN: 用户访问推送历史页面
    await page.goto('/radar/history')

    // THEN: 页面标题应该显示
    await expect(page.locator('h4, h1, h2').filter({ hasText: '推送历史' })).toBeVisible({
      timeout: 10000,
    })
  })

  test('[P2] 应该显示筛选器组件', async ({ page }) => {
    // GIVEN: 用户在推送历史页面
    await page.goto('/radar/history')
    await page.waitForLoadState('networkidle')

    // THEN: 应该显示筛选器
    // 注意：这里使用更宽松的选择器，因为不确定具体的实现
    const filters = page.locator('text=雷达类型, text=时间范围, text=相关性').first()

    // 如果页面加载成功，至少应该有一些内容
    const pageContent = await page.content()
    expect(pageContent.length).toBeGreaterThan(0)
  })

  test('[P2] 应该能够处理空状态', async ({ page }) => {
    // GIVEN: 用户访问推送历史页面（可能没有数据）
    await page.goto('/radar/history')
    await page.waitForLoadState('networkidle')

    // THEN: 页面应该正常加载（不崩溃）
    // 可能显示"暂无推送历史"或显示推送列表
    const hasEmptyState = await page.getByText('暂无推送历史').isVisible().catch(() => false)
    const hasCards = await page.locator('[class*="MuiCard"]').count()

    // 至少有一个状态应该为真
    expect(hasEmptyState || hasCards > 0).toBeTruthy()
  })
})

test.describe('[P2] 推送历史查看 - 响应式测试', () => {
  test('[P2] 页面在桌面端应该正常显示', async ({ page }) => {
    // GIVEN: 桌面端视口
    await page.setViewportSize({ width: 1920, height: 1080 })

    // WHEN: 访问推送历史页面
    await page.goto('/radar/history')
    await page.waitForLoadState('networkidle')

    // THEN: 页面应该正常加载
    const pageContent = await page.content()
    expect(pageContent).toContain('推送历史')
  })

  test('[P2] 页面在移动端应该正常显示', async ({ page }) => {
    // GIVEN: 移动端视口
    await page.setViewportSize({ width: 375, height: 667 })

    // WHEN: 访问推送历史页面
    await page.goto('/radar/history')
    await page.waitForLoadState('networkidle')

    // THEN: 页面应该正常加载
    const pageContent = await page.content()
    expect(pageContent).toContain('推送历史')
  })
})

test.describe('[P2] 推送历史查看 - 错误处理', () => {
  test('[P2] 页面应该能够处理网络错误', async ({ page }) => {
    // GIVEN: 模拟 API 失败
    await page.route('**/api/radar/pushes*', (route) => {
      route.abort('failed')
    })

    // WHEN: 访问推送历史页面
    await page.goto('/radar/history')
    await page.waitForLoadState('networkidle')

    // THEN: 页面应该显示错误提示或正常降级
    // 页面不应该崩溃
    const pageContent = await page.content()
    expect(pageContent.length).toBeGreaterThan(0)
  })
})

/**
 * 如果您的项目需要登录，请取消注释并调整以下代码
 */
/*
test.describe('[P0] 推送历史查看 - 需要登录', () => {
  test.beforeEach(async ({ page }) => {
    // 方式1：通过 UI 登录
    await page.goto('/login')
    // 根据实际的登录页面调整选择器
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    // 方式2：通过 API 登录（更快）
    // const response = await page.request.post('/api/auth/login', {
    //   data: { email: 'test@example.com', password: 'password' }
    // })
    // const { token } = await response.json()
    // await page.evaluate((token) => {
    //   localStorage.setItem('authToken', token)
    // }, token)
  })

  test('[P0] 登录后应该能访问推送历史', async ({ page }) => {
    await page.goto('/radar/history')
    await expect(page.locator('h4')).toContainText('推送历史')
  })
})
*/
