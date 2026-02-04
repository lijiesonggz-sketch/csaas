'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/lib/utils/api'
import { Project } from '@/lib/api/projects'

interface ProjectContextType {
  project: Project | null
  loading: boolean
  error: string | null
  refreshProject: () => Promise<void>
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const params = useParams()
  const projectId = params.projectId as string

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProject = async () => {
    if (!projectId) return

    try {
      setLoading(true)
      setError(null)
      const data = await apiFetch(`/projects/${projectId}`)
      setProject(data)
    } catch (err: any) {
      console.error('Failed to load project:', err)
      setError(err.message || '加载项目失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProject()
  }, [projectId])

  return (
    <ProjectContext.Provider
      value={{
        project,
        loading,
        error,
        refreshProject: loadProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const context = useContext(ProjectContext)
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider')
  }
  return context
}
