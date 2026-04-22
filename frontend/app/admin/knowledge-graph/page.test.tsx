import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import KnowledgeGraphPage from './page'
import {
  getReasoningChain,
  getRegulationGraph,
  getTaxonomyTree,
  listRegulationSources,
  type ReasoningChainData,
  type RegulationGraphData,
  type RegulationSourcePage,
  type TaxonomyTreeL1,
} from '@/lib/api/knowledge-graph'

const mockPush = jest.fn()
const mockDrawer = jest.fn(
  (props: { open: boolean; controlId: string; sourceModule: string; sourceRecordId?: string }) =>
    props.open ? (
      <div
        data-testid="control-detail-drawer-probe"
        data-control-id={props.controlId}
        data-source-module={props.sourceModule}
        data-source-record-id={props.sourceRecordId}
      />
    ) : null,
)

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}))

jest.mock('@/components/ui/tabs', () => {
  const React = require('react')
  const TabsContext = React.createContext({
    value: '',
    onValueChange: (_value: string) => {},
  })

  function Tabs({
    value,
    onValueChange,
    children,
  }: {
    value: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
  }) {
    return (
      <TabsContext.Provider value={{ value, onValueChange: onValueChange ?? (() => {}) }}>
        <div>{children}</div>
      </TabsContext.Provider>
    )
  }

  function TabsList({ children }: { children: React.ReactNode }) {
    return <div role="tablist">{children}</div>
  }

  function TabsTrigger({
    value,
    children,
  }: {
    value: string
    children: React.ReactNode
  }) {
    const ctx = React.useContext(TabsContext)
    const selected = ctx.value === value
    return (
      <button
        type="button"
        role="tab"
        aria-selected={selected}
        onClick={() => ctx.onValueChange(value)}
      >
        {children}
      </button>
    )
  }

  return { Tabs, TabsList, TabsTrigger }
})

jest.mock('@/lib/api/knowledge-graph', () => ({
  getTaxonomyTree: jest.fn(),
  getReasoningChain: jest.fn(),
  listRegulationSources: jest.fn(),
  getRegulationGraph: jest.fn(),
}))
jest.mock('@/components/compliance/ControlDetailDrawer', () => ({
  ControlDetailDrawer: (props: {
    open: boolean
    controlId: string
    sourceModule: string
    sourceRecordId?: string
  }) => mockDrawer(props),
}))

const mockUseSession = useSession as jest.Mock
const mockGetTaxonomyTree = getTaxonomyTree as jest.MockedFunction<typeof getTaxonomyTree>
const mockGetReasoningChain = getReasoningChain as jest.MockedFunction<typeof getReasoningChain>
const mockListRegulationSources = listRegulationSources as jest.MockedFunction<typeof listRegulationSources>
const mockGetRegulationGraph = getRegulationGraph as jest.MockedFunction<typeof getRegulationGraph>

const mockTree: TaxonomyTreeL1[] = [
  {
    l1Code: 'IT01',
    l1Name: '战略与治理',
    children: [
      { l2Code: 'IT01-01', l2Name: 'IT战略规划', failureModeCount: 2 },
      { l2Code: 'IT01-02', l2Name: 'IT治理架构', failureModeCount: 1 },
    ],
  },
  {
    l1Code: 'IT02',
    l1Name: '数据管理',
    children: [{ l2Code: 'IT02-01', l2Name: '数据质量管理', failureModeCount: 1 }],
  },
]

const mockChain: ReasoningChainData = {
  taxonomy: {
    l1Code: 'IT01',
    l1Name: '战略与治理',
    l2Code: 'IT01-01',
    l2Name: 'IT战略规划',
  },
  failureModes: [
    {
      failureModeId: 'fm-1',
      failureModeCode: 'FM-001',
      name: '战略与业务不一致',
      category: 'DEFINITION_ERROR',
      controlPointCount: 1,
    },
  ],
  controlPoints: [
    {
      controlId: 'cp-1',
      controlCode: 'CP-001',
      controlName: '战略规划流程',
      maturityLevel: 'hard',
      authoritativeScore: 0.95,
      originType: 'standard',
      failureModeRelevance: 'PRIMARY',
      failureModeId: 'fm-1',
    },
  ],
  obligations: [
    {
      obligationId: 'ob-1',
      obligationCode: 'OBL-001',
      obligationText: '应当建立 IT 战略规划流程',
      obligationType: 'MANDATORY',
      controlId: 'cp-1',
      coverage: 'FULL',
    },
  ],
}

