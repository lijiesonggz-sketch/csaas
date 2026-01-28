'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { Box, Container, Typography, Card, CardContent, Button, CircularProgress, Divider } from '@mui/material'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  TrendingUp,
  Business,
  Gavel,
  ArrowForward,
  Radar as RadarIcon,
} from '@mui/icons-material'
import OnboardingWizard from '@/components/radar/OnboardingWizard'
import { useOnboarding } from '@/lib/hooks/useOnboarding'
import { apiFetch } from '@/lib/utils/api'
import { ErrorBoundary } from '@/components/error-boundary/ErrorBoundary'

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

  const { isOnboarded, radarActivated, isLoading } = useOnboarding(orgId)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [shouldRefreshStatus, setShouldRefreshStatus] = useState(false)

  // Show onboarding wizard if not completed
  useEffect(() => {
    if (!isLoading && !isOnboarded && orgId) {
      setShowOnboarding(true)
    }
  }, [isLoading, isOnboarded, orgId])

  // Refresh radar status after onboarding completes
  useEffect(() => {
    if (shouldRefreshStatus && orgId) {
      // Trigger status refresh by re-fetching
      const refreshStatus = async () => {
        try {
          const response = await apiFetch(`/organizations/${orgId}/radar-status`)
          if (response.ok) {
            const data = await response.json()
            setShouldRefreshStatus(false)
          }
        } catch (error) {
          console.error('Failed to refresh status:', error)
        }
      }
      refreshStatus()
    }
  }, [shouldRefreshStatus, orgId])

  // Handle onboarding completion
  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
    setShouldRefreshStatus(true)
    // Instead of reloading, we trigger a status refresh
  }

  const radarTypes = [
    {
      id: 'tech',
      title: '技术雷达',
      icon: <TrendingUp />,
      description: '基于薄弱项推送技术趋势，包含ROI分析、优先级排序和供应商推荐',
      route: `/radar/tech${orgId ? `?orgId=${orgId}` : ''}`,
      color: '#2196F3',
    },
    {
      id: 'industry',
      title: '行业雷达',
      icon: <Business />,
      description: '同业标杆学习，推送技术实践案例、招聘信息和机构动态',
      route: `/radar/industry${orgId ? `?orgId=${orgId}` : ''}`,
      color: '#FF9800',
    },
    {
      id: 'compliance',
      title: '合规雷达',
      icon: <Gavel />,
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

      <Container sx={{ maxWidth: 1400, px: 3, py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom>
            <RadarIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Radar Service
          </Typography>
          <Typography variant="body1" color="text.secondary">
            智能推送技术趋势、行业标杆和合规预警，帮助您做出技术投资决策
          </Typography>

          {/* Radar activation status badge */}
          {orgId && !isLoading && (
            <Box sx={{ mt: 2 }}>
              <Button
                size="small"
                variant={radarActivated ? 'contained' : 'outlined'}
                color={radarActivated ? 'success' : 'default'}
                onClick={() => setShowOnboarding(true)}
              >
                {radarActivated ? '✓ Radar已激活' : '激活Radar Service'}
              </Button>
            </Box>
          )}
        </Box>

        {/* Radar Type Cards - 使用CSS Grid保持与旧版首页一致 */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            lg: 'repeat(3, 1fr)',
          },
          gap: 3,
        }}>
          {radarTypes.map((radar) => (
            <Box key={radar.id} sx={{ display: 'flex' }}>
              <Card
                sx={{
                  height: '100%',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Box sx={{
                      p: 1,
                      borderRadius: 1,
                      bgcolor: `${radar.color}.light`,
                      color: `${radar.color}.dark`,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 48,
                      height: 48,
                    }}>
                      {radar.icon}
                    </Box>
                    <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>{radar.title}</Typography>
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2, lineHeight: 1.4 }}>
                    {radar.description}
                  </Typography>
                </CardContent>

                <Divider />

                <Box sx={{ p: 2 }}>
                  <Button
                    variant="outlined"
                    fullWidth
                    endIcon={<ArrowForward />}
                    onClick={() => router.push(radar.route)}
                  >
                    进入雷达
                  </Button>
                </Box>
              </Card>
            </Box>
          ))}
        </Box>

        {/* Info Box */}
        <Box sx={{ mt: 4 }}>
          <Card sx={{ bgcolor: 'info.light', color: 'info.contrastText' }}>
            <CardContent>
              <Typography variant="body2">
                <strong>💡 提示：</strong>
                Radar Service会根据您的评估结果自动识别薄弱项，并推送相关内容。
                {orgId ? (
                  <>
                    您的组织ID: <code>{orgId}</code>
                  </>
                ) : (
                  '请先选择组织。'
                )}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Container>
    </>
  )
}

// Loading fallback for Suspense
function RadarDashboardFallback() {
  return (
    <Box sx={{ maxWidth: 1400, margin: '0 auto', px: 3, py: 4 }}>
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
