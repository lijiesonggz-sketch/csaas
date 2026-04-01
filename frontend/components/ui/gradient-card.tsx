import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * GradientCard Component
 *
 * 渐变卡片组件，支持渐变背景和悬停效果
 * 基于 Advisory Authority 设计风格
 */
interface GradientCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  variant?: 'primary' | 'accent' | 'purple' | 'orange'
  hover?: boolean
}

export function GradientCard({
  children,
  variant = 'primary',
  hover = false,
  className,
  ...props
}: GradientCardProps) {
  const variantStyles = {
    primary: 'bg-gradient-to-br from-[#1E3A5F] to-[#0F2847]',
    accent: 'bg-gradient-to-br from-[#059669] to-[#047857]',
    purple: 'bg-gradient-to-br from-[#7C3AED] to-[#5B21B6]',
    orange: 'bg-gradient-to-br from-[#F59E0B] to-[#D97706]',
  }

  return (
    <div
      className={cn(
        'rounded-sm text-white shadow-lg',
        variantStyles[variant],
        hover && 'cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export default GradientCard
