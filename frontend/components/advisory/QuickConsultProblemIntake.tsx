'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  Search,
  SendHorizontal,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  QUICK_CONSULT_EMPTY_PROBLEM_MESSAGE,
  QUICK_CONSULT_FEEDBACK_FAILED_MESSAGE,
  QUICK_CONSULT_FEEDBACK_MAX_LENGTH,
  QUICK_CONSULT_PROBLEM_MAX_LENGTH,
  QUICK_CONSULT_PROBLEM_TOO_LONG_MESSAGE,
  QUICK_CONSULT_START_FAILED_MESSAGE,
  readQuickConsultDraft,
  saveQuickConsultDraft,
  startQuickConsult,
  submitQuickConsultRecommendationFeedback,
  type QuickConsultMethodRecommendation,
  type QuickConsultStartResult,
} from '@/lib/advisory/quick-consult'
import {
  fetchThinkTankManualBrowseCatalog,
  type ThinkTankManualBrowseCatalog,
  type ThinkTankManualBrowseWorkflow,
  type ThinkTankManualMethodChoice,
  type ThinkTankWorkflowLaunchOptions,
} from '@/lib/advisory/workflows'
import { cn } from '@/lib/utils'

type QuickConsultStatus = 'idle' | 'submitting' | 'clarification' | 'analysis' | 'error'
type ManualBrowseStatus = 'idle' | 'loading' | 'ready' | 'error'
type RecommendationFeedbackStatus = 'idle' | 'submitting' | 'saved' | 'error'

interface QuickConsultProblemIntakeProps {
  userIdentity: string | null
  className?: string
  onBeforeStartQuickConsult?: () => Promise<boolean> | boolean
  onOpenEnterpriseBackgroundSettings?: () => void
  onAcceptRecommendation?: (
    workflowKey: string,
    metadata: ThinkTankWorkflowLaunchOptions
  ) => Promise<void> | void
}

