import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'

/**
 * StatCard Component
 *
 * 统计卡片组件，用于展示统计数据，带悬浮效果
 * 基于 Advisory Authority 设计风格
 */
interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  value: string | number
  icon?: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  description?: string
  variant?: 'default' | 'primary' | 'accent' | 'warning'
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  description,
  variant = 'default',
  className,
  ...props
}: StatCardProps) {
  const variantStyles = {
    default: 'border-[#E2E8F0] bg-[#FEFDFB]',
    primary: 'border-[#1E3A5F]/20 bg-[#1E3A5F]/5',
    accent: 'border-[#059669]/20 bg-[#059669]/5',
    warning: 'border-[#F59E0B]/20 bg-[#F59E0B]/5',
  }

  const iconStyles = {
    default: 'bg-[#1E3A5F] text-white',
    primary: 'bg-[#1E3A5F] text-white',
    accent: 'bg-[#059669] text-white',
    warning: 'bg-[#F59E0B] text-white',
  }

  return (
    <Card
      className={cn(
        'border rounded-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-[#64748B] mb-1">{title}</p>
            <p className="text-2xl font-bold text-[#1E3A5F]">{value}</p>

            {trend && (
              <div className="flex items-center gap-1 mt-2">
                <span
                  className={cn(
                    'text-xs font-medium',
                    trend.isPositive ? 'text-[#059669]' : 'text-[#DC2626]'
                  )}
                >
                  {trend.isPositive ? '+' : '-'}{Math.abs(trend.value)}%
                </span>
                <span className="text-xs text-[#64748B]">vs 上月</span>
              </div>
            )}

            {description && (
              <p className="text-xs text-[#64748B] mt-2">{description}</p>
            )}
          </div>

          {Icon && (
            <div className={cn('w-10 h-10 rounded-sm flex items-center justify-center', iconStyles[variant])}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default StatCard
