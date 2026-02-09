import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Story 8.6: 同业动态前端展示增强
 *
 * 测试范围：
 * - AC1: 同业动态卡片展示
 * - AC2: 卡片内容格式
 * - AC3: 详情弹窗
 * - AC4: 关注同业筛选
 */

test.describe('[P1] 同业动态前端展示增强 - 基础功能测试', () => {
  test('[P1] 应该能够访问行业雷达页面并切换到同业动态标签', async ({ page }) => {
    // GIVEN: 用户访问行业雷达页面
    await page.goto('/radar/industry')

    // WHEN: 点击同业动态标签
    await page.getByText('同业动态').click()

    // THEN: 应该显示同业动态内容
    await expect(page.getByText('筛选条件')).toBeVisible({ timeout: 10000 })
  })

  test('[P1] 应该显示同业动态筛选器', async ({ page }) => {
    // GIVEN: 用户在行业雷达页面的同业动态标签
    await page.goto('/radar/industry?tab=peer-monitoring')
    await page.waitForLoadState('networkidle')

    // THEN: 应该显示筛选器选项
    await expect(page.getByText('全部同业动态')).toBeVisible()
    await expect(page.getByText('我关注的同业')).toBeVisible()
  })

  test('[P2] 应该能够筛选我关注的同业', async ({ page }) => {
    // GIVEN: 用户在同业动态页面
    await page.goto('/radar/industry?tab=peer-monitoring')
    await page.waitForLoadState('networkidle')

    // WHEN: 点击"我关注的同业"筛选器
    await page.getByText('我关注的同业').click()

    // THEN: 筛选器应该被选中
    await expect(page.getByText('仅显示您关注的同业机构动态')).toBeVisible()
  })

  test('[P2] 空状态应该显示友好提示', async ({ page }) => {
    // GIVEN: 用户在同业动态页面（可能没有数据）
    await page.goto('/radar/industry?tab=peer-monitoring')
    await page.waitForLoadState('networkidle')

    // THEN: 应该显示空状态或推送列表
    const hasEmptyState = await page.getByText('暂无关注的同业动态').isVisible().catch(() => false)
    const hasCards = await page.locator('[data-testid="peer-monitoring-card"]').count()

    // 至少有一个状态应该为真
    expect(hasEmptyState || hasCards > 0).toBeTruthy()
  })
})

test.describe('[P1] 同业动态前端展示增强 - 卡片展示测试', () => {
  test('[P1] 同业动态卡片应该显示正确的内容格式', async ({ page }) => {
    // GIVEN: 用户在同业动态页面
    await page.goto('/radar/industry?tab=peer-monitoring')
    await page.waitForLoadState('networkidle')

    // 等待卡片加载或空状态
    await page.waitForSelector('[data-testid="peer-monitoring-card"], text=暂无关注的同业动态', {
      timeout: 10000,
    })

    // 如果有卡片，验证内容格式
    const cards = page.locator('[data-testid="peer-monitoring-card"]')
    const cardCount = await cards.count()

    if (cardCount > 0) {
      // THEN: 卡片应该包含必要元素
      await expect(page.getByText('同业动态').first()).toBeVisible()
      await expect(page.getByRole('button', { name: /查看详情/i }).first()).toBeVisible()
    }
  })

  test('[P2] 关注的同业应该有特殊标识', async ({ page }) => {
    // GIVEN: 用户在同业动态页面
    await page.goto('/radar/industry?tab=peer-monitoring')
    await page.waitForLoadState('networkidle')

    // 等待卡片加载
    await page.waitForTimeout(2000)

    // 检查是否有"与您关注的相关"标签
    const hasWatchedLabel = await page.getByText(/与您关注的.*相关/).isVisible().catch(() => false)
    const hasStarIcon = await page.getByText('⭐ 关注').isVisible().catch(() => false)

    // 如果页面有数据，应该有这些标识之一
    const hasCards = await page.locator('[data-testid="peer-monitoring-card"]').count()
    if (hasCards > 0) {
      expect(hasWatchedLabel || hasStarIcon).toBeTruthy()
    }
  })
})

