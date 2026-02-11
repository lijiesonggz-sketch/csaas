'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MainLayout from '@/components/layout/MainLayout'
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Grid,
  Chip,
  Divider,
} from '@mui/material'
import {
  BusinessCenter,
  CheckCircle,
  Schedule,
  RocketLaunch,
  TrendingUp,
  ArrowForward,
} from '@mui/icons-material'
import { apiFetch } from '@/lib/utils/api'

interface Project {
  id: string
  name: string
  organizationId: string
  status: string
  organization?: {
    id: string
    name: string
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const response = await apiFetch('/projects?limit=10')
      if (response.ok) {
        const data = await response.json()
        setProjects(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'in_progress':
        return 'warning'
      case 'pending':
        return 'default'
      default:
        return 'default'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成'
      case 'in_progress':
        return '进行中'
      case 'pending':
        return '待启动'
      default:
        return status
    }
  }

  const completedCount = projects.filter(p => p.status === 'completed').length
  const inProgressCount = projects.filter(p => p.status === 'in_progress').length
  const pendingCount = projects.filter(p => p.status === 'pending').length

  return (
    <MainLayout>
      <Box sx={{ width: '100%', p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom>
            工作台
          </Typography>
          <Typography variant="body1" color="text.secondary">
            欢迎使用 Csaas - AI驱动的IT咨询成熟度评估平台
          </Typography>
        </Box>

        {/* Statistics Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'primary.light',
                    color: 'primary.dark',
                  }}>
                    <BusinessCenter />
                  </Box>
                  <Box>
                    <Typography variant="h4" color="primary.main">
                      {projects.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      总项目数
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'success.light',
                    color: 'success.dark',
                  }}>
                    <CheckCircle />
                  </Box>
                  <Box>
                    <Typography variant="h4" color="success.main">
                      {completedCount}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      已完成
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'warning.light',
                    color: 'warning.dark',
                  }}>
                    <Schedule />
                  </Box>
                  <Box>
                    <Typography variant="h4" color="warning.main">
                      {inProgressCount}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      进行中
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'info.light',
                    color: 'info.dark',
                  }}>
                    <RocketLaunch />
                  </Box>
                  <Box>
                    <Typography variant="h4" color="info.main">
                      {pendingCount}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      待启动
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Radar Service Entry */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: 'secondary.light',
                color: 'secondary.dark',
              }}>
                <TrendingUp />
              </Box>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6">
                  Radar Service - 技术雷达推送
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  基于您的评估结果，智能推送技术趋势、行业标杆和合规预警
                </Typography>
              </Box>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : projects.length > 0 ? (
              <Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                  选择项目查看Radar推送
                </Typography>
                <Grid container spacing={2}>
                  {projects.map((project) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={project.id}>
                      <Card
                        variant="outlined"
                        sx={{
                          transition: 'transform 0.2s, box-shadow 0.2s',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: 2,
                          },
                        }}
                      >
                        <CardContent sx={{ pb: 1 }}>
                          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                            {project.name}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                            <Chip
                              size="small"
                              label={getStatusLabel(project.status)}
                              color={getStatusColor(project.status) as any}
                            />
                            <Button
                              size="small"
                              variant="contained"
                              endIcon={<ArrowForward />}
                              onClick={() => router.push(`/radar?orgId=${project.organizationId}`)}
                            >
                              进入Radar
                            </Button>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  暂无项目，请先创建项目
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Quick Start Card */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              快速开始
            </Typography>
            <Typography variant="body2" color="text.secondary">
              从上方选择一个项目，进入Radar Service查看智能推送内容。
              Radar会根据您的评估结果自动识别薄弱项，并推送相关技术趋势、行业标杆和合规预警。
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </MainLayout>
  )
}
