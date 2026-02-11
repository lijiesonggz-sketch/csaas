'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Box, Container, Typography, Button, Alert, CircularProgress, Grid, Breadcrumbs, Chip } from '@mui/material'
import { Business, Refresh, ArrowBack, Home } from '@mui/icons-material'
import { PushCard } from '@/components/radar/PushCard'
import { PushDetailModal } from '@/components/radar/PushDetailModal'
import { PeerMonitoringCard, PeerMonitoringPush } from '@/components/radar/PeerMonitoringCard'
import { PeerMonitoringDetailModal } from '@/components/radar/PeerMonitoringDetailModal'
import { PeerMonitoringFilter } from '@/components/radar/PeerMonitoringFilter'
import {
  getIndustryPushes,
  getWatchedPeers,
  getPeerMonitoringPushes,
  markPeerMonitoringPushAsRead,
  bookmarkPeerMonitoringPush,
  RadarPush,
  WatchedPeer,
} from '@/lib/api/radar'
import { useWebSocket } from '@/lib/hooks/useWebSocket'
import { useOrganizationStore } from '@/lib/stores/useOrganizationStore'

// 禁用静态生成，因为这个页面需要动态数据
export const dynamic = 'force-dynamic'

/**
 * Industry Radar Page - 行业雷达
 *
 * Story 3.3 - Phase 1 Task 1.1: 创建行业雷达页面组件
 * Story 8.6 - 同业动态前端展示增强
 *
 * 功能：
 * - 复用技术雷达页面布局 (Story 2.5)
 * - 从后端API加载行业推送列表
 * - 使用PushCard组件展示同业案例
 * - WebSocket实时监听新推送（过滤radarType === 'industry'）
 * - 筛选器状态持久化（使用URL查询参数）
 * - 同业动态推送展示（Story 8.6）
 * - 同业动态详情弹窗（Story 8.6 - AC3）
 * - 与我关注的同业相关筛选（Story 8.6 - AC4）
 */
