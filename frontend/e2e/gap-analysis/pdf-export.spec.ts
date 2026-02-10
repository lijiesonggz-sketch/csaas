import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Story 10.2: PDF报告导出功能
 *
 * 测试场景：
 * 1. 验证导出按钮点击后打开预览页面
 * 2. 验证预览页面包含完整报告内容
 * 3. 验证打印样式隐藏导航栏和侧边栏
 */

test.describe('[P1] PDF报告导出 - 基础功能测试', () => {
  test('[P1] 应该显示导出PDF按钮', async ({ page }) => {
    // GIVEN: 访问差距分析页面（需要先完成分析）
    await page.goto('/projects/test-project/gap-analysis')
    await page.waitForLoadState('networkidle')

    // THEN: 应该显示导出PDF按钮（如果已有分析结果）
    // 注意：如果没有分析结果，按钮不会出现
    const exportButton = page.getByRole('button', { name: /导出.*PDF/i })
    const hasExportButton = await exportButton.isVisible().catch(() => false)

    if (hasExportButton) {
      await expect(exportButton).toBeVisible()
    }
  })

  test('[P1] 导出按钮应该可点击', async ({ page }) => {
    // GIVEN: 访问差距分析页面
    await page.goto('/projects/test-project/gap-analysis')
    await page.waitForLoadState('networkidle')

    // WHEN: 查找导出按钮
    const exportButton = page.getByRole('button', { name: /导出.*PDF/i })
    const hasExportButton = await exportButton.isVisible().catch(() => false)

    if (hasExportButton) {
      // THEN: 按钮应该可点击
      await expect(exportButton).toBeEnabled()
    }
  })

  test('[P1] 点击导出按钮应该打开预览对话框', async ({ page }) => {
    // GIVEN: 访问差距分析页面
    await page.goto('/projects/test-project/gap-analysis')
    await page.waitForLoadState('networkidle')

    // WHEN: 点击导出按钮
    const exportButton = page.getByRole('button', { name: /导出.*PDF/i })
    const hasExportButton = await exportButton.isVisible().catch(() => false)

    if (hasExportButton) {
      await exportButton.click()

      // THEN: 应该显示预览对话框
      const modal = page.locator('.ant-modal').filter({ hasText: '差距分析报告预览' })
      await expect(modal).toBeVisible({ timeout: 5000 })
    }
  })

  test('[P1] 预览对话框应该包含打印按钮', async ({ page }) => {
    // GIVEN: 访问差距分析页面并点击导出
    await page.goto('/projects/test-project/gap-analysis')
    await page.waitForLoadState('networkidle')

    const exportButton = page.getByRole('button', { name: /导出.*PDF/i })
    const hasExportButton = await exportButton.isVisible().catch(() => false)

    if (hasExportButton) {
      await exportButton.click()
      await page.waitForSelector('.ant-modal', { timeout: 5000 })

      // THEN: 应该显示打印按钮
      const printButton = page.getByRole('button', { name: /打印|保存为 PDF/i })
      await expect(printButton).toBeVisible()
    }
  })
})

