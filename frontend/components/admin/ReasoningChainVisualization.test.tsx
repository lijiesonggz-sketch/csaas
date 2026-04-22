import { render, screen, fireEvent } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { ReasoningChainVisualization } from './ReasoningChainVisualization'
import type { ReasoningChainData } from '@/lib/api/knowledge-graph'

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
}

const mockData: ReasoningChainData = {
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
      name: '战略不一致',
      category: 'DEFINITION_ERROR',
      controlPointCount: 3,
    },
    {
      failureModeId: 'fm-2',
      failureModeCode: 'FM-002',
      name: '映射错误',
      category: 'MAPPING_ERROR',
      controlPointCount: 2,
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
    {
      controlId: 'cp-2',
      controlCode: 'CP-002',
      controlName: '战略审批机制',
      maturityLevel: 'draft-hard',
      authoritativeScore: 0.8,
      originType: 'standard',
      failureModeRelevance: 'SECONDARY',
      failureModeId: 'fm-1',
    },
  ],
  obligations: [
    {
      obligationId: 'ob-1',
      obligationCode: 'OBL-001',
      obligationText: '应当建立IT战略规划流程',
      obligationType: 'MANDATORY',
      controlId: 'cp-1',
      coverage: 'FULL',
    },
    {
      obligationId: 'ob-2',
      obligationCode: 'OBL-002',
      obligationText: '应当定期审查IT战略',
      obligationType: 'RECOMMENDED',
      controlId: 'cp-1',
      coverage: 'PARTIAL',
    },
  ],
}

