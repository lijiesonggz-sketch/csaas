/**
 * Peer Crawler Health Page
 *
 * 爬虫健康度监控页面
 * 显示健康度仪表板、告警列表、任务日志
 *
 * Story 8.5: 爬虫健康度监控与告警
 */

'use client'

import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  getCrawlerHealth,
  getCrawlerTasks,
  getCrawlerStats,
  CrawlerHealth,
  CrawlerTask,
  CrawlerStats,
} from '@/lib/api/peer-crawler-health'
import { getAlerts, resolveAlert, Alert } from '@/lib/api/dashboard'
import { CrawlerHealthDashboard } from '@/components/admin/CrawlerHealthDashboard'
import { CrawlerTaskLogList } from '@/components/admin/CrawlerTaskLogList'
import { AlertList } from '@/components/admin/AlertList'
import { ArrowLeft, RefreshCw } from 'lucide-react'

export default function PeerCrawlerHealthPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [health, setHealth] = useState<CrawlerHealth | null>(null)
  const [tasks, setTasks] = useState<CrawlerTask[]>([])
  const [taskTotal, setTaskTotal] = useState(0)
  const [stats, setStats] = useState<CrawlerStats | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [taskPage, setTaskPage] = useState(1)
  const [taskFilters, setTaskFilters] = useState<{
    status?: 'pending' | 'running' | 'completed' | 'failed'
    peerName?: string
  }>({})

  // Redirect if not authenticated or not admin/consultant
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session?.user && !['admin', 'consultant'].includes(session.user.role)) {
      router.push('/')
    }
  }, [status, session, router])

  // Fetch all data
  const fetchData = async (isRefresh = false) => {
    if (!session?.accessToken) return

    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const [healthData, tasksData, statsData, alertsData] = await Promise.all([
        getCrawlerHealth(),
        getCrawlerTasks({
          ...taskFilters,
          limit: 20,
          offset: (taskPage - 1) * 20,
        }),
        getCrawlerStats(30),
        getAlerts(session.accessToken, { status: 'unresolved', alertType: 'crawler_failure', limit: 10 }),
      ])

      setHealth(healthData.data)
      setTasks(tasksData.data)
      setTaskTotal(tasksData.total)
      setStats(statsData.data)
      setAlerts(alertsData.data)
    } catch (err) {
      console.error('Failed to fetch crawler health data:', err)
      setError('加载数据失败，请稍后重试')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Initial load
  useEffect(() => {
    if (session?.accessToken) {
      fetchData()
    }
  }, [session?.accessToken, taskPage, taskFilters])

  // Handle back navigation
  const handleBack = () => {
    router.push('/dashboard')
  }

  // Handle manual refresh
  const handleRefresh = () => {
    fetchData(true)
  }

  // Handle alert resolution
  const handleResolveAlert = async (alertId: string) => {
    if (!session?.accessToken) return

    try {
      await resolveAlert(session.accessToken, alertId)
      // Refresh alerts list
      const alertsData = await getAlerts(session.accessToken, {
        status: 'unresolved',
        alertType: 'crawler_failure',
        limit: 10,
      })
      setAlerts(alertsData.data)
    } catch (err) {
      console.error('Failed to resolve alert:', err)
      alert('处理告警失败，请稍后重试')
    }
  }

  // Handle filter change
  const handleFilterChange = (filters: { status?: string; peerName?: string }) => {
    setTaskFilters({
      status: filters.status as any,
      peerName: filters.peerName,
    })
    setTaskPage(1)
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E3A5F]"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-[#1E3A5F] text-white rounded hover:bg-[#1E3A5F]/80"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FEFDFB] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <div className="mb-4">
          <button
            onClick={handleBack}
            className="flex items-center space-x-2 text-[#94A3B8] hover:text-[#1E3A5F] transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>返回仪表板</span>
          </button>
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#1E3A5F]">爬虫健康度监控</h1>
              <p className="mt-1 text-sm text-[#94A3B8]">监控同业采集爬虫的健康状态和性能指标</p>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-[#E2E8F0] rounded-sm hover:bg-[#FEFDFB] disabled:opacity-50"
            >
              <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? '刷新中...' : '手动刷新'}</span>
            </button>
          </div>
        </div>

        {/* Health Dashboard */}
        {health && <CrawlerHealthDashboard health={health} loading={loading} />}

        {/* Alerts Section */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-[#1E3A5F] mb-4">爬虫告警</h2>
          <div className="bg-white rounded-sm border border-[#E2E8F0] shadow-sm p-6">
            <AlertList alerts={alerts} onResolve={handleResolveAlert} loading={loading} />
          </div>
        </div>

        {/* Task Log List */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-[#1E3A5F] mb-4">任务日志</h2>
          <CrawlerTaskLogList
            tasks={tasks}
            total={taskTotal}
            loading={loading}
            onFilterChange={handleFilterChange}
            onPageChange={setTaskPage}
            page={taskPage}
            pageSize={20}
          />
        </div>

        {/* Stats Summary */}
        {stats && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-[#1E3A5F] mb-4">采集统计（最近30天）</h2>
            <div className="bg-white rounded-sm border border-[#E2E8F0] shadow-sm p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Success Rate Trend */}
                <div>
                  <h3 className="text-sm font-medium text-[#94A3B8] mb-3">成功率趋势</h3>
                  <div className="space-y-2">
                    {stats.successRateTrend.slice(-7).map((item) => (
                      <div key={item.date} className="flex items-center justify-between">
                        <span className="text-sm text-[#94A3B8]">{item.date}</span>
                        <div className="flex items-center">
                          <div className="w-24 h-2 bg-[#E2E8F0] rounded-full mr-2">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${item.rate}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{item.rate}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Source Comparison */}
                <div>
                  <h3 className="text-sm font-medium text-[#94A3B8] mb-3">采集源对比</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {stats.sourceComparison.slice(0, 5).map((item) => (
                      <div key={item.peerName} className="flex items-center justify-between">
                        <span className="text-sm text-[#94A3B8] truncate max-w-[100px]">
                          {item.peerName}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-green-600">{item.success} 成功</span>
                          <span className="text-xs text-red-600">{item.failed} 失败</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Content Type Distribution */}
                <div>
                  <h3 className="text-sm font-medium text-[#94A3B8] mb-3">内容类型分布</h3>
                  <div className="space-y-2">
                    {stats.contentTypeDistribution.map((item) => (
                      <div key={item.type} className="flex items-center justify-between">
                        <span className="text-sm text-[#94A3B8]">{item.type}</span>
                        <span className="text-sm font-medium">{item.count} 条</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
