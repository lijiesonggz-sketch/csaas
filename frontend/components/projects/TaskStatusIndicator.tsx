'use client'

import React from 'react'
import { Box, Chip, Typography, Tooltip } from '@mui/material'
import { CheckCircle, Error, Schedule, Autorenew } from '@mui/icons-material'

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed'

interface TaskStatusIndicatorProps {
  status: TaskStatus
  label?: string
  showIcon?: boolean
  size?: 'small' | 'medium'
}

export default function TaskStatusIndicator({
  status,
  label,
  showIcon = true,
  size = 'small',
}: TaskStatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          color: 'success' as const,
          icon: <CheckCircle fontSize={size} />,
          defaultLabel: '已完成',
        }
      case 'processing':
        return {
          color: 'primary' as const,
          icon: <Autorenew fontSize={size} sx={{ animation: 'spin 1s linear infinite' }} />,
          defaultLabel: '处理中',
        }
      case 'failed':
        return {
          color: 'error' as const,
          icon: <Error fontSize={size} />,
          defaultLabel: '失败',
        }
      case 'pending':
      default:
        return {
          color: 'default' as const,
          icon: <Schedule fontSize={size} />,
          defaultLabel: '待处理',
        }
    }
  }

  const config = getStatusConfig()
  const displayLabel = label || config.defaultLabel

  if (showIcon) {
    return (
      <Tooltip title={displayLabel}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: `${config.color}.main` }}>
          {config.icon}
          <Typography variant="body2" color="text.secondary">
            {displayLabel}
          </Typography>
        </Box>
      </Tooltip>
    )
  }

  return <Chip label={displayLabel} color={config.color} size={size} icon={config.icon} />
}
