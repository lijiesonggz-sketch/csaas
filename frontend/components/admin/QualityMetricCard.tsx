/**
 * QualityMetricCard Component
 *
 * Displays a single content quality metric with icon and trend indicator.
 *
 * @module frontend/components/admin
 * @story 7-2
 */

import React from 'react';
import { StarIcon, ChatBubbleLeftIcon, ExclamationTriangleIcon, TrophyIcon } from '@heroicons/react/24/solid';

interface QualityMetricCardProps {
  title: string;
  value: number;
  subtitle?: string;
  type: 'rating' | 'feedback' | 'lowRated' | 'achievement';
  target?: number;
}

export function QualityMetricCard({ title, value, subtitle, type, target }: QualityMetricCardProps) {
  const icons = {
    rating: StarIcon,
    feedback: ChatBubbleLeftIcon,
    lowRated: ExclamationTriangleIcon,
    achievement: TrophyIcon,
  };

  const colors = {
    rating: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    feedback: 'bg-blue-50 border-blue-200 text-blue-700',
    lowRated: 'bg-red-50 border-red-200 text-red-700',
    achievement: 'bg-green-50 border-green-200 text-green-700',
  };

  const iconColors = {
    rating: 'text-yellow-500',
    feedback: 'text-blue-500',
    lowRated: 'text-red-500',
    achievement: 'text-green-500',
  };

  const Icon = icons[type];

  const formatValue = () => {
    if (type === 'rating') {
      return value.toFixed(1);
    }
    if (type === 'achievement') {
      return `${Math.round(value)}%`;
    }
    return value.toString();
  };

  return (
    <div className={`rounded-lg border-2 p-6 ${colors[type]}`} data-testid={`${type}-card`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <Icon className={`h-5 w-5 ${iconColors[type]}`} />
      </div>

      <div className="mt-2">
        <div className="flex items-baseline">
          <p className={`text-3xl font-bold ${colors[type].split(' ')[2]}`}>
            {formatValue()}
          </p>
          {target !== undefined && type === 'rating' && (
            <span className="ml-2 text-sm text-gray-500">
              / {target} 目标
            </span>
          )}
        </div>

        {subtitle && (
          <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
        )}

        {type === 'rating' && target !== undefined && (
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-yellow-400 h-2 rounded-full transition-all"
              style={{ width: `${Math.min((value / target) * 100, 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
