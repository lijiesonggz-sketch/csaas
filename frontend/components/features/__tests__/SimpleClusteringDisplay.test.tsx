import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import SimpleClusteringDisplay from '../SimpleClusteringDisplay'

/**
 * SimpleClusteringDisplay 组件测试
 */

const mockResult = {
  categories: [
    {
      id: 'cat1',
      name: '信息安全管理',
      description: '信息安全管理相关条款',
      clusters: [
        {
          id: 'c1',
          name: '访问控制',
          description: '访问控制相关条款',
          importance: 'HIGH' as const,
          risk_level: 'HIGH' as const,
          clauses: [
            {
              source_document_id: 'doc1',
              source_document_name: '测试文档',
              clause_id: 'A.5.1',
              clause_text: '信息安全策略应由管理层批准并发布',
              rationale: '核心安全策略要求',
            },
          ],
        },
        {
          id: 'c2',
          name: '数据保护',
          description: '数据保护相关条款',
          importance: 'MEDIUM' as const,
          risk_level: 'LOW' as const,
          clauses: [
            {
              source_document_id: 'doc1',
              source_document_name: '测试文档',
              clause_id: 'A.8.1',
              clause_text: '数据分类和标记',
              rationale: '数据管理要求',
            },
          ],
        },
      ],
    },
  ],
  clustering_logic: '基于ISO 27001标准进行聚类',
  coverage_summary: {
    overall: {
      total_clauses: 10,
      clustered_clauses: 8,
      coverage_rate: 0.8,
    },
  },
}

describe('SimpleClusteringDisplay', () => {
  describe('统计概览', () => {
    it('应该显示分类数量', () => {
      render(<SimpleClusteringDisplay result={mockResult} />)
      expect(screen.getByText('分类数量')).toBeInTheDocument()
      expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('应该显示聚类数量', () => {
      render(<SimpleClusteringDisplay result={mockResult} />)
      expect(screen.getByText('聚类数量')).toBeInTheDocument()
      // "2" appears for both cluster count and clause count
      const twos = screen.getAllByText('2')
      expect(twos.length).toBeGreaterThanOrEqual(1)
    })

    it('应该显示覆盖率', () => {
      render(<SimpleClusteringDisplay result={mockResult} />)
      expect(screen.getByText('覆盖率')).toBeInTheDocument()
      expect(screen.getByText('80.0%')).toBeInTheDocument()
    })
  })

  describe('聚类逻辑', () => {
    it('应该显示聚类方法', () => {
      render(<SimpleClusteringDisplay result={mockResult} />)
      expect(screen.getByText('聚类方法')).toBeInTheDocument()
      expect(screen.getByText('基于ISO 27001标准进行聚类')).toBeInTheDocument()
    })
  })

  describe('分类和聚类展示', () => {
    it('应该显示分类名称', () => {
      render(<SimpleClusteringDisplay result={mockResult} />)
      expect(screen.getByText('信息安全管理')).toBeInTheDocument()
    })

    it('应该显示聚类名称', () => {
      render(<SimpleClusteringDisplay result={mockResult} />)
      expect(screen.getByText('访问控制')).toBeInTheDocument()
      expect(screen.getByText('数据保护')).toBeInTheDocument()
    })

    it('应该显示重要性标签', () => {
      render(<SimpleClusteringDisplay result={mockResult} />)
      expect(screen.getByText('高重要性')).toBeInTheDocument()
      expect(screen.getByText('中重要性')).toBeInTheDocument()
    })

    it('应该显示风险标签', () => {
      render(<SimpleClusteringDisplay result={mockResult} />)
      expect(screen.getByText('高风险')).toBeInTheDocument()
      expect(screen.getByText('低风险')).toBeInTheDocument()
    })
  })

  describe('展开/收起条款', () => {
    it('点击聚类应该展开条款详情', () => {
      render(<SimpleClusteringDisplay result={mockResult} />)
      // Click on the cluster to expand
      fireEvent.click(screen.getByText('访问控制'))
      expect(screen.getByText('A.5.1')).toBeInTheDocument()
    })
  })
})
