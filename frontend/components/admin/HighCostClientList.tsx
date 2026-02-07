/**
 * HighCostClientList Component
 *
 * Displays a list of high-cost organizations with details.
 *
 * @module frontend/components/admin
 * @story 7-4
 */

'use client';

import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';

interface HighCostClient {
  organizationId: string;
  organizationName: string;
  cost: number;
  count: number;
}

interface HighCostClientListProps {
  clients: HighCostClient[];
  onViewDetails?: (organizationId: string) => void;
  loading?: boolean;
}

export function HighCostClientList({
  clients,
  onViewDetails,
  loading = false,
}: HighCostClientListProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">高成本客户</h3>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">高成本客户</h3>
        <span className="text-sm text-gray-500">Top {clients?.length || 0}</span>
      </div>

      {!clients || clients.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-gray-500">暂无数据</div>
      ) : (
        <div className="space-y-3">
          {clients.map((client, index) => (
            <div
              key={client.organizationId}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center space-x-3 flex-1">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-blue-600">#{index + 1}</span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {client.organizationName}
                  </p>
                  <p className="text-xs text-gray-500">{client.count} 次调用</p>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">¥{client.cost.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">本月成本</p>
                  </div>

                  {client.cost > 500 && (
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
                  )}

                  {onViewDetails && (
                    <button
                      onClick={() => onViewDetails(client.organizationId)}
                      className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                    >
                      查看详情
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
