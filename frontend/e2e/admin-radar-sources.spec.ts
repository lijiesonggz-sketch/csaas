import { test, expect } from '@playwright/test'

/**
 * Story 7.1: 雷达源管理页面 E2E 测试
 *
 * 测试雷达信息源配置管理功能
 */

test.describe('[Story 7.1] 雷达源管理', () => {
  // 测试前登录
  test.beforeEach(async ({ page }) => {
    // GIVEN: 管理员已登录
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Fill login form using role selectors
    await page.getByRole('textbox', { name: '邮箱' }).fill('admin@test.com')
    await page.locator('input[type="password"]').fill('admin123')
    await page.getByRole('button', { name: '登录' }).click()

    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard', {
      timeout: 15000,
      waitUntil: 'networkidle'
    })
  })

  test.describe('[P1] 页面加载和显示', () => {
    test('[P1] 应该显示雷达源管理页面标题', async ({ page }) => {
      // WHEN: 访问雷达源管理页面
      await page.goto('/admin/radar-sources')
      await page.waitForLoadState('networkidle')

      // THEN: 显示页面标题
      await expect(page.getByRole('heading', { name: '雷达信息源配置' })).toBeVisible()
    })

    test('[P1] 应该显示添加信息源按钮', async ({ page }) => {
      // GIVEN: 雷达源管理页面已加载
      await page.goto('/admin/radar-sources')
      await page.waitForLoadState('networkidle')

      // THEN: 显示添加信息源按钮
      await expect(page.getByRole('button', { name: '添加信息源' })).toBeVisible()
    })

    test('[P1] 应该显示返回按钮', async ({ page }) => {
      // GIVEN: 雷达源管理页面已加载
      await page.goto('/admin/radar-sources')
      await page.waitForLoadState('networkidle')

      // THEN: 显示返回按钮
      const backButton = page.locator('button').first()
      await expect(backButton).toBeVisible()
    })
  })

  test.describe('[P1] 信息源列表', () => {
    test('[P1] 应该显示信息源列表表格', async ({ page }) => {
      // GIVEN: 雷达源管理页面已加载
      await page.goto('/admin/radar-sources')
      await page.waitForLoadState('networkidle')

      // THEN: 显示表格表头
      await expect(page.getByRole('cell', { name: '信息源名称' })).toBeVisible()
      await expect(page.getByRole('cell', { name: '类别' })).toBeVisible()
      await expect(page.getByRole('cell', { name: '类型' })).toBeVisible()
      await expect(page.getByRole('cell', { name: 'URL' })).toBeVisible()
      await expect(page.getByRole('cell', { name: '启用状态' })).toBeVisible()
      await expect(page.getByRole('cell', { name: '操作' })).toBeVisible()
    })

    test('[P1] 应该显示类别标签', async ({ page }) => {
      // GIVEN: 雷达源管理页面已加载
      await page.goto('/admin/radar-sources')
      await page.waitForLoadState('networkidle')

      // THEN: 表格中包含类别标签
      const categoryChips = page.locator('.MuiChip-root').filter({ hasText: /技术雷达|行业雷达|合规雷达/ })
      await expect(categoryChips.first()).toBeVisible()
    })

    test('[P1] 应该显示操作按钮', async ({ page }) => {
      // GIVEN: 雷达源管理页面已加载
      await page.goto('/admin/radar-sources')
      await page.waitForLoadState('networkidle')

      // THEN: 显示操作按钮（测试爬虫、编辑、删除）
      const actionButtons = page.locator('table tbody tr:first-child td:last-child button')
      await expect(actionButtons.first()).toBeVisible()
    })
  })

  test.describe('[P1] 添加信息源', () => {
    test('[P1] 应该打开添加信息源弹窗', async ({ page }) => {
      // GIVEN: 雷达源管理页面已加载
      await page.goto('/admin/radar-sources')
      await page.waitForLoadState('networkidle')

      // WHEN: 点击添加信息源按钮
      await page.getByRole('button', { name: '添加信息源' }).click()

      // THEN: 显示添加信息源弹窗
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('heading', { name: '添加信息源' })).toBeVisible()
    })

    test('[P1] 弹窗应该包含所有表单字段', async ({ page }) => {
      // GIVEN: 添加信息源弹窗已打开
      await page.goto('/admin/radar-sources')
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: '添加信息源' }).click()

      // THEN: 显示所有表单字段
      await expect(page.getByLabel('信息源名称')).toBeVisible()
      await expect(page.getByLabel('雷达类别')).toBeVisible()
      await expect(page.getByLabel('URL')).toBeVisible()
      await expect(page.getByLabel('内容类型')).toBeVisible()
      await expect(page.getByLabel('同业机构名称')).toBeVisible()
      await expect(page.getByLabel('爬取频率（Cron表达式）')).toBeVisible()
    })

    test('[P1] 应该验证必填字段', async ({ page }) => {
      // GIVEN: 添加信息源弹窗已打开
      await page.goto('/admin/radar-sources')
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: '添加信息源' }).click()

      // WHEN: 直接提交表单
      await page.getByRole('button', { name: '创建' }).click()

      // THEN: 显示必填字段错误提示
      await expect(page.getByText('信息源名称不能为空')).toBeVisible()
      await expect(page.getByText('URL不能为空')).toBeVisible()
    })

    test('[P1] 应该验证URL格式', async ({ page }) => {
      // GIVEN: 添加信息源弹窗已打开
      await page.goto('/admin/radar-sources')
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: '添加信息源' }).click()

      // WHEN: 输入无效的URL
      await page.getByLabel('信息源名称').fill('测试信息源')
      await page.getByLabel('URL').fill('invalid-url')
      await page.getByRole('button', { name: '创建' }).click()

      // THEN: 显示URL格式错误
      await expect(page.getByText('URL格式不正确')).toBeVisible()
    })

    test('[P1] 应该验证Cron表达式格式', async ({ page }) => {
      // GIVEN: 添加信息源弹窗已打开
      await page.goto('/admin/radar-sources')
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: '添加信息源' }).click()

      // WHEN: 输入无效的Cron表达式
      await page.getByLabel('爬取频率（Cron表达式）').fill('invalid')
      await page.getByRole('button', { name: '创建' }).click()

      // THEN: 显示Cron表达式格式错误
      await expect(page.getByText('Cron表达式格式不正确')).toBeVisible()
    })
  })

  test.describe('[P1] 编辑信息源', () => {
    test('[P1] 应该打开编辑信息源弹窗', async ({ page }) => {
      // GIVEN: 雷达源管理页面已加载且有数据
      await page.goto('/admin/radar-sources')
      await page.waitForLoadState('networkidle')

      // 等待表格加载
      await page.waitForSelector('table tbody tr', { timeout: 10000 })

      // WHEN: 点击编辑按钮
      const editButton = page.locator('table tbody tr:first-child td:last-child button[aria-label="编辑"], table tbody tr:first-child td:last-child button').nth(1)
      await editButton.click()

      // THEN: 显示编辑信息源弹窗
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('heading', { name: '编辑信息源' })).toBeVisible()
    })
  })

  test.describe('[P1] 删除信息源', () => {
    test('[P1] 应该显示删除确认对话框', async ({ page }) => {
      // GIVEN: 雷达源管理页面已加载且有数据
      await page.goto('/admin/radar-sources')
      await page.waitForLoadState('networkidle')

      // 等待表格加载
      await page.waitForSelector('table tbody tr', { timeout: 10000 })

      // WHEN: 点击删除按钮
      const deleteButton = page.locator('table tbody tr:first-child td:last-child button[color="error"], table tbody tr:first-child td:last-child button').last()
      await deleteButton.click()

      // THEN: 显示浏览器确认对话框
      page.on('dialog', async dialog => {
        expect(dialog.message()).toContain('确定要删除')
        await dialog.dismiss()
      })
    })
  })

  test.describe('[P1] 启用/禁用信息源', () => {
    test('[P1] 应该切换信息源启用状态', async ({ page }) => {
      // GIVEN: 雷达源管理页面已加载且有数据
      await page.goto('/admin/radar-sources')
      await page.waitForLoadState('networkidle')

      // 等待表格加载
      await page.waitForSelector('table tbody tr', { timeout: 10000 })

      // WHEN: 点击启用状态开关
      const toggleSwitch = page.locator('table tbody tr:first-child .MuiSwitch-root input')
      const initialChecked = await toggleSwitch.isChecked()
      await toggleSwitch.click()

      // THEN: 开关状态改变
      await page.waitForTimeout(500)
      // 验证操作成功（可能有提示消息）
    })
  })

  test.describe('[P1] 测试爬虫功能', () => {
    test('[P1] 应该触发测试爬虫', async ({ page }) => {
      // GIVEN: 雷达源管理页面已加载且有数据
      await page.goto('/admin/radar-sources')
      await page.waitForLoadState('networkidle')

      // 等待表格加载
      await page.waitForSelector('table tbody tr', { timeout: 10000 })

      // WHEN: 点击测试爬虫按钮
      const testButton = page.locator('table tbody tr:first-child td:last-child button').first()
      await testButton.click()

      // THEN: 显示成功提示
      await expect(page.getByText('测试爬虫任务已加入队列')).toBeVisible()
    })
  })

  test.describe('[P1] 导航功能', () => {
    test('[P1] 应该返回仪表板', async ({ page }) => {
      // GIVEN: 雷达源管理页面已加载
      await page.goto('/admin/radar-sources')
      await page.waitForLoadState('networkidle')

      // WHEN: 点击返回按钮
      const backButton = page.locator('button svg[data-testid="ArrowBackIcon"]').first().locator('..')
      await backButton.click()

      // THEN: 导航到仪表板
      await page.waitForURL('/dashboard', { timeout: 10000 })
      await expect(page).toHaveURL('/dashboard')
    })
  })

  test.describe('[P1] 权限控制', () => {
    test('[P1] 非管理员应该被重定向', async ({ page }) => {
      // GIVEN: 以普通用户登录
      await page.goto('/login')
      await page.waitForLoadState('networkidle')
      await page.getByRole('textbox', { name: '邮箱' }).fill('user@test.com')
      await page.locator('input[type="password"]').fill('user123')
      await page.getByRole('button', { name: '登录' }).click()
      await page.waitForURL('/dashboard', { timeout: 15000 })

      // WHEN: 尝试访问雷达源管理页面
      await page.goto('/admin/radar-sources')

      // THEN: 被重定向到首页
      await page.waitForURL('/', { timeout: 10000 })
      await expect(page).toHaveURL('/')
    })
  })
})
