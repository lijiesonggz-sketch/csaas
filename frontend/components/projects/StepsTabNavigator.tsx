'use client'

import React, { useMemo, useCallback, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  CloudUpload,
  FileText,
  Layers,
  Grid3X3,
  ClipboardList,
  TrendingUp,
  CheckCircle,
  BookOpen,
  Zap,
  Loader2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Step {
  id: string
  name: string
  icon: React.ReactElement
  route: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

interface StepsTabNavigatorProps {
  projectId: string
  steps: Step[]
  currentStep?: string
}

export default function StepsTabNavigator({ projectId, steps, currentStep }: StepsTabNavigatorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isNavigating, setIsNavigating] = useState(false)

  const currentStepValue = useMemo(() => {
    if (currentStep) return currentStep
    const pathSegment = pathname.split('/').pop()
    const validStepIds = steps.map(s => s.id)
    return validStepIds.includes(pathSegment || '') ? pathSegment : 'upload'
  }, [currentStep, pathname, steps])

  const handleChange = useCallback((stepId: string) => {
    if (isNavigating || stepId === currentStepValue) return

    const step = steps.find((s) => s.id === stepId)
    if (step) {
      setIsNavigating(true)
      router.push(step.route)
      setTimeout(() => setIsNavigating(false), 300)
    }
  }, [steps, currentStepValue, isNavigating, router])

  const getStatusIcon = (status: Step['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
      case 'processing': return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
      case 'failed': return <X className="w-3.5 h-3.5 text-red-500" />
      default: return null
    }
  }

  return (
    <div className="border-b border-[#E2E8F0] mb-6">
      <nav className="flex gap-0.5 overflow-x-auto pb-0" role="tablist">
        {steps.map((step) => {
          const isActive = step.id === currentStepValue
          const statusIcon = getStatusIcon(step.status)

          return (
            <button
              key={step.id}
              role="tab"
              aria-selected={isActive}
              disabled={isNavigating}
              onClick={() => handleChange(step.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                isActive
                  ? 'text-[#1E3A5F] border-[#1E3A5F] bg-[#FEFDFB]'
                  : 'text-[#64748b] border-transparent hover:text-[#1E3A5F] hover:bg-gray-50',
                isNavigating && 'opacity-50 cursor-wait'
              )}
            >
              {statusIcon}
              <span className="flex items-center gap-1.5">
                {step.icon}
                {step.name}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export const DEFAULT_STEPS: Omit<Step, 'route'>[] = [
  {
    id: 'upload',
    name: '上传文档',
    icon: <CloudUpload className="w-4 h-4" />,
    status: 'pending',
  },
  {
    id: 'summary',
    name: '综述生成',
    icon: <FileText className="w-4 h-4" />,
    status: 'pending',
  },
  {
    id: 'clustering',
    name: '聚类分析',
    icon: <Layers className="w-4 h-4" />,
    status: 'pending',
  },
  {
    id: 'standard-interpretation',
    name: '标准解读',
    icon: <BookOpen className="w-4 h-4" />,
    status: 'pending',
  },
  {
    id: 'matrix',
    name: '成熟度矩阵',
    icon: <Grid3X3 className="w-4 h-4" />,
    status: 'pending',
  },
  {
    id: 'questionnaire',
    name: '问卷生成',
    icon: <ClipboardList className="w-4 h-4" />,
    status: 'pending',
  },
  {
    id: 'gap-analysis',
    name: '差距分析',
    icon: <TrendingUp className="w-4 h-4" />,
    status: 'pending',
  },
  {
    id: 'quick-gap-analysis',
    name: '超简版差距分析',
    icon: <Zap className="w-4 h-4" />,
    status: 'pending',
  },
  {
    id: 'action-plan',
    name: '改进措施',
    icon: <CheckCircle className="w-4 h-4" />,
    status: 'pending',
  },
]
