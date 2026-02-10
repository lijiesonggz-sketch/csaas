import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import SimpleQuestionnaireDisplay from '../SimpleQuestionnaireDisplay'

/**
 * SimpleQuestionnaireDisplay 组件测试
 */

const mockResult = {
  sections: [
    {
      id: 's1',
      title: '信息安全策略',
      questions: [
        {
          id: 'q1',
          text: '是否建立了信息安全策略？',
          type: 'boolean',
          answer: 'yes',
          weight: 'high',
          recommendation: '建议定期审查策略',
        },
        {
          id: 'q2',
          text: '是否实施了访问控制？',
          type: 'boolean',
          answer: 'no',
          weight: 'high',
        },
        {
          id: 'q3',
          text: '是否有数据备份计划？',
          type: 'boolean',
          answer: 'partial',
        },
      ],
    },
  ],
  totalQuestions: 3,
  answeredQuestions: 3,
  completionRate: 100,
}

describe('SimpleQuestionnaireDisplay', () => {
  describe('统计概览', () => {
    it('应该显示总问题数', () => {
      render(<SimpleQuestionnaireDisplay result={mockResult} />)
      expect(screen.getByText('总问题数')).toBeInTheDocument()
      // "3" appears for both totalQuestions and answeredQuestions
      const threes = screen.getAllByText('3')
      expect(threes.length).toBeGreaterThanOrEqual(1)
    })

    it('应该显示已回答数', () => {
      render(<SimpleQuestionnaireDisplay result={mockResult} />)
      expect(screen.getByText('已回答')).toBeInTheDocument()
    })

    it('应该显示完成率', () => {
      render(<SimpleQuestionnaireDisplay result={mockResult} />)
      expect(screen.getByText('完成率')).toBeInTheDocument()
      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })

  describe('问卷部分', () => {
    it('应该显示部分标题', () => {
      render(<SimpleQuestionnaireDisplay result={mockResult} />)
      expect(screen.getByText('信息安全策略')).toBeInTheDocument()
    })

    it('应该显示问题数量', () => {
      render(<SimpleQuestionnaireDisplay result={mockResult} />)
      expect(screen.getByText('3 个问题')).toBeInTheDocument()
    })

    it('应该显示问题文本', () => {
      render(<SimpleQuestionnaireDisplay result={mockResult} />)
      expect(screen.getByText('是否建立了信息安全策略？')).toBeInTheDocument()
    })

    it('应该显示回答状态', () => {
      render(<SimpleQuestionnaireDisplay result={mockResult} />)
      expect(screen.getByText('是')).toBeInTheDocument()
      expect(screen.getByText('否')).toBeInTheDocument()
      expect(screen.getByText('部分符合')).toBeInTheDocument()
    })

    it('应该显示建议', () => {
      render(<SimpleQuestionnaireDisplay result={mockResult} />)
      expect(screen.getByText(/建议定期审查策略/)).toBeInTheDocument()
    })

    it('应该显示权重标签', () => {
      render(<SimpleQuestionnaireDisplay result={mockResult} />)
      const importantLabels = screen.getAllByText('重要')
      expect(importantLabels.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('展开/收起', () => {
    it('点击部分标题应该切换展开状态', () => {
      render(<SimpleQuestionnaireDisplay result={mockResult} />)
      // Sections are expanded by default, click to collapse
      fireEvent.click(screen.getByText('信息安全策略'))
      // After collapse, questions should not be visible
      expect(screen.queryByText('是否建立了信息安全策略？')).not.toBeInTheDocument()
    })
  })
})
