import { expect, test, type Page } from '@playwright/test'

const BASE_POLICIES = [
  {
    id: 'p4',
    l1Code: 'IT04',
    rolloutState: 'domain-primary',
    allowLegacyFallback: true,
    killSwitchEnabled: false,
    activeClassifierVersion: 'taxonomy-classifier-6.6',
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
    rolloutState: 'domain-primary',
    allowLegacyFallback: true,
    killSwitchEnabled: false,
    activeClassifierVersion: 'taxonomy-classifier-6.6',
    primaryThreshold: 0.78,
    shadowWindowDays: 14,
    stateChangedAt: '2026-05-01T00:00:00.000Z',
    stateAllowsPrimary: true,
    stateAllowsLegacyFallback: true,
    hasRetirementEvidence: true,
  },
]

const BLOCKED_DRY_RUN = {
  success: true,
  data: {
    l1Code: 'IT07',
    currentState: 'domain-primary',
    targetState: 'legacy-off',
    allowed: false,
    gateStatus: 'FAIL',
    prerequisites: {
      cutoverTierPassed: true,
      observationWindowPassed: true,
      killSwitchDrillPassed: true,
      rollbackVerified: false,
      reclassifyReady: true,
      backfillReady: false,
    },
    blockingReasons: [
      'rollback readiness has not been verified',
      'backfill readiness has not been verified',
    ],
    rolloutGuidance: {
      rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
    },
    recommendedNextAction: 'Verify rollback and backfill readiness before retiring IT07.',
    policySummary: {
      l1Code: 'IT07',
      rolloutState: 'domain-primary',
      killSwitchEnabled: false,
      allowLegacyFallback: true,
    },
    cleanupReadiness: {
      allowed: false,
      blockingReasons: ['domain-primary stable window has not elapsed'],
    },
  },
}

const PASSING_DRY_RUN = {
  success: true,
  data: {
    l1Code: 'IT04',
    currentState: 'domain-primary',
    targetState: 'legacy-off',
    allowed: true,
    gateStatus: 'PASS',
    prerequisites: {
      cutoverTierPassed: true,
      observationWindowPassed: true,
      killSwitchDrillPassed: true,
      rollbackVerified: true,
      reclassifyReady: true,
      backfillReady: true,
    },
    blockingReasons: [],
    rolloutGuidance: {
      rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
    },
    recommendedNextAction: 'Execute legacy-off for IT04.',
    policySummary: {
      l1Code: 'IT04',
      rolloutState: 'domain-primary',
      killSwitchEnabled: false,
      allowLegacyFallback: true,
    },
    cleanupReadiness: {
      allowed: false,
      blockingReasons: ['first non-IT04 cleanup requires a separate release'],
    },
  },
}

const RETIREMENT_RESPONSE = {
  success: true,
  data: {
    l1Code: 'IT04',
    previousState: 'domain-primary',
    targetState: 'legacy-off',
    stateChangedAt: '2026-05-03T02:10:00.000Z',
    operator: 'admin-1',
    smokeVerification: { passed: true, checkedAt: '2026-05-03T02:10:15.000Z' },
    reportPath: '/reports/taxonomy-retirement/IT04-kg-v2-r3.json',
    finalFallbackRate: 0.0087,
    cleanupReadiness: {
      allowed: false,
      blockingReasons: ['first non-IT04 cleanup requires a separate release'],
    },
    auditSummary: { updatedBy: 'admin-1', releaseId: 'kg-v2-r3' },
    policySummary: {
      l1Code: 'IT04',
      rolloutState: 'legacy-off',
      allowLegacyFallback: false,
      killSwitchEnabled: false,
    },
  },
}

const ROLLBACK_RESPONSE = {
  success: true,
  data: {
    l1Code: 'IT04',
    previousState: 'legacy-off',
    targetState: 'domain-primary',
    stateChangedAt: '2026-05-03T02:20:00.000Z',
    operator: 'admin-1',
    legacyFallbackRestored: true,
    rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
    evidenceSummary: {
      lastRetirementReportPath: '/reports/taxonomy-retirement/IT04-kg-v2-r3.json',
      lastRollbackVerifiedAt: '2026-05-02T08:00:00.000Z',
    },
    policySummary: {
      l1Code: 'IT04',
      rolloutState: 'domain-primary',
      allowLegacyFallback: true,
      killSwitchEnabled: false,
    },
  },
}

