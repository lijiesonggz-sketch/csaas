import { expect, test, type Page } from '@playwright/test'

/**
 * Story 8.1 ATDD - Taxonomy Rollout Overview Page
 *
 * AC#1: 管理员访问 /admin/taxonomy-rollout 页面，展示 IT01-IT08 核心状态
 * AC#2: 选中某个 domain 查看详情面板（ownership + thresholds + evidence）
 * AC#3: 页面展示 readiness 摘要（ready/not-ready/total）
 * AC#4: 支持按 rolloutState、killSwitchEnabled、allowLegacyFallback 和关键字过滤
 * AC#5: API 端点返回完整列表和单个详情
 */

const MOCK_POLICIES = [
  {
    id: 'p1',
    l1Code: 'IT01',
    rolloutState: 'legacy-primary',
    allowLegacyFallback: false,
    killSwitchEnabled: false,
    activeClassifierVersion: 'v2.0',
    primaryThreshold: 0.72,
    shadowWindowDays: 14,
    stateChangedAt: null,
    stateAllowsPrimary: true,
    stateAllowsLegacyFallback: false,
    hasRetirementEvidence: false,
  },
  {
    id: 'p2',
    l1Code: 'IT02',
    rolloutState: 'legacy-primary',
    allowLegacyFallback: true,
    killSwitchEnabled: false,
    activeClassifierVersion: 'v2.0',
    primaryThreshold: 0.72,
    shadowWindowDays: 14,
    stateChangedAt: null,
    stateAllowsPrimary: false,
    stateAllowsLegacyFallback: true,
    hasRetirementEvidence: false,
  },
  {
    id: 'p3',
    l1Code: 'IT03',
    rolloutState: 'legacy-primary',
    allowLegacyFallback: true,
    killSwitchEnabled: false,
    activeClassifierVersion: 'v2.0',
    primaryThreshold: 0.72,
    shadowWindowDays: 14,
    stateChangedAt: null,
    stateAllowsPrimary: false,
    stateAllowsLegacyFallback: true,
    hasRetirementEvidence: false,
  },
  {
    id: 'p4',
    l1Code: 'IT04',
    rolloutState: 'it04-on-new-interface',
    allowLegacyFallback: true,
    killSwitchEnabled: false,
    activeClassifierVersion: 'v2.0',
    primaryThreshold: 0.7,
    shadowWindowDays: 14,
    stateChangedAt: '2026-01-10T00:00:00.000Z',
    stateAllowsPrimary: true,
    stateAllowsLegacyFallback: true,
    hasRetirementEvidence: true,
  },
  {
    id: 'p5',
    l1Code: 'IT05',
    rolloutState: 'legacy-primary',
    allowLegacyFallback: true,
    killSwitchEnabled: false,
    activeClassifierVersion: 'v2.0',
    primaryThreshold: 0.72,
    shadowWindowDays: 14,
    stateChangedAt: null,
    stateAllowsPrimary: false,
    stateAllowsLegacyFallback: true,
    hasRetirementEvidence: false,
  },
  {
    id: 'p6',
    l1Code: 'IT06',
    rolloutState: 'legacy-primary',
    allowLegacyFallback: true,
    killSwitchEnabled: false,
    activeClassifierVersion: 'v2.0',
    primaryThreshold: 0.72,
    shadowWindowDays: 14,
    stateChangedAt: null,
    stateAllowsPrimary: false,
    stateAllowsLegacyFallback: true,
    hasRetirementEvidence: false,
  },
  {
    id: 'p7',
    l1Code: 'IT07',
    rolloutState: 'domain-compare',
    allowLegacyFallback: true,
    killSwitchEnabled: false,
    activeClassifierVersion: 'v2.0',
    primaryThreshold: 0.78,
    shadowWindowDays: 14,
    stateChangedAt: '2026-01-12T00:00:00.000Z',
    stateAllowsPrimary: false,
    stateAllowsLegacyFallback: true,
    hasRetirementEvidence: false,
  },
  {
    id: 'p8',
    l1Code: 'IT08',
    rolloutState: 'legacy-primary',
    allowLegacyFallback: true,
    killSwitchEnabled: false,
    activeClassifierVersion: 'v2.0',
    primaryThreshold: 0.72,
    shadowWindowDays: 14,
    stateChangedAt: null,
    stateAllowsPrimary: false,
    stateAllowsLegacyFallback: true,
    hasRetirementEvidence: false,
  },
]

