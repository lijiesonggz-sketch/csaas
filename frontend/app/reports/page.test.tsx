import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ReportsPage from './page'
import { useRouter } from 'next/navigation'
import { getReportCenter } from '@/lib/api/report-center'

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

jest.mock('@/components/layout/MainLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/lib/api/report-center', () => ({
  getReportCenter: jest.fn(),
}))

describe('ReportsPage', () => {
  const mockPush = jest.fn()
  const mockGetReportCenter = getReportCenter as jest.MockedFunction<typeof getReportCenter>

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })
    mockGetReportCenter.mockResolvedValue({
      items: [
        {
          projectId: 'project-ready',
          projectName: '可查看项目',
          organizationId: 'org-1',
          reportId: 'survey-ready',
          reportStatus: 'ready',
          latestSurveyResponseId: 'survey-ready',
          generatedAt: '2026-03-30T08:00:00.000Z',
          updatedAt: '2026-03-30T09:00:00.000Z',
          projectSummary: {
            clientName: '客户A',
            standardName: 'ISO27001',
            projectStatus: 'active',
          },
          gapSummary: {
            overallMaturity: 3.6,
            overallGrade: '充分规范级',
            topShortcomings: [
              {
                clusterId: 'cluster-1',
                clusterName: '身份与访问控制',
                gap: 1.2,
              },
            ],
          },
          riskSummary: {
            conflictSeverity: 'MEDIUM',
            conflictCount: 2,
            topRiskClusters: ['身份与访问控制'],
          },
          emptyStateReason: null,
          availableActions: {
            viewReport: true,
          },
        },
        {
          projectId: 'project-empty',
          projectName: '空态项目',
          organizationId: 'org-1',
          reportId: null,
          reportStatus: 'not_ready',
          latestSurveyResponseId: null,
          generatedAt: null,
          updatedAt: '2026-03-29T09:00:00.000Z',
          projectSummary: {
            clientName: '客户B',
            standardName: null,
            projectStatus: 'draft',
          },
          gapSummary: {
            overallMaturity: null,
            overallGrade: null,
            topShortcomings: [],
          },
          riskSummary: {
            conflictSeverity: 'NONE',
            conflictCount: 0,
            topRiskClusters: [],
          },
          emptyStateReason: '尚未完成问卷并生成可读报告数据',
          availableActions: {
            viewReport: false,
          },
        },
      ],
      summary: {
        totalItems: 2,
        readyCount: 1,
        notReadyCount: 1,
        failedCount: 0,
      },
      filtersApplied: {
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      },
    })
  })

  it('renders report center items and empty-state messaging', async () => {
    render(<ReportsPage />)

    await waitFor(() => {
      expect(mockGetReportCenter).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'updatedAt',
          sortOrder: 'desc',
        }),
      )
    })

    expect(screen.getByText('报告中心')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '可查看项目' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '空态项目' })).toBeInTheDocument()
    expect(screen.getByText('当前项目暂无可读报告')).toBeInTheDocument()
    expect(screen.getByText('尚未完成问卷并生成可读报告数据')).toBeInTheDocument()
  })

  it('navigates to detail when the ready report action is clicked', async () => {
    render(<ReportsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('report-view-project-ready')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('report-view-project-ready'))

    expect(mockPush).toHaveBeenCalledWith('/reports/survey-ready')
  })

  it('refetches report center data when status filter changes', async () => {
    render(<ReportsPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('状态筛选')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('状态筛选'), {
      target: {
        value: 'ready',
      },
    })

    await waitFor(() => {
      expect(mockGetReportCenter).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: ['ready'],
        }),
      )
    })
  })

  it('renders a global empty state when no report items are returned', async () => {
    mockGetReportCenter.mockResolvedValueOnce({
      items: [],
      summary: {
        totalItems: 0,
        readyCount: 0,
        notReadyCount: 0,
        failedCount: 0,
      },
      filtersApplied: {
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      },
    })

    render(<ReportsPage />)

    await waitFor(() => {
      expect(screen.getByText('暂无报告项目')).toBeInTheDocument()
    })
  })
})
