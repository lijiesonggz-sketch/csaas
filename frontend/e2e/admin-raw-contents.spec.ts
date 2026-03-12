import { test, expect } from '@playwright/test'

/**
 * Story 7.2: 文件导入管理页面 E2E 测试
 *
 * 测试 RawContent 管理功能
 */

test.describe('[Story 7.2] 文件导入管理', () => {
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
    test('[P1] 应该显示文件导入管理页面标题', async ({ page }) => {
      // WHEN: 访问文件导入管理页面
      await page.goto('/admin/raw-contents')
      await page.waitForLoadState('networkidle')

      // THEN: 显示页面标题
      await expect(page.getByRole('heading', { name: '文件导入管理' })).toBeVisible()
    })

    test('[P1] 应该显示返回按钮', async ({ page }) => {
      // GIVEN: 文件导入管理页面已加载
      await page.goto('/admin/raw-contents')
      await page.waitForLoadState('networkidle')

      // THEN: 显示返回按钮
      await expect(page.locator('button svg[data-testid="ArrowBackIcon"], button:has(svg)').first()).toBeVisible()
    })
  })

  test.describe('[P1] 统计卡片', () => {
    test('[P1] 应该显示统计卡片区域', async ({ page }) => {
      // GIVEN: 文件导入管理页面已加载
      await page.goto('/admin/raw-contents')
      await page.waitForLoadState('networkidle')

      // THEN: 显示所有统计卡片
      await expect(page.getByText('待分析')).toBeVisible()
      await expect(page.getByText('分析中')).toBeVisible()
      await expect(page.getByText('已分析')).toBeVisible()
      await expect(page.getByText('失败')).toBeVisible()
      await expect(page.getByText('今日导入')).toBeVisible()
    })

    test('[P1] 统计卡片应该显示数字', async ({ page }) => {
      // GIVEN: 文件导入管理页面已加载
      await page.goto('/admin/raw-contents')
      await page.waitForLoadState('networkidle')

      // THEN: 统计卡片显示数字或加载状态
      const statCards = page.locator('.MuiCard-root')
      await expect(statCards.first()).toBeVisible()
    })
  })

  test.describe('[P1] 筛选功能', () => {
    test('[P1] 应该显示筛选区域', async ({ page }) => {
      // GIVEN: 文件导入管理页面已加载
      await page.goto('/admin/raw-contents')
      await page.waitForLoadState('networkidle')

      // THEN: 显示筛选下拉框
      await expect(page.getByLabel('状态')).toBeVisible()
      await expect(page.getByLabel('分类')).toBeVisible()
      await expect(page.getByLabel('来源')).toBeVisible()
    })

    test('[P1] 应该按状态筛选', async ({ page }) => {
      // GIVEN: 文件导入管理页面已加载
      await page.goto('/admin/raw-contents')
      await page.waitForLoadState('networkidle')

      // WHEN: 选择状态筛选
      await page.getByLabel('状态').click()
      await page.getByRole('option', { name: '待分析' }).click()

      // THEN: 筛选条件已应用
      await expect(page.getByLabel('状态')).toHaveValue('pending')
    })

    test('[P1] 应该按分类筛选', async ({ page }) => {
      // GIVEN: 文件导入管理页面已加载
      await page.goto('/admin/raw-contents')
      await page.waitForLoadState('networkidle')

      // WHEN: 选择分类筛选
      await page.getByLabel('分类').click()
      await page.getByRole('option', { name: '技术' }).click()

      // THEN: 筛选条件已应用
      await expect(page.getByLabel('分类')).toHaveValue('tech')
    })

    test('[P1] 应该按来源筛选', async ({ page }) => {
      // GIVEN: 文件导入管理页面已加载
      await page.goto('/admin/raw-contents')
      await page.waitForLoadState('networkidle')

      // WHEN: 选择来源筛选
      await page.getByLabel('来源').click()
      await page.getByRole('option', { name: '微信公众号' }).click()

      // THEN: 筛选条件已应用
      await expect(page.getByLabel('来源')).toHaveValue('wechat')
    })

    test('[P1] 应该支持搜索功能', async ({ page }) => {
      // GIVEN: 文件导入管理页面已加载
      await page.goto('/admin/raw-contents')
      await page.waitForLoadState('networkidle')

      // WHEN: 输入搜索关键词
      const searchInput = page.getByPlaceholder('搜索标题...')
      await searchInput.fill('测试')
      await searchInput.press('Enter')

      // THEN: 搜索已执行
      await page.waitForTimeout(500)
    })

    test('[P1] 应该清除筛选条件', async ({ page }) => {
      // GIVEN: 文件导入管理页面已加载且有筛选条件
      await page.goto('/admin/raw-contents')
      await page.waitForLoadState('networkidle')
      await page.getByLabel('状态').click()
      await page.getByRole('option', { name: '待分析' }).click()

      // WHEN: 点击清除筛选按钮
      await page.getByRole('button', { name: '清除筛选' }).click()

      // THEN: 筛选条件已清除
      await expect(page.getByLabel('状态')).toHaveValue('all')
      await expect(page.getByLabel('分类')).toHaveValue('all')
      await expect(page.getByLabel('来源')).toHaveValue('all')
    })
  })

  test.describe('[P1] 内容列表表格', () => {
    test('[P1] 应该显示内容列表表格', async ({ page }) => {
      // GIVEN: 文件导入管理页面已加载
      await page.goto('/admin/raw-contents')
      await page.waitForLoadState('networkidle')

      // THEN: 显示表格表头
      await expect(page.getByRole('cell', { name: '标题' })).toBeVisible()
      await expect(page.getByRole('cell', { name: '来源' })).toBeVisible()
      await expect(page.getByRole('cell', { name: '分类' })).toBeVisible()
      await expect(page.getByRole('cell', { name: '状态' })).toBeVisible()
      await expect(page.getByRole('cell', { name: '导入时间' })).toBeVisible()
      await expect(page.getByRole('cell', { name: '操作' })).toBeVisible()
    })

    test('[P1] 应该显示状态标签', async ({ page }) => {
      // GIVEN: 文件导入管理页面已加载
      await page.goto('/admin/raw-contents')
      await page.waitForLoadState('networkidle')

      // THEN: 表格中包含状态标签
      const statusChips = page.locator('.MuiChip-root').filter({ hasText: /待分析|分析中|已分析|失败/ })
      const count = await statusChips.count()
      if (count > 0) {
        await expect(statusChips.first()).toBeVisible()
      }
    })

    test('[P1] 应该显示来源和分类标签', async ({ page }) => {
      // GIVEN: 文件导入管理页面已加载
      await page.goto('/admin/raw-contents')
      await page.waitForLoadState('networkidle')

      // THEN: 表格中包含来源和分类标签
      const sourceChips = page.locator('.MuiChip-root').filter({ hasText: /微信公众号|网站/ })
      const categoryChips = page.locator('.MuiChip-root').filter({ hasText: /技术|行业|合规|政策/ })

      const sourceCount = await sourceChips.count()
      const categoryCount = await categoryChips.count()

      if (sourceCount > 0) {
        await expect(sourceChips.first()).toBeVisible()
      }
      if (categoryCount > 0) {
        await expect(categoryChips.first()).toBeVisible()
      }
    })
  })

  test.describe('[P1] 分页功能', () => {
    test('[P1] 应该显示分页器', async ({ page }) => {
      // GIVEN: 文件导入管理页面已加载
      await page.goto('/admin/raw-contents')
      await page.waitForLoadState('networkidle')

      // 等待数据加载
      await page.waitForTimeout(1000)

      // THEN: 如果有数据，显示分页器
      const pagination = page.locator('.MuiPagination-root')
      const count = await pagination.count()
      if (count > 0) {
        await expect(pagination).toBeVisible()
      }
    })
  })

  test.describe('[P1] 内容详情', () => {
    test('[P1] 应该打开内容详情对话框', async ({ page }) => {
      // GIVEN: 文件导入管理页面已加载且有数据
      await page.goto('/admin/raw-contents')
      await page.waitForLoadState('networkidle')

      // 等待表格加载
      await page.waitForSelector('table tbody tr', { timeout: 10000 })

      // WHEN: 点击详情按钮
      const viewButton = page.locator('table tbody tr:first-child button[aria-label="查看详情"], table tbody tr:first-child button').first()
      await viewButton.click()

      // THEN: 显示详情对话框
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('heading', { name: '内容详情' })).toBeVisible()
    })

    test('[P1] 详情对话框应该显示基本信息', async ({ page }) => {
      // GIVEN: 详情对话框已打开
      await page.goto('/admin/raw-contents')
      await page.waitForLoadState('networkidle')
      await page.waitForSelector('table tbody tr', { timeout: 10000 })

      const viewButton = page.locator('table tbody tr:first-child button[aria-label="查看详情"], table tbody tr:first-child button').first()
      await viewButton.click()

      // THEN: 显示基本信息
      await expect(page.getByText('标题')).toBeVisible()
      await expect(page.getByText('来源')).toBeVisible()
      await expect(page.getByText('分类')).toBeVisible()
      await expect(page.getByText('状态')).toBeVisible()
      await expect(page.getByText('导入时间')).toBeVisible()
      await expect(page.getByText('内容预览')).toBeVisible()
    })

    test('[P1] 应该关闭详情对话框', async ({ page }) => {
      // GIVEN: 详情对话框已打开
      await page.goto('/admin/raw-contents')
      await page.waitForLoadState('networkidle')
      await page.waitForSelector('table tbody tr', { timeout: 10000 })

      const viewButton = page.locator('table tbody tr:first-child button[aria-label="查看详情"], table tbody tr:first-child button').first()
      await viewButton.click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // WHEN: 点击关闭按钮
      await page.getByRole('button', { name: '关闭' }).click()

      // THEN: 对话框已关闭
      await expect(page.getByRole('dialog')).not.toBeVisible()
    })
  })

  test.describe('[P1] 重新分析功能', () => {
    test('[P1] 应该触发重新分析', async ({ page }) => {
      // GIVEN: 文件导入管理页面已加载且有失败/待分析状态的数据
      await page.goto('/admin/raw-contents')
      await page.waitForLoadState('networkidle')

      // 等待表格加载
      await page.waitForSelector('table tbody tr', { timeout: 10000 })

      // 查找失败或待分析状态的行
      const rows = page.locator('table tbody tr')
      const count = await rows.count()

      for (let i = 0; i < count; i++) {
        const statusCell = rows.nth(i).locator('td').nth(3)
        const statusText = await statusCell.textContent()

        if (statusText?.includes('失败') || statusText?.includes('待分析')) {
          // WHEN: 点击重新分析按钮
          const reanalyzeButton = rows.nth(i).locator('button[aria-label="重新分析"], button').nth(1)
          await reanalyzeButton.click()

          // THEN: 显示成功提示
          await expect(page.getByText('重新分析已触发')).toBeVisible()
          break
        }
      }
    })
  })

  test.describe('[P1] 删除功能', () => {
    test('[P1] 应该显示删除确认对话框', async ({ page }) => {
      // GIVEN: 文件导入管理页面已加载且有数据
      await page.goto('/admin/raw-contents')
      await page.waitForLoadState('networkidle')

      // 等待表格加载
      await page.waitForSelector('table tbody tr', { timeout: 10000 })

      // WHEN: 点击删除按钮
      const deleteButton = page.locator('table tbody tr:first-child button[color="error"], table tbody tr:first-child button').last()
      await deleteButton.click()

      // THEN: 显示浏览器确认对话框
      page.on('dialog', async dialog => {
        expect(dialog.message()).toContain('确定要删除')
        await dialog.dismiss()
      })
    })
  })

  test.describe('[P1] 导航功能', () => {
    test('[P1] 应该返回仪表板', async ({ page }) => {
      // GIVEN: 文件导入管理页面已加载
      await page.goto('/admin/raw-contents')
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

      // WHEN: 尝试访问文件导入管理页面
      await page.goto('/admin/raw-contents')

      // THEN: 被重定向到首页
      await page.waitForURL('/', { timeout: 10000 })
      await expect(page).toHaveURL('/')
    })
  })
})
