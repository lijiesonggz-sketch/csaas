'use client'

import { Component, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AlertCircle, FileText, Loader2, Network, Search, ShieldAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/ui/page-header'
import {
  getReasoningChain,
  getRegulationGraph,
  getTaxonomyGovernanceSummary,
  getTaxonomyTree,
  importTaxonomyRuntimeProfile,
  listRegulationSources,
  exportTaxonomyRuntimeProfile,
  type ReasoningChainData,
  type RegulationGraphData,
  type RegulationSourceSummary,
  type TaxonomyGovernanceSummary,
  type TaxonomyRuntimeProfileImportResult,
  type TaxonomyTreeL1,
} from '@/lib/api/knowledge-graph'
import { KnowledgeGraphDetailPanel } from '@/components/admin/KnowledgeGraphDetailPanel'
import { TaxonomyGovernancePanel } from '@/components/admin/TaxonomyGovernancePanel'
import { KnowledgeGraphTree } from '@/components/admin/KnowledgeGraphTree'
import { ReasoningChainVisualization } from '@/components/admin/ReasoningChainVisualization'
import { RegulationDrivenDetailPanel } from '@/components/admin/RegulationDrivenDetailPanel'
import { RegulationDrivenVisualization } from '@/components/admin/RegulationDrivenVisualization'
import { ControlDetailDrawer } from '@/components/compliance/ControlDetailDrawer'

const ALLOWED_ROLES = ['admin']
const REGULATION_SOURCE_GROUP_LABELS: Record<string, string> = {
  law: '法律',
  regulation: '行政法规',
  guideline: '监管指引',
  standard: '规范标准',
  other: '其他',
}

type ViewMode = 'case-driven' | 'regulation-driven' | 'taxonomy-governance'
type CaseEntityType = 'failure-mode' | 'control-point' | 'obligation'
type RegulationEntityType =
  | 'regulation-source'
  | 'clause'
  | 'obligation'
  | 'regulation-control-point'

type GovernanceLoadOptions = {
  clearSummaryOnError?: boolean
  errorFallback?: string
}

interface SelectedCaseEntity {
  type: CaseEntityType
  id: string
}

interface SelectedRegulationEntity {
  type: RegulationEntityType
  id: string
}

function errorMessage(error: unknown, fallback = '操作失败') {
  if (!(error instanceof Error)) {
    return fallback
  }

  const message = error.message?.trim()
  if (!message) {
    return fallback
  }

  if (
    /failed to fetch|networkerror|load failed|fetch resource|network request failed/i.test(message)
  ) {
    return fallback
  }

  return message
}

function matchesRegulationSource(source: RegulationSourceSummary, query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return [source.sourceCode, source.sourceName, source.authorityName ?? ''].some((value) =>
    value.toLowerCase().includes(normalized)
  )
}

function hasRegulationEntity(
  graph: RegulationGraphData,
  entity: SelectedRegulationEntity | null,
  sourceId: string
) {
  if (!entity) return false
  if (entity.type === 'regulation-source') return entity.id === sourceId
  if (entity.type === 'clause') return graph.clauses.some((item) => item.clauseId === entity.id)
  if (entity.type === 'obligation') {
    return graph.obligations.some((item) => item.obligationId === entity.id)
  }
  if (entity.type === 'regulation-control-point') {
    return graph.controlPoints.some((item) => item.edgeId === entity.id)
  }
  return false
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive" className="m-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            组件渲染失败: {this.state.error?.message || '未知错误'}
          </AlertDescription>
        </Alert>
      )
    }
    return this.props.children
  }
}

