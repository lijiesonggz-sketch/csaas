import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import SimpleSummaryDisplay from '../SimpleSummaryDisplay'

/**
 * SimpleSummaryDisplay 组件测试
 *
 * 测试场景：
 * 1. 基本渲染 - 标题和概述
 * 2. 合规等级展示
 * 3. 关键领域展示
 * 4. 关键要求展示
 * 5. 可选字段缺失时的处理
 */

const mockResult = {
  selectedResult: JSON.stringify({
    title: '信息安全管理体系综述',
    overview: '本文档概述了信息安全管理体系的核心要求',
    compliance_level: 'ISO 27001:2022',
    key_areas: [
      { name: '访问控制', description: '管理用户访问权限', importance: 'HIGH' },
      { name: '数据保护', description: '保护敏感数据', importance: 'MEDIUM' },
      { name: '物理安全', description: '物理环境安全', importance: 'LOW' },
    ],
    key_requirements: ['建立信息安全策略', '实施风险评估', '定期审计'],
  }),
}

const mockResultMinimal = {
  selectedResult: JSON.stringify({
    title: '最小化综述',
    overview: '简单概述',
    key_areas: [],
    key_requirements: [],
  }),
}

describe('SimpleSummaryDisplay', () => {
  describe('基本渲染', () => {
    it('应该显示标题', () => {
      render(<SimpleSummaryDisplay result={mockResult} />)
      expect(screen.getByText('信息安全管理体系综述')).toBeInTheDocument()
    })

    it('应该显示概述', () => {
      render(<SimpleSummaryDisplay result={mockResult} />)
      expect(screen.getByText('本文档概述了信息安全管理体系的核心要求')).toBeInTheDocument()
    })
  })

  describe('合规等级', () => {
    it('应该显示合规等级', () => {
      render(<SimpleSummaryDisplay result={mockResult} />)
      expect(screen.getByText('ISO 27001:2022')).toBeInTheDocument()
    })

    it('应该显示合规等级标签', () => {
      render(<SimpleSummaryDisplay result={mockResult} />)
      expect(screen.getByText('当前合规等级')).toBeInTheDocument()
    })

    it('无合规等级时不应该显示该区域', () => {
      render(<SimpleSummaryDisplay result={mockResultMinimal} />)
      expect(screen.queryByText('当前合规等级')).not.toBeInTheDocument()
    })
  })

  describe('关键领域', () => {
    it('应该显示关键领域标题', () => {
      render(<SimpleSummaryDisplay result={mockResult} />)
      expect(screen.getByText('关键领域')).toBeInTheDocument()
    })

    it('应该显示所有关键领域', () => {
      render(<SimpleSummaryDisplay result={mockResult} />)
      expect(screen.getByText('访问控制')).toBeInTheDocument()
      expect(screen.getByText('数据保护')).toBeInTheDocument()
      expect(screen.getByText('物理安全')).toBeInTheDocument()
    })

    it('应该显示领域描述', () => {
      render(<SimpleSummaryDisplay result={mockResult} />)
      expect(screen.getByText('管理用户访问权限')).toBeInTheDocument()
    })

    it('应该显示重要性标签', () => {
      render(<SimpleSummaryDisplay result={mockResult} />)
      expect(screen.getByText('高')).toBeInTheDocument()
      expect(screen.getByText('中')).toBeInTheDocument()
      expect(screen.getByText('低')).toBeInTheDocument()
    })

    it('无关键领域时不应该显示该区域', () => {
      render(<SimpleSummaryDisplay result={mockResultMinimal} />)
      expect(screen.queryByText('关键领域')).not.toBeInTheDocument()
    })
  })

  describe('关键要求', () => {
    it('应该显示关键要求标题', () => {
      render(<SimpleSummaryDisplay result={mockResult} />)
      expect(screen.getByText('关键要求')).toBeInTheDocument()
    })

    it('应该显示所有关键要求', () => {
      render(<SimpleSummaryDisplay result={mockResult} />)
      expect(screen.getByText('建立信息安全策略')).toBeInTheDocument()
      expect(screen.getByText('实施风险评估')).toBeInTheDocument()
      expect(screen.getByText('定期审计')).toBeInTheDocument()
    })

    it('无关键要求时不应该显示该区域', () => {
      render(<SimpleSummaryDisplay result={mockResultMinimal} />)
      expect(screen.queryByText('关键要求')).not.toBeInTheDocument()
    })
  })
})
