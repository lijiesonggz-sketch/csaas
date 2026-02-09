/**
 * CrawlerHealthDashboard Component
 *
 * 爬虫健康度仪表板组件
 * 显示整体状态、采集源统计、任务统计、24小时统计
 *
 * Story 8.5: 爬虫健康度监控与告警
 */

'use client'

import React from 'react'
import { CrawlerHealth } from '@/lib/api/peer-crawler-health'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ServerIcon,
  QueueListIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'

interface CrawlerHealthDashboardProps {
  health: CrawlerHealth
  loading?: boolean
}

export function CrawlerHealthDashboard({ health, loading = false }: CrawlerHealthDashboardProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleIcon className="h-12 w-12 text-green-500" />
      case 'warning':
        return <ExclamationTriangleIcon className="h-12 w-12 text-yellow-500" />
      case 'critical':
        return <XCircleIcon className="h-12 w-12 text-red-500" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-50 border-green-200'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200'
      case 'critical':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy':
        return '健康'
      case 'warning':
        return '警告'
      case 'critical':
        return '严重'
      default:
        return '未知'
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Overall Status Card */}
      <div className={`rounded-lg border p-6 ${getStatusColor(health.overallStatus)}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">整体状态</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {getStatusText(health.overallStatus)}
            </p>
          </div>
          {getStatusIcon(health.overallStatus)}
        </div>
      </div>

      {/* Sources Stats Card */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">采集源</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{health.sources.total}</p>
            <p className="mt-1 text-sm text-gray-500">
              <span className="text-green-600">{health.sources.active} 活跃</span>
              <span className="mx-1">/</span>
              <span className="text-gray-400">{health.sources.inactive} 停用</span>
            </p>
          </div>
          <ServerIcon className="h-12 w-12 text-blue-500" />
        </div>
      </div>

      {/* Recent Tasks Card */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">最近任务</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {health.recentTasks.completed + health.recentTasks.failed + health.recentTasks.pending}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              <span className="text-green-600">{health.recentTasks.completed} 完成</span>
              <span className="mx-1">/</span>
              <span className="text-red-600">{health.recentTasks.failed} 失败</span>
              <span className="mx-1">/</span>
              <span className="text-yellow-600">{health.recentTasks.pending} 待执行</span>
            </p>
          </div>
          <QueueListIcon className="h-12 w-12 text-purple-500" />
        </div>
      </div>

      {/* Last 24h Stats Card */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">24小时统计</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {(health.last24h.successRate * 100).toFixed(1)}%
            </p>
            <p className="mt-1 text-sm text-gray-500">
              <span>成功率</span>
              <span className="mx-1">|</span>
              <span>{health.last24h.crawlCount} 次采集</span>
            </p>
          </div>
          <ChartBarIcon className="h-12 w-12 text-orange-500" />
        </div>
      </div>
    </div>
  )
}
