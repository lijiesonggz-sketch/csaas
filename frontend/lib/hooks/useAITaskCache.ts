/**
 * AI任务结果缓存Hook
 * 避免重复加载已完成的任务结果
 */
import { useState, useEffect } from 'react'

interface CacheEntry {
  data: any
  timestamp: number
  taskId: string
}

const CACHE_DURATION = 30 * 60 * 1000 // 30分钟

export function useAITaskCache() {
  const [cache, setCache] = useState<Map<string, CacheEntry>>(new Map())

  const getCacheKey = (projectId: string, taskType: string) => {
    return `${projectId}-${taskType}`
  }

  const get = (projectId: string, taskType: string): any | null => {
    const key = getCacheKey(projectId, taskType)
    const entry = cache.get(key)

    if (!entry) {
      // 尝试从localStorage加载
      const stored = localStorage.getItem(`task_cache_${key}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        // 检查是否过期
        if (Date.now() - parsed.timestamp < CACHE_DURATION) {
          setCache(prev => new Map(prev).set(key, parsed))
          return parsed.data
        } else {
          localStorage.removeItem(`task_cache_${key}`)
        }
      }
      return null
    }

    // 检查内存缓存是否过期
    if (Date.now() - entry.timestamp > CACHE_DURATION) {
      cache.delete(key)
      localStorage.removeItem(`task_cache_${key}`)
      return null
    }

    return entry.data
  }

  const set = (projectId: string, taskType: string, taskId: string, data: any) => {
    const key = getCacheKey(projectId, taskType)
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      taskId,
    }

    // 更新内存缓存
    setCache(prev => new Map(prev).set(key, entry))

    // 更新localStorage缓存
    try {
      localStorage.setItem(`task_cache_${key}`, JSON.stringify(entry))
    } catch (err) {
      console.warn('Failed to save to localStorage:', err)
    }
  }

  const clear = (projectId?: string) => {
    if (projectId) {
      // 清除特定项目的缓存
      const keysToDelete: string[] = []
      cache.forEach((value, key) => {
        if (key.startsWith(`${projectId}-`)) {
          keysToDelete.push(key)
        }
      })
      keysToDelete.forEach(key => cache.delete(key))

      // 清除localStorage
      Object.keys(localStorage)
        .filter(k => k.startsWith('task_cache_') && k.includes(projectId))
        .forEach(k => localStorage.removeItem(k))
    } else {
      // 清除所有缓存
      setCache(new Map())
      Object.keys(localStorage)
        .filter(k => k.startsWith('task_cache_'))
        .forEach(k => localStorage.removeItem(k))
    }
  }

  return { get, set, clear }
}
