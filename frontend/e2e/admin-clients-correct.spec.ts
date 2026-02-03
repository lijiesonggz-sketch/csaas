import { test, expect } from '@playwright/test'

/**
 * Story 6.2: 咨询公司批量客户管理后台 - E2E 测试
 *
 * 正确的测试方式：使用页面实际的可访问性选择器，而不是添加 data-testid
 */

test.describe('[Story 6.2] 客户管理后台 - 正确的测试方式', () => {
  // 测试前登录
  test.beforeEach(async ({ page }) => {
    // GIVEN: 访问登录页面
    await page.goto('/login')

    // WHEN: 使用实际的 placeholder 来定位输入框
    await page.getByPlaceholder('邮箱').fill('admin@test.com')
    await page.getByPlaceholder('密码').fill('admin123')

    // AND: 点击登录按钮（使用按钮文本）
    await page.getByRole('button', { name: '登 录' }).click()

    // THEN: 等待跳转到 dashboard
    await page.waitForURL('/dashboard')
  })

  test.describe('[P1] AC1: 客户列表视图', () => {
    test('[P1] 应该显示客户管理页面标题和客户列表', async ({ page }) => {
      // GIVEN: 管理员已登录
      // WHEN: 访问客户管理页面
      await page.goto('/admin/clients')

      // THEN: 显示页面标题（使用 heading role）
      await expect(page.getByRole('heading', { name: '客户管理', level: 1 })).toBeVisible()

      // AND: 显示统计信息
      await expect(page.getByText('总客户数')).toBeVisible()
      await expect(page.getByText('活跃客户')).toBeVisible()
      await expect(page.getByText('试用客户')).toBeVisible()

      // AND: 显示客户卡片（通过客户名称定位）
      await expect(page.getByText('测试银行A')).toBeVisible()
      await expect(page.getByText('测试银行B')).toBeVisible()
      await expect(page.getByText('测试保险公司')).toBeVisible()
    })

    test('[P1] 应该支持按状态筛选客户', async ({ page }) => {
      // GIVEN: 客户列表页面已加载
      await page.goto('/admin/clients')
      await page.waitForLoadState('networkidle')

      // WHEN: 点击状态筛选器
      await page.getByRole('combobox', { name: '状态' }).click()

      // AND: 选择"活跃"选项（使用 role='option' 来精确定位下拉选项）
      await page.getByRole('option', { name: '活跃' }).click()

      // 等待筛选生效
      await page.waitForTimeout(500)

      // THEN: 只显示活跃状态的客户
      await expect(page.getByText('测试银行A')).toBeVisible()
      await expect(page.getByText('测试保险公司')).toBeVisible()

      // AND: 不显示试用状态的客户
      await expect(page.getByText('测试银行B')).not.toBeVisible()
    })

    test('[P1] 应该支持按行业类型筛选客户', async ({ page }) => {
      // GIVEN: 客户列表页面已加载
      await page.goto('/admin/clients')
      await page.waitForLoadState('networkidle')

      // WHEN: 点击行业类型筛选器
      await page.getByRole('combobox', { name: '行业类型' }).click()

      // AND: 选择"银行"选项（使用 role='option' 来精确定位下拉选项）
      await page.getByRole('option', { name: '银行' }).click()

      // 等待筛选生效
      await page.waitForTimeout(500)

      // THEN: 只显示银行业客户
      await expect(page.getByText('测试银行A')).toBeVisible()
      await expect(page.getByText('测试银行B')).toBeVisible()

      // AND: 不显示其他行业客户
      await expect(page.getByText('测试保险公司')).not.toBeVisible()
    })

    test('[P1] 应该支持搜索客户', async ({ page }) => {
      // GIVEN: 客户列表页面已加载
      await page.goto('/admin/clients')
      await page.waitForLoadState('networkidle')

      // WHEN: 在搜索框输入关键词
      await page.getByPlaceholder('搜索客户名称、联系人或邮箱').fill('测试银行A')

      // THEN: 只显示匹配的客户
      await expect(page.getByText('测试银行A')).toBeVisible()

      // AND: 不显示其他客户
      await expect(page.getByText('测试银行B')).not.toBeVisible()
      await expect(page.getByText('测试保险公司')).not.toBeVisible()
    })
  })

  test.describe('[P1] AC2 & AC3: 添加客户', () => {
    test('[P1] 应该打开添加客户弹窗并显示表单', async ({ page }) => {
      // GIVEN: 客户列表页面已加载
      await page.goto('/admin/clients')

      // WHEN: 点击"添加客户"按钮
      await page.getByRole('button', { name: '添加客户' }).click()

      // THEN: 显示添加客户对话框
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      // 使用对话框内的 heading 来验证标题
      await expect(dialog.getByRole('heading', { name: '添加客户' })).toBeVisible()

      // AND: 显示表单字段（在对话框内定位）
      await expect(dialog.getByLabel('客户名称')).toBeVisible()
      await expect(dialog.getByLabel('联系人姓名')).toBeVisible()
      await expect(dialog.getByLabel('联系人邮箱')).toBeVisible()
      await expect(dialog.getByLabel('行业类型')).toBeVisible()
      await expect(dialog.getByLabel('机构规模')).toBeVisible()
    })

    test('[P0] 应该成功创建客户', async ({ page }) => {
      // GIVEN: 添加客户弹窗已打开
      await page.goto('/admin/clients')
      await page.getByRole('button', { name: '添加客户' }).click()

      // 获取对话框定位器
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      // WHEN: 填写客户信息（在对话框内定位）
      await dialog.getByLabel('客户名称').fill('测试新银行')
      await dialog.getByLabel('联系人姓名').fill('测试联系人')
      await dialog.getByLabel('联系人邮箱').fill('test@newbank.com')

      // AND: 选择行业类型（在对话框内定位）
      await dialog.getByLabel('行业类型').click()
      await page.getByRole('option', { name: '银行' }).click()

      // AND: 选择机构规模（在对话框内定位）
      await dialog.getByLabel('机构规模').click()
      await page.getByRole('option', { name: '中型' }).click()

      // AND: 提交表单
      await dialog.getByRole('button', { name: '添加' }).click()

      // THEN: 等待对话框关闭（增加超时时间，因为需要等待API调用）
      await expect(dialog).not.toBeVisible({ timeout: 10000 })

      // AND: 客户列表中显示新客户（使用 first() 避免多个匹配）
      await expect(page.getByText('测试新银行').first()).toBeVisible({ timeout: 10000 })
    })
  })
})
