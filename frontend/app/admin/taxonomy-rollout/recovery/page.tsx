'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AlertCircle, CheckCircle2, History, Loader2, RotateCcw, ShieldAlert } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  backfillTaxonomyCases,
  buildTaxonomyRolloutReportUrl,
  fetchRolloutPolicies,
  fetchRolloutPolicyByL1Code,
  fetchTaxonomyRolloutReports,
  reclassifyTaxonomyCases,
  type BackfillTaxonomyCasesRequest,
  type ReclassifyTaxonomyCasesRequest,
  type TaxonomyRolloutPolicyDetail,
  type TaxonomyRolloutPolicyListItem,
  type TaxonomyRolloutRecoveryOperation,
  type TaxonomyRolloutRecoveryResult,
  type TaxonomyRolloutReportHistoryResponse,
  type TaxonomyRolloutState,
} from '@/lib/api/taxonomy-rollout'

const ALLOWED_ROLES = ['admin']
const HISTORY_LIMIT = 2

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

type PendingRecoveryRequest = {
  operation: TaxonomyRolloutRecoveryOperation
  l1Code: string
  batchId: string | null
  caseIds: string[]
  classifierVersion: string | null
  shadowOnly: boolean
  dryRun: boolean
  scopeLabel: string
}

type OperatorReadableError = {
  message: string
  code?: string
  auditId?: string
  status?: number
  operation?: TaxonomyRolloutRecoveryOperation
  l1Code?: string
}

function errorMessage(error: unknown, fallback = '操作失败') {
  if (!(error instanceof Error)) return fallback
  const message = error.message?.trim()
  if (!message) return fallback
  return message
}

function operatorError(
  error: unknown,
  fallback: string,
  context?: Pick<OperatorReadableError, 'operation' | 'l1Code'>
): OperatorReadableError {
  const source = error as Partial<OperatorReadableError> | null
  return {
    message: errorMessage(error, fallback),
    code: typeof source?.code === 'string' ? source.code : undefined,
    auditId: typeof source?.auditId === 'string' ? source.auditId : undefined,
    status: typeof source?.status === 'number' ? source.status : undefined,
    operation: context?.operation,
    l1Code: context?.l1Code,
  }
}

function parseCaseIds(value: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  value
    .split(/[,\n]+/)
    .map((caseId) => caseId.trim())
    .filter(Boolean)
    .forEach((caseId) => {
      if (seen.has(caseId)) return
      seen.add(caseId)
      result.push(caseId)
    })

  return result
}

