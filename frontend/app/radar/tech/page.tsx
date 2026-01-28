'use client'

import { useState, useEffect } from 'react'
import { Box, Container, Typography, Button, Alert, CircularProgress, Grid } from '@mui/material'
import { TrendingUp, Refresh } from '@mui/icons-material'
import { PushCard } from '@/components/radar/PushCard'
import { PushDetailModal } from '@/components/radar/PushDetailModal'
import { getRadarPushes, RadarPush } from '@/lib/api/radar'
import { useWebSocket } from '@/lib/hooks/useWebSocket'

// 禁用静态生成，因为这个页面需要动态数据
export const dynamic = 'force-dynamic'

/**
 * Tech Radar Page - 技术雷达
 *
 * Story 2.4 - Phase 3: 前端展示 (Issue #2修复 - 真实API集成)
 * - 从后端API加载技术推送列表
 * - 使用PushCard组件展示推送摘要和ROI分析
 * - 使用PushDetailModal弹窗展示详情
 * - WebSocket实时监听新推送
 */
export default function TechRadarPage() {
  const [selectedPushId, setSelectedPushId] = useState<string | null>(null)
  const [pushes, setPushes] = useState<RadarPush[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { socket, isConnected } = useWebSocket()

  // 加载推送列表
  const fetchPushes = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await getRadarPushes({
        radarType: 'tech',
        status: 'sent',
        page: 1,
        limit: 20,
      })
      setPushes(response.data)
    } catch (err) {
      console.error('Failed to fetch pushes:', err)
      setError(err instanceof Error ? err.message : '加载推送失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 初始加载
  useEffect(() => {
    fetchPushes()
  }, [])

  // WebSocket监听新推送
  useEffect(() => {
    if (!socket || !isConnected) return

    // 监听新推送事件
    socket.on('radar:push:new', (newPush: RadarPush) => {
      if (newPush.radarType === 'tech') {
        console.log('New tech radar push received:', newPush)

        // 添加到列表顶部
        setPushes((prev) => [newPush, ...prev])

        // 显示浏览器通知
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('技术雷达新推送', {
            body: newPush.title,
            icon: '/radar-icon.png',
          })
        }
      }
    })

    return () => {
      socket.off('radar:push:new')
    }
  }, [socket, isConnected])

  // 请求通知权限
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const handleRefresh = () => {
    fetchPushes()
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* 页面标题 */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <TrendingUp fontSize="large" />
          <Typography variant="h4" fontWeight="bold">
            技术雷达 - ROI导向的技术决策支持
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          基于您的薄弱项和关注领域，为您推荐最具性价比的技术方案
        </Typography>
      </Box>

      {/* 操作按钮 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          {!isConnected && (
            <Typography variant="caption" color="warning.main">
              ⚠️ 实时推送连接中断，正在重新连接...
            </Typography>
          )}
          {isConnected && (
            <Typography variant="caption" color="success.main">
              ✓ 实时推送已连接
            </Typography>
          )}
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={handleRefresh}
          disabled={isLoading}
        >
          刷新
        </Button>
      </Box>

      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* 加载状态 */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* 推送列表 */}
      {!isLoading && pushes.length > 0 && (
        <Grid container spacing={3}>
          {pushes.map((push) => (
            <Grid item xs={12} sm={6} lg={4} key={push.pushId}>
              <PushCard
                push={push}
                onViewDetail={setSelectedPushId}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* 空状态 */}
      {!isLoading && pushes.length === 0 && !error && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            暂无推送内容
          </Typography>
          <Typography variant="body2" color="text.secondary">
            系统会根据您的薄弱项和关注领域自动推送相关技术方案
          </Typography>
        </Box>
      )}

      {/* 详情弹窗 */}
      {selectedPushId && (
        <PushDetailModal
          pushId={selectedPushId}
          isOpen={!!selectedPushId}
          onClose={() => setSelectedPushId(null)}
        />
      )}
    </Container>
  )
}
