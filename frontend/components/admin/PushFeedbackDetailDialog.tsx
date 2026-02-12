/**
 * PushFeedbackDetailDialog Component
 *
 * Displays detailed feedback information for a specific push.
 * Includes push content, user feedback, and optimization suggestions.
 *
 * @module frontend/components/admin
 * @story 7-2
 */

'use client';

import React, { useState } from 'react';
import { PushFeedbackDetail } from '@/lib/api/content-quality';
import { StarIcon, LightBulbIcon, CheckCircleIcon, XCircleIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { formatChinaDate } from '@/lib/utils/dateTime';

interface PushFeedbackDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  detail: PushFeedbackDetail | null;
  onMarkOptimized: (pushId: string) => void;
  onMarkIgnored: (pushId: string) => void;
  loading?: boolean;
}

export function PushFeedbackDetailDialog({
  isOpen,
  onClose,
  detail,
  onMarkOptimized,
  onMarkIgnored,
  loading,
}: PushFeedbackDetailDialogProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'feedback' | 'suggestions'>('content');

  if (!isOpen || !detail) return null;

  const { push, feedback, optimizationSuggestions, status } = detail;

  const getStatusBadge = () => {
    switch (status) {
      case 'optimized':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800" data-testid="status-optimized-badge">
            <CheckCircleIcon className="h-3 w-3 mr-1" />
            已优化
          </span>
        );
      case 'ignored':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <XCircleIcon className="h-3 w-3 mr-1" />
            已忽略
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            待处理
          </span>
        );
    }
  };

  const averageRating = feedback.length > 0
    ? feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length
    : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" data-testid="push-feedback-detail-dialog">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Dialog */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
          {/* Header */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">推送反馈详情</h3>
              <p className="text-sm text-gray-500 mt-1">{push.title}</p>
            </div>
            <div className="flex items-center space-x-3">
              {getStatusBadge()}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 py-4 sm:px-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center text-yellow-600">
                  <StarIcon className="h-5 w-5 mr-1" />
                  <span className="text-2xl font-bold">{averageRating.toFixed(1)}</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">平均评分</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <span className="text-2xl font-bold text-blue-600">{feedback.length}</span>
                <p className="text-xs text-gray-600 mt-1">反馈数量</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <span className="text-2xl font-bold text-purple-600">{(push.relevanceScore * 100).toFixed(0)}%</span>
                <p className="text-xs text-gray-600 mt-1">相关性评分</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-4">
              <nav className="-mb-px flex space-x-8">
                {[
                  { key: 'content', label: '推送内容' },
                  { key: 'feedback', label: `用户反馈 (${feedback.length})` },
                  { key: 'suggestions', label: '优化建议' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="min-h-[200px] max-h-[400px] overflow-y-auto">
              {activeTab === 'content' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">摘要</h4>
                    <p className="text-sm text-gray-600">{push.summary}</p>
                  </div>
                  {push.fullContent && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">完整内容</h4>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{push.fullContent}</p>
                    </div>
                  )}
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>来源: {push.source}</span>
                    <span>类型: {push.radarType}</span>
                  </div>
                </div>
              )}

              {activeTab === 'feedback' && (
                <div className="space-y-3" data-testid="user-feedback-list">
                  {feedback.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">暂无反馈</p>
                  ) : (
                    feedback.map((item) => (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <div className="flex text-yellow-400">
                              {[...Array(5)].map((_, i) => (
                                <StarIcon
                                  key={i}
                                  className={`h-4 w-4 ${i < item.rating ? '' : 'text-gray-200'}`}
                                />
                              ))}
                            </div>
                            <span className="ml-2 text-sm font-medium text-gray-900">{item.user.name}</span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatChinaDate(item.createdAt)}
                          </span>
                        </div>
                        {item.comment && (
                          <p className="text-sm text-gray-600">{item.comment}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'suggestions' && (
                <div data-testid="optimization-suggestions">
                  {optimizationSuggestions.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">暂无优化建议</p>
                  ) : (
                    <ul className="space-y-3">
                      {optimizationSuggestions.map((suggestion, index) => (
                        <li key={index} className="flex items-start">
                          <LightBulbIcon className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-700">{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          {status === 'pending' && (
            <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-end space-x-3">
              <button
                onClick={() => onMarkIgnored(push.id)}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                忽略
              </button>
              <button
                onClick={() => onMarkOptimized(push.id)}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                data-testid="mark-optimized-button"
              >
                {loading ? '处理中...' : '标记为已优化'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
