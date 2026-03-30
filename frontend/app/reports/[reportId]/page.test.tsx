import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ControlReportPage from './page'
import { useParams } from 'next/navigation'
import {
  createReportPdfJob,
  downloadReportPdf,
  getLatestReportPdfJob,
  getReportDetail,
  getRemediationPriorityList,
} from '@/lib/api/report-center'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
}))

jest.mock('@/lib/api/report-center', () => ({
  getReportDetail: jest.fn(),
  getLatestReportPdfJob: jest.fn(),
  createReportPdfJob: jest.fn(),
  getReportPdfJob: jest.fn(),
  downloadReportPdf: jest.fn(),
  getRemediationPriorityList: jest.fn(),
}))

jest.mock('@/lib/stores/useOrganizationStore', () => ({
  useOrganizationStore: jest.fn((selector: (state: { currentOrganization: { id: string } }) => unknown) =>
    selector({
      currentOrganization: { id: 'org-1' },
    }),
  ),
}))

const mockControlDetailDrawer = jest.fn(
  ({
    open,
    controlId,
    sourceModule,
    sourceRecordId,
  }: {
    open: boolean
    controlId: string
    sourceModule: string
    sourceRecordId: string
  }) =>
    open ? (
      <div data-testid="report-control-detail-drawer">
        {controlId}-{sourceModule}-{sourceRecordId}
      </div>
    ) : null,
)

jest.mock('@/components/compliance/ControlDetailDrawer', () => ({
  ControlDetailDrawer: (props: {
    open: boolean
    controlId: string
    sourceModule: string
    sourceRecordId: string
  }) => mockControlDetailDrawer(props),
}))

