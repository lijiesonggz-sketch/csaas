'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AlertCircle, ArrowRightLeft, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  evaluateRolloutGate,
  fetchRolloutPolicies,
  transitionRolloutState,
  type TaxonomyRolloutGateDecision,
  type TaxonomyRolloutMutableTargetState,
  type TaxonomyRolloutPolicyListItem,
  type TaxonomyRolloutState,
  type TaxonomyRolloutTransitionResult,
} from '@/lib/api/taxonomy-rollout'

const ALLOWED_ROLES = ['admin']

const ROLLOUT_STATE_LABELS: Record<TaxonomyRolloutState, string> = {
  'legacy-primary': 'Legacy Primary',
  'it04-on-new-interface': 'IT04 on New Interface',
  'domain-shadow': 'Domain Shadow',
  'domain-compare': 'Domain Compare',
  'domain-primary': 'Domain Primary',
  'legacy-off': 'Legacy Off',
}

const ROLLOUT_STATE_COLORS: Record<TaxonomyRolloutState, string> = {
  'legacy-primary': 'bg-slate-100 text-slate-700',
  'it04-on-new-interface': 'bg-blue-100 text-blue-800',
  'domain-shadow': 'bg-amber-100 text-amber-900',
  'domain-compare': 'bg-orange-100 text-orange-900',
  'domain-primary': 'bg-emerald-100 text-emerald-900',
  'legacy-off': 'bg-emerald-700 text-white',
}

function errorMessage(error: unknown, fallback = '操作失败') {
  if (!(error instanceof Error)) return fallback
  const message = error.message?.trim()
  if (!message) return fallback
  return message
}