const MOCK_DETAIL = {
  id: 'p4',
  l1Code: 'IT04',
  rolloutState: 'it04-on-new-interface',
  allowLegacyFallback: true,
  killSwitchEnabled: false,
  activeClassifierVersion: 'v2.0',
  primaryThreshold: 0.7,
  shadowWindowDays: 14,
  stateChangedAt: '2026-01-10T00:00:00.000Z',
  stateAllowsPrimary: true,
  stateAllowsLegacyFallback: true,
  hasRetirementEvidence: true,
  mappingOwner: 'team-alpha',
  rulebookOwner: 'team-beta',
  benchmarkOwner: 'team-gamma',
  gateApprover: 'lead-1',
  rollbackApprover: 'lead-2',
  cutoverThresholdsJson: { canaryPercentage: 10, errorBudget: 0.02 },
  retirementThresholdsJson: { fallbackRateMax: 0.05 },
  retirementEvidenceJson: {
    lastCutoverAt: '2026-01-10T00:00:00.000Z',
    lastCutoverReleaseId: 'rel-001',
    lastLegacyOffAt: null,
    lastLegacyOffReleaseId: null,
    lastKillSwitchDrillAt: null,
    lastRollbackVerifiedAt: null,
    lastReclassifyVerifiedAt: null,
    lastBackfillVerifiedAt: null,
    lastSmokeVerifiedAt: null,
    lastRetirementReportPath: '/reports/it04-retirement.json',
  },
  updatedAt: '2026-01-15T00:00:00.000Z',
}

type SetupMocksOptions = {
  sessionRole?: 'admin' | 'consultant'
  policies?: typeof MOCK_POLICIES
  detail?: typeof MOCK_DETAIL
  detailStatus?: number
  detailMessage?: string
}

async function setupMocks(page: Page, options: SetupMocksOptions = {}) {
  const {
    sessionRole = 'admin',
    policies = MOCK_POLICIES,
    detail = MOCK_DETAIL,
    detailStatus = 200,
    detailMessage = 'detail request failed',
  } = options

  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'a1', name: 'Admin', email: 'a@b.com', role: sessionRole },
        accessToken: 'tok',
        expires: '2099-01-01T00:00:00.000Z',
      }),
    })
  )
  await page.route('**/api/admin/knowledge-graph/taxonomy-rollout/policies', (route) => {
    if (!route.request().url().includes('/IT'))
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: policies }),
      })
    return route.continue()
  })
  await page.route('**/api/admin/knowledge-graph/taxonomy-rollout/policies/IT04', (route) =>
    route.fulfill({
      status: detailStatus,
      contentType: 'application/json',
      body:
        detailStatus >= 400
          ? JSON.stringify({ message: detailMessage })
          : JSON.stringify({ success: true, data: detail }),
    })
  )
}

async function selectFilterOption(page: Page, comboboxIndex: number, optionLabel: string) {
  await page.getByRole('combobox').nth(comboboxIndex).click()
  const option = page.locator('[role="option"]').filter({ hasText: optionLabel }).first()
  await expect(option).toBeVisible()
  await option.click()
}

