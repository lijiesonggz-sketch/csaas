/**
 * Cost Optimization E2E Tests
 *
 * End-to-end tests for AI cost optimization features.
 * Tests admin cost monitoring, optimization suggestions, and batch operations.
 *
 * @module frontend/e2e
 * @story 7-4
 */

import { test, expect } from '@playwright/test';

// Helper function to login as admin
async function loginAsAdmin(page) {
  await page.goto('/login');

  // Wait for page to be fully loaded
  await page.waitForLoadState('networkidle');

  // Fill login form using data-testid selectors
  await page.fill('[data-testid="email-input"]', 'admin@example.com');
  await page.fill('[data-testid="password-input"]', 'password');

  // Click login button using data-testid selector
  await page.click('[data-testid="login-button"]');

  // Wait for redirect to dashboard with increased timeout
  await page.waitForURL(/\/dashboard/, {
    timeout: 15000,
    waitUntil: 'networkidle'
  });

  // Ensure page is fully loaded
  await page.waitForLoadState('domcontentloaded');
}

// Helper function to login as regular user
async function loginAsUser(page) {
  await page.goto('/login');

  // Wait for page to be fully loaded
  await page.waitForLoadState('networkidle');

  // Fill login form using data-testid selectors
  await page.fill('[data-testid="email-input"]', 'user@example.com');
  await page.fill('[data-testid="password-input"]', 'password');

  // Click login button using data-testid selector
  await page.click('[data-testid="login-button"]');

  // Wait for redirect to dashboard with increased timeout
  await page.waitForURL(/\/dashboard/, {
    timeout: 15000,
    waitUntil: 'networkidle'
  });

  // Ensure page is fully loaded
  await page.waitForLoadState('domcontentloaded');
}

test.describe('[P1] AI成本优化 - 成本指标', () => {
  test('[P1] 应该显示成本指标', async ({ page }) => {
    // GIVEN: 管理员已登录
    await loginAsAdmin(page);

    // WHEN: 访问成本优化页面
    await page.goto('/admin/cost-optimization');

    // THEN: 显示成本指标卡片
    await expect(page.locator('[data-testid="total-cost-card"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="avg-cost-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="top-cost-orgs-card"]')).toBeVisible();

    // 验证指标包含数值
    const totalCostText = await page.locator('[data-testid="total-cost-value"]').textContent();
    expect(totalCostText).toMatch(/[\d,]+/); // Should contain numbers
  });
});

test.describe('[P1] AI成本优化 - 成本趋势图', () => {
  test('[P1] 应该渲染成本趋势图', async ({ page }) => {
    // GIVEN: 管理员在成本优化页面
    await loginAsAdmin(page);
    await page.goto('/admin/cost-optimization');

    // WHEN: 页面加载完成
    await page.waitForSelector('[data-testid="cost-trend-chart"]', { timeout: 10000 });

    // THEN: 显示成本趋势图
    await expect(page.locator('[data-testid="cost-trend-chart"]')).toBeVisible();

    // 验证图表包含数据
    const chartCanvas = page.locator('[data-testid="cost-trend-chart"] canvas');
    await expect(chartCanvas).toBeVisible();
  });
});

test.describe('[P1] AI成本优化 - 高成本客户列表', () => {
  test('[P1] 应该显示高成本客户列表', async ({ page }) => {
    // GIVEN: 管理员在成本优化页面
    await loginAsAdmin(page);
    await page.goto('/admin/cost-optimization');

    // WHEN: 页面加载完成
    await page.waitForSelector('[data-testid="high-cost-clients-list"]', { timeout: 10000 });

    // THEN: 显示高成本客户列表
    await expect(page.locator('[data-testid="high-cost-clients-list"]')).toBeVisible();

    // Check if there are any high-cost clients
    const clientCards = await page.locator('[data-testid="high-cost-client-card"]').count();

    if (clientCards > 0) {
      // 验证第一个客户卡片包含必要信息
      const firstCard = page.locator('[data-testid="high-cost-client-card"]').first();
      await expect(firstCard.locator('[data-testid="client-name"]')).toBeVisible();
      await expect(firstCard.locator('[data-testid="client-cost"]')).toBeVisible();
      await expect(firstCard.locator('[data-testid="client-usage-count"]')).toBeVisible();
    }
  });
});

