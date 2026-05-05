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

const REPORTS_PAGE_1 = {
  success: true,
  data: {
    items: [
      {
        id: 'hist-reclassify-1',
        l1Code: 'IT04',
        type: 'reclassify',
        status: 'completed',
        createdAt: '2026-05-04T09:00:00.000Z',
        summary: 'Reclassify dry-run completed for batch kg-v2-r3',
        reportPath: '/reports/taxonomy-recovery/reclassify/IT04-dry-run.json',
        evidenceLink: '/reports/taxonomy-recovery/reclassify/IT04-smoke.json',
      },
      {
        id: 'hist-retirement-1',
        l1Code: 'IT04',
        type: 'retirement',
        status: 'completed',
        createdAt: '2026-05-03T02:10:00.000Z',
        summary: 'Retirement report generated',
        reportPath: '/reports/taxonomy-retirement/IT04-kg-v2-r3.json',
        evidenceLink: '/reports/taxonomy-retirement/IT04-smoke.json',
      },
    ],
    page: 1,
    limit: 2,
    total: 3,
  },
}

const REPORTS_PAGE_2 = {
  success: true,
  data: {
    items: [
      {
        id: 'hist-rollback-1',
        l1Code: 'IT04',
        type: 'rollback',
        status: 'completed',
        createdAt: '2026-05-02T08:00:00.000Z',
        summary: 'Rollback verification evidence recorded',
        reportPath: '/reports/taxonomy-retirement/IT04-rollback.json',
        evidenceLink: '/reports/taxonomy-retirement/IT04-rollback-smoke.json',
      },
    ],
    page: 2,
    limit: 2,
    total: 3,
  },
}

type MockOptions = {
  reclassifyFails?: boolean
  backfillBlocked?: boolean
}

async function setupMocks(page: Page, options: MockOptions = {}) {
  const reportRequests: URL[] = []
  const reclassifyRequests: unknown[] = []
  const backfillRequests: unknown[] = []

  const buildDetail = (l1Code: string) => {
    const matchingPolicy =
      BASE_POLICIES.find((policy) => policy.l1Code === l1Code) ?? BASE_POLICIES[0]

    return {
      ...matchingPolicy,
      mappingOwner: 'team-alpha',
      rulebookOwner: 'team-beta',
      benchmarkOwner: 'team-gamma',
      gateApprover: 'lead-1',
      rollbackApprover: 'lead-2',
      cutoverThresholdsJson: { canaryPercentage: 10, errorBudget: 0.02 },
      retirementThresholdsJson: {
        rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
      },
      retirementEvidenceJson: {
        lastCutoverAt: '2026-05-01T00:00:00.000Z',
        lastCutoverReleaseId: 'rel-001',
        lastLegacyOffAt: '2026-05-03T02:10:00.000Z',
        lastLegacyOffReleaseId: 'kg-v2-r3',
        lastKillSwitchDrillAt: '2026-05-02T00:00:00.000Z',
        lastRollbackVerifiedAt: '2026-05-02T08:00:00.000Z',
        lastReclassifyVerifiedAt: '2026-05-04T09:00:00.000Z',
        lastBackfillVerifiedAt: '2026-05-04T10:00:00.000Z',
        lastSmokeVerifiedAt: '2026-05-03T02:10:15.000Z',
        lastRetirementReportPath: '/reports/taxonomy-retirement/IT04-kg-v2-r3.json',
      },
      updatedAt: '2026-05-04T10:00:00.000Z',
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
      body: JSON.stringify({ success: true, data: BASE_POLICIES }),
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

  await page.route('**/api/admin/knowledge-graph/taxonomy-rollout/reports**', (route) => {
    const url = new URL(route.request().url())
    reportRequests.push(url)
    const pageNumber = url.searchParams.get('page') ?? '1'

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pageNumber === '2' ? REPORTS_PAGE_2 : REPORTS_PAGE_1),
    })
  })

  await page.route('**/api/admin/knowledge-graph/taxonomy-rollout/reclassify**', (route) => {
    const body = route.request().postDataJSON()
    reclassifyRequests.push(body)

    if (options.reclassifyFails) {
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            code: 'RECLASSIFY_BLOCKED',
            message:
              'Reclassify blocked because latest pointer update is not allowed for shadow-only dry-run.',
            auditId: 'audit-reclassify-failed-1',
          },
        }),
      })
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          operation: 'reclassify',
          l1Code: 'IT04',
          dryRun: true,
          shadowOnly: true,
          processedCount: 3,
          affectedDomains: ['IT04'],
          latestPointerUpdated: false,
          classifierVersion: 'taxonomy-classifier-6.7',
          summary: 'Dry-run reclassified 3 cases for IT04 without updating latest pointers.',
          reportPath: '/reports/taxonomy-recovery/reclassify/IT04-dry-run.json',
          auditId: 'audit-reclassify-1',
        },
      }),
    })
  })

  await page.route('**/api/admin/knowledge-graph/taxonomy-rollout/backfill**', (route) => {
    const body = route.request().postDataJSON()
    backfillRequests.push(body)

    if (options.backfillBlocked ?? true) {
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            code: 'BACKFILL_BLOCKED',
            message:
              'Backfill is blocked for scoped non-dry-run execution; run dry-run or provide an approved batch scope.',
            auditId: 'audit-backfill-blocked-1',
          },
        }),
      })
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          operation: 'backfill',
          l1Code: 'IT04',
          dryRun: true,
          processedCount: 2,
          affectedDomains: ['IT04'],
          latestPointerUpdated: false,
          classifierVersion: null,
          summary: 'Backfill dry-run completed for 2 scoped cases.',
          reportPath: '/reports/taxonomy-recovery/backfill/IT04-dry-run.json',
          auditId: 'audit-backfill-1',
        },
      }),
    })
  })

  return { reportRequests, reclassifyRequests, backfillRequests }
}