const mockRegulationSources: RegulationSourcePage = {
  items: [
    {
      sourceId: 'source-1',
      sourceCode: 'SRC-001',
      sourceName: '监管数据报送管理指引',
      sourceLevel: 'guideline',
      authorityName: '监管机构',
    },
  ],
  total: 1,
  page: 1,
  limit: 100,
}

const mockRegulationGraph: RegulationGraphData = {
  source: {
    sourceId: 'source-1',
    sourceCode: 'SRC-001',
    sourceName: '监管数据报送管理指引',
    sourceLevel: 'guideline',
    authorityName: '监管机构',
    clauseCount: 1,
    obligationCount: 1,
    controlPointCount: 1,
  },
  clauses: [
    {
      clauseId: 'clause-1',
      clauseCode: 'CLAUSE-001',
      articleNo: '4.1',
      sectionPath: '第四条/第一款',
      clauseText: '应当建立监管报送复核机制',
      clauseSummary: '建立复核机制',
      mandatoryLevel: 'MUST',
      obligationCount: 1,
      controlPointCount: 1,
    },
  ],
  obligations: [
    {
      obligationId: 'ob-1',
      obligationCode: 'OBL-001',
      obligationText: '应当建立监管报送复核机制',
      obligationType: 'MANDATORY',
      applicableSector: ['银行'],
      clauseId: 'clause-1',
      clauseCode: 'CLAUSE-001',
      clauseSummary: '建立复核机制',
      controlPointCount: 1,
    },
  ],
  controlPoints: [
    {
      edgeId: 'clause-1:ob-1:cp-1',
      controlId: 'cp-1',
      controlCode: 'CP-001',
      controlName: '监管报送复核控制',
      maturityLevel: 'hard',
      authoritativeScore: 0.92,
      originType: 'regulation_derived',
      applicableSector: ['银行'],
      coverage: 'FULL',
      obligationId: 'ob-1',
      obligationCode: 'OBL-001',
      clauseId: 'clause-1',
      clauseCode: 'CLAUSE-001',
    },
  ],
}

