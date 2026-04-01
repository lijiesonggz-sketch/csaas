'use client'

import React, { useState, useCallback, useEffect } from 'react'
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
import {
  TrendingUp,
  Clock,
  DollarSign,
  Trophy,
  Building2,
  ExternalLink,
  Bookmark,
  Share2,
  CheckCircle,
  Calculator,
} from 'lucide-react'
import { getRadarPush, markPushAsRead, RadarPush } from '@/lib/api/radar'
import { formatChinaDate } from '@/lib/utils/dateTime'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

/**
 * PushDetailModal属性
 */
interface PushDetailModalProps {
  pushId: string
  isOpen: boolean
  onClose: () => void
}

/**
 * PushDetailModal组件 - 推送详情弹窗
 *
 * Story 2.4 - Phase 3 Task 3.2 (Issue #5修复 - 添加backend fetch)
 * Story 2.5 - Task 2.4: 性能优化 (React.memo, useCallback)
 *
 * 功能：
 * - 从后端API加载推送详情
 * - 显示文章全文
 * - 显示完整ROI分析（投入详情、收益详情、ROI计算公式）
 * - 显示实施周期和推荐供应商列表
 * - 添加操作按钮（收藏、分享、标记已读）
 */
export const PushDetailModal = React.memo(function PushDetailModal({
  pushId,
  isOpen,
  onClose,
}: PushDetailModalProps) {
  const [push, setPush] = useState<RadarPush | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isMarkingAsRead, setIsMarkingAsRead] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 加载推送详情
  useEffect(() => {
    if (!isOpen || !pushId) return

    const fetchPush = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const data = await getRadarPush(pushId)
        setPush(data)
      } catch (err) {
        // 生产环境应使用错误跟踪服务（如 Sentry）
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to fetch push details:', err)
        }
        setError(err instanceof Error ? err.message : '加载推送详情失败')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPush()
  }, [pushId, isOpen])

  // 标记为已读
  const handleMarkAsRead = useCallback(async () => {
    if (!pushId || isMarkingAsRead) return

    setIsMarkingAsRead(true)
    try {
      await markPushAsRead(pushId)
      if (push) {
        setPush({ ...push, isRead: true, readAt: new Date().toISOString() })
      }
    } catch (err) {
      // 生产环境应使用错误跟踪服务（如 Sentry）
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to mark as read:', err)
      }
      // 可以添加用户友好的错误提示
    } finally {
      setIsMarkingAsRead(false)
    }
  }, [pushId, push, isMarkingAsRead])

  // 加载状态
  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="rounded-sm">
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#1E3A5F] animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // 错误状态
  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="rounded-sm">
          <div className="p-4 bg-red-50 border border-red-200 rounded-sm text-red-800">
            {error}
          </div>
          <DialogFooter>
            <Button onClick={onClose} className="rounded-sm">关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // 无数据
  if (!push) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-sm max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold font-[var(--font-plus-jakarta)] text-[#1E3A5F]">
            {push.title}
          </DialogTitle>
          <DialogDescription className="flex gap-2 text-sm text-[#94A3B8]">
            <span>{push.source}</span>
            <span>•</span>
            <span>{formatChinaDate(push.publishDate)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 薄弱项标签 */}
          {push.weaknessCategories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {push.weaknessCategories.map((category) => (
                <Badge
                  key={category}
                  variant="secondary"
                  className="rounded-sm"
                >
                  🎯 关联薄弱项: {category}
                </Badge>
              ))}
            </div>
          )}

          {/* 文章全文 */}
          <div>
            <p className="text-sm text-[#1E3A5F] whitespace-pre-wrap leading-relaxed">
              {push.fullContent || push.summary}
            </p>
          </div>

          {/* 行业雷达详情 (Story 3.3 - Phase 3) */}
          {push.radarType === 'industry' && (
            <>
              {/* 同业机构背景区域 */}
              {push.peerName && (
                <div className="p-4 border-2 border-green-300 rounded-sm bg-gradient-to-br from-green-50 to-green-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-[#059669] rounded-sm flex items-center justify-center">
                      <Building2 className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[#059669]">
                        {push.peerName}
                      </h3>
                      <Badge className="rounded-sm bg-[#059669]">同业标杆机构</Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* 技术实践详细描述 */}
              {push.practiceDescription && (
                <div className="p-3 bg-slate-50 rounded-sm border border-[#E2E8F0]">
                  <h4 className="text-sm font-semibold text-[#1E3A5F] mb-2">
                    技术实践详细描述
                  </h4>
                  <p className="text-sm text-[#1E3A5F] whitespace-pre-wrap leading-relaxed">
                    {push.practiceDescription}
                  </p>
                </div>
              )}

              {/* 投入成本/实施周期/效果 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {push.estimatedCost && (
                  <div className="p-4 bg-white border border-[#E2E8F0] rounded-sm shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-5 h-5 text-[#059669]" />
                      <h4 className="text-sm font-semibold text-[#1E3A5F]">
                        投入成本
                      </h4>
                    </div>
                    <p className="text-xl font-bold text-[#1E3A5F]">
                      {push.estimatedCost}
                    </p>
                    <p className="text-xs text-[#94A3B8]">
                      包含软硬件采购、实施服务等
                    </p>
                  </div>
                )}

                {push.implementationPeriod && (
                  <div className="p-4 bg-white border border-[#E2E8F0] rounded-sm shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-5 h-5 text-orange-500" />
                      <h4 className="text-sm font-semibold text-[#1E3A5F]">
                        实施周期
                      </h4>
                    </div>
                    <p className="text-xl font-bold text-[#1E3A5F]">
                      {push.implementationPeriod}
                    </p>
                    <p className="text-xs text-[#94A3B8]">
                      从启动到上线的预计时间
                    </p>
                  </div>
                )}

                {push.technicalEffect && (
                  <div className="p-4 bg-white border border-[#E2E8F0] rounded-sm shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="w-5 h-5 text-[#059669]" />
                      <h4 className="text-sm font-semibold text-[#1E3A5F]">
                        技术效果
                      </h4>
                    </div>
                    <p className="text-lg font-bold text-[#1E3A5F]">
                      {push.technicalEffect}
                    </p>
                    <p className="text-xs text-[#94A3B8]">
                      实际效果和收益
                    </p>
                  </div>
                )}
              </div>

              {/* 可借鉴点总结 */}
              {push.tags && push.tags.length > 0 && (
                <div className="p-4 bg-white border border-[#E2E8F0] rounded-sm shadow-sm">
                  <h4 className="text-sm font-semibold text-[#1E3A5F] mb-2">
                    可借鉴点总结
                  </h4>
                  <p className="text-sm text-[#94A3B8]">
                    {push.tags.join('、')}
                  </p>
                </div>
              )}
            </>
          )}

          {/* ROI分析详情 (技术雷达) */}
          {push.radarType === 'tech' && push.roiAnalysis && (
            <div className="p-4 border-2 border-blue-300 rounded-sm bg-gradient-to-br from-blue-50 to-indigo-50">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-[#1E3A5F] rounded-sm flex items-center justify-center">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-[#1E3A5F]">
                  💰 投资回报率(ROI)分析
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 预计投入成本 */}
                <div className="p-4 bg-white border border-[#E2E8F0] rounded-sm shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-5 h-5 text-[#1E3A5F]" />
                    <h4 className="text-sm font-semibold text-[#1E3A5F]">
                      预计投入成本
                    </h4>
                  </div>
                  <p className="text-xl font-bold text-[#1E3A5F]">
                    {push.roiAnalysis.estimatedCost}
                  </p>
                  <p className="text-xs text-[#94A3B8]">
                    包含软硬件采购、实施服务、培训等
                  </p>
                </div>

                {/* 预期收益 */}
                <div className="p-4 bg-white border border-[#E2E8F0] rounded-sm shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-5 h-5 text-[#059669]" />
                    <h4 className="text-sm font-semibold text-[#1E3A5F]">
                      预期收益
                    </h4>
                  </div>
                  <p className="text-lg font-bold text-[#1E3A5F]">
                    {push.roiAnalysis.expectedBenefit}
                  </p>
                  <p className="text-xs text-[#94A3B8]">
                    量化收益包含成本节省、风险规避等
                  </p>
                </div>

                {/* ROI估算 */}
                <div className="p-4 border-2 border-green-300 rounded-sm bg-gradient-to-br from-green-50 to-green-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Calculator className="w-5 h-5 text-[#059669]" />
                    <h4 className="text-sm font-semibold text-[#1E3A5F]">
                      ROI估算
                    </h4>
                  </div>
                  <p className="text-3xl font-bold text-[#059669]">
                    {push.roiAnalysis.roiEstimate}
                  </p>
                  <div className="mt-2 p-2 bg-white rounded-sm border border-[#E2E8F0]">
                    <p className="text-xs text-[#94A3B8]">计算公式：</p>
                    <p className="text-xs font-mono text-[#94A3B8]">
                      ROI = (预期收益 - 投入成本) / 投入成本
                    </p>
                  </div>
                </div>

                {/* 实施周期 */}
                <div className="p-4 bg-white border border-[#E2E8F0] rounded-sm shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-orange-500" />
                    <h4 className="text-sm font-semibold text-[#1E3A5F]">
                      实施周期
                    </h4>
                  </div>
                  <p className="text-xl font-bold text-[#1E3A5F]">
                    {push.roiAnalysis.implementationPeriod}
                  </p>
                  <p className="text-xs text-[#94A3B8]">
                    从启动到上线的预计时间
                  </p>
                </div>
              </div>

              {/* 推荐供应商 */}
              {push.roiAnalysis.recommendedVendors.length > 0 && (
                <div className="mt-4 p-4 bg-white border border-[#E2E8F0] rounded-sm shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-5 h-5 text-[#94A3B8]" />
                    <h4 className="text-sm font-semibold text-[#1E3A5F]">
                      推荐供应商
                    </h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {push.roiAnalysis.recommendedVendors.map((vendor) => (
                      <Badge
                        key={vendor}
                        variant="outline"
                        className="rounded-sm"
                      >
                        {vendor}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-[#94A3B8] mt-2">
                    以上供应商具有金融行业资质和成功案例
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 原文链接 */}
          {push.url && (
            <div>
              <Button
                variant="outline"
                className="rounded-sm w-full"
                asChild
              >
                <a
                  href={push.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  查看原文
                </a>
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-sm">
            <Bookmark className="w-4 h-4 mr-2" />
            收藏
          </Button>
          <Button variant="outline" className="rounded-sm">
            <Share2 className="w-4 h-4 mr-2" />
            分享
          </Button>
          <Button
            onClick={handleMarkAsRead}
            disabled={push.isRead || isMarkingAsRead}
            className={cn(
              "rounded-sm",
              push.isRead
                ? "bg-[#94A3B8] hover:bg-[#7a8ba3]"
                : "bg-[#059669] hover:bg-[#047857]"
            )}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {push.isRead ? '已读' : isMarkingAsRead ? '标记中...' : '标记为已读'}
          </Button>
          <Button variant="outline" onClick={onClose} className="rounded-sm">
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
