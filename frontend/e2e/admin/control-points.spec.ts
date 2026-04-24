import { test, expect } from '@playwright/test'

test.describe('Control Point 管理工作台', () => {
  test.describe.configure({ timeout: 180000 })

  test.beforeEach(async ({ page }) => {
    const controlPoints = [
      {
        controlId: 'cp-1',
        controlCode: 'CTRL-IT04-001',
        controlName: '监管报送复核控制',
        controlDesc: '确保监管报送在提交前完成复核',
        aliases: ['报送复核'],
        keywords: ['监管报送', '复核'],
        canonicalTheme: '监管报送复核',
        l1Code: 'IT04',
        l2Code: 'IT04-01',
        controlFamily: '治理',
        controlType: 'preventive',
        mandatoryDefault: true,
        riskLevelDefault: 'HIGH',
        ownerRoleHint: ['数据治理岗'],
        status: 'ACTIVE',
        createdAt: '2026-04-20T00:00:00.000Z',
        updatedAt: '2026-04-21T00:00:00.000Z',
        originType: 'both',
        maturityLevel: 'hard',
        authoritativeScore: 0.91,
        applicableSector: ['银行', '通用'],
      },
    ]
    const packCatalog = [
      {
        packId: 'pack-1',
        packCode: 'PACK-BASE-CYBER',
        packName: '网络安全基线包',
        packType: 'base',
        packVersion: 'stable',
        status: 'ACTIVE',
      },
      {
        packId: 'pack-2',
        packCode: 'PACK-SECTOR-BANK',
        packName: '银行业增强包',
        packType: 'sector',
        packVersion: 'preview',
        status: 'ACTIVE',
      },
    ]
    const packLinks = [
      {
        id: 'pack-link-1',
        packId: 'pack-1',
        packCode: 'PACK-BASE-CYBER',
        packName: '网络安全基线包',
        packType: 'base',
        packVersion: 'stable',
        itemRole: 'INCLUDE',
        priority: 10,
      },
    ]

    await page.route('**/api/auth/session**', async (route) => {
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

    await page.route(/\/api\/admin\/knowledge-graph\/control-points(?:\?.*)?$/, async (route) => {
      const request = route.request()
      const url = new URL(request.url())

      if (request.method() === 'GET') {
        const keyword = url.searchParams.get('keyword')
        const filtered = keyword
          ? controlPoints.filter(
              (item) =>
                item.controlCode.includes(keyword) ||
                item.controlName.includes(keyword) ||
                item.controlDesc.includes(keyword),
            )
          : controlPoints

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: filtered,
            total: filtered.length,
            page: 1,
            limit: 100,
          }),
        })
        return
      }

      if (request.method() !== 'POST') {
        return route.fallback()
      }

      const payload = request.postDataJSON() as Record<string, unknown>
      const created = {
        controlId: 'cp-2',
        status: 'ACTIVE',
        createdAt: '2026-04-22T00:00:00.000Z',
        updatedAt: '2026-04-22T00:00:00.000Z',
        originType: 'candidate',
        maturityLevel: 'candidate',
        authoritativeScore: null,
        applicableSector: ['通用'],
        ...payload,
      }
      controlPoints.push(created as (typeof controlPoints)[number])

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      })
    })

    await page.route('**/api/admin/knowledge-graph/control-points/*/status', async (route) => {
      const controlId = route.request().url().split('/').slice(-2)[0]
      const payload = route.request().postDataJSON() as { status: string }
      const target = controlPoints.find((item) => item.controlId === controlId)
      if (target) target.status = payload.status

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(target ?? { controlId, status: payload.status }),
      })
    })

    await page.route('**/api/admin/knowledge-graph/control-points/*', async (route) => {
      const url = route.request().url()
      if (url.endsWith('/status') || url.endsWith('/full-context') || url.endsWith('/evidences') || url.endsWith('/questions') || url.endsWith('/remediations') || url.endsWith('/pack-links') || url.endsWith('/regulatory-links')) {
        return route.fallback()
      }

      const controlId = url.split('/').pop()!
      const target = controlPoints.find((item) => item.controlId === controlId) ?? controlPoints[0]
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(target),
      })
    })

    await page.route('**/api/admin/knowledge-graph/control-points/*/full-context', async (route) => {
      const controlId = route.request().url().split('/').slice(-2)[0]
      const target = controlPoints.find((item) => item.controlId === controlId) ?? controlPoints[0]
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          control: {
            controlId: target.controlId,
            controlCode: target.controlCode,
            controlName: target.controlName,
            controlDesc: target.controlDesc,
            l1: { code: target.l1Code, name: '数据治理与监管报送' },
            l2: { code: target.l2Code, name: '监管报送控制' },
          },
          governance: {
            originType: target.originType,
            maturityLevel: target.maturityLevel,
            authoritativeScore: target.authoritativeScore,
            applicableSector: target.applicableSector,
          },
          applicabilityReason: '适用于监管报送高风险场景',
          failureModes: [
            {
              failureModeId: 'fm-1',
              failureModeCode: 'FM-REP-001',
              name: '报送口径定义错误',
              category: 'DEFINITION_ERROR',
              relevance: 'PRIMARY',
            },
          ],
          obligations: [
            {
              obligationId: 'obl-1',
              obligationCode: 'OBL-001',
              obligationText: '应当建立监管报送复核机制',
              obligationType: 'MANDATORY',
              coverage: 'FULL',
            },
          ],
          reasoningChain: null,
          clauses: [],
          cases: [
            {
              caseId: 'case-1',
              caseCode: 'CASE-001',
              caseTitle: '因报送不准被处罚',
              relationType: 'VIOLATES',
              confidenceScore: '0.92',
            },
          ],
          evidences: [],
          questions: [],
          remediations: [],
        }),
      })
    })

    await page.route('**/api/admin/knowledge-graph/control-points/*/evidences', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          controlId: 'cp-1',
          evidences: [
            {
              id: 'map-1',
              evidenceId: 'evd-1',
              evidenceCode: 'EVD-001',
              evidenceName: '审批记录',
              frequency: 'MONTHLY',
              ownerRole: '数据治理岗',
              samplingRequirement: 'FULL',
            },
          ],
        }),
      })
    })

    await page.route('**/api/admin/knowledge-graph/control-points/*/questions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ controlId: 'cp-1', questions: [] }),
      })
    })

    await page.route('**/api/admin/knowledge-graph/control-points/*/remediations', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ controlId: 'cp-1', remediations: [] }),
      })
    })

    await page.route('**/api/admin/knowledge-graph/control-points/*/pack-links', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ controlId: 'cp-1', items: packLinks }),
      })
    })

    await page.route('**/api/admin/knowledge-graph/control-packs', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(packCatalog.filter((item) => item.status === 'ACTIVE')),
      })
    })

    await page.route('**/api/admin/knowledge-graph/control-pack-items', async (route) => {
      const request = route.request()

      if (request.method() === 'POST') {
        const payload = request.postDataJSON() as { packId: string; controlId: string }
        const pack = packCatalog.find((item) => item.packId === payload.packId)
        const created = {
          id: `pack-link-${packLinks.length + 1}`,
          packId: payload.packId,
          packCode: pack?.packCode ?? 'UNKNOWN',
          packName: pack?.packName ?? '未知包',
          packType: pack?.packType ?? 'base',
          packVersion: pack?.packVersion ?? 'preview',
          itemRole: 'INCLUDE',
          priority: 100,
        }
        packLinks.push(created)
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(created),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: packLinks, total: packLinks.length, page: 1, limit: 100 }),
      })
    })

    await page.route('**/api/admin/knowledge-graph/control-pack-items/*', async (route) => {
      if (route.request().method() !== 'DELETE') {
        return route.fallback()
      }

      const id = route.request().url().split('/').pop()!
      const index = packLinks.findIndex((item) => item.id === id)
      if (index >= 0) {
        packLinks.splice(index, 1)
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, id }),
      })
    })

    await page.route('**/api/admin/knowledge-graph/control-points/*/regulatory-links', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ controlId: 'cp-1', clauses: [], obligations: [], cases: [] }),
      })
    })

    await page.route('**/api/admin/knowledge-graph/taxonomy/tree**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            l1Code: 'IT04',
            l1Name: '数据治理与监管报送',
            children: [{ l2Code: 'IT04-01', l2Name: '监管报送控制', failureModeCount: 2 }],
          },
        ]),
      })
    })

    await page.route('**/api/admin/knowledge-graph/failure-modes**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              failureModeId: 'fm-1',
              failureModeCode: 'FM-REP-001',
              name: '报送口径定义错误',
              category: 'DEFINITION_ERROR',
              status: 'ACTIVE',
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
        }),
      })
    })

    await page.route('**/api/admin/knowledge-graph/failure-modes/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          failureModeId: 'fm-1',
          failureModeCode: 'FM-REP-001',
          name: '报送口径定义错误',
          description: '定义口径不一致',
          category: 'DEFINITION_ERROR',
          status: 'ACTIVE',
          taxonomyMaps: [],
          controlMaps: [
            {
              id: 'cmap-1',
              controlId: 'cp-1',
              controlCode: 'CTRL-IT04-001',
              controlName: '监管报送复核控制',
              relevance: 'PRIMARY',
              maturityLevel: 'hard',
              authoritativeScore: 0.91,
            },
          ],
        }),
      })
    })
  })

  test('[P0] 管理员可以打开管理页、创建控制点并查看证据 tab', async ({ page }) => {
    await page.goto('/admin/control-points', { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('control-points-list-panel')).toBeVisible()
    await expect(page.getByTestId('control-points-detail-panel')).toBeVisible()
    await expect(
      page.getByTestId('control-points-detail-panel').getByText('监管报送复核控制'),
    ).toBeVisible()

    await page.getByRole('button', { name: '新建 Control Point' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('编码').fill('CTRL-IT04-999')
    await dialog.getByLabel('名称').fill('新增控制点')
    await dialog.getByLabel('控制族').fill('治理')
    await dialog.locator('select').nth(1).selectOption('IT04')
    await dialog.locator('select').nth(2).selectOption('IT04-01')
    await dialog.getByRole('checkbox', { name: '默认必选' }).click()
    await dialog.getByRole('button', { name: '创建控制点' }).click()

    await expect(
      page.getByTestId('control-points-detail-panel').getByText('新增控制点'),
    ).toBeVisible()

    await page.getByRole('tab', { name: '证据类型' }).click()
    await expect(page.getByText('EVD-001')).toBeVisible()
  })

  test('[P1] 从 Failure Mode 管理页打开 Drawer 后可以跳到 Control Point 管理，并看到目录选择器', async ({ page }) => {
    await page.goto('/admin/failure-modes', { waitUntil: 'domcontentloaded' })

    await page.getByRole('button', { name: 'CTRL-IT04-001 · 监管报送复核控制' }).click()
    await expect(page.getByTestId('control-detail-drawer')).toBeVisible()
    await page.getByTestId('view-in-management').click()

    await expect(page).toHaveURL(/\/admin\/control-points\?controlId=cp-1/)
    await expect(page.getByTestId('control-points-detail-panel')).toContainText('CTRL-IT04-001')

    await page.goto('/admin/failure-modes', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('control-point-directory-selector')).toBeVisible()
  })

  test('[P1] 管理员可以在 Pack Links tab 添加控制包并删除非最后一个关联', async ({ page }) => {
    await page.goto('/admin/control-points', { waitUntil: 'domcontentloaded' })

    await page.getByRole('tab', { name: '控制包关联' }).click()
    await expect(page.getByText('PACK-BASE-CYBER')).toBeVisible()
    await expect(page.getByText('PACK-SECTOR-BANK')).toBeVisible()

    await page
      .locator('div')
      .filter({ hasText: 'PACK-SECTOR-BANK' })
      .getByRole('button', { name: '添加关联' })
      .click()

    await expect(page.getByText('PACK-SECTOR-BANK')).toBeVisible()

    await page
      .locator('div')
      .filter({ hasText: 'PACK-BASE-CYBER' })
      .getByRole('button')
      .last()
      .click()

    await expect(
      page
        .locator('div')
        .filter({ hasText: 'PACK-BASE-CYBER' })
        .getByRole('button', { name: '添加关联' }),
    ).toBeVisible()
  })
})
