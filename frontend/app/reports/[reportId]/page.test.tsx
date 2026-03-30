import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ControlReportPage from './page'
import { useParams } from 'next/navigation'
import { getReportDetail } from '@/lib/api/report-center'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
}))

jest.mock('@/lib/api/report-center', () => ({
  getReportDetail: jest.fn(),
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

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useParams as jest.Mock).mockReturnValue({
      reportId: '11111111-1111-4111-8111-111111111111',
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
    expect(screen.getByText('补齐权限复核流程')).toBeInTheDocument()
    expect(screen.getByText('建立每季度权限复核记录')).toBeInTheDocument()
    expect(screen.getByText(/降低超权访问风险/)).toBeInTheDocument()
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
      expect(screen.getByRole('button', { name: '查看详情' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '查看详情' }))

    expect(screen.getByTestId('report-control-detail-drawer')).toBeInTheDocument()
    expect(mockControlDetailDrawer).toHaveBeenCalledWith(
      expect.objectContaining({
        controlId: 'control-1',
        sourceModule: 'report',
        sourceRecordId: '11111111-1111-4111-8111-111111111111',
      }),
    )
  })
})
