import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'

const DESKTOP_VIEWPORT = { width: 1440, height: 900 }

test.use({ viewport: DESKTOP_VIEWPORT })

function skipMobileProject(testInfo: TestInfo) {
  test.skip(
    testInfo.project.name.startsWith('Mobile'),
    'Story 4.3 history/search flow is desktop-only; mobile desktop-required fallback is covered elsewhere.'
  )
}

async function mockAdvisorySession(page: Page) {
  await page.route('**/api/auth/session**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'consultant-history@example.com',
          name: 'ThinkTank Consultant',
          email: 'consultant-history@example.com',
          role: 'consultant',
          tenantId: 'tenant-history',
          organizationId: 'org-history',
        },
        accessToken: 'token-for-history',
        expires: '2099-01-01T00:00:00.000Z',
      }),
    })
  )
}

type MockAdvisoryWorkspaceOptions = {
  historyItems?: unknown[]
  searchItems?: unknown[]
}

function createReportHistoryItem() {
  return {
    id: 'output-1',
    resultType: 'output',
    sessionId: 'session-1',
    outputId: 'output-1',
    workflowKey: 'problem-solving',
    workflowType: 'Problem Solving',
    title: 'Retention Diagnosis',
    summary: 'Users drop after setup.',
    status: 'completed',
    lastStep: { index: 2, label: 'Map constraints' },
    timestamp: '2026-05-21T01:08:00.000Z',
    openTarget: 'view-output',
  }
}

async function mockAdvisoryWorkspaceApis(
  page: Page,
  options: MockAdvisoryWorkspaceOptions = {}
) {
  const historyItems = options.historyItems ?? [createReportHistoryItem()]
  const searchItems = options.searchItems ?? [createReportHistoryItem()]

  await page.route('**/api/advisory/access**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { allowed: true, module: 'thinktank' } }),
    })
  )
  await page.route('**/api/advisory/workflows', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          workflows: [
            ['brainstorming', 'Brainstorming'],
            ['domain-research', 'Domain Research'],
            ['market-research', 'Market Research'],
            ['product-brief', 'Product Brief'],
            ['prd', 'PRD'],
            ['problem-solving', 'Problem Solving'],
            ['design-thinking', 'Design Thinking'],
            ['storytelling', 'Storytelling'],
          ].map(([key, displayName]) => ({
            key,
            displayName,
            canonicalName: displayName,
            scenarioLabel:
              key === 'problem-solving' ? 'Systematic diagnosis' : 'Improve onboarding',
            sourcePath: `workflow:${key}`,
          })),
        },
      }),
    })
  )
  await page.route('**/api/advisory/organization-context', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'context-history',
          organizationName: 'History Tenant',
          industry: 'Data security',
          size: '100-500',
          completenessScore: 100,
          completeness: {
            requiredFieldsComplete: true,
            missingFields: [],
            updatedAt: '2026-05-21T01:00:00.000Z',
          },
          appliedToPrompts: false,
        },
      }),
    })
  )
  await page.route('**/api/advisory/sessions/unfinished', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { sessions: [] } }),
    })
  )
  await page.route('**/api/advisory/sessions/history**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { items: historyItems, meta: { page: 1, limit: 20, total: historyItems.length } },
      }),
    })
  )
  await page.route('**/api/advisory/sessions/search**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { items: searchItems, meta: { page: 1, limit: 20, total: searchItems.length } },
      }),
    })
  )
  await page.route('**/api/advisory/sessions/session-1/messages', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          sessionId: 'session-1',
          currentStep: { index: 2, label: 'Map constraints' },
          messages: [
            {
              id: 'message-assistant-1',
              role: 'assistant',
              content: 'Key conclusion: setup guidance is missing.',
              workflowKey: 'problem-solving',
              stepIndex: 2,
              decisionOptions: [],
            },
          ],
        },
      }),
    })
  )
  await page.route('**/api/advisory/sessions/session-1/output**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          sessionId: 'session-1',
          output: {
            id: 'output-1',
            sessionId: 'session-1',
            workflowKey: 'problem-solving',
            status: 'completed',
            title: 'Retention Diagnosis',
            summary: 'Users drop after setup.',
            contentMarkdown: '# Retention Diagnosis',
            sections: [
              {
                id: 'section-1',
                stepIndex: 2,
                heading: 'Map constraints',
                contentMarkdown: 'Guided setup is missing.',
                aiLabel: '[AI Generated]',
                metadata: {},
                createdAt: '2026-05-21T01:08:00.000Z',
              },
            ],
            aiLabelMetadata: { visible_label: '[AI Generated]' },
            metadata: {},
          },
        },
      }),
    })
  )
}

