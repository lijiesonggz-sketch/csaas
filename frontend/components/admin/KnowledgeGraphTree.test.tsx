import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { KnowledgeGraphTree } from './KnowledgeGraphTree'
import type { TaxonomyTreeL1 } from '@/lib/api/knowledge-graph'

const mockTree: TaxonomyTreeL1[] = [
  {
    l1Code: 'IT01',
    l1Name: '战略与治理',
    children: [
      { l2Code: 'IT01-01', l2Name: 'IT战略规划', failureModeCount: 5 },
      { l2Code: 'IT01-02', l2Name: 'IT治理架构', failureModeCount: 3 },
    ],
  },
  {
    l1Code: 'IT02',
    l1Name: '数据管理',
    children: [
      { l2Code: 'IT02-01', l2Name: '数据质量管理', failureModeCount: 4 },
      { l2Code: 'IT02-02', l2Name: '数据安全管理', failureModeCount: 6 },
    ],
  },
]

describe('KnowledgeGraphTree', () => {
  const mockOnSelectL2 = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('[P0] 基本渲染', () => {
    it('应该渲染所有 L1 分类节点', () => {
      render(
        <KnowledgeGraphTree
          tree={mockTree}
          selectedL2Code={null}
          onSelectL2={mockOnSelectL2}
        />
      )

      expect(screen.getByText(/IT01.*战略与治理/)).toBeInTheDocument()
      expect(screen.getByText(/IT02.*数据管理/)).toBeInTheDocument()
    })

    it('应该默认折叠所有 L1 节点', () => {
      render(
        <KnowledgeGraphTree
          tree={mockTree}
          selectedL2Code={null}
          onSelectL2={mockOnSelectL2}
        />
      )

      // L2 节点应该不可见
      expect(screen.queryByText('IT战略规划')).not.toBeInTheDocument()
      expect(screen.queryByText('数据质量管理')).not.toBeInTheDocument()
    })

    it('应该显示空状态当树为空', () => {
      render(
        <KnowledgeGraphTree
          tree={[]}
          selectedL2Code={null}
          onSelectL2={mockOnSelectL2}
        />
      )

      expect(screen.getByText('暂无 IT 分类数据')).toBeInTheDocument()
    })
  })

  describe('[P0] 展开/折叠交互', () => {
    it('应该展开 L1 节点当点击时', async () => {
      render(
        <KnowledgeGraphTree
          tree={mockTree}
          selectedL2Code={null}
          onSelectL2={mockOnSelectL2}
        />
      )

      const l1Button = screen.getByRole('button', { name: /IT01.*战略与治理/ })
      fireEvent.click(l1Button)

      await waitFor(() => {
        expect(screen.getByText('IT战略规划')).toBeInTheDocument()
        expect(screen.getByText('IT治理架构')).toBeInTheDocument()
      })
    })

    it('应该折叠已展开的 L1 节点当再次点击时', async () => {
      render(
        <KnowledgeGraphTree
          tree={mockTree}
          selectedL2Code={null}
          onSelectL2={mockOnSelectL2}
        />
      )

      const l1Button = screen.getByRole('button', { name: /IT01.*战略与治理/ })
      
      // 展开
      fireEvent.click(l1Button)
      await waitFor(() => {
        expect(screen.getByText('IT战略规划')).toBeInTheDocument()
      })

      // 折叠
      fireEvent.click(l1Button)
      await waitFor(() => {
        expect(screen.queryByText('IT战略规划')).not.toBeInTheDocument()
      })
    })

    it('应该显示失效模式数量徽章', async () => {
      render(
        <KnowledgeGraphTree
          tree={mockTree}
          selectedL2Code={null}
          onSelectL2={mockOnSelectL2}
        />
      )

      const l1Button = screen.getByRole('button', { name: /IT01.*战略与治理/ })
      fireEvent.click(l1Button)

      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument()
        expect(screen.getByText('3')).toBeInTheDocument()
      })
    })
  })

  describe('[P0] L2 节点选择', () => {
    it('应该调用 onSelectL2 当点击 L2 节点时', async () => {
      render(
        <KnowledgeGraphTree
          tree={mockTree}
          selectedL2Code={null}
          onSelectL2={mockOnSelectL2}
        />
      )

      const l1Button = screen.getByRole('button', { name: /IT01.*战略与治理/ })
      fireEvent.click(l1Button)

      await waitFor(() => {
        const l2Button = screen.getByRole('button', { name: /IT战略规划/ })
        fireEvent.click(l2Button)
      })

      expect(mockOnSelectL2).toHaveBeenCalledWith('IT01-01')
    })

    it('应该高亮选中的 L2 节点', async () => {
      render(
        <KnowledgeGraphTree
          tree={mockTree}
          selectedL2Code="IT01-01"
          onSelectL2={mockOnSelectL2}
        />
      )

      const l1Button = screen.getByRole('button', { name: /IT01.*战略与治理/ })
      fireEvent.click(l1Button)

      await waitFor(() => {
        const l2Button = screen.getByRole('button', { name: /IT战略规划/ })
        expect(l2Button).toHaveClass('bg-blue-50')
      })
    })
  })

  describe('[P0] 搜索过滤', () => {
    it('应该过滤匹配的 L1 节点', () => {
      render(
        <KnowledgeGraphTree
          tree={mockTree}
          selectedL2Code={null}
          onSelectL2={mockOnSelectL2}
          searchQuery="战略"
        />
      )

      expect(screen.getByRole('button', { name: /IT01.*战略.*治理/ })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /IT02.*数据管理/ })).not.toBeInTheDocument()
    })

    it('应该过滤匹配的 L2 节点', () => {
      render(
        <KnowledgeGraphTree
          tree={mockTree}
          selectedL2Code={null}
          onSelectL2={mockOnSelectL2}
          searchQuery="数据质量"
        />
      )

      // IT02 应该显示因为其子节点匹配
      expect(screen.getByRole('button', { name: /IT02.*数据管理/ })).toBeInTheDocument()
      // 自动展开显示匹配的 L2
      expect(screen.getByRole('button', { name: /数据质量.*管理/ })).toBeInTheDocument()
      // 不匹配的 L2 应该被过滤
      expect(screen.queryByRole('button', { name: /数据安全管理/ })).not.toBeInTheDocument()
    })

    it('应该高亮搜索匹配的文本', () => {
      render(
        <KnowledgeGraphTree
          tree={mockTree}
          selectedL2Code={null}
          onSelectL2={mockOnSelectL2}
          searchQuery="战略"
        />
      )

      const marks = screen.getAllByText('战略')
      expect(marks.length).toBeGreaterThan(0)
      marks.forEach(mark => {
        expect(mark.tagName).toBe('MARK')
      })
    })

    it('应该显示空状态当没有匹配结果', () => {
      render(
        <KnowledgeGraphTree
          tree={mockTree}
          selectedL2Code={null}
          onSelectL2={mockOnSelectL2}
          searchQuery="不存在的关键词"
        />
      )

      expect(screen.getByText('未找到匹配的分类')).toBeInTheDocument()
    })

    it('应该自动展开所有节点当搜索时', () => {
      render(
        <KnowledgeGraphTree
          tree={mockTree}
          selectedL2Code={null}
          onSelectL2={mockOnSelectL2}
          searchQuery="IT"
        />
      )

      // 所有 L2 节点应该可见
      expect(screen.getByRole('button', { name: /战略规划/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /治理架构/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /数据质量管理/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /数据安全管理/ })).toBeInTheDocument()
    })
  })

  describe('[P1] 可访问性', () => {
    it('应该有正确的 ARIA 属性', async () => {
      render(
        <KnowledgeGraphTree
          tree={mockTree}
          selectedL2Code={null}
          onSelectL2={mockOnSelectL2}
        />
      )

      const nav = screen.getByRole('navigation', { name: 'IT 分类树' })
      expect(nav).toBeInTheDocument()

      const l1Button = screen.getByRole('button', { name: /IT01.*战略与治理/ })
      expect(l1Button).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(l1Button)

      await waitFor(() => {
        expect(l1Button).toHaveAttribute('aria-expanded', 'true')
      })
    })

    it('应该标记选中的 L2 节点', async () => {
      render(
        <KnowledgeGraphTree
          tree={mockTree}
          selectedL2Code="IT01-01"
          onSelectL2={mockOnSelectL2}
        />
      )

      const l1Button = screen.getByRole('button', { name: /IT01.*战略与治理/ })
      fireEvent.click(l1Button)

      await waitFor(() => {
        const l2Button = screen.getByRole('button', { name: /IT战略规划/ })
        expect(l2Button).toHaveAttribute('aria-current', 'true')
      })
    })
  })
})
