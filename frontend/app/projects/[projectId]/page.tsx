'use client'

import React, { useState, useEffect } from 'react'
import { Box, Grid, Card, CardContent, Typography, Button, Stack, Divider } from '@mui/material'
import { useParams, useRouter } from 'next/navigation'
import {
  CloudUpload,
  Description,
  Category,
  GridOn,
  Assignment,
  TaskAlt,
  ArrowForward,
} from '@mui/icons-material'
import { ProjectsAPI, Project } from '@/lib/api/projects'
import TaskStatusIndicator from '@/components/projects/TaskStatusIndicator'

export default function ProjectWorkbenchPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProject()
  }, [projectId])

  const loadProject = async () => {
    try {
      setLoading(true)
      const data = await ProjectsAPI.getProject(projectId)
      setProject(data)
    } catch (error) {
      console.error('Failed to load project:', error)
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    {
      id: 'upload',
      name: '上传文档',
      icon: <CloudUpload />,
      route: `/projects/${projectId}/upload`,
      status: 'pending' as const,
      description: '上传合规文档，支持PDF、Word、Excel等格式',
    },
    {
      id: 'summary',
      name: '综述生成',
      icon: <Description />,
      route: `/projects/${projectId}/summary`,
      status: 'pending' as const,
      description: 'AI自动生成文档综述，提取关键信息',
    },
    {
      id: 'clustering',
      name: '聚类分析',
      icon: <Category />,
      route: `/projects/${projectId}/clustering`,
      status: 'pending' as const,
      description: '智能聚类分析，发现文档主题',
    },
    {
      id: 'matrix',
      name: '成熟度矩阵',
      icon: <GridOn />,
      route: `/projects/${projectId}/matrix`,
      status: 'pending' as const,
      description: '生成成熟度评估矩阵，可视化分析结果',
    },
    {
      id: 'questionnaire',
      name: '问卷生成',
      icon: <Assignment />,
      route: `/projects/${projectId}/questionnaire`,
      status: 'pending' as const,
      description: '自动生成调研问卷，支持导出和分享',
    },
    {
      id: 'action-plan',
      name: '改进措施',
      icon: <TaskAlt />,
      route: `/projects/${projectId}/action-plan`,
      status: 'pending' as const,
      description: '生成改进措施建议和行动计划',
    },
  ]

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Typography>加载中...</Typography>
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          {project?.name}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {project?.description || '暂无描述'}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {steps.map((step, index) => (
          <Grid item xs={12} sm={6} md={4} key={step.id}>
            <Card
              sx={{
                height: '100%',
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
                  <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                    {step.icon}
                  </Box>
                  <Typography variant="h6">{step.name}</Typography>
                </Box>

                <TaskStatusIndicator status={step.status} />

                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  {step.description}
                </Typography>
              </CardContent>

              <Divider />

              <Box sx={{ p: 2 }}>
                <Button
                  variant="outlined"
                  fullWidth
                  endIcon={<ArrowForward />}
                  onClick={() => router.push(step.route)}
                >
                  {index === 0 ? '开始' : step.status === 'completed' ? '查看' : '进入'}
                </Button>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* 项目信息 */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          项目详情
        </Typography>
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  项目状态
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {project?.status === 'COMPLETED'
                    ? '已完成'
                    : project?.status === 'ACTIVE'
                      ? '进行中'
                      : project?.status === 'DRAFT'
                        ? '草稿'
                        : '已归档'}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  客户名称
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {project?.clientName || '-'}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  合规标准
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {project?.standardName || '-'}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  完成进度
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {project?.progress}%
                </Typography>
              </Box>

              <Divider />

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  创建时间
                </Typography>
                <Typography variant="body2">
                  {project?.createdAt ? new Date(project.createdAt).toLocaleString('zh-CN') : '-'}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  最后更新
                </Typography>
                <Typography variant="body2">
                  {project?.updatedAt ? new Date(project.updatedAt).toLocaleString('zh-CN') : '-'}
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}
