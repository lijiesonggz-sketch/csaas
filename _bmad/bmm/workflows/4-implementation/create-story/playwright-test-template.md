# Playwright E2E 测试用例模板

## 基础测试结构

```typescript
import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Story X.Y: [功能名称]
 *
 * 测试覆盖：
 * - 基础功能测试
 * - 响应式设计测试
 * - 错误处理测试
 */

test.describe('[P1] [功能名称] - 基础功能测试', () => {
  test('[P1] 应该能够[具体功能]', async ({ page }) => {
    // GIVEN: [前置条件]
    await page.goto('/path/to/page')

    // WHEN: [执行操作]
    await page.click('[data-testid="button-id"]')

    // THEN: [验证结果]
    await expect(page.locator('[data-testid="result"]')).toBeVisible()
  })
})

test.describe('[P2] [功能名称] - 响应式测试', () => {
  test('[P2] 页面在桌面端应该正常显示', async ({ page }) => {
    // GIVEN: 桌面端视口
    await page.setViewportSize({ width: 1920, height: 1080 })

    // WHEN: 访问页面
    await page.goto('/path/to/page')
    await page.waitForLoadState('networkidle')

    // THEN: 页面应该正常加载
    await expect(page.locator('h1')).toBeVisible()
  })

  test('[P2] 页面在移动端应该正常显示', async ({ page }) => {
    // GIVEN: 移动端视口
    await page.setViewportSize({ width: 375, height: 667 })

    // WHEN: 访问页面
    await page.goto('/path/to/page')
    await page.waitForLoadState('networkidle')

    // THEN: 页面应该正常加载
    await expect(page.locator('h1')).toBeVisible()
  })
})

test.describe('[P2] [功能名称] - 错误处理', () => {
  test('[P2] 页面应该能够处理网络错误', async ({ page }) => {
    // GIVEN: 模拟 API 失败
    await page.route('**/api/**', route => route.abort())

    // WHEN: 访问页面
    await page.goto('/path/to/page')

    // THEN: 应该显示错误提示
    await expect(page.getByText('加载失败')).toBeVisible()
  })
})
```

## 最佳实践

1. **使用 data-testid**：优先使用 `data-testid` 属性定位元素
2. **Given-When-Then 格式**：清晰的测试结构
3. **优先级标记**：[P1] 关键功能，[P2] 重要功能
4. **智能等待**：使用 `waitForLoadState`、`waitForSelector` 而不是 `waitForTimeout`
5. **跨浏览器测试**：确保在 Chromium、Firefox、WebKit 上都通过
6. **响应式测试**：测试桌面端和移动端视口
7. **错误处理**：测试网络错误、无效输入等边界情况

## 运行测试

```bash
# 运行所有测试
cd frontend
npx playwright test

# 运行特定测试文件
npx playwright test e2e/feature-name.spec.ts

# 调试模式
npx playwright test --debug

# UI 模式（推荐）
npx playwright test --ui

# 查看测试报告
npx playwright show-report
```

## 参考资源

- **配置文件**：`frontend/playwright.config.ts`
- **测试指南**：`frontend/PLAYWRIGHT_GUIDE.md`
- **测试示例**：`frontend/e2e/push-history.spec.ts`

## 检测前端功能的关键词

在 create-story 工作流中，以下关键词表明故事涉及前端功能，需要 Playwright 测试：

### 标题/描述关键词
- "页面" / "page"
- "界面" / "UI" / "interface"
- "表单" / "form"
- "列表" / "list"
- "查看" / "view" / "display"
- "按钮" / "button"
- "组件" / "component"

### 验收标准关键词
- 用户交互 (click, input, select)
- 视觉元素 (display, show, hide)
- 导航 (go to, redirect)
- 响应式设计 (responsive)

### 任务/子任务关键词
- frontend/ 目录
- React 组件
- Next.js 页面
- UI 库 (MUI, etc.)

## 测试质量标准

### 必须满足的条件
- ✅ 100% 测试通过率
- ✅ 跨浏览器兼容（Chromium, Firefox, WebKit）
- ✅ 无间歇性失败（flaky tests）
- ✅ 遵循 Given-When-Then 格式
- ✅ 使用优先级标记 [P1], [P2]
- ✅ 覆盖基础功能、响应式设计、错误处理

### 推荐的测试覆盖
- **基础功能测试 (P1)**：核心用户流程
- **响应式测试 (P2)**：桌面端 + 移动端
- **错误处理 (P2)**：网络错误、无效输入
- **边界情况**：空数据、大数据量等

## 常见测试场景模板

### 表单提交测试
```typescript
test('[P1] 应该能够成功提交表单', async ({ page }) => {
  // GIVEN: 用户在表单页面
  await page.goto('/form-page')

  // WHEN: 填写并提交表单
  await page.fill('[data-testid="name-input"]', 'Test User')
  await page.fill('[data-testid="email-input"]', 'test@example.com')
  await page.click('[data-testid="submit-button"]')

  // THEN: 应该显示成功消息
  await expect(page.getByText('提交成功')).toBeVisible()
})
```

### 列表加载测试
```typescript
test('[P1] 应该能够加载并显示列表数据', async ({ page }) => {
  // GIVEN: 用户访问列表页面
  await page.goto('/list-page')
  await page.waitForLoadState('networkidle')

  // WHEN: 页面加载完成
  // THEN: 应该显示列表项
  const listItems = page.locator('[data-testid="list-item"]')
  await expect(listItems).toHaveCount(10)
})
```

### 导航测试
```typescript
test('[P1] 应该能够导航到详情页', async ({ page }) => {
  // GIVEN: 用户在列表页面
  await page.goto('/list-page')

  // WHEN: 点��列表项
  await page.click('[data-testid="list-item"]:first-child')

  // THEN: 应该导航到详情页
  await expect(page).toHaveURL(/\/detail\/\d+/)
  await expect(page.locator('h1')).toBeVisible()
})
```

## 故障排查

### 测试失败常见原因
1. **元素未找到**：检查 data-testid 是否正确
2. **超时错误**：增加等待时间或使用更精确的等待条件
3. **间歇性失败**：检查是否有竞态条件，使用更可靠的等待策略
4. **跨浏览器失败**：检查浏览器特定的兼容性问题

### 调试技巧
```bash
# 使用 UI 模式调试
npx playwright test --ui

# 使用调试模式
npx playwright test --debug

# 生成详细的测试报告
npx playwright test --reporter=html

# 只运行失败的测试
npx playwright test --last-failed
```

## 集成到工作流

### create-story 阶段
- 自动检测前端功能关键词
- 生成具体的测试场景（Given-When-Then）
- 提供测试文件位置和参考

### dev-story 阶段
- 检测故事中的 Playwright 测试要求
- 强制实现测试用例
- 自动运行测试并验证结果
- 失败时停止并要求修复

### code-review 阶段
- 验证测试质量和覆盖率
- 检查测试是否遵循最佳实践
- 确认测试通过率 100%
