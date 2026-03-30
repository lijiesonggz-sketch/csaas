import { expect, test, type Page } from '@playwright/test'

const SESSION_RESPONSE = {
  user: {
    id: 'qa-user-1',
    name: 'QA User',
    email: 'qa@example.com',
    role: 'consultant',
  },
  accessToken: 'qa-token',
  expires: '2099-01-01T00:00:00.000Z',
} as const

const PROJECT_RESPONSE = {
  success: true,
  data: {
    id: 'test-project-id',
    name: 'QA 审核项目',
    clientName: '测试客户',
    standardName: 'ISO27001',
    status: 'ACTIVE',
    progress: 42,
    createdAt: '2026-03-30T09:00:00.000Z',
    updatedAt: '2026-03-30T10:00:00.000Z',
  },
} as const

const REVIEW_ITEMS = [
  {
    reviewItemId: 'review-citation',
    sourceResultId: 'review-citation',
    taskId: 'task-citation',
    taskType: 'summary',
    reviewStage: 'summary',
    title: '真实条文溯源审核项',
    reviewStatus: 'pending',
    confidenceLevel: 'high',
    consistencyScores: {
      structural: 0.92,
      semantic: 0.9,
      detail: 0.88,
    },
    highRiskFlag: false,
    canRerun: true,
    sourceModule: 'audit',
    sourceRecordId: 'review-citation',
    sourceRoute: '/projects/test-project-id/review',
    riskLevel: 'low',
    degradationReasons: [],
    matchedControls: [
      {
        controlId: 'CTRL-001',
        controlName: '测试控制点',
        packSource: 'governance',
        priority: 'HIGH',
      },
    ],
    controlId: 'CTRL-001',
    provenanceStatus: 'citation_chain',
    citationChain: {
      sourceId: 'source-1',
      sourceName: '监管报送办法',
      clauseId: 'clause-1',
      clauseCode: 'CLAUSE-001',
      articleNo: '第十条',
      rawText: '这里是真实条文原文',
    },
    sourcePreview: {
      aiExcerpt: '真实条文溯源的 AI 摘要',
      sourceExcerpt: '这段 preview 不应被 citation_chain 视图消费',
      sourceDocumentName: 'preview-only.docx',
      extractionQuality: 'partial',
    },
    createdAt: '2026-03-30T10:00:00.000Z',
    updatedAt: '2026-03-30T10:10:00.000Z',
  },
  {
    reviewItemId: 'review-preview',
    sourceResultId: 'review-preview',
    taskId: 'task-preview',
    taskType: 'clustering',
    reviewStage: 'clustering',
    title: '降级来源预览审核项',
    reviewStatus: 'pending',
    confidenceLevel: 'medium',
    consistencyScores: {
      structural: 0.84,
      semantic: 0.8,
      detail: null,
    },
    highRiskFlag: false,
    canRerun: true,
    sourceModule: 'audit',
    sourceRecordId: 'review-preview',
    sourceRoute: '/projects/test-project-id/review',
    riskLevel: 'medium',
    degradationReasons: ['当前结果置信度为 MEDIUM'],
    matchedControls: [],
    controlId: null,
    provenanceStatus: 'degraded_preview',
    citationChain: null,
    sourcePreview: {
      aiExcerpt: '降级来源预览的 AI 摘要',
      sourceExcerpt: '这是降级来源预览片段',
      sourceDocumentName: 'preview-source.pdf',
      extractionQuality: 'partial',
    },
    createdAt: '2026-03-30T10:20:00.000Z',
    updatedAt: '2026-03-30T10:30:00.000Z',
  },
  {
    reviewItemId: 'review-missing',
    sourceResultId: 'review-missing',
    taskId: 'task-missing',
    taskType: 'matrix',
    reviewStage: 'matrix',
    title: '来源缺失审核项',
    reviewStatus: 'pending',
    confidenceLevel: 'medium',
    consistencyScores: {
      structural: 0.75,
      semantic: 0.72,
      detail: null,
    },
    highRiskFlag: false,
    canRerun: true,
    sourceModule: 'audit',
    sourceRecordId: 'review-missing',
    sourceRoute: '/projects/test-project-id/review',
    riskLevel: 'medium',
    degradationReasons: [],
    matchedControls: [],
    controlId: null,
    provenanceStatus: 'missing',
    citationChain: null,
    sourcePreview: {
      aiExcerpt: '来源缺失的 AI 摘要',
      sourceExcerpt: null,
      sourceDocumentName: null,
      extractionQuality: 'missing',
    },
    createdAt: '2026-03-30T10:40:00.000Z',
    updatedAt: '2026-03-30T10:50:00.000Z',
  },
] as const

