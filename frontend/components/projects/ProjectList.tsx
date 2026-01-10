'use client'

import React, { useState, useEffect } from 'react'
import { ProjectsAPI, Project } from '@/lib/api/projects'
import ProjectCard from './ProjectCard'
import CreateProjectDialog from './CreateProjectDialog'
import { Plus, Sparkles } from 'lucide-react'

interface ProjectListProps {
  onProjectClick?: (project: Project) => void
}

export default function ProjectList({ onProjectClick }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const loadProjects = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await ProjectsAPI.getProjects()
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
          <div className="relative">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">加载项目列表...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="space-y-4" role="alert" aria-live="polite">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
        <div className="flex justify-center">
          <button
            onClick={loadProjects}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors min-w-[100px] min-h-[44px]"
          >
            重试
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-[1920px] mx-auto px-6 py-8">
      {/* 头部：标题 + 创建按钮 */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">我的项目</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            管理您的合规咨询项目
          </p>
        </div>
        <button
          onClick={() => setCreateDialogOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm hover:shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-w-[140px] min-h-[48px]"
        >
          <Plus className="w-5 h-5" strokeWidth={2} />
          创建项目
        </button>
      </header>

      {/* 项目列表或空状态 */}
      {projects.length === 0 ? (
        <section className="text-center py-16 px-6">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full">
              <Sparkles className="w-12 h-12 text-gray-400 dark:text-gray-500" strokeWidth={2} />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            还没有任何项目
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            点击上方"创建项目"按钮开始您的第一个咨询项目
          </p>
          <button
            onClick={() => setCreateDialogOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm hover:shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-h-[48px]"
          >
            <Plus className="w-5 h-5" strokeWidth={2} />
            创建第一个项目
          </button>
        </section>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => onProjectClick?.(project)}
              onDelete={handleProjectDeleted}
            />
          ))}
        </section>
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
