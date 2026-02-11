'use client'

import React, { useState, useEffect } from 'react'
import { Container, Box, AppBar, Toolbar, Typography, Breadcrumbs, Link, IconButton, Divider } from '@mui/material'
import { ArrowBack, Home, Dashboard } from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { ProjectProvider, useProject } from '@/lib/contexts/ProjectContext'
import StepsTabNavigator, { DEFAULT_STEPS, Step } from '@/components/projects/StepsTabNavigator'

function ProjectWorkbenchContent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { project, loading } = useProject()
  const [steps, setSteps] = useState<Step[]>([])

  useEffect(() => {
    if (project) {
      // TODO: 根据项目的任务状态更新步骤状态
      const stepsWithRoutes = DEFAULT_STEPS.map((step) => ({
        ...step,
        route: `/projects/${project.id}/${step.id}`,
      }))
      setSteps(stepsWithRoutes)
    }
  }, [project])

  if (loading || !project) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Typography>加载中...</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* 顶部导航栏 */}
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Container maxWidth="xl">
          <Toolbar variant="dense" sx={{ gap: 2 }}>
            <IconButton edge="start" onClick={() => router.push('/projects')}>
              <ArrowBack />
            </IconButton>

            <Breadcrumbs aria-label="breadcrumb">
              <Link underline="hover" color="inherit" href="/dashboard" display="flex" alignItems="center" gap={0.5}>
                <Dashboard fontSize="inherit" />
                工作台
              </Link>
              <Link underline="hover" color="inherit" href="/projects" display="flex" alignItems="center" gap={0.5}>
                <Home fontSize="inherit" />
                项目列表
              </Link>
              <Typography color="text.primary">{project.name}</Typography>
            </Breadcrumbs>

            <Box sx={{ flexGrow: 1 }} />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                客户: {project.clientName || '-'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                标准: {project.standardName || '-'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                进度: {project.progress}%
              </Typography>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      {/* 步骤导航 */}
      <Container maxWidth="xl" sx={{ mt: 3 }}>
        <StepsTabNavigator projectId={project.id} steps={steps} />
      </Container>

      {/* 主内容区 */}
      <Container maxWidth="xl" sx={{ flexGrow: 1, py: 3 }}>
        {children}
      </Container>
    </Box>
  )
}

export default function ProjectWorkbenchLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProjectProvider>
      <ProjectWorkbenchContent>{children}</ProjectWorkbenchContent>
    </ProjectProvider>
  )
}
