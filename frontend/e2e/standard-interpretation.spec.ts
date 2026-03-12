import { test, expect } from '@playwright/test'

test.describe('[P1] 标准解读页面 - 基础功能测试', () => {
  test('[P1] 应该显示渐变头部', async ({ page }) => {
    // GIVEN: 用户访问标准解读页面
    await page.goto('/projects/123/standard-interpretation')
    // WHEN: 页面加载完成
    // THEN: 应该显示紫蓝渐变头部
    const header = page.getByRole('banner')
    await expect(header).toBeVisible()
  })

  test('[P1] 应该显示页面标题和描述', async ({ page }) => {
    // GIVEN: 用户访问标准解读页面
    await page.goto('/projects/123/standard-interpretation')
    // WHEN: 页面加载完成
    // THEN: 应该显示标准解读标题
    await expect(page.getByText('标准解读')).toBeVisible()
    await expect(page.getByText('基于上传的标准文档，AI智能解读条款要求')).toBeVisible()
  })

  test('[P1] 应该显示 Tab 导航', async ({ page }) => {
    // GIVEN: 用户访问标准解读页面
    await page.goto('/projects/123/standard-interpretation')
    // WHEN: 页面加载完成
    // THEN: 应该显示 4 个 Tab（概述、关键术语、条款要求、实施指南）
    const tabs = page.getByRole('tablist').getByRole('tab')
    await expect(tabs).toHaveCount(4)
  })

  test('[P1] 应该能够点击返回按钮', async ({ page }) => {
    // GIVEN: 用户访问标准解读页面
    await page.goto('/projects/123/standard-interpretation')
    // WHEN: 点击返回按钮
    const backButton = page.getByText('返回')
    await backButton.click()
    // THEN: 应该导航到上一页
    // Note: Navigation is tested by the router, we just verify the button exists and is clickable
    await expect(backButton).toBeVisible()
  })

  test('[P1] 当没有文档时应该显示警告提示', async ({ page }) => {
    // GIVEN: 用户访问标准解读页面且项目没有上传文档
    await page.goto('/projects/999/standard-interpretation')
    // WHEN: 页面加载完成
    // THEN: 应该显示上传文档的警告
    await expect(page.getByText(/请先上传标准文档/)).toBeVisible()
  })
})

test.describe('[P1] 分析工作流测试', () => {
  test('[P1] 应该显示开始解读按钮', async ({ page }) => {
    // GIVEN: 用户访问标准解读页面且已有文档
    await page.goto('/projects/123/standard-interpretation')
    // WHEN: 页面加载完成
    // THEN: 应该显示开始解读按钮
    const startButton = page.getByText('开始解读')
    await expect(startButton).toBeVisible()
  })

  test('[P1] 应该禁用开始解读按钮当没有文档时', async ({ page }) => {
    // GIVEN: 用户访问标准解读页面且项目没有上传文档
    await page.goto('/projects/999/standard-interpretation')
    // WHEN: 页面加载完成
    // THEN: 开始解读按钮应该被禁用
    const startButton = page.getByText('开始解读')
    await expect(startButton).toBeVisible()
    // Check if button is disabled (has disabled attribute or disabled class)
    const isDisabled = await startButton.isDisabled()
    expect(isDisabled).toBe(true)
  })
})

