import { render, screen, fireEvent } from '@testing-library/react'
import ClusteringResultDisplay from '../ClusteringResultDisplay'

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

const mockResult = {
  taskId: 'test-task-123',
  projectId: 'project-123',
  content: JSON.stringify({
    categories: [
      {
        id: 'cat-1',
        name: '测试大类',
        description: '测试大类描述',
        clusters: [
          {
            id: 'cluster-1',
            name: '测试聚类',
            description: '测试聚类描述',
            importance: 'HIGH',
            risk_level: 'HIGH',
            clauses: [
              {
                source_document_id: 'doc-1',
                source_document_name: '测试文档',
                clause_id: '第一条',
                clause_text: '测试条款内容',
                rationale: '归类理由',
              },
            ],
          },
        ],
      },
    ],
    clustering_logic: '测试聚类逻辑',
    coverage_summary: {
      by_document: {
        'doc-1': {
          total_clauses: 10,
          clustered_clauses: 8,
          missing_clause_ids: ['第二条'],
        },
      },
      overall: {
        total_clauses: 10,
        clustered_clauses: 8,
        coverage_rate: 0.8,
      },
    },
  }),
  selectedModel: 'GPT4',
  confidenceLevel: 'HIGH',
}

const mockDocuments = [
  {
    id: 'doc-1',
    name: '测试文档',
    content: '第一条 测试内容\n第二条 测试内容',
  },
]

describe('ClusteringResultDisplay', () => {
  it('renders clustering result correctly', () => {
    render(
      <ClusteringResultDisplay result={mockResult} documents={mockDocuments} />
    )

    // Check basic info is displayed
    expect(screen.getByText('聚类任务完成！下一步：生成成熟度矩阵')).toBeInTheDocument()
    expect(screen.getByText('test-task-123')).toBeInTheDocument()
  })

  it('displays category and cluster information', () => {
    render(
      <ClusteringResultDisplay result={mockResult} documents={mockDocuments} />
    )

    expect(screen.getByText('测试大类')).toBeInTheDocument()
    expect(screen.getByText('测试聚类')).toBeInTheDocument()
  })

  it('displays coverage statistics', () => {
    render(
      <ClusteringResultDisplay result={mockResult} documents={mockDocuments} />
    )

    expect(screen.getByText('覆盖率统计')).toBeInTheDocument()
  })

  it('displays clustering logic', () => {
    render(
      <ClusteringResultDisplay result={mockResult} documents={mockDocuments} />
    )

    expect(screen.getByText('聚类逻辑')).toBeInTheDocument()
    expect(screen.getByText('测试聚类逻辑')).toBeInTheDocument()
  })

  it('handles copy task ID button click', () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    })

    render(
      <ClusteringResultDisplay result={mockResult} documents={mockDocuments} />
    )

    const copyButton = screen.getByRole('button', { name: /复制ID/i })
    fireEvent.click(copyButton)

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test-task-123')
  })

  it('handles invalid result data gracefully', () => {
    const invalidResult = {
      ...mockResult,
      content: 'invalid json',
    }

    render(
      <ClusteringResultDisplay result={invalidResult} documents={mockDocuments} />
    )

    expect(screen.getByText('数据解析失败')).toBeInTheDocument()
  })

  it('handles missing categories gracefully', () => {
    const invalidResult = {
      ...mockResult,
      content: JSON.stringify({}),
    }

    render(
      <ClusteringResultDisplay result={invalidResult} documents={mockDocuments} />
    )

    expect(screen.getByText('数据格式错误')).toBeInTheDocument()
  })
})
