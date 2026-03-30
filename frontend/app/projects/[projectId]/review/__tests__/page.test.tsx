import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ProjectReviewPage from '../page'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
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
  })

  it('should load review items and render detail pane', async () => {
    render(<ProjectReviewPage />)

    await waitFor(() => {
      expect(mockGetProjectReviewItems).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          page: 1,
          pageSize: 20,
        }),
      )
    })

    await waitFor(() => {
      expect(mockGetProjectReviewResult).toHaveBeenCalledWith('task-1')
    })

    expect(screen.getByText('审核工作台')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '综述生成' })).toBeInTheDocument()
    expect(
      (screen.getByLabelText('当前结果 JSON') as HTMLTextAreaElement).value,
    ).toContain('原始标题')
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
        }),
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
        }),
      )
    })

    expect(mockSubmitProjectReviewDecision.mock.calls[0][0]).not.toHaveProperty(
      'modifiedResult',
    )
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
        }),
      )
    })

    expect(screen.getByText(/retry-later/)).toBeInTheDocument()
  })

  it('should show explicit missing-source guidance when source excerpt is unavailable', async () => {
    mockGetProjectReviewItems.mockResolvedValueOnce({
      items: [
        {
          ...mockReviewItem,
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
        screen.getByText('当前缺少原文来源或引用不完整，系统不会猜测或补造原文内容。'),
      ).toBeInTheDocument()
    })
  })

  it('should show extraction-quality warning for partial source text', async () => {
    mockGetProjectReviewItems.mockResolvedValueOnce({
      items: [
        {
          ...mockReviewItem,
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

  it('should block bulk approve when pending high-risk items still exist after revalidation', async () => {
    mockGetProjectReviewItems.mockResolvedValue({
      items: [
        {
          ...mockReviewItem,
          reviewItemId: 'review-high-1',
          highRiskFlag: true,
          riskLevel: 'high',
          reviewStatus: 'pending',
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
      expect(screen.getByTestId('review-bulk-approve-button')).toBeEnabled()
    })

    fireEvent.click(screen.getByTestId('review-bulk-approve-button'))

    await waitFor(() => {
      expect(screen.getByText(/未确认高风险项/)).toBeInTheDocument()
    })
  })

  it('should bulk approve remaining low-risk pending items after high-risk items are already confirmed', async () => {
    mockGetProjectReviewItems.mockResolvedValue({
      items: [
        {
          ...mockReviewItem,
          reviewItemId: 'review-high-approved',
          highRiskFlag: true,
          riskLevel: 'high',
          reviewStatus: 'approved',
        },
        {
          ...mockReviewItem,
          reviewItemId: 'review-low-pending',
          highRiskFlag: false,
          riskLevel: 'low',
          reviewStatus: 'pending',
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 2,
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
      expect(screen.getByTestId('review-bulk-approve-button')).toBeEnabled()
    })

    fireEvent.click(screen.getByTestId('review-bulk-approve-button'))

    await waitFor(() => {
      expect(mockSubmitProjectReviewDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewItemId: 'review-low-pending',
          decision: 'accept',
          reviewedBy: 'user-1',
        }),
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
        }),
      )
    })
  })
})
