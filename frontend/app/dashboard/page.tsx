'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Briefcase,
  CheckCircle,
  Clock,
  Rocket,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  Plus,
  Radar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import MainLayout from '@/components/layout/MainLayout'
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

type ProjectStatusKey = 'completed' | 'active' | 'draft' | 'archived' | 'unknown'

function normalizeProjectStatus(status: string): ProjectStatusKey {
  switch (status?.toLowerCase()) {
    case 'completed':
      return 'completed'
    case 'active':
    case 'in_progress':
      return 'active'
    case 'draft':
    case 'pending':
      return 'draft'
    case 'archived':
      return 'archived'
    default:
      return 'unknown'
  }
}

function getStatusConfig(status: string) {
  switch (normalizeProjectStatus(status)) {
    case 'completed':
      return { color: 'bg-emerald-100 text-emerald-700', label: '已完成' }
    case 'active':
      return { color: 'bg-blue-100 text-blue-700', label: '进行中' }
    case 'draft':
      return { color: 'bg-slate-100 text-slate-700', label: '待启动' }
    case 'archived':
      return { color: 'bg-amber-100 text-amber-700', label: '已归档' }
    default:
      return { color: 'bg-slate-100 text-slate-700', label: status || '未知' }
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
      const data = await apiFetch<Project[]>('/projects')
      setProjects(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch projects:', error)
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  const completedCount = projects.filter((p) => normalizeProjectStatus(p.status) === 'completed').length
  const inProgressCount = projects.filter((p) => normalizeProjectStatus(p.status) === 'active').length
  const pendingCount = projects.filter((p) => normalizeProjectStatus(p.status) === 'draft').length

  const stats = [
    {
      icon: Briefcase,
      value: projects.length,
      label: '总项目数',
      iconBg: 'bg-[#1E3A5F]',
      iconColor: 'text-white',
    },
    {
      icon: CheckCircle,
      value: completedCount,
      label: '已完成',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
    {
      icon: Clock,
      value: inProgressCount,
      label: '进行中',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-700',
    },
    {
      icon: Rocket,
      value: pendingCount,
      label: '待启动',
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-600',
    },
  ]

  return (
    <MainLayout>
      <div className="w-full px-6 py-8 bg-[#FEFDFB] min-h-screen">
        {/* Header */}
        <Card className="mb-6 border border-[#E2E8F0] shadow-sm rounded-sm overflow-hidden">
          <div className="bg-[#1E3A5F] p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-sm bg-white/10 flex items-center justify-center">
                <LayoutDashboard className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold font-[var(--font-plus-jakarta)]">工作台</h1>
                <p className="text-white/80 text-sm font-[var(--font-inter)]">
                  欢迎使用 Csaas - AI驱动的IT咨询成熟度评估平台
                </p>
              </div>
              <Button
                onClick={() => router.push('/projects/new')}
                className="bg-white text-[#1E3A5F] hover:bg-white/90 rounded-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                新建项目
              </Button>
            </div>
          </div>
        </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, idx) => {
            const Icon = stat.icon
            return (
              <Card key={idx} className="border border-[#E2E8F0] shadow-sm rounded-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-14 h-14 rounded-sm ${stat.iconBg} flex items-center justify-center`}>
                      <Icon className={`w-7 h-7 ${stat.iconColor}`} />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-[#1E3A5F]">{stat.value}</div>
                      <div className="text-sm text-[#94A3B8]">{stat.label}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Radar Service Section */}
        <Card className="mb-6 border border-[#E2E8F0] shadow-sm rounded-sm">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-sm bg-[#059669] flex items-center justify-center">
                <Radar className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
                  Radar Service - 技术雷达推送
                </h2>
                <p className="text-sm text-[#94A3B8] font-[var(--font-inter)]">
                  基于您的评估结果，智能推送技术趋势、行业标杆和合规预警
                </p>
              </div>
              <button
                onClick={fetchProjects}
                disabled={loading}
                className="p-2 text-[#94A3B8] hover:text-[#1E3A5F] disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {projects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {projects.slice(0, 6).map((project) => {
                  const statusConfig = getStatusConfig(project.status)
                  return (
                    <Card
                      key={project.id}
                      className="cursor-pointer transition-shadow hover:shadow-md border border-[#E2E8F0] rounded-sm"
                      onClick={() => router.push(`/radar?orgId=${project.organizationId}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-[#1E3A5F] truncate flex-1">
                            {project.name}
                          </h3>
                          <ArrowRight className="w-4 h-4 text-[#059669] ml-2 flex-shrink-0" />
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge className={statusConfig.color}>
                            {statusConfig.label}
                          </Badge>
                          {project.organization && (
                            <span className="text-xs text-[#94A3B8]">
                              {project.organization.name}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-[#FEFDFB] border border-[#E2E8F0] rounded-sm">
                <TrendingUp className="w-12 h-12 text-[#94A3B8] mx-auto mb-3 opacity-50" />
                <p className="text-[#1E3A5F] mb-1 font-[var(--font-plus-jakarta)]">暂无项目</p>
                <p className="text-sm text-[#94A3B8] mb-4 font-[var(--font-inter)]">
                  创建项目后即可查看Radar推送
                </p>
                <Button
                  onClick={() => router.push('/projects/new')}
                  className="bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  创建第一个项目
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Quick Start */}
        <Card className="border border-[#E2E8F0] shadow-sm rounded-sm">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-[#1E3A5F] mb-2 font-[var(--font-plus-jakarta)]">快速开始</h2>
            <p className="text-sm text-[#94A3B8] mb-4 font-[var(--font-inter)]">
              按照以下步骤开始使用 Csaas 平台
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { step: 1, title: '创建项目', desc: '设置项目基本信息', link: '/projects/new' },
                { step: 2, title: '上传文档', desc: '上传标准文档进行解读', link: '/projects' },
                { step: 3, title: '查看雷达', desc: '获取技术趋势推送', link: '/radar' },
              ].map((item) => (
                <div
                  key={item.step}
                  className="p-4 rounded-sm bg-[#FEFDFB] border border-[#E2E8F0] hover:border-[#059669] cursor-pointer transition-colors"
                  onClick={() => router.push(item.link)}
                >
                  <div className="w-8 h-8 rounded-sm bg-[#1E3A5F] text-white flex items-center justify-center font-semibold text-sm mb-3">
                    {item.step}
                  </div>
                  <h3 className="font-semibold text-[#1E3A5F] mb-1 font-[var(--font-plus-jakarta)]">{item.title}</h3>
                  <p className="text-sm text-[#94A3B8] font-[var(--font-inter)]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  )
}
