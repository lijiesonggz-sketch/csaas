'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft,
  CheckCircle2,
  Gavel,
  Loader2,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  getProjectReviewItems,
  getProjectReviewResult,
  rerunProjectReviewItem,
  submitProjectReviewDecision,
  type ProjectReviewItem,
  type ProjectReviewQuery,
  type ProjectReviewRiskLevel,
  type ProjectReviewStage,
  type ProjectReviewStatus,
} from '@/lib/api/project-review'
import type { GenerationResult } from '@/lib/types/ai-generation'
import { ControlDetailDrawer } from '@/components/compliance/ControlDetailDrawer'
import { useOrganizationStore } from '@/lib/stores/useOrganizationStore'

type FilterValue<T extends string> = 'all' | T
type LocationHint = { label: string; value: string }

const LOCATION_HINT_LABELS: Record<string, string> = {
  clauseId: 'Clause ID',
  clause_id: 'Clause ID',
  clauseCode: 'Clause Code',
  clause_code: 'Clause Code',
  articleNo: '条号',
  article_no: '条号',
  sourceName: '来源',
  source_name: '来源',
  sourceDocumentName: '文档',
  source_document_name: '文档',
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeJsonPatch(base: unknown, patch: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch
  }

  const next: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    const current = next[key]
    next[key] =
      isPlainObject(current) && isPlainObject(value)
        ? mergeJsonPatch(current, value)
        : value
  }
  return next
}

function normalizeDetailPayload(result: GenerationResult | null): Record<string, unknown> {
  if (!result) {
    return {}
  }

  if (typeof result.selectedResult === 'string') {
    try {
      return JSON.parse(result.selectedResult) as Record<string, unknown>
    } catch {
      return {
        raw: result.selectedResult,
      }
    }
  }

  return (result.selectedResult ?? {}) as Record<string, unknown>
}

function extractLocationHints(
  value: unknown,
  maxItems = 8,
): LocationHint[] {
  const hints: LocationHint[] = []
  const seen = new Set<string>()

  function walk(input: unknown, depth: number) {
    if (hints.length >= maxItems || depth > 4) {
      return
    }

    if (Array.isArray(input)) {
      input.slice(0, 6).forEach((item) => walk(item, depth + 1))
      return
    }

    if (!isPlainObject(input)) {
      return
    }

    for (const [key, rawValue] of Object.entries(input)) {
      if (hints.length >= maxItems) {
        return
      }

      if (
        LOCATION_HINT_LABELS[key] &&
        typeof rawValue === 'string' &&
        rawValue.trim().length > 0
      ) {
        const token = `${key}:${rawValue}`
        if (!seen.has(token)) {
          seen.add(token)
          hints.push({
            label: LOCATION_HINT_LABELS[key],
            value: rawValue,
          })
        }
      }

      if (typeof rawValue === 'object' && rawValue !== null) {
        walk(rawValue, depth + 1)
      }
    }
  }

  walk(value, 0)
  return hints
}

