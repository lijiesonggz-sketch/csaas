'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import ProjectListShadcn from '@/components/projects/ProjectListShadcn'
import { Project } from '@/lib/api/projects'

export default function ProjectsPage() {
  const router = useRouter()

  const handleProjectClick = (project: Project) => {
    router.push(`/projects/${project.id}`)
  }

  return <ProjectListShadcn onProjectClick={handleProjectClick} />
}
