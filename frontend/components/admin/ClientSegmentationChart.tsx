/**
 * Client Segmentation Chart Component
 *
 * Story 7.3: 客户管理与流失风险预警
 *
 * 使用 Recharts 饼图显示客户活跃度分布
 */

'use client'

import React from 'react'
import { Paper, Typography, Box, useTheme } from '@mui/material'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { ClientSegment, ActivityStatus } from '@/lib/api/clients-activity'

interface ClientSegmentationChartProps {
  data: ClientSegment[]
}

const COLORS: Record<string, string> = {
  [ActivityStatus.HIGH_ACTIVE]: '#4caf50',   // 绿色
  [ActivityStatus.MEDIUM_ACTIVE]: '#ff9800', // 橙色
  [ActivityStatus.LOW_ACTIVE]: '#f44336',    // 红色
  [ActivityStatus.CHURN_RISK]: '#d32f2f',    // 深红色
}

const LABELS: Record<string, string> = {
  [ActivityStatus.HIGH_ACTIVE]: '高活跃',
  [ActivityStatus.MEDIUM_ACTIVE]: '中活跃',
  [ActivityStatus.LOW_ACTIVE]: '低活跃',
  [ActivityStatus.CHURN_RISK]: '流失风险',
}

export function ClientSegmentationChart({ data }: ClientSegmentationChartProps) {
  const theme = useTheme()

  const chartData = data.map((segment) => ({
    name: LABELS[segment.name] || segment.label,
    value: segment.count,
    percentage: segment.percentage,
    fill: COLORS[segment.name] || theme.palette.grey[500],
  }))

  const renderLabel = (entry: any) => {
    return `${entry.name}: ${entry.percentage}%`
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <Paper sx={{ p: 1.5, boxShadow: 2 }}>
          <Typography variant="body2" fontWeight="bold">
            {data.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            数量: {data.value} 家
          </Typography>
          <Typography variant="body2" color="text.secondary">
            占比: {data.percentage}%
          </Typography>
        </Paper>
      )
    }
    return null
  }

  return (
    <Paper sx={{ p: 3, height: 400 }}>
      <Typography variant="h6" gutterBottom>
        客户活跃度分布
      </Typography>
      <Box sx={{ width: '100%', height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderLabel}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value: string, entry: any) => (
                <span style={{ color: entry.color }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  )
}
