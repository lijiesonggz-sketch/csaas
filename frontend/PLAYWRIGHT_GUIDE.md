# Playwright E2E 测试使用指南

## 📖 目录

1. [什么是 Playwright](#什么是-playwright)
2. [安装和配置](#安装和配置)
3. [编写测试](#编写测试)
4. [运行测试](#运行测试)
5. [调试测试](#调试测试)
6. [最佳实践](#最佳实践)
7. [常见问题](#常见问题)

---

## 什么是 Playwright

Playwright 是微软开发的现代化端到端测试框架，支持：

- ✅ **多浏览器**: Chromium, Firefox, WebKit
- ✅ **跨平台**: Windows, Linux, macOS
- ✅ **自动等待**: 智能等待元素可见、可点击
- ✅ **强大的选择器**: CSS, XPath, Text, ARIA
- ✅ **网络拦截**: Mock API 响应
- ✅ **截图和视频**: 自动记录失败场景
- ✅ **并行执行**: 快速运行大量测试

---

## 安装和配置

### 1. 安装 Playwright

```bash
cd frontend

# 安装 Playwright
npm install -D @playwright/test

# 安装浏览器
npx playwright install
```

### 2. 配置文件

已创建 `playwright.config.ts`，包含：

```typescript
export default defineConfig({
  testDir: './e2e',              // 测试目录
  timeout: 30000,                // 测试超时
  retries: 2,                    // 失败重试次数
  workers: 1,                    // 并行 worker 数
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium' },        // Chrome 测试
    { name: 'firefox' },         // Firefox 测试
    { name: 'webkit' },          // Safari 测试
  ],
})
```

### 3. 添加测试脚本到 package.json

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:chromium": "playwright test --project=chromium",
    "test:e2e:report": "playwright show-report"
  }
}
```

---

## 编写测试

### 基本结构

```typescript
import { test, expect } from '@playwright/test'

test.describe('功能模块名称', () => {
  test.beforeEach(async ({ page }) => {
    // 每个测试前的准备工作
    await page.goto('/login')
  })

  test('测试用例描述', async ({ page }) => {
    // GIVEN: 前置条件
    await page.fill('[data-testid="email"]', 'test@example.com')

    // WHEN: 执行操作
    await page.click('[data-testid="login-button"]')

    // THEN: 验证结果
    await expect(page).toHaveURL('/dashboard')
  })
})
```

### 常用 API

#### 1. 页面导航

```typescript
// 访问页面
await page.goto('/radar/history')

// 等待页面加载完成
await page.waitForLoadState('networkidle')

// 等待 URL 变化
await page.waitForURL('/dashboard')

// 刷新页面
await page.reload()
```

#### 2. 元素定位

```typescript
// 通过 data-testid（推荐）
page.locator('[data-testid="submit-button"]')

// 通过文本
page.getByText('推送历史')

// 通过标签
page.getByLabel('雷达类型')

// 通过角色
page.getByRole('button', { name: '登录' })

// 通过占位符
page.getByPlaceholder('请输入邮箱')

// CSS 选择器
page.locator('.card-title')

// XPath
page.locator('xpath=//button[@type="submit"]')
```

#### 3. 用户交互

```typescript
// 点击
await page.click('[data-testid="button"]')

// 填写输入框
await page.fill('[data-testid="email"]', 'test@example.com')

// 选择下拉框
await page.selectOption('select#country', 'China')

// 勾选复选框
await page.check('[data-testid="agree"]')

// 上传文件
await page.setInputFiles('input[type="file"]', 'path/to/file.pdf')

// 悬停
await page.hover('[data-testid="menu"]')

// 键盘操作
await page.keyboard.press('Enter')
await page.keyboard.type('Hello World')
```

#### 4. 断言

```typescript
// 元素可见
await expect(page.getByText('推送历史')).toBeVisible()

// 元素不可见
await expect(page.getByText('加载中')).not.toBeVisible()

// 元素包含文本
await expect(page.locator('h1')).toContainText('推送历史')

// 元素有特定文本
await expect(page.locator('h1')).toHaveText('推送历史')

// URL 匹配
await expect(page).toHaveURL('/radar/history')

// 元素数量
await expect(page.locator('.card')).toHaveCount(5)

// 元素属性
await expect(page.locator('button')).toHaveAttribute('disabled', '')

// 元素类名
await expect(page.locator('div')).toHaveClass(/active/)
```

#### 5. 等待

```typescript
// 等待元素可见
await page.waitForSelector('[data-testid="card"]')

// 等待元素消失
await page.waitForSelector('[data-testid="loading"]', { state: 'hidden' })

// 等待网络请求
await page.waitForResponse('**/api/radar/pushes')

// 等待固定时间（不推荐，仅用于调试）
await page.waitForTimeout(1000)

// 等待函数返回 true
await page.waitForFunction(() => document.querySelectorAll('.card').length > 0)
```

#### 6. 网络拦截

```typescript
// Mock API 响应
await page.route('**/api/radar/pushes', (route) => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: [{ id: '1', title: 'Test Push' }],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    }),
  })
})

