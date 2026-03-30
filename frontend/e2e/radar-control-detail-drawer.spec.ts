import { expect, test, type Page } from '@playwright/test'

/**
 * Playwright regression for the radar entry of the shared control detail drawer.
 *
 * Scope:
 * - keep only the radar flow that is currently missing from repo-level E2E coverage
 * - do not duplicate report/review specs that already live in their own files
 */

const DRAWER_SELECTOR = '[data-testid="control-detail-drawer"]'
const SOURCE_BADGE_SELECTOR = '[data-testid="control-detail-source-badge"]'
const CLOSE_BUTTON_ARIA = '关闭控制点详情'
const SECTION_PREFIX = 'control-detail-section-'

const EXPECTED_SECTIONS = [
  'applicabilityReason',
  'clauses',
  'cases',
  'evidences',
  'questions',
  'remediations',
] as const

const MATCHED_PUSH = {
  pushId: 'push-matched-1',
  radarType: 'compliance',
  title: '有控制点关联的合规推送',
  summary: '该推送用于验证雷达控制点详情抽屉接线。',
  relevanceScore: 0.96,
  priorityLevel: 3,
  weaknessCategories: ['数据安全'],
  url: 'https://example.com/matched',
  publishDate: '2026-03-30T00:00:00.000Z',
  source: '测试来源',
  tags: [],
  targetAudience: '合规负责人',
  isRead: false,
  controlId: 'ctrl-001',
  matchedControls: [
    {
      controlId: 'ctrl-001',
      controlName: '测试控制点',
      packSource: '测试控制包',
      priority: 'high',
    },
  ],
  sourceModule: 'radar',
  sourceRecordId: 'push-matched-1',
  sourceRoute: '/radar/compliance',
} as const

const UNMATCHED_PUSH = {
  pushId: 'push-unmatched-1',
  radarType: 'compliance',
  title: '无控制点关联的合规推送',
  summary: '该推送用于验证没有 matchedControls 时不会显示详情入口。',
  relevanceScore: 0.72,
  priorityLevel: 2,
  weaknessCategories: [],
  url: 'https://example.com/unmatched',
  publishDate: '2026-03-30T00:00:00.000Z',
  source: '测试来源',
  tags: [],
  targetAudience: '合规负责人',
  isRead: false,
  controlId: null,
  matchedControls: [],
  sourceModule: 'radar',
  sourceRecordId: 'push-unmatched-1',
  sourceRoute: '/radar/compliance',
} as const

const CONTROL_EXPLAIN_RESPONSE = {
  success: true,
  data: {
    control: {
      controlId: 'ctrl-001',
      controlCode: 'CTRL-DG-004',
      controlName: '测试控制点',
      l1: { code: 'IT04', name: '数据治理与监管数据报送' },
      l2: { code: 'IT04-06', name: '监管报送准确性控制' },
    },
    applicabilityReason: '这是用于雷达控制点详情抽屉回归的测试说明。',
    clauses: [],
    cases: [],
    evidences: [],
    questions: [],
    remediations: [],
  },
} as const

const CURRENT_ORGANIZATION_RESPONSE = {
  success: true,
  data: {
    organization: {
      id: 'org-e2e-1',
      name: 'E2E 测试机构',
    },
    role: 'admin',
  },
} as const

async function login(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  const emailInput = page.locator('input[placeholder="邮箱"]').first()
  const passwordInput = page.locator('input[placeholder="密码"]').first()

  if (await emailInput.isVisible()) {
    await emailInput.fill('admin@test.com')
    await passwordInput.fill('admin123')
  } else {
    await page.locator('input[name="email"]').fill('admin@test.com')
    await page.locator('input[name="password"]').fill('admin123')
  }

  await page.click('button[type="submit"]')
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
  await page.waitForLoadState('domcontentloaded')
}

async function mockCurrentOrganization(page: Page) {
  await page.route('**/organizations/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CURRENT_ORGANIZATION_RESPONSE),
    })
  })
}

async function mockCompliancePushes(page: Page, pushes: Array<Record<string, unknown>>) {
  await page.route('**/api/radar/pushes**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          data: pushes,
          pagination: {
            page: 1,
            limit: 20,
            total: pushes.length,
            totalPages: 1,
          },
        },
      }),
    })
  })
}

