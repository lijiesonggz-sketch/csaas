/**
 * Activity Status Badge Component
 *
 * Story 7.3: 客户管理与流失风险预警
 *
 * 显示客户活跃度状态徽章
 */

import React from 'react'
import { Chip, Tooltip, Box, Typography } from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material'
import {
  ActivityStatus,
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_STATUS_COLORS,
} from '@/lib/api/clients-activity'

interface ActivityStatusBadgeProps {
  status: ActivityStatus
  rate?: number
  showIcon?: boolean
  size?: 'small' | 'medium'
}

const STATUS_ICONS: Record<ActivityStatus, React.ReactNode> = {
  [ActivityStatus.HIGH_ACTIVE]: <CheckCircleIcon fontSize="small" />,
  [ActivityStatus.MEDIUM_ACTIVE]: <WarningIcon fontSize="small" />,
  [ActivityStatus.LOW_ACTIVE]: <ErrorIcon fontSize="small" />,
  [ActivityStatus.CHURN_RISK]: <TrendingDownIcon fontSize="small" />,
}

const STATUS_TOOLTIPS: Record<ActivityStatus, string> = {
  [ActivityStatus.HIGH_ACTIVE]: '月活率 > 85%，客户活跃度高',
  [ActivityStatus.MEDIUM_ACTIVE]: '月活率 60-85%，客户活跃度正常',
  [ActivityStatus.LOW_ACTIVE]: '月活率 < 60%，需要关注',
  [ActivityStatus.CHURN_RISK]: '月活率 < 60%，有流失风险，建议立即干预',
}

export function ActivityStatusBadge({
  status,
  rate,
  showIcon = true,
  size = 'small',
}: ActivityStatusBadgeProps) {
  const icon = STATUS_ICONS[status]
  const label = ACTIVITY_STATUS_LABELS[status]
  const color = ACTIVITY_STATUS_COLORS[status]
  const tooltip = STATUS_TOOLTIPS[status]

  const displayLabel = rate !== undefined ? `${label} (${rate.toFixed(1)}%)` : label

  return (
    <Tooltip title={tooltip} arrow>
      <Chip
        icon={showIcon ? icon : undefined}
        label={displayLabel}
        color={color}
        size={size}
        variant={status === ActivityStatus.CHURN_RISK ? 'filled' : 'outlined'}
        sx={{
          fontWeight: status === ActivityStatus.CHURN_RISK ? 'bold' : 'normal',
          animation: status === ActivityStatus.CHURN_RISK ? 'pulse 2s infinite' : 'none',
          '@keyframes pulse': {
            '0%': {
              boxShadow: '0 0 0 0 rgba(244, 67, 54, 0.4)',
            },
            '70%': {
              boxShadow: '0 0 0 6px rgba(244, 67, 54, 0)',
            },
            '100%': {
              boxShadow: '0 0 0 0 rgba(244, 67, 54, 0)',
            },
          },
        }}
      />
    </Tooltip>
  )
}

interface ActivityRateDisplayProps {
  rate: number
  showStatus?: boolean
}

export function ActivityRateDisplay({ rate, showStatus = true }: ActivityRateDisplayProps) {
  let status: ActivityStatus
  if (rate > 85) {
    status = ActivityStatus.HIGH_ACTIVE
  } else if (rate >= 60) {
    status = ActivityStatus.MEDIUM_ACTIVE
  } else {
    status = ActivityStatus.CHURN_RISK
  }

  const color = ACTIVITY_STATUS_COLORS[status]

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 'bold',
          color: `${color}.main`,
        }}
      >
        {rate.toFixed(1)}%
      </Typography>
      {showStatus && <ActivityStatusBadge status={status} size="small" showIcon={false} />}
    </Box>
  )
}
