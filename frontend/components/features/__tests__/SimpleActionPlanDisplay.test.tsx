import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import SimpleActionPlanDisplay from '../SimpleActionPlanDisplay'

/**
 * SimpleActionPlanDisplay 组件测试
 */

const mockResult = {
  summary: '基于差距分析结果，建议从以下领域进行改进',
  improvements: [
    {
      priority: '高',
      area: '信息安全策略',
      currentLevel: '初始级',
      targetLevel: '已定义级',
      actions: ['制定信息安全策略', '建立安全委员会'],
      timeline: '3个月',
      resources: '安全团队',
      expectedOutcome: '建立完整的安全策略体系',
    },
    {
      priority: '中',
      area: '访问控制',
      actions: ['实施RBAC', '部署MFA'],
    },
    {
      priority: '低',
      area: '物理安全',
      actions: ['安装门禁系统'],
    },
  ],
  totalMeasures: 5,
}

const mockResultMinimal = {
  summary: '',
  improvements: [
    {
      priority: '中',
      area: '基础改进',
      actions: ['执行基础操作'],
    },
  ],
}

describe('SimpleActionPlanDisplay', () => {
  describe('概述', () => {
    it('应该显示改进措施概述', () => {
      render(<SimpleActionPlanDisplay result={mockResult} />)
      expect(screen.getByText('改进措施概述')).toBeInTheDocument()
      expect(screen.getByText('基于差距分析结果，建议从以下领域进行改进')).toBeInTheDocument()
    })

    it('无概述时不应该显示概述区域', () => {
      render(<SimpleActionPlanDisplay result={mockResultMinimal} />)
      expect(screen.queryByText('改进措施概述')).not.toBeInTheDocument()
    })
  })

  describe('统计概览', () => {
    it('应该显示改进领域数量', () => {
      render(<SimpleActionPlanDisplay result={mockResult} />)
      expect(screen.getByText('改进领域')).toBeInTheDocument()
    })

    it('应该显示总措施数', () => {
      render(<SimpleActionPlanDisplay result={mockResult} />)
      expect(screen.getByText('总措施数')).toBeInTheDocument()
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('应该显示高优先级数量', () => {
      render(<SimpleActionPlanDisplay result={mockResult} />)
      // "高优先级" appears in stats and in improvement cards
      const highPriority = screen.getAllByText('高优先级')
      expect(highPriority.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('改进措施列表', () => {
    it('应该显示所有改进领域', () => {
      render(<SimpleActionPlanDisplay result={mockResult} />)
      expect(screen.getByText('信息安全策略')).toBeInTheDocument()
      expect(screen.getByText('访问控制')).toBeInTheDocument()
      expect(screen.getByText('物理安全')).toBeInTheDocument()
    })

    it('应该显示优先级标签', () => {
      render(<SimpleActionPlanDisplay result={mockResult} />)
      // "高优先级" appears in both stats section and improvement card
      const highPriority = screen.getAllByText('高优先级')
      expect(highPriority.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('中优先级')).toBeInTheDocument()
      expect(screen.getByText('低优先级')).toBeInTheDocument()
    })

    it('应该显示建议行动', () => {
      render(<SimpleActionPlanDisplay result={mockResult} />)
      expect(screen.getByText('制定信息安全策略')).toBeInTheDocument()
      expect(screen.getByText('建立安全委员会')).toBeInTheDocument()
    })

    it('应该显示当前和目标等级', () => {
      render(<SimpleActionPlanDisplay result={mockResult} />)
      expect(screen.getByText('初始级')).toBeInTheDocument()
      expect(screen.getByText('已定义级')).toBeInTheDocument()
    })
  })

  describe('元信息', () => {
    it('应该显示时间周期', () => {
      render(<SimpleActionPlanDisplay result={mockResult} />)
      expect(screen.getByText('时间周期')).toBeInTheDocument()
      expect(screen.getByText('3个月')).toBeInTheDocument()
    })

    it('应该显示所需资源', () => {
      render(<SimpleActionPlanDisplay result={mockResult} />)
      expect(screen.getByText('所需资源')).toBeInTheDocument()
      expect(screen.getByText('安全团队')).toBeInTheDocument()
    })

    it('应该显示预期成果', () => {
      render(<SimpleActionPlanDisplay result={mockResult} />)
      expect(screen.getByText('预期成果')).toBeInTheDocument()
      expect(screen.getByText('建立完整的安全策略体系')).toBeInTheDocument()
    })
  })
})
