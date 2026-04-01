import React from 'react'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  description?: string
  icon?: React.ReactNode
  className?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  description = '暂无数据',
  icon = <Inbox className="h-12 w-12 text-[#94A3B8]" />,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 text-[#64748B]',
        className
      )}
    >
      <div className="mb-4">{icon}</div>
      <p className="text-sm">{description}</p>
    </div>
  )
}
