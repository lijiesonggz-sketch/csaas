'use client'

import React from 'react'
import { Project } from '@/lib/api/projects'
import {
  FolderKanban,
  Building2,
  ShieldCheck,
  TrendingUp,
  Calendar,
  MoreVertical,
} from 'lucide-react'

interface ProjectCardProps {
  project: Project
  onClick?: () => void
}

export default function ProjectCard({ project, onClick }: ProjectCardProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return {
          label: '已完成',
          bgColor: 'bg-green-100 dark:bg-green-900/30',
          textColor: 'text-green-700 dark:text-green-400',
          dotColor: 'bg-green-500',
        }
      case 'ACTIVE':
        return {
          label: '进行中',
          bgColor: 'bg-blue-100 dark:bg-blue-900/30',
          textColor: 'text-blue-700 dark:text-blue-400',
          dotColor: 'bg-blue-500',
        }
      case 'DRAFT':
        return {
          label: '草稿',
          bgColor: 'bg-gray-100 dark:bg-gray-800',
          textColor: 'text-gray-700 dark:text-gray-400',
          dotColor: 'bg-gray-500',
        }
      case 'ARCHIVED':
        return {
          label: '已归档',
          bgColor: 'bg-purple-100 dark:bg-purple-900/30',
          textColor: 'text-purple-700 dark:text-purple-400',
          dotColor: 'bg-purple-500',
        }
      default:
        return {
          label: status,
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-700',
          dotColor: 'bg-gray-500',
        }
    }
  }

  const statusConfig = getStatusConfig(project.status)

  return (
    <article
      className="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-200 cursor-pointer overflow-hidden"
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`项目: ${project.name}`}
      onKeyPress={(e) => e.key === 'Enter' && onClick?.()}
    >
      {/* 顶部彩色条 */}
      <div className={`h-1.5 w-full ${statusConfig.dotColor}`} />

      <div className="p-6">
        {/* 头部：标题 + 状态 */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`p-2.5 rounded-lg ${statusConfig.bgColor}`}>
              <FolderKanban className={`w-5 h-5 ${statusConfig.textColor}`} strokeWidth={2} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate pr-2">
              {project.name}
            </h3>
          </div>

          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor} animate-pulse`} />
            {statusConfig.label}
          </div>
        </div>

        {/* 描述 */}
        {project.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4 min-h-[40px]">
            {project.description}
          </p>
        )}

        {/* 信息列表 */}
        <div className="space-y-2.5 mb-4">
          {project.clientName && (
            <div className="flex items-center gap-2.5 text-sm">
              <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" strokeWidth={2} />
              <span className="text-gray-600 dark:text-gray-400 truncate">
                {project.clientName}
              </span>
            </div>
          )}

          {project.standardName && (
            <div className="flex items-center gap-2.5 text-sm">
              <ShieldCheck className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" strokeWidth={2} />
              <span className="text-gray-600 dark:text-gray-400 truncate">
                {project.standardName}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2.5 text-sm">
            <TrendingUp className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" strokeWidth={2} />
            <div className="flex items-center gap-2 flex-1">
              <span className="text-gray-600 dark:text-gray-400">进度</span>
              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-[120px]">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
              <span className="text-gray-900 dark:text-white font-medium text-xs">
                {project.progress}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-sm">
            <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" strokeWidth={2} />
            <span className="text-gray-500 dark:text-gray-500 text-xs">
              {new Date(project.createdAt).toLocaleDateString('zh-CN')}
            </span>
          </div>
        </div>

        {/* 底部：操作提示 */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            点击查看详情
          </span>
          <MoreVertical className="w-4 h-4 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={2} />
        </div>
      </div>
    </article>
  )
}
