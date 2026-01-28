'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
  MenuBook,
  Speed,
  Radar,
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

  // 使用ref缓存数据，避免重复请求
  const projectCacheRef = useRef<{ projectId: string; data: Project } | null>(null)
  const tasksCacheRef = useRef<{ projectId: string; data: any[]; timestamp: number } | null>(null)
  const CACHE_DURATION = 5000 // 5秒缓存

  // 使用useCallback缓存loadProject函数
  const loadProject = useCallback(async () => {
    // 检查缓存
    if (projectCacheRef.current?.projectId === projectId) {
      console.log('✅ [ProjectPage] 使用缓存的项目数据')
      setProject(projectCacheRef.current.data)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await ProjectsAPI.getProject(projectId)
      setProject(data)
      // 缓存数据
      projectCacheRef.current = { projectId, data }
    } catch (error) {
      console.error('❌ Failed to load project:', error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // 使用useCallback缓存loadTaskStatuses函数
  const loadTaskStatuses = useCallback(async () => {
    // 检查缓存
    const now = Date.now()
    if (tasksCacheRef.current?.projectId === projectId &&
        now - tasksCacheRef.current.timestamp < CACHE_DURATION) {
      console.log('✅ [ProjectPage] 使用缓存的任务数据')
      // 从缓存数据计算状态
      computeTaskStatuses(tasksCacheRef.current.data)
      return
    }

    try {
      const tasks = await AITasksAPI.getTasksByProject(projectId)

      console.log('📊 [ProjectPage] 获取到的所有任务:', tasks.length, '个')

      // 缓存数据
      tasksCacheRef.current = { projectId, data: tasks, timestamp: now }

      // 计算状态
      computeTaskStatuses(tasks)
    } catch (error) {
      console.error('❌ Failed to load task statuses:', error)
    }
  }, [projectId])

  // 提取状态计算逻辑
  const computeTaskStatuses = useCallback((tasks: any[]) => {
    // 定义步骤ID到任务类型的映射
    const stepToTaskType: Record<string, string[]> = {
      summary: ['summary'],
      clustering: ['clustering'],
      matrix: ['matrix'],
      questionnaire: ['questionnaire', 'binary_questionnaire'],
      'gap-analysis': ['questionnaire'],
      'action-plan': ['action_plan'],
      'standard-interpretation': ['standard_interpretation', 'standard_related_search', 'standard_version_compare'],
      'quick-gap-analysis': ['quick_gap_analysis'],
    }

    // 获取每个步骤的最新任务状态
    const statuses: Record<string, 'completed' | 'processing' | 'pending' | 'failed'> = {}

    Object.entries(stepToTaskType).forEach(([stepId, taskTypes]) => {
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

    console.log('🎯 [ProjectPage] 最终状态映射:', statuses)
    setTaskStatuses(statuses)
  }, [])

  useEffect(() => {
    loadProject()
    loadTaskStatuses()
  }, [projectId, loadProject, loadTaskStatuses])

  // 使用useMemo缓存steps配置，避免每次渲染都重新创建
  const steps = useMemo(() => [
    {
      id: 'upload',
      name: '上传文档',
      icon: <CloudUpload />,
      route: `/projects/${projectId}/upload`,
      status: (() => {
        const uploadedDocs = (project?.metadata as any)?.uploadedDocuments
        return uploadedDocs && uploadedDocs.length > 0 ? 'completed' as const : 'pending' as const
      })(),
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
      id: 'standard-interpretation',
      name: '标准解读',
      icon: <MenuBook />,
      route: `/projects/${projectId}/standard-interpretation`,
      status: (taskStatuses['standard-interpretation'] || 'pending') as 'completed' | 'processing' | 'pending' | 'failed',
      description: '深度解读标准内容、搜索关联标准、版本比对',
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
      id: 'quick-gap-analysis',
      name: '超简版差距分析',
      icon: <Speed />,
      route: `/projects/${projectId}/quick-gap-analysis`,
      status: (taskStatuses['quick-gap-analysis'] || 'pending') as 'completed' | 'processing' | 'pending' | 'failed',
      description: '快速输入现状描述，AI分析差距并生成改进措施',
    },
    {
      id: 'action-plan',
      name: '改进措施',
      icon: <TaskAlt />,
      route: `/projects/${projectId}/action-plan`,
      status: (taskStatuses['action-plan'] || 'pending') as 'completed' | 'processing' | 'pending' | 'failed',
      description: '生成改进措施建议和行动计划',
    },
    {
      id: 'radar-service',
      name: 'Radar Service',
      icon: <Radar />,
      route: `/radar?orgId=${project?.organizationId}`,
      status: 'completed' as 'completed' | 'processing' | 'pending' | 'failed',
      description: '技术趋势、行业标杆、合规预警 - 智能推送',
    },
  ], [projectId, project?.metadata, taskStatuses])

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

      {/* 使用CSS Grid替代Material-UI Grid，确保等宽 */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          lg: 'repeat(3, 1fr)',
        },
        gap: 3,
        maxWidth: 1400,
        margin: '0 auto',
      }}>
        {steps.map((step, index) => (
          <Box key={step.id} sx={{ display: 'flex' }}>
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
                  <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'primary.light', color: 'primary.contrastText', flexShrink: 0 }}>
                    {step.icon}
                  </Box>
                  <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>{step.name}</Typography>
                </Box>

                <TaskStatusIndicator status={step.status} />

                <Typography variant="body2" color="text.secondary" sx={{ mt: 2, lineHeight: 1.4 }}>
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
          </Box>
        ))}
      </Box>

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
