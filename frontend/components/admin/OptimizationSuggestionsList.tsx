/**
 * OptimizationSuggestionsList Component
 *
 * Displays a list of cost optimization suggestions for organizations.
 *
 * @module frontend/components/admin
 * @story 7-4
 */

'use client';

import React from 'react';
import {
  LightBulbIcon,
  ArrowTrendingDownIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface OptimizationSuggestion {
  organizationId: string;
  organizationName: string;
  currentCost: number;
  estimatedCostAfterOptimization: number;
  potentialSavings: number;
  savingsPercentage: number;
  suggestions: string[];
  priority: 'high' | 'medium' | 'low';
}

interface OptimizationSuggestionsListProps {
  suggestions: OptimizationSuggestion[];
  onSelectOrganization?: (organizationId: string) => void;
  selectedOrganizations?: string[];
  loading?: boolean;
}

export function OptimizationSuggestionsList({
  suggestions,
  onSelectOrganization,
  selectedOrganizations = [],
  loading = false,
}: OptimizationSuggestionsListProps) {
  const priorityColors = {
    high: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-green-100 text-green-800 border-green-200',
  };

  const priorityLabels = {
    high: '高优先级',
    medium: '中优先级',
    low: '低优先级',
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">优化建议</h3>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">优化建议</h3>
        <span className="text-sm text-gray-500">{suggestions?.length || 0} 个建议</span>
      </div>

      {!suggestions || !Array.isArray(suggestions) || suggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-gray-500">
          <CheckCircleIcon className="h-12 w-12 mb-2 text-green-500" />
          <p>暂无优化建议，所有客户成本均在合理范围内</p>
        </div>
      ) : (
        <div className="space-y-4">
          {suggestions.map((suggestion) => {
            const isSelected = selectedOrganizations.includes(suggestion.organizationId);

            return (
              <div
                key={suggestion.organizationId}
                className={`border rounded-lg p-4 transition-all ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start space-x-3 flex-1">
                    {onSelectOrganization && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onSelectOrganization(suggestion.organizationId)}
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    )}

                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="text-sm font-semibold text-gray-900">
                          {suggestion.organizationName}
                        </h4>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded border ${priorityColors[suggestion.priority]}`}
                        >
                          {priorityLabels[suggestion.priority]}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-gray-500">当前成本</p>
                          <p className="text-sm font-semibold text-gray-900">
                            ¥{suggestion.currentCost.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">优化后成本</p>
                          <p className="text-sm font-semibold text-green-600">
                            ¥{suggestion.estimatedCostAfterOptimization.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">预计节省</p>
                          <div className="flex items-center space-x-1">
                            <ArrowTrendingDownIcon className="h-4 w-4 text-green-500" />
                            <p className="text-sm font-semibold text-green-600">
                              ¥{suggestion.potentialSavings.toFixed(2)}
                            </p>
                            <span className="text-xs text-gray-500">
                              ({suggestion.savingsPercentage.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        {suggestion.suggestions.map((item, index) => (
                          <div key={index} className="flex items-start space-x-2">
                            <LightBulbIcon className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-gray-600">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
