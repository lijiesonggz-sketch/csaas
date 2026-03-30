/**
 * Story 7.4: 审核工作台控制点详情抽屉集成 - 单元测试
 *
 * 测试 page.tsx 中 ControlDetailDrawer 的集成逻辑
 * 验证状态管理、参数传递和上下文保持
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ReviewPage from '../page'
import { getProjectReviewItems } from '@/lib/api/project-review'

// Mock ControlDetailDrawer
jest.mock('@/components/compliance/ControlDetailDrawer', () => ({
  ControlDetailDrawer: ({
    open,
    onOpenChange,
    controlId,
    sourceModule,
    sourceRecordId,
    organizationId,
  }) => {
    if (!open) return null
    return (
      <div data-testid="control-detail-drawer">
        <div data-testid="control-id">{controlId}</div>
        <div data-testid="source-module">{sourceModule}</div>
        <div data-testid="source-record-id">{sourceRecordId}</div>
        <div data-testid="organization-id">{organizationId}</div>
        <button data-testid="drawer-close-button" onClick={() => onOpenChange(false)}>
          关闭
        </button>
      </div>
    )
  },
}))

// Mock API
jest.mock('@/lib/api/project-review', () => ({
  getProjectReviewItems: jest.fn().mockResolvedValue({
    items: [
      {
        reviewItemId: 'item-1',
        sourceResultId: 'result-1',
        title: '测试审核项1',
        reviewStatus: 'pending',
        riskLevel: 'low',
        confidenceLevel: 'high',
        reviewStage: 'summary',
        canRerun: true,
        highRiskFlag: false,
        degradationReasons: [],
        consistencyScores: { structural: 0.9, semantic: 0.85, detail: 0.88 },
        controlId: 'CP-001',
        matchedControls: [
          {
            controlId: 'CP-001',
            controlName: '测试控制点1',
            packSource: 'governance',
            priority: 'HIGH',
          },
        ],
        taskId: 'task-1',
        sourceModule: 'audit',
        sourceRecordId: 'item-1',
        sourceRoute: '/projects/test-project-id/review',
        sourcePreview: {
          sourceDocumentName: 'test-doc.pdf',
          extractionQuality: 'complete',
          sourceExcerpt: 'test excerpt',
          aiExcerpt: 'AI result',
        },
        updatedAt: '2026-03-29T00:00:00Z',
      },
      {
        reviewItemId: 'item-2',
        sourceResultId: 'result-2',
        title: '测试审核项2（无控制点）',
        reviewStatus: 'pending',
        riskLevel: 'medium',
        confidenceLevel: 'medium',
        reviewStage: 'clustering',
        canRerun: true,
        highRiskFlag: false,
        degradationReasons: [],
        consistencyScores: { structural: null, semantic: 0.7, detail: 0.6 },
        controlId: null,
        matchedControls: [],
        taskId: 'task-2',
        sourceModule: 'audit',
        sourceRecordId: 'item-2',
        sourceRoute: '/projects/test-project-id/review',
        sourcePreview: {
          sourceDocumentName: 'doc2.pdf',
          extractionQuality: 'partial',
          sourceExcerpt: 'excerpt 2',
          aiExcerpt: 'AI result 2',
        },
        updatedAt: '2026-03-29T00:00:00Z',
      },
      {
        reviewItemId: 'item-3',
        sourceResultId: 'result-3',
        title: '测试审核项3（多控制点）',
        reviewStatus: 'pending',
        riskLevel: 'medium',
        confidenceLevel: 'medium',
        reviewStage: 'matrix',
        canRerun: true,
        highRiskFlag: false,
        degradationReasons: [],
        consistencyScores: { structural: 0.8, semantic: 0.75, detail: 0.72 },
        controlId: null,
        matchedControls: [
          {
            controlId: 'CP-010',
            controlName: '测试控制点10',
            packSource: 'governance',
            priority: 'HIGH',
          },
          {
            controlId: 'CP-011',
            controlName: '测试控制点11',
            packSource: 'sector',
            priority: 'MEDIUM',
          },
        ],
        taskId: 'task-3',
        sourceModule: 'audit',
        sourceRecordId: 'item-3',
        sourceRoute: '/projects/test-project-id/review',
        sourcePreview: {
          sourceDocumentName: 'doc3.pdf',
          extractionQuality: 'complete',
          sourceExcerpt: 'excerpt 3',
          aiExcerpt: 'AI result 3',
        },
        updatedAt: '2026-03-29T00:00:00Z',
      },
    ],
  }),
  getProjectReviewResult: jest.fn().mockResolvedValue({
    id: 'result-1',
    taskId: 'task-1',
    selectedResult: JSON.stringify({ key: 'value' }),
    status: 'completed',
  }),
  rerunProjectReviewItem: jest.fn(),
  submitProjectReviewDecision: jest.fn(),
}))

jest.mock('@/lib/stores/useOrganizationStore', () => ({
  useOrganizationStore: jest.fn((selector) => {
    const state = {
      currentOrganization: { id: 'org-123', name: 'Test Org' },
    }
    return selector(state)
  }),
}))

jest.mock('next-auth/react', () => ({
  useSession: jest.fn().mockReturnValue({
    data: { user: { id: 'user-1', name: 'Test User' } },
  }),
}))

jest.mock('next/navigation', () => ({
  useParams: jest.fn().mockReturnValue({ projectId: 'test-project-id' }),
  useRouter: jest.fn().mockReturnValue({ back: jest.fn() }),
}))

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

const mockGetProjectReviewItems = getProjectReviewItems as jest.Mock

function buildDefaultReviewItemsResponse() {
  return {
    items: [
      {
        reviewItemId: 'item-1',
        sourceResultId: 'result-1',
        title: '测试审核项1',
        reviewStatus: 'pending',
        riskLevel: 'low',
        confidenceLevel: 'high',
        reviewStage: 'summary',
        canRerun: true,
        highRiskFlag: false,
        degradationReasons: [],
        consistencyScores: { structural: 0.9, semantic: 0.85, detail: 0.88 },
        controlId: 'CP-001',
        matchedControls: [
          {
            controlId: 'CP-001',
            controlName: '测试控制点1',
            packSource: 'governance',
            priority: 'HIGH',
          },
        ],
        taskId: 'task-1',
        sourceModule: 'audit',
        sourceRecordId: 'item-1',
        sourceRoute: '/projects/test-project-id/review',
        sourcePreview: {
          sourceDocumentName: 'test-doc.pdf',
          extractionQuality: 'complete',
          sourceExcerpt: 'test excerpt',
          aiExcerpt: 'AI result',
        },
        updatedAt: '2026-03-29T00:00:00Z',
      },
      {
        reviewItemId: 'item-2',
        sourceResultId: 'result-2',
        title: '测试审核项2（无控制点）',
        reviewStatus: 'pending',
        riskLevel: 'medium',
        confidenceLevel: 'medium',
        reviewStage: 'clustering',
        canRerun: true,
        highRiskFlag: false,
        degradationReasons: [],
        consistencyScores: { structural: null, semantic: 0.7, detail: 0.6 },
        controlId: null,
        matchedControls: [],
        taskId: 'task-2',
        sourceModule: 'audit',
        sourceRecordId: 'item-2',
        sourceRoute: '/projects/test-project-id/review',
        sourcePreview: {
          sourceDocumentName: 'doc2.pdf',
          extractionQuality: 'partial',
          sourceExcerpt: 'excerpt 2',
          aiExcerpt: 'AI result 2',
        },
        updatedAt: '2026-03-29T00:00:00Z',
      },
      {
        reviewItemId: 'item-3',
        sourceResultId: 'result-3',
        title: '测试审核项3（多控制点）',
        reviewStatus: 'pending',
        riskLevel: 'medium',
        confidenceLevel: 'medium',
        reviewStage: 'matrix',
        canRerun: true,
        highRiskFlag: false,
        degradationReasons: [],
        consistencyScores: { structural: 0.8, semantic: 0.75, detail: 0.72 },
        controlId: null,
        matchedControls: [
          {
            controlId: 'CP-010',
            controlName: '测试控制点10',
            packSource: 'governance',
            priority: 'HIGH',
          },
          {
            controlId: 'CP-011',
            controlName: '测试控制点11',
            packSource: 'sector',
            priority: 'MEDIUM',
          },
        ],
        taskId: 'task-3',
        sourceModule: 'audit',
        sourceRecordId: 'item-3',
        sourceRoute: '/projects/test-project-id/review',
        sourcePreview: {
          sourceDocumentName: 'doc3.pdf',
          extractionQuality: 'complete',
          sourceExcerpt: 'excerpt 3',
          aiExcerpt: 'AI result 3',
        },
        updatedAt: '2026-03-29T00:00:00Z',
      },
    ],
  }
}

/** 点击列表中的审核项（第一个按钮匹配） */
async function selectItem(name: string) {
  // 列表中的 item 是 button[type="button"]，包含 item.title
  // 但详情区标题也包含相同文本，所以用 getAllByText 取列表中的
  const buttons = await screen.findAllByText(name)
  // 列表中的在详情区之前（DOM 顺序），取第一个
  fireEvent.click(buttons[0])
}

