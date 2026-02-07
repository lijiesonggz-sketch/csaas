/**
 * HealthTrendChart Component
 *
 * Displays health metric trends over time using Recharts.
 *
 * @module frontend/components/admin
 * @story 7-1
 */

'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface HealthTrendChartProps {
  metric: string;
  data: Array<{
    date: string;
    value: number;
  }>;
  range: '7d' | '30d' | '90d';
  onRangeChange?: (range: '7d' | '30d' | '90d') => void;
  onExport?: () => void;
}

export function HealthTrendChart({
  metric,
  data,
  range,
  onRangeChange,
  onExport,
}: HealthTrendChartProps) {
  const getMetricLabel = (metric: string) => {
    const labels: Record<string, string> = {
      availability: '系统可用性',
      push_success_rate: '推送成功率',
      ai_cost: 'AI成本',
      customer_activity: '客户活跃度',
    };
    return labels[metric] || metric;
  };

  const getRangeLabel = (range: string) => {
    const labels: Record<string, string> = {
      '7d': '最近7天',
      '30d': '最近30天',
      '90d': '最近90天',
    };
    return labels[range] || range;
  };

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {getMetricLabel(metric)} - {getRangeLabel(range)}
        </h3>

        <div className="flex items-center space-x-2">
          {onRangeChange && (
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              {(['7d', '30d', '90d'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => onRangeChange(r)}
                  className={`px-3 py-1 text-sm font-medium rounded ${
                    range === r
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {getRangeLabel(r)}
                </button>
              ))}
            </div>
          )}

          {onExport && (
            <button
              onClick={onExport}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              导出CSV
            </button>
          )}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-500">
          暂无数据
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '12px',
              }}
              labelFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('zh-CN');
              }}
              formatter={(value: number) => [value.toFixed(2), getMetricLabel(metric)]}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              formatter={() => getMetricLabel(metric)}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
