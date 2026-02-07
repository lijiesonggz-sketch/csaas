/**
 * AlertList Component
 *
 * Displays a list of system alerts with filtering and resolution actions.
 *
 * @module frontend/components/admin
 * @story 7-1
 */

import React, { useState } from 'react';
import { Alert } from '@/lib/api/dashboard';
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

interface AlertListProps {
  alerts: Alert[];
  onResolve: (alertId: string) => Promise<void>;
  loading?: boolean;
}

export function AlertList({ alerts, onResolve, loading = false }: AlertListProps) {
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const handleResolve = async (alertId: string) => {
    setResolvingId(alertId);
    try {
      await onResolve(alertId);
    } finally {
      setResolvingId(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'medium':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'low':
        return <ExclamationTriangleIcon className="h-5 w-5 text-blue-500" />;
      default:
        return null;
    }
  };

  const getAlertTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      crawler_failure: '爬虫失败',
      ai_cost_exceeded: 'AI成本超标',
      customer_churn_risk: '客户流失风险',
      push_failure_high: '推送失败率高',
      system_downtime: '系统停机',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500" />
        <p className="mt-2 text-sm text-gray-600">暂无告警</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`rounded-lg border p-4 ${getSeverityColor(alert.severity)}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              <div className="flex-shrink-0 mt-0.5">{getSeverityIcon(alert.severity)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white border">
                    {getAlertTypeLabel(alert.alertType)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(alert.occurredAt).toLocaleString('zh-CN')}
                  </span>
                </div>
                <p className="text-sm font-medium">{alert.message}</p>
                {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    <details>
                      <summary className="cursor-pointer hover:underline">详细信息</summary>
                      <pre className="mt-1 p-2 bg-white rounded text-xs overflow-x-auto">
                        {JSON.stringify(alert.metadata, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            </div>

            {alert.status === 'unresolved' && (
              <button
                onClick={() => handleResolve(alert.id)}
                disabled={resolvingId === alert.id}
                className="ml-4 flex-shrink-0 px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resolvingId === alert.id ? '处理中...' : '标记已处理'}
              </button>
            )}

            {alert.status === 'resolved' && (
              <span className="ml-4 flex-shrink-0 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                <CheckCircleIcon className="h-4 w-4 mr-1" />
                已处理
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
