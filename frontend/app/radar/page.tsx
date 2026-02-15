'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { Box, Container, Typography, CircularProgress, Tooltip } from '@mui/material'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  TrendingUp,
  Business,
  ArrowForward,
  Settings,
  ArrowBack,
  ArrowLeft,
  ArrowRight,
  Info,
} from '@mui/icons-material'
import OnboardingWizard from '@/components/radar/OnboardingWizard'
import { useOnboarding } from '@/lib/hooks/useOnboarding'
import { apiFetch } from '@/lib/utils/api'
import { ErrorBoundary } from '@/components/error-boundary/ErrorBoundary'
import PageHeader from '@/components/ui/mui/PageHeader'
import ContentCard from '@/components/ui/mui/ContentCard'
import GradientCard from '@/components/ui/mui/GradientCard'
import SecondaryButton from '@/components/ui/mui/SecondaryButton'
import { PrimaryButton as UnifiedButton } from '@/components/ui/mui'

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
      icon: <TrendingUp sx={{ fontSize: 24 }} />,
      description: '基于薄弱项推送技术趋势，包含ROI分析、优先级排序和供应商推荐',
      route: `/radar/tech${orgId ? `?orgId=${orgId}` : ''}`,
      color: '#2196F3',
    },
    {
      id: 'industry',
      title: '行业雷达',
      icon: <Business sx={{ fontSize: 24 }} />,
      description: '同业标杆学习，推送技术实践案例、招聘信息和机构动态',
      route: `/radar/industry${orgId ? `?orgId=${orgId}` : ''}`,
      color: '#FF9800',
    },
    {
      id: 'compliance',
      title: '合规雷达',
      icon: <TrendingUp sx={{ fontSize: 24 }} />,
      description: '合规风险预警，提供应对剧本、自查清单和整改方案对比',
      route: `/radar/compliance${orgId ? `?orgId=${orgId}` : ''}`,
      color: '#F44336',
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

      <Container maxWidth="xl" sx={{ px: 6, py: 8 }}>
        {/* Page Header with Gradient */}
        <PageHeader
          title="Radar Service"
          description="智能推送技术趋势、行业标杆和合规预警，帮助您做出技术投资决策"
          action={
            <Box sx={{ display: 'flex', gap: 2 }}>
              <UnifiedButton
                variant="outlined"
                size="medium"
                onClick={() => router.push('/dashboard')}
              >
                <ArrowLeft sx={{ fontSize: 16, mr: 1 }} />
                返回首页
              </UnifiedButton>
              <UnifiedButton
                size="medium"
                onClick={() => router.push(`/radar/settings${orgId ? `?orgId=${orgId}` : ''}`)}
              >
                <Settings sx={{ fontSize: 16, mr: 1 }} />
                配置管理
              </UnifiedButton>
            </Box>
          }
        />

        {/* Radar activation status badge */}
        {orgId && !isLoading && (
          <Box sx={{ mt: 4 }}>
            <UnifiedButton
              size="small"
              variant={radarActivated ? 'contained' : 'outlined'}
              onClick={() => setShowOnboarding(true)}
            >
              {radarActivated ? 'Radar已激活' : '激活Radar Service'}
            </UnifiedButton>
          </Box>
        )}

        {/* Radar Type Cards */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
          gap: 4,
          mt: 4
        }}>
          {radarTypes.map((radar) => (
            <GradientCard
              key={radar.id}
              hover
              onClick={() => router.push(radar.route)}
              role="button"
              aria-label={`进入${radar.title}`}
              sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 3 }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 56,
                      height: 56,
                      flexShrink: 0,
                      color: 'white',
                      background: radar.color === '#2196F3'
                        ? 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)'
                        : radar.color === '#FF9800'
                        ? 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)'
                        : 'linear-gradient(135deg, #F44336 0%, #D32F2F 100%)',
                    }}
                  >
                    {radar.icon}
                  </Box>
                  <Typography variant="h6" sx={{ fontSize: '1.25rem', fontWeight: 600, color: 'white' }}>
                    {radar.title}
                  </Typography>
                </Box>

                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.625, px: 0.5 }}>
                  {radar.description}
                </Typography>
              </Box>

              <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid rgba(255, 255, 255, 0.3)' }}>
                <UnifiedButton
                  variant="text"
                  size="medium"
                  onClick={() => router.push(radar.route)}
                  sx={{ width: '100%', color: 'white', '&:hover': { color: 'rgba(255, 255, 255, 0.9)' } }}
                >
                  进入雷达
                  <ArrowRight sx={{ fontSize: 16, ml: 1 }} />
                </UnifiedButton>
              </Box>
            </GradientCard>
          ))}
        </Box>

        {/* Info Box */}
        <Box sx={{ mt: 4 }}>
          <GradientCard sx={{ p: 3, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Tooltip title="提示信息">
              <Box>
                <Info sx={{ fontSize: 24, color: '#667eea' }} />
              </Box>
            </Tooltip>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2">
                <strong>提示：</strong>
                Radar Service会根据您的评估结果自动识别薄弱项，并推送相关内容。
                {orgId ? (
                  <>
                    您的组织ID: <code>{orgId}</code>
                  </>
                ) : (
                  '请先选择组织。'
                )}
              </Typography>
            </Box>
          </GradientCard>
        </Box>
      </Container>
    </>
  )
}

// Loading fallback for Suspense
function RadarDashboardFallback() {
  return (
    <Box sx={{ maxWidth: '72rem', mx: 'auto', px: 6, py: 8 }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    </Box>
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
