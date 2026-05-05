'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  AlertCircle,
  CheckCircle2,
  GitBranch,
  Loader2,
  RotateCcw,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  buildTaxonomyRetirementReportUrl,
  evaluateRetirementDryRun,
  executeTaxonomyRetirement,
  fetchRolloutPolicies,
  fetchRolloutPolicyByL1Code,
  rollbackTaxonomyRetirement,
  type TaxonomyRolloutPolicyDetail,
  type TaxonomyRolloutPolicyListItem,
  type TaxonomyRolloutRetirementExecutionResult,
  type TaxonomyRolloutRetirementReadiness,
  type TaxonomyRolloutRetirementRollbackResult,
  type TaxonomyRolloutState,
} from '@/lib/api/taxonomy-rollout'

const ALLOWED_ROLES = ['admin']
const RELEASE_ID_MAX_LENGTH = 80
const RELEASE_ID_PATTERN = /^[A-Za-z0-9._-]{1,80}$/
const RELEASE_ID_ERROR =
  'releaseId must be 1-80 characters and contain only letters, numbers, dots, underscores, or hyphens.'

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
  'legacy-off': 'bg-rose-100 text-rose-900',
}

const PREREQUISITE_FIELDS: Array<{
  key: keyof TaxonomyRolloutRetirementReadiness['prerequisites']
  label: string
}> = [
  { key: 'cutoverTierPassed', label: 'Cutover Tier Passed' },
  { key: 'observationWindowPassed', label: 'Observation Window Passed' },
  { key: 'killSwitchDrillPassed', label: 'Kill Switch Drill Passed' },
  { key: 'rollbackVerified', label: 'Rollback Verified' },
  { key: 'reclassifyReady', label: 'Reclassify Ready' },
  { key: 'backfillReady', label: 'Backfill Ready' },
]

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

function syncQuery(selectedL1Code: string | null) {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  if (selectedL1Code) params.set('l1Code', selectedL1Code)
  else params.delete('l1Code')
  const nextQuery = params.toString()
  const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname
  window.history.replaceState(null, '', nextUrl)
}

function ReportLink({ reportPath }: { reportPath: string }) {
  const href = buildTaxonomyRetirementReportUrl(reportPath)
  if (!href) return <span className="break-all font-medium text-[#1E3A5F]">{reportPath}</span>

  return (
    <a
      className="break-all font-medium text-[#1E3A5F] underline underline-offset-2"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {reportPath}
    </a>
  )
}

export default function TaxonomyRolloutRetirementPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const canAccess = Boolean(session?.user && ALLOWED_ROLES.includes(session.user.role))

  const [policies, setPolicies] = useState<TaxonomyRolloutPolicyListItem[]>([])
  const [selectedL1Code, setSelectedL1Code] = useState<string | null>(null)
  const [detail, setDetail] = useState<TaxonomyRolloutPolicyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [isDryRunning, setIsDryRunning] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isRollingBack, setIsRollingBack] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [readiness, setReadiness] = useState<TaxonomyRolloutRetirementReadiness | null>(null)
  const [executionResult, setExecutionResult] =
    useState<TaxonomyRolloutRetirementExecutionResult | null>(null)
  const [rollbackResult, setRollbackResult] =
    useState<TaxonomyRolloutRetirementRollbackResult | null>(null)
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false)
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false)
  const [releaseId, setReleaseId] = useState('')
  const [executeConfirmationText, setExecuteConfirmationText] = useState('')
  const [rollbackConfirmationText, setRollbackConfirmationText] = useState('')
  const [dialogError, setDialogError] = useState<string | null>(null)
  const selectedL1CodeRef = useRef<string | null>(null)

  useEffect(() => {
    selectedL1CodeRef.current = selectedL1Code
  }, [selectedL1Code])

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
        const requested = searchParams.get('l1Code')?.trim().toUpperCase()
        const nextSelectedL1Code =
          requested && data.some((policy) => policy.l1Code === requested)
            ? requested
            : (data[0]?.l1Code ?? null)
        selectedL1CodeRef.current = nextSelectedL1Code
        setSelectedL1Code(nextSelectedL1Code)
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

  useEffect(() => {
    if (!selectedL1Code || status !== 'authenticated' || !canAccess) {
      setDetail(null)
      return
    }

    const normalizedSelectedL1Code = selectedL1Code
    syncQuery(normalizedSelectedL1Code)
    let cancelled = false

    async function loadDetail() {
      try {
        setDetailLoading(true)
        const data = await fetchRolloutPolicyByL1Code(normalizedSelectedL1Code)
        if (!cancelled) setDetail(data)
      } catch (loadError) {
        if (!cancelled) {
          setDetail(null)
          setError(errorMessage(loadError, '无法加载 domain 详情'))
        }
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }

    void loadDetail()
    return () => {
      cancelled = true
    }
  }, [canAccess, selectedL1Code, status])

  const selectedPolicy = useMemo(
    () => policies.find((policy) => policy.l1Code === selectedL1Code) ?? null,
    [policies, selectedL1Code]
  )

  async function refreshSelectedPolicy() {
    if (!selectedL1Code) return
    const [nextPolicies, nextDetail] = await Promise.all([
      fetchRolloutPolicies(),
      fetchRolloutPolicyByL1Code(selectedL1Code),
    ])
    setPolicies(nextPolicies)
    setDetail(nextDetail)
  }

  async function handleDryRun() {
    if (!selectedL1Code) return
    const requestedL1Code = selectedL1Code
    try {
      setIsDryRunning(true)
      setError(null)
      setExecutionResult(null)
      setRollbackResult(null)
      const result = await evaluateRetirementDryRun({ l1Code: requestedL1Code })
      if (selectedL1CodeRef.current !== requestedL1Code || result.l1Code !== requestedL1Code) {
        return
      }
      setReadiness(result)
    } catch (dryRunError) {
      setError(errorMessage(dryRunError, '执行 retirement dry-run 失败'))
      setReadiness(null)
    } finally {
      setIsDryRunning(false)
    }
  }

  async function handleExecuteRetirement() {
    if (!selectedL1Code) return
    const normalizedReleaseId = releaseId.trim()
    const normalizedConfirmationText = executeConfirmationText.trim()
    setDialogError(null)

    if (
      !readiness ||
      readiness.l1Code !== selectedL1Code ||
      selectedPolicy?.rolloutState !== 'domain-primary'
    ) {
      setDialogError('请重新执行当前 domain 的 dry-run 后再执行 legacy-off。')
      return
    }

    if (!RELEASE_ID_PATTERN.test(normalizedReleaseId)) {
      setDialogError(RELEASE_ID_ERROR)
      return
    }

    try {
      setIsExecuting(true)
      setError(null)
      const result = await executeTaxonomyRetirement({
        l1Code: selectedL1Code,
        releaseId: normalizedReleaseId,
        confirmationText: normalizedConfirmationText,
      })
      setExecutionResult(result)
      setRollbackResult(null)
      setReadiness(null)
      setExecuteDialogOpen(false)
      setReleaseId('')
      setExecuteConfirmationText('')
      await refreshSelectedPolicy()
    } catch (executeError) {
      const message = errorMessage(executeError, '执行 legacy-off 失败')
      setDialogError(message)
    } finally {
      setIsExecuting(false)
    }
  }

  async function handleRollback() {
    if (!selectedL1Code) return
    try {
      setIsRollingBack(true)
      setError(null)
      setDialogError(null)
      const result = await rollbackTaxonomyRetirement({
        l1Code: selectedL1Code,
        targetState: 'domain-primary',
        confirmationText: rollbackConfirmationText.trim(),
        restoreLegacyFallback: true,
      })
      setRollbackResult(result)
      setExecutionResult(null)
      setReadiness(null)
      setRollbackDialogOpen(false)
      setRollbackConfirmationText('')
      await refreshSelectedPolicy()
    } catch (rollbackError) {
      const message = errorMessage(rollbackError, '执行 rollback 失败')
      setDialogError(message)
    } finally {
      setIsRollingBack(false)
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
                  无权访问 Taxonomy Rollout Retirement Console
                </h1>
                <p className="mt-2 text-[#64748B]">当前账号没有查看该页面的权限，请联系管理员。</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const executeDisabled =
    !readiness ||
    readiness.l1Code !== selectedL1Code ||
    !readiness.allowed ||
    selectedPolicy?.rolloutState !== 'domain-primary'
  const rollbackDisabled = selectedPolicy?.rolloutState !== 'legacy-off'

  return (
    <div className="min-h-screen bg-[#FEFDFB] px-6 py-16">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <GitBranch className="h-6 w-6 text-[#1E3A5F]" />
              <h1 className="text-3xl font-bold text-[#1E3A5F]">
                Taxonomy Rollout Retirement Console
              </h1>
            </div>
            <p className="mt-1 text-[#64748B]">
              执行 `legacy-off` dry-run、retirement 和 rollback，并查看最近一次 report / evidence。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="rounded-sm">
              <Link
                href={
                  selectedL1Code
                    ? `/admin/taxonomy-rollout/gates?l1Code=${selectedL1Code}`
                    : '/admin/taxonomy-rollout/gates'
                }
              >
                返回 Gates Console
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-sm">
              <Link
                href={
                  selectedL1Code
                    ? `/admin/taxonomy-rollout/recovery?l1Code=${selectedL1Code}`
                    : '/admin/taxonomy-rollout/recovery'
                }
              >
                Recovery/History Console
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-sm">
              <Link href="/admin/taxonomy-rollout">返回 Rollout Overview</Link>
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="rounded-sm">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {executionResult && (
          <Alert className="rounded-sm border-emerald-200 bg-emerald-50 text-emerald-900">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="space-y-1">
              <p className="font-semibold">Retirement completed</p>
              <p>
                {executionResult.l1Code} 已进入 {executionResult.policySummary.rolloutState}，Smoke
                Verification: {executionResult.smokeVerification.passed ? 'PASS' : 'FAIL'}
              </p>
            </AlertDescription>
          </Alert>
        )}

        {rollbackResult && (
          <Alert className="rounded-sm border-blue-200 bg-blue-50 text-blue-900">
            <RotateCcw className="h-4 w-4" />
            <AlertDescription className="space-y-1">
              <p className="font-semibold">Rollback completed</p>
              <p>
                {rollbackResult.l1Code} 已恢复到 {rollbackResult.policySummary.rolloutState}，Legacy
                Fallback: {rollbackResult.legacyFallbackRestored ? 'Restored' : 'Disabled'}
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-[#1E3A5F]">Control Panel</CardTitle>
              <CardDescription>
                选择 domain，先 dry-run，再决定 execute 或 rollback。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#1E3A5F]">Domain</label>
                <Select
                  value={selectedL1Code ?? undefined}
                  onValueChange={(value) => {
                    selectedL1CodeRef.current = value
                    setSelectedL1Code(value)
                    setReadiness(null)
                    setExecutionResult(null)
                    setRollbackResult(null)
                    setDialogError(null)
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

              {loading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-[#1E3A5F]" />
                </div>
              ) : (
                selectedPolicy && (
                  <div className="rounded-sm border border-[#E2E8F0] bg-white p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748B]">Current State</span>
                      <Badge className={ROLLOUT_STATE_COLORS[selectedPolicy.rolloutState]}>
                        {ROLLOUT_STATE_LABELS[selectedPolicy.rolloutState]}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[#64748B]">Legacy Fallback</span>
                      <Badge variant={selectedPolicy.allowLegacyFallback ? 'default' : 'outline'}>
                        {selectedPolicy.allowLegacyFallback ? 'Allowed' : 'Blocked'}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[#64748B]">Kill Switch</span>
                      <Badge
                        variant={selectedPolicy.killSwitchEnabled ? 'destructive' : 'secondary'}
                      >
                        {selectedPolicy.killSwitchEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>
                )
              )}

              <Button
                className="w-full rounded-sm"
                onClick={() => void handleDryRun()}
                disabled={!selectedL1Code || isDryRunning}
              >
                {isDryRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  'Run Retirement Dry Run'
                )}
              </Button>

              <div className="grid gap-3">
                <Button
                  className="rounded-sm"
                  disabled={executeDisabled || isExecuting}
                  onClick={() => {
                    setDialogError(null)
                    setExecuteDialogOpen(true)
                  }}
                >
                  Execute Legacy-Off
                </Button>
                <Button
                  variant="outline"
                  className="rounded-sm"
                  disabled={rollbackDisabled || isRollingBack}
                  onClick={() => {
                    setDialogError(null)
                    setRollbackDialogOpen(true)
                  }}
                >
                  Rollback
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-[#1E3A5F]">
                  Retirement Readiness
                </CardTitle>
                <CardDescription>
                  dry-run 结果、blocking reasons、rollback path 和最近一次执行结果。
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!readiness ? (
                  <div className="rounded-sm border border-dashed border-[#CBD5E1] px-4 py-10 text-center text-sm text-[#64748B]">
                    先选择 domain 并执行 Run Retirement Dry Run。
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#64748B]">{readiness.l1Code}</p>
                        <p className="text-sm text-[#64748B]">
                          {readiness.currentState} → {readiness.targetState}
                        </p>
                      </div>
                      <Badge
                        className={
                          readiness.gateStatus === 'PASS'
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-rose-100 text-rose-900'
                        }
                      >
                        {readiness.gateStatus}
                      </Badge>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {PREREQUISITE_FIELDS.map((field) => {
                        const passed = readiness.prerequisites[field.key]
                        return (
                          <Card key={field.key} className="rounded-sm border-[#E2E8F0] shadow-none">
                            <CardContent className="flex items-center justify-between py-4 text-sm">
                              <span className="text-[#1E3A5F]">{field.label}</span>
                              <Badge variant={passed ? 'default' : 'secondary'}>
                                {passed ? 'PASS' : 'FAIL'}
                              </Badge>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>

                    <Card className="rounded-sm border-[#E2E8F0] bg-[#F8FAFC] shadow-none">
                      <CardContent className="space-y-3 py-4 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-[#64748B]">Rollback Path</span>
                          <span className="text-right font-medium text-[#1E3A5F]">
                            {readiness.rolloutGuidance.rollbackPath}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#64748B]">Recommended Next Action</span>
                          <span className="text-right font-medium text-[#1E3A5F]">
                            {readiness.recommendedNextAction}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    {readiness.blockingReasons.length > 0 && (
                      <Alert variant="destructive" className="rounded-sm">
                        <TriangleAlert className="h-4 w-4" />
                        <AlertDescription className="space-y-1">
                          {readiness.blockingReasons.map((reason) => (
                            <p key={reason}>{reason}</p>
                          ))}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-[#1E3A5F]">
                    Retirement Result
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {executionResult ? (
                    <>
                      <p className="font-medium text-[#1E3A5F]">
                        Smoke Verification:{' '}
                        {executionResult.smokeVerification.passed ? 'PASS' : 'FAIL'}
                      </p>
                      <p>
                        Checked At: {formatUtcDate(executionResult.smokeVerification.checkedAt)}
                      </p>
                      <p>Final Fallback Rate: {executionResult.finalFallbackRate.toFixed(4)}</p>
                      <p>
                        Cleanup Readiness:{' '}
                        {executionResult.cleanupReadiness.allowed ? 'READY' : 'DEFERRED'}
                      </p>
                      {executionResult.cleanupReadiness.blockingReasons.map((reason) => (
                        <p key={reason} className="text-[#64748B]">
                          {reason}
                        </p>
                      ))}
                      {executionResult.reportPath ? (
                        <p>
                          <ReportLink reportPath={executionResult.reportPath} />
                        </p>
                      ) : (
                        <p>Report Path: N/A</p>
                      )}
                    </>
                  ) : (
                    <p className="text-[#64748B]">尚未执行 legacy-off。</p>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-[#1E3A5F]">
                    Latest Evidence
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {detailLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-[#1E3A5F]" />
                    </div>
                  ) : detail ? (
                    <>
                      <p>
                        Last Legacy Off:{' '}
                        {formatUtcDate(detail.retirementEvidenceJson.lastLegacyOffAt)}
                      </p>
                      <p>
                        Last Smoke Verified:{' '}
                        {formatUtcDate(detail.retirementEvidenceJson.lastSmokeVerifiedAt)}
                      </p>
                      <p>
                        Last Rollback Verified:{' '}
                        {formatUtcDate(detail.retirementEvidenceJson.lastRollbackVerifiedAt)}
                      </p>
                      {detail.retirementEvidenceJson.lastRetirementReportPath ? (
                        <p>
                          <ReportLink
                            reportPath={detail.retirementEvidenceJson.lastRetirementReportPath}
                          />
                        </p>
                      ) : (
                        <p>Last Report Path: N/A</p>
                      )}
                    </>
                  ) : (
                    <p className="text-[#64748B]">暂无可展示的 evidence。</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {rollbackResult && (
              <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-[#1E3A5F]">
                    Rollback Result
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p>Restored State: {rollbackResult.policySummary.rolloutState}</p>
                  <p>
                    Legacy Fallback:{' '}
                    {rollbackResult.legacyFallbackRestored ? 'Restored' : 'Disabled'}
                  </p>
                  <p>
                    Rollback Verified At:{' '}
                    {formatUtcDate(rollbackResult.evidenceSummary.lastRollbackVerifiedAt)}
                  </p>
                  {rollbackResult.reportPath ? (
                    <p>
                      <ReportLink reportPath={rollbackResult.reportPath} />
                    </p>
                  ) : (
                    <p>Report Path: N/A</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <Dialog
          open={executeDialogOpen}
          onOpenChange={(open) => {
            setExecuteDialogOpen(open)
            if (!open) setDialogError(null)
          }}
        >
          <DialogContent className="rounded-sm sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Confirm Legacy-Off</DialogTitle>
              <DialogDescription>
                这是高风险操作。请确认 domain、当前状态、releaseId 和回滚路径后再执行。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              {dialogError && (
                <Alert variant="destructive" className="rounded-sm">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{dialogError}</AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-3 rounded-sm border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-sm">
                <div>
                  <p className="text-[#64748B]">Domain</p>
                  <p className="mt-1 font-medium text-[#1E3A5F]">{selectedL1Code ?? 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[#64748B]">Current State</p>
                  <p className="mt-1 font-medium text-[#1E3A5F]">
                    {selectedPolicy?.rolloutState ?? 'N/A'}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[#64748B]">Rollback Path</p>
                  <p className="mt-1 font-medium text-[#1E3A5F]">
                    {readiness?.rolloutGuidance.rollbackPath ?? 'N/A'}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#1E3A5F]">Release ID</label>
                <Input
                  value={releaseId}
                  onChange={(event) => setReleaseId(event.target.value)}
                  aria-label="Release ID"
                  maxLength={RELEASE_ID_MAX_LENGTH}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#1E3A5F]">
                  Type Domain Code to Confirm
                </label>
                <Input
                  value={executeConfirmationText}
                  onChange={(event) => setExecuteConfirmationText(event.target.value)}
                  aria-label="Type Domain Code to Confirm"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                className="rounded-sm"
                onClick={() => {
                  setDialogError(null)
                  setExecuteDialogOpen(false)
                }}
              >
                Cancel
              </Button>
              <Button
                className="rounded-sm"
                disabled={!releaseId.trim() || !executeConfirmationText.trim() || isExecuting}
                onClick={() => void handleExecuteRetirement()}
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Executing...
                  </>
                ) : (
                  'Confirm Execute Legacy-Off'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={rollbackDialogOpen}
          onOpenChange={(open) => {
            setRollbackDialogOpen(open)
            if (!open) setDialogError(null)
          }}
        >
          <DialogContent className="rounded-sm sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Confirm Rollback</DialogTitle>
              <DialogDescription>
                rollback 会把 domain 从 `legacy-off` 恢复到 `domain-primary` 并重新允许 legacy
                fallback。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              {dialogError && (
                <Alert variant="destructive" className="rounded-sm">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{dialogError}</AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-3 rounded-sm border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-sm">
                <div>
                  <p className="text-[#64748B]">Current State</p>
                  <p className="mt-1 font-medium text-[#1E3A5F]">
                    {selectedPolicy?.rolloutState ?? 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-[#64748B]">Rollback Target</p>
                  <p className="mt-1 font-medium text-[#1E3A5F]">domain-primary</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[#64748B]">Rollback Path</p>
                  <p className="mt-1 font-medium text-[#1E3A5F]">
                    {readiness?.rolloutGuidance.rollbackPath ??
                      'Enable kill switch and revert rollout state to domain-primary'}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#1E3A5F]">
                  Type Domain Code to Confirm
                </label>
                <Input
                  value={rollbackConfirmationText}
                  onChange={(event) => setRollbackConfirmationText(event.target.value)}
                  aria-label="Type Domain Code to Confirm"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                className="rounded-sm"
                onClick={() => {
                  setDialogError(null)
                  setRollbackDialogOpen(false)
                }}
              >
                Cancel
              </Button>
              <Button
                className="rounded-sm"
                disabled={!rollbackConfirmationText.trim() || isRollingBack}
                onClick={() => void handleRollback()}
              >
                {isRollingBack ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rolling Back...
                  </>
                ) : (
                  'Confirm Rollback'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
