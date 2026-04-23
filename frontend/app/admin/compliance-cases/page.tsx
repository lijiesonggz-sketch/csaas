'use client'

import React, { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  CaseControlMapSource,
  CaseControlRelationType,
  ComplianceCaseControlMapDraft,
  ComplianceCaseClusteringResult,
  ComplianceCaseExtractionResult,
  ComplianceCaseImportJobResult,
  ComplianceCaseStatus,
  ComplianceCaseSummary,
  ControlPointSummary,
  enqueueComplianceCaseImport,
  getComplianceCaseClustering,
  getComplianceCaseExtraction,
  getComplianceCases,
  searchControlPoints,
  submitComplianceCaseHumanReview,
} from '@/lib/api/compliance-cases'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ControlDetailDrawer } from '@/components/compliance/ControlDetailDrawer'

type CaseStatusFilter = ComplianceCaseStatus | 'all'
type ReviewDecision = 'approve' | 'reject' | 'pending'
type Filters = {
  batchId: string
  regulatorCode: string
  status: CaseStatusFilter
  keyword: string
}
type ManualMapping = {
  controlId: string
  controlCode: string
  controlName: string
  relationType: CaseControlRelationType
  confidenceScore: string
}

const DEFAULT_PAGE_SIZE = 10
const DEFAULT_FILTERS: Filters = { batchId: '', regulatorCode: '', status: 'all', keyword: '' }
const ALLOWED_ROLES = ['admin', 'consultant']

function errorMessage(error: unknown, fallback = '操作失败') {
  return error instanceof Error && error.message ? error.message : fallback
}

function errorStatus(error: unknown) {
  return error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
    ? error.status
    : null
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
}

function caseStatusLabel(status: ComplianceCaseStatus) {
  return {
    pending: '待处理',
    extracted: '已提取',
    clustered: '待人审',
    reviewed: '已审核',
    active: '启用',
    inactive: '停用',
  }[status]
}

function reviewStatusLabel(status: 'PENDING' | 'APPROVED' | 'REJECTED') {
  return { PENDING: '待审核', APPROVED: '已确认', REJECTED: '已拒绝' }[status]
}

function relationLabel(type: CaseControlRelationType) {
  return { VIOLATES: '违反', RELATED: '相关', SUPPORTS: '支持' }[type]
}

function sourceLabel(source: CaseControlMapSource) {
  return {
    RULE: '规则命中',
    LLM_ASSISTED_RULE: 'LLM辅助规则命中',
    LLM_FALLBACK: 'LLM兜底命中',
    MANUAL: '人工映射',
    FAILURE_MODE_CHAIN: '失效模式链路',
  }[source]
}

function buildDerivedFailureModeTrace(
  caseRecord: ComplianceCaseSummary | null,
  draft: ComplianceCaseControlMapDraft,
) {
  const failureMode = draft.derivedFailureMode
  if (!failureMode) {
    return null
  }

  const caseLabel = caseRecord?.caseCode ?? '当前案例'
  const failureModeLabel = `${failureMode.failureModeCode} · ${failureMode.failureModeName}`
  const controlLabel = draft.controlCode || draft.controlName || '当前控制点'

  return {
    label: '案例推导路径',
    detail: `${caseLabel} → ${failureModeLabel} → ${controlLabel}`,
  }
}

function themesEqual(left: string[] = [], right: string[] = []) {
  return left.length > 0 && left.length === right.length && left.every((value, index) => value === right[index])
}

function initialDecisions(clustering: ComplianceCaseClusteringResult | null) {
  if (!clustering) return {}
  return clustering.caseControlMapDrafts.reduce<Record<string, ReviewDecision>>((acc, draft) => {
    acc[draft.id] =
      draft.reviewStatus === 'APPROVED'
        ? 'approve'
        : draft.reviewStatus === 'REJECTED'
          ? 'reject'
          : 'pending'
    return acc
  }, {})
}