export default function KnowledgeGraphPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const canAccess = Boolean(session?.user && ALLOWED_ROLES.includes(session.user.role))

  const [viewMode, setViewMode] = useState<ViewMode>('case-driven')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [taxonomyTree, setTaxonomyTree] = useState<TaxonomyTreeL1[]>([])
  const [taxonomyLoading, setTaxonomyLoading] = useState(true)
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null)
  const [selectedL2Code, setSelectedL2Code] = useState<string | null>(null)
  const [selectedCaseEntity, setSelectedCaseEntity] = useState<SelectedCaseEntity | null>(null)
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null)
  const [reasoningChain, setReasoningChain] = useState<ReasoningChainData | null>(null)
  const [chainLoading, setChainLoading] = useState(false)
  const [chainError, setChainError] = useState<string | null>(null)

  const [regulationSources, setRegulationSources] = useState<RegulationSourceSummary[]>([])
  const [regulationSourcesLoading, setRegulationSourcesLoading] = useState(true)
  const [regulationSourcesError, setRegulationSourcesError] = useState<string | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [selectedRegulationEntity, setSelectedRegulationEntity] =
    useState<SelectedRegulationEntity | null>(null)
  const [regulationGraph, setRegulationGraph] = useState<RegulationGraphData | null>(null)
  const [regulationGraphLoading, setRegulationGraphLoading] = useState(false)
  const [regulationGraphError, setRegulationGraphError] = useState<string | null>(null)
  const [governanceSummary, setGovernanceSummary] = useState<TaxonomyGovernanceSummary | null>(null)
  const [governanceLoading, setGovernanceLoading] = useState(false)
  const [governanceError, setGovernanceError] = useState<string | null>(null)
  const [governanceInitialLoadRequested, setGovernanceInitialLoadRequested] = useState(false)

  const activeErrors = (
    viewMode === 'case-driven'
      ? [taxonomyError, chainError]
      : viewMode === 'regulation-driven'
        ? [regulationSourcesError, regulationGraphError]
        : [governanceError]
  ).filter((message): message is string => Boolean(message))

  const filteredRegulationSources = useMemo(
    () => regulationSources.filter((source) => matchesRegulationSource(source, debouncedSearch)),
    [debouncedSearch, regulationSources]
  )

  const groupedRegulationSources = useMemo(() => {
    const groups = new Map<string, RegulationSourceSummary[]>()
    filteredRegulationSources.forEach((source) => {
      const key = source.sourceLevel ?? 'other'
      const current = groups.get(key) ?? []
      current.push(source)
      groups.set(key, current)
    })
    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label: REGULATION_SOURCE_GROUP_LABELS[key] ?? key,
      items,
    }))
  }, [filteredRegulationSources])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [router, status])

  useEffect(() => {
    if (status !== 'authenticated' || !canAccess) return
    let cancelled = false

    async function loadTaxonomy() {
      try {
        setTaxonomyLoading(true)
        setTaxonomyError(null)
        const tree = await getTaxonomyTree()
        if (cancelled) return
        setTaxonomyTree(tree)
      } catch (loadError) {
        if (!cancelled) setTaxonomyError(errorMessage(loadError, '加载 IT 分类树失败'))
      } finally {
        if (!cancelled) setTaxonomyLoading(false)
      }
    }

    void loadTaxonomy()
    return () => {
      cancelled = true
    }
  }, [canAccess, status])

  useEffect(() => {
    if (status !== 'authenticated' || !canAccess) return
    let cancelled = false

    async function loadRegulationSources() {
      try {
        setRegulationSourcesLoading(true)
        setRegulationSourcesError(null)
        const result = await listRegulationSources({
          page: 1,
          limit: 100,
          sourceStatus: 'ACTIVE',
        })
        if (cancelled) return
        setRegulationSources(result.items)
        setSelectedSourceId((current) =>
          current && result.items.some((item) => item.sourceId === current)
            ? current
            : (result.items[0]?.sourceId ?? null)
        )
      } catch (loadError) {
        if (!cancelled) setRegulationSourcesError(errorMessage(loadError, '加载法规来源失败'))
      } finally {
        if (!cancelled) setRegulationSourcesLoading(false)
      }
    }

    void loadRegulationSources()
    return () => {
      cancelled = true
    }
  }, [canAccess, status])

  useEffect(() => {
    if (!selectedL2Code || status !== 'authenticated' || !canAccess) {
      setReasoningChain(null)
      setSelectedCaseEntity(null)
      setChainError(null)
      return
    }

    const l2Code = selectedL2Code
    let cancelled = false
    async function loadReasoningChain() {
      try {
        setChainLoading(true)
        setChainError(null)
        setSelectedCaseEntity(null)
        setSelectedControlId(null)
        const data = await getReasoningChain(l2Code)
        if (cancelled) return
        setReasoningChain(data)
      } catch (loadError) {
        if (!cancelled) setChainError(errorMessage(loadError, '加载推理链路失败'))
      } finally {
        if (!cancelled) setChainLoading(false)
      }
    }

    void loadReasoningChain()
    return () => {
      cancelled = true
    }
  }, [canAccess, selectedL2Code, status])

  useEffect(() => {
    if (!selectedSourceId || status !== 'authenticated' || !canAccess) {
      setRegulationGraph(null)
      setSelectedRegulationEntity(null)
      setRegulationGraphError(null)
      return
    }

    const sourceId = selectedSourceId
    let cancelled = false
    async function loadRegulationGraph() {
      try {
        setRegulationGraphLoading(true)
        setRegulationGraphError(null)
        const data = await getRegulationGraph(sourceId)
        if (cancelled) return
        setRegulationGraph(data)
        setSelectedRegulationEntity((current) =>
          hasRegulationEntity(data, current, sourceId)
            ? current
            : { type: 'regulation-source', id: sourceId }
        )
      } catch (loadError) {
        if (!cancelled) setRegulationGraphError(errorMessage(loadError, '加载法规驱动线失败'))
      } finally {
        if (!cancelled) setRegulationGraphLoading(false)
      }
    }

    void loadRegulationGraph()
    return () => {
      cancelled = true
    }
  }, [canAccess, selectedSourceId, status])

  async function loadGovernanceSummary(
    options: GovernanceLoadOptions = {}
  ): Promise<TaxonomyGovernanceSummary | null> {
    try {
      setGovernanceLoading(true)
      setGovernanceError(null)
      const result = await getTaxonomyGovernanceSummary()
      setGovernanceSummary(result)
      return result
    } catch (loadError) {
      if (options.clearSummaryOnError) {
        setGovernanceSummary(null)
      }
      const message = options.errorFallback
        ? `${options.errorFallback}${
            loadError instanceof Error && loadError.message.trim()
              ? `：${loadError.message.trim()}`
              : ''
          }`
        : errorMessage(loadError, '加载 taxonomy 治理摘要失败')
      setGovernanceError(message)
      return null
    } finally {
      setGovernanceLoading(false)
    }
  }

  useEffect(() => {
    if (status !== 'authenticated' || !canAccess || viewMode !== 'taxonomy-governance') {
      return
    }

    if (governanceSummary || governanceLoading || governanceInitialLoadRequested) {
      return
    }

    setGovernanceInitialLoadRequested(true)
    void loadGovernanceSummary()
  }, [
    canAccess,
    governanceInitialLoadRequested,
    governanceLoading,
    governanceSummary,
    status,
    viewMode,
  ])

  useEffect(() => {
    if (viewMode === 'taxonomy-governance' || governanceSummary) {
      return
    }

    setGovernanceInitialLoadRequested(false)
  }, [governanceSummary, viewMode])

  async function handleImportGovernanceRuntimeProfile(
    file: File,
    sourceVersion: string
  ): Promise<TaxonomyRuntimeProfileImportResult> {
    const result = await importTaxonomyRuntimeProfile(file, sourceVersion)
    await loadGovernanceSummary({
      clearSummaryOnError: true,
      errorFallback: '导入成功，但治理摘要刷新失败，请点击刷新重试',
    })
    return result
  }

  function handleSelectRegulationSource(sourceId: string) {
    setSelectedSourceId(sourceId)
    setSelectedRegulationEntity({ type: 'regulation-source', id: sourceId })
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
                <h1 className="text-2xl font-bold text-[#1E3A5F]">无权访问知识图谱总览</h1>
                <p className="mt-2 text-[#64748B]">当前账号没有查看该页面的权限，请联系管理员。</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FEFDFB] px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="知识图谱总览"
          description="IT 分类 → 失效模式 → 控制点 → 合规义务推理链路可视化"
          icon={<Network className="h-6 w-6" />}
          variant="default"
          className="p-8"
          action={
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
                <TabsList className="bg-white/15">
                  <TabsTrigger
                    value="case-driven"
                    className="text-white/75 data-[state=active]:bg-white data-[state=active]:text-[#1E3A5F]"
                  >
                    案例驱动线
                  </TabsTrigger>
                  <TabsTrigger
                    value="regulation-driven"
                    className="text-white/75 data-[state=active]:bg-white data-[state=active]:text-[#1E3A5F]"
                  >
                    法规驱动线
                  </TabsTrigger>
                  <TabsTrigger
                    value="taxonomy-governance"
                    className="text-white/75 data-[state=active]:bg-white data-[state=active]:text-[#1E3A5F]"
                  >
                    taxonomy 治理
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜索 IT 分类、失效模式、控制点、义务..."
                  className="w-64 rounded-sm bg-white pl-9 text-[#1E3A5F] placeholder:text-[#64748B]"
                  aria-label="搜索知识图谱"
                />
              </div>
            </div>
          }
        />

        {activeErrors.map((message) => (
          <Alert key={message} variant="destructive" className="rounded-sm">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ))}

        <div className="grid gap-4 lg:grid-cols-[18rem_1fr_24rem]">
          {viewMode === 'case-driven' ? (
            <>
              <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
                <CardContent className="p-4">
                  <h2 className="mb-3 text-sm font-semibold text-[#1E3A5F]">IT 分类体系</h2>
                  {taxonomyLoading ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-[#1E3A5F]" />
                    </div>
                  ) : (
                    <ErrorBoundary>
                      <KnowledgeGraphTree
                        tree={taxonomyTree}
                        selectedL2Code={selectedL2Code}
                        onSelectL2={setSelectedL2Code}
                        searchQuery={debouncedSearch}
                      />
                    </ErrorBoundary>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
                <CardContent className="p-4">
                  <ErrorBoundary>
                    <ReasoningChainVisualization
                      data={reasoningChain}
                      loading={chainLoading}
                      onSelectEntity={(entity) => {
                        if (entity.type === 'control-point') {
                          setSelectedControlId(entity.id)
                          return
                        }
                        setSelectedControlId(null)
                        setSelectedCaseEntity(entity)
                      }}
                      selectedEntityId={selectedControlId ?? selectedCaseEntity?.id ?? null}
                      searchQuery={debouncedSearch}
                    />
                  </ErrorBoundary>
                </CardContent>
              </Card>

              <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
                <CardContent className="p-4">
                  <ErrorBoundary>
                    <KnowledgeGraphDetailPanel
                      entityType={
                        selectedCaseEntity?.type === 'control-point'
                          ? null
                          : (selectedCaseEntity?.type ?? null)
                      }
                      entityId={
                        selectedCaseEntity?.type === 'control-point'
                          ? null
                          : (selectedCaseEntity?.id ?? null)
                      }
                      reasoningChain={reasoningChain}
                      loading={chainLoading}
                    />
                  </ErrorBoundary>
                </CardContent>
              </Card>
            </>
          ) : viewMode === 'regulation-driven' ? (
            <>
              <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
                <CardContent className="p-4">
                  <h2 className="mb-3 text-sm font-semibold text-[#1E3A5F]">法规来源</h2>
                  {regulationSourcesLoading ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-[#1E3A5F]" />
                    </div>
                  ) : groupedRegulationSources.length === 0 ? (
                    <div className="rounded-sm border border-dashed border-[#CBD5E1] px-4 py-6 text-center text-sm text-[#64748B]">
                      {debouncedSearch ? '未找到匹配的法规来源' : '暂无法规来源数据'}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {groupedRegulationSources.map((group) => (
                        <div key={group.key} className="space-y-2">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                            <FileText className="h-3.5 w-3.5" />
                            <span>{group.label}</span>
                          </div>
                          <div className="space-y-2">
                            {group.items.map((source) => (
                              <button
                                key={source.sourceId}
                                type="button"
                                className={`w-full rounded-sm border px-3 py-2 text-left transition ${
                                  selectedSourceId === source.sourceId
                                    ? 'border-blue-300 bg-blue-50'
                                    : 'border-[#E2E8F0] hover:border-[#94A3B8]'
                                }`}
                                onClick={() => handleSelectRegulationSource(source.sourceId)}
                              >
                                <div className="text-xs font-mono text-[#64748B]">
                                  {source.sourceCode}
                                </div>
                                <div className="mt-1 text-sm font-medium text-[#1E3A5F]">
                                  {source.sourceName}
                                </div>
                                {source.authorityName && (
                                  <div className="mt-1 text-xs text-[#64748B]">
                                    {source.authorityName}
                                  </div>
                                )}
                                {source.sourceLevel && (
                                  <div className="mt-2">
                                    <Badge variant="secondary" className="text-xs">
                                      {source.sourceLevel}
                                    </Badge>
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
                <CardContent className="p-4">
                  <ErrorBoundary>
                    <RegulationDrivenVisualization
                      data={regulationGraph}
                      loading={regulationGraphLoading}
                      onSelectEntity={(entity) => setSelectedRegulationEntity(entity)}
                      selectedEntityId={selectedRegulationEntity?.id ?? null}
                      searchQuery={debouncedSearch}
                    />
                  </ErrorBoundary>
                </CardContent>
              </Card>

              <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
                <CardContent className="p-4">
                  <ErrorBoundary>
                    <RegulationDrivenDetailPanel
                      entityType={selectedRegulationEntity?.type ?? null}
                      entityId={selectedRegulationEntity?.id ?? null}
                      data={regulationGraph}
                      loading={regulationGraphLoading}
                    />
                  </ErrorBoundary>
                </CardContent>
              </Card>
            </>
          ) : (
            <TaxonomyGovernancePanel
              summary={governanceSummary}
              loading={governanceLoading}
              error={governanceError}
              onRefresh={() => void loadGovernanceSummary()}
              onExport={() => exportTaxonomyRuntimeProfile()}
              onImport={handleImportGovernanceRuntimeProfile}
            />
          )}
        </div>
      </div>
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
          sourceRecordId={selectedL2Code ?? undefined}
        />
      )}
    </div>
  )
}
