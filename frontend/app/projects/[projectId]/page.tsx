'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  CloudUpload,
  FileText,
  Layers,
  Grid3X3,
  ClipboardList,
  ShieldCheck,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  BookOpen,
  Zap,
  Radar,
  FolderOpen,
  ArrowLeft,
  Building2,
  FileSearch,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { apiFetch } from '@/lib/utils/api'
import { AITasksAPI } from '@/lib/api/ai-tasks'
import { Project } from '@/lib/api/projects'
import { cn } from '@/lib/utils'

export default function ProjectWorkbenchPage() {
  const router = useRouter()
  const params = useParams<{ projectId: string }>()
  const projectId = params?.projectId ?? ''

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [taskStatuses, setTaskStatuses] = useState<
    Record<string, 'completed' | 'processing' | 'pending' | 'failed'>
  >({})

  const projectCacheRef = useRef<{ projectId: string; data: Project } | null>(null)
  const tasksCacheRef = useRef<{ projectId: string; data: any[]; timestamp: number } | null>(null)
  const CACHE_DURATION = 5000

  const loadProject = useCallback(async () => {
    if (projectCacheRef.current?.projectId === projectId) {
      setProject(projectCacheRef.current.data)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await apiFetch(`/projects/${projectId}`)
      setProject(data)
      projectCacheRef.current = { projectId, data }
    } catch (error) {
      console.error('❌ Failed to load project:', error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const loadTaskStatuses = useCallback(async () => {
    const now = Date.now()
    if (
      tasksCacheRef.current?.projectId === projectId &&
      now - tasksCacheRef.current.timestamp < CACHE_DURATION
    ) {
      computeTaskStatuses(tasksCacheRef.current.data)
      return
    }

    try {
      const tasks = await AITasksAPI.getTasksByProject(projectId)
      tasksCacheRef.current = { projectId, data: tasks, timestamp: now }
      computeTaskStatuses(tasks)
    } catch (error) {
      console.error('❌ Failed to load task statuses:', error)
    }
  }, [projectId])

  const computeTaskStatuses = useCallback((tasks: any[]) => {
    const stepToTaskType: Record<string, string[]> = {
      summary: ['summary'],
      clustering: ['clustering'],
      matrix: ['matrix'],
      questionnaire: ['questionnaire', 'binary_questionnaire'],
      'gap-analysis': ['questionnaire'],
      'action-plan': ['action_plan'],
      'standard-interpretation': [
        'standard_interpretation',
        'standard_related_search',
        'standard_version_compare',
      ],
      'quick-gap-analysis': ['quick_gap_analysis'],
    }

    const statuses: Record<string, 'completed' | 'processing' | 'pending' | 'failed'> = {}

    Object.entries(stepToTaskType).forEach(([stepId, taskTypes]) => {
      const relatedTasks = tasks.filter((task) => taskTypes.includes(task.type))

      if (relatedTasks.length === 0) {
        statuses[stepId] = 'pending'
        return
      }

      const latestTask = relatedTasks.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0]

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
  }, [])

  useEffect(() => {
    loadProject()
    loadTaskStatuses()
  }, [projectId, loadProject, loadTaskStatuses])

  const steps = useMemo(
    () => [
      {
        id: 'upload',
        name: '上传文档',
        icon: CloudUpload,
        route: `/projects/${projectId}/upload`,
        status: (() => {
          const uploadedDocs = (project?.metadata as any)?.uploadedDocuments
          return uploadedDocs && uploadedDocs.length > 0
            ? ('completed' as const)
            : ('pending' as const)
        })(),
        description: '上传合规文档，支持PDF、Word、Excel等格式',
      },
      {
        id: 'summary',
        name: '综述生成',
        icon: FileText,
        route: `/projects/${projectId}/summary`,
        status: (taskStatuses['summary'] || 'pending') as
          | 'completed'
          | 'processing'
          | 'pending'
          | 'failed',
        description: 'AI自动生成文档综述，提取关键信息',
      },
      {
        id: 'clustering',
        name: '聚类分析',
        icon: Layers,
        route: `/projects/${projectId}/clustering`,
        status: (taskStatuses['clustering'] || 'pending') as
          | 'completed'
          | 'processing'
          | 'pending'
          | 'failed',
        description: '智能聚类分析，发现文档主题',
      },
      {
        id: 'standard-interpretation',
        name: '标准解读',
        icon: BookOpen,
        route: `/projects/${projectId}/standard-interpretation`,
        status: (taskStatuses['standard-interpretation'] || 'pending') as
          | 'completed'
          | 'processing'
          | 'pending'
          | 'failed',
        description: '深度解读标准内容、搜索关联标准、版本比对',
      },
      {
        id: 'review',
        name: '审核工作台',
        icon: ShieldCheck,
        route: `/projects/${projectId}/review`,
        status: (() => {
          const reviewableStepIds = [
            'summary',
            'clustering',
            'matrix',
            'questionnaire',
            'action-plan',
            'standard-interpretation',
            'quick-gap-analysis',
          ]

          const hasReviewableOutput = reviewableStepIds.some((stepId) => {
            const status = taskStatuses[stepId]
            return status === 'completed' || status === 'processing'
          })

          return hasReviewableOutput ? ('processing' as const) : ('pending' as const)
        })(),
        description: '统一处理 accept / modify / reject / rerun，集中查看待审结果',
      },
      {
        id: 'matrix',
        name: '成熟度矩阵',
        icon: Grid3X3,
        route: `/projects/${projectId}/matrix`,
        status: (taskStatuses['matrix'] || 'pending') as
          | 'completed'
          | 'processing'
          | 'pending'
          | 'failed',
        description: '生成成熟度评估矩阵，可视化分析结果',
      },
      {
        id: 'questionnaire',
        name: '问卷生成',
        icon: ClipboardList,
        route: `/projects/${projectId}/questionnaire`,
        status: (taskStatuses['questionnaire'] || 'pending') as
          | 'completed'
          | 'processing'
          | 'pending'
          | 'failed',
        description: '自动生成调研问卷，支持导出和分享',
      },
      {
        id: 'gap-analysis',
        name: '差距分析',
        icon: TrendingUp,
        route: `/projects/${projectId}/gap-analysis`,
        status: (taskStatuses['gap-analysis'] || 'pending') as
          | 'completed'
          | 'processing'
          | 'pending'
          | 'failed',
        description: '填写问卷并生成差距分析报告',
      },
      {
        id: 'quick-gap-analysis',
        name: '超简版差距分析',
        icon: Zap,
        route: `/projects/${projectId}/quick-gap-analysis`,
        status: (taskStatuses['quick-gap-analysis'] || 'pending') as
          | 'completed'
          | 'processing'
          | 'pending'
          | 'failed',
        description: '快速输入现状描述，AI分析差距并生成改进措施',
      },
      {
        id: 'action-plan',
        name: '改进措施',
        icon: CheckCircle,
        route: `/projects/${projectId}/action-plan`,
        status: (taskStatuses['action-plan'] || 'pending') as
          | 'completed'
          | 'processing'
          | 'pending'
          | 'failed',
        description: '生成改进措施建议和行动计划',
      },
      {
        id: 'radar-service',
        name: 'Radar Service',
        icon: Radar,
        route: `/radar?orgId=${project?.organizationId}`,
        status: 'completed' as 'completed' | 'processing' | 'pending' | 'failed',
        description: '技术趋势、行业标杆、合规预警 - 智能推送',
      },
    ],
    [projectId, project?.metadata, taskStatuses]
  )

  const getProjectStatusConfig = (status: string | undefined) => {
    switch (status) {
      case 'COMPLETED':
        return {
          variant: 'default' as const,
          text: '已完成',
          className: 'bg-[#059669] text-white hover:bg-[#047857]',
        }
      case 'ACTIVE':
        return {
          variant: 'default' as const,
          text: '进行中',
          className: 'bg-blue-600 text-white hover:bg-blue-700',
        }
      case 'DRAFT':
        return {
          variant: 'secondary' as const,
          text: '草稿',
          className: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
        }
      case 'ARCHIVED':
        return {
          variant: 'outline' as const,
          text: '已归档',
          className: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200',
        }
      default:
        return { variant: 'secondary' as const, text: status || '未知', className: '' }
    }
  }

  const projectStatusConfig = getProjectStatusConfig(project?.status)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-[#059669] text-white hover:bg-[#047857] rounded-sm">已完成</Badge>
        )
      case 'processing':
        return (
          <Badge className="bg-blue-600 text-white hover:bg-blue-700 animate-pulse rounded-sm">
            进行中
          </Badge>
        )
      case 'failed':
        return <Badge className="bg-red-600 text-white hover:bg-red-700 rounded-sm">失败</Badge>
      default:
        return (
          <Badge variant="outline" className="rounded-sm">
            待开始
          </Badge>
        )
    }
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#E2E8F0] border-t-[#1E3A5F] rounded-full animate-spin" />
          <p className="text-[#94A3B8]">加载中...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="w-full px-6 py-8">
      {/* 页面头部 */}
      <div className="bg-[#1E3A5F] rounded-sm p-8 mb-8 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-sm">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-[var(--font-plus-jakarta)]">
                {project?.name || '项目详情'}
              </h1>
              <p className="text-white/80 mt-1 font-[var(--font-inter)]">
                {project?.description || '管理项目功能模块，跟踪AI分析进度'}
              </p>
            </div>
          </div>
          <Button
            onClick={() => router.push('/projects')}
            className="bg-white text-[#1E3A5F] hover:bg-white/90 rounded-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回项目列表
          </Button>
        </div>
      </div>

      {project?.organizationId && (
        <Card className="mb-8 border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">KG 准备入口</h2>
                <p className="text-sm text-slate-500 mt-1">
                  先完成机构画像，再查看适用控制点结果，随后进入项目问卷流程。
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/organizations/${project.organizationId}/profile`)}
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  机构画像
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    router.push(`/organizations/${project.organizationId}/applicable-controls`)
                  }
                >
                  <FileSearch className="w-4 h-4 mr-2" />
                  适用控制点
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 功能模块网格 - 流体布局 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold font-[var(--font-plus-jakarta)] text-[#1E3A5F] mb-4">
          功能模块
        </h2>
        <div
          role="list"
          aria-label="功能模块"
          className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
        >
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <Card
                key={step.id}
                className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 border-t-4 border-t-[#1E3A5F] h-full flex flex-col"
                onClick={() => router.push(step.route)}
                role="link"
                aria-label={`${step.name} - ${step.description}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-sm bg-slate-100">
                      <Icon className="w-5 h-5 text-[#1E3A5F]" />
                    </div>
                    <h3 className="font-semibold text-[#1E3A5F]">{step.name}</h3>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col gap-4">
                  <div>{getStatusBadge(step.status)}</div>

                  <p className="text-sm text-[#94A3B8] flex-1">{step.description}</p>

                  <div className="pt-3 border-t border-[#E2E8F0]">
                    <Button
                      className="w-full bg-[#1E3A5F] hover:bg-[#152a47] rounded-sm"
                      onClick={() => router.push(step.route)}
                    >
                      {index === 0 ? '开始' : step.status === 'completed' ? '查看' : '进入'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* 项目信息 */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">项目详情</h2>
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[#94A3B8] text-sm">项目状态</span>
              <Badge
                variant={projectStatusConfig.variant}
                className={projectStatusConfig.className}
              >
                {projectStatusConfig.text}
              </Badge>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[#94A3B8] text-sm">客户名称</span>
              <span className="font-medium text-[#1E3A5F]">{project?.clientName || '-'}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[#94A3B8] text-sm">合规标准</span>
              <span className="font-medium text-[#1E3A5F]">{project?.standardName || '-'}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[#94A3B8] text-sm">完成进度</span>
              <div className="flex items-center gap-3">
                <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1E3A5F] transition-all duration-500"
                    style={{ width: `${project?.progress || 0}%` }}
                  />
                </div>
                <span className="font-medium text-[#1E3A5F] text-sm">{project?.progress}%</span>
              </div>
            </div>

            <div className="border-t border-[#E2E8F0] pt-4">
              <div className="flex justify-between items-center">
                <span className="text-[#94A3B8] text-sm">创建时间</span>
                <span className="text-[#94A3B8] text-sm">
                  {project?.createdAt ? new Date(project.createdAt).toLocaleString('zh-CN') : '-'}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[#94A3B8] text-sm">最后更新</span>
              <span className="text-[#94A3B8] text-sm">
                {project?.updatedAt ? new Date(project.updatedAt).toLocaleString('zh-CN') : '-'}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </main>
  )
}
