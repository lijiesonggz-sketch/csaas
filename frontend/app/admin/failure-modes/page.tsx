'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft,
  GitBranch,
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
  type FailureModeCategory,
  type FailureModeDetail,
  type FailureModeStatus,
  type FailureModeSummary,
  createFailureMode,
  createFailureModeControlMap,
  createFailureModeTaxonomyMap,
  deleteFailureModeControlMap,
  deleteFailureModeTaxonomyMap,
  getFailureMode,
  getTaxonomyTree,
  listFailureModes,
  suggestFailureModeCode,
  updateFailureMode,
} from '@/lib/api/failure-modes'
import { searchControlPoints, type ControlPointSummary } from '@/lib/api/compliance-cases'
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
import { ControlDetailDrawer } from '@/components/compliance/ControlDetailDrawer'
import { formatAuthoritativeScorePercent } from '@/lib/utils/authoritative-score'
import { useRef } from 'react'

const ALLOWED_ROLES = ['admin']
const DEFAULT_CATEGORY: FailureModeCategory = 'DEFINITION_ERROR'
const CATEGORY_OPTIONS: FailureModeCategory[] = [
  'DEFINITION_ERROR',
  'MAPPING_ERROR',
  'MISSING_CONTROL',
  'TIMELINESS_FAILURE',
  'INTEGRITY_FAILURE',
  'UNAUTHORIZED_ACTION',
  'FALSIFICATION',
]
const STATUS_OPTIONS: Array<FailureModeStatus | 'all'> = ['all', 'ACTIVE', 'INACTIVE']
const RELEVANCE_OPTIONS = ['PRIMARY', 'SECONDARY'] as const

function errorMessage(error: unknown, fallback = '操作失败') {
  return error instanceof Error && error.message ? error.message : fallback
}

function buildCreateForm(existingCodes: string[], category: FailureModeCategory) {
  const suggestedCode = suggestFailureModeCode({ category, existingCodes })
  return { failureModeCode: suggestedCode, suggestedCode, name: '', description: '', category }
}

