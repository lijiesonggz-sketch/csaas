'use client'

import React from 'react'
import { Project } from '@/lib/api/projects'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  ShieldCheck,
  TrendingUp,
  Calendar,
  Trash2,
  LayoutGrid
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatChinaDate } from '@/lib/utils/dateTime'

interface ProjectCardProps {
  project: Project
  onClick?: () => void
  onDelete?: () => void
}

export default function ProjectCardShadcn({ project, onClick, onDelete }: ProjectCardProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return { variant: 'default' as const, text: '已完成', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' }
      case 'ACTIVE':
        return { variant: 'default' as const, text: '进行中', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' }
      case 'DRAFT':
        return { variant: 'secondary' as const, text: '草稿', className: 'bg-slate-100 text-slate-700 hover:bg-slate-100' }
      case 'ARCHIVED':
        return { variant: 'outline' as const, text: '已归档', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200' }
      default:
        return { variant: 'secondary' as const, text: status, className: '' }
    }
  }

  const statusConfig = getStatusConfig(project.status)

  return (
    <Card
      className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 border-t-4 border-t-indigo-500 h-full flex flex-col"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 shrink-0">
              <LayoutGrid className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="font-semibold text-slate-900 truncate">
              {project.name}
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant={statusConfig.variant}
              className={cn("text-xs", statusConfig.className)}
            >
              {statusConfig.text}
            </Badge>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete?.()
              }}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
              title="删除项目"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4">
        <p className="text-sm text-slate-500 line-clamp-2 min-h-[2.5rem]">
          {project.description || '\u00A0'}
        </p>

        <div className="space-y-3 flex-1">
          {project.clientName && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">{project.clientName}</span>
            </div>
          )}

          {project.standardName && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">{project.standardName}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-slate-600">
            <TrendingUp className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-slate-500">进度</span>
            <div className="flex-1 max-w-[100px] h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                style={{ width: `${project.progress}%` }}
              />
            </div>
            <span className="text-slate-700 font-medium text-xs">{project.progress}%</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs">{formatChinaDate(project.createdAt)}</span>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-400">点击查看详情</p>
        </div>
      </CardContent>
    </Card>
  )
}
