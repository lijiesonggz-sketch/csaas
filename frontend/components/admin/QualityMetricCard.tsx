/**
 * QualityMetricCard Component
 *
 * Displays a single content quality metric with icon and trend indicator.
 *
 * @module frontend/components/admin
 * @story 7-2
 */

import React from 'react'
import {
  StarIcon,
  ChatBubbleLeftIcon,
  ExclamationTriangleIcon,
  TrophyIcon,
} from '@heroicons/react/24/solid'

interface QualityMetricCardProps {
  title: string
  value: number
  subtitle?: string
  type: 'rating' | 'feedback' | 'lowRated' | 'achievement'
  target?: number
}

export function QualityMetricCard({
  title,
  value,
  subtitle,
  type,
  target,
}: QualityMetricCardProps) {
  const icons = {
    rating: StarIcon,
    feedback: ChatBubbleLeftIcon,
    lowRated: ExclamationTriangleIcon,
    achievement: TrophyIcon,
  }

  const accentColors = {
    rating: 'border-l-amber-500',
    feedback: 'border-l-[#1E3A5F]',
    lowRated: 'border-l-red-600',
    achievement: 'border-l-[#059669]',
  }

  const iconColors = {
    rating: 'text-yellow-500',
    feedback: 'text-blue-500',
    lowRated: 'text-red-500',
    achievement: 'text-green-500',
  }

  const Icon = icons[type]

  const formatValue = () => {
    if (type === 'rating') {
      return value.toFixed(1)
    }
    if (type === 'achievement') {
      return `${Math.round(value)}%`
    }
    return value.toString()
  }

  return (
    <div
      className={`rounded-sm border border-l-4 border-[#E2E8F0] bg-white p-6 shadow-sm ${accentColors[type]}`}
      data-testid={`${type}-card`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-[#64748B]">{title}</h3>
        <Icon className={`h-5 w-5 ${iconColors[type]}`} />
      </div>

      <div className="mt-2">
        <div className="flex items-baseline">
          <p className="text-3xl font-bold text-[#1E3A5F]">{formatValue()}</p>
          {target !== undefined && type === 'rating' && (
            <span className="ml-2 text-sm text-[#64748B]">/ {target} 目标</span>
          )}
        </div>

        {subtitle && <p className="mt-1 text-xs text-[#64748B]">{subtitle}</p>}

        {type === 'rating' && target !== undefined && (
          <div className="mt-2 w-full bg-[#E2E8F0] rounded-full h-2">
            <div
              className="bg-[#1E3A5F] h-2 rounded-full transition-all"
              style={{ width: `${Math.min((value / target) * 100, 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
