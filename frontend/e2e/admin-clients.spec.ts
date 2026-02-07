import { test, expect } from '@playwright/test'
import { faker } from '@faker-js/faker'

/**
 * Story 6.2: 咨询公司批量客户管理后台 - E2E 测试
 *
 * 测试客户管理前端功能
 */

test.describe('[Story 6.2] 客户管理后台', () => {
  // 测试前登录
  test.beforeEach(async ({ page }) => {
    // GIVEN: 管理员已登录
    await page.goto('/login');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Fill login form using placeholder selectors
    await page.fill('input[placeholder="邮箱"]', 'admin@test.com');
    await page.fill('input[placeholder="密码"]', 'admin123');

    // Click login button using type selector
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard with increased timeout
    await page.waitForURL('/dashboard', {
      timeout: 15000,
      waitUntil: 'networkidle'
    });

    // Ensure page is fully loaded
    await page.waitForLoadState('domcontentloaded');
  });

  test.describe('[P1] AC1: 客户列表视图', () => {
    test('[P1] 应该显示客户管理页面标题和客户列表', async ({ page }) => {
      // GIVEN: 管理员已登录
      // WHEN: 访问客户管理页面
      await page.goto('/admin/clients')

      // THEN: 显示页面标题
      await expect(page.locator('h1')).toContainText('客户管理')

      // AND: 显示客户列表
      const clientCards = page.locator('[data-testid="client-card"]')
      await expect(clientCards.first()).toBeVisible()

      // AND: 每个客户卡片包含必要信息
      const firstCard = clientCards.first()
      await expect(firstCard.locator('[data-testid="client-name"]')).toBeVisible()
      await expect(firstCard.locator('[data-testid="client-status"]')).toBeVisible()
      await expect(firstCard.locator('[data-testid="client-actions"]')).toBeVisible()
    })

    test('[P1] 应该支持按状态筛选客户', async ({ page }) => {
      // GIVEN: 客户列表页面已加载
      await page.goto('/admin/clients')

      // WHEN: 选择状态筛选器
      await page.click('[data-testid="status-filter"]')
      await page.click('[data-testid="status-option-active"]')

      // THEN: 只显示 active 状态的客户
      const clientCards = page.locator('[data-testid="client-card"]')
      const count = await clientCards.count()

      for (let i = 0; i < count; i++) {
        const status = await clientCards.nth(i).locator('[data-testid="client-status"]').textContent()
        expect(status).toContain('激活')
      }
    })

    test('[P1] 应该支持按行业类型筛选客户', async ({ page }) => {
      // GIVEN: 客户列表页面已加载
      await page.goto('/admin/clients')

      // WHEN: 选择行业类型筛选器
      await page.click('[data-testid="industry-filter"]')
      await page.click('[data-testid="industry-option-banking"]')

      // THEN: 只显示银行业客户
      const clientCards = page.locator('[data-testid="client-card"]')
      const count = await clientCards.count()

      for (let i = 0; i < count; i++) {
        const industry = await clientCards.nth(i).locator('[data-testid="client-industry"]').textContent()
        expect(industry).toContain('银行')
      }
    })

    test('[P1] 应该支持搜索客户', async ({ page }) => {
      // GIVEN: 客户列表页面已加载
      await page.goto('/admin/clients')

      // WHEN: 输入搜索关键词
      await page.fill('[data-testid="search-input"]', '测试银行')

      // THEN: 显示匹配的客户
      const clientCards = page.locator('[data-testid="client-card"]')
      await expect(clientCards.first().locator('[data-testid="client-name"]')).toContainText('测试银行')
    })
  })

  test.describe('[P1] AC2 & AC3: 添加客户', () => {
    test('[P1] 应该打开添加客户弹窗并显示表单', async ({ page }) => {
      // GIVEN: 客户列表页面已加载
      await page.goto('/admin/clients')

      // WHEN: 点击"添加客户"按钮
      await page.click('[data-testid="add-client-button"]')

      // THEN: 显示添加客户弹窗
      await expect(page.locator('[data-testid="add-client-modal"]')).toBeVisible()

      // AND: 显示表单字段
      await expect(page.locator('[data-testid="client-name-input"]')).toBeVisible()
      await expect(page.locator('[data-testid="contact-person-input"]')).toBeVisible()
      await expect(page.locator('[data-testid="contact-email-input"]')).toBeVisible()
      await expect(page.locator('[data-testid="industry-type-select"]')).toBeVisible()
      await expect(page.locator('[data-testid="scale-select"]')).toBeVisible()
    })

    test('[P0] 应该成功创建客户并发送欢迎邮件', async ({ page }) => {
      // GIVEN: 添加客户弹窗已打开
      await page.goto('/admin/clients')
      await page.click('[data-testid="add-client-button"]')

      // WHEN: 填写客户信息
      const clientName = faker.company.name()
      const contactPerson = faker.person.fullName()
      const contactEmail = faker.internet.email()

      await page.fill('[data-testid="client-name-input"]', clientName)
      await page.fill('[data-testid="contact-person-input"]', contactPerson)
      await page.fill('[data-testid="contact-email-input"]', contactEmail)
      await page.selectOption('[data-testid="industry-type-select"]', 'banking')
      await page.selectOption('[data-testid="scale-select"]', 'medium')

      // AND: 提交表单
      await page.click('[data-testid="submit-button"]')

      // THEN: 显示成功提示
      await expect(page.locator('[data-testid="success-message"]')).toContainText('客户已添加')
      await expect(page.locator('[data-testid="success-message"]')).toContainText('欢迎邮件已发送')

      // AND: 客户列表中显示新客户
      await expect(page.locator(`[data-testid="client-name"]:has-text("${clientName}")`)).toBeVisible()
    })

    test('[P1] 应该验证邮箱格式', async ({ page }) => {
      // GIVEN: 添加客户弹窗已打开
      await page.goto('/admin/clients')
      await page.click('[data-testid="add-client-button"]')

      // WHEN: 输入无效的邮箱格式
      await page.fill('[data-testid="client-name-input"]', 'Test Bank')
      await page.fill('[data-testid="contact-person-input"]', 'John Doe')
      await page.fill('[data-testid="contact-email-input"]', 'invalid-email')

      // AND: 提交表单
      await page.click('[data-testid="submit-button"]')

      // THEN: 显示邮箱格式错误提示
      await expect(page.locator('[data-testid="email-error"]')).toContainText('邮箱格式不正确')
    })

    test('[P1] 应该验证必填字段', async ({ page }) => {
      // GIVEN: 添加客户弹窗已打开
      await page.goto('/admin/clients')
      await page.click('[data-testid="add-client-button"]')

      // WHEN: 不填写任何字段直接提交
      await page.click('[data-testid="submit-button"]')

      // THEN: 显示必填字段错误提示
      await expect(page.locator('[data-testid="name-error"]')).toContainText('请输入客户名称')
      await expect(page.locator('[data-testid="contact-person-error"]')).toContainText('请输入联系人')
      await expect(page.locator('[data-testid="contact-email-error"]')).toContainText('请输入联系邮箱')
    })
  })

  test.describe('[P1] AC4: 客户详情页面', () => {
    test('[P1] 应该显示客户详情和标签页导航', async ({ page }) => {
      // GIVEN: 客户列表页面已加载
      await page.goto('/admin/clients')

      // WHEN: 点击客户卡片
      await page.click('[data-testid="client-card"]:first-child')

      // THEN: 显示客户详情页面
      await expect(page.locator('h1[data-testid="client-detail-title"]')).toBeVisible()

      // AND: 显示标签页导航
      await expect(page.locator('[data-testid="tab-overview"]')).toBeVisible()
      await expect(page.locator('[data-testid="tab-weaknesses"]')).toBeVisible()
      await expect(page.locator('[data-testid="tab-watch-config"]')).toBeVisible()
      await expect(page.locator('[data-testid="tab-push-history"]')).toBeVisible()
    })

    test('[P1] 应该显示概览标签内容', async ({ page }) => {
      // GIVEN: 客户详情页面已加载
      await page.goto('/admin/clients')
      await page.click('[data-testid="client-card"]:first-child')

      // WHEN: 点击概览标签
      await page.click('[data-testid="tab-overview"]')

      // THEN: 显示基本信息卡片
      await expect(page.locator('[data-testid="basic-info-card"]')).toBeVisible()
      await expect(page.locator('[data-testid="client-name"]')).toBeVisible()
      await expect(page.locator('[data-testid="contact-person"]')).toBeVisible()
      await expect(page.locator('[data-testid="contact-email"]')).toBeVisible()

      // AND: 显示活跃度趋势图
      await expect(page.locator('[data-testid="activity-chart"]')).toBeVisible()

      // AND: 显示推送统计
      await expect(page.locator('[data-testid="push-stats"]')).toBeVisible()
    })

    test('[P1] 应该显示薄弱项标签内容', async ({ page }) => {
      // GIVEN: 客户详情页面已加载
      await page.goto('/admin/clients')
      await page.click('[data-testid="client-card"]:first-child')

      // WHEN: 点击薄弱项标签
      await page.click('[data-testid="tab-weaknesses"]')

      // THEN: 显示薄弱项列表
      await expect(page.locator('[data-testid="weakness-list"]')).toBeVisible()
    })

    test('[P1] 应该显示关注配置标签内容', async ({ page }) => {
      // GIVEN: 客户详情页面已加载
      await page.goto('/admin/clients')
      await page.click('[data-testid="client-card"]:first-child')

      // WHEN: 点击关注配置标签
      await page.click('[data-testid="tab-watch-config"]')

      // THEN: 显示关注领域列表
      await expect(page.locator('[data-testid="watched-topics-list"]')).toBeVisible()

      // AND: 显示关注同业列表
      await expect(page.locator('[data-testid="watched-peers-list"]')).toBeVisible()
    })

    test('[P1] 应该显示推送历史标签内容', async ({ page }) => {
      // GIVEN: 客户详情页面已加载
      await page.goto('/admin/clients')
      await page.click('[data-testid="client-card"]:first-child')

      // WHEN: 点击推送历史标签
      await page.click('[data-testid="tab-push-history"]')

      // THEN: 显示推送记录列表
      await expect(page.locator('[data-testid="push-history-list"]')).toBeVisible()
    })
  })

  test.describe('[P1] AC5: 批量配置客户', () => {
    test('[P1] 应该打开批量配置弹窗', async ({ page }) => {
      // GIVEN: 客户列表页面已加载
      await page.goto('/admin/clients')

      // WHEN: 选择多个客户
      await page.click('[data-testid="client-checkbox"]:nth-child(1)')
      await page.click('[data-testid="client-checkbox"]:nth-child(2)')
      await page.click('[data-testid="client-checkbox"]:nth-child(3)')

      // AND: 点击"批量配置"按钮
      await page.click('[data-testid="bulk-config-button"]')

      // THEN: 显示批量配置弹窗
      await expect(page.locator('[data-testid="bulk-config-modal"]')).toBeVisible()

      // AND: 显示配置表单
      await expect(page.locator('[data-testid="push-start-time-input"]')).toBeVisible()
      await expect(page.locator('[data-testid="push-end-time-input"]')).toBeVisible()
      await expect(page.locator('[data-testid="max-push-per-day-input"]')).toBeVisible()
      await expect(page.locator('[data-testid="relevance-filter-select"]')).toBeVisible()
    })

    test('[P1] 应该成功应用批量配置', async ({ page }) => {
      // GIVEN: 批量配置弹窗已打开
      await page.goto('/admin/clients')
      await page.click('[data-testid="client-checkbox"]:nth-child(1)')
      await page.click('[data-testid="client-checkbox"]:nth-child(2)')
      await page.click('[data-testid="bulk-config-button"]')

      // WHEN: 填写配置信息
      await page.fill('[data-testid="push-start-time-input"]', '08:00')
      await page.fill('[data-testid="push-end-time-input"]', '20:00')
      await page.fill('[data-testid="max-push-per-day-input"]', '10')
      await page.selectOption('[data-testid="relevance-filter-select"]', 'high')

      // AND: 提交配置
      await page.click('[data-testid="submit-button"]')

      // THEN: 显示成功提示
      await expect(page.locator('[data-testid="success-message"]')).toContainText('批量配置已应用到 2 个客户')
    })

    test('[P1] 应该显示受影响客户数量', async ({ page }) => {
      // GIVEN: 批量配置弹窗已打开
      await page.goto('/admin/clients')
      await page.click('[data-testid="client-checkbox"]:nth-child(1)')
      await page.click('[data-testid="client-checkbox"]:nth-child(2)')
      await page.click('[data-testid="client-checkbox"]:nth-child(3)')
      await page.click('[data-testid="bulk-config-button"]')

      // THEN: 显示受影响客户数量
      await expect(page.locator('[data-testid="affected-count"]')).toContainText('3 个客户')
    })
  })

  test.describe('[P2] AC6: 客户分组管理', () => {
    test('[P2] 应该创建客户分组', async ({ page }) => {
      // GIVEN: 客户列表页面已加载
      await page.goto('/admin/clients')

      // WHEN: 点击"创建分组"按钮
      await page.click('[data-testid="create-group-button"]')

      // AND: 填写分组信息
      const groupName = faker.company.buzzPhrase()
      await page.fill('[data-testid="group-name-input"]', groupName)
      await page.fill('[data-testid="group-description-input"]', '测试分组描述')

      // AND: 提交表单
      await page.click('[data-testid="submit-button"]')

      // THEN: 显示成功提示
      await expect(page.locator('[data-testid="success-message"]')).toContainText('分组已创建')

      // AND: 分组列表中显示新分组
      await expect(page.locator(`[data-testid="group-name"]:has-text("${groupName}")`)).toBeVisible()
    })

    test('[P2] 应该将客户添加到分组', async ({ page }) => {
      // GIVEN: 客户列表页面已加载
      await page.goto('/admin/clients')

      // WHEN: 选择客户
      await page.click('[data-testid="client-checkbox"]:nth-child(1)')

      // AND: 点击"添加到分组"按钮
      await page.click('[data-testid="add-to-group-button"]')

      // AND: 选择分组
      await page.click('[data-testid="group-option"]:first-child')

      // AND: 确认
      await page.click('[data-testid="confirm-button"]')

      // THEN: 显示成功提示
      await expect(page.locator('[data-testid="success-message"]')).toContainText('已添加到分组')
    })

    test('[P2] 应该按分组筛选客户', async ({ page }) => {
      // GIVEN: 客户列表页面已加载
      await page.goto('/admin/clients')

      // WHEN: 选择分组筛选器
      await page.click('[data-testid="group-filter"]')
      await page.click('[data-testid="group-option"]:first-child')

      // THEN: 只显示该分组的客户
      const clientCards = page.locator('[data-testid="client-card"]')
      await expect(clientCards.first()).toBeVisible()
    })
  })

  test.describe('[P1] CSV 批量导入', () => {
    test('[P1] 应该打开批量导入弹窗', async ({ page }) => {
      // GIVEN: 客户列表页面已加载
      await page.goto('/admin/clients')

      // WHEN: 点击"批量导入"按钮
      await page.click('[data-testid="bulk-import-button"]')

      // THEN: 显示批量导入弹窗
      await expect(page.locator('[data-testid="bulk-import-modal"]')).toBeVisible()

      // AND: 显示文件上传区域
      await expect(page.locator('[data-testid="file-upload-area"]')).toBeVisible()

      // AND: 显示下载模板链接
      await expect(page.locator('[data-testid="download-template-link"]')).toBeVisible()
    })

    test('[P1] 应该下载 CSV 模板', async ({ page }) => {
      // GIVEN: 批量导入弹窗已打开
      await page.goto('/admin/clients')
      await page.click('[data-testid="bulk-import-button"]')

      // WHEN: 点击下载模板链接
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('[data-testid="download-template-link"]'),
      ])

      // THEN: 下载 CSV 模板文件
      expect(download.suggestedFilename()).toContain('clients-template.csv')
    })

    test('[P1] 应该成功导入 CSV 文件', async ({ page }) => {
      // GIVEN: 批量导入弹窗已打开
      await page.goto('/admin/clients')
      await page.click('[data-testid="bulk-import-button"]')

      // WHEN: 上传 CSV 文件
      const csvContent = `name,contactPerson,contactEmail,industryType,scale
Test Bank 1,John Doe,john@test1.com,banking,large
Test Bank 2,Jane Smith,jane@test2.com,banking,medium`

      await page.setInputFiles('[data-testid="file-input"]', {
        name: 'clients.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csvContent),
      })

      // AND: 提交导入
      await page.click('[data-testid="submit-button"]')

      // THEN: 显示导入结果
      await expect(page.locator('[data-testid="import-result"]')).toBeVisible()
      await expect(page.locator('[data-testid="success-count"]')).toContainText('2')
      await expect(page.locator('[data-testid="failed-count"]')).toContainText('0')
    })

    test('[P1] 应该显示 CSV 格式错误', async ({ page }) => {
      // GIVEN: 批量导入弹窗已打开
      await page.goto('/admin/clients')
      await page.click('[data-testid="bulk-import-button"]')

      // WHEN: 上传无效的 CSV 文件
      const invalidCsv = 'invalid,csv,format\n1,2'

      await page.setInputFiles('[data-testid="file-input"]', {
        name: 'invalid.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(invalidCsv),
      })

      // AND: 提交导入
      await page.click('[data-testid="submit-button"]')

      // THEN: 显示格式错误提示
      await expect(page.locator('[data-testid="error-message"]')).toContainText('CSV 格式不正确')
    })
  })
})
