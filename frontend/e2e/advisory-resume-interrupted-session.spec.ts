import { expect, test, type Page, type TestInfo } from '@playwright/test'

const DESKTOP_VIEWPORT = { width: 1440, height: 900 }
const DEFAULT_USER_EMAIL = 'consultant-resume@example.com'

test.use({ viewport: DESKTOP_VIEWPORT })

function skipMobileProject(testInfo: TestInfo) {
  test.skip(
    testInfo.project.name.startsWith('Mobile'),
    'Story 4.2 resume flow is desktop-only; mobile desktop-required fallback is covered by the advisory baseline.'
  )
}

async function mockAdvisorySession(page: Page, email = DEFAULT_USER_EMAIL) {
  await page.route('**/api/auth/session**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: email,
          name: 'ThinkTank Consultant',
          email,
          role: 'consultant',
          tenantId: 'tenant-resume',
          organizationId: 'org-resume',
        },
        accessToken: `token-for-${email}`,
        expires: '2099-01-01T00:00:00.000Z',
      }),
    })
  )
}

async function mockAdvisoryWorkspaceApis(page: Page) {
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
            scenarioLabel: key === 'design-thinking' ? 'Improve onboarding' : 'Consulting workflow',
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
          id: 'context-resume',
          organizationName: 'Resume Tenant',
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
      body: JSON.stringify({
        data: {
          sessions: [
            {
              sessionId: 'session-1',
              workflowKey: 'problem-solving',
              workflowType: 'Problem Solving',
              title: 'Retention Diagnosis',
              lastStep: { index: 2, label: 'Map constraints' },
              status: 'active',
              statusSummary: '未完成 - 可继续',
              lastActivityAt: '2026-05-21T01:06:00.000Z',
              checkpointSource: 'hot',
            },
          ],
        },
      }),
    })
  )
  await page.route('**/api/advisory/sessions/session-1/resume', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          session: {
            sessionId: 'session-1',
            workflowKey: 'problem-solving',
            workflowType: 'Problem Solving',
            title: 'Retention Diagnosis',
            lastStep: { index: 2, label: 'Map constraints' },
            status: 'active',
            statusSummary: '未完成 - 可继续',
            lastActivityAt: '2026-05-21T01:06:00.000Z',
            checkpointSource: 'hot',
          },
          messages: [
            {
              id: 'message-assistant-1',
              role: 'assistant',
              content: 'Key conclusion: setup guidance is missing.',
              sequence: 2,
              workflowKey: 'problem-solving',
              stepIndex: 2,
              decisionOptions: [
                { key: 'continue', action: 'continue', label: '继续', enabled: true },
              ],
            },
          ],
          output: {
            id: 'output-1',
            sessionId: 'session-1',
            workflowKey: 'problem-solving',
            status: 'draft',
            title: 'Retention Diagnosis',
            summary: 'Users drop after setup.',
            contentMarkdown: '# Retention Diagnosis',
            sections: [
              {
                id: 'section-1',
                stepIndex: 2,
                heading: 'Map constraints',
                contentMarkdown: 'Trial users lack setup guidance.',
                aiLabel: '[AI Generated]',
                metadata: {},
                createdAt: '2026-05-21T01:06:00.000Z',
              },
            ],
            aiLabelMetadata: { visible_label: '[AI Generated]' },
            metadata: {},
          },
          checkpointSource: 'hot',
          recoveryMessage: {
            title: '已恢复未完成会话',
            content: '已恢复到 Map constraints。Key conclusion: setup guidance is missing.',
            lastStep: 'Map constraints',
            keyConclusions: ['setup guidance is missing'],
            actions: [
              { key: 'continue', label: '继续' },
              { key: 'review-document', label: '先查看文档' },
            ],
          },
          recoveredState: {
            lastStep: 'Map constraints',
            messageCount: 1,
            outputSectionCount: 1,
            recoveredFrom: 'checkpoint',
          },
          missingState: [],
        },
      }),
    })
  )
}

test.describe('Story 4.2 - Resume Interrupted Sessions', () => {
  test('[4.2-E2E-001][P1] resumes an unfinished ThinkTank session with recovery and document review actions', async ({
    page,
  }, testInfo) => {
    skipMobileProject(testInfo)
    await mockAdvisorySession(page)
    await mockAdvisoryWorkspaceApis(page)

    const unfinishedReady = page.waitForResponse((response) =>
      response.url().includes('/api/advisory/sessions/unfinished')
    )
    await page.goto('/advisory')
    await unfinishedReady

    const resumeButton = page.getByRole('button', { name: /继续 Retention Diagnosis/ })
    const workflowButton = page.getByRole('button', {
      name: /启动 Design Thinking（Improve onboarding）/,
    })
    await expect(resumeButton).toBeVisible()
    await expect(resumeButton).toContainText('Problem Solving')
    await expect(resumeButton).toContainText('Map constraints')
    await expect(resumeButton).toContainText('未完成 - 可继续')
    await expect(resumeButton).toContainText(/05\/21.*09:06/)
    const resumeCardIsBeforeCatalog = await resumeButton.evaluate((node, selector) => {
        const workflow = document.querySelector(selector)
        return Boolean(
          workflow && node.compareDocumentPosition(workflow) & Node.DOCUMENT_POSITION_FOLLOWING
        )
      }, 'button[aria-label^="启动 Design Thinking"]')
    expect(resumeCardIsBeforeCatalog).toBe(true)
    await expect(workflowButton).toBeVisible()

    const resumeReady = page.waitForResponse((response) =>
      response.url().includes('/api/advisory/sessions/session-1/resume')
    )
    await resumeButton.click()
    await resumeReady

    const recoverySummary = page.getByRole('article', { name: 'ThinkTank 会话恢复摘要' })
    await expect(recoverySummary).toBeVisible()
    await expect(recoverySummary).toContainText('已恢复未完成会话')
    await expect(recoverySummary).toContainText('Map constraints')
    await expect(recoverySummary).toContainText('setup guidance is missing')
    await expect(
      page.getByText('Key conclusion: setup guidance is missing.', { exact: true })
    ).toBeVisible()

    await recoverySummary.getByRole('button', { name: '先查看文档' }).click()
    await expect(page.getByRole('complementary', { name: '咨询文档抽屉' })).toContainText(
      'Retention Diagnosis'
    )

    await recoverySummary.getByRole('button', { name: '继续' }).click()
    await expect(page.getByRole('textbox', { name: '输入你的回答' })).toBeFocused()
  })
})
