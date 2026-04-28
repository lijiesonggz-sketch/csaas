import * as React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import ControlPointAdminPage from './page'
import * as controlPointsApi from '@/lib/api/control-points'
import * as knowledgeGraphApi from '@/lib/api/knowledge-graph'
import * as complianceIntelligenceApi from '@/lib/api/compliance-intelligence'
import * as failureModesApi from '@/lib/api/failure-modes'

const mockPush = jest.fn()
const mockUseSession = jest.fn(() => ({
  data: { user: { id: 'user-1', role: 'admin' } },
  status: 'authenticated',
}))
let mockControlIdParam: string | null = null

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'controlId' ? mockControlIdParam : null),
  }),
}))
jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))
jest.mock('@/components/ui/tabs', () => {
  const TabsContext = React.createContext<{
    value: string
    onValueChange?: (value: string) => void
  }>({ value: '' })

  const Tabs = ({
    value,
    onValueChange,
    children,
  }: {
    value: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
  }) => <TabsContext.Provider value={{ value, onValueChange }}>{children}</TabsContext.Provider>

  const TabsList = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  const TabsTrigger = ({ value, children }: { value: string; children: React.ReactNode }) => {
    const context = React.useContext(TabsContext)
    return <button onClick={() => context.onValueChange?.(value)}>{children}</button>
  }
  const TabsContent = ({ value, children }: { value: string; children: React.ReactNode }) => {
    const context = React.useContext(TabsContext)
    return context.value === value ? <div>{children}</div> : null
  }

  return { Tabs, TabsList, TabsTrigger, TabsContent }
})
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
  const SelectTrigger = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  const SelectValue = () => null
  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
})

jest.mock('@/lib/api/control-points')
jest.mock('@/lib/api/knowledge-graph')
jest.mock('@/lib/api/compliance-intelligence')
jest.mock('@/lib/api/failure-modes')

const mockListControlPoints = controlPointsApi.listControlPoints as jest.MockedFunction<
  typeof controlPointsApi.listControlPoints
>
const mockGetControlPoint = controlPointsApi.getControlPoint as jest.MockedFunction<
  typeof controlPointsApi.getControlPoint
>
const mockCreateControlPoint = controlPointsApi.createControlPoint as jest.MockedFunction<
  typeof controlPointsApi.createControlPoint
>
const mockCreateControlEvidenceMap =
  controlPointsApi.createControlEvidenceMap as jest.MockedFunction<
    typeof controlPointsApi.createControlEvidenceMap
  >
const mockDeleteControlEvidenceMap =
  controlPointsApi.deleteControlEvidenceMap as jest.MockedFunction<
    typeof controlPointsApi.deleteControlEvidenceMap
  >
const mockGetControlPointEvidences =
  controlPointsApi.getControlPointEvidences as jest.MockedFunction<
    typeof controlPointsApi.getControlPointEvidences
  >
const mockSearchEvidenceTypes = controlPointsApi.searchEvidenceTypes as jest.MockedFunction<
  typeof controlPointsApi.searchEvidenceTypes
>
const mockCreateQuestionItem = controlPointsApi.createQuestionItem as jest.MockedFunction<
  typeof controlPointsApi.createQuestionItem
>
const mockGetControlPointQuestions =
  controlPointsApi.getControlPointQuestions as jest.MockedFunction<
    typeof controlPointsApi.getControlPointQuestions
  >
const mockUpdateQuestionItem = controlPointsApi.updateQuestionItem as jest.MockedFunction<
  typeof controlPointsApi.updateQuestionItem
>
const mockCreateRemediationAction = controlPointsApi.createRemediationAction as jest.MockedFunction<
  typeof controlPointsApi.createRemediationAction
>
const mockGetControlPointRemediations =
  controlPointsApi.getControlPointRemediations as jest.MockedFunction<
    typeof controlPointsApi.getControlPointRemediations
  >
const mockUpdateRemediationAction = controlPointsApi.updateRemediationAction as jest.MockedFunction<
  typeof controlPointsApi.updateRemediationAction
>
const mockCreateControlPackItem = controlPointsApi.createControlPackItem as jest.MockedFunction<
  typeof controlPointsApi.createControlPackItem
>
const mockDeleteControlPackItem = controlPointsApi.deleteControlPackItem as jest.MockedFunction<
  typeof controlPointsApi.deleteControlPackItem
>
const mockGetControlPointPackLinks =
  controlPointsApi.getControlPointPackLinks as jest.MockedFunction<
    typeof controlPointsApi.getControlPointPackLinks
  >
const mockListControlPackCatalog = controlPointsApi.listControlPackCatalog as jest.MockedFunction<
  typeof controlPointsApi.listControlPackCatalog
>
const mockGetControlPointRegulatoryLinks =
  controlPointsApi.getControlPointRegulatoryLinks as jest.MockedFunction<
    typeof controlPointsApi.getControlPointRegulatoryLinks
  >
const mockSearchRegulationClauses = controlPointsApi.searchRegulationClauses as jest.MockedFunction<
  typeof controlPointsApi.searchRegulationClauses
>
const mockCreateClauseControlMap = controlPointsApi.createClauseControlMap as jest.MockedFunction<
  typeof controlPointsApi.createClauseControlMap
