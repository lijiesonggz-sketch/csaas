'use client'

import { useState, useEffect } from 'react'
import { X, Star } from 'lucide-react'
import dayjs from 'dayjs'
import { useSession } from 'next-auth/react'
import { ControlDetailDrawer } from '@/components/compliance/ControlDetailDrawer'
import { getRadarPush, type PushHistoryItem, type RadarPush } from '@/lib/api/radar'
import { submitPushFeedback, getUserFeedback, PushFeedback } from '@/lib/api/feedback'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface PushDetailModalProps {
  open: boolean
  push: PushHistoryItem | null
  onClose: () => void
  onMarkAsRead?: (pushId: string) => void
}

/**
 * 推送详情弹窗组件
 *
 * Story 5.4 - AC 6: 推送详情查看
 * Story 7.2 - 用户反馈功能
 * HIGH-2 修复: 实现推送详情弹窗和反馈表单
 */
export default function PushDetailModal({
  open,
  push,
  onClose,
  onMarkAsRead,
}: PushDetailModalProps) {
  const { data: session } = useSession()
  const organizationId = session?.user?.organizationId

  // 反馈状态
  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [existingFeedback, setExistingFeedback] = useState<PushFeedback | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadingFeedback, setLoadingFeedback] = useState(false)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const [feedbackSuccess, setFeedbackSuccess] = useState(false)
  const [controlContext, setControlContext] = useState<Pick<
    RadarPush,
    'controlId' | 'matchedControls' | 'sourceModule' | 'sourceRecordId'
  > | null>(null)
  const [loadingControlContext, setLoadingControlContext] = useState(false)
  const [controlDrawerOpen, setControlDrawerOpen] = useState(false)
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null)

  // 加载用户已有的反馈
  useEffect(() => {
    if (!open || !push || !session?.accessToken) {
      return
    }

    let cancelled = false

    const loadUserFeedback = async () => {
      try {
        setLoadingFeedback(true)
        setFeedbackError(null)
        const feedback = await getUserFeedback(session.accessToken!, push.id)

        if (cancelled) {
          return
        }

        if (feedback) {
          setExistingFeedback(feedback)
          setRating(feedback.rating)
          setComment(feedback.comment || '')
        } else {
          setExistingFeedback(null)
          setRating(null)
          setComment('')
        }
      } catch (error: any) {
        if (cancelled) {
          return
        }

        console.error('加载反馈失败:', error)
        setFeedbackError('加载反馈失败')
      } finally {
        if (!cancelled) {
          setLoadingFeedback(false)
        }
      }
    }

    void loadUserFeedback()

    return () => {
      cancelled = true
    }
  }, [open, push, session?.accessToken])

  useEffect(() => {
    if (!open || !push) {
      setControlContext(null)
      setLoadingControlContext(false)
      return
    }

    let cancelled = false

    setLoadingControlContext(true)
    setControlContext({
      controlId: push.controlId,
      matchedControls: push.matchedControls,
      sourceModule: push.sourceModule,
      sourceRecordId: push.sourceRecordId,
    })

    getRadarPush(push.id)
      .then((detail) => {
        if (cancelled) {
          return
        }

        setControlContext({
          controlId: detail.controlId,
          matchedControls: detail.matchedControls,
          sourceModule: detail.sourceModule,
          sourceRecordId: detail.sourceRecordId,
        })
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        setControlContext({
          controlId: push.controlId,
          matchedControls: push.matchedControls,
          sourceModule: push.sourceModule,
          sourceRecordId: push.sourceRecordId,
        })
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingControlContext(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, push])

  if (!push) return null

  const handleSubmitFeedback = async () => {
    if (!push || !session?.accessToken || rating === null) return

    try {
      setSubmitting(true)
      setFeedbackError(null)
      setFeedbackSuccess(false)

      await submitPushFeedback(session.accessToken, push.id, {
        rating,
        comment: comment.trim() || undefined,
      })

      setFeedbackSuccess(true)
      setExistingFeedback({
        id: 'temp',
        pushId: push.id,
        userId: session.user?.id || '',
        rating,
        comment: comment.trim() || null,
        createdAt: new Date().toISOString(),
      })

      // 3秒后关闭成功提示
      setTimeout(() => {
        setFeedbackSuccess(false)
      }, 3000)
    } catch (error: any) {
      console.error('提交反馈失败:', error)
      setFeedbackError(error.message || '提交反馈失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleMarkAsRead = () => {
    if (onMarkAsRead && !push.isRead) {
      onMarkAsRead(push.id)
    }
  }

  const handleOpenControlDetail = (controlId: string) => {
    setSelectedControlId(controlId)
    setControlDrawerOpen(true)
  }

  const getRadarTypeLabel = (type: string) => {
    switch (type) {
      case 'tech':
        return '技术雷达'
      case 'industry':
        return '行业雷达'
      case 'compliance':
        return '合规雷达'
      default:
        return type
    }
  }

  const getRadarTypeVariant = (type: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (type) {
      case 'tech':
        return 'default'
      case 'industry':
        return 'default'
      case 'compliance':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getRelevanceLabel = (level: string) => {
    switch (level) {
      case 'high':
        return '高相关'
      case 'medium':
        return '中相关'
      case 'low':
        return '低相关'
      default:
        return level
    }
  }

  const matchedControls = controlContext?.matchedControls ?? push.matchedControls

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold">{push.title}</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-6 w-6"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* 基础信息 */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant={getRadarTypeVariant(push.radarType)}>
                {getRadarTypeLabel(push.radarType)}
              </Badge>
              <Badge variant="outline">{getRelevanceLabel(push.relevanceLevel)}</Badge>
              {push.isRead && <Badge variant="outline">已读</Badge>}
            </div>
            <div className="text-sm text-muted-foreground">
              推送时间: {dayjs(push.sentAt).format('YYYY-MM-DD HH:mm:ss')}
            </div>
            {push.readAt && (
              <div className="text-sm text-muted-foreground">
                阅读时间: {dayjs(push.readAt).format('YYYY-MM-DD HH:mm:ss')}
              </div>
            )}
          </div>

          <Separator />

          {/* 摘要 */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">摘要</h3>
            <p className="text-sm text-muted-foreground">{push.summary}</p>
          </div>

          {/* 信息来源 */}
          {push.sourceName && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">信息来源</h3>
              <p className="text-sm text-muted-foreground">{push.sourceName}</p>
              {push.sourceUrl && (
                <a
                  href={push.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  查看原文
                </a>
              )}
            </div>
          )}

          {/* 关联薄弱项 */}
          {push.weaknessCategories && push.weaknessCategories.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">关联薄弱项</h3>
              <div className="flex flex-wrap gap-2">
                {push.weaknessCategories.map((category, index) => (
                  <Badge key={index} variant="outline">
                    {category}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 技术雷达特有: ROI 分析 */}
          {push.radarType === 'tech' && push.roiScore !== undefined && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">ROI 分析</h3>
              <p className="text-sm text-muted-foreground">
                ROI 评分: {(push.roiScore * 100).toFixed(0)}%
              </p>
            </div>
          )}

          {/* 行业雷达特有: 同业机构信息 */}
          {push.radarType === 'industry' && push.matchedPeers && push.matchedPeers.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">关注的同业机构</h3>
              <div className="flex flex-wrap gap-2">
                {push.matchedPeers.map((peer, index) => (
                  <Badge key={index} variant="default" className="bg-emerald-600">
                    {peer}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 合规雷达特有: 风险级别 */}
          {push.radarType === 'compliance' && push.riskLevel && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">风险级别</h3>
              <Badge
                variant={push.riskLevel === 'high' ? 'destructive' : push.riskLevel === 'medium' ? 'secondary' : 'default'}
                className="bg-emerald-600"
              >
                {push.riskLevel === 'high' ? '高风险' : push.riskLevel === 'medium' ? '中风险' : '低风险'}
              </Badge>
            </div>
          )}

          {/* 相关性评分 */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">相关性评分</h3>
            <p className="text-sm text-muted-foreground">
              {(push.relevanceScore * 100).toFixed(0)}% - {getRelevanceLabel(push.relevanceLevel)}
            </p>
          </div>

          {(loadingControlContext || matchedControls.length > 0) && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">关联控制点</h3>
              {loadingControlContext && (
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <span className="text-sm text-muted-foreground">正在加载控制点上下文...</span>
                </div>
              )}
              {!loadingControlContext && matchedControls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {matchedControls.map((control) => (
                    <Button
                      key={control.controlId}
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenControlDetail(control.controlId)}
                      className="h-7"
                    >
                      查看控制点详情: {control.controlName}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* 用户反馈表单 - Story 7.2 */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">内容反馈</h3>

            {loadingFeedback && (
              <div className="flex justify-center py-4">
                <Skeleton className="h-6 w-24" />
              </div>
            )}

            {!loadingFeedback && existingFeedback && (
              <Alert>
                <AlertDescription>
                  您已经对该推送提交过反馈（评分: {existingFeedback.rating} 星）
                </AlertDescription>
              </Alert>
            )}

            {!loadingFeedback && !existingFeedback && (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    请为这条推送内容评分（1-5星）
                  </p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => {
                          setRating(star)
                          setFeedbackError(null)
                        }}
                        className={cn(
                          'transition-colors',
                          rating && rating >= star ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'
                        )}
                      >
                        <Star
                          className="h-6 w-6"
                          fill={rating && rating >= star ? 'currentColor' : 'none'}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <Textarea
                  rows={3}
                  placeholder="请分享您对这条推送内容的看法..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={submitting}
                  className="resize-none"
                />

                {feedbackError && (
                  <Alert variant="destructive">
                    <AlertDescription>{feedbackError}</AlertDescription>
                  </Alert>
                )}

                {feedbackSuccess && (
                  <Alert className="border-emerald-600 text-emerald-600">
                    <AlertDescription>反馈提交成功！感谢您的反馈。</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleSubmitFeedback}
                  disabled={rating === null || submitting}
                  className="w-full"
                >
                  {submitting ? '提交中...' : '提交反馈'}
                </Button>
              </>
            )}
          </div>

          <DialogFooter>
            {!push.isRead && (
              <Button onClick={handleMarkAsRead} variant="default">
                标记为已读
              </Button>
            )}
            <Button onClick={onClose} variant="outline">
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {organizationId && selectedControlId && (
        <ControlDetailDrawer
          open={controlDrawerOpen}
          onOpenChange={setControlDrawerOpen}
          organizationId={organizationId}
          controlId={selectedControlId}
          sourceModule={controlContext?.sourceModule || 'radar'}
          sourceRecordId={controlContext?.sourceRecordId || push.id}
        />
      )}
    </>
  )
}