// 阻止请求
await page.route('**/analytics/**', (route) => route.abort())

// 修改请求
await page.route('**/api/**', (route) => {
  const headers = route.request().headers()
  headers['Authorization'] = 'Bearer mock-token'
  route.continue({ headers })
})
```

---

## 运行测试

### 命令行运行

```bash
# 运行所有测试
npm run test:e2e

# 运行特定文件
npm run test:e2e -- push-history.spec.ts

# 运行特定测试
npm run test:e2e -- -g "用户可以访问推送历史页面"

# 在特定浏览器运行
npm run test:e2e -- --project=chromium

# 显示浏览器窗口（headed 模式）
npm run test:e2e -- --headed

# 生成 HTML 报告
npm run test:e2e
npm run test:e2e:report
```

### UI 模式（推荐）

```bash
# 启动 UI 模式
npm run test:e2e:ui
```

UI 模式提供：
- 📊 可视化测试列表
- ▶️ 单独运行测试
- 🔍 查看测试步骤
- 📸 查看截图和视频
- 🐛 时间旅行调试

---

## 调试测试

### 1. Debug 模式

```bash
# 启动调试模式
npm run test:e2e:debug

# 调试特定测试
npm run test:e2e:debug -- -g "用户可以访问推送历史页面"
```

调试模式会：
- 打开浏览器窗口
- 打开 Playwright Inspector
- 逐步执行测试
- 可以暂停、继续、单步执行

### 2. 使用 page.pause()

```typescript
test('调试测试', async ({ page }) => {
  await page.goto('/radar/history')

  // 暂停执行，打开 Inspector
  await page.pause()

  await page.click('[data-testid="button"]')
})
```

### 3. 查看截图和视频

测试失败时自动生成：
- 📸 截图: `test-results/*/test-failed-1.png`
- 🎥 视频: `test-results/*/video.webm`
- 📝 追踪: `test-results/*/trace.zip`

查看追踪文件：
```bash
npx playwright show-trace test-results/*/trace.zip
```

### 4. 控制台日志

```typescript
// 监听控制台消息
page.on('console', (msg) => console.log('Browser console:', msg.text()))

// 监听页面错误
page.on('pageerror', (error) => console.log('Page error:', error))

// 监听请求
page.on('request', (request) => console.log('Request:', request.url()))

// 监听响应
page.on('response', (response) => console.log('Response:', response.url()))
```

---

## 最佳实践

### 1. 使用 data-testid

❌ **不推荐**:
```typescript
await page.click('.btn-primary')  // CSS 类名可能变化
await page.click('button:nth-child(2)')  // 位置可能变化
```

✅ **推荐**:
```typescript
await page.click('[data-testid="submit-button"]')
```

在组件中添加 data-testid:
```tsx
<button data-testid="submit-button">提交</button>
```

### 2. 使用 Page Object Model (可选)

```typescript
// pages/push-history.page.ts
export class PushHistoryPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/radar/history')
  }

  async filterByRadarType(type: string) {
    await this.page.getByLabel('雷达类型').click()
    await this.page.getByRole('option', { name: type }).click()
  }

  async getPushCards() {
    return this.page.locator('[class*="MuiCard"]')
  }
}

// 在测试中使用
test('筛选测试', async ({ page }) => {
  const pushHistoryPage = new PushHistoryPage(page)
  await pushHistoryPage.goto()
  await pushHistoryPage.filterByRadarType('技术雷达')
  const cards = await pushHistoryPage.getPushCards()
  await expect(cards).toHaveCount(5)
})
```

### 3. 使用 Fixtures

```typescript
// fixtures/auth.fixture.ts
import { test as base } from '@playwright/test'

export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    // 登录
    await page.goto('/login')
    await page.fill('[data-testid="email"]', 'test@example.com')
    await page.fill('[data-testid="password"]', 'password')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/dashboard')

    // 提供给测试使用
    await use(page)

    // 清理（可选）
    await page.goto('/logout')
  },
})

