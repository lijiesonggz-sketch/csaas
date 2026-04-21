import { fireEvent, render, screen } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { KnowledgeGraphDetailPanel } from './KnowledgeGraphDetailPanel'
import type { ReasoningChainData } from '@/lib/api/knowledge-graph'

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

const mockPush = jest.fn()

const mockReasoningChain: ReasoningChainData = {
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
      name: '战略与业务不一致',
      category: 'DEFINITION_ERROR',
      controlPointCount: 2,
    },
  ],
  controlPoints: [
    {
      controlId: 'cp-1',
      controlCode: 'CP-001',
      controlName: '战略规划流程',
      maturityLevel: 'hard',
      authoritativeScore: 95,
      originType: 'standard',
      failureModeRelevance: 'PRIMARY',
      failureModeId: 'fm-1',
    },
    {
      controlId: 'cp-2',
      controlCode: 'CP-002',
      controlName: '投资审批机制',
      maturityLevel: 'draft-hard',
      authoritativeScore: 80,
      originType: 'case',
      failureModeRelevance: 'SECONDARY',
      failureModeId: 'fm-1',
    },
  ],
  obligations: [
    {
      obligationId: 'ob-1',
      obligationCode: 'OBL-001',
      obligationText: '应当建立 IT 战略规划流程',
      obligationType: 'MANDATORY',
      controlId: 'cp-1',
      coverage: 'FULL',
    },
    {
      obligationId: 'ob-2',
      obligationCode: 'OBL-002',
      obligationText: '应当定期复核 IT 投资审批',
      obligationType: 'RECOMMENDED',
      controlId: 'cp-1',
      coverage: 'PARTIAL',
    },
  ],
}

describe('KnowledgeGraphDetailPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })
  })

  it('[P0] 在 loading 时显示详情加载状态', () => {
    render(
      <KnowledgeGraphDetailPanel
        entityType={null}
        entityId={null}
        reasoningChain={null}
        loading
      />,
    )

    expect(screen.getByText('加载详情中...')).toBeInTheDocument()
  })

  it('[P0] 未选择实体时显示占位提示', () => {
    render(
      <KnowledgeGraphDetailPanel
        entityType={null}
        entityId={null}
        reasoningChain={mockReasoningChain}
      />,
    )

    expect(screen.getByText('点击推理链路中的卡片查看详情')).toBeInTheDocument()
  })

  it('[P0] 渲染失效模式详情、关联控制点和义务', () => {
    render(
      <KnowledgeGraphDetailPanel
        entityType="failure-mode"
        entityId="fm-1"
        reasoningChain={mockReasoningChain}
      />,
    )

    expect(screen.getByText('失效模式详情')).toBeInTheDocument()
    expect(screen.getByText('FM-001')).toBeInTheDocument()
    expect(screen.getByText('战略与业务不一致')).toBeInTheDocument()
    expect(screen.getByText('DEFINITION_ERROR')).toBeInTheDocument()
    expect(screen.getByText('战略与治理 / IT战略规划')).toBeInTheDocument()
    expect(screen.getByText('关联控制点')).toBeInTheDocument()
    expect(screen.getByText('CP-001')).toBeInTheDocument()
    expect(screen.getByText('投资审批机制')).toBeInTheDocument()
    expect(screen.getByText('关联合规义务')).toBeInTheDocument()
    expect(screen.getByText('OBL-001')).toBeInTheDocument()
    expect(screen.getByText('OBL-002')).toBeInTheDocument()
  })

  it('[P1] 从失效模式详情跳转到 Failure Mode 管理页', () => {
    render(
      <KnowledgeGraphDetailPanel
        entityType="failure-mode"
        entityId="fm-1"
        reasoningChain={mockReasoningChain}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '在 Failure Mode 管理中查看' }))

    expect(mockPush).toHaveBeenCalledWith('/admin/failure-modes?failureModeId=fm-1')
  })

  it('[P1] 从失效模式详情跳转到 Obligation 管理页', () => {
    render(
      <KnowledgeGraphDetailPanel
        entityType="failure-mode"
        entityId="fm-1"
        reasoningChain={mockReasoningChain}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /OBL-001 应当建立 IT 战略规划流程/ }))

    expect(mockPush).toHaveBeenCalledWith('/admin/obligations?obligationId=ob-1')
  })

  it('[P0] 渲染控制点详情、关联失效模式和义务', () => {
    render(
      <KnowledgeGraphDetailPanel
        entityType="control-point"
        entityId="cp-1"
        reasoningChain={mockReasoningChain}
      />,
    )

    expect(screen.getByText('控制点详情')).toBeInTheDocument()
    expect(screen.getByText('CP-001')).toBeInTheDocument()
    expect(screen.getByText('战略规划流程')).toBeInTheDocument()
    expect(screen.getByText('hard')).toBeInTheDocument()
    expect(screen.getByText('95%')).toBeInTheDocument()
    expect(screen.getByText('standard')).toBeInTheDocument()
    expect(screen.getByText('PRIMARY')).toBeInTheDocument()
    expect(screen.getByText('关联失效模式')).toBeInTheDocument()
    expect(screen.getByText('FM-001')).toBeInTheDocument()
    expect(screen.getByText('关联合规义务')).toBeInTheDocument()
    expect(screen.getByText('OBL-001')).toBeInTheDocument()
    expect(screen.getByText('OBL-002')).toBeInTheDocument()
  })

  it('[P1] 点击关联合规义务跳转到 Obligation 管理页', () => {
    render(
      <KnowledgeGraphDetailPanel
        entityType="control-point"
        entityId="cp-1"
        reasoningChain={mockReasoningChain}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /OBL-001 应当建立 IT 战略规划流程/ }))

    expect(mockPush).toHaveBeenCalledWith('/admin/obligations?obligationId=ob-1')
  })

  it('[P1] 找不到实体时显示空状态', () => {
    render(
      <KnowledgeGraphDetailPanel
        entityType="control-point"
        entityId="missing-id"
        reasoningChain={mockReasoningChain}
      />,
    )

    expect(screen.getByText('未找到对应的实体数据')).toBeInTheDocument()
  })
})
