'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  TrendingUp,
  Building2,
  AlertTriangle,
  Settings,
  ArrowRight,
  Info,
  History as HistoryIcon,
} from 'lucide-react'
import OnboardingWizard from '@/components/radar/OnboardingWizard'
import { useOnboarding } from '@/lib/hooks/useOnboarding'
import { ErrorBoundary } from '@/components/error-boundary/ErrorBoundary'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buildRadarHistoryRoute } from '@/lib/api/radar'
import { useRadarUnreadCount } from '@/lib/hooks/useRadarUnreadCount'
import { cn } from '@/lib/utils'

/**
 * Radar Dashboard Page
 *
 * Epic 1 Story 1.4 - AC 6
 * 显示三大雷达入口：技术雷达、行业雷达、合规雷达
 *
 * @route /radar
 */
function RadarDashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orgId = searchParams.get('orgId')

  const { isOnboarded, radarActivated, isLoading, refetch } = useOnboarding(orgId)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const { unreadCount } = useRadarUnreadCount({
    enabled: Boolean(orgId),
  })

  // Show onboarding wizard if not completed and radar not activated
  useEffect(() => {
    if (!isLoading && !isOnboarded && !radarActivated && orgId) {
      setShowOnboarding(true)
    }
  }, [isLoading, isOnboarded, radarActivated, orgId])

  // Handle onboarding completion
  const handleOnboardingComplete = async () => {
    setShowOnboarding(false)
    // Refetch radar status from server
    await refetch()
  }

  const radarTypes = [
    {
      id: 'tech',
      title: '技术雷达',
      icon: <TrendingUp className="w-6 h-6" />,
      description: '基于薄弱项推送技术趋势，包含ROI分析、优先级排序和供应商推荐',
      route: `/radar/tech${orgId ? `?orgId=${orgId}` : ''}`,
      color: 'bg-blue-600',
    },
    {
      id: 'industry',
      title: '行业雷达',
      icon: <Building2 className="w-6 h-6" />,
      description: '同业标杆学习，推送技术实践案例、招聘信息和机构动态',
      route: `/radar/industry${orgId ? `?orgId=${orgId}` : ''}`,
      color: 'bg-amber-500',
    },
    {
      id: 'compliance',
      title: '合规雷达',
      icon: <AlertTriangle className="w-6 h-6" />,
      description: '合规风险预警，提供应对剧本、自查清单和整改方案对比',
      route: `/radar/compliance${orgId ? `?orgId=${orgId}` : ''}`,
      color: 'bg-red-600',
    },
  ]

  return (
    <>
      {/* Onboarding Wizard */}
      {orgId && (
        <OnboardingWizard
          orgId={orgId}
          open={showOnboarding}
          onClose={() => setShowOnboarding(false)}
          onComplete={handleOnboardingComplete}
        />
      )}

      <div className="container mx-auto px-6 py-8 bg-[#FEFDFB] min-h-screen">
        {/* Page Header */}
        <Card className="mb-6 border border-[#E2E8F0] shadow-sm rounded-sm overflow-hidden">
          <div className="bg-[#1E3A5F] p-6 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <h1 className="text-3xl font-bold font-[var(--font-plus-jakarta)] mb-2">
                  Radar Service
                </h1>
                <p className="text-white/80 text-sm font-[var(--font-inter)]">
                  智能推送技术趋势、行业标杆和合规预警，帮助您做出技术投资决策
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => router.push(buildRadarHistoryRoute(orgId ?? undefined))}
                  className="border-white text-white hover:bg-white/10 rounded-sm"
                >
                  <div className="relative">
                    <HistoryIcon className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </div>
                  <span className="ml-2">推送历史</span>
                </Button>
                <Button
                  size="default"
                  onClick={() => router.push(`/radar/settings${orgId ? `?orgId=${orgId}` : ''}`)}
                  className="bg-white text-[#1E3A5F] hover:bg-white/90 rounded-sm"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  配置管理
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Radar activation status badge */}
        {orgId && !isLoading && (
          <div className="mb-6">
            <Button
              size="sm"
              variant={radarActivated ? 'default' : 'outline'}
              onClick={() => setShowOnboarding(true)}
              className={cn(
                'rounded-sm',
                radarActivated
                  ? 'bg-[#059669] text-white hover:bg-[#047857]'
                  : 'border-[#1E3A5F] text-[#1E3A5F]'
              )}
            >
              {radarActivated ? 'Radar已激活' : '激活Radar Service'}
            </Button>
          </div>
        )}

        {/* Radar Type Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {radarTypes.map((radar) => (
            <Card
              key={radar.id}
              className="cursor-pointer transition-shadow hover:shadow-md border border-[#E2E8F0] rounded-sm overflow-hidden"
              onClick={() => router.push(radar.route)}
            >
              <div className={cn('p-6 text-white', radar.color)}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-white/20 rounded-sm">{radar.icon}</div>
                  <h2 className="text-xl font-semibold font-[var(--font-plus-jakarta)]">
                    {radar.title}
                  </h2>
                </div>
                <p className="text-sm text-white/90 font-[var(--font-inter)]">
                  {radar.description}
                </p>
              </div>
              <div className="p-4 bg-white border-t border-[#E2E8F0] flex items-center justify-between">
                <span className="text-sm text-[#94A3B8] font-[var(--font-inter)]">进入雷达</span>
                <ArrowRight className="w-4 h-4 text-[#059669]" />
              </div>
            </Card>
          ))}
        </div>

        {/* Info Box */}
        <Card className="border border-[#E2E8F0] shadow-sm rounded-sm">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-sm">
              <Info className="w-5 h-5 text-[#1E3A5F]" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-[#1E3A5F] font-[var(--font-inter)]">
                <strong>提示：</strong>
                Radar Service会根据您的评估结果自动识别薄弱项，并推送相关内容。
                {orgId ? (
                  <>
                    {' '}
                    您的组织ID:{' '}
                    <code className="px-2 py-1 bg-slate-100 rounded-sm text-xs">{orgId}</code>
                  </>
                ) : (
                  '请先选择组织。'
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

// Loading fallback for Suspense
function RadarDashboardFallback() {
  return (
    <div className="container mx-auto px-6 py-8 bg-[#FEFDFB] min-h-screen">
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-[#1E3A5F] border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )
}

// Main page component with Suspense boundary
export default function RadarDashboardPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RadarDashboardFallback />}>
        <RadarDashboardContent />
      </Suspense>
    </ErrorBoundary>
  )
}
