'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AlertCircle, GitBranch, Loader2, Search, ShieldAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import {
  fetchRolloutPolicies,
  fetchRolloutPolicyByL1Code,
  type TaxonomyRolloutPolicyDetail,
  type TaxonomyRolloutPolicyListItem,
  type TaxonomyRolloutState,
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
  'legacy-primary': 'bg-gray-100 text-gray-800',
  'it04-on-new-interface': 'bg-blue-100 text-blue-800',
  'domain-shadow': 'bg-yellow-100 text-yellow-800',
  'domain-compare': 'bg-orange-100 text-orange-800',
  'domain-primary': 'bg-green-100 text-green-800',
  'legacy-off': 'bg-purple-100 text-purple-800',
}

const EVIDENCE_FIELDS: Array<{
  key: keyof TaxonomyRolloutPolicyDetail['retirementEvidenceJson']
  label: string
  isDate?: boolean
}> = [
  { key: 'lastCutoverAt', label: 'Last Cutover At', isDate: true },
  { key: 'lastCutoverReleaseId', label: 'Last Cutover Release ID' },
  { key: 'lastLegacyOffAt', label: 'Last Legacy Off At', isDate: true },
  { key: 'lastLegacyOffReleaseId', label: 'Last Legacy Off Release ID' },
  { key: 'lastKillSwitchDrillAt', label: 'Last Kill Switch Drill At', isDate: true },
  { key: 'lastRollbackVerifiedAt', label: 'Last Rollback Verified At', isDate: true },
  { key: 'lastReclassifyVerifiedAt', label: 'Last Reclassify Verified At', isDate: true },
  { key: 'lastBackfillVerifiedAt', label: 'Last Backfill Verified At', isDate: true },
  { key: 'lastSmokeVerifiedAt', label: 'Last Smoke Verified At', isDate: true },
  { key: 'lastRetirementReportPath', label: 'Last Retirement Report Path' },
]

