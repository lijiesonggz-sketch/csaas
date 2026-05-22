import { expect, test, type Page } from '@playwright/test'

const USAGE_API_PATTERN = '**/api/advisory/admin/operations/usage**'
const USAGE_API_PATH = '/api/advisory/admin/operations/usage'

const RAW_PRIVACY_STRINGS = [
  'PRIVATE_CONVERSATION_DO_NOT_RENDER',
  'PRIVATE_PROMPT_DO_NOT_RENDER',
  'PRIVATE_REPORT_DO_NOT_RENDER',
  'PRIVATE_FEEDBACK_DO_NOT_RENDER',
]

type FreshnessStatus = 'fresh' | 'delayed' | 'unavailable'

type UsageFixtureOptions = {
  freshnessStatus?: FreshnessStatus
  includeRawPrivacyProbe?: boolean
}

async function mockAdminSession(page: Page) {
  await page.route('**/api/auth/session**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'operator-story-6-1',
          name: 'ThinkTank Operator',
          email: 'operator@example.com',
          role: 'admin',
          tenantId: 'tenant-alpha',
          organizationId: 'org-alpha',
        },
        accessToken: 'token-for-story-6-1-operations',
        expires: '2099-01-01T00:00:00.000Z',
      }),
    })
  })

  await page.route('**/api/advisory/access**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { allowed: true, module: 'thinktank' } }),
    })
  })
}

function buildUsageResponse(options: UsageFixtureOptions = {}) {
  const freshnessStatus = options.freshnessStatus ?? 'fresh'
  const workflowUsage: Array<Record<string, unknown>> =
    freshnessStatus === 'unavailable'
      ? []
      : [
          {
            workflowKey: 'problem-solving',
            workflowLabel: 'Problem Solving',
            trendPeriod: '2026-05-01 to 2026-05-22',
            starts: 10,
            completions: 3,
            incompleteSessions: 7,
            completionRate: 30,
            lowCompletion: true,
            drilldown: [
              { period: '2026-05-01 to 2026-05-07', starts: 6, completions: 1, incompleteSessions: 5 },
              { period: '2026-05-08 to 2026-05-14', starts: 4, completions: 2, incompleteSessions: 2 },
            ],
          },
          {
            workflowKey: 'innovation-strategy',
            workflowLabel: 'Innovation Strategy',
            trendPeriod: '2026-05-01 to 2026-05-22',
            starts: 2,
            completions: 2,
            incompleteSessions: 0,
            completionRate: 100,
            lowCompletion: false,
            drilldown: [{ period: '2026-05-01 to 2026-05-22', starts: 2, completions: 2, incompleteSessions: 0 }],
          },
        ]

  const data: Record<string, unknown> = {
    generatedAt: '2026-05-22T08:12:12.000Z',
    filters: {
      selected: {
        tenantId: 'tenant-alpha',
        dateFrom: '2026-05-01',
        dateTo: '2026-05-22',
        workflowType: 'all',
      },
      tenants: [
        { id: 'tenant-alpha', name: 'Tenant Alpha' },
        { id: 'tenant-beta', name: 'Tenant Beta' },
      ],
      workflowTypes: [
        { key: 'all', label: 'All workflows' },
        { key: 'problem-solving', label: 'Problem Solving' },
        { key: 'innovation-strategy', label: 'Innovation Strategy' },
      ],
    },
    freshness:
      freshnessStatus === 'fresh'
        ? {
            status: 'fresh',
            lastEventAt: '2026-05-22T08:10:00.000Z',
            source: 'audit_logs',
            message: 'Telemetry is current through 2026-05-22 08:10 UTC.',
          }
        : freshnessStatus === 'delayed'
          ? {
              status: 'delayed',
              lastEventAt: '2026-05-20T08:10:00.000Z',
              source: 'audit_logs',
              message: 'Telemetry is delayed. Treat these metrics as stale.',
            }
          : {
              status: 'unavailable',
              lastEventAt: null,
              source: 'audit_logs',
              message: 'Telemetry source is unavailable. No trusted measurements are available.',
            },
    metrics:
      freshnessStatus === 'unavailable'
        ? null
        : {
            quickConsultVolume: 32,
            structuredWorkflowStarts: 12,
            completions: 7,
            incompleteSessions: 5,
            completionRate: 58.3,
            partyModeUsage: 3,
          },
    workflowUsage,
    instrumentationGaps:
      freshnessStatus === 'fresh'
        ? [
            {
              eventName: 'thinktank.workflow.unknown',
              reason: 'unknown_event_name',
              owningArea: 'workflow telemetry',
              count: 2,
            },
            {
              eventName: 'thinktank.workflow.started',
              reason: 'wrong_event_version',
              owningArea: 'Story 1.4 event contract',
              count: 1,
            },
          ]
        : [],
  }

  if (options.includeRawPrivacyProbe && workflowUsage[0]) {
    Object.assign(data, {
      rawConversationContent: RAW_PRIVACY_STRINGS[0],
      prompt: RAW_PRIVACY_STRINGS[1],
      reportContent: RAW_PRIVACY_STRINGS[2],
      feedbackText: RAW_PRIVACY_STRINGS[3],
    })
    Object.assign(workflowUsage[0], {
      rawConversationContent: RAW_PRIVACY_STRINGS[0],
      prompt: RAW_PRIVACY_STRINGS[1],
      reportContent: RAW_PRIVACY_STRINGS[2],
      feedbackText: RAW_PRIVACY_STRINGS[3],
    })
  }

  return { data }
}

