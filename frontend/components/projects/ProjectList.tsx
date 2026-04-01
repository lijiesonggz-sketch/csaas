'use client'

import React, { useState, useEffect } from 'react'
import { Project } from '@/lib/api/projects'
import { apiFetch } from '@/lib/utils/api'
import ProjectCard from './ProjectCard'
import CreateProjectDialog from './CreateProjectDialog'
import {
  Sparkles,
  ArrowLeft,
  LayoutDashboard,
  Plus,
  Loader2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { ContentCard } from '@/components/ui/content-card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

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
    } catch (err) {
      console.error('Failed to load projects:', err)
      setError(err instanceof Error ? err.message : '加载项目列表失败')
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
        className="flex items-center justify-center min-h-[400px]"
        role="status"
        aria-label="加载中"
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-[#1E3A5F]" />
          <p className="text-sm text-[#64748B]">
            加载项目列表...
          </p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="max-w-[1920px] mx-auto px-12 py-6" role="alert" aria-live="polite">
        <Alert variant="destructive" className="mb-4 border-[#FECACA] bg-[#FEF2F2]">
          <AlertCircle className="h-4 w-4 text-[#DC2626]" />
          <AlertDescription className="text-[#991B1B]">
            {error}
          </AlertDescription>
        </Alert>
        <div className="flex justify-center">
          <Button
            onClick={loadProjects}
            variant="outline"
            className="min-w-[100px] h-11 border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]"
          >
            重试
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="w-full px-12 py-8">
      {/* 头部：使用 PageHeader 组件 */}
      <PageHeader
        title="我的项目"
        description="管理您的合规咨询项目，跟踪项目进度和AI分析结果"
        icon={<LayoutDashboard className="h-6 w-6" />}
        action={
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="bg-gradient-to-r from-[#1E3A5F] to-[#059669] text-white hover:shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            创建项目
          </Button>
        }
      />

      {/* 返回按钮 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard')}
          className="text-[#64748B] hover:text-[#1E3A5F] hover:bg-[#F1F5F9]"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回工作台
        </Button>
      </div>

      {/* 项目列表或空状态 */}
      {projects.length === 0 ? (
        <ContentCard padding="lg" className="text-center py-16">
          <div className="flex justify-center mb-8">
            <div className="p-8 rounded-full bg-gradient-to-br from-[#eef2ff] to-[#ddd6fe]">
              <Sparkles className="h-12 w-12 text-[#6366f1]" />
            </div>
          </div>
          <h3 className="text-xl font-semibold text-[#1E3A5F] mb-3">
            还没有任何项目
          </h3>
          <p className="text-sm text-[#64748B] mb-10">
            点击上方"创建项目"按钮开始您的第一个咨询项目
          </p>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="bg-gradient-to-r from-[#1E3A5F] to-[#059669] text-white hover:shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            创建第一个项目
          </Button>
        </ContentCard>
      ) : (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 -mx-3 px-3"
          role="list"
          aria-label="项目列表"
        >
          {projects.map((project) => (
            <div
              key={project.id}
              className="p-3"
            >
              <div className="w-full min-w-0">
                <ProjectCard
                  project={project}
                  onClick={() => onProjectClick?.(project)}
                  onDelete={handleProjectDeleted}
                />
              </div>
            </div>
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
