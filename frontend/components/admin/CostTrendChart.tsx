/**
 * CostTrendChart Component
 *
 * Displays AI cost trends over time using Recharts.
 *
 * @module frontend/components/admin
 * @story 7-4
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

interface CostTrendChartProps {
  data: Array<{
    date: string;
    cost: number;
    count: number;
  }>;
  days: number;
  onDaysChange?: (days: number) => void;
  onExport?: () => void;
}

export function CostTrendChart({ data, days, onDaysChange, onExport }: CostTrendChartProps) {
  const getDaysLabel = (days: number) => {
    const labels: Record<number, string> = {
      7: '最近7天',
      30: '最近30天',
      90: '最近90天',
    };
    return labels[days] || `最近${days}天`;
  };

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          AI成本趋势 - {getDaysLabel(days)}
        </h3>

        <div className="flex items-center space-x-2">
          {onDaysChange && (
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => onDaysChange(d)}
                  className={`px-3 py-1 text-sm font-medium rounded ${
                    days === d
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {getDaysLabel(d)}
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

      {!data || data.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-500">暂无数据</div>
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
            <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} domain={['auto', 'auto']} />
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
              formatter={(value: number, name: string) => {
                if (name === 'cost') {
                  return [`¥${value.toFixed(2)}`, 'AI成本'];
                }
                return [value, '调用次数'];
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line
              type="monotone"
              dataKey="cost"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 3 }}
              activeDot={{ r: 5 }}
              name="AI成本"
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: '#10b981', r: 3 }}
              activeDot={{ r: 5 }}
              name="调用次数"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
