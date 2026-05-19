'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Archive,
  Edit,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Target,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  type ApplicableSector,
  createClauseControlMap,
  createControlEvidenceMap,
  type ControlPackCatalogItem,
  type ControlPackItemRecord,
  createControlPackItem,
  type ControlPointEvidence,
  type ControlPointMaturityLevel,
  type ControlPointOriginType,
  type ControlPointRecord,
  type ControlPointStatus,
  type ControlPointRegulatoryLinksResponse,
  createControlPoint,
  createQuestionItem,
  createRemediationAction,
  deleteClauseControlMap,
  deleteControlEvidenceMap,
  deleteControlPackItem,
  type EvidenceFrequency,
  type EvidenceSamplingRequirement,
  getControlPoint,
  getControlPointEvidences,
  getControlPointPackLinks,
  getControlPointQuestions,
  getControlPointRegulatoryLinks,
  getControlPointRemediations,
  listControlPoints,
  listControlPackCatalog,
  type QuestionItemRecord,
  type QuestionItemType,
  type RemediationActionRecord,
  type RemediationEffort,
  type RemediationPriority,
  searchEvidenceTypes,
  searchRegulationClauses,
  updateControlPointStatus,
  updateControlPoint,
  updateQuestionItem,
  updateRemediationAction,
} from '@/lib/api/control-points'
import { getControlExplain, type ControlExplainResponse } from '@/lib/api/compliance-intelligence'
import { getTaxonomyTree } from '@/lib/api/knowledge-graph'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Progress } from '@/components/ui/progress'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/ui/page-header'
import { formatAuthoritativeScorePercent } from '@/lib/utils/authoritative-score'
import { listFailureModes } from '@/lib/api/failure-modes'

const ALLOWED_ROLES = ['admin']
const PAGE_SIZE = 20
const CONTROL_TYPE_OPTIONS = ['governance', 'preventive', 'detective', 'corrective'] as const
const RISK_LEVEL_OPTIONS = ['LOW', 'MEDIUM', 'HIGH'] as const
const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE'] as const
const ORIGIN_TYPE_OPTIONS = [
  'case_derived',
  'regulation_derived',
  'both',
  'candidate',
  'manual',
] as const satisfies readonly ControlPointOriginType[]
const MATURITY_LEVEL_OPTIONS = [
  'hard',
  'draft-hard',
  'candidate',
  'retired',
] as const satisfies readonly ControlPointMaturityLevel[]
const APPLICABLE_SECTOR_OPTIONS = [
  '银行',
  '证券',
  '保险',
  '基金',
  '期货',
  '通用',
] as const satisfies readonly ApplicableSector[]
const QUESTION_TYPE_OPTIONS = [
  'YES_NO',
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'RATING',
  'TEXT',
] as const satisfies readonly QuestionItemType[]
const EVIDENCE_FREQUENCY_OPTIONS = [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'ANNUALLY',
  'EVENT_TRIGGERED',
] as const satisfies readonly EvidenceFrequency[]
const EVIDENCE_SAMPLING_OPTIONS = [
  'FULL',
  'SAMPLING',
  'KEY_SAMPLE',
] as const satisfies readonly EvidenceSamplingRequirement[]
const REMEDIATION_PRIORITY_OPTIONS = [
  'HIGH',
  'MEDIUM',
  'LOW',
] as const satisfies readonly RemediationPriority[]
const REMEDIATION_EFFORT_OPTIONS = [
  'LOW',
  'MEDIUM',
  'HIGH',
] as const satisfies readonly RemediationEffort[]
const MATURITY_LABELS: Record<string, string> = {
  hard: '正式硬控制点',
  'draft-hard': '候选硬控制点',
  candidate: '候选控制点',
  retired: '已退役',
}
const ORIGIN_LABELS: Record<string, string> = {
  case_derived: '案例驱动',
  regulation_derived: '法规驱动',
  both: '双轨覆盖',
  candidate: '待治理',
  manual: '人工创建',
}
const AUTHORITY_ITEMS: Array<{
  key:
    | 'has_source_basis'
    | 'has_applicability_scope'
    | 'has_control_activity'
    | 'has_expected_evidence'
    | 'has_human_review'
    | 'has_case_validation'
  label: string
}> = [
  { key: 'has_source_basis', label: '有来源依据' },
  { key: 'has_applicability_scope', label: '有适用范围' },
  { key: 'has_control_activity', label: '有控制活动' },
  { key: 'has_expected_evidence', label: '有预期证据' },
  { key: 'has_human_review', label: '有人审确认' },
  { key: 'has_case_validation', label: '有案例验证' },
]

type ControlPointFormState = {
  controlCode: string
  controlName: string
  controlDesc: string
  aliases: string
  keywords: string
  canonicalTheme: string
  l1Code: string
  l2Code: string
  controlFamily: string
  controlType: (typeof CONTROL_TYPE_OPTIONS)[number]
  mandatoryDefault: boolean
  riskLevelDefault: (typeof RISK_LEVEL_OPTIONS)[number]
  ownerRoleHint: string
}

type FiltersState = {
  keyword: string
  status: ControlPointStatus | 'all'
  l1Code: string
  l2Code: string
  controlFamily: string
  originTypes: ControlPointOriginType[]
  maturityLevels: ControlPointMaturityLevel[]
  sectors: ApplicableSector[]
  failureModeId: string
  failureModeName: string
}

type QuestionFormState = {
  questionText: string
  questionType: QuestionItemType
  expectedAnswer: string
  answerSchema: Record<string, unknown> | null
}

type RemediationFormState = {
  actionTitle: string
  actionDesc: string
  priorityDefault: RemediationPriority
  effortLevel: RemediationEffort
}

type EvidenceMetaState = {
  frequency: EvidenceFrequency
  ownerRole: string
  samplingRequirement: EvidenceSamplingRequirement
}

function errorMessage(error: unknown, fallback = '操作失败') {
  return error instanceof Error && error.message ? error.message : fallback
}

