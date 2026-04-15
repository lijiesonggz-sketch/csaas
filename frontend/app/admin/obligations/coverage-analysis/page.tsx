'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Loader2,
  PieChart as PieChartIcon,
  RefreshCw,
  ShieldAlert,
  Table2,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  type ApplicableSector,
  type ObligationCoverageAnalysis,
  type ObligationCoverageBlindSpot,
  type ObligationType,
  getObligationCoverageAnalysis,
} from '@/lib/api/obligations'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

const ALLOWED_ROLES = ['admin']
const OBLIGATION_TYPE_OPTIONS: Array<ObligationType | 'all'> = [
  'all',
  'MANDATORY',
  'PROHIBITIVE',
  'RECOMMENDED',
]
const INDUSTRY_OPTIONS: ApplicableSector[] = ['银行', '证券', '保险', '基金', '期货']
const OVERVIEW_COLORS = ['#1E3A5F', '#D97706']
const ORIGIN_LABELS: Record<string, string> = {
  case_derived: '案例驱动',
  regulation_derived: '法规驱动',
  both: '双源映射',
  candidate: '候选控制',
  manual: '人工维护',
}

function errorMessage(error: unknown, fallback = '加载覆盖率分析失败') {
  return error instanceof Error && error.message ? error.message : fallback
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(value === 0 || value === 1 ? 0 : 1)}%`
}

function matchesSector(applicableSector: ApplicableSector[], sector: ApplicableSector) {
  return (
    applicableSector.length === 0 ||
    applicableSector.includes(sector) ||
    applicableSector.includes('通用')
  )
}

function MetricCard({
  title,
  value,
  description,
}: {
  title: string
  value: string
  description: string
}) {
  return (
    <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
      <CardContent className="space-y-2 p-5">
        <div className="text-sm font-medium text-[#64748B]">{title}</div>
        <div className="text-3xl font-bold text-[#1E3A5F]">{value}</div>
        <div className="text-xs text-[#94A3B8]">{description}</div>
      </CardContent>
    </Card>
  )
}

export default function ObligationCoverageAnalysisPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const canAccess = Boolean(session?.user && ALLOWED_ROLES.includes(session.user.role))

  const [data, setData] = useState<ObligationCoverageAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const hasLoadedOnce = useRef(false)
  const [obligationTypeFilter, setObligationTypeFilter] = useState<ObligationType | 'all'>('all')
  const [sectorFilter, setSectorFilter] = useState<ApplicableSector | 'all'>('all')
  const [selectedSector, setSelectedSector] = useState<ApplicableSector | 'all'>('all')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [router, status])

  useEffect(() => {
    if (status !== 'authenticated' || !canAccess) return

    let cancelled = false

    async function loadCoverageAnalysis() {
      try {
        if (hasLoadedOnce.current) {
          setRefreshing(true)
        } else {
          setLoading(true)
        }
        setError(null)
        const result = await getObligationCoverageAnalysis()
        if (cancelled) return
        hasLoadedOnce.current = true
        setData(result)
      } catch (loadError) {
        if (!cancelled) {
          setError(errorMessage(loadError))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    void loadCoverageAnalysis()

    return () => {
      cancelled = true
    }
  }, [canAccess, reloadToken, status])

  const filteredBlindSpots = useMemo(() => {
    const blindSpots = data?.blindSpots ?? []

    return blindSpots.filter((item) => {
      if (obligationTypeFilter !== 'all' && item.obligationType !== obligationTypeFilter) {
        return false
      }
      if (
        sectorFilter !== 'all' &&
        !matchesSector(item.applicableSector ?? [], sectorFilter)
      ) {
        return false
      }
      if (
        selectedSector !== 'all' &&
        !matchesSector(item.applicableSector ?? [], selectedSector)
      ) {
        return false
      }
      return true
    })
  }, [data, obligationTypeFilter, sectorFilter, selectedSector])

  const overviewChartData = useMemo(
    () => [
      { name: '已覆盖', value: data?.totals?.covered ?? 0, fill: OVERVIEW_COLORS[0] },
      { name: '未覆盖', value: data?.totals?.uncovered ?? 0, fill: OVERVIEW_COLORS[1] },
    ],
    [data],
  )

  const originChartData = useMemo(
    () =>
      Object.entries(data?.originDistribution ?? {}).map(([key, value]) => ({
        key,
        label: ORIGIN_LABELS[key] ?? key,
        value,
      })),
    [data],
  )

  const industryCoverageData = useMemo(
    () => (data?.sectorCoverage ?? []).filter((item) => item.sector !== '通用'),
    [data],
  )

  function handleBlindSpotClick(blindSpot: ObligationCoverageBlindSpot) {
    router.push(`/admin/obligations?obligationId=${blindSpot.obligationId}`)
  }

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-[#FEFDFB] p-6">
        <div className="mx-auto max-w-3xl pt-24">
          <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <ShieldAlert className="h-12 w-12 text-amber-600" />
              <div>
                <h1 className="text-2xl font-bold text-[#1E3A5F]">无权访问覆盖率分析</h1>
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

  if (status === 'loading' || status === 'unauthenticated' || (loading && !data && !error)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FEFDFB]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E3A5F]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FEFDFB] px-6 py-16">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <Button
              variant="outline"
              className="rounded-sm"
              onClick={() => router.push('/admin/obligations')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回 Obligation 管理
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-[#1E3A5F]">覆盖率分析</h1>
              <p className="mt-1 text-[#64748B]">
                查看法规义务覆盖率、来源结构和行业对比，快速识别当前合规盲区。
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            className="rounded-sm"
            onClick={() => setReloadToken((current) => current + 1)}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            刷新
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="rounded-sm">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="总义务数"
            value={String(data?.totals?.obligations ?? 0)}
            description="当前 coverage-analysis contract 返回的全部法规义务数量"
          />
          <MetricCard
            title="已覆盖"
            value={String(data?.totals?.covered ?? 0)}
            description="已有至少一个控制点映射的法规义务"
          />
          <MetricCard
            title="未覆盖"
            value={String(data?.totals?.uncovered ?? 0)}
            description="当前仍没有 control point 映射的法规义务"
          />
          <MetricCard
            title="覆盖率"
            value={formatPercent(data?.totals?.coverageRate ?? 0)}
            description="保持 ratio 语义，由前端统一格式化为百分比"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
          <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-[#1E3A5F]" />
                <div>
                  <h2 className="font-semibold text-[#1E3A5F]">覆盖率总览</h2>
                  <p className="text-sm text-[#64748B]">已覆盖 vs 未覆盖义务占比</p>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="h-[280px] min-h-[280px]">
                  {(data?.totals?.obligations ?? 0) === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-[#64748B]">
                      暂无义务数据，无法生成覆盖率图表。
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={overviewChartData}
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          dataKey="value"
                          nameKey="name"
                        >
                          {overviewChartData.map((item) => (
                            <Cell key={item.name} fill={item.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="rounded-sm border border-[#E2E8F0] bg-white p-4">
                    <div className="text-sm text-[#64748B]">当前覆盖率</div>
                    <div className="mt-1 text-2xl font-bold text-[#1E3A5F]">
                      {formatPercent(data?.totals?.coverageRate ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-sm border border-[#E2E8F0] bg-white p-4 text-sm text-[#475569]">
                    {data?.totals?.uncovered === 0
                      ? '当前没有未覆盖义务，看板进入全覆盖状态。'
                      : `当前仍有 ${data?.totals?.uncovered ?? 0} 条义务未被控制点覆盖，建议优先查看下方合规盲区表格。`}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#1E3A5F]" />
                <div>
                  <h2 className="font-semibold text-[#1E3A5F]">来源分析</h2>
                  <p className="text-sm text-[#64748B]">按 control point originType 观察当前覆盖来源结构</p>
                </div>
              </div>
              <div className="h-[280px] min-h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={originChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#1E3A5F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {originChartData.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-sm border border-[#E2E8F0] px-3 py-2 text-sm"
                  >
                    <span className="text-[#475569]">{item.label}</span>
                    <span className="font-semibold text-[#1E3A5F]">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#1E3A5F]" />
                <div>
                  <h2 className="font-semibold text-[#1E3A5F]">行业覆盖</h2>
                  <p className="text-sm text-[#64748B]">比较银行、证券、保险、基金、期货的义务覆盖率差异</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={selectedSector === 'all' ? 'default' : 'outline'}
                  className="rounded-sm"
                  onClick={() => { setSelectedSector('all'); setSectorFilter('all') }}
                >
                  全部行业
                </Button>
                {INDUSTRY_OPTIONS.map((sector) => (
                  <Button
                    key={sector}
                    size="sm"
                    variant={selectedSector === sector ? 'default' : 'outline'}
                    className="rounded-sm"
                    onClick={() => { setSelectedSector(sector); setSectorFilter('all') }}
                  >
                    {sector}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
              <div className="h-[300px] min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={industryCoverageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="sector" tick={{ fill: '#64748B', fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="covered" fill="#1E3A5F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-sm border border-[#E2E8F0]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>行业</TableHead>
                      <TableHead>总义务</TableHead>
                      <TableHead>已覆盖</TableHead>
                      <TableHead>覆盖率</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {industryCoverageData.map((item) => (
                      <TableRow key={item.sector}>
                        <TableCell className="font-medium text-[#1E3A5F]">{item.sector}</TableCell>
                        <TableCell>{item.obligations}</TableCell>
                        <TableCell>{item.covered}</TableCell>
                        <TableCell>{formatPercent(item.coverageRate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-sm border-[#E2E8F0] shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex items-center gap-2">
                <Table2 className="h-5 w-5 text-[#1E3A5F]" />
                <div>
                  <h2 className="font-semibold text-[#1E3A5F]">合规盲区</h2>
                  <p className="text-sm text-[#64748B]">
                    当前展示：{selectedSector === 'all' ? '全部行业' : `${selectedSector} 行业`}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>义务类型</Label>
                  <Select
                    value={obligationTypeFilter}
                    onValueChange={(value) =>
                      setObligationTypeFilter(value as ObligationType | 'all')
                    }
                  >
                    <SelectTrigger aria-label="义务类型">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OBLIGATION_TYPE_OPTIONS.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item === 'all' ? '全部类型' : item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>适用行业</Label>
                  <Select
                    value={sectorFilter}
                    onValueChange={(value) => setSectorFilter(value as ApplicableSector | 'all')}
                  >
                    <SelectTrigger aria-label="适用行业">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部行业</SelectItem>
                      {INDUSTRY_OPTIONS.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="rounded-sm border border-[#E2E8F0]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>义务编码</TableHead>
                    <TableHead>义务摘要</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>法规来源</TableHead>
                    <TableHead>适用行业</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBlindSpots.length > 0 ? (
                    filteredBlindSpots.map((item) => (
                      <TableRow
                        key={item.obligationId}
                        className="cursor-pointer"
                        onClick={() => handleBlindSpotClick(item)}
                      >
                        <TableCell className="font-medium text-[#1E3A5F]">
                          {item.obligationCode}
                        </TableCell>
                        <TableCell className="max-w-[360px] truncate text-[#475569]" title={item.obligationText}>
                          {item.obligationText}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.obligationType}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-[#334155]">
                            {item.source?.sourceName ?? '未关联来源'}
                          </div>
                          <div className="text-xs text-[#94A3B8]">
                            {item.clause?.clauseCode ?? '无条文编码'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(item.applicableSector.length > 0 ? item.applicableSector : ['通用']).map(
                              (sector) => (
                                <Badge key={`${item.obligationId}-${sector}`} variant="outline">
                                  {sector}
                                </Badge>
                              ),
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-[#64748B]">
                        当前筛选条件下没有未覆盖义务。
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