describe('ReasoningChainVisualization', () => {
  const mockOnSelectEntity = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
  })

  describe('[P0] 加载状态', () => {
    it('应该显示 Loader 和提示文本', () => {
      render(
        <ReasoningChainVisualization
          data={null}
          loading={true}
          onSelectEntity={mockOnSelectEntity}
        />
      )

      expect(screen.getByText('加载推理链路中...')).toBeInTheDocument()
      const loader = screen.getByText('加载推理链路中...').previousElementSibling
      expect(loader).toHaveClass('animate-spin')
    })
  })

  describe('[P0] 空数据状态', () => {
    it('应该显示占位符和提示', () => {
      render(
        <ReasoningChainVisualization
          data={null}
          loading={false}
          onSelectEntity={mockOnSelectEntity}
        />
      )

      expect(screen.getByText('请从左侧选择 IT 分类查看推理链路')).toBeInTheDocument()
    })
  })

  describe('[P0] 有数据时渲染三列', () => {
    it('应该渲染失效模式、控制点、义务三列', () => {
      render(
        <ReasoningChainVisualization
          data={mockData}
          loading={false}
          onSelectEntity={mockOnSelectEntity}
        />
      )

      expect(screen.getByText(/失效模式 \(2\)/)).toBeInTheDocument()
      expect(screen.getByText(/控制点 \(2\)/)).toBeInTheDocument()
      expect(screen.getByText(/合规义务 \(2\)/)).toBeInTheDocument()
    })
  })

  describe('[P0] 失效模式卡片信息', () => {
    it('应该显示 code、name、category、controlPointCount', () => {
      render(
        <ReasoningChainVisualization
          data={mockData}
          loading={false}
          onSelectEntity={mockOnSelectEntity}
        />
      )

      expect(screen.getByText('FM-001')).toBeInTheDocument()
      expect(screen.getByText('战略不一致')).toBeInTheDocument()
      expect(screen.getByText('DEFINITION_ERROR')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  describe('[P0] 控制点卡片信息', () => {
    it('应该显示 code、name、maturityLevel、authoritativeScore、relevance Badge', () => {
      render(
        <ReasoningChainVisualization
          data={mockData}
          loading={false}
          onSelectEntity={mockOnSelectEntity}
        />
      )

      expect(screen.getByText('CP-001')).toBeInTheDocument()
      expect(screen.getByText('战略规划流程')).toBeInTheDocument()
      expect(screen.getByText('hard')).toBeInTheDocument()
      expect(screen.getByText('95%')).toBeInTheDocument()
      expect(screen.getByText('PRIMARY')).toBeInTheDocument()
    })
  })

  describe('[P0] 义务卡片信息', () => {
    it('应该显示 code、text、type、coverage', () => {
      render(
        <ReasoningChainVisualization
          data={mockData}
          loading={false}
          onSelectEntity={mockOnSelectEntity}
        />
      )

      expect(screen.getByText('OBL-001')).toBeInTheDocument()
      expect(screen.getByText('应当建立IT战略规划流程')).toBeInTheDocument()
      expect(screen.getByText('MANDATORY')).toBeInTheDocument()
      expect(screen.getByText('FULL')).toBeInTheDocument()
    })
  })

  describe('[P1] 点击失效模式卡片', () => {
    it('应该触发 onSelectEntity 回调', () => {
      render(
        <ReasoningChainVisualization
          data={mockData}
          loading={false}
          onSelectEntity={mockOnSelectEntity}
        />
      )

      const fmCard = screen.getByRole('button', { name: /失效模式 FM-001/ })
      fireEvent.click(fmCard)

      expect(mockOnSelectEntity).toHaveBeenCalledWith({
        type: 'failure-mode',
        id: 'fm-1',
      })
    })
  })

  describe('[P1] 点击控制点卡片', () => {
    it('应该触发 onSelectEntity 回调', () => {
      render(
        <ReasoningChainVisualization
          data={mockData}
          loading={false}
          onSelectEntity={mockOnSelectEntity}
        />
      )

      const cpCard = screen.getByRole('button', { name: /控制点 CP-001/ })
      fireEvent.click(cpCard)

      expect(mockOnSelectEntity).toHaveBeenCalledWith({
        type: 'control-point',
        id: 'cp-1',
      })
    })
  })

  describe('[P1] 选中的卡片高亮', () => {
    it('应该显示高亮样式 ring-2 ring-blue-500', () => {
      render(
        <ReasoningChainVisualization
          data={mockData}
          loading={false}
          onSelectEntity={mockOnSelectEntity}
          selectedEntityId="fm-1"
        />
      )

      const fmCard = screen.getByRole('button', { name: /失效模式 FM-001/ })
      expect(fmCard).toHaveClass('ring-2', 'ring-blue-500')
    })
  })

  describe('[P1] 搜索过滤', () => {
    it('应该正确过滤失效模式、控制点、义务', () => {
      render(
        <ReasoningChainVisualization
          data={mockData}
          loading={false}
          onSelectEntity={mockOnSelectEntity}
          searchQuery="战略规划"
        />
      )

      expect(screen.getByRole('button', { name: /控制点 CP-001/ })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /控制点 CP-002/ })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /义务 OBL-001/ })).toBeInTheDocument()
    })
  })

  describe('[P2] category 标签颜色', () => {
    it('应该显示正确的 CATEGORY_COLORS', () => {
      render(
        <ReasoningChainVisualization
          data={mockData}
          loading={false}
          onSelectEntity={mockOnSelectEntity}
        />
      )

      const definitionErrorBadge = screen.getByText('DEFINITION_ERROR')
      expect(definitionErrorBadge).toHaveClass('bg-red-100', 'text-red-800')

      const mappingErrorBadge = screen.getByText('MAPPING_ERROR')
      expect(mappingErrorBadge).toHaveClass('bg-orange-100', 'text-orange-800')
    })
  })

  describe('[P2] maturityLevel 标签颜色', () => {
    it('应该显示正确的 MATURITY_COLORS', () => {
      render(
        <ReasoningChainVisualization
          data={mockData}
          loading={false}
          onSelectEntity={mockOnSelectEntity}
        />
      )

      const hardBadge = screen.getByText('hard')
      expect(hardBadge).toHaveClass('bg-green-100', 'text-green-800')

      const draftHardBadge = screen.getByText('draft-hard')
      expect(draftHardBadge).toHaveClass('bg-yellow-100', 'text-yellow-800')
    })
  })
})
