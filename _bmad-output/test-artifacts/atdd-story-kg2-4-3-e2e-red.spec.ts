import { expect, test } from '@playwright/test'
import {
  obligationDetailResponse,
  obligationListResponse,
  regulationClausesResponse,
} from './atdd-story-kg2-4-3-fixtures'

test.describe('Story KG2 4.3 ATDD RED - obligation admin page user journey', () => {
  test.skip(
    '[P1][4.3-E2E-001] should let an admin open /admin/obligations and see the left list, filters, and right-side obligation detail shell',
    async ({ page }) => {
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

      await page.route('**/api/admin/knowledge-graph/obligations**', async (route) => {
        if (route.request().method() !== 'GET') {
          await route.continue()
          return
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: obligationListResponse,
          }),
        })
      })

      await page.route(
        `**/api/admin/knowledge-graph/obligations/${obligationDetailResponse.obligationId}`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: obligationDetailResponse,
            }),
          })
        },
      )

      await page.goto('/admin/obligations')

      await expect(page.getByRole('heading', { name: 'Obligation 管理' })).toBeVisible()
      await expect(page.getByLabel('关键词')).toBeVisible()
      await expect(page.getByText(obligationDetailResponse.obligationCode)).toBeVisible()
      await expect(page.getByDisplayValue(obligationDetailResponse.obligationText)).toBeVisible()
      await expect(page.getByText('法规条文')).toBeVisible()
      await expect(page.getByText('控制点映射')).toBeVisible()
    },
  )

  test.skip(
    '[P1][4.3-E2E-002] should let an admin create or update an obligation, open the clause detail dialog, and manage control-point mappings from the same page',
    async ({ page }) => {
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

      await page.route('**/api/admin/knowledge-graph/obligations**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: obligationListResponse,
          }),
        })
      })

      await page.route('**/api/admin/knowledge-graph/regulation-clauses**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: regulationClausesResponse,
          }),
        })
      })

      await page.goto('/admin/obligations')

      await page.getByRole('button', { name: '新建 Obligation' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByLabel('关联条文')).toBeVisible()
      await expect(page.getByLabel('义务编码')).toBeVisible()
      await expect(page.getByRole('button', { name: '创建' })).toBeVisible()

      await page.getByRole('button', { name: /查看条文详情|打开条文详情/ }).click()
      await expect(page.getByRole('dialog')).toContainText(obligationDetailResponse.clause.clauseText)
      await expect(page.getByRole('dialog')).toContainText(obligationDetailResponse.clause.sectionPath)

      await page.getByPlaceholder('搜索 control code / control name').fill('复核')
      await page.getByRole('button', { name: '搜索控制点' }).click()
      await expect(page.getByText('添加为映射')).toBeVisible()
      await expect(page.getByRole('button', { name: /保存修改|保存/ })).toBeVisible()
    },
  )
})