test.describe('Story 8.1 - Taxonomy Rollout Overview', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page)
  })

  test('[8.1-E2E-001][P0] AC#1 - displays all 8 domains with core status fields', async ({
    page,
  }) => {
    await page.goto('/admin/taxonomy-rollout')
    await expect(page.getByRole('heading', { name: /Taxonomy Rollout Overview/i })).toBeVisible()
    const table = page.getByRole('table')
    await expect(table).toBeVisible()
    await expect(table.getByText('Shadow Window')).toBeVisible()
    await expect(table.getByText('State Changed')).toBeVisible()
    for (const code of ['IT01', 'IT02', 'IT03', 'IT04', 'IT05', 'IT06', 'IT07', 'IT08']) {
      await expect(table.getByText(code, { exact: true })).toBeVisible()
    }
    await expect(page.getByRole('cell', { name: '14d' }).first()).toBeVisible()
    await expect(table.getByText('2026-01-10')).toBeVisible()
  })

  test('[8.1-E2E-002][P0] AC#2 - shows detail panel when domain row is clicked', async ({
    page,
  }) => {
    await page.goto('/admin/taxonomy-rollout')
    await expect(page.getByRole('table')).toBeVisible()
    await page.getByRole('row').filter({ hasText: 'IT04' }).click()
    await expect(page.getByText('IT04 详情')).toBeVisible()
    await expect(page.getByText('team-alpha')).toBeVisible()
    await expect(page.getByText('team-beta')).toBeVisible()
    await expect(page.getByText('team-gamma')).toBeVisible()
    await expect(page.getByText('lead-1')).toBeVisible()
    await expect(page.getByText('lead-2')).toBeVisible()
    await expect(page.getByText('Retirement Evidence')).toBeVisible()
    await expect(page.getByText('rel-001')).toBeVisible()
    await expect(page.getByText('/reports/it04-retirement.json')).toBeVisible()
  })

  test('[8.1-E2E-003][P0] AC#3 - displays readiness summary at page top', async ({ page }) => {
    await page.goto('/admin/taxonomy-rollout')
    const summary = page.getByTestId('readiness-summary')
    await expect(summary).toBeVisible()
    await expect(page.getByTestId('readiness-ready-count')).toHaveText('2')
    await expect(page.getByTestId('readiness-not-ready-count')).toHaveText('6')
    await expect(page.getByTestId('readiness-total-count')).toHaveText('8')
  })

  test('[8.1-E2E-004][P1] AC#4 - filters by keyword search', async ({ page }) => {
    await page.goto('/admin/taxonomy-rollout')
    await expect(page.getByRole('table')).toBeVisible()
    await page.getByPlaceholder('搜索 domain code...').fill('IT04')
    await expect(page.getByRole('table').getByText('IT04', { exact: true })).toBeVisible()
    await expect(page.getByRole('table').getByText('IT01', { exact: true })).not.toBeVisible()
  })

  test('[8.1-E2E-005][P1] AC#4 - filters by rolloutState select', async ({ page }) => {
    await page.goto('/admin/taxonomy-rollout')
    await expect(page.getByRole('table')).toBeVisible()
    await selectFilterOption(page, 0, 'Domain Compare')
    await expect(page.getByRole('table').getByText('IT07', { exact: true })).toBeVisible()
    await expect(page.getByRole('table').getByText('IT01', { exact: true })).not.toBeVisible()
  })

  test('[8.1-E2E-006][P1] AC#4 - filters by kill switch select', async ({ page }) => {
    await page.unroute('**/api/auth/session')
    await page.unroute('**/api/admin/knowledge-graph/taxonomy-rollout/policies')
    await page.unroute('**/api/admin/knowledge-graph/taxonomy-rollout/policies/IT04')
    await setupMocks(page, {
      policies: [{ ...MOCK_POLICIES[0], killSwitchEnabled: true }, MOCK_POLICIES[3]],
    })

    await page.goto('/admin/taxonomy-rollout')
    await expect(page.getByRole('table')).toBeVisible()
    await selectFilterOption(page, 1, '已启用')
    await expect(page.getByRole('table').getByText('IT01', { exact: true })).toBeVisible()
    await expect(page.getByRole('table').getByText('IT04', { exact: true })).not.toBeVisible()
  })

  test('[8.1-E2E-007][P1] AC#4 - filters by legacy fallback select', async ({ page }) => {
    await page.unroute('**/api/auth/session')
    await page.unroute('**/api/admin/knowledge-graph/taxonomy-rollout/policies')
    await page.unroute('**/api/admin/knowledge-graph/taxonomy-rollout/policies/IT04')
    await setupMocks(page, {
      policies: [{ ...MOCK_POLICIES[0], allowLegacyFallback: false }, MOCK_POLICIES[3]],
    })

    await page.goto('/admin/taxonomy-rollout')
    await expect(page.getByRole('table')).toBeVisible()
    await selectFilterOption(page, 2, '禁止')
    await expect(page.getByRole('table').getByText('IT01', { exact: true })).toBeVisible()
    await expect(page.getByRole('table').getByText('IT04', { exact: true })).not.toBeVisible()
  })

  test('[8.1-E2E-008][P1] AC#4 - shows empty state when filter matches nothing', async ({
    page,
  }) => {
    await page.goto('/admin/taxonomy-rollout')
    await expect(page.getByRole('table')).toBeVisible()
    await page.getByPlaceholder('搜索 domain code...').fill('NONEXISTENT')
    await expect(page.getByText('未找到匹配的 domain policies')).toBeVisible()
  })

  test('[8.1-E2E-009][P0] AC#5 - API returns list via GET /policies', async ({ page }) => {
    const apiCalled = page.waitForResponse(
      (r) => r.url().includes('/taxonomy-rollout/policies') && r.status() === 200
    )
    await page.goto('/admin/taxonomy-rollout')
    const response = await apiCalled
    const body = await response.json()
    expect(body.data).toHaveLength(8)
  })

  test('[8.1-E2E-010][P1] readiness summary shows correct counts for bootstrap data', async ({
    page,
  }) => {
    await page.goto('/admin/taxonomy-rollout')
    const summary = page.getByTestId('readiness-summary')
    await expect(summary).toBeVisible()
    await expect(page.getByTestId('readiness-ready-count')).toHaveText('2')
    await expect(page.getByTestId('readiness-not-ready-count')).toHaveText('6')
    await expect(page.getByTestId('readiness-total-count')).toHaveText('8')
    await expect(summary.getByText('Ready (PRIMARY_CHAIN)')).toBeVisible()
    await expect(summary.getByText('Not Ready')).toBeVisible()
    await expect(summary.getByText('Total Domains')).toBeVisible()
  })

  test('[8.1-E2E-011][P1] navigation back to knowledge graph overview works', async ({ page }) => {
    await page.goto('/admin/taxonomy-rollout')
    const backButton = page.getByRole('button', { name: '返回知识图谱总览' })
    await expect(backButton).toBeVisible()
    await backButton.click()
    await expect(page).toHaveURL(/\/admin\/knowledge-graph$/)
  })

  test('[8.1-E2E-012][P1] should show access denied state for non-admin session', async ({
    page,
  }) => {
    await page.unroute('**/api/auth/session')
    await page.unroute('**/api/admin/knowledge-graph/taxonomy-rollout/policies')
    await page.unroute('**/api/admin/knowledge-graph/taxonomy-rollout/policies/IT04')
    await setupMocks(page, { sessionRole: 'consultant' })

    await page.goto('/admin/taxonomy-rollout')
    await expect(page.getByRole('heading', { name: '无权访问 Taxonomy Rollout' })).toBeVisible()
    await expect(page.getByRole('button', { name: '返回管理后台' })).toBeVisible()
  })

  test('[8.1-E2E-013][P1] should show detail failure state when policy detail request fails', async ({
    page,
  }) => {
    await page.unroute('**/api/auth/session')
    await page.unroute('**/api/admin/knowledge-graph/taxonomy-rollout/policies')
    await page.unroute('**/api/admin/knowledge-graph/taxonomy-rollout/policies/IT04')
    await setupMocks(page, { detailStatus: 500 })

    await page.goto('/admin/taxonomy-rollout')
    await expect(page.getByRole('table')).toBeVisible()
    await page.getByRole('row').filter({ hasText: 'IT04' }).click()
    await expect(page.getByText('无法加载详情')).toBeVisible()
  })
})
