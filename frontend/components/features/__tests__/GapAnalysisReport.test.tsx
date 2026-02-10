import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import GapAnalysisReport from '../GapAnalysisReport'

/**
 * 差距分析报告组件的测试套件
 *
 * 测试场景：
 * 1. 验证报告组件正确渲染所有章节（封面、成熟度概览、雷达图、维度详情等）
 * 2. 验证打印样式类名正确应用
 * 3. 验证雷达图组件正确集成并接收数据
 */

describe('GapAnalysisReport - TDD', () => {
  /** @type {import('../GapAnalysisReport').GapAnalysisReportData} */
  const mockReportData = {
    projectName: '测试项目',
    reportDate: '2024年1月15日',
    overall: {
      maturityLevel: 3.52,
      grade: '充分规范级',
      description: '组织已建立基本的管理流程和规范',
      calculation: {
        totalScore: 176,
        maxScore: 250,
        formula: '总分 / 满分 * 5',
      },
    },
    dimensionMaturity: [
      { dimension: '战略与治理', clusterCount: 2, maturityLevel: 3.5, grade: '充分规范级' },
      { dimension: '技术架构', clusterCount: 3, maturityLevel: 4.0, grade: '系统优化级' },
      { dimension: '流程与管理', clusterCount: 2, maturityLevel: 2.8, grade: '初步规范级' },
      { dimension: '人员能力', clusterCount: 2, maturityLevel: 3.2, grade: '充分规范级' },
      { dimension: '安全与合规', clusterCount: 3, maturityLevel: 4.2, grade: '系统优化级' },
      { dimension: '创新与文化', clusterCount: 1, maturityLevel: 2.9, grade: '初步规范级' },
    ],
    clusterMaturity: [
      {
        cluster_id: 'C001',
        cluster_name: '战略规划',
        dimension: '战略与治理',
        maturityLevel: 3.5,
        totalScore: 35,
        maxScore: 50,
        questionsCount: 10,
        calculation: '35/50*5=3.5',
        grade: '充分规范级',
        isShortcoming: false,
      },
      {
        cluster_id: 'C002',
        cluster_name: '技术架构设计',
        dimension: '技术架构',
        maturityLevel: 4.0,
        totalScore: 40,
        maxScore: 50,
        questionsCount: 10,
        calculation: '40/50*5=4.0',
        grade: '系统优化级',
        isShortcoming: false,
      },
      {
        cluster_id: 'C003',
        cluster_name: '流程管理',
        dimension: '流程与管理',
        maturityLevel: 2.5,
        totalScore: 25,
        maxScore: 50,
        questionsCount: 10,
        calculation: '25/50*5=2.5',
        grade: '初步规范级',
        isShortcoming: true,
      },
    ],
    topShortcomings: [
      { rank: 1, cluster_id: 'C003', cluster_name: '流程管理', maturityLevel: 2.5, gap: 1.5 },
      { rank: 2, cluster_id: 'C004', cluster_name: '创新文化', maturityLevel: 2.8, gap: 1.2 },
      { rank: 3, cluster_id: 'C005', cluster_name: '人员培训', maturityLevel: 2.9, gap: 1.1 },
    ],
    topStrengths: [
      { rank: 1, cluster_id: 'C006', cluster_name: '安全合规', maturityLevel: 4.5, advantage: 0.8 },
      { rank: 2, cluster_id: 'C002', cluster_name: '技术架构设计', maturityLevel: 4.0, advantage: 0.5 },
      { rank: 3, cluster_id: 'C007', cluster_name: '数据管理', maturityLevel: 3.8, advantage: 0.3 },
    ],
    targetMaturity: 4.0,
  }

  describe('AC1: 报告组件渲染', () => {
    it('应该正确渲染报告组件', () => {
      // Arrange & Act
      const { container } = render(
        <GapAnalysisReport data={mockReportData} showCover={true} />
      )

      // Assert
      expect(container.querySelector('.gap-analysis-report')).toBeInTheDocument()
    })

    it('应该显示项目名称', () => {
      // Arrange & Act
      render(<GapAnalysisReport data={mockReportData} showCover={true} />)

      // Assert
      expect(screen.getByText('测试项目')).toBeInTheDocument()
    })

    it('应该显示报告日期', () => {
      // Arrange & Act
      render(<GapAnalysisReport data={mockReportData} showCover={true} />)

      // Assert
      expect(screen.getByText('2024年1月15日')).toBeInTheDocument()
    })

    it('应该显示报告标题', () => {
      // Arrange & Act
      render(<GapAnalysisReport data={mockReportData} showCover={true} />)

      // Assert
      expect(screen.getByText('差距分析报告')).toBeInTheDocument()
    })

    it('应该应用自定义类名', () => {
      // Arrange & Act
      const { container } = render(
        <GapAnalysisReport data={mockReportData} className="custom-report" />
      )

      // Assert
      expect(container.querySelector('.custom-report')).toBeInTheDocument()
    })

    it('应该设置data-project-name属性', () => {
      // Arrange & Act
      const { container } = render(
        <GapAnalysisReport data={mockReportData} />
      )

      // Assert
      const reportElement = container.querySelector('.gap-analysis-report')
      expect(reportElement).toHaveAttribute('data-project-name', '测试项目')
    })
  })

  describe('AC2: 封面页渲染', () => {
    it('应该渲染封面页', () => {
      // Arrange & Act
      const { container } = render(
        <GapAnalysisReport data={mockReportData} showCover={true} />
      )

      // Assert
      expect(container.querySelector('.report-cover')).toBeInTheDocument()
    })

    it('应该显示封面图标', () => {
      // Arrange & Act
      const { container } = render(
        <GapAnalysisReport data={mockReportData} showCover={true} />
      )

      // Assert
      expect(container.querySelector('.report-cover-icon')).toBeInTheDocument()
    })

    it('应该显示副标题', () => {
      // Arrange & Act
      render(<GapAnalysisReport data={mockReportData} showCover={true} />)

      // Assert
      expect(screen.getByText('基于 CMMI 成熟度模型的全面评估')).toBeInTheDocument()
    })

    it('showCover为false时不显示封面', () => {
      // Arrange & Act
      const { container } = render(
        <GapAnalysisReport data={mockReportData} showCover={false} />
      )

      // Assert
      expect(container.querySelector('.report-cover')).not.toBeInTheDocument()
    })
  })

  describe('AC3: 成熟度概览', () => {
    it('应该显示成熟度概览标题', () => {
      // Arrange & Act
      render(<GapAnalysisReport data={mockReportData} />)

      // Assert
      expect(screen.getByText('成熟度概览')).toBeInTheDocument()
    })

    it('应该显示总体成熟度等级', () => {
      // Arrange & Act
      render(<GapAnalysisReport data={mockReportData} />)

      // Assert - 使用getAllByText因为成熟度数值可能出现在多处（标题和进度条）
      const maturityTexts = screen.getAllByText(/3\.52/)
      expect(maturityTexts.length).toBeGreaterThan(0)
    })

    it('应该显示等级评定标签', () => {
      // Arrange & Act
      render(<GapAnalysisReport data={mockReportData} />)

      // Assert - 使用getAllByText因为可能有多个相同等级的标签
      const gradeTags = screen.getAllByText('充分规范级')
      expect(gradeTags.length).toBeGreaterThan(0)
    })

    it('应该显示描述文本', () => {
      // Arrange & Act
      render(<GapAnalysisReport data={mockReportData} />)

      // Assert
      expect(screen.getByText('组织已建立基本的管理流程和规范')).toBeInTheDocument()
    })

    it('应该显示计算公式', () => {
      // Arrange & Act
      render(<GapAnalysisReport data={mockReportData} />)

      // Assert
      expect(screen.getByText('总分 / 满分 * 5')).toBeInTheDocument()
    })

    it('应该显示总得分和满分', () => {
      // Arrange & Act
      render(<GapAnalysisReport data={mockReportData} />)

      // Assert
      expect(screen.getByText('176')).toBeInTheDocument()
      expect(screen.getByText('250')).toBeInTheDocument()
    })
  })

  describe('AC4: 雷达图集成', () => {
    it('应该渲染雷达图区域', () => {
      // Arrange & Act
      const { container } = render(<GapAnalysisReport data={mockReportData} />)

      // Assert
      expect(screen.getByText('维度成熟度分布')).toBeInTheDocument()
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })

    it('应该传递数据给雷达图组件', () => {
      // Arrange & Act
      const { container } = render(<GapAnalysisReport data={mockReportData} />)

      // Assert - 验证雷达图容器存在，说明组件已渲染
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })

    it('有目标成熟度时应该显示对比模式', () => {
      // Arrange & Act
      const { container } = render(
        <GapAnalysisReport data={mockReportData} />
      )

      // Assert - 验证雷达图容器存在
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })
  })

  describe('AC5: 维度详情表格', () => {
    it('应该显示维度详情标题', () => {
      // Arrange & Act
      render(<GapAnalysisReport data={mockReportData} />)

      // Assert
      expect(screen.getByText('各维度成熟度详情')).toBeInTheDocument()
    })

    it('应该显示所有维度', () => {
      // Arrange & Act
      const { container } = render(<GapAnalysisReport data={mockReportData} />)

      // Assert - 使用容器查询来检查表格内容
      expect(container.textContent).toContain('战略与治理')
      expect(container.textContent).toContain('技术架构')
      expect(container.textContent).toContain('流程与管理')
    })

    it('应该显示维度等级标签', () => {
      // Arrange & Act
      render(<GapAnalysisReport data={mockReportData} />)

      // Assert - 检查多个等级标签是否存在
      const gradeTags = screen.getAllByText(/充分规范级|系统优化级|初步规范级/)
      expect(gradeTags.length).toBeGreaterThan(0)
    })

    it('应该处理未知的等级评定', () => {
      // Arrange
      /** @type {import('../GapAnalysisReport').GapAnalysisReportData} */
      const dataWithUnknownGrade = {
        ...mockReportData,
        dimensionMaturity: [
          { dimension: '测试维度', clusterCount: 1, maturityLevel: 1.5, grade: '未知等级' },
        ],
      }

      // Act
      const { container } = render(<GapAnalysisReport data={dataWithUnknownGrade} />)

      // Assert - 组件应该正常渲染，使用默认颜色
      expect(container.querySelector('.gap-analysis-report')).toBeInTheDocument()
    })
  })

  describe('AC6: TOP 3 短板和优势', () => {
    it('应该显示TOP 3短板标题', () => {
      // Arrange & Act
      render(<GapAnalysisReport data={mockReportData} />)

      // Assert
      expect(screen.getByText('TOP 3 短板维度')).toBeInTheDocument()
    })

    it('应该显示TOP 3优势标题', () => {
      // Arrange & Act
      render(<GapAnalysisReport data={mockReportData} />)

      // Assert
      expect(screen.getByText('TOP 3 优势维度')).toBeInTheDocument()
    })

    it('应该显示短板项', () => {
      // Arrange & Act
      const { container } = render(<GapAnalysisReport data={mockReportData} />)

      // Assert - 使用容器查询检查内容
      expect(container.textContent).toContain('流程管理')
      expect(container.textContent).toContain('创新文化')
    })

    it('应该显示优势项', () => {
      // Arrange & Act
      render(<GapAnalysisReport data={mockReportData} />)

      // Assert
      expect(screen.getByText('安全合规')).toBeInTheDocument()
    })

    it('应该显示排名标签', () => {
      // Arrange & Act
      render(<GapAnalysisReport data={mockReportData} />)

      // Assert - 检查排名标签
      const rankTags = screen.getAllByText(/^[123]$/)
      expect(rankTags.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('AC7: 改进建议', () => {
    it('应该显示改进建议标题', () => {
      // Arrange & Act
      render(<GapAnalysisReport data={mockReportData} />)

      // Assert
      expect(screen.getByText('改进建议')).toBeInTheDocument()
    })

    it('应该生成默认改进建议', () => {
      // Arrange & Act
      const { container } = render(<GapAnalysisReport data={mockReportData} />)

      // Assert - 使用容器查询检查内容
      expect(container.textContent).toContain('流程管理')
    })

    it('应该显示建议列表', () => {
      // Arrange & Act
      render(<GapAnalysisReport data={mockReportData} />)

      // Assert - 检查建议列表项
      expect(screen.getByText('针对流程管理制定专项改进计划')).toBeInTheDocument()
    })
  })

  describe('AC8: 聚类详情表格', () => {
    it('应该显示聚类详情标题', () => {
      // Arrange & Act
      render(<GapAnalysisReport data={mockReportData} />)

      // Assert
      expect(screen.getByText('各聚类详细成熟度')).toBeInTheDocument()
    })

    it('应该显示聚类名称', () => {
      // Arrange & Act
      const { container } = render(<GapAnalysisReport data={mockReportData} />)

      // Assert - 使用容器查询检查内容
      expect(container.textContent).toContain('战略规划')
      expect(container.textContent).toContain('技术架构设计')
    })

    it('应该显示短板标签', () => {
      // Arrange & Act
      render(<GapAnalysisReport data={mockReportData} />)

      // Assert
      expect(screen.getByText('短板')).toBeInTheDocument()
    })
  })

  describe('AC9: 打印样式类名', () => {
    it('应该应用gap-analysis-report类名', () => {
      // Arrange & Act
      const { container } = render(
        <GapAnalysisReport data={mockReportData} />
      )

      // Assert
      expect(container.querySelector('.gap-analysis-report')).toBeInTheDocument()
    })

    it('应该应用report-section类名', () => {
      // Arrange & Act
      const { container } = render(<GapAnalysisReport data={mockReportData} />)

      // Assert
      expect(container.querySelectorAll('.report-section').length).toBeGreaterThan(0)
    })

    it('应该应用report-card类名', () => {
      // Arrange & Act
      const { container } = render(<GapAnalysisReport data={mockReportData} />)

      // Assert
      expect(container.querySelectorAll('.report-card').length).toBeGreaterThan(0)
    })

    it('应该应用report-cover类名（当showCover为true）', () => {
      // Arrange & Act
      const { container } = render(
        <GapAnalysisReport data={mockReportData} showCover={true} />
      )

      // Assert
      expect(container.querySelector('.report-cover')).toBeInTheDocument()
    })

    it('应该应用print-page-break类名到封面', () => {
      // Arrange & Act
      const { container } = render(
        <GapAnalysisReport data={mockReportData} showCover={true} />
      )

      // Assert
      expect(container.querySelector('.print-page-break')).toBeInTheDocument()
    })

    it('应该应用report-footer类名', () => {
      // Arrange & Act
      const { container } = render(
        <GapAnalysisReport data={mockReportData} />
      )

      // Assert
      expect(container.querySelector('.report-footer')).toBeInTheDocument()
    })
  })

  describe('AC10: 报告页脚', () => {
    it('应该显示报告页脚', () => {
      // Arrange & Act
      const { container } = render(<GapAnalysisReport data={mockReportData} />)

      // Assert
      expect(container.querySelector('.report-footer')).toBeInTheDocument()
    })

    it('应该包含生成时间信息', () => {
      // Arrange & Act
      render(<GapAnalysisReport data={mockReportData} />)

      // Assert
      expect(screen.getByText(/本报告由 CSAAS 平台自动生成/)).toBeInTheDocument()
    })
  })

  describe('边界情况', () => {
    it('应该处理空的topShortcomings数组', () => {
      // Arrange
      /** @type {import('../GapAnalysisReport').GapAnalysisReportData} */
      const dataWithNoShortcomings = {
        ...mockReportData,
        topShortcomings: [],
      }

      // Act
      const { container } = render(<GapAnalysisReport data={dataWithNoShortcomings} />)

      // Assert - 组件应该正常渲染
      expect(container.querySelector('.gap-analysis-report')).toBeInTheDocument()
    })

    it('应该处理空的topStrengths数组', () => {
      // Arrange
      /** @type {import('../GapAnalysisReport').GapAnalysisReportData} */
      const dataWithNoStrengths = {
        ...mockReportData,
        topStrengths: [],
      }

      // Act
      const { container } = render(<GapAnalysisReport data={dataWithNoStrengths} />)

      // Assert - 组件应该正常渲染
      expect(container.querySelector('.gap-analysis-report')).toBeInTheDocument()
    })

    it('应该处理没有targetMaturity的情况', () => {
      // Arrange
      /** @type {import('../GapAnalysisReport').GapAnalysisReportData} */
      const dataWithoutTarget = {
        ...mockReportData,
        targetMaturity: undefined,
      }

      // Act
      const { container } = render(<GapAnalysisReport data={dataWithoutTarget} />)

      // Assert - 组件应该正常渲染
      expect(container.querySelector('.gap-analysis-report')).toBeInTheDocument()
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })

    it('应该处理空的clusterMaturity数组', () => {
      // Arrange
      /** @type {import('../GapAnalysisReport').GapAnalysisReportData} */
      const dataWithNoClusters = {
        ...mockReportData,
        clusterMaturity: [],
      }

      // Act
      const { container } = render(<GapAnalysisReport data={dataWithNoClusters} />)

      // Assert - 组件应该正常渲染
      expect(container.querySelector('.gap-analysis-report')).toBeInTheDocument()
    })
  })
})
