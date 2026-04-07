import { expect, test } from '@playwright/test'

test.describe('[Story 12.1] 案例运营后台', () => {
  test('管理员可以通过上传文件创建导入任务', async ({ page }) => {
    let importRequestSeen = false

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

    await page.route('**/api/admin/knowledge-graph/compliance-cases**', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: [],
            total: 0,
            page: 1,
            limit: 10,
          },
        }),
      })
    })

    await page.route('**/api/admin/knowledge-graph/cases/import', async (route) => {
      importRequestSeen = true
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            jobId: 'case-import-PBOC-batch-001',
            batchId: 'PBOC-batch-001',
            fileName: 'cases.xlsx',
            regulatorCode: 'PBOC',
            status: 'queued',
          },
        }),
      })
    })

    await page.goto('/admin/compliance-cases')

    await expect(page.getByLabel('上传文件')).toBeVisible()
    await page.getByLabel('上传文件').setInputFiles({
      name: 'cases.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('mock workbook'),
    })
    await expect(page.getByText('已选择：cases.xlsx')).toBeVisible()
    await page.locator('#import-regulator-code').fill('PBOC')
    await page.getByRole('button', { name: '创建导入任务' }).click()

    await expect(page.getByText(/导入任务已创建：文件 `cases\.xlsx`/)).toBeVisible()
    expect(importRequestSeen).toBe(true)
  })

  test('管理员可以查看案例详情并提交 clustered 人审', async ({ page }) => {
    let reviewed = false

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

    await page.route('**/api/admin/knowledge-graph/compliance-cases**', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: [
              {
                caseId: 'case-1',
                caseCode: 'PBOC-CASE-001',
                regulatorCode: 'PBOC',
                caseTitle: '处罚案例',
                sourceOrg: '人民银行',
                penalizedPerson: null,
                industry: 'banking',
                region: 'CN',
                caseDate: '2026-04-01T00:00:00.000Z',
                authorityName: '人民银行',
                penaltyType: null,
                caseFacts: '案例事实',
                penaltyReason: '处罚原因',
                rawSourceUrl: null,
                rawContentId: null,
                l1Code: null,
                l2Code: null,
                confidenceScore: null,
                importBatchId: 'PBOC-batch-001',
                status: reviewed ? 'reviewed' : 'clustered',
                humanReviewed: reviewed,
                reviewedBy: reviewed ? 'admin-1' : null,
                reviewedAt: reviewed ? '2026-04-02T09:00:00.000Z' : null,
                createdAt: '2026-04-01T00:00:00.000Z',
                updatedAt: '2026-04-01T00:00:00.000Z',
              },
            ],
            total: 1,
            page: 1,
            limit: 10,
          },
        }),
      })
    })

    await page.route('**/api/admin/knowledge-graph/compliance-cases/case-1/extraction', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            caseId: 'case-1',
            caseCode: 'PBOC-CASE-001',
            status: reviewed ? 'reviewed' : 'clustered',
            violationThemes: ['客户身份识别'],
            clauseCandidates: [
              {
                clauseId: 'clause-1',
                clauseCode: 'CLAUSE-001',
                summary: '条款摘要',
                matchedKeywords: ['KYC'],
                confidenceScore: 0.9,
              },
            ],
            extractedAt: '2026-04-01T00:10:00.000Z',
          },
        }),
      })
    })

    await page.route('**/api/admin/knowledge-graph/compliance-cases/case-1/clustering', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            caseId: 'case-1',
            caseCode: 'PBOC-CASE-001',
            status: reviewed ? 'reviewed' : 'clustered',
            normalizedThemes: ['客户身份识别'],
            candidateControlPoints: [
              {
                controlName: '交易监测',
                sourceTheme: '客户身份识别',
                confidenceScore: 0.8,
                reason: '主题相近',
              },
            ],
            clusteredAt: '2026-04-01T00:20:00.000Z',
            humanReviewed: reviewed,
            reviewedBy: reviewed ? 'admin-1' : null,
            reviewedAt: reviewed ? '2026-04-02T09:00:00.000Z' : null,
            caseControlMapDrafts: [
              {
                id: 'draft-1',
                controlId: 'control-1',
                controlCode: 'CTRL-001',
                controlName: '客户身份识别',
                relationType: 'VIOLATES',
                reviewStatus: reviewed ? 'APPROVED' : 'PENDING',
                confidenceScore: '0.9000',
                source: 'RULE',
              },
            ],
          },
        }),
      })
    })

    await page.route('**/api/admin/knowledge-graph/compliance-cases/case-1/human-review', async (route) => {
      reviewed = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            caseId: 'case-1',
            status: 'reviewed',
            humanReviewed: true,
            reviewedBy: 'admin-1',
            reviewedAt: '2026-04-02T09:00:00.000Z',
            approvedCount: 1,
            rejectedCount: 0,
            manualMappingCount: 0,
          },
        }),
      })
    })

    await page.goto('/admin/compliance-cases')

    await expect(page.getByRole('heading', { name: '案例运营' })).toBeVisible()
    await expect(page.getByText('PBOC-CASE-001')).toBeVisible()

    await page.getByRole('button', { name: '查看详情' }).click()
    await expect(page.getByText('CTRL-001 · 客户身份识别')).toBeVisible()
    await expect(page.getByText('交易监测')).toBeVisible()

    await page.getByRole('button', { name: '确认' }).click()
    await page.getByRole('button', { name: '提交人工审核' }).click()

    await expect(page.locator('text=审核人：admin-1').first()).toBeVisible()
    await expect(page.getByText('当前案例状态为 已审核，不可再次提交人工审核。')).toBeVisible()
  })
})
