import { expect, test, type Page } from '@playwright/test'
import {
  VALID_CASE_ID,
  VALID_CONTROL_ID,
  VALID_FAILURE_MODE_ID,
  VALID_OBLIGATION_ID,
  createAdminFullContextResponse,
  createAdminSession,
  createComplianceCaseClusteringResponse,
  createComplianceCaseExtractionResponse,
  createComplianceCaseListResponse,
  createFailureModeDetailResponse,
  createFailureModeListResponse,
  createKnowledgeGraphReasoningChain,
  createKnowledgeGraphTaxonomyTree,
  createObligationDetailResponse,
  createObligationListResponse,
} from '../fixtures/control-detail-cross-navigation-fixtures'

async function mockAdminSession(page: Page) {
  await page.route('**/api/auth/session**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createAdminSession()),
    })
  })
}

test.describe('Story 5.2 控制点详情增强与交叉导航 (ATDD RED)', () => {
  test.describe.configure({ timeout: 180000 })

  test(
    '[P0][5.2-E2E-001] should open the shared control detail drawer from /admin/knowledge-graph by clicking a control-point card and render the admin source badge plus 0-1 authoritativeScore as 83%',
    async ({ page }) => {
      await mockAdminSession(page)

      await page.route('**/api/admin/knowledge-graph/taxonomy/tree**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createKnowledgeGraphTaxonomyTree()),
        })
      })

      await page.route('**/api/admin/knowledge-graph/reasoning-chain/IT04-06', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createKnowledgeGraphReasoningChain()),
        })
      })

      await page.route(
        `**/api/admin/knowledge-graph/control-points/${VALID_CONTROL_ID}/full-context`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createAdminFullContextResponse()),
          })
        },
      )

      await page.goto('/admin/knowledge-graph', { waitUntil: 'domcontentloaded' })
      await page.getByRole('button', { name: /IT04.*数据治理与监管数据报送/ }).click()
      await page.getByRole('button', { name: '监管报送准确性控制' }).click()
      await page.getByRole('button', { name: /CTRL-REP-001.*监管报送复核控制/ }).click()

      await expect(page.getByTestId('control-detail-drawer')).toBeVisible()
      await expect(page.getByText('来自管理端')).toBeVisible()
      await expect(
        page.getByTestId('control-detail-governance-summary').getByText('83%'),
      ).toBeVisible()
      await expect(
        page.getByText('管理端详情不计算机构适用性，请在组织上下文中查看适用性说明'),
      ).toBeVisible()
    },
  )

  test(
    '[P0][5.2-E2E-002] should honor ?failureModeId deep linking on /admin/failure-modes, keep the selected failure mode, and open the shared drawer when the mapped control code is clicked',
    async ({ page }) => {
      await mockAdminSession(page)

      await page.route('**/api/admin/knowledge-graph/failure-modes?**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createFailureModeListResponse()),
        })
      })

      await page.route('**/api/admin/knowledge-graph/taxonomy/tree?status=ACTIVE', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createKnowledgeGraphTaxonomyTree()),
        })
      })

      await page.route(`**/api/admin/knowledge-graph/failure-modes/${VALID_FAILURE_MODE_ID}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createFailureModeDetailResponse()),
        })
      })

      await page.route(
        `**/api/admin/knowledge-graph/control-points/${VALID_CONTROL_ID}/full-context`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createAdminFullContextResponse()),
          })
        },
      )

      await page.goto(`/admin/failure-modes?failureModeId=${VALID_FAILURE_MODE_ID}`, {
        waitUntil: 'domcontentloaded',
      })

      await expect(page.getByRole('button', { name: /FM-REP-001.*报送口径定义错误/ })).toBeVisible()
      await expect(
        page.getByRole('button', { name: /CTRL-REP-001.*监管报送复核控制/ }),
      ).toBeVisible()
      await page
        .getByRole('button', { name: /^CTRL-REP-001 · 监管报送复核控制$/ })
        .click()

      await expect(page.getByTestId('control-detail-drawer')).toBeVisible()
      await expect(page.getByText('来自管理端')).toBeVisible()
      await expect(
        page.getByTestId('control-detail-failure-mode-cards').getByText('FM-REP-001'),
      ).toBeVisible()
    },
  )

  test(
    '[P0][5.2-E2E-003] should preserve ?obligationId deep linking on /admin/obligations and open the shared drawer from the mapped control point row without breaking the clause detail flow',
    async ({ page }) => {
      await mockAdminSession(page)

      await page.route('**/api/admin/knowledge-graph/obligations?**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createObligationListResponse()),
        })
      })

      await page.route(`**/api/admin/knowledge-graph/obligations/${VALID_OBLIGATION_ID}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createObligationDetailResponse()),
        })
      })

      await page.route(
        `**/api/admin/knowledge-graph/control-points/${VALID_CONTROL_ID}/full-context`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createAdminFullContextResponse()),
          })
        },
      )

      await page.goto(`/admin/obligations?obligationId=${VALID_OBLIGATION_ID}`, {
        waitUntil: 'domcontentloaded',
      })

      await expect(
        page.getByRole('button', { name: /OBL-IT04-4.1-01.*应当建立监管报送复核机制/ }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: /CTRL-REP-001.*监管报送复核控制/ }),
      ).toBeVisible()
      await page
        .getByRole('button', { name: /^CTRL-REP-001 · 监管报送复核控制$/ })
        .click()

      await expect(page.getByTestId('control-detail-drawer')).toBeVisible()
      await expect(page.getByText('来自管理端')).toBeVisible()
      await expect(
        page.getByTestId('control-detail-section-clauses').getByText('CLAUSE-IT04-REP-001'),
      ).toBeVisible()
    },
  )

  test(
    '[P0][5.2-E2E-004] should honor ?caseId deep linking on /admin/compliance-cases, preload the case detail dialog, and open the shared drawer from the control mapping row without leaving stale pointer-events after close',
    async ({ page }) => {
      await mockAdminSession(page)

      await page.route('**/api/admin/knowledge-graph/compliance-cases?**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createComplianceCaseListResponse()),
        })
      })

      await page.route(
        `**/api/admin/knowledge-graph/compliance-cases/${VALID_CASE_ID}/extraction`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createComplianceCaseExtractionResponse()),
          })
        },
      )

      await page.route(
        `**/api/admin/knowledge-graph/compliance-cases/${VALID_CASE_ID}/clustering`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createComplianceCaseClusteringResponse()),
          })
        },
      )

      await page.route(
        `**/api/admin/knowledge-graph/control-points/${VALID_CONTROL_ID}/full-context`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createAdminFullContextResponse()),
          })
        },
      )

      await page.goto(`/admin/compliance-cases?caseId=${VALID_CASE_ID}`, {
        waitUntil: 'domcontentloaded',
      })

      await expect(page.getByText('基础信息')).toBeVisible()
      await expect(page.getByRole('button', { name: '提交人工审核' })).toBeVisible()
      await page.getByRole('button', { name: /CTRL-REP-001.*监管报送复核控制/ }).click()

      await expect(page.getByTestId('control-detail-drawer')).toBeVisible()
      await expect(page.getByText('来自管理端')).toBeVisible()
      await expect(page.getByTestId('control-detail-source-trace')).toContainText(
        'FM-REP-001 · 报送口径定义错误',
      )

      await page.getByLabel('关闭控制点详情').click()
      await expect(page.getByTestId('control-detail-drawer')).not.toBeVisible()
      await expect(page.getByRole('button', { name: '提交人工审核' })).toBeVisible()
    },
  )

  test(
    '[P1][5.2-E2E-005] should continue cross-navigation from drawer related cards into the three admin pages',
    async ({ page }) => {
      await mockAdminSession(page)

      await page.route('**/api/admin/knowledge-graph/taxonomy/tree**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createKnowledgeGraphTaxonomyTree()),
        })
      })

      await page.route('**/api/admin/knowledge-graph/reasoning-chain/IT04-06', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createKnowledgeGraphReasoningChain()),
        })
      })

      await page.route('**/api/admin/knowledge-graph/failure-modes?**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createFailureModeListResponse()),
        })
      })

      await page.route(
        '**/api/admin/knowledge-graph/taxonomy/tree?status=ACTIVE',
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createKnowledgeGraphTaxonomyTree()),
          })
        },
      )

      await page.route(
        `**/api/admin/knowledge-graph/failure-modes/${VALID_FAILURE_MODE_ID}`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createFailureModeDetailResponse()),
          })
        },
      )

      await page.route('**/api/admin/knowledge-graph/obligations?**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createObligationListResponse()),
        })
      })

      await page.route(
        `**/api/admin/knowledge-graph/obligations/${VALID_OBLIGATION_ID}`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createObligationDetailResponse()),
          })
        },
      )

      await page.route('**/api/admin/knowledge-graph/compliance-cases?**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createComplianceCaseListResponse()),
        })
      })

      await page.route(
        `**/api/admin/knowledge-graph/compliance-cases/${VALID_CASE_ID}/extraction`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createComplianceCaseExtractionResponse()),
          })
        },
      )

      await page.route(
        `**/api/admin/knowledge-graph/compliance-cases/${VALID_CASE_ID}/clustering`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createComplianceCaseClusteringResponse()),
          })
        },
      )

      await page.route(
        `**/api/admin/knowledge-graph/control-points/${VALID_CONTROL_ID}/full-context`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createAdminFullContextResponse()),
          })
        },
      )

      const openDrawerFromKnowledgeGraph = async () => {
        await page.goto('/admin/knowledge-graph', { waitUntil: 'domcontentloaded' })
        await page.getByRole('button', { name: /IT04.*数据治理与监管数据报送/ }).click()
        await page.getByRole('button', { name: '监管报送准确性控制' }).click()
        await page.getByRole('button', { name: /CTRL-REP-001.*监管报送复核控制/ }).click()
        await expect(page.getByTestId('control-detail-drawer')).toBeVisible()
      }

      await openDrawerFromKnowledgeGraph()
      await page
        .getByTestId('control-detail-failure-mode-cards')
        .getByRole('button', { name: /FM-REP-001.*报送口径定义错误/ })
        .click()
      await expect(page).toHaveURL(
        new RegExp(`/admin/failure-modes\\?failureModeId=${VALID_FAILURE_MODE_ID}$`),
      )
      await expect(
        page.getByRole('button', { name: /FM-REP-001.*报送口径定义错误/ }),
      ).toBeVisible()

      await openDrawerFromKnowledgeGraph()
      await page
        .getByTestId('control-detail-obligation-cards')
        .getByRole('button', { name: /OBL-IT04-4.1-01.*应当建立监管报送复核机制/ })
        .click()
      await expect(page).toHaveURL(
        new RegExp(`/admin/obligations\\?obligationId=${VALID_OBLIGATION_ID}$`),
      )
      await expect(
        page.getByRole('button', { name: /OBL-IT04-4.1-01.*应当建立监管报送复核机制/ }),
      ).toBeVisible()

      await openDrawerFromKnowledgeGraph()
      await page
        .getByTestId('control-detail-section-cases')
        .getByRole('button', { name: /CASE-PBOC-2024-001.*某银行因报送不准被罚 50 万/ })
        .click()
      await expect(page).toHaveURL(
        new RegExp(`/admin/compliance-cases\\?caseId=${VALID_CASE_ID}$`),
      )
      await expect(page.getByText('基础信息')).toBeVisible()
    },
  )
})
