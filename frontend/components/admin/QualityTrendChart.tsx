/**
 * QualityTrendChart Component
 *
 * Displays quality trends over time using Recharts line chart.
 * Shows average rating trend and low-rated push count trend.
 *
 * @module frontend/components/admin
 * @story 7-2
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
  ReferenceLine,
} from 'recharts';
import { QualityTrendDataPoint } from '@/lib/api/content-quality';

interface QualityTrendChartProps {
  averageRatingTrend: QualityTrendDataPoint[];
  lowRatedPushCountTrend: QualityTrendDataPoint[];
}

export function QualityTrendChart({
  averageRatingTrend,
  lowRatedPushCountTrend,
}: QualityTrendChartProps) {
  // Merge data for display
  const mergedData = averageRatingTrend.map((item, index) => ({
    date: item.date,
    averageRating: item.value,
    lowRatedCount: lowRatedPushCountTrend[index]?.value || 0,
  }));

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg border p-6" data-testid="quality-trend-chart">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">质量趋势 (30天)</h3>

      {/* Average Rating Trend */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-2">平均评分趋势</h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mergedData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
              />
              <YAxis
                domain={[0, 5]}
                tick={{ fill: '#6b7280', fontSize: 11 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={4} stroke="#22c55e" strokeDasharray="3 3" label={{ value: '目标 4.0', fill: '#22c55e', fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="averageRating"
                name="平均评分"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Low Rated Push Count Trend */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">低分推送数量趋势</h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mergedData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 11 }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="lowRatedCount"
                name="低分推送数"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ fill: '#ef4444', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
