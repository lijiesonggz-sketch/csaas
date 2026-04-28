import * as React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import KnowledgeGraphPage from './page'

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
    ) : null
)

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}))

jest.mock('@/components/ui/tabs', () => {
  const TabsContext = React.createContext({
    value: '',
    onValueChange: () => {},
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

  function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
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
  getTaxonomyGovernanceSummary: jest.fn(),
  importTaxonomyRuntimeProfile: jest.fn(),
  exportTaxonomyRuntimeProfile: jest.fn(),
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
const mockKnowledgeGraphApi = jest.requireMock('@/lib/api/knowledge-graph') as {
  getTaxonomyTree: jest.Mock
  getReasoningChain: jest.Mock
  listRegulationSources: jest.Mock
  getRegulationGraph: jest.Mock
  getTaxonomyGovernanceSummary: jest.Mock
  importTaxonomyRuntimeProfile: jest.Mock
  exportTaxonomyRuntimeProfile: jest.Mock
}

const mockTree = [
  {
    l1Code: 'IT01',
    l1Name: '战略与治理',
    children: [{ l2Code: 'IT01-01', l2Name: 'IT战略规划', failureModeCount: 2 }],
  },
]

const mockRegulationSources = {
  items: [],
  total: 0,
  page: 1,
  limit: 100,
}

const governanceSummaryV1 = {
  generatedAt: '2026-04-28T02:00:00.000Z',
  sourceVersion: '2026-04-28-governance-v1',
  domains: [
    {
      l1Code: 'IT01',
      l1Name: '战略与治理',
      catalogL2Count: 2,
      runtimeProfileCount: 2,
      rulebookEntryCount: 2,
      mappingSourceVersion: '2026-04-28-governance-v1',
      rulebookVersion: 'it01-rulebook-v2',
      fallbackBucket: 'IT01-01',
      readinessStage: 'runtime-classifier-ready',
    },
  ],
}

const governanceSummaryV2 = {
  ...governanceSummaryV1,
  sourceVersion: '2026-04-29-governance-v2',
  domains: governanceSummaryV1.domains.map((domain) => ({
    ...domain,
    mappingSourceVersion: '2026-04-29-governance-v2',
  })),
}

describe('KnowledgeGraphPage governance red-phase scaffolds', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDrawer.mockClear()

    mockUseSession.mockReturnValue({
      data: { user: { id: 'admin-1', role: 'admin' } },
      status: 'authenticated',
    })

    mockKnowledgeGraphApi.getTaxonomyTree.mockResolvedValue(mockTree)
    mockKnowledgeGraphApi.getReasoningChain.mockResolvedValue(null)
    mockKnowledgeGraphApi.listRegulationSources.mockResolvedValue(mockRegulationSources)
    mockKnowledgeGraphApi.getRegulationGraph.mockResolvedValue(null)
    mockKnowledgeGraphApi.getTaxonomyGovernanceSummary.mockResolvedValue(governanceSummaryV1)
    mockKnowledgeGraphApi.importTaxonomyRuntimeProfile.mockResolvedValue({
      sourceVersion: '2026-04-29-governance-v2',
      importedRowCount: 2,
      cacheRefreshed: true,
      replacedSnapshot: true,
    })
    mockKnowledgeGraphApi.exportTaxonomyRuntimeProfile.mockResolvedValue(undefined)
  })

  test('[P1] governance tab should lazy-load taxonomy governance summary when selected', async () => {
    render(<KnowledgeGraphPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '知识图谱总览' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'taxonomy 治理' }))

    await waitFor(() => {
      expect(mockKnowledgeGraphApi.getTaxonomyGovernanceSummary).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('heading', { name: '治理概览' })).toBeInTheDocument()
      expect(screen.getAllByText('2026-04-28-governance-v1').length).toBeGreaterThan(0)
    })
  })

  test('[P1] governance tab should render read-only rulebook summary and change-path callouts', async () => {
    render(<KnowledgeGraphPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '知识图谱总览' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'taxonomy 治理' }))

    await waitFor(() => {
      expect(screen.getByText('Rulebook 覆盖摘要')).toBeInTheDocument()
      expect(screen.getAllByText('it01-rulebook-v2').length).toBeGreaterThan(0)
      expect(
        screen.getByText('仅表示治理可见性，不表示所有 L2 都必须 100% rulebook 化。')
      ).toBeInTheDocument()
      expect(screen.getByText('Catalog 变更路径')).toBeInTheDocument()
      expect(screen.getByText('Runtime Profile 变更路径')).toBeInTheDocument()
      expect(screen.getByText('Rulebook 变更路径')).toBeInTheDocument()
    })
  })

  test('[P1] governance export action should call export API helper', async () => {
    render(<KnowledgeGraphPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '知识图谱总览' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'taxonomy 治理' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '导出 Runtime Profile' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '导出 Runtime Profile' }))

    await waitFor(() => {
      expect(mockKnowledgeGraphApi.exportTaxonomyRuntimeProfile).toHaveBeenCalledTimes(1)
    })
  })

  test('[P1] governance export failure should surface an actionable error message', async () => {
    mockKnowledgeGraphApi.exportTaxonomyRuntimeProfile.mockRejectedValue(
      new Error('导出 Runtime Profile 失败')
    )

    render(<KnowledgeGraphPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '知识图谱总览' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'taxonomy 治理' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '导出 Runtime Profile' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '导出 Runtime Profile' }))

    await waitFor(() => {
      expect(screen.getAllByText('导出 Runtime Profile 失败').length).toBeGreaterThan(0)
    })
  })

  test('[P1] governance tab should not retry summary loading forever after the first failure', async () => {
    mockKnowledgeGraphApi.getTaxonomyGovernanceSummary.mockRejectedValue(
      new Error('治理摘要请求失败')
    )

    render(<KnowledgeGraphPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '知识图谱总览' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'taxonomy 治理' }))

    await waitFor(() => {
      expect(screen.getAllByText('治理摘要请求失败').length).toBeGreaterThan(0)
      expect(mockKnowledgeGraphApi.getTaxonomyGovernanceSummary).toHaveBeenCalledTimes(1)
    })
  })

  test('[P1] governance tab should retry summary loading when the user leaves and re-enters after an initial failure', async () => {
    mockKnowledgeGraphApi.getTaxonomyGovernanceSummary
      .mockRejectedValueOnce(new Error('治理摘要请求失败'))
      .mockResolvedValueOnce(governanceSummaryV1)

    render(<KnowledgeGraphPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '知识图谱总览' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'taxonomy 治理' }))

    await waitFor(() => {
      expect(screen.getAllByText('治理摘要请求失败').length).toBeGreaterThan(0)
      expect(mockKnowledgeGraphApi.getTaxonomyGovernanceSummary).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole('tab', { name: '案例驱动线' }))
    fireEvent.click(screen.getByRole('tab', { name: 'taxonomy 治理' }))

    await waitFor(() => {
      expect(mockKnowledgeGraphApi.getTaxonomyGovernanceSummary).toHaveBeenCalledTimes(2)
      expect(screen.getAllByText('2026-04-28-governance-v1').length).toBeGreaterThan(0)
    })
  })

  test('[P1] governance import success should refetch summary and surface the updated sourceVersion', async () => {
    mockKnowledgeGraphApi.getTaxonomyGovernanceSummary
      .mockResolvedValueOnce(governanceSummaryV1)
      .mockResolvedValueOnce(governanceSummaryV2)

    render(<KnowledgeGraphPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '知识图谱总览' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'taxonomy 治理' }))

    await waitFor(() => {
      expect(screen.getAllByText('2026-04-28-governance-v1').length).toBeGreaterThan(0)
    })

    const file = new File(
      [
        '\uFEFF一级编码,一级类型,二级编码,二级子类型,定义口径,建议canonicalTheme,建议aliases,建议keywords\n' +
          'IT01,战略与治理,IT01-01,IT战略规划,定义战略治理范围,IT战略规划,战略规划|治理蓝图,战略|规划',
      ],
      'runtime-profile.csv',
      { type: 'text/csv' }
    )

    fireEvent.click(screen.getByRole('button', { name: '导入 Runtime Profile' }))
    fireEvent.change(screen.getByLabelText('sourceVersion'), {
      target: { value: '2026-04-29-governance-v2' },
    })
    fireEvent.change(screen.getByLabelText('上传 Runtime Profile CSV'), {
      target: { files: [file] },
    })
    fireEvent.click(screen.getByRole('button', { name: '确认导入 Runtime Profile' }))

    await waitFor(() => {
      expect(mockKnowledgeGraphApi.importTaxonomyRuntimeProfile).toHaveBeenCalledTimes(1)
      expect(mockKnowledgeGraphApi.getTaxonomyGovernanceSummary).toHaveBeenCalledTimes(2)
      expect(screen.getAllByText('2026-04-29-governance-v2').length).toBeGreaterThan(0)
    })
  })

  test('[P1] governance import should keep success state but clear stale summary when refetch fails', async () => {
    mockKnowledgeGraphApi.getTaxonomyGovernanceSummary
      .mockResolvedValueOnce(governanceSummaryV1)
      .mockRejectedValueOnce(new Error('summary refresh boom'))

    render(<KnowledgeGraphPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '知识图谱总览' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'taxonomy 治理' }))

    await waitFor(() => {
      expect(screen.getAllByText('2026-04-28-governance-v1').length).toBeGreaterThan(0)
    })

    const file = new File(
      [
        '\uFEFF一级编码,一级类型,二级编码,二级子类型,定义口径,建议canonicalTheme,建议aliases,建议keywords\n' +
          'IT01,战略与治理,IT01-01,IT战略规划,定义战略治理范围,IT战略规划,战略规划|治理蓝图,战略|规划',
      ],
      'runtime-profile.csv',
      { type: 'text/csv' }
    )

    fireEvent.click(screen.getByRole('button', { name: '导入 Runtime Profile' }))
    fireEvent.change(screen.getByLabelText('sourceVersion'), {
      target: { value: '2026-04-29-governance-v2' },
    })
    fireEvent.change(screen.getByLabelText('上传 Runtime Profile CSV'), {
      target: { files: [file] },
    })
    fireEvent.click(screen.getByRole('button', { name: '确认导入 Runtime Profile' }))

    await waitFor(() => {
      expect(mockKnowledgeGraphApi.importTaxonomyRuntimeProfile).toHaveBeenCalledTimes(1)
      expect(screen.getByText('导入成功：2 行，版本 2026-04-29-governance-v2')).toBeInTheDocument()
      expect(
        screen.getAllByText('导入成功，但治理摘要刷新失败，请点击刷新重试：summary refresh boom')
          .length
      ).toBeGreaterThan(0)
      expect(screen.getByText('暂无治理摘要数据')).toBeInTheDocument()
    })
  })
})
