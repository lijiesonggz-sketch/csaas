import * as React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import FailureModeAdminPage from './page'
import * as failureModeApi from '@/lib/api/failure-modes'

const mockPush = jest.fn()
const mockUseSession = jest.fn(() => ({
  data: { user: { id: 'user-1', role: 'admin' } },
  status: 'authenticated',
}))
let mockFailureModeIdParam: string | null = null
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
    get: (key: string) => (key === 'failureModeId' ? mockFailureModeIdParam : null),
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
                CTRL-002 · 映射核验控制
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

jest.mock('@/components/ui/select', () => {
  type SelectItemData = { value: string; children: React.ReactNode }
  const collectItems = (children: React.ReactNode): SelectItemData[] => {
    const items: SelectItemData[] = []
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return
      if (child.type === SelectItem)
        items.push({ value: child.props.value, children: child.props.children })
      else if ('children' in child.props && child.props.children)
        items.push(...collectItems(child.props.children))
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

jest.mock('@/lib/api/failure-modes')

const mockListFailureModes = failureModeApi.listFailureModes as jest.MockedFunction<
  typeof failureModeApi.listFailureModes
>
const mockGetFailureMode = failureModeApi.getFailureMode as jest.MockedFunction<
  typeof failureModeApi.getFailureMode
>
const mockCreateFailureMode = failureModeApi.createFailureMode as jest.MockedFunction<
  typeof failureModeApi.createFailureMode
>
const mockUpdateFailureMode = failureModeApi.updateFailureMode as jest.MockedFunction<
  typeof failureModeApi.updateFailureMode
>
const mockCreateTaxonomyMap = failureModeApi.createFailureModeTaxonomyMap as jest.MockedFunction<
  typeof failureModeApi.createFailureModeTaxonomyMap
>
const mockDeleteTaxonomyMap = failureModeApi.deleteFailureModeTaxonomyMap as jest.MockedFunction<
  typeof failureModeApi.deleteFailureModeTaxonomyMap
>
const mockCreateControlMap = failureModeApi.createFailureModeControlMap as jest.MockedFunction<
  typeof failureModeApi.createFailureModeControlMap
>
const mockDeleteControlMap = failureModeApi.deleteFailureModeControlMap as jest.MockedFunction<
  typeof failureModeApi.deleteFailureModeControlMap
>
const mockGetTaxonomyTree = failureModeApi.getTaxonomyTree as jest.MockedFunction<
  typeof failureModeApi.getTaxonomyTree
>
const mockSuggestFailureModeCode = failureModeApi.suggestFailureModeCode as jest.MockedFunction<
  typeof failureModeApi.suggestFailureModeCode
>

const detail = {
  failureModeId: 'fm-1',
  failureModeCode: 'FM-REP-001',
  name: '报送口径定义错误',
  description: '定义口径不一致',
  category: 'DEFINITION_ERROR' as const,
  status: 'ACTIVE' as const,
  taxonomyMaps: [{ id: 'map-1', l2Code: 'IT04-01', l2Name: '监管数据报送' }],
  controlMaps: [
    {
      id: 'cmap-1',
      controlId: 'cp-1',
      controlCode: 'CTRL-001',
      controlName: '报送前校验',
      relevance: 'PRIMARY' as const,
      maturityLevel: 'hard',
      authoritativeScore: 0.8333,
    },
  ],
}

describe('FailureModeAdminPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFailureModeIdParam = null
    mockPush.mockReset()
    mockUseSession.mockReturnValue({
      data: { user: { id: 'user-1', role: 'admin' } },
      status: 'authenticated',
    })
    mockSuggestFailureModeCode.mockReturnValue('FM-DEF-001')
    mockListFailureModes.mockResolvedValue({ items: [detail], total: 1, page: 1, limit: 20 })
    mockGetFailureMode.mockResolvedValue(detail)
    mockCreateFailureMode.mockResolvedValue({
      failureModeId: 'fm-new',
      failureModeCode: 'FM-DEF-001',
      name: '新失效模式',
      category: 'DEFINITION_ERROR',
      status: 'ACTIVE',
    })
    mockUpdateFailureMode.mockResolvedValue(detail)
    mockCreateTaxonomyMap.mockResolvedValue({ id: 'map-2', l2Code: 'IT04-02' })
    mockDeleteTaxonomyMap.mockResolvedValue({ success: true, id: 'map-1' })
    mockCreateControlMap.mockResolvedValue({
      id: 'cmap-2',
      controlId: 'cp-2',
      relevance: 'SECONDARY',
    })
    mockDeleteControlMap.mockResolvedValue({ success: true, id: 'cmap-1' })
    mockGetTaxonomyTree.mockResolvedValue([
      {
        l1Code: 'IT04',
        l1Name: '数据治理与监管数据报送',
        sortOrder: 1,
        children: [{ l2Code: 'IT04-01', l2Name: '监管数据报送' }],
      },
    ])
  })

  it('renders list and detail panel', async () => {
    render(<FailureModeAdminPage />)
    await waitFor(() => {
      expect(screen.getByText('Failure Mode 管理')).toBeInTheDocument()
      expect(screen.getAllByText('FM-REP-001').length).toBeGreaterThan(0)
      expect(screen.getByDisplayValue('报送口径定义错误')).toBeInTheDocument()
    })
    expect(screen.getByText(/score 83%/)).toBeInTheDocument()
  })

  it('navigates back to /dashboard from the page header back button', async () => {
    render(<FailureModeAdminPage />)

    await waitFor(() => expect(screen.getByText('Failure Mode 管理')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '返回' }))

    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })

  it('navigates back to /dashboard from the forbidden state action', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 'user-2', role: 'consultant' } },
      status: 'authenticated',
    })

    render(<FailureModeAdminPage />)

    expect(screen.getByText('无权访问 Failure Mode 管理')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '返回管理后台' }))

    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })

  it('opens create dialog with suggested code and creates a failure mode', async () => {
    render(<FailureModeAdminPage />)
    await waitFor(() => expect(screen.getByText('新建 Failure Mode')).toBeInTheDocument())
    fireEvent.click(screen.getByText('新建 Failure Mode'))
    expect(mockSuggestFailureModeCode).toHaveBeenCalled()
    expect(screen.getByDisplayValue('FM-DEF-001')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('名称'), { target: { value: '新失效模式' } })
    fireEvent.click(screen.getByText('创建'))
    await waitFor(() =>
      expect(mockCreateFailureMode).toHaveBeenCalledWith(
        expect.objectContaining({ failureModeCode: 'FM-DEF-001', name: '新失效模式' })
      )
    )
  })

  it('keeps user-edited create form values when async code refresh finishes', async () => {
    let resolveKnownCodes: ((value: { items: typeof detail[]; total: number; page: number; limit: number }) => void) | null =
      null

    mockListFailureModes
      .mockResolvedValueOnce({ items: [detail], total: 1, page: 1, limit: 20 })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveKnownCodes = resolve
          }),
      )

    mockSuggestFailureModeCode
      .mockReturnValueOnce('FM-DEF-001')
      .mockReturnValueOnce('FM-DEF-009')

    render(<FailureModeAdminPage />)
    await waitFor(() => expect(screen.getByText('新建 Failure Mode')).toBeInTheDocument())

    fireEvent.click(screen.getByText('新建 Failure Mode'))
    fireEvent.change(screen.getByLabelText('编码'), { target: { value: 'FM-CUSTOM-999' } })
    fireEvent.change(screen.getByLabelText('名称'), { target: { value: '手工输入名称' } })
    fireEvent.change(screen.getAllByRole('combobox').at(-1)!, { target: { value: 'MAPPING_ERROR' } })

    resolveKnownCodes?.({
      items: [
        detail,
        {
          ...detail,
          failureModeId: 'fm-2',
          failureModeCode: 'FM-DEF-008',
          name: '其他失效模式',
        },
      ],
      total: 2,
      page: 1,
      limit: 100,
    })

    await waitFor(() => expect(screen.getByLabelText('编码')).toHaveValue('FM-CUSTOM-999'))
    expect(screen.getByLabelText('名称')).toHaveValue('手工输入名称')
    expect(screen.getAllByRole('combobox').at(-1)).toHaveValue('MAPPING_ERROR')
  })

  it('updates failure mode detail', async () => {
    render(<FailureModeAdminPage />)
    await waitFor(() => expect(screen.getByDisplayValue('报送口径定义错误')).toBeInTheDocument())
    fireEvent.change(screen.getByDisplayValue('报送口径定义错误'), {
      target: { value: '更新后的名称' },
    })
    fireEvent.click(screen.getByText('保存修改'))
    await waitFor(() =>
      expect(mockUpdateFailureMode).toHaveBeenCalledWith(
        'fm-1',
        expect.objectContaining({ name: '更新后的名称' })
      )
    )
  })

  it('adds and removes taxonomy map', async () => {
    render(<FailureModeAdminPage />)
    await waitFor(() => expect(screen.getByText('IT 分类映射')).toBeInTheDocument())
    const taxonomySection = screen.getByText('IT 分类映射').closest('div')?.parentElement
    const taxonomySelect = taxonomySection?.querySelector('select')
    expect(taxonomySelect).toBeTruthy()
    fireEvent.change(taxonomySelect as Element, { target: { value: 'IT04-01' } })
    fireEvent.click(screen.getByText('添加映射'))
    await waitFor(() =>
      expect(mockCreateTaxonomyMap).toHaveBeenCalledWith('fm-1', { l2Code: 'IT04-01' })
    )
    let deleteTaxonomyButton: HTMLButtonElement | null = null
    await waitFor(() => {
      deleteTaxonomyButton = document.querySelector(
        'button[aria-label="删除 IT 分类映射 IT04-01"]',
      ) as HTMLButtonElement | null
      expect(deleteTaxonomyButton).toBeTruthy()
    })
    fireEvent.click(deleteTaxonomyButton!)
    await waitFor(() => expect(mockDeleteTaxonomyMap).toHaveBeenCalledWith('fm-1', 'map-1'))
  })

  it('searches controls and adds a control map', async () => {
    render(<FailureModeAdminPage />)
    await waitFor(() => expect(screen.getByText('控制点映射')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText('搜索 control code / control name'), {
      target: { value: '核验' },
    })
    fireEvent.click(screen.getByText('搜索控制点'))
    await waitFor(() => {
      expect(screen.getByText('CTRL-002 · 映射核验控制')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('添加为映射'))
    await waitFor(() =>
      expect(mockCreateControlMap).toHaveBeenCalledWith(
        'fm-1',
        expect.objectContaining({ controlId: 'cp-2' })
      )
    )
  })

  it('uses the selected relevance when creating a failure mode control map', async () => {
    render(<FailureModeAdminPage />)

    await waitFor(() => expect(screen.getByText('控制点映射')).toBeInTheDocument())
    const relevanceSelect = screen.getAllByRole('combobox').find((element) =>
      (element as HTMLSelectElement).value === 'PRIMARY',
    ) as HTMLSelectElement
    fireEvent.change(relevanceSelect, { target: { value: 'SECONDARY' } })

    fireEvent.change(screen.getByPlaceholderText('搜索 control code / control name'), {
      target: { value: '核验' },
    })
    fireEvent.click(screen.getByText('搜索控制点'))

    await waitFor(() => {
      expect(screen.getByText('CTRL-002 · 映射核验控制')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('添加为映射'))

    await waitFor(() =>
      expect(mockCreateControlMap).toHaveBeenCalledWith(
        'fm-1',
        expect.objectContaining({ controlId: 'cp-2', relevance: 'SECONDARY' }),
      ),
    )
  })

  it('removes an existing control map', async () => {
    render(<FailureModeAdminPage />)

    let controlDeleteButton: HTMLButtonElement | null = null
    await waitFor(() => {
      controlDeleteButton = document.querySelector(
        'button[aria-label="删除控制点映射 CTRL-001"]',
      ) as HTMLButtonElement | null
      expect(controlDeleteButton).toBeTruthy()
    })
    fireEvent.click(controlDeleteButton!)
    await waitFor(() => expect(mockDeleteControlMap).toHaveBeenCalledWith('fm-1', 'cmap-1'))
  })

  it('disables next-page navigation on the last full page', async () => {
    mockListFailureModes.mockResolvedValue({
      items: Array.from({ length: 20 }, (_, index) => ({
        ...detail,
        failureModeId: `fm-${index + 1}`,
        failureModeCode: `FM-REP-${String(index + 1).padStart(3, '0')}`,
      })),
      total: 20,
      page: 1,
      limit: 20,
    })

    render(<FailureModeAdminPage />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled(),
    )
  })

  it('loads the deep-linked failure mode detail even when it is not present on the current list page', async () => {
    mockFailureModeIdParam = 'fm-deep-link'
    mockListFailureModes.mockResolvedValue({
      items: [
        {
          failureModeId: 'fm-list-only',
          failureModeCode: 'FM-LIST-001',
          name: '列表页默认项',
          description: '',
          category: 'DEFINITION_ERROR',
          status: 'ACTIVE',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    })
    mockGetFailureMode.mockImplementation(async (failureModeId: string) => ({
      ...detail,
      failureModeId,
      failureModeCode: 'FM-DEEP-001',
      name: '深链预选的失效模式详情',
    }))

    render(<FailureModeAdminPage />)

    await waitFor(() => expect(mockGetFailureMode).toHaveBeenCalledWith('fm-deep-link'))
    expect(screen.getByDisplayValue('深链预选的失效模式详情')).toBeInTheDocument()
    expect(screen.getByText('FM-LIST-001')).toBeInTheDocument()
  })

  it('consumes the deep link only once and does not snap back after the user selects another failure mode', async () => {
    mockFailureModeIdParam = 'fm-deep-link'
    mockListFailureModes.mockResolvedValue({
      items: [
        {
          failureModeId: 'fm-list-only',
          failureModeCode: 'FM-LIST-001',
          name: '列表页默认项',
          description: '',
          category: 'DEFINITION_ERROR',
          status: 'ACTIVE',
        },
        {
          failureModeId: 'fm-deep-link',
          failureModeCode: 'FM-DEEP-001',
          name: '深链命中项',
          description: '',
          category: 'DEFINITION_ERROR',
          status: 'ACTIVE',
        },
      ],
      total: 2,
      page: 1,
      limit: 20,
    })
    mockGetFailureMode.mockImplementation(async (failureModeId: string) => ({
      ...detail,
      failureModeId,
      failureModeCode: failureModeId === 'fm-deep-link' ? 'FM-DEEP-001' : 'FM-LIST-001',
      name: failureModeId === 'fm-deep-link' ? '深链命中项' : '列表页默认项',
    }))

    render(<FailureModeAdminPage />)

    await waitFor(() => expect(screen.getByDisplayValue('深链命中项')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /FM-LIST-001.*列表页默认项/ }))
    await waitFor(() => expect(screen.getByDisplayValue('列表页默认项')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '刷新' }))

    await waitFor(() => expect(screen.getByDisplayValue('列表页默认项')).toBeInTheDocument())
    expect(mockGetFailureMode).toHaveBeenLastCalledWith('fm-list-only')
  })

  it('keeps the list available when taxonomy metadata fails to load', async () => {
    mockGetTaxonomyTree.mockRejectedValue(new Error('taxonomy unavailable'))

    render(<FailureModeAdminPage />)

    await waitFor(() => {
      expect(screen.getByText('Failure Mode 管理')).toBeInTheDocument()
      expect(screen.getAllByText('FM-REP-001').length).toBeGreaterThan(0)
    })
  })

  it('opens the shared control detail drawer from a mapped control row', async () => {
    render(<FailureModeAdminPage />)

    await waitFor(() => expect(screen.getByText('控制点映射')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'CTRL-001 · 报送前校验' }))

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
