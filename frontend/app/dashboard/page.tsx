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

function getStatusConfig(status: string) {
  switch (status) {
    case 'completed':
      return { color: 'bg-emerald-100 text-emerald-700', label: '已完成' }
    case 'in_progress':
      return { color: 'bg-indigo-100 text-indigo-700', label: '进行中' }
    case 'pending':
      return { color: 'bg-slate-100 text-slate-700', label: '待启动' }
    default:
      return { color: 'bg-slate-100 text-slate-700', label: status }
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

  const completedCount = projects.filter((p) => p.status === 'completed').length
  const inProgressCount = projects.filter((p) => p.status === 'in_progress').length
  const pendingCount = projects.filter((p) => p.status === 'pending').length

  const stats = [
    {
      icon: Briefcase,
      value: projects.length,
      label: '总项目数',
      iconBg: 'bg-gradient-to-br from-indigo-500 to-purple-600',
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
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
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
      <div className="w-full px-6 py-8">
        {/* Header */}
        <Card className="mb-6 border-0 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <LayoutDashboard className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">工作台</h1>
                <p className="text-white/90 text-sm">
                  欢迎使用 Csaas - AI驱动的IT咨询成熟度评估平台
                </p>
              </div>
              <Button
                onClick={() => router.push('/projects/new')}
                className="bg-white text-indigo-600 hover:bg-white/90"
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
              <Card key={idx} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-14 h-14 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                      <Icon className={`w-7 h-7 ${stat.iconColor}`} />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                      <div className="text-sm text-slate-500">{stat.label}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Radar Service Section */}
        <Card className="mb-6 border-0 shadow-sm">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Radar className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-900">
                  Radar Service - 技术雷达推送
                </h2>
                <p className="text-sm text-slate-500">
                  基于您的评估结果，智能推送技术趋势、行业标杆和合规预警
                </p>
              </div>
              <button
                onClick={fetchProjects}
                disabled={loading}
                className="p-2 text-slate-400 hover:text-slate-600 disabled:opacity-50"
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
                      className="cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 border-slate-100"
                      onClick={() => router.push(`/radar?orgId=${project.organizationId}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-slate-900 truncate flex-1">
                            {project.name}
                          </h3>
                          <ArrowRight className="w-4 h-4 text-indigo-600 ml-2 flex-shrink-0" />
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge className={statusConfig.color}>
                            {statusConfig.label}
                          </Badge>
                          {project.organization && (
                            <span className="text-xs text-slate-500">
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
              <div className="text-center py-12 bg-slate-50 rounded-xl">
                <TrendingUp className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-50" />
                <p className="text-slate-600 mb-1">暂无项目</p>
                <p className="text-sm text-slate-500 mb-4">
                  创建项目后即可查看Radar推送
                </p>
                <Button
                  onClick={() => router.push('/projects/new')}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  创建第一个项目
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Quick Start */}
        <Card className="border-0 shadow-sm">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">快速开始</h2>
            <p className="text-sm text-slate-500 mb-4">
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
                  className="p-4 rounded-xl bg-slate-50 hover:bg-indigo-50 cursor-pointer transition-colors"
                  onClick={() => router.push(item.link)}
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold text-sm mb-3">
                    {item.step}
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-slate-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  )
}
