'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import {
  X as Close,
  Bookmark,
  CheckCircle,
  Building2,
  DollarSign,
  Clock,
  Trophy,
  Lightbulb,
  Link as LinkIcon,
  Calendar,
} from 'lucide-react'
import { PeerMonitoringPush } from './PeerMonitoringCard'
import { formatChinaDate } from '@/lib/utils/dateTime'
import { cn } from '@/lib/utils'

/**
 * 详情弹窗扩展的数据结构
 */
interface PeerMonitoringDetail extends PeerMonitoringPush {
  peerBackground?: string
  learnablePoints?: string[]
  isBookmarked: boolean
}

/**
 * PeerMonitoringDetailModal组件属性
 */
interface PeerMonitoringDetailModalProps {
  open: boolean
  push: PeerMonitoringDetail
  onClose: () => void
  onBookmark: () => void
  onMarkAsRead: () => void
}

/**
 * PeerMonitoringDetailModal组件 - 同业动态详情弹窗
 *
 * Story 8.6 - AC3
 *
 * 功能：
 * - 显示完整同业案例信息
 * - 同业机构背景
 * - 技术实践详细描述
 * - 投入成本/实施周期/效果
 * - 可借鉴点总结
 * - 信息来源和发布日期
 * - 相关技术标签
 * - 收藏功能
 * - 标记已读功能
 */
export const PeerMonitoringDetailModal = React.memo(function PeerMonitoringDetailModal({
  open,
  push,
  onClose,
  onBookmark,
  onMarkAsRead,
}: PeerMonitoringDetailModalProps) {
  // 优先级配置
  const priorityConfig: Record<string, { label: string; color: string }> = {
    high: { label: '高优先级', color: 'text-red-600 bg-red-50 border-red-200' },
    medium: { label: '中优先级', color: 'text-amber-600 bg-amber-50 border-amber-200' },
    low: { label: '低优先级', color: 'text-gray-600 bg-gray-50 border-gray-200' },
  }

  const priority = priorityConfig[push.priorityLevel] || { label: '普通', color: 'text-gray-600 bg-gray-50 border-gray-200' }

  // 相关性评分显示
  const relevancePercent = Math.round((push.relevanceScore || 0) * 100)

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-sm max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* 标题区域 */}
        <DialogHeader>
          <div className="flex items-start gap-4">
            {push.peerLogo ? (
              <Avatar className="w-12 h-12">
                <img src={push.peerLogo} alt={push.peerName} />
              </Avatar>
            ) : (
              <Avatar className="w-12 h-12 bg-[#1E3A5F]">
                <Building2 className="w-7 h-7 text-white" />
              </Avatar>
            )}
            <div className="flex-1">
              <DialogTitle className="text-xl font-bold text-[#1E3A5F] mb-1">
                {push.peerName}
              </DialogTitle>
              <div className="flex flex-wrap gap-2 mt-1">
                <Badge className="rounded-sm bg-[#1E3A5F]">同业动态</Badge>
                <Badge variant="outline" className={cn("rounded-sm", priority.color)}>
                  {priority.label}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-sm",
                    relevancePercent >= 90
                      ? "text-amber-600 bg-amber-50 border-amber-200"
                      : "text-gray-600 bg-gray-50 border-gray-200"
                  )}
                >
                  {relevancePercent}% 相关
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-sm"
            >
              <Close className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* 同业机构背景 */}
          {push.peerBackground && (
            <div className="p-4 border-2 border-green-300 rounded-sm bg-gradient-to-br from-green-50 to-green-100">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-[#059669]" />
                <h3 className="text-lg font-semibold text-[#059669]">同业机构背景</h3>
              </div>
              <p className="text-sm text-[#1E3A5F] leading-relaxed">
                {push.peerBackground}
              </p>
            </div>
          )}

          {/* 技术实践详细描述 */}
          <div>
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-2">
              技术实践详细描述
            </h3>
            <p className="text-sm text-[#94A3B8] whitespace-pre-wrap leading-relaxed">
              {push.practiceDescription}
            </p>
          </div>

          {/* 投入成本/实施周期/效果 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 投入成本 */}
            <div className="p-4 bg-white border border-[#E2E8F0] rounded-sm shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-[#1E3A5F]" />
                <h4 className="text-sm font-semibold text-[#1E3A5F]">
                  投入成本
                </h4>
              </div>
              <p className="text-2xl font-bold text-[#1E3A5F] mb-1">
                {push.estimatedCost}
              </p>
              <p className="text-xs text-[#94A3B8]">
                包含软硬件采购、实施服务等
              </p>
            </div>

            {/* 实施周期 */}
            <div className="p-4 bg-white border border-[#E2E8F0] rounded-sm shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-orange-500" />
                <h4 className="text-sm font-semibold text-[#1E3A5F]">
                  实施周期
                </h4>
              </div>
              <p className="text-2xl font-bold text-[#1E3A5F] mb-1">
                {push.implementationPeriod}
              </p>
              <p className="text-xs text-[#94A3B8]">
                从启动到上线的预计时间
              </p>
            </div>

            {/* 技术效果 */}
            <div className="p-4 bg-white border border-[#E2E8F0] rounded-sm shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-[#059669]" />
                <h4 className="text-sm font-semibold text-[#1E3A5F]">
                  技术效果
                </h4>
              </div>
              <p className="text-lg font-bold text-[#059669] mb-1">
                {push.technicalEffect}
              </p>
              <p className="text-xs text-[#94A3B8]">
                实际效果和收益
              </p>
            </div>
          </div>

          {/* 可借鉴点总结 */}
          {push.learnablePoints && push.learnablePoints.length > 0 && (
            <div className="p-4 border-2 border-amber-300 rounded-sm bg-gradient-to-br from-amber-50 to-orange-50">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-5 h-5 text-amber-600" />
                <h3 className="text-lg font-semibold text-amber-700">可借鉴点总结</h3>
              </div>
              <ul className="space-y-2">
                {push.learnablePoints.map((point, index) => (
                  <li
                    key={index}
                    className="text-sm text-[#1E3A5F] pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-amber-600"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 信息来源和发布日期 */}
          <div className="flex flex-wrap gap-6">
            {push.source && (
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-[#94A3B8]" />
                <p className="text-sm text-[#94A3B8]">
                  来源: {push.source}
                </p>
              </div>
            )}
            {push.publishDate && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#94A3B8]" />
                <p className="text-sm text-[#94A3B8]">
                  发布日期: {formatChinaDate(push.publishDate)}
                </p>
              </div>
            )}
          </div>

          {/* 相关技术标签 */}
          {push.tags && push.tags.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-[#1E3A5F] mb-2">
                相关技术
              </h4>
              <div className="flex flex-wrap gap-2">
                {push.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="rounded-sm"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={onBookmark}
            className={cn(
              "rounded-sm",
              push.isBookmarked && "border-[#1E3A5F] text-[#1E3A5F]"
            )}
          >
            <Bookmark className={cn("w-4 h-4 mr-2", push.isBookmarked ? "fill-current" : "")} />
            {push.isBookmarked ? '已收藏' : '收藏'}
          </Button>
          <Button
            onClick={onMarkAsRead}
            disabled={push.isRead}
            className={cn(
              "rounded-sm",
              push.isRead
                ? "bg-[#94A3B8] hover:bg-[#7a8ba3]"
                : "bg-[#1E3A5F] hover:bg-[#152a47]"
            )}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {push.isRead ? '已读' : '标记为已读'}
          </Button>
          <Button variant="outline" onClick={onClose} className="rounded-sm">
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
