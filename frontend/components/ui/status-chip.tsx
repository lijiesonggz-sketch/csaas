import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * 状态类型
 */
export type StatusType = 'success' | 'info' | 'warning' | 'error' | 'pending'

const statusChipVariants = cva(
  'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-semibold',
  {
    variants: {
      statusType: {
        success: 'bg-[#D1FAE5] text-[#059669]',
        info: 'bg-[#DBEAFE] text-[#1E3A5F]',
        warning: 'bg-[#FEF3C7] text-[#D97706]',
        error: 'bg-[#FEE2E2] text-[#DC2626]',
        pending: 'bg-[#F3F4F6] text-[#6B7280]',
      },
      size: {
        small: 'text-xs px-2 py-0.5',
        medium: 'text-sm px-2.5 py-1',
      },
    },
    defaultVariants: {
      statusType: 'info',
      size: 'small',
    },
  }
)

export interface StatusChipProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusChipVariants> {
  label: string
  icon?: React.ReactNode
}

export function StatusChip({
  label,
  icon,
  statusType,
  size,
  className,
  ...props
}: StatusChipProps) {
  return (
    <div className={cn(statusChipVariants({ statusType, size }), className)} {...props}>
      {icon}
      <span>{label}</span>
    </div>
  )
}

export default StatusChip
