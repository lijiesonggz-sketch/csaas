'use client'

/**
 * 成熟度雷达图组件
 * 使用 recharts 库展示六个维度的成熟度分布
 */

import React, { useMemo, useState, useEffect } from 'react'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import RadarIcon from '@mui/icons-material/Radar'

/**
 * 雷达图数据项接口
 */
export interface MaturityRadarData {
  name: string
  value: number
  fullMark: number
}

/**
 * 组件属性接口
 */
interface MaturityRadarChartProps {
  /** 雷达图数据 */
  data: MaturityRadarData[]
  /** 图表标题 */
  title?: string
  /** 主颜色 */
  color?: string
  /** 填充色 */
  fillColor?: string
  /** 图表高度 */
  height?: number
  /** 是否显示图例 */
  showLegend?: boolean
  /** 额外的CSS类名 */
  className?: string
  /** 对比数据（用于显示目标成熟度） */
  comparisonData?: MaturityRadarData[]
  /** 对比数据名称 */
  comparisonName?: string
  /** 当前数据名称 */
  currentName?: string
}

/**
 * 6个雷达图维度定义
 */
export const RADAR_DIMENSIONS = [
  '战略与治理',
  '技术架构',
  '流程与管理',
  '人员能力',
  '安全与合规',
  '创新与文化',
] as const

/**
 * 从维度成熟度数据映射到雷达图数据
 * @param dimensionMaturity - 维度成熟度数据
 * @returns 雷达图数据数组
 */
export const mapToRadarData = (
  dimensionMaturity: Array<{
    dimension: string
    clusterCount: number
    maturityLevel: number
    grade: string
  }>
): MaturityRadarData[] => {
  // 按维度名称分组计算平均成熟度
  const dimensionMap = new Map<string, number[]>()

  dimensionMaturity.forEach((d) => {
    const values = dimensionMap.get(d.dimension) || []
    values.push(d.maturityLevel)
    dimensionMap.set(d.dimension, values)
  })

  // 生成雷达图数据
  return RADAR_DIMENSIONS.map((name) => {
    const values = dimensionMap.get(name) || [3]
    // 防止除以零
    const avgValue = values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 3
    return {
      name,
      value: Number(avgValue.toFixed(2)),
      fullMark: 5,
    }
  })
}

/**
 * 默认颜色配置
 */
const DEFAULT_COLORS = {
  stroke: '#1890ff',
  fill: '#1890ff',
  comparisonStroke: '#52c41a',
  comparisonFill: '#52c41a',
}

/**
 * 渐变色配置（#1890ff 到 #52c41a）
 */
const GRADIENT_CONFIG = {
  id: 'radarGradient',
  startColor: '#1890ff',
  endColor: '#52c41a',
}

/**
 * 自定义提示框属性接口
 */
interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    name: string
    value: number
    color: string
  }>
  label?: string
}

/**
 * 自定义提示框组件
 * @param active - 是否激活
 * @param payload - 数据项
 * @param label - 标签
 */
export const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
}) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          backgroundColor: '#fff',
          border: '1px solid #d9d9d9',
          borderRadius: '4px',
          padding: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        }}
      >
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#333' }}>
          {label}
        </p>
        {payload.map((entry, index) => (
          <p
            key={index}
            style={{
              margin: '4px 0',
              color: entry.color,
              fontSize: '14px',
            }}
          >
            {entry.name}: {entry.value.toFixed(2)} / 5.0
          </p>
        ))}
      </div>
    )
  }
  return null
}

/**
 * 成熟度雷达图组件
 *
 * @example
 * ```tsx
 * <MaturityRadarChart
 *   data={[
 *     { name: '战略与治理', value: 3.5, fullMark: 5 },
 *     { name: '技术架构', value: 4.0, fullMark: 5 },
 *     ...
 *   ]}
 *   title="成熟度分析"
 * />
 * ```
 */
