/**
 * Admin Dashboard Page
 *
 * Operations dashboard for system health monitoring.
 * Features 30-second auto-refresh and manual refresh.
 *
 * @module frontend/app/admin/dashboard
 * @story 7-1
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  getHealthMetrics,
  getAlerts,
  resolveAlert,
  getTrendData,
  HealthMetrics,
  Alert,
  TrendData,
} from '@/lib/api/dashboard';
import { HealthMetricCard } from '@/components/admin/HealthMetricCard';
import { AlertList } from '@/components/admin/AlertList';
import { HealthTrendChart } from '@/components/admin/HealthTrendChart';
import { ArrowPathIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<
    'availability' | 'push_success_rate' | 'ai_cost' | 'customer_activity'
  >('availability');
  const [selectedRange, setSelectedRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (session?.user && session.user.role !== 'admin') {
      router.push('/');
    }
  }, [status, session, router]);

  // Fetch all dashboard data
  const fetchDashboardData = async (isRefresh = false) => {
    if (!session?.accessToken) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Fetch metrics, alerts, and trend data in parallel
      const [metricsData, alertsData, trendsData] = await Promise.all([
        getHealthMetrics(session.accessToken),
        getAlerts(session.accessToken, { status: 'unresolved', limit: 10 }),
        getTrendData(session.accessToken, selectedMetric, selectedRange),
      ]);

      // Conditional update: only update if data has changed (cache invalidation)
      // Check if backend data is newer than current data
      if (metricsData.lastUpdated) {
        const backendUpdateTime = new Date(metricsData.lastUpdated);
        if (backendUpdateTime > lastUpdate || !metrics) {
          setMetrics(metricsData);
          setLastUpdate(backendUpdateTime);
        }
      } else {
        // Fallback: always update if no timestamp
        setMetrics(metricsData);
        setLastUpdate(new Date());
      }

      setAlerts(alertsData.data);
      setUnresolvedCount(alertsData.meta.unresolved);
      setTrendData(trendsData);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('加载仪表板数据失败，请稍后重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (session?.accessToken) {
      fetchDashboardData();
    }
  }, [session?.accessToken]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!session?.accessToken) return;

    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [session?.accessToken, selectedMetric, selectedRange]);

  // Refetch trend data when metric or range changes
  useEffect(() => {
    if (session?.accessToken && !loading) {
      const fetchTrends = async () => {
        try {
          const trendsData = await getTrendData(
            session.accessToken,
            selectedMetric,
            selectedRange,
          );
          setTrendData(trendsData);
        } catch (err) {
          console.error('Failed to fetch trend data:', err);
        }
      };
      fetchTrends();
    }
  }, [selectedMetric, selectedRange, session?.accessToken]);

  // Handle manual refresh
  const handleRefresh = () => {
    fetchDashboardData(true);
  };

  // Handle back navigation
  const handleBack = () => {
    router.push('/dashboard');
  };

  // Handle alert resolution
  const handleResolveAlert = async (alertId: string) => {
    if (!session?.accessToken) return;

    try {
      await resolveAlert(session.accessToken, alertId);
      // Refresh alerts list
      const alertsData = await getAlerts(session.accessToken, {
        status: 'unresolved',
        limit: 10,
      });
      setAlerts(alertsData.data);
      setUnresolvedCount(alertsData.meta.unresolved);
    } catch (err) {
      console.error('Failed to resolve alert:', err);
      alert('处理告警失败，请稍后重试');
    }
  };

  // Handle chart export
  const handleExportChart = () => {
    if (!trendData) return;

    const csv = [
      ['日期', '数值'],
      ...trendData.data.map((item) => [item.date, item.value.toString()]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedMetric}_${selectedRange}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
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
        {/* Back Button */}
        <div className="mb-4">
          <button
            onClick={handleBack}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            <span>返回仪表板</span>
          </button>
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">运营仪表板</h1>
              <p className="mt-1 text-sm text-gray-600">
                最后更新: {lastUpdate.toLocaleTimeString('zh-CN')}
              </p>
            </div>

            <div className="flex items-center space-x-4">
              {unresolvedCount > 0 && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                  {unresolvedCount} 个未处理告警
                </span>
              )}

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <ArrowPathIcon
                  className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`}
                />
                <span>{refreshing ? '刷新中...' : '手动刷新'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <HealthMetricCard
              title="系统可用性"
              current={metrics.availability.current}
              target={metrics.availability.target}
              status={metrics.availability.status as any}
              subtitle={`运行时间: ${(metrics.availability.uptime / 3600).toFixed(1)}小时`}
            />

            <HealthMetricCard
              title="推送成功率"
              current={metrics.pushSuccessRate.current}
              target={metrics.pushSuccessRate.target}
              status={metrics.pushSuccessRate.status as any}
              subtitle={`今日推送: ${metrics.pushSuccessRate.totalPushes}条`}
            />

            <HealthMetricCard
              title="AI成本"
              current={metrics.aiCost.avgPerClient}
              target={metrics.aiCost.target}
              status={metrics.aiCost.status as any}
              unit="元"
              subtitle={`本月累计: ${metrics.aiCost.thisMonth.toFixed(2)}元`}
            />

            <HealthMetricCard
              title="客户活跃度"
              current={metrics.customerActivity.activityRate}
              target={metrics.customerActivity.target}
              status={metrics.customerActivity.status as any}
              subtitle={`活跃客户: ${metrics.customerActivity.activeCustomers}/${metrics.customerActivity.totalCustomers}`}
            />
          </div>
        )}

        {/* Alerts Section */}
        <div className="mb-6">
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">异常告警</h2>
            <AlertList
              alerts={alerts}
              onResolve={handleResolveAlert}
              loading={loading}
            />
          </div>
        </div>

        {/* Trend Chart */}
        <div className="mb-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择指标
            </label>
            <div className="flex space-x-2">
              {[
                { value: 'availability', label: '系统可用性' },
                { value: 'push_success_rate', label: '推送成功率' },
                { value: 'ai_cost', label: 'AI成本' },
                { value: 'customer_activity', label: '客户活跃度' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedMetric(option.value as any)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg ${
                    selectedMetric === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {trendData && (
            <HealthTrendChart
              metric={selectedMetric}
              data={trendData.data}
              range={selectedRange}
              onRangeChange={setSelectedRange}
              onExport={handleExportChart}
            />
          )}
        </div>
      </div>
    </div>
  );
}
