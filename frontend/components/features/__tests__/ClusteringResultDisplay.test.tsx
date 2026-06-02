import { render, screen, fireEvent } from '@testing-library/react'
import ClusteringResultDisplay from '../ClusteringResultDisplay'

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

// Mock Accordion to always render content (Radix Accordion doesn't expand in JSDOM)
jest.mock('@/components/ui/accordion', () => ({
  Accordion: ({ children }: any) => <div>{children}</div>,
  AccordionItem: ({ children, value }: any) => (
    <div data-testid={`accordion-item-${value}`}>{children}</div>
  ),
  AccordionTrigger: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  AccordionContent: ({ children }: any) => <div>{children}</div>,
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
    render(<ClusteringResultDisplay result={mockResult} documents={mockDocuments} />)

    expect(screen.getByText('聚类任务完成！下一步：生成成熟度矩阵')).toBeInTheDocument()
    expect(screen.getByText('test-task-123')).toBeInTheDocument()
  })

  it('displays category and cluster information', () => {
    render(<ClusteringResultDisplay result={mockResult} documents={mockDocuments} />)

    expect(screen.getByText('测试大类')).toBeInTheDocument()
    expect(screen.getByText('测试聚类')).toBeInTheDocument()
  })

  it('displays coverage statistics', () => {
    render(<ClusteringResultDisplay result={mockResult} documents={mockDocuments} />)

    expect(screen.getByText('覆盖率统计')).toBeInTheDocument()
  })

  it('displays structured generation mode when present', () => {
    const structuredResult = {
      ...mockResult,
      content: JSON.stringify({
        ...JSON.parse(mockResult.content),
        generation_mode: 'structured',
      }),
    }

    render(<ClusteringResultDisplay result={structuredResult} documents={mockDocuments} />)

    expect(screen.getByText('生成方式：原始层级映射')).toBeInTheDocument()
  })

  it('uses stored coverage for structured results instead of overwriting it with browser recalculation', () => {
    const structuredResult = {
      ...mockResult,
      content: JSON.stringify({
        categories: [
          {
            id: 'cat-1',
            name: 'AIMM',
            description: 'AIMM',
            clusters: [
              {
                id: 'cluster-1',
                name: '战略规划',
                description: '战略规划要求',
                importance: 'HIGH',
                risk_level: 'HIGH',
                clauses: [
                  {
                    source_document_id: 'doc-aimm',
                    source_document_name: 'AIMM',
                    clause_id: '5.1.2-a',
                    clause_text: '利益相关者分析',
                    rationale: '战略规划要求',
                  },
                ],
              },
            ],
          },
        ],
        clustering_logic: '按原始层级生成',
        generation_mode: 'structured',
        coverage_summary: {
          by_document: {
            'doc-aimm': {
              total_clauses: 2,
              clustered_clauses: 2,
              missing_clause_ids: [],
              coverage_granularity: 'leaf_requirement',
            },
          },
          overall: {
            total_clauses: 2,
            clustered_clauses: 2,
            coverage_rate: 1,
            coverage_granularity: 'leaf_requirement',
          },
        },
      }),
    }

    render(
      <ClusteringResultDisplay
        result={structuredResult}
        documents={[
          {
            id: 'doc-aimm',
            name: 'AIMM',
            content: [
              '5.1.2 过程描述',
              'a) 利益相关者分析，明确利益相关者的需求；',
              'b) 战略需求评估，明确人工智能战略需求范围；',
            ].join('\n'),
          },
        ]}
      />
    )

    expect(screen.getByText('100.0% (2/2)')).toBeInTheDocument()
    expect(screen.queryByText('50.0% (1/2)')).not.toBeInTheDocument()
  })

  it('syncs coverage state when the result prop changes without remounting', () => {
    const oldResult = {
      ...mockResult,
      taskId: 'old-task',
      content: JSON.stringify({
        ...JSON.parse(mockResult.content),
        coverage_summary: {
          by_document: {
            'doc-1': {
              total_clauses: 519,
              clustered_clauses: 154,
              missing_clause_ids: ['5.1.2-a'],
            },
          },
          overall: {
            total_clauses: 519,
            clustered_clauses: 154,
            coverage_rate: 154 / 519,
          },
        },
      }),
    }
    const newResult = {
      ...mockResult,
      taskId: 'new-task',
      content: JSON.stringify({
        ...JSON.parse(mockResult.content),
        generation_mode: 'structured',
        coverage_summary: {
          by_document: {
            'doc-1': {
              total_clauses: 519,
              clustered_clauses: 519,
              missing_clause_ids: [],
              coverage_granularity: 'leaf_requirement',
            },
          },
          overall: {
            total_clauses: 519,
            clustered_clauses: 519,
            coverage_rate: 1,
            coverage_granularity: 'leaf_requirement',
          },
        },
      }),
    }

    const { rerender } = render(<ClusteringResultDisplay result={oldResult} documents={[]} />)
    expect(screen.getByText('29.7% (154/519)')).toBeInTheDocument()

    rerender(<ClusteringResultDisplay result={newResult} documents={[]} />)

    expect(screen.getByText('100.0% (519/519)')).toBeInTheDocument()
    expect(screen.queryByText('29.7% (154/519)')).not.toBeInTheDocument()
  })

  it('normalizes stale coverage summaries with clustered clauses but zero total clauses', () => {
    const staleCoverageResult = {
      ...mockResult,
      content: JSON.stringify({
        categories: [
          {
            id: 'cat-1',
            name: '成熟度要求',
            description: '成熟度要求描述',
            clusters: [
              {
                id: 'cluster-1',
                name: '战略规划',
                description: '战略规划要求',
                importance: 'HIGH',
                risk_level: 'HIGH',
                clauses: [
                  {
                    source_document_id: 'doc-1',
                    source_document_name: 'GB/T 33136',
                    clause_id: '战略管理-规范级',
                    clause_text: '制定数据中心战略规划',
                    rationale: '同属战略管理能力项',
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
              total_clauses: 0,
              clustered_clauses: 47,
              missing_clause_ids: [],
            },
          },
          overall: {
            total_clauses: 0,
            clustered_clauses: 47,
            coverage_rate: 0,
          },
        },
      }),
    }

    render(<ClusteringResultDisplay result={staleCoverageResult} documents={[]} />)

    expect(screen.getByText('100.0% (47/47)')).toBeInTheDocument()
  })

  it('recalculates legacy stored coverage with leaf requirement matching when documents are available', () => {
    const legacyCoverageResult = {
      ...mockResult,
      content: JSON.stringify({
        categories: [
          {
            id: 'cat-1',
            name: 'AIMM',
            description: 'AIMM',
            clusters: [
              {
                id: 'cluster-1',
                name: '战略规划',
                description: '战略规划要求',
                importance: 'HIGH',
                risk_level: 'HIGH',
                clauses: [
                  {
                    source_document_id: 'doc-aimm',
                    source_document_name: 'AIMM',
                    clause_id: '5.1.2 a)',
                    clause_text: '利益相关者分析',
                    rationale: '战略规划要求',
                  },
                ],
              },
            ],
          },
        ],
        clustering_logic: '测试聚类逻辑',
        coverage_summary: {
          by_document: {
            'doc-aimm': {
              total_clauses: 112,
              clustered_clauses: 7,
              missing_clause_ids: [],
            },
          },
          overall: {
            total_clauses: 112,
            clustered_clauses: 7,
            coverage_rate: 0.0625,
          },
        },
      }),
    }

    render(
      <ClusteringResultDisplay
        result={legacyCoverageResult}
        documents={[
          {
            id: 'doc-aimm',
            name: 'AIMM',
            content: [
              '5.1.2 过程描述',
              '过程描述如下：',
              'a) 利益相关者分析，明确利益相关者的需求；',
              'b) 战略需求评估，明确人工智能战略需求范围；',
            ].join('\n'),
          },
        ]}
      />
    )

    expect(screen.getByText('50.0% (1/2)')).toBeInTheDocument()
    expect(screen.getByText('覆盖粒度：叶子要求项')).toBeInTheDocument()
  })

  it('displays clustering logic', () => {
    render(<ClusteringResultDisplay result={mockResult} documents={mockDocuments} />)

    expect(screen.getByText('聚类逻辑')).toBeInTheDocument()
    expect(screen.getByText('测试聚类逻辑')).toBeInTheDocument()
  })

  it('handles copy task ID button click', () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    })

    render(<ClusteringResultDisplay result={mockResult} documents={mockDocuments} />)

    const copyButton = screen.getByRole('button', { name: /复制ID/i })
    fireEvent.click(copyButton)

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test-task-123')
  })

  it('handles invalid result data gracefully', () => {
    const invalidResult = {
      ...mockResult,
      content: 'invalid json',
    }

    render(<ClusteringResultDisplay result={invalidResult} documents={mockDocuments} />)

    expect(screen.getByText('数据解析失败')).toBeInTheDocument()
  })

  it('handles missing categories gracefully', () => {
    const invalidResult = {
      ...mockResult,
      content: JSON.stringify({}),
    }

    render(<ClusteringResultDisplay result={invalidResult} documents={mockDocuments} />)

    expect(screen.getByText('数据格式错误')).toBeInTheDocument()
  })
})