const DETAIL_RESULTS: Record<string, { data: Record<string, unknown> }> = {
  'task-citation': {
    data: {
      id: 'review-citation',
      taskId: 'task-citation',
      selectedResult: {
        title: '真实条文溯源结果',
        overview: '这是 citation chain 场景的 AI 结果',
        reference: {
          clauseCode: 'CLAUSE-001',
          articleNo: '第十条',
          sourceName: '监管报送办法',
        },
      },
    },
  },
  'task-preview': {
    data: {
      id: 'review-preview',
      taskId: 'task-preview',
      selectedResult: {
        title: '降级来源预览结果',
        overview: '这是 degraded preview 场景的 AI 结果',
        reference: {
          clauseCode: 'CLAUSE-201',
          articleNo: '第20.1条',
          sourceName: 'ISO27001',
        },
      },
    },
  },
  'task-missing': {
    data: {
      id: 'review-missing',
      taskId: 'task-missing',
      selectedResult: {
        title: '来源缺失结果',
        overview: '这是 missing 场景的 AI 结果',
      },
    },
  },
}

async function mockSession(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SESSION_RESPONSE),
    })
  })
}

async function mockProject(page: Page) {
  await page.route('**/projects/test-project-id', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PROJECT_RESPONSE),
    })
  })
}

async function mockReviewItems(page: Page, items = REVIEW_ITEMS) {
  await page.route('**/projects/test-project-id/review-items**', async (route) => {
    if (route.request().method() === 'POST') {
      await route.continue()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          items,
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: items.length,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
          filtersApplied: {
            sortBy: 'updatedAt',
            sortOrder: 'desc',
          },
        },
      }),
    })
  })
}

async function mockReviewDetails(page: Page) {
  await page.route('**/ai-generation/result/**', async (route) => {
    const taskId = route.request().url().split('/').pop() ?? ''
    const result = DETAIL_RESULTS[taskId]

    if (!result) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Result not found' }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(result),
    })
  })
}

async function openReviewPage(page: Page, items = REVIEW_ITEMS) {
  await mockSession(page)
  await mockProject(page)
  await mockReviewItems(page, items)
  await mockReviewDetails(page)

  await page.goto('/projects/test-project-id/review')
  await expect(page.getByRole('heading', { name: '审核工作台', exact: true })).toBeVisible()
}

test.describe('[Story 8.3] 审核工作台 provenance 三态', () => {
  test('citation_chain 场景明确展示真实条文溯源语义，且不显示 partial 警告', async ({ page }) => {
    await openReviewPage(page, [REVIEW_ITEMS[0], REVIEW_ITEMS[1], REVIEW_ITEMS[2]])

    await expect(
      page.getByRole('heading', { name: '真实条文溯源审核项', exact: true })
    ).toBeVisible()
    await expect(page.getByText('真实条文溯源', { exact: true })).toBeVisible()
    await expect(page.getByText('来源：监管报送办法')).toBeVisible()
    await expect(page.getByText('这里是真实条文原文', { exact: true })).toBeVisible()
    await expect(page.getByText('条款：CLAUSE-001')).toBeVisible()
    await expect(page.getByText('条号：第十条')).toBeVisible()
    await expect(page.getByText('citation_chain', { exact: true })).toBeVisible()
    await expect(page.getByText('真实条文溯源的 AI 摘要')).toBeVisible()
    await expect(page.getByText('原文抽取可能不完整')).toHaveCount(0)
  })

  test('degraded_preview 场景明确展示降级来源预览语义，并保留 partial 提示与定位线索', async ({
    page,
  }) => {
    await openReviewPage(page, [REVIEW_ITEMS[1], REVIEW_ITEMS[0], REVIEW_ITEMS[2]])

    await expect(
      page.getByRole('heading', { name: '降级来源预览审核项', exact: true })
    ).toBeVisible()
    await expect(page.getByText('降级来源预览', { exact: true })).toBeVisible()
    await expect(page.getByText('degraded_preview', { exact: true })).toBeVisible()
    await expect(
      page.getByText('当前仅能展示来源预览或定位线索，不能宣称已完成真实条文溯源。')
    ).toBeVisible()
    await expect(page.getByText('原文抽取可能不完整')).toBeVisible()
    await expect(page.getByText('这是降级来源预览片段')).toBeVisible()
    await expect(page.getByText(/Clause Code: CLAUSE-201/)).toBeVisible()
    await expect(page.getByText(/条号: 第20.1条/)).toBeVisible()
    await expect(page.getByText('来源: ISO27001')).toBeVisible()
  })

  test('missing 场景展示缺失说明，且不伪造 preview 或 citation 文案', async ({ page }) => {
    await openReviewPage(page, [REVIEW_ITEMS[2], REVIEW_ITEMS[0], REVIEW_ITEMS[1]])

    await expect(page.getByRole('heading', { name: '来源缺失审核项', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: '来源缺失说明' })).toBeVisible()
    await expect(page.getByText('missing', { exact: true })).toBeVisible()
    await expect(
      page.getByText('当前缺少原文来源或引用不完整，系统不会猜测或补造原文内容。')
    ).toBeVisible()
    await expect(page.getByText('原文抽取可能不完整')).toHaveCount(0)
    await expect(page.getByText('这是降级来源预览片段')).toHaveCount(0)
    await expect(page.getByText('这里是真实条文原文')).toHaveCount(0)
  })
})
