/**
 * Content Quality Admin Page
 *
 * Admin dashboard for content quality management.
 * Displays metrics, low-rated pushes, and quality trends.
 *
 * @module frontend/app/admin/content-quality
 * @story 7-2
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  getContentQualityMetrics,
  getLowRatedPushes,
  getPushFeedbackDetails,
  getQualityTrends,
  markPushAsOptimized,
  markPushAsIgnored,
  ContentQualityMetrics,
  LowRatedPush,
  PushFeedbackDetail,
  QualityTrends,
} from '@/lib/api/content-quality';
import { QualityMetricCard } from '@/components/admin/QualityMetricCard';
import { RatingDistributionChart } from '@/components/admin/RatingDistributionChart';
import { LowRatedPushList } from '@/components/admin/LowRatedPushList';
import { PushFeedbackDetailDialog } from '@/components/admin/PushFeedbackDetailDialog';
import { QualityTrendChart } from '@/components/admin/QualityTrendChart';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

export default function ContentQualityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [metrics, setMetrics] = useState<ContentQualityMetrics | null>(null);
  const [lowRatedPushes, setLowRatedPushes] = useState<LowRatedPush[]>([]);
  const [trends, setTrends] = useState<QualityTrends | null>(null);
  const [selectedPushDetail, setSelectedPushDetail] = useState<PushFeedbackDetail | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (session?.user && session.user.role !== 'admin') {
      router.push('/');
    }
  }, [status, session, router]);

  // Fetch all data
  const fetchData = async (isRefresh = false) => {
    if (!session?.accessToken) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [metricsData, pushesData, trendsData] = await Promise.all([
        getContentQualityMetrics(session.accessToken),
        getLowRatedPushes(session.accessToken, { limit: 20 }),
        getQualityTrends(session.accessToken, '30d'),
      ]);

      setMetrics(metricsData);
      setLowRatedPushes(pushesData.data);
      setTrends(trendsData);
    } catch (err) {
      console.error('Failed to fetch content quality data:', err);
      setError('加载内容质量数据失败，请稍后重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (session?.accessToken) {
      fetchData();
    }
  }, [session?.accessToken]);

  // Handle refresh
  const handleRefresh = () => {
    fetchData(true);
  };

  // Handle view details
  const handleViewDetails = async (pushId: string) => {
    if (!session?.accessToken) return;

    try {
      const detail = await getPushFeedbackDetails(session.accessToken, pushId);
      setSelectedPushDetail(detail);
      setIsDialogOpen(true);
    } catch (err) {
      console.error('Failed to fetch push details:', err);
      alert('获取推送详情失败');
    }
  };

  // Handle mark as optimized
  const handleMarkOptimized = async (pushId: string) => {
    if (!session?.accessToken) return;

    setActionLoading(true);
    try {
      await markPushAsOptimized(session.accessToken, pushId);
      // Update local state
      if (selectedPushDetail) {
        setSelectedPushDetail({
          ...selectedPushDetail,
          status: 'optimized',
        });
      }
      // Refresh data
      fetchData(true);
    } catch (err) {
      console.error('Failed to mark as optimized:', err);
      alert('标记失败，请稍后重试');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle mark as ignored
  const handleMarkIgnored = async (pushId: string) => {
    if (!session?.accessToken) return;

    setActionLoading(true);
    try {
      await markPushAsIgnored(session.accessToken, pushId);
      // Update local state
      if (selectedPushDetail) {
        setSelectedPushDetail({
          ...selectedPushDetail,
          status: 'ignored',
        });
      }
      // Refresh data
      fetchData(true);
    } catch (err) {
      console.error('Failed to mark as ignored:', err);
      alert('标记失败，请稍后重试');
    } finally {
      setActionLoading(false);
    }
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
              <h1 className="text-3xl font-bold text-gray-900">内容质量管理</h1>
              <p className="mt-1 text-sm text-gray-600">
                监控推送内容质量，收集用户反馈，持续改进服务
              </p>
            </div>

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

        {/* Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <QualityMetricCard
              title="平均评分"
              value={metrics.averageRating}
              type="rating"
              target={4.0}
              subtitle={`目标: 4.0/5.0`}
            />

            <QualityMetricCard
              title="总反馈数"
              value={metrics.totalFeedback}
              type="feedback"
              subtitle="用户提交的评分总数"
            />

            <QualityMetricCard
              title="低分推送"
              value={metrics.lowRatedPushes}
              type="lowRated"
              subtitle="评分低于 3.0 的推送"
            />

            <QualityMetricCard
              title="目标达成率"
              value={metrics.targetAchievement}
              type="achievement"
              subtitle="评分 ≥ 4.0 的推送占比"
            />
          </div>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {metrics && (
            <RatingDistributionChart distribution={metrics.ratingDistribution} />
          )}

          {trends && (
            <QualityTrendChart
              averageRatingTrend={trends.averageRatingTrend}
              lowRatedPushCountTrend={trends.lowRatedPushCountTrend}
            />
          )}
        </div>

        {/* Low Rated Push List */}
        <LowRatedPushList
          pushes={lowRatedPushes}
          onViewDetails={handleViewDetails}
          loading={refreshing}
        />

        {/* Detail Dialog */}
        <PushFeedbackDetailDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          detail={selectedPushDetail}
          onMarkOptimized={handleMarkOptimized}
          onMarkIgnored={handleMarkIgnored}
          loading={actionLoading}
        />
      </div>
    </div>
  );
}
