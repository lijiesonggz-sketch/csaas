/**
 * Cost Optimization Page
 *
 * AI cost monitoring and optimization dashboard.
 * Displays cost metrics, trends, high-cost clients, and optimization suggestions.
 *
 * @module frontend/app/admin/cost-optimization
 * @story 7-4
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/lib/auth/types';
import {
  getCostMetrics,
  getCostTrends,
  getOptimizationSuggestions,
  exportCostReport,
  batchOptimize,
  CostMetrics,
  CostTrendsResponse,
  OptimizationSuggestion,
  getOrganizationCost,
  OrganizationCostDetails,
} from '@/lib/api/cost-optimization';
import { HealthMetricCard } from '@/components/admin/HealthMetricCard';
import { CostTrendChart } from '@/components/admin/CostTrendChart';
import { CostBreakdownChart } from '@/components/admin/CostBreakdownChart';
import { HighCostClientList } from '@/components/admin/HighCostClientList';
import { OptimizationSuggestionsList } from '@/components/admin/OptimizationSuggestionsList';
import { BatchOptimizeDialog } from '@/components/admin/BatchOptimizeDialog';
import { ArrowPathIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { formatChinaDate } from '@/lib/utils/dateTime';

export default function CostOptimizationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [metrics, setMetrics] = useState<CostMetrics | null>(null);
  const [trends, setTrends] = useState<CostTrendsResponse | null>(null);
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [selectedOrganizationDetails, setSelectedOrganizationDetails] =
    useState<OrganizationCostDetails | null>(null);
  const [selectedDays, setSelectedDays] = useState<number>(30);
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([]);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (session?.user && session.user.role !== UserRole.ADMIN) {
      router.push('/');
    }
  }, [status, session, router]);

  // Fetch all cost optimization data
  const fetchCostData = async (isRefresh = false) => {
    if (!session?.accessToken) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Fetch metrics, trends, and suggestions in parallel
      const [metricsData, trendsData, suggestionsData] = await Promise.all([
        getCostMetrics(session.accessToken),
        getCostTrends(session.accessToken, selectedDays),
        getOptimizationSuggestions(session.accessToken),
      ]);

      setMetrics(metricsData);
      setTrends(trendsData);
      setSuggestions(suggestionsData);
    } catch (err) {
      console.error('Failed to fetch cost data:', err);
      setError('加载成本数据失败，请稍后重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (session?.accessToken) {
      fetchCostData();
    }
  }, [session?.accessToken]);

  // Refetch trends when days change
  useEffect(() => {
    if (session?.accessToken && !loading) {
      const fetchTrends = async () => {
        try {
          const trendsData = await getCostTrends(session.accessToken, selectedDays);
          setTrends(trendsData);
        } catch (err) {
          console.error('Failed to fetch trends:', err);
        }
      };
      fetchTrends();
    }
  }, [selectedDays, session?.accessToken]);

  // Handle manual refresh
  const handleRefresh = () => {
    fetchCostData(true);
  };

  // Handle view organization details
  const handleViewDetails = async (organizationId: string) => {
    if (!session?.accessToken) return;

    try {
      const details = await getOrganizationCost(session.accessToken, organizationId);
      setSelectedOrganizationDetails(details);
    } catch (err) {
      console.error('Failed to fetch organization details:', err);
      alert('获取客户详情失败，请稍后重试');
    }
  };

  // Handle export report
  const handleExportReport = async (format: 'csv' | 'excel' = 'csv') => {
    if (!session?.accessToken) return;

    try {
      const blob = await exportCostReport(session.accessToken, { format });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cost-report-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export report:', err);
      alert('导出报告失败，请稍后重试');
    }
  };

  // Handle export chart
  const handleExportChart = () => {
    if (!trends) return;

    const csv = [
      ['日期', '成本', '调用次数'],
      ...trends.trends.map((item) => [item.date, item.cost.toString(), item.count.toString()]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cost-trends-${selectedDays}d-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Handle organization selection
  const handleSelectOrganization = (organizationId: string) => {
    setSelectedOrganizations((prev) =>
      prev.includes(organizationId)
        ? prev.filter((id) => id !== organizationId)
        : [...prev, organizationId],
    );
  };

  // Handle batch optimize
  const handleBatchOptimize = async (action: string, notes: string) => {
    if (!session?.accessToken || selectedOrganizations.length === 0) return;

    try {
      const result = await batchOptimize(session.accessToken, {
        organizationIds: selectedOrganizations,
        action: action as 'switch_model' | 'enable_caching' | 'optimize_prompts',
        notes,
      });

      alert(
        `批量优化完成！\n成功: ${result.success} 个\n失败: ${result.failed} 个`,
      );

      // Clear selection and refresh data
      setSelectedOrganizations([]);
      fetchCostData(true);
    } catch (err) {
      console.error('Batch optimize failed:', err);
      throw err;
    }
  };

  // Calculate cost status
  const getCostStatus = (
    current: number,
    target: number,
  ): 'healthy' | 'warning' | 'critical' => {
    const ratio = current / target;
    if (ratio <= 1) return 'healthy';
    if (ratio <= 1.2) return 'warning';
    return 'critical';
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI成本优化</h1>
              <p className="mt-1 text-sm text-gray-600">
                监控AI使用成本并获取优化建议
              </p>
            </div>

            <div className="flex items-center space-x-4">
              {selectedOrganizations.length > 0 && (
                <button
                  onClick={() => setShowBatchDialog(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  批量优化 ({selectedOrganizations.length})
                </button>
              )}

              <button
                onClick={() => handleExportReport('csv')}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
                <span>导出报告</span>
              </button>

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{refreshing ? '刷新中...' : '刷新'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <HealthMetricCard
              title="总成本"
              current={metrics.totalCost}
              target={metrics.averageCostPerOrganization * (metrics.topCostOrganizations?.length || 0)}
              status={getCostStatus(
                metrics.totalCost,
                metrics.averageCostPerOrganization * (metrics.topCostOrganizations?.length || 0),
              )}
              unit="元"
              subtitle={metrics.period ? `本月累计 (${formatChinaDate(metrics.period.startDate)} - ${formatChinaDate(metrics.period.endDate)})` : '本月累计'}
            />

            <HealthMetricCard
              title="平均成本"
              current={metrics.averageCostPerOrganization}
              target={500}
              status={getCostStatus(metrics.averageCostPerOrganization, 500)}
              unit="元"
              subtitle="每客户平均成本"
            />

            <HealthMetricCard
              title="高成本客户"
              current={metrics.topCostOrganizations?.filter((org) => org.cost > 500).length || 0}
              target={0}
              status={
                (metrics.topCostOrganizations?.filter((org) => org.cost > 500).length || 0) === 0
                  ? 'healthy'
                  : 'warning'
              }
              unit="个"
              subtitle={`Top ${metrics.topCostOrganizations?.length || 0} 客户`}
            />
          </div>
        )}

        {/* Cost Trend Chart */}
        {trends && (
          <div className="mb-6">
            <CostTrendChart
              data={trends.trends}
              days={selectedDays}
              onDaysChange={setSelectedDays}
              onExport={handleExportChart}
            />
          </div>
        )}

        {/* High Cost Clients and Cost Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {metrics && (
            <HighCostClientList
              clients={metrics.topCostOrganizations}
              onViewDetails={handleViewDetails}
              loading={loading}
            />
          )}

          {selectedOrganizationDetails && (
            <CostBreakdownChart data={selectedOrganizationDetails.costBreakdown} />
          )}
        </div>

        {/* Optimization Suggestions */}
        <div className="mb-6">
          <OptimizationSuggestionsList
            suggestions={suggestions}
            onSelectOrganization={handleSelectOrganization}
            selectedOrganizations={selectedOrganizations}
            loading={loading}
          />
        </div>

        {/* Batch Optimize Dialog */}
        <BatchOptimizeDialog
          isOpen={showBatchDialog}
          onClose={() => setShowBatchDialog(false)}
          selectedOrganizations={(Array.isArray(suggestions) ? suggestions : [])
            .filter((s) => selectedOrganizations.includes(s.organizationId))
            .map((s) => ({ id: s.organizationId, name: s.organizationName }))}
          onConfirm={handleBatchOptimize}
        />
      </div>
    </div>
  );
}