async function setupMocks(page: Page, options?: { retiredDomain?: boolean }) {
  const retiredDomain = options?.retiredDomain ?? false
  let retirementCompleted = retiredDomain
  let rollbackCompleted = false

  const buildPolicies = () => {
    if (rollbackCompleted) {
      return [
        {
          ...BASE_POLICIES[0],
          rolloutState: 'domain-primary',
          allowLegacyFallback: true,
          stateChangedAt: '2026-05-03T02:20:00.000Z',
        },
        BASE_POLICIES[1],
      ]
    }

    if (retirementCompleted) {
      return [
        {
          ...BASE_POLICIES[0],
          rolloutState: 'legacy-off',
          allowLegacyFallback: false,
          stateChangedAt: '2026-05-03T02:10:00.000Z',
        },
        BASE_POLICIES[1],
      ]
    }

    return BASE_POLICIES
  }

  const buildDetail = (l1Code: string) => {
    const matchingPolicy =
      buildPolicies().find((policy) => policy.l1Code === l1Code) ?? buildPolicies()[0]

    return {
      ...matchingPolicy,
      mappingOwner: 'team-alpha',
      rulebookOwner: 'team-beta',
      benchmarkOwner: 'team-gamma',
      gateApprover: 'lead-1',
      rollbackApprover: 'lead-2',
      cutoverThresholdsJson: {
        canaryPercentage: 10,
        errorBudget: 0.02,
      },
      retirementThresholdsJson: {
        rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
      },
      retirementEvidenceJson: {
        lastCutoverAt: '2026-05-01T00:00:00.000Z',
        lastCutoverReleaseId: 'rel-001',
        lastLegacyOffAt: retirementCompleted ? '2026-05-03T02:10:00.000Z' : null,
        lastLegacyOffReleaseId: retirementCompleted ? 'kg-v2-r3' : null,
        lastKillSwitchDrillAt: '2026-05-02T00:00:00.000Z',
        lastRollbackVerifiedAt: rollbackCompleted ? '2026-05-03T02:20:00.000Z' : null,
        lastReclassifyVerifiedAt: '2026-05-02T00:00:00.000Z',
        lastBackfillVerifiedAt: '2026-05-02T00:00:00.000Z',
        lastSmokeVerifiedAt: retirementCompleted ? '2026-05-03T02:10:15.000Z' : null,
        lastRetirementReportPath: '/reports/taxonomy-retirement/IT04-kg-v2-r3.json',
      },
      updatedAt: '2026-05-03T02:20:00.000Z',
    }
  }

  await page.route('**/api/auth/session**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'admin-1', name: 'Admin', email: 'admin@test.com', role: 'admin' },
        accessToken: 'tok',
        expires: '2099-01-01T00:00:00.000Z',
      }),
    })
  )

  await page.route('**/api/admin/knowledge-graph/taxonomy-rollout/policies', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: buildPolicies() }),
    })
  )

  await page.route('**/api/admin/knowledge-graph/taxonomy-rollout/policies/*', (route) => {
    const l1Code = route.request().url().split('/').pop()?.trim().toUpperCase() ?? 'IT04'
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: buildDetail(l1Code) }),
    })
  })

  await page.route(
    '**/api/admin/knowledge-graph/taxonomy-rollout/retirement/dry-run**',
    (route) => {
      const requestBody = route.request().postDataJSON() as { l1Code?: string } | undefined

      let body = BLOCKED_DRY_RUN

      if (requestBody?.l1Code === 'IT04') {
        body = PASSING_DRY_RUN
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    }
  )

  await page.route(
    '**/api/admin/knowledge-graph/taxonomy-rollout/retirement/execute**',
    (route) => {
      retirementCompleted = true
      rollbackCompleted = false

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(RETIREMENT_RESPONSE),
      })
    }
  )

  await page.route(
    '**/api/admin/knowledge-graph/taxonomy-rollout/retirement/rollback**',
    (route) => {
      retirementCompleted = false
      rollbackCompleted = true

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ROLLBACK_RESPONSE),
      })
    }
  )
}

async function selectOption(page: Page, comboboxIndex: number, optionLabel: string) {
  await page.getByRole('combobox').nth(comboboxIndex).click()
  const option = page.locator('[role="option"]').filter({ hasText: optionLabel }).first()
  await expect(option).toBeVisible()
  await option.click()
}

