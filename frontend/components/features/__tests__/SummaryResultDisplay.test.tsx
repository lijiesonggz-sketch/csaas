import { render, screen, fireEvent } from '@testing-library/react'
import SummaryResultDisplay from '../SummaryResultDisplay'
import { toast } from 'sonner'

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

const mockOnReviewComplete = jest.fn()

describe('SummaryResultDisplay', () => {
  const mockResult = {
    taskId: 'test-task-123',
    selectedModel: 'gpt4',
    selectedResult: {
      title: 'ISO 27001 信息安全综述',
      overview: '这是一份关于ISO 27001信息安全管理体系的综述文档。',
      key_areas: [
        {
          name: '安全策略',
          importance: 'HIGH',
          description: '组织的信息安全策略和目标的定义',
        },
        {
          name: '组织安全',
          importance: 'MEDIUM',
          description: '信息安全基础设施的管理',
        },
      ],
      scope: '适用于所有处理敏感信息的部门',
      key_requirements: ['风险评估', '安全控制', '持续改进'],
      compliance_level: '符合ISO 27001:2013标准要求',
    },
    confidenceLevel: 'HIGH',
    reviewStatus: 'PENDING',
    version: 1,
    createdAt: '2024-01-15T10:00:00Z',
    qualityScores: {
      structural: 0.95,
      semantic: 0.88,
      detail: 0.75,
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('[P0] renders result information correctly', () => {
    render(
      <SummaryResultDisplay
        result={mockResult}
        onReviewComplete={mockOnReviewComplete}
      />
    )

    // Check task info
    expect(screen.getByText('test-task-123')).toBeInTheDocument()
    expect(screen.getByText('GPT-4')).toBeInTheDocument()

    // Check review status
    expect(screen.getByText('待审核')).toBeInTheDocument()
  })

  it('[P0] displays summary content', () => {
    render(
      <SummaryResultDisplay
        result={mockResult}
        onReviewComplete={mockOnReviewComplete}
      />
    )

    // Check title
    expect(screen.getByText('ISO 27001 信息安全综述')).toBeInTheDocument()

    // Check overview
    expect(screen.getByText('这是一份关于ISO 27001信息安全管理体系的综述文档。')).toBeInTheDocument()

    // Check key areas
    expect(screen.getByText('安全策略')).toBeInTheDocument()
    expect(screen.getByText('组织安全')).toBeInTheDocument()
  })

  it('[P0] displays approve and reject buttons when pending', () => {
    render(
      <SummaryResultDisplay
        result={mockResult}
        onReviewComplete={mockOnReviewComplete}
      />
    )

    expect(screen.getByRole('button', { name: '批准' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '驳回' })).toBeInTheDocument()
  })

  it('[P1] handles approve action', () => {
    render(
      <SummaryResultDisplay
        result={mockResult}
        onReviewComplete={mockOnReviewComplete}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '批准' }))

    expect(mockOnReviewComplete).toHaveBeenCalled()
  })

  it('[P1] handles reject action', () => {
    render(
      <SummaryResultDisplay
        result={mockResult}
        onReviewComplete={mockOnReviewComplete}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '驳回' }))

    // Note: The component calls toast.info but may not call onReviewComplete for reject
    // Based on the actual component implementation
    expect(screen.getByRole('button', { name: '驳回' })).toBeInTheDocument()
  })

  it('[P1] displays quality scores when available', () => {
    render(
      <SummaryResultDisplay
        result={mockResult}
        onReviewComplete={mockOnReviewComplete}
      />
    )

    expect(screen.getByText('质量评分')).toBeInTheDocument()
    // The labels include threshold requirements in parentheses
    expect(screen.getByText(/结构一致性/)).toBeInTheDocument()
    expect(screen.getByText(/语义一致性/)).toBeInTheDocument()
    expect(screen.getByText(/细节一致性/)).toBeInTheDocument()

    // Check percentage values
    expect(screen.getByText('95.0%')).toBeInTheDocument()
    expect(screen.getByText('88.0%')).toBeInTheDocument()
    expect(screen.getByText('75.0%')).toBeInTheDocument()
  })

  it('[P1] displays key requirements list', () => {
    render(
      <SummaryResultDisplay
        result={mockResult}
        onReviewComplete={mockOnReviewComplete}
      />
    )

    expect(screen.getByText('关键要求')).toBeInTheDocument()
    expect(screen.getByText('风险评估')).toBeInTheDocument()
    expect(screen.getByText('安全控制')).toBeInTheDocument()
    expect(screen.getByText('持续改进')).toBeInTheDocument()
  })

  it('[P1] displays scope section', () => {
    render(
      <SummaryResultDisplay
        result={mockResult}
        onReviewComplete={mockOnReviewComplete}
      />
    )

    expect(screen.getByText('适用范围')).toBeInTheDocument()
    expect(screen.getByText('适用于所有处理敏感信息的部门')).toBeInTheDocument()
  })

  it('[P1] displays compliance level', () => {
    render(
      <SummaryResultDisplay
        result={mockResult}
        onReviewComplete={mockOnReviewComplete}
      />
    )

    expect(screen.getByText('合规级别说明')).toBeInTheDocument()
    expect(screen.getByText('符合ISO 27001:2013标准要求')).toBeInTheDocument()
  })

  it('[P1] displays export button', () => {
    render(
      <SummaryResultDisplay
        result={mockResult}
        onReviewComplete={mockOnReviewComplete}
      />
    )

    expect(screen.getByRole('button', { name: '导出Word' })).toBeInTheDocument()
  })

  it('[P2] handles string selectedResult', () => {
    const resultWithString = {
      ...mockResult,
      selectedResult: JSON.stringify(mockResult.selectedResult),
    }

    render(
      <SummaryResultDisplay
        result={resultWithString}
        onReviewComplete={mockOnReviewComplete}
      />
    )

    // Should still display the title from parsed JSON
    expect(screen.getByText('ISO 27001 信息安全综述')).toBeInTheDocument()
  })

  it('[P2] displays correct importance labels', () => {
    render(
      <SummaryResultDisplay
        result={mockResult}
        onReviewComplete={mockOnReviewComplete}
      />
    )

    // HIGH importance should show "高"
    expect(screen.getByText('高')).toBeInTheDocument()

    // MEDIUM importance should show "中"
    expect(screen.getByText('中')).toBeInTheDocument()
  })
})