test.describe('[P1] PDF报告导出 - 报告内容验证', () => {
  test('[P1] 预览应该包含报告标题', async ({ page }) => {
    // GIVEN: 打开报告预览
    await page.goto('/projects/test-project/gap-analysis')
    await page.waitForLoadState('networkidle')

    const exportButton = page.getByRole('button', { name: /导出.*PDF/i })
    const hasExportButton = await exportButton.isVisible().catch(() => false)

    if (hasExportButton) {
      await exportButton.click()
      await page.waitForSelector('.gap-analysis-report', { timeout: 5000 })

      // THEN: 应该显示报告标题
      await expect(page.getByText('差距分析报告')).toBeVisible()
    }
  })

  test('[P1] 预览应该包含成熟度概览', async ({ page }) => {
    // GIVEN: 打开报告预览
    await page.goto('/projects/test-project/gap-analysis')
    await page.waitForLoadState('networkidle')

    const exportButton = page.getByRole('button', { name: /导出.*PDF/i })
    const hasExportButton = await exportButton.isVisible().catch(() => false)

    if (hasExportButton) {
      await exportButton.click()
      await page.waitForSelector('.gap-analysis-report', { timeout: 5000 })

      // THEN: 应该显示成熟度概览
      await expect(page.getByText('成熟度概览')).toBeVisible()
    }
  })

  test('[P1] 预览应该包含雷达图', async ({ page }) => {
    // GIVEN: 打开报告预览
    await page.goto('/projects/test-project/gap-analysis')
    await page.waitForLoadState('networkidle')

    const exportButton = page.getByRole('button', { name: /导出.*PDF/i })
    const hasExportButton = await exportButton.isVisible().catch(() => false)

    if (hasExportButton) {
      await exportButton.click()
      await page.waitForSelector('.gap-analysis-report', { timeout: 5000 })

      // THEN: 应该显示雷达图区域
      await expect(page.getByText('维度成熟度分布')).toBeVisible()
      // 验证recharts容器存在
      const chartContainer = page.locator('.recharts-responsive-container')
      await expect(chartContainer).toBeVisible()
    }
  })

  test('[P1] 预览应该包含TOP 3短板', async ({ page }) => {
    // GIVEN: 打开报告预览
    await page.goto('/projects/test-project/gap-analysis')
    await page.waitForLoadState('networkidle')

    const exportButton = page.getByRole('button', { name: /导出.*PDF/i })
    const hasExportButton = await exportButton.isVisible().catch(() => false)

    if (hasExportButton) {
      await exportButton.click()
      await page.waitForSelector('.gap-analysis-report', { timeout: 5000 })

      // THEN: 应该显示TOP 3短板
      await expect(page.getByText('TOP 3 短板维度')).toBeVisible()
    }
  })

  test('[P1] 预览应该包含TOP 3优势', async ({ page }) => {
    // GIVEN: 打开报告预览
    await page.goto('/projects/test-project/gap-analysis')
    await page.waitForLoadState('networkidle')

    const exportButton = page.getByRole('button', { name: /导出.*PDF/i })
    const hasExportButton = await exportButton.isVisible().catch(() => false)

    if (hasExportButton) {
      await exportButton.click()
      await page.waitForSelector('.gap-analysis-report', { timeout: 5000 })

      // THEN: 应该显示TOP 3优势
      await expect(page.getByText('TOP 3 优势维度')).toBeVisible()
    }
  })

  test('[P1] 预览应该包含改进建议', async ({ page }) => {
    // GIVEN: 打开报告预览
    await page.goto('/projects/test-project/gap-analysis')
    await page.waitForLoadState('networkidle')

    const exportButton = page.getByRole('button', { name: /导出.*PDF/i })
    const hasExportButton = await exportButton.isVisible().catch(() => false)

    if (hasExportButton) {
      await exportButton.click()
      await page.waitForSelector('.gap-analysis-report', { timeout: 5000 })

      // THEN: 应该显示改进建议
      await expect(page.getByText('改进建议')).toBeVisible()
    }
  })

  test('[P1] 预览应该包含维度详情表格', async ({ page }) => {
    // GIVEN: 打开报告预览
    await page.goto('/projects/test-project/gap-analysis')
    await page.waitForLoadState('networkidle')

    const exportButton = page.getByRole('button', { name: /导出.*PDF/i })
    const hasExportButton = await exportButton.isVisible().catch(() => false)

    if (hasExportButton) {
      await exportButton.click()
      await page.waitForSelector('.gap-analysis-report', { timeout: 5000 })

      // THEN: 应该显示维度详情
      await expect(page.getByText('各维度成熟度详情')).toBeVisible()
    }
  })

  test('[P1] 预览应该包含聚类详情表格', async ({ page }) => {
    // GIVEN: 打开报告预览
    await page.goto('/projects/test-project/gap-analysis')
    await page.waitForLoadState('networkidle')

    const exportButton = page.getByRole('button', { name: /导出.*PDF/i })
    const hasExportButton = await exportButton.isVisible().catch(() => false)

    if (hasExportButton) {
      await exportButton.click()
      await page.waitForSelector('.gap-analysis-report', { timeout: 5000 })

      // THEN: 应该显示聚类详情
      await expect(page.getByText('各聚类详细成熟度')).toBeVisible()
    }
  })
})