test.describe('Story 8.3 - Taxonomy Rollout Retirement Console', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page)
  })

  test('[8.3-E2E-001][P0] blocked dry-run shows prerequisite checklist, blocking reasons, rollback path, and a disabled but visible Execute CTA', async ({
    page,
  }) => {
    await page.goto('/admin/taxonomy-rollout/retirement?l1Code=IT07', {
      waitUntil: 'domcontentloaded',
    })

    await expect(
      page.getByRole('heading', { name: /Taxonomy Rollout Retirement Console/i })
    ).toBeVisible()
    await selectOption(page, 0, 'IT07')
    await page.getByRole('button', { name: 'Run Retirement Dry Run' }).click()

    await expect(page.getByText('FAIL').first()).toBeVisible()
    await expect(page.getByText('Rollback Verified', { exact: true })).toBeVisible()
    await expect(page.getByText('Backfill Ready', { exact: true })).toBeVisible()
    await expect(page.getByText('rollback readiness has not been verified')).toBeVisible()
    await expect(page.getByText('backfill readiness has not been verified')).toBeVisible()
    await expect(
      page.getByText('Enable kill switch and revert rollout state to domain-primary')
    ).toBeVisible()

    const executeButton = page.getByRole('button', { name: 'Execute Legacy-Off' })
    await expect(executeButton).toBeVisible()
    await expect(executeButton).toBeDisabled()
  })

  test('[8.3-E2E-002][P0] passing legacy-off flow opens a structured confirmation dialog and shows smoke report and cleanup summary after success', async ({
    page,
  }) => {
    await page.goto('/admin/taxonomy-rollout/retirement?l1Code=IT04', {
      waitUntil: 'domcontentloaded',
    })

    await expect(
      page.getByRole('heading', { name: /Taxonomy Rollout Retirement Console/i })
    ).toBeVisible()
    await selectOption(page, 0, 'IT04')
    await page.getByRole('button', { name: 'Run Retirement Dry Run' }).click()

    await expect(page.getByText('PASS').first()).toBeVisible()
    await expect(page.getByText('Execute legacy-off for IT04.')).toBeVisible()

    await page.getByRole('button', { name: 'Execute Legacy-Off' }).click()

    const dialog = page.getByRole('dialog', { name: 'Confirm Legacy-Off' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('IT04', { exact: true })).toBeVisible()
    await expect(dialog.getByText('domain-primary', { exact: true })).toBeVisible()
    await dialog.getByLabel('Release ID').fill('kg-v2-r3')
    await dialog.getByLabel('Type Domain Code to Confirm').fill('IT04')
    await dialog.getByRole('button', { name: 'Confirm Execute Legacy-Off' }).click()

    await expect(page.getByText('Retirement completed')).toBeVisible()
    await expect(
      page.getByText('/reports/taxonomy-retirement/IT04-kg-v2-r3.json').first()
    ).toBeVisible()
    await expect(page.getByText('legacy-off', { exact: true })).toBeVisible()
    await expect(page.getByText('0.0087')).toBeVisible()
    await expect(page.getByText('first non-IT04 cleanup requires a separate release')).toBeVisible()
  })

  test('[8.3-E2E-003][P0] rollback flow shows rollback target and restores domain-primary state with legacy fallback re-enabled', async ({
    page,
  }) => {
    await page.unroute('**/api/auth/session**')
    await page.unroute('**/api/admin/knowledge-graph/taxonomy-rollout/policies**')
    await page.unroute('**/api/admin/knowledge-graph/taxonomy-rollout/retirement/dry-run**')
    await page.unroute('**/api/admin/knowledge-graph/taxonomy-rollout/retirement/execute**')
    await page.unroute('**/api/admin/knowledge-graph/taxonomy-rollout/retirement/rollback**')
    await setupMocks(page, { retiredDomain: true })

    await page.goto('/admin/taxonomy-rollout/retirement?l1Code=IT04&mode=rollback', {
      waitUntil: 'domcontentloaded',
    })

    await expect(
      page.getByRole('heading', { name: /Taxonomy Rollout Retirement Console/i })
    ).toBeVisible()
    await expect(page.getByText('legacy-off').first()).toBeVisible()

    await page.getByRole('button', { name: 'Rollback' }).click()

    const dialog = page.getByRole('dialog', { name: 'Confirm Rollback' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('legacy-off', { exact: true })).toBeVisible()
    await expect(dialog.getByText('domain-primary', { exact: true })).toBeVisible()
    await expect(
      dialog.getByText('Enable kill switch and revert rollout state to domain-primary')
    ).toBeVisible()
    await dialog.getByLabel('Type Domain Code to Confirm').fill('IT04')
    await dialog.getByRole('button', { name: 'Confirm Rollback' }).click()

    await expect(page.getByText('Rollback completed')).toBeVisible()
    await expect(page.getByText('domain-primary').first()).toBeVisible()
    await expect(page.getByText('Legacy Fallback: Restored', { exact: true })).toBeVisible()
    await expect(
      page.getByText('/reports/taxonomy-retirement/IT04-kg-v2-r3.json').first()
    ).toBeVisible()
  })
})
