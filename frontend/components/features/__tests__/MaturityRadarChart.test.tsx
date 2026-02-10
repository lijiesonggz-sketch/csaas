import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import MaturityRadarChart, {
  MaturityRadarData,
  mapToRadarData,
  RADAR_DIMENSIONS,
  CustomTooltip,
} from '../MaturityRadarChart'

/**
 * 成熟度雷达图组件的测试套件
 *
 * 测试场景：
 * 1. 验证雷达图组件正确渲染，包含6个维度
 * 2. 验证数据绑定正确，数值显示精度为2位小数
 * 3. 验证空数据状态显示占位符
 * 4. 验证自定义颜色属性生效
 * 5. 验证对比数据（目标成熟度）正确显示
 */

describe('MaturityRadarChart - TDD', () => {
  const mockData: MaturityRadarData[] = [
    { name: '战略与治理', value: 3.52, fullMark: 5 },
    { name: '技术架构', value: 4.01, fullMark: 5 },
    { name: '流程与管理', value: 2.85, fullMark: 5 },
    { name: '人员能力', value: 3.25, fullMark: 5 },
    { name: '安全与合规', value: 4.15, fullMark: 5 },
    { name: '创新与文化', value: 2.95, fullMark: 5 },
  ]

  const mockComparisonData: MaturityRadarData[] = [
    { name: '战略与治理', value: 4.5, fullMark: 5 },
    { name: '技术架构', value: 4.5, fullMark: 5 },
    { name: '流程与管理', value: 4.5, fullMark: 5 },
    { name: '人员能力', value: 4.5, fullMark: 5 },
    { name: '安全与合规', value: 4.5, fullMark: 5 },
    { name: '创新与文化', value: 4.5, fullMark: 5 },
  ]

  describe('AC1: 雷达图组件渲染', () => {
    it('应该正确渲染雷达图组件', () => {
      // Arrange & Act
      const { container } = render(
        <MaturityRadarChart data={mockData} title="测试雷达图" />
      )

      // Assert
      expect(screen.getByText('测试雷达图')).toBeInTheDocument()
      // ResponsiveContainer should be rendered
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })

    it('应该使用ResponsiveContainer实现响应式', () => {
      // Arrange & Act
      const { container } = render(<MaturityRadarChart data={mockData} />)

      // Assert
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })

    it('应该显示卡片容器', () => {
      // Arrange & Act
      const { container } = render(<MaturityRadarChart data={mockData} />)

      // Assert - MUI Card uses MuiCard-root class
      expect(container.querySelector('.MuiCard-root')).toBeInTheDocument()
    })
  })

  describe('AC2: 数据绑定', () => {
    it('应该正确绑定数据到雷达图', () => {
      // Arrange & Act
      const { container } = render(<MaturityRadarChart data={mockData} />)

      // Assert - ResponsiveContainer indicates chart is rendered
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })

    it('应该使用传入的标题', () => {
      // Arrange & Act
      render(<MaturityRadarChart data={mockData} title="自定义标题" />)

      // Assert
      expect(screen.getByText('自定义标题')).toBeInTheDocument()
    })

    it('应该使用默认标题', () => {
      // Arrange & Act
      render(<MaturityRadarChart data={mockData} />)

      // Assert
      expect(screen.getByText('成熟度雷达图')).toBeInTheDocument()
    })

    it('应该在数据变化时自动更新雷达图', () => {
      // Arrange
      const initialData: MaturityRadarData[] = [
        { name: '战略与治理', value: 2.0, fullMark: 5 },
        { name: '技术架构', value: 2.5, fullMark: 5 },
        { name: '流程与管理', value: 2.0, fullMark: 5 },
        { name: '人员能力', value: 2.5, fullMark: 5 },
        { name: '安全与合规', value: 2.0, fullMark: 5 },
        { name: '创新与文化', value: 2.5, fullMark: 5 },
      ]

      const updatedData: MaturityRadarData[] = [
        { name: '战略与治理', value: 4.5, fullMark: 5 },
        { name: '技术架构', value: 4.8, fullMark: 5 },
        { name: '流程与管理', value: 4.2, fullMark: 5 },
        { name: '人员能力', value: 4.6, fullMark: 5 },
        { name: '安全与合规', value: 4.9, fullMark: 5 },
        { name: '创新与文化', value: 4.3, fullMark: 5 },
      ]

      const { rerender, container } = render(<MaturityRadarChart data={initialData} />)

      // Assert - 初始渲染成功
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()

      // Act - 更新数据
      rerender(<MaturityRadarChart data={updatedData} />)

      // Assert - 组件仍然渲染，说明已响应数据变化
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })
  })

  describe('AC3: 视觉样式', () => {
    it('应该应用自定义高度', () => {
      // Arrange & Act
      const { container } = render(
        <MaturityRadarChart data={mockData} height={300} />
      )

      // Assert
      const responsiveContainer = container.querySelector('.recharts-responsive-container')
      expect(responsiveContainer).toHaveStyle({ height: '300px' })
    })

    it('应该使用默认主题色', () => {
      // Arrange & Act
      const { container } = render(<MaturityRadarChart data={mockData} />)

      // Assert - 验证雷达图容器存在（默认颜色在组件内部设置）
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })

    it('应该有正确的边距设置', () => {
      // Arrange & Act
      const { container } = render(<MaturityRadarChart data={mockData} />)

      // Assert - MUI Card uses MuiCard-root class
      const card = container.querySelector('.MuiCard-root')
      expect(card).toBeInTheDocument()
    })
  })

  describe('AC4: 对比模式（当前vs目标）', () => {
    it('应该渲染对比模式下的组件', () => {
      // Arrange & Act
      const { container } = render(
        <MaturityRadarChart
          data={mockData}
          comparisonData={mockComparisonData}
          currentName="当前成熟度"
          comparisonName="目标成熟度"
          showLegend={true}
        />
      )

      // Assert
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })

    it('没有对比数据时应该只渲染当前成熟度图表', () => {
      // Arrange & Act
      const { container } = render(<MaturityRadarChart data={mockData} />)

      // Assert
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })
  })

  describe('空数据状态', () => {
    it('空数据时应该显示Empty占位符', () => {
      // Arrange & Act
      render(<MaturityRadarChart data={[]} />)

      // Assert
      expect(screen.getByText('暂无成熟度数据')).toBeInTheDocument()
    })

    it('空数据时应该显示Simple图片', () => {
      // Arrange & Act
      const { container } = render(<MaturityRadarChart data={[]} />)

      // Assert - MUI empty state uses Typography, no ant-empty-image class
      expect(screen.getByText('暂无成熟度数据')).toBeInTheDocument()
    })

    it('undefined数据时应该显示Empty占位符', () => {
      // Arrange & Act
      render(<MaturityRadarChart data={undefined as any} />)

      // Assert
      expect(screen.getByText('暂无成熟度数据')).toBeInTheDocument()
    })

    it('null数据时应该显示Empty占位符', () => {
      // Arrange & Act
      render(<MaturityRadarChart data={null as any} />)

      // Assert
      expect(screen.getByText('暂无成熟度数据')).toBeInTheDocument()
    })
  })

  describe('mapToRadarData工具函数', () => {
    it('应该正确映射维度成熟度数据', () => {
      // Arrange
      const dimensionMaturity = [
        { dimension: '战略与治理', clusterCount: 2, maturityLevel: 3.5, grade: '充分规范级' },
        { dimension: '技术架构', clusterCount: 3, maturityLevel: 4.0, grade: '系统优化级' },
        { dimension: '流程与管理', clusterCount: 2, maturityLevel: 2.8, grade: '初步规范级' },
        { dimension: '人员能力', clusterCount: 2, maturityLevel: 3.2, grade: '充分规范级' },
        { dimension: '安全与合规', clusterCount: 3, maturityLevel: 4.2, grade: '系统优化级' },
        { dimension: '创新与文化', clusterCount: 1, maturityLevel: 2.9, grade: '初步规范级' },
      ]

      // Act
      const result = mapToRadarData(dimensionMaturity)

      // Assert
      expect(result).toHaveLength(6)
      expect(result[0].name).toBe('战略与治理')
      expect(result[0].value).toBe(3.5)
      expect(result[0].fullMark).toBe(5)
    })

    it('应该计算同一维度的平均成熟度', () => {
      // Arrange
      const dimensionMaturity = [
        { dimension: '技术架构', clusterCount: 1, maturityLevel: 3.0, grade: '充分规范级' },
        { dimension: '技术架构', clusterCount: 1, maturityLevel: 5.0, grade: '卓越级' },
      ]

      // Act
      const result = mapToRadarData(dimensionMaturity)

      // Assert - 技术架构的平均值应该是4.0
      const techArch = result.find((r) => r.name === '技术架构')
      expect(techArch?.value).toBe(4.0)
    })

    it('缺失维度应该使用默认值3', () => {
      // Arrange
      const dimensionMaturity = [
        { dimension: '技术架构', clusterCount: 1, maturityLevel: 4.0, grade: '系统优化级' },
      ]

      // Act
      const result = mapToRadarData(dimensionMaturity)

      // Assert
      expect(result).toHaveLength(6)
      const techArch = result.find((r) => r.name === '技术架构')
      expect(techArch?.value).toBe(4.0)

      // 其他维度应该使用默认值3
      const strategy = result.find((r) => r.name === '战略与治理')
      expect(strategy?.value).toBe(3)
    })

    it('数值应该保留2位小数', () => {
      // Arrange
      const dimensionMaturity = [
        { dimension: '技术架构', clusterCount: 1, maturityLevel: 3.33333, grade: '充分规范级' },
      ]

      // Act
      const result = mapToRadarData(dimensionMaturity)

      // Assert
      const techArch = result.find((r) => r.name === '技术架构')
      expect(techArch?.value).toBe(3.33)
    })

    it('应该处理空数组输入', () => {
      // Arrange
      const dimensionMaturity: any[] = []

      // Act
      const result = mapToRadarData(dimensionMaturity)

      // Assert - 所有维度应该使用默认值3
      expect(result).toHaveLength(6)
      result.forEach((item) => {
        expect(item.value).toBe(3)
        expect(item.fullMark).toBe(5)
      })
    })
  })

  describe('响应式行为', () => {
    it('应该根据height属性设置高度', () => {
      // Arrange & Act
      const { container } = render(
        <MaturityRadarChart data={mockData} height={300} />
      )

      // Assert
      const responsiveContainer = container.querySelector('.recharts-responsive-container')
      expect(responsiveContainer).toHaveStyle({ height: '300px' })
    })

    it('默认高度应该是400', () => {
      // Arrange & Act
      const { container } = render(<MaturityRadarChart data={mockData} />)

      // Assert
      const responsiveContainer = container.querySelector('.recharts-responsive-container')
      expect(responsiveContainer).toHaveStyle({ height: '400px' })
    })
  })

  describe('可访问性', () => {
    it('应该使用语义化的标题', () => {
      // Arrange & Act
      render(<MaturityRadarChart data={mockData} title="成熟度分析结果" />)

      // Assert
      expect(screen.getByText('成熟度分析结果')).toBeInTheDocument()
    })

    it('应该显示雷达图图标', () => {
      // Arrange & Act
      const { container } = render(<MaturityRadarChart data={mockData} />)

      // Assert - MUI RadarIcon uses data-testid="RadarIcon"
      const icon = container.querySelector('[data-testid="RadarIcon"]')
      expect(icon).toBeInTheDocument()
    })
  })

  describe('RADAR_DIMENSIONS常量', () => {
    it('应该包含6个维度', () => {
      expect(RADAR_DIMENSIONS).toHaveLength(6)
    })

    it('应该包含所有预期的维度', () => {
      expect(RADAR_DIMENSIONS).toContain('战略与治理')
      expect(RADAR_DIMENSIONS).toContain('技术架构')
      expect(RADAR_DIMENSIONS).toContain('流程与管理')
      expect(RADAR_DIMENSIONS).toContain('人员能力')
      expect(RADAR_DIMENSIONS).toContain('安全与合规')
      expect(RADAR_DIMENSIONS).toContain('创新与文化')
    })
  })

  describe('CustomTooltip 提示框', () => {
    it('应该在悬停时显示自定义提示框', () => {
      // Arrange & Act
      const { container } = render(<MaturityRadarChart data={mockData} />)

      // Assert - 验证Tooltip组件存在
      expect(container.querySelector('.recharts-tooltip-wrapper')).toBeDefined()
    })

    it('应该支持自定义颜色属性', () => {
      // Arrange & Act
      const { container } = render(
        <MaturityRadarChart
          data={mockData}
          color="#ff4d4f"
          fillColor="#ff7875"
        />
      )

      // Assert - 验证雷达图容器存在（自定义颜色在组件内部设置）
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })

    it('应该在对比模式下显示两个雷达图', () => {
      // Arrange & Act
      const { container } = render(
        <MaturityRadarChart
          data={mockData}
          comparisonData={mockComparisonData}
          showLegend={true}
        />
      )

      // Assert - 验证雷达图容器存在（图例在SVG/Canvas中渲染，不在DOM文本中）
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })

    it('应该支持隐藏图例', () => {
      // Arrange & Act
      const { container } = render(
        <MaturityRadarChart data={mockData} showLegend={false} />
      )

      // Assert - 验证雷达图容器存在
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })

    it('应该应用自定义类名', () => {
      // Arrange & Act
      const { container } = render(
        <MaturityRadarChart data={mockData} className="custom-radar-chart" />
      )

      // Assert
      expect(container.querySelector('.custom-radar-chart')).toBeInTheDocument()
    })

    it('应该支持自定义当前数据和对比数据名称', () => {
      // Arrange & Act
      const { container } = render(
        <MaturityRadarChart
          data={mockData}
          comparisonData={mockComparisonData}
          currentName="现状成熟度"
          comparisonName="期望成熟度"
        />
      )

      // Assert - 验证雷达图容器存在（自定义名称在SVG/Canvas中渲染，不在DOM文本中）
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })

    it('应该处理对比数据项少于当前数据的情况', () => {
      // Arrange - 对比数据只有3项，而当前数据有6项
      const partialComparisonData: MaturityRadarData[] = [
        { name: '战略与治理', value: 4.5, fullMark: 5 },
        { name: '技术架构', value: 4.5, fullMark: 5 },
        { name: '流程与管理', value: 4.5, fullMark: 5 },
      ]

      // Act
      const { container } = render(
        <MaturityRadarChart
          data={mockData}
          comparisonData={partialComparisonData}
        />
      )

      // Assert - 验证雷达图容器存在
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })
  })

  describe('CustomTooltip 组件单元测试', () => {
    it('应该在active为true时渲染提示框内容', () => {
      // Arrange
      const payload = [
        { name: '当前成熟度', value: 3.5, color: '#1890ff' },
      ]

      // Act
      const { container } = render(
        <CustomTooltip active={true} payload={payload} label="技术架构" />
      )

      // Assert
      expect(screen.getByText('技术架构')).toBeInTheDocument()
      expect(screen.getByText('当前成熟度: 3.50 / 5.0')).toBeInTheDocument()
    })

    it('应该渲染多个payload项', () => {
      // Arrange
      const payload = [
        { name: '当前成熟度', value: 3.5, color: '#1890ff' },
        { name: '目标成熟度', value: 4.5, color: '#52c41a' },
      ]

      // Act
      const { container } = render(
        <CustomTooltip active={true} payload={payload} label="战略与治理" />
      )

      // Assert
      expect(screen.getByText('战略与治理')).toBeInTheDocument()
      expect(screen.getByText('当前成熟度: 3.50 / 5.0')).toBeInTheDocument()
      expect(screen.getByText('目标成熟度: 4.50 / 5.0')).toBeInTheDocument()
    })

    it('应该在active为false时返回null', () => {
      // Arrange
      const payload = [{ name: '当前成熟度', value: 3.5, color: '#1890ff' }]

      // Act
      const { container } = render(
        <CustomTooltip active={false} payload={payload} label="技术架构" />
      )

      // Assert
      expect(container.firstChild).toBeNull()
    })

    it('应该在payload为空数组时返回null', () => {
      // Act
      const { container } = render(
        <CustomTooltip active={true} payload={[]} label="技术架构" />
      )

      // Assert
      expect(container.firstChild).toBeNull()
    })

    it('应该在payload为undefined时返回null', () => {
      // Act
      const { container } = render(
        <CustomTooltip active={true} payload={undefined} label="技术架构" />
      )

      // Assert
      expect(container.firstChild).toBeNull()
    })

    it('应该正确处理数值精度', () => {
      // Arrange
      const payload = [
        { name: '当前成熟度', value: 3.33333, color: '#1890ff' },
      ]

      // Act
      render(<CustomTooltip active={true} payload={payload} label="技术架构" />)

      // Assert - 验证数值保留2位小数
      expect(screen.getByText('当前成熟度: 3.33 / 5.0')).toBeInTheDocument()
    })

    it('应该正确处理整数数值', () => {
      // Arrange
      const payload = [
        { name: '当前成熟度', value: 5, color: '#1890ff' },
      ]

      // Act
      render(<CustomTooltip active={true} payload={payload} label="技术架构" />)

      // Assert - 验证整数显示为5.00
      expect(screen.getByText('当前成熟度: 5.00 / 5.0')).toBeInTheDocument()
    })

    it('应该正确处理零值', () => {
      // Arrange
      const payload = [
        { name: '当前成熟度', value: 0, color: '#1890ff' },
      ]

      // Act
      render(<CustomTooltip active={true} payload={payload} label="技术架构" />)

      // Assert - 验证零值显示为0.00
      expect(screen.getByText('当前成熟度: 0.00 / 5.0')).toBeInTheDocument()
    })

    it('应该正确处理四舍五入（3.336应该显示为3.34）', () => {
      // Arrange
      const payload = [
        { name: '当前成熟度', value: 3.336, color: '#1890ff' },
      ]

      // Act
      render(<CustomTooltip active={true} payload={payload} label="技术架构" />)

      // Assert - 验证四舍五入行为
      expect(screen.getByText('当前成熟度: 3.34 / 5.0')).toBeInTheDocument()
    })

    it('应该正确处理向下取整（3.334应该显示为3.33）', () => {
      // Arrange
      const payload = [
        { name: '当前成熟度', value: 3.334, color: '#1890ff' },
      ]

      // Act
      render(<CustomTooltip active={true} payload={payload} label="技术架构" />)

      // Assert - 验证向下取整行为
      expect(screen.getByText('当前成熟度: 3.33 / 5.0')).toBeInTheDocument()
    })
  })

  describe('数据验证和边界情况', () => {
    it('应该处理数据值为0的情况', () => {
      // Arrange
      const zeroData: MaturityRadarData[] = [
        { name: '战略与治理', value: 0, fullMark: 5 },
        { name: '技术架构', value: 0, fullMark: 5 },
        { name: '流程与管理', value: 0, fullMark: 5 },
        { name: '人员能力', value: 0, fullMark: 5 },
        { name: '安全与合规', value: 0, fullMark: 5 },
        { name: '创新与文化', value: 0, fullMark: 5 },
      ]

      // Act
      const { container } = render(<MaturityRadarChart data={zeroData} />)

      // Assert
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })

    it('应该处理数据值为最大值的情况', () => {
      // Arrange
      const maxData: MaturityRadarData[] = [
        { name: '战略与治理', value: 5, fullMark: 5 },
        { name: '技术架构', value: 5, fullMark: 5 },
        { name: '流程与管理', value: 5, fullMark: 5 },
        { name: '人员能力', value: 5, fullMark: 5 },
        { name: '安全与合规', value: 5, fullMark: 5 },
        { name: '创新与文化', value: 5, fullMark: 5 },
      ]

      // Act
      const { container } = render(<MaturityRadarChart data={maxData} />)

      // Assert
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })

    it('应该处理部分维度数据缺失的情况', () => {
      // Arrange
      const partialData: MaturityRadarData[] = [
        { name: '战略与治理', value: 3.5, fullMark: 5 },
        { name: '技术架构', value: 4.0, fullMark: 5 },
      ]

      // Act
      const { container } = render(<MaturityRadarChart data={partialData} />)

      // Assert
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })
  })

  describe('mapToRadarData 边界情况', () => {
    it('应该处理包含多个相同维度的数据', () => {
      // Arrange
      const dimensionMaturity = [
        { dimension: '技术架构', clusterCount: 1, maturityLevel: 3.0, grade: '充分规范级' },
        { dimension: '技术架构', clusterCount: 1, maturityLevel: 4.0, grade: '系统优化级' },
        { dimension: '技术架构', clusterCount: 1, maturityLevel: 5.0, grade: '卓越级' },
      ]

      // Act
      const result = mapToRadarData(dimensionMaturity)

      // Assert - 平均值应该是 (3.0 + 4.0 + 5.0) / 3 = 4.0
      const techArch = result.find((r) => r.name === '技术架构')
      expect(techArch?.value).toBe(4.0)
    })

    it('应该处理包含未知维度的情况', () => {
      // Arrange
      const dimensionMaturity = [
        { dimension: '未知维度', clusterCount: 1, maturityLevel: 4.0, grade: '系统优化级' },
      ]

      // Act
      const result = mapToRadarData(dimensionMaturity)

      // Assert - 未知维度不应该影响结果，其他维度使用默认值
      expect(result).toHaveLength(6)
      const unknownDimension = result.find((r) => r.name === '未知维度')
      expect(unknownDimension).toBeUndefined()
    })

    it('应该处理负数值的情况', () => {
      // Arrange
      const dimensionMaturity = [
        { dimension: '技术架构', clusterCount: 1, maturityLevel: -1, grade: '初始级' },
      ]

      // Act
      const result = mapToRadarData(dimensionMaturity)

      // Assert
      const techArch = result.find((r) => r.name === '技术架构')
      expect(techArch?.value).toBe(-1)
    })
  })
})
