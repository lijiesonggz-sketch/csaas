'use client'

import React, { useState, useEffect } from 'react'
import { Project } from '@/lib/api/projects'
import { apiFetch } from '@/lib/utils/api'
import ProjectCard from './ProjectCard'
import CreateProjectDialog from './CreateProjectDialog'
import {
  Add,
  AutoAwesome,
  ArrowBack,
  ViewKanban,
} from '@mui/icons-material'
import {
  Container,
  Grid,
  Box,
  CircularProgress,
  Typography,
  Button,
  Alert,
  Grid2,
} from '@mui/material'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/mui/PageHeader'
import PrimaryButton from '@/components/ui/mui/PrimaryButton'
import ContentCard from '@/components/ui/mui/ContentCard'
import EmptyState from '@/components/ui/mui/EmptyState'

interface ProjectListProps {
  onProjectClick?: (project: Project) => void
}

export default function ProjectList({ onProjectClick }: ProjectListProps) {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const loadProjects = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiFetch('/projects')
      setProjects(data)
    } catch (err: any) {
      console.error('Failed to load projects:', err)
      setError(err.message || '加载项目列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  const handleProjectCreated = () => {
    loadProjects()
    setCreateDialogOpen(false)
  }

  const handleProjectDeleted = () => {
    loadProjects()
  }

  if (loading) {
    return (
      <main
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
        }}
        role="status"
        aria-label="加载中"
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <CircularProgress size={48} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            加载项目列表...
          </Typography>
        </Box>
      </main>
    )
  }

  if (error) {
    return (
      <main style={{ maxWidth: '1920px', margin: '0 auto', padding: '24px 48px' }} role="alert" aria-live="polite">
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            onClick={loadProjects}
            variant="outlined"
            sx={{ minWidth: 100, minHeight: 44 }}
          >
            重试
          </Button>
        </Box>
      </main>
    )
  }

  return (
    <main style={{ width: '100%', margin: '0 auto', padding: '32px 48px' }}>
      <Container maxWidth={false} disableGutters>
        {/* 头部：使用 PageHeader 组件 */}
        <PageHeader
          title="我的项目"
          description="管理您的合规咨询项目，跟踪项目进度和AI分析结果"
          icon={<ViewKanban sx={{ fontSize: 24 }} />}
          action={
            <PrimaryButton
              startIcon={<Add />}
              onClick={() => setCreateDialogOpen(true)}
            >
              创建项目
            </PrimaryButton>
          }
        />

        {/* 返回按钮 */}
        <Box sx={{ mb: 3 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => router.push('/dashboard')}
            sx={{
              color: 'text.secondary',
              minWidth: 'auto',
            }}
          >
            返回工作台
          </Button>
        </Box>

        {/* 项目列表或空状态 */}
        {projects.length === 0 ? (
          <ContentCard sx={{ py: 16, px: 6, textAlign: 'center' }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 6 }}>
              <Box
                sx={{
                  p: 4,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #eef2ff 0%, #ddd6fe 100%)',
                }}
              >
                <AutoAwesome sx={{ fontSize: 48, color: '#6366f1' }} />
              </Box>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, color: 'text.primary' }}>
              还没有任何项目
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 8 }}>
              点击上方"创建项目"按钮开始您的第一个咨询项目
            </Typography>
            <PrimaryButton
              startIcon={<Add />}
              onClick={() => setCreateDialogOpen(true)}
            >
              创建第一个项目
            </PrimaryButton>
          </ContentCard>
        ) : (
          <Grid container spacing={3} role="list" aria-label="项目列表" sx={{ width: 'calc(100% + 24px)', margin: '-12px' }}>
            {projects.map((project) => (
              <Grid
                item
                xs={12}
                sm={6}
                md={6}
                lg={4}
                xl={3}
                key={project.id}
                sx={{
                  display: 'flex',
                  padding: '12px !important',
                }}
              >
                <Box sx={{ width: '100%', minWidth: 0 }}>
                  <ProjectCard
                    project={project}
                    onClick={() => onProjectClick?.(project)}
                    onDelete={handleProjectDeleted}
                  />
                </Box>
              </Grid>
            ))}
          </Grid>
        )}

        {/* 创建项目对话框 */}
        <CreateProjectDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          onCreated={handleProjectCreated}
        />
      </Container>
    </main>
  )
}
