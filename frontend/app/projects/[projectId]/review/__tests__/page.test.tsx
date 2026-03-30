import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import ProjectReviewPage from '../page'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  bulkApproveProjectReviewItems,
  getProjectReviewItems,
  getProjectReviewResult,
  rerunProjectReviewItem,
  submitProjectReviewDecision,
} from '@/lib/api/project-review'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
}))

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}))

jest.mock('@/lib/api/project-review', () => ({
  getProjectReviewItems: jest.fn(),
  getProjectReviewResult: jest.fn(),
  submitProjectReviewDecision: jest.fn(),
  rerunProjectReviewItem: jest.fn(),
  bulkApproveProjectReviewItems: jest.fn(),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

const mockUseParams = useParams as jest.Mock
const mockUseRouter = useRouter as jest.Mock
const mockUseSession = useSession as jest.Mock

const mockGetProjectReviewItems = getProjectReviewItems as jest.Mock
const mockGetProjectReviewResult = getProjectReviewResult as jest.Mock
const mockSubmitProjectReviewDecision = submitProjectReviewDecision as jest.Mock
const mockRerunProjectReviewItem = rerunProjectReviewItem as jest.Mock
const mockBulkApproveProjectReviewItems = bulkApproveProjectReviewItems as jest.Mock

const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

const mockLocalStorageGetItem = localStorageMock.getItem
const mockLocalStorageSetItem = localStorageMock.setItem
const mockLocalStorageRemoveItem = localStorageMock.removeItem

const mockReviewItem = {
  reviewItemId: 'review-1',
  sourceResultId: 'review-1',
  taskId: 'task-1',
  taskType: 'summary',
  reviewStage: 'summary',
  title: '综述生成',
  reviewStatus: 'pending',
  confidenceLevel: 'medium',
  consistencyScores: {
    structural: 0.9,
    semantic: 0.85,
    detail: null,
  },
  highRiskFlag: false,
  canRerun: true,
  sourceModule: 'audit',
  sourceRecordId: 'review-1',
  sourceRoute: '/projects/project-1/review',
  riskLevel: 'medium',
  degradationReasons: ['当前结果置信度为 MEDIUM'],
  matchedControls: [],
  controlId: null,
  provenanceStatus: 'degraded_preview',
  citationChain: null,
  sourcePreview: {
    aiExcerpt: '这是 AI 输出摘要',
    sourceExcerpt: '这是原文预览',
    sourceDocumentName: 'ISO27001.md',
    extractionQuality: 'complete',
  },
  createdAt: '2026-03-29T08:00:00.000Z',
  updatedAt: '2026-03-29T09:00:00.000Z',
} as const

const mockDetailResult = {
  id: 'review-1',
  taskId: 'task-1',
  projectId: 'project-1',
  generationType: 'summary',
  selectedResult: {
    title: '原始标题',
    overview: '原始概述',
    reference: {
      clauseCode: 'CLAUSE-001',
      articleNo: '第5.1条',
      sourceName: 'ISO27001',
    },
  },
  selectedModel: 'gpt4',
  confidenceLevel: 'MEDIUM',
  qualityScores: {
    structural: 0.9,
    semantic: 0.85,
    detail: 0.8,
  },
  consistencyReport: {
    agreements: [],
    disagreements: [],
    highRiskDisagreements: [],
  },
  reviewStatus: 'PENDING',
  version: 1,
  createdAt: '2026-03-29T08:00:00.000Z',
} as const

function buildReviewItemsResponse(items = [mockReviewItem]) {
  return {
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
  }
}

function buildDraftStorageKey(reviewItemId: string) {
  return `project-review-draft:project-1:${reviewItemId}`
}

function buildStoredDraft(reviewItemId: string, patchInput: string, reasonInput: string) {
  return JSON.stringify({
    projectId: 'project-1',
    reviewItemId,
    patchInput,
    reasonInput,
    savedAt: '2026-03-30T09:30:00.000Z',
  })
}

describe('ProjectReviewPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockUseParams.mockReturnValue({ projectId: 'project-1' })
    mockUseRouter.mockReturnValue({ back: jest.fn(), push: jest.fn() })
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-1',
        },
      },
      status: 'authenticated',
    })

    mockGetProjectReviewItems.mockResolvedValue({
      items: [mockReviewItem],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      filtersApplied: {
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      },
    })
    mockGetProjectReviewResult.mockResolvedValue(mockDetailResult)
    mockSubmitProjectReviewDecision.mockResolvedValue(undefined)
    mockRerunProjectReviewItem.mockResolvedValue({
      status: 'queued',
      message: '已加入重跑队列',
    })
    mockBulkApproveProjectReviewItems.mockResolvedValue({
      reviewStage: 'summary',
      filtersApplied: {
        reviewStage: 'summary',
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      },
      blockedReviewItemIds: [],
      approvedReviewItemIds: ['review-1'],
    })
    mockLocalStorageGetItem.mockReturnValue(null)
  })

  it('should load review items and render detail pane', async () => {
    render(<ProjectReviewPage />)

    await waitFor(() => {
      expect(mockGetProjectReviewItems).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          page: 1,
          pageSize: 20,
        })
      )
    })

    await waitFor(() => {
      expect(mockGetProjectReviewResult).toHaveBeenCalledWith('task-1')
    })

    expect(screen.getByText('审核工作台')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '综述生成' })).toBeInTheDocument()
    expect(screen.getByText('降级来源预览')).toBeInTheDocument()
    expect(screen.queryByText('原文来源对照')).not.toBeInTheDocument()
    expect((screen.getByLabelText('当前结果 JSON') as HTMLTextAreaElement).value).toContain(
      '原始标题'
    )
    expect(screen.getByText(/Clause Code: CLAUSE-001/)).toBeInTheDocument()
    expect(screen.getByText('结构一致性')).toBeInTheDocument()
    expect(screen.getByText('90%')).toBeInTheDocument()
  })

  it('should submit accept decision successfully', async () => {
    render(<ProjectReviewPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('当前结果 JSON')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByTestId('review-accept-button')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('review-accept-button'))

    await waitFor(() => {
      expect(mockSubmitProjectReviewDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewItemId: 'review-1',
          decision: 'accept',
          reviewedBy: 'user-1',
        })
      )
    })
  })

  it('should submit modify using modifiedPatch contract', async () => {
    render(<ProjectReviewPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('当前结果 JSON')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByLabelText('修改 patch JSON')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('修改 patch JSON'), {
      target: {
        value: '{"title":"新标题"}',
      },
    })

    fireEvent.click(screen.getByTestId('review-modify-button'))

    await waitFor(() => {
      expect(mockSubmitProjectReviewDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewItemId: 'review-1',
          decision: 'modify',
          reviewedBy: 'user-1',
          modifiedPatch: {
            title: '新标题',
          },
          originalResult: expect.objectContaining({
            title: '原始标题',
          }),
        })
      )
    })

    expect(mockSubmitProjectReviewDecision.mock.calls[0][0]).not.toHaveProperty('modifiedResult')
    expect(mockLocalStorageRemoveItem).toHaveBeenCalledWith(buildDraftStorageKey('review-1'))
  })

  it('should block modify submission when content is unchanged', async () => {
    render(<ProjectReviewPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('当前结果 JSON')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByTestId('review-modify-button')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('review-modify-button'))

    await waitFor(() => {
      expect(screen.getByText('内容未变更')).toBeInTheDocument()
    })

    expect(mockSubmitProjectReviewDecision).not.toHaveBeenCalled()
  })

  it('should preserve patch and reason when modify request fails', async () => {
    mockSubmitProjectReviewDecision.mockRejectedValueOnce(new Error('提交失败'))

    render(<ProjectReviewPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('当前结果 JSON')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByLabelText('修改 patch JSON')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('修改 patch JSON'), {
      target: {
        value: '{"title":"新标题"}',
      },
    })
    fireEvent.change(screen.getByLabelText('审核理由'), {
      target: {
        value: '需要修正文案',
      },
    })

    fireEvent.click(screen.getByTestId('review-modify-button'))

    await waitFor(() => {
      expect(mockSubmitProjectReviewDecision).toHaveBeenCalled()
    })

    expect(screen.getByLabelText('修改 patch JSON')).toHaveValue('{"title":"新标题"}')
    expect(screen.getByLabelText('审核理由')).toHaveValue('需要修正文案')
  })

  it('should autosave a meaningful draft for the selected review item', async () => {
    const intervalCallbacks: Array<() => void> = []
    const setIntervalSpy = jest.spyOn(window, 'setInterval').mockImplementation(((
      handler: TimerHandler,
      timeout?: number
    ) => {
      if (typeof handler === 'function' && timeout === 60000) {
        intervalCallbacks.push(handler as () => void)
      }
      return intervalCallbacks.length as unknown as number
    }) as typeof window.setInterval)
    const clearIntervalSpy = jest
      .spyOn(window, 'clearInterval')
      .mockImplementation((() => undefined) as typeof window.clearInterval)

    render(<ProjectReviewPage />)

    const patchField = await screen.findByLabelText('修改 patch JSON')
    const reasonField = await screen.findByLabelText('审核理由')

    fireEvent.change(patchField, {
      target: {
        value: '{"title":"草稿标题"}',
      },
    })
    fireEvent.change(reasonField, {
      target: {
        value: '需要稍后继续编辑',
      },
    })

    await waitFor(() => {
      expect(patchField).toHaveValue('{"title":"草稿标题"}')
    })

    await waitFor(() => {
      expect(intervalCallbacks.length).toBeGreaterThan(0)
    })

    act(() => {
      intervalCallbacks.forEach((callback) => callback())
    })

    const savedDrafts = mockLocalStorageSetItem.mock.calls
      .filter(([key]) => key === buildDraftStorageKey('review-1'))
      .map(([, value]) => JSON.parse(value as string))

    expect(savedDrafts.length).toBeGreaterThan(0)
    expect(
      savedDrafts.some((draft) => {
        return (
          draft.projectId === 'project-1' &&
          draft.reviewItemId === 'review-1' &&
          draft.reasonInput === '需要稍后继续编辑'
        )
      })
    ).toBe(true)

    setIntervalSpy.mockRestore()
    clearIntervalSpy.mockRestore()
  })

  it('should show restore prompt and restore the stored draft for the current review item', async () => {
    mockLocalStorageGetItem.mockImplementation((key: string) =>
      key === buildDraftStorageKey('review-1')
        ? buildStoredDraft('review-1', '{"title":"恢复标题"}', '恢复的审核理由')
        : null
    )

    render(<ProjectReviewPage />)

    await waitFor(() => {
      expect(screen.getByTestId('review-draft-restore-alert')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('review-restore-draft-button'))

    await waitFor(() => {
      expect(screen.getByLabelText('修改 patch JSON')).toHaveValue('{"title":"恢复标题"}')
    })

    expect(screen.getByLabelText('审核理由')).toHaveValue('恢复的审核理由')
    expect(screen.queryByTestId('review-draft-restore-alert')).not.toBeInTheDocument()
  })

  it('should discard the stored draft when the user ignores restore', async () => {
    mockLocalStorageGetItem.mockImplementation((key: string) =>
      key === buildDraftStorageKey('review-1')
        ? buildStoredDraft('review-1', '{"title":"恢复标题"}', '恢复的审核理由')
        : null
    )

    render(<ProjectReviewPage />)

    await waitFor(() => {
      expect(screen.getByTestId('review-draft-restore-alert')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('review-discard-draft-button'))

    await waitFor(() => {
      expect(mockLocalStorageRemoveItem).toHaveBeenCalledWith(buildDraftStorageKey('review-1'))
    })

    expect(screen.getByLabelText('修改 patch JSON')).toHaveValue('{}')
    expect(screen.getByLabelText('审核理由')).toHaveValue('')
    expect(screen.queryByTestId('review-draft-restore-alert')).not.toBeInTheDocument()
  })

  it('should clear the current draft immediately when inputs return to the default empty state', async () => {
    mockLocalStorageGetItem.mockImplementation((key: string) =>
      key === buildDraftStorageKey('review-1')
        ? buildStoredDraft('review-1', '{"title":"恢复标题"}', '恢复的审核理由')
        : null
    )

    render(<ProjectReviewPage />)

    await waitFor(() => {
      expect(screen.getByTestId('review-draft-restore-alert')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('review-restore-draft-button'))

    const patchField = await screen.findByLabelText('修改 patch JSON')
    const reasonField = await screen.findByLabelText('审核理由')

    fireEvent.change(patchField, {
      target: {
        value: '{}',
      },
    })
    fireEvent.change(reasonField, {
      target: {
        value: '',
      },
    })

    await waitFor(() => {
      expect(mockLocalStorageRemoveItem).toHaveBeenCalledWith(buildDraftStorageKey('review-1'))
    })
  })

  it.each([
    {
      decision: 'accept',
      buttonTestId: 'review-accept-button',
    },
    {
      decision: 'reject',
      buttonTestId: 'review-reject-button',
    },
  ])(
    'should clear the current draft after $decision succeeds',
    async ({ decision, buttonTestId }) => {
      render(<ProjectReviewPage />)

      const patchField = await screen.findByLabelText('修改 patch JSON')
      const reasonField = await screen.findByLabelText('审核理由')

      fireEvent.change(patchField, {
        target: {
          value: '{"title":"待清理草稿"}',
        },
      })
      fireEvent.change(reasonField, {
        target: {
          value: '待清理的审核理由',
        },
      })

      fireEvent.click(screen.getByTestId(buttonTestId))

      await waitFor(() => {
        expect(mockSubmitProjectReviewDecision).toHaveBeenCalledWith(
          expect.objectContaining({
            decision,
            reviewItemId: 'review-1',
          })
        )
      })

      expect(mockLocalStorageRemoveItem).toHaveBeenCalledWith(buildDraftStorageKey('review-1'))
    }
  )

  it('should only restore the draft that matches the selected review item', async () => {
    const secondReviewItem = {
      ...mockReviewItem,
      reviewItemId: 'review-2',
      sourceResultId: 'review-2',
      taskId: 'task-2',
      reviewStage: 'matrix',
      taskType: 'matrix',
      title: '第二审核项',
      sourceRecordId: 'review-2',
      updatedAt: '2026-03-30T10:00:00.000Z',
    }

    mockGetProjectReviewItems.mockResolvedValue(
      buildReviewItemsResponse([mockReviewItem, secondReviewItem])
    )
    mockGetProjectReviewResult.mockImplementation((taskId: string) =>
      Promise.resolve(
        taskId === 'task-2'
          ? {
              ...mockDetailResult,
              id: 'review-2',
              taskId: 'task-2',
              selectedResult: {
                title: '第二项标题',
              },
            }
          : mockDetailResult
      )
    )
    mockLocalStorageGetItem.mockImplementation((key: string) =>
      key === buildDraftStorageKey('review-2')
        ? buildStoredDraft('review-2', '{"title":"第二项草稿"}', '第二项审核理由')
        : null
    )

    render(<ProjectReviewPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '综述生成' })).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText('第二审核项')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('review-draft-restore-alert')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('第二审核项'))

    await waitFor(() => {
      expect(mockGetProjectReviewResult).toHaveBeenCalledWith('task-2')
    })

    await waitFor(() => {
      expect(mockLocalStorageGetItem).toHaveBeenCalledWith(buildDraftStorageKey('review-2'))
    })
  })

  it('should discard malformed stored drafts without breaking the page', async () => {
    mockLocalStorageGetItem.mockImplementation((key: string) =>
      key === buildDraftStorageKey('review-1') ? '{bad-json' : null
    )

    render(<ProjectReviewPage />)

    await screen.findByLabelText('修改 patch JSON')

    await waitFor(() => {
      expect(mockLocalStorageGetItem).toHaveBeenCalledWith(buildDraftStorageKey('review-1'))
    })

    expect(screen.queryByTestId('review-draft-restore-alert')).not.toBeInTheDocument()
  })

  it('should request retry-later status for rerun failures without clearing context', async () => {
    mockRerunProjectReviewItem.mockResolvedValueOnce({
      status: 'retry-later',
      message: '队列繁忙',
    })

    render(<ProjectReviewPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('当前结果 JSON')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByTestId('review-rerun-button')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('review-rerun-button'))

    await waitFor(() => {
      expect(mockRerunProjectReviewItem).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-1',
          reviewItemId: 'review-1',
          reviewStage: 'summary',
        })
      )
    })

    expect(screen.getByText(/retry-later/)).toBeInTheDocument()
  })

  it('should show explicit missing-source guidance when source excerpt is unavailable', async () => {
    mockGetProjectReviewItems.mockResolvedValueOnce({
      items: [
        {
          ...mockReviewItem,
          provenanceStatus: 'missing',
          sourcePreview: {
            ...mockReviewItem.sourcePreview,
            sourceExcerpt: null,
            extractionQuality: 'missing',
          },
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      filtersApplied: {
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      },
    })

    render(<ProjectReviewPage />)

    await waitFor(() => {
      expect(
        screen.getByText('当前缺少原文来源或引用不完整，系统不会猜测或补造原文内容。')
      ).toBeInTheDocument()
    })

    expect(screen.queryByText('原文来源对照')).not.toBeInTheDocument()
  })

  it('should show citation-chain semantics when a real clause chain is available', async () => {
    mockGetProjectReviewItems.mockResolvedValueOnce({
      items: [
        {
          ...mockReviewItem,
          provenanceStatus: 'citation_chain',
          sourcePreview: {
            ...mockReviewItem.sourcePreview,
            extractionQuality: 'partial',
          },
          citationChain: {
            sourceId: 'source-1',
            sourceName: '监管报送办法',
            clauseId: 'clause-1',
            clauseCode: 'CLAUSE-001',
            articleNo: '第十条',
            rawText: '这里是真实条文原文',
          },
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      filtersApplied: {
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      },
    })

    render(<ProjectReviewPage />)

    await waitFor(() => {
      expect(screen.getByText('真实条文溯源')).toBeInTheDocument()
    })

    expect(screen.getAllByText(/CLAUSE-001/).length).toBeGreaterThan(0)
    expect(screen.queryByText('原文抽取可能不完整')).not.toBeInTheDocument()
  })

  it('should show extraction-quality warning for partial source text', async () => {
    mockGetProjectReviewItems.mockResolvedValueOnce({
      items: [
        {
          ...mockReviewItem,
          provenanceStatus: 'degraded_preview',
          sourcePreview: {
            ...mockReviewItem.sourcePreview,
            extractionQuality: 'partial',
          },
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      filtersApplied: {
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      },
    })

    render(<ProjectReviewPage />)

    await waitFor(() => {
      expect(screen.getByText('原文抽取可能不完整')).toBeInTheDocument()
    })
  })

  it('should highlight high-risk items in the score panel', async () => {
    mockGetProjectReviewItems.mockResolvedValue({
      items: [
        {
          ...mockReviewItem,
          highRiskFlag: true,
          riskLevel: 'high',
          confidenceLevel: 'low',
          degradationReasons: ['检测到 2 个高风险分歧点'],
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      filtersApplied: {
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      },
    })

    render(<ProjectReviewPage />)

    await waitFor(() => {
      expect(screen.getByText('当前项需要优先处理')).toBeInTheDocument()
    })
  })

  it('should block bulk approve when reviewStage is not locked to a single stage', async () => {
    render(<ProjectReviewPage />)

    await waitFor(() => {
      expect(screen.getByTestId('review-bulk-approve-button')).toBeEnabled()
    })

    fireEvent.click(screen.getByTestId('review-bulk-approve-button'))

    await waitFor(() => {
      expect(screen.getByText('整批通过前请先选择单一审核阶段')).toBeInTheDocument()
    })

    expect(mockBulkApproveProjectReviewItems).not.toHaveBeenCalled()
  })

  it('should surface blocked review item ids returned by the batch endpoint', async () => {
    mockBulkApproveProjectReviewItems.mockResolvedValueOnce({
      reviewStage: 'summary',
      filtersApplied: {
        reviewStage: 'summary',
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      },
      blockedReviewItemIds: ['review-high-1'],
      approvedReviewItemIds: [],
    })

    render(<ProjectReviewPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('审核阶段筛选')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('审核阶段筛选'), {
      target: {
        value: 'summary',
      },
    })

    await waitFor(() => {
      expect(screen.getByTestId('review-bulk-approve-button')).toBeEnabled()
    })

    fireEvent.click(screen.getByTestId('review-bulk-approve-button'))

    await waitFor(() => {
      expect(screen.getByText(/review-high-1/)).toBeInTheDocument()
    })
  })

  it('should call the batch approve endpoint after a single reviewStage is selected', async () => {
    render(<ProjectReviewPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('审核阶段筛选')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('审核阶段筛选'), {
      target: {
        value: 'summary',
      },
    })

    await waitFor(() => {
      expect(screen.getByTestId('review-bulk-approve-button')).toBeEnabled()
    })

    fireEvent.click(screen.getByTestId('review-bulk-approve-button'))

    await waitFor(() => {
      expect(mockBulkApproveProjectReviewItems).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          reviewStage: 'summary',
        })
      )
    })
  })

  it('should refetch items when filter changes', async () => {
    render(<ProjectReviewPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('审核状态筛选')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('审核状态筛选'), {
      target: {
        value: 'pending',
      },
    })

    await waitFor(() => {
      expect(mockGetProjectReviewItems).toHaveBeenLastCalledWith(
        'project-1',
        expect.objectContaining({
          reviewStatus: ['pending'],
        })
      )
    })
  })
})
