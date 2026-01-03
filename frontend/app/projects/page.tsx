'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import ProjectList from '@/components/projects/ProjectList'
import { Project } from '@/lib/api/projects'

export default function ProjectsPage() {
  const router = useRouter()

  const handleProjectClick = (project: Project) => {
    router.push(`/projects/${project.id}`)
  }

  return <ProjectList onProjectClick={handleProjectClick} />
}
