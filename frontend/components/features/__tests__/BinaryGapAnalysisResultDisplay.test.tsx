import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import BinaryGapAnalysisResultDisplay from '../BinaryGapAnalysisResultDisplay'

const mockResult = {
  total_clauses: 100,
  satisfied_clauses: 75,
  gap_clauses: 25,
  compliance_rate: 0.75,
  summary: {
    overview: '整体合规率为75%，存在一定差距',
    top_gap_clusters: ['信息安全管理', '访问控制'],
    recommendations: ['加强信息安全培训', '完善访问控制策略'],
  },
  gap_details: [
    {
      cluster_id: 'c1',
      cluster_name: '信息安全',
      clause_id: 'A.5.1',
      clause_text: '信息安全策略应由管理层批准',
      question_text: '是否有信息安全策略？',
      user_answer: false,
      gap: true,
      priority: 'HIGH' as const,
    },
    {
      cluster_id: 'c2',
      cluster_name: '访问控制',
      clause_id: 'A.9.1',
      clause_text: '应建立访问控制策略',
      question_text: '是否有访问控制策略？',
      user_answer: false,
      gap: true,
      priority: 'MEDIUM' as const,
    },
    {
      cluster_id: 'c3',
      cluster_name: '物理安全',
      clause_id: 'A.11.1',
      clause_text: '应定义安全区域',
      question_text: '是否定义了安全区域？',
      user_answer: true,
      gap: false,
      priority: 'LOW' as const,
    },
  ],
  gap_clusters: [
    {
      cluster_id: 'c1',
      cluster_name: '信息安全',
      total_clauses: 20,
      gap_clauses: 10,
      gap_rate: 0.5,
      priority: 'HIGH',
    },
    {
      cluster_id: 'c2',
      cluster_name: '访问控制',
      total_clauses: 15,
      gap_clauses: 5,
      gap_rate: 0.333,
      priority: 'MEDIUM',
    },
  ],
}

const mockResultNoGaps = {
  total_clauses: 50,
  satisfied_clauses: 50,
  gap_clauses: 0,
  compliance_rate: 1.0,
  summary: {
    overview: '',
    top_gap_clusters: [],
    recommendations: [],
  },
  gap_details: [],
  gap_clusters: [],
}

