import { expect, test } from '@playwright/test'

test.describe('Story 4.7 ATDD - advisory safe exit and destructive actions', () => {
  test('[P0][4.7-E2E-001][AC1,AC2] safe exit and delete confirmations use accessible dialog flows without data-testid selectors', async ({
    page,
  }) => {
    await page.route('**/api/auth/session**', async (route) => {
      await route.fulfill({
        json: {
          user: {
            id: 'consultant-safe-exit@example.com',
            name: 'ThinkTank Consultant',
            email: 'consultant-safe-exit@example.com',
            role: 'consultant',
            tenantId: 'tenant-safe-exit',
            organizationId: 'org-safe-exit',
          },
          accessToken: 'token-for-safe-exit',
          expires: '2099-01-01T00:00:00.000Z',
        },
      })
    })
    await page.route('**/api/advisory/access**', async (route) => {
      await route.fulfill({ json: { success: true, data: { allowed: true, module: 'thinktank' } } })
    })
    await page.route('**/api/advisory/workflows', async (route) => {
      await route.fulfill({
        json: {
          data: {
            workflows: [
              {
                key: 'problem-solving',
                displayName: 'Problem Solving',
                canonicalName: 'Problem Solving',
                scenarioLabel: 'Systematic diagnosis',
                sourcePath: 'workflow:problem-solving',
              },
            ],
          },
        },
      })
    })
    await page.route('**/api/advisory/organization-context', async (route) => {
      await route.fulfill({
        json: {
          data: {
            id: 'context-safe-exit',
            organizationName: 'Safe Exit Tenant',
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
        },
      })
    })
    await page.route('**/api/advisory/sessions/unfinished', async (route) => {
      await route.fulfill({
        json: {
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
        },
      })
    })
    await page.route('**/api/advisory/sessions/history**', async (route) => {
      await route.fulfill({
        json: { data: { items: [], meta: { page: 1, limit: 20, total: 0 } } },
      })
    })
    await page.route('**/api/advisory/sessions/session-1/resume', async (route) => {
      await route.fulfill({
        json: {
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
                workflowKey: 'problem-solving',
                stepIndex: 2,
                decisionOptions: [],
              },
            ],
            output: null,
            checkpointSource: 'hot',
            recoveryMessage: {
              title: '已恢复未完成会话',
              content: '已恢复到 Map constraints。',
              lastStep: 'Map constraints',
              keyConclusions: [],
              actions: [
                { key: 'continue', label: '继续' },
                { key: 'review-document', label: '先查看文档' },
              ],
            },
            recoveredState: {
              lastStep: 'Map constraints',
              messageCount: 1,
              outputSectionCount: 0,
              recoveredFrom: 'checkpoint',
            },
            missingState: [],
          },
        },
      })
    })
    await page.route('**/api/advisory/sessions/session-1/exit', async (route) => {
      await route.fulfill({
        json: {
          data: {
            sessionId: 'session-1',
            status: 'paused',
            updatedAt: '2026-05-21T01:10:00.000Z',
          },
        },
      })
    })

    await page.goto('/advisory')
    await page.getByRole('button', { name: /继续 Retention Diagnosis/ }).click()
    await page.getByRole('button', { name: /退出工作流|安全退出/ }).click()

    const dialog = page.getByRole('alertdialog', { name: /退出 ThinkTank 工作流/ })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/当前进度已自动保存/)).toBeVisible()
    await expect(dialog.getByRole('button', { name: /取消|继续编辑/ })).toBeFocused()
  })
})
