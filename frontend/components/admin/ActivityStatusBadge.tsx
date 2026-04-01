/**
 * Activity Status Badge Component
 *
 * Story 7.3: 客户管理与流失风险预警
 *
 * 显示客户活跃度状态徽章
 */

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  TrendingDown,
} from 'lucide-react'
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
  [ActivityStatus.HIGH_ACTIVE]: <CheckCircle className="h-3 w-3" />,
  [ActivityStatus.MEDIUM_ACTIVE]: <AlertTriangle className="h-3 w-3" />,
  [ActivityStatus.LOW_ACTIVE]: <XCircle className="h-3 w-3" />,
  [ActivityStatus.CHURN_RISK]: <TrendingDown className="h-3 w-3" />,
}

const STATUS_TOOLTIPS: Record<ActivityStatus, string> = {
  [ActivityStatus.HIGH_ACTIVE]: '月活率 > 85%，客户活跃度高',
  [ActivityStatus.MEDIUM_ACTIVE]: '月活率 60-85%，客户活跃度正常',
  [ActivityStatus.LOW_ACTIVE]: '月活率 < 60%，需要关注',
  [ActivityStatus.CHURN_RISK]: '月活率 < 60%，有流失风险，建议立即干预',
}

const STATUS_VARIANTS: Record<ActivityStatus, 'default' | 'destructive' | 'outline' | 'secondary'> = {
  [ActivityStatus.HIGH_ACTIVE]: 'default',
  [ActivityStatus.MEDIUM_ACTIVE]: 'secondary',
  [ActivityStatus.LOW_ACTIVE]: 'outline',
  [ActivityStatus.CHURN_RISK]: 'destructive',
}

export function ActivityStatusBadge({
  status,
  rate,
  showIcon = true,
  size = 'small',
}: ActivityStatusBadgeProps) {
  const icon = STATUS_ICONS[status]
  const label = ACTIVITY_STATUS_LABELS[status]
  const tooltip = STATUS_TOOLTIPS[status]

  const displayLabel = rate !== undefined ? `${label} (${rate.toFixed(1)}%)` : label

  const isPulse = status === ActivityStatus.CHURN_RISK

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={STATUS_VARIANTS[status]}
            className={`
              ${size === 'small' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'}
              ${isPulse ? 'font-bold animate-pulse' : ''}
            `}
          >
            {showIcon && <span className="mr-1">{icon}</span>}
            {displayLabel}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-bold">
        {rate.toFixed(1)}%
      </span>
      {showStatus && <ActivityStatusBadge status={status} size="small" showIcon={false} />}
    </div>
  )
}