/** 打开控制点详情抽屉 */
async function openDrawer() {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /查看控制点详情/ })).toBeInTheDocument()
  })
  fireEvent.click(screen.getByRole('button', { name: /查看控制点详情/ }))

  await waitFor(() => {
    expect(screen.getByTestId('control-detail-drawer')).toBeInTheDocument()
  })
}

describe('Story 7.4: 审核工作台控制点详情抽屉集成', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetProjectReviewItems.mockResolvedValue(buildDefaultReviewItemsResponse())
  })

  describe('抽屉状态管理', () => {
    it('应该初始状态为关闭', async () => {
      render(<ReviewPage />)

      await waitFor(() => {
        expect(screen.getAllByText('测试审核项1').length).toBeGreaterThan(0)
      })

      expect(screen.queryByTestId('control-detail-drawer')).not.toBeInTheDocument()
    })

    it('应该在点击"查看控制点详情"后打开抽屉', async () => {
      render(<ReviewPage />)

      await waitFor(() => {
        expect(screen.getAllByText('测试审核项1').length).toBeGreaterThan(0)
      })

      await selectItem('测试审核项1')
      await openDrawer()

      expect(screen.getByTestId('control-detail-drawer')).toBeInTheDocument()
    })

    it('应该在点击关闭按钮后关闭抽屉', async () => {
      render(<ReviewPage />)

      await waitFor(() => {
        expect(screen.getAllByText('测试审核项1').length).toBeGreaterThan(0)
      })

      await selectItem('测试审核项1')
      await openDrawer()

      fireEvent.click(screen.getByTestId('drawer-close-button'))

      await waitFor(() => {
        expect(screen.queryByTestId('control-detail-drawer')).not.toBeInTheDocument()
      })
    })

    it('没有 controlId 的审核项不应显示"查看控制点详情"按钮', async () => {
      render(<ReviewPage />)

      await waitFor(() => {
        expect(screen.getAllByText('测试审核项2（无控制点）').length).toBeGreaterThan(0)
      })

      await selectItem('测试审核项2（无控制点）')

      // 等待详情区更新为 item-2 的内容（heading 中出现 item-2 的标题）
      // 同时验证按钮已消失（都包在 waitFor 中确保 React 完成重渲染）
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '测试审核项2（无控制点）' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '查看控制点详情' })).not.toBeInTheDocument()
      })
    })

    it('controlId 为空但 matchedControls 非空时仍应显示"查看控制点详情"按钮', async () => {
      mockGetProjectReviewItems.mockResolvedValue({
        items: [
          {
            reviewItemId: 'item-3',
            sourceResultId: 'result-3',
            title: '测试审核项3（多控制点）',
            reviewStatus: 'pending',
            riskLevel: 'medium',
            confidenceLevel: 'medium',
            reviewStage: 'matrix',
            canRerun: true,
            highRiskFlag: false,
            degradationReasons: [],
            consistencyScores: { structural: 0.8, semantic: 0.75, detail: 0.72 },
            controlId: null,
            matchedControls: [
              {
                controlId: 'CP-010',
                controlName: '测试控制点10',
                packSource: 'governance',
                priority: 'HIGH',
              },
              {
                controlId: 'CP-011',
                controlName: '测试控制点11',
                packSource: 'sector',
                priority: 'MEDIUM',
              },
            ],
            taskId: 'task-3',
            sourceModule: 'audit',
            sourceRecordId: 'item-3',
            sourceRoute: '/projects/test-project-id/review',
            sourcePreview: {
              sourceDocumentName: 'doc3.pdf',
              extractionQuality: 'complete',
              sourceExcerpt: 'excerpt 3',
              aiExcerpt: 'AI result 3',
            },
            updatedAt: '2026-03-29T00:00:00Z',
          },
        ],
      })

      render(<ReviewPage />)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '测试审核项3（多控制点）' })).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /查看控制点详情/ })).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /查看控制点详情/ })).toHaveTextContent('(2)')
    })
  })

  describe('控制点上下文参数传递', () => {
    it('应该传递正确的 controlId', async () => {
      render(<ReviewPage />)

      await waitFor(() => {
        expect(screen.getAllByText('测试审核项1').length).toBeGreaterThan(0)
      })

      await selectItem('测试审核项1')
      await openDrawer()

      expect(screen.getByTestId('control-id')).toHaveTextContent('CP-001')
    })

    it('多控制点场景下应该传递首个 matched control 的 controlId', async () => {
      mockGetProjectReviewItems.mockResolvedValue({
        items: [
          {
            reviewItemId: 'item-3',
            sourceResultId: 'result-3',
            title: '测试审核项3（多控制点）',
            reviewStatus: 'pending',
            riskLevel: 'medium',
            confidenceLevel: 'medium',
            reviewStage: 'matrix',
            canRerun: true,
            highRiskFlag: false,
            degradationReasons: [],
            consistencyScores: { structural: 0.8, semantic: 0.75, detail: 0.72 },
            controlId: null,
            matchedControls: [
              {
                controlId: 'CP-010',
                controlName: '测试控制点10',
                packSource: 'governance',
                priority: 'HIGH',
              },
              {
                controlId: 'CP-011',
                controlName: '测试控制点11',
                packSource: 'sector',
                priority: 'MEDIUM',
              },
            ],
            taskId: 'task-3',
            sourceModule: 'audit',
            sourceRecordId: 'item-3',
            sourceRoute: '/projects/test-project-id/review',
            sourcePreview: {
              sourceDocumentName: 'doc3.pdf',
              extractionQuality: 'complete',
              sourceExcerpt: 'excerpt 3',
              aiExcerpt: 'AI result 3',
            },
            updatedAt: '2026-03-29T00:00:00Z',
          },
        ],
      })

      render(<ReviewPage />)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '测试审核项3（多控制点）' })).toBeInTheDocument()
      })
      await openDrawer()

      expect(screen.getByTestId('control-id')).toHaveTextContent('CP-010')
    })

    it('应该传递 sourceModule="audit"', async () => {
      render(<ReviewPage />)

      await waitFor(() => {
        expect(screen.getAllByText('测试审核项1').length).toBeGreaterThan(0)
      })

      await selectItem('测试审核项1')
      await openDrawer()

      expect(screen.getByTestId('source-module')).toHaveTextContent('audit')
    })

    it('应该传递正确的 sourceRecordId（审核项ID）', async () => {
      render(<ReviewPage />)

      await waitFor(() => {
        expect(screen.getAllByText('测试审核项1').length).toBeGreaterThan(0)
      })

      await selectItem('测试审核项1')
      await openDrawer()

      expect(screen.getByTestId('source-record-id')).toHaveTextContent('item-1')
    })

    it('应该传递正确的 organizationId', async () => {
      render(<ReviewPage />)

      await waitFor(() => {
        expect(screen.getAllByText('测试审核项1').length).toBeGreaterThan(0)
      })

      await selectItem('测试审核项1')
      await openDrawer()

      expect(screen.getByTestId('organization-id')).toHaveTextContent('org-123')
    })
  })

  describe('审核上下文保持', () => {
    it('关闭抽屉后审核列表状态应保持不变', async () => {
      render(<ReviewPage />)

      await waitFor(() => {
        expect(screen.getAllByText('测试审核项1').length).toBeGreaterThan(0)
      })

      await selectItem('测试审核项1')
      await openDrawer()

      fireEvent.click(screen.getByTestId('drawer-close-button'))

      await waitFor(() => {
        expect(screen.queryByTestId('control-detail-drawer')).not.toBeInTheDocument()
      })

      // 审核列表和详情区仍然可见
      expect(screen.getAllByText('测试审核项1').length).toBeGreaterThan(0)
      expect(screen.getByText('详情区')).toBeInTheDocument()
    })
  })
})