export default function IndustryRadarPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [selectedPushId, setSelectedPushId] = useState<string | null>(null)
  const [selectedPeerPush, setSelectedPeerPush] = useState<PeerMonitoringPush | null>(null)
  const [pushes, setPushes] = useState<RadarPush[]>([])
  const [peerPushes, setPeerPushes] = useState<PeerMonitoringPush[]>([])
  const [watchedPeers, setWatchedPeers] = useState<WatchedPeer[]>([])
  const [watchedPeerNames, setWatchedPeerNames] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [filter, setFilter] = useState(searchParams.get('filter') || 'all')
  const [peerFilter, setPeerFilter] = useState<'all' | 'watched' | 'specific-peer'>(
    (searchParams.get('peerFilter') as 'all' | 'watched' | 'specific-peer') || 'all'
  )
  const [selectedPeer, setSelectedPeer] = useState<string>(searchParams.get('selectedPeer') || '')
  const [activeTab, setActiveTab] = useState<'industry' | 'peer-monitoring'>(
    (searchParams.get('tab') as 'industry' | 'peer-monitoring') || 'industry'
  )

  const currentOrganization = useOrganizationStore((state) => state.currentOrganization)
  const organizationId = currentOrganization?.id

  const { socket, isConnected } = useWebSocket(organizationId)

  // 加载行业推送列表
  const fetchPushes = async (orgId?: string) => {
    const effectiveOrgId = orgId || organizationId
    if (!effectiveOrgId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await getIndustryPushes(effectiveOrgId, {
        filter: filter as 'all' | 'watched' | 'same-scale' | 'same-region',
        page: 1,
        limit: 20,
      })

      // 如果是"我关注的同业"筛选，前端再次过滤
      let filteredPushes = response.data
      if (filter === 'watched' && watchedPeerNames.length > 0) {
        filteredPushes = response.data.filter((push) =>
          push.peerName && watchedPeerNames.includes(push.peerName)
        )
      }

      setPushes(filteredPushes)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to fetch pushes:', err)
      }
      setError(err instanceof Error ? err.message : '加载推送失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 加载同业动态推送列表 (Story 8.6)
  const fetchPeerMonitoringPushes = async (orgId?: string) => {
    const effectiveOrgId = orgId || organizationId
    if (!effectiveOrgId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await getPeerMonitoringPushes(effectiveOrgId, {
        watchedOnly: peerFilter === 'watched',
        peerName: peerFilter === 'specific-peer' ? selectedPeer : undefined,
        page: 1,
        limit: 20,
      })

      setPeerPushes(response.data)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to fetch peer monitoring pushes:', err)
      }
      setError(err instanceof Error ? err.message : '加载同业动态失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 标记同业动态为已读 (Story 8.6)
  const handleMarkPeerPushAsRead = async (pushId: string) => {
    try {
      await markPeerMonitoringPushAsRead(pushId)
      setPeerPushes((prev) =>
        prev.map((push) =>
          push.id === pushId ? { ...push, isRead: true } : push
        )
      )
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to mark peer push as read:', err)
      }
    }
  }

  // 收藏/取消收藏同业动态 (Story 8.6)
  const handleBookmarkPeerPush = async (pushId: string, bookmark: boolean) => {
    try {
      setActionError(null)
      await bookmarkPeerMonitoringPush(pushId, bookmark)
      setPeerPushes((prev) =>
        prev.map((push) =>
          push.id === pushId ? { ...push, isBookmarked: bookmark } : push
        )
      )
      if (selectedPeerPush && selectedPeerPush.id === pushId) {
        setSelectedPeerPush({ ...selectedPeerPush, isBookmarked: bookmark })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '收藏操作失败，请稍后重试'
      setActionError(errorMessage)
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to bookmark peer push:', err)
      }
    }
  }

  // 初始加载
  useEffect(() => {
    const loadInitialData = async () => {
      // 先加载组织
      const { fetchOrganizations } = useOrganizationStore.getState()

      let org = currentOrganization

      if (!org) {
        await fetchOrganizations()

        // 手动获取加载后的组织
        org = useOrganizationStore.getState().currentOrganization
      }

      // 加载关注的同业列表 (定义在useEffect内部避免依赖问题)
      if (org?.id) {
        try {
          const response = await getWatchedPeers(org.id)
          setWatchedPeers(response)
          setWatchedPeerNames(response.map((peer) => peer.peerName))
        } catch (err) {
          // 不影响主流程，静默失败
          if (process.env.NODE_ENV === 'development') {
            console.error('Failed to fetch watched peers:', err)
          }
        }
      }

      // 根据当前标签加载对应数据
      if (activeTab === 'industry') {
        await fetchPushes(org?.id)
      } else {
        await fetchPeerMonitoringPushes(org?.id)
      }
    }

    loadInitialData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, peerFilter, selectedPeer, activeTab])

  // WebSocket监听新推送（过滤radarType === 'industry' 或 pushType === 'peer-monitoring'）
  useEffect(() => {
    if (!socket) return

    // 监听新推送事件
    socket.on('radar:push:new', (newPush: RadarPush) => {
      if (newPush.radarType === 'industry') {
        // 添加到列表顶部
        setPushes((prev) => [newPush, ...prev])

        // 显示浏览器通知
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('行业雷达新推送', {
            body: newPush.title,
            icon: '/radar-icon.png',
          })
        }
      }
    })

    // 监听同业动态推送事件 (Story 8.6)
    socket.on('radar:peer-monitoring:new', (newPush: PeerMonitoringPush) => {
      setPeerPushes((prev) => [newPush, ...prev])

      // 显示浏览器通知
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('同业动态新推送', {
          body: `${newPush.peerName} - ${newPush.practiceDescription.substring(0, 50)}...`,
          icon: '/radar-icon.png',
        })
      }
    })

    return () => {
      socket.off('radar:push:new')
      socket.off('radar:peer-monitoring:new')
    }
  }, [socket])

  // 请求通知权限
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const handleRefresh = () => {
    if (activeTab === 'industry') {
      fetchPushes()
    } else {
      fetchPeerMonitoringPushes()
    }
  }

  // 筛选器切换（状态持久化到URL）
  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter)
    const params = new URLSearchParams(searchParams.toString())
    params.set('filter', newFilter)
    router.push(`/radar/industry?${params.toString()}`)
  }

  // 同业筛选器切换 (Story 8.6)
  const handlePeerFilterChange = (newFilter: 'all' | 'watched' | 'specific-peer') => {
    setPeerFilter(newFilter)
    const params = new URLSearchParams(searchParams.toString())
    params.set('peerFilter', newFilter)
    router.push(`/radar/industry?${params.toString()}`)
  }

  // 特定同业选择 (Story 8.6)
  const handlePeerChange = (peer: string) => {
    setSelectedPeer(peer)
    const params = new URLSearchParams(searchParams.toString())
    params.set('selectedPeer', peer)
    router.push(`/radar/industry?${params.toString()}`)
  }

  // 标签切换
  const handleTabChange = (tab: 'industry' | 'peer-monitoring') => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push(`/radar/industry?${params.toString()}`)
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* 面包屑导航 */}
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs aria-label="breadcrumb">
          <Link href="/radar" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'success.main' }}>
              <Home sx={{ fontSize: 18 }} />
              <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 500 }}>
                雷达首页
              </Typography>
            </Box>
          </Link>
          <Typography variant="body2" color="text.secondary">
            行业雷达
          </Typography>
        </Breadcrumbs>
      </Box>

      {/* 页面标题 */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Business fontSize="large" sx={{ color: 'success.main' }} />
            <Typography variant="h4" fontWeight="bold">
              行业雷达 - 同业标杆学习
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
          学习标杆机构的实践经验，洞察同业技术趋势
        </Typography>
      </Box>

      {/* 标签切换 */}
      <Box sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Chip
            label="行业动态"
            color={activeTab === 'industry' ? 'success' : 'default'}
            onClick={() => handleTabChange('industry')}
            sx={{
              fontWeight: activeTab === 'industry' ? 600 : 400,
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
              mb: -0.5,
            }}
          />
          <Chip
            label="同业动态"
            color={activeTab === 'peer-monitoring' ? 'primary' : 'default'}
            onClick={() => handleTabChange('peer-monitoring')}
            sx={{
              fontWeight: activeTab === 'peer-monitoring' ? 600 : 400,
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
              mb: -0.5,
            }}
          />
        </Box>
      </Box>

      {/* 行业动态筛选器 */}
      {activeTab === 'industry' && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label="全部"
              color={filter === 'all' ? 'success' : 'default'}
              onClick={() => handleFilterChange('all')}
              sx={{ fontWeight: filter === 'all' ? 600 : 400, cursor: 'pointer' }}
            />
            <Chip
              label="我关注的同业"
              color={filter === 'watched' ? 'success' : 'default'}
              onClick={() => handleFilterChange('watched')}
              sx={{ fontWeight: filter === 'watched' ? 600 : 400, cursor: 'pointer' }}
            />
            <Chip
              label="同规模机构"
              color={filter === 'same-scale' ? 'success' : 'default'}
              onClick={() => handleFilterChange('same-scale')}
              sx={{ fontWeight: filter === 'same-scale' ? 600 : 400, cursor: 'pointer' }}
            />
            <Chip
              label="同地区机构"
              color={filter === 'same-region' ? 'success' : 'default'}
              onClick={() => handleFilterChange('same-region')}
              sx={{ fontWeight: filter === 'same-region' ? 600 : 400, cursor: 'pointer' }}
            />
          </Box>
        </Box>
      )}

      {/* 同业动态筛选器 (Story 8.6 - AC4) */}
      {activeTab === 'peer-monitoring' && (
        <PeerMonitoringFilter
          filter={peerFilter}
          selectedPeer={selectedPeer}
          watchedPeers={watchedPeerNames}
          onFilterChange={handlePeerFilterChange}
          onPeerChange={handlePeerChange}
        />
      )}

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
            共 {activeTab === 'industry' ? pushes.length : peerPushes.length} 条推送
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

      {/* 操作错误提示 */}
      {actionError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {/* 加载状态 */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress color={activeTab === 'industry' ? 'success' : 'primary'} />
        </Box>
      )}

      {/* 行业动态推送列表 */}
      {!isLoading && activeTab === 'industry' && pushes.length > 0 && (
        <Grid container spacing={4} justifyContent="center">
          {pushes.map((push) => (
            <Grid size={{ xs: 12, lg: 6, xl: 6 }} key={push.pushId}>
              <PushCard
                push={push}
                variant="industry"
                isWatchedPeer={push.peerName ? watchedPeerNames.includes(push.peerName) : false}
                onViewDetail={setSelectedPushId}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* 同业动态推送列表 (Story 8.6 - AC1, AC2) */}
      {!isLoading && activeTab === 'peer-monitoring' && peerPushes.length > 0 && (
        <Grid container spacing={4} justifyContent="center">
          {peerPushes.map((push) => (
            <Grid size={{ xs: 12, lg: 6, xl: 6 }} key={push.id}>
              <PeerMonitoringCard
                push={push}
                isWatchedPeer={watchedPeerNames.includes(push.peerName)}
                onMarkAsRead={() => handleMarkPeerPushAsRead(push.id)}
                onViewDetail={() => setSelectedPeerPush(push)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* 行业动态空状态 */}
      {!isLoading && activeTab === 'industry' && pushes.length === 0 && !error && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            暂无行业雷达推送，请配置关注的同业机构
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            系统会根据您关注的同业机构自动推送相关实践案例
          </Typography>
          <Button
            component={Link}
            href="/radar/settings"
            variant="contained"
            color="success"
          >
            前往配置
          </Button>
        </Box>
      )}

      {/* 同业动态空状态 (Story 8.6) */}
      {!isLoading && activeTab === 'peer-monitoring' && peerPushes.length === 0 && !error && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            暂无关注的同业动态，请先在设置中添加关注的同业机构
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            系统会实时监控您关注的同业机构动态并推送相关信息
          </Typography>
          <Button
            component={Link}
            href="/radar/settings"
            variant="contained"
            color="primary"
          >
            前往配置
          </Button>
        </Box>
      )}

      {/* 行业动态详情弹窗 */}
      {selectedPushId && (
        <PushDetailModal
          pushId={selectedPushId}
          isOpen={!!selectedPushId}
          onClose={() => setSelectedPushId(null)}
        />
      )}

      {/* 同业动态详情弹窗 (Story 8.6 - AC3) */}
      {selectedPeerPush && (
        <PeerMonitoringDetailModal
          open={!!selectedPeerPush}
          push={{
            ...selectedPeerPush,
            isBookmarked: selectedPeerPush.isBookmarked || false,
          }}
          onClose={() => setSelectedPeerPush(null)}
          onBookmark={() => handleBookmarkPeerPush(selectedPeerPush.id, !selectedPeerPush.isBookmarked)}
          onMarkAsRead={() => handleMarkPeerPushAsRead(selectedPeerPush.id)}
        />
      )}
    </Container>
  )
}
