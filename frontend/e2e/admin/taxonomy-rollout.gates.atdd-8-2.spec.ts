import { expect, test, type Page } from '@playwright/test'

const MOCK_POLICIES = [
  {
    id: 'p4',
    l1Code: 'IT04',
    rolloutState: 'it04-on-new-interface',
    allowLegacyFallback: true,
    killSwitchEnabled: false,
    activeClassifierVersion: 'taxonomy-classifier-6.4',
    primaryThreshold: 0.7,
    shadowWindowDays: 14,
    stateChangedAt: '2026-05-01T00:00:00.000Z',
    stateAllowsPrimary: true,
    stateAllowsLegacyFallback: true,
    hasRetirementEvidence: true,
  },
  {
    id: 'p7',
    l1Code: 'IT07',
    rolloutState: 'domain-compare',
    allowLegacyFallback: true,
    killSwitchEnabled: true,
    activeClassifierVersion: 'taxonomy-classifier-6.4',
    primaryThreshold: 0.78,
    shadowWindowDays: 14,
    stateChangedAt: '2026-05-01T00:00:00.000Z',
    stateAllowsPrimary: false,
    stateAllowsLegacyFallback: true,
    hasRetirementEvidence: false,
  },
]

const BLOCKED_EVALUATION = {
  success: true,
  data: {
    l1Code: 'IT07',
    currentState: 'domain-compare',
    targetState: 'domain-primary',
    allowed: false,
    gateStatus: 'FAIL',
    benchmarkGate: { gateStatus: 'FAIL' },
    metrics: {
      totalRuns: 42,
      fallbackRate: 0.0952,
      unknownRate: 0.0476,
      manualCorrectionRate: 0.0714,
      errorBudgetConsumed: 0.0952,
      observationWindowDays: 14,
    },
    blockingReasons: [
      'benchmark gate is not PASS for target domain',
      'runtime error budget exceeds cutover threshold',
    ],
    rolloutGuidance: {
      rollbackPath: 'Enable kill switch and revert rollout state',
    },
    recommendedNextAction: 'Investigate benchmark drift before promoting IT07 to domain-primary.',
    policySummary: {
      l1Code: 'IT07',
      rolloutState: 'domain-compare',
      killSwitchEnabled: true,
      allowLegacyFallback: true,
    },
  },
}

const PASSING_EVALUATION = {
  success: true,
  data: {
    l1Code: 'IT04',
    currentState: 'it04-on-new-interface',
    targetState: 'domain-shadow',
    allowed: true,
    gateStatus: 'PASS',
    benchmarkGate: { gateStatus: 'PASS' },
    metrics: {
      totalRuns: 58,
      fallbackRate: 0.0172,
      unknownRate: 0,
      manualCorrectionRate: 0.0172,
      errorBudgetConsumed: 0.0172,
      observationWindowDays: 14,
    },
    blockingReasons: [],
    rolloutGuidance: {
      rollbackPath: 'Enable kill switch and revert rollout state',
    },
    recommendedNextAction: 'Promote IT04 to domain-shadow and keep monitoring fallback rate.',
    policySummary: {
      l1Code: 'IT04',
      rolloutState: 'it04-on-new-interface',
      killSwitchEnabled: false,
      allowLegacyFallback: true,
    },
  },
}

const TRANSITION_RESPONSE = {
  success: true,
  data: {
    l1Code: 'IT04',
    previousState: 'it04-on-new-interface',
    targetState: 'domain-shadow',
    stateChangedAt: '2026-05-02T04:28:37.000Z',
    operator: 'a1',
    auditSummary: {
      updatedBy: 'a1',
      rollbackPath: 'Enable kill switch and revert rollout state',
    },
    policySummary: {
      l1Code: 'IT04',
      rolloutState: 'domain-shadow',
      killSwitchEnabled: false,
      allowLegacyFallback: true,
    },
  },
}

const POST_TRANSITION_EVALUATION = {
  success: true,
  data: {
    l1Code: 'IT04',
    currentState: 'domain-shadow',
    targetState: 'domain-compare',
    allowed: true,
    gateStatus: 'PASS',
    benchmarkGate: { gateStatus: 'PASS' },
    metrics: {
      totalRuns: 58,
      fallbackRate: 0.0172,
      unknownRate: 0,
      manualCorrectionRate: 0.0172,
      errorBudgetConsumed: 0.0172,
      observationWindowDays: 14,
    },
    blockingReasons: [],
    rolloutGuidance: {
      rollbackPath: 'Enable kill switch and revert rollout state',
    },
    recommendedNextAction: 'Continue shadow observation before compare rollout.',
    policySummary: {
      l1Code: 'IT04',
      rolloutState: 'domain-shadow',
      killSwitchEnabled: false,
      allowLegacyFallback: true,
    },
  },
}

