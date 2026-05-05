import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * PageHeader Component
 *
 * 页面头部组件，包含标题、描述、图标和操作按钮
 * 基于 Advisory Authority 设计风格
 */
interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  variant?: 'default' | 'gradient' | 'subtle'
}

export function PageHeader({
  title,
  description,
  icon,
  action,
  variant = 'default',
  className,
  ...props
}: PageHeaderProps) {
  const variantStyles = {
    default: 'bg-[#1E3A5F] text-white',
    gradient: 'bg-[#1E3A5F] text-white',
    subtle: 'bg-[#F1F5F9] text-[#1E3A5F]',
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-sm p-6 mb-6',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      <div className="relative z-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3 lg:min-w-[480px]">
            {icon && (
              <div className="flex items-center justify-center w-12 h-12 rounded-sm bg-white/20 backdrop-blur-sm">
                {icon}
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{title}</h1>
              {description && <p className="text-sm opacity-90 mt-0.5">{description}</p>}
            </div>
          </div>
          {action && <div className="min-w-0">{action}</div>}
        </div>
      </div>
    </div>
  )
}

export default PageHeader