test.describe('Story 4.3 - Conversation History and Search', () => {
  test('[4.3-E2E-001][P1] filters, searches, and opens a ThinkTank report result', async ({
    page,
  }, testInfo) => {
    skipMobileProject(testInfo)
    await mockAdvisorySession(page)
    await mockAdvisoryWorkspaceApis(page)

    const historyReady = page.waitForResponse((response) =>
      response.url().includes('/api/advisory/sessions/history')
    )
    await page.goto('/advisory')
    await historyReady

    const historyRegion = page.getByRole('region', { name: '历史记录' })
    await expect(historyRegion).toBeVisible()
    await expect(
      historyRegion.getByRole('button', { name: /打开报告 Retention Diagnosis/ })
    ).toBeVisible()

    await chooseHistoryFilter(historyRegion, '历史类型', '报告')
    await chooseHistoryFilter(historyRegion, '历史状态', '已完成')
    await chooseHistoryFilter(historyRegion, '历史工作流', 'Problem Solving')
    await historyRegion.getByRole('searchbox', { name: '搜索历史记录' }).fill('retention')
    const searchReady = page.waitForResponse((response) =>
      response.url().includes('/api/advisory/sessions/search')
    )
    await historyRegion.getByRole('button', { name: '搜索历史' }).click()
    await searchReady

    const reportResult = historyRegion.getByRole('button', {
      name: /打开报告 Retention Diagnosis/,
    })
    await expect(reportResult).toContainText('Problem Solving')
    await expect(reportResult).toContainText('Users drop after setup.')

    await reportResult.click()

    await expect(page.getByRole('complementary', { name: '咨询文档抽屉' })).toContainText(
      'Retention Diagnosis'
    )
    await expect(page).toHaveURL(/\/advisory/)
  })

  test('[4.3-E2E-002][P1] empty history state is keyboard reachable and starts Quick Consult', async ({
    page,
  }, testInfo) => {
    skipMobileProject(testInfo)
    await mockAdvisorySession(page)
    await mockAdvisoryWorkspaceApis(page, { historyItems: [], searchItems: [] })

    const historyReady = page.waitForResponse((response) =>
      response.url().includes('/api/advisory/sessions/history')
    )
    await page.goto('/advisory')
    await historyReady

    const historyRegion = page.getByRole('region', { name: '历史记录' })
    await expect(historyRegion).toBeVisible()
    const emptyState = historyRegion.getByRole('status', { name: 'ThinkTank 历史空状态' })
    await expect(emptyState).toContainText('暂无历史记录')
    await expect(emptyState).toContainText('从 Quick Consult 开始第一次咨询后，历史会显示在这里。')

    const startButton = historyRegion.getByRole('button', { name: '开始第一次咨询' })
    await startButton.focus()
    await expect(startButton).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(page.getByRole('button', { name: 'Quick Consult', exact: true })).toBeFocused()
  })
})

async function chooseHistoryFilter(historyRegion: Locator, label: string, option: string) {
  await historyRegion.getByRole('combobox', { name: label }).click()
  await historyRegion.page().getByRole('option', { name: option }).click()
}
