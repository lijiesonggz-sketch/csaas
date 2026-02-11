'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Box, Container, Typography, Button, Alert, CircularProgress, Grid, Breadcrumbs, Skeleton } from '@mui/material'
import { Warning, Refresh, ArrowBack, Home, Security } from '@mui/icons-material'
import { PushCard } from '@/components/radar/PushCard'
import { CompliancePlaybookModal } from '@/components/radar/CompliancePlaybookModal'
import { getCompliancePushes, RadarPush } from '@/lib/api/radar'
import { useWebSocket } from '@/lib/hooks/useWebSocket'
import { useOrganizationStore } from '@/lib/stores/useOrganizationStore'

// 禁用静态生成，因为这个页面需要动态数据
export const dynamic = 'force-dynamic'

/**
 * Compliance Radar Page - 合规雷达
 *
 * Story 4.3 - Phase 2 Task 2.1: 创建合规雷达页面组件
 * - 复用行业雷达页面布局 (Story 3.3)
 * - 从后端API加载合规推送列表
 * - 使用PushCard组件展示风险预警 (variant='compliance')
 * - WebSocket实时监听新推送（过滤radarType === 'compliance'）
 * - 排序规则: priorityLevel (high > medium > low), 然后按 sentAt DESC
 * - 高优先级推送显示 🚨 图标
 */
export default function ComplianceRadarPage() {
  const router = useRouter()

  const [pushes, setPushes] = useState<RadarPush[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPushId, setSelectedPushId] = useState<string | null>(null)

  const currentOrganization = useOrganizationStore((state) => state.currentOrganization)
  const organizationId = currentOrganization?.id

  const { socket, isConnected } = useWebSocket(organizationId)

  // 加载推送列表
  const fetchPushes = async (orgId?: string) => {
    const effectiveOrgId = orgId || organizationId
    if (!effectiveOrgId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await getCompliancePushes(effectiveOrgId, {
        page: 1,
        limit: 20,
      })

      setPushes(response.data)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to fetch compliance pushes:', err)
      }
      setError(err instanceof Error ? err.message : '加载推送失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 初始加载 - 修复 Issue #3 (Code Review 2026-01-31): 修复竞态条件
  useEffect(() => {
    const loadInitialData = async () => {
      // 先加载组织
      const { fetchOrganizations } = useOrganizationStore.getState()

      let org = currentOrganization

      if (!org) {
        await fetchOrganizations()

        // 重试获取组织（最多3次，每次间隔100ms）
        let retryCount = 0
        while (!org && retryCount < 3) {
          await new Promise(resolve => setTimeout(resolve, 100))
          org = useOrganizationStore.getState().currentOrganization
          retryCount++
        }
      }

      // 加载推送列表
      await fetchPushes(org?.id)
    }

    loadInitialData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // 只在mount时执行一次

  // WebSocket监听新推送（过滤radarType === 'compliance'）
  useEffect(() => {
    if (!socket) return

    // 监听新推送事件
    socket.on('radar:push:new', (newPush: RadarPush) => {
      if (newPush.radarType === 'compliance') {
        // 添加到列表顶部（会自动应用排序）
        setPushes((prev) => [newPush, ...prev])

        // 显示浏览器通知
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('合规雷达新推送', {
            body: newPush.title,
            icon: '/radar-icon-compliance.png',
            tag: newPush.pushId,  // 防止重复通知
          })
        }
      }
    })

    return () => {
      socket.off('radar:push:new')
    }
  }, [socket])

  // 请求通知权限
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const handleRefresh = () => {
    fetchPushes()
  }

  // 排序逻辑 (Task 2.2): priorityLevel (high > medium > low), 然后按 sentAt DESC
  // 修复 Issue #7: 添加注释说明后端使用数字1|2|3,分别对应low|medium|high
  const sortedPushes = useMemo(() => {
    return [...pushes].sort((a, b) => {
      // 映射 priorityLevel 到数字 (high=3, medium=2, low=1)
      // 注: 后端返回的 priorityLevel 是数字类型 1|2|3，分别对应 low|medium|high
      // 虽然 AC 文档中描述为字符串 'high'|'medium'|'low'，但实际实现使用数字
      const priorityMap: Record<number, number> = { 3: 3, 2: 2, 1: 1 }
      const priorityA = priorityMap[a.priorityLevel] || 0
      const priorityB = priorityMap[b.priorityLevel] || 0

      // 先按优先级降序 (3 > 2 > 1)
      if (priorityA !== priorityB) {
        return priorityB - priorityA
      }

      // 优先级相同，按时间倒序
      const timeA = a.sentAt ? new Date(a.sentAt).getTime() : 0
      const timeB = b.sentAt ? new Date(b.sentAt).getTime() : 0
      return timeB - timeA
    })
  }, [pushes])

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* 面包屑导航 */}
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs aria-label="breadcrumb">
          <Link href="/radar" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'error.main' }}>
              <Home sx={{ fontSize: 18 }} />
              <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 500 }}>
                雷达首页
              </Typography>
            </Box>
          </Link>
          <Typography variant="body2" color="text.secondary">
            合规雷达
          </Typography>
        </Breadcrumbs>
      </Box>

      {/* 页面标题 */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Warning fontSize="large" sx={{ color: 'error.main' }} />
            <Typography variant="h4" fontWeight="bold">
              合规雷达 - 风险预警与应对剧本
            </Typography>
          </Box>
          <Button
            component={Link}
            href="/radar"
            variant="outlined"
            startIcon={<ArrowBack />}
            sx={{ minWidth: 120 }}
          >
            返回雷达
          </Button>
        </Box>
        <Typography variant="body1" color="text.secondary">
          监控监管风险，获取应对剧本，快速启动自查整改流程
        </Typography>
      </Box>

      {/* 操作按钮和状态 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
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
          <Typography variant="caption" color="text.secondary">
            共 {sortedPushes.length} 条推送
          </Typography>
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

      {/* 加载骨架屏 (Task 6.2) */}
      {isLoading && (
        <Grid container spacing={4} justifyContent="center">
          {[1, 2, 3].map((i) => (
            <Grid item xs={12} lg={6} xl={6} key={i}>
              <Skeleton variant="rectangular" width="100%" height={300} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* 推送列表 */}
      {!isLoading && sortedPushes.length > 0 && (
        <Grid container spacing={4} justifyContent="center">
          {sortedPushes.map((push) => (
            <Grid item xs={12} lg={6} xl={6} key={push.pushId}>
              <PushCard
                push={push}
                variant="compliance"
                onViewDetail={setSelectedPushId}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* 空状态 (Task 6.1) */}
      {!isLoading && sortedPushes.length === 0 && !error && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Security sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            暂无合规雷达推送，系统将基于您的薄弱项推送相关风险预警
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            系统会根据您的评估结果和配置的合规雷达源自动推送风险预警
          </Typography>
        </Box>
      )}

      {/* 应对剧本弹窗 - 修复 Issue #4 (Code Review 2026-01-31): 确保 push 对象存在 */}
      {selectedPushId && (() => {
        const selectedPush = pushes.find(p => p.pushId === selectedPushId)
        // 如果找不到对应的push（数据不一致），不渲染Modal
        if (!selectedPush) {
          console.warn(`Push ${selectedPushId} not found in pushes array`)
          return null
        }
        return (
          <CompliancePlaybookModal
            visible={!!selectedPushId}
            pushId={selectedPushId}
            organizationId={organizationId!}
            push={selectedPush}
            onClose={() => setSelectedPushId(null)}
          />
        )
      })()}
    </Container>
  )
}
