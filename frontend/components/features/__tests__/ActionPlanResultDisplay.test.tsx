import { render, screen, fireEvent } from '@testing-library/react'
import ActionPlanResultDisplay from '../ActionPlanResultDisplay'

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}))

// Mock xlsx
jest.mock('xlsx', () => ({
  utils: {
    book_new: jest.fn(() => ({})),
    aoa_to_sheet: jest.fn(() => ({})),
    book_append_sheet: jest.fn(),
  },
  writeFile: jest.fn(),
}))

const mockResult = {
  taskId: 'actionplan-task-123',
  selectedResult: {
    improvements: [
      {
        area: '测试领域',
        actions: ['措施1', '措施2', '措施3'],
        priority: '高',
        timeline: '3个月',
        resources: '测试资源',
        targetLevel: 'Level 3',
        currentLevel: 'Level 1',
        expectedOutcome: '预期成果',
      },
      {
        area: '测试领域2',
        actions: ['措施4', '措施5'],
        priority: '中',
        timeline: '6个月',
        resources: '测试资源2',
        targetLevel: 'Level 4',
        currentLevel: 'Level 2',
        expectedOutcome: '预期成果2',
      },
    ],
    summary: '改进措施概述文本',
    metadata: {
      timeline: '6个月',
      clusterCount: 2,
      generatedAt: new Date().toISOString(),
    },
    totalMeasures: 5,
  },
}

describe('ActionPlanResultDisplay', () => {
  it('renders action plan result correctly', () => {
    render(<ActionPlanResultDisplay result={mockResult} />)

    // Check basic info is displayed
    expect(screen.getByText('改进措施概述')).toBeInTheDocument()
    expect(screen.getByText('改进措施概述文本')).toBeInTheDocument()
  })

  it('displays statistics overview', () => {
    render(<ActionPlanResultDisplay result={mockResult} />)

    expect(screen.getByText('改进领域')).toBeInTheDocument()
    expect(screen.getByText('总措施数')).toBeInTheDocument()
    // Use getAllByText for '高优先级' since it appears multiple times
    expect(screen.getAllByText('高优先级').length).toBeGreaterThan(0)
  })

  it('displays improvement details', () => {
    render(<ActionPlanResultDisplay result={mockResult} />)

    expect(screen.getByText('改进措施详情')).toBeInTheDocument()
    expect(screen.getByText('1. 测试领域')).toBeInTheDocument()
    // Use getAllByText for '高优先级' since it appears multiple times
    expect(screen.getAllByText('高优先级').length).toBeGreaterThan(0)
  })

  it('displays improvement actions', () => {
    render(<ActionPlanResultDisplay result={mockResult} />)

    expect(screen.getByText('改进措施 (3项)')).toBeInTheDocument()
    expect(screen.getByText('措施1')).toBeInTheDocument()
    expect(screen.getByText('措施2')).toBeInTheDocument()
    expect(screen.getByText('措施3')).toBeInTheDocument()
  })

  it('displays metadata information', () => {
    render(<ActionPlanResultDisplay result={mockResult} />)

    expect(screen.getByText('实施计划')).toBeInTheDocument()
    // These appear multiple times
    expect(screen.getAllByText('时间周期').length).toBeGreaterThan(0)
    expect(screen.getAllByText('6个月').length).toBeGreaterThan(0)
    expect(screen.getByText('聚类数量')).toBeInTheDocument()
  })

  it('handles export buttons', () => {
    render(<ActionPlanResultDisplay result={mockResult} />)

    const exportCSVButton = screen.getByRole('button', { name: /导出CSV/i })
    const exportExcelButton = screen.getByRole('button', { name: /导出Excel/i })
    const exportWordButton = screen.getByRole('button', { name: /导出Word/i })

    expect(exportCSVButton).toBeInTheDocument()
    expect(exportExcelButton).toBeInTheDocument()
    expect(exportWordButton).toBeInTheDocument()
  })
})
