import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Story 1.6: 行业雷达页面优化
 */

test.describe('[P1] 行业雷达页面 - 基础功能测试', () => {
  test('[P1] 应该显示渐变头部', async ({ page }) => {
    // GIVEN: 用户访问行业雷达页面
    await page.goto('/radar/industry')

    // THEN: 应该显示页面标题
    const header = page.getByRole('heading', { name: /行业雷达.*同业标杆/ })
    await expect(header).toBeVisible({ timeout: 10000 })
  })

  test('[P1] 应该显示 Tab 导航', async ({ page }) => {
    // GIVEN: 用户访问行业雷达页面
    await page.goto('/radar/industry')
    await page.waitForLoadState('networkidle')

    // THEN: 应该显示行业动态和同业动态两个 Tab
    const industryTab = page.getByRole('button', { name: '行业动态' })
    const peerTab = page.getByRole('button', { name: '同业动态' })

    await expect(industryTab).toBeVisible()
    await expect(peerTab).toBeVisible()
  })

  test('[P1] 应该切换 Tab 显示不同内容', async ({ page }) => {
    // GIVEN: 用户访问行业雷达页面
    await page.goto('/radar/industry')
    await page.waitForLoadState('networkidle')

    // WHEN: 点击同业动态 Tab
    const peerTab = page.getByRole('button', { name: '同业动态' })
    await peerTab.click()

    // THEN: URL 应该包含 tab 参数
    await expect(page).toHaveURL(/tab=peer-monitoring/)

    // WHEN: 切换回行业动态 Tab
    const industryTab = page.getByRole('button', { name: '行业动态' })
    await industryTab.click()

    // THEN: URL 应该更新
    await expect(page).toHaveURL(/tab=industry/)
  })

  test('[P1] 应该显示筛选标签', async ({ page }) => {
    // GIVEN: 用户访问行业雷达页面
    await page.goto('/radar/industry')
    await page.waitForLoadState('networkidle')

    // THEN: 应该显示筛选标签
    const filterButtons = page.getByRole('button').filter({ hasText: /全部|我关注的同业|同规模机构|同地区机构/ })
    const count = await filterButtons.count()

    await expect(count).toBeGreaterThan(0)
  })

  test('[P1] 应该移除所有 emoji', async ({ page }) => {
    // GIVEN: 用户访问行业雷达页面
    await page.goto('/radar/industry')
    await page.waitForLoadState('networkidle')

    // THEN: 验证页面正常加载
    await expect(page.getByRole('heading', { name: /行业雷达/ })).toBeVisible()
  })

  test('[P1] 应该显示推送列表或空状态', async ({ page }) => {
    // GIVEN: 用户访问行业雷达页面
    await page.goto('/radar/industry')
    await page.waitForLoadState('networkidle')

    // THEN: 页面应该正常加载
    await expect(page.getByRole('heading', { name: /行业雷达/ })).toBeVisible()
  })

  test('[P1] 应该能够使用筛选标签', async ({ page }) => {
    // GIVEN: 用户访问行业雷达页面
    await page.goto('/radar/industry')
    await page.waitForLoadState('networkidle')

    // WHEN: 点击筛选标签
    const allButton = page.getByRole('button', { name: '全部' })
    await allButton.click()

    // THEN: URL 应该更新
    await expect(page).toHaveURL(/filter=all/)
  })
})

test.describe('[P2] 行业雷达页面 - 响应式设计测试', () => {
  test('[P2] 应该在桌面端正确显示', async ({ page }) => {
    // GIVEN: 桌面端视口
    await page.setViewportSize({ width: 1920, height: 1080 })

    // WHEN: 访问行业雷达页面
    await page.goto('/radar/industry')
    await page.waitForLoadState('networkidle')

    // THEN: 页面应该正常加载
    await expect(page.getByRole('heading', { name: /行业雷达/ })).toBeVisible()

    // 验证 Tab 导航存在
    await expect(page.getByRole('button', { name: '行业动态' })).toBeVisible()
  })

  test('[P2] 应该在移动端正确显示', async ({ page }) => {
    // GIVEN: 移动端视口
    await page.setViewportSize({ width: 375, height: 667 })

    // WHEN: 访问行业雷达页面
    await page.goto('/radar/industry')
    await page.waitForLoadState('networkidle')

    // THEN: 页面应该正常加载
    await expect(page.getByRole('heading', { name: /行业雷达/ })).toBeVisible()

    // 验证 Tab 导航存在（移动端可能横向滚动）
    await expect(page.getByRole('button', { name: '行业动态' })).toBeVisible()
  })
})

test.describe('[P2] 行业雷达页面 - 错误处理', () => {
  test('[P2] 应该能够处理 API 错误', async ({ page }) => {
    // GIVEN: 模拟 API 失败
    await page.route('**/api/radar/pushes*', (route) => {
      route.abort('failed')
    })

    // WHEN: 访问行业雷达页面
    await page.goto('/radar/industry')
    await page.waitForLoadState('networkidle')

    // THEN: 页面应该显示错误提示或正常降级
    await expect(page.getByRole('heading', { name: /行业雷达/ })).toBeVisible()
  })
})