describe('ControlReportPage', () => {
  const mockGetReportDetail = getReportDetail as jest.MockedFunction<typeof getReportDetail>
  const mockGetLatestReportPdfJob = getLatestReportPdfJob as jest.MockedFunction<
    typeof getLatestReportPdfJob
  >
  const mockCreateReportPdfJob = createReportPdfJob as jest.MockedFunction<
    typeof createReportPdfJob
  >
  const mockDownloadReportPdf = downloadReportPdf as jest.MockedFunction<typeof downloadReportPdf>
  const mockGetRemediationPriorityList = getRemediationPriorityList as jest.MockedFunction<
    typeof getRemediationPriorityList
  >

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useParams as jest.Mock).mockReturnValue({
      reportId: '11111111-1111-4111-8111-111111111111',
    })
    mockGetLatestReportPdfJob.mockResolvedValue(null)
    mockGetRemediationPriorityList.mockResolvedValue({
      reportId: '11111111-1111-4111-8111-111111111111',
      items: [
        {
          rank: 1,
          controlId: 'control-1',
          remediationActionId: 'action-1',
          controlCode: 'CTRL-001',
          controlName: '账号权限最小化',
          l1Code: 'IT01',
          l1Name: '身份安全',
          l2Code: 'IT01-01',
          l2Name: '账户治理',
          riskLevel: 'HIGH',
          difficultyLevel: 'medium',
          priorityScore: 6,
          statusLabel: '已有整改建议',
          title: '补齐权限复核流程',
          description: '建立每季度权限复核记录',
          expectedBenefit: '降低超权访问风险',
        },
      ],
    })
  })

  it('renders section, control and recommendation hierarchy', async () => {
    mockGetReportDetail.mockResolvedValue({
      sections: [
        {
          l1Code: 'IT01',
          l1Name: '身份安全',
          l2Sections: [
            {
              l2Code: 'IT01-01',
              l2Name: '账户治理',
              controls: [
                {
                  controlId: 'control-1',
                  controlCode: 'CTRL-001',
                  controlName: '账号权限最小化',
                  currentStatus: 'PARTIAL',
                  gapLevel: 'HIGH',
                  clauses: [],
                  cases: [],
                  evidences: [],
                  recommendations: [
                    {
                      controlId: 'control-1',
                      remediationActionId: 'action-1',
                      actionCode: 'RA-001',
                      actionTitle: '补齐权限复核流程',
                      actionDesc: '建立每季度权限复核记录',
                      priority: 'HIGH',
                      currentStatus: 'PARTIAL',
                      gapLevel: 'HIGH',
                      expectedBenefit: '降低超权访问风险',
                    },
                  ],
                  matchedControls: [
                    {
                      controlId: 'control-1',
                      controlName: '账号权限最小化',
                      packSource: 'report',
                      priority: 'HIGH',
                    },
                  ],
                  sourceModule: 'report',
                  sourceRecordId: '11111111-1111-4111-8111-111111111111',
                  sourceRoute: '/reports/11111111-1111-4111-8111-111111111111',
                },
              ],
            },
          ],
        },
      ],
    })

    render(<ControlReportPage />)

    await waitFor(() => {
      expect(screen.getByText('身份安全')).toBeInTheDocument()
    })

    expect(screen.getByText('账户治理')).toBeInTheDocument()
    expect(screen.getByText('CTRL-001')).toBeInTheDocument()
    expect(screen.getByText('账号权限最小化')).toBeInTheDocument()
    expect(screen.getAllByText('补齐权限复核流程').length).toBeGreaterThan(0)
    expect(screen.getAllByText('建立每季度权限复核记录').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/降低超权访问风险/).length).toBeGreaterThan(0)
    expect(screen.getByText('整改优先级清单')).toBeInTheDocument()
  })

  it('shows empty state when no sections are returned', async () => {
    mockGetReportDetail.mockResolvedValue({
      sections: [],
    })

    render(<ControlReportPage />)

    await waitFor(() => {
      expect(screen.getByText('暂无报告数据')).toBeInTheDocument()
    })
  })

  it('shows not-found style error when report detail request fails', async () => {
    const error = new Error('报告不存在')
    ;(error as Error & { status?: number }).status = 404
    mockGetReportDetail.mockRejectedValue(error)

    render(<ControlReportPage />)

    await waitFor(() => {
      expect(screen.getByText('未找到对应报告')).toBeInTheDocument()
    })
  })

  it('opens shared control detail drawer from a control node', async () => {
    mockGetReportDetail.mockResolvedValue({
      sections: [
        {
          l1Code: 'IT01',
          l1Name: '身份安全',
          l2Sections: [
            {
              l2Code: 'IT01-01',
              l2Name: '账户治理',
              controls: [
                {
                  controlId: 'control-1',
                  controlCode: 'CTRL-001',
                  controlName: '账号权限最小化',
                  currentStatus: 'PARTIAL',
                  gapLevel: 'HIGH',
                  clauses: [],
                  cases: [],
                  evidences: [],
                  recommendations: [],
                  matchedControls: [
                    {
                      controlId: 'control-1',
                      controlName: '账号权限最小化',
                      packSource: 'report',
                      priority: 'HIGH',
                    },
                  ],
                  sourceModule: 'report',
                  sourceRecordId: 'report-node-001',
                  sourceRoute: '/reports/11111111-1111-4111-8111-111111111111',
                },
              ],
            },
          ],
        },
      ],
    })

    render(<ControlReportPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '查看详情' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '查看详情' }))

    expect(screen.getByTestId('report-control-detail-drawer')).toBeInTheDocument()
    expect(mockControlDetailDrawer).toHaveBeenCalledWith(
      expect.objectContaining({
        controlId: 'control-1',
        sourceModule: 'report',
        sourceRecordId: 'report-node-001',
      }),
    )
  })

  it('hides the detail entry when the control node does not expose stable report context', async () => {
    mockGetReportDetail.mockResolvedValue({
      sections: [
        {
          l1Code: 'IT01',
          l1Name: '身份安全',
          l2Sections: [
            {
              l2Code: 'IT01-01',
              l2Name: '账户治理',
              controls: [
                {
                  controlId: null,
                  controlCode: 'CTRL-001',
                  controlName: '账号权限最小化',
                  currentStatus: 'PARTIAL',
                  gapLevel: 'HIGH',
                  clauses: [],
                  cases: [],
                  evidences: [],
                  recommendations: [],
                  matchedControls: [],
                  sourceModule: 'report',
                  sourceRecordId: 'report-node-002',
                  sourceRoute: '/reports/11111111-1111-4111-8111-111111111111',
                },
              ],
            },
          ],
        },
      ],
    })

    render(<ControlReportPage />)

    await waitFor(() => {
      expect(screen.getByText('账号权限最小化')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: '查看详情' })).not.toBeInTheDocument()
    expect(mockControlDetailDrawer).not.toHaveBeenCalled()
  })

  it('creates a report pdf job from the detail page', async () => {
    mockGetReportDetail.mockResolvedValue({
      sections: [],
    })
    mockCreateReportPdfJob.mockResolvedValue({
      pdfJobId: 'pdf-job-1',
      reportId: '11111111-1111-4111-8111-111111111111',
      status: 'queued',
      fileName: null,
      fileSizeBytes: null,
      downloadUrl: null,
      errorSummary: null,
      expiresAt: '2026-04-29T00:00:00.000Z',
      startedAt: null,
      completedAt: null,
      failedAt: null,
      createdAt: '2026-03-30T09:00:00.000Z',
      updatedAt: '2026-03-30T09:00:00.000Z',
    })

    render(<ControlReportPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '生成 PDF' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '生成 PDF' }))

    await waitFor(() => {
      expect(mockCreateReportPdfJob).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111')
    })
    expect(screen.getByText('PDF 排队中')).toBeInTheDocument()
  })

  it('downloads the latest ready pdf job', async () => {
    mockGetReportDetail.mockResolvedValue({
      sections: [],
    })
    mockGetLatestReportPdfJob.mockResolvedValue({
      pdfJobId: 'pdf-job-1',
      reportId: '11111111-1111-4111-8111-111111111111',
      status: 'ready',
      fileName: 'control-report.pdf',
      fileSizeBytes: 128,
      downloadUrl:
        '/compliance-intelligence/report-center/11111111-1111-4111-8111-111111111111/pdf-jobs/pdf-job-1/download',
      errorSummary: null,
      expiresAt: '2026-04-29T00:00:00.000Z',
      startedAt: '2026-03-30T09:00:02.000Z',
      completedAt: '2026-03-30T09:00:12.000Z',
      failedAt: null,
      createdAt: '2026-03-30T09:00:00.000Z',
      updatedAt: '2026-03-30T09:00:12.000Z',
    })

    render(<ControlReportPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '下载 PDF' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '下载 PDF' }))

    await waitFor(() => {
      expect(mockDownloadReportPdf).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        'pdf-job-1',
      )
    })
  })

  it('shows stale errors from pdf generation requests', async () => {
    mockGetReportDetail.mockResolvedValue({
      sections: [],
    })
    mockCreateReportPdfJob.mockRejectedValue(new Error('报告数据已过期，请先重新生成报告'))

    render(<ControlReportPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '生成 PDF' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '生成 PDF' }))

    await waitFor(() => {
      expect(screen.getByText('报告数据已过期，请先重新生成报告')).toBeInTheDocument()
    })
  })
})
