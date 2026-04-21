import { fireEvent, render, screen } from '@testing-library/react'
import { RegulationDrivenVisualization } from './RegulationDrivenVisualization'
import type { RegulationGraphData } from '@/lib/api/knowledge-graph'

const mockOnSelectEntity = jest.fn()

const mockData: RegulationGraphData = {
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
      authoritativeScore: 92,
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

describe('RegulationDrivenVisualization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('[P0] loading 时显示法规驱动线加载态', () => {
    render(
      <RegulationDrivenVisualization
        data={null}
        loading
        onSelectEntity={mockOnSelectEntity}
      />,
    )

    expect(screen.getByText('加载法规驱动线中...')).toBeInTheDocument()
  })

  it('[P0] 无数据时显示占位提示', () => {
    render(
      <RegulationDrivenVisualization
        data={null}
        loading={false}
        onSelectEntity={mockOnSelectEntity}
      />,
    )

    expect(screen.getByText('请从左侧选择法规来源查看法规驱动线')).toBeInTheDocument()
  })

  it('[P0] 渲染法规条文、义务和控制点三列', () => {
    render(
      <RegulationDrivenVisualization
        data={mockData}
        loading={false}
        onSelectEntity={mockOnSelectEntity}
      />,
    )

    expect(screen.getByText('监管数据报送管理指引')).toBeInTheDocument()
    expect(screen.getByText(/法规条文 \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/法规义务 \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/控制点 \(1\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /法规条文 CLAUSE-001/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /法规义务 OBL-001/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /控制点 CP-001/ })).toBeInTheDocument()
  })

  it('[P1] 点击条文卡片触发实体选择', () => {
    render(
      <RegulationDrivenVisualization
        data={mockData}
        loading={false}
        onSelectEntity={mockOnSelectEntity}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /法规条文 CLAUSE-001/ }))

    expect(mockOnSelectEntity).toHaveBeenCalledWith({
      type: 'clause',
      id: 'clause-1',
    })
  })

  it('[P1] 搜索时保留链路连续性', () => {
    render(
      <RegulationDrivenVisualization
        data={mockData}
        loading={false}
        onSelectEntity={mockOnSelectEntity}
        searchQuery="复核"
      />,
    )

    expect(screen.getByRole('button', { name: /法规条文 CLAUSE-001/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /法规义务 OBL-001/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /控制点 CP-001/ })).toBeInTheDocument()
  })
})
