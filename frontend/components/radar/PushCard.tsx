'use client'

import React from 'react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  TrendingUp,
  ExternalLink,
  Building2,
  AlertTriangle,
  Gavel,
  AlertOctagon,
  Bookmark,
} from 'lucide-react'
import { formatChinaDate } from '@/lib/utils/dateTime'
import { cn } from '@/lib/utils'

/**
 * ROI分析数据结构
 */
interface ROIAnalysis {
  estimatedCost: string
  expectedBenefit: string
  roiEstimate: string
  implementationPeriod: string
  recommendedVendors: string[]
}

/**
 * 推送卡片属性
 */
interface PushCardProps {
  push: {
    pushId: string
    title: string
    summary: string
    relevanceScore: number
    priorityLevel: 1 | 2 | 3
    weaknessCategories: string[]
    publishDate: string
    source: string
    roiAnalysis?: ROIAnalysis
    // 行业雷达特定字段 (Story 3.3)
    peerName?: string
    practiceDescription?: string
    estimatedCost?: string
    implementationPeriod?: string
    technicalEffect?: string
    // 合规雷达特定字段 (Story 4.3)
    complianceRiskCategory?: string
    penaltyCase?: string
    policyRequirements?: string
    hasPlaybook?: boolean
    playbookStatus?: 'ready' | 'generating' | 'failed'
    sentAt?: string
    // Story 6.3: 品牌信息
    brandName?: string
  }
  variant?: 'tech' | 'industry' | 'compliance'
  isWatchedPeer?: boolean
  onViewDetail?: (pushId: string) => void
}

/**
 * PushCard组件 - 技术雷达推送卡片
 *
 * Story 2.4 - Phase 3 Task 3.1
 * Story 2.5 - Task 2.4: 性能优化 (React.memo with comparison)
 *
 * 功能：
 * - 显示推送基本信息（标题、摘要、优先级）
 * - 显示ROI分析摘要（投入、收益、ROI评分、周期）
 * - 使用视觉标识突出高ROI推送
 * - 添加"查看详情"按钮
 */
