'use client'

import React, { useState } from 'react'
import { Project } from '@/lib/api/projects'
import {
  ViewKanban,
  Business,
  VerifiedUser,
  TrendingUp,
  CalendarToday,
  Delete,
} from '@mui/icons-material'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  LinearProgress,
} from '@mui/material'
import { apiFetch } from '@/lib/utils/api'
import { message } from '@/lib/message'
import { formatChinaDate } from '@/lib/utils/dateTime'
import ContentCard from '@/components/ui/mui/ContentCard'
import StatusChip from '@/components/ui/mui/StatusChip'

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
        sx={{
          cursor: 'pointer',
          height: '100%',
          minHeight: '320px',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            transform: 'translateY(-2px)',
          },
        }}
        onClick={handleCardClick}
        role="button"
        aria-label={`项目: ${project.name}`}
      >
        {/* 顶部渐变彩色条 */}
        <Box
          sx={{
            height: '6px',
            width: '100%',
            background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)',
          }}
        />

        <Box sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* 头部：标题 + 状态 + 删除按钮 */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  background: 'linear-gradient(135deg, #eef2ff 0%, #ddd6fe 100%)',
                }}
              >
                <ViewKanban sx={{ fontSize: 20, color: '#6366f1' }} />
              </Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  color: 'text.primary',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {project.name}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StatusChip statusType={statusConfig.status} label={statusConfig.text} size="small" />

              <IconButton
                data-delete-button="true"
                sx={{ color: 'text.secondary' }}
                title="删除项目"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Delete sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Box>

          {/* 描述 */}
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mb: 3,
              height: '40px',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {project.description || '\u00A0'}
          </Typography>

          {/* 信息列表 */}
          <Box sx={{ mb: 3, flex: 1 }}>
            {project.clientName && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Business sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {project.clientName}
                </Typography>
              </Box>
            )}

            {project.standardName && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <VerifiedUser sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {project.standardName}
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <TrendingUp sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  进度
                </Typography>
                <Box sx={{ flex: 1, maxWidth: '120px', height: '8px', bgcolor: '#e5e7eb', borderRadius: 1, overflow: 'hidden' }}>
                  <Box
                    sx={{
                      height: '100%',
                      background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)',
                      transition: 'all 0.5s ease',
                      width: `${project.progress}%`,
                    }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 500, ml: 0.5 }}>
                  {project.progress}%
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CalendarToday sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {formatChinaDate(project.createdAt)}
              </Typography>
            </Box>
          </Box>

          {/* 底部：操作提示 */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 2, borderTop: '1px solid #e5e7eb' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              点击查看详情
            </Typography>
          </Box>
        </Box>
      </ContentCard>

      {/* 删除确认对话框 */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>删除项目</DialogTitle>
        <DialogContent>
          <DialogContentText>
            确定要删除这个项目吗？删除后无法恢复。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            取消
          </Button>
          <Button onClick={handleDelete} color="error" disabled={deleting}>
            {deleting ? '删除中...' : '确定'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