function getStatusTone(status: ProjectReviewStatus) {
  switch (status) {
    case 'approved':
      return 'bg-emerald-100 text-emerald-700'
    case 'modified':
      return 'bg-amber-100 text-amber-700'
    case 'rejected':
      return 'bg-rose-100 text-rose-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

function getRiskTone(riskLevel: ProjectReviewRiskLevel) {
  switch (riskLevel) {
    case 'high':
      return 'bg-rose-100 text-rose-700'
    case 'medium':
      return 'bg-amber-100 text-amber-700'
    default:
      return 'bg-emerald-100 text-emerald-700'
  }
}

function getConfidenceTone(confidenceLevel: string) {
  switch (confidenceLevel) {
    case 'high':
      return 'bg-emerald-100 text-emerald-700'
    case 'medium':
      return 'bg-amber-100 text-amber-700'
    default:
      return 'bg-rose-100 text-rose-700'
  }
}

function formatScore(value: number | null): string {
  if (value === null) {
    return '验证中'
  }

  return `${Math.round(value * 100)}%`
}

const REVIEW_STATUS_OPTIONS: Array<{ value: FilterValue<ProjectReviewStatus>; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'modified', label: '已修改' },
  { value: 'rejected', label: '已拒绝' },
]

const RISK_LEVEL_OPTIONS: Array<{ value: FilterValue<ProjectReviewRiskLevel>; label: string }> = [
  { value: 'all', label: '全部风险' },
  { value: 'high', label: '高风险' },
  { value: 'medium', label: '中风险' },
  { value: 'low', label: '低风险' },
]

const REVIEW_STAGE_OPTIONS: Array<{ value: FilterValue<ProjectReviewStage>; label: string }> = [
  { value: 'all', label: '全部阶段' },
  { value: 'summary', label: '综述生成' },
  { value: 'clustering', label: '聚类分析' },
  { value: 'matrix', label: '成熟度矩阵' },
  { value: 'questionnaire', label: '问卷生成' },
  { value: 'action_plan', label: '改进措施' },
  { value: 'standard_interpretation', label: '标准解读' },
  { value: 'quick_gap_analysis', label: '超简版差距分析' },
]

export default function ProjectReviewPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const projectId = params.projectId as string
  const reviewerId = session?.user?.id || ''
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization)
  const organizationId = currentOrganization?.id

  const [items, setItems] = useState<ProjectReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [detailResult, setDetailResult] = useState<GenerationResult | null>(null)
  const [reasonInput, setReasonInput] = useState('')
  const [patchInput, setPatchInput] = useState('{}')
  const [noopWarningVisible, setNoopWarningVisible] = useState(false)
  const [actionBusy, setActionBusy] = useState<
    null | 'accept' | 'modify' | 'reject' | 'rerun' | 'bulk-approve'
  >(null)
  const [actionNotice, setActionNotice] = useState<null | { kind: 'success' | 'error'; message: string }>(null)
  const [filters, setFilters] = useState<{
    reviewStatus: FilterValue<ProjectReviewStatus>
    riskLevel: FilterValue<ProjectReviewRiskLevel>
    reviewStage: FilterValue<ProjectReviewStage>
  }>({
    reviewStatus: 'all',
    riskLevel: 'all',
    reviewStage: 'all',
  })

  // Story 7.4: 控制点详情抽屉状态
  const [controlDrawerOpen, setControlDrawerOpen] = useState(false)
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null)
  const [drawerContext, setDrawerContext] = useState<{
    organizationId: string
    controlId: string
    reviewItemId: string
  } | null>(null)

  const selectedItem = useMemo(
    () => items.find((item) => item.reviewItemId === selectedItemId) ?? null,
    [items, selectedItemId],
  )

  const editablePayload = useMemo(
    () => normalizeDetailPayload(detailResult),
    [detailResult],
  )
  const locationHints = useMemo(
    () => extractLocationHints(editablePayload),
    [editablePayload],
  )

  const listQuery = useMemo<ProjectReviewQuery>(() => {
    return {
      page: 1,
      pageSize: 20,
      reviewStatus:
        filters.reviewStatus === 'all' ? undefined : [filters.reviewStatus],
      riskLevel: filters.riskLevel === 'all' ? undefined : [filters.riskLevel],
      reviewStage: filters.reviewStage === 'all' ? undefined : filters.reviewStage,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    }
  }, [filters])
  const batchSummary = useMemo(() => {
    const pendingItems = items.filter((item) => item.reviewStatus === 'pending')
    const pendingHighRiskItems = pendingItems.filter((item) => item.highRiskFlag)
    return {
      totalItems: items.length,
      pendingCount: pendingItems.length,
      pendingHighRiskCount: pendingHighRiskItems.length,
    }
  }, [items])

  const loadReviewItems = useCallback(
    async (preserveSelection = true) => {
      try {
        setLoading(true)
        setError(null)
        const response = await getProjectReviewItems(projectId, listQuery)
        setItems(response.items)
        setActionNotice(null)

        if (response.items.length === 0) {
          setSelectedItemId(null)
          setDetailResult(null)
          setLoading(false)
          return
        }

        const nextSelectedId =
          preserveSelection &&
          selectedItemId &&
          response.items.some((item) => item.reviewItemId === selectedItemId)
            ? selectedItemId
            : response.items[0].reviewItemId

        setSelectedItemId(nextSelectedId)
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : '加载审核工作台失败'
        setError(message)
      } finally {
        setLoading(false)
      }
    },
    [listQuery, projectId, selectedItemId],
  )

  const loadDetailResult = useCallback(
    async (taskId: string, resetEditContext = true) => {
      try {
        setDetailLoading(true)
        const result = await getProjectReviewResult(taskId)
        setDetailResult(result)

        if (resetEditContext) {
          setReasonInput('')
          setPatchInput('{}')
          setNoopWarningVisible(false)
          setActionNotice(null)
        }
      } catch (detailError) {
        const message =
          detailError instanceof Error ? detailError.message : '加载审核详情失败'
        setActionNotice({
          kind: 'error',
          message,
        })
      } finally {
        setDetailLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void loadReviewItems(false)
  }, [loadReviewItems])

  useEffect(() => {
    if (!selectedItem?.taskId) {
      setDetailResult(null)
      return
    }

    void loadDetailResult(selectedItem.taskId, true)
  }, [loadDetailResult, selectedItem?.taskId])

  const handleDecision = useCallback(
    async (decision: 'accept' | 'modify' | 'reject') => {
      if (!selectedItem || !reviewerId) {
        setActionNotice({
          kind: 'error',
          message: '当前无法识别审核人，请重新登录后再试',
        })
        return
      }

      if (decision === 'reject' && !reasonInput.trim()) {
        setActionNotice({
          kind: 'error',
          message: '拒绝操作需要填写原因',
        })
        return
      }

      let modifiedResult: Record<string, unknown> | undefined

      if (decision === 'modify') {
        let patch: unknown
        try {
          patch = patchInput.trim() ? JSON.parse(patchInput) : {}
        } catch {
          setActionNotice({
            kind: 'error',
            message: '修改 patch 不是合法 JSON',
          })
          return
        }

        modifiedResult = mergeJsonPatch(editablePayload, patch) as Record<string, unknown>

        if (JSON.stringify(modifiedResult) === JSON.stringify(editablePayload)) {
          setNoopWarningVisible(true)
          setActionNotice({
            kind: 'error',
            message: '内容未变更，请确认后再提交修改',
          })
          return
        }
      }

      try {
        setActionBusy(decision)
        setActionNotice(null)
        setNoopWarningVisible(false)

        await submitProjectReviewDecision({
          reviewItemId: selectedItem.reviewItemId,
          decision,
          reviewedBy: reviewerId,
          modifiedResult,
          reason: reasonInput.trim() || undefined,
        })

        const successMessage =
          decision === 'accept'
            ? '审核通过已保存'
            : decision === 'modify'
              ? '修改结果已保存'
              : '拒绝结果已保存'

        toast.success(successMessage)
        setActionNotice({
          kind: 'success',
          message: successMessage,
        })
        setReasonInput('')
        setPatchInput('{}')
        await loadReviewItems(true)
        if (selectedItem.taskId) {
          await loadDetailResult(selectedItem.taskId, true)
        }
      } catch (submitError) {
        const message =
          submitError instanceof Error ? submitError.message : '提交审核动作失败'
        toast.error(message)
        setActionNotice({
          kind: 'error',
          message,
        })
      } finally {
        setActionBusy(null)
      }
    },
    [
      editablePayload,
      loadDetailResult,
      loadReviewItems,
      patchInput,
      reasonInput,
      reviewerId,
      selectedItem,
    ],
  )

  const handleRerun = useCallback(async () => {
    if (!selectedItem) {
      return
    }

    try {
      setActionBusy('rerun')
      const result = await rerunProjectReviewItem({
        projectId,
        reviewStage: selectedItem.reviewStage,
        reason: reasonInput.trim() || undefined,
      })

      if (result.status === 'queued') {
        toast.success(result.message)
        setActionNotice({
          kind: 'success',
          message: `rerun 状态：queued，${result.message}`,
        })
        await loadReviewItems(true)
      } else {
        toast.error(result.message)
        setActionNotice({
          kind: 'error',
          message: `rerun 状态：retry-later，${result.message}`,
        })
      }
    } finally {
      setActionBusy(null)
    }
  }, [loadReviewItems, projectId, reasonInput, selectedItem])

  const handleBulkApprove = useCallback(async () => {
    if (!reviewerId) {
      setActionNotice({
        kind: 'error',
        message: '当前无法识别审核人，请重新登录后再试',
      })
      return
    }

    try {
      setActionBusy('bulk-approve')
      const latestBatch = await getProjectReviewItems(projectId, listQuery)
      const blockingHighRiskItems = latestBatch.items.filter(
        (item) => item.highRiskFlag && item.reviewStatus === 'pending',
      )

      if (blockingHighRiskItems.length > 0) {
        setActionNotice({
          kind: 'error',
          message: `仍有未确认高风险项：${blockingHighRiskItems
            .map((item) => item.reviewItemId)
            .join('、')}`,
        })
        return
      }

      const approvableItems = latestBatch.items.filter(
        (item) => item.reviewStatus === 'pending',
      )

      if (approvableItems.length === 0) {
        setActionNotice({
          kind: 'success',
          message: '当前筛选范围内没有可批量通过的待处理项',
        })
        return
      }

      for (const item of approvableItems) {
        await submitProjectReviewDecision({
          reviewItemId: item.reviewItemId,
          decision: 'accept',
          reviewedBy: reviewerId,
        })
      }

      toast.success(`已整批通过 ${approvableItems.length} 项`)
      setActionNotice({
        kind: 'success',
        message: `已整批通过 ${approvableItems.length} 项`,
      })
      await loadReviewItems(true)
    } catch (bulkError) {
      const message =
        bulkError instanceof Error ? bulkError.message : '整批通过失败'
      setActionNotice({
        kind: 'error',
        message,
      })
    } finally {
      setActionBusy(null)
    }
  }, [listQuery, loadReviewItems, projectId, reviewerId])

  // Story 7.4: 处理控制点详情打开
  const handleOpenControlDetail = useCallback((controlId: string) => {
    if (!organizationId || !selectedItem) {
      return
    }

    setDrawerContext({
      organizationId,
      controlId,
      reviewItemId: selectedItem.reviewItemId,
    })
    setSelectedControlId(controlId)
    setControlDrawerOpen(true)
  }, [organizationId, selectedItem])

  return (
    <div className="w-full px-6 py-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f766e] via-[#155e75] to-[#1d4ed8] p-8 mb-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.12)_0%,transparent_50%)]" />

        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Gavel className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">审核工作台</h1>
              <p className="text-sm text-white/80">
                统一处理 accept / modify / reject / rerun，并追踪风险与置信度
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => void loadReviewItems(true)}
              className="bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              刷新
            </Button>
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {actionNotice && (
        <Alert
          className={`mb-6 ${
            actionNotice.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          <AlertTitle>
            {actionNotice.kind === 'success' ? '操作成功' : '操作提醒'}
          </AlertTitle>
          <AlertDescription>{actionNotice.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="border-0 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <CardHeader>
            <CardTitle>待审列表</CardTitle>
            <CardDescription>筛选并选择要处理的审核项</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-500">审核状态</span>
                <select
                  aria-label="审核状态筛选"
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={filters.reviewStatus}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      reviewStatus: event.target.value as FilterValue<ProjectReviewStatus>,
                    }))
                  }
                >
                  {REVIEW_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-slate-500">风险等级</span>
                <select
                  aria-label="风险等级筛选"
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={filters.riskLevel}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      riskLevel: event.target.value as FilterValue<ProjectReviewRiskLevel>,
                    }))
                  }
                >
                  {RISK_LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-slate-500">审核阶段</span>
                <select
                  aria-label="审核阶段筛选"
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={filters.reviewStage}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      reviewStage: event.target.value as FilterValue<ProjectReviewStage>,
                    }))
                  }
                >
                  {REVIEW_STAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-900">当前筛选批次</p>
                <p className="text-xs text-slate-500">
                  整批通过前会按当前筛选条件重新拉取最新列表并校验高风险项
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">总数</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {batchSummary.totalItems}
                  </p>
                </div>
                <div className="rounded-xl bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">待处理</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {batchSummary.pendingCount}
                  </p>
                </div>
                <div className="rounded-xl bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">高风险待确认</p>
                  <p className="text-lg font-semibold text-rose-700">
                    {batchSummary.pendingHighRiskCount}
                  </p>
                </div>
              </div>

              <Button
                data-testid="review-bulk-approve-button"
                onClick={() => void handleBulkApprove()}
                disabled={actionBusy !== null || batchSummary.totalItems === 0}
                className="w-full bg-slate-900 hover:bg-slate-800"
              >
                {actionBusy === 'bulk-approve' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                整批通过当前筛选
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 py-12 text-slate-500">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                正在加载审核项...
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                当前筛选条件下没有待审项。
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <button
                    key={item.reviewItemId}
                    type="button"
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      item.reviewItemId === selectedItemId
                        ? 'border-sky-500 bg-sky-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                    onClick={() => setSelectedItemId(item.reviewItemId)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(item.updatedAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
                      {item.highRiskFlag && (
                        <ShieldAlert className="w-4 h-4 text-rose-500 mt-1" />
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      <Badge className={getStatusTone(item.reviewStatus)}>
                        {item.reviewStatus}
                      </Badge>
                      <Badge className={getRiskTone(item.riskLevel)}>
                        {item.riskLevel}
                      </Badge>
                      <Badge className={getConfidenceTone(item.confidenceLevel)}>
                        {item.confidenceLevel}
                      </Badge>
                    </div>

                    {item.degradationReasons.length > 0 && (
                      <p className="mt-3 text-xs text-slate-600">
                        {item.degradationReasons.join('；')}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <CardHeader>
            <CardTitle>详情区</CardTitle>
            <CardDescription>
              查看当前选中项的来源预览、AI 输出与审核动作
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!selectedItem ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
                暂无可展示的审核详情。
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold text-slate-900">
                    {selectedItem.title}
                  </h2>
                  <Badge className={getStatusTone(selectedItem.reviewStatus)}>
                    {selectedItem.reviewStatus}
                  </Badge>
                  <Badge className={getRiskTone(selectedItem.riskLevel)}>
                    {selectedItem.riskLevel}
                  </Badge>
                  <Badge className={getConfidenceTone(selectedItem.confidenceLevel)}>
                    {selectedItem.confidenceLevel}
                  </Badge>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <Card className="border border-slate-200 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base">原文来源对照</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-slate-700">
                      <p>
                        <span className="font-medium">文档：</span>
                        {selectedItem.sourcePreview.sourceDocumentName || '未提供'}
                      </p>
                      <p>
                        <span className="font-medium">抽取质量：</span>
                        {selectedItem.sourcePreview.extractionQuality}
                      </p>
                      {selectedItem.sourcePreview.extractionQuality === 'partial' && (
                        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                          <AlertTitle>原文抽取可能不完整</AlertTitle>
                          <AlertDescription>
                            当前原文来源来自 PDF/扫描件或不完整抽取，但系统仍只展示已有片段，不会补造内容。
                          </AlertDescription>
                        </Alert>
                      )}
                      {!selectedItem.sourcePreview.sourceExcerpt && (
                        <Alert className="border-slate-200 bg-slate-50 text-slate-900">
                          <AlertTitle>缺少原文来源</AlertTitle>
                          <AlertDescription>
                            当前缺少原文来源或引用不完整，系统不会猜测或补造原文内容。
                          </AlertDescription>
                        </Alert>
                      )}
                      <div className="space-y-2">
                        <p className="font-medium">定位线索</p>
                        {locationHints.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {locationHints.map((hint) => (
                              <Badge
                                key={`${hint.label}:${hint.value}`}
                                className="bg-slate-100 text-slate-700"
                              >
                                {hint.label}: {hint.value}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">
                            当前详情没有可提取的 clause / source / article 定位线索。
                          </p>
                        )}
                        {selectedItem.controlId && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenControlDetail(selectedItem.controlId as string)}
                            disabled={!organizationId}
                            className="mt-2"
                          >
                            查看控制点详情
                          </Button>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3">
                        {selectedItem.sourcePreview.sourceExcerpt || '当前没有可展示的原文预览'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border border-slate-200 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base">AI 结果对照</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-slate-700">
                      <p>
                        <span className="font-medium">阶段：</span>
                        {selectedItem.reviewStage}
                      </p>
                      <p>
                        <span className="font-medium">可重跑：</span>
                        {selectedItem.canRerun ? '是' : '否'}
                      </p>
                      <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3">
                        {selectedItem.sourcePreview.aiExcerpt}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {detailLoading ? (
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-slate-500">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    正在加载详情...
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Card className="border border-slate-200 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-base">一致性与置信度面板</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {(selectedItem.highRiskFlag || selectedItem.confidenceLevel === 'low') && (
                          <Alert className="border-rose-200 bg-rose-50 text-rose-900">
                            <AlertTitle>当前项需要优先处理</AlertTitle>
                            <AlertDescription>
                              检测到高风险分歧或低置信度结果，请在继续批量操作前完成人工复核。
                            </AlertDescription>
                          </Alert>
                        )}

                        <div className="grid gap-3 md:grid-cols-3">
                          {([
                            ['结构一致性', selectedItem.consistencyScores.structural],
                            ['语义一致性', selectedItem.consistencyScores.semantic],
                            ['细节一致性', selectedItem.consistencyScores.detail],
                          ] as const).map(([label, value]) => (
                            <div
                              key={label}
                              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                            >
                              <p className="text-sm text-slate-500">{label}</p>
                              <p className="mt-2 text-2xl font-semibold text-slate-900">
                                {formatScore(value)}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge className={getConfidenceTone(selectedItem.confidenceLevel)}>
                            置信度：{selectedItem.confidenceLevel}
                          </Badge>
                          <Badge className={getRiskTone(selectedItem.riskLevel)}>
                            风险：{selectedItem.riskLevel}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm font-medium text-slate-900">降级原因</p>
                          {selectedItem.degradationReasons.length > 0 ? (
                            <ul className="space-y-2 text-sm text-slate-700">
                              {selectedItem.degradationReasons.map((reason) => (
                                <li
                                  key={reason}
                                  className="rounded-xl bg-slate-50 px-3 py-2"
                                >
                                  {reason}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-slate-500">
                              当前没有额外降级原因。
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-4">
                      <Card className="border border-slate-200 shadow-none">
                        <CardHeader>
                          <CardTitle className="text-base">当前结果 JSON</CardTitle>
                          <CardDescription>
                            右侧 patch 仅填写你要修改的字段，不要整体复制粘贴整个对象。
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Textarea
                            aria-label="当前结果 JSON"
                            readOnly
                            value={JSON.stringify(editablePayload, null, 2)}
                            className="min-h-[360px] font-mono text-xs"
                          />
                        </CardContent>
                      </Card>
                    </div>

                    <div className="space-y-4">
                      <Card className="border border-slate-200 shadow-none">
                        <CardHeader>
                          <CardTitle className="text-base">修改 patch</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Textarea
                            aria-label="修改 patch JSON"
                            value={patchInput}
                            onChange={(event) => {
                              setPatchInput(event.target.value)
                              setNoopWarningVisible(false)
                            }}
                            className="min-h-[220px] font-mono text-xs"
                          />
                        </CardContent>
                      </Card>

                      <Card className="border border-slate-200 shadow-none">
                        <CardHeader>
                          <CardTitle className="text-base">审核备注 / 理由</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Input
                            aria-label="审核理由"
                            placeholder="输入 reject / rerun 的原因，或 modify 的补充说明"
                            value={reasonInput}
                            onChange={(event) => setReasonInput(event.target.value)}
                          />
                        </CardContent>
                      </Card>

                      {noopWarningVisible && (
                        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                          <AlertTitle>内容未变更</AlertTitle>
                          <AlertDescription>
                            当前 patch 合并后与原始内容完全一致，请继续编辑或取消本次修改。
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="grid gap-3">
                        <Button
                          aria-label="接受审核"
                          data-testid="review-accept-button"
                          onClick={() => void handleDecision('accept')}
                          disabled={actionBusy !== null || !reviewerId}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          {actionBusy === 'accept' ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                          )}
                          接受
                        </Button>

                        <Button
                          aria-label="提交修改"
                          data-testid="review-modify-button"
                          onClick={() => void handleDecision('modify')}
                          disabled={actionBusy !== null || !reviewerId}
                          className="bg-amber-600 hover:bg-amber-700"
                        >
                          {actionBusy === 'modify' ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Gavel className="w-4 h-4 mr-2" />
                          )}
                          提交修改
                        </Button>

                        <Button
                          aria-label="拒绝审核"
                          data-testid="review-reject-button"
                          onClick={() => void handleDecision('reject')}
                          disabled={actionBusy !== null || !reviewerId}
                          variant="destructive"
                        >
                          {actionBusy === 'reject' ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4 mr-2" />
                          )}
                          拒绝
                        </Button>

                        <Button
                          aria-label="重新生成审核项"
                          data-testid="review-rerun-button"
                          onClick={() => void handleRerun()}
                          disabled={actionBusy !== null || !selectedItem.canRerun}
                          variant="outline"
                        >
                          {actionBusy === 'rerun' ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-2" />
                          )}
                          重新生成
                        </Button>
                      </div>
                    </div>
                  </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Story 7.4: Control Detail Drawer */}
      {controlDrawerOpen && drawerContext && (
        <ControlDetailDrawer
          open={controlDrawerOpen}
          onOpenChange={setControlDrawerOpen}
          organizationId={drawerContext.organizationId}
          controlId={drawerContext.controlId}
          sourceModule="audit"
          sourceRecordId={drawerContext.reviewItemId}
        />
      )}
    </div>
  )
}