function formatUtcDateTime(value: string | null | undefined): string {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes} UTC`
}

function formatBoolean(value: boolean | null | undefined): string {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return 'N/A'
}

function operationLabel(operation: TaxonomyRolloutRecoveryOperation): string {
  return operation === 'reclassify' ? 'Reclassify' : 'Backfill'
}

function buildScopeLabel(batchId: string | null, caseIds: string[]): string {
  const parts: string[] = []
  if (batchId) parts.push(`Batch ${batchId}`)
  if (caseIds.length > 0) {
    parts.push(`${caseIds.length} case ID${caseIds.length === 1 ? '' : 's'}`)
  }
  return parts.length > 0 ? parts.join(' + ') : 'Domain scope only'
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
  const href = buildTaxonomyRolloutReportUrl(reportPath)
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

function OperatorErrorAlert({ error }: { error: OperatorReadableError }) {
  return (
    <Alert variant="destructive" className="rounded-sm">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="space-y-1">
        <p className="font-semibold">Operator review required</p>
        {error.code && <p>{error.code}</p>}
        <p>{error.message}</p>
        {error.operation && error.l1Code && (
          <p>
            Action: {operationLabel(error.operation)} / Domain: {error.l1Code}
          </p>
        )}
        {error.auditId && <p>Audit ID: {error.auditId}</p>}
      </AlertDescription>
    </Alert>
  )
}

export default function TaxonomyRolloutRecoveryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const canAccess = Boolean(session?.user && ALLOWED_ROLES.includes(session.user.role))

  const [policies, setPolicies] = useState<TaxonomyRolloutPolicyListItem[]>([])
  const [selectedL1Code, setSelectedL1Code] = useState<string | null>(null)
  const [detail, setDetail] = useState<TaxonomyRolloutPolicyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFailure, setLastFailure] = useState<OperatorReadableError | null>(null)
  const [operation, setOperation] = useState<TaxonomyRolloutRecoveryOperation>('reclassify')
  const [batchId, setBatchId] = useState('')
  const [caseIdsInput, setCaseIdsInput] = useState('')
  const [classifierVersion, setClassifierVersion] = useState('')
  const [shadowOnly, setShadowOnly] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [pendingRequest, setPendingRequest] = useState<PendingRecoveryRequest | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmationText, setConfirmationText] = useState('')
  const [dialogError, setDialogError] = useState<OperatorReadableError | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [latestResult, setLatestResult] = useState<TaxonomyRolloutRecoveryResult | null>(null)
  const [history, setHistory] = useState<TaxonomyRolloutReportHistoryResponse | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [dateFromInput, setDateFromInput] = useState('')
  const [dateToInput, setDateToInput] = useState('')
  const [appliedDateFrom, setAppliedDateFrom] = useState('')
  const [appliedDateTo, setAppliedDateTo] = useState('')
  const selectedL1CodeRef = useRef<string | null>(null)
  const historyRequestKeyRef = useRef<string | null>(null)

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

  const loadHistoryFor = useCallback(
    async (l1Code: string, page: number, dateFrom: string, dateTo: string) => {
      const requestKey = `${l1Code}:${page}:${dateFrom}:${dateTo}`
      historyRequestKeyRef.current = requestKey
      try {
        setHistoryLoading(true)
        const data = await fetchTaxonomyRolloutReports({
          l1Code,
          page,
          limit: HISTORY_LIMIT,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        })
        if (historyRequestKeyRef.current === requestKey) setHistory(data)
      } catch (historyError) {
        if (historyRequestKeyRef.current === requestKey) {
          setHistory(null)
          setError(errorMessage(historyError, '加载 report history 失败'))
        }
      } finally {
        if (historyRequestKeyRef.current === requestKey) setHistoryLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    if (!selectedL1Code || status !== 'authenticated' || !canAccess) {
      setHistory(null)
      return
    }

    void loadHistoryFor(selectedL1Code, historyPage, appliedDateFrom, appliedDateTo)
  }, [
    appliedDateFrom,
    appliedDateTo,
    canAccess,
    historyPage,
    loadHistoryFor,
    selectedL1Code,
    status,
  ])

  const selectedPolicy = useMemo(
    () => policies.find((policy) => policy.l1Code === selectedL1Code) ?? null,
    [policies, selectedL1Code]
  )

  const parsedCaseIds = useMemo(() => parseCaseIds(caseIdsInput), [caseIdsInput])
  const actionButtonLabel =
    operation === 'reclassify'
      ? dryRun
        ? 'Run Reclassify Dry Run'
        : 'Run Reclassify'
      : 'Run Backfill'
  const hasNextPage = history
    ? (history.hasNextPage ?? history.page * history.limit < history.total)
    : false

  function resetOperationState() {
    setLatestResult(null)
    setLastFailure(null)
    setDialogError(null)
    setConfirmationText('')
  }

  async function refreshSelectedPolicy() {
    if (!selectedL1Code) return
    const [nextPolicies, nextDetail] = await Promise.all([
      fetchRolloutPolicies(),
      fetchRolloutPolicyByL1Code(selectedL1Code),
    ])
    setPolicies(nextPolicies)
    setDetail(nextDetail)
  }

  function handleOpenConfirmation() {
    if (!selectedL1Code) {
      setError('请选择 domain 后再执行 recovery operation。')
      return
    }

    const normalizedBatchId = batchId.trim()
    const normalizedClassifierVersion = classifierVersion.trim()
    const caseIds = parseCaseIds(caseIdsInput)

    if (!dryRun && !normalizedBatchId && caseIds.length === 0) {
      setError('正式执行必须提供 Batch ID 或 Case IDs，避免无收窄范围的高风险操作。')
      return
    }

    setError(null)
    setDialogError(null)
    setLastFailure(null)
    setPendingRequest({
      operation,
      l1Code: selectedL1Code,
      batchId: normalizedBatchId || null,
      caseIds,
      classifierVersion: normalizedClassifierVersion || null,
      shadowOnly,
      dryRun,
      scopeLabel: buildScopeLabel(normalizedBatchId || null, caseIds),
    })
    setConfirmOpen(true)
  }

  function closeDialog() {
    if (dialogError) setLastFailure(dialogError)
    setConfirmOpen(false)
    setDialogError(null)
    setConfirmationText('')
  }

  async function handleConfirm() {
    if (!pendingRequest) return

    if (confirmationText.trim().toUpperCase() !== pendingRequest.l1Code) {
      setDialogError({
        message: 'Type Domain Code to Confirm 必须匹配当前 domain。',
        code: 'CONFIRMATION_MISMATCH',
        operation: pendingRequest.operation,
        l1Code: pendingRequest.l1Code,
      })
      return
    }

    const basePayload = {
      l1Code: pendingRequest.l1Code,
      dryRun: pendingRequest.dryRun,
      confirmationText: confirmationText.trim().toUpperCase(),
      ...(pendingRequest.batchId ? { batchId: pendingRequest.batchId } : {}),
      ...(pendingRequest.caseIds.length > 0 ? { caseIds: pendingRequest.caseIds } : {}),
    }

    try {
      setIsSubmitting(true)
      setDialogError(null)
      setLastFailure(null)
      setError(null)

      const result =
        pendingRequest.operation === 'reclassify'
          ? await reclassifyTaxonomyCases({
              ...basePayload,
              ...(pendingRequest.classifierVersion
                ? { classifierVersion: pendingRequest.classifierVersion }
                : {}),
              shadowOnly: pendingRequest.shadowOnly,
            } satisfies ReclassifyTaxonomyCasesRequest)
          : await backfillTaxonomyCases({
              ...basePayload,
              ...(pendingRequest.classifierVersion
                ? { classifierVersion: pendingRequest.classifierVersion }
                : {}),
              shadowOnly: pendingRequest.shadowOnly,
            } satisfies BackfillTaxonomyCasesRequest)

      setLatestResult(result)
      setConfirmOpen(false)
      setConfirmationText('')
      setPendingRequest(null)
      await Promise.all([
        refreshSelectedPolicy(),
        loadHistoryFor(pendingRequest.l1Code, 1, appliedDateFrom, appliedDateTo),
      ])
      setHistoryPage(1)
    } catch (submitError) {
      setDialogError(
        operatorError(submitError, `${operationLabel(pendingRequest.operation)} 操作失败`, {
          operation: pendingRequest.operation,
          l1Code: pendingRequest.l1Code,
        })
      )
    } finally {
      setIsSubmitting(false)
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
                  无权访问 Taxonomy Rollout Recovery Console
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

  return (
    <div className="min-h-screen bg-[#FEFDFB] px-6 py-16">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <RotateCcw className="h-6 w-6 text-[#1E3A5F]" />
              <h1 className="text-3xl font-bold text-[#1E3A5F]">
                Taxonomy Rollout Recovery Console
              </h1>
            </div>
            <p className="mt-1 text-[#64748B]">
              独立执行 reclassify / backfill，并查看最近的 recovery、retirement 和 evidence
              history。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
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
              <Link
                href={
                  selectedL1Code
                    ? `/admin/taxonomy-rollout/gates?l1Code=${selectedL1Code}`
                    : '/admin/taxonomy-rollout/gates'
                }
              >
                打开 Gates Console
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

        {lastFailure && <OperatorErrorAlert error={lastFailure} />}

        {latestResult && (
          <Alert className="rounded-sm border-emerald-200 bg-emerald-50 text-emerald-900">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="space-y-1">
              <p className="font-semibold">Recovery operation completed</p>
              <p>
                {operationLabel(latestResult.operation)} for {latestResult.l1Code} processed{' '}
                {latestResult.processedCount} cases.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-[#1E3A5F]">Control Panel</CardTitle>
              <CardDescription>
                选择 domain 和 operation，先确认范围，再提交正式 API。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="text-[#1E3A5F]">Domain</Label>
                <Select
                  value={selectedL1Code ?? undefined}
                  onValueChange={(value) => {
                    selectedL1CodeRef.current = value
                    setSelectedL1Code(value)
                    setHistoryPage(1)
                    setLatestResult(null)
                    resetOperationState()
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
                <Label className="text-[#1E3A5F]">Operation</Label>
                <Select
                  value={operation}
                  onValueChange={(value) => {
                    setOperation(value as TaxonomyRolloutRecoveryOperation)
                    resetOperationState()
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select operation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reclassify">Reclassify</SelectItem>
                    <SelectItem value="backfill">Backfill</SelectItem>
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
                      <span className="text-[#64748B]">Classifier</span>
                      <span className="text-right text-xs font-medium text-[#1E3A5F]">
                        {selectedPolicy.activeClassifierVersion ?? 'N/A'}
                      </span>
                    </div>
                  </div>
                )
              )}

              <div className="space-y-2">
                <Label htmlFor="recovery-batch-id" className="text-[#1E3A5F]">
                  Batch ID
                </Label>
                <Input
                  id="recovery-batch-id"
                  value={batchId}
                  onChange={(event) => setBatchId(event.target.value)}
                  aria-label="Batch ID"
                  placeholder="batch-it04-2026-05-05"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recovery-case-ids" className="text-[#1E3A5F]">
                  Case IDs
                </Label>
                <Textarea
                  id="recovery-case-ids"
                  value={caseIdsInput}
                  onChange={(event) => setCaseIdsInput(event.target.value)}
                  aria-label="Case IDs"
                  placeholder="case-101, case-202&#10;case-303"
                  className="min-h-[96px] rounded-sm"
                />
                <p className="text-xs text-[#64748B]">
                  使用逗号或换行分隔；提交前会 trim、dedupe，并移除空值。当前 {parsedCaseIds.length}{' '}
                  个 case。
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recovery-classifier-version" className="text-[#1E3A5F]">
                  Classifier Version
                </Label>
                <Input
                  id="recovery-classifier-version"
                  value={classifierVersion}
                  onChange={(event) => setClassifierVersion(event.target.value)}
                  aria-label="Classifier Version"
                  placeholder="taxonomy-classifier-6.7"
                />
              </div>

              <div className="grid gap-3 rounded-sm border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="recovery-shadow-only" className="text-[#1E3A5F]">
                    Shadow Only
                  </Label>
                  <input
                    id="recovery-shadow-only"
                    type="checkbox"
                    checked={shadowOnly}
                    onChange={(event) => setShadowOnly(event.target.checked)}
                    aria-label="Shadow Only"
                    className="h-4 w-4 rounded-sm border-[#94A3B8] text-[#1E3A5F]"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="recovery-dry-run" className="text-[#1E3A5F]">
                    Dry Run
                  </Label>
                  <input
                    id="recovery-dry-run"
                    type="checkbox"
                    checked={dryRun}
                    onChange={(event) => setDryRun(event.target.checked)}
                    aria-label="Dry Run"
                    className="h-4 w-4 rounded-sm border-[#94A3B8] text-[#1E3A5F]"
                  />
                </div>
              </div>

              <Button
                className="w-full rounded-sm"
                disabled={!selectedL1Code || isSubmitting}
                onClick={handleOpenConfirmation}
              >
                {actionButtonLabel}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-[#1E3A5F]">
                  Latest Result
                </CardTitle>
                <CardDescription>
                  最近一次 reclassify / backfill 的结构化结果和 report link。
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!latestResult ? (
                  <div className="rounded-sm border border-dashed border-[#CBD5E1] px-4 py-10 text-center text-sm text-[#64748B]">
                    尚未执行 recovery operation。
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <Card className="rounded-sm border-[#E2E8F0] shadow-none">
                        <CardContent className="py-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#94A3B8]">
                            Processed Count
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-[#1E3A5F]">
                            {latestResult.processedCount}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-sm border-[#E2E8F0] shadow-none">
                        <CardContent className="py-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#94A3B8]">
                            Affected Domains
                          </p>
                          <p className="mt-2 text-lg font-semibold text-[#1E3A5F]">
                            {latestResult.affectedDomains.join(', ') || 'N/A'}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-sm border-[#E2E8F0] shadow-none">
                        <CardContent className="py-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#94A3B8]">
                            Latest Pointer Updated
                          </p>
                          <p className="mt-2 text-lg font-semibold text-[#1E3A5F]">
                            {formatBoolean(latestResult.latestPointerUpdated)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-sm border-[#E2E8F0] shadow-none">
                        <CardContent className="py-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#94A3B8]">
                            Classifier Version
                          </p>
                          <p className="mt-2 break-all text-sm font-semibold text-[#1E3A5F]">
                            {latestResult.classifierVersion ?? 'N/A'}
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="rounded-sm border-[#E2E8F0] bg-[#F8FAFC] shadow-none">
                      <CardContent className="space-y-3 py-4 text-sm">
                        <p className="font-medium text-[#1E3A5F]">
                          {latestResult.summary ?? 'No summary returned.'}
                        </p>
                        <p>Dry Run: {formatBoolean(latestResult.dryRun)}</p>
                        <p>Shadow Only: {formatBoolean(latestResult.shadowOnly)}</p>
                        {(latestResult.auditSummary?.auditId ?? latestResult.auditId) && (
                          <p>
                            Audit ID: {latestResult.auditSummary?.auditId ?? latestResult.auditId}
                          </p>
                        )}
                        {latestResult.reportPath ? (
                          <p>
                            <ReportLink reportPath={latestResult.reportPath} />
                          </p>
                        ) : (
                          <p>Report Path: N/A</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-[#1E3A5F]" />
                  <CardTitle className="text-lg font-semibold text-[#1E3A5F]">
                    <h2>Report History</h2>
                  </CardTitle>
                </div>
                <CardDescription>
                  服务端分页查看 retirement、rollback、reclassify、backfill 与 smoke evidence。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="recovery-date-from" className="text-[#1E3A5F]">
                      Date From
                    </Label>
                    <Input
                      id="recovery-date-from"
                      type="date"
                      value={dateFromInput}
                      onChange={(event) => setDateFromInput(event.target.value)}
                      aria-label="Date From"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recovery-date-to" className="text-[#1E3A5F]">
                      Date To
                    </Label>
                    <Input
                      id="recovery-date-to"
                      type="date"
                      value={dateToInput}
                      onChange={(event) => setDateToInput(event.target.value)}
                      aria-label="Date To"
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-sm"
                    onClick={() => {
                      setAppliedDateFrom(dateFromInput.trim())
                      setAppliedDateTo(dateToInput.trim())
                      setHistoryPage(1)
                    }}
                  >
                    Apply Filters
                  </Button>
                </div>

                {detailLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-[#1E3A5F]" />
                  </div>
                ) : detail ? (
                  <Card className="rounded-sm border-[#E2E8F0] bg-[#F8FAFC] shadow-none">
                    <CardContent className="grid gap-3 py-4 text-sm md:grid-cols-3">
                      <div>
                        <p className="text-[#64748B]">Last Reclassify</p>
                        <p className="font-medium text-[#1E3A5F]">
                          {formatUtcDateTime(
                            detail.retirementEvidenceJson.lastReclassifyVerifiedAt
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#64748B]">Last Backfill</p>
                        <p className="font-medium text-[#1E3A5F]">
                          {formatUtcDateTime(detail.retirementEvidenceJson.lastBackfillVerifiedAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#64748B]">Last Smoke Evidence</p>
                        <p className="font-medium text-[#1E3A5F]">
                          {formatUtcDateTime(detail.retirementEvidenceJson.lastSmokeVerifiedAt)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {historyLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-[#1E3A5F]" />
                  </div>
                ) : !history || history.items.length === 0 ? (
                  <div className="rounded-sm border border-dashed border-[#CBD5E1] px-4 py-8 text-center text-sm text-[#64748B]">
                    当前筛选条件下没有 report history。
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.items.map((item) => (
                      <Card key={item.id} className="rounded-sm border-[#E2E8F0] shadow-none">
                        <CardContent className="space-y-3 py-4 text-sm">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{item.type}</Badge>
                              <Badge>{item.status ?? item.outcome ?? 'unknown'}</Badge>
                              <span className="font-mono text-xs text-[#64748B]">
                                {item.l1Code}
                              </span>
                            </div>
                            <span className="text-xs text-[#64748B]">
                              {formatUtcDateTime(item.createdAt ?? item.occurredAt)}
                            </span>
                          </div>
                          <p className="font-medium text-[#1E3A5F]">
                            {item.summary ?? 'No summary returned.'}
                          </p>
                          {item.reportPath && (
                            <p>
                              Report: <ReportLink reportPath={item.reportPath} />
                            </p>
                          )}
                          {item.evidenceLink && (
                            <p>
                              Evidence: <ReportLink reportPath={item.evidenceLink} />
                            </p>
                          )}
                          {item.auditId && <p>Audit ID: {item.auditId}</p>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t border-[#E2E8F0] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-[#64748B]">
                    Page {history?.page ?? historyPage} / Limit {history?.limit ?? HISTORY_LIMIT} /
                    Total {history?.total ?? 0}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="rounded-sm"
                      disabled={historyPage <= 1 || historyLoading}
                      onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                    >
                      Previous Page
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-sm"
                      disabled={!hasNextPage || historyLoading}
                      onClick={() => setHistoryPage((page) => page + 1)}
                    >
                      Next Page
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog
          open={confirmOpen}
          onOpenChange={(open) => {
            if (open) setConfirmOpen(true)
            else closeDialog()
          }}
        >
          <DialogContent className="rounded-sm sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>
                Confirm {pendingRequest ? operationLabel(pendingRequest.operation) : 'Recovery'}
              </DialogTitle>
              <DialogDescription>
                这是高风险恢复操作。请复核 domain、operation、scope、dryRun、shadowOnly 和
                classifierVersion 后再执行。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              {dialogError && <OperatorErrorAlert error={dialogError} />}

              <div className="grid grid-cols-2 gap-3 rounded-sm border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-sm">
                <div>
                  <p className="text-[#64748B]">Domain</p>
                  <p className="mt-1 font-medium text-[#1E3A5F]">
                    {pendingRequest?.l1Code ?? 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-[#64748B]">Operation</p>
                  <p className="mt-1 font-medium text-[#1E3A5F]">
                    {pendingRequest ? operationLabel(pendingRequest.operation) : 'N/A'}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[#64748B]">Scope</p>
                  <p className="mt-1 font-medium text-[#1E3A5F]">
                    {pendingRequest?.scopeLabel ?? 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-[#64748B]">Dry Run</p>
                  <p className="mt-1 font-medium text-[#1E3A5F]">
                    {formatBoolean(pendingRequest?.dryRun)}
                  </p>
                </div>
                <div>
                  <p className="text-[#64748B]">Execution Mode</p>
                  <p className="mt-1 font-medium text-[#1E3A5F]">
                    {pendingRequest?.dryRun ? 'Dry Run' : 'Execute'}
                  </p>
                </div>
                <div>
                  <p className="text-[#64748B]">Shadow Only</p>
                  <p className="mt-1 font-medium text-[#1E3A5F]">
                    {formatBoolean(pendingRequest?.shadowOnly)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[#64748B]">Classifier Version</p>
                  <p className="mt-1 break-all font-medium text-[#1E3A5F]">
                    {pendingRequest?.classifierVersion ?? 'N/A'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recovery-confirm-domain" className="text-[#1E3A5F]">
                  Type Domain Code to Confirm
                </Label>
                <Input
                  id="recovery-confirm-domain"
                  value={confirmationText}
                  onChange={(event) => setConfirmationText(event.target.value)}
                  aria-label="Type Domain Code to Confirm"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" className="rounded-sm" onClick={closeDialog}>
                Close
              </Button>
              <Button
                className="rounded-sm"
                disabled={!confirmationText.trim() || isSubmitting}
                onClick={() => void handleConfirm()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : pendingRequest?.operation === 'backfill' ? (
                  'Confirm Backfill'
                ) : (
                  'Confirm Reclassify'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
