import * as React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ObligationCoverageAnalysisPage from './page'
import * as obligationsApi from '@/lib/api/obligations'

const mockPush = jest.fn()
const mockUseSession = jest.fn(() => ({
  data: { user: { id: 'user-1', role: 'admin' } },
  status: 'authenticated',
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}))

jest.mock('@/components/ui/select', () => {
  type SelectItemData = { value: string; children: React.ReactNode }
  const collectItems = (children: React.ReactNode): SelectItemData[] => {
    const items: SelectItemData[] = []
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return
      if (child.type === SelectItem) {
        items.push({ value: child.props.value, children: child.props.children })
      } else if ('children' in child.props && child.props.children) {
        items.push(...collectItems(child.props.children))
      }
    })
    return items
  }
  const Select = ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode
    value?: string
    onValueChange?: (value: string) => void
  }) => {
    const items = collectItems(children)
    return (
      <select value={value} onChange={(event) => onValueChange?.(event.target.value)}>
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.children}
          </option>
        ))}
      </select>
    )
  }
  const SelectContent = ({ children }: { children: React.ReactNode }) => <>{children}</>
  const SelectItem = ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  )
  const SelectTrigger = ({
    children,
    'aria-label': ariaLabel,
  }: {
    children: React.ReactNode
    'aria-label'?: string
  }) => <label aria-label={ariaLabel}>{children}</label>
  const SelectValue = () => null
  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
})

jest.mock('recharts', () => {
  const ReactLib = require('react')
  const Container = ({ children }: { children: React.ReactNode }) => (
    <div className="recharts-responsive-container">{children}</div>
  )
  const Chart = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return {
    ResponsiveContainer: Container,
    PieChart: Chart,
    Pie: Chart,
    Cell: () => null,
    BarChart: Chart,
    Bar: Chart,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
  }
})

jest.mock('@/lib/api/obligations')

const mockGetObligationCoverageAnalysis = obligationsApi.getObligationCoverageAnalysis as jest.MockedFunction<
  typeof obligationsApi.getObligationCoverageAnalysis
>

const coverageAnalysisResponse: obligationsApi.ObligationCoverageAnalysis = {
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
}

describe('ObligationCoverageAnalysisPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPush.mockReset()
    mockUseSession.mockReturnValue({
      data: { user: { id: 'user-1', role: 'admin' } },
      status: 'authenticated',
    })
    mockGetObligationCoverageAnalysis.mockResolvedValue(coverageAnalysisResponse)
  })

  it('renders summary cards, charts, and blind spot table', async () => {
    const { container } = render(<ObligationCoverageAnalysisPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '覆盖率分析' })).toBeInTheDocument()
      expect(screen.getByText('总义务数')).toBeInTheDocument()
      expect(screen.getByText('来源分析')).toBeInTheDocument()
      expect(screen.getByText('行业覆盖')).toBeInTheDocument()
      expect(screen.getByText('合规盲区')).toBeInTheDocument()
      expect(screen.getByText('OBL-IT04-4.1-02')).toBeInTheDocument()
    })

    expect(container.querySelectorAll('.recharts-responsive-container').length).toBeGreaterThan(0)
  })

  it('refreshes coverage data when the refresh button is clicked', async () => {
    render(<ObligationCoverageAnalysisPage />)

    await waitFor(() => expect(mockGetObligationCoverageAnalysis).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: '刷新' }))
    await waitFor(() => expect(mockGetObligationCoverageAnalysis).toHaveBeenCalledTimes(2))
  })

  it('filters blind spots by obligation type, applicable sector, and drill-down sector', async () => {
    render(<ObligationCoverageAnalysisPage />)

    await waitFor(() => expect(screen.getByText('OBL-IT04-4.1-02')).toBeInTheDocument())
    fireEvent.change(screen.getAllByRole('combobox')[0], {
      target: { value: 'MANDATORY' },
    })
    fireEvent.change(screen.getAllByRole('combobox')[1], {
      target: { value: '银行' },
    })
    fireEvent.click(screen.getByRole('button', { name: '银行' }))

    expect(screen.getByText('OBL-IT04-4.1-02')).toBeInTheDocument()
    expect(screen.queryByText('OBL-IT04-6.3-01')).not.toBeInTheDocument()
  })

  it('navigates to obligation detail when a blind spot row is clicked', async () => {
    render(<ObligationCoverageAnalysisPage />)

    await waitFor(() => expect(screen.getByText('OBL-IT04-4.1-02')).toBeInTheDocument())
    fireEvent.click(screen.getByText('OBL-IT04-4.1-02'))

    expect(mockPush).toHaveBeenCalledWith('/admin/obligations?obligationId=obl-1')
  })

  it('shows a stable forbidden state for non-admin users', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 'user-2', role: 'consultant' } },
      status: 'authenticated',
    })

    render(<ObligationCoverageAnalysisPage />)

    expect(screen.getByText('无权访问覆盖率分析')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '返回管理后台' }))
    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })

  it('shows a stable all-covered state when there are no blind spots', async () => {
    mockGetObligationCoverageAnalysis.mockResolvedValue({
      ...coverageAnalysisResponse,
      totals: {
        obligations: 4,
        covered: 4,
        uncovered: 0,
        coverageRate: 1,
      },
      blindSpots: [],
    })

    render(<ObligationCoverageAnalysisPage />)

    await waitFor(() => expect(screen.getAllByText('100%').length).toBeGreaterThan(0))
    expect(screen.getByText('当前没有未覆盖义务，看板进入全覆盖状态。')).toBeInTheDocument()
    expect(screen.getByText('当前筛选条件下没有未覆盖义务。')).toBeInTheDocument()
  })

  it('shows a stable error state when the coverage-analysis request fails', async () => {
    mockGetObligationCoverageAnalysis.mockRejectedValue(new Error('coverage-analysis failed'))

    render(<ObligationCoverageAnalysisPage />)

    await waitFor(() =>
      expect(screen.getByText('coverage-analysis failed')).toBeInTheDocument(),
    )
  })

  it('shows placeholder when there are zero obligations', async () => {
    mockGetObligationCoverageAnalysis.mockResolvedValue({
      totals: { obligations: 0, covered: 0, uncovered: 0, coverageRate: 0 },
      originDistribution: { case_derived: 0, regulation_derived: 0, both: 0, candidate: 0, manual: 0 },
      sectorCoverage: [
        { sector: '银行', obligations: 0, covered: 0, coverageRate: 0 },
        { sector: '证券', obligations: 0, covered: 0, coverageRate: 0 },
        { sector: '保险', obligations: 0, covered: 0, coverageRate: 0 },
        { sector: '基金', obligations: 0, covered: 0, coverageRate: 0 },
        { sector: '期货', obligations: 0, covered: 0, coverageRate: 0 },
      ],
      blindSpots: [],
    })

    render(<ObligationCoverageAnalysisPage />)

    await waitFor(() => {
      expect(screen.getByText('暂无义务数据，无法生成覆盖率图表。')).toBeInTheDocument()
    })
    expect(screen.getByText('当前没有未覆盖义务，看板进入全覆盖状态。')).toBeInTheDocument()
  })

  it('shows empty blind spots message when filter yields no results', async () => {
    render(<ObligationCoverageAnalysisPage />)

    await waitFor(() => expect(screen.getByText('OBL-IT04-4.1-02')).toBeInTheDocument())
    fireEvent.change(screen.getAllByRole('combobox')[0], {
      target: { value: 'RECOMMENDED' },
    })

    expect(screen.getByText('当前筛选条件下没有未覆盖义务。')).toBeInTheDocument()
  })
})