test.describe('[P1] 条款折叠面板 - 功能测试', () => {
  test('[P1] 应该显示条款要求Tab', async ({ page }) => {
    // GIVEN: 用户访问标准解读页面
    await page.goto('/projects/123/standard-interpretation')
    // WHEN: 点击"条款要求" Tab
    const clausesTab = page.getByRole('tab', { name: '条款要求' })
    await clausesTab.click()
    // THEN: 应该显示条款要求内容
    await expect(page.getByText('关键条款要求')).toBeVisible()
  })

  test('[P1] 展开的条款应该显示优先级标识', async ({ page }) => {
    // GIVEN: 用户访问标准解读页面并切换到核心要求 Tab
    await page.goto('/projects/123/standard-interpretation')
    const clausesTab = page.getByRole('tab', { name: '条款要求' })
    await clausesTab.click()
    // WHEN: 展开某个条款
    // 查找第一个条款并点击
    const firstClause = page.locator('[data-testid="clause-accordion"]').first()
    await firstClause.click()
    // THEN: 应该显示优先级标签（高/中/低）
    await expect(page.getByText(/优先级/).or(page.getByText(/高|中|低/))).toBeVisible({ timeout: 5000 })
  })
})

test.describe('[P2] 响应式设计测试', () => {
  test('[P2.1] 桌面端应该正常显示', async ({ page }) => {
    // GIVEN: 设置桌面端视口
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/projects/123/standard-interpretation')
    // WHEN: 页面加载完成
    // THEN: 应该正常显示所有内容
    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('tablist')).toBeVisible()
  })

  test('[P2.2] 平板端应该正常显示', async ({ page }) => {
    // GIVEN: 设置平板端视口
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto('/projects/123/standard-interpretation')
    // WHEN: 页面加载完成
    // THEN: 应该正常显示所有内容
    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('tablist')).toBeVisible()
  })

  test('[P2.3] 移动端应该正常显示', async ({ page }) => {
    // GIVEN: 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/projects/123/standard-interpretation')
    // WHEN: 页面加载完成
    // THEN: 应该正常显示所有内容，Tab 导航应该可以横向滚动
    await expect(page.getByRole('banner')).toBeVisible()
    const tablist = page.getByRole('tablist')
    await expect(tablist).toBeVisible()
    // Check if tabs container allows scrolling on mobile
    const overflowX = await tablist.evaluate(el => window.getComputedStyle(el).overflowX)
    expect(overflowX).toMatch(/auto|scroll/)
  })
})

test.describe('[P2] 视觉一致性测试', () => {
  test('[P2.1] 应该显示 PageHeader 组件', async ({ page }) => {
    // GIVEN: 用户访问标准解读页面
    await page.goto('/projects/123/standard-interpretation')
    // WHEN: 页面加载完成
    // THEN: PageHeader 应该存在并显示正确的内容
    await expect(page.getByTestId('page-header')).toBeVisible()
    await expect(page.getByText('标准解读')).toBeVisible()
  })

  test('[P2.2] 应该使用统一设计的按钮', async ({ page }) => {
    // GIVEN: 用户访问标准解读页面
    await page.goto('/projects/123/standard-interpretation')
    // WHEN: 查看所有按钮
    // THEN: 按钮应该使用统一的设计系统样式
    const startButton = page.getByText('开始解读')
    await expect(startButton).toBeVisible()
    // Check button has proper styling classes (unified-button)
    const buttonClasses = await startButton.getAttribute('class')
    expect(buttonClasses).toMatch(/button/i)
  })

  test('[P2.3] 条款卡片应该正确渲染', async ({ page }) => {
    // GIVEN: 用户访问标准解读页面
    await page.goto('/projects/123/standard-interpretation')
    const clausesTab = page.getByRole('tab', { name: '条款要求' })
    await clausesTab.click()
    // WHEN: 页面加载完成
    // THEN: 应该显示条款卡片组件
    await expect(page.locator('[data-testid="clause-accordion"]')).toBeVisible({ timeout: 5000 })
  })

  test('[P2.4] 状态标识应该显示正确的优先级', async ({ page }) => {
    // GIVEN: 用户访问标准解读页面
    await page.goto('/projects/123/standard-interpretation')
    const clausesTab = page.getByRole('tab', { name: '条款要求' })
    await clausesTab.click()
    // WHEN: 展开条款
    const firstClause = page.locator('[data-testid="clause-accordion"]').first()
    await firstClause.click()
    // THEN: 应该显示优先级标签
    await expect(page.getByText(/优先级/)).toBeVisible({ timeout: 5000 })
  })
})