function parseCommaSeparated(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseLineSeparated(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildCreateForm(): ControlPointFormState {
  return {
    controlCode: '',
    controlName: '',
    controlDesc: '',
    aliases: '',
    keywords: '',
    canonicalTheme: '',
    l1Code: '',
    l2Code: '',
    controlFamily: '',
    controlType: 'preventive' as const,
    mandatoryDefault: false,
    riskLevelDefault: 'MEDIUM' as const,
    ownerRoleHint: '',
  }
}

function buildEditForm(detail: ControlPointRecord): ControlPointFormState {
  return {
    controlCode: detail.controlCode,
    controlName: detail.controlName,
    controlDesc: detail.controlDesc ?? '',
    aliases: (detail.aliases ?? []).join('\n'),
    keywords: (detail.keywords ?? []).join(', '),
    canonicalTheme: detail.canonicalTheme ?? '',
    l1Code: detail.l1Code,
    l2Code: detail.l2Code,
    controlFamily: detail.controlFamily,
    controlType: detail.controlType,
    mandatoryDefault: detail.mandatoryDefault,
    riskLevelDefault: detail.riskLevelDefault,
    ownerRoleHint: (detail.ownerRoleHint ?? []).join(', '),
  }
}

function buildDefaultFilters(): FiltersState {
  return {
    keyword: '',
    status: 'ACTIVE',
    l1Code: 'all',
    l2Code: 'all',
    controlFamily: 'all',
    originTypes: [...ORIGIN_TYPE_OPTIONS],
    maturityLevels: ['hard', 'draft-hard', 'candidate'],
    sectors: [],
    failureModeId: '',
    failureModeName: '',
  }
}

function buildClearedFilters(): FiltersState {
  return {
    keyword: '',
    status: 'all',
    l1Code: 'all',
    l2Code: 'all',
    controlFamily: 'all',
    originTypes: [...ORIGIN_TYPE_OPTIONS],
    maturityLevels: [...MATURITY_LEVEL_OPTIONS],
    sectors: [],
    failureModeId: '',
    failureModeName: '',
  }
}

function buildQuestionForm(): QuestionFormState {
  return {
    questionText: '',
    questionType: 'SINGLE_CHOICE',
    expectedAnswer: '',
    answerSchema: null,
  }
}

function buildEvidenceMeta(): EvidenceMetaState {
  return {
    frequency: 'MONTHLY',
    ownerRole: '',
    samplingRequirement: 'FULL',
  }
}

function resolveL2Options(
  taxonomyTree: Array<{
    l1Code: string
    l1Name: string
    children: Array<{ l2Code: string; l2Name: string }>
  }>,
  l1Code: string
) {
  if (!l1Code || l1Code === 'all') {
    return taxonomyTree.flatMap((item) => item.children)
  }

  return taxonomyTree.find((item) => item.l1Code === l1Code)?.children ?? []
}

function validateControlPointForm(form: ControlPointFormState, requireCode = false) {
  if (requireCode && !form.controlCode.trim()) return 'controlCode 为必填项'
  if (!form.controlName.trim()) return 'controlName 为必填项'
  if (!form.l1Code) return 'l1Code 为必填项'
  if (!form.l2Code) return 'l2Code 为必填项'
  if (!form.controlFamily.trim()) return 'controlFamily 为必填项'
  if (!form.controlType) return 'controlType 为必填项'
  if (!form.riskLevelDefault) return 'riskLevelDefault 为必填项'
  return null
}

function buildRemediationForm(): RemediationFormState {
  return {
    actionTitle: '',
    actionDesc: '',
    priorityDefault: 'MEDIUM',
    effortLevel: 'MEDIUM',
  }
}

function getSelectedFilterValues<T>(selected: T[], all: readonly T[]) {
  if (selected.length === 0 || selected.length === all.length) {
    return undefined
  }

  return selected
}

function buildQuestionAnswerSchema(form: QuestionFormState) {
  const answerSchema = { ...(form.answerSchema ?? {}) }
  if (form.expectedAnswer.trim()) {
    answerSchema.expectedAnswer = form.expectedAnswer.trim()
  } else {
    delete answerSchema.expectedAnswer
  }

  return Object.keys(answerSchema).length > 0 ? answerSchema : undefined
}

function matchesClientSideMultiFilters(
  item: ControlPointRecord,
  {
    originTypes,
    maturityLevels,
    sectors,
  }: {
    originTypes?: ControlPointOriginType[]
    maturityLevels?: ControlPointMaturityLevel[]
    sectors?: ApplicableSector[]
  }
) {
  if (originTypes && !originTypes.includes(item.originType ?? 'candidate')) {
    return false
  }

  if (maturityLevels && !maturityLevels.includes(item.maturityLevel ?? 'candidate')) {
    return false
  }

  if (sectors && !(item.applicableSector ?? []).some((sector) => sectors.includes(sector))) {
    return false
  }

  return true
}

function getOriginBadgeClassName(originType?: ControlPointOriginType | null) {
  switch (originType) {
    case 'case_derived':
      return 'border-none bg-sky-100 text-sky-700 hover:bg-sky-100'
    case 'regulation_derived':
      return 'border-none bg-violet-100 text-violet-700 hover:bg-violet-100'
    case 'both':
      return 'border-none bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
    case 'manual':
      return 'border-none bg-slate-200 text-slate-700 hover:bg-slate-200'
    default:
      return 'border-none bg-amber-100 text-amber-800 hover:bg-amber-100'
  }
}

function getMaturityBadgeClassName(maturityLevel?: ControlPointMaturityLevel | null) {
  switch (maturityLevel) {
    case 'hard':
      return 'border-none bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
    case 'draft-hard':
      return 'border-none bg-amber-100 text-amber-800 hover:bg-amber-100'
    case 'retired':
      return 'border-none bg-rose-100 text-rose-700 hover:bg-rose-100'
    default:
      return 'border-none bg-slate-200 text-slate-700 hover:bg-slate-200'
  }
}

function buildEmptyRegulatoryLinks(controlId = ''): ControlPointRegulatoryLinksResponse {
  return {
    controlId,
    clauses: [],
    obligations: [],
    cases: [],
  }
}

export default function ControlPointAdminPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const canAccess = Boolean(session?.user && ALLOWED_ROLES.includes(session.user.role))
  const deepLinkedControlId = searchParams?.get('controlId') ?? null
  const appliedDeepLinkId = useRef<string | null>(null)
  const itemsRef = useRef<ControlPointRecord[]>([])
  const preferredSelectedControlId = useRef<string | null>(null)
  const failureModeSearchRequestId = useRef(0)
  const evidenceSearchRequestId = useRef(0)
  const clauseSearchRequestId = useRef(0)

  const [filters, setFilters] = useState<FiltersState>(buildDefaultFilters())
  const [failureModeKeyword, setFailureModeKeyword] = useState('')
  const [failureModeResults, setFailureModeResults] = useState<
    Array<{ failureModeId: string; failureModeCode: string; name: string }>
  >([])
  const deferredKeyword = useDeferredValue(filters.keyword)
  const [items, setItems] = useState<ControlPointRecord[]>([])
  const [listTotal, setListTotal] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ControlPointRecord | null>(null)
  const [fullContext, setFullContext] = useState<ControlExplainResponse | null>(null)
  const [listLoading, setListLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createForm, setCreateForm] = useState<ControlPointFormState>(buildCreateForm())
  const [editForm, setEditForm] = useState<ControlPointFormState>(buildCreateForm())
  const [activeTab, setActiveTab] = useState('evidence')
  const [tabLoading, setTabLoading] = useState(false)
  const [tabReloadToken, setTabReloadToken] = useState(0)
  const [evidenceItems, setEvidenceItems] = useState<ControlPointEvidence[]>([])
  const [evidenceKeyword, setEvidenceKeyword] = useState('')
  const [evidenceSearchResults, setEvidenceSearchResults] = useState<
    Awaited<ReturnType<typeof searchEvidenceTypes>>['items']
  >([])
  const [evidenceMeta, setEvidenceMeta] = useState<EvidenceMetaState>(buildEvidenceMeta())
  const [questionItems, setQuestionItems] = useState<QuestionItemRecord[]>([])
  const [questionForm, setQuestionForm] = useState(buildQuestionForm())
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [remediationItems, setRemediationItems] = useState<RemediationActionRecord[]>([])
  const [remediationForm, setRemediationForm] = useState(buildRemediationForm())
  const [editingRemediationId, setEditingRemediationId] = useState<string | null>(null)
  const [packItems, setPackItems] = useState<ControlPackItemRecord[]>([])
  const [packCatalog, setPackCatalog] = useState<ControlPackCatalogItem[]>([])
  const [packKeyword, setPackKeyword] = useState('')
  const [regulatoryLinks, setRegulatoryLinks] = useState<ControlPointRegulatoryLinksResponse>(
    buildEmptyRegulatoryLinks()
  )
  const [clauseKeyword, setClauseKeyword] = useState('')
  const [clauseResults, setClauseResults] = useState<
    Awaited<ReturnType<typeof searchRegulationClauses>>['items']
  >([])
  const [controlFamilies, setControlFamilies] = useState<string[]>([])
  const [taxonomyTree, setTaxonomyTree] = useState<
    Array<{
      l1Code: string
      l1Name: string
      children: Array<{ l2Code: string; l2Name: string }>
    }>
  >([])

  const l1Options = useMemo(
    () =>
      taxonomyTree.map((item) => ({
        value: item.l1Code,
        label: `${item.l1Code} · ${item.l1Name}`,
      })),
    [taxonomyTree]
  )

  const filterL2Options = useMemo(
    () => resolveL2Options(taxonomyTree, filters.l1Code),
    [filters.l1Code, taxonomyTree]
  )
  const createL2Options = useMemo(
    () => resolveL2Options(taxonomyTree, createForm.l1Code),
    [createForm.l1Code, taxonomyTree]
  )
  const editL2Options = useMemo(
    () => resolveL2Options(taxonomyTree, editForm.l1Code),
    [editForm.l1Code, taxonomyTree]
  )
  const totalPages = Math.max(1, Math.ceil(listTotal / PAGE_SIZE))
  const activeOriginTypes = useMemo(
    () => getSelectedFilterValues(filters.originTypes, ORIGIN_TYPE_OPTIONS),
    [filters.originTypes]
  )
  const activeMaturityLevels = useMemo(
    () => getSelectedFilterValues(filters.maturityLevels, MATURITY_LEVEL_OPTIONS),
    [filters.maturityLevels]
  )
  const activeSectors = useMemo(
    () => (filters.sectors.length === 0 ? undefined : filters.sectors),
    [filters.sectors]
  )
  const visiblePackCatalog = useMemo(() => {
    const linkedPackIds = new Set(packItems.map((item) => item.packId))
    const keyword = packKeyword.trim().toLowerCase()

    return packCatalog.filter((item) => {
      if (linkedPackIds.has(item.packId)) {
        return false
      }

      if (!keyword) {
        return true
      }

      return (
        item.packCode.toLowerCase().includes(keyword) ||
        (item.packName ?? '').toLowerCase().includes(keyword)
      )
    })
  }, [packCatalog, packItems, packKeyword])
  const visibleEvidenceSearchResults = useMemo(() => {
    const linkedEvidenceIds = new Set(evidenceItems.map((item) => item.evidenceId))
    return evidenceSearchResults.filter((item) => !linkedEvidenceIds.has(item.evidenceId))
  }, [evidenceItems, evidenceSearchResults])
  const visibleClauseResults = useMemo(() => {
    const linkedClauseIds = new Set(regulatoryLinks.clauses.map((item) => item.clauseId))
    return clauseResults.filter((item) => !linkedClauseIds.has(item.clauseId))
  }, [clauseResults, regulatoryLinks.clauses])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [router, status])

  useEffect(() => {
    if (deepLinkedControlId && appliedDeepLinkId.current !== deepLinkedControlId) {
      appliedDeepLinkId.current = deepLinkedControlId
      setSelectedId(deepLinkedControlId)
    }
  }, [deepLinkedControlId])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    if (status !== 'authenticated' || !canAccess) return
    let cancelled = false

    async function loadTaxonomyTree() {
      try {
        const taxonomyResult = await getTaxonomyTree()
        if (cancelled) return
        setTaxonomyTree(
          taxonomyResult.map((item) => ({
            l1Code: item.l1Code,
            l1Name: item.l1Name,
            children: item.children.map((child) => ({
              l2Code: child.l2Code,
              l2Name: child.l2Name,
            })),
          }))
        )
      } catch (taxonomyError) {
        if (!cancelled) {
          setTaxonomyTree([])
          toast.error(errorMessage(taxonomyError, '加载 IT 分类目录失败'))
        }
      }
    }

    void loadTaxonomyTree()
    return () => {
      cancelled = true
    }
  }, [canAccess, reloadToken, status])

  useEffect(() => {
    if (status !== 'authenticated' || !canAccess) return
    let cancelled = false

    async function loadControlFamilies() {
      try {
        const familyResult = await listControlPoints({
          page: 1,
          limit: 100,
          status: filters.status === 'all' ? undefined : filters.status,
        })
        if (cancelled) return
        setControlFamilies(
          Array.from(new Set(familyResult.items.map((item) => item.controlFamily)))
            .filter(Boolean)
            .sort((left, right) => left.localeCompare(right))
        )
      } catch (familyError) {
        if (!cancelled) {
          setControlFamilies([])
          toast.error(errorMessage(familyError, '加载 Control Point 控制族目录失败'))
        }
      }
    }

    void loadControlFamilies()
    return () => {
      cancelled = true
    }
  }, [canAccess, filters.status, reloadToken, status])

  useEffect(() => {
    setPage(1)
  }, [
    deferredKeyword,
    filters.controlFamily,
    filters.failureModeId,
    filters.l1Code,
    filters.l2Code,
    filters.maturityLevels,
    filters.originTypes,
    filters.sectors,
    filters.status,
  ])

  useEffect(() => {
    if (status !== 'authenticated' || !canAccess) return
    let cancelled = false
    const needsClientSideMultiFilter =
      (activeOriginTypes?.length ?? 0) > 1 ||
      (activeMaturityLevels?.length ?? 0) > 1 ||
      (activeSectors?.length ?? 0) > 1

    const baseQuery = {
      status: filters.status === 'all' ? undefined : filters.status,
      keyword: deferredKeyword.trim() || undefined,
      l1Code: filters.l1Code === 'all' ? undefined : filters.l1Code,
      l2Code: filters.l2Code === 'all' ? undefined : filters.l2Code,
      controlFamily: filters.controlFamily === 'all' ? undefined : filters.controlFamily,
      originType: activeOriginTypes?.length === 1 ? activeOriginTypes[0] : undefined,
      maturityLevel: activeMaturityLevels?.length === 1 ? activeMaturityLevels[0] : undefined,
      applicableSector: activeSectors?.length === 1 ? activeSectors[0] : undefined,
      failureModeId: filters.failureModeId || undefined,
    } as const

    async function loadAllControlPointPages() {
      const collected: ControlPointRecord[] = []
      let nextPage = 1
      let total = 0

      do {
        const result = await listControlPoints({
          ...baseQuery,
          page: nextPage,
          limit: 100,
        })
        collected.push(...result.items)
        total = result.total
        nextPage += 1
      } while (collected.length < total)

      return collected
    }

    async function loadData() {
      try {
        setListLoading(true)
        setError(null)
        const controlResult = await (async () => {
          if (needsClientSideMultiFilter) {
            const allItems = await loadAllControlPointPages()
            const filteredItems = allItems.filter((item) =>
              matchesClientSideMultiFilters(item, {
                originTypes: activeOriginTypes,
                maturityLevels: activeMaturityLevels,
                sectors: activeSectors,
              })
            )
            const nextTotal = filteredItems.length
            const nextTotalPages = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE))
            if (page > nextTotalPages && nextTotal > 0) {
              setPage(nextTotalPages)
              return null
            }

            return {
              items: filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
              total: nextTotal,
            }
          }

          const result = await listControlPoints({
            ...baseQuery,
            page,
            limit: PAGE_SIZE,
          })
          const nextTotalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
          if (page > nextTotalPages && result.total > 0 && result.items.length === 0) {
            setPage(nextTotalPages)
            return null
          }

          return {
            items: result.items,
            total: result.total,
          }
        })()

        if (cancelled || !controlResult) return
        itemsRef.current = controlResult.items
        setItems(controlResult.items)
        setListTotal(controlResult.total)
        setSelectedId((current) => {
          if (appliedDeepLinkId.current) {
            return appliedDeepLinkId.current
          }
          if (current && controlResult.items.some((item) => item.controlId === current)) {
            return current
          }
          if (current && preferredSelectedControlId.current === current) {
            return current
          }
          return controlResult.items[0]?.controlId ?? null
        })
      } catch (loadError) {
        if (!cancelled) {
          setItems([])
          itemsRef.current = []
          setListTotal(0)
          setError(errorMessage(loadError, '加载 Control Point 列表失败'))
        }
      } finally {
        if (!cancelled) setListLoading(false)
      }
    }

    void loadData()
    return () => {
      cancelled = true
    }
  }, [
    activeMaturityLevels,
    activeOriginTypes,
    activeSectors,
    canAccess,
    deferredKeyword,
    filters.controlFamily,
    filters.failureModeId,
    filters.l1Code,
    filters.l2Code,
    filters.status,
    page,
    reloadToken,
    status,
  ])

  useEffect(() => {
    if (!selectedId || status !== 'authenticated' || !canAccess) {
      setDetail(null)
      setFullContext(null)
      setEditForm(buildCreateForm())
      return
    }

    const controlId = selectedId
    let cancelled = false

    async function loadDetail() {
      try {
        setDetailLoading(true)
        setDetail(null)
        setFullContext(null)
        setEditForm(buildCreateForm())
        const [detailResult, fullContextResult] = await Promise.all([
          getControlPoint(controlId),
          getControlExplain({ controlId, sourceModule: 'admin' }),
        ])
        if (cancelled) return
        setDetail(detailResult)
        setEditForm(buildEditForm(detailResult))
        setFullContext(fullContextResult)
        if (appliedDeepLinkId.current === controlId) {
          appliedDeepLinkId.current = null
        }
      } catch (loadError) {
        if (!cancelled) {
          if (appliedDeepLinkId.current === controlId) {
            appliedDeepLinkId.current = null
            setSelectedId(itemsRef.current[0]?.controlId ?? null)
          }
          toast.error(errorMessage(loadError, '加载 Control Point 详情失败'))
        }
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }

    void loadDetail()
    return () => {
      cancelled = true
    }
  }, [canAccess, reloadToken, selectedId, status])

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationError = validateControlPointForm(createForm, true)
    if (validationError) {
      toast.error(validationError)
      return
    }
    try {
      setSaving(true)
      const created = await createControlPoint({
        controlCode: createForm.controlCode.trim(),
        controlName: createForm.controlName.trim(),
        controlDesc: createForm.controlDesc.trim() || undefined,
        aliases: parseLineSeparated(createForm.aliases),
        keywords: parseCommaSeparated(createForm.keywords),
        canonicalTheme: createForm.canonicalTheme.trim() || undefined,
        l1Code: createForm.l1Code,
        l2Code: createForm.l2Code,
        controlFamily: createForm.controlFamily.trim(),
        controlType: createForm.controlType,
        mandatoryDefault: createForm.mandatoryDefault,
        riskLevelDefault: createForm.riskLevelDefault,
        ownerRoleHint: parseCommaSeparated(createForm.ownerRoleHint),
      })
      toast.success('控制点已创建')
      setCreateOpen(false)
      setCreateForm(buildCreateForm())
      setReloadToken((current) => current + 1)
      preferredSelectedControlId.current = created.controlId
      setSelectedId(created.controlId)
    } catch (submitError) {
      toast.error(errorMessage(submitError, '创建控制点失败'))
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive() {
    if (!selectedId) return
    try {
      setSaving(true)
      await updateControlPointStatus(selectedId, { status: 'INACTIVE' })
      toast.success('控制点已归档')
      setArchiveOpen(false)
      setReloadToken((current) => current + 1)
    } catch (submitError) {
      toast.error(errorMessage(submitError, '归档控制点失败'))
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateControlPoint(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedId) return

    const validationError = validateControlPointForm(editForm, false)
    if (validationError) {
      toast.error(validationError)
      return
    }

    try {
      setSaving(true)
      await updateControlPoint(selectedId, {
        controlName: editForm.controlName.trim(),
        controlDesc: editForm.controlDesc.trim() || undefined,
        aliases: parseLineSeparated(editForm.aliases),
        keywords: parseCommaSeparated(editForm.keywords),
        canonicalTheme: editForm.canonicalTheme.trim() || undefined,
        l1Code: editForm.l1Code,
        l2Code: editForm.l2Code,
        controlFamily: editForm.controlFamily.trim(),
        controlType: editForm.controlType,
        mandatoryDefault: editForm.mandatoryDefault,
        riskLevelDefault: editForm.riskLevelDefault,
        ownerRoleHint: parseCommaSeparated(editForm.ownerRoleHint),
      })
      toast.success('控制点已更新')
      setEditOpen(false)
      setReloadToken((current) => current + 1)
    } catch (submitError) {
      toast.error(errorMessage(submitError, '更新控制点失败'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSearchFailureModes() {
    try {
      const requestId = failureModeSearchRequestId.current + 1
      failureModeSearchRequestId.current = requestId
      const result = await listFailureModes({ page: 1, limit: 10, keyword: failureModeKeyword })
      if (requestId !== failureModeSearchRequestId.current) return
      setFailureModeResults(
        result.items.map((item) => ({
          failureModeId: item.failureModeId,
          failureModeCode: item.failureModeCode,
          name: item.name,
        }))
      )
    } catch (searchError) {
      toast.error(errorMessage(searchError, '搜索 Failure Mode 失败'))
    }
  }

  useEffect(() => {
    if (!selectedId) {
      setEvidenceItems([])
      setQuestionItems([])
      setRemediationItems([])
      setPackItems([])
      setRegulatoryLinks(buildEmptyRegulatoryLinks())
      setQuestionForm(buildQuestionForm())
      setEditingQuestionId(null)
      setRemediationForm(buildRemediationForm())
      setEditingRemediationId(null)
      setEvidenceMeta(buildEvidenceMeta())
      setEvidenceSearchResults([])
      setClauseResults([])
      return
    }

    const controlId = selectedId
    let cancelled = false

    setEvidenceItems([])
    setQuestionItems([])
    setRemediationItems([])
    setPackItems([])
    setRegulatoryLinks(buildEmptyRegulatoryLinks(controlId))
    setQuestionForm(buildQuestionForm())
    setEditingQuestionId(null)
    setRemediationForm(buildRemediationForm())
    setEditingRemediationId(null)
    setEvidenceMeta(buildEvidenceMeta())
    setEvidenceSearchResults([])
    setClauseResults([])

    async function loadTabData() {
      try {
        setTabLoading(true)
        switch (activeTab) {
          case 'evidence': {
            const result = await getControlPointEvidences(controlId)
            if (!cancelled) setEvidenceItems(result.evidences)
            break
          }
          case 'question': {
            const result = await getControlPointQuestions(controlId)
            if (!cancelled) setQuestionItems(result.questions)
            break
          }
          case 'remediation': {
            const result = await getControlPointRemediations(controlId)
            if (!cancelled) setRemediationItems(result.remediations)
            break
          }
          case 'pack': {
            const [packLinks, packCatalogResult] = await Promise.all([
              getControlPointPackLinks(controlId),
              listControlPackCatalog(),
            ])
            if (!cancelled) {
              setPackItems(packLinks.items)
              setPackCatalog(packCatalogResult)
            }
            break
          }
          case 'regulatory': {
            const result = await getControlPointRegulatoryLinks(controlId)
            if (!cancelled) setRegulatoryLinks(result)
            break
          }
          default:
            break
        }
      } catch (loadError) {
        if (!cancelled) toast.error(errorMessage(loadError, '加载子资源失败'))
      } finally {
        if (!cancelled) setTabLoading(false)
      }
    }

    void loadTabData()
    return () => {
      cancelled = true
    }
  }, [activeTab, selectedId, tabReloadToken])

  async function handleSearchEvidences() {
    try {
      const requestId = evidenceSearchRequestId.current + 1
      evidenceSearchRequestId.current = requestId
      const result = await searchEvidenceTypes({ keyword: evidenceKeyword, page: 1, limit: 10 })
      if (requestId !== evidenceSearchRequestId.current) return
      setEvidenceSearchResults(result.items)
    } catch (searchError) {
      toast.error(errorMessage(searchError, '搜索证据类型失败'))
    }
  }

  async function handleAddEvidence(evidenceId: string) {
    if (!selectedId) return
    if (evidenceItems.some((item) => item.evidenceId === evidenceId)) {
      toast.error('该证据映射已存在')
      return
    }
    try {
      setSaving(true)
      await createControlEvidenceMap({
        controlId: selectedId,
        evidenceId,
        requiredLevel: 'REQUIRED',
        frequency: evidenceMeta.frequency,
        ownerRole: evidenceMeta.ownerRole || undefined,
        samplingRequirement: evidenceMeta.samplingRequirement,
      })
      toast.success('证据映射已添加')
      setEvidenceKeyword('')
      setEvidenceSearchResults([])
      setEvidenceMeta(buildEvidenceMeta())
      setTabReloadToken((current) => current + 1)
    } catch (submitError) {
      toast.error(errorMessage(submitError, '添加证据映射失败'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteEvidence(id: string) {
    try {
      setSaving(true)
      await deleteControlEvidenceMap(id)
      toast.success('证据映射已删除')
      setTabReloadToken((current) => current + 1)
    } catch (submitError) {
      toast.error(errorMessage(submitError, '删除证据映射失败'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedId || !detail) return
    try {
      setSaving(true)
      const answerSchema = buildQuestionAnswerSchema(questionForm)
      if (editingQuestionId) {
        await updateQuestionItem(editingQuestionId, {
          questionText: questionForm.questionText.trim(),
          questionType: questionForm.questionType,
          answerSchema,
        })
      } else {
        await createQuestionItem({
          controlId: selectedId,
          questionCode: `${detail.controlCode}-Q-${Date.now()}`,
          questionText: questionForm.questionText.trim(),
          questionType: questionForm.questionType,
          answerSchema,
        })
      }
      toast.success(editingQuestionId ? '题库项已更新' : '题库项已创建')
      setQuestionForm(buildQuestionForm())
      setEditingQuestionId(null)
      setTabReloadToken((current) => current + 1)
    } catch (submitError) {
      toast.error(
        errorMessage(submitError, editingQuestionId ? '更新题库项失败' : '创建题库项失败')
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteQuestion(questionId: string) {
    try {
      setSaving(true)
      await updateQuestionItem(questionId, { status: 'INACTIVE' })
      toast.success('题库项已删除')
      setTabReloadToken((current) => current + 1)
    } catch (submitError) {
      toast.error(errorMessage(submitError, '删除题库项失败'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveRemediation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedId || !detail) return
    try {
      setSaving(true)
      if (editingRemediationId) {
        await updateRemediationAction(editingRemediationId, {
          actionTitle: remediationForm.actionTitle.trim(),
          actionDesc: remediationForm.actionDesc.trim() || undefined,
          priorityDefault: remediationForm.priorityDefault,
          effortLevel: remediationForm.effortLevel,
        })
      } else {
        await createRemediationAction({
          controlId: selectedId,
          actionCode: `${detail.controlCode}-RA-${Date.now()}`,
          actionTitle: remediationForm.actionTitle.trim(),
          actionDesc: remediationForm.actionDesc.trim() || undefined,
          priorityDefault: remediationForm.priorityDefault,
          effortLevel: remediationForm.effortLevel,
        })
      }
      toast.success(editingRemediationId ? '整改建议已更新' : '整改建议已创建')
      setRemediationForm(buildRemediationForm())
      setEditingRemediationId(null)
      setTabReloadToken((current) => current + 1)
    } catch (submitError) {
      toast.error(
        errorMessage(submitError, editingRemediationId ? '更新整改建议失败' : '创建整改建议失败')
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteRemediation(actionId: string) {
    try {
      setSaving(true)
      await updateRemediationAction(actionId, { status: 'INACTIVE' })
      toast.success('整改建议已删除')
      setTabReloadToken((current) => current + 1)
    } catch (submitError) {
      toast.error(errorMessage(submitError, '删除整改建议失败'))
    } finally {
      setSaving(false)
    }
  }

  async function handleAddPack(packId: string) {
    if (!selectedId) return
    if (packItems.some((item) => item.packId === packId)) {
      toast.error('该控制包关联已存在')
      return
    }
    try {
      setSaving(true)
      await createControlPackItem({
        controlId: selectedId,
        packId,
        itemRole: 'INCLUDE',
        priority: 100,
      })
      toast.success('控制包关联已添加')
      setPackKeyword('')
      setTabReloadToken((current) => current + 1)
    } catch (submitError) {
      toast.error(errorMessage(submitError, '添加控制包关联失败'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePack(id: string) {
    if (detail?.maturityLevel === 'hard' && packItems.length <= 1) {
      toast.error('hard 级控制点必须至少保留 1 个控制包关联')
      return
    }
    try {
      setSaving(true)
      await deleteControlPackItem(id)
      toast.success('控制包关联已删除')
      setTabReloadToken((current) => current + 1)
    } catch (submitError) {
      toast.error(errorMessage(submitError, '删除控制包关联失败'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSearchClauses() {
    try {
      const requestId = clauseSearchRequestId.current + 1
      clauseSearchRequestId.current = requestId
      const result = await searchRegulationClauses({ keyword: clauseKeyword, page: 1, limit: 10 })
      if (requestId !== clauseSearchRequestId.current) return
      setClauseResults(result.items)
    } catch (searchError) {
      toast.error(errorMessage(searchError, '搜索法规条文失败'))
    }
  }

  async function handleAddClause(clauseId: string) {
    if (!selectedId) return
    if (regulatoryLinks.clauses.some((item) => item.clauseId === clauseId)) {
      toast.error('该法规条文关联已存在')
      return
    }
    try {
      setSaving(true)
      await createClauseControlMap({
        controlId: selectedId,
        clauseId,
        mappingType: 'direct',
        reviewStatus: 'PENDING',
      })
      toast.success('法规条文关联已添加')
      setClauseKeyword('')
      setClauseResults([])
      setTabReloadToken((current) => current + 1)
    } catch (submitError) {
      toast.error(errorMessage(submitError, '添加法规条文关联失败'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteClause(id: string) {
    try {
      setSaving(true)
      await deleteClauseControlMap(id)
      toast.success('法规条文关联已删除')
      setTabReloadToken((current) => current + 1)
    } catch (submitError) {
      toast.error(errorMessage(submitError, '删除法规条文关联失败'))
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
                <h1 className="text-2xl font-bold text-[#1E3A5F]">无权访问 Control Point 管理</h1>
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
            title="Control Point 管理"
            description="维护控制点清单、治理字段与关联上下文"
            icon={<Target className="h-6 w-6" />}
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
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  新建 Control Point
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
              <CardContent className="space-y-4 p-5" data-testid="control-points-list-panel">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="control-keyword">关键词</Label>
                    <Input
                      id="control-keyword"
                      value={filters.keyword}
                      onChange={(event) =>
                        setFilters((current) => ({ ...current, keyword: event.target.value }))
                      }
                      placeholder="搜索 code / name / description"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>状态</Label>
                      <Select
                        value={filters.status}
                        onValueChange={(value) =>
                          setFilters((current) => ({
                            ...current,
                            status: value as FiltersState['status'],
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部</SelectItem>
                          {STATUS_OPTIONS.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>控制族</Label>
                      <Select
                        value={filters.controlFamily}
                        onValueChange={(value) =>
                          setFilters((current) => ({ ...current, controlFamily: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部</SelectItem>
                          {controlFamilies.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>一级分类</Label>
                      <Select
                        value={filters.l1Code}
                        onValueChange={(value) =>
                          setFilters((current) => ({
                            ...current,
                            l1Code: value,
                            l2Code: 'all',
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部</SelectItem>
                          {l1Options.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>二级分类</Label>
                      <Select
                        value={filters.l2Code}
                        onValueChange={(value) =>
                          setFilters((current) => ({ ...current, l2Code: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部</SelectItem>
                          {filterL2Options.map((item) => (
                            <SelectItem key={item.l2Code} value={item.l2Code}>
                              {item.l2Code} · {item.l2Name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>来源类型</Label>
                      <div className="space-y-2 rounded-sm border border-[#E2E8F0] p-3">
                        {ORIGIN_TYPE_OPTIONS.map((item) => (
                          <div key={item} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={filters.originTypes.includes(item)}
                              onCheckedChange={(checked) =>
                                setFilters((current) => ({
                                  ...current,
                                  originTypes:
                                    checked === true
                                      ? current.originTypes.includes(item)
                                        ? current.originTypes
                                        : [...current.originTypes, item]
                                      : current.originTypes.filter((value) => value !== item),
                                }))
                              }
                            />
                            <span>{ORIGIN_LABELS[item]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>成熟度</Label>
                      <div className="space-y-2 rounded-sm border border-[#E2E8F0] p-3">
                        {MATURITY_LEVEL_OPTIONS.map((item) => (
                          <div key={item} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={filters.maturityLevels.includes(item)}
                              onCheckedChange={(checked) =>
                                setFilters((current) => ({
                                  ...current,
                                  maturityLevels:
                                    checked === true
                                      ? current.maturityLevels.includes(item)
                                        ? current.maturityLevels
                                        : [...current.maturityLevels, item]
                                      : current.maturityLevels.filter((value) => value !== item),
                                }))
                              }
                            />
                            <span>{MATURITY_LABELS[item]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>适用行业</Label>
                      <div className="space-y-2 rounded-sm border border-[#E2E8F0] p-3">
                        {APPLICABLE_SECTOR_OPTIONS.map((item) => (
                          <div key={item} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={filters.sectors.includes(item)}
                              onCheckedChange={(checked) =>
                                setFilters((current) => ({
                                  ...current,
                                  sectors:
                                    checked === true
                                      ? current.sectors.includes(item)
                                        ? current.sectors
                                        : [...current.sectors, item]
                                      : current.sectors.filter((value) => value !== item),
                                }))
                              }
                            />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-sm border border-[#E2E8F0] p-3">
                    <div className="grid gap-3 lg:grid-cols-[1fr_180px]">
                      <Input
                        value={failureModeKeyword}
                        onChange={(event) => setFailureModeKeyword(event.target.value)}
                        placeholder="搜索 Failure Mode"
                      />
                      <Button
                        variant="outline"
                        className="rounded-sm"
                        onClick={() => void handleSearchFailureModes()}
                      >
                        <Search className="mr-2 h-4 w-4" />
                        搜索失效模式
                      </Button>
                    </div>
                    {filters.failureModeId && (
                      <div className="flex items-center justify-between rounded-sm bg-slate-50 px-3 py-2 text-sm">
                        <span>已筛选：{filters.failureModeName}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          className="rounded-sm"
                          onClick={() =>
                            setFilters((current) => ({
                              ...current,
                              failureModeId: '',
                              failureModeName: '',
                            }))
                          }
                        >
                          清除
                        </Button>
                      </div>
                    )}
                    {failureModeResults.length > 0 && (
                      <div className="space-y-2">
                        {failureModeResults.map((item) => (
                          <button
                            key={item.failureModeId}
                            type="button"
                            className="flex w-full items-center justify-between rounded-sm border border-[#E2E8F0] px-3 py-2 text-left hover:border-[#CBD5E1]"
                            onClick={() =>
                              setFilters((current) => ({
                                ...current,
                                failureModeId: item.failureModeId,
                                failureModeName: `${item.failureModeCode} · ${item.name}`,
                              }))
                            }
                          >
                            <span className="font-medium text-[#1E3A5F]">
                              {item.failureModeCode} · {item.name}
                            </span>
                            <Badge variant="outline">筛选</Badge>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-sm"
                        onClick={() => setFilters(buildClearedFilters())}
                      >
                        清空全部过滤条件
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#E2E8F0] pt-4">
                  <div className="mb-3 flex items-center justify-between text-sm text-[#64748B]">
                    <span>共 {listTotal} 条</span>
                    <span>每页 {PAGE_SIZE} 条</span>
                  </div>

                  {listLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-[#1E3A5F]" />
                    </div>
                  ) : items.length === 0 ? (
                    <div className="rounded-sm border border-dashed border-[#CBD5E1] px-4 py-8 text-center text-sm text-[#64748B]">
                      没有符合条件的控制点。
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {items.map((item) => (
                        <button
                          key={item.controlId}
                          type="button"
                          data-testid="control-point-list-item"
                          className={`w-full rounded-sm border px-3 py-3 text-left transition ${
                            item.controlId === selectedId
                              ? 'border-[#1E3A5F] bg-[#F8FAFC]'
                              : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
                          }`}
                          onClick={() => {
                            preferredSelectedControlId.current = null
                            setSelectedId(item.controlId)
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div
                                data-testid="control-code"
                                className="truncate font-medium text-[#1E3A5F]"
                              >
                                {item.controlCode}
                              </div>
                              <div
                                data-testid="control-name"
                                className="mt-1 truncate text-sm text-[#334155]"
                              >
                                {item.controlName}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                <Badge variant="outline">{item.controlFamily}</Badge>
                                <Badge variant="outline">
                                  {item.l1Code} / {item.l2Code}
                                </Badge>
                                {item.maturityLevel && (
                                  <Badge className={getMaturityBadgeClassName(item.maturityLevel)}>
                                    {MATURITY_LABELS[item.maturityLevel] ?? item.maturityLevel}
                                  </Badge>
                                )}
                                {item.originType && (
                                  <Badge className={getOriginBadgeClassName(item.originType)}>
                                    {ORIGIN_LABELS[item.originType] ?? item.originType}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0 space-y-2 text-right text-xs text-[#64748B]">
                              <div>{formatAuthoritativeScorePercent(item.authoritativeScore)}</div>
                              <Progress
                                value={(item.authoritativeScore ?? 0) * 100}
                                className="h-2 w-24"
                              />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-4">
                  <Button
                    variant="outline"
                    className="rounded-sm"
                    disabled={page === 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    上一页
                  </Button>
                  <span className="text-sm text-[#64748B]">
                    第 {page} / {totalPages} 页
                  </span>
                  <Button
                    variant="outline"
                    className="rounded-sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  >
                    下一页
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
              <CardContent className="space-y-4 p-5" data-testid="control-points-detail-panel">
                {detailLoading ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-[#1E3A5F]" />
                  </div>
                ) : detail && fullContext ? (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Target className="h-5 w-5 text-[#1E3A5F]" />
                          <h2 className="text-2xl font-bold text-[#1E3A5F]">
                            {detail.controlCode}
                          </h2>
                          <Badge variant="outline">{detail.status}</Badge>
                        </div>
                        <p className="text-lg text-[#334155]">{detail.controlName}</p>
                        <p className="text-sm text-[#64748B]">
                          {detail.controlFamily} ·{' '}
                          {fullContext.control?.l1?.name
                            ? `${detail.l1Code} · ${fullContext.control.l1.name}`
                            : detail.l1Code}{' '}
                          /{' '}
                          {fullContext.control?.l2?.name
                            ? `${detail.l2Code} · ${fullContext.control.l2.name}`
                            : detail.l2Code}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="rounded-sm"
                          onClick={() => setEditOpen(true)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          编辑控制点
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-sm text-rose-700"
                          onClick={() => setArchiveOpen(true)}
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          归档控制点
                        </Button>
                      </div>
                    </div>

                    <div
                      data-testid="section-basic-info"
                      className="rounded-sm border border-[#E2E8F0] p-4"
                    >
                      <h3 className="font-semibold text-[#1E3A5F]">基本信息</h3>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-xs text-[#64748B]">描述</p>
                          <p className="text-sm text-[#334155]">{detail.controlDesc || '未填写'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#64748B]">默认风险等级</p>
                          <p className="text-sm text-[#334155]">{detail.riskLevelDefault}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#64748B]">控制类型</p>
                          <p className="text-sm text-[#334155]">{detail.controlType}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#64748B]">默认必选</p>
                          <p className="text-sm text-[#334155]">
                            {detail.mandatoryDefault ? '是' : '否'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#64748B]">创建时间</p>
                          <p className="text-sm text-[#334155]">{detail.createdAt || '未提供'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#64748B]">更新时间</p>
                          <p className="text-sm text-[#334155]">{detail.updatedAt || '未提供'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-sm border border-[#E2E8F0] p-4">
                      <h3 className="font-semibold text-[#1E3A5F]">治理字段</h3>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-xs text-[#64748B]">来源类型</p>
                          <p className="text-sm text-[#334155]">
                            {fullContext.governance?.originType
                              ? (ORIGIN_LABELS[fullContext.governance.originType] ??
                                fullContext.governance.originType)
                              : '未填写'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#64748B]">成熟度</p>
                          <p className="text-sm text-[#334155]">
                            {fullContext.governance?.maturityLevel
                              ? (MATURITY_LABELS[fullContext.governance.maturityLevel] ??
                                fullContext.governance.maturityLevel)
                              : '未填写'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#64748B]">权威分数</p>
                          <div className="space-y-2">
                            <p className="text-sm text-[#334155]">
                              {formatAuthoritativeScorePercent(
                                fullContext.governance?.authoritativeScore
                              )}
                            </p>
                            <Progress
                              value={(fullContext.governance?.authoritativeScore ?? 0) * 100}
                              className="h-2.5"
                            />
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-[#64748B]">适用行业</p>
                          <p className="text-sm text-[#334155]">
                            {(fullContext.governance?.applicableSector ?? []).join('、') ||
                              '未填写'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className="mb-2 text-xs text-[#64748B]">权威度维度</p>
                        <div className="grid gap-2 md:grid-cols-2">
                          {AUTHORITY_ITEMS.map((item) => (
                            <div
                              key={item.key}
                              className="flex items-center gap-2 text-sm text-[#334155]"
                            >
                              <Checkbox
                                checked={
                                  fullContext.governance?.authorityProfile?.[item.key] === true
                                }
                              />
                              <span>{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {fullContext.governance?.sectorRequirements &&
                        Object.keys(fullContext.governance.sectorRequirements).length > 0 && (
                          <div className="mt-4">
                            <p className="mb-2 text-xs text-[#64748B]">行业差异化参数</p>
                            <Accordion
                              type="single"
                              collapsible
                              className="rounded-sm border border-[#E2E8F0] px-3"
                            >
                              {Object.entries(fullContext.governance.sectorRequirements).map(
                                ([sector, requirements]) => (
                                  <AccordionItem key={sector} value={sector}>
                                    <AccordionTrigger className="py-3 text-sm text-[#1E3A5F]">
                                      {sector}
                                    </AccordionTrigger>
                                    <AccordionContent>
                                      <div className="space-y-2">
                                        {Object.entries(requirements ?? {}).map(([key, value]) => (
                                          <div
                                            key={key}
                                            className="flex justify-between gap-4 text-sm"
                                          >
                                            <span className="text-[#64748B]">{key}</span>
                                            <span className="text-[#334155]">{String(value)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                )
                              )}
                            </Accordion>
                          </div>
                        )}
                    </div>

                    <div className="rounded-sm border border-[#E2E8F0] p-4">
                      <h3 className="font-semibold text-[#1E3A5F]">IT 分类与主题</h3>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-xs text-[#64748B]">一级 / 二级分类</p>
                          <p className="text-sm text-[#334155]">
                            {fullContext.control?.l1?.name
                              ? `${detail.l1Code} · ${fullContext.control.l1.name}`
                              : detail.l1Code}{' '}
                            /{' '}
                            {fullContext.control?.l2?.name
                              ? `${detail.l2Code} · ${fullContext.control.l2.name}`
                              : detail.l2Code}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#64748B]">规范主题</p>
                          <p className="text-sm text-[#334155]">
                            {detail.canonicalTheme || '未填写'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#64748B]">别名</p>
                          <p className="text-sm text-[#334155]">
                            {(detail.aliases ?? []).join('、') || '未填写'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#64748B]">关键词</p>
                          <p className="text-sm text-[#334155]">
                            {(detail.keywords ?? []).join('、') || '未填写'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-sm border border-[#E2E8F0] p-4">
                      <h3 className="font-semibold text-[#1E3A5F]">关联的失效模式</h3>
                      <div className="mt-3 space-y-2">
                        {(fullContext.failureModes ?? []).length === 0 ? (
                          <p className="text-sm text-[#64748B]">暂无关联失效模式</p>
                        ) : (
                          fullContext.failureModes?.map((item) => (
                            <button
                              key={item.failureModeId ?? item.failureModeCode}
                              type="button"
                              className="flex w-full items-center justify-between rounded-sm border border-[#E2E8F0] px-3 py-2 text-left hover:border-[#CBD5E1]"
                              onClick={() =>
                                item.failureModeId &&
                                router.push(
                                  `/admin/failure-modes?failureModeId=${encodeURIComponent(item.failureModeId)}`
                                )
                              }
                            >
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline">{item.failureModeCode}</Badge>
                                  {item.category && (
                                    <Badge className="border-none bg-amber-100 text-amber-800 hover:bg-amber-100">
                                      {item.category}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-[#334155]">{item.name}</p>
                              </div>
                              <Badge className="border-none bg-sky-100 text-sky-700 hover:bg-sky-100">
                                {item.relevance || 'PRIMARY'}
                              </Badge>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-sm border border-[#E2E8F0] p-4">
                      <h3 className="font-semibold text-[#1E3A5F]">关联的法规义务</h3>
                      <div className="mt-3 space-y-2">
                        {(fullContext.obligations ?? []).length === 0 ? (
                          <p className="text-sm text-[#64748B]">暂无关联法规义务</p>
                        ) : (
                          fullContext.obligations?.map((item) => (
                            <button
                              key={item.obligationId ?? item.obligationCode}
                              type="button"
                              className="flex w-full items-center justify-between rounded-sm border border-[#E2E8F0] px-3 py-2 text-left hover:border-[#CBD5E1]"
                              onClick={() =>
                                item.obligationId &&
                                router.push(
                                  `/admin/obligations?obligationId=${encodeURIComponent(item.obligationId)}`
                                )
                              }
                            >
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline">{item.obligationCode}</Badge>
                                  {item.obligationType && (
                                    <Badge className="border-none bg-violet-100 text-violet-700 hover:bg-violet-100">
                                      {item.obligationType}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-[#334155]">{item.obligationText}</p>
                              </div>
                              <Badge className="border-none bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                {item.coverage || 'FULL'}
                              </Badge>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-sm border border-[#E2E8F0] p-4">
                      <h3 className="font-semibold text-[#1E3A5F]">关联的案例</h3>
                      <div className="mt-3 space-y-2">
                        {(fullContext.cases ?? []).length === 0 ? (
                          <p className="text-sm text-[#64748B]">暂无关联案例</p>
                        ) : (
                          fullContext.cases.map((item) => (
                            <button
                              key={item.caseId ?? item.caseCode}
                              type="button"
                              className="flex w-full items-center justify-between rounded-sm border border-[#E2E8F0] px-3 py-2 text-left hover:border-[#CBD5E1]"
                              onClick={() =>
                                item.caseId &&
                                router.push(
                                  `/admin/compliance-cases?caseId=${encodeURIComponent(item.caseId)}`
                                )
                              }
                            >
                              <div>
                                <p className="font-medium text-[#1E3A5F]">{item.caseCode}</p>
                                <p className="text-sm text-[#334155]">{item.caseTitle}</p>
                              </div>
                              <div className="text-xs text-[#64748B]">
                                {item.relationType || 'VIOLATES'} · {item.confidenceScore || '--'}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-sm border border-[#E2E8F0] p-4">
                      <h3 className="font-semibold text-[#1E3A5F]">子资源管理</h3>
                      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-3">
                        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-slate-100">
                          <TabsTrigger value="evidence">证据类型</TabsTrigger>
                          <TabsTrigger value="question">题库项</TabsTrigger>
                          <TabsTrigger value="remediation">整改建议</TabsTrigger>
                          <TabsTrigger value="pack">控制包关联</TabsTrigger>
                          <TabsTrigger value="regulatory">法规条文关联</TabsTrigger>
                        </TabsList>

                        <TabsContent value="evidence" className="space-y-4">
                          {tabLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-[#1E3A5F]" />
                          ) : (
                            <>
                              <div className="grid gap-3 lg:grid-cols-[1fr_180px]">
                                <Input
                                  value={evidenceKeyword}
                                  onChange={(event) => setEvidenceKeyword(event.target.value)}
                                  placeholder="搜索 evidence types"
                                />
                                <Button
                                  variant="outline"
                                  className="rounded-sm"
                                  onClick={() => void handleSearchEvidences()}
                                >
                                  <Search className="mr-2 h-4 w-4" />
                                  搜索证据
                                </Button>
                              </div>
                              <div className="grid gap-3 md:grid-cols-3">
                                <Select
                                  value={evidenceMeta.frequency}
                                  onValueChange={(value) =>
                                    setEvidenceMeta((current) => ({
                                      ...current,
                                      frequency: value as EvidenceFrequency,
                                    }))
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {EVIDENCE_FREQUENCY_OPTIONS.map((item) => (
                                      <SelectItem key={item} value={item}>
                                        {item}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  value={evidenceMeta.ownerRole}
                                  onChange={(event) =>
                                    setEvidenceMeta((current) => ({
                                      ...current,
                                      ownerRole: event.target.value,
                                    }))
                                  }
                                  placeholder="owner role"
                                />
                                <Select
                                  value={evidenceMeta.samplingRequirement}
                                  onValueChange={(value) =>
                                    setEvidenceMeta((current) => ({
                                      ...current,
                                      samplingRequirement: value as EvidenceSamplingRequirement,
                                    }))
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {EVIDENCE_SAMPLING_OPTIONS.map((item) => (
                                      <SelectItem key={item} value={item}>
                                        {item}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {visibleEvidenceSearchResults.length > 0 && (
                                <div className="space-y-2 rounded-sm border border-dashed border-[#CBD5E1] p-3">
                                  {visibleEvidenceSearchResults.map((item) => (
                                    <div
                                      key={item.evidenceId}
                                      className="flex items-center justify-between rounded-sm border border-[#E2E8F0] px-3 py-2"
                                    >
                                      <div>
                                        <p className="font-medium text-[#1E3A5F]">
                                          {item.evidenceCode}
                                        </p>
                                        <p className="text-sm text-[#334155]">
                                          {item.evidenceName}
                                        </p>
                                      </div>
                                      <Button
                                        size="sm"
                                        className="rounded-sm"
                                        disabled={saving}
                                        onClick={() => void handleAddEvidence(item.evidenceId)}
                                      >
                                        添加映射
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="space-y-2">
                                {evidenceItems.length === 0 ? (
                                  <p className="text-sm text-[#64748B]">暂无证据映射</p>
                                ) : (
                                  evidenceItems.map((item) => (
                                    <div
                                      key={item.id}
                                      className="flex items-center justify-between rounded-sm border border-[#E2E8F0] px-3 py-2"
                                    >
                                      <div>
                                        <p className="font-medium text-[#1E3A5F]">
                                          {item.evidenceCode} · {item.evidenceName}
                                        </p>
                                        <p className="text-xs text-[#64748B]">
                                          {item.frequency || '--'} · {item.ownerRole || '--'} ·{' '}
                                          {item.samplingRequirement || '--'}
                                        </p>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => void handleDeleteEvidence(item.id)}
                                      >
                                        <Trash2 className="h-4 w-4 text-rose-600" />
                                      </Button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </>
                          )}
                        </TabsContent>

                        <TabsContent value="question" className="space-y-4">
                          <form className="space-y-3" onSubmit={handleSaveQuestion}>
                            <Input
                              value={questionForm.questionText}
                              onChange={(event) =>
                                setQuestionForm((current) => ({
                                  ...current,
                                  questionText: event.target.value,
                                }))
                              }
                              placeholder="question text"
                            />
                            <div className="grid gap-3 md:grid-cols-2">
                              <Select
                                value={questionForm.questionType}
                                onValueChange={(value) =>
                                  setQuestionForm((current) => ({
                                    ...current,
                                    questionType: value as QuestionItemType,
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {QUESTION_TYPE_OPTIONS.map((item) => (
                                    <SelectItem key={item} value={item}>
                                      {item}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                value={questionForm.expectedAnswer}
                                onChange={(event) =>
                                  setQuestionForm((current) => ({
                                    ...current,
                                    expectedAnswer: event.target.value,
                                  }))
                                }
                                placeholder="expected answer"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              {editingQuestionId && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="rounded-sm"
                                  onClick={() => {
                                    setQuestionForm(buildQuestionForm())
                                    setEditingQuestionId(null)
                                  }}
                                >
                                  取消编辑
                                </Button>
                              )}
                              <Button type="submit" className="rounded-sm">
                                {editingQuestionId ? '更新题库项' : '新增题库项'}
                              </Button>
                            </div>
                          </form>
                          <div className="space-y-2">
                            {questionItems.length === 0 ? (
                              <p className="text-sm text-[#64748B]">暂无题库项</p>
                            ) : (
                              questionItems.map((item) => (
                                <div
                                  key={item.questionId}
                                  className="flex items-center justify-between rounded-sm border border-[#E2E8F0] px-3 py-2"
                                >
                                  <div>
                                    <p className="font-medium text-[#1E3A5F]">
                                      {item.questionText}
                                    </p>
                                    <p className="text-xs text-[#64748B]">
                                      {item.questionType} ·{' '}
                                      {(item.answerSchema as { expectedAnswer?: string } | null)
                                        ?.expectedAnswer || '--'}
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="rounded-sm"
                                      onClick={() => {
                                        setEditingQuestionId(item.questionId)
                                        setQuestionForm({
                                          questionText: item.questionText,
                                          questionType: item.questionType,
                                          expectedAnswer:
                                            (
                                              item.answerSchema as {
                                                expectedAnswer?: string
                                              } | null
                                            )?.expectedAnswer || '',
                                          answerSchema: item.answerSchema ?? null,
                                        })
                                      }}
                                    >
                                      编辑
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => void handleDeleteQuestion(item.questionId)}
                                    >
                                      <Trash2 className="h-4 w-4 text-rose-600" />
                                    </Button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="remediation" className="space-y-4">
                          <form className="space-y-3" onSubmit={handleSaveRemediation}>
                            <Input
                              value={remediationForm.actionTitle}
                              onChange={(event) =>
                                setRemediationForm((current) => ({
                                  ...current,
                                  actionTitle: event.target.value,
                                }))
                              }
                              placeholder="action title"
                            />
                            <Textarea
                              value={remediationForm.actionDesc}
                              onChange={(event) =>
                                setRemediationForm((current) => ({
                                  ...current,
                                  actionDesc: event.target.value,
                                }))
                              }
                              placeholder="action desc"
                            />
                            <div className="grid gap-3 md:grid-cols-2">
                              <Select
                                value={remediationForm.priorityDefault}
                                onValueChange={(value) =>
                                  setRemediationForm((current) => ({
                                    ...current,
                                    priorityDefault: value as RemediationPriority,
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {REMEDIATION_PRIORITY_OPTIONS.map((item) => (
                                    <SelectItem key={item} value={item}>
                                      {item}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select
                                value={remediationForm.effortLevel}
                                onValueChange={(value) =>
                                  setRemediationForm((current) => ({
                                    ...current,
                                    effortLevel: value as RemediationEffort,
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {REMEDIATION_EFFORT_OPTIONS.map((item) => (
                                    <SelectItem key={item} value={item}>
                                      {item}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex justify-end gap-2">
                              {editingRemediationId && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="rounded-sm"
                                  onClick={() => {
                                    setRemediationForm(buildRemediationForm())
                                    setEditingRemediationId(null)
                                  }}
                                >
                                  取消编辑
                                </Button>
                              )}
                              <Button type="submit" className="rounded-sm">
                                {editingRemediationId ? '更新整改建议' : '新增整改建议'}
                              </Button>
                            </div>
                          </form>
                          <div className="space-y-2">
                            {remediationItems.length === 0 ? (
                              <p className="text-sm text-[#64748B]">暂无整改建议</p>
                            ) : (
                              remediationItems.map((item) => (
                                <div
                                  key={item.actionId}
                                  className="flex items-center justify-between rounded-sm border border-[#E2E8F0] px-3 py-2"
                                >
                                  <div>
                                    <p className="font-medium text-[#1E3A5F]">{item.actionTitle}</p>
                                    <p className="text-xs text-[#64748B]">
                                      {item.priorityDefault || '--'} · {item.effortLevel || '--'}
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="rounded-sm"
                                      onClick={() => {
                                        setEditingRemediationId(item.actionId)
                                        setRemediationForm({
                                          actionTitle: item.actionTitle,
                                          actionDesc: item.actionDesc ?? '',
                                          priorityDefault: item.priorityDefault || 'MEDIUM',
                                          effortLevel: item.effortLevel || 'MEDIUM',
                                        })
                                      }}
                                    >
                                      编辑
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => void handleDeleteRemediation(item.actionId)}
                                    >
                                      <Trash2 className="h-4 w-4 text-rose-600" />
                                    </Button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="pack" className="space-y-4">
                          <div className="grid gap-3 lg:grid-cols-[1fr_180px]">
                            <Input
                              value={packKeyword}
                              onChange={(event) => setPackKeyword(event.target.value)}
                              placeholder="搜索 control packs"
                            />
                            <Button
                              variant="outline"
                              className="rounded-sm"
                              onClick={() => setPackKeyword((current) => current)}
                            >
                              <Search className="mr-2 h-4 w-4" />
                              筛选控制包
                            </Button>
                          </div>
                          {visiblePackCatalog.slice(0, 10).map((item) => (
                            <div
                              key={item.packId}
                              className="flex items-center justify-between rounded-sm border border-[#E2E8F0] px-3 py-2"
                            >
                              <div>
                                <p className="font-medium text-[#1E3A5F]">{item.packCode}</p>
                                <p className="text-xs text-[#64748B]">
                                  {item.packName || '未命名包'} · {item.packType || '--'} ·{' '}
                                  {item.packVersion || '--'}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                className="rounded-sm"
                                disabled={saving}
                                onClick={() => void handleAddPack(item.packId)}
                              >
                                添加关联
                              </Button>
                            </div>
                          ))}
                          <div className="space-y-2">
                            {packItems.length === 0 ? (
                              <p className="text-sm text-[#64748B]">暂无控制包关联</p>
                            ) : (
                              packItems.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between rounded-sm border border-[#E2E8F0] px-3 py-2"
                                >
                                  <div>
                                    <p className="font-medium text-[#1E3A5F]">{item.packCode}</p>
                                    <p className="text-xs text-[#64748B]">
                                      {item.packName || '未命名包'} · {item.packType || '--'} ·{' '}
                                      {item.packVersion || '--'}
                                    </p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => void handleDeletePack(item.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-rose-600" />
                                  </Button>
                                </div>
                              ))
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="regulatory" className="space-y-4">
                          <div className="grid gap-3 lg:grid-cols-[1fr_180px]">
                            <Input
                              value={clauseKeyword}
                              onChange={(event) => setClauseKeyword(event.target.value)}
                              placeholder="搜索 regulation clauses"
                            />
                            <Button
                              variant="outline"
                              className="rounded-sm"
                              onClick={() => void handleSearchClauses()}
                            >
                              <Search className="mr-2 h-4 w-4" />
                              搜索条文
                            </Button>
                          </div>
                          {visibleClauseResults.length > 0 && (
                            <div className="space-y-2 rounded-sm border border-dashed border-[#CBD5E1] p-3">
                              {visibleClauseResults.map((item) => (
                                <div
                                  key={item.clauseId}
                                  className="flex items-center justify-between rounded-sm border border-[#E2E8F0] px-3 py-2"
                                >
                                  <div>
                                    <p className="font-medium text-[#1E3A5F]">{item.clauseCode}</p>
                                    <p className="text-sm text-[#334155]">
                                      {item.articleNo || ''} {item.clauseText}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    className="rounded-sm"
                                    disabled={saving}
                                    onClick={() => void handleAddClause(item.clauseId)}
                                  >
                                    添加关联
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="space-y-2">
                            {regulatoryLinks.clauses.length === 0 ? (
                              <p className="text-sm text-[#64748B]">暂无法规条文关联</p>
                            ) : (
                              regulatoryLinks.clauses.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between rounded-sm border border-[#E2E8F0] px-3 py-2"
                                >
                                  <div>
                                    <p className="font-medium text-[#1E3A5F]">{item.clauseCode}</p>
                                    <p className="text-sm text-[#334155]">
                                      {item.sectionPath || ''} {item.clauseText}
                                    </p>
                                    <p className="text-xs text-[#64748B]">
                                      {item.source?.sourceCode ||
                                        item.source?.sourceName ||
                                        '未提供法规来源'}
                                    </p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => void handleDeleteClause(item.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-rose-600" />
                                  </Button>
                                </div>
                              ))
                            )}
                          </div>
                          {(regulatoryLinks.obligations.length > 0 ||
                            regulatoryLinks.cases.length > 0) && (
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="rounded-sm border border-[#E2E8F0] p-3">
                                <p className="font-medium text-[#1E3A5F]">相关义务</p>
                                <div className="mt-2 space-y-1 text-sm text-[#334155]">
                                  {regulatoryLinks.obligations.map((item) => (
                                    <div key={item.id}>
                                      {item.obligationCode} · {item.obligationText}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="rounded-sm border border-[#E2E8F0] p-3">
                                <p className="font-medium text-[#1E3A5F]">相关案例</p>
                                <div className="mt-2 space-y-1 text-sm text-[#334155]">
                                  {regulatoryLinks.cases.map((item) => (
                                    <div key={`${item.caseCode}-${item.caseTitle}`}>
                                      {item.caseCode} · {item.caseTitle}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                  </>
                ) : (
                  <div className="rounded-sm border border-dashed border-[#CBD5E1] px-4 py-10 text-center text-[#64748B]">
                    请选择左侧 Control Point 查看详情。
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
            <DialogTitle>新建 Control Point</DialogTitle>
            <DialogDescription>填写控制点基础字段并创建新的核心实体。</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-control-code">编码</Label>
                <Input
                  id="create-control-code"
                  value={createForm.controlCode}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, controlCode: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-control-name">名称</Label>
                <Input
                  id="create-control-name"
                  value={createForm.controlName}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, controlName: event.target.value }))
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-control-desc">描述</Label>
              <Textarea
                id="create-control-desc"
                value={createForm.controlDesc}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, controlDesc: event.target.value }))
                }
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-control-family">控制族</Label>
                <Input
                  id="create-control-family"
                  value={createForm.controlFamily}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, controlFamily: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>控制类型</Label>
                <Select
                  value={createForm.controlType}
                  onValueChange={(value) =>
                    setCreateForm((current) => ({
                      ...current,
                      controlType: value as (typeof CONTROL_TYPE_OPTIONS)[number],
                    }))
                  }
                >
                  <SelectTrigger aria-label="控制类型">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTROL_TYPE_OPTIONS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>一级分类</Label>
                <Select
                  value={createForm.l1Code}
                  onValueChange={(value) =>
                    setCreateForm((current) => ({ ...current, l1Code: value, l2Code: '' }))
                  }
                >
                  <SelectTrigger aria-label="一级分类">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {l1Options.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>二级分类</Label>
                <Select
                  value={createForm.l2Code}
                  onValueChange={(value) =>
                    setCreateForm((current) => ({ ...current, l2Code: value }))
                  }
                >
                  <SelectTrigger aria-label="二级分类">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {createL2Options.map((item) => (
                      <SelectItem key={item.l2Code} value={item.l2Code}>
                        {item.l2Code} · {item.l2Name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>默认风险等级</Label>
                <Select
                  value={createForm.riskLevelDefault}
                  onValueChange={(value) =>
                    setCreateForm((current) => ({
                      ...current,
                      riskLevelDefault: value as (typeof RISK_LEVEL_OPTIONS)[number],
                    }))
                  }
                >
                  <SelectTrigger aria-label="默认风险等级">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_LEVEL_OPTIONS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-aliases">别名（每行一个）</Label>
              <Textarea
                id="create-aliases"
                value={createForm.aliases}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, aliases: event.target.value }))
                }
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-keywords">关键词（逗号分隔）</Label>
                <Input
                  id="create-keywords"
                  value={createForm.keywords}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, keywords: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-theme">规范主题</Label>
                <Input
                  id="create-theme"
                  value={createForm.canonicalTheme}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, canonicalTheme: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-owner-role">Owner Role Hint（逗号分隔）</Label>
              <Input
                id="create-owner-role"
                value={createForm.ownerRoleHint}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, ownerRoleHint: event.target.value }))
                }
              />
            </div>

            <div className="flex items-center gap-3 rounded-sm border border-[#E2E8F0] px-3 py-2">
              <Checkbox
                id="create-mandatory-default"
                checked={createForm.mandatoryDefault}
                onCheckedChange={(checked) =>
                  setCreateForm((current) => ({
                    ...current,
                    mandatoryDefault: checked === true,
                  }))
                }
              />
              <Label htmlFor="create-mandatory-default">默认必选</Label>
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
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '创建控制点'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-sm">
          <DialogHeader>
            <DialogTitle>编辑 Control Point</DialogTitle>
            <DialogDescription>更新控制点元数据与分类信息。</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleUpdateControlPoint}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-control-code">编码</Label>
                <Input id="edit-control-code" value={editForm.controlCode} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-control-name">名称</Label>
                <Input
                  id="edit-control-name"
                  value={editForm.controlName}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, controlName: event.target.value }))
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-control-desc">描述</Label>
              <Textarea
                id="edit-control-desc"
                value={editForm.controlDesc}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, controlDesc: event.target.value }))
                }
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-control-family">控制族</Label>
                <Input
                  id="edit-control-family"
                  value={editForm.controlFamily}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, controlFamily: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>控制类型</Label>
                <Select
                  value={editForm.controlType}
                  onValueChange={(value) =>
                    setEditForm((current) => ({
                      ...current,
                      controlType: value as typeof current.controlType,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTROL_TYPE_OPTIONS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>一级分类</Label>
                <Select
                  value={editForm.l1Code}
                  onValueChange={(value) =>
                    setEditForm((current) => ({ ...current, l1Code: value, l2Code: '' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {l1Options.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>二级分类</Label>
                <Select
                  value={editForm.l2Code}
                  onValueChange={(value) =>
                    setEditForm((current) => ({ ...current, l2Code: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {editL2Options.map((item) => (
                      <SelectItem key={item.l2Code} value={item.l2Code}>
                        {item.l2Code} · {item.l2Name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>默认风险等级</Label>
                <Select
                  value={editForm.riskLevelDefault}
                  onValueChange={(value) =>
                    setEditForm((current) => ({
                      ...current,
                      riskLevelDefault: value as typeof current.riskLevelDefault,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_LEVEL_OPTIONS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-aliases">别名（每行一个）</Label>
              <Textarea
                id="edit-aliases"
                value={editForm.aliases}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, aliases: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-keywords">关键词（逗号分隔）</Label>
                <Input
                  id="edit-keywords"
                  value={editForm.keywords}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, keywords: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-theme">规范主题</Label>
                <Input
                  id="edit-theme"
                  value={editForm.canonicalTheme}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, canonicalTheme: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-owner-role">Owner Role Hint（逗号分隔）</Label>
              <Input
                id="edit-owner-role"
                value={editForm.ownerRoleHint}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, ownerRoleHint: event.target.value }))
                }
              />
            </div>
            <div className="flex items-center gap-3 rounded-sm border border-[#E2E8F0] px-3 py-2">
              <Checkbox
                id="edit-mandatory-default"
                checked={editForm.mandatoryDefault}
                onCheckedChange={(checked) =>
                  setEditForm((current) => ({ ...current, mandatoryDefault: checked === true }))
                }
              />
              <Label htmlFor="edit-mandatory-default">默认必选</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-sm"
                onClick={() => setEditOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" className="rounded-sm" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存修改'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle>确认归档控制点</DialogTitle>
            <DialogDescription>
              归档后该控制点将被标记为 INACTIVE，并从默认列表中过滤掉。
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-sm"
              onClick={() => setArchiveOpen(false)}
            >
              取消
            </Button>
            <Button type="button" className="rounded-sm" disabled={saving} onClick={handleArchive}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '确认归档'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