export default function ComplianceCasesAdminPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const canAccess = Boolean(session?.user && ALLOWED_ROLES.includes(session.user.role))
  const deepLinkedCaseId = searchParams.get('caseId')
  const pendingDeepLinkCaseId = useRef<string | null>(null)

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [items, setItems] = useState<ComplianceCaseSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [pagination, setPagination] = useState({ page: 1, limit: DEFAULT_PAGE_SIZE, total: 0, totalPages: 1 })

  const [importForm, setImportForm] = useState<{
    file: File | null
    regulatorCode: string
    batchId: string
  }>({
    file: null,
    regulatorCode: '',
    batchId: '',
  })
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ComplianceCaseImportJobResult | null>(null)
  const [importFileInputKey, setImportFileInputKey] = useState(0)

  const [selectedCase, setSelectedCase] = useState<ComplianceCaseSummary | null>(null)
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null)
  const [selectedControlTrace, setSelectedControlTrace] = useState<{
    label: string
    detail: string
  } | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailReloadToken, setDetailReloadToken] = useState(0)
  const [extraction, setExtraction] = useState<ComplianceCaseExtractionResult | null>(null)
  const [clustering, setClustering] = useState<ComplianceCaseClusteringResult | null>(null)
  const [reviewDecisions, setReviewDecisions] = useState<Record<string, ReviewDecision>>({})
  const [manualMappings, setManualMappings] = useState<ManualMapping[]>([])
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [controlKeyword, setControlKeyword] = useState('')
  const [controlLoading, setControlLoading] = useState(false)
  const [controlResults, setControlResults] = useState<ControlPointSummary[]>([])

  const detailStatus = clustering?.status ?? selectedCase?.status ?? null
  const canReview = detailStatus === 'clustered' && canAccess
  const normalizedNeedsAttention = themesEqual(
    extraction?.violationThemes ?? [],
    clustering?.normalizedThemes ?? [],
  )

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [router, status])

  useEffect(() => {
    if (deepLinkedCaseId) {
      pendingDeepLinkCaseId.current = deepLinkedCaseId
    }
  }, [deepLinkedCaseId])

  useEffect(() => {
    if (status !== 'authenticated' || !canAccess) return
    let cancelled = false

    async function loadCases() {
      try {
        setLoading(true)
        setError(null)
        setForbidden(false)
        const result = await getComplianceCases({
          page: pagination.page,
          limit: pagination.limit,
          batchId: appliedFilters.batchId || undefined,
          regulatorCode: appliedFilters.regulatorCode || undefined,
          status: appliedFilters.status === 'all' ? undefined : appliedFilters.status,
          keyword: appliedFilters.keyword || undefined,
        })
        if (cancelled) return
        setItems(result.items)
        setPagination((prev) => ({
          ...prev,
          total: result.total,
          totalPages: result.limit > 0 ? Math.max(1, Math.ceil(result.total / result.limit)) : 1,
        }))
      } catch (loadError) {
        if (cancelled) return
        if (errorStatus(loadError) === 403) {
          setForbidden(true)
          setError('你当前没有查看案例运营后台的权限。')
        } else {
          setError(errorMessage(loadError, '加载案例列表失败'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadCases()
    return () => {
      cancelled = true
    }
  }, [
    appliedFilters.batchId,
    appliedFilters.keyword,
    appliedFilters.regulatorCode,
    appliedFilters.status,
    canAccess,
    pagination.limit,
    pagination.page,
    reloadToken,
    status,
  ])

  useEffect(() => {
    if (loading || !deepLinkedCaseId || pendingDeepLinkCaseId.current !== deepLinkedCaseId) {
      return
    }

    const targetCase = items.find((item) => item.caseId === deepLinkedCaseId)
    if (targetCase) {
      pendingDeepLinkCaseId.current = null
      openDetail(targetCase)
      return
    }

    let cancelled = false

    async function loadDeepLinkedCase(caseId: string) {
      try {
        const result = await getComplianceCases({
          caseId,
          page: 1,
          limit: 1,
        })

        if (cancelled) {
          return
        }

        const deepLinkedCase = result.items.find((item) => item.caseId === caseId)
        if (deepLinkedCase) {
          openDetail(deepLinkedCase)
        }
      } finally {
        if (!cancelled) {
          pendingDeepLinkCaseId.current = null
        }
      }
    }

    void loadDeepLinkedCase(deepLinkedCaseId)

    return () => {
      cancelled = true
    }
  }, [deepLinkedCaseId, items, loading])

  useEffect(() => {
    if (!detailOpen || !selectedCase) return
    let cancelled = false
    const caseId = selectedCase.caseId

    async function loadDetails() {
      try {
        setDetailLoading(true)
        setDetailError(null)
        const [nextExtraction, nextClustering] = await Promise.all([
          getComplianceCaseExtraction(caseId),
          getComplianceCaseClustering(caseId),
        ])
        if (cancelled) return
        setExtraction(nextExtraction)
        setClustering(nextClustering)
        setReviewDecisions(initialDecisions(nextClustering))
      } catch (loadError) {
        if (cancelled) return
        setDetailError(errorMessage(loadError, '加载案例详情失败'))
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }

    void loadDetails()
    return () => {
      cancelled = true
    }
  }, [detailOpen, detailReloadToken, selectedCase])

  const applyFilters = () => {
    setPagination((prev) => ({ ...prev, page: 1 }))
    setAppliedFilters({
      batchId: filters.batchId.trim(),
      regulatorCode: filters.regulatorCode.trim(),
      status: filters.status,
      keyword: filters.keyword.trim(),
    })
  }

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS)
    setAppliedFilters(DEFAULT_FILTERS)
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const onFilterKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') applyFilters()
  }

  const handleImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const file = importForm.file
    const regulatorCode = importForm.regulatorCode.trim()
    const batchId = importForm.batchId.trim() || undefined

    if (!file || !regulatorCode) {
      setImportError('请上传文件并填写 regulatorCode。')
      return
    }

    try {
      setImporting(true)
      setImportError(null)
      setImportResult(null)
      const result = await enqueueComplianceCaseImport({
        file,
        regulatorCode,
        batchId,
      })
      setImportResult(result)
      toast.success('案例导入任务已创建')
      setImportForm((prev) => ({
        file: null,
        regulatorCode: prev.regulatorCode,
        batchId: '',
      }))
      setImportFileInputKey((prev) => prev + 1)
      const nextFilters = { ...DEFAULT_FILTERS, batchId: result.batchId, regulatorCode: result.regulatorCode, status: 'all' as const }
      setFilters(nextFilters)
      setAppliedFilters(nextFilters)
      setPagination((prev) => ({ ...prev, page: 1 }))
      setReloadToken((prev) => prev + 1)
    } catch (submitError) {
      const message = errorMessage(submitError, '创建导入任务失败')
      setImportError(message)
      toast.error(message)
    } finally {
      setImporting(false)
    }
  }

  const openDetail = (item: ComplianceCaseSummary) => {
    setSelectedCase(item)
    setSelectedControlId(null)
    setSelectedControlTrace(null)
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    setExtraction(null)
    setClustering(null)
    setManualMappings([])
    setReviewError(null)
    setControlKeyword('')
    setControlResults([])
    setDetailReloadToken((prev) => prev + 1)
  }

  const closeDetail = (open: boolean) => {
    if (!open && selectedControlId) {
      return
    }

    setDetailOpen(open)
    if (!open) {
      setDetailLoading(false)
      setSelectedCase(null)
      setExtraction(null)
      setClustering(null)
      setManualMappings([])
      setReviewDecisions({})
      setReviewError(null)
      setControlKeyword('')
      setControlResults([])
      setSelectedControlId(null)
      setSelectedControlTrace(null)
    }
  }

  const setDecision = (draftId: string, next: ReviewDecision) => {
    setReviewDecisions((prev) => ({ ...prev, [draftId]: prev[draftId] === next ? 'pending' : next }))
  }

  const searchControls = async () => {
    const keyword = controlKeyword.trim()
    if (!keyword) {
      setControlResults([])
      return
    }
    try {
      setControlLoading(true)
      const result = await searchControlPoints({ keyword, status: 'ACTIVE', limit: 10, page: 1 })
      const existingDraftIds = new Set(clustering?.caseControlMapDrafts.map((draft) => draft.controlId) ?? [])
      const existingManualIds = new Set(manualMappings.map((mapping) => mapping.controlId))
      setControlResults(result.items.filter((item) => !existingDraftIds.has(item.controlId) && !existingManualIds.has(item.controlId)))
    } catch (searchError) {
      toast.error(errorMessage(searchError, '搜索控制点失败'))
    } finally {
      setControlLoading(false)
    }
  }

  const addManualMapping = (item: ControlPointSummary) => {
    setManualMappings((prev) => [...prev, { controlId: item.controlId, controlCode: item.controlCode, controlName: item.controlName, relationType: 'VIOLATES', confidenceScore: '1' }])
    setControlResults((prev) => prev.filter((candidate) => candidate.controlId !== item.controlId))
  }

  const updateManualMapping = (controlId: string, field: 'relationType' | 'confidenceScore', value: string) => {
    setManualMappings((prev) => prev.map((mapping) => (mapping.controlId === controlId ? { ...mapping, [field]: value } : mapping)))
  }

  const removeManualMapping = (controlId: string) => {
    setManualMappings((prev) => prev.filter((mapping) => mapping.controlId !== controlId))
  }

  const submitReview = async () => {
    if (!selectedCase || !detailStatus) return
    if (!canReview) {
      setReviewError('只有 clustered 状态的案例可以执行人工审核。')
      return
    }
    const approvedMapIds = Object.entries(reviewDecisions).filter(([, value]) => value === 'approve').map(([id]) => id)
    const rejectedMapIds = Object.entries(reviewDecisions).filter(([, value]) => value === 'reject').map(([id]) => id)
    if (approvedMapIds.length === 0 && rejectedMapIds.length === 0 && manualMappings.length === 0) {
      setReviewError('请至少确认、拒绝一个草稿映射，或手工追加一条映射。')
      return
    }

    try {
      setReviewSubmitting(true)
      setReviewError(null)
      const result = await submitComplianceCaseHumanReview(selectedCase.caseId, {
        approvedMapIds: approvedMapIds.length > 0 ? approvedMapIds : undefined,
        rejectedMapIds: rejectedMapIds.length > 0 ? rejectedMapIds : undefined,
        manualMappings: manualMappings.length > 0 ? manualMappings.map((mapping) => {
          const confidenceScore = Number(mapping.confidenceScore)
          return {
            controlId: mapping.controlId,
            relationType: mapping.relationType,
            confidenceScore: Number.isFinite(confidenceScore) ? confidenceScore : undefined,
          }
        }) : undefined,
      })
      toast.success('人工审核已提交')
      setSelectedCase((prev) => prev ? { ...prev, status: result.status, humanReviewed: result.humanReviewed, reviewedBy: result.reviewedBy, reviewedAt: result.reviewedAt } : prev)
      setManualMappings([])
      setControlResults([])
      setReloadToken((prev) => prev + 1)
      setDetailReloadToken((prev) => prev + 1)
    } catch (submitError) {
      const message = errorMessage(submitError, '人工审核提交失败')
      setReviewError(message)
      toast.error(message)
    } finally {
      setReviewSubmitting(false)
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
                <h1 className="text-2xl font-bold text-[#1E3A5F]">无权访问案例运营后台</h1>
                <p className="mt-2 text-[#64748B]">当前账号没有查看该页面的权限，请联系管理员分配相应角色。</p>
              </div>
              <Button variant="outline" className="rounded-sm" onClick={() => router.push('/dashboard')}>
                返回工作台
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-[#FEFDFB] px-6 py-16">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Button variant="outline" className="rounded-sm" onClick={() => router.push('/dashboard')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-[#1E3A5F] font-[var(--font-plus-jakarta)]">案例运营</h1>
                <p className="mt-1 text-[#64748B]">通过后台统一完成处罚案例导入、结果查看与人工审核。</p>
              </div>
            </div>

            <Button variant="outline" className="rounded-sm" onClick={() => setReloadToken((prev) => prev + 1)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              刷新列表
            </Button>
          </div>

          <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[#1E3A5F]">导入案例</h2>
                  <p className="text-sm text-[#64748B]">提交既有导入 pipeline，获取可追踪的 jobId 和 batchId。</p>
                </div>
                {importing && <Loader2 className="h-5 w-5 animate-spin text-[#1E3A5F]" />}
              </div>

              <form className="grid grid-cols-1 gap-4 md:grid-cols-4" onSubmit={handleImport}>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="import-file">上传文件</Label>
                  <Input
                    key={importFileInputKey}
                    id="import-file"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(event) =>
                      setImportForm((prev) => ({
                        ...prev,
                        file: event.target.files?.[0] ?? null,
                      }))
                    }
                  />
                  <p className="text-xs text-[#64748B]">支持 `.xlsx`、`.xls`、`.csv` 文件。</p>
                  {importForm.file && (
                    <p className="text-sm text-[#1E3A5F]">已选择：{importForm.file.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="import-regulator-code">监管编码</Label>
                  <Input
                    id="import-regulator-code"
                    placeholder="例如 PBOC"
                    value={importForm.regulatorCode}
                    onChange={(event) => setImportForm((prev) => ({ ...prev, regulatorCode: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="import-batch-id">批次号（可选）</Label>
                  <Input
                    id="import-batch-id"
                    placeholder="留空则后端自动生成"
                    value={importForm.batchId}
                    onChange={(event) => setImportForm((prev) => ({ ...prev, batchId: event.target.value }))}
                  />
                </div>

                <div className="flex justify-end md:col-span-4">
                  <Button type="submit" className="rounded-sm" disabled={importing}>
                    {importing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        提交中...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        创建导入任务
                      </>
                    )}
                  </Button>
                </div>
              </form>

              {importError && (
                <Alert variant="destructive" className="rounded-sm">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{importError}</AlertDescription>
                </Alert>
              )}

              {importResult && (
                <Alert className="rounded-sm border-emerald-200 bg-emerald-50">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                  <AlertDescription className="text-emerald-900">
                    导入任务已创建：文件 `{importResult.fileName}`，jobId=`{importResult.jobId}`，batchId=`{importResult.batchId}`，状态 `{importResult.status}`。
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[#1E3A5F]">案例列表</h2>
                  <p className="text-sm text-[#64748B]">支持按 batchId、监管编码、状态和关键词筛选。</p>
                </div>
                <p className="text-sm text-[#64748B]">
                  共 {pagination.total} 条，当前第 {pagination.page} / {pagination.totalPages} 页
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                <div className="space-y-2">
                  <Label htmlFor="filter-batch-id">批次号</Label>
                  <Input
                    id="filter-batch-id"
                    value={filters.batchId}
                    onChange={(event) => setFilters((prev) => ({ ...prev, batchId: event.target.value }))}
                    onKeyDown={onFilterKeyDown}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filter-regulator">监管编码</Label>
                  <Input
                    id="filter-regulator"
                    value={filters.regulatorCode}
                    onChange={(event) => setFilters((prev) => ({ ...prev, regulatorCode: event.target.value }))}
                    onKeyDown={onFilterKeyDown}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filter-status">状态</Label>
                  <Select
                    value={filters.status}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value as CaseStatusFilter }))}
                  >
                    <SelectTrigger id="filter-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="pending">待处理</SelectItem>
                      <SelectItem value="extracted">已提取</SelectItem>
                      <SelectItem value="clustered">待人审</SelectItem>
                      <SelectItem value="reviewed">已审核</SelectItem>
                      <SelectItem value="active">启用</SelectItem>
                      <SelectItem value="inactive">停用</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="filter-keyword">关键词</Label>
                  <div className="flex gap-2">
                    <Input
                      id="filter-keyword"
                      placeholder="案例编号 / 标题 / 事实关键词"
                      value={filters.keyword}
                      onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))}
                      onKeyDown={onFilterKeyDown}
                    />
                    <Button type="button" variant="outline" className="rounded-sm" onClick={applyFilters}>
                      <Search className="mr-2 h-4 w-4" />
                      查询
                    </Button>
                    <Button type="button" variant="outline" className="rounded-sm" onClick={clearFilters}>
                      重置
                    </Button>
                  </div>
                </div>
              </div>

              {error && (
                <Alert variant={forbidden ? 'default' : 'destructive'} className="rounded-sm">
                  {forbidden ? <ShieldAlert className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="overflow-x-auto rounded-sm border border-[#E2E8F0]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#1E3A5F] hover:bg-[#1E3A5F]">
                      <TableHead className="text-white">案例编号</TableHead>
                      <TableHead className="text-white">标题 / 机构</TableHead>
                      <TableHead className="text-white">批次号</TableHead>
                      <TableHead className="text-white">监管编码</TableHead>
                      <TableHead className="text-white">状态</TableHead>
                      <TableHead className="text-white">审核信息</TableHead>
                      <TableHead className="text-right text-white">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center">
                          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1E3A5F]" />
                        </TableCell>
                      </TableRow>
                    ) : items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-[#64748B]">
                          暂无符合条件的案例。
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => (
                        <TableRow key={item.caseId} className="hover:bg-[#FEFDFB]">
                          <TableCell className="font-medium text-[#1E3A5F]">{item.caseCode}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div>{item.caseTitle || '未命名案例'}</div>
                              <div className="text-xs text-[#64748B]">{item.authorityName || item.sourceOrg || '暂无来源机构'}</div>
                            </div>
                          </TableCell>
                          <TableCell>{item.importBatchId || '-'}</TableCell>
                          <TableCell>{item.regulatorCode || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{caseStatusLabel(item.status)}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-[#64748B]">
                            <div>审核人：{item.reviewedBy || '-'}</div>
                            <div>审核时间：{formatDate(item.reviewedAt)}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button type="button" size="sm" variant="outline" className="rounded-sm" onClick={() => openDetail(item)}>
                              查看详情
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-[#64748B]">
                  显示 {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} / {pagination.total}
                </p>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" className="rounded-sm" disabled={pagination.page <= 1} onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}>
                    上一页
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="rounded-sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}>
                    下一页
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={detailOpen} onOpenChange={closeDetail}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto rounded-sm">
          <DialogHeader>
            <DialogTitle className="text-[#1E3A5F]">{selectedCase?.caseCode || '案例详情'}</DialogTitle>
            <DialogDescription>查看提取结果、聚类草稿，并在允许状态下完成人工审核。</DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-12">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1E3A5F]" />
            </div>
          ) : detailError ? (
            <Alert variant="destructive" className="rounded-sm">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{detailError}</AlertDescription>
            </Alert>
          ) : selectedCase ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
                  <CardContent className="space-y-2 p-4 text-sm">
                    <h3 className="font-semibold text-[#1E3A5F]">基础信息</h3>
                    <div>标题：{selectedCase.caseTitle || '-'}</div>
                    <div>监管编码：{selectedCase.regulatorCode || '-'}</div>
                    <div>被处罚单位：{selectedCase.sourceOrg || '-'}</div>
                    <div>被处罚人：{selectedCase.penalizedPerson || '-'}</div>
                    <div>监管机关：{selectedCase.authorityName || '-'}</div>
                    <div>批次号：{selectedCase.importBatchId || '-'}</div>
                  </CardContent>
                </Card>

                <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
                  <CardContent className="space-y-2 p-4 text-sm">
                    <h3 className="font-semibold text-[#1E3A5F]">处理状态</h3>
                    <Badge variant="outline">{caseStatusLabel(detailStatus || selectedCase.status)}</Badge>
                    <div>提取时间：{formatDate(extraction?.extractedAt)}</div>
                    <div>聚类时间：{formatDate(clustering?.clusteredAt)}</div>
                    <div>审核人：{clustering?.reviewedBy || selectedCase.reviewedBy || '-'}</div>
                    <div>审核时间：{formatDate(clustering?.reviewedAt || selectedCase.reviewedAt)}</div>
                  </CardContent>
                </Card>

                <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
                  <CardContent className="space-y-2 p-4 text-sm">
                    <h3 className="font-semibold text-[#1E3A5F]">案件摘要</h3>
                    <div>事实：{selectedCase.caseFacts || '暂无'}</div>
                    <div>处罚原因：{selectedCase.penaltyReason || '暂无'}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
                  <CardContent className="space-y-3 p-4">
                    <h3 className="font-semibold text-[#1E3A5F]">提取结果</h3>
                    <div className="space-y-2">
                      <Label>原始违规表述</Label>
                      <div className="flex flex-wrap gap-2">
                        {extraction?.violationThemes?.length ? (
                          extraction.violationThemes.map((theme) => (
                            <Badge key={theme} variant="outline">{theme}</Badge>
                          ))
                        ) : (
                          <span className="text-sm text-[#64748B]">暂无提取主题</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>条款候选</Label>
                      {extraction?.clauseCandidates?.length ? (
                        extraction.clauseCandidates.map((candidate) => (
                          <div key={candidate.clauseId} className="rounded-sm border border-[#E2E8F0] p-3 text-sm">
                            <div className="font-medium text-[#1E3A5F]">{candidate.clauseCode}</div>
                            <div>{candidate.summary || '暂无摘要'}</div>
                            <div className="text-xs text-[#64748B]">关键词：{candidate.matchedKeywords?.join('、') || '无'}</div>
                          </div>
                        ))
                      ) : (
                        <span className="text-sm text-[#64748B]">暂无条款候选</span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
                  <CardContent className="space-y-3 p-4">
                    <h3 className="font-semibold text-[#1E3A5F]">聚类结果</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>标准化匹配主题</Label>
                        {normalizedNeedsAttention && (
                          <span className="text-xs text-amber-700">该主题尚未完成语义归一化</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {clustering?.normalizedThemes?.length ? (
                          clustering.normalizedThemes.map((theme) => (
                            <Badge key={theme} variant="outline">{theme}</Badge>
                          ))
                        ) : (
                          <span className="text-sm text-[#64748B]">暂无归一化主题</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>候选新控制点</Label>
                      {clustering?.candidateControlPoints?.length ? (
                        <>
                          <p className="text-xs text-[#64748B]">未命中现有 KG control point，建议人工补映射或补充 control point 中文别名/关键词。</p>
                          {clustering.candidateControlPoints.map((candidate) => (
                            <div key={`${candidate.controlName}-${candidate.sourceTheme}`} className="rounded-sm border border-[#E2E8F0] p-3 text-sm">
                              <div className="font-medium text-[#1E3A5F]">{candidate.controlName}</div>
                              <div>来源主题：{candidate.sourceTheme}</div>
                              <div className="text-[#64748B]">{candidate.reason}</div>
                            </div>
                          ))}
                        </>
                      ) : (
                        <span className="text-sm text-[#64748B]">暂无候选新控制点</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-[#1E3A5F]">人工审核</h3>
                      <p className="text-sm text-[#64748B]">clustered 状态允许确认、拒绝或手工追加映射。</p>
                    </div>
                    {!canReview && <Badge variant="outline">只读模式</Badge>}
                  </div>

                  {!canReview && (
                    <Alert className="rounded-sm border-[#E2E8F0]">
                      <ShieldAlert className="h-4 w-4" />
                      <AlertDescription>
                        当前案例状态为 {caseStatusLabel(detailStatus || selectedCase.status)}，不可再次提交人工审核。
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-3">
                    <Label>草稿映射</Label>
                    {clustering?.caseControlMapDrafts?.length ? (
                      clustering.caseControlMapDrafts.map((draft) => {
                        const decision = reviewDecisions[draft.id] ?? 'pending'
                        const displayStatus =
                          decision === 'approve' ? 'APPROVED' : decision === 'reject' ? 'REJECTED' : draft.reviewStatus

                        return (
                          <div key={draft.id} className="rounded-sm border border-[#E2E8F0] p-3">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div className="text-sm">
                                <button
                                  type="button"
                                  className="font-medium text-[#1E3A5F] hover:underline"
                                  onClick={() => {
                                    setSelectedControlId(draft.controlId)
                                    setSelectedControlTrace(buildDerivedFailureModeTrace(selectedCase, draft))
                                  }}
                                >
                                  {draft.controlCode || '未编码'} · {draft.controlName || '未命名控制点'}
                                </button>
                                <div className="text-[#64748B]">关系：{relationLabel(draft.relationType)} · 置信度：{draft.confidenceScore || '-'} · 来源：{sourceLabel(draft.source)}</div>
                                {draft.derivedFailureMode && (
                                  <div className="mt-1 text-xs text-[#1E3A5F]">
                                    推导来源：{draft.derivedFailureMode.failureModeCode} ·{' '}
                                    {draft.derivedFailureMode.failureModeName}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline">{reviewStatusLabel(displayStatus)}</Badge>
                                {canReview && (
                                  <>
                                    <Button type="button" size="sm" variant={decision === 'approve' ? 'default' : 'outline'} className="rounded-sm" onClick={() => setDecision(draft.id, 'approve')}>
                                      确认
                                    </Button>
                                    <Button type="button" size="sm" variant={decision === 'reject' ? 'destructive' : 'outline'} className="rounded-sm" onClick={() => setDecision(draft.id, 'reject')}>
                                      拒绝
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <span className="text-sm text-[#64748B]">暂无草稿映射</span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>手工追加映射</Label>
                      <span className="text-xs text-[#64748B]">通过既有 control point 列表搜索并追加</span>
                    </div>

                    <div className="flex gap-2">
                      <Input value={controlKeyword} onChange={(event) => setControlKeyword(event.target.value)} placeholder="搜索 control code / control name" disabled={!canReview} />
                      <Button type="button" variant="outline" className="rounded-sm" disabled={!canReview || controlLoading} onClick={searchControls}>
                        {controlLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>
                          <Search className="mr-2 h-4 w-4" />
                          搜索
                        </>}
                      </Button>
                    </div>

                    {controlResults.length > 0 && (
                      <div className="space-y-2 rounded-sm border border-dashed border-[#CBD5E1] p-3">
                        {controlResults.map((item) => (
                          <div key={item.controlId} className="flex flex-col gap-2 rounded-sm border border-[#E2E8F0] p-3 md:flex-row md:items-center md:justify-between">
                            <div className="text-sm">
                              <div className="font-medium text-[#1E3A5F]">{item.controlCode} · {item.controlName}</div>
                              <div className="text-[#64748B]">{item.controlFamily} · {item.l1Code} / {item.l2Code}</div>
                            </div>
                            <Button type="button" size="sm" className="rounded-sm" onClick={() => addManualMapping(item)}>
                              <Plus className="mr-1 h-4 w-4" />
                              添加映射
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {manualMappings.length > 0 ? (
                      <div className="space-y-3">
                        {manualMappings.map((mapping) => (
                          <div key={mapping.controlId} className="grid grid-cols-1 gap-3 rounded-sm border border-[#E2E8F0] p-3 md:grid-cols-12">
                            <div className="md:col-span-5">
                              <button
                                type="button"
                                className="font-medium text-[#1E3A5F] hover:underline"
                                onClick={() => {
                                  setSelectedControlId(mapping.controlId)
                                  setSelectedControlTrace(null)
                                }}
                              >
                                {mapping.controlCode} · {mapping.controlName}
                              </button>
                            </div>
                            <div className="space-y-2 md:col-span-3">
                              <Label>关系</Label>
                              <Select value={mapping.relationType} onValueChange={(value) => updateManualMapping(mapping.controlId, 'relationType', value)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="VIOLATES">违反</SelectItem>
                                  <SelectItem value="RELATED">相关</SelectItem>
                                  <SelectItem value="SUPPORTS">支持</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2 md:col-span-3">
                              <Label>置信度</Label>
                              <Input type="number" min="0" max="1" step="0.01" value={mapping.confidenceScore} onChange={(event) => updateManualMapping(mapping.controlId, 'confidenceScore', event.target.value)} />
                            </div>
                            <div className="flex items-end md:col-span-1">
                              <Button type="button" size="icon" variant="ghost" aria-label={`删除 ${mapping.controlCode}`} onClick={() => removeManualMapping(mapping.controlId)}>
                                <Trash2 className="h-4 w-4 text-rose-600" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-[#64748B]">暂未追加手工映射</span>
                    )}
                  </div>

                  {reviewError && (
                    <Alert variant="destructive" className="rounded-sm">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{reviewError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex justify-end">
                    <Button type="button" className="rounded-sm" disabled={!canReview || reviewSubmitting} onClick={submitReview}>
                      {reviewSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          提交审核中...
                        </>
                      ) : (
                        '提交人工审核'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {selectedControlId && (
        <ControlDetailDrawer
          open={Boolean(selectedControlId)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedControlId(null)
              setSelectedControlTrace(null)
            }
          }}
          controlId={selectedControlId}
          sourceModule="admin"
          sourceRecordId={selectedCase?.caseId}
          sourceTrace={selectedControlTrace}
        />
      )}
    </>
  )
}
