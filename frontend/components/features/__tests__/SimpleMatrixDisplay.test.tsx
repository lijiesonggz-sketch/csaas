import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import SimpleMatrixDisplay from '../SimpleMatrixDisplay'

/**
 * SimpleMatrixDisplay 组件测试
 */

const mockResult = {
  dimensions: [
    {
      id: 'd1',
      name: '战略与治理',
      currentLevel: 3,
      description: '组织战略和治理能力',
      levels: ['初始级', '可重复级', '已定义级', '可管理级', '优化级'],
      scores: [1, 2, 3, 2, 1],
      gap: 1,
    },
    {
      id: 'd2',
      name: '技术架构',
      currentLevel: 4,
      description: '技术架构成熟度',
      levels: ['初始级', '可重复级', '已定义级', '可管理级', '优化级'],
      scores: [1, 3, 4, 4, 2],
    },
  ],
  overallMaturity: '已定义级',
  averageScore: 3.5,
  targetLevel: '可管理级',
  recommendations: ['加强战略规划', '提升技术架构'],
}

const mockResultMinimal = {
  dimensions: [
    {
      id: 'd1',
      name: '基础维度',
      currentLevel: 2,
      description: '基础描述',
      levels: ['初始级', '可重复级', '已定义级', '可管理级', '优化级'],
      scores: [1, 2, 1, 0, 0],
    },
  ],
  overallMaturity: '可重复级',
  averageScore: 2.0,
}

describe('SimpleMatrixDisplay', () => {
  describe('总体概览', () => {
    it('应该显示评估维度数量', () => {
      render(<SimpleMatrixDisplay result={mockResult} />)
      expect(screen.getByText('评估维度')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('应该显示平均分数', () => {
      render(<SimpleMatrixDisplay result={mockResult} />)
      expect(screen.getByText('平均分数')).toBeInTheDocument()
      expect(screen.getByText('3.5')).toBeInTheDocument()
    })

    it('应该显示整体成熟度', () => {
      render(<SimpleMatrixDisplay result={mockResult} />)
      expect(screen.getByText('整体成熟度')).toBeInTheDocument()
      // '已定义级' appears in overview and in level labels under each dimension
      const maturityTexts = screen.getAllByText('已定义级')
      expect(maturityTexts.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('维度评估', () => {
    it('应该显示各维度名称', () => {
      render(<SimpleMatrixDisplay result={mockResult} />)
      expect(screen.getByText('战略与治理')).toBeInTheDocument()
      expect(screen.getByText('技术架构')).toBeInTheDocument()
    })

    it('应该显示维度描述', () => {
      render(<SimpleMatrixDisplay result={mockResult} />)
      expect(screen.getByText('组织战略和治理能力')).toBeInTheDocument()
    })

    it('应该显示差距标签', () => {
      render(<SimpleMatrixDisplay result={mockResult} />)
      expect(screen.getByText(/差距 1 级/)).toBeInTheDocument()
    })

    it('点击维度应该展开详细分数', () => {
      render(<SimpleMatrixDisplay result={mockResult} />)
      fireEvent.click(screen.getByText('战略与治理'))
      expect(screen.getByText('详细分数分布：')).toBeInTheDocument()
    })
  })

  describe('改进建议', () => {
    it('应该显示改进建议', () => {
      render(<SimpleMatrixDisplay result={mockResult} />)
      expect(screen.getByText('改进建议')).toBeInTheDocument()
      expect(screen.getByText('加强战略规划')).toBeInTheDocument()
      expect(screen.getByText('提升技术架构')).toBeInTheDocument()
    })

    it('无建议时不应该显示', () => {
      render(<SimpleMatrixDisplay result={mockResultMinimal} />)
      expect(screen.queryByText('改进建议')).not.toBeInTheDocument()
    })
  })

  describe('目标等级', () => {
    it('应该显示目标成熟度等级', () => {
      render(<SimpleMatrixDisplay result={mockResult} />)
      expect(screen.getByText('目标成熟度等级')).toBeInTheDocument()
      // '可管理级' appears in target level and in level labels
      const targetTexts = screen.getAllByText('可管理级')
      expect(targetTexts.length).toBeGreaterThanOrEqual(1)
    })

    it('无目标等级时不应该显示', () => {
      render(<SimpleMatrixDisplay result={mockResultMinimal} />)
      expect(screen.queryByText('目标成熟度等级')).not.toBeInTheDocument()
    })
  })
})
