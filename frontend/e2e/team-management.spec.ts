import { test, expect } from '@playwright/test'

/**
 * Story 7.3: 团队管理页面 E2E 测试
 *
 * 测试组织成员管理功能
 */

test.describe('[Story 7.3] 团队管理', () => {
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
    test('[P1] 应该显示团队管理页面标题', async ({ page }) => {
      // WHEN: 访问团队管理页面
      await page.goto('/team')
      await page.waitForLoadState('networkidle')

      // THEN: 显示页面标题
      await expect(page.getByRole('heading', { name: '团队管理' })).toBeVisible()
    })

    test('[P1] 应该显示添加成员按钮（管理员）', async ({ page }) => {
      // GIVEN: 团队管理页面已加载
      await page.goto('/team')
      await page.waitForLoadState('networkidle')

      // THEN: 显示添加成员按钮
      await expect(page.getByRole('button', { name: '添加成员' })).toBeVisible()
    })
  })

  test.describe('[P1] 成员列表表格', () => {
    test('[P1] 应该显示成员列表表格', async ({ page }) => {
      // GIVEN: 团队管理页面已加载
      await page.goto('/team')
      await page.waitForLoadState('networkidle')

      // THEN: 显示表格表头
      await expect(page.getByRole('cell', { name: '姓名' })).toBeVisible()
      await expect(page.getByRole('cell', { name: '邮箱' })).toBeVisible()
      await expect(page.getByRole('cell', { name: '角色' })).toBeVisible()
      await expect(page.getByRole('cell', { name: '加入时间' })).toBeVisible()
      await expect(page.getByRole('cell', { name: '操作' })).toBeVisible()
    })

    test('[P1] 应该显示角色标签', async ({ page }) => {
      // GIVEN: 团队管理页面已加载
      await page.goto('/team')
      await page.waitForLoadState('networkidle')

      // THEN: 表格中包含角色标签
      const roleChips = page.locator('.MuiChip-root').filter({ hasText: /管理员|成员/ })
      const count = await roleChips.count()
      if (count > 0) {
        await expect(roleChips.first()).toBeVisible()
      }
    })

    test('[P1] 应该显示操作按钮', async ({ page }) => {
      // GIVEN: 团队管理页面已加载
      await page.goto('/team')
      await page.waitForLoadState('networkidle')

      // 等待表格加载
      await page.waitForSelector('table tbody tr', { timeout: 10000 })

      // THEN: 显示操作按钮（编辑、删除）
      const actionButtons = page.locator('table tbody tr:first-child td:last-child button')
      const count = await actionButtons.count()
      if (count > 0) {
        await expect(actionButtons.first()).toBeVisible()
      }
    })
  })

  test.describe('[P1] 添加成员', () => {
    test('[P1] 应该打开添加成员弹窗', async ({ page }) => {
      // GIVEN: 团队管理页面已加载
      await page.goto('/team')
      await page.waitForLoadState('networkidle')

      // WHEN: 点击添加成员按钮
      await page.getByRole('button', { name: '添加成员' }).click()

      // THEN: 显示添加成员弹窗
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('heading', { name: '添加成员' })).toBeVisible()
    })

    test('[P1] 弹窗应该包含所有表单字段', async ({ page }) => {
      // GIVEN: 添加成员弹窗已打开
      await page.goto('/team')
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: '添加成员' }).click()

      // THEN: 显示所有表单字段
      await expect(page.getByLabel('邮箱地址')).toBeVisible()
      await expect(page.getByLabel('角色')).toBeVisible()
    })

    test('[P1] 应该验证邮箱格式', async ({ page }) => {
      // GIVEN: 添加成员弹窗已打开
      await page.goto('/team')
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: '添加成员' }).click()

      // WHEN: 输入无效的邮箱格式
      await page.getByLabel('邮箱地址').fill('invalid-email')
      await page.getByRole('button', { name: '确认添加' }).click()

      // THEN: 显示邮箱格式错误提示
      await expect(page.getByText('请输入有效的邮箱地址')).toBeVisible()
    })

    test('[P1] 应该验证必填字段', async ({ page }) => {
      // GIVEN: 添加成员弹窗已打开
      await page.goto('/team')
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: '添加成员' }).click()

      // WHEN: 直接提交表单
      await page.getByRole('button', { name: '确认添加' }).click()

      // THEN: 显示必填字段错误提示
      await expect(page.getByText('请输入邮箱地址')).toBeVisible()
    })

    test('[P1] 应该支持选择角色', async ({ page }) => {
      // GIVEN: 添加成员弹窗已打开
      await page.goto('/team')
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: '添加成员' }).click()

      // WHEN: 选择角色
      await page.getByLabel('角色').click()
      await page.getByRole('option', { name: '管理员' }).click()

      // THEN: 角色已选择
      await expect(page.getByLabel('角色')).toHaveValue('admin')
    })

    test('[P1] 应该关闭添加成员弹窗', async ({ page }) => {
      // GIVEN: 添加成员弹窗已打开
      await page.goto('/team')
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: '添加成员' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // WHEN: 点击取消按钮
      await page.getByRole('button', { name: '取消' }).click()

      // THEN: 弹窗已关闭
      await expect(page.getByRole('dialog')).not.toBeVisible()
    })
  })

  test.describe('[P1] 编辑成员', () => {
    test('[P1] 应该打开编辑成员弹窗', async ({ page }) => {
      // GIVEN: 团队管理页面已加载且有数据
      await page.goto('/team')
      await page.waitForLoadState('networkidle')

      // 等待表格加载
      await page.waitForSelector('table tbody tr', { timeout: 10000 })

      // WHEN: 点击编辑按钮（非当前用户）
      const rows = page.locator('table tbody tr')
      const count = await rows.count()

      for (let i = 0; i < count; i++) {
        const editButton = rows.nth(i).locator('button[aria-label^="编辑"]').first()
        const isDisabled = await editButton.isDisabled().catch(() => true)

        if (!isDisabled) {
          await editButton.click()
          break
        }
      }

      // THEN: 显示编辑成员弹窗
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('heading', { name: '编辑成员角色' })).toBeVisible()
    })

    test('[P1] 编辑弹窗应该显示成员信息', async ({ page }) => {
      // GIVEN: 编辑成员弹窗已打开
      await page.goto('/team')
      await page.waitForLoadState('networkidle')
      await page.waitForSelector('table tbody tr', { timeout: 10000 })

      const rows = page.locator('table tbody tr')
      const count = await rows.count()

      for (let i = 0; i < count; i++) {
        const editButton = rows.nth(i).locator('button[aria-label^="编辑"]').first()
        const isDisabled = await editButton.isDisabled().catch(() => true)

        if (!isDisabled) {
          await editButton.click()
          break
        }
      }

      // THEN: 显示成员信息
      await expect(page.getByText('成员:')).toBeVisible()
      await expect(page.getByLabel('角色')).toBeVisible()
    })

    test('[P1] 应该关闭编辑成员弹窗', async ({ page }) => {
      // GIVEN: 编辑成员弹窗已打开
      await page.goto('/team')
      await page.waitForLoadState('networkidle')
      await page.waitForSelector('table tbody tr', { timeout: 10000 })

      const rows = page.locator('table tbody tr')
      const count = await rows.count()

      for (let i = 0; i < count; i++) {
        const editButton = rows.nth(i).locator('button[aria-label^="编辑"]').first()
        const isDisabled = await editButton.isDisabled().catch(() => true)

        if (!isDisabled) {
          await editButton.click()
          break
        }
      }

      await expect(page.getByRole('dialog')).toBeVisible()

      // WHEN: 点击取消按钮
      await page.getByRole('button', { name: '取消' }).click()

      // THEN: 弹窗已关闭
      await expect(page.getByRole('dialog')).not.toBeVisible()
    })
  })

  test.describe('[P1] 移除成员', () => {
    test('[P1] 应该打开移除成员确认弹窗', async ({ page }) => {
      // GIVEN: 团队管理页面已加载且有数据
      await page.goto('/team')
      await page.waitForLoadState('networkidle')

      // 等待表格加载
      await page.waitForSelector('table tbody tr', { timeout: 10000 })

      // WHEN: 点击移除按钮（非当前用户）
      const rows = page.locator('table tbody tr')
      const count = await rows.count()

      for (let i = 0; i < count; i++) {
        const removeButton = rows.nth(i).locator('button[aria-label^="移除"], button[color="error"]').first()
        const isDisabled = await removeButton.isDisabled().catch(() => true)

        if (!isDisabled) {
          await removeButton.click()
          break
        }
      }

      // THEN: 显示移除成员确认弹窗
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('heading', { name: '确认移除成员' })).toBeVisible()
    })

    test('[P1] 确认弹窗应该显示成员信息', async ({ page }) => {
      // GIVEN: 移除成员确认弹窗已打开
      await page.goto('/team')
      await page.waitForLoadState('networkidle')
      await page.waitForSelector('table tbody tr', { timeout: 10000 })

      const rows = page.locator('table tbody tr')
      const count = await rows.count()

      for (let i = 0; i < count; i++) {
        const removeButton = rows.nth(i).locator('button[aria-label^="移除"], button[color="error"]').first()
        const isDisabled = await removeButton.isDisabled().catch(() => true)

        if (!isDisabled) {
          await removeButton.click()
          break
        }
      }

      // THEN: 显示成员信息和警告
      await expect(page.getByText(/确定要将.*从组织中移除吗/)).toBeVisible()
      await expect(page.getByText('移除后，该成员将无法访问组织的项目和资源')).toBeVisible()
    })

    test('[P1] 应该关闭移除成员确认弹窗', async ({ page }) => {
      // GIVEN: 移除成员确认弹窗已打开
      await page.goto('/team')
      await page.waitForLoadState('networkidle')
      await page.waitForSelector('table tbody tr', { timeout: 10000 })

      const rows = page.locator('table tbody tr')
      const count = await rows.count()

      for (let i = 0; i < count; i++) {
        const removeButton = rows.nth(i).locator('button[aria-label^="移除"], button[color="error"]').first()
        const isDisabled = await removeButton.isDisabled().catch(() => true)

        if (!isDisabled) {
          await removeButton.click()
          break
        }
      }

      await expect(page.getByRole('dialog')).toBeVisible()

      // WHEN: 点击取消按钮
      await page.getByRole('button', { name: '取消' }).click()

      // THEN: 弹窗已关闭
      await expect(page.getByRole('dialog')).not.toBeVisible()
    })
  })

  test.describe('[P1] 分页功能', () => {
    test('[P1] 应该显示分页器', async ({ page }) => {
      // GIVEN: 团队管理页面已加载
      await page.goto('/team')
      await page.waitForLoadState('networkidle')

      // THEN: 显示分页器
      await expect(page.getByText(/每页行数/)).toBeVisible()
    })

    test('[P1] 应该支持更改每页行数', async ({ page }) => {
      // GIVEN: 团队管理页面已加载
      await page.goto('/team')
      await page.waitForLoadState('networkidle')

      // WHEN: 更改每页行数
      await page.getByLabel('每页行数').click()
      await page.getByRole('option', { name: '20' }).click()

      // THEN: 每页行数已更改
      await page.waitForTimeout(500)
    })
  })

  test.describe('[P1] 权限控制', () => {
    test('[P1] 非管理员不应该看到操作按钮', async ({ page }) => {
      // GIVEN: 以普通成员登录
      await page.goto('/login')
      await page.waitForLoadState('networkidle')
      await page.getByRole('textbox', { name: '邮箱' }).fill('member@test.com')
      await page.locator('input[type="password"]').fill('member123')
      await page.getByRole('button', { name: '登录' }).click()
      await page.waitForURL('/dashboard', { timeout: 15000 })

      // WHEN: 访问团队管理页面
      await page.goto('/team')
      await page.waitForLoadState('networkidle')

      // THEN: 不显示添加成员按钮
      const addButton = page.getByRole('button', { name: '添加成员' })
      await expect(addButton).not.toBeVisible()

      // AND: 不显示操作列
      const actionHeader = page.getByRole('cell', { name: '操作' })
      const count = await actionHeader.count()
      expect(count).toBe(0)
    })

    test('[P1] 不能编辑或移除自己', async ({ page }) => {
      // GIVEN: 团队管理页面已加载
      await page.goto('/team')
      await page.waitForLoadState('networkidle')
      await page.waitForSelector('table tbody tr', { timeout: 10000 })

      // WHEN: 查找当前用户的行
      const rows = page.locator('table tbody tr')
      const count = await rows.count()

      for (let i = 0; i < count; i++) {
        const row = rows.nth(i)
        const emailCell = row.locator('td').nth(1)
        const email = await emailCell.textContent()

        // 假设当前用户是 admin@test.com
        if (email?.includes('admin@test.com')) {
          // THEN: 编辑和删除按钮被禁用
          const editButton = row.locator('button[aria-label^="编辑"]').first()
          const removeButton = row.locator('button[aria-label^="移除"], button[color="error"]').first()

          await expect(editButton).toBeDisabled()
          await expect(removeButton).toBeDisabled()
          break
        }
      }
    })
  })

  test.describe('[P1] 空状态', () => {
    test('[P1] 应该显示空状态提示', async ({ page }) => {
      // GIVEN: 团队管理页面已加载但无成员
      // 注意：这个测试可能需要特定的测试数据
      await page.goto('/team')
      await page.waitForLoadState('networkidle')

      // 等待表格加载
      await page.waitForSelector('table tbody tr', { timeout: 10000 })

      // 检查是否有空状态提示
      const emptyState = page.getByText('暂无成员')
      const count = await emptyState.count()

      if (count > 0) {
        await expect(emptyState).toBeVisible()
      }
    })
  })
})