test.describe('[P1] AI成本优化 - 优化建议', () => {
  test('[P1] 应该显示优化建议', async ({ page }) => {
    // GIVEN: 管理员在成本优化页面
    await loginAsAdmin(page);
    await page.goto('/admin/cost-optimization');

    // WHEN: 页面加载完成
    await page.waitForSelector('[data-testid="optimization-suggestions"]', { timeout: 10000 });

    // THEN: 显示优化建议列表
    await expect(page.locator('[data-testid="optimization-suggestions"]')).toBeVisible();

    // Check if there are any suggestions
    const suggestionCards = await page.locator('[data-testid="suggestion-card"]').count();

    if (suggestionCards > 0) {
      // 验证第一个建议包含必要信息
      const firstSuggestion = page.locator('[data-testid="suggestion-card"]').first();
      await expect(firstSuggestion.locator('[data-testid="suggestion-type"]')).toBeVisible();
      await expect(firstSuggestion.locator('[data-testid="suggestion-description"]')).toBeVisible();
      await expect(firstSuggestion.locator('[data-testid="potential-savings"]')).toBeVisible();
    }
  });

  test('[P1] 应该能够查看建议详情', async ({ page }) => {
    // GIVEN: 管理员在成本优化页面
    await loginAsAdmin(page);
    await page.goto('/admin/cost-optimization');
    await page.waitForSelector('[data-testid="optimization-suggestions"]', { timeout: 10000 });

    // Check if there are any suggestions
    const suggestionCards = await page.locator('[data-testid="suggestion-card"]').count();

    if (suggestionCards === 0) {
      test.skip();
      return;
    }

    // WHEN: 点击查看详情按钮
    await page.click('[data-testid="suggestion-card"]:first-child [data-testid="view-suggestion-button"]');

    // THEN: 显示建议详情对话框
    await expect(page.locator('[data-testid="suggestion-detail-dialog"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="affected-organizations"]')).toBeVisible();
  });
});

test.describe('[P1] AI成本优化 - 批量优化', () => {
  test('[P1] 应该支持批量优化', async ({ page }) => {
    // GIVEN: 管理员在成本优化页面
    await loginAsAdmin(page);
    await page.goto('/admin/cost-optimization');
    await page.waitForSelector('[data-testid="high-cost-clients-list"]', { timeout: 10000 });

    // Check if there are any high-cost clients
    const clientCards = await page.locator('[data-testid="high-cost-client-card"]').count();

    if (clientCards === 0) {
      test.skip();
      return;
    }

    // WHEN: 选择多个客户并点击批量优化
    await page.click('[data-testid="high-cost-client-card"]:first-child [data-testid="select-client-checkbox"]');

    // Check if second client exists
    if (clientCards > 1) {
      await page.click('[data-testid="high-cost-client-card"]:nth-child(2) [data-testid="select-client-checkbox"]');
    }

    await page.click('[data-testid="batch-optimize-button"]');

    // THEN: 显示批量优化对话框
    await expect(page.locator('[data-testid="batch-optimize-dialog"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="selected-count"]')).toBeVisible();

    // 选择优化操作
    await page.click('[data-testid="optimization-action-select"]');
    await page.click('[data-testid="action-switch-model"]');

    // 提交批量优化
    await page.click('[data-testid="confirm-batch-optimize-button"]');

    // THEN: 显示成功消息
    await expect(page.locator('[data-testid="batch-optimize-success"]')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('[P1] AI成本优化 - 导出报告', () => {
  test('[P1] 应该支持导出报告', async ({ page }) => {
    // GIVEN: 管理员在成本优化页面
    await loginAsAdmin(page);
    await page.goto('/admin/cost-optimization');

    // WHEN: 点击导出报告按钮
    await page.waitForSelector('[data-testid="export-report-button"]', { timeout: 10000 });

    // Setup download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });

    await page.click('[data-testid="export-report-button"]');

    // THEN: 应该触发文件下载
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/cost-report.*\.(csv|xlsx)/);
  });

  test('[P1] 应该支持选择导出格式', async ({ page }) => {
    // GIVEN: 管理员在成本优化页面
    await loginAsAdmin(page);
    await page.goto('/admin/cost-optimization');

    // WHEN: 点击导出选项
    await page.waitForSelector('[data-testid="export-options-button"]', { timeout: 10000 });
    await page.click('[data-testid="export-options-button"]');

    // THEN: 显示导出选项对话框
    await expect(page.locator('[data-testid="export-options-dialog"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="format-csv"]')).toBeVisible();
    await expect(page.locator('[data-testid="format-excel"]')).toBeVisible();

    // 选择Excel格式
    await page.click('[data-testid="format-excel"]');

    // Setup download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });

    await page.click('[data-testid="confirm-export-button"]');

    // THEN: 应该下载Excel文件
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });
});

test.describe('[P2] AI成本优化 - 访问控制', () => {
  test('[P2] 普通用户不能访问成本优化页面', async ({ page }) => {
    // GIVEN: 普通用户已登录
    await loginAsUser(page);

    // WHEN: 尝试访问成本优化页面
    await page.goto('/admin/cost-optimization');

    // THEN: 应该被重定向到首页或显示403错误
    await expect(page).not.toHaveURL('/admin/cost-optimization');
  });
});
