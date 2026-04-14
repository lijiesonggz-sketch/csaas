import * as React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import FailureModeAdminPage from './page'
import * as failureModeApi from '@/lib/api/failure-modes'
import * as complianceCasesApi from '@/lib/api/compliance-cases'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: {
      user: {
        id: 'user-1',
        role: 'admin',
      },
    },
    status: 'authenticated',
  })),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
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
        return
      }
      if ('children' in child.props && child.props.children) {
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

jest.mock('@/lib/api/failure-modes')
jest.mock('@/lib/api/compliance-cases')

const mockListFailureModes = failureModeApi.listFailureModes as jest.MockedFunction<typeof failureModeApi.listFailureModes>
const mockGetFailureMode = failureModeApi.getFailureMode as jest.MockedFunction<typeof failureModeApi.getFailureMode>
const mockCreateFailureMode = failureModeApi.createFailureMode as jest.MockedFunction<typeof failureModeApi.createFailureMode>
const mockUpdateFailureMode = failureModeApi.updateFailureMode as jest.MockedFunction<typeof failureModeApi.updateFailureMode>
const mockCreateTaxonomyMap = failureModeApi.createFailureModeTaxonomyMap as jest.MockedFunction<typeof failureModeApi.createFailureModeTaxonomyMap>
const mockDeleteTaxonomyMap = failureModeApi.deleteFailureModeTaxonomyMap as jest.MockedFunction<typeof failureModeApi.deleteFailureModeTaxonomyMap>
const mockCreateControlMap = failureModeApi.createFailureModeControlMap as jest.MockedFunction<typeof failureModeApi.createFailureModeControlMap>
const mockDeleteControlMap = failureModeApi.deleteFailureModeControlMap as jest.MockedFunction<typeof failureModeApi.deleteFailureModeControlMap>
const mockGetTaxonomyTree = failureModeApi.getTaxonomyTree as jest.MockedFunction<typeof failureModeApi.getTaxonomyTree>
const mockSearchControlPoints = complianceCasesApi.searchControlPoints as jest.MockedFunction<typeof complianceCasesApi.searchControlPoints>

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
    mockListFailureModes.mockResolvedValue({
      items: [detail],
      total: 1,
      page: 1,
      limit: 20,
    })
    mockGetFailureMode.mockResolvedValue(detail)
    mockCreateFailureMode.mockResolvedValue(detail)
    mockUpdateFailureMode.mockResolvedValue(detail)
    mockCreateTaxonomyMap.mockResolvedValue({ id: 'map-2', l2Code: 'IT04-02' })
    mockDeleteTaxonomyMap.mockResolvedValue({ success: true, id: 'map-1' })
    mockCreateControlMap.mockResolvedValue({ id: 'cmap-2', controlId: 'cp-2', relevance: 'SECONDARY' })
    mockDeleteControlMap.mockResolvedValue({ success: true, id: 'cmap-1' })
    mockGetTaxonomyTree.mockResolvedValue([
      {
        l1Code: 'IT04',
        l1Name: '数据治理与监管数据报送',
        sortOrder: 1,
        children: [{ l2Code: 'IT04-01', l2Name: '监管数据报送' }],
      },
    ])
    mockSearchControlPoints.mockResolvedValue({
      items: [
        {
          controlId: 'cp-2',
          controlCode: 'CTRL-002',
          controlName: '映射核验控制',
          controlDesc: null,
          l1Code: 'IT04',
          l2Code: 'IT04-01',
          controlFamily: '治理',
          controlType: 'preventive',
          mandatoryDefault: true,
          riskLevelDefault: 'HIGH',
          ownerRoleHint: [],
          status: 'ACTIVE',
          createdAt: '',
          updatedAt: '',
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
    })
  })

  it('renders list and detail panel', async () => {
    render(<FailureModeAdminPage />)

    await waitFor(() => {
      expect(screen.getByText('Failure Mode 管理')).toBeInTheDocument()
      expect(screen.getAllByText('FM-REP-001').length).toBeGreaterThan(0)
      expect(screen.getByDisplayValue('报送口径定义错误')).toBeInTheDocument()
    })
  })

  it('creates a failure mode from dialog', async () => {
    render(<FailureModeAdminPage />)

    await waitFor(() => expect(screen.getByText('新建 Failure Mode')).toBeInTheDocument())
    fireEvent.click(screen.getByText('新建 Failure Mode'))
    fireEvent.change(screen.getByLabelText('编码'), { target: { value: 'FM-NEW-001' } })
    fireEvent.change(screen.getByLabelText('名称'), { target: { value: '新失效模式' } })
    fireEvent.click(screen.getByText('创建'))

    await waitFor(() => {
      expect(mockCreateFailureMode).toHaveBeenCalledWith(
        expect.objectContaining({
          failureModeCode: 'FM-NEW-001',
          name: '新失效模式',
        }),
      )
    })
  })

  it('updates failure mode detail', async () => {
    render(<FailureModeAdminPage />)

    await waitFor(() => expect(screen.getByDisplayValue('报送口径定义错误')).toBeInTheDocument())
    fireEvent.change(screen.getByDisplayValue('报送口径定义错误'), {
      target: { value: '更新后的名称' },
    })
    fireEvent.click(screen.getByText('保存修改'))

    await waitFor(() => {
      expect(mockUpdateFailureMode).toHaveBeenCalledWith(
        'fm-1',
        expect.objectContaining({ name: '更新后的名称' }),
      )
    })
  })

  it('adds and removes taxonomy map', async () => {
    render(<FailureModeAdminPage />)

    await waitFor(() => expect(screen.getByText('IT 分类映射')).toBeInTheDocument())
    fireEvent.change(screen.getAllByRole('combobox')[4], { target: { value: 'IT04-01' } })
    fireEvent.click(screen.getByText('添加映射'))

    await waitFor(() => {
      expect(mockCreateTaxonomyMap).toHaveBeenCalledWith('fm-1', { l2Code: 'IT04-01' })
    })

    fireEvent.click(screen.getAllByRole('button').find((button) => button.querySelector('svg.lucide-trash2'))!)
    await waitFor(() => {
      expect(mockDeleteTaxonomyMap).toHaveBeenCalledWith('fm-1', 'map-1')
    })
  })

  it('searches controls and adds a control map', async () => {
    render(<FailureModeAdminPage />)

    await waitFor(() => expect(screen.getByText('控制点映射')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText('搜索 control code / control name'), {
      target: { value: '核验' },
    })
    fireEvent.click(screen.getByText('搜索控制点'))

    await waitFor(() => {
      expect(mockSearchControlPoints).toHaveBeenCalled()
      expect(screen.getByText('CTRL-002 · 映射核验控制')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('添加为映射'))
    await waitFor(() => {
      expect(mockCreateControlMap).toHaveBeenCalledWith(
        'fm-1',
        expect.objectContaining({ controlId: 'cp-2' }),
      )
    })
  })
})
