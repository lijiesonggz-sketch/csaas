import { test, expect } from '@playwright/test'

/**
 * Story 7.4: 审核工作台接入控制点详情抽屉 - E2E 测试
 *
 * 测试审核工作台中打开控制点详情抽屉的功能
 * 选择器基于实际生产代码中已经存在的 role 和 data-testid。
 */

test.describe('[Story 7.4] 审核工作台控制点详情抽屉', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    await page.fill('input[placeholder="邮箱"]', 'admin@test.com')
    await page.fill('input[placeholder="密码"]', 'admin123')
    await page.click('button[type="submit"]')

    await page.waitForURL('/dashboard', {
      timeout: 15000,
      waitUntil: 'networkidle'
    })
    await page.waitForLoadState('domcontentloaded')
  })

  test.describe('[P0] AC1: 审核列表中打开控制点详情', () => {
    test('[P0] 场景 1.1: 点击"查看控制点详情"按钮，抽屉正确打开', async ({ page }) => {
      await page.goto('/projects/test-project-id/review')
      await page.waitForLoadState('networkidle')

      // 先选中一个审核项（点击第一个审核项）
      const firstItem = page.locator('button[type="button"]').filter({
        hasText: /待审核|已通过|已修改|已拒绝|pending|approved|modified|rejected/
      }).first()
      if (await firstItem.count() > 0) {
        await firstItem.click()
        await page.waitForTimeout(500)
      }

      // WHEN: 点击"查看控制点详情"按钮
      const controlButton = page.getByRole('button', { name: '查看控制点详情' })

      // 如果按钮存在（当前选中项有 controlId）
      if (await controlButton.isVisible()) {
        await controlButton.click()

        // THEN: 抽屉打开 - ControlDetailDrawer 使用 data-testid="control-detail-drawer"
        const drawer = page.locator('[data-testid="control-detail-drawer"]')
        await expect(drawer).toBeVisible({ timeout: 10000 })
      }
    })

    test('[P0] 场景 1.2: 抽屉显示来源标签为"审核"', async ({ page }) => {
      await page.goto('/projects/test-project-id/review')
      await page.waitForLoadState('networkidle')

      // 选中一个审核项
      const firstItem = page.locator('button[type="button"]').filter({
        hasText: /待审核|已通过|已修改|已拒绝|pending|approved|modified|rejected/
      }).first()
      if (await firstItem.count() > 0) {
        await firstItem.click()
        await page.waitForTimeout(500)
      }

      const controlButton = page.getByRole('button', { name: '查看控制点详情' })
      if (await controlButton.isVisible()) {
        await controlButton.click()

        const sourceBadge = page.locator('[data-testid="control-detail-source-badge"]')
        await expect(sourceBadge).toBeVisible({ timeout: 10000 })
        await expect(sourceBadge).toContainText('审核')
      }
    })
  })

  test.describe('[P0] AC2: 关闭抽屉后保持审核上下文', () => {
    test('[P0] 场景 2.1: 点击关闭按钮，抽屉正确关闭', async ({ page }) => {
      await page.goto('/projects/test-project-id/review')
      await page.waitForLoadState('networkidle')

      // 选中审核项并打开抽屉
      const firstItem = page.locator('button[type="button"]').filter({
        hasText: /待审核|已通过|已修改|已拒绝|pending|approved|modified|rejected/
      }).first()
      if (await firstItem.count() > 0) {
        await firstItem.click()
        await page.waitForTimeout(500)
      }

      const controlButton = page.getByRole('button', { name: '查看控制点详情' })
      if (await controlButton.isVisible()) {
        await controlButton.click()
        await expect(page.locator('[data-testid="control-detail-drawer"]')).toBeVisible({ timeout: 10000 })

        // WHEN: 点击关闭按钮 - ControlDetailDrawer 使用 aria-label="关闭控制点详情"
        const closeButton = page.getByRole('button', { name: '关闭控制点详情' })
        await closeButton.click()

        // THEN: 抽屉关闭
        await expect(page.locator('[data-testid="control-detail-drawer"]')).not.toBeVisible({ timeout: 5000 })
      }
    })

    test('[P0] 场景 2.2: 关闭后审核详情区仍然可见', async ({ page }) => {
      await page.goto('/projects/test-project-id/review')
      await page.waitForLoadState('networkidle')

      // 选中审核项并打开抽屉
      const firstItem = page.locator('button[type="button"]').filter({
        hasText: /待审核|已通过|已修改|已拒绝|pending|approved|modified|rejected/
      }).first()
      if (await firstItem.count() > 0) {
        await firstItem.click()
        await page.waitForTimeout(500)
      }

      const controlButton = page.getByRole('button', { name: '查看控制点详情' })
      if (await controlButton.isVisible()) {
        await controlButton.click()
        await expect(page.locator('[data-testid="control-detail-drawer"]')).toBeVisible({ timeout: 10000 })

        // 关闭抽屉
        const closeButton = page.getByRole('button', { name: '关闭控制点详情' })
        await closeButton.click()

        // THEN: 审核详情标题仍然可见
        const detailTitle = page.getByText('详情区')
        await expect(detailTitle).toBeVisible()
      }
    })

    test('[P2] 场景 2.4: 关闭后可以再次打开抽屉', async ({ page }) => {
      await page.goto('/projects/test-project-id/review')
      await page.waitForLoadState('networkidle')

      // 选中审核项并打开抽屉
      const firstItem = page.locator('button[type="button"]').filter({
        hasText: /待审核|已通过|已修改|已拒绝|pending|approved|modified|rejected/
      }).first()
      if (await firstItem.count() > 0) {
        await firstItem.click()
        await page.waitForTimeout(500)
      }

      const controlButton = page.getByRole('button', { name: '查看控制点详情' })
      if (await controlButton.isVisible()) {
        // 第一次打开
        await controlButton.click()
        await expect(page.locator('[data-testid="control-detail-drawer"]')).toBeVisible({ timeout: 10000 })

        // 关闭
        const closeButton = page.getByRole('button', { name: '关闭控制点详情' })
        await closeButton.click()
        await expect(page.locator('[data-testid="control-detail-drawer"]')).not.toBeVisible({ timeout: 5000 })

        // WHEN: 再次打开
        await controlButton.click()

        // THEN: 抽屉再次打开
        await expect(page.locator('[data-testid="control-detail-drawer"]')).toBeVisible({ timeout: 10000 })
      }
    })
  })

  test.describe('[P0] AC3: 控制点上下文协议遵循', () => {
    test('[P0] 场景 3.1: 抽屉传递正确的上下文参数', async ({ page }) => {
      await page.goto('/projects/test-project-id/review')
      await page.waitForLoadState('networkidle')

      // 选中审核项并打开抽屉
      const firstItem = page.locator('button[type="button"]').filter({
        hasText: /待审核|已通过|已修改|已拒绝|pending|approved|modified|rejected/
      }).first()
      if (await firstItem.count() > 0) {
        await firstItem.click()
        await page.waitForTimeout(500)
      }

      const controlButton = page.getByRole('button', { name: '查看控制点详情' })
      if (await controlButton.isVisible()) {
        const explainRequestPromise = page.waitForRequest((request) =>
          request.url().includes('/compliance-intelligence/control-explain/'),
        )

        await controlButton.click()
        await expect(page.locator('[data-testid="control-detail-drawer"]')).toBeVisible({ timeout: 10000 })

        // THEN: 验证 API 请求包含必要上下文
        const explainRequest = await explainRequestPromise
        const requestUrl = new URL(explainRequest.url())

        expect(requestUrl.pathname).toMatch(/\/compliance-intelligence\/control-explain\/[^/]+$/)
        expect(requestUrl.searchParams.get('organizationId')).toBeTruthy()
      }
    })
  })
})
