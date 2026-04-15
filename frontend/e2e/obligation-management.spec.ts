import { expect, test } from '@playwright/test'

test.describe('Obligation 管理页面', () => {
  test.describe.configure({ timeout: 180000 })

  test('管理员可以查看条文详情并管理控制点映射', async ({ page }) => {
    page.setDefaultNavigationTimeout(120000)
    let createMapSeen = false
    let deleteMapSeen = false

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
      const url = route.request().url()
      const method = route.request().method()

      if (method === 'GET' && url.includes('/obligations/obl-1')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              obligationId: 'obl-1',
              obligationCode: 'OBL-IT04-4.1-01',
              obligationText: '应当建立监管报送复核机制',
              obligationType: 'MANDATORY',
              applicableSector: ['银行', '通用'],
              status: 'ACTIVE',
              clause: {
                clauseId: 'clause-1',
                clauseCode: 'CLAUSE-IT04-REP-001',
                articleNo: '4.1',
                sectionPath: '第四条/第一款',
                clauseText: '金融机构应当建立监管报送复核机制，并保留复核痕迹。',
                clauseSummary: '应建立监管报送复核机制并保留痕迹',
                source: {
                  sourceId: 'source-1',
                  sourceCode: 'SRC-IT04-REPORTING-001',
                  sourceName: '监管数据报送管理指引',
                  sourceLevel: 'guideline',
                  authorityName: '监管机构',
                },
              },
              controlMaps: [
                {
                  id: 'map-1',
                  controlId: 'cp-1',
                  controlCode: 'CTRL-REP-001',
                  controlName: '监管报送复核控制',
                  coverage: 'FULL',
                  originType: 'regulation_derived',
                  maturityLevel: 'hard',
                  authoritativeScore: 0.92,
                },
              ],
            },
          }),
        })
        return
      }

      if (method === 'POST' && url.includes('/control-maps')) {
        createMapSeen = true
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: 'map-2', controlId: 'cp-2', coverage: 'FULL' },
          }),
        })
        return
      }

      if (method === 'DELETE' && url.includes('/control-maps/')) {
        deleteMapSeen = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { success: true, id: 'map-1' },
          }),
        })
        return
      }

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              items: [
                {
                  obligationId: 'obl-1',
                  obligationCode: 'OBL-IT04-4.1-01',
                  obligationText: '应当建立监管报送复核机制',
                  obligationType: 'MANDATORY',
                  applicableSector: ['银行', '通用'],
                  status: 'ACTIVE',
                  createdAt: '2026-04-14T00:00:00.000Z',
                  updatedAt: '2026-04-14T00:00:00.000Z',
                },
              ],
              total: 1,
              page: 1,
              limit: 20,
            },
          }),
        })
        return
      }

      await route.continue()
    })

    await page.route('**/api/admin/knowledge-graph/control-points**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: [
              {
                controlId: 'cp-2',
                controlCode: 'CTRL-REP-002',
                controlName: '监管报送差错纠偏控制',
                controlDesc: null,
                l1Code: 'IT04',
                l2Code: 'IT04-06',
                controlFamily: '治理',
                controlType: 'preventive',
                mandatoryDefault: true,
                riskLevelDefault: 'HIGH',
                ownerRoleHint: [],
                status: 'ACTIVE',
                createdAt: '',
                updatedAt: '',
              },
            ],
            total: 1,
            page: 1,
            limit: 10,
          },
        }),
      })
    })

    await page.goto('/admin/obligations', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: 'Obligation 管理' })).toBeVisible({
      timeout: 30000,
    })
    await expect(page.locator('textarea').first()).toHaveValue('应当建立监管报送复核机制')

    await page.getByRole('button', { name: '查看条文详情' }).click()
    await expect(page.getByText('金融机构应当建立监管报送复核机制，并保留复核痕迹。')).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByPlaceholder('搜索 control code / control name').fill('复核')
    await page.getByRole('button', { name: '搜索控制点' }).click()
    await expect(page.getByText('CTRL-REP-002 · 监管报送差错纠偏控制')).toBeVisible()
    await page.getByRole('button', { name: '添加为映射' }).click()
    expect(createMapSeen).toBe(true)

    await page.locator('button[aria-label="删除控制点映射 CTRL-REP-001"]').click()
    await page.getByRole('button', { name: '确认删除' }).click()
    expect(deleteMapSeen).toBe(true)
  })

  test('管理员可以搜索条文并新建义务', async ({ page }) => {
    page.setDefaultNavigationTimeout(120000)
    let clauseSearchSeen = false

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
      const method = route.request().method()
      const url = route.request().url()

      if (method === 'POST' && url.includes('/api/admin/knowledge-graph/obligations')) {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              obligationId: 'obl-new',
              obligationCode: 'OBL-IT04-4.1-02',
              obligationText: '新义务',
              obligationType: 'MANDATORY',
              applicableSector: ['银行'],
              status: 'ACTIVE',
            },
          }),
        })
        return
      }

      if (method === 'GET' && url.includes('/obligations/obl-new')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              obligationId: 'obl-new',
              obligationCode: 'OBL-IT04-4.1-02',
              obligationText: '新义务',
              obligationType: 'MANDATORY',
              applicableSector: ['银行'],
              status: 'ACTIVE',
              clause: {
                clauseId: 'clause-1',
                clauseCode: 'CLAUSE-IT04-REP-001',
                articleNo: '4.1',
                sectionPath: '第四条/第一款',
                clauseText: '金融机构应当建立监管报送复核机制，并保留复核痕迹。',
                clauseSummary: '应建立监管报送复核机制并保留痕迹',
                source: null,
              },
              controlMaps: [],
            },
          }),
        })
        return
      }

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              items: [],
              total: 0,
              page: 1,
              limit: 20,
            },
          }),
        })
        return
      }

      await route.continue()
    })

    await page.route('**/api/admin/knowledge-graph/regulation-clauses**', async (route) => {
      clauseSearchSeen = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: [
              {
                clauseId: 'clause-1',
                sourceId: 'source-1',
                clauseCode: 'CLAUSE-IT04-REP-001',
                articleNo: '4.1',
                sectionPath: '第四条/第一款',
                clauseText: '金融机构应当建立监管报送复核机制，并保留复核痕迹。',
                clauseSummary: '应建立监管报送复核机制并保留痕迹',
                mandatoryLevel: 'MUST',
              },
            ],
            total: 1,
            page: 1,
            limit: 10,
          },
        }),
      })
    })

    await page.goto('/admin/obligations', { waitUntil: 'domcontentloaded' })

    await page.getByRole('button', { name: '新建 Obligation' }).click()
    await page.getByLabel('条文关键词').fill('复核')
    await page.getByRole('button', { name: '搜索条文' }).click()
    expect(clauseSearchSeen).toBe(true)
    await page.getByRole('button', { name: '选择此条文' }).click()
    await expect(page.getByText('建议编码：OBL-IT04-4.1-01')).toBeVisible()
    await page.getByLabel('义务内容').fill('新义务')
    await page.locator('[role="dialog"]').evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    const createRequest = page.waitForRequest(
      (request) =>
        request.url().includes('/api/admin/knowledge-graph/obligations') &&
        request.method() === 'POST',
    )
    await page
      .getByRole('button', { name: '创建' })
      .evaluate((element: HTMLButtonElement) => element.click())
    const request = await createRequest
    expect(request.postDataJSON()).toMatchObject({
      clauseId: 'clause-1',
      obligationCode: 'OBL-IT04-4.1-01',
      obligationText: '新义务',
    })
  })
})
