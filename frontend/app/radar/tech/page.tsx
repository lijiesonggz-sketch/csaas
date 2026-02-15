'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { PushCard } from '@/components/radar/PushCard'
import { PushDetailModal } from '@/components/radar/PushDetailModal'
import { getRadarPushes, RadarPush } from '@/lib/api/radar'
import { useWebSocket } from '@/lib/hooks/useWebSocket'
import { useOrganizationStore } from '@/lib/stores/useOrganizationStore'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'

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
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization)
  const organizationId = currentOrganization?.id

  const { socket, isConnected } = useWebSocket(organizationId)

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
    const loadInitialData = async () => {
      const { fetchOrganizations } = useOrganizationStore.getState()
      let org = currentOrganization

      if (!org) {
        await fetchOrganizations()
        org = useOrganizationStore.getState().currentOrganization
      }

      fetchPushes()
    }

    loadInitialData()
  }, [])

  // WebSocket监听新推送
  useEffect(() => {
    if (!socket || !isConnected) return

    socket.on('radar:push:new', (newPush: RadarPush) => {
      if (newPush.radarType === 'tech') {
        setPushes((prev) => [newPush, ...prev])

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
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Page Header */}
      <Card className="mb-6 bg-gradient-to-br from-indigo-500 via-purple-500 to-purple-600 text-white border-0">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">技术雷达 - ROI导向的技术决策支持</h1>
                <p className="text-sm text-white/80 mt-1">
                  基于您的薄弱项和关注领域，为您推荐最具性价比的技术方案
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

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-4 rounded-lg">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Push List - 响应式三列布局 */}
      {!isLoading && pushes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {pushes.map((push) => (
            <PushCard
              key={push.pushId}
              push={push}
              onViewDetail={setSelectedPushId}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && pushes.length === 0 && !error && (
        <Card className="p-8 sm:p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">暂无推送内容</h3>
          <p className="text-sm text-muted-foreground">
            系统会根据您的薄弱项和关注领域自动推送相关技术方案
          </p>
        </Card>
      )}

      {/* Detail Modal */}
      {selectedPushId && (
        <PushDetailModal
          pushId={selectedPushId}
          isOpen={!!selectedPushId}
          onClose={() => setSelectedPushId(null)}
        />
      )}
    </div>
  )
}