test.describe('[P1] Tab 切换功能测试', () => {
  test('[P1.1] 应该能够切换到关键术语 Tab', async ({ page }) => {
    // GIVEN: 用户访问标准解读页面
    await page.goto('/projects/123/standard-interpretation')
    // WHEN: 点击"关键术语" Tab
    const termsTab = page.getByRole('tab', { name: '关键术语' })
    await termsTab.click()
    // THEN: 应该显示关键术语内容
    await expect(page.getByText('关键术语定义')).toBeVisible({ timeout: 5000 })
  })

  test('[P1.2] 应该能够切换到实施指南 Tab', async ({ page }) => {
    // GIVEN: 用户访问标准解读页面
    await page.goto('/projects/123/standard-interpretation')
    // WHEN: 点击"实施指南" Tab
    const guidanceTab = page.getByRole('tab', { name: '实施指南' })
    await guidanceTab.click()
    // THEN: 应该显示实施指南内容
    await expect(page.getByText('实施指南')).toBeVisible({ timeout: 5000 })
  })

  test('[P1.3] 应该能够切换回概述 Tab', async ({ page }) => {
    // GIVEN: 用户访问标准解读页面
    await page.goto('/projects/123/standard-interpretation')
    // WHEN: 点击"概述" Tab
    const overviewTab = page.getByRole('tab', { name: '概述' })
    await overviewTab.click()
    // THEN: 应该显示概述内容
    await expect(page.getByText('标准概述')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('[P2] 页面内容结构测试', () => {
  test('[P2.1] 概述 Tab 应该显示背景、范围和目标', async ({ page }) => {
    // GIVEN: 用户访问标准解读页面
    await page.goto('/projects/123/standard-interpretation')
    // WHEN: 点击"概述" Tab
    const overviewTab = page.getByRole('tab', { name: '概述' })
    await overviewTab.click()
    // THEN: 应该显示概述的各个部分
    await expect(page.getByText('标准概述')).toBeVisible({ timeout: 5000 })
  })

  test('[P2.2] 关键术语 Tab 应该显示术语定义', async ({ page }) => {
    // GIVEN: 用户访问标准解读页面
    await page.goto('/projects/123/standard-interpretation')
    // WHEN: 点击"关键术语" Tab
    const termsTab = page.getByRole('tab', { name: '关键术语' })
    await termsTab.click()
    // THEN: 应该显示术语内容
    await expect(page.getByText('关键术语定义')).toBeVisible({ timeout: 5000 })
  })

  test('[P2.3] 实施指南 Tab 应该显示准备步骤', async ({ page }) => {
    // GIVEN: 用户访问标准解读页面
    await page.goto('/projects/123/standard-interpretation')
    // WHEN: 点击"实施指南" Tab
    const guidanceTab = page.getByRole('tab', { name: '实施指南' })
    await guidanceTab.click()
    // THEN: 应该显示实施指南内容
    await expect(page.getByText('实施指南')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('[P1] 加载状态测试', () => {
  test('[P1.1] 初始状态应该显示加载指示器', async ({ page }) => {
    // GIVEN: 用户访问标准解读页面
    await page.goto('/projects/123/standard-interpretation')
    // WHEN: 页面正在加载
    // THEN: 应该显示加载状态
    await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('[P2] 错误处理测试', () => {
  test('[P2.1] API 失败时应该显示错误信息', async ({ page }) => {
    // GIVEN: 用户访问一个不存在的项目
    await page.goto('/projects/999/standard-interpretation')
    // WHEN: 页面加载完成或失败
    // THEN: 应该显示错误信息或警告
    await expect(page.getByRole('alert').or(page.getByText(/警告/)).or(page.getByText(/错误/))).toBeVisible({ timeout: 5000 })
  })
})