function formatUtcDate(value: string | null | undefined): string {
  if (!value) return 'N/A'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function getNextTargetState(
  currentState: TaxonomyRolloutState | null | undefined
): TaxonomyRolloutMutableTargetState | null {
  if (!currentState) return null
  switch (currentState) {
    case 'legacy-primary':
    case 'it04-on-new-interface':
      return 'domain-shadow'
    case 'domain-shadow':
      return 'domain-compare'
    case 'domain-compare':
      return 'domain-primary'
    default:
      return null
  }
}

function getTargetLabel(targetState: TaxonomyRolloutMutableTargetState | null): string {
  if (!targetState) return 'No Transition Available'
  switch (targetState) {
    case 'domain-shadow':
      return 'Promote to Shadow'
    case 'domain-compare':
      return 'Promote to Compare'
    case 'domain-primary':
      return 'Promote to Primary'
    default:
      return 'No Transition Available'
  }
}

function getRecommendedTargetLabel(targetState: TaxonomyRolloutMutableTargetState | null): string {
  if (!targetState) return '当前状态已无后续推广目标'
  return ROLLOUT_STATE_LABELS[targetState]
}

function syncQuery(
  selectedL1Code: string | null,
  targetState: TaxonomyRolloutMutableTargetState | null
) {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams(window.location.search)
  if (selectedL1Code) params.set('l1Code', selectedL1Code)
  else params.delete('l1Code')

  if (targetState) params.set('targetState', targetState)
  else params.delete('targetState')

  const nextQuery = params.toString()
  const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname
  window.history.replaceState(null, '', nextUrl)
}

export default function TaxonomyRolloutGatesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const canAccess = Boolean(session?.user && ALLOWED_ROLES.includes(session.user.role))

  const [policies, setPolicies] = useState<TaxonomyRolloutPolicyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [transitionResult, setTransitionResult] = useState<TaxonomyRolloutTransitionResult | null>(
    null
  )
  const [selectedL1Code, setSelectedL1Code] = useState<string | null>(null)
  const [targetState, setTargetState] = useState<TaxonomyRolloutMutableTargetState | null>(null)
  const [evaluationResult, setEvaluationResult] = useState<TaxonomyRolloutGateDecision | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [router, status])

  useEffect(() => {
    if (status !== 'authenticated' || !canAccess) return

    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchRolloutPolicies()
        if (cancelled) return

        setPolicies(data)
        const nextSelected = searchParams.get('l1Code')?.trim().toUpperCase()
        setSelectedL1Code(
          nextSelected && data.some((policy) => policy.l1Code === nextSelected)
            ? nextSelected
            : (data[0]?.l1Code ?? null)
        )
      } catch (loadError) {
        if (!cancelled) setError(errorMessage(loadError, '加载 rollout policies 失败'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [canAccess, searchParams, status])

  const selectedPolicy = useMemo(
    () => policies.find((policy) => policy.l1Code === selectedL1Code) ?? null,
    [policies, selectedL1Code]
  )

  useEffect(() => {
    if (!selectedPolicy) {
      setTargetState(null)
      setEvaluationResult(null)
      return
    }

    const nextTarget = getNextTargetState(selectedPolicy.rolloutState)
    const requestedTarget = searchParams.get(
      'targetState'
    ) as TaxonomyRolloutMutableTargetState | null

    setTargetState(requestedTarget && requestedTarget === nextTarget ? requestedTarget : nextTarget)
  }, [searchParams, selectedPolicy])

  useEffect(() => {
    syncQuery(selectedL1Code, targetState)
  }, [selectedL1Code, targetState])

  async function refreshPolicies() {
    const refreshed = await fetchRolloutPolicies()
    setPolicies(refreshed)
    return refreshed
  }

  async function handleEvaluate() {
    if (!selectedL1Code || !targetState) return

    try {
      setIsEvaluating(true)
      setError(null)
      setTransitionResult(null)
      const result = await evaluateRolloutGate({
        l1Code: selectedL1Code,
        targetState,
      })
      setEvaluationResult(result)
    } catch (evaluateError) {
      setError(errorMessage(evaluateError, '执行 gate evaluation 失败'))
      setEvaluationResult(null)
    } finally {
      setIsEvaluating(false)
    }
  }

  async function handleConfirmTransition() {
    if (!selectedL1Code || !targetState || !evaluationResult?.allowed) return

    try {
      setIsTransitioning(true)
      setError(null)
      const result = await transitionRolloutState({
        l1Code: selectedL1Code,
        targetState,
      })
      await refreshPolicies()
      setTransitionResult(result)
      setConfirmOpen(false)

      const nextTarget = getNextTargetState(result.policySummary.rolloutState)
      setTargetState(nextTarget)

      if (nextTarget) {
        const followUp = await evaluateRolloutGate({
          l1Code: selectedL1Code,
          targetState: nextTarget,
        })
        setEvaluationResult(followUp)
      } else {
        setEvaluationResult(null)
      }
    } catch (transitionError) {
      setError(errorMessage(transitionError, '执行 state transition 失败'))
    } finally {
      setIsTransitioning(false)
    }
  }

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FEFDFB]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E3A5F]" />
      </div>
    )
  }

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-[#FEFDFB] p-6">
        <div className="mx-auto max-w-3xl pt-24">
          <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <ShieldAlert className="h-12 w-12 text-amber-600" />
              <div>
                <h1 className="text-2xl font-bold text-[#1E3A5F]">
                  无权访问 Taxonomy Rollout Gates
                </h1>
                <p className="mt-2 text-[#64748B]">当前账号没有查看该页面的权限，请联系管理员。</p>
              </div>
              <Button
                variant="outline"
                className="rounded-sm"
                onClick={() => router.push('/dashboard')}
              >
                返回管理后台
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const transitionButtonLabel = getTargetLabel(targetState)
  const transitionButtonDisabled =
    !evaluationResult || !evaluationResult.allowed || isTransitioning || !targetState

  return (
    <div className="min-h-screen bg-[#FEFDFB] px-6 py-16">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-6 w-6 text-[#1E3A5F]" />
              <h1 className="text-3xl font-bold text-[#1E3A5F]">Taxonomy Rollout Gates</h1>
            </div>
            <p className="mt-1 text-[#64748B]">
              评估 per-domain readiness，查看 blocking reasons，并在 PASS 时执行受控 state
              transition。
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="outline" className="rounded-sm">
              <Link
                href={
                  selectedL1Code
                    ? `/admin/taxonomy-rollout/retirement?l1Code=${selectedL1Code}`
                    : '/admin/taxonomy-rollout/retirement'
                }
              >
                打开 Retirement Console
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-sm">
              <Link href="/admin/taxonomy-rollout">返回 Rollout Overview</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-sm">
              <Link href="/admin/knowledge-graph">返回知识图谱总览</Link>
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="rounded-sm">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {transitionResult && (
          <Alert className="rounded-sm border-emerald-200 bg-emerald-50 text-emerald-900">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="flex flex-col gap-1">
              <span className="font-semibold">Transition completed</span>
              <span>
                {transitionResult.l1Code} 已切换到 {transitionResult.targetState}，生效日期{' '}
                {formatUtcDate(transitionResult.stateChangedAt)}。
              </span>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-[#1E3A5F]">Control Panel</CardTitle>
              <CardDescription>
                先选 domain，再选目标态，然后触发 readiness evaluation。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#1E3A5F]">Domain</label>
                <Select
                  value={selectedL1Code ?? undefined}
                  onValueChange={(value) => {
                    setSelectedL1Code(value)
                    setEvaluationResult(null)
                    setTransitionResult(null)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select domain" />
                  </SelectTrigger>
                  <SelectContent>
                    {policies.map((policy) => (
                      <SelectItem key={policy.l1Code} value={policy.l1Code}>
                        {policy.l1Code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[#1E3A5F]">Target State</label>
                <Select
                  value={targetState ?? undefined}
                  onValueChange={(value) => {
                    setTargetState(value as TaxonomyRolloutMutableTargetState)
                    setEvaluationResult(null)
                    setTransitionResult(null)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target state" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetState ? (
                      <SelectItem value={targetState}>
                        {getRecommendedTargetLabel(targetState)}
                      </SelectItem>
                    ) : (
                      <SelectItem value="domain-primary" disabled>
                        No Transition Available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedPolicy && (
                <div className="rounded-sm border border-[#E2E8F0] bg-white p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Current State</span>
                    <Badge className={ROLLOUT_STATE_COLORS[selectedPolicy.rolloutState]}>
                      {ROLLOUT_STATE_LABELS[selectedPolicy.rolloutState]}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[#64748B]">Kill Switch</span>
                    <Badge variant={selectedPolicy.killSwitchEnabled ? 'destructive' : 'secondary'}>
                      {selectedPolicy.killSwitchEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[#64748B]">Legacy Fallback</span>
                    <Badge variant={selectedPolicy.allowLegacyFallback ? 'default' : 'outline'}>
                      {selectedPolicy.allowLegacyFallback ? 'Allowed' : 'Blocked'}
                    </Badge>
                  </div>
                </div>
              )}

              <Button
                className="w-full rounded-sm"
                onClick={() => void handleEvaluate()}
                disabled={!selectedL1Code || !targetState || isEvaluating || loading}
              >
                {isEvaluating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Evaluating...
                  </>
                ) : (
                  'Evaluate Readiness'
                )}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-[#1E3A5F]">
                  Gate Result Summary
                </CardTitle>
                <CardDescription>
                  展示 benchmark gate、runtime metrics、blocking reasons 和下一步建议。
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!evaluationResult ? (
                  <div className="rounded-sm border border-dashed border-[#CBD5E1] px-4 py-10 text-center text-sm text-[#64748B]">
                    先选择 domain 并执行 Evaluate Readiness。
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              evaluationResult.gateStatus === 'PASS'
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-rose-100 text-rose-900'
                            }
                          >
                            {evaluationResult.gateStatus}
                          </Badge>
                          <span className="text-sm text-[#64748B]">{evaluationResult.l1Code}</span>
                        </div>
                        <p className="text-sm text-[#64748B]">
                          {evaluationResult.currentState} → {evaluationResult.targetState}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-[0.2em] text-[#94A3B8]">
                          Benchmark Gate
                        </p>
                        <p className="text-sm font-semibold text-[#1E3A5F]">
                          {evaluationResult.benchmarkGate.gateStatus}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <Card className="rounded-sm border-[#E2E8F0] shadow-none">
                        <CardContent className="py-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#94A3B8]">
                            Fallback Rate
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-[#1E3A5F]">
                            {formatPercent(evaluationResult.metrics.fallbackRate)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-sm border-[#E2E8F0] shadow-none">
                        <CardContent className="py-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#94A3B8]">
                            Unknown Rate
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-[#1E3A5F]">
                            {formatPercent(evaluationResult.metrics.unknownRate)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-sm border-[#E2E8F0] shadow-none">
                        <CardContent className="py-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#94A3B8]">
                            Manual Correction Rate
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-[#1E3A5F]">
                            {formatPercent(evaluationResult.metrics.manualCorrectionRate)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-sm border-[#E2E8F0] shadow-none">
                        <CardContent className="py-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#94A3B8]">
                            Error Budget Consumed
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-[#1E3A5F]">
                            {evaluationResult.metrics.errorBudgetConsumed.toFixed(4)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-sm border-[#E2E8F0] shadow-none">
                        <CardContent className="py-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#94A3B8]">
                            Total Runs
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-[#1E3A5F]">
                            {evaluationResult.metrics.totalRuns}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-sm border-[#E2E8F0] shadow-none">
                        <CardContent className="py-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#94A3B8]">
                            Observation Window
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-[#1E3A5F]">
                            {evaluationResult.metrics.observationWindowDays}d
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="rounded-sm border-[#E2E8F0] bg-[#F8FAFC] shadow-none">
                      <CardContent className="py-4 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[#64748B]">Kill Switch</span>
                          <span className="font-medium text-[#1E3A5F]">
                            Kill Switch:{' '}
                            {evaluationResult.policySummary.killSwitchEnabled
                              ? 'Enabled (read-only)'
                              : 'Disabled (read-only)'}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-4">
                          <span className="text-[#64748B]">Rollback Path</span>
                          <span className="text-right font-medium text-[#1E3A5F]">
                            {evaluationResult.rolloutGuidance.rollbackPath}
                          </span>
                        </div>
                        <div className="mt-3">
                          <p className="text-[#64748B]">Recommended Next Action</p>
                          <p className="mt-1 font-medium text-[#1E3A5F]">
                            {evaluationResult.recommendedNextAction}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {evaluationResult.blockingReasons.length > 0 && (
                      <Alert variant="destructive" className="rounded-sm">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <div className="space-y-1">
                            {evaluationResult.blockingReasons.map((reason: string) => (
                              <p key={reason}>{reason}</p>
                            ))}
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-[#64748B]">
                        当前目标态：{getRecommendedTargetLabel(targetState)}
                      </div>
                      <Button
                        className="rounded-sm"
                        disabled={transitionButtonDisabled}
                        onClick={() => setConfirmOpen(true)}
                      >
                        {isTransitioning ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Transitioning...
                          </>
                        ) : (
                          transitionButtonLabel
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="rounded-sm sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Confirm State Transition</DialogTitle>
              <DialogDescription>
                该操作会基于当前 gate 结果推进 domain rollout
                state。请在确认前复核关键指标和回滚路径。
              </DialogDescription>
            </DialogHeader>

            {evaluationResult && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3 rounded-sm border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                  <div>
                    <p className="text-[#64748B]">Domain</p>
                    <p className="mt-1 font-medium text-[#1E3A5F]">{evaluationResult.l1Code}</p>
                  </div>
                  <div>
                    <p className="text-[#64748B]">Observation Window</p>
                    <p className="mt-1 font-medium text-[#1E3A5F]">
                      {evaluationResult.metrics.observationWindowDays} days
                    </p>
                  </div>
                  <div>
                    <p className="text-[#64748B]">Current State</p>
                    <p className="mt-1 font-medium text-[#1E3A5F]">
                      {evaluationResult.currentState}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#64748B]">Target State</p>
                    <p className="mt-1 font-medium text-[#1E3A5F]">
                      {evaluationResult.targetState}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#64748B]">Fallback Rate</p>
                    <p className="mt-1 font-medium text-[#1E3A5F]">
                      {formatPercent(evaluationResult.metrics.fallbackRate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#64748B]">Rollback Path</p>
                    <p className="mt-1 font-medium text-[#1E3A5F]">
                      {evaluationResult.rolloutGuidance.rollbackPath}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                className="rounded-sm"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="rounded-sm"
                onClick={() => void handleConfirmTransition()}
                disabled={!evaluationResult?.allowed || isTransitioning}
              >
                {targetState ? `Confirm ${getTargetLabel(targetState)}` : 'Confirm Transition'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
