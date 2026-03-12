'use client'

import React, { useState, useEffect } from 'react'
import { Project } from '@/lib/api/projects'
import { apiFetch } from '@/lib/utils/api'
import ProjectCardShadcn from './ProjectCardShadcn'
import CreateProjectDialog from './CreateProjectDialog'
import { Button } from '@/components/ui/button'
import { Plus, LayoutGrid, ArrowLeft, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface ProjectListProps {
  onProjectClick?: (project: Project) => void
}

export default function ProjectListShadcn({ onProjectClick }: ProjectListProps) {
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
      <main className="flex items-center justify-center min-h-[400px]" role="status" aria-label="加载中">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-500">加载项目列表...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="max-w-[1920px] mx-auto px-6 py-6" role="alert" aria-live="polite">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-600">{error}</p>
        </div>
        <div className="flex justify-center">
          <Button onClick={loadProjects} variant="outline">
            重试
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="w-full px-6 py-8">
      {/* 页面头部 */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-8 mb-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">我的项目</h1>
              <p className="text-white/80 mt-1">管理您的合规咨询项目，跟踪项目进度和AI分析结果</p>
            </div>
          </div>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="bg-white text-indigo-600 hover:bg-white/90 shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            创建项目
          </Button>
        </div>
      </div>

      {/* 返回按钮 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard')}
          className="text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回工作台
        </Button>
      </div>

      {/* 项目列表或空状态 */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="p-6 rounded-full bg-gradient-to-br from-indigo-50 to-purple-50 mb-6">
            <Sparkles className="w-12 h-12 text-indigo-500" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">还没有任何项目</h2>
          <p className="text-slate-500 mb-8">点击上方"创建项目"按钮开始您的第一个咨询项目</p>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            创建第一个项目
          </Button>
        </div>
      ) : (
        /* 流体网格布局 - 自动填满所有屏幕宽度 */
        <div
          role="list"
          aria-label="项目列表"
          className={cn(
            "grid gap-6",
            /* 移动端：1列 | 小屏：2列 | 中屏：2列 | 大屏：3列 | 超大屏：4列 | 超宽屏：5列 */
            "grid-cols-1",
            "sm:grid-cols-2",
            "lg:grid-cols-3",
            "xl:grid-cols-4",
            "2xl:grid-cols-5"
          )}
        >
          {projects.map((project) => (
            <ProjectCardShadcn
              key={project.id}
              project={project}
              onClick={() => onProjectClick?.(project)}
              onDelete={handleProjectDeleted}
            />
          ))}
        </div>
      )}

      {/* 创建项目对话框 */}
      <CreateProjectDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreated={handleProjectCreated}
      />
    </main>
  )
}
