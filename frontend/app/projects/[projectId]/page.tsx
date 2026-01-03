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
  TrendingUp,
} from '@mui/icons-material'
import { ProjectsAPI, Project } from '@/lib/api/projects'
import { AITasksAPI } from '@/lib/api/ai-tasks'
import TaskStatusIndicator from '@/components/projects/TaskStatusIndicator'

export default function ProjectWorkbenchPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [taskStatuses, setTaskStatuses] = useState<Record<string, 'completed' | 'processing' | 'pending' | 'failed'>>({})

  useEffect(() => {
    loadProject()
    loadTaskStatuses()
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

  const loadTaskStatuses = async () => {
    try {
      const tasks = await AITasksAPI.getTasksByProject(projectId)

      // 定义步骤ID到任务类型的映射
      const stepToTaskType: Record<string, string[]> = {
        summary: ['summary'],
        clustering: ['clustering'],
        matrix: ['matrix'],
        questionnaire: ['questionnaire'],
        'gap-analysis': ['questionnaire'], // 差距分析基于问卷任务
        'action-plan': ['action_plan'],
      }

      // 获取每个步骤的最新任务状态
      const statuses: Record<string, 'completed' | 'processing' | 'pending' | 'failed'> = {}

      Object.entries(stepToTaskType).forEach(([stepId, taskTypes]) => {
        // 找到该步骤相关的所有任务
        const relatedTasks = tasks.filter(task => taskTypes.includes(task.type))

        if (relatedTasks.length === 0) {
          statuses[stepId] = 'pending'
          return
        }

        // 按创建时间排序，获取最新任务
        const latestTask = relatedTasks.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0]

        // 根据任务状态确定步骤状态
        if (latestTask.status === 'completed') {
          statuses[stepId] = 'completed'
        } else if (latestTask.status === 'processing' || latestTask.status === 'pending') {
          statuses[stepId] = 'processing'
        } else if (latestTask.status === 'failed') {
          statuses[stepId] = 'failed'
        } else {
          statuses[stepId] = 'pending'
        }
      })

      setTaskStatuses(statuses)
    } catch (error) {
      console.error('Failed to load task statuses:', error)
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
      status: (taskStatuses['summary'] || 'pending') as 'completed' | 'processing' | 'pending' | 'failed',
      description: 'AI自动生成文档综述，提取关键信息',
    },
    {
      id: 'clustering',
      name: '聚类分析',
      icon: <Category />,
      route: `/projects/${projectId}/clustering`,
      status: (taskStatuses['clustering'] || 'pending') as 'completed' | 'processing' | 'pending' | 'failed',
      description: '智能聚类分析，发现文档主题',
    },
    {
      id: 'matrix',
      name: '成熟度矩阵',
      icon: <GridOn />,
      route: `/projects/${projectId}/matrix`,
      status: (taskStatuses['matrix'] || 'pending') as 'completed' | 'processing' | 'pending' | 'failed',
      description: '生成成熟度评估矩阵，可视化分析结果',
    },
    {
      id: 'questionnaire',
      name: '问卷生成',
      icon: <Assignment />,
      route: `/projects/${projectId}/questionnaire`,
      status: (taskStatuses['questionnaire'] || 'pending') as 'completed' | 'processing' | 'pending' | 'failed',
      description: '自动生成调研问卷，支持导出和分享',
    },
    {
      id: 'gap-analysis',
      name: '差距分析',
      icon: <TrendingUp />,
      route: `/projects/${projectId}/gap-analysis`,
      status: (taskStatuses['gap-analysis'] || 'pending') as 'completed' | 'processing' | 'pending' | 'failed',
      description: '填写问卷并生成差距分析报告',
    },
    {
      id: 'action-plan',
      name: '改进措施',
      icon: <TaskAlt />,
      route: `/projects/${projectId}/action-plan`,
      status: (taskStatuses['action-plan'] || 'pending') as 'completed' | 'processing' | 'pending' | 'failed',
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