async function mockControlExplain(page: Page) {
  await page.route('**/compliance-intelligence/control-explain/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CONTROL_EXPLAIN_RESPONSE),
    })
  })
}

async function expectDrawerOpen(page: Page) {
  const drawer = page.locator(DRAWER_SELECTOR)
  await expect(drawer).toBeVisible({ timeout: 10000 })
  return drawer
}

async function expectDrawerClosed(page: Page) {
  await expect(page.locator(DRAWER_SELECTOR)).not.toBeVisible({ timeout: 5000 })
}

async function closeDrawer(page: Page) {
  await page.getByRole('button', { name: CLOSE_BUTTON_ARIA }).click()
}

async function expectDrawerSections(page: Page) {
  for (const sectionKey of EXPECTED_SECTIONS) {
    await expect(page.locator(`[data-testid="${SECTION_PREFIX}${sectionKey}"]`)).toBeAttached({
      timeout: 5000,
    })
  }
}

test.describe('[Story 7.2] 雷达页面控制点详情抽屉', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('AC1: 从推送卡片打开控制点详情抽屉', async ({ page }) => {
    await mockCurrentOrganization(page)
    await mockCompliancePushes(page, [MATCHED_PUSH])
    await mockControlExplain(page)

    await page.goto('/radar/compliance')
    await page.waitForLoadState('networkidle')

    const controlDetailButton = page.getByRole('button', { name: '查看控制点详情' })
    await expect(controlDetailButton).toBeVisible()
    await controlDetailButton.click()

    await expectDrawerOpen(page)
  })

  test('AC2: 抽屉显示来自雷达的来源标签', async ({ page }) => {
    await mockCurrentOrganization(page)
    await mockCompliancePushes(page, [MATCHED_PUSH])
    await mockControlExplain(page)

    await page.goto('/radar/compliance')
    await page.waitForLoadState('networkidle')

    const controlDetailButton = page.getByRole('button', { name: '查看控制点详情' })
    await expect(controlDetailButton).toBeVisible()
    await controlDetailButton.click()

    const drawer = await expectDrawerOpen(page)
    await expect(drawer.locator(SOURCE_BADGE_SELECTOR)).toContainText(/雷达|radar/i)
  })

  test('AC3: 关闭抽屉后雷达推送列表保持可见', async ({ page }) => {
    await mockCurrentOrganization(page)
    await mockCompliancePushes(page, [MATCHED_PUSH])
    await mockControlExplain(page)

    await page.goto('/radar/compliance')
    await page.waitForLoadState('networkidle')

    const controlDetailButton = page.getByRole('button', { name: '查看控制点详情' })
    await expect(controlDetailButton).toBeVisible()
    await controlDetailButton.click()
    await expectDrawerOpen(page)

    await closeDrawer(page)
    await expectDrawerClosed(page)

    await expect(page.getByText('合规雷达').first()).toBeVisible()
    await expect(page.getByText(MATCHED_PUSH.title)).toBeVisible()
  })

  test('AC4: 抽屉内容包含标准 6 个分节', async ({ page }) => {
    await mockCurrentOrganization(page)
    await mockCompliancePushes(page, [MATCHED_PUSH])
    await mockControlExplain(page)

    await page.goto('/radar/compliance')
    await page.waitForLoadState('networkidle')

    const controlDetailButton = page.getByRole('button', { name: '查看控制点详情' })
    await expect(controlDetailButton).toBeVisible()
    await controlDetailButton.click()
    await expectDrawerOpen(page)

    await expectDrawerSections(page)
  })

  test('AC5: 无匹配控制点的推送不显示控制点详情入口', async ({ page }) => {
    await mockCurrentOrganization(page)
    await mockCompliancePushes(page, [UNMATCHED_PUSH])

    await page.goto('/radar/compliance')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(UNMATCHED_PUSH.title)).toBeVisible()
    await expect(page.getByRole('button', { name: '查看应对剧本' })).toBeVisible()
    await expect(page.getByRole('button', { name: '查看控制点详情' })).toHaveCount(0)
  })
})
