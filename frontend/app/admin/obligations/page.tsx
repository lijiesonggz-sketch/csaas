'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  BadgeInfo,
  FileText,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  type ApplicableSector,
  type ObligationCoverage,
  type ObligationDetail,
  type ObligationStatus,
  type ObligationSummary,
  type ObligationType,
  type RegulationClauseSummary,
  createObligation,
  createObligationControlMap,
  deleteObligationControlMap,
  getObligation,
  listObligations,
  searchRegulationClauses,
  suggestObligationCode,
  updateObligation,
} from '@/lib/api/obligations'
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
import { Textarea } from '@/components/ui/textarea'
import { ControlPointDirectorySelector } from '@/components/admin/ControlPointDirectorySelector'
import { ControlDetailDrawer } from '@/components/compliance/ControlDetailDrawer'
import { PageHeader } from '@/components/ui/page-header'
import { formatAuthoritativeScorePercent } from '@/lib/utils/authoritative-score'

const ALLOWED_ROLES = ['admin']
const OBLIGATION_TYPE_OPTIONS: ObligationType[] = ['MANDATORY', 'PROHIBITIVE', 'RECOMMENDED']
const STATUS_OPTIONS: Array<ObligationStatus | 'all'> = ['all', 'ACTIVE', 'INACTIVE']
const COVERAGE_OPTIONS: ObligationCoverage[] = ['FULL', 'PARTIAL']
const APPLICABLE_SECTOR_OPTIONS: ApplicableSector[] = [
  '银行',
  '证券',
  '保险',
  '基金',
  '期货',
  '通用',
]
const OBLIGATION_LIST_PAGE_SIZE = 20
const OBLIGATION_CODE_SCAN_PAGE_SIZE = 100
const MAX_OBLIGATION_CODE_SCAN = 1000

function errorMessage(error: unknown, fallback = '操作失败') {
  return error instanceof Error && error.message ? error.message : fallback
}

function buildCreateForm() {
  return {
    clauseId: '',
    obligationCode: '',
    suggestedCode: '',
    obligationText: '',
    obligationType: 'MANDATORY' as ObligationType,
    applicableSector: ['银行'] as ApplicableSector[],
    status: 'ACTIVE' as ObligationStatus,
  }
}

type ObligationControlMapSummary = ObligationDetail['controlMaps'][number]
type PendingDeleteControlMap = {
  obligationId: string
  map: ObligationControlMapSummary
}

