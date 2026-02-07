import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright 配置文件
 * 用于 E2E 测试
 */
export default defineConfig({
  // 测试目录
  testDir: './e2e',

  // 测试超时时间 - 增加到60秒
  timeout: 60000,

  // 期望超时时间
  expect: {
    timeout: 10000,
  },

  // 每个测试的重试次数
  retries: process.env.CI ? 2 : 0,

  // 并行运行的 worker 数量
  workers: process.env.CI ? 1 : undefined,

  // 测试报告
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['list'],
  ],

  // 全局配置
  use: {
    // 基础 URL - 前端运行在 3001 端口
    baseURL: 'http://localhost:3001',

    // 操作超时时间
    actionTimeout: 15000,

    // 导航超时时间
    navigationTimeout: 30000,

    // 截图设置
    screenshot: 'only-on-failure',

    // 视频录制
    video: 'retain-on-failure',

    // 追踪
    trace: 'on-first-retry',

    // 浏览器上下文选项
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  },

  // 测试项目配置（不同浏览器）
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // 移动端测试
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // 开发服务器配置（已禁用，使用手动启动的服务器）
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3001',
  //   reuseExistingServer: true,
  //   timeout: 120000,
  // },
})