export function QuickConsultProblemIntake({
  userIdentity,
  className,
  onBeforeStartQuickConsult,
  onOpenEnterpriseBackgroundSettings,
  onAcceptRecommendation,
}: QuickConsultProblemIntakeProps) {
  const [problem, setProblem] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<QuickConsultStatus>('idle')
  const [result, setResult] = useState<QuickConsultStartResult | null>(null)
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({})
  const [expandedRecommendationIds, setExpandedRecommendationIds] = useState<Set<string>>(
    () => new Set()
  )
  const [acceptingRecommendationId, setAcceptingRecommendationId] = useState<string | null>(null)
  const [manualBrowseOpen, setManualBrowseOpen] = useState(false)
  const [manualBrowseStatus, setManualBrowseStatus] = useState<ManualBrowseStatus>('idle')
  const [manualBrowseCatalog, setManualBrowseCatalog] =
    useState<ThinkTankManualBrowseCatalog | null>(null)
  const [manualBrowseError, setManualBrowseError] = useState<string | null>(null)
  const [manualBrowseQuery, setManualBrowseQuery] = useState('')
  const [launchingManualChoiceId, setLaunchingManualChoiceId] = useState<string | null>(null)
  const [selectedFeedbackRating, setSelectedFeedbackRating] = useState<number | null>(null)
  const [recommendationFeedbackText, setRecommendationFeedbackText] = useState('')
  const [recommendationFeedbackStatus, setRecommendationFeedbackStatus] =
    useState<RecommendationFeedbackStatus>('idle')
  const [recommendationFeedbackError, setRecommendationFeedbackError] = useState<string | null>(
    null
  )
  const [recommendationFeedbackDismissed, setRecommendationFeedbackDismissed] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const manualBrowserRef = useRef<HTMLElement>(null)
  const submitInFlightRef = useRef(false)
  const isSubmitting = status === 'submitting'

  useEffect(() => {
    setProblem(readQuickConsultDraft(userIdentity))
    setError(null)
    setStatus('idle')
    setResult(null)
    setClarificationAnswers({})
    setExpandedRecommendationIds(new Set())
    setAcceptingRecommendationId(null)
    setManualBrowseOpen(false)
    setManualBrowseStatus('idle')
    setManualBrowseCatalog(null)
    setManualBrowseError(null)
    setManualBrowseQuery('')
    setLaunchingManualChoiceId(null)
    resetRecommendationFeedback()
  }, [userIdentity])

  useEffect(() => {
    if (!manualBrowseOpen) return

    manualBrowserRef.current?.focus({ preventScroll: true })
  }, [manualBrowseOpen])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = '52px'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
  }, [problem])

  const handleProblemChange = (nextProblem: string) => {
    setProblem(nextProblem)
    setError(null)
    if (result) {
      setResult(null)
      setStatus('idle')
      setClarificationAnswers({})
      setExpandedRecommendationIds(new Set())
      setAcceptingRecommendationId(null)
      setManualBrowseOpen(false)
      setManualBrowseStatus('idle')
      setManualBrowseCatalog(null)
      setManualBrowseError(null)
      setManualBrowseQuery('')
      setLaunchingManualChoiceId(null)
      resetRecommendationFeedback()
    }
    saveQuickConsultDraft({ userIdentity, problem: nextProblem })
  }

  const resetRecommendationFeedback = () => {
    setSelectedFeedbackRating(null)
    setRecommendationFeedbackText('')
    setRecommendationFeedbackStatus('idle')
    setRecommendationFeedbackError(null)
    setRecommendationFeedbackDismissed(false)
  }

  const ensureCanStartQuickConsult = async () => {
    if (!onBeforeStartQuickConsult) return true
    return (await onBeforeStartQuickConsult()) !== false
  }

  const handleSubmit = async () => {
    if (isSubmitting || submitInFlightRef.current) return

    const normalizedProblem = problem.trim()
    if (!normalizedProblem) {
      setError(QUICK_CONSULT_EMPTY_PROBLEM_MESSAGE)
      setStatus('error')
      return
    }
    if (normalizedProblem.length > QUICK_CONSULT_PROBLEM_MAX_LENGTH) {
      setError(QUICK_CONSULT_PROBLEM_TOO_LONG_MESSAGE)
      setStatus('error')
      return
    }

    setError(null)
    setStatus('submitting')
    submitInFlightRef.current = true

    try {
      const canStart = await ensureCanStartQuickConsult()
      if (!canStart) {
        setStatus('idle')
        return
      }

      const response = await startQuickConsult({ problem: normalizedProblem })
      setResult(response)
      setStatus(response.status === 'clarification_required' ? 'clarification' : 'analysis')
      setClarificationAnswers({})
      setExpandedRecommendationIds(new Set())
      setAcceptingRecommendationId(null)
      setManualBrowseOpen(false)
      setManualBrowseStatus('idle')
      setManualBrowseCatalog(null)
      setManualBrowseError(null)
      setManualBrowseQuery('')
      setLaunchingManualChoiceId(null)
      resetRecommendationFeedback()
      if (response.status === 'analysis_started') {
        saveQuickConsultDraft({ userIdentity, problem: '' })
      }
      textareaRef.current?.focus({ preventScroll: true })
    } catch (submitError) {
      setResult(null)
      setStatus('error')
      setAcceptingRecommendationId(null)
      setLaunchingManualChoiceId(null)
      setError(
        submitError instanceof Error && submitError.message.trim()
          ? submitError.message
          : QUICK_CONSULT_START_FAILED_MESSAGE
      )
    } finally {
      submitInFlightRef.current = false
    }
  }

  const handleClarificationAnswerChange = (question: string, answer: string) => {
    setError(null)
    if (result?.status === 'clarification_required') {
      setStatus('clarification')
    }
    setClarificationAnswers((current) => ({
      ...current,
      [question]: answer,
    }))
  }

  const handleClarificationSubmit = async () => {
    if (
      !result ||
      result.status !== 'clarification_required' ||
      isSubmitting ||
      submitInFlightRef.current
    )
      return

    const questions = clarificationQuestions.slice(0, 2)
    if (questions.length === 0) {
      setError(QUICK_CONSULT_START_FAILED_MESSAGE)
      setStatus('error')
      return
    }
    const answers = questions
      .map((question) => ({
        question,
        answer: (clarificationAnswers[question] ?? '').trim(),
      }))
      .filter((answer) => answer.answer)

    if (answers.length !== questions.length) {
      setError('请先回答澄清问题后再继续。')
      setStatus('error')
      return
    }

    setError(null)
    setStatus('submitting')
    submitInFlightRef.current = true

    try {
      const canStart = await ensureCanStartQuickConsult()
      if (!canStart) {
        setStatus('clarification')
        return
      }

      const response = await startQuickConsult({
        problem: originalProblem,
        contextId: result.contextId,
        originalProblem,
        clarificationAnswers: answers,
      })
      setResult(response)
      setStatus(response.status === 'clarification_required' ? 'clarification' : 'analysis')
      setExpandedRecommendationIds(new Set())
      setAcceptingRecommendationId(null)
      setManualBrowseOpen(false)
      setManualBrowseStatus('idle')
      setManualBrowseCatalog(null)
      setManualBrowseError(null)
      setManualBrowseQuery('')
      setLaunchingManualChoiceId(null)
      resetRecommendationFeedback()
      if (response.status === 'analysis_started') {
        saveQuickConsultDraft({ userIdentity, problem: '' })
      }
      textareaRef.current?.focus({ preventScroll: true })
    } catch (submitError) {
      setStatus('error')
      setAcceptingRecommendationId(null)
      setLaunchingManualChoiceId(null)
      setError(
        submitError instanceof Error && submitError.message.trim()
          ? submitError.message
          : QUICK_CONSULT_START_FAILED_MESSAGE
      )
    } finally {
      submitInFlightRef.current = false
    }
  }

  const statusText = readQuickConsultStatusText(status)
  const originalProblem =
    result?.originalProblemContext?.text ?? result?.originalProblem ?? problem.trim()
  const clarificationQuestions = Array.isArray(result?.clarificationQuestions)
    ? result.clarificationQuestions
    : Array.isArray(result?.questions)
      ? result.questions
      : []
  const classification = result?.classification
  const recommendations =
    result?.status === 'analysis_started' &&
    classification?.confidenceLevel !== 'low' &&
    Array.isArray(result.recommendations)
      ? result.recommendations
      : []
  const recommendationContext = result?.recommendationContext ?? result?.enterpriseContext
  const contextCompletionPrompt = recommendationContext?.contextCompletionPrompt
  const handleManualBrowse = async () => {
    if (manualBrowseStatus === 'loading') return

    setManualBrowseOpen(true)
    setManualBrowseStatus('loading')
    setManualBrowseError(null)

    try {
      const catalog = await fetchThinkTankManualBrowseCatalog({
        quickConsultContextId: result?.contextId,
      })
      setManualBrowseCatalog(catalog)
      setManualBrowseStatus('ready')
    } catch (browseError) {
      setManualBrowseCatalog(null)
      setManualBrowseStatus('error')
      setManualBrowseError(readManualBrowseErrorMessage(browseError))
    }
  }
  const toggleRecommendationRationale = (recommendationId: string) => {
    setExpandedRecommendationIds((current) => {
      const next = new Set(current)
      if (next.has(recommendationId)) {
        next.delete(recommendationId)
      } else {
        next.add(recommendationId)
      }
      return next
    })
  }
  const handleAcceptRecommendation = async (recommendation: QuickConsultMethodRecommendation) => {
    if (!onAcceptRecommendation || acceptingRecommendationId) return

    setError(null)
    setAcceptingRecommendationId(recommendation.id)
    try {
      await onAcceptRecommendation(recommendation.workflowKey, {
        quickConsultContextId: result?.contextId ?? '',
        acceptedRecommendationId: recommendation.recommendationId,
        acceptedRecommendation: true,
      })
    } catch (acceptError) {
      setError(
        acceptError instanceof Error && acceptError.message.trim()
          ? acceptError.message
          : QUICK_CONSULT_START_FAILED_MESSAGE
      )
      setStatus('error')
    } finally {
      setAcceptingRecommendationId(null)
    }
  }
  const handleLaunchManualWorkflow = async (workflow: ThinkTankManualBrowseWorkflow) => {
    const choiceId = `workflow:${workflow.workflowKey}`
    if (!onAcceptRecommendation || launchingManualChoiceId) return

    setError(null)
    setLaunchingManualChoiceId(choiceId)
    try {
      await onAcceptRecommendation(workflow.workflowKey, {
        quickConsultContextId: result?.contextId,
        manualChoice: true,
        manualChoiceKind: 'workflow',
        manualChoiceId: choiceId,
        manualChoiceLabel: workflow.displayName,
      })
    } catch (launchError) {
      setError(readManualBrowseErrorMessage(launchError))
      setStatus('error')
    } finally {
      setLaunchingManualChoiceId(null)
    }
  }
  const handleLaunchManualMethod = async (method: ThinkTankManualMethodChoice) => {
    if (!onAcceptRecommendation || launchingManualChoiceId) return

    setError(null)
    setLaunchingManualChoiceId(method.id)
    try {
      await onAcceptRecommendation(method.workflowKey, {
        quickConsultContextId: result?.contextId,
        manualChoice: true,
        manualChoiceKind: 'method',
        manualChoiceId: method.id,
        manualChoiceLabel: method.methodName,
      })
    } catch (launchError) {
      setError(readManualBrowseErrorMessage(launchError))
      setStatus('error')
    } finally {
      setLaunchingManualChoiceId(null)
    }
  }
  const handleSubmitRecommendationFeedback = async () => {
    if (!result?.contextId || selectedFeedbackRating === null) return
    if (recommendationFeedbackStatus === 'submitting' || recommendationFeedbackStatus === 'saved') {
      return
    }

    setRecommendationFeedbackStatus('submitting')
    setRecommendationFeedbackError(null)

    try {
      await submitQuickConsultRecommendationFeedback({
        quickConsultContextId: result.contextId,
        rating: selectedFeedbackRating,
        feedbackText: recommendationFeedbackText,
        recommendationIds: recommendations.map((recommendation) => recommendation.recommendationId),
      })
      setRecommendationFeedbackStatus('saved')
    } catch (feedbackError) {
      setRecommendationFeedbackStatus('error')
      setRecommendationFeedbackError(
        feedbackError instanceof Error && feedbackError.message.trim()
          ? feedbackError.message
          : QUICK_CONSULT_FEEDBACK_FAILED_MESSAGE
      )
    }
  }
  const normalizedManualBrowseQuery = manualBrowseQuery.trim().toLowerCase()
  const visibleManualWorkflows = (manualBrowseCatalog?.workflows ?? []).filter((workflow) =>
    matchesManualBrowseQuery(
      [workflow.displayName, workflow.scenarioLabel, workflow.description],
      normalizedManualBrowseQuery
    )
  )
  const visibleManualMethods = (manualBrowseCatalog?.methodChoices ?? []).filter((method) =>
    matchesManualBrowseQuery(
      [method.methodName, method.category, method.phase, method.description, method.workflowKey],
      normalizedManualBrowseQuery
    )
  )
  const shouldShowRecommendationFeedback =
    recommendations.length > 0 && !recommendationFeedbackDismissed
  const isRecommendationFeedbackSubmitting = recommendationFeedbackStatus === 'submitting'
  const isRecommendationFeedbackSaved = recommendationFeedbackStatus === 'saved'

  return (
    <section
      role="region"
      aria-label="Quick Consult"
      className={cn(
        'mx-auto flex w-full max-w-4xl flex-col gap-4 rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] p-5 text-left shadow-sm',
        className
      )}
    >
      <div>
        <h2 className="text-lg font-semibold text-[hsl(var(--advisory-foreground))]">
          Quick Consult
        </h2>
        <p className="mt-1 text-sm leading-6 text-[hsl(var(--advisory-muted-foreground))]">
          选择一个工作流后，对话将在这里开始。
        </p>
      </div>

      <form
        aria-label="Quick Consult problem intake"
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
      >
        <div className="space-y-2">
          <Label
            htmlFor="quick-consult-problem"
            className="text-sm font-medium text-[hsl(var(--advisory-foreground))]"
          >
            Describe the problem
          </Label>
          <Textarea
            ref={textareaRef}
            id="quick-consult-problem"
            aria-multiline="true"
            value={problem}
            maxLength={QUICK_CONSULT_PROBLEM_MAX_LENGTH + 1}
            disabled={isSubmitting}
            onChange={(event) => handleProblemChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void handleSubmit()
              }
            }}
            className="min-h-[52px] max-h-[200px] resize-none rounded-sm border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] text-sm leading-6 text-[hsl(var(--advisory-foreground))]"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[hsl(var(--advisory-muted-foreground))]">
            {problem.length}/{QUICK_CONSULT_PROBLEM_MAX_LENGTH}
          </span>
          <Button type="submit" disabled={isSubmitting} className="h-10 rounded-sm px-4">
            <SendHorizontal className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Starting quick consult' : 'Start quick consult'}
          </Button>
        </div>
      </form>

      <div
        role="status"
        aria-live="polite"
        aria-label="Quick Consult status"
        className="min-h-6 text-sm leading-6 text-[hsl(var(--advisory-muted-foreground))]"
      >
        {statusText}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-sm border border-[hsl(var(--destructive))] bg-[hsl(var(--advisory-panel))] px-3 py-2 text-sm leading-6 text-[hsl(var(--destructive))]"
        >
          {error}
        </p>
      )}

      {classification && (
        <section
          role="region"
          aria-label="Quick Consult problem types"
          className="rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-muted-bg))] p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[hsl(var(--advisory-foreground))]">
                问题类型识别
              </h3>
              <p className="mt-1 text-sm leading-6 text-[hsl(var(--advisory-foreground))]">
                {classification.scenarioLanguage.label}
              </p>
            </div>
            <span className="rounded-sm border border-[hsl(var(--advisory-border))] px-2 py-1 text-xs text-[hsl(var(--advisory-muted-foreground))]">
              {readClassificationConfidenceLabel(classification.confidenceLevel)}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[hsl(var(--advisory-muted-foreground))]">
            {classification.scenarioLanguage.summary}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm text-[hsl(var(--advisory-foreground))]">
            {classification.problemTypes.map((problemType) => (
              <li
                key={problemType.id}
                className="rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] px-2 py-1"
              >
                {problemType.label}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm leading-6 text-[hsl(var(--advisory-muted-foreground))]">
            {classification.scenarioLanguage.guidance}
          </p>
          {classification.confidenceLevel === 'low' && classification.manualBrowseHint && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="text-sm leading-6 text-[hsl(var(--advisory-muted-foreground))]">
                {classification.manualBrowseHint}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleManualBrowse()}
                className="h-9 rounded-sm px-3"
              >
                浏览工作流
              </Button>
            </div>
          )}
        </section>
      )}

      {recommendations.length > 0 && (
        <section role="region" aria-label="Quick Consult recommendations" className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-[hsl(var(--advisory-foreground))]">
              Quick Consult recommendations
            </h3>
          </div>
          {recommendationContext?.mode === 'enterprise' && (
            <div
              role="status"
              aria-label="企业上下文 recommendation context"
              className="rounded-sm border border-[hsl(var(--advisory-success-border))] bg-[hsl(var(--advisory-success-bg))] px-3 py-2 text-sm leading-6 text-[hsl(var(--advisory-success-foreground))]"
            >
              <p>
                正在使用企业上下文：已结合
                {formatEnterpriseSignalLabels(recommendationContext.signalsApplied)}。
              </p>
              {recommendationContext.signalsApplied.length > 0 && (
                <p className="mt-1 text-xs">
                  {formatEnterpriseSignalLabels(recommendationContext.signalsApplied)}
                </p>
              )}
            </div>
          )}
          {recommendationContext?.mode === 'generic' && (
            <p
              role="alert"
              className="rounded-sm border border-[hsl(var(--advisory-warning-border))] bg-[hsl(var(--advisory-panel))] px-3 py-2 text-sm leading-6 text-[hsl(var(--advisory-foreground))]"
            >
              当前使用通用推荐模式，企业背景数据暂时不可用
            </p>
          )}
          {contextCompletionPrompt && (
            <div
              role="status"
              aria-live="polite"
              aria-label="企业背景补全提示"
              className="rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-muted-bg))] px-3 py-2 text-sm leading-6 text-[hsl(var(--advisory-foreground))]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p>{contextCompletionPrompt.message}</p>
                  {contextCompletionPrompt.missingFields.length > 0 && (
                    <p className="mt-1 text-xs text-[hsl(var(--advisory-muted-foreground))]">
                      待补充：{formatContextMissingFields(contextCompletionPrompt.missingFields)}
                    </p>
                  )}
                </div>
                {contextCompletionPrompt.action === 'open_enterprise_background_settings' &&
                  onOpenEnterpriseBackgroundSettings && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onOpenEnterpriseBackgroundSettings}
                      className="h-8 rounded-sm px-2 text-xs"
                    >
                      <ExternalLink className="mr-1 h-3.5 w-3.5" />
                      完善企业背景
                    </Button>
                  )}
              </div>
            </div>
          )}
          <div className="grid gap-3">
            {recommendations.map((recommendation) => {
              const isExpanded = expandedRecommendationIds.has(recommendation.id)
              const isAccepting = acceptingRecommendationId === recommendation.id

              return (
                <article
                  key={recommendation.id}
                  aria-label={`${recommendation.methodName} recommendation`}
                  className="rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-[hsl(var(--advisory-foreground))]">
                        {recommendation.methodName}
                      </h4>
                      <p className="mt-1 text-sm leading-6 text-[hsl(var(--advisory-muted-foreground))]">
                        {recommendation.fitScenario}
                      </p>
                    </div>
                    <span className="rounded-sm border border-[hsl(var(--advisory-border))] px-2 py-1 text-xs text-[hsl(var(--advisory-muted-foreground))]">
                      {recommendation.expectedDuration}
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-3 text-sm leading-6 sm:grid-cols-2">
                    <div>
                      <dt className="font-medium text-[hsl(var(--advisory-foreground))]">
                        Expected output
                      </dt>
                      <dd className="text-[hsl(var(--advisory-muted-foreground))]">
                        {recommendation.expectedOutput}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-[hsl(var(--advisory-foreground))]">
                        Rationale
                      </dt>
                      <dd className="text-[hsl(var(--advisory-muted-foreground))]">
                        {recommendation.primaryRationale}
                      </dd>
                    </div>
                  </dl>
                  {recommendation.sourceRefs.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2 text-xs text-[hsl(var(--advisory-muted-foreground))]">
                      {recommendation.sourceRefs.map((sourceRef, index) => (
                        <li
                          key={`${sourceRef}:${index}`}
                          className="rounded-sm border border-[hsl(var(--advisory-border))] px-2 py-1"
                        >
                          {formatRecommendationSourceRef(sourceRef)}
                        </li>
                      ))}
                    </ul>
                  )}
                  {isExpanded && recommendation.expandedRationale && (
                    <p className="mt-3 rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-muted-bg))] px-3 py-2 text-sm leading-6 text-[hsl(var(--advisory-foreground))]">
                      {recommendation.expandedRationale}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      aria-label={`View other methods for ${recommendation.methodName}`}
                      onClick={() => void handleManualBrowse()}
                      className="h-9 rounded-sm px-3"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View other methods
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      aria-label={`Reject ${recommendation.methodName} recommendation`}
                      onClick={() => void handleManualBrowse()}
                      className="h-9 rounded-sm px-3"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject recommendation
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      aria-label={`why this method: ${recommendation.methodName}`}
                      onClick={() => toggleRecommendationRationale(recommendation.id)}
                      className="h-9 rounded-sm px-3"
                    >
                      <HelpCircle className="mr-2 h-4 w-4" />
                      why this method
                    </Button>
                    <Button
                      type="button"
                      disabled={!onAcceptRecommendation || isAccepting}
                      onClick={() => void handleAcceptRecommendation(recommendation)}
                      className="h-9 rounded-sm px-3"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {isAccepting
                        ? `Accepting ${recommendation.methodName}`
                        : `Accept ${recommendation.methodName}`}
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>
          {shouldShowRecommendationFeedback && (
            <section
              role="region"
              aria-label="Recommendation feedback"
              className="rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-muted-bg))] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-[hsl(var(--advisory-foreground))]">
                    Rate recommendation quality
                  </h4>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="Dismiss recommendation feedback"
                  disabled={isRecommendationFeedbackSubmitting}
                  onClick={() => setRecommendationFeedbackDismissed(true)}
                  className="h-8 rounded-sm px-2 text-xs"
                >
                  Dismiss
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <Button
                    key={rating}
                    type="button"
                    variant={selectedFeedbackRating === rating ? 'default' : 'outline'}
                    aria-label={`Rate ${rating}`}
                    aria-pressed={selectedFeedbackRating === rating}
                    disabled={isRecommendationFeedbackSubmitting || isRecommendationFeedbackSaved}
                    onClick={() => {
                      setSelectedFeedbackRating(rating)
                      setRecommendationFeedbackStatus('idle')
                      setRecommendationFeedbackError(null)
                    }}
                    className="h-9 min-w-9 rounded-sm px-3"
                  >
                    {rating}
                  </Button>
                ))}
              </div>
              <Textarea
                aria-label="Optional recommendation feedback"
                value={recommendationFeedbackText}
                maxLength={QUICK_CONSULT_FEEDBACK_MAX_LENGTH}
                disabled={isRecommendationFeedbackSubmitting || isRecommendationFeedbackSaved}
                onChange={(event) => {
                  setRecommendationFeedbackText(event.target.value)
                  setRecommendationFeedbackError(null)
                  if (recommendationFeedbackStatus === 'error') {
                    setRecommendationFeedbackStatus('idle')
                  }
                }}
                className="mt-3 min-h-[72px] resize-none rounded-sm border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] text-sm leading-6 text-[hsl(var(--advisory-foreground))]"
              />
              <p className="mt-1 text-xs text-[hsl(var(--advisory-muted-foreground))]">
                {recommendationFeedbackText.length}/{QUICK_CONSULT_FEEDBACK_MAX_LENGTH}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  disabled={
                    selectedFeedbackRating === null ||
                    isRecommendationFeedbackSubmitting ||
                    isRecommendationFeedbackSaved
                  }
                  onClick={() => void handleSubmitRecommendationFeedback()}
                  className="h-9 rounded-sm px-3"
                >
                  {isRecommendationFeedbackSubmitting
                    ? 'Saving recommendation feedback'
                    : 'Submit recommendation feedback'}
                </Button>
                {isRecommendationFeedbackSaved && (
                  <span className="text-sm text-[hsl(var(--advisory-success-foreground))]">
                    Recommendation feedback saved
                  </span>
                )}
              </div>
              {recommendationFeedbackError && (
                <p
                  role="alert"
                  className="mt-3 rounded-sm border border-[hsl(var(--destructive))] bg-[hsl(var(--advisory-panel))] px-3 py-2 text-sm leading-6 text-[hsl(var(--destructive))]"
                >
                  {recommendationFeedbackError}
                </p>
              )}
            </section>
          )}
        </section>
      )}

      {manualBrowseOpen && (
        <section
          ref={manualBrowserRef}
          role="region"
          aria-label="Quick Consult manual method browser"
          tabIndex={-1}
          className="space-y-4 rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-muted-bg))] p-4 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[hsl(var(--advisory-foreground))]">
                Manual methods
              </h3>
              <p className="mt-1 text-sm leading-6 text-[hsl(var(--advisory-muted-foreground))]">
                Browse workflows and method choices.
              </p>
            </div>
            {manualBrowseStatus === 'loading' && (
              <span className="text-xs text-[hsl(var(--advisory-muted-foreground))]">Loading</span>
            )}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--advisory-muted-foreground))]" />
            <Input
              aria-label="Search workflows and methods"
              value={manualBrowseQuery}
              onChange={(event) => setManualBrowseQuery(event.target.value)}
              className="h-10 rounded-sm border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] pl-9 text-sm"
            />
          </div>

          {manualBrowseError && (
            <p
              role="alert"
              className="rounded-sm border border-[hsl(var(--destructive))] bg-[hsl(var(--advisory-panel))] px-3 py-2 text-sm leading-6 text-[hsl(var(--destructive))]"
            >
              {manualBrowseError}
            </p>
          )}

          {manualBrowseCatalog?.methodCatalogStatus === 'degraded' &&
            manualBrowseCatalog.recoverableMessage && (
              <p
                role="alert"
                className="rounded-sm border border-[hsl(var(--advisory-warning-border))] bg-[hsl(var(--advisory-panel))] px-3 py-2 text-sm leading-6 text-[hsl(var(--advisory-foreground))]"
              >
                {manualBrowseCatalog.recoverableMessage}
              </p>
            )}

          {manualBrowseCatalog && (
            <div className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-2">
                {visibleManualWorkflows.map((workflow) => {
                  const choiceId = `workflow:${workflow.workflowKey}`
                  const isLaunching = launchingManualChoiceId === choiceId

                  return (
                    <article
                      key={workflow.workflowKey}
                      aria-label={`${workflow.displayName} workflow option`}
                      className="rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] p-3"
                    >
                      <div className="flex min-h-20 flex-col gap-2">
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-[hsl(var(--advisory-foreground))]">
                            {workflow.displayName}
                          </h4>
                          <p className="mt-1 text-xs leading-5 text-[hsl(var(--advisory-muted-foreground))]">
                            {workflow.scenarioLabel}
                          </p>
                        </div>
                        {workflow.description && (
                          <p className="text-xs leading-5 text-[hsl(var(--advisory-muted-foreground))]">
                            {workflow.description}
                          </p>
                        )}
                        <div className="mt-auto flex items-center justify-between gap-3">
                          <span className="text-xs text-[hsl(var(--advisory-muted-foreground))]">
                            {workflow.expectedDuration ?? 'Workflow'}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            disabled={!onAcceptRecommendation || Boolean(launchingManualChoiceId)}
                            onClick={() => void handleLaunchManualWorkflow(workflow)}
                            className="h-8 rounded-sm px-3 text-xs"
                          >
                            <ExternalLink className="mr-2 h-3.5 w-3.5" />
                            {isLaunching
                              ? `Launching ${workflow.displayName}`
                              : `Launch ${workflow.displayName}`}
                          </Button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>

              {visibleManualMethods.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase text-[hsl(var(--advisory-muted-foreground))]">
                    Method choices
                  </h4>
                  <div className="space-y-2">
                    {visibleManualMethods.map((method) => {
                      const isLaunching = launchingManualChoiceId === method.id

                      return (
                        <div
                          key={method.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[hsl(var(--advisory-foreground))]">
                              {method.methodName}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-[hsl(var(--advisory-muted-foreground))]">
                              {[method.workflowKey, method.category, method.phase]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                            {method.description && (
                              <p className="mt-1 text-xs leading-5 text-[hsl(var(--advisory-muted-foreground))]">
                                {method.description}
                              </p>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            disabled={!onAcceptRecommendation || Boolean(launchingManualChoiceId)}
                            onClick={() => void handleLaunchManualMethod(method)}
                            className="h-8 rounded-sm px-3 text-xs"
                          >
                            <ExternalLink className="mr-2 h-3.5 w-3.5" />
                            {isLaunching
                              ? `Launching ${method.methodName}`
                              : `Launch ${method.methodName}`}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {result?.status === 'clarification_required' && (
        <section
          role="region"
          aria-label="Quick Consult clarification questions"
          className="rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-muted-bg))] p-4"
        >
          <p className="text-sm font-medium text-[hsl(var(--advisory-foreground))]">
            Original problem: {originalProblem}
          </p>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-6 text-[hsl(var(--advisory-foreground))]">
            {clarificationQuestions.slice(0, 2).map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
          <div className="mt-4 space-y-3">
            {clarificationQuestions.slice(0, 2).map((question, index) => {
              const label = `Answer clarification ${index + 1}`

              return (
                <div key={question} className="space-y-2">
                  <Label
                    htmlFor={`quick-consult-clarification-${index}`}
                    className="text-sm font-medium text-[hsl(var(--advisory-foreground))]"
                  >
                    {label}
                  </Label>
                  <Textarea
                    id={`quick-consult-clarification-${index}`}
                    aria-label={label}
                    value={clarificationAnswers[question] ?? ''}
                    disabled={isSubmitting}
                    onChange={(event) =>
                      handleClarificationAnswerChange(question, event.target.value)
                    }
                    className="min-h-[52px] max-h-[160px] resize-none rounded-sm border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] text-sm leading-6 text-[hsl(var(--advisory-foreground))]"
                  />
                </div>
              )
            })}
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleClarificationSubmit()}
              className="h-10 rounded-sm px-4"
            >
              <SendHorizontal className="mr-2 h-4 w-4" />
              Continue quick consult
            </Button>
          </div>
        </section>
      )}

      {result?.status === 'analysis_started' && (
        <div className="rounded-sm border border-[hsl(var(--advisory-success-border))] bg-[hsl(var(--advisory-success-bg))] p-4 text-sm leading-6 text-[hsl(var(--advisory-success-foreground))]">
          <p>5-minute analysis started</p>
          {result.operationalStatus && <p className="mt-1">{result.operationalStatus}</p>}
        </div>
      )}
    </section>
  )
}

function readQuickConsultStatusText(status: QuickConsultStatus): string {
  if (status === 'submitting') return 'Preparing consultant intake'
  if (status === 'clarification') return 'Clarification questions ready'
  if (status === 'analysis') return '5-minute analysis started'
  if (status === 'error') return 'Quick Consult needs attention'
  return 'Quick Consult ready'
}

function readClassificationConfidenceLabel(
  confidenceLevel: NonNullable<QuickConsultStartResult['classification']>['confidenceLevel']
): string {
  if (confidenceLevel === 'low') return '置信度较低'
  if (confidenceLevel === 'medium') return '置信度中等'
  return '置信度较高'
}

function matchesManualBrowseQuery(values: Array<string | undefined>, query: string): boolean {
  if (!query) return true

  return values.some((value) => value?.toLowerCase().includes(query))
}

function formatContextMissingFields(fields: string[]): string {
  const labels: Record<string, string> = {
    organizationName: '企业名称',
    industry: '行业',
    size: '规模',
    complianceOwner: '合规负责人',
  }

  return fields.map((field) => labels[field] ?? field).join('、')
}

function formatEnterpriseSignalLabels(signalsApplied: string[]): string {
  const labels: Record<string, string> = {
    it_maturity: 'CSAAS IT成熟度',
    compliance: 'CSAAS合规数据',
  }
  const labelsApplied = signalsApplied
    .map((signal) => labels[signal])
    .filter((label): label is string => Boolean(label))

  return labelsApplied.length > 0 ? labelsApplied.join('、') : '企业数据'
}

function formatRecommendationSourceRef(sourceRef: string): string {
  if (sourceRef === 'csaas:it-maturity') return 'CSAAS IT成熟度'
  if (sourceRef === 'csaas:compliance') return 'CSAAS合规数据'
  if (sourceRef.startsWith('workflow:')) return '工作流来源'
  if (sourceRef.startsWith('method:')) return '方法库来源'
  return '推荐来源'
}

function readManualBrowseErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : QUICK_CONSULT_START_FAILED_MESSAGE
}
