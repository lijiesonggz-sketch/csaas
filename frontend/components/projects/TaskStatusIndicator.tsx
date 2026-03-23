'use client'

import React from 'react'
import { StatusChip } from '@/components/ui/mui'
import type { StatusType } from '@/components/ui/mui/StatusChip'

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed'

interface TaskStatusIndicatorProps {
  status: TaskStatus
  label?: string
  showIcon?: boolean
  size?: 'sm' | 'md'
}

/**
 * TaskStatusIndicator Component
 *
 * Displays task status using the unified StatusChip component.
 * Maps task status to status badge types.
 */
export default function TaskStatusIndicator({
  status,
  label,
  showIcon = true,
  size = 'sm',
}: TaskStatusIndicatorProps) {
  const getStatusConfig = (): { status: StatusType; defaultLabel: string } => {
    switch (status) {
      case 'completed':
        return { status: 'success', defaultLabel: '已完成' }
      case 'processing':
        return { status: 'info', defaultLabel: '处理中' }
      case 'failed':
        return { status: 'error', defaultLabel: '失败' }
      case 'pending':
      default:
        return { status: 'pending', defaultLabel: '待处理' }
    }
  }

  const config = getStatusConfig()
  const displayLabel = label || config.defaultLabel

  if (!showIcon) {
    return (
      <span sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
        {displayLabel}
      </span>
    )
  }

  return (
    <StatusChip
      status={config.status}
      text={displayLabel}
      size={size}
    />
  )
}
