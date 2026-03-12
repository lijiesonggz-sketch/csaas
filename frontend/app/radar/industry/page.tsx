'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Building2, RefreshCw, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

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

      let filteredPushes = response.data
      if (filter === 'watched' && watchedPeerNames.length > 0) {
        filteredPushes = response.data.filter((push) =>
          push.peerName && watchedPeerNames.includes(push.peerName)
        )
      }

      setPushes(filteredPushes)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载推送失败')
    } finally {
      setIsLoading(false)
    }
  }

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
      setError(err instanceof Error ? err.message : '加载同业动态失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMarkPeerPushAsRead = async (pushId: string) => {
    try {
      await markPeerMonitoringPushAsRead(pushId)
      setPeerPushes((prev) =>
        prev.map((push) =>
          push.id === pushId ? { ...push, isRead: true } : push
        )
      )
    } catch (err) {
      console.error('Failed to mark peer push as read:', err)
    }
  }

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
      setActionError(err instanceof Error ? err.message : '收藏操作失败')
    }
  }

  useEffect(() => {
    const loadInitialData = async () => {
      const { fetchOrganizations } = useOrganizationStore.getState()
      let org = currentOrganization

      if (!org) {
        await fetchOrganizations()
        org = useOrganizationStore.getState().currentOrganization
      }

      if (org?.id) {
        try {
          const response = await getWatchedPeers(org.id)
          setWatchedPeers(response)
          setWatchedPeerNames(response.map((peer) => peer.peerName))
        } catch (err) {
          console.error('Failed to fetch watched peers:', err)
        }
      }

      if (activeTab === 'industry') {
        await fetchPushes(org?.id)
      } else {
        await fetchPeerMonitoringPushes(org?.id)
      }
    }

    loadInitialData()
  }, [filter, peerFilter, selectedPeer, activeTab])

  useEffect(() => {
    if (!socket) return

    socket.on('radar:push:new', (newPush: RadarPush) => {
      if (newPush.radarType === 'industry') {
        setPushes((prev) => [newPush, ...prev])
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('行业雷达新推送', {
            body: newPush.title,
            icon: '/radar-icon.png',
          })
        }
      }
    })

    socket.on('radar:peer-monitoring:new', (newPush: PeerMonitoringPush) => {
      setPeerPushes((prev) => [newPush, ...prev])
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

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter)
    const params = new URLSearchParams(searchParams.toString())
    params.set('filter', newFilter)
    router.push(`/radar/industry?${params.toString()}`)
  }

  const handlePeerFilterChange = (newFilter: 'all' | 'watched' | 'specific-peer') => {
    setPeerFilter(newFilter)
    const params = new URLSearchParams(searchParams.toString())
    params.set('peerFilter', newFilter)
    router.push(`/radar/industry?${params.toString()}`)
  }

  const handlePeerChange = (peer: string) => {
    setSelectedPeer(peer)
    const params = new URLSearchParams(searchParams.toString())
    params.set('selectedPeer', peer)
    router.push(`/radar/industry?${params.toString()}`)
  }

  const handleTabChange = (tab: 'industry' | 'peer-monitoring') => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push(`/radar/industry?${params.toString()}`)
  }

  const handleBack = () => {
    router.push('/radar')
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Back Button */}
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回雷达
        </Button>
      </div>

      {/* Page Header */}
      <Card className="mb-6 bg-gradient-to-br from-indigo-500 via-purple-500 to-purple-600 text-white border-0">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">行业雷达 - 同业标杆学习</h1>
                <p className="text-sm text-white/80 mt-1">
                  学习标杆机构的实践经验，洞察同业技术趋势
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="bg-white/20 text-white hover:bg-white/30 border-0"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Connection Status */}
      <div className="mb-4">
        {!isConnected && (
          <Alert variant="destructive" className="rounded-lg">
            <AlertDescription>实时推送连接中断，正在重新连接...</AlertDescription>
          </Alert>
        )}
        {isConnected && (
          <div className="inline-flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            实时推送已连接
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <Card className="mb-4">
        <CardContent className="p-2">
          <div className="flex items-center justify-center gap-2">
            {[
              { id: 'industry', label: '行业动态' },
              { id: 'peer-monitoring', label: '同业动态' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as 'industry' | 'peer-monitoring')}
                className={cn(
                  'px-4 py-2 rounded-lg font-medium transition-all',
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      {activeTab === 'industry' && (
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {['all', 'watched', 'same-scale', 'same-region'].map((filterOption) => (
              <button
                key={filterOption}
                onClick={() => handleFilterChange(filterOption)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium transition-all',
                  filter === filterOption
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {filterOption === 'all' ? '全部' :
                  filterOption === 'watched' ? '我关注的同业' :
                    filterOption === 'same-scale' ? '同规模机构' : '同地区机构'}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'peer-monitoring' && (
        <PeerMonitoringFilter
          filter={peerFilter}
          selectedPeer={selectedPeer}
          watchedPeers={watchedPeerNames}
          onFilterChange={handlePeerFilterChange}
          onPeerChange={handlePeerChange}
        />
      )}

      {/* Push Count */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          共 {activeTab === 'industry' ? pushes.length : peerPushes.length} 条推送
        </p>
      </div>

      {/* Error Alerts */}
      {error && (
        <Alert variant="destructive" className="mb-4 rounded-lg">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {actionError && (
        <Alert variant="destructive" className="mb-4 rounded-lg">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Industry Dynamic Push List - 响应式三列布局 */}
      {!isLoading && activeTab === 'industry' && pushes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {pushes.map((push) => (
            <PushCard
              key={push.pushId}
              push={push}
              variant="industry"
              isWatchedPeer={push.peerName ? watchedPeerNames.includes(push.peerName) : false}
              onViewDetail={setSelectedPushId}
            />
          ))}
        </div>
      )}

      {/* Peer Monitoring Push List - 响应式三列布局 */}
      {!isLoading && activeTab === 'peer-monitoring' && peerPushes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {peerPushes.map((push) => (
            <PeerMonitoringCard
              key={push.id}
              push={push}
              isWatchedPeer={watchedPeerNames.includes(push.peerName)}
              onMarkAsRead={() => handleMarkPeerPushAsRead(push.id)}
              onViewDetail={() => setSelectedPeerPush(push)}
            />
          ))}
        </div>
      )}

      {/* Empty States */}
      {!isLoading && activeTab === 'industry' && pushes.length === 0 && !error && (
        <Card className="p-8 sm:p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">暂无行业雷达推送</h3>
          <p className="text-sm text-muted-foreground mb-4">
            系统会根据您关注的同业机构自动推送相关实践案例
          </p>
          <Button onClick={() => router.push('/radar/settings')}>
            前往配置
          </Button>
        </Card>
      )}

      {!isLoading && activeTab === 'peer-monitoring' && peerPushes.length === 0 && !error && (
        <Card className="p-8 sm:p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">暂无关注的同业动态</h3>
          <p className="text-sm text-muted-foreground mb-4">
            系统会实时监控您关注的同业机构动态并推送相关信息
          </p>
          <Button onClick={() => router.push('/radar/settings')}>
            前往配置
          </Button>
        </Card>
      )}

      {/* Modals */}
      {selectedPushId && (
        <PushDetailModal
          pushId={selectedPushId}
          isOpen={!!selectedPushId}
          onClose={() => setSelectedPushId(null)}
        />
      )}

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
    </div>
  )
}
