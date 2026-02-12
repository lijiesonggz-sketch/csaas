/**
 * CrawlerTaskLogList Component
 *
 * 采集任务日志列表组件
 * 支持筛选和分页
 *
 * Story 8.5: 爬虫健康度监控与告警
 */

'use client'

import React, { useState } from 'react'
import { CrawlerTask } from '@/lib/api/peer-crawler-health'
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PlayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'

interface CrawlerTaskLogListProps {
  tasks: CrawlerTask[]
  total: number
  loading?: boolean
  onFilterChange?: (filters: {
    status?: 'pending' | 'running' | 'completed' | 'failed'
    peerName?: string
  }) => void
  onPageChange?: (page: number) => void
  page?: number
  pageSize?: number
}

export function CrawlerTaskLogList({
  tasks,
  total,
  loading = false,
  onFilterChange,
  onPageChange,
  page = 1,
  pageSize = 20,
}: CrawlerTaskLogListProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [searchPeerName, setSearchPeerName] = useState('')

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status)
    onFilterChange?.({
      status: status as any,
      peerName: searchPeerName || undefined,
    })
  }

  const handleSearch = () => {
    onFilterChange?.({
      status: selectedStatus as any,
      peerName: searchPeerName || undefined,
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />
      case 'running':
        return <PlayIcon className="h-5 w-5 text-blue-500" />
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />
      default:
        return null
    }
  }

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      completed: '已完成',
      failed: '失败',
      running: '执行中',
      pending: '待执行',
    }
    return statusMap[status] || status
  }

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'running':
        return 'bg-blue-100 text-blue-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded w-full"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border">
      {/* Filters */}
      <div className="p-4 border-b">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
            <select
              value={selectedStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">全部</option>
              <option value="pending">待执行</option>
              <option value="running">执行中</option>
              <option value="completed">已完成</option>
              <option value="failed">失败</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">同业名称</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchPeerName}
                onChange={(e) => setSearchPeerName(e.target.value)}
                placeholder="搜索同业名称"
                className="block w-48 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
              >
                搜索
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状态
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                同业名称
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                类型
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                目标URL
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                重试次数
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                创建时间
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {(!tasks || tasks.length === 0) ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  暂无任务记录
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(task.status)}
                      <span
                        className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(
                          task.status
                        )}`}
                      >
                        {getStatusText(task.status)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {task.peerName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {task.sourceType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">
                    <a
                      href={task.targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {task.targetUrl}
                    </a>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {task.retryCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(task.createdAt).toLocaleString('zh-CN')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t flex items-center justify-between">
          <div className="text-sm text-gray-500">
            显示第 {(page - 1) * pageSize + 1} 到 {Math.min(page * pageSize, total)} 条，共 {total} 条
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="p-2 rounded-md border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <span className="text-sm text-gray-700">
              第 {page} / {totalPages} 页
            </span>
            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="p-2 rounded-md border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
