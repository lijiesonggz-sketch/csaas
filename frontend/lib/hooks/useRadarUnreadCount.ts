'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getUnreadPushCount,
  RADAR_UNREAD_COUNT_REFRESH_EVENT,
} from '@/lib/api/radar'

interface UseRadarUnreadCountOptions {
  enabled?: boolean
  pollingIntervalMs?: number
}

export function useRadarUnreadCount(options: UseRadarUnreadCountOptions = {}) {
  const {
    enabled = true,
    pollingIntervalMs = 60000,
  } = options
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const isMountedRef = useRef(true)

  const refresh = useCallback(async () => {
    if (!enabled) {
      if (isMountedRef.current) {
        setUnreadCount(0)
        setIsLoading(false)
        setError(null)
      }
      return
    }

    try {
      const count = await getUnreadPushCount()

      if (!isMountedRef.current) {
        return
      }

      setUnreadCount(count)
      setError(null)
    } catch (err) {
      if (!isMountedRef.current) {
        return
      }

      setError(err instanceof Error ? err.message : '加载未读推送数失败')
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [enabled])

  useEffect(() => {
    isMountedRef.current = true
    void refresh()

    return () => {
      isMountedRef.current = false
    }
  }, [refresh])

  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    const handleRefresh = () => {
      void refresh()
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void refresh()
      }
    }

    window.addEventListener(RADAR_UNREAD_COUNT_REFRESH_EVENT, handleRefresh)
    window.addEventListener('focus', handleRefresh)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void refresh()
      }
    }, pollingIntervalMs)

    return () => {
      window.removeEventListener(RADAR_UNREAD_COUNT_REFRESH_EVENT, handleRefresh)
      window.removeEventListener('focus', handleRefresh)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.clearInterval(timer)
    }
  }, [enabled, pollingIntervalMs, refresh])

  return {
    unreadCount,
    isLoading,
    error,
    refresh,
  }
}
