/**
 * HealthMetricCard Component
 *
 * Displays a single health metric with current value, target, status, and trend.
 *
 * @module frontend/components/admin
 * @story 7-1
 */

import React from 'react'
import {
  ArrowUpIcon,
  ArrowDownIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/solid'

interface HealthMetricCardProps {
  title: string
  current: number
  target: number
  status: 'healthy' | 'warning' | 'critical'
  unit?: string
  subtitle?: string
  trend?: 'up' | 'down' | 'stable'
  trendValue?: number
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
  const statusAccent = {
    healthy: 'border-l-[#059669]',
    warning: 'border-l-amber-500',
    critical: 'border-l-red-600',
  }

  const statusTextColors = {
    healthy: 'text-[#059669]',
    warning: 'text-amber-700',
    critical: 'text-red-700',
  }

  const statusIcons = {
    healthy: <CheckCircleIcon className="h-5 w-5 text-[#059669]" />,
    warning: <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />,
    critical: <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />,
  }

  return (
    <div
      className={`rounded-sm border border-l-4 border-[#E2E8F0] bg-white p-6 shadow-sm ${statusAccent[status]}`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-[#64748B]">{title}</h3>
        {statusIcons[status]}
      </div>

      <div className="mt-2">
        <div className="flex items-baseline">
          <p className="text-3xl font-bold text-[#1E3A5F]">
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
          <span className="text-[#64748B]">
            目标: {target.toFixed(2)}
            {unit}
          </span>
          <span
            className={`rounded-sm px-2 py-0.5 text-xs font-medium ${statusTextColors[status]} bg-[#F8FAFC]`}
          >
            {status === 'healthy' && '正常'}
            {status === 'warning' && '警告'}
            {status === 'critical' && '异常'}
          </span>
        </div>

        {subtitle && <p className="mt-2 text-xs text-[#64748B]">{subtitle}</p>}
      </div>
    </div>
  )
}
