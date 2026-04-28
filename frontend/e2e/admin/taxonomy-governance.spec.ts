import { expect, test } from '@playwright/test'
import {
  buildRuntimeProfileUploadFile,
  governanceSummaryFixtureV1,
  governanceSummaryFixtureV2,
  runtimeProfileImportSuccessFixture,
  runtimeProfileReplacementWarningText,
} from '../fixtures/taxonomy-governance-fixtures'

async function mockAdminSession(page: Parameters<typeof test>[0]['page']) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'admin-1',
          name: 'Admin User',
          email: 'admin@example.com',
          role: 'admin',
        },
        accessToken: 'admin-token',
        expires: '2099-01-01T00:00:00.000Z',
      }),
    })
  })
}

async function mockConsultantSession(page: Parameters<typeof test>[0]['page']) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'consultant-1',
          name: 'Consultant User',
          email: 'consultant@example.com',
          role: 'consultant',
        },
        accessToken: 'consultant-token',
        expires: '2099-01-01T00:00:00.000Z',
      }),
    })
  })
}

async function mockKnowledgeGraphBaseline(page: Parameters<typeof test>[0]['page']) {
  await page.route('**/api/admin/knowledge-graph/taxonomy/tree', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          l1Code: 'IT01',
          l1Name: '战略与治理',
          children: [{ l2Code: 'IT01-01', l2Name: 'IT战略规划', failureModeCount: 2 }],
        },
      ]),
    })
  })

  await page.route('**/api/admin/knowledge-graph/regulation-sources**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [],
        total: 0,
        page: 1,
        limit: 100,
      }),
    })
  })
}

test.describe('Story 7.4 taxonomy governance admin flows (ATDD RED)', () => {
  test('[P1] 管理员切换到 taxonomy 治理视图后看到治理概览、Rulebook 只读摘要和变更路径说明', async ({
    page,
  }) => {
    await mockAdminSession(page)
    await mockKnowledgeGraphBaseline(page)

    await page.route('**/api/admin/knowledge-graph/taxonomy-governance/summary', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(governanceSummaryFixtureV1),
      })
    })

    await page.goto('/admin/knowledge-graph', { waitUntil: 'domcontentloaded' })

    await page.getByRole('tab', { name: 'taxonomy 治理' }).click()

    await expect(page.getByRole('heading', { name: '治理概览' })).toBeVisible()
    await expect(page.getByText('当前 Runtime Profile 版本')).toBeVisible()
    await expect(page.getByText('2026-04-28-governance-v1').first()).toBeVisible()
    await expect(page.getByText('Rulebook 覆盖摘要')).toBeVisible()
    await expect(page.getByText('Catalog 变更路径')).toBeVisible()
    await expect(page.getByText('Runtime Profile 变更路径')).toBeVisible()
    await expect(page.getByText('Rulebook 变更路径')).toBeVisible()
  })

  test('[P1] 管理员导入新的 runtime profile snapshot 后看到成功提示和 sourceVersion 刷新', async ({
    page,
  }) => {
    await mockAdminSession(page)
    await mockKnowledgeGraphBaseline(page)

    let currentSummary = governanceSummaryFixtureV1

    await page.route('**/api/admin/knowledge-graph/taxonomy-governance/summary', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(currentSummary),
      })
    })

    await page.route(
      '**/api/admin/knowledge-graph/taxonomy-governance/runtime-profile/import',
      async (route) => {
        currentSummary = governanceSummaryFixtureV2
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(runtimeProfileImportSuccessFixture),
        })
      }
    )

    await page.goto('/admin/knowledge-graph', { waitUntil: 'domcontentloaded' })

    await page.getByRole('tab', { name: 'taxonomy 治理' }).click()
    await expect(page.getByText('2026-04-28-governance-v1').first()).toBeVisible()
    await expect(page.getByText(runtimeProfileReplacementWarningText)).toBeVisible()

    await page.getByRole('button', { name: '导入 Runtime Profile' }).click()
    await page.getByLabel('sourceVersion').fill('2026-04-29-governance-v2')
    await page.getByLabel('上传 Runtime Profile CSV').setInputFiles(buildRuntimeProfileUploadFile())
    await page.getByRole('button', { name: '确认导入 Runtime Profile' }).click()

    await expect(page.getByText('导入成功')).toBeVisible()
    await expect(page.getByText('2026-04-29-governance-v2').first()).toBeVisible()
  })

  test('[P1] 非管理员访问知识图谱总览时应被拒绝', async ({ page }) => {
    await mockConsultantSession(page)
    await mockKnowledgeGraphBaseline(page)

    await page.goto('/admin/knowledge-graph', { waitUntil: 'domcontentloaded' })

    await expect(page.getByText('无权访问知识图谱总览')).toBeVisible()
    await expect(page.getByText('当前账号没有查看该页面的权限，请联系管理员。')).toBeVisible()
  })
})
