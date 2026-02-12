/**
 * LowRatedPushList Component
 *
 * Displays a list of low-rated pushes with filtering and sorting.
 *
 * @module frontend/components/admin
 * @story 7-2
 */

'use client';

import React, { useState } from 'react';
import { LowRatedPush } from '@/lib/api/content-quality';
import { StarIcon, EyeIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { formatChinaDate } from '@/lib/utils/dateTime';

interface LowRatedPushListProps {
  pushes: LowRatedPush[];
  onViewDetails: (pushId: string) => void;
  loading?: boolean;
}

export function LowRatedPushList({ pushes, onViewDetails, loading }: LowRatedPushListProps) {
  const [filter, setFilter] = useState<'all' | 'tech' | 'industry' | 'compliance'>('all');

  const filteredPushes = filter === 'all'
    ? pushes
    : pushes.filter(p => p.radarType === filter);

  const getRadarTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      tech: '技术雷达',
      industry: '行业雷达',
      compliance: '合规雷达',
    };
    return labels[type] || type;
  };

  const getRadarTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      tech: 'bg-blue-100 text-blue-800',
      industry: 'bg-purple-100 text-purple-800',
      compliance: 'bg-orange-100 text-orange-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-6" data-testid="low-rated-push-list">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">低分推送列表</h3>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-6" data-testid="low-rated-push-list">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">低分推送列表</h3>
        <div className="flex items-center space-x-2">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
          <span className="text-sm text-red-600 font-medium">
            {filteredPushes.length} 条低分推送
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 mb-4">
        {(['all', 'tech', 'industry', 'compliance'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
              filter === type
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            data-testid={`radar-type-filter-${type}`}
          >
            {type === 'all' ? '全部' : getRadarTypeLabel(type)}
          </button>
        ))}
      </div>

      {/* Push List */}
      <div className="space-y-3">
        {filteredPushes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            暂无低分推送
          </div>
        ) : (
          filteredPushes.map((push) => (
            <div
              key={push.pushId}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              data-testid="low-rated-push-card"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getRadarTypeColor(push.radarType)}`}>
                      {getRadarTypeLabel(push.radarType)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatChinaDate(push.createdAt)}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 truncate" title={push.title}>
                    {push.title}
                  </h4>
                </div>

                <div className="flex items-center space-x-4 ml-4">
                  {/* Rating */}
                  <div className="text-center" data-testid="average-rating">
                    <div className="flex items-center text-red-600">
                      <StarIcon className="h-4 w-4 mr-1" />
                      <span className="text-lg font-bold">{push.averageRating.toFixed(1)}</span>
                    </div>
                    <p className="text-xs text-gray-500">{push.feedbackCount} 条反馈</p>
                  </div>

                  {/* View Details Button */}
                  <button
                    onClick={() => onViewDetails(push.pushId)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    data-testid="view-details-button"
                    title="查看详情"
                  >
                    <EyeIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
