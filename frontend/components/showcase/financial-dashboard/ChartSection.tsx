'use client'

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

const maturityData = [
  { dimension: '信息安全', score: 85, fullMark: 100 },
  { dimension: '访问控制', score: 72, fullMark: 100 },
  { dimension: '数据保护', score: 90, fullMark: 100 },
  { dimension: '运维管理', score: 68, fullMark: 100 },
  { dimension: '应急响应', score: 75, fullMark: 100 },
  { dimension: '合规治理', score: 82, fullMark: 100 },
]

const gapData = [
  { name: '信息安全', current: 85, target: 95 },
  { name: '访问控制', current: 72, target: 90 },
  { name: '数据保护', current: 90, target: 95 },
  { name: '运维管理', current: 68, target: 85 },
  { name: '应急响应', current: 75, target: 90 },
  { name: '合规治理', current: 82, target: 95 },
]

export function ChartSection() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Radar Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">合规成熟度雷达</h3>
        <p className="text-xs text-gray-500 mb-4">各维度成熟度评分</p>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={maturityData}>
            <PolarGrid stroke="#E5E7EB" />
            <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: '#6B7280' }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
            <Radar
              name="当前评分"
              dataKey="score"
              stroke="#2563EB"
              fill="#2563EB"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Bar Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">差距分析</h3>
        <p className="text-xs text-gray-500 mb-4">当前水平 vs 目标水平</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={gapData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid #E5E7EB',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="current" fill="#2563EB" radius={[2, 2, 0, 0]} name="当前" />
            <Bar dataKey="target" fill="#93C5FD" radius={[2, 2, 0, 0]} name="目标" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