export const PushCard = React.memo(
  function PushCard({ push, variant = 'tech', isWatchedPeer = false, onViewDetail }: PushCardProps) {
    // 优先级配置
    const priorityConfig: Record<1 | 2 | 3, { label: string; className: string }> = {
      1: { label: '优先级 1', className: 'bg-primary text-primary-foreground' },
      2: { label: '优先级 2', className: 'bg-primary text-primary-foreground' },
      3: { label: '优先级 3', className: 'bg-muted text-muted-foreground' },
    }

    const priority = priorityConfig[push.priorityLevel as 1 | 2 | 3] || {
      label: '未分类',
      className: 'bg-muted text-muted-foreground',
    }

    // 相关性评分显示
    const relevancePercent = Math.round((push.relevanceScore || 0) * 100)
    const relevanceClassName =
      relevancePercent >= 95
        ? 'border-amber-500 text-amber-600'
        : 'border-border text-muted-foreground'

    return (
      <Card
        className={cn(
          'h-full flex flex-col transition-shadow hover:shadow-lg',
          variant === 'compliance' && push.relevanceScore >= 0.9 && 'border-red-500 border-2'
        )}
      >
        <CardContent className="flex-grow p-4 sm:p-5">
          {/* 标题和优先级 */}
          <div className="mb-3">
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge className={cn('text-xs font-semibold', priority.className)}>
                {priority.label}
              </Badge>
              <Badge variant="outline" className={cn('text-xs', relevanceClassName)}>
                {relevancePercent}% 相关
              </Badge>
            </div>
            <h3 className="text-base font-semibold leading-snug text-foreground">
              {push.title}
            </h3>
          </div>

          {/* 薄弱项标签 */}
          {push.weaknessCategories.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {push.weaknessCategories.map((category) => (
                <Badge
                  key={category}
                  variant="outline"
                  className="text-xs border-primary text-primary hover:bg-primary/10"
                >
                  {category}
                </Badge>
              ))}
            </div>
          )}

          {/* 摘要 */}
          <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
            {push.summary}
          </p>

          {/* 行业雷达卡片显示 (Story 3.3 - variant='industry') */}
          {variant === 'industry' && (
            <div className="p-3 sm:p-4 rounded-lg bg-gradient-to-br from-green-50 to-green-100 border border-green-200">
              {/* 同业机构名称 */}
              {push.peerName && (
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-bold text-green-700">
                    {push.peerName}
                    {isWatchedPeer && (
                      <Badge className="ml-2 h-5 text-xs bg-amber-500 text-white">
                        <Bookmark className="w-3 h-3 mr-1" />
                        关注
                      </Badge>
                    )}
                  </span>
                </div>
              )}

              {/* 实践描述摘要 */}
              {push.practiceDescription && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {push.practiceDescription.length > 100
                    ? `${push.practiceDescription.substring(0, 100)}...`
                    : push.practiceDescription}
                </p>
              )}

              {/* 投入成本和实施周期 */}
              <div className="grid grid-cols-2 gap-3">
                {push.estimatedCost && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-0.5">投入成本</span>
                    <span className="text-sm font-bold text-foreground">{push.estimatedCost}</span>
                  </div>
                )}
                {push.implementationPeriod && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-0.5">实施周期</span>
                    <span className="text-sm font-bold text-foreground">
                      {push.implementationPeriod}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 合规雷达卡片显示 (Story 4.3 - variant='compliance') */}
          {variant === 'compliance' && (
            <div
              className={cn(
                'p-3 sm:p-4 rounded-lg bg-gradient-to-br from-red-50 to-red-100',
                push.relevanceScore >= 0.9
                  ? 'border-2 border-red-600'
                  : 'border border-red-200'
              )}
            >
              {/* 风险类别标签 */}
              {push.complianceRiskCategory && (
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-bold text-red-700">
                    {push.complianceRiskCategory}
                  </span>
                </div>
              )}

              {/* 处罚案例摘要 */}
              {push.penaltyCase && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {push.penaltyCase.length > 100
                    ? `${push.penaltyCase.substring(0, 100)}...`
                    : push.penaltyCase}
                </p>
              )}

              {/* ROI 分析摘要 */}
              <div className="mb-2">
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-muted-foreground">相关性评分</span>
                  <span className="text-xs font-bold text-red-600">
                    {push.relevanceScore >= 0.9
                      ? '高相关'
                      : push.relevanceScore >= 0.7
                        ? '中相关'
                        : '低相关'}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-300',
                      push.relevanceScore >= 0.9
                        ? 'bg-red-600'
                        : push.relevanceScore >= 0.7
                          ? 'bg-amber-500'
                          : 'bg-green-600'
                    )}
                    style={{ width: `${Math.round(push.relevanceScore * 100)}%` }}
                  />
                </div>
              </div>

              {/* 高优先级标识 */}
              {push.priorityLevel === 3 && (
                <div className="flex items-center gap-1 mt-2">
                  <AlertOctagon className="w-4 h-4 text-red-600" />
                  <span className="text-xs font-bold text-red-600">高优先级推送</span>
                </div>
              )}
            </div>
          )}

          {/* ROI分析展示 (技术雷达) */}
          {variant === 'tech' && push.roiAnalysis && (
            <div className="p-3 sm:p-4 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-primary">ROI分析</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 预计投入 */}
                <div>
                  <span className="text-xs text-muted-foreground block mb-0.5">预计投入</span>
                  <span className="text-sm font-bold text-foreground">
                    {push.roiAnalysis.estimatedCost}
                  </span>
                </div>

                {/* 预期收益 */}
                <div>
                  <span className="text-xs text-muted-foreground block mb-0.5">预期收益</span>
                  <span className="text-sm font-bold text-green-600 truncate block">
                    {push.roiAnalysis.expectedBenefit}
                  </span>
                </div>

                {/* ROI估算 */}
                <div>
                  <span className="text-xs text-muted-foreground block mb-0.5">ROI估算</span>
                  <span className="text-base font-bold text-green-600">
                    {push.roiAnalysis.roiEstimate}
                  </span>
                </div>

                {/* 实施周期 */}
                <div>
                  <span className="text-xs text-muted-foreground block mb-0.5">实施周期</span>
                  <span className="text-sm font-bold text-foreground">
                    {push.roiAnalysis.implementationPeriod}
                  </span>
                </div>
              </div>

              {/* 推荐供应商 */}
              {push.roiAnalysis.recommendedVendors.length > 0 && (
                <>
                  <hr className="my-3 border-border" />
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">推荐供应商</span>
                    <div className="flex flex-wrap gap-1">
                      {push.roiAnalysis.recommendedVendors.map((vendor) => (
                        <Badge
                          key={vendor}
                          variant="outline"
                          className="text-xs border-border text-muted-foreground hover:border-primary hover:text-primary"
                        >
                          {vendor}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 如果没有ROI分析 (仅技术雷达) */}
          {variant === 'tech' && !push.roiAnalysis && (
            <div className="p-3 rounded-lg bg-muted border border-border">
              <p className="text-sm text-muted-foreground text-center">ROI分析中...</p>
            </div>
          )}

          {/* 元信息 */}
          <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-border text-xs text-muted-foreground">
            {push.brandName && (
              <>
                <span className="text-primary font-semibold">来自 {push.brandName} 的推送</span>
                <span>•</span>
              </>
            )}
            <span>来源: {push.source}</span>
            <span>•</span>
            <span>{formatChinaDate(push.publishDate)}</span>
          </div>
        </CardContent>

        <CardFooter className="p-4 pt-0">
          <Button
            className="w-full"
            variant={variant === 'compliance' ? 'destructive' : 'default'}
            onClick={() => onViewDetail?.(push.pushId)}
            disabled={!onViewDetail}
          >
            {variant === 'compliance' ? '查看应对剧本' : '查看详情'}
            {variant === 'compliance' ? (
              <Gavel className="w-4 h-4 ml-2" />
            ) : (
              <ExternalLink className="w-4 h-4 ml-2" />
            )}
          </Button>
        </CardFooter>
      </Card>
    )
  },
  // 自定义比较函数优化 React.memo
  (prevProps, nextProps) => {
    return (
      prevProps.push.pushId === nextProps.push.pushId &&
      prevProps.push.title === nextProps.push.title &&
      prevProps.push.relevanceScore === nextProps.push.relevanceScore &&
      prevProps.push.priorityLevel === nextProps.push.priorityLevel &&
      prevProps.push.complianceRiskCategory === nextProps.push.complianceRiskCategory &&
      prevProps.push.penaltyCase === nextProps.push.penaltyCase &&
      prevProps.push.hasPlaybook === nextProps.push.hasPlaybook &&
      JSON.stringify(prevProps.push.roiAnalysis) === JSON.stringify(nextProps.push.roiAnalysis)
    )
  }
)
