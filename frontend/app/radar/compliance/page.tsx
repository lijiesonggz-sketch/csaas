'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, RefreshCw, CheckCircle, AlertCircle, Gavel, ArrowLeft } from 'lucide-react'
import { PushCard } from '@/components/radar/PushCard'
import { CompliancePlaybookModal } from '@/components/radar/CompliancePlaybookModal'
import { getCompliancePushes, RadarPush } from '@/lib/api/radar'
import { useWebSocket } from '@/lib/hooks/useWebSocket'
import { useOrganizationStore } from '@/lib/stores/useOrganizationStore'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default function ComplianceRadarPage() {
  const router = useRouter()

  const [pushes, setPushes] = useState<RadarPush[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPushId, setSelectedPushId] = useState<string | null>(null)

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
      const response = await getCompliancePushes(effectiveOrgId, {
        page: 1,
        limit: 20,
      })

      setPushes(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载推送失败')
    } finally {
      setIsLoading(false)
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

      await fetchPushes(org?.id)
    }

    loadInitialData()
  }, [])

  useEffect(() => {
    if (!socket) return

    socket.on('radar:push:new', (newPush: RadarPush) => {
      if (newPush.radarType === 'compliance') {
        setPushes((prev) => [newPush, ...prev])
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('合规雷达新推送', {
            body: newPush.title,
            icon: '/radar-icon-compliance.png',
            tag: newPush.pushId,
          })
        }
      }
    })

    return () => {
      socket.off('radar:push:new')
    }
  }, [socket])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const handleRefresh = () => {
    fetchPushes()
  }

  const handleBack = () => {
    router.push('/radar')
  }

  const sortedPushes = useMemo(() => {
    return [...pushes].sort((a, b) => {
      const priorityMap: Record<number, number> = { 3: 3, 2: 2, 1: 1 }
      const priorityA = priorityMap[a.priorityLevel] || 0
      const priorityB = priorityMap[b.priorityLevel] || 0

      if (priorityA !== priorityB) {
        return priorityB - priorityA
      }

      const timeA = a.sentAt ? new Date(a.sentAt).getTime() : 0
      const timeB = b.sentAt ? new Date(b.sentAt).getTime() : 0
      return timeB - timeA
    })
  }, [pushes])

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
      <Card className="mb-6 bg-gradient-to-br from-red-500 via-orange-500 to-amber-500 text-white border-0">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">合规雷达 - 风险预警与应对剧本</h1>
                <p className="text-sm text-white/80 mt-1">
                  监控监管风险，获取应对剧本，快速启动自查整改流程
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

      {/* Push Count */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          共 {sortedPushes.length} 条推送
        </p>
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
      {!isLoading && sortedPushes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {sortedPushes.map((push) => (
            <PushCard
              key={push.pushId}
              push={push}
              variant="compliance"
              onViewDetail={setSelectedPushId}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && sortedPushes.length === 0 && !error && (
        <Card className="p-8 sm:p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Gavel className="w-10 h-10 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">暂无合规雷达推送</h3>
          <p className="text-sm text-muted-foreground">
            系统会根据您的评估结果和配置的合规雷达源自动推送风险预警
          </p>
        </Card>
      )}

      {/* Compliance Playbook Modal */}
      {selectedPushId && (() => {
        const selectedPush = pushes.find(p => p.pushId === selectedPushId)
        if (!selectedPush) return null
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
    </div>
  )
}
