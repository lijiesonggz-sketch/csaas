'use client'

import React, { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, Clock, RefreshCw, AlertCircle } from 'lucide-react'
import { AITasksAPI } from '@/lib/api/ai-tasks'
import { toast } from 'sonner'

interface ClusterProgress {
  clusterId: string
  clusterName: string
  status: 'pending' | 'generating' | 'completed' | 'failed'
  questionsGenerated: number
  questionsExpected: number
  startedAt?: string
  completedAt?: string
  error?: string
}

interface ClusterStatus {
  totalClusters: number
  completedClusters: string[]
  failedClusters: string[]
  pendingClusters: string[]
  clusterProgress: Record<string, ClusterProgress>
}

interface QuestionnaireProgressDisplayProps {
  taskId: string
  projectId: string
  clusterStatus: ClusterStatus
  onResumeComplete?: () => void
  onRegenerateComplete?: () => void
}

/**
 * 问卷生成进度显示组件
 *
 * 功能：
 * 1. 显示聚类级别的生成进度
 * 2. 列出所有聚类的状态（已完成/失败/待生成）
 * 3. 提供继续生成按钮
 * 4. 为每个聚类提供重新生成按钮
 */
export function QuestionnaireProgressDisplay({
  taskId,
  projectId,
  clusterStatus,
  onResumeComplete,
  onRegenerateComplete,
}: QuestionnaireProgressDisplayProps) {
  const [isResuming, setIsResuming] = useState(false)
  const [regeneratingCluster, setRegeneratingCluster] = useState<string | null>(null)

  // 计算进度百分比
  const progressPercentage = Math.round(
    (clusterStatus.completedClusters.length / clusterStatus.totalClusters) * 100,
  )

  // 计算剩余聚类数量（待生成 + 失败）
  const remainingClusters = clusterStatus.pendingClusters.length + clusterStatus.failedClusters.length

  // 估算剩余时间（假设每个聚类需要5分钟）
  const estimatedTime = Math.ceil(remainingClusters * 5)

  // 继续生成处理
  const handleResume = async () => {
    if (isResuming) return

    try {
      setIsResuming(true)
      const result = await AITasksAPI.resumeQuestionnaireGeneration(taskId)

      toast.success(`已创建继续生成任务`, {
        description: `剩余 ${result.clustersToGenerate.length} 个聚类正在生成中...`,
      })

      if (onResumeComplete) {
        onResumeComplete()
      }
    } catch (error: any) {
      toast.error('继续生成失败', {
        description: error.message || '未知错误',
      })
    } finally {
      setIsResuming(false)
    }
  }

  // 单聚类重新生成处理
  const handleRegenerateCluster = async (clusterId: string) => {
    if (regeneratingCluster) return

    try {
      setRegeneratingCluster(clusterId)
      const result = await AITasksAPI.regenerateCluster(taskId, clusterId)

      toast.success(`正在重新生成`, {
        description: `聚类: ${result.clusterName}`,
      })

      if (onRegenerateComplete) {
        onRegenerateComplete()
      }
    } catch (error: any) {
      toast.error('重新生成失败', {
        description: error.message || '未知错误',
      })
    } finally {
      setRegeneratingCluster(null)
    }
  }

  // 获取聚类状态图标和颜色
  const getClusterStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'generating':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
      case 'pending':
      default:
        return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  const getClusterStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'generating':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'pending':
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }

  const getClusterStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成'
      case 'failed':
        return '失败'
      case 'generating':
        return '生成中'
      case 'pending':
      default:
        return '待生成'
    }
  }

  return (
    <div className="space-y-6">
      {/* 总进度概览 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          生成进度
        </h3>

        {/* 进度条 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              总进度
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {progressPercentage}%
            </span>
          </div>
          <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
              role="progressbar"
              aria-valuenow={progressPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-gray-600 dark:text-gray-400">已完成</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {clusterStatus.completedClusters.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">待生成</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {clusterStatus.pendingClusters.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-gray-600 dark:text-gray-400">失败</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {clusterStatus.failedClusters.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-blue-500" />
            <span className="text-gray-600 dark:text-gray-400">总计</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {clusterStatus.totalClusters}
            </span>
          </div>
        </div>

        {/* 继续生成按钮 */}
        {remainingClusters > 0 && (
          <div className="mt-6 flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">
                还有 {remainingClusters} 个聚类未完成
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                预计需要 {estimatedTime} 分钟
              </p>
            </div>
            <button
              onClick={handleResume}
              disabled={isResuming}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isResuming ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  继续生成
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 聚类详情列表 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          聚类详情
        </h3>

        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          data-testid="cluster-list"
        >
          {Object.values(clusterStatus.clusterProgress).map((cluster) => (
            <div
              key={cluster.clusterId}
              data-status={cluster.status}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              {/* 聚类标题和状态 */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                    {cluster.clusterName}
                  </h4>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getClusterStatusBadgeColor(
                      cluster.status,
                    )}`}
                  >
                    {getClusterStatusIcon(cluster.status)}
                    <span className="ml-1">{getClusterStatusText(cluster.status)}</span>
                  </span>
                </div>
              </div>

              {/* 题目进度 */}
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {cluster.status === 'completed' ? (
                  <span className="text-green-600 dark:text-green-400">
                    ✓ {cluster.questionsGenerated}/{cluster.questionsExpected} 题
                  </span>
                ) : cluster.status === 'failed' ? (
                  <span className="text-red-600 dark:text-red-400">
                    ✗ 失败: {cluster.error || '未知错误'}
                  </span>
                ) : cluster.status === 'generating' ? (
                  <span className="text-blue-600 dark:text-blue-400">
                    ⏳ 生成中...
                  </span>
                ) : (
                  <span className="text-gray-500 dark:text-gray-500">
                    ⏸️ 等待生成 (0/{cluster.questionsExpected} 题)
                  </span>
                )}
              </div>

              {/* 重新生成按钮 */}
              <button
                onClick={() => handleRegenerateCluster(cluster.clusterId)}
                disabled={
                  regeneratingCluster === cluster.clusterId || cluster.status === 'generating'
                }
                aria-label={`重新生成聚类: ${cluster.clusterName}`}
                className="w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {regeneratingCluster === cluster.clusterId ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    重新生成
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
