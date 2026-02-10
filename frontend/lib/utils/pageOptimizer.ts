/**
 * 页面性能优化工具函数
 * 提供通用的优化Hook和工具
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { message } from '@/lib/message'
import { useAITaskCache } from '@/lib/hooks/useAITaskCache'

/**
 * 通用页面优化Hook
 * 为AI任务相关页面提供缓存和优化的数据加载
 */
export function useOptimizedPageData(projectId: string, taskTypes: string[]) {
  const cache = useAITaskCache()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 从缓存或API加载数据
   */
  const loadData = useCallback(async (
    taskType: string,
    fetcher: () => Promise<any>,
    setter: (data: any) => void
  ) => {
    try {
      setLoading(true)
      setError(null)

      // 1. 尝试从缓存加载
      const cached = cache.get(projectId, taskType)
      if (cached) {
        console.log(`✅ 从缓存加载 ${taskType} 结果`)
        setter(cached)
        return cached
      }

      // 2. 从API加载
      const data = await fetcher()
      setter(data)

      return data
    } catch (err: any) {
      console.error(`Failed to load ${taskType}:`, err)
      setError(err.message || '加载失败')
      throw err
    } finally {
      setLoading(false)
    }
  }, [projectId, cache])

  /**
   * 保存数据到缓存
   */
  const saveToCache = useCallback((
    taskType: string,
    taskId: string,
    data: any
  ) => {
    cache.set(projectId, taskType, taskId, data)
  }, [projectId, cache])

  /**
   * 清除缓存
   */
  const clearCache = useCallback((taskType?: string) => {
    if (taskType) {
      // 清除特定类型的缓存
      // 注意：useAITaskCache的clear方法是按项目清除的，这里我们手动处理
      const key = `${projectId}-${taskType}`
      localStorage.removeItem(`task_cache_${key}`)
    } else {
      // 清除整个项目的缓存
      cache.clear(projectId)
    }
  }, [projectId, cache])

  return {
    loading,
    error,
    loadData,
    saveToCache,
    clearCache,
  }
}

/**
 * 优化列表渲染Hook
 * 提供分页、筛选、排序等功能
 */
export function useOptimizedList<T>(items: T[], initialPageSize = 20) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  // 分页后的数据
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return items.slice(start, end)
  }, [items, currentPage, pageSize])

  // 统计信息
  const stats = useMemo(() => ({
    total: items.length,
    totalPages: Math.ceil(items.length / pageSize),
    currentPage,
    pageSize,
  }), [items.length, currentPage, pageSize])

  const handlePageChange = useCallback((page: number, size: number) => {
    setCurrentPage(page)
    setPageSize(size)
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return {
    items: paginatedItems,
    stats,
    currentPage,
    pageSize,
    setCurrentPage,
    setPageSize,
    handlePageChange,
  }
}

/**
 * 优化的工具函数Hook
 */
export function useOptimizedUtils() {
  /**
   * 获取优先级颜色
   */
  const getPriorityColor = useCallback((priority: string) => {
    const colors: Record<string, string> = {
      HIGH: 'red',
      MEDIUM: 'orange',
      LOW: 'green',
    }
    return colors[priority] || 'default'
  }, [])

  /**
   * 获取优先级标签
   */
  const getPriorityTag = useCallback((priority: string) => {
    const colors: Record<string, string> = {
      HIGH: 'red',
      MEDIUM: 'orange',
      LOW: 'green',
    }
    const labels: Record<string, string> = {
      HIGH: '高优先级',
      MEDIUM: '中优先级',
      LOW: '低优先级',
    }
    return { color: colors[priority] || 'default', label: labels[priority] || priority }
  }, [])

  /**
   * 格式化日期
   */
  const formatDate = useCallback((date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [])

  return {
    getPriorityColor,
    getPriorityTag,
    formatDate,
  }
}

/**
 * 优化的导出函数Hook
 */
export function useOptimizedExport<T>(
  getData: () => T | null,
  getFilename: (type: 'excel' | 'word') => string
) {
  const [exporting, setExporting] = useState(false)

  const exportToExcel = useCallback(async (
    exportFn: (data: T, filename: string) => Promise<void> | void
  ) => {
    const data = getData()
    if (!data) {
      message.warning('没有数据可导出')
      return
    }

    try {
      setExporting(true)
      const filename = getFilename('excel')
      await exportFn(data, filename)
      message.success('正在导出Excel...')
    } catch (err) {
      console.error('Export to Excel error:', err)
      message.error('导出Excel失败')
    } finally {
      setExporting(false)
    }
  }, [getData, getFilename])

  const exportToWord = useCallback(async (
    exportFn: (data: T, filename: string) => Promise<void> | void
  ) => {
    const data = getData()
    if (!data) {
      message.warning('没有数据可导出')
      return
    }

    try {
      setExporting(true)
      const filename = getFilename('word')
      await exportFn(data, filename)
      message.success('正在导出Word...')
    } catch (err) {
      console.error('Export to Word error:', err)
      message.error('导出Word失败')
    } finally {
      setExporting(false)
    }
  }, [getData, getFilename])

  return {
    exporting,
    exportToExcel,
    exportToWord,
  }
}

/**
 * 防抖Hook
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * 节流Hook
 */
export function useThrottle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T {
  const lastRun = useRef(Date.now())

  return useCallback((...args: any[]) => {
    const now = Date.now()
    if (now - lastRun.current >= delay) {
      func(...args)
      lastRun.current = now
    }
  }, [func, delay]) as T
}