describe('KnowledgeGraphPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()
    mockDrawer.mockClear()
    mockUseSession.mockReturnValue({
      data: { user: { id: 'admin-1', role: 'admin' } },
      status: 'authenticated',
    })
    mockGetTaxonomyTree.mockResolvedValue(mockTree)
    mockGetReasoningChain.mockResolvedValue(mockChain)
    mockListRegulationSources.mockResolvedValue(mockRegulationSources)
    mockGetRegulationGraph.mockResolvedValue(mockRegulationGraph)
  })

  it('[P0] session loading 时显示全屏加载态', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'loading',
    })

    render(<KnowledgeGraphPage />)

    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('[P1] 未认证时跳转到登录页', async () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })

    render(<KnowledgeGraphPage />)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })

  it('[P0] 非管理员显示无权访问提示', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 'consultant-1', role: 'consultant' } },
      status: 'authenticated',
    })

    render(<KnowledgeGraphPage />)

    expect(screen.getByText('无权访问知识图谱总览')).toBeInTheDocument()
    expect(mockGetTaxonomyTree).not.toHaveBeenCalled()
    expect(mockListRegulationSources).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '返回管理后台' }))
    expect(mockPush).toHaveBeenCalledWith('/admin/dashboard')
  })

  it('[P0] 管理员进入页面时加载并显示 IT 分类树', async () => {
    render(<KnowledgeGraphPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '知识图谱总览' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /IT01.*战略与治理/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /IT02.*数据管理/ })).toBeInTheDocument()
    })

    expect(mockGetTaxonomyTree).toHaveBeenCalledTimes(1)
    expect(mockListRegulationSources).toHaveBeenCalledTimes(1)
    expect(mockGetReasoningChain).not.toHaveBeenCalled()
  })

  it('[P0] 选择 L2 节点后加载推理链路并联动详情面板', async () => {
    render(<KnowledgeGraphPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /IT01.*战略与治理/ })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /IT01.*战略与治理/ }))
    fireEvent.click(screen.getByRole('button', { name: /IT战略规划/ }))

    await waitFor(() => {
      expect(mockGetReasoningChain).toHaveBeenCalledWith('IT01-01')
      expect(screen.getByText('FM-001')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /失效模式 FM-001/ }))

    expect(screen.getByText('失效模式详情')).toBeInTheDocument()
    expect(screen.getAllByText('战略与业务不一致').length).toBeGreaterThan(1)
    expect(screen.getByText('关联合规义务')).toBeInTheDocument()
    expect(screen.getAllByText('OBL-001').length).toBeGreaterThan(0)
  })

  it('[P0] 点击控制点卡片时打开共享控制点详情 drawer', async () => {
    render(<KnowledgeGraphPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /IT01.*战略与治理/ })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /IT01.*战略与治理/ }))
    fireEvent.click(screen.getByRole('button', { name: /IT战略规划/ }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /控制点 CP-001/ })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /控制点 CP-001/ }))

    await waitFor(() =>
      expect(screen.getByTestId('control-detail-drawer-probe')).toHaveAttribute(
        'data-control-id',
        'cp-1',
      ),
    )
    expect(screen.getByTestId('control-detail-drawer-probe')).toHaveAttribute(
      'data-source-module',
      'admin',
    )
  })

  it('[P1] 搜索输入经过 300ms debounce 后过滤分类树', async () => {
    jest.useFakeTimers()
    render(<KnowledgeGraphPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /IT01.*战略与治理/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /IT02.*数据管理/ })).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('搜索知识图谱'), {
      target: { value: '战略' },
    })

    expect(screen.getByRole('button', { name: /IT02.*数据管理/ })).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /IT02.*数据管理/ })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /战略.*治理/ })).toBeInTheDocument()
    })
  })

  it('[P0] 切换到法规驱动线时加载真实图谱并联动详情', async () => {
    render(<KnowledgeGraphPage />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '法规驱动线' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: '法规驱动线' }))

    await waitFor(() => {
      expect(mockGetRegulationGraph).toHaveBeenCalledWith('source-1')
      expect(screen.getAllByText('监管数据报送管理指引').length).toBeGreaterThan(1)
      expect(screen.getByRole('button', { name: /法规条文 CLAUSE-001/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /法规义务 OBL-001/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /控制点 CP-001/ })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /法规义务 OBL-001/ }))

    expect(screen.getByText('法规义务详情')).toBeInTheDocument()
    expect(screen.getAllByText('应当建立监管报送复核机制').length).toBeGreaterThan(1)
  })

  it('[P1] taxonomy 加载失败时显示错误提示', async () => {
    mockGetTaxonomyTree.mockRejectedValue(new Error('加载 IT 分类树失败'))

    render(<KnowledgeGraphPage />)

    await waitFor(() => {
      expect(screen.getByText('加载 IT 分类树失败')).toBeInTheDocument()
    })
  })

  it('[P1] reasoning chain 加载失败时显示错误提示', async () => {
    mockGetReasoningChain.mockRejectedValue(new Error('推理链路加载失败'))

    render(<KnowledgeGraphPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /IT01.*战略与治理/ })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /IT01.*战略与治理/ }))
    fireEvent.click(screen.getByRole('button', { name: /IT战略规划/ }))

    await waitFor(() => {
      expect(screen.getByText('推理链路加载失败')).toBeInTheDocument()
    })
  })

  it('[P1] regulation graph 加载失败时显示错误提示', async () => {
    mockGetRegulationGraph.mockRejectedValue(new Error('法规驱动线加载失败'))

    render(<KnowledgeGraphPage />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '法规驱动线' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: '法规驱动线' }))

    await waitFor(() => {
      expect(screen.getByText('法规驱动线加载失败')).toBeInTheDocument()
    })
  })
})