describe('BinaryGapAnalysisResultDisplay', () => {
  describe('基本渲染 - 统计数据', () => {
    it('应该显示合规率', () => {
      render(<BinaryGapAnalysisResultDisplay result={mockResult} />)
      expect(screen.getByText('75.0%')).toBeInTheDocument()
    })

    it('应该显示总条款数', () => {
      render(<BinaryGapAnalysisResultDisplay result={mockResult} />)
      expect(screen.getByText('100')).toBeInTheDocument()
    })

    it('应该显示已满足条款数', () => {
      render(<BinaryGapAnalysisResultDisplay result={mockResult} />)
      expect(screen.getByText('75')).toBeInTheDocument()
    })

    it('应该显示差距条款数', () => {
      render(<BinaryGapAnalysisResultDisplay result={mockResult} />)
      expect(screen.getByText('25')).toBeInTheDocument()
    })

    it('应该显示概述信息', () => {
      render(<BinaryGapAnalysisResultDisplay result={mockResult} />)
      expect(screen.getByText('整体合规率为75%，存在一定差距')).toBeInTheDocument()
    })

    it('应该显示统计标签', () => {
      render(<BinaryGapAnalysisResultDisplay result={mockResult} />)
      expect(screen.getByText('合规率')).toBeInTheDocument()
      expect(screen.getByText('总条款')).toBeInTheDocument()
      expect(screen.getByText('已满足')).toBeInTheDocument()
      expect(screen.getByText('差距条款')).toBeInTheDocument()
    })
  })

  describe('差距聚类汇总', () => {
    it('应该显示差距聚类汇总标题', () => {
      render(<BinaryGapAnalysisResultDisplay result={mockResult} />)
      expect(screen.getByText('差距聚类汇总')).toBeInTheDocument()
    })

    it('应该显示每个聚类的名称', () => {
      render(<BinaryGapAnalysisResultDisplay result={mockResult} />)
      // cluster names appear in both gap_clusters and gap_details sections
      const infoSec = screen.getAllByText('信息安全')
      expect(infoSec.length).toBeGreaterThanOrEqual(1)
    })

    it('应该显示聚类的差距率', () => {
      render(<BinaryGapAnalysisResultDisplay result={mockResult} />)
      expect(screen.getByText('50.0%')).toBeInTheDocument()
      expect(screen.getByText('33.3%')).toBeInTheDocument()
    })

    it('应该显示聚类的条款统计', () => {
      render(<BinaryGapAnalysisResultDisplay result={mockResult} />)
      expect(screen.getByText('10 / 20 条款未满足')).toBeInTheDocument()
      expect(screen.getByText('5 / 15 条款未满足')).toBeInTheDocument()
    })

    it('应该显示优先级标签', () => {
      render(<BinaryGapAnalysisResultDisplay result={mockResult} />)
      const highPriority = screen.getAllByText('高优先级')
      expect(highPriority.length).toBeGreaterThanOrEqual(1)
      const medPriority = screen.getAllByText('中优先级')
      expect(medPriority.length).toBeGreaterThanOrEqual(1)
    })

    it('应该显示差距最严重的聚类', () => {
      render(<BinaryGapAnalysisResultDisplay result={mockResult} />)
      expect(screen.getByText('差距最严重的聚类')).toBeInTheDocument()
      expect(screen.getByText('信息安全管理')).toBeInTheDocument()
    })
  })

  describe('差距详情', () => {
    it('应该显示差距详情标题', () => {
      render(<BinaryGapAnalysisResultDisplay result={mockResult} />)
      expect(screen.getByText('差距详情')).toBeInTheDocument()
    })

    it('应该显示条款信息', () => {
      render(<BinaryGapAnalysisResultDisplay result={mockResult} />)
      expect(screen.getByText(/信息安全策略应由管理层批准/)).toBeInTheDocument()
      expect(screen.getByText(/是否有信息安全策略？/)).toBeInTheDocument()
    })

    it('应该显示用户回答', () => {
      render(<BinaryGapAnalysisResultDisplay result={mockResult} />)
      const noChips = screen.getAllByText('没有')
      expect(noChips.length).toBeGreaterThanOrEqual(1)
    })

    it('应该显示展开/收起按钮', () => {
      render(<BinaryGapAnalysisResultDisplay result={mockResult} />)
      const expandButton = screen.getByRole('button', { name: /查看全部/ })
      expect(expandButton).toBeInTheDocument()
    })

    it('点击展开按钮应该切换显示', () => {
      render(<BinaryGapAnalysisResultDisplay result={mockResult} />)
      const expandButton = screen.getByRole('button', { name: /查看全部/ })
      fireEvent.click(expandButton)
      expect(screen.getByRole('button', { name: /收起/ })).toBeInTheDocument()
    })
  })

  describe('无差距状态', () => {
    it('应该显示无差距的成功消息', () => {
      render(<BinaryGapAnalysisResultDisplay result={mockResultNoGaps} />)
      expect(screen.getByText(/未发现明显差距/)).toBeInTheDocument()
    })

    it('无差距时不应该显示差距详情', () => {
      render(<BinaryGapAnalysisResultDisplay result={mockResultNoGaps} />)
      expect(screen.queryByText('差距详情')).not.toBeInTheDocument()
    })

    it('无差距时不应该显示差距聚类汇总', () => {
      render(<BinaryGapAnalysisResultDisplay result={mockResultNoGaps} />)
      expect(screen.queryByText('差距聚类汇总')).not.toBeInTheDocument()
    })
  })

  describe('改进建议', () => {
    it('应该显示改进建议', () => {
      render(<BinaryGapAnalysisResultDisplay result={mockResult} />)
      expect(screen.getByText('加强信息安全培训')).toBeInTheDocument()
      expect(screen.getByText('完善访问控制策略')).toBeInTheDocument()
    })

    it('无建议时不应该显示改进建议区域', () => {
      const resultNoRec = {
        ...mockResult,
        summary: { ...mockResult.summary, recommendations: [] },
      }
      render(<BinaryGapAnalysisResultDisplay result={resultNoRec} />)
      // The lightbulb icon section should not appear
      const lightbulbSections = screen.queryAllByText('改进建议')
      expect(lightbulbSections.length).toBe(0)
    })
  })

  describe('生成改进措施按钮', () => {
    it('有差距时应该显示生成改进措施按钮', () => {
      const mockFn = jest.fn()
      render(<BinaryGapAnalysisResultDisplay result={mockResult} onGenerateActionPlan={mockFn} />)
      expect(screen.getByRole('button', { name: /生成改进措施/ })).toBeInTheDocument()
    })

    it('点击按钮应该调用 onGenerateActionPlan', () => {
      const mockFn = jest.fn()
      render(<BinaryGapAnalysisResultDisplay result={mockResult} onGenerateActionPlan={mockFn} />)
      fireEvent.click(screen.getByRole('button', { name: /生成改进措施/ }))
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('loading 状态下按钮应该禁用', () => {
      const mockFn = jest.fn()
      render(
        <BinaryGapAnalysisResultDisplay result={mockResult} onGenerateActionPlan={mockFn} loading={true} />
      )
      const button = screen.getByRole('button', { name: /生成改进措施/ })
      expect(button).toBeDisabled()
    })

    it('无差距时不应该显示生成按钮', () => {
      const mockFn = jest.fn()
      render(<BinaryGapAnalysisResultDisplay result={mockResultNoGaps} onGenerateActionPlan={mockFn} />)
      expect(screen.queryByRole('button', { name: /生成改进措施/ })).not.toBeInTheDocument()
    })

    it('未提供 onGenerateActionPlan 时不应该显示按钮', () => {
      render(<BinaryGapAnalysisResultDisplay result={mockResult} />)
      expect(screen.queryByText('需要改进措施吗？')).not.toBeInTheDocument()
    })
  })

  describe('合规率颜色', () => {
    it('高合规率应该正确显示', () => {
      const highResult = { ...mockResult, compliance_rate: 0.85 }
      render(<BinaryGapAnalysisResultDisplay result={highResult} />)
      expect(screen.getByText('85.0%')).toBeInTheDocument()
    })

    it('中等合规率应该正确显示', () => {
      const medResult = { ...mockResult, compliance_rate: 0.65 }
      render(<BinaryGapAnalysisResultDisplay result={medResult} />)
      expect(screen.getByText('65.0%')).toBeInTheDocument()
    })

    it('低合规率应该正确显示', () => {
      const lowResult = { ...mockResult, compliance_rate: 0.45 }
      render(<BinaryGapAnalysisResultDisplay result={lowResult} />)
      expect(screen.getByText('45.0%')).toBeInTheDocument()
    })
  })
})
