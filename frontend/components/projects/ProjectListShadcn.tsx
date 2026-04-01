'use client'

import React, { useState, useEffect } from 'react'
import { Project } from '@/lib/api/projects'
import { apiFetch } from '@/lib/utils/api'
import ProjectCardShadcn from './ProjectCardShadcn'
import CreateProjectDialog from './CreateProjectDialog'
import { Button } from '@/components/ui/button'
import { Plus, LayoutGrid, ArrowLeft, Sparkles } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

interface ProjectListProps {
  onProjectClick?: (project: Project) => void
}

export default function ProjectListShadcn({ onProjectClick }: ProjectListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const shouldOpenCreateDialog = searchParams?.get('create') === '1'

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

  useEffect(() => {
    if (shouldOpenCreateDialog) {
      setCreateDialogOpen(true)
    }
  }, [shouldOpenCreateDialog])

  const handleProjectCreated = () => {
    loadProjects()
    setCreateDialogOpen(false)
    if (shouldOpenCreateDialog) {
      router.replace('/projects')
    }
  }

  const handleProjectDeleted = () => {
    loadProjects()
  }

  const handleCreateDialogClose = () => {
    setCreateDialogOpen(false)
    if (shouldOpenCreateDialog) {
      router.replace('/projects')
    }
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-[400px] bg-[#FEFDFB]" role="status" aria-label="加载中">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#E2E8F0] border-t-[#1E3A5F] rounded-full animate-spin" />
          <p className="text-[#94A3B8]">加载项目列表...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="max-w-[1920px] mx-auto px-6 py-6 bg-[#FEFDFB]" role="alert" aria-live="polite">
        <div className="bg-red-50 border border-red-200 rounded-sm p-4 mb-4">
          <p className="text-red-600">{error}</p>
        </div>
        <div className="flex justify-center">
          <Button onClick={loadProjects} variant="outline" className="rounded-sm">
            重试
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="w-full px-6 py-8 bg-[#FEFDFB] min-h-screen">
      {/* 页面头部 */}
      <div className="bg-[#1E3A5F] rounded-sm p-8 mb-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-sm">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-[var(--font-plus-jakarta)]">我的项目</h1>
              <p className="text-white/80 mt-1 font-[var(--font-inter)]">管理您的合规咨询项目，跟踪项目进度和AI分析结果</p>
            </div>
          </div>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="bg-white text-[#1E3A5F] hover:bg-white/90 shadow-sm rounded-sm"
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
          className="text-[#94A3B8] hover:text-[#1E3A5F]"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回工作台
        </Button>
      </div>

      {/* 项目列表或空状态 */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="p-6 rounded-full bg-emerald-50 mb-6 border border-[#E2E8F0]">
            <Sparkles className="w-12 h-12 text-[#059669]" />
          </div>
          <h2 className="text-xl font-semibold text-[#1E3A5F] mb-2 font-[var(--font-plus-jakarta)]">还没有任何项目</h2>
          <p className="text-[#94A3B8] mb-8 font-[var(--font-inter)]">点击上方"创建项目"按钮开始您的第一个咨询项目</p>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="bg-[#1E3A5F] hover:bg-[#162e4d] text-white rounded-sm"
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
        onClose={handleCreateDialogClose}
        onCreated={handleProjectCreated}
      />
    </main>
  )
}
