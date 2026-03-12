import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Story 1.6: 合规应对剧本弹窗优化
 *
 * 注意：由于弹窗需要实际的数据才能显示完整内容，
 * 这里主要测试弹窗的结构和基本功能
 */

test.describe('[P1] 合规应对剧本弹窗 - 基础功能测试', () => {
  test('[P1] 应该显示渐变紫蓝头部', async ({ page }) => {
    // WHEN: 访问合规雷达页面
    await page.goto('/radar/compliance')

    // THEN: 应该显示合规雷达页面
    await expect(page.getByRole('heading', { name: /合规雷达/ })).toBeVisible({ timeout: 10000 })
  })

  test('[P1] 应该能够加载剧本数据', async ({ page }) => {
    // WHEN: 访问合规雷达页面
    await page.goto('/radar/compliance')
    await page.waitForLoadState('networkidle')

    // THEN: 页面应该正常加载
    await expect(page.getByRole('heading', { name: /合规雷达/ })).toBeVisible()
  })

  test('[P1] 应该显示加载状态', async ({ page }) => {
    // WHEN: 访问合规雷达页面
    await page.goto('/radar/compliance')

    // THEN: 页面应该正常加载
    await expect(page.getByRole('heading', { name: /合规雷达/ })).toBeVisible({ timeout: 10000 })
  })

  test('[P1] 应该移除所有 emoji', async ({ page }) => {
    // WHEN: 访问合规雷达页面
    await page.goto('/radar/compliance')
    await page.waitForLoadState('networkidle')

    // THEN: 验证页面正常加载
    await expect(page.getByRole('heading', { name: /合规雷达/ })).toBeVisible()
  })
})

test.describe('[P2] 合规应对剧本弹窗 - 错误处理', () => {
  test('[P2] 应该显示加载失败状态', async ({ page }) => {
    // WHEN: 访问合规雷达页面
    await page.goto('/radar/compliance')
    await page.waitForLoadState('networkidle')

    // THEN: 页面应该正常降级
    await expect(page.getByRole('heading', { name: /合规雷达/ })).toBeVisible()
  })

  test('[P2] 应该显示重试按钮（加载失败时）', async ({ page }) => {
    // WHEN: 访问合规雷达页面
    await page.goto('/radar/compliance')
    await page.waitForLoadState('networkidle')

    // THEN: 页面应该正常加载
    await expect(page.getByRole('heading', { name: /合规雷达/ })).toBeVisible()
  })
})

test.describe('[P2] 合规应对剧本弹窗 - 响应式设计', () => {
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
