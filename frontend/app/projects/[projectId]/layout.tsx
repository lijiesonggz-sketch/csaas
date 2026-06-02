'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Home, LayoutDashboard, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { ProjectProvider, useProject } from '@/lib/contexts/ProjectContext'
import StepsTabNavigator, { DEFAULT_STEPS, Step } from '@/components/projects/StepsTabNavigator'

function ProjectWorkbenchContent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { project, loading } = useProject()
  const [steps, setSteps] = useState<Step[]>([])

  useEffect(() => {
    if (project) {
      const stepsWithRoutes = DEFAULT_STEPS.map((step) => ({
        ...step,
        route: `/projects/${project.id}/${step.id}`,
      }))
      setSteps(stepsWithRoutes)
    }
  }, [project])

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FEFDFB]">
        <p className="text-[#64748b]">加载中...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#FEFDFB]">
      {/* Top breadcrumb bar */}
      <div className="border-b border-[#E2E8F0] bg-white">
        <div className="w-full max-w-[1400px] mx-auto px-6 h-12 flex items-center gap-3">
          <button
            onClick={() => router.push('/projects')}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            aria-label="返回项目列表"
          >
            <ArrowLeft className="w-4 h-4 text-[#64748b]" />
          </button>

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm">
            <Link
              href="/dashboard"
              className="flex items-center gap-1 text-[#64748b] hover:text-[#1E3A5F] transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>工作台</span>
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8]" />
            <Link
              href="/projects"
              className="flex items-center gap-1 text-[#64748b] hover:text-[#1E3A5F] transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              <span>项目列表</span>
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span className="text-[#1E3A5F] font-medium">{project.name}</span>
          </nav>

          <div className="flex-1" />

          <div className="flex items-center gap-4 text-xs text-[#64748b]">
            <span>客户: {project.clientName || '-'}</span>
            <span className="text-[#E2E8F0]">|</span>
            <span>标准: {project.standardName || '-'}</span>
            <span className="text-[#E2E8F0]">|</span>
            <span>进度: {project.progress}%</span>
          </div>
        </div>
      </div>

      {/* Step navigation */}
      <div className="w-full max-w-[1400px] mx-auto px-6 mt-4">
        <StepsTabNavigator projectId={project.id} steps={steps} />
      </div>

      {/* Main content */}
      <div className="w-full max-w-[1400px] mx-auto px-6 py-4 flex-1">{children}</div>
    </div>
  )
}

export default function ProjectWorkbenchLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProjectProvider>
      <ProjectWorkbenchContent>{children}</ProjectWorkbenchContent>
    </ProjectProvider>
  )
}