>
const mockDeleteClauseControlMap = controlPointsApi.deleteClauseControlMap as jest.MockedFunction<
  typeof controlPointsApi.deleteClauseControlMap
>
const mockUpdateControlPoint = controlPointsApi.updateControlPoint as jest.MockedFunction<
  typeof controlPointsApi.updateControlPoint
>
const mockUpdateControlPointStatus =
  controlPointsApi.updateControlPointStatus as jest.MockedFunction<
    typeof controlPointsApi.updateControlPointStatus
  >
const mockGetTaxonomyTree = knowledgeGraphApi.getTaxonomyTree as jest.MockedFunction<
  typeof knowledgeGraphApi.getTaxonomyTree
>
const mockGetControlExplain = complianceIntelligenceApi.getControlExplain as jest.MockedFunction<
  typeof complianceIntelligenceApi.getControlExplain
>
const mockListFailureModes = failureModesApi.listFailureModes as jest.MockedFunction<
  typeof failureModesApi.listFailureModes
>
const mockedToast = jest.requireMock('sonner').toast as {
  success: jest.Mock
  error: jest.Mock
}

const listItems = [
  {
    controlId: 'cp-1',
    controlCode: 'CTRL-IT04-001',
    controlName: '监管报送复核控制',
    controlDesc: '确保监管报送在提交前完成复核',
    aliases: ['报送复核'],
    keywords: ['监管报送', '复核'],
    canonicalTheme: '监管报送复核',
    l1Code: 'IT04',
    l2Code: 'IT04-01',
    controlFamily: '治理',
    controlType: 'preventive' as const,
    mandatoryDefault: true,
    riskLevelDefault: 'HIGH' as const,
    ownerRoleHint: ['数据治理岗'],
    status: 'ACTIVE' as const,
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-21T00:00:00.000Z',
    originType: 'both' as const,
    maturityLevel: 'hard' as const,
    authoritativeScore: 0.91,
    applicableSector: ['银行', '通用'],
    sectorRequirements: {
      银行: { review_frequency: '季度' },
    },
    authorityProfileJson: {
      has_source_basis: true,
      has_applicability_scope: true,
      has_control_activity: true,
      has_expected_evidence: true,
      has_human_review: true,
      has_case_validation: false,
    },
  },
  {
    controlId: 'cp-2',
    controlCode: 'CTRL-IT04-002',
    controlName: '报送差错纠偏控制',
    controlDesc: '发现差错后触发纠偏流程',
    aliases: [],
    keywords: [],
    canonicalTheme: '差错纠偏',
    l1Code: 'IT04',
    l2Code: 'IT04-01',
    controlFamily: '治理',
    controlType: 'corrective' as const,
    mandatoryDefault: true,
    riskLevelDefault: 'MEDIUM' as const,
    ownerRoleHint: ['合规岗'],
    status: 'ACTIVE' as const,
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-21T00:00:00.000Z',
    originType: 'regulation_derived' as const,
    maturityLevel: 'draft-hard' as const,
    authoritativeScore: 0.72,
    applicableSector: ['银行'],
    sectorRequirements: null,
    authorityProfileJson: null,
  },
]

const controlExplain = {
  control: {
    controlId: 'cp-1',
    controlCode: 'CTRL-IT04-001',
    controlName: '监管报送复核控制',
    controlDesc: '确保监管报送在提交前完成复核',
    l1: { code: 'IT04', name: '数据治理与监管报送' },
    l2: { code: 'IT04-01', name: '监管报送控制' },
  },
  governance: {
    originType: 'both',
    maturityLevel: 'hard',
    authoritativeScore: 0.91,
    authorityProfile: {
      has_source_basis: true,
      has_applicability_scope: true,
      has_control_activity: true,
      has_expected_evidence: true,
      has_human_review: true,
      has_case_validation: false,
    },
    applicableSector: ['银行', '通用'],
    sectorRequirements: {
      银行: { review_frequency: '季度' },
    },
  },
  applicabilityReason: '适用于监管报送高风险场景',
  failureModes: [
    {
      failureModeId: 'fm-1',
      failureModeCode: 'FM-REP-001',
      name: '报送口径定义错误',
      category: 'DEFINITION_ERROR',
      relevance: 'PRIMARY',
    },
  ],
  obligations: [
    {
      obligationId: 'obl-1',
      obligationCode: 'OBL-001',
      obligationText: '应当建立监管报送复核机制',
      obligationType: 'MANDATORY',
      coverage: 'FULL',
      clause: {
        clauseId: 'clause-1',
        clauseCode: 'CLAUSE-001',
        articleNo: '第四条',
      },
    },
  ],
  reasoningChain: null,
  clauses: [],
  cases: [
    {
      caseId: 'case-1',
      caseCode: 'CASE-001',
      caseTitle: '因报送不准被处罚',
      relationType: 'VIOLATES',
      confidenceScore: '0.92',
    },
  ],
  evidences: [],
  questions: [],
  remediations: [],
}

function getRowActionButtons(text: string) {
  const label = screen.getByText(text)
  const row = label.parentElement?.parentElement as HTMLElement
  return within(row).getAllByRole('button')
}

