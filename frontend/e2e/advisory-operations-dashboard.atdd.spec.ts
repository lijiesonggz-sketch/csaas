import { expect, test, type Page } from '@playwright/test'

const USAGE_API_PATTERN = '**/api/advisory/admin/operations/usage**'
const USAGE_API_PATH = '/api/advisory/admin/operations/usage'
const PROVIDER_TELEMETRY_API_PATTERN = '**/api/advisory/admin/operations/provider-telemetry**'
const PROVIDER_TELEMETRY_API_PATH = '/api/advisory/admin/operations/provider-telemetry'

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

type ProviderTelemetryFixtureOptions = {
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
              {
                period: '2026-05-01 to 2026-05-07',
                starts: 6,
                completions: 1,
                incompleteSessions: 5,
              },
              {
                period: '2026-05-08 to 2026-05-14',
                starts: 4,
                completions: 2,
                incompleteSessions: 2,
              },
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
            drilldown: [
              {
                period: '2026-05-01 to 2026-05-22',
                starts: 2,
                completions: 2,
                incompleteSessions: 0,
              },
            ],
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

function buildProviderTelemetryResponse(options: ProviderTelemetryFixtureOptions = {}) {
  const freshnessStatus = options.freshnessStatus ?? 'fresh'
  const unavailable = freshnessStatus === 'unavailable'
  const data: Record<string, unknown> = {
    generatedAt: '2026-05-23T01:30:00.000Z',
    appliedFilters: {
      tenantId: 'tenant-alpha',
      dateFrom: '2026-05-01T00:00:00.000Z',
      dateTo: '2026-05-22T23:59:59.999Z',
      groupBy: ['workflow', 'experience', 'provider'],
    },
    summary: unavailable
      ? {
          terminalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          retryEvents: 0,
          errorRate: null,
          timeoutRate: null,
          estimatedTokens: 0,
          estimatedCost: 0,
          latency: { averageMs: null, p95Ms: null },
          tokens: { input: 0, output: 0, total: 0, estimated: 0 },
          measurementStatus: 'unavailable',
        }
      : {
          terminalCalls: 8,
          successfulCalls: 6,
          failedCalls: 2,
          retryEvents: 1,
          errorRate: 0.25,
          timeoutRate: 0.125,
          estimatedTokens: 12000,
          estimatedCost: 18.75,
          latency: { averageMs: 3400, p95Ms: 6200 },
          tokens: { input: 7200, output: 4800, total: 12000, estimated: 12000 },
          measurementStatus: freshnessStatus,
        },
    byWorkflow: unavailable
      ? []
      : [
          {
            workflowKey: 'problem-solving',
            workflowLabel: 'Problem Solving',
            terminalCalls: 5,
            successfulCalls: 3,
            failedCalls: 2,
            retryEvents: 1,
            errorRate: 0.4,
            timeoutRate: 0.2,
            estimatedTokens: 9000,
            estimatedCost: 13.5,
            latency: { averageMs: 3600, p95Ms: 6400 },
            tokens: { input: 5400, output: 3600, total: 9000, estimated: 9000 },
            measurementStatus: freshnessStatus,
            cacheHits: 3,
            cacheMisses: 2,
            cacheBypasses: 0,
          },
        ],
    byExperience: unavailable
      ? []
      : [
          {
            experience: 'quick_consult',
            terminalCalls: 3,
            successfulCalls: 3,
            failedCalls: 0,
            retryEvents: 0,
            errorRate: 0,
            timeoutRate: 0,
            estimatedTokens: 900,
            estimatedCost: 1.2,
            latency: { averageMs: 1400, p95Ms: 2300 },
            tokens: { input: 500, output: 400, total: 900, estimated: 900 },
            measurementStatus: freshnessStatus,
            cacheHits: 2,
            cacheMisses: 1,
            cacheBypasses: 0,
          },
          {
            experience: 'party_mode',
            terminalCalls: 5,
            successfulCalls: 3,
            failedCalls: 2,
            retryEvents: 1,
            errorRate: 0.4,
            timeoutRate: 0.2,
            estimatedTokens: 11100,
            estimatedCost: 17.55,
            latency: { averageMs: 4600, p95Ms: 7200 },
            tokens: { input: 6700, output: 4400, total: 11100, estimated: 11100 },
            measurementStatus: freshnessStatus,
            cacheHits: 2,
            cacheMisses: 3,
            cacheBypasses: 1,
          },
        ],
    byProvider: unavailable
      ? []
      : [
          {
            provider: 'zhipu-glm',
            terminalCalls: 8,
            successfulCalls: 6,
            failedCalls: 2,
            retryEvents: 1,
            errorRate: 0.25,
            timeoutRate: 0.125,
            estimatedTokens: 12000,
            estimatedCost: 18.75,
            latency: { averageMs: 3400, p95Ms: 6200 },
            tokens: { input: 7200, output: 4800, total: 12000, estimated: 12000 },
            measurementStatus: freshnessStatus,
            cacheHits: 5,
            cacheMisses: 3,
            cacheBypasses: 1,
          },
        ],
    cache: unavailable
      ? {
          hits: 0,
          misses: 0,
          bypasses: 0,
          totalLookups: 0,
          hitRate: null,
          cachedInputTokens: 0,
          cacheReadInputTokens: 0,
          cacheCreationInputTokens: 0,
          cacheEligibleInputTokens: 0,
        }
      : {
          hits: 5,
          misses: 3,
          bypasses: 1,
          totalLookups: 9,
          hitRate: 0.5556,
          cachedInputTokens: 3200,
          cacheReadInputTokens: 2200,
          cacheCreationInputTokens: 1000,
          cacheEligibleInputTokens: 5900,
        },
    instrumentationGaps: unavailable
      ? []
      : [
          {
            eventName: 'thinktank.provider.call_failed',
            reason: 'missing_grouping_metadata',
            owner: 'provider_gateway',
            count: 1,
          },
        ],
    freshness:
      freshnessStatus === 'fresh'
        ? {
            source: 'audit_logs',
            status: 'fresh',
            latestEventAt: '2026-05-22T08:10:00.000Z',
            description: 'Provider telemetry is current.',
          }
        : freshnessStatus === 'delayed'
          ? {
              source: 'audit_logs',
              status: 'delayed',
              latestEventAt: '2026-05-20T08:10:00.000Z',
              description: 'Provider telemetry is delayed. Treat these metrics as stale.',
            }
          : {
              source: 'audit_logs',
              status: 'unavailable',
              latestEventAt: null,
              description:
                'Provider telemetry source is unavailable. No trusted measurements are available.',
            },
  }

  if (options.includeRawPrivacyProbe) {
    Object.assign(data, {
      rawProviderPayload: RAW_PRIVACY_STRINGS[1],
      conversation: RAW_PRIVACY_STRINGS[0],
      report: RAW_PRIVACY_STRINGS[2],
      feedback: RAW_PRIVACY_STRINGS[3],
      cacheKey: 'PRIVATE_CACHE_KEY_DO_NOT_RENDER',
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

async function mockProviderTelemetryResponse(page: Page, responseBody: unknown, status = 200) {
  await page.route(PROVIDER_TELEMETRY_API_PATTERN, async (route) => {
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

async function openOperationsDashboardWithProviderTelemetry(
  page: Page,
  expectedUsageStatus = 200,
  expectedProviderStatus = 200
) {
  const usageResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(USAGE_API_PATH) && response.status() === expectedUsageStatus
  )
  const providerResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(PROVIDER_TELEMETRY_API_PATH) &&
      response.status() === expectedProviderStatus
  )

  await page.goto('/admin/advisory/operations')
  const [usageResponse, providerResponse] = await Promise.all([
    usageResponsePromise,
    providerResponsePromise,
  ])

  if (expectedUsageStatus < 400) expect(usageResponse.ok()).toBeTruthy()
  if (expectedProviderStatus < 400) expect(providerResponse.ok()).toBeTruthy()
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
    await mockProviderTelemetryResponse(page, buildProviderTelemetryResponse())

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
    await expect(
      workflowTable.getByRole('row').filter({ hasText: 'Problem Solving' })
    ).toContainText('30%')
    await expect(
      workflowTable.getByRole('row').filter({ hasText: 'Innovation Strategy' })
    ).toContainText('100%')

    const gaps = page.getByRole('region', { name: /Instrumentation gaps/i })
    await expect(gaps).toContainText(/unknown event name/i)
    await expect(gaps).toContainText(/wrong event version/i)
  })

  test('[6.1-E2E-002][P1][AC1] applies tenant, date range, and workflow filters to the operations usage request', async ({
    page,
  }) => {
    await mockAdminSession(page)
    await mockUsageResponse(page, buildUsageResponse())
    await mockProviderTelemetryResponse(page, buildProviderTelemetryResponse())
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

  test('[6.1-E2E-003][P1][AC3] opens low-completion drilldown with aggregate counts only', async ({
    page,
  }) => {
    await mockAdminSession(page)
    await mockUsageResponse(page, buildUsageResponse())
    await mockProviderTelemetryResponse(page, buildProviderTelemetryResponse())
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
    await mockProviderTelemetryResponse(page, buildProviderTelemetryResponse())

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
    await mockProviderTelemetryResponse(page, buildProviderTelemetryResponse())

    await openOperationsDashboard(page, 503)

    const alert = page
      .getByRole('alert')
      .filter({ hasText: /Telemetry unavailable|Usage data unavailable/i })
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
    await mockProviderTelemetryResponse(page, buildProviderTelemetryResponse())

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

test.describe('Story 6.3 - provider cost latency and failure dashboard E2E (ATDD RED)', () => {
  test('[6.3-E2E-001][P1][AC1,AC2] renders provider monitoring groups, threshold warnings, and freshness context', async ({
    page,
  }) => {
    await mockAdminSession(page)
    await mockUsageResponse(page, buildUsageResponse())
    await mockProviderTelemetryResponse(page, buildProviderTelemetryResponse())

    await openOperationsDashboardWithProviderTelemetry(page)

    const providerMetrics = page.getByRole('region', { name: /Provider telemetry metrics/i })
    await expect(providerMetrics).toContainText('Average latency')
    await expect(providerMetrics).toContainText('3400 ms')
    await expect(providerMetrics).toContainText('P95 latency')
    await expect(providerMetrics).toContainText('6200 ms')
    await expect(providerMetrics).toContainText('Error rate')
    await expect(providerMetrics).toContainText('25%')
    await expect(providerMetrics).toContainText('Timeout rate')
    await expect(providerMetrics).toContainText('12.5%')
    await expect(providerMetrics).toContainText('Estimated tokens')
    await expect(providerMetrics).toContainText('12,000')
    await expect(providerMetrics).toContainText('Estimated cost')
    await expect(providerMetrics).toContainText('18.75')
    await expect(providerMetrics).toContainText('Cache hit rate')
    await expect(providerMetrics).toContainText('55.6%')

    const providerGroups = page.getByRole('table', { name: /Provider telemetry groups/i })
    await expect(providerGroups).toContainText('Problem Solving')
    await expect(providerGroups).toContainText('Quick Consult')
    await expect(providerGroups).toContainText('Party Mode')
    await expect(providerGroups).toContainText('zhipu-glm')

    const breaches = page.getByRole('region', { name: /Provider threshold breaches/i })
    await expect(breaches).toContainText(/Warning breach/i)
    await expect(breaches).toContainText('P95 latency')
    await expect(breaches).toContainText('tenant-alpha')
    await expect(breaches).toContainText('Workflow type: all')
    await expect(breaches).toContainText('2026-05-01 to 2026-05-22')

    const providerGaps = page.getByRole('region', { name: /Provider telemetry gaps/i })
    await expect(providerGaps).toContainText(/missing grouping metadata/i)
    await expect(providerGaps).toContainText('provider_gateway')
  })

  test('[6.3-E2E-002][P1][AC1] applies shared filters to provider telemetry requests', async ({
    page,
  }) => {
    await mockAdminSession(page)
    await mockUsageResponse(page, buildUsageResponse())
    await mockProviderTelemetryResponse(page, buildProviderTelemetryResponse())
    await openOperationsDashboardWithProviderTelemetry(page)

    const filteredProviderRequestPromise = page.waitForRequest((request) => {
      const url = new URL(request.url())
      return (
        url.pathname.includes(PROVIDER_TELEMETRY_API_PATH) &&
        url.searchParams.get('tenantId') === 'tenant-beta' &&
        url.searchParams.get('dateFrom') === '2026-05-01' &&
        url.searchParams.get('dateTo') === '2026-05-22' &&
        url.searchParams.get('workflowType') === 'problem-solving' &&
        url.searchParams.get('groupBy') === 'workflow,experience,provider'
      )
    })

    await chooseComboboxOption(page, /Tenant/i, 'Tenant Beta')
    await page.getByLabel(/Date from/i).fill('2026-05-01')
    await page.getByLabel(/Date to/i).fill('2026-05-22')
    await chooseComboboxOption(page, /Workflow type/i, 'Problem Solving')
    await page.getByRole('button', { name: /Apply filters/i }).click()

    const filteredRequest = await filteredProviderRequestPromise
    const filteredUrl = new URL(filteredRequest.url())
    expect(filteredUrl.searchParams.get('tenantId')).toBe('tenant-beta')
    expect(filteredUrl.searchParams.get('dateFrom')).toBe('2026-05-01')
    expect(filteredUrl.searchParams.get('dateTo')).toBe('2026-05-22')
    expect(filteredUrl.searchParams.get('workflowType')).toBe('problem-solving')
    expect(filteredUrl.searchParams.get('groupBy')).toBe('workflow,experience,provider')
  })

  test('[6.3-E2E-003][P1][AC3] shows unavailable provider telemetry without successful zero measurements or raw private content', async ({
    page,
  }) => {
    await mockAdminSession(page)
    await mockUsageResponse(page, buildUsageResponse())
    await mockProviderTelemetryResponse(
      page,
      buildProviderTelemetryResponse({
        freshnessStatus: 'unavailable',
        includeRawPrivacyProbe: true,
      }),
      503
    )

    await openOperationsDashboardWithProviderTelemetry(page, 200, 503)

    const alert = page.getByRole('alert').filter({ hasText: /Provider telemetry unavailable/i })
    await expect(alert).toBeVisible()
    await expect(alert).toContainText(/No trusted measurements/i)
    await expect(page.getByText(/Average latency\s+0 ms/i)).toHaveCount(0)
    await expect(page.getByText(/Estimated cost\s+0/i)).toHaveCount(0)
    await expectRawPrivacyStringsHidden(page)
    await expect(page.getByText('PRIVATE_CACHE_KEY_DO_NOT_RENDER', { exact: true })).toHaveCount(0)
  })
})
