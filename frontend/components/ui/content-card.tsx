import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

/**
 * ContentCard Component
 *
 * 内容卡片组件，纸白色背景的通用内容容器
 * 基于 Advisory Authority 设计风格
 */
interface ContentCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
}

export function ContentCard({
  children,
  padding = 'md',
  hover = false,
  className,
  ...props
}: ContentCardProps) {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-6',
    lg: 'p-8',
  }

  return (
    <Card
      className={cn(
        'border border-[#E2E8F0] bg-[#FEFDFB] rounded-sm shadow-sm',
        hover && 'cursor-pointer transition-shadow duration-200 hover:shadow-md',
        className
      )}
      {...props}
    >
      <CardContent className={paddingStyles[padding]}>
        {children}
      </CardContent>
    </Card>
  )
}

export default ContentCard
