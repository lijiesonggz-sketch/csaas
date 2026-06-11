import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import MissingClausesHandler from '../MissingClausesHandler'

/**
 * MissingClausesHandler 组件测试
 *
 * 测试场景：
 * 1. 所有条款已覆盖 - 显示成功消息
 * 2. 覆盖率不完整但无明确缺失条款 - 显示信息提示
 * 3. 有缺失条款 - 显示缺失条款列表
 * 4. 分配到现有聚类对话框
 * 5. 新建聚类对话框
 */

const mockCategories = [
  {
    id: 'cat1',
    name: '信息安全管理',
    description: '信息安全管理相关条款',
    clusters: [
      {
        id: 'cluster1',
        name: '访问控制',
        description: '访问控制相关',
        clauses: [
          {
            source_document_id: 'doc1',
            source_document_name: '测试文档',
            clause_id: '第一条',
            clause_text: '测试条款内容',
            rationale: '测试理由',
          },
        ],
        importance: 'HIGH' as const,
        risk_level: 'HIGH' as const,
      },
    ],
  },
]

// Documents with a missing clause (第二条 is not clustered)
const mockDocumentsWithMissing = [
  {
    id: 'doc1',
    name: '测试文档',
    content: '第一条 已聚类的条款内容 第二条 缺失的条款内容',
  },
]

// Documents where all clauses are clustered
const mockDocumentsAllCovered = [
  {
    id: 'doc1',
    name: '测试文档',
    content: '第一条 已聚类的条款内容',
  },
]

const mockCoverageComplete = {
  doc1: {
    total_clauses: 1,
    clustered_clauses: 1,
    missing_clause_ids: [],
  },
}

const mockCoverageIncomplete = {
  doc1: {
    total_clauses: 2,
    clustered_clauses: 1,
    missing_clause_ids: ['第二条'],
  },
}

