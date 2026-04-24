import * as React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

import { ControlPointDirectorySelector } from './ControlPointDirectorySelector'
import * as controlPointsApi from '@/lib/api/control-points'
import * as knowledgeGraphApi from '@/lib/api/knowledge-graph'

jest.mock('sonner', () => ({ toast: { error: jest.fn() } }))
jest.mock('@/lib/api/control-points')
jest.mock('@/lib/api/knowledge-graph')
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

const mockListControlPoints = controlPointsApi.listControlPoints as jest.MockedFunction<
  typeof controlPointsApi.listControlPoints
>
const mockGetTaxonomyTree = knowledgeGraphApi.getTaxonomyTree as jest.MockedFunction<
  typeof knowledgeGraphApi.getTaxonomyTree
>

const baseItems = [
  {
    controlId: 'cp-1',
    controlCode: 'CTRL-001',
    controlName: '监管报送复核控制',
    l1Code: 'IT04',
    l2Code: 'IT04-01',
    controlFamily: '治理',
    controlType: 'preventive' as const,
    mandatoryDefault: true,
    riskLevelDefault: 'HIGH' as const,
    status: 'ACTIVE' as const,
    createdAt: '',
    updatedAt: '',
    maturityLevel: 'hard' as const,
    authoritativeScore: 0.9,
  },
  {
    controlId: 'cp-2',
    controlCode: 'CTRL-002',
    controlName: '监管报送差错纠偏控制',
    l1Code: 'IT04',
    l2Code: 'IT04-01',
    controlFamily: '治理',
    controlType: 'corrective' as const,
    mandatoryDefault: true,
    riskLevelDefault: 'MEDIUM' as const,
    status: 'ACTIVE' as const,
    createdAt: '',
    updatedAt: '',
    maturityLevel: 'draft-hard' as const,
    authoritativeScore: 0.7,
  },
]

describe('ControlPointDirectorySelector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetTaxonomyTree.mockResolvedValue([
      {
        l1Code: 'IT04',
        l1Name: '数据治理与监管报送',
        children: [{ l2Code: 'IT04-01', l2Name: '监管报送控制' }],
      },
    ])
  })

  it('keeps pagination visible when the current page becomes empty after excluding mapped controls', async () => {
    mockListControlPoints
      .mockResolvedValueOnce({
        items: [baseItems[0]],
        total: 1,
        page: 1,
        limit: 100,
      })
      .mockResolvedValueOnce({
        items: baseItems,
        total: 20,
        page: 1,
        limit: 10,
      })

    render(
      <ControlPointDirectorySelector
        excludeControlIds={['cp-1', 'cp-2']}
        onSelect={jest.fn()}
      />,
    )

    await waitFor(() => expect(screen.getByRole('button', { name: '搜索控制点' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '搜索控制点' }))

    await waitFor(() =>
      expect(
        screen.getByText('当前页结果已被已关联控制点过滤，请尝试翻页或调整筛选条件。'),
      ).toBeInTheDocument(),
    )
    expect(screen.getByText('第 1 / 2 页')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下一页' })).toBeEnabled()
  })

  it('re-filters existing results immediately when excludeControlIds changes', async () => {
    mockListControlPoints
      .mockResolvedValueOnce({
        items: [baseItems[0]],
        total: 1,
        page: 1,
        limit: 100,
      })
      .mockResolvedValueOnce({
        items: [baseItems[0]],
        total: 1,
        page: 1,
        limit: 10,
      })

    const { rerender } = render(
      <ControlPointDirectorySelector excludeControlIds={[]} onSelect={jest.fn()} />,
    )

    await waitFor(() => expect(screen.getByRole('button', { name: '搜索控制点' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '搜索控制点' }))

    await waitFor(() => expect(screen.getByText('CTRL-001 · 监管报送复核控制')).toBeInTheDocument())

    rerender(<ControlPointDirectorySelector excludeControlIds={['cp-1']} onSelect={jest.fn()} />)

    await waitFor(() =>
      expect(screen.queryByText('CTRL-001 · 监管报送复核控制')).not.toBeInTheDocument(),
    )
    expect(
      screen.getByText('当前页结果已被已关联控制点过滤，请尝试翻页或调整筛选条件。'),
    ).toBeInTheDocument()
  })

  it('passes the full filter surface to listControlPoints when searching', async () => {
    mockListControlPoints
      .mockResolvedValueOnce({
        items: [
          { ...baseItems[0], controlFamily: '治理' },
          { ...baseItems[1], controlFamily: '监测' },
        ],
        total: 2,
        page: 1,
        limit: 100,
      })
      .mockResolvedValueOnce({
        items: [baseItems[0]],
        total: 1,
        page: 1,
        limit: 10,
      })

    render(<ControlPointDirectorySelector excludeControlIds={[]} onSelect={jest.fn()} />)

    await waitFor(() => expect(screen.getByRole('button', { name: '搜索控制点' })).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('搜索 control code / control name'), {
      target: { value: '复核' },
    })

    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'IT04' } })
    fireEvent.change(selects[1], { target: { value: 'IT04-01' } })
    fireEvent.change(selects[2], { target: { value: '治理' } })
    fireEvent.change(selects[3], { target: { value: 'hard' } })
    fireEvent.change(selects[4], { target: { value: '银行' } })

    fireEvent.click(screen.getByRole('button', { name: '搜索控制点' }))

    await waitFor(() =>
      expect(mockListControlPoints).toHaveBeenLastCalledWith({
        page: 1,
        limit: 10,
        status: 'ACTIVE',
        keyword: '复核',
        l1Code: 'IT04',
        l2Code: 'IT04-01',
        controlFamily: '治理',
        maturityLevel: 'hard',
        applicableSector: '银行',
      }),
    )
  })
})