export default function ObligationAdminPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const canAccess = Boolean(session?.user && ALLOWED_ROLES.includes(session.user.role))
  const deepLinkedObligationId = searchParams.get('obligationId')
  const appliedDeepLinkId = useRef<string | null>(null)
  const itemsRef = useRef<ObligationSummary[]>([])

  const [filters, setFilters] = useState({
    keyword: '',
    obligationType: 'all' as ObligationType | 'all',
    status: 'ACTIVE' as ObligationStatus | 'all',
    applicableSector: 'all' as ApplicableSector | 'all',
  })
  const [appliedFilters, setAppliedFilters] = useState(filters)
  const [items, setItems] = useState<ObligationSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ObligationDetail | null>(null)
  const [draft, setDraft] = useState({
    obligationText: '',
    obligationType: 'MANDATORY' as ObligationType,
    applicableSector: ['银行'] as ApplicableSector[],
    status: 'ACTIVE' as ObligationStatus,
  })
  const [listLoading, setListLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedCoverage, setSelectedCoverage] = useState<ObligationCoverage>('FULL')
  const [createOpen, setCreateOpen] = useState(false)
  const [clauseDetailOpen, setClauseDetailOpen] = useState(false)
  const [createKnownCodes, setCreateKnownCodes] = useState<string[]>([])
  const [createForm, setCreateForm] = useState(buildCreateForm())
  const [clauseKeyword, setClauseKeyword] = useState('')
  const [clauseResults, setClauseResults] = useState<RegulationClauseSummary[]>([])
  const [clauseLoading, setClauseLoading] = useState(false)
  const [selectedClause, setSelectedClause] = useState<RegulationClauseSummary | null>(null)
  const [pendingDeleteMap, setPendingDeleteMap] = useState<PendingDeleteControlMap | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [router, status])

  useEffect(() => {
    if (deepLinkedObligationId && appliedDeepLinkId.current !== deepLinkedObligationId) {
      appliedDeepLinkId.current = deepLinkedObligationId
      setSelectedId(deepLinkedObligationId)
    }
  }, [deepLinkedObligationId])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    if (status !== 'authenticated' || !canAccess) return
    let cancelled = false

    async function loadData() {
      try {
        setListLoading(true)
        setError(null)
        const listResult = await listObligations({
          page,
          limit: OBLIGATION_LIST_PAGE_SIZE,
          obligationType:
            appliedFilters.obligationType === 'all' ? undefined : appliedFilters.obligationType,
          status: appliedFilters.status === 'all' ? undefined : appliedFilters.status,
          applicableSector:
            appliedFilters.applicableSector === 'all' ? undefined : appliedFilters.applicableSector,
          keyword: appliedFilters.keyword || undefined,
        })
        if (cancelled) return
        setItems(listResult.items)
        setTotal(listResult.total)
        setSelectedId((current) =>
          appliedDeepLinkId.current
            ? appliedDeepLinkId.current
            : deepLinkedObligationId && current === deepLinkedObligationId
              ? current
              : current && listResult.items.some((item) => item.obligationId === current)
                ? current
                : (listResult.items[0]?.obligationId ?? null)
        )
      } catch (loadError) {
        if (!cancelled) {
          setError(errorMessage(loadError, '加载 Obligation 列表失败'))
        }
      } finally {
        if (!cancelled) {
          setListLoading(false)
        }
      }
    }

    void loadData()
    return () => {
      cancelled = true
    }
  }, [appliedFilters, canAccess, deepLinkedObligationId, page, reloadToken, status])

  useEffect(() => {
    if (!selectedId || status !== 'authenticated' || !canAccess) {
      setDetail(null)
      setSelectedControlId(null)
      setPendingDeleteMap(null)
      return
    }

    const obligationId = selectedId
    let cancelled = false

    async function loadDetail() {
      try {
        setDetailLoading(true)
        setDetail(null)
        setSelectedControlId(null)
        const result = await getObligation(obligationId)
        if (cancelled) return
        setDetail(result)
        if (appliedDeepLinkId.current === obligationId) {
          appliedDeepLinkId.current = null
        }
        setDraft({
          obligationText: result.obligationText,
          obligationType: result.obligationType,
          applicableSector: result.applicableSector ?? [],
          status: result.status,
        })
      } catch (loadError) {
        if (!cancelled) {
          if (appliedDeepLinkId.current === obligationId) {
            appliedDeepLinkId.current = null
            setSelectedId(itemsRef.current[0]?.obligationId ?? null)
          }
          toast.error(errorMessage(loadError, '加载 Obligation 详情失败'))
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false)
        }
      }
    }

    void loadDetail()
    return () => {
      cancelled = true
    }
  }, [canAccess, reloadToken, selectedId, status])

  useEffect(() => {
    if (pendingDeleteMap && selectedId !== pendingDeleteMap.obligationId) {
      setPendingDeleteMap(null)
    }
  }, [pendingDeleteMap, selectedId])

  useEffect(() => {
    if (status !== 'authenticated' || !canAccess) return
    if (!selectedId && items.length > 0) {
      setSelectedId(items[0].obligationId)
    }
  }, [canAccess, items, selectedId, status])

  function toggleSector(list: ApplicableSector[], sector: ApplicableSector) {
    return list.includes(sector) ? list.filter((item) => item !== sector) : [...list, sector]
  }

  async function collectKnownObligationCodes() {
    const codes: string[] = []
    let currentPage = 1
    let scanTarget = MAX_OBLIGATION_CODE_SCAN

    do {
      const result = await listObligations({
        page: currentPage,
        limit: OBLIGATION_CODE_SCAN_PAGE_SIZE,
      })
      codes.push(...result.items.map((item) => item.obligationCode))
      scanTarget = Math.min(result.total, MAX_OBLIGATION_CODE_SCAN)
      currentPage += 1
    } while (codes.length < scanTarget)

    return Array.from(new Set(codes))
  }

  async function openCreateDialog() {
    const fallbackCodes = items.map((item) => item.obligationCode)
    setCreateKnownCodes(fallbackCodes)
    setCreateForm(buildCreateForm())
    setClauseKeyword('')
    setClauseResults([])
    setSelectedClause(null)
    setCreateOpen(true)

    try {
      const knownCodes = await collectKnownObligationCodes()
      setCreateKnownCodes(knownCodes)
    } catch {
      // keep fallback codes
    }
  }

  function selectClause(clause: RegulationClauseSummary) {
    const existingCodes =
      createKnownCodes.length > 0 ? createKnownCodes : items.map((item) => item.obligationCode)
    const suggestedCode = suggestObligationCode({
      clauseCode: clause.clauseCode,
      articleNo: clause.articleNo,
      existingCodes,
    })

    setSelectedClause(clause)
    setCreateForm((current) => ({
      ...current,
      clauseId: clause.clauseId,
      obligationCode:
        current.obligationCode === '' || current.obligationCode === current.suggestedCode
          ? suggestedCode
          : current.obligationCode,
      suggestedCode,
    }))
  }

  async function handleClauseSearch() {
    if (!clauseKeyword.trim()) {
      setClauseResults([])
      return
    }
    try {
      setClauseLoading(true)
      const result = await searchRegulationClauses({
        page: 1,
        limit: 10,
        keyword: clauseKeyword.trim(),
      })
      setClauseResults(result.items)
    } catch (searchError) {
      toast.error(errorMessage(searchError, '搜索条文失败'))
    } finally {
      setClauseLoading(false)
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!createForm.clauseId) {
      toast.error('请先选择条文')
      return
    }

    try {
      setSaving(true)
      const created = await createObligation({
        clauseId: createForm.clauseId,
        obligationCode: createForm.obligationCode.trim(),
        obligationText: createForm.obligationText.trim(),
        obligationType: createForm.obligationType,
        applicableSector: createForm.applicableSector,
        status: createForm.status,
      })
      toast.success('Obligation 已创建')
      setCreateOpen(false)
      setSelectedId(created.obligationId)
      setReloadToken((current) => current + 1)
    } catch (submitError) {
      toast.error(errorMessage(submitError, '创建 Obligation 失败'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveDetail() {
    if (!detail) return
    try {
      setSaving(true)
      await updateObligation(detail.obligationId, {
        obligationText: draft.obligationText.trim(),
        obligationType: draft.obligationType,
        applicableSector: draft.applicableSector,
        status: draft.status,
      })
      toast.success('Obligation 已更新')
      setReloadToken((current) => current + 1)
    } catch (submitError) {
      toast.error(errorMessage(submitError, '更新 Obligation 失败'))
    } finally {
      setSaving(false)
    }
  }

  async function handleAddControlMap(controlId: string) {
    if (!detail) return
    try {
      setSaving(true)
      await createObligationControlMap(detail.obligationId, {
        controlId,
        coverage: selectedCoverage,
      })
      toast.success('控制点映射已添加')
      setReloadToken((current) => current + 1)
    } catch (submitError) {
      toast.error(errorMessage(submitError, '添加控制点映射失败'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteControlMap() {
    if (!pendingDeleteMap) return
    try {
      setSaving(true)
      await deleteObligationControlMap(pendingDeleteMap.obligationId, pendingDeleteMap.map.id)
      toast.success('控制点映射已删除')
      setPendingDeleteMap(null)
      setReloadToken((current) => current + 1)
    } catch (submitError) {
      toast.error(errorMessage(submitError, '删除控制点映射失败'))
    } finally {
      setSaving(false)
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
                <h1 className="text-2xl font-bold text-[#1E3A5F]">无权访问 Obligation 管理</h1>
                <p className="mt-2 text-[#64748B]">当前账号没有查看该页面的权限，请联系管理员。</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-[#FEFDFB] px-6 py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <PageHeader
            title="Obligation 管理"
            description="维护法规义务、关联条文和控制点映射"
            icon={<BadgeInfo className="h-6 w-6" />}
            variant="default"
            className="p-8"
            action={
              <div className="flex flex-wrap gap-2">
                <Button
                  className="rounded-sm bg-white text-[#1E3A5F] hover:bg-white/90"
                  onClick={() => setReloadToken((current) => current + 1)}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  刷新
                </Button>
                <Button
                  className="rounded-sm bg-white text-[#1E3A5F] hover:bg-white/90"
                  onClick={openCreateDialog}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  新建 Obligation
                </Button>
              </div>
            }
          />

          {error && (
            <Alert variant="destructive" className="rounded-sm">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="obligation-keyword">关键词</Label>
                    <Input
                      id="obligation-keyword"
                      value={filters.keyword}
                      onChange={(event) =>
                        setFilters((current) => ({ ...current, keyword: event.target.value }))
                      }
                      placeholder="搜索 obligation code / text / clause code"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>义务类型</Label>
                      <Select
                        value={filters.obligationType}
                        onValueChange={(value) =>
                          setFilters((current) => ({
                            ...current,
                            obligationType: value as ObligationType | 'all',
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部</SelectItem>
                          {OBLIGATION_TYPE_OPTIONS.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>状态</Label>
                      <Select
                        value={filters.status}
                        onValueChange={(value) =>
                          setFilters((current) => ({
                            ...current,
                            status: value as ObligationStatus | 'all',
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item === 'all' ? '全部' : item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>适用行业</Label>
                    <Select
                      value={filters.applicableSector}
                      onValueChange={(value) =>
                        setFilters((current) => ({
                          ...current,
                          applicableSector: value as ApplicableSector | 'all',
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        {APPLICABLE_SECTOR_OPTIONS.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="flex-1 rounded-sm"
                      onClick={() => {
                        setPage(1)
                        setAppliedFilters(filters)
                      }}
                    >
                      <Search className="mr-2 h-4 w-4" />
                      查询
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-sm"
                      onClick={() => {
                        const reset = {
                          keyword: '',
                          obligationType: 'all' as ObligationType | 'all',
                          status: 'ACTIVE' as ObligationStatus | 'all',
                          applicableSector: 'all' as ApplicableSector | 'all',
                        }
                        setFilters(reset)
                        setAppliedFilters(reset)
                        setPage(1)
                      }}
                    >
                      重置
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {listLoading ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-[#1E3A5F]" />
                    </div>
                  ) : items.length === 0 ? (
                    <div className="rounded-sm border border-dashed border-[#CBD5E1] px-4 py-6 text-sm text-[#64748B]">
                      暂无符合条件的 Obligation。
                    </div>
                  ) : (
                    items.map((item) => (
                      <button
                        key={item.obligationId}
                        className={`w-full rounded-sm border p-3 text-left transition ${
                          selectedId === item.obligationId
                            ? 'border-[#1E3A5F] bg-[#EEF4FF]'
                            : 'border-[#E2E8F0] bg-white hover:border-[#94A3B8]'
                        }`}
                        onClick={() => setSelectedId(item.obligationId)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{item.obligationCode}</Badge>
                          <Badge variant={item.status === 'ACTIVE' ? 'success' : 'secondary'}>
                            {item.status}
                          </Badge>
                        </div>
                        <div className="mt-2 font-medium text-[#1E3A5F] line-clamp-2">
                          {item.obligationText}
                        </div>
                        <div className="mt-1 text-xs text-[#64748B]">
                          {item.obligationType} ·{' '}
                          {(item.applicableSector ?? []).join('、') || '通用'}
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <div className="flex items-center justify-between text-sm text-[#64748B]">
                  <span>总数 {total}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-sm"
                      disabled={page <= 1}
                      onClick={() => setPage((current) => current - 1)}
                    >
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-sm"
                      disabled={page * OBLIGATION_LIST_PAGE_SIZE >= total}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
              <CardContent className="space-y-6 p-6">
                {detailLoading ? (
                  <div className="flex justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-[#1E3A5F]" />
                  </div>
                ) : detail ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>义务编码</Label>
                        <Input value={detail.obligationCode} disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>义务类型</Label>
                        <Select
                          value={draft.obligationType}
                          onValueChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              obligationType: value as ObligationType,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OBLIGATION_TYPE_OPTIONS.map((item) => (
                              <SelectItem key={item} value={item}>
                                {item}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>义务内容</Label>
                        <Textarea
                          rows={4}
                          value={draft.obligationText}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              obligationText: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>状态</Label>
                        <Select
                          value={draft.status}
                          onValueChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              status: value as ObligationStatus,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                            <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>适用行业</Label>
                        <div className="flex flex-wrap gap-2 rounded-sm border border-[#E2E8F0] p-3">
                          {APPLICABLE_SECTOR_OPTIONS.map((sector) => (
                            <label
                              key={sector}
                              className="flex items-center gap-2 text-sm text-[#334155]"
                            >
                              <input
                                type="checkbox"
                                checked={draft.applicableSector.includes(sector)}
                                onChange={() =>
                                  setDraft((current) => ({
                                    ...current,
                                    applicableSector: toggleSector(
                                      current.applicableSector,
                                      sector
                                    ),
                                  }))
                                }
                              />
                              {sector}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-end justify-end md:col-span-2">
                        <Button className="rounded-sm" onClick={handleSaveDetail} disabled={saving}>
                          <Save className="mr-2 h-4 w-4" />
                          保存修改
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-sm border border-[#E2E8F0] p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#1E3A5F]" />
                        <h2 className="font-semibold text-[#1E3A5F]">法规条文</h2>
                      </div>
                      {detail.clause ? (
                        <div className="space-y-3">
                          <div className="rounded-sm border border-[#E2E8F0] px-3 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{detail.clause.clauseCode}</Badge>
                              {detail.clause.articleNo && (
                                <Badge variant="secondary">{detail.clause.articleNo}</Badge>
                              )}
                              {detail.clause.source?.sourceCode && (
                                <Badge variant="outline">{detail.clause.source.sourceCode}</Badge>
                              )}
                            </div>
                            <div className="mt-2 text-sm font-medium text-[#1E3A5F]">
                              {detail.clause.clauseSummary || detail.clause.clauseText}
                            </div>
                            {detail.clause.source?.sourceName && (
                              <div className="mt-1 text-xs text-[#64748B]">
                                来源：{detail.clause.source.sourceName}
                              </div>
                            )}
                          </div>
                          <div>
                            <Button
                              variant="outline"
                              className="rounded-sm"
                              onClick={() => setClauseDetailOpen(true)}
                            >
                              <BadgeInfo className="mr-2 h-4 w-4" />
                              查看条文详情
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-[#64748B]">当前义务暂无关联条文</p>
                      )}
                    </div>

                    <div className="rounded-sm border border-[#E2E8F0] p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-[#1E3A5F]" />
                        <h2 className="font-semibold text-[#1E3A5F]">控制点映射</h2>
                      </div>
                      <div className="mt-3 max-w-[220px]">
                        <Label>覆盖程度</Label>
                        <Select
                          value={selectedCoverage}
                          onValueChange={(value) =>
                            setSelectedCoverage(value as ObligationCoverage)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COVERAGE_OPTIONS.map((item) => (
                              <SelectItem key={item} value={item}>
                                {item}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="mt-3">
                        <ControlPointDirectorySelector
                          actionLabel="添加为映射"
                          disabled={saving}
                          excludeControlIds={detail.controlMaps.map((map) => map.controlId)}
                          onPreview={setSelectedControlId}
                          onSelect={(item) => void handleAddControlMap(item.controlId)}
                        />
                      </div>

                      <div className="mt-4 space-y-2">
                        {detail.controlMaps.length === 0 ? (
                          <p className="text-sm text-[#64748B]">暂无控制点映射</p>
                        ) : (
                          detail.controlMaps.map((map) => (
                            <div
                              key={map.id}
                              className="flex items-center justify-between rounded-sm border border-[#E2E8F0] px-3 py-2"
                            >
                              <div>
                                <div className="font-medium text-[#1E3A5F]">
                                  <button
                                    type="button"
                                    className="hover:underline"
                                    onClick={() => setSelectedControlId(map.controlId)}
                                  >
                                    {map.controlCode} · {map.controlName}
                                  </button>
                                </div>
                                <div className="text-xs text-[#64748B]">
                                  {map.coverage} · {map.maturityLevel || 'unknown'} · score{' '}
                                  {formatAuthoritativeScorePercent(map.authoritativeScore)}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`删除控制点映射 ${map.controlCode}`}
                                onClick={() =>
                                  setPendingDeleteMap({
                                    obligationId: detail.obligationId,
                                    map,
                                  })
                                }
                              >
                                <Trash2 className="h-4 w-4 text-rose-600" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-sm border border-dashed border-[#CBD5E1] px-4 py-10 text-center text-[#64748B]">
                    请选择左侧 Obligation 查看详情。
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-sm">
          <DialogHeader>
            <DialogTitle>新建 Obligation</DialogTitle>
            <DialogDescription>先搜索并选择条文，再创建新的法规义务。</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label htmlFor="clause-keyword">条文关键词</Label>
              <Input
                id="clause-keyword"
                value={clauseKeyword}
                onChange={(event) => setClauseKeyword(event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-sm"
                onClick={handleClauseSearch}
                disabled={clauseLoading}
              >
                {clauseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '搜索条文'}
              </Button>
            </div>

            {clauseResults.length > 0 && (
              <div className="space-y-2 rounded-sm border border-[#E2E8F0] p-3">
                {clauseResults.map((clause) => (
                  <div
                    key={clause.clauseId}
                    className="flex items-center justify-between rounded-sm border border-[#E2E8F0] px-3 py-2"
                  >
                    <div className="text-sm">
                      <div className="font-medium text-[#1E3A5F]">
                        {clause.clauseCode}
                        {clause.articleNo ? ` · ${clause.articleNo}` : ''}
                      </div>
                      <div className="text-[#64748B]">
                        {clause.clauseSummary || clause.clauseText}
                      </div>
                    </div>
                    <Button type="button" size="sm" onClick={() => selectClause(clause)}>
                      选择此条文
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="obligation-code">义务编码</Label>
              <Input
                id="obligation-code"
                value={createForm.obligationCode}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    obligationCode: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-[#64748B]">
                {selectedClause
                  ? `建议编码：${createForm.suggestedCode}`
                  : '请先选择条文以生成建议编码'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="obligation-text">义务内容</Label>
              <Textarea
                id="obligation-text"
                rows={4}
                value={createForm.obligationText}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    obligationText: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>关联条文</Label>
              <div className="rounded-sm border border-[#E2E8F0] px-3 py-2 text-sm text-[#475569]">
                {selectedClause
                  ? `${selectedClause.clauseCode}${selectedClause.articleNo ? ` · ${selectedClause.articleNo}` : ''}`
                  : '尚未选择条文'}
              </div>
            </div>

            <div className="space-y-2">
              <Label>义务类型</Label>
              <Select
                value={createForm.obligationType}
                onValueChange={(value) =>
                  setCreateForm((current) => ({
                    ...current,
                    obligationType: value as ObligationType,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OBLIGATION_TYPE_OPTIONS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>适用行业</Label>
              <div className="flex flex-wrap gap-2 rounded-sm border border-[#E2E8F0] p-3">
                {APPLICABLE_SECTOR_OPTIONS.map((sector) => (
                  <label key={sector} className="flex items-center gap-2 text-sm text-[#334155]">
                    <input
                      type="checkbox"
                      checked={createForm.applicableSector.includes(sector)}
                      onChange={() =>
                        setCreateForm((current) => ({
                          ...current,
                          applicableSector: toggleSector(current.applicableSector, sector),
                        }))
                      }
                    />
                    {sector}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-sm"
                onClick={() => setCreateOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" className="rounded-sm" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '创建'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingDeleteMap)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteMap(null)
          }
        }}
      >
        <DialogContent className="max-w-md rounded-sm">
          <DialogHeader>
            <DialogTitle>确认删除控制点映射</DialogTitle>
            <DialogDescription>
              {pendingDeleteMap
                ? `将从当前义务中删除 ${pendingDeleteMap.map.controlCode} 映射。此操作不可撤销。`
                : '将从当前义务中删除所选控制点映射。'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-sm"
              onClick={() => setPendingDeleteMap(null)}
              disabled={saving}
            >
              取消
            </Button>
            <Button
              type="button"
              className="rounded-sm"
              variant="destructive"
              onClick={handleDeleteControlMap}
              disabled={saving}
            >
              确认删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={clauseDetailOpen} onOpenChange={setClauseDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-sm">
          <DialogHeader>
            <DialogTitle>条文详情</DialogTitle>
            <DialogDescription>查看当前法规义务绑定的条文原文与来源信息。</DialogDescription>
          </DialogHeader>
          {detail?.clause ? (
            <div className="space-y-3 text-sm text-[#334155]">
              <div>
                <strong>条文编码：</strong>
                {detail.clause.clauseCode}
              </div>
              {detail.clause.articleNo && (
                <div>
                  <strong>条号：</strong>
                  {detail.clause.articleNo}
                </div>
              )}
              {detail.clause.sectionPath && (
                <div>
                  <strong>章节路径：</strong>
                  {detail.clause.sectionPath}
                </div>
              )}
              {detail.clause.source?.sourceName && (
                <div>
                  <strong>来源：</strong>
                  {detail.clause.source.sourceName}
                </div>
              )}
              <div className="rounded-sm border border-[#E2E8F0] bg-[#F8FAFC] p-3 leading-6">
                {detail.clause.clauseText}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#64748B]">暂无条文详情。</p>
          )}
        </DialogContent>
      </Dialog>

      {selectedControlId && (
        <ControlDetailDrawer
          open={Boolean(selectedControlId)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedControlId(null)
            }
          }}
          controlId={selectedControlId}
          sourceModule="admin"
          sourceRecordId={selectedId ?? undefined}
        />
      )}
    </>
  )
}