function errorMessage(error: unknown, fallback = '操作失败') {
  if (!(error instanceof Error)) return fallback
  const message = error.message?.trim()
  if (!message) return fallback
  if (/failed to fetch|networkerror|load failed/i.test(message)) return fallback
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

function formatEvidenceValue(value: string | null, isDate = false): string {
  if (!value) return 'N/A'
  return isDate ? formatUtcDate(value) : value
}

export default function TaxonomyRolloutPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const canAccess = Boolean(session?.user && ALLOWED_ROLES.includes(session.user.role))

  const [policies, setPolicies] = useState<TaxonomyRolloutPolicyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedL1Code, setSelectedL1Code] = useState<string | null>(null)
  const [detail, setDetail] = useState<TaxonomyRolloutPolicyDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [filterState, setFilterState] = useState<string>('all')
  const [filterKillSwitch, setFilterKillSwitch] = useState<string>('all')
  const [filterFallback, setFilterFallback] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

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
        if (!cancelled) setPolicies(data)
      } catch (e) {
        if (!cancelled) setError(errorMessage(e, '加载 rollout policies 失败'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [canAccess, status])

  useEffect(() => {
    if (!selectedL1Code || status !== 'authenticated' || !canAccess) {
      setDetail(null)
      return
    }
    let cancelled = false
    async function loadDetail() {
      try {
        setDetailLoading(true)
        const data = await fetchRolloutPolicyByL1Code(selectedL1Code!)
        if (!cancelled) setDetail(data)
      } catch {
        if (!cancelled) setDetail(null)
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }
    void loadDetail()
    return () => {
      cancelled = true
    }
  }, [canAccess, selectedL1Code, status])

  const filteredPolicies = policies.filter((policy) => {
    if (filterState !== 'all' && policy.rolloutState !== filterState) return false
    if (filterKillSwitch === 'enabled' && !policy.killSwitchEnabled) return false
    if (filterKillSwitch === 'disabled' && policy.killSwitchEnabled) return false
    if (filterFallback === 'enabled' && !policy.allowLegacyFallback) return false
    if (filterFallback === 'disabled' && policy.allowLegacyFallback) return false
    if (searchQuery && !policy.l1Code.toLowerCase().includes(searchQuery.toLowerCase()))
      return false
    return true
  })

  useEffect(() => {
    if (selectedL1Code && !filteredPolicies.some((policy) => policy.l1Code === selectedL1Code)) {
      setSelectedL1Code(null)
    }
  }, [filteredPolicies, selectedL1Code])

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
                <h1 className="text-2xl font-bold text-[#1E3A5F]">无权访问 Taxonomy Rollout</h1>
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
              <GitBranch className="h-6 w-6 text-[#1E3A5F]" />
              <h1 className="text-3xl font-bold text-[#1E3A5F]">Taxonomy Rollout Overview</h1>
            </div>
            <p className="mt-1 text-[#64748B]">
              IT01-IT08 domain rollout 状态、fallback 开关、版本和责任边界
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="outline" className="rounded-sm">
              <Link
                href={
                  selectedL1Code
                    ? `/admin/taxonomy-rollout/gates?l1Code=${selectedL1Code}`
                    : '/admin/taxonomy-rollout/gates'
                }
              >
                Open Gates Console
              </Link>
            </Button>
            <Button
              variant="outline"
              className="rounded-sm"
              onClick={() => router.push('/admin/knowledge-graph')}
            >
              返回知识图谱总览
            </Button>
          </div>
        </div>

        <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
          <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1E3A5F]">Gate Promotion Console</p>
              <p className="mt-1 text-sm text-[#64748B]">
                前往独立 gates 子页评估 rollout readiness，并在 PASS 后执行 Promote。
              </p>
            </div>
            <Button
              className="rounded-sm bg-[#1E3A5F] text-white hover:bg-[#16304E]"
              onClick={() => router.push('/admin/taxonomy-rollout/gates')}
            >
              打开 Gates Console
            </Button>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive" className="rounded-sm">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索 domain code..."
              className="w-48 pl-9"
              aria-label="搜索 domain"
            />
          </div>
          <Select value={filterState} onValueChange={setFilterState}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Rollout State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="legacy-primary">Legacy Primary</SelectItem>
              <SelectItem value="it04-on-new-interface">IT04 on New Interface</SelectItem>
              <SelectItem value="domain-shadow">Domain Shadow</SelectItem>
              <SelectItem value="domain-compare">Domain Compare</SelectItem>
              <SelectItem value="domain-primary">Domain Primary</SelectItem>
              <SelectItem value="legacy-off">Legacy Off</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterKillSwitch} onValueChange={setFilterKillSwitch}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Kill Switch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Kill Switch: 全部</SelectItem>
              <SelectItem value="enabled">已启用</SelectItem>
              <SelectItem value="disabled">已禁用</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterFallback} onValueChange={setFilterFallback}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Legacy Fallback" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Fallback: 全部</SelectItem>
              <SelectItem value="enabled">允许</SelectItem>
              <SelectItem value="disabled">禁止</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Readiness Summary (AC#3) */}
        {!loading &&
          policies.length > 0 &&
          (() => {
            const readyCount = policies.filter((policy) => policy.stateAllowsPrimary).length
            const notReadyCount = policies.length - readyCount
            return (
              <div data-testid="readiness-summary" className="grid grid-cols-3 gap-4">
                <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
                  <CardContent className="flex flex-col items-center py-4">
                    <span
                      className="text-2xl font-bold text-green-600"
                      data-testid="readiness-ready-count"
                    >
                      {readyCount}
                    </span>
                    <span className="text-xs text-[#64748B]">Ready (PRIMARY_CHAIN)</span>
                  </CardContent>
                </Card>
                <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
                  <CardContent className="flex flex-col items-center py-4">
                    <span
                      className="text-2xl font-bold text-amber-600"
                      data-testid="readiness-not-ready-count"
                    >
                      {notReadyCount}
                    </span>
                    <span className="text-xs text-[#64748B]">Not Ready</span>
                  </CardContent>
                </Card>
                <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
                  <CardContent className="flex flex-col items-center py-4">
                    <span
                      className="text-2xl font-bold text-[#1E3A5F]"
                      data-testid="readiness-total-count"
                    >
                      {policies.length}
                    </span>
                    <span className="text-xs text-[#64748B]">Total Domains</span>
                  </CardContent>
                </Card>
              </div>
            )
          })()}

        <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
          <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-[#1E3A5F]">
                Domain Policies
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-[#1E3A5F]" />
                </div>
              ) : filteredPolicies.length === 0 ? (
                <div className="rounded-sm border border-dashed border-[#CBD5E1] px-4 py-6 text-center text-sm text-[#64748B]">
                  {searchQuery ||
                  filterState !== 'all' ||
                  filterKillSwitch !== 'all' ||
                  filterFallback !== 'all'
                    ? '未找到匹配的 domain policies'
                    : '暂无 domain policies 数据'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>L1 Code</TableHead>
                      <TableHead>Rollout State</TableHead>
                      <TableHead>Kill Switch</TableHead>
                      <TableHead>Fallback</TableHead>
                      <TableHead>Threshold</TableHead>
                      <TableHead>Shadow Window</TableHead>
                      <TableHead>State Changed</TableHead>
                      <TableHead>Version</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPolicies.map((policy) => (
                      <TableRow
                        key={policy.l1Code}
                        className={`cursor-pointer ${selectedL1Code === policy.l1Code ? 'bg-blue-50' : ''}`}
                        onClick={() => setSelectedL1Code(policy.l1Code)}
                      >
                        <TableCell className="font-mono font-semibold">{policy.l1Code}</TableCell>
                        <TableCell>
                          <Badge className={ROLLOUT_STATE_COLORS[policy.rolloutState]}>
                            {ROLLOUT_STATE_LABELS[policy.rolloutState]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={policy.killSwitchEnabled ? 'destructive' : 'secondary'}>
                            {policy.killSwitchEnabled ? '已启用' : '已禁用'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={policy.allowLegacyFallback ? 'default' : 'outline'}>
                            {policy.allowLegacyFallback ? '允许' : '禁止'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {policy.primaryThreshold.toFixed(2)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {policy.shadowWindowDays}d
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatUtcDate(policy.stateChangedAt)}
                        </TableCell>
                        <TableCell className="text-xs text-[#64748B]">
                          {policy.activeClassifierVersion || 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Detail Panel */}
          <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-[#1E3A5F]">
                {selectedL1Code ? `${selectedL1Code} 详情` : '选择 Domain 查看详情'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedL1Code ? (
                <p className="text-sm text-[#64748B]">点击左侧表格中的 domain 查看详细信息</p>
              ) : detailLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-[#1E3A5F]" />
                </div>
              ) : !detail ? (
                <p className="text-sm text-[#64748B]">无法加载详情</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-[#1E3A5F]">Readiness 摘要</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">当前状态</span>
                        <Badge className={ROLLOUT_STATE_COLORS[detail.rolloutState]}>
                          {ROLLOUT_STATE_LABELS[detail.rolloutState]}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">最近状态变更</span>
                        <span>{formatUtcDate(detail.stateChangedAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">PRIMARY_CHAIN</span>
                        <Badge variant={detail.stateAllowsPrimary ? 'default' : 'secondary'}>
                          {detail.stateAllowsPrimary ? '允许' : '不允许'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">LEGACY_FALLBACK</span>
                        <Badge variant={detail.stateAllowsLegacyFallback ? 'default' : 'outline'}>
                          {detail.stateAllowsLegacyFallback ? '允许' : '禁止'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Evidence 存在</span>
                        <Badge variant={detail.hasRetirementEvidence ? 'default' : 'secondary'}>
                          {detail.hasRetirementEvidence ? '有' : '无'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-[#1E3A5F]">Ownership</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Mapping Owner</span>
                        <span>{detail.mappingOwner}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Rulebook Owner</span>
                        <span>{detail.rulebookOwner}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Benchmark Owner</span>
                        <span>{detail.benchmarkOwner}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Gate Approver</span>
                        <span>{detail.gateApprover}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Rollback Approver</span>
                        <span>{detail.rollbackApprover}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-[#1E3A5F]">Thresholds</h3>
                    <div className="space-y-1 text-xs font-mono text-[#64748B]">
                      <div>Cutover: {JSON.stringify(detail.cutoverThresholdsJson)}</div>
                      <div>Retirement: {JSON.stringify(detail.retirementThresholdsJson)}</div>
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-[#1E3A5F]">
                      Retirement Evidence
                    </h3>
                    <div className="space-y-1 text-xs font-mono text-[#64748B]">
                      {EVIDENCE_FIELDS.map((field) => (
                        <div key={field.key} className="flex justify-between gap-4">
                          <span>{field.label}</span>
                          <span>
                            {formatEvidenceValue(
                              detail.retirementEvidenceJson[field.key],
                              field.isDate
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
