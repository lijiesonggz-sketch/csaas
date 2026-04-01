/**
 * Client Segmentation Chart Component
 *
 * Story 7.3: 客户管理与流失风险预警
 *
 * 使用 Recharts 饼图显示客户活跃度分布
 */

'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
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
  const chartData = data.map((segment) => ({
    name: LABELS[segment.name] || segment.label,
    value: segment.count,
    percentage: segment.percentage,
    fill: COLORS[segment.name] || '#94A3B8',
  }))

  const renderLabel = (entry: any) => {
    return `${entry.name}: ${entry.percentage}%`
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold">{data.name}</p>
          <p className="text-sm text-muted-foreground">数量: {data.value} 家</p>
          <p className="text-sm text-muted-foreground">占比: {data.percentage}%</p>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="border border-[#E2E8F0] rounded-sm h-[400px]">
      <CardContent className="p-6">
      <h3 className="text-lg font-semibold mb-4">客户活跃度分布</h3>
      <div className="w-full h-[320px]">
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
      </div>
      </CardContent>
    </Card>
  )
}