// 在测试中使用
test('需要登录的测试', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/radar/history')
  // 已经登录，可以直接测试
})
```

### 4. 避免硬编码等待

❌ **不推荐**:
```typescript
await page.click('[data-testid="button"]')
await page.waitForTimeout(2000)  // 硬编码等待
```

✅ **推荐**:
```typescript
await page.click('[data-testid="button"]')
await page.waitForSelector('[data-testid="result"]')  // 等待元素出现
```

### 5. 测试隔离

```typescript
test.beforeEach(async ({ page }) => {
  // 每个测试前清理状态
  await page.goto('/login')
  await page.evaluate(() => localStorage.clear())
  await page.evaluate(() => sessionStorage.clear())
})
```

### 6. 并行执行

```typescript
// 默认并行执行
test.describe.configure({ mode: 'parallel' })

// 串行执行（如果测试有依赖）
test.describe.configure({ mode: 'serial' })
```

---

## 常见问题

### Q1: 元素找不到

**问题**: `Error: locator.click: Timeout 30000ms exceeded`

**解决方案**:
```typescript
// 1. 等待元素可见
await page.waitForSelector('[data-testid="button"]', { state: 'visible' })
await page.click('[data-testid="button"]')

// 2. 增加超时时间
await page.click('[data-testid="button"]', { timeout: 60000 })

// 3. 检查选择器是否正确
await page.locator('[data-testid="button"]').screenshot({ path: 'debug.png' })
```

### Q2: 测试不稳定（flaky）

**原因**:
- 网络请求延迟
- 动画效果
- 异步操作

**解决方案**:
```typescript
// 1. 等待网络空闲
await page.goto('/radar/history')
await page.waitForLoadState('networkidle')

// 2. 等待特定请求
await page.waitForResponse('**/api/radar/pushes')

// 3. 禁用动画
await page.emulateMedia({ reducedMotion: 'reduce' })

// 4. 使用重试
test.describe.configure({ retries: 2 })
```

### Q3: 如何测试文件上传

```typescript
// 方法1: 使用本地文件
await page.setInputFiles('input[type="file"]', 'path/to/file.pdf')

// 方法2: 使用 Buffer
await page.setInputFiles('input[type="file"]', {
  name: 'test.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('file content'),
})

// 方法3: 多文件上传
await page.setInputFiles('input[type="file"]', [
  'file1.pdf',
  'file2.pdf',
])
```

### Q4: 如何测试下载

```typescript
// 监听下载事件
const downloadPromise = page.waitForEvent('download')
await page.click('[data-testid="download-button"]')
const download = await downloadPromise

// 保存文件
await download.saveAs('/path/to/save/file.pdf')

// 获取文件名
console.log(download.suggestedFilename())
```

### Q5: 如何测试弹窗

```typescript
// 监听弹窗
page.on('dialog', async (dialog) => {
  console.log(dialog.message())
  await dialog.accept()  // 或 dialog.dismiss()
})

await page.click('[data-testid="delete-button"]')
```

### Q6: 如何测试新标签页

```typescript
// 监听新页面
const [newPage] = await Promise.all([
  page.waitForEvent('popup'),
  page.click('[data-testid="open-new-tab"]'),
])

// 在新页面操作
await newPage.waitForLoadState()
await expect(newPage).toHaveURL('https://example.com')
```

---

## 示例：Story 5.4 完整测试

已创建完整的 E2E 测试示例：`frontend/e2e/push-history.spec.ts`

包含测试场景：
- ✅ 访问推送历史页面
- ✅ 雷达类型筛选
- ✅ 时间范围筛选
- ✅ 相关性筛选
- ✅ 重置筛选
- ✅ 标记已读
- ✅ 分页浏览
- ✅ 响应式布局
- ✅ 错误处理

---

## 参考资料

### 官方文档
- [Playwright 官方文档](https://playwright.dev/)
- [Playwright API 参考](https://playwright.dev/docs/api/class-playwright)
- [Playwright 最佳实践](https://playwright.dev/docs/best-practices)

### 视频教程
- [Playwright 入门教程](https://www.youtube.com/watch?v=Xz6lhEzgI5I)
- [Playwright 高级技巧](https://www.youtube.com/watch?v=wawbt1cATsk)

### 社区资源
- [Playwright GitHub](https://github.com/microsoft/playwright)
- [Playwright Discord](https://discord.com/invite/playwright)

---

**文档维护者**: Claude Sonnet 4.5
**最后更新**: 2026-02-02
**版本**: 1.0.0
