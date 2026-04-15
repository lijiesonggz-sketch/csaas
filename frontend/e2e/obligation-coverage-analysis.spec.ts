import { expect, test } from '@playwright/test'

test.describe('Obligation 覆盖率分析看板', () => {
  test.describe.configure({ timeout: 180000 })

  test('管理员可以加载看板、按行业 drill-down 过滤并跳转到义务详情', async ({ page }) => {
    page.setDefaultNavigationTimeout(120000)
    let coverageAnalysisHitCount = 0

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
      if (url.includes('/obligations/coverage-analysis')) {
        await route.fallback()
        return
      }
      if (route.request().method() === 'GET' && url.includes('/obligations/obl-1')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              obligationId: 'obl-1',
              obligationCode: 'OBL-IT04-4.1-02',
              obligationText: '应当建立监管报送复核留痕的缺陷升级闭环',
              obligationType: 'MANDATORY',
              applicableSector: ['银行', '通用'],
              status: 'ACTIVE',
              clause: {
                clauseId: 'clause-1',
                clauseCode: 'CLAUSE-IT04-REP-002',
                articleNo: '4.1',
                sectionPath: '第四条/第一款',
                clauseText: '金融机构应当建立监管报送复核留痕与缺陷升级闭环，确保报送过程可追溯。',
                clauseSummary: '要求建立监管报送复核与缺陷升级闭环',
                source: {
                  sourceId: 'source-1',
                  sourceCode: 'SRC-IT04-REPORTING-001',
                  sourceName: '监管数据报送管理指引',
                  sourceLevel: 'guideline',
                  authorityName: '监管机构',
                },
              },
              controlMaps: [],
            },
          }),
        })
        return
      }

      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              items: [
                {
                  obligationId: 'obl-list-1',
                  obligationCode: 'OBL-LIST-001',
                  obligationText: '列表默认第一项',
                  obligationType: 'MANDATORY',
                  applicableSector: ['银行'],
                  status: 'ACTIVE',
                  createdAt: '2026-04-15T00:00:00.000Z',
                  updatedAt: '2026-04-15T00:00:00.000Z',
                },
              ],
              total: 1,
              page: 1,
              limit: 20,
            },
          }),
        })
      }
    })

    await page.route('**/api/admin/knowledge-graph/obligations/coverage-analysis', async (route) => {
      coverageAnalysisHitCount += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            totals: {
              obligations: 5,
              covered: 3,
              uncovered: 2,
              coverageRate: 0.6,
            },
            originDistribution: {
              case_derived: 1,
              regulation_derived: 2,
              both: 1,
              candidate: 1,
              manual: 1,
            },
            sectorCoverage: [
              { sector: '银行', obligations: 3, covered: 2, coverageRate: 0.6667 },
              { sector: '证券', obligations: 2, covered: 1, coverageRate: 0.5 },
              { sector: '保险', obligations: 1, covered: 1, coverageRate: 1 },
              { sector: '基金', obligations: 1, covered: 0, coverageRate: 0 },
              { sector: '期货', obligations: 1, covered: 1, coverageRate: 1 },
            ],
            blindSpots: [
              {
                obligationId: 'obl-1',
                obligationCode: 'OBL-IT04-4.1-02',
                obligationText: '应当建立监管报送复核留痕的缺陷升级闭环',
                obligationType: 'MANDATORY',
                applicableSector: ['银行', '通用'],
                clause: {
                  clauseId: 'clause-1',
                  clauseCode: 'CLAUSE-IT04-REP-002',
                  articleNo: '4.1',
                  clauseSummary: '要求建立监管报送复核与缺陷升级闭环',
                },
                source: {
                  sourceId: 'source-1',
                  sourceCode: 'SRC-IT04-REPORTING-001',
                  sourceName: '监管数据报送管理指引',
                },
              },
              {
                obligationId: 'obl-2',
                obligationCode: 'OBL-IT04-6.3-01',
                obligationText: '不得绕过监管报送数据质量校验',
                obligationType: 'PROHIBITIVE',
                applicableSector: ['证券'],
                clause: {
                  clauseId: 'clause-2',
                  clauseCode: 'CLAUSE-IT04-REP-019',
                  articleNo: '6.3',
                  clauseSummary: '禁止绕过数据质量校验',
                },
                source: {
                  sourceId: 'source-2',
                  sourceCode: 'SRC-IT04-REPORTING-002',
                  sourceName: '数据质量监管补充规定',
                },
              },
            ],
          },
        }),
      })
    })

    await page.goto('/admin/obligations/coverage-analysis', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: '覆盖率分析' })).toBeVisible({
      timeout: 30000,
    })
    await expect(page.getByText('OBL-IT04-4.1-02')).toBeVisible()
    await expect(page.getByText('OBL-IT04-6.3-01')).toBeVisible()

    await page.getByRole('button', { name: '银行' }).click()
    await expect(page.getByText('OBL-IT04-4.1-02')).toBeVisible()
    await expect(page.getByText('OBL-IT04-6.3-01')).not.toBeVisible()

    await page.getByRole('button', { name: '刷新' }).click()
    await expect.poll(() => coverageAnalysisHitCount).toBeGreaterThan(1)

    await page.getByText('OBL-IT04-4.1-02').click()
    await expect(page).toHaveURL(/\/admin\/obligations\?obligationId=obl-1/)
    await expect(page.locator('textarea').first()).toHaveValue(
      '应当建立监管报送复核留痕的缺陷升级闭环',
    )
  })

  test('非 admin 用户看到无权访问提示', async ({ page }) => {
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'consultant-1', name: 'Consultant', email: 'consultant@example.com', role: 'consultant' },
          accessToken: 'consultant-token',
          expires: '2099-01-01T00:00:00.000Z',
        }),
      })
    })

    await page.goto('/admin/obligations/coverage-analysis', { waitUntil: 'domcontentloaded' })

    await expect(page.getByText('无权访问覆盖率分析')).toBeVisible({ timeout: 15000 })
  })

  test('API 错误后可通过刷新恢复', async ({ page }) => {
    let hitCount = 0

    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: 'admin' },
          accessToken: 'admin-token',
          expires: '2099-01-01T00:00:00.000Z',
        }),
      })
    })

    await page.route('**/api/admin/knowledge-graph/obligations/coverage-analysis', async (route) => {
      hitCount += 1
      if (hitCount === 1) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Internal error' }) })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              totals: { obligations: 1, covered: 1, uncovered: 0, coverageRate: 1 },
              originDistribution: { case_derived: 1, regulation_derived: 0, both: 0, candidate: 0, manual: 0 },
              sectorCoverage: [{ sector: '银行', obligations: 1, covered: 1, coverageRate: 1 }],
              blindSpots: [],
            },
          }),
        })
      }
    })

    await page.goto('/admin/obligations/coverage-analysis', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Internal error')).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: '刷新' }).click()
    await expect(page.getByText('Internal error')).not.toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: '覆盖率分析' })).toBeVisible()
  })
})