async function setupMocks(page: Page) {
  let transitionCompleted = false

  await page.route('**/api/auth/session**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'a1', name: 'Admin', email: 'a@b.com', role: 'admin' },
        accessToken: 'tok',
        expires: '2099-01-01T00:00:00.000Z',
      }),
    })
  )

  await page.route('**/api/admin/knowledge-graph/taxonomy-rollout/policies**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: MOCK_POLICIES }),
    })
  )

  await page.route('**/api/admin/knowledge-graph/taxonomy-rollout/gates/evaluate**', (route) => {
    const requestBody = route.request().postDataJSON() as
      | { l1Code?: string; targetState?: string }
      | undefined

    let body = BLOCKED_EVALUATION

    if (requestBody?.l1Code === 'IT04' && requestBody?.targetState === 'domain-shadow') {
      body = transitionCompleted ? POST_TRANSITION_EVALUATION : PASSING_EVALUATION
    }

    if (requestBody?.l1Code === 'IT04' && requestBody?.targetState === 'domain-compare') {
      body = POST_TRANSITION_EVALUATION
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })

  await page.route('**/api/admin/knowledge-graph/taxonomy-rollout/transitions**', (route) => {
    transitionCompleted = true
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TRANSITION_RESPONSE),
    })
  })
}

async function selectOption(page: Page, comboboxIndex: number, optionLabel: string) {
  await page.getByRole('combobox').nth(comboboxIndex).click()
  const option = page.locator('[role="option"]').filter({ hasText: optionLabel }).first()
  await expect(option).toBeVisible()
  await option.click()
}

test.describe('Story 8.2 - Taxonomy Rollout Gates', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page)
  })

  test('[8.2-E2E-001][P0] blocked flow shows FAIL summary, metrics, blocking reasons, read-only kill switch, and a disabled but visible Promote CTA', async ({
    page,
  }) => {
    await page.goto('/admin/taxonomy-rollout/gates', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: /Taxonomy Rollout Gates/i })).toBeVisible()
    await selectOption(page, 0, 'IT07')
    await selectOption(page, 1, 'Domain Primary')
    await page.getByRole('button', { name: 'Evaluate Readiness' }).click()

    await expect(page.getByText('FAIL').first()).toBeVisible()
    await expect(page.getByText('Kill Switch: Enabled (read-only)')).toBeVisible()
    await expect(page.getByText('benchmark gate is not PASS for target domain')).toBeVisible()
    await expect(page.getByText('runtime error budget exceeds cutover threshold')).toBeVisible()
    await expect(page.getByText('Enable kill switch and revert rollout state')).toBeVisible()
    await expect(
      page.getByText('Investigate benchmark drift before promoting IT07 to domain-primary.')
    ).toBeVisible()

    const disabledButton = page.getByRole('button', { name: 'Promote to Primary' })
    await expect(disabledButton).toBeVisible()
    await expect(disabledButton).toBeDisabled()
  })

  test('[8.2-E2E-002][P0] passing promote flow opens a structured confirmation dialog and completes the state transition', async ({
    page,
  }) => {
    await page.goto('/admin/taxonomy-rollout/gates', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: /Taxonomy Rollout Gates/i })).toBeVisible()
    await selectOption(page, 0, 'IT04')
    await selectOption(page, 1, 'Domain Shadow')
    await page.getByRole('button', { name: 'Evaluate Readiness' }).click()

    await expect(page.getByText('PASS').first()).toBeVisible()
    await expect(page.getByText('Kill Switch: Disabled (read-only)')).toBeVisible()
    await expect(
      page.getByText('Promote IT04 to domain-shadow and keep monitoring fallback rate.')
    ).toBeVisible()

    await page.getByRole('button', { name: 'Promote to Shadow' }).click()

    const dialog = page.getByRole('dialog', { name: 'Confirm State Transition' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('IT04', { exact: true })).toBeVisible()
    await expect(dialog.getByText('it04-on-new-interface', { exact: true })).toBeVisible()
    await expect(dialog.getByText('domain-shadow', { exact: true })).toBeVisible()
    await expect(dialog.getByText('14 days')).toBeVisible()
    await expect(dialog.getByText('Enable kill switch and revert rollout state')).toBeVisible()

    await dialog.getByRole('button', { name: 'Confirm Promote to Shadow' }).click()

    await expect(page.getByText('Transition completed')).toBeVisible()
    await expect(page.getByText('2026-05-02')).toBeVisible()
    await expect(page.getByText(/domain-shadow/).first()).toBeVisible()
    await expect(
      page.getByText('Continue shadow observation before compare rollout.')
    ).toBeVisible()
  })
})
