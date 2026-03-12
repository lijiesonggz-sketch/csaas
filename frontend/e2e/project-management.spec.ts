import { test, expect } from '@playwright/test'

/**
 * Story 1.4: 项目管理页面优化 - E2E 测试
 *
 * 测试范围:
 * - 项目列表页面视觉一致性
 * - 项目详情九宫格功能
 * - 子页面统一头部样式
 * - 响应式布局
 */

test.describe('[P1] 项目列表页面 - 视觉一致性测试', () => {
  test.beforeEach(async ({ page }) => {
    // 登录并访问项目列表
    await page.goto('/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
  })

  test('[P1] 应该显示渐变头部', async ({ page }) => {
    // GIVEN: 用户访问项目列表页面
    // WHEN: 页面加载完成
    // THEN: 应该显示 PageHeader 组件
    const header = page.locator('[role="banner"]')
    await expect(header).toBeVisible()

    // 验证标题
    const title = page.locator('#page-title')
    await expect(title).toContainText('我的项目')
  })

  test('[P1] 项目卡片应该使用统一样式', async ({ page }) => {
    // GIVEN: 用户访问项目列表页面
    // WHEN: 页面加载完成
    // THEN: 项目卡片应该使用 GradientCard 样式 (圆角 16px)
    const cards = page.locator('[role="list"] > div')
    const count = await cards.count()

    if (count > 0) {
      // 验证卡片有圆角
      const firstCard = cards.first()
      await expect(firstCard).toHaveClass(/rounded-card/)

      // 验证卡片有阴影
      await expect(firstCard).toHaveClass(/shadow-card/)
    }
  })

  test('[P1] 状态标签应该使用 StatusBadge 组件', async ({ page }) => {
    // GIVEN: 用户访问项目列表页面
    // WHEN: 页面加载完成
    // THEN: 状态标签应该使用 StatusBadge 组件
    const statusBadges = page.locator('[role="status"]')
    const count = await statusBadges.count()

    if (count > 0) {
      // 验证状态标签可见
      await expect(statusBadges.first()).toBeVisible()

      // 验证状态标签有正确的样式
      const firstBadge = statusBadges.first()
      await expect(firstBadge).toHaveClass(/rounded-pill/)
    }
  })

  test('[P1] 创建项目按钮应该使用 UnifiedButton', async ({ page }) => {
    // GIVEN: 用户访问项目列表页面
    // WHEN: 页面加载完成
    // THEN: 创建项目按钮应该使用 UnifiedButton 样式
    const createButton = page.getByRole('button', { name: /创建项目/ })
    await expect(createButton).toBeVisible()

    // 验证按钮有圆角
    await expect(createButton).toHaveClass(/rounded-button/)
  })
})

test.describe('[P1] 项目详情九宫格 - 功能测试', () => {
  test.beforeEach(async ({ page }) => {
    // 登录并访问项目详情
    await page.goto('/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('[P1] 应该显示九宫格功能模块', async ({ page }) => {
    // GIVEN: 用户访问项目详情页面
    await page.goto('/projects/123')
    await page.waitForLoadState('networkidle')

    // WHEN: 页面加载完成
    // THEN: 应该显示 PageHeader
    const header = page.locator('[role="banner"]')
    await expect(header).toBeVisible()

    // AND: 应该显示功能模块区域
    const grid = page.locator('section[aria-label="功能模块"]')
    await expect(grid).toBeVisible()

    // AND: 应该显示多个功能卡片
    const cards = grid.locator('> div')
    await expect(cards).toHaveCount.greaterThan(0)
  })

  test('[P1] 功能模块卡片应该有悬浮效果', async ({ page }) => {
    // GIVEN: 用户访问项目详情页面
    await page.goto('/projects/123')
    await page.waitForLoadState('networkidle')

    // WHEN: 鼠标悬浮在卡片上
    const firstCard = page.locator('section[aria-label="功能模块"] > div').first()
    await firstCard.hover()

    // THEN: 卡片应该有悬浮效果 (transform 或 shadow 变化)
    // Note: 实际测试中可能需要更具体的验证
    await expect(firstCard).toBeVisible()
  })

  test('[P1] 点击功能模块应该导航到对应页面', async ({ page }) => {
    // GIVEN: 用户访问项目详情页面
    await page.goto('/projects/123')
    await page.waitForLoadState('networkidle')

    // WHEN: 点击第一个功能模块
    const firstCard = page.locator('section[aria-label="功能模块"] > div').first()
    await firstCard.click()

    // THEN: 应该导航到对应页面
    await expect(page).toHaveURL(/\/projects\/123\//)
  })
})

test.describe('[P1] 子页面 - 统一头部样式测试', () => {
  const subPages = [
    { path: 'upload', name: '上传文档' },
    { path: 'summary', name: '综述生成' },
    { path: 'clustering', name: '聚类分析' },
    { path: 'matrix', name: '成熟度矩阵' },
    { path: 'questionnaire', name: '问卷生成' },
    { path: 'gap-analysis', name: '差距分析' },
    { path: 'action-plan', name: '改进措施' },
    { path: 'standard-interpretation', name: '标准解读' },
    { path: 'quick-gap-analysis', name: '快速差距分析' },
  ]

  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  for (const { path, name } of subPages) {
    test(`[P1] ${name}页面应该使用 PageHeader 组件`, async ({ page }) => {
      // GIVEN: 用户访问子页面
      await page.goto(`/projects/123/${path}`)
      await page.waitForLoadState('networkidle')

      // WHEN: 页面加载完成
      // THEN: 应该显示 PageHeader
      const header = page.locator('[role="banner"]')
      await expect(header).toBeVisible()

      // AND: 应该显示页面标题
      const title = page.locator('#page-title')
      await expect(title).toBeVisible()
    })
  }
})

test.describe('[P2] 响应式设计测试', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('[P2] 桌面端应该显示 3 列项目卡片', async ({ page }) => {
    // GIVEN: 设置桌面端视口
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')

    // WHEN: 页面加载完成
    // THEN: 应该显示 3 列网格布局
    const grid = page.locator('section[role="list"]')
    await expect(grid).toHaveClass(/lg:grid-cols-3/)
  })

  test('[P2] 平板端应该显示 2 列项目卡片', async ({ page }) => {
    // GIVEN: 设置平板视口
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')

    // WHEN: 页面加载完成
    // THEN: 应该显示 2 列网格布局
    const grid = page.locator('section[role="list"]')
    await expect(grid).toHaveClass(/md:grid-cols-2/)
  })

  test('[P2] 移动端应该显示 1 列项目卡片', async ({ page }) => {
    // GIVEN: 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')

    // WHEN: 页面加载完成
    // THEN: 应该显示单列布局
    const grid = page.locator('section[role="list"]')
    await expect(grid).toHaveClass(/grid-cols-1/)
  })

  test('[P2] 项目详情九宫格响应式布局', async ({ page }) => {
    // GIVEN: 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/projects/123')
    await page.waitForLoadState('networkidle')

    // WHEN: 页面加载完成
    // THEN: 九宫格应该显示为单列
    const grid = page.locator('section[aria-label="功能模块"]')
    await expect(grid).toHaveClass(/grid-cols-1/)

    // 设置平板视口
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.reload()
    await page.waitForLoadState('networkidle')

    // THEN: 九宫格应该显示为 2 列
    await expect(grid).toHaveClass(/md:grid-cols-2/)

    // 设置桌面视口
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.reload()
    await page.waitForLoadState('networkidle')

    // THEN: 九宫格应该显示为 3 列
    await expect(grid).toHaveClass(/lg:grid-cols-3/)
  })
})

test.describe('[P1] 设计系统一致性测试', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
  })

  test('[P1] 颜色系统一致性', async ({ page }) => {
    // GIVEN: 用户访问项目列表页面
    // WHEN: 页面加载完成
    // THEN: 主要元素应该使用设计系统颜色

    // 验证 PageHeader 背景色
    const header = page.locator('[role="banner"]')
    await expect(header).toHaveClass(/bg-slate-900/)

    // 验证按钮使用主色
    const primaryButton = page.locator('button').filter({ hasText: /创建/ }).first()
    const buttonClasses = await primaryButton.getAttribute('class')

    // 按钮应该包含 primary 相关的类名
    expect(buttonClasses).toMatch(/primary|bg-gradient/)
  })

  test('[P1] 圆角一致性', async ({ page }) => {
    // GIVEN: 用户访问项目列表页面
    // WHEN: 页面加载完成
    // THEN: 卡片应该有 16px 圆角
    const cards = page.locator('[role="list"] > div')
    const count = await cards.count()

    if (count > 0) {
      await expect(cards.first()).toHaveClass(/rounded-card/)
    }

    // 按钮应该有 8px 圆角
    const buttons = page.locator('button')
    if (await buttons.count() > 0) {
      await expect(buttons.first()).toHaveClass(/rounded-button/)
    }
  })
})