describe('ControlPointAdminPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPush.mockReset()
    mockControlIdParam = null
    mockUseSession.mockReturnValue({
      data: { user: { id: 'user-1', role: 'admin' } },
      status: 'authenticated',
    })
    mockListControlPoints.mockResolvedValue({
      items: listItems,
      total: listItems.length,
      page: 1,
      limit: 100,
    })
    mockGetControlPoint.mockResolvedValue(listItems[0])
    mockCreateControlPoint.mockResolvedValue(listItems[0])
    mockCreateControlEvidenceMap.mockResolvedValue({
      id: 'evidence-map-default',
    })
    mockDeleteControlEvidenceMap.mockResolvedValue({ success: true, id: 'evidence-map-default' })
    mockUpdateControlPoint.mockResolvedValue(listItems[0])
    mockUpdateControlPointStatus.mockResolvedValue({
      ...listItems[0],
      status: 'INACTIVE',
    })
    mockGetTaxonomyTree.mockResolvedValue([
      {
        l1Code: 'IT04',
        l1Name: '数据治理与监管报送',
        children: [{ l2Code: 'IT04-01', l2Name: '监管报送控制', failureModeCount: 2 }],
      },
    ])
    mockGetControlExplain.mockResolvedValue(controlExplain)
    mockGetControlPointEvidences.mockResolvedValue({ controlId: 'cp-1', evidences: [] })
    mockSearchEvidenceTypes.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    })
    mockCreateQuestionItem.mockResolvedValue({
      questionId: 'question-default',
      questionCode: 'Q-DEFAULT',
      questionText: '默认题目',
      questionType: 'SINGLE_CHOICE',
      answerSchema: { expectedAnswer: '是' },
    })
    mockGetControlPointQuestions.mockResolvedValue({ controlId: 'cp-1', questions: [] })
    mockUpdateQuestionItem.mockResolvedValue({
      questionId: 'question-default',
      questionCode: 'Q-DEFAULT',
      questionText: '默认题目',
      questionType: 'SINGLE_CHOICE',
      answerSchema: { expectedAnswer: '是' },
    })
    mockCreateRemediationAction.mockResolvedValue({
      actionId: 'action-default',
      actionCode: 'RA-DEFAULT',
      actionTitle: '默认整改动作',
      actionDesc: '默认整改描述',
      priorityDefault: 'MEDIUM',
      effortLevel: 'MEDIUM',
    })
    mockGetControlPointRemediations.mockResolvedValue({ controlId: 'cp-1', remediations: [] })
    mockUpdateRemediationAction.mockResolvedValue({
      actionId: 'action-default',
      actionCode: 'RA-DEFAULT',
      actionTitle: '默认整改动作',
      actionDesc: '默认整改描述',
      priorityDefault: 'MEDIUM',
      effortLevel: 'MEDIUM',
    })
    mockCreateControlPackItem.mockResolvedValue({
      id: 'pack-link-default',
      packId: 'pack-1',
      packCode: 'PACK-BASE-CYBER',
      packName: '网络安全基线包',
      packType: 'base',
      packVersion: 'stable',
      itemRole: 'INCLUDE',
      priority: 10,
    })
    mockDeleteControlPackItem.mockResolvedValue({ success: true, id: 'pack-link-default' })
    mockGetControlPointPackLinks.mockResolvedValue({ controlId: 'cp-1', items: [] })
    mockListControlPackCatalog.mockResolvedValue([])
    mockGetControlPointRegulatoryLinks.mockResolvedValue({
      controlId: 'cp-1',
      clauses: [],
      obligations: [],
      cases: [],
    })
    mockSearchRegulationClauses.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    })
    mockCreateClauseControlMap.mockResolvedValue({
      id: 'clause-map-default',
      controlId: 'cp-1',
      clauseId: 'clause-1',
      mappingType: 'direct',
      reviewStatus: 'PENDING',
    })
    mockDeleteClauseControlMap.mockResolvedValue({ success: true, id: 'clause-map-default' })
    mockListFailureModes.mockResolvedValue({
      items: [
        {
          failureModeId: 'fm-1',
          failureModeCode: 'FM-REP-001',
          name: '报送口径定义错误',
          description: '',
          category: 'DEFINITION_ERROR',
          status: 'ACTIVE',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    })
    mockedToast.success.mockReset()
    mockedToast.error.mockReset()
  })

  it('renders the control list and detail panel', async () => {
    render(<ControlPointAdminPage />)

    await waitFor(() => {
      expect(screen.getByTestId('control-points-list-panel')).toBeInTheDocument()
      expect(screen.getByTestId('control-points-detail-panel')).toBeInTheDocument()
      expect(screen.getAllByText('CTRL-IT04-001').length).toBeGreaterThan(0)
      expect(screen.getAllByText('监管报送复核控制').length).toBeGreaterThan(0)
      expect(screen.getByText('报送口径定义错误')).toBeInTheDocument()
      expect(screen.getByText('应当建立监管报送复核机制')).toBeInTheDocument()
      expect(screen.getByText('DEFINITION_ERROR')).toBeInTheDocument()
      expect(screen.getByText('MANDATORY')).toBeInTheDocument()
      expect(screen.getAllByText(/IT04 · 数据治理与监管报送/).length).toBeGreaterThan(0)
    })
  })

  it('clears all filters to an unfiltered backend query', async () => {
    mockListControlPoints
      .mockResolvedValueOnce({
        items: listItems,
        total: listItems.length,
        page: 1,
        limit: 100,
      })
      .mockResolvedValueOnce({
        items: listItems,
        total: listItems.length,
        page: 1,
        limit: 20,
      })

    render(<ControlPointAdminPage />)

    await waitFor(() => expect(screen.getByText('清空全部过滤条件')).toBeInTheDocument())
    fireEvent.click(screen.getByText('清空全部过滤条件'))

    await waitFor(() =>
      expect(mockListControlPoints).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        status: undefined,
        keyword: undefined,
        l1Code: undefined,
        l2Code: undefined,
        controlFamily: undefined,
        originType: undefined,
        maturityLevel: undefined,
        applicableSector: undefined,
        failureModeId: undefined,
      })
    )
  })

  it('keeps the list available when taxonomy metadata fails to load', async () => {
    mockGetTaxonomyTree.mockRejectedValue(new Error('taxonomy unavailable'))

    render(<ControlPointAdminPage />)

    await waitFor(() => {
      expect(screen.getByTestId('control-points-list-panel')).toBeInTheDocument()
      expect(screen.getAllByText('CTRL-IT04-001').length).toBeGreaterThan(0)
    })
    expect(screen.queryByText('加载 Control Point 列表失败')).not.toBeInTheDocument()
  })

  it('loads controlFamily options from metadata beyond the current page', async () => {
    mockListControlPoints.mockImplementation(async (params) => {
      if (params.limit === 100) {
        return {
          items: [
            ...listItems,
            {
              ...listItems[0],
              controlId: 'cp-3',
              controlCode: 'CTRL-IT04-003',
              controlFamily: '监测',
            },
          ],
          total: 3,
          page: 1,
          limit: 1000,
        }
      }

      return {
        items: [listItems[0]],
        total: 1,
        page: 1,
        limit: 20,
      }
    })

    render(<ControlPointAdminPage />)

    await waitFor(() =>
      expect(mockListControlPoints).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 100,
        })
      )
    )
    expect(screen.getByRole('option', { name: '监测' })).toBeInTheDocument()
  })

  it('creates a control point from the create dialog', async () => {
    render(<ControlPointAdminPage />)

    await waitFor(() => expect(screen.getByText('新建 Control Point')).toBeInTheDocument())
    fireEvent.click(screen.getByText('新建 Control Point'))
    fireEvent.change(screen.getByLabelText('编码'), { target: { value: 'CTRL-IT04-999' } })
    fireEvent.change(screen.getByLabelText('名称'), { target: { value: '新增控制点' } })
    fireEvent.change(screen.getByLabelText('控制族'), { target: { value: '治理' } })
    const dialogComboboxes = screen.getAllByRole('combobox').slice(-4)
    fireEvent.change(dialogComboboxes[0], { target: { value: 'preventive' } })
    fireEvent.change(dialogComboboxes[1], { target: { value: 'IT04' } })
    fireEvent.change(dialogComboboxes[2], { target: { value: 'IT04-01' } })
    fireEvent.change(dialogComboboxes[3], { target: { value: 'HIGH' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '默认必选' }))
    fireEvent.click(screen.getByRole('button', { name: '创建控制点' }))

    await waitFor(() =>
      expect(mockCreateControlPoint).toHaveBeenCalledWith(
        expect.objectContaining({
          controlCode: 'CTRL-IT04-999',
          controlName: '新增控制点',
          controlFamily: '治理',
          l1Code: 'IT04',
          l2Code: 'IT04-01',
          controlType: 'preventive',
          riskLevelDefault: 'HIGH',
          mandatoryDefault: true,
        })
      )
    )
  })

  it('archives the selected control point', async () => {
    render(<ControlPointAdminPage />)

    await waitFor(() => expect(screen.getByText('归档控制点')).toBeInTheDocument())
    fireEvent.click(screen.getByText('归档控制点'))
    await waitFor(() => expect(screen.getByText('确认归档控制点')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '确认归档' }))

    await waitFor(() =>
      expect(mockUpdateControlPointStatus).toHaveBeenCalledWith('cp-1', { status: 'INACTIVE' })
    )
  })

  it('loads the deep-linked control point even when it is not the first list item', async () => {
    mockControlIdParam = 'cp-2'
    mockGetControlPoint.mockImplementation(async (controlId: string) => {
      return listItems.find((item) => item.controlId === controlId) ?? listItems[0]
    })
    mockGetControlExplain.mockImplementation(async ({ controlId }) => ({
      ...controlExplain,
      control: {
        ...controlExplain.control,
        controlId,
        controlCode: controlId === 'cp-2' ? 'CTRL-IT04-002' : 'CTRL-IT04-001',
        controlName: controlId === 'cp-2' ? '报送差错纠偏控制' : '监管报送复核控制',
      },
    }))

    render(<ControlPointAdminPage />)

    await waitFor(() => expect(mockGetControlPoint).toHaveBeenCalledWith('cp-2'))
    expect(screen.getAllByText('报送差错纠偏控制').length).toBeGreaterThan(0)
  })

  it('falls back to the first list item when a deep-linked controlId is invalid', async () => {
    mockControlIdParam = 'missing-control'
    mockGetControlPoint.mockImplementation(async (controlId: string) => {
      if (controlId === 'missing-control') {
        throw new Error('not found')
      }
      return listItems.find((item) => item.controlId === controlId) ?? listItems[0]
    })
    mockGetControlExplain.mockImplementation(async ({ controlId }) => {
      if (controlId === 'missing-control') {
        throw new Error('not found')
      }
      return {
        ...controlExplain,
        control: {
          ...controlExplain.control,
          controlId,
          controlCode: controlId === 'cp-2' ? 'CTRL-IT04-002' : 'CTRL-IT04-001',
          controlName: controlId === 'cp-2' ? '报送差错纠偏控制' : '监管报送复核控制',
        },
      }
    })

    render(<ControlPointAdminPage />)

    await waitFor(() => expect(mockGetControlPoint).toHaveBeenCalledWith('missing-control'))
    await waitFor(() => expect(mockGetControlPoint).toHaveBeenCalledWith('cp-1'))
    expect(screen.getAllByText('监管报送复核控制').length).toBeGreaterThan(0)
  })

  it('keeps a newly created control selected after refresh even when the list result does not include it', async () => {
    const createdControl = {
      ...listItems[0],
      controlId: 'cp-new',
      controlCode: 'CTRL-IT04-999',
      controlName: '新增控制点详情',
    }
    mockCreateControlPoint.mockResolvedValue(createdControl)
    mockGetControlPoint.mockImplementation(async (controlId: string) => {
      if (controlId === 'cp-new') {
        return createdControl
      }
      return listItems.find((item) => item.controlId === controlId) ?? listItems[0]
    })
    mockGetControlExplain.mockImplementation(async ({ controlId }) => ({
      ...controlExplain,
      control: {
        ...controlExplain.control,
        controlId,
        controlCode: controlId === 'cp-new' ? 'CTRL-IT04-999' : 'CTRL-IT04-001',
        controlName: controlId === 'cp-new' ? '新增控制点详情' : '监管报送复核控制',
      },
    }))

    render(<ControlPointAdminPage />)

    await waitFor(() => expect(screen.getByText('新建 Control Point')).toBeInTheDocument())
    fireEvent.click(screen.getByText('新建 Control Point'))
    fireEvent.change(screen.getByLabelText('编码'), { target: { value: 'CTRL-IT04-999' } })
    fireEvent.change(screen.getByLabelText('名称'), { target: { value: '新增控制点' } })
    fireEvent.change(screen.getByLabelText('控制族'), { target: { value: '治理' } })
    const dialogComboboxes = screen.getAllByRole('combobox').slice(-4)
    fireEvent.change(dialogComboboxes[0], { target: { value: 'preventive' } })
    fireEvent.change(dialogComboboxes[1], { target: { value: 'IT04' } })
    fireEvent.change(dialogComboboxes[2], { target: { value: 'IT04-01' } })
    fireEvent.change(dialogComboboxes[3], { target: { value: 'HIGH' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '默认必选' }))
    fireEvent.click(screen.getByRole('button', { name: '创建控制点' }))

    await waitFor(() => expect(mockGetControlPoint).toHaveBeenCalledWith('cp-new'))
    expect(screen.getAllByText('新增控制点详情').length).toBeGreaterThan(0)
  })

  it('resets question edit state when switching to another control point', async () => {
    mockGetControlPoint.mockImplementation(async (controlId: string) => {
      return listItems.find((item) => item.controlId === controlId) ?? listItems[0]
    })
    mockGetControlExplain.mockImplementation(async ({ controlId }) => ({
      ...controlExplain,
      control: {
        ...controlExplain.control,
        controlId,
      },
    }))
    mockGetControlPointQuestions.mockImplementation(async (controlId: string) => ({
      controlId,
      questions:
        controlId === 'cp-1'
          ? [
              {
                questionId: 'question-1',
                questionCode: 'Q-1',
                questionText: '是否执行复核？',
                questionType: 'YES_NO',
                answerSchema: { expectedAnswer: '是', scale: 5 },
              },
            ]
          : [],
    }))

    render(<ControlPointAdminPage />)

    await waitFor(() => expect(screen.getByText('题库项')).toBeInTheDocument())
    fireEvent.click(screen.getByText('题库项'))
    await waitFor(() => expect(screen.getByText('是否执行复核？')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '编辑' }))
    expect(screen.getByRole('button', { name: '更新题库项' })).toBeInTheDocument()

    fireEvent.click(screen.getAllByTestId('control-point-list-item')[1])

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '新增题库项' })).toBeInTheDocument()
    )
  })

  it('clears stale question items when switching control and the next load fails', async () => {
    mockGetControlPoint.mockImplementation(async (controlId: string) => {
      return listItems.find((item) => item.controlId === controlId) ?? listItems[0]
    })
    mockGetControlExplain.mockImplementation(async ({ controlId }) => ({
      ...controlExplain,
      control: {
        ...controlExplain.control,
        controlId,
      },
    }))
    mockGetControlPointQuestions.mockImplementation(async (controlId: string) => {
      if (controlId === 'cp-2') {
        throw new Error('question load failed')
      }

      return {
        controlId,
        questions: [
          {
            questionId: 'question-1',
            questionCode: 'Q-1',
            questionText: '是否执行复核？',
            questionType: 'YES_NO',
            answerSchema: { expectedAnswer: '是' },
          },
        ],
      }
    })

    render(<ControlPointAdminPage />)

    await waitFor(() => expect(screen.getByText('题库项')).toBeInTheDocument())
    fireEvent.click(screen.getByText('题库项'))
    await waitFor(() => expect(screen.getByText('是否执行复核？')).toBeInTheDocument())

    fireEvent.click(screen.getAllByTestId('control-point-list-item')[1])

    await waitFor(() => expect(screen.getByText('暂无题库项')).toBeInTheDocument())
    expect(screen.queryByText('是否执行复核？')).not.toBeInTheDocument()
  })

  it('resets remediation edit state when switching to another control point', async () => {
    mockGetControlPoint.mockImplementation(async (controlId: string) => {
      return listItems.find((item) => item.controlId === controlId) ?? listItems[0]
    })
    mockGetControlExplain.mockImplementation(async ({ controlId }) => ({
      ...controlExplain,
      control: {
        ...controlExplain.control,
        controlId,
      },
    }))
    mockGetControlPointRemediations.mockImplementation(async (controlId: string) => ({
      controlId,
      remediations:
        controlId === 'cp-1'
          ? [
              {
                actionId: 'action-1',
                actionCode: 'RA-1',
                actionTitle: '补齐复核流程',
                actionDesc: '整改建议',
                priorityDefault: 'HIGH',
                effortLevel: 'LOW',
              },
            ]
          : [],
    }))

    render(<ControlPointAdminPage />)

    await waitFor(() => expect(screen.getByText('整改建议')).toBeInTheDocument())
    fireEvent.click(screen.getByText('整改建议'))
    await waitFor(() => expect(screen.getByText('补齐复核流程')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '编辑' }))
    expect(screen.getByRole('button', { name: '更新整改建议' })).toBeInTheDocument()

    fireEvent.click(screen.getAllByTestId('control-point-list-item')[1])

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '新增整改建议' })).toBeInTheDocument()
    )
  })

  it('updates a control point from the edit dialog and refreshes the detail view', async () => {
    const updatedDetail = {
      ...listItems[0],
      controlName: '更新后的控制点',
      controlFamily: '监测',
    }

    mockGetControlPoint.mockResolvedValueOnce(listItems[0]).mockResolvedValue(updatedDetail)
    mockGetControlExplain.mockResolvedValueOnce(controlExplain).mockResolvedValue({
      ...controlExplain,
      control: {
        ...controlExplain.control,
        controlName: '更新后的控制点',
      },
    })
    mockUpdateControlPoint.mockResolvedValue(updatedDetail)

    render(<ControlPointAdminPage />)

    await waitFor(() => expect(screen.getByText('编辑控制点')).toBeInTheDocument())
    fireEvent.click(screen.getByText('编辑控制点'))
    fireEvent.change(screen.getByLabelText('名称'), {
      target: { value: '更新后的控制点' },
    })
    fireEvent.change(screen.getByLabelText('控制族'), {
      target: { value: '监测' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }))

    await waitFor(() =>
      expect(mockUpdateControlPoint).toHaveBeenCalledWith(
        'cp-1',
        expect.objectContaining({
          controlName: '更新后的控制点',
          controlFamily: '监测',
        })
      )
    )
    await waitFor(() => expect(screen.getAllByText('更新后的控制点').length).toBeGreaterThan(0))
  })

  it('adds and removes an evidence mapping with the selected metadata', async () => {
    mockGetControlPointEvidences
      .mockResolvedValueOnce({ controlId: 'cp-1', evidences: [] })
      .mockResolvedValueOnce({
        controlId: 'cp-1',
        evidences: [
          {
            id: 'evidence-map-1',
            evidenceId: 'evidence-2',
            evidenceCode: 'EVD-002',
            evidenceName: '自动校验日志',
            frequency: 'MONTHLY',
            ownerRole: '审计岗',
            samplingRequirement: 'FULL',
          },
        ],
      })
      .mockResolvedValueOnce({ controlId: 'cp-1', evidences: [] })
    mockSearchEvidenceTypes.mockResolvedValue({
      items: [
        {
          evidenceId: 'evidence-2',
          evidenceCode: 'EVD-002',
          evidenceName: '自动校验日志',
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
    })

    render(<ControlPointAdminPage />)

    await waitFor(() => expect(screen.getByText('证据类型')).toBeInTheDocument())
    fireEvent.click(screen.getByText('证据类型'))
    await waitFor(() => expect(screen.getByText('暂无证据映射')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('搜索 evidence types'), {
      target: { value: '日志' },
    })
    fireEvent.change(screen.getByPlaceholderText('owner role'), {
      target: { value: '审计岗' },
    })
    fireEvent.click(screen.getByText('搜索证据'))

    await waitFor(() => expect(screen.getByText('EVD-002')).toBeInTheDocument())
    fireEvent.click(screen.getByText('添加映射'))

    await waitFor(() =>
      expect(mockCreateControlEvidenceMap).toHaveBeenCalledWith({
        controlId: 'cp-1',
        evidenceId: 'evidence-2',
        requiredLevel: 'REQUIRED',
        frequency: 'MONTHLY',
        ownerRole: '审计岗',
        samplingRequirement: 'FULL',
      })
    )
    await waitFor(() => expect(screen.getByText('EVD-002 · 自动校验日志')).toBeInTheDocument())

    fireEvent.click(getRowActionButtons('EVD-002 · 自动校验日志')[0])

    await waitFor(() => expect(mockDeleteControlEvidenceMap).toHaveBeenCalledWith('evidence-map-1'))
    await waitFor(() => expect(screen.getByText('暂无证据映射')).toBeInTheDocument())
  })

  it('creates, updates, and soft-deletes a question item from the question tab', async () => {
    mockGetControlPointQuestions
      .mockResolvedValueOnce({ controlId: 'cp-1', questions: [] })
      .mockResolvedValueOnce({
        controlId: 'cp-1',
        questions: [
          {
            questionId: 'question-1',
            questionCode: 'Q-1',
            questionText: '新增题库项',
            questionType: 'SINGLE_CHOICE',
            answerSchema: { expectedAnswer: '是' },
          },
        ],
      })
      .mockResolvedValueOnce({
        controlId: 'cp-1',
        questions: [
          {
            questionId: 'question-1',
            questionCode: 'Q-1',
            questionText: '更新后的题目',
            questionType: 'SINGLE_CHOICE',
            answerSchema: { expectedAnswer: '否' },
          },
        ],
      })
      .mockResolvedValueOnce({ controlId: 'cp-1', questions: [] })

    render(<ControlPointAdminPage />)

    await waitFor(() => expect(screen.getByText('题库项')).toBeInTheDocument())
    fireEvent.click(screen.getByText('题库项'))
    await waitFor(() => expect(screen.getByText('暂无题库项')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('question text'), {
      target: { value: '新增题库项' },
    })
    fireEvent.change(screen.getByPlaceholderText('expected answer'), {
      target: { value: '是' },
    })
    fireEvent.click(screen.getByRole('button', { name: '新增题库项' }))

    await waitFor(() =>
      expect(mockCreateQuestionItem).toHaveBeenCalledWith(
        expect.objectContaining({
          controlId: 'cp-1',
          questionText: '新增题库项',
          questionType: 'SINGLE_CHOICE',
          answerSchema: { expectedAnswer: '是' },
        })
      )
    )
    await waitFor(() => expect(screen.getByText('SINGLE_CHOICE · 是')).toBeInTheDocument())

    const createdQuestionLabel = screen.getByText('SINGLE_CHOICE · 是')
    fireEvent.click(
      within(createdQuestionLabel.parentElement!.parentElement as HTMLElement).getByRole('button', {
        name: '编辑',
      })
    )
    fireEvent.change(screen.getByPlaceholderText('question text'), {
      target: { value: '更新后的题目' },
    })
    fireEvent.change(screen.getByPlaceholderText('expected answer'), {
      target: { value: '否' },
    })
    fireEvent.click(screen.getByRole('button', { name: '更新题库项' }))

    await waitFor(() =>
      expect(mockUpdateQuestionItem).toHaveBeenCalledWith(
        'question-1',
        expect.objectContaining({
          questionText: '更新后的题目',
          questionType: 'SINGLE_CHOICE',
          answerSchema: { expectedAnswer: '否' },
        })
      )
    )
    await waitFor(() => expect(screen.getByText('更新后的题目')).toBeInTheDocument())

    fireEvent.click(getRowActionButtons('更新后的题目')[1])

    await waitFor(() =>
      expect(mockUpdateQuestionItem).toHaveBeenLastCalledWith('question-1', { status: 'INACTIVE' })
    )
    await waitFor(() => expect(screen.getByText('暂无题库项')).toBeInTheDocument())
  })

  it('creates, updates, and soft-deletes a remediation action from the remediation tab', async () => {
    mockGetControlPointRemediations
      .mockResolvedValueOnce({ controlId: 'cp-1', remediations: [] })
      .mockResolvedValueOnce({
        controlId: 'cp-1',
        remediations: [
          {
            actionId: 'action-1',
            actionCode: 'RA-1',
            actionTitle: '补齐复核流程',
            actionDesc: '新增整改描述',
            priorityDefault: 'MEDIUM',
            effortLevel: 'MEDIUM',
          },
        ],
      })
      .mockResolvedValueOnce({
        controlId: 'cp-1',
        remediations: [
          {
            actionId: 'action-1',
            actionCode: 'RA-1',
            actionTitle: '更新后的整改建议',
            actionDesc: '更新后的整改描述',
            priorityDefault: 'MEDIUM',
            effortLevel: 'MEDIUM',
          },
        ],
      })
      .mockResolvedValueOnce({ controlId: 'cp-1', remediations: [] })

    render(<ControlPointAdminPage />)

    await waitFor(() => expect(screen.getByText('整改建议')).toBeInTheDocument())
    fireEvent.click(screen.getByText('整改建议'))
    await waitFor(() => expect(screen.getByText('暂无整改建议')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('action title'), {
      target: { value: '补齐复核流程' },
    })
    fireEvent.change(screen.getByPlaceholderText('action desc'), {
      target: { value: '新增整改描述' },
    })
    fireEvent.click(screen.getByRole('button', { name: '新增整改建议' }))

    await waitFor(() =>
      expect(mockCreateRemediationAction).toHaveBeenCalledWith(
        expect.objectContaining({
          controlId: 'cp-1',
          actionTitle: '补齐复核流程',
          actionDesc: '新增整改描述',
          priorityDefault: 'MEDIUM',
          effortLevel: 'MEDIUM',
        })
      )
    )
    await waitFor(() => expect(screen.getByText('补齐复核流程')).toBeInTheDocument())

    fireEvent.click(
      within(
        screen.getByText('补齐复核流程').parentElement!.parentElement as HTMLElement
      ).getByRole('button', { name: '编辑' })
    )
    fireEvent.change(screen.getByPlaceholderText('action title'), {
      target: { value: '更新后的整改建议' },
    })
    fireEvent.change(screen.getByPlaceholderText('action desc'), {
      target: { value: '更新后的整改描述' },
    })
    fireEvent.click(screen.getByRole('button', { name: '更新整改建议' }))

    await waitFor(() =>
      expect(mockUpdateRemediationAction).toHaveBeenCalledWith(
        'action-1',
        expect.objectContaining({
          actionTitle: '更新后的整改建议',
          actionDesc: '更新后的整改描述',
        })
      )
    )
    await waitFor(() => expect(screen.getByText('更新后的整改建议')).toBeInTheDocument())

    fireEvent.click(getRowActionButtons('更新后的整改建议')[1])

    await waitFor(() =>
      expect(mockUpdateRemediationAction).toHaveBeenLastCalledWith('action-1', {
        status: 'INACTIVE',
      })
    )
    await waitFor(() => expect(screen.getByText('暂无整改建议')).toBeInTheDocument())
  })

  it('searches, creates, and deletes regulatory links from the regulatory tab', async () => {
    mockGetControlPointRegulatoryLinks
      .mockResolvedValueOnce({
        controlId: 'cp-1',
        clauses: [],
        obligations: [],
        cases: [],
      })
      .mockResolvedValueOnce({
        controlId: 'cp-1',
        clauses: [
          {
            id: 'clause-map-1',
            clauseId: 'clause-1',
            clauseCode: 'CLAUSE-001',
            sectionPath: '第四条/第一款',
            clauseText: '金融机构应建立复核机制。',
            source: { sourceCode: 'SRC-001' },
          },
        ],
        obligations: [
          {
            id: 'obl-1',
            obligationCode: 'OBL-001',
            obligationText: '应当建立复核机制',
          },
        ],
        cases: [
          {
            caseCode: 'CASE-001',
            caseTitle: '监管处罚案例',
          },
        ],
      })
      .mockResolvedValueOnce({
        controlId: 'cp-1',
        clauses: [],
        obligations: [],
        cases: [],
      })
    mockSearchRegulationClauses.mockResolvedValue({
      items: [
        {
          clauseId: 'clause-1',
          clauseCode: 'CLAUSE-001',
          articleNo: '第四条',
          clauseText: '金融机构应建立复核机制。',
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
    })

    render(<ControlPointAdminPage />)

    await waitFor(() => expect(screen.getByText('法规条文关联')).toBeInTheDocument())
    fireEvent.click(screen.getByText('法规条文关联'))
    await waitFor(() => expect(screen.getByText('暂无法规条文关联')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('搜索 regulation clauses'), {
      target: { value: '复核' },
    })
    fireEvent.click(screen.getByText('搜索条文'))

    await waitFor(() => expect(screen.getByText('CLAUSE-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText('添加关联'))

    await waitFor(() =>
      expect(mockCreateClauseControlMap).toHaveBeenCalledWith({
        controlId: 'cp-1',
        clauseId: 'clause-1',
        mappingType: 'direct',
        reviewStatus: 'PENDING',
      })
    )
    await waitFor(() => expect(screen.getByText('OBL-001 · 应当建立复核机制')).toBeInTheDocument())
    expect(screen.getByText('CASE-001 · 监管处罚案例')).toBeInTheDocument()

    fireEvent.click(getRowActionButtons('CLAUSE-001')[0])

    await waitFor(() => expect(mockDeleteClauseControlMap).toHaveBeenCalledWith('clause-map-1'))
    await waitFor(() => expect(screen.getByText('暂无法规条文关联')).toBeInTheDocument())
  })

  it('blocks deleting the last pack link for a hard control point before calling the API', async () => {
    mockGetControlPointPackLinks.mockResolvedValue({
      controlId: 'cp-1',
      items: [
        {
          id: 'pack-link-1',
          packId: 'pack-1',
          packCode: 'PACK-BASE-CYBER',
          packName: '网络安全基线包',
          packType: 'base',
          packVersion: 'stable',
          itemRole: 'INCLUDE',
          priority: 10,
        },
      ],
    })

    render(<ControlPointAdminPage />)

    await waitFor(() => expect(screen.getByText('控制包关联')).toBeInTheDocument())
    fireEvent.click(screen.getByText('控制包关联'))
    await waitFor(() => expect(screen.getByText('PACK-BASE-CYBER')).toBeInTheDocument())
    mockedToast.error.mockClear()

    fireEvent.click(getRowActionButtons('PACK-BASE-CYBER')[0])

    expect(mockDeleteControlPackItem).not.toHaveBeenCalled()
    expect(mockedToast.error).toHaveBeenCalledWith('hard 级控制点必须至少保留 1 个控制包关联')
    expect(screen.getByText('PACK-BASE-CYBER')).toBeInTheDocument()
  })
})
