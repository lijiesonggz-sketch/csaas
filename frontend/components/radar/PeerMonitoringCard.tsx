'use client'

import React from 'react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Clock,
  Building2,
  Star,
  ExternalLink,
  DollarSign,
  Award,
} from 'lucide-react'
import { formatChinaDate } from '@/lib/utils/dateTime'
import { cn } from '@/lib/utils'

/**
 * 同业动态推送数据结构
 */
export interface PeerMonitoringPush {
  id: string
  pushType: 'peer-monitoring' | 'industry' | 'tech' | 'compliance'
  peerName: string
  peerLogo?: string
  practiceDescription: string
  estimatedCost: string
  implementationPeriod: string
  technicalEffect: string
  relevanceScore: number
  priorityLevel: 'high' | 'medium' | 'low'
  sentAt: string
  isRead: boolean
  source?: string
  publishDate?: string
  tags?: string[]
  isBookmarked?: boolean
}

/**
 * PeerMonitoringCard组件属性
 */
interface PeerMonitoringCardProps {
  push: PeerMonitoringPush
  isWatchedPeer: boolean
  onMarkAsRead: () => void
  onViewDetail: () => void
}

/**
 * PeerMonitoringCard组件 - 同业动态卡片
 *
 * Story 8.6 - AC1, AC2
 *
 * 功能：
 * - 显示同业动态推送卡片
 * - 显示"与您关注的XX银行相关"标签
 * - 显示同业实践详情：成本、周期、效果
 * - 显示"同业动态"标签
 * - 显示相关性标注
 * - 查看详情按钮
 */
export const PeerMonitoringCard = React.memo(function PeerMonitoringCard({
  push,
  isWatchedPeer,
  onMarkAsRead,
  onViewDetail,
}: PeerMonitoringCardProps) {
  // 优先级配置
  const priorityConfig: Record<string, { label: string; className: string }> = {
    high: { label: '高优先级', className: 'bg-destructive text-destructive-foreground' },
    medium: { label: '中优先级', className: 'bg-amber-500 text-white' },
    low: { label: '低优先级', className: 'bg-muted text-muted-foreground' },
  }

  const priority = priorityConfig[push.priorityLevel] || { label: '普通', className: 'bg-muted text-muted-foreground' }

  // 相关性评分显示
  const relevancePercent = Math.round((push.relevanceScore || 0) * 100)

  // 处理卡片点击
  const handleCardClick = () => {
    if (!push.isRead) {
      onMarkAsRead()
    }
  }

  // 处理查看详情
  const handleViewDetail = (e: React.MouseEvent) => {
    e.stopPropagation()
    onViewDetail()
  }

  return (
    <Card
      data-testid="peer-monitoring-card"
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleCardClick()
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`查看 ${push.peerName} 的同业动态详情`}
      className={cn(
        'h-full flex flex-col transition-shadow cursor-pointer',
        'hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        isWatchedPeer ? 'border-2 border-primary' : 'border'
      )}
    >
      <CardContent className="flex-grow p-4 sm:p-5">
        {/* 头部：类型标签和优先级 */}
        <div className="mb-3">
          <div className="flex flex-wrap gap-2 mb-2 items-center">
            {/* 同业动态标签 */}
            <Badge className="bg-primary text-primary-foreground text-xs font-semibold">
              同业动态
            </Badge>
            {/* 优先级标签 */}
            <Badge variant="outline" className={cn('text-xs', priority.className)}>
              {priority.label}
            </Badge>
            {/* 相关性评分 */}
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                relevancePercent >= 90
                  ? 'border-amber-500 text-amber-600'
                  : 'border-border text-muted-foreground'
              )}
            >
              {relevancePercent}% 相关
            </Badge>
          </div>

          {/* 与我关注的同业相关标签 */}
          {isWatchedPeer && (
            <Badge className="bg-green-500 text-white text-xs font-semibold mb-1">
              与您关注的{push.peerName}相关
            </Badge>
          )}
        </div>

        {/* 同业机构名称和Logo */}
        <div className="flex items-center gap-3 mb-3">
          {push.peerLogo ? (
            <Avatar className="w-10 h-10">
              <img src={push.peerLogo} alt={push.peerName} />
              <AvatarFallback>
                <Building2 className="w-5 h-5" />
              </AvatarFallback>
            </Avatar>
          ) : (
            <Avatar className="w-10 h-10 bg-primary">
              <Building2 className="w-5 h-5 text-white" />
            </Avatar>
          )}
          <div>
            <h3 className={cn(
              'text-base font-bold',
              isWatchedPeer ? 'text-primary' : 'text-foreground'
            )}>
              {push.peerName}
              {isWatchedPeer && (
                <Badge className="ml-2 h-5 text-xs bg-amber-500 text-white">
                  <Star className="w-3 h-3 mr-1" />
                  关注
                </Badge>
              )}
            </h3>
          </div>
        </div>

        {/* 实践描述摘要 */}
        <p className="text-sm text-muted-foreground mb-3 line-clamp-3 leading-relaxed">
          {push.practiceDescription}
        </p>

        {/* 成本、周期、效果 */}
        <div className="p-3 sm:p-4 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
          <div className="grid grid-cols-2 gap-3">
            {/* 投入成本 */}
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground block">投入成本</span>
                <span className="text-sm font-bold text-foreground truncate block">
                  {push.estimatedCost}
                </span>
              </div>
            </div>

            {/* 实施周期 */}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground block">实施周期</span>
                <span className="text-sm font-bold text-foreground truncate block">
                  {push.implementationPeriod}
                </span>
              </div>
            </div>

            {/* 技术效果 - 跨两列 */}
            <div className="flex items-center gap-2 col-span-2">
              <Award className="w-4 h-4 text-green-600" />
              <div className="min-w-0 flex-1">
                <span className="text-xs text-muted-foreground block">技术效果</span>
                <span className="text-sm font-bold text-green-600 truncate block">
                  {push.technicalEffect}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 相关技术标签 */}
        {push.tags && push.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {push.tags.slice(0, 5).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-xs border-border text-muted-foreground"
              >
                {tag}
              </Badge>
            ))}
            {push.tags.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{push.tags.length - 5}
              </Badge>
            )}
          </div>
        )}

        {/* 元信息 */}
        <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-border text-xs text-muted-foreground">
          {push.source && (
            <>
              <span>来源: {push.source}</span>
              <span>•</span>
            </>
          )}
          {push.publishDate && <span>{formatChinaDate(push.publishDate)}</span>}
          {push.isRead && (
            <>
              <span>•</span>
              <span className="text-green-600">已读</span>
            </>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button className="w-full" onClick={handleViewDetail}>
          查看详情
          <ExternalLink className="w-4 h-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  )
})