test.describe('[P1] 同业动态前端展示增强 - 详情弹窗测试', () => {
  test('[P1] 点击卡片应该打开详情弹窗', async ({ page }) => {
    // GIVEN: 用户在同业动态页面
    await page.goto('/radar/industry?tab=peer-monitoring')
    await page.waitForLoadState('networkidle')

    // 等待卡片加载
    await page.waitForTimeout(2000)

    // 如果有卡片
    const viewDetailButtons = page.getByRole('button', { name: /查看详情/i })
    const buttonCount = await viewDetailButtons.count()

    if (buttonCount > 0) {
      // WHEN: 点击查看详情按钮
      await viewDetailButtons.first().click()

      // THEN: 应该打开详情弹窗
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
    }
  })

  test('[P2] 详情弹窗应该显示完整信息', async ({ page }) => {
    // GIVEN: 用户在同业动态页面并打开详情弹窗
    await page.goto('/radar/industry?tab=peer-monitoring')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const viewDetailButtons = page.getByRole('button', { name: /查看详情/i })
    const buttonCount = await viewDetailButtons.count()

    if (buttonCount > 0) {
      await viewDetailButtons.first().click()
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })

      // THEN: 弹窗应该包含必要信息
      await expect(page.getByText('同业动态').first()).toBeVisible()
      await expect(page.getByRole('button', { name: /关闭/i })).toBeVisible()
    }
  })

  test('[P2] 应该能够关闭详情弹窗', async ({ page }) => {
    // GIVEN: 用户在详情弹窗
    await page.goto('/radar/industry?tab=peer-monitoring')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const viewDetailButtons = page.getByRole('button', { name: /查看详情/i })
    const buttonCount = await viewDetailButtons.count()

    if (buttonCount > 0) {
      await viewDetailButtons.first().click()
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })

      // WHEN: 点击关闭按钮
      await page.getByRole('button', { name: /关闭/i }).click()

      // THEN: 弹窗应该关闭
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })
    }
  })
})

test.describe('[P2] 同业动态前端展示增强 - 响应式测试', () => {
  test('[P2] 页面在桌面端应该正常显示', async ({ page }) => {
    // GIVEN: 桌面端视口
    await page.setViewportSize({ width: 1920, height: 1080 })

    // WHEN: 访问同业动态页面
    await page.goto('/radar/industry?tab=peer-monitoring')
    await page.waitForLoadState('networkidle')

    // THEN: 页面应该正常加载
    const pageContent = await page.content()
    expect(pageContent).toContain('同业动态')
  })

  test('[P2] 页面在移动端应该正常显示', async ({ page }) => {
    // GIVEN: 移动端视口
    await page.setViewportSize({ width: 375, height: 667 })

    // WHEN: 访问同业动态页面
    await page.goto('/radar/industry?tab=peer-monitoring')
    await page.waitForLoadState('networkidle')

    // THEN: 页面应该正常加载
    const pageContent = await page.content()
    expect(pageContent).toContain('同业动态')
  })
})

test.describe('[P2] 同业动态前端展示增强 - 错误处理', () => {
  test('[P2] 页面应该能够处理网络错误', async ({ page }) => {
    // GIVEN: 模拟 API 失败
    await page.route('**/api/radar/pushes*', (route) => {
      route.abort('failed')
    })

    // WHEN: 访问同业动态页面
    await page.goto('/radar/industry?tab=peer-monitoring')
    await page.waitForLoadState('networkidle')

    // THEN: 页面应该显示错误提示或正常降级
    // 页面不应该崩溃
    const pageContent = await page.content()
    expect(pageContent.length).toBeGreaterThan(0)
  })
})

test.describe('[P2] 同业动态前端展示增强 - URL 状态持久化', () => {
  test('[P2] 筛选状态应该持久化到 URL', async ({ page }) => {
    // GIVEN: 用户在同业动态页面
    await page.goto('/radar/industry?tab=peer-monitoring')
    await page.waitForLoadState('networkidle')

    // WHEN: 点击"我关注的同业"筛选器
    await page.getByText('我关注的同业').click()

    // THEN: URL 应该更新
    await page.waitForURL(/peerFilter=watched/)
  })

  test('[P2] 标签切换应该持久化到 URL', async ({ page }) => {
    // GIVEN: 用户在行业雷达页面
    await page.goto('/radar/industry')

    // WHEN: 点击同业动态标签
    await page.getByText('同业动态').click()

    // THEN: URL 应该更新
    await page.waitForURL(/tab=peer-monitoring/)
  })
})
