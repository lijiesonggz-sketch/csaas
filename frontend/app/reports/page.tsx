'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowRight,
  FileText,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import MainLayout from '@/components/layout/MainLayout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  getReportCenter,
  type ReportCenterItem,
  type ReportCenterResponse,
  type ReportCenterStatus,
} from '@/lib/api/report-center'

const STATUS_LABELS: Record<
  ReportCenterStatus,
  { label: string; className: string; actionLabel: string }
> = {
  not_ready: {
    label: '未就绪',
    className: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
    actionLabel: '报告未就绪',
  },
  ready_to_generate: {
    label: '可生成',
    className: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
    actionLabel: '等待生成',
  },
  generating: {
    label: '生成中',
    className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    actionLabel: '生成中',
  },
  ready: {
    label: '可查看',
    className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
    actionLabel: '查看报告',
  },
  failed: {
    label: '生成失败',
    className: 'bg-red-100 text-red-800 hover:bg-red-100',
    actionLabel: '查看失败原因',
  },
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '暂无'
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  })
}

function getProjectStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return '进行中'
    case 'completed':
      return '已完成'
    case 'archived':
      return '已归档'
    case 'draft':
      return '待启动'
    default:
      return status
  }
}

export default function ReportsPage() {
  const router = useRouter()
  const [reportCenter, setReportCenter] = useState<ReportCenterResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectFilter, setProjectFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | ReportCenterStatus>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadReportCenter = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await getReportCenter({
          projectId: projectFilter === 'all' ? undefined : projectFilter,
          status: statusFilter === 'all' ? undefined : [statusFilter],
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          sortBy: 'updatedAt',
          sortOrder: 'desc',
        })

        if (!cancelled) {
          setReportCenter(response)
        }
      } catch (loadError) {
        if (!cancelled) {
          const message =
            loadError instanceof Error ? loadError.message : '加载报告中心失败，请稍后重试'
          setError(message)
          setReportCenter(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadReportCenter()

    return () => {
      cancelled = true
    }
  }, [dateFrom, dateTo, projectFilter, statusFilter])

  const items = reportCenter?.items ?? []

  return (
    <MainLayout>
      <div className="w-full px-6 py-8 bg-[#FEFDFB] min-h-screen">
        <Card className="mb-6 overflow-hidden border border-[#E2E8F0] shadow-sm rounded-sm">
          <div className="bg-[#1E3A5F] p-6 text-white">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-white/10">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold font-[var(--font-plus-jakarta)]">报告中心</h1>
                  <p className="text-sm text-white/80 font-[var(--font-inter)]">
                    统一查看各项目的报告状态、风险摘要和差距重点
                  </p>
                </div>
              </div>
              <Button
                className="bg-white text-[#1E3A5F] hover:bg-white/90 rounded-sm"
                onClick={() => {
                  setProjectFilter('all')
                  setStatusFilter('all')
                  setDateFrom('')
                  setDateTo('')
                }}
              >
                重置筛选
              </Button>
            </div>
          </div>
        </Card>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="border border-[#E2E8F0] shadow-sm rounded-sm">
            <CardContent className="p-4">
              <p className="text-sm text-[#94A3B8]">项目总数</p>
              <p className="mt-2 text-2xl font-semibold text-[#1E3A5F]">
                {reportCenter?.summary.totalItems ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card className="border border-[#E2E8F0] shadow-sm rounded-sm">
            <CardContent className="p-4">
              <p className="text-sm text-[#94A3B8]">可查看</p>
              <p className="mt-2 text-2xl font-semibold text-[#059669]">
                {reportCenter?.summary.readyCount ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card className="border border-[#E2E8F0] shadow-sm rounded-sm">
            <CardContent className="p-4">
              <p className="text-sm text-[#94A3B8]">未就绪</p>
              <p className="mt-2 text-2xl font-semibold text-[#94A3B8]">
                {reportCenter?.summary.notReadyCount ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card className="border border-[#E2E8F0] shadow-sm rounded-sm">
            <CardContent className="p-4">
              <p className="text-sm text-[#94A3B8]">失败项</p>
              <p className="mt-2 text-2xl font-semibold text-red-600">
                {reportCenter?.summary.failedCount ?? 0}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 border-0 shadow-sm">
          <CardHeader>
            <CardTitle>筛选条件</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <label className="flex flex-col gap-2 text-sm text-slate-600">
                <span>项目筛选</span>
                <select
                  aria-label="项目筛选"
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={projectFilter}
                  onChange={(event) => setProjectFilter(event.target.value)}
                >
                  <option value="all">全部项目</option>
                  {items.map((item) => (
                    <option key={item.projectId} value={item.projectId}>
                      {item.projectName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-600">
                <span>状态筛选</span>
                <select
                  aria-label="状态筛选"
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as 'all' | ReportCenterStatus)
                  }
                >
                  <option value="all">全部状态</option>
                  <option value="ready">可查看</option>
                  <option value="not_ready">未就绪</option>
                  <option value="failed">生成失败</option>
                  <option value="ready_to_generate">可生成</option>
                  <option value="generating">生成中</option>
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-600">
                <span>开始日期</span>
                <Input
                  aria-label="开始日期"
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-600">
                <span>结束日期</span>
                <Input
                  aria-label="结束日期"
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-4">
              <RefreshCw className="h-8 w-8 animate-spin text-teal-700" />
              <p className="text-sm text-slate-500">正在加载报告中心...</p>
            </CardContent>
          </Card>
        ) : null}

        {!loading && error ? (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>加载失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-4 text-center">
              <FileText className="h-10 w-10 text-slate-300" />
              <div>
                <p className="text-lg font-semibold text-slate-900">暂无报告项目</p>
                <p className="mt-2 text-sm text-slate-500">
                  当前筛选条件下还没有可展示的报告条目。
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {items.map((item) => {
              const statusMeta = STATUS_LABELS[item.reportStatus]

              return (
                <Card
                  key={item.projectId}
                  className="border-0 shadow-sm transition-all duration-200 hover:shadow-md"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">{item.projectName}</h2>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
                          <Badge variant="outline">
                            {getProjectStatusLabel(item.projectSummary.projectStatus)}
                          </Badge>
                          {item.projectSummary.standardName ? (
                            <Badge variant="outline">{item.projectSummary.standardName}</Badge>
                          ) : null}
                        </div>
                      </div>

                      <Button
                        data-testid={`report-view-${item.projectId}`}
                        disabled={!item.availableActions.viewReport || !item.reportId}
                        onClick={() => {
                          if (item.reportId) {
                            router.push(`/reports/${item.reportId}`)
                          }
                        }}
                      >
                        {statusMeta.actionLabel}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">项目摘要</p>
                        <div className="mt-3 space-y-2 text-sm text-slate-600">
                          <p>客户：{item.projectSummary.clientName ?? '未填写'}</p>
                          <p>标准：{item.projectSummary.standardName ?? '未设置'}</p>
                          <p>更新时间：{formatDateTime(item.updatedAt)}</p>
                          <p>最新报告时间：{formatDateTime(item.generatedAt)}</p>
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">差距摘要</p>
                        <div className="mt-3 space-y-2 text-sm text-slate-600">
                          <p>
                            总体成熟度：
                            {item.gapSummary.overallMaturity !== null
                              ? `${item.gapSummary.overallMaturity.toFixed(2)} / 5`
                              : '暂无'}
                          </p>
                          <p>等级：{item.gapSummary.overallGrade ?? '暂无'}</p>
                          <p>
                            重点短板：
                            {item.gapSummary.topShortcomings.length > 0
                              ? item.gapSummary.topShortcomings
                                  .map((shortcoming) => shortcoming.clusterName)
                                  .join('、')
                              : '暂无'}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-4 md:col-span-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          <ShieldAlert className="h-4 w-4 text-amber-600" />
                          风险摘要
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-slate-600">
                          <p>冲突严重度：{item.riskSummary.conflictSeverity}</p>
                          <p>冲突数量：{item.riskSummary.conflictCount}</p>
                          <p>
                            风险聚焦：
                            {item.riskSummary.topRiskClusters.length > 0
                              ? item.riskSummary.topRiskClusters.join('、')
                              : '暂无'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {item.emptyStateReason ? (
                      <Alert className="mt-4 border-slate-200 bg-slate-50">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>当前项目暂无可读报告</AlertTitle>
                        <AlertDescription>{item.emptyStateReason}</AlertDescription>
                      </Alert>
                    ) : null}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : null}
      </div>
    </MainLayout>
  )
}