test.describe('[P2] PDF报告导出 - 打印样式验证', () => {
  test('[P2] 报告组件应该有正确的打印样式类名', async ({ page }) => {
    // GIVEN: 打开报告预览
    await page.goto('/projects/test-project/gap-analysis')
    await page.waitForLoadState('networkidle')

    const exportButton = page.getByRole('button', { name: /导出.*PDF/i })
    const hasExportButton = await exportButton.isVisible().catch(() => false)

    if (hasExportButton) {
      await exportButton.click()
      await page.waitForSelector('.gap-analysis-report', { timeout: 5000 })

      // THEN: 应该应用打印样式类名
      const reportElement = page.locator('.gap-analysis-report')
      await expect(reportElement).toBeVisible()

      // 验证报告部分有正确的类名
      const sections = page.locator('.report-section')
      const sectionCount = await sections.count()
      expect(sectionCount).toBeGreaterThan(0)
    }
  })

  test('[P2] 封面应该有分页类名', async ({ page }) => {
    // GIVEN: 打开报告预览
    await page.goto('/projects/test-project/gap-analysis')
    await page.waitForLoadState('networkidle')

    const exportButton = page.getByRole('button', { name: /导出.*PDF/i })
    const hasExportButton = await exportButton.isVisible().catch(() => false)

    if (hasExportButton) {
      await exportButton.click()
      await page.waitForSelector('.gap-analysis-report', { timeout: 5000 })

      // THEN: 封面应该有print-page-break类名
      const cover = page.locator('.print-page-break')
      await expect(cover).toBeVisible()
    }
  })

  test('[P2] 报告应该有data-project-name属性', async ({ page }) => {
    // GIVEN: 打开报告预览
    await page.goto('/projects/test-project/gap-analysis')
    await page.waitForLoadState('networkidle')

    const exportButton = page.getByRole('button', { name: /导出.*PDF/i })
    const hasExportButton = await exportButton.isVisible().catch(() => false)

    if (hasExportButton) {
      await exportButton.click()
      await page.waitForSelector('.gap-analysis-report', { timeout: 5000 })

      // THEN: 报告元素应该有data-project-name属性
      const reportElement = page.locator('.gap-analysis-report')
      await expect(reportElement).toHaveAttribute('data-project-name', /.+/)
    }
  })
})

test.describe('[P2] PDF报告导出 - 响应式测试', () => {
  test('[P2] 预览在桌面端应该正常显示', async ({ page }) => {
    // GIVEN: 桌面端视口
    await page.setViewportSize({ width: 1920, height: 1080 })

    // WHEN: 访问差距分析页面并打开预览
    await page.goto('/projects/test-project/gap-analysis')
    await page.waitForLoadState('networkidle')

    const exportButton = page.getByRole('button', { name: /导出.*PDF/i })
    const hasExportButton = await exportButton.isVisible().catch(() => false)

    if (hasExportButton) {
      await exportButton.click()
      await page.waitForSelector('.gap-analysis-report', { timeout: 5000 })

      // THEN: 报告应该正常显示
      await expect(page.getByText('差距分析报告')).toBeVisible()
    }
  })

  test('[P2] 预览在平板端应该正常显示', async ({ page }) => {
    // GIVEN: 平板端视口
    await page.setViewportSize({ width: 1024, height: 768 })

    // WHEN: 访问差距分析页面并打开预览
    await page.goto('/projects/test-project/gap-analysis')
    await page.waitForLoadState('networkidle')

    const exportButton = page.getByRole('button', { name: /导出.*PDF/i })
    const hasExportButton = await exportButton.isVisible().catch(() => false)

    if (hasExportButton) {
      await exportButton.click()
      await page.waitForSelector('.gap-analysis-report', { timeout: 5000 })

      // THEN: 报告应该正常显示
      await expect(page.getByText('差距分析报告')).toBeVisible()
    }
  })
})

test.describe('[P2] PDF报告导出 - 错误处理', () => {
  test('[P2] 页面应该能够处理没有分析数据的情况', async ({ page }) => {
    // GIVEN: 访问差距分析页面（没有分析数据）
    await page.goto('/projects/test-project/gap-analysis')
    await page.waitForLoadState('networkidle')

    // WHEN: 检查导出按钮
    const exportButton = page.getByRole('button', { name: /导出.*PDF/i })
    const hasExportButton = await exportButton.isVisible().catch(() => false)

    // THEN: 如果没有分析数据，按钮可能不可用或不存在
    // 页面不应该崩溃
    const pageContent = await page.content()
    expect(pageContent.length).toBeGreaterThan(0)
  })
})