async function mockUsageResponse(page: Page, responseBody: unknown, status = 200) {
  await page.route(USAGE_API_PATTERN, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(responseBody),
    })
  })
}

async function openOperationsDashboard(page: Page, expectedStatus = 200) {
  const usageResponsePromise = page.waitForResponse(
    (response) => response.url().includes(USAGE_API_PATH) && response.status() === expectedStatus
  )

  await page.goto('/admin/advisory/operations')
  const usageResponse = await usageResponsePromise

  if (expectedStatus < 400) {
    expect(usageResponse.ok()).toBeTruthy()
  }
}

async function chooseComboboxOption(page: Page, label: RegExp, optionName: RegExp | string) {
  await page.getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: optionName }).click()
}

async function expectRawPrivacyStringsHidden(page: Page) {
  for (const rawString of RAW_PRIVACY_STRINGS) {
    await expect(page.getByText(rawString, { exact: true })).toHaveCount(0)
  }
}

test.describe('Story 6.1 - ThinkTank operations usage dashboard E2E (ATDD RED)', () => {
  test('[6.1-E2E-001][P1][AC1,AC2,AC4] renders filters, usage metrics, workflow counts, and instrumentation gaps', async ({
    page,
  }) => {
    await mockAdminSession(page)
    await mockUsageResponse(page, buildUsageResponse())

    await openOperationsDashboard(page)

    await expect(page.getByRole('heading', { name: /ThinkTank Operations/i })).toBeVisible()
    await expect(page.getByRole('combobox', { name: /Tenant/i })).toBeVisible()
    await expect(page.getByLabel(/Date from/i)).toBeVisible()
    await expect(page.getByLabel(/Date to/i)).toBeVisible()
    await expect(page.getByRole('combobox', { name: /Workflow type/i })).toBeVisible()

    const metrics = page.getByRole('region', { name: /Usage metrics/i })
    await expect(metrics).toContainText('Quick Consult volume')
    await expect(metrics).toContainText('32')
    await expect(metrics).toContainText('Structured workflow starts')
    await expect(metrics).toContainText('12')
    await expect(metrics).toContainText('Completions')
    await expect(metrics).toContainText('7')
    await expect(metrics).toContainText('Incomplete sessions')
    await expect(metrics).toContainText('5')
    await expect(metrics).toContainText('Party Mode usage')
    await expect(metrics).toContainText('3')

    const workflowTable = page.getByRole('table', { name: /Workflow completion/i })
    await expect(workflowTable).toBeVisible()
    await expect(workflowTable.getByRole('row').filter({ hasText: 'Problem Solving' })).toContainText('30%')
    await expect(workflowTable.getByRole('row').filter({ hasText: 'Innovation Strategy' })).toContainText('100%')

    const gaps = page.getByRole('region', { name: /Instrumentation gaps/i })
    await expect(gaps).toContainText(/unknown event name/i)
    await expect(gaps).toContainText(/wrong event version/i)
  })

  test('[6.1-E2E-002][P1][AC1] applies tenant, date range, and workflow filters to the operations usage request', async ({
    page,
  }) => {
    await mockAdminSession(page)
    await mockUsageResponse(page, buildUsageResponse())
    await openOperationsDashboard(page)

    const filteredRequestPromise = page.waitForRequest((request) => {
      const url = new URL(request.url())
      return (
        url.pathname.includes(USAGE_API_PATH) &&
        url.searchParams.get('tenantId') === 'tenant-beta' &&
        url.searchParams.get('dateFrom') === '2026-05-01' &&
        url.searchParams.get('dateTo') === '2026-05-22' &&
        url.searchParams.get('workflowType') === 'problem-solving'
      )
    })

    await chooseComboboxOption(page, /Tenant/i, 'Tenant Beta')
    await page.getByLabel(/Date from/i).fill('2026-05-01')
    await page.getByLabel(/Date to/i).fill('2026-05-22')
    await chooseComboboxOption(page, /Workflow type/i, 'Problem Solving')
    await page.getByRole('button', { name: /Apply filters/i }).click()

    const filteredRequest = await filteredRequestPromise
    const filteredUrl = new URL(filteredRequest.url())
    expect(filteredUrl.searchParams.get('tenantId')).toBe('tenant-beta')
    expect(filteredUrl.searchParams.get('dateFrom')).toBe('2026-05-01')
    expect(filteredUrl.searchParams.get('dateTo')).toBe('2026-05-22')
    expect(filteredUrl.searchParams.get('workflowType')).toBe('problem-solving')
  })

  test('[6.1-E2E-003][P1][AC3] opens low-completion drilldown with aggregate counts only', async ({ page }) => {
    await mockAdminSession(page)
    await mockUsageResponse(page, buildUsageResponse())
    await openOperationsDashboard(page)

    const workflowTable = page.getByRole('table', { name: /Workflow completion/i })
    const lowCompletionRow = workflowTable.getByRole('row').filter({ hasText: 'Problem Solving' })
    await expect(lowCompletionRow).toContainText(/Low completion/i)
    await expect(lowCompletionRow).toContainText('2026-05-01 to 2026-05-22')

    await lowCompletionRow.getByRole('button', { name: /Drill down|View details/i }).click()

    const drilldown = page.getByRole('dialog', { name: /Problem Solving completion drilldown/i })
    await expect(drilldown).toBeVisible()
    await expect(drilldown).toContainText('Aggregated counts')
    await expect(drilldown).toContainText('Starts')
    await expect(drilldown).toContainText('10')
    await expect(drilldown).toContainText('Completions')
    await expect(drilldown).toContainText('3')
    await expect(drilldown).toContainText('Incomplete sessions')
    await expect(drilldown).toContainText('7')
    await expectRawPrivacyStringsHidden(page)
  })

  test('[6.1-E2E-004][P1][AC4] shows delayed freshness state without presenting stale zeros as successful measurements', async ({
    page,
  }) => {
    await mockAdminSession(page)
    await mockUsageResponse(page, buildUsageResponse({ freshnessStatus: 'delayed' }))

    await openOperationsDashboard(page)

    const freshness = page.getByRole('region', { name: /Data freshness/i })
    await expect(freshness).toContainText(/Delayed|Stale/i)
    await expect(freshness).toContainText(/2026-05-20|last event/i)
    await expect(page.getByText(/No trusted measurements|Metrics are stale/i)).toBeVisible()
    await expect(page.getByText(/Quick Consult volume\s+0/i)).toHaveCount(0)
    await expect(page.getByText(/Completion rate\s+0%/i)).toHaveCount(0)
  })

  test('[6.1-E2E-005][P1][AC4] shows unavailable telemetry state when operations usage cannot be loaded', async ({
    page,
  }) => {
    await mockAdminSession(page)
    await mockUsageResponse(page, buildUsageResponse({ freshnessStatus: 'unavailable' }), 503)

    await openOperationsDashboard(page, 503)

    const alert = page.getByRole('alert').filter({ hasText: /Telemetry unavailable|Usage data unavailable/i })
    await expect(alert).toBeVisible()
    await expect(alert).toContainText(/No trusted measurements|try again/i)
    await expect(page.getByText(/Quick Consult volume\s+0/i)).toHaveCount(0)
    await expect(page.getByText(/Structured workflow starts\s+0/i)).toHaveCount(0)
  })

  test('[6.1-E2E-006][P1][AC3] never renders raw private conversation, prompt, report, or feedback content from usage data', async ({
    page,
  }) => {
    await mockAdminSession(page)
    await mockUsageResponse(page, buildUsageResponse({ includeRawPrivacyProbe: true }))

    await openOperationsDashboard(page)

    await expectRawPrivacyStringsHidden(page)
    await page
      .getByRole('table', { name: /Workflow completion/i })
      .getByRole('row')
      .filter({ hasText: 'Problem Solving' })
      .getByRole('button', { name: /Drill down|View details/i })
      .click()

    const drilldown = page.getByRole('dialog', { name: /Problem Solving completion drilldown/i })
    await expect(drilldown).toContainText('Aggregated counts')
    await expectRawPrivacyStringsHidden(page)
  })
})
