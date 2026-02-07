/**
 * RatingDistributionChart Component
 *
 * Displays rating distribution as a bar chart using Recharts.
 *
 * @module frontend/components/admin
 * @story 7-2
 */

'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface RatingDistributionChartProps {
  distribution: Record<number, number>;
}

export function RatingDistributionChart({ distribution }: RatingDistributionChartProps) {
  const data = [
    { rating: '1星', count: distribution[1] || 0, fill: '#ef4444' },
    { rating: '2星', count: distribution[2] || 0, fill: '#f97316' },
    { rating: '3星', count: distribution[3] || 0, fill: '#eab308' },
    { rating: '4星', count: distribution[4] || 0, fill: '#84cc16' },
    { rating: '5星', count: distribution[5] || 0, fill: '#22c55e' },
  ];

  const total = Object.values(distribution).reduce((a, b) => a + b, 0);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (active && payload && payload.length) {
      const count = payload[0].value;
      const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
      return (
        <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
          <p className="font-medium">{payload[0].payload.rating}</p>
          <p className="text-sm text-gray-600">
            数量: {count}
          </p>
          <p className="text-sm text-gray-600">
            占比: {percentage}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg border p-6" data-testid="rating-distribution-chart">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">评分分布</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="rating"
              tick={{ fill: '#6b7280', fontSize: 12 }}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 12 }}
              axisLine={{ stroke: '#e5e7eb' }}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-2 text-center text-xs text-gray-600">
        {data.map((item) => (
          <div key={item.rating}>
            <span className="inline-block w-3 h-3 rounded mr-1" style={{ backgroundColor: item.fill }} />
            {item.rating}: {total > 0 ? ((item.count / total) * 100).toFixed(0) : 0}%
          </div>
        ))}
      </div>
    </div>
  );
}
