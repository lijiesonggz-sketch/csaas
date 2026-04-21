import { fireEvent, render, screen } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { RegulationDrivenDetailPanel } from './RegulationDrivenDetailPanel'
import type { RegulationGraphData } from '@/lib/api/knowledge-graph'

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

const mockPush = jest.fn()

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

describe('RegulationDrivenDetailPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })
  })

  it('[P0] loading 时显示详情加载态', () => {
    render(
      <RegulationDrivenDetailPanel
        entityType={null}
        entityId={null}
        data={null}
        loading
      />,
    )

    expect(screen.getByText('加载详情中...')).toBeInTheDocument()
  })

  it('[P0] 渲染法规来源详情', () => {
    render(
      <RegulationDrivenDetailPanel
        entityType="regulation-source"
        entityId="source-1"
        data={mockData}
      />,
    )

    expect(screen.getByText('法规来源详情')).toBeInTheDocument()
    expect(screen.getByText('SRC-001')).toBeInTheDocument()
    expect(screen.getByText('监管数据报送管理指引')).toBeInTheDocument()
    expect(screen.getByText('监管机构')).toBeInTheDocument()
  })

  it('[P0] 渲染条文详情和关联义务', () => {
    render(
      <RegulationDrivenDetailPanel entityType="clause" entityId="clause-1" data={mockData} />,
    )

    expect(screen.getByText('法规条文详情')).toBeInTheDocument()
    expect(screen.getByText('CLAUSE-001')).toBeInTheDocument()
    expect(screen.getAllByText('应当建立监管报送复核机制').length).toBeGreaterThan(1)
    expect(screen.getByText('关联法规义务')).toBeInTheDocument()
    expect(screen.getByText('OBL-001')).toBeInTheDocument()
  })

  it('[P1] 从义务详情跳转到 Obligation 管理页', () => {
    render(
      <RegulationDrivenDetailPanel
        entityType="obligation"
        entityId="ob-1"
        data={mockData}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '在 Obligation 管理中查看' }))

    expect(mockPush).toHaveBeenCalledWith('/admin/obligations?obligationId=ob-1')
  })

  it('[P1] 从控制点详情跳转到所属义务', () => {
    render(
      <RegulationDrivenDetailPanel
        entityType="regulation-control-point"
        entityId="clause-1:ob-1:cp-1"
        data={mockData}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '查看所属义务' }))

    expect(mockPush).toHaveBeenCalledWith('/admin/obligations?obligationId=ob-1')
  })
})
