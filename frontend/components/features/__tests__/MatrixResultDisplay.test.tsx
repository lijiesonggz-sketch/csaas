import { render, screen, fireEvent } from '@testing-library/react'
import MatrixResultDisplay from '../MatrixResultDisplay'

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

const mockResult = {
  taskId: 'matrix-task-123',
  projectId: 'project-123',
  selectedModel: 'GPT4',
  confidenceLevel: 'HIGH',
  selectedResult: {
    matrix: [
      {
        cluster_id: 'cluster-1',
        cluster_name: '测试聚类',
        levels: {
          level_1: {
            name: '初始级',
            description: '初始级描述',
            key_practices: ['实践1', '实践2'],
          },
          level_2: {
            name: '可重复级',
            description: '可重复级描述',
            key_practices: ['实践3', '实践4'],
          },
          level_3: {
            name: '已定义级',
            description: '已定义级描述',
            key_practices: ['实践5', '实践6'],
          },
          level_4: {
            name: '可管理级',
            description: '可管理级描述',
            key_practices: ['实践7', '实践8'],
          },
          level_5: {
            name: '优化级',
            description: '优化级描述',
            key_practices: ['实践9', '实践10'],
          },
        },
      },
    ],
    maturity_model_description: '成熟度模型说明',
  },
  qualityScores: {
    structural: 0.85,
    semantic: 0.9,
    detail: 0.88,
  },
}

describe('MatrixResultDisplay', () => {
  it('renders matrix result correctly', () => {
    render(<MatrixResultDisplay result={mockResult} />)

    // Check basic info is displayed
    expect(screen.getByText('矩阵生成完成！下一步：生成调研问卷')).toBeInTheDocument()
    // Task ID appears multiple times
    expect(screen.getAllByText('matrix-task-123').length).toBeGreaterThan(0)
  })

  it('displays matrix table headers', () => {
    render(<MatrixResultDisplay result={mockResult} />)

    expect(screen.getByText('成熟度矩阵 (1 行 × 5 列)')).toBeInTheDocument()
    expect(screen.getByText('聚类')).toBeInTheDocument()
    expect(screen.getByText('Level 1 (初始级)')).toBeInTheDocument()
    expect(screen.getByText('Level 5 (优化级)')).toBeInTheDocument()
  })

  it('displays cluster information in table', () => {
    render(<MatrixResultDisplay result={mockResult} />)

    expect(screen.getByText('测试聚类')).toBeInTheDocument()
    expect(screen.getByText('cluster-1')).toBeInTheDocument()
  })

  it('displays level information', () => {
    render(<MatrixResultDisplay result={mockResult} />)

    // '初始级' appears multiple times (in each level column)
    expect(screen.getAllByText('初始级').length).toBeGreaterThan(0)
    expect(screen.getByText('初始级描述')).toBeInTheDocument()
    // '关键实践：' appears multiple times
    expect(screen.getAllByText('关键实践：').length).toBeGreaterThan(0)
  })

  it('displays quality scores', () => {
    render(<MatrixResultDisplay result={mockResult} />)

    expect(screen.getByText('质量评分')).toBeInTheDocument()
    expect(screen.getByText('结构质量')).toBeInTheDocument()
    expect(screen.getByText('语义质量')).toBeInTheDocument()
    expect(screen.getByText('细节质量')).toBeInTheDocument()
  })

  it('displays maturity model description', () => {
    render(<MatrixResultDisplay result={mockResult} />)

    // '成熟度模型说明' appears in both title and content
    expect(screen.getAllByText('成熟度模型说明').length).toBeGreaterThan(0)
  })

  it('handles copy task ID button click', () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    })

    render(<MatrixResultDisplay result={mockResult} />)

    const copyButton = screen.getByRole('button', { name: /复制ID/i })
    fireEvent.click(copyButton)

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('matrix-task-123')
  })

  it('displays metadata cards', () => {
    render(<MatrixResultDisplay result={mockResult} />)

    expect(screen.getByText('任务ID')).toBeInTheDocument()
    expect(screen.getByText('选中模型')).toBeInTheDocument()
    expect(screen.getByText('置信度')).toBeInTheDocument()
    expect(screen.getByText('矩阵规模')).toBeInTheDocument()
  })
})
