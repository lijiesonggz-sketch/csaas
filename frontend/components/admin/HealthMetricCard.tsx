/**
 * HealthMetricCard Component
 *
 * Displays a single health metric with current value, target, status, and trend.
 *
 * @module frontend/components/admin
 * @story 7-1
 */

import React from 'react';
import { ArrowUpIcon, ArrowDownIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';

interface HealthMetricCardProps {
  title: string;
  current: number;
  target: number;
  status: 'healthy' | 'warning' | 'critical';
  unit?: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
}

export function HealthMetricCard({
  title,
  current,
  target,
  status,
  unit = '%',
  subtitle,
  trend,
  trendValue,
}: HealthMetricCardProps) {
  const statusColors = {
    healthy: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    critical: 'bg-red-50 border-red-200',
  };

  const statusTextColors = {
    healthy: 'text-green-700',
    warning: 'text-yellow-700',
    critical: 'text-red-700',
  };

  const statusIcons = {
    healthy: <CheckCircleIcon className="h-5 w-5 text-green-500" />,
    warning: <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />,
    critical: <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />,
  };

  return (
    <div className={`rounded-lg border-2 p-6 ${statusColors[status]}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        {statusIcons[status]}
      </div>

      <div className="mt-2">
        <div className="flex items-baseline">
          <p className={`text-3xl font-bold ${statusTextColors[status]}`}>
            {(current ?? 0).toFixed(2)}
            {unit}
          </p>
          {trend && trendValue !== undefined && (
            <div className="ml-2 flex items-center text-sm">
              {trend === 'up' && (
                <>
                  <ArrowUpIcon className="h-4 w-4 text-green-500" />
                  <span className="text-green-600">+{trendValue.toFixed(1)}%</span>
                </>
              )}
              {trend === 'down' && (
                <>
                  <ArrowDownIcon className="h-4 w-4 text-red-500" />
                  <span className="text-red-600">-{trendValue.toFixed(1)}%</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-gray-600">
            目标: {target.toFixed(2)}
            {unit}
          </span>
          <span className={`font-medium ${statusTextColors[status]}`}>
            {status === 'healthy' && '正常'}
            {status === 'warning' && '警告'}
            {status === 'critical' && '异常'}
          </span>
        </div>

        {subtitle && <p className="mt-2 text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}