describe('MissingClausesHandler', () => {
  const mockOnUpdateClustering = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('所有条款已覆盖', () => {
    it('应该显示成功消息', () => {
      render(
        <MissingClausesHandler
          taskId="task1"
          coverageByDocument={mockCoverageComplete}
          documents={mockDocumentsAllCovered}
          categories={mockCategories}
          onUpdateClustering={mockOnUpdateClustering}
        />
      )
      expect(screen.getByText(/所有条款已完整覆盖/)).toBeInTheDocument()
    })

    it('不应该显示缺失条款列表', () => {
      render(
        <MissingClausesHandler
          taskId="task1"
          coverageByDocument={mockCoverageComplete}
          documents={mockDocumentsAllCovered}
          categories={mockCategories}
          onUpdateClustering={mockOnUpdateClustering}
        />
      )
      expect(screen.queryByText('缺失条款列表')).not.toBeInTheDocument()
    })
  })

  describe('覆盖率不完整但无明确缺失条款', () => {
    it('应该显示覆盖率统计信息', () => {
      // All clauses in content are clustered, but stats show incomplete
      const incompleteCoverage = {
        doc1: {
          total_clauses: 5,
          clustered_clauses: 1,
          missing_clause_ids: [],
        },
      }
      render(
        <MissingClausesHandler
          taskId="task1"
          coverageByDocument={incompleteCoverage}
          documents={mockDocumentsAllCovered}
          categories={mockCategories}
          onUpdateClustering={mockOnUpdateClustering}
        />
      )
      expect(screen.getByText(/覆盖率统计信息/)).toBeInTheDocument()
    })
  })

  describe('有缺失条款', () => {
    it('不同文档存在相同缺失条款号时不应该产生重复key警告', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <MissingClausesHandler
          taskId="task1"
          coverageByDocument={{
            doc1: {
              total_clauses: 1,
              clustered_clauses: 0,
              missing_clause_ids: ['第一条'],
            },
            doc2: {
              total_clauses: 1,
              clustered_clauses: 0,
              missing_clause_ids: ['第一条'],
            },
          }}
          documents={[
            {
              id: 'doc1',
              name: '文档一',
              content: '第一条 文档一的缺失条款',
            },
            {
              id: 'doc2',
              name: '文档二',
              content: '第一条 文档二的缺失条款',
            },
          ]}
          categories={[]}
          onUpdateClustering={mockOnUpdateClustering}
        />
      )

      expect(screen.getByText(/共发现 2 个缺失条款/)).toBeInTheDocument()
      expect(
        consoleErrorSpy.mock.calls.some((call) =>
          call.some((message) =>
            String(message).includes('Encountered two children with the same key')
          )
        )
      ).toBe(false)

      consoleErrorSpy.mockRestore()
    })

    it('应该用规范化条款ID计算AIMM叶子要求项缺失列表并提取原文内容', () => {
      const aimmDocuments = [
        {
          id: 'doc1',
          name: 'AIMM文档',
          content: [
            '5.1.2 数据治理',
            'a) 应建立数据治理组织机制。',
            'b) 应制定并持续改进数据治理制度。',
            '5.1.3 模型治理',
            'a) 应建立模型风险管理机制。',
          ].join('\n'),
        },
      ]
      const aimmCategories = [
        {
          id: 'cat1',
          name: '治理能力',
          description: '治理能力相关要求',
          clusters: [
            {
              id: 'cluster1',
              name: '数据治理机制',
              description: '数据治理机制相关要求',
              clauses: [
                {
                  source_document_id: 'doc1',
                  source_document_name: 'AIMM文档',
                  clause_id: '5.1.2 a)',
                  clause_text: '应建立数据治理组织机制。',
                  rationale: '测试理由',
                },
                {
                  source_document_id: 'doc1',
                  source_document_name: 'AIMM文档',
                  clause_id: '5.1.3-a',
                  clause_text: '应建立模型风险管理机制。',
                  rationale: '测试理由',
                },
              ],
              importance: 'HIGH' as const,
              risk_level: 'HIGH' as const,
            },
          ],
        },
      ]

      render(
        <MissingClausesHandler
          taskId="task1"
          coverageByDocument={{
            doc1: {
              total_clauses: 3,
              clustered_clauses: 2,
              missing_clause_ids: ['5.1.2-b'],
            },
          }}
          documents={aimmDocuments}
          categories={aimmCategories}
          onUpdateClustering={mockOnUpdateClustering}
        />
      )

      expect(screen.getByText(/共发现 1 个缺失条款/)).toBeInTheDocument()
      expect(screen.getByText('5.1.2-b')).toBeInTheDocument()
      expect(screen.queryByText('5.1.2-a')).not.toBeInTheDocument()
      expect(screen.getByText(/应制定并持续改进数据治理制度/)).toBeInTheDocument()
      expect(screen.queryByText('条款内容未找到')).not.toBeInTheDocument()
    })

    it('应该显示缺失条款警告', () => {
      render(
        <MissingClausesHandler
          taskId="task1"
          coverageByDocument={mockCoverageIncomplete}
          documents={mockDocumentsWithMissing}
          categories={mockCategories}
          onUpdateClustering={mockOnUpdateClustering}
        />
      )
      expect(screen.getByText(/发现缺失条款/)).toBeInTheDocument()
    })

    it('应该显示缺失条款列表标题', () => {
      render(
        <MissingClausesHandler
          taskId="task1"
          coverageByDocument={mockCoverageIncomplete}
          documents={mockDocumentsWithMissing}
          categories={mockCategories}
          onUpdateClustering={mockOnUpdateClustering}
        />
      )
      expect(screen.getByText('缺失条款列表')).toBeInTheDocument()
    })

    it('应该显示文档名称标签', () => {
      render(
        <MissingClausesHandler
          taskId="task1"
          coverageByDocument={mockCoverageIncomplete}
          documents={mockDocumentsWithMissing}
          categories={mockCategories}
          onUpdateClustering={mockOnUpdateClustering}
        />
      )
      const docChips = screen.getAllByText('测试文档')
      expect(docChips.length).toBeGreaterThanOrEqual(1)
    })

    it('应该显示分配按钮', () => {
      render(
        <MissingClausesHandler
          taskId="task1"
          coverageByDocument={mockCoverageIncomplete}
          documents={mockDocumentsWithMissing}
          categories={mockCategories}
          onUpdateClustering={mockOnUpdateClustering}
        />
      )
      expect(screen.getByRole('button', { name: /分配到现有聚类/ })).toBeInTheDocument()
    })

    it('应该显示新建聚类按钮', () => {
      render(
        <MissingClausesHandler
          taskId="task1"
          coverageByDocument={mockCoverageIncomplete}
          documents={mockDocumentsWithMissing}
          categories={mockCategories}
          onUpdateClustering={mockOnUpdateClustering}
        />
      )
      expect(screen.getByRole('button', { name: /新建聚类/ })).toBeInTheDocument()
    })
  })

  describe('分配到现有聚类对话框', () => {
    it('点击分配按钮应该打开对话框', () => {
      render(
        <MissingClausesHandler
          taskId="task1"
          coverageByDocument={mockCoverageIncomplete}
          documents={mockDocumentsWithMissing}
          categories={mockCategories}
          onUpdateClustering={mockOnUpdateClustering}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /分配到现有聚类/ }))
      expect(screen.getByText(/分配条款到聚类/)).toBeInTheDocument()
    })

    it('对话框应该有取消和确定按钮', () => {
      render(
        <MissingClausesHandler
          taskId="task1"
          coverageByDocument={mockCoverageIncomplete}
          documents={mockDocumentsWithMissing}
          categories={mockCategories}
          onUpdateClustering={mockOnUpdateClustering}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /分配到现有聚类/ }))
      expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '确定' })).toBeInTheDocument()
    })
  })

  describe('新建聚类对话框', () => {
    it('点击新建聚类按钮应该打开对话框', () => {
      render(
        <MissingClausesHandler
          taskId="task1"
          coverageByDocument={mockCoverageIncomplete}
          documents={mockDocumentsWithMissing}
          categories={mockCategories}
          onUpdateClustering={mockOnUpdateClustering}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /新建聚类/ }))
      // Dialog title contains "新建聚类: 第二条"
      expect(screen.getByText(/新建聚类: 第二条/)).toBeInTheDocument()
    })

    it('对话框应该包含表单字段', () => {
      render(
        <MissingClausesHandler
          taskId="task1"
          coverageByDocument={mockCoverageIncomplete}
          documents={mockDocumentsWithMissing}
          categories={mockCategories}
          onUpdateClustering={mockOnUpdateClustering}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /新建聚类/ }))
      expect(screen.getByLabelText(/聚类名称/)).toBeInTheDocument()
      expect(screen.getByLabelText(/聚类描述/)).toBeInTheDocument()
      expect(screen.getByLabelText(/归类理由/)).toBeInTheDocument()
    })
  })
})