async function selectOption(page: Page, comboboxIndex: number, optionLabel: string | RegExp) {
  await page.getByRole('combobox').nth(comboboxIndex).click()
  const option = page.locator('[role="option"]').filter({ hasText: optionLabel }).first()
  await expect(option).toBeVisible()
  await option.click()
}

test.describe('Story 8.4 - Taxonomy Rollout Recovery Console', () => {
  test('[8.4-E2E-001][P0] overview and retirement pages navigate to recovery console with l1Code preserved', async ({
    page,
  }) => {
    await setupMocks(page)

    await page.goto('/admin/taxonomy-rollout?l1Code=IT04', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /Taxonomy Rollout Overview/i })).toBeVisible()
    await page.getByRole('link', { name: /Recovery|History|Recovery Console/i }).click()
    await expect(page).toHaveURL(/\/admin\/taxonomy-rollout\/recovery\?l1Code=IT04/)
    await expect(
      page.getByRole('heading', { name: /Taxonomy Rollout Recovery Console/i })
    ).toBeVisible()

    await page.goto('/admin/taxonomy-rollout/retirement?l1Code=IT07', {
      waitUntil: 'domcontentloaded',
    })
    await expect(
      page.getByRole('heading', { name: /Taxonomy Rollout Retirement Console/i })
    ).toBeVisible()
    await page.getByRole('link', { name: /Recovery|History|Recovery Console/i }).click()
    await expect(page).toHaveURL(/\/admin\/taxonomy-rollout\/recovery\?l1Code=IT07/)
  })

  test('[8.4-E2E-002][P0] reclassify dry-run requires confirmation and renders structured result without updating latest pointer', async ({
    page,
  }) => {
    const mocks = await setupMocks(page)

    await page.goto('/admin/taxonomy-rollout/recovery?l1Code=IT04', {
      waitUntil: 'domcontentloaded',
    })

    await expect(
      page.getByRole('heading', { name: /Taxonomy Rollout Recovery Console/i })
    ).toBeVisible()
    await selectOption(page, 0, 'IT04')
    await selectOption(page, 1, /Reclassify/i)
    await page.getByLabel('Batch ID').fill('kg-v2-r3')
    await page.getByLabel('Case IDs').fill('case-101, case-101\ncase-202\ncase-303')
    await page.getByLabel('Classifier Version').fill('taxonomy-classifier-6.7')
    await page.getByLabel('Shadow Only').check()
    await page.getByLabel('Dry Run').check()

    await page.getByRole('button', { name: /Run Reclassify Dry Run/i }).click()

    const dialog = page.getByRole('dialog', { name: /Confirm Reclassify/i })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('IT04', { exact: true })).toBeVisible()
    await expect(dialog.getByText('kg-v2-r3')).toBeVisible()
    await expect(dialog.getByText('taxonomy-classifier-6.7')).toBeVisible()
    await expect(dialog.getByText('Dry Run').first()).toBeVisible()
    await expect(dialog.getByText(/Shadow Only/i)).toBeVisible()
    await dialog.getByLabel('Type Domain Code to Confirm').fill('IT04')

    const reclassifyResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/knowledge-graph/taxonomy-rollout/reclassify') &&
        response.status() === 200
    )
    await dialog.getByRole('button', { name: /Confirm Reclassify/i }).click()
    await reclassifyResponse

    expect(mocks.reclassifyRequests).toEqual([
      expect.objectContaining({
        l1Code: 'IT04',
        batchId: 'kg-v2-r3',
        caseIds: ['case-101', 'case-202', 'case-303'],
        classifierVersion: 'taxonomy-classifier-6.7',
        shadowOnly: true,
        dryRun: true,
        confirmationText: 'IT04',
      }),
    ])
    await expect(page.getByText('Dry-run reclassified 3 cases for IT04')).toBeVisible()
    await expect(page.getByText('Processed Count')).toBeVisible()
    await expect(page.getByText('Affected Domains')).toBeVisible()
    await expect(page.getByText('Latest Pointer Updated')).toBeVisible()
    await expect(page.getByText('No', { exact: true })).toBeVisible()
    await expect(page.getByText('taxonomy-classifier-6.7')).toBeVisible()
    await expect(
      page.getByText('/reports/taxonomy-recovery/reclassify/IT04-dry-run.json').first()
    ).toBeVisible()
  })

  test('[8.4-E2E-003][P0] backfill scoped execution uses confirmation and surfaces blocked reason with audit id', async ({
    page,
  }) => {
    const mocks = await setupMocks(page, { backfillBlocked: true })

    await page.goto('/admin/taxonomy-rollout/recovery?l1Code=IT04', {
      waitUntil: 'domcontentloaded',
    })

    await selectOption(page, 0, 'IT04')
    await selectOption(page, 1, /Backfill/i)
    await page.getByLabel('Batch ID').fill('kg-v2-r3')
    await page.getByLabel('Case IDs').fill('case-404\ncase-405')
    await page.getByLabel('Dry Run').uncheck()

    await page.getByRole('button', { name: /Run Backfill/i }).click()

    const dialog = page.getByRole('dialog', { name: /Confirm Backfill/i })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('IT04', { exact: true })).toBeVisible()
    await expect(dialog.getByText('kg-v2-r3')).toBeVisible()
    await expect(dialog.getByText(/Execute/i)).toBeVisible()
    await dialog.getByLabel('Type Domain Code to Confirm').fill('IT04')

    const backfillResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/knowledge-graph/taxonomy-rollout/backfill') &&
        response.status() === 409
    )
    await dialog.getByRole('button', { name: /Confirm Backfill/i }).click()
    await backfillResponse

    expect(mocks.backfillRequests).toEqual([
      expect.objectContaining({
        l1Code: 'IT04',
        batchId: 'kg-v2-r3',
        caseIds: ['case-404', 'case-405'],
        shadowOnly: false,
        dryRun: false,
        confirmationText: 'IT04',
      }),
    ])
    await expect(dialog.getByText('BACKFILL_BLOCKED')).toBeVisible()
    await expect(
      dialog.getByText('Backfill is blocked for scoped non-dry-run execution')
    ).toBeVisible()
    await expect(dialog.getByText('audit-backfill-blocked-1')).toBeVisible()
  })

  test('[8.4-E2E-004][P1] history supports server-side pagination and date filtering without fetching all records', async ({
    page,
  }) => {
    const mocks = await setupMocks(page)

    await page.goto('/admin/taxonomy-rollout/recovery?l1Code=IT04', {
      waitUntil: 'domcontentloaded',
    })

    await expect(page.getByRole('heading', { name: /Report History/i })).toBeVisible()
    await expect(page.getByText('Reclassify dry-run completed for batch kg-v2-r3')).toBeVisible()
    await expect(page.getByText('Retirement report generated')).toBeVisible()
    expect(mocks.reportRequests[0].searchParams.get('l1Code')).toBe('IT04')
    expect(mocks.reportRequests[0].searchParams.get('page')).toBe('1')
    expect(mocks.reportRequests[0].searchParams.get('limit')).toBe('2')

    await page.getByLabel('Date From').fill('2026-05-01')
    await page.getByLabel('Date To').fill('2026-05-04')
    const filterResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/knowledge-graph/taxonomy-rollout/reports') &&
        response.url().includes('dateFrom=2026-05-01') &&
        response.url().includes('dateTo=2026-05-04') &&
        response.status() === 200
    )
    await page.getByRole('button', { name: /Apply Filters/i }).click()
    await filterResponse

    const nextPageResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/knowledge-graph/taxonomy-rollout/reports') &&
        response.url().includes('page=2') &&
        response.status() === 200
    )
    await page.getByRole('button', { name: /Next Page/i }).click()
    await nextPageResponse

    await expect(page.getByText('Rollback verification evidence recorded')).toBeVisible()
    await expect(page.getByText('/reports/taxonomy-retirement/IT04-rollback.json')).toBeVisible()
    expect(mocks.reportRequests.some((url) => url.searchParams.get('limit') === null)).toBe(false)
    expect(mocks.reportRequests.some((url) => Number(url.searchParams.get('limit')) > 50)).toBe(
      false
    )
  })

  test('[8.4-E2E-005][P0] mutation failure remains visible in dialog and recovery page for operator review', async ({
    page,
  }) => {
    await setupMocks(page, { reclassifyFails: true })

    await page.goto('/admin/taxonomy-rollout/recovery?l1Code=IT04', {
      waitUntil: 'domcontentloaded',
    })

    await selectOption(page, 0, 'IT04')
    await selectOption(page, 1, /Reclassify/i)
    await page.getByLabel('Batch ID').fill('kg-v2-r3')
    await page.getByLabel('Case IDs').fill('case-501')
    await page.getByLabel('Classifier Version').fill('taxonomy-classifier-6.7')
    await page.getByLabel('Shadow Only').check()
    await page.getByLabel('Dry Run').check()
    await page.getByRole('button', { name: /Run Reclassify Dry Run/i }).click()

    const dialog = page.getByRole('dialog', { name: /Confirm Reclassify/i })
    await dialog.getByLabel('Type Domain Code to Confirm').fill('IT04')

    const failedResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/knowledge-graph/taxonomy-rollout/reclassify') &&
        response.status() === 409
    )
    await dialog.getByRole('button', { name: /Confirm Reclassify/i }).click()
    await failedResponse

    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('RECLASSIFY_BLOCKED')).toBeVisible()
    await expect(
      dialog.getByText('Reclassify blocked because latest pointer update is not allowed')
    ).toBeVisible()
    await expect(dialog.getByText('audit-reclassify-failed-1')).toBeVisible()

    await dialog
      .getByRole('button', { name: /^Close$/i })
      .first()
      .click()
    await expect(page.getByText('RECLASSIFY_BLOCKED')).toBeVisible()
    await expect(page.getByText('Operator review required')).toBeVisible()
    await expect(page.getByText('Audit ID: audit-reclassify-failed-1')).toBeVisible()
  })
})