export const MaturityRadarChart: React.FC<MaturityRadarChartProps> = ({
  data,
  title = '成熟度雷达图',
  color = DEFAULT_COLORS.stroke,
  fillColor = DEFAULT_COLORS.fill,
  height: propHeight,
  showLegend = true,
  className = '',
  comparisonData,
  comparisonName = '目标成熟度',
  currentName = '当前成熟度',
}) => {
  /**
   * 响应式高度和半径配置
   */
  const [responsiveConfig, setResponsiveConfig] = useState({
    height: propHeight || 400,
    outerRadius: '80%',
  })

  /**
   * 监听窗口大小变化，实现响应式布局
   */
  useEffect(() => {
    const updateConfig = () => {
      const width = window.innerWidth
      if (width < 768) {
        // 移动端
        setResponsiveConfig({
          height: propHeight || 300,
          outerRadius: '60%',
        })
      } else if (width < 1024) {
        // 平板端
        setResponsiveConfig({
          height: propHeight || 350,
          outerRadius: '70%',
        })
      } else {
        // 桌面端
        setResponsiveConfig({
          height: propHeight || 400,
          outerRadius: '80%',
        })
      }
    }

    // 初始设置
    updateConfig()

    // 监听窗口变化
    window.addEventListener('resize', updateConfig)
    return () => window.removeEventListener('resize', updateConfig)
  }, [propHeight])

  /**
   * 验证数据是否有效
   */
  const isValidData = useMemo(() => {
    return Array.isArray(data) && data.length > 0
  }, [data])

  /**
   * 验证对比数据是否有效
   */
  const isValidComparisonData = useMemo(() => {
    return Array.isArray(comparisonData) && comparisonData.length > 0
  }, [comparisonData])

  /**
   * 合并数据（用于同时显示当前和目标）
   */
  const mergedData = useMemo(() => {
    if (!isValidData) return []

    if (!isValidComparisonData) {
      return data.map((item) => ({
        name: item.name,
        current: item.value,
        target: 0,
        fullMark: item.fullMark,
      }))
    }

    return data.map((item, index) => ({
      name: item.name,
      current: item.value,
      target: comparisonData?.[index]?.value ?? 0,
      fullMark: item.fullMark,
    }))
  }, [data, comparisonData, isValidData, isValidComparisonData])

  // 空数据状态
  if (!isValidData) {
    return (
      <Card className={className} sx={{ my: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <RadarIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="subtitle1" fontWeight={600}>
              {title}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <Typography>暂无成熟度数据</Typography>
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className} sx={{ my: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <RadarIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="subtitle1" fontWeight={600}>
            {title}
          </Typography>
        </Box>
        <ResponsiveContainer width="100%" height={responsiveConfig.height}>
        <RadarChart
          cx="50%"
          cy="50%"
          outerRadius={responsiveConfig.outerRadius}
          data={mergedData}
          margin={{ top: 24, right: 24, bottom: 24, left: 24 }}
        >
          {/* 定义渐变色 */}
          <defs>
            <linearGradient id={GRADIENT_CONFIG.id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GRADIENT_CONFIG.startColor} stopOpacity={0.6} />
              <stop offset="100%" stopColor={GRADIENT_CONFIG.endColor} stopOpacity={0.3} />
            </linearGradient>
          </defs>

          <PolarGrid stroke="#e8e8e8" />
          <PolarAngleAxis
            dataKey="name"
            tick={{
              fill: '#333',
              fontSize: 14,
              fontWeight: 500,
            }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 5]}
            tick={{ fill: '#666', fontSize: 12 }}
            tickCount={6}
          />

          {/* 当前成熟度 - 使用渐变色填充 */}
          <Radar
            name={currentName}
            dataKey="current"
            stroke={color}
            fill={`url(#${GRADIENT_CONFIG.id})`}
            fillOpacity={0.6}
            strokeWidth={2}
          />

          {/* 目标成熟度（如果有对比数据） */}
          {isValidComparisonData && (
            <Radar
              name={comparisonName}
              dataKey="target"
              stroke={DEFAULT_COLORS.comparisonStroke}
              fill={DEFAULT_COLORS.comparisonFill}
              fillOpacity={0.1}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
          )}

          {showLegend && (
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{
                paddingTop: '24px',
                fontSize: '14px',
              }}
            />
          )}

          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export default MaturityRadarChart
