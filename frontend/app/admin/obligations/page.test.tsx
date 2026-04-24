import * as React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ObligationAdminPage from './page'
import * as obligationsApi from '@/lib/api/obligations'

const mockPush = jest.fn()
const mockUseSession = jest.fn(() => ({
  data: { user: { id: 'user-1', role: 'admin' } },
  status: 'authenticated',
}))
let mockObligationIdParam: string | null = null
const mockDrawer = jest.fn((props: { open: boolean; controlId: string; sourceModule: string }) =>
  props.open ? (
    <div
      data-testid="control-detail-drawer-probe"
      data-control-id={props.controlId}
      data-source-module={props.sourceModule}
    />
  ) : null,
)

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'obligationId' ? mockObligationIdParam : null),
  }),
}))
jest.mock('@/components/compliance/ControlDetailDrawer', () => ({
  ControlDetailDrawer: (props: { open: boolean; controlId: string; sourceModule: string }) =>
    mockDrawer(props),
}))
jest.mock('@/components/admin/ControlPointDirectorySelector', () => {
  const React = require('react')

  return {
    ControlPointDirectorySelector: ({
      onPreview,
      onSelect,
    }: {
      onPreview?: (controlId: string) => void
      onSelect: (control: { controlId: string }) => void
    }) => {
      const [open, setOpen] = React.useState(false)
      return (
        <div data-testid="control-point-directory-selector">
          <input placeholder="搜索 control code / control name" />
          <button type="button" onClick={() => setOpen(true)}>
            搜索控制点
          </button>
          {open && (
            <div>
              <button type="button" onClick={() => onPreview?.('cp-2')}>
                CTRL-REP-002 · 监管报送差错纠偏控制
              </button>
              <button
                type="button"
                onClick={() =>
                  onSelect({
                    controlId: 'cp-2',
                  })
                }
              >
                添加为映射
              </button>
            </div>
          )}
        </div>
      )
    },
  }
})
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

jest.mock('@/lib/api/obligations')

const mockListObligations = obligationsApi.listObligations as jest.MockedFunction<
  typeof obligationsApi.listObligations
>
const mockGetObligation = obligationsApi.getObligation as jest.MockedFunction<
  typeof obligationsApi.getObligation
>
const mockSearchRegulationClauses = obligationsApi.searchRegulationClauses as jest.MockedFunction<
  typeof obligationsApi.searchRegulationClauses
>
const mockCreateObligation = obligationsApi.createObligation as jest.MockedFunction<
  typeof obligationsApi.createObligation
>
const mockUpdateObligation = obligationsApi.updateObligation as jest.MockedFunction<
  typeof obligationsApi.updateObligation
>
const mockCreateControlMap = obligationsApi.createObligationControlMap as jest.MockedFunction<
  typeof obligationsApi.createObligationControlMap
>
const mockDeleteControlMap = obligationsApi.deleteObligationControlMap as jest.MockedFunction<
  typeof obligationsApi.deleteObligationControlMap
>
const mockSuggestObligationCode = obligationsApi.suggestObligationCode as jest.MockedFunction<
  typeof obligationsApi.suggestObligationCode
>

const detail = {
  obligationId: 'obl-1',
  obligationCode: 'OBL-IT04-4.1-01',
  obligationText: '应当建立监管报送复核机制',
  obligationType: 'MANDATORY' as const,
  applicableSector: ['银行', '通用'] as obligationsApi.ApplicableSector[],
  status: 'ACTIVE' as const,
  clause: {
    clauseId: 'clause-1',
    clauseCode: 'CLAUSE-IT04-REP-001',
    articleNo: '4.1',
    sectionPath: '第四条/第一款',
    clauseText: '金融机构应当建立监管报送复核机制，并保留复核痕迹。',
    clauseSummary: '应建立监管报送复核机制并保留痕迹',
    source: {
      sourceId: 'source-1',
      sourceCode: 'SRC-IT04-REPORTING-001',
      sourceName: '监管数据报送管理指引',
      sourceLevel: 'guideline',
      authorityName: '监管机构',
    },
  },
  controlMaps: [
    {
      id: 'map-1',
      controlId: 'cp-1',
      controlCode: 'CTRL-REP-001',
      controlName: '监管报送复核控制',
      coverage: 'FULL' as const,
      originType: 'regulation_derived',
      maturityLevel: 'hard',
      authoritativeScore: 0.92,
    },
  ],
}

