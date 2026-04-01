'use client'

import React, { useState } from 'react'
import { Project } from '@/lib/api/projects'
import {
  LayoutDashboard,
  Building2,
  ShieldCheck,
  TrendingUp,
  Calendar,
  Trash2,
} from 'lucide-react'
import { apiFetch } from '@/lib/utils/api'
import { message } from '@/lib/message'
import { formatChinaDate } from '@/lib/utils/dateTime'
import { ContentCard } from '@/components/ui/content-card'
import { StatusChip } from '@/components/ui/status-chip'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ProjectCardProps {
  project: Project
  onClick?: () => void
  onDelete?: () => void
}

export default function ProjectCard({ project, onClick, onDelete }: ProjectCardProps) {
  const [deleting, setDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const handleDelete = async () => {
    try {
      setDeleting(true)
      await apiFetch(`/projects/${project.id}`, { method: 'DELETE' })
      message.success('项目已删除')
      setDeleteDialogOpen(false)
      onDelete?.()
    } catch (error: any) {
      message.error(error.message || '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('[data-delete-button]')) {
      return
    }
    onClick?.()
  }

  const getStatusConfig = (status: string): { status: 'success' | 'info' | 'warning' | 'pending'; text: string } => {
    switch (status) {
      case 'COMPLETED':
        return { status: 'success', text: '已完成' }
      case 'ACTIVE':
        return { status: 'info', text: '进行中' }
      case 'DRAFT':
        return { status: 'pending', text: '草稿' }
      case 'ARCHIVED':
        return { status: 'warning', text: '已归档' }
      default:
        return { status: 'pending', text: status }
    }
  }

  const statusConfig = getStatusConfig(project.status)

  return (
    <>
      <ContentCard
        padding="none"
        hover
        className="cursor-pointer min-h-[320px] flex flex-col transition-all duration-200 hover:-translate-y-0.5"
        onClick={handleCardClick}
        role="button"
        aria-label={`项目: ${project.name}`}
      >
        {/* 顶部渐变彩色条 */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#6366f1] to-[#a855f7]" />

        <div className="p-4 flex-1 flex flex-col">
          {/* 头部：标题 + 状态 + 删除按钮 */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-gradient-to-br from-[#eef2ff] to-[#ddd6fe]">
                <LayoutDashboard className="h-5 w-5 text-[#6366f1]" />
              </div>
              <h3 className="font-semibold text-[#1E3A5F] truncate text-base">
                {project.name}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <StatusChip statusType={statusConfig.status} label={statusConfig.text} size="small" />

              <button
                data-delete-button="true"
                className="text-[#64748B] hover:text-[#DC2626] transition-colors p-1 rounded-sm hover:bg-[#FEE2E2]"
                title="删除项目"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 描述 */}
          <p className="text-sm text-[#64748B] mb-4 h-10 line-clamp-2">
            {project.description || '\u00A0'}
          </p>

          {/* 信息列表 */}
          <div className="mb-4 flex-1 space-y-2">
            {project.clientName && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#64748B] flex-shrink-0" />
                <p className="text-sm text-[#64748B] truncate">
                  {project.clientName}
                </p>
              </div>
            )}

            {project.standardName && (
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#64748B] flex-shrink-0" />
                <p className="text-sm text-[#64748B] truncate">
                  {project.standardName}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#64748B] flex-shrink-0" />
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm text-[#64748B]">进度</span>
                <div className="flex-1 max-w-[120px] h-2 bg-[#E5E7EB] rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#6366f1] to-[#a855f7] transition-all duration-500"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-[#1E3A5F]">
                  {project.progress}%
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#64748B] flex-shrink-0" />
              <span className="text-xs text-[#64748B]">
                {formatChinaDate(project.createdAt)}
              </span>
            </div>
          </div>

          {/* 底部：操作提示 */}
          <div className="flex items-center justify-between pt-3 border-t border-[#E5E7EB]">
            <span className="text-xs text-[#64748B]">
              点击查看详情
            </span>
          </div>
        </div>
      </ContentCard>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#1E3A5F]">
              删除项目
            </DialogTitle>
            <DialogDescription className="text-sm text-[#64748B]">
              确定要删除这个项目吗？删除后无法恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
              className="border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]"
            >
              取消
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-[#DC2626] hover:bg-[#B91C1C] text-white"
            >
              {deleting ? '删除中...' : '确定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
