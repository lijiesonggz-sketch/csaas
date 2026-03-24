/**
 * useTaskProgressPolling Hook
 * 用于轮询任务进度，支持页面可见性检测
 * 适用于长时间任务，避免WebSocket超时问题
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { AITasksAPI } from '../api/ai-tasks'

export interface TaskProgress {
  status: string
  stage: string
  stageMessage?: string
  percentage?: number
  details?: {
    current?: number
    total?: number
    message?: string
    phase?: string
    totalClauses?: number
    totalBatches?: number
    currentBatch?: number
  }
  progress: {
    gpt4?: { status: string; message: string; error?: string; duration_ms?: number; percentage?: number; details?: { current: number; total: number } }
    claude?: { status: string; message: string; error?: string; duration_ms?: number; percentage?: number; details?: { current: number; total: number } }
    domestic?: { status: string; message: string; error?: string; duration_ms?: number; percentage?: number; details?: { current: number; total: number } }
    validation_stage?: string
    aggregation_stage?: string
    total_elapsed_ms?: number
  }
  message: string
}

export interface UseTaskProgressPollingOptions {
  taskId?: string
  enabled?: boolean
  pollingInterval?: number // 轮询间隔（毫秒），默认5秒
  onComplete?: (progress: TaskProgress) => void
  onError?: (error: Error) => void
}

export function useTaskProgressPolling(options: UseTaskProgressPollingOptions = {}) {
  const {
    taskId,
    enabled = true,
    pollingInterval = 5000,
    onComplete,
    onError,
  } = options

  const [progress, setProgress] = useState<TaskProgress | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const pollingTimerRef = useRef<NodeJS.Timeout>()
  const isMountedRef = useRef(true)
  const pollingStartTimeRef = useRef<number>(0)

  /**
   * 获取任务状态
   */
  const fetchStatus = useCallback(async () => {
    if (!taskId || !enabled) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const status = await AITasksAPI.getTaskStatus(taskId)

      if (!isMountedRef.current) return

      setProgress(status)

      // 检查是否完成
      if (status.status === 'completed' || status.status === 'failed') {
        // 停止轮询
        if (pollingTimerRef.current) {
          clearInterval(pollingTimerRef.current)
          pollingTimerRef.current = undefined
        }

        // 触发完成回调
        if (onComplete) {
          onComplete(status)
        }
      }
    } catch (err) {
      if (!isMountedRef.current) return

      const error = err instanceof Error ? err : new Error('Failed to fetch task status')
      setError(error)

      if (onError) {
        onError(error)
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [taskId, enabled, onComplete, onError])

  /**
   * 开始轮询
   */
  const startPolling = useCallback(() => {
    if (!taskId || !enabled) {
      return
    }

    // 记录轮询开始时间
    pollingStartTimeRef.current = Date.now()

    // 立即获取一次状态
    fetchStatus()

    // 设置定时轮询
    pollingTimerRef.current = setInterval(() => {
      fetchStatus()
    }, pollingInterval)
  }, [taskId, enabled, pollingInterval, fetchStatus])

  /**
   * 停止轮询
   */
  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current)
      pollingTimerRef.current = undefined
    }
  }, [])

  /**
   * 手动刷新
   */
  const refetch = useCallback(() => {
    fetchStatus()
  }, [fetchStatus])

  // 启动轮询
  useEffect(() => {
    startPolling()

    return () => {
      stopPolling()
      isMountedRef.current = false
    }
  }, [startPolling, stopPolling])

  // 页面可见性检测：只在页面可见时轮询
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 页面隐藏时停止轮询
        stopPolling()
      } else {
        // 页面可见时立即刷新状态并恢复轮询
        if (enabled && taskId) {
          // 立即刷新一次状态（可能任务已完成）
          fetchStatus()

          // ✅ 修复：总是恢复轮询，让fetchStatus自然地检测到任务状态
          // 如果任务已完成，fetchStatus会在下次轮询时检测到并触发onComplete
          // 如果任务还在进行中，继续轮询
          startPolling()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, taskId, startPolling, stopPolling, fetchStatus])

  return {
    progress,
    isLoading,
    error,
    refetch,
    startPolling,
    stopPolling,
  }
}