describe('ObligationAdminPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPush.mockReset()
    mockUseSession.mockReturnValue({
      data: { user: { id: 'user-1', role: 'admin' } },
      status: 'authenticated',
    })
    mockObligationIdParam = null
    mockSuggestObligationCode.mockReturnValue('OBL-IT04-4.1-02')
    mockListObligations.mockResolvedValue({
      items: [
        {
          obligationId: detail.obligationId,
          obligationCode: detail.obligationCode,
          obligationText: detail.obligationText,
          obligationType: detail.obligationType,
          applicableSector: detail.applicableSector,
          status: detail.status,
          createdAt: '',
          updatedAt: '',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    })
    mockGetObligation.mockResolvedValue(detail)
    mockSearchRegulationClauses.mockResolvedValue({
      items: [
        {
          clauseId: 'clause-1',
          sourceId: 'source-1',
          clauseCode: 'CLAUSE-IT04-REP-001',
          articleNo: '4.1',
          sectionPath: '第四条/第一款',
          clauseText: '金融机构应当建立监管报送复核机制，并保留复核痕迹。',
          clauseSummary: '应建立监管报送复核机制并保留痕迹',
          mandatoryLevel: 'MUST',
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
    })
    mockCreateObligation.mockResolvedValue({
      obligationId: 'obl-new',
      obligationCode: 'OBL-IT04-4.1-02',
      obligationText: '新义务',
      obligationType: 'MANDATORY',
      applicableSector: ['银行'],
      status: 'ACTIVE',
      createdAt: '',
      updatedAt: '',
    })
    mockUpdateObligation.mockResolvedValue(detail)
    mockCreateControlMap.mockResolvedValue({
      id: 'map-2',
      controlId: 'cp-2',
      coverage: 'PARTIAL',
    })
    mockDeleteControlMap.mockResolvedValue({ success: true, id: 'map-1' })
  })

  it('renders list and detail panel', async () => {
    render(<ObligationAdminPage />)
    await waitFor(() => {
      expect(screen.getByText('Obligation 管理')).toBeInTheDocument()
      expect(screen.getAllByText('OBL-IT04-4.1-01').length).toBeGreaterThan(0)
      expect(screen.getByDisplayValue('应当建立监管报送复核机制')).toBeInTheDocument()
    })
    expect(screen.getByText(/score 92%/)).toBeInTheDocument()
  })

  it('navigates back to /dashboard from the page header back button', async () => {
    render(<ObligationAdminPage />)

    await waitFor(() => expect(screen.getByText('Obligation 管理')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '返回' }))

    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })

  it('navigates back to /dashboard from the forbidden state action', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 'user-2', role: 'consultant' } },
      status: 'authenticated',
    })

    render(<ObligationAdminPage />)

    expect(screen.getByText('无权访问 Obligation 管理')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '返回管理后台' }))

    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })

  it('opens create dialog, searches clauses, and creates an obligation with suggested code', async () => {
    render(<ObligationAdminPage />)
    await waitFor(() => expect(screen.getByText('新建 Obligation')).toBeInTheDocument())
    fireEvent.click(screen.getByText('新建 Obligation'))
    fireEvent.change(screen.getByLabelText('条文关键词'), { target: { value: '复核' } })
    fireEvent.click(screen.getByText('搜索条文'))
    await waitFor(() => expect(mockSearchRegulationClauses).toHaveBeenCalled())
    fireEvent.click(screen.getByText('选择此条文'))
    expect(screen.getByDisplayValue('OBL-IT04-4.1-02')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('义务内容'), {
      target: { value: '新义务' },
    })
    fireEvent.click(screen.getByText('创建'))
    await waitFor(() =>
      expect(mockCreateObligation).toHaveBeenCalledWith(
        expect.objectContaining({
          clauseId: 'clause-1',
          obligationCode: 'OBL-IT04-4.1-02',
          obligationText: '新义务',
        }),
      ),
    )
  })

  it('updates obligation detail', async () => {
    render(<ObligationAdminPage />)
    await waitFor(() => expect(screen.getByDisplayValue('应当建立监管报送复核机制')).toBeInTheDocument())
    fireEvent.change(screen.getByDisplayValue('应当建立监管报送复核机制'), {
      target: { value: '更新后的义务描述' },
    })
    fireEvent.click(screen.getByText('保存修改'))
    await waitFor(() =>
      expect(mockUpdateObligation).toHaveBeenCalledWith(
        'obl-1',
        expect.objectContaining({ obligationText: '更新后的义务描述' }),
      ),
    )
  })

  it('opens clause detail dialog', async () => {
    render(<ObligationAdminPage />)
    await waitFor(() => expect(screen.getByText('法规条文')).toBeInTheDocument())
    fireEvent.click(screen.getByText('查看条文详情'))
    await waitFor(() => {
      expect(screen.getByText('第四条/第一款')).toBeInTheDocument()
      expect(screen.getByText('金融机构应当建立监管报送复核机制，并保留复核痕迹。')).toBeInTheDocument()
    })
  })

  it('removes an existing obligation control map', async () => {
    render(<ObligationAdminPage />)
    await waitFor(() => expect(screen.getByText('控制点映射')).toBeInTheDocument())
    let deleteButton: HTMLButtonElement | null = null
    await waitFor(() => {
      deleteButton = document.querySelector(
        'button[aria-label="删除控制点映射 CTRL-REP-001"]',
      ) as HTMLButtonElement | null
      expect(deleteButton).toBeTruthy()
    })
    fireEvent.click(deleteButton!)
    expect(mockDeleteControlMap).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByText('确认删除控制点映射')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))
    await waitFor(() =>
      expect(mockDeleteControlMap).toHaveBeenCalledWith('obl-1', 'map-1'),
    )
  })

  it('closes the delete confirmation instead of deleting against a newly selected obligation', async () => {
    mockListObligations.mockResolvedValue({
      items: [
        {
          obligationId: 'obl-1',
          obligationCode: 'OBL-IT04-4.1-01',
          obligationText: '应当建立监管报送复核机制',
          obligationType: 'MANDATORY',
          applicableSector: ['银行'],
          status: 'ACTIVE',
          createdAt: '',
          updatedAt: '',
        },
        {
          obligationId: 'obl-2',
          obligationCode: 'OBL-IT04-4.1-02',
          obligationText: '第二条义务',
          obligationType: 'MANDATORY',
          applicableSector: ['银行'],
          status: 'ACTIVE',
          createdAt: '',
          updatedAt: '',
        },
      ],
      total: 2,
      page: 1,
      limit: 20,
    })
    mockGetObligation.mockImplementation(async (obligationId: string) => ({
      ...detail,
      obligationId,
      obligationCode: obligationId === 'obl-2' ? 'OBL-IT04-4.1-02' : detail.obligationCode,
      obligationText: obligationId === 'obl-2' ? '第二条义务' : detail.obligationText,
    }))

    render(<ObligationAdminPage />)

    await waitFor(() => expect(screen.getByText('控制点映射')).toBeInTheDocument())
    fireEvent.click(
      document.querySelector(
        'button[aria-label="删除控制点映射 CTRL-REP-001"]',
      ) as HTMLButtonElement,
    )
    await waitFor(() => expect(screen.getByText('确认删除控制点映射')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /OBL-IT04-4.1-02.*第二条义务/ }))

    await waitFor(() =>
      expect(screen.queryByText('确认删除控制点映射')).not.toBeInTheDocument(),
    )
    expect(mockDeleteControlMap).not.toHaveBeenCalled()
  })

  it('searches controls and adds an obligation control map', async () => {
    render(<ObligationAdminPage />)
    await waitFor(() => expect(screen.getByText('控制点映射')).toBeInTheDocument())
    await waitFor(() =>
      expect(
        screen.getByPlaceholderText('搜索 control code / control name'),
      ).toBeInTheDocument(),
    )
    fireEvent.change(screen.getByPlaceholderText('搜索 control code / control name'), {
      target: { value: '复核' },
    })
    await waitFor(() => expect(screen.getByText('搜索控制点')).toBeInTheDocument())
    fireEvent.click(screen.getByText('搜索控制点'))
    await waitFor(() => {
      expect(screen.getByText('CTRL-REP-002 · 监管报送差错纠偏控制')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('添加为映射'))
    await waitFor(() =>
      expect(mockCreateControlMap).toHaveBeenCalledWith(
        'obl-1',
        expect.objectContaining({ controlId: 'cp-2' }),
      ),
    )
  })

  it('uses the selected coverage when creating an obligation control map', async () => {
    render(<ObligationAdminPage />)

    await waitFor(() => expect(screen.getByText('控制点映射')).toBeInTheDocument())
    const coverageSelect = screen.getAllByRole('combobox').find((element) =>
      (element as HTMLSelectElement).value === 'FULL',
    ) as HTMLSelectElement
    fireEvent.change(coverageSelect, { target: { value: 'PARTIAL' } })

    fireEvent.change(screen.getByPlaceholderText('搜索 control code / control name'), {
      target: { value: '复核' },
    })
    await waitFor(() => expect(screen.getByText('搜索控制点')).toBeInTheDocument())
    fireEvent.click(screen.getByText('搜索控制点'))

    await waitFor(() => {
      expect(screen.getByText('CTRL-REP-002 · 监管报送差错纠偏控制')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('添加为映射'))

    await waitFor(() =>
      expect(mockCreateControlMap).toHaveBeenCalledWith(
        'obl-1',
        expect.objectContaining({ controlId: 'cp-2', coverage: 'PARTIAL' }),
      ),
    )
  })

  it('caps known obligation code scanning to a bounded number of pages', async () => {
    mockListObligations.mockReset()
    mockListObligations.mockImplementation(() => {
      throw new Error('unexpected extra code scan call')
    })
    mockListObligations.mockResolvedValueOnce({
      items: [
        {
          obligationId: detail.obligationId,
          obligationCode: detail.obligationCode,
          obligationText: detail.obligationText,
          obligationType: detail.obligationType,
          applicableSector: detail.applicableSector,
          status: detail.status,
          createdAt: '',
          updatedAt: '',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    })

    for (let page = 1; page <= 10; page += 1) {
      mockListObligations.mockResolvedValueOnce({
        items: Array.from({ length: 100 }, (_, index) => ({
          obligationId: `obl-scan-${page}-${index}`,
          obligationCode: `OBL-SCAN-${page}-${String(index).padStart(2, '0')}`,
          obligationText: `scan obligation ${page}-${index}`,
          obligationType: 'MANDATORY' as const,
          applicableSector: ['银行'] as obligationsApi.ApplicableSector[],
          status: 'ACTIVE' as const,
          createdAt: '',
          updatedAt: '',
        })),
        total: 5000,
        page,
        limit: 100,
      })
    }

    render(<ObligationAdminPage />)
    await waitFor(() => expect(screen.getByText('新建 Obligation')).toBeInTheDocument())
    fireEvent.click(screen.getByText('新建 Obligation'))

    await waitFor(() => expect(mockListObligations).toHaveBeenCalledTimes(11))
    expect(mockListObligations.mock.calls[0][0]).toEqual(
      expect.objectContaining({ page: 1, limit: 20 }),
    )
    expect(
      mockListObligations.mock.calls
        .slice(1)
        .every(([params]) => params?.limit === 100),
    ).toBe(true)
  })

  it('loads the deep-linked obligation detail even when it is not present on the current list page', async () => {
    mockObligationIdParam = 'obl-deep-link'
    mockListObligations.mockResolvedValue({
      items: [
        {
          obligationId: 'obl-list-only',
          obligationCode: 'OBL-LIST-001',
          obligationText: '列表页默认第一项',
          obligationType: 'MANDATORY',
          applicableSector: ['银行'],
          status: 'ACTIVE',
          createdAt: '',
          updatedAt: '',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    })
    mockGetObligation.mockImplementation(async (obligationId: string) => ({
      ...detail,
      obligationId,
      obligationCode: 'OBL-DEEP-001',
      obligationText: '深链预选的义务详情',
    }))

    render(<ObligationAdminPage />)

    await waitFor(() =>
      expect(mockGetObligation).toHaveBeenCalledWith('obl-deep-link'),
    )
    expect(screen.getByDisplayValue('深链预选的义务详情')).toBeInTheDocument()
    expect(screen.getByText('OBL-LIST-001')).toBeInTheDocument()
  })

  it('consumes the deep link only once and does not snap back after switching obligations', async () => {
    mockObligationIdParam = 'obl-deep-link'
    mockListObligations.mockResolvedValue({
      items: [
        {
          obligationId: 'obl-list-only',
          obligationCode: 'OBL-LIST-001',
          obligationText: '列表页默认第一项',
          obligationType: 'MANDATORY',
          applicableSector: ['银行'],
          status: 'ACTIVE',
          createdAt: '',
          updatedAt: '',
        },
        {
          obligationId: 'obl-deep-link',
          obligationCode: 'OBL-DEEP-001',
          obligationText: '深链命中项',
          obligationType: 'MANDATORY',
          applicableSector: ['银行'],
          status: 'ACTIVE',
          createdAt: '',
          updatedAt: '',
        },
      ],
      total: 2,
      page: 1,
      limit: 20,
    })
    mockGetObligation.mockImplementation(async (obligationId: string) => ({
      ...detail,
      obligationId,
      obligationCode: obligationId === 'obl-deep-link' ? 'OBL-DEEP-001' : 'OBL-LIST-001',
      obligationText: obligationId === 'obl-deep-link' ? '深链命中项' : '列表页默认第一项',
    }))

    render(<ObligationAdminPage />)

    await waitFor(() => expect(screen.getByDisplayValue('深链命中项')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /OBL-LIST-001.*列表页默认第一项/ }))
    await waitFor(() => expect(screen.getByDisplayValue('列表页默认第一项')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '刷新' }))

    await waitFor(() => expect(screen.getByDisplayValue('列表页默认第一项')).toBeInTheDocument())
    expect(mockGetObligation).toHaveBeenLastCalledWith('obl-list-only')
  })

  it('handles deep-link with obligationId that returns 404 gracefully', async () => {
    mockObligationIdParam = 'obl-nonexistent'
    mockListObligations.mockResolvedValue({
      items: [
        {
          obligationId: 'obl-list-1',
          obligationCode: 'OBL-LIST-001',
          obligationText: '列表默认第一项',
          obligationType: 'MANDATORY',
          applicableSector: ['银行'],
          status: 'ACTIVE',
          createdAt: '',
          updatedAt: '',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    })
    mockGetObligation
      .mockRejectedValueOnce(new Error('Not found'))
      .mockResolvedValueOnce({
        ...detail,
        obligationId: 'obl-list-1',
        obligationCode: 'OBL-LIST-001',
        obligationText: '列表默认第一项',
      })

    render(<ObligationAdminPage />)

    await waitFor(() =>
      expect(mockGetObligation).toHaveBeenCalledWith('obl-nonexistent'),
    )
    await waitFor(() => expect(mockGetObligation).toHaveBeenLastCalledWith('obl-list-1'))
    expect(screen.getByDisplayValue('列表默认第一项')).toBeInTheDocument()
  })

  it('opens the shared control detail drawer from an obligation control map row', async () => {
    render(<ObligationAdminPage />)

    await waitFor(() => expect(screen.getByText('控制点映射')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'CTRL-REP-001 · 监管报送复核控制' }))

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
})
