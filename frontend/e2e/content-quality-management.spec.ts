import { test, expect } from '@playwright/test';

/**
 * Story 7.2: 内容质量管理
 * ATDD Tests - Red Phase (Failing Tests)
 */

test.describe('Story 7.2: Content Quality Management', () => {

  // AC1: 推送详情页显示内容评分区域
  test('AC1: Push detail shows rating section', async ({ page }) => {
    // Setup: Login as user
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Navigate to radar page with push
    await page.goto('/radar');
    await page.waitForSelector('[data-testid="push-item"]');

    // Open push detail
    await page.click('[data-testid="push-item"]:first-child');

    // Verify rating section exists
    await expect(page.locator('[data-testid="rating-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-rating"]')).toBeVisible();
    await expect(page.locator('[data-testid="feedback-input"]')).toBeVisible();
    await expect(page.getByText('您的反馈帮助我们改进服务')).toBeVisible();
  });

  // AC2: 用户提交评分创建反馈记录
  test('AC2: User submits rating creates feedback record', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.goto('/radar');
    await page.click('[data-testid="push-item"]:first-child');

    // Submit rating
    await page.click('[data-testid="star-4"]'); // 4 stars
    await page.fill('[data-testid="feedback-input"]', 'Great content!');
    await page.click('[data-testid="submit-rating"]');

    // Verify success message
    await expect(page.getByText('感谢您的反馈！')).toBeVisible();
  });

  // AC3: 内容质量管理页面基础结构
  test('AC3: Content quality management page structure', async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Navigate to content quality page
    await page.goto('/admin/content-quality');

    // Verify page structure
    await expect(page.getByRole('heading', { name: '内容质量管理' })).toBeVisible();
    await expect(page.locator('[data-testid="average-rating"]')).toBeVisible();
    await expect(page.locator('[data-testid="rating-distribution"]')).toBeVisible();
    await expect(page.locator('[data-testid="low-rated-pushes"]')).toBeVisible();
  });

  // AC4: 低分推送识别与列表
  test('AC4: Low-rated pushes identification and list', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.goto('/admin/content-quality');

    // Verify low-rated pushes list
    const lowRatedList = page.locator('[data-testid="low-rated-pushes"]');
    await expect(lowRatedList).toBeVisible();

    // Check first low-rated push item
    const firstItem = lowRatedList.locator('[data-testid="push-item"]').first();
    await expect(firstItem.locator('[data-testid="push-title"]')).toBeVisible();
    await expect(firstItem.locator('[data-testid="average-rating"]')).toBeVisible();
    await expect(firstItem.locator('[data-testid="feedback-count"]')).toBeVisible();
    await expect(firstItem.locator('[data-testid="view-details"]')).toBeVisible();
  });

  // AC5: 低分推送详情查看与处理
  test('AC5: Low-rated push details and handling', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.goto('/admin/content-quality');

    // Click view details on first low-rated push
    await page.click('[data-testid="low-rated-pushes"] [data-testid="view-details"]:first-child');

    // Verify details modal/page
    await expect(page.locator('[data-testid="push-content"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-feedbacks"]')).toBeVisible();
    await expect(page.locator('[data-testid="ai-analysis"]')).toBeVisible();
    await expect(page.locator('[data-testid="optimization-suggestions"]')).toBeVisible();

    // Verify action buttons
    await expect(page.locator('[data-testid="mark-optimized"]')).toBeVisible();
    await expect(page.locator('[data-testid="mark-ignored"]')).toBeVisible();
  });

  // AC6: 内容质量趋势分析
  test('AC6: Content quality trend analysis', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.goto('/admin/content-quality');

    // Verify trend charts
    await expect(page.locator('[data-testid="rating-trend-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="low-rated-count-trend"]')).toBeVisible();

    // Verify radar type grouping
    await expect(page.locator('[data-testid="trend-by-radar-type"]')).toBeVisible();

    // Verify target indicator
    await expect(page.getByText(/平均评分.*4\.0/)).toBeVisible();
  });
});
