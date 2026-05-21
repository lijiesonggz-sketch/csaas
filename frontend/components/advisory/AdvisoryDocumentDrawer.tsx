'use client'

import {
  RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  Database,
  FileDown,
  FileText,
  PanelRightClose,
  PanelRightOpen,
  Star,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ADVISORY_LAYOUT } from '@/lib/advisory/layout'
import type {
  ThinkTankOutputExportFormat,
  ThinkTankOutputFavoriteInput,
  ThinkTankOutputKnowledgeBaseAssociationInput,
  ThinkTankOutputRatingInput,
  ThinkTankWorkflowOutput,
  ThinkTankWorkflowOutputSection,
} from '@/lib/advisory/outputs'
import { cn } from '@/lib/utils'

interface AdvisoryDocumentDrawerProps {
  open: boolean
  width?: number | string
  output: ThinkTankWorkflowOutput | null
  hasNewContent: boolean
  completionFeedback?: string
  liveAnnouncement?: string
  conversationInputRef?: RefObject<HTMLTextAreaElement>
  exportingFormat?: ThinkTankOutputExportFormat | null
  exportError?: string | null
  onOpenChange: (open: boolean) => void
  onWidthChange?: (width: number) => void
  onClearNewContent?: () => void
  onExportOutput?: (format: ThinkTankOutputExportFormat) => Promise<void> | void
  onDismissExportError?: () => void
  onSubmitOutputRating?: (input: ThinkTankOutputRatingInput) => Promise<void> | void
  onUpdateOutputFavorite?: (input: ThinkTankOutputFavoriteInput) => Promise<void> | void
  onAssociateOutputWithKnowledgeBase?: (
    input: ThinkTankOutputKnowledgeBaseAssociationInput
  ) => Promise<void> | void
}

type MarkdownBlock =
  | { type: 'heading'; level: 3 | 4; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }

export function AdvisoryDocumentDrawer({
  open,
  width = ADVISORY_LAYOUT.drawerDefaultWidth,
  output,
  hasNewContent,
  completionFeedback,
  liveAnnouncement,
  conversationInputRef,
  exportingFormat,
  exportError,
  onOpenChange,
  onWidthChange,
  onClearNewContent,
  onExportOutput,
  onDismissExportError,
  onSubmitOutputRating,
  onUpdateOutputFavorite,
  onAssociateOutputWithKnowledgeBase,
}: AdvisoryDocumentDrawerProps) {
  const latestSection = output?.sections?.at(-1) ?? null
  const outputRef = useRef<ThinkTankWorkflowOutput | null>(output)
  const latestSectionRef = useRef<HTMLElement | null>(null)
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const [selectedRating, setSelectedRating] = useState<number | null>(
    output?.assetState?.rating ?? null
  )
  const [feedbackText, setFeedbackText] = useState('')
  const [assetStatus, setAssetStatus] = useState<string | null>(null)
  const [assetError, setAssetError] = useState<string | null>(null)
  const [knowledgeBaseStatus, setKnowledgeBaseStatus] = useState<string | null>(null)
  const [knowledgeBaseError, setKnowledgeBaseError] = useState<string | null>(null)
  const [isSubmittingRating, setIsSubmittingRating] = useState(false)
  const [isUpdatingFavorite, setIsUpdatingFavorite] = useState(false)
  const [associatingKnowledgeBaseOutputId, setAssociatingKnowledgeBaseOutputId] = useState<
    string | null
  >(null)
  const widthStyle = typeof width === 'number' ? `${width}px` : width
  const hasExportableSections = Boolean(output?.sections?.length)
  const exportDisabled = !hasExportableSections || Boolean(exportingFormat)
  const isFavorited = output?.assetState?.isFavorited === true
  const isMutatingAssetState = isSubmittingRating || isUpdatingFavorite
  const knowledgeBaseAssociation = output?.knowledgeBaseAssociation
  const isKnowledgeBaseAssociated = knowledgeBaseAssociation?.status === 'associated'
  const isKnowledgeBasePending = knowledgeBaseAssociation?.status === 'pending'
  const isKnowledgeBaseFailed = knowledgeBaseAssociation?.status === 'failed'
  const hasReusableKnowledgeBaseContent = hasReusableReportContent(output)
  const isAssociatingKnowledgeBase = Boolean(
    output?.id && associatingKnowledgeBaseOutputId === output.id
  )
  const knowledgeBaseActionLabel =
    isKnowledgeBaseFailed || isKnowledgeBasePending ? '重试保存' : '保存到知识库'
  const knowledgeBaseStatusLabel = isKnowledgeBaseAssociated
    ? '已关联'
    : isKnowledgeBasePending
      ? '待同步'
      : isKnowledgeBaseFailed
        ? '关联失败'
        : '未关联'
  const maxWidthPx =
    typeof window === 'undefined'
      ? ADVISORY_LAYOUT.drawerMinWidth
      : Math.round(window.innerWidth * 0.5)

  useEffect(() => {
    outputRef.current = output
  }, [output])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        onOpenChange(false)
        conversationInputRef?.current?.focus({ preventScroll: true })
        return
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        onOpenChange(!open)
        if (!open) onClearNewContent?.()
        conversationInputRef?.current?.focus({ preventScroll: true })
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [conversationInputRef, onClearNewContent, onOpenChange, open])

  useEffect(() => {
    if (!open || !latestSection) return

    const schedule =
      typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame
        : (callback: FrameRequestCallback) => window.setTimeout(callback, 0)

    schedule(() => {
      if (typeof latestSectionRef.current?.scrollIntoView === 'function') {
        latestSectionRef.current.scrollIntoView({ block: 'nearest' })
      }
      conversationInputRef?.current?.focus({ preventScroll: true })
    })
  }, [conversationInputRef, latestSection, open])

  useEffect(() => {
    setSelectedRating(output?.assetState?.rating ?? null)
    setFeedbackText('')
    setAssetStatus(null)
    setAssetError(null)
    setKnowledgeBaseStatus(null)
    setKnowledgeBaseError(null)
  }, [output?.assetState?.rating, output?.id])

  const metadataSummary = useMemo(() => {
    if (!output) return null
    const metadata = output.aiLabelMetadata ?? {}
    const provider = readText(metadata.provider)
    const model = readText(metadata.model)
    const workflowKey = readText(metadata.workflow_key) ?? readText(metadata.workflowKey)

    return {
      provider,
      model,
      workflowKey,
      generator: readText(metadata.generator) ?? 'ThinkTank',
    }
  }, [output])

  const handleOpen = () => {
    onOpenChange(true)
    onClearNewContent?.()
    conversationInputRef?.current?.focus({ preventScroll: true })
  }

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!open) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    resizeStateRef.current = {
      startX: readPointerClientX(event),
      startWidth: resolveNumericWidth(width),
    }
    window.addEventListener('pointermove', handleWindowResizePointerMove)
    window.addEventListener('pointerup', handleWindowResizePointerUp, { once: true })
    window.addEventListener('pointercancel', handleWindowResizePointerUp, { once: true })
    window.addEventListener('blur', handleWindowResizePointerUp, { once: true })
  }

  const handleWindowResizePointerMove = (event: PointerEvent) => {
    if (!resizeStateRef.current || !onWidthChange) return

    const nextWidth = clampDrawerWidth(
      resizeStateRef.current.startWidth + resizeStateRef.current.startX - readPointerClientX(event)
    )
    onWidthChange(nextWidth)
  }

  const handleWindowResizePointerUp = () => {
    resizeStateRef.current = null
    window.removeEventListener('pointermove', handleWindowResizePointerMove)
    window.removeEventListener('pointerup', handleWindowResizePointerUp)
    window.removeEventListener('pointercancel', handleWindowResizePointerUp)
    window.removeEventListener('blur', handleWindowResizePointerUp)
  }

  const handleResizePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    handleWindowResizePointerMove(event.nativeEvent)
  }

  const handleResizePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    resizeStateRef.current = null
    window.removeEventListener('pointermove', handleWindowResizePointerMove)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const handleExport = (format: ThinkTankOutputExportFormat) => {
    if (exportDisabled) return

    Promise.resolve(onExportOutput?.(format)).finally(() => {
      conversationInputRef?.current?.focus({ preventScroll: true })
    })
  }

  const handleSubmitRating = async () => {
    if (!output || !selectedRating || !onSubmitOutputRating || isSubmittingRating) return
    setIsSubmittingRating(true)
    setAssetStatus(null)
    setAssetError(null)

    try {
      await onSubmitOutputRating({
        outputId: output.id,
        rating: selectedRating,
        ...(feedbackText.trim() ? { feedbackText: feedbackText.trim() } : {}),
      })
      setAssetStatus('评分已提交')
      setFeedbackText('')
      conversationInputRef?.current?.focus({ preventScroll: true })
    } catch (error) {
      setAssetError(readActionError(error, '评分提交失败，请稍后重试。'))
    } finally {
      setIsSubmittingRating(false)
    }
  }

  const handleToggleFavorite = async () => {
    if (!output || !onUpdateOutputFavorite || isUpdatingFavorite) return
    const nextFavorited = !isFavorited
    setIsUpdatingFavorite(true)
    setAssetStatus(null)
    setAssetError(null)

    try {
      await onUpdateOutputFavorite({
        outputId: output.id,
        isFavorited: nextFavorited,
      })
      setAssetStatus(nextFavorited ? '已收藏' : '已取消收藏')
      conversationInputRef?.current?.focus({ preventScroll: true })
    } catch (error) {
      setAssetError(readActionError(error, '收藏状态更新失败，请稍后重试。'))
    } finally {
      setIsUpdatingFavorite(false)
    }
  }

  const handleAssociateKnowledgeBase = async () => {
    if (!output || !onAssociateOutputWithKnowledgeBase || isAssociatingKnowledgeBase) return
    if (!hasReusableKnowledgeBaseContent) return
    const requestedOutputId = output.id
    setAssociatingKnowledgeBaseOutputId(requestedOutputId)
    setKnowledgeBaseStatus(null)
    setKnowledgeBaseError(null)

    try {
      await onAssociateOutputWithKnowledgeBase({ outputId: requestedOutputId })
      if (outputRef.current?.id === requestedOutputId) {
        setKnowledgeBaseStatus('知识库关联状态已更新')
        conversationInputRef?.current?.focus({ preventScroll: true })
      }
    } catch {
      if (outputRef.current?.id === requestedOutputId) {
        setKnowledgeBaseError('知识库暂不可用，报告仍保留在 ThinkTank，可稍后重试。')
      }
    } finally {
      setAssociatingKnowledgeBaseOutputId((current) =>
        current === requestedOutputId ? null : current
      )
    }
  }

  useEffect(() => {
    return () => {
      resizeStateRef.current = null
      window.removeEventListener('pointermove', handleWindowResizePointerMove)
      window.removeEventListener('pointerup', handleWindowResizePointerUp)
      window.removeEventListener('pointercancel', handleWindowResizePointerUp)
      window.removeEventListener('blur', handleWindowResizePointerUp)
    }
  })

  if (!open) {
    return (
      <aside
        aria-label="咨询文档抽屉"
        className="relative flex min-w-0 flex-col items-center border-l border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-muted-bg))] px-2 py-4"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={hasNewContent ? '打开咨询文档抽屉，新报告内容' : '打开咨询文档抽屉'}
          aria-expanded="false"
          title="打开咨询文档抽屉查看报告草稿"
          onClick={handleOpen}
          className="text-[hsl(var(--advisory-foreground))]"
        >
          <PanelRightOpen className="h-5 w-5" />
        </Button>
        {hasNewContent && (
          <p
            role="status"
            aria-live="polite"
            aria-label="咨询文档新内容提示"
            className="mt-3 rounded-sm border border-[hsl(var(--advisory-success-border))] bg-[hsl(var(--advisory-success-bg))] px-2 py-1 text-center text-[10px] leading-4 text-[hsl(var(--advisory-success-foreground))]"
          >
            新的报告章节已生成
          </p>
        )}
        <div className="mt-4 flex flex-col items-center gap-2 text-[hsl(var(--advisory-muted-foreground))]">
          <FileText className="h-4 w-4" />
          <span className="text-xs font-medium [writing-mode:vertical-rl]">文档</span>
          <span className="text-xs font-medium [writing-mode:vertical-rl]">
            {latestSection ? '报告草稿' : '暂无文档'}
          </span>
        </div>
      </aside>
    )
  }

  return (
    <aside
      role="complementary"
      aria-label="咨询文档抽屉"
      className="relative flex min-w-0 flex-col overflow-hidden border-l border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))]"
      style={{
        width: widthStyle,
        minWidth: ADVISORY_LAYOUT.drawerMinWidth,
        maxWidth: ADVISORY_LAYOUT.drawerMaxWidth,
      }}
    >
      <div
        role="separator"
        aria-label="调整咨询文档抽屉宽度"
        aria-orientation="vertical"
        aria-valuemin={ADVISORY_LAYOUT.drawerMinWidth}
        aria-valuemax={maxWidthPx}
        aria-valuenow={resolveNumericWidth(width)}
        tabIndex={0}
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        className="absolute left-0 top-0 z-10 h-full w-1 cursor-col-resize bg-transparent hover:bg-[hsl(var(--advisory-border))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[hsl(var(--ring))]"
      />
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[hsl(var(--advisory-border))] px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase text-[hsl(var(--advisory-muted-foreground))]">
            Document
          </p>
          <h2 className="truncate text-base font-semibold text-[hsl(var(--advisory-foreground))]">
            {output?.title ?? '报告草稿'}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="导出 Markdown"
            aria-busy={exportingFormat === 'markdown' ? 'true' : undefined}
            title={hasExportableSections ? '导出 Markdown' : '报告至少需要一个章节后才能导出'}
            disabled={exportDisabled}
            onClick={() => handleExport('markdown')}
            className="h-8 gap-1 px-2 text-xs"
          >
            <FileText className="h-4 w-4" />
            <span>MD</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="导出 PDF"
            aria-busy={exportingFormat === 'pdf' ? 'true' : undefined}
            title={hasExportableSections ? '导出 PDF' : '报告至少需要一个章节后才能导出'}
            disabled={exportDisabled}
            onClick={() => handleExport('pdf')}
            className="h-8 gap-1 px-2 text-xs"
          >
            <FileDown className="h-4 w-4" />
            <span>PDF</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="关闭咨询文档抽屉"
            title="关闭咨询文档抽屉"
            onClick={() => {
              onOpenChange(false)
              conversationInputRef?.current?.focus({ preventScroll: true })
            }}
            className="h-8 w-8 shrink-0"
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p
        role="status"
        aria-live="polite"
        aria-label="ThinkTank 输出草稿更新状态"
        className="sr-only"
      >
        {liveAnnouncement ?? ''}
      </p>

      {completionFeedback && (
        <p className="mx-4 mt-3 rounded-sm border border-[hsl(var(--advisory-success-border))] bg-[hsl(var(--advisory-success-bg))] px-3 py-2 text-xs leading-5 text-[hsl(var(--advisory-success-foreground))]">
          {completionFeedback}
        </p>
      )}

      {exportError && (
        <div
          role="alert"
          className="mx-4 mt-3 flex items-start justify-between gap-3 rounded-sm border border-[hsl(var(--destructive))] bg-[hsl(var(--advisory-panel))] px-3 py-2 text-xs leading-5 text-[hsl(var(--destructive))]"
        >
          <p>{exportError}</p>
          {onDismissExportError && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="关闭导出错误"
              title="关闭导出错误"
              onClick={onDismissExportError}
              className="h-6 w-6 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      {output && (
        <section
          aria-label="报告评分、收藏与知识库"
          className="border-b border-[hsl(var(--advisory-border))] px-4 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div role="group" aria-label="报告评分" className="flex flex-wrap items-center gap-1">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <Button
                    key={rating}
                    type="button"
                    variant={selectedRating === rating ? 'default' : 'outline'}
                    size="sm"
                    aria-label={`评分 ${rating} 分`}
                    aria-pressed={selectedRating === rating}
                    disabled={isMutatingAssetState}
                    onClick={() => setSelectedRating(rating)}
                    className="h-7 min-w-8 rounded-sm px-2 text-xs"
                  >
                    {rating}
                  </Button>
                ))}
                {output.assetState?.feedbackTextPresent && (
                  <span className="ml-2 text-xs text-[hsl(var(--advisory-muted-foreground))]">
                    已提交文字反馈
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-end gap-2">
                <Textarea
                  aria-label="评分反馈（可选）"
                  value={feedbackText}
                  maxLength={2000}
                  placeholder="评分反馈（可选）"
                  onChange={(event) => setFeedbackText(event.target.value)}
                  className="min-h-9 flex-1 resize-none rounded-sm border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] px-2 py-1 text-xs leading-5"
                />
                <Button
                  type="button"
                  size="sm"
                  aria-label="提交评分"
                  disabled={!selectedRating || isMutatingAssetState || !onSubmitOutputRating}
                  onClick={handleSubmitRating}
                  className="h-9 shrink-0 rounded-sm px-3 text-xs"
                >
                  {isSubmittingRating ? '提交中' : '提交评分'}
                </Button>
              </div>
            </div>
            <Button
              type="button"
              variant={isFavorited ? 'default' : 'outline'}
              size="icon"
              aria-label={isFavorited ? '取消收藏报告' : '收藏报告'}
              aria-pressed={isFavorited}
              disabled={isMutatingAssetState || !onUpdateOutputFavorite}
              title={isFavorited ? '取消收藏报告' : '收藏报告'}
              onClick={handleToggleFavorite}
              className="h-9 w-9 shrink-0 rounded-sm"
            >
              <Star className={cn('h-4 w-4', isFavorited && 'fill-current')} />
            </Button>
          </div>
          {(assetStatus || assetError) && (
            <p
              role={assetError ? 'alert' : 'status'}
              className={cn(
                'mt-2 text-xs leading-5',
                assetError
                  ? 'text-[hsl(var(--destructive))]'
                  : 'text-[hsl(var(--advisory-success-foreground))]'
              )}
            >
              {assetError ?? assetStatus}
            </p>
          )}
          <div className="mt-3 flex items-start justify-between gap-3 border-t border-[hsl(var(--advisory-border))] pt-3">
            <div className="min-w-0 text-xs leading-5">
              <p className="font-medium text-[hsl(var(--advisory-foreground))]">知识库关联</p>
              <p className="text-[hsl(var(--advisory-muted-foreground))]">
                {knowledgeBaseStatusLabel}
                {knowledgeBaseAssociation?.retryCount
                  ? ` · 已尝试 ${knowledgeBaseAssociation.retryCount} 次`
                  : ''}
              </p>
              {(toSafeKnowledgeBaseMessage(
                knowledgeBaseAssociation?.message,
                knowledgeBaseAssociation?.status
              ) ||
                knowledgeBaseStatus ||
                knowledgeBaseError) && (
                <p
                  role={knowledgeBaseError || isKnowledgeBaseFailed ? 'alert' : 'status'}
                  className={cn(
                    'mt-1',
                    knowledgeBaseError || isKnowledgeBaseFailed
                      ? 'text-[hsl(var(--destructive))]'
                      : 'text-[hsl(var(--advisory-muted-foreground))]'
                  )}
                >
                  {knowledgeBaseError ??
                    toSafeKnowledgeBaseMessage(
                      knowledgeBaseAssociation?.message,
                      knowledgeBaseAssociation?.status
                    ) ??
                    knowledgeBaseStatus}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant={isKnowledgeBaseAssociated ? 'outline' : 'default'}
              size="sm"
              aria-label={knowledgeBaseActionLabel}
              disabled={
                isAssociatingKnowledgeBase ||
                isKnowledgeBaseAssociated ||
                !hasReusableKnowledgeBaseContent ||
                !onAssociateOutputWithKnowledgeBase
              }
              title={
                hasReusableKnowledgeBaseContent
                  ? knowledgeBaseActionLabel
                  : '报告至少需要一个章节后才能保存到知识库'
              }
              onClick={handleAssociateKnowledgeBase}
              className="h-8 shrink-0 gap-1 rounded-sm px-3 text-xs"
            >
              <Database className="h-4 w-4" />
              <span>{isAssociatingKnowledgeBase ? '保存中' : knowledgeBaseActionLabel}</span>
            </Button>
          </div>
        </section>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {!output || output.sections.length === 0 ? (
          <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
            <FileText className="h-8 w-8 text-[hsl(var(--advisory-muted-foreground))]" />
            <p className="mt-4 text-lg font-semibold text-[hsl(var(--advisory-foreground))]">
              报告草稿
            </p>
            <p className="mt-2 text-sm leading-6 text-[hsl(var(--advisory-muted-foreground))]">
              完成工作流步骤后，报告章节会显示在这里。
            </p>
          </div>
        ) : (
          <article className="space-y-4 text-sm leading-6 text-[hsl(var(--advisory-foreground))]">
            <header className="border-b border-[hsl(var(--advisory-border))] pb-4">
              {output.summary && (
                <p className="mt-2 text-sm text-[hsl(var(--advisory-muted-foreground))]">
                  {output.summary}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[hsl(var(--advisory-muted-foreground))]">
                <span className="rounded-sm border border-[hsl(var(--advisory-border))] px-2 py-1">
                  [AI Generated]
                </span>
                <span>{metadataSummary?.generator}</span>
                {metadataSummary?.provider && <span>{metadataSummary.provider}</span>}
                {metadataSummary?.model && <span>{metadataSummary.model}</span>}
              </div>
            </header>

            {output.sections.map((section) => (
              <section
                key={section.id}
                ref={(node) => {
                  if (section.id === latestSection?.id) latestSectionRef.current = node
                }}
                aria-label={`报告章节：${section.heading}`}
                className="rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-muted-bg))] p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-base font-semibold">{section.heading}</h4>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--advisory-muted-foreground))]">
                    <span>{section.aiLabel || '[AI Generated]'}</span>
                    <span>Step {section.stepIndex}</span>
                  </div>
                </div>
                <MarkdownContent content={section.contentMarkdown} />
                <SectionMetadata section={section} />
              </section>
            ))}
          </article>
        )}
      </div>
    </aside>
  )
}

function SectionMetadata({ section }: { section: ThinkTankWorkflowOutputSection }) {
  const stepLabel = readText(section.metadata?.stepLabel) ?? readText(section.metadata?.step_label)
  const generatedAt =
    readText(section.metadata?.generatedAt) ?? readText(section.metadata?.generated_at)

  if (!stepLabel && !generatedAt) return null

  return (
    <p className="mt-3 flex flex-wrap gap-2 border-t border-[hsl(var(--advisory-border))] pt-3 text-xs text-[hsl(var(--advisory-muted-foreground))]">
      {stepLabel && <span>{stepLabel}</span>}
      {generatedAt && <span>{generatedAt}</span>}
    </p>
  )
}

function MarkdownContent({ content }: { content: string }) {
  const blocks = parseMarkdownBlocks(content)

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const HeadingTag = `h${block.level}` as 'h3' | 'h4'
          return (
            <HeadingTag key={`${block.type}-${index}`} className="font-semibold">
              {block.text}
            </HeadingTag>
          )
        }
        if (block.type === 'list') {
          return (
            <ul key={`${block.type}-${index}`} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`${index}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          )
        }
        return (
          <p key={`${block.type}-${index}`} className="whitespace-pre-wrap">
            {block.text}
          </p>
        )
      })}
    </div>
  )
}

function parseMarkdownBlocks(rawContent: string): MarkdownBlock[] {
  const lines = rawContent.split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const trimmed = lines[index].trim()
    if (!trimmed) {
      index += 1
      continue
    }
    const heading = trimmed.match(/^(#{1,2})\s+(.+)$/)
    if (heading) {
      blocks.push({
        type: 'heading',
        level: (heading[1].length + 2) as 3 | 4,
        text: sanitizeAiMarkdown(heading[2]),
      })
      index += 1
      continue
    }
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = []
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(sanitizeAiMarkdown(lines[index].trim().replace(/^[-*]\s+/, '')))
        index += 1
      }
      blocks.push({ type: 'list', items })
      continue
    }
    const paragraphLines: string[] = []
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,2})\s+/.test(lines[index].trim()) &&
      !/^[-*]\s+/.test(lines[index].trim())
    ) {
      paragraphLines.push(lines[index])
      index += 1
    }
    blocks.push({ type: 'paragraph', text: sanitizeAiMarkdown(paragraphLines.join('\n')) })
  }

  return blocks
}

function sanitizeAiMarkdown(content: string): string {
  return content.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
}

function readText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readActionError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

function hasReusableReportContent(output: ThinkTankWorkflowOutput | null): boolean {
  if (!output) return false
  if (output.status === 'completed') return true
  if (readText(output.contentMarkdown)) return true

  return output.sections.some(
    (section) => readText(section.heading) || readText(section.contentMarkdown)
  )
}

function toSafeKnowledgeBaseMessage(
  message: string | null | undefined,
  status: 'associated' | 'pending' | 'failed' | null | undefined
): string | null {
  if (status === 'pending' || status === 'failed') {
    return '知识库暂不可用，报告仍保留在 ThinkTank，可稍后重试。'
  }

  return readText(message)
}

function resolveNumericWidth(width: number | string): number {
  if (typeof width === 'number') return width
  if (width.endsWith('vw') && typeof window !== 'undefined') {
    return Math.round((Number.parseFloat(width) / 100) * window.innerWidth)
  }
  const parsed = Number.parseFloat(width)
  return Number.isFinite(parsed) ? parsed : ADVISORY_LAYOUT.drawerMinWidth
}

function clampDrawerWidth(width: number): number {
  const maxWidth =
    typeof window === 'undefined'
      ? ADVISORY_LAYOUT.drawerMinWidth
      : Math.round(window.innerWidth * 0.5)

  return Math.min(maxWidth, Math.max(ADVISORY_LAYOUT.drawerMinWidth, Math.round(width)))
}

type PointerClientEvent = {
  clientX?: number
  pageX?: number
  nativeEvent?: {
    clientX?: number
    pageX?: number
  }
}

function readPointerClientX(event: PointerClientEvent): number {
  const candidates = [
    event.nativeEvent?.clientX,
    event.clientX,
    event.nativeEvent?.pageX,
    event.pageX,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate
    }
  }

  return 0
}