export default function FailureModeAdminPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const canAccess = Boolean(session?.user && ALLOWED_ROLES.includes(session.user.role))
  const deepLinkedFailureModeId = searchParams.get('failureModeId')
  const appliedDeepLinkId = useRef<string | null>(null)

  const [filters, setFilters] = useState({
    keyword: '',
    category: 'all' as FailureModeCategory | 'all',
    status: 'ACTIVE' as FailureModeStatus | 'all',
  })
  const [appliedFilters, setAppliedFilters] = useState(filters)
  const [items, setItems] = useState<FailureModeSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null)
  const [detail, setDetail] = useState<FailureModeDetail | null>(null)
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    category: DEFAULT_CATEGORY,
    status: 'ACTIVE' as FailureModeStatus,
  })
  const [listLoading, setListLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [taxonomyTree, setTaxonomyTree] = useState<
    Array<{
      l1Code: string
      l1Name: string
      sortOrder: number
      children: Array<{ l2Code: string; l2Name: string }>
    }>
  >([])
  const [selectedL2Code, setSelectedL2Code] = useState('')
  const [controlKeyword, setControlKeyword] = useState('')
  const [controlResults, setControlResults] = useState<ControlPointSummary[]>([])
  const [controlLoading, setControlLoading] = useState(false)
  const [selectedRelevance, setSelectedRelevance] =
    useState<(typeof RELEVANCE_OPTIONS)[number]>('PRIMARY')
  const [createOpen, setCreateOpen] = useState(false)
  const [createKnownCodes, setCreateKnownCodes] = useState<string[]>([])
  const [createForm, setCreateForm] = useState(buildCreateForm([], DEFAULT_CATEGORY))

  const taxonomyOptions = useMemo(
    () =>
      taxonomyTree.flatMap((node) =>
        node.children.map((child) => ({
          value: child.l2Code,
          label: `${child.l2Code} · ${child.l2Name}`,
        }))
      ),
    [taxonomyTree]
  )

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [router, status])

  useEffect(() => {
    if (deepLinkedFailureModeId && appliedDeepLinkId.current !== deepLinkedFailureModeId) {
      appliedDeepLinkId.current = deepLinkedFailureModeId
      setSelectedId(deepLinkedFailureModeId)
    }
  }, [deepLinkedFailureModeId])

  useEffect(() => {
    if (status !== 'authenticated' || !canAccess) return
    let cancelled = false
    async function loadData() {
      try {
        setListLoading(true)
        setError(null)
        const [listResult, taxonomyResult] = await Promise.all([
          listFailureModes({
            page,
            limit: 20,
            category: appliedFilters.category === 'all' ? undefined : appliedFilters.category,
            status: appliedFilters.status === 'all' ? undefined : appliedFilters.status,
            keyword: appliedFilters.keyword || undefined,
          }),
          getTaxonomyTree(),
        ])
        if (cancelled) return
        setItems(listResult.items)
        setTotal(listResult.total)
        setTaxonomyTree(
          taxonomyResult.map((node) => ({
            l1Code: node.l1Code,
            l1Name: node.l1Name,
            sortOrder: node.sortOrder,
            children: node.children.map((child) => ({
              l2Code: child.l2Code,
              l2Name: child.l2Name,
            })),
          }))
        )
        setSelectedId((current) =>
          appliedDeepLinkId.current
            ? appliedDeepLinkId.current
            : deepLinkedFailureModeId && current === deepLinkedFailureModeId
              ? current
            : current && listResult.items.some((item) => item.failureModeId === current)
              ? current
              : (listResult.items[0]?.failureModeId ?? null)
        )
      } catch (loadError) {
        if (!cancelled) setError(errorMessage(loadError, '加载 Failure Mode 列表失败'))
      } finally {
        if (!cancelled) setListLoading(false)
      }
    }
    void loadData()
    return () => {
      cancelled = true
    }
  }, [appliedFilters, canAccess, deepLinkedFailureModeId, page, reloadToken, status])

  useEffect(() => {
    if (!selectedId || status !== 'authenticated' || !canAccess) {
      setDetail(null)
      setSelectedL2Code('')
      setControlKeyword('')
      setControlResults([])
      return
    }
    const failureModeId = selectedId
    let cancelled = false
    async function loadDetail() {
      try {
        setDetailLoading(true)
        setDetail(null)
        setSelectedL2Code('')
        setControlKeyword('')
        setControlResults([])
        setSelectedControlId(null)
        const result = await getFailureMode(failureModeId)
        if (cancelled) return
        setDetail(result)
        if (appliedDeepLinkId.current === failureModeId) {
          appliedDeepLinkId.current = null
        }
        setDraft({
          name: result.name,
          description: result.description ?? '',
          category: result.category,
          status: result.status,
        })
      } catch (loadError) {
        if (!cancelled) toast.error(errorMessage(loadError, '加载 Failure Mode 详情失败'))
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }
    void loadDetail()
    return () => {
      cancelled = true
    }
  }, [canAccess, reloadToken, selectedId, status])

  async function collectKnownFailureModeCodes() {
    const codes: string[] = []
    let currentPage = 1
    let total = 0

    do {
      const result = await listFailureModes({ page: currentPage, limit: 100 })
      codes.push(...result.items.map((item) => item.failureModeCode))
      total = result.total
      currentPage += 1
    } while (codes.length < total)

    return Array.from(new Set(codes))
  }

  async function openCreateDialog() {
    const fallbackCodes = items.map((item) => item.failureModeCode)
    setCreateKnownCodes(fallbackCodes)
    setCreateForm(buildCreateForm(fallbackCodes, DEFAULT_CATEGORY))
    setCreateOpen(true)
    try {
      const knownCodes = await collectKnownFailureModeCodes()
      setCreateKnownCodes(knownCodes)
      setCreateForm((current) => {
        const suggestion = suggestFailureModeCode({
          category: current.category,
          existingCodes: knownCodes,
        })
        const shouldReplace =
          current.failureModeCode === '' || current.failureModeCode === current.suggestedCode

        return {
          ...current,
          suggestedCode: suggestion,
          failureModeCode: shouldReplace ? suggestion : current.failureModeCode,
        }
      })
    } catch {
      // keep fallback suggestion based on currently loaded items
    }
  }

  function updateCreateCategory(nextCategory: FailureModeCategory) {
    setCreateForm((current) => {
      const suggestion = suggestFailureModeCode({
        category: nextCategory,
        existingCodes:
          createKnownCodes.length > 0
            ? createKnownCodes
            : items.map((item) => item.failureModeCode),
      })
      const shouldReplace =
        current.failureModeCode === '' || current.failureModeCode === current.suggestedCode
      return {
        ...current,
        category: nextCategory,
        suggestedCode: suggestion,
        failureModeCode: shouldReplace ? suggestion : current.failureModeCode,
      }
    })
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      setSaving(true)
      const created = await createFailureMode({
        failureModeCode: createForm.failureModeCode.trim(),
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        category: createForm.category,
      })
      toast.success('Failure Mode 已创建')
      setCreateOpen(false)
      setSelectedId(created.failureModeId)
      setReloadToken((current) => current + 1)
    } catch (submitError) {
      toast.error(errorMessage(submitError, '创建 Failure Mode 失败'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveDetail() {
    if (!detail) return
    try {
      setSaving(true)
      await updateFailureMode(detail.failureModeId, {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        category: draft.category,
        status: draft.status,
      })
      toast.success('Failure Mode 已更新')
      setReloadToken((current) => current + 1)
    } catch (submitError) {
      toast.error(errorMessage(submitError, '更新 Failure Mode 失败'))
    } finally {
      setSaving(false)
    }
  }

  async function handleAddTaxonomyMap() {
    if (!detail || !selectedL2Code) return
    try {
      setSaving(true)
      await createFailureModeTaxonomyMap(detail.failureModeId, { l2Code: selectedL2Code })
      toast.success('IT 分类映射已添加')
      setSelectedL2Code('')
      setReloadToken((current) => current + 1)
    } catch (submitError) {
      toast.error(errorMessage(submitError, '添加 IT 分类映射失败'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteTaxonomyMap(mapId: string) {
    if (!detail) return
    try {
      setSaving(true)
      await deleteFailureModeTaxonomyMap(detail.failureModeId, mapId)
      toast.success('IT 分类映射已删除')
      setReloadToken((current) => current + 1)
    } catch (submitError) {
      toast.error(errorMessage(submitError, '删除 IT 分类映射失败'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSearchControls() {
    if (!controlKeyword.trim()) {
      setControlResults([])
      return
    }
    try {
      setControlLoading(true)
      const result = await searchControlPoints({
        page: 1,
        limit: 10,
        status: 'ACTIVE',
        keyword: controlKeyword.trim(),
      })
      const mappedIds = new Set(detail?.controlMaps.map((item) => item.controlId) ?? [])
      setControlResults(result.items.filter((item) => !mappedIds.has(item.controlId)))
    } catch (searchError) {
      toast.error(errorMessage(searchError, '搜索控制点失败'))
    } finally {
      setControlLoading(false)
    }
  }

  async function handleAddControlMap(controlId: string) {
    if (!detail) return
    try {
      setSaving(true)
      await createFailureModeControlMap(detail.failureModeId, {
        controlId,
        relevance: selectedRelevance,
      })
      toast.success('控制点映射已添加')
      setControlKeyword('')
      setControlResults([])
      setReloadToken((current) => current + 1)
    } catch (submitError) {
      toast.error(errorMessage(submitError, '添加控制点映射失败'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteControlMap(mapId: string) {
    if (!detail) return
    try {
      setSaving(true)
      await deleteFailureModeControlMap(detail.failureModeId, mapId)
      toast.success('控制点映射已删除')
      setReloadToken((current) => current + 1)
    } catch (submitError) {
      toast.error(errorMessage(submitError, '删除控制点映射失败'))
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || status === 'unauthenticated')
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FEFDFB]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E3A5F]" />
      </div>
    )

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-[#FEFDFB] p-6">
        <div className="mx-auto max-w-3xl pt-24">
          <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <ShieldAlert className="h-12 w-12 text-amber-600" />
              <div>
                <h1 className="text-2xl font-bold text-[#1E3A5F]">无权访问 Failure Mode 管理</h1>
                <p className="mt-2 text-[#64748B]">当前账号没有查看该页面的权限，请联系管理员。</p>
              </div>
              <Button
                variant="outline"
                className="rounded-sm"
                onClick={() => router.push('/admin/dashboard')}
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
    <>
      <div className="min-h-screen bg-[#FEFDFB] px-6 py-16">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Button
                variant="outline"
                className="rounded-sm"
                onClick={() => router.push('/admin/dashboard')}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-[#1E3A5F]">Failure Mode 管理</h1>
                <p className="mt-1 text-[#64748B]">维护失效模式字典、IT 分类映射和控制点映射。</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="rounded-sm"
                onClick={() => setReloadToken((current) => current + 1)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                刷新
              </Button>
              <Button className="rounded-sm" onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                新建 Failure Mode
              </Button>
            </div>
          </div>

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
                    <Label htmlFor="failure-mode-keyword">关键词</Label>
                    <Input
                      id="failure-mode-keyword"
                      value={filters.keyword}
                      onChange={(event) =>
                        setFilters((current) => ({ ...current, keyword: event.target.value }))
                      }
                      placeholder="搜索 code / name / description"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>分类</Label>
                      <Select
                        value={filters.category}
                        onValueChange={(value) =>
                          setFilters((current) => ({
                            ...current,
                            category: value as FailureModeCategory | 'all',
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部</SelectItem>
                          {CATEGORY_OPTIONS.map((item) => (
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
                            status: value as FailureModeStatus | 'all',
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
                          category: 'all' as FailureModeCategory | 'all',
                          status: 'ACTIVE' as FailureModeStatus | 'all',
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
                      暂无符合条件的 Failure Mode。
                    </div>
                  ) : (
                    items.map((item) => (
                      <button
                        key={item.failureModeId}
                        className={`w-full rounded-sm border p-3 text-left transition ${selectedId === item.failureModeId ? 'border-[#1E3A5F] bg-[#EEF4FF]' : 'border-[#E2E8F0] bg-white hover:border-[#94A3B8]'}`}
                        onClick={() => setSelectedId(item.failureModeId)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{item.failureModeCode}</Badge>
                          <Badge variant={item.status === 'ACTIVE' ? 'success' : 'secondary'}>
                            {item.status}
                          </Badge>
                        </div>
                        <div className="mt-2 font-medium text-[#1E3A5F]">{item.name}</div>
                        <div className="mt-1 text-xs text-[#64748B]">{item.category}</div>
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
                      disabled={page * 20 >= total}
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
                        <Label>编码</Label>
                        <Input value={detail.failureModeCode} disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>名称</Label>
                        <Input
                          value={draft.name}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, name: event.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>分类</Label>
                        <Select
                          value={draft.category}
                          onValueChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              category: value as FailureModeCategory,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORY_OPTIONS.map((item) => (
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
                          value={draft.status}
                          onValueChange={(value) =>
                            setDraft((current) => ({
                              ...current,
                              status: value as FailureModeStatus,
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
                      <div className="space-y-2 md:col-span-2">
                        <Label>描述</Label>
                        <Textarea
                          rows={5}
                          value={draft.description}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, description: event.target.value }))
                          }
                        />
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
                        <GitBranch className="h-4 w-4 text-[#1E3A5F]" />
                        <h2 className="font-semibold text-[#1E3A5F]">IT 分类映射</h2>
                      </div>
                      <div className="flex flex-col gap-3 md:flex-row">
                        <Select value={selectedL2Code} onValueChange={setSelectedL2Code}>
                          <SelectTrigger className="md:flex-1">
                            <SelectValue placeholder="选择 IT 二级分类" />
                          </SelectTrigger>
                          <SelectContent>
                            {taxonomyOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          className="rounded-sm"
                          onClick={handleAddTaxonomyMap}
                          disabled={!selectedL2Code || saving}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          添加映射
                        </Button>
                      </div>
                      <div className="mt-4 space-y-2">
                        {detail.taxonomyMaps.length === 0 ? (
                          <p className="text-sm text-[#64748B]">暂无 IT 分类映射</p>
                        ) : (
                          detail.taxonomyMaps.map((map) => (
                            <div
                              key={map.id}
                              className="flex items-center justify-between rounded-sm border border-[#E2E8F0] px-3 py-2"
                            >
                              <div>
                                <div className="font-medium text-[#1E3A5F]">{map.l2Code}</div>
                                <div className="text-sm text-[#64748B]">
                                  {map.l2Name || '未命名分类'}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`删除 IT 分类映射 ${map.l2Code}`}
                                onClick={() => handleDeleteTaxonomyMap(map.id)}
                              >
                                <Trash2 className="h-4 w-4 text-rose-600" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-sm border border-[#E2E8F0] p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-[#1E3A5F]" />
                        <h2 className="font-semibold text-[#1E3A5F]">控制点映射</h2>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-[1fr_180px]">
                        <Input
                          value={controlKeyword}
                          onChange={(event) => setControlKeyword(event.target.value)}
                          placeholder="搜索 control code / control name"
                        />
                        <Button
                          variant="outline"
                          className="rounded-sm"
                          onClick={handleSearchControls}
                          disabled={controlLoading}
                        >
                          {controlLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Search className="mr-2 h-4 w-4" />
                              搜索控制点
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="mt-3 max-w-[220px]">
                        <Label>关联强度</Label>
                        <Select
                          value={selectedRelevance}
                          onValueChange={(value) =>
                            setSelectedRelevance(value as (typeof RELEVANCE_OPTIONS)[number])
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RELEVANCE_OPTIONS.map((item) => (
                              <SelectItem key={item} value={item}>
                                {item}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {controlResults.length > 0 && (
                        <div className="mt-3 space-y-2 rounded-sm border border-dashed border-[#CBD5E1] p-3">
                          {controlResults.map((item) => (
                            <div
                              key={item.controlId}
                              className="flex items-center justify-between rounded-sm border border-[#E2E8F0] px-3 py-2"
                            >
                              <div>
                                <div className="font-medium text-[#1E3A5F]">
                                  {item.controlCode} · {item.controlName}
                                </div>
                                <div className="text-xs text-[#64748B]">
                                  {item.controlFamily} · {item.l1Code} / {item.l2Code}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                className="rounded-sm"
                                onClick={() => handleAddControlMap(item.controlId)}
                              >
                                添加为映射
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
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
                                <button
                                  type="button"
                                  className="font-medium text-[#1E3A5F] hover:underline"
                                  onClick={() => setSelectedControlId(map.controlId)}
                                >
                                  {map.controlCode} · {map.controlName}
                                </button>
                                <div className="text-xs text-[#64748B]">
                                  {map.relevance} · {map.maturityLevel || 'unknown'} · score{' '}
                                  {formatAuthoritativeScorePercent(map.authoritativeScore)}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`删除控制点映射 ${map.controlCode}`}
                                onClick={() => handleDeleteControlMap(map.id)}
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
                    请选择左侧 Failure Mode 查看详情。
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle>新建 Failure Mode</DialogTitle>
            <DialogDescription>
              创建新的失效模式字典项。编码会自动给出建议，但你可以覆盖修改。
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label htmlFor="failure-mode-code">编码</Label>
              <Input
                id="failure-mode-code"
                value={createForm.failureModeCode}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, failureModeCode: event.target.value }))
                }
                placeholder="例如 FM-DEF-001"
              />
              <p className="text-xs text-[#64748B]">建议编码：{createForm.suggestedCode}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="failure-mode-name">名称</Label>
              <Input
                id="failure-mode-name"
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>分类</Label>
              <Select
                value={createForm.category}
                onValueChange={(value) => updateCreateCategory(value as FailureModeCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="failure-mode-description">描述</Label>
              <Textarea
                id="failure-mode-description"
                rows={4}
                value={createForm.description}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, description: event.target.value }))
                }
              />
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
