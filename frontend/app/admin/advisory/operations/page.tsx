'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
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
import {
  AdvisoryOperationsUsageFilters,
  AdvisoryOperationsUsageView,
  AdvisoryOperationsWorkflowUsage,
  fetchAdvisoryOperationsUsage,
} from '@/lib/advisory/operations'

const DEFAULT_FILTERS = {
  tenantId: 'current',
  dateFrom: '',
  dateTo: '',
  workflowType: 'all',
}

export default function AdvisoryOperationsPage() {
  const [dashboard, setDashboard] = useState<AdvisoryOperationsUsageView | null>(null)
  const [filters, setFilters] = useState<Required<AdvisoryOperationsUsageFilters>>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedWorkflow, setSelectedWorkflow] =
    useState<AdvisoryOperationsWorkflowUsage | null>(null)

  useEffect(() => {
    void loadUsage({}, true)
  }, [])

  const tenantOptions = dashboard?.filters.tenants ?? [{ id: filters.tenantId, name: filters.tenantId }]
  const workflowOptions = dashboard?.filters.workflowTypes ?? [{ key: 'all', label: 'All workflows' }]
  const unavailable = dashboard?.freshness.status === 'unavailable'
  const delayed = dashboard?.freshness.status === 'delayed'
  const metrics = dashboard?.metrics ?? null

  const lowCompletionCount = useMemo(
    () => dashboard?.workflowUsage.filter((workflow) => workflow.lowCompletion).length ?? 0,
    [dashboard],
  )

  async function loadUsage(nextFilters: AdvisoryOperationsUsageFilters, initial = false) {
    if (initial) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const loaded = await fetchAdvisoryOperationsUsage(nextFilters)
      setDashboard(loaded)
      setFilters(loaded.filters.selected)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Usage data unavailable. No trusted measurements are available.',
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  function updateFilter(key: keyof Required<AdvisoryOperationsUsageFilters>, value: string) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function applyFilters() {
    void loadUsage(filters)
  }

  if (loading) {
    return (
      <section className="bg-slate-50 px-6 py-8">
        <div role="status" className="flex items-center gap-3 text-sm font-medium text-slate-700">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          <span>Loading ThinkTank operations</span>
        </div>
      </section>
    )
  }

  return (
    <section className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-emerald-600" />
              <h1 className="text-2xl font-semibold">ThinkTank Operations</h1>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Aggregated usage, completion, freshness, and instrumentation health.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={applyFilters} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>

        {(error || unavailable) && (
          <Alert variant="destructive" role="alert">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error ??
                `Telemetry unavailable. ${
                  dashboard?.freshness.description ?? 'No trusted measurements are available; try again.'
                }`}
            </AlertDescription>
          </Alert>
        )}

        {delayed && (
          <Alert role="alert" className="border-amber-200 bg-amber-50 text-amber-900">
            <Clock3 className="h-4 w-4" />
            <AlertDescription>
              Delayed telemetry. Metrics are stale until the audit log stream catches up.
            </AlertDescription>
          </Alert>
        )}

        <Card variant="outlined" className="bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-[1fr_160px_160px_1fr_auto] md:items-end">
              <div className="space-y-1">
                <Label htmlFor="operations-tenant">Tenant</Label>
                <Select
                  value={filters.tenantId}
                  onValueChange={(value) => updateFilter('tenantId', value)}
                >
                  <SelectTrigger id="operations-tenant" aria-label="Tenant">
                    <SelectValue placeholder="Tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenantOptions.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id ?? 'current'}>
                        {tenant.name ?? tenant.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="operations-date-from">Date from</Label>
                <Input
                  id="operations-date-from"
                  type="date"
                  value={filters.dateFrom}
                  onChange={(event) => updateFilter('dateFrom', event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="operations-date-to">Date to</Label>
                <Input
                  id="operations-date-to"
                  type="date"
                  value={filters.dateTo}
                  onChange={(event) => updateFilter('dateTo', event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="operations-workflow-type">Workflow type</Label>
                <Select
                  value={filters.workflowType}
                  onValueChange={(value) => updateFilter('workflowType', value)}
                >
                  <SelectTrigger id="operations-workflow-type" aria-label="Workflow type">
                    <SelectValue placeholder="Workflow type" />
                  </SelectTrigger>
                  <SelectContent>
                    {workflowOptions.map((workflow) => (
                      <SelectItem key={workflow.key} value={workflow.key ?? 'all'}>
                        {workflow.label ?? workflow.key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" onClick={applyFilters} disabled={refreshing}>
                <Search className="mr-2 h-4 w-4" />
                Apply filters
              </Button>
            </div>
          </CardContent>
        </Card>

        <section role="region" aria-label="Data freshness">
          <Card variant="outlined" className="bg-white">
            <CardContent className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium">Data freshness</p>
                <p className="mt-1 text-sm text-slate-600">
                  {dashboard?.freshness.description ?? 'No freshness information is available.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={freshnessBadgeVariant(dashboard?.freshness.status)}>
                  {freshnessLabel(dashboard?.freshness.status)}
                </Badge>
                <span className="text-xs text-slate-500">
                  {dashboard?.freshness.latestEventAt
                    ? `last event ${formatDateTime(dashboard.freshness.latestEventAt)}`
                    : 'last event unavailable'}
                </span>
              </div>
            </CardContent>
          </Card>
        </section>

        <section role="region" aria-label="Usage metrics">
          {metrics ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <MetricCard label="Quick Consult volume" value={metrics.quickConsultVolume} />
              <MetricCard
                label="Structured workflow starts"
                value={metrics.structuredWorkflowStarts}
              />
              <MetricCard label="Completions" value={metrics.completions} />
              <MetricCard label="Incomplete sessions" value={metrics.incompleteSessions} />
              <MetricCard label="Completion rate" value={formatPercent(metrics.completionRate)} />
              <MetricCard label="Party Mode usage" value={metrics.partyModeUsage} />
            </div>
          ) : (
            <Card variant="outlined" className="bg-white">
              <CardContent className="py-5 text-sm text-slate-600">
                No trusted measurements are available for this filter set.
              </CardContent>
            </Card>
          )}
        </section>

        <Card variant="outlined" className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Workflow completion</CardTitle>
            <Badge variant={lowCompletionCount > 0 ? 'warning' : 'success'}>
              {lowCompletionCount} low completion
            </Badge>
          </CardHeader>
          <CardContent>
            <Table aria-label="Workflow completion">
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Trend period</TableHead>
                  <TableHead className="text-right">Starts</TableHead>
                  <TableHead className="text-right">Completions</TableHead>
                  <TableHead className="text-right">Incomplete</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard?.workflowUsage.length ? (
                  dashboard.workflowUsage.map((workflow) => (
                    <TableRow key={workflow.workflowKey}>
                      <TableCell className="font-medium">{workflow.workflowLabel}</TableCell>
                      <TableCell>{workflow.trendPeriod}</TableCell>
                      <TableCell className="text-right">{workflow.starts}</TableCell>
                      <TableCell className="text-right">{workflow.completions}</TableCell>
                      <TableCell className="text-right">{workflow.incompleteSessions}</TableCell>
                      <TableCell className="text-right">
                        {formatPercent(workflow.completionRate)}
                      </TableCell>
                      <TableCell>
                        {workflow.lowCompletion ? (
                          <Badge variant="warning">Low completion</Badge>
                        ) : (
                          <Badge variant="success">Healthy</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedWorkflow(workflow)}
                        >
                          Drill down
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="py-6 text-center text-sm text-slate-500">
                      No trusted workflow measurements are available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <section role="region" aria-label="Instrumentation gaps">
          <Card variant="outlined" className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Instrumentation gaps</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard?.instrumentationGaps.length ? (
                <div className="space-y-2">
                  {dashboard.instrumentationGaps.map((gap, index) => (
                    <div
                      key={`${gap.reason}-${gap.eventName ?? index}`}
                      className="flex flex-col gap-1 rounded-sm border border-slate-200 px-3 py-2 text-sm md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-medium">{humanizeGapReason(gap.reason)}</p>
                        <p className="text-slate-600">
                          {gap.eventName ?? 'event unavailable'} · {gap.owningArea}
                        </p>
                      </div>
                      <Badge variant="outline">{gap.count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">No instrumentation gaps detected.</p>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      <Dialog open={Boolean(selectedWorkflow)} onOpenChange={(open) => !open && setSelectedWorkflow(null)}>
        <DialogContent
          role="dialog"
          aria-label={
            selectedWorkflow
              ? `${selectedWorkflow.workflowLabel} completion drilldown`
              : 'Workflow completion drilldown'
          }
        >
          <DialogHeader>
            <DialogTitle>
              {selectedWorkflow?.workflowLabel ?? 'Workflow'} completion drilldown
            </DialogTitle>
          </DialogHeader>
          {selectedWorkflow && (
            <div className="space-y-4">
              <p className="text-sm font-medium">Aggregated counts</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label="Starts" value={selectedWorkflow.drilldown.starts} />
                <MetricCard label="Completions" value={selectedWorkflow.drilldown.completions} />
                <MetricCard
                  label="Start failures"
                  value={selectedWorkflow.drilldown.startFailures}
                />
                <MetricCard
                  label="Incomplete sessions"
                  value={selectedWorkflow.drilldown.incompleteSessions}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card variant="outlined" className="bg-white">
      <CardContent className="py-4">
        <p className="text-xs font-medium uppercase tracking-normal text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  )
}

function freshnessLabel(status: string | undefined) {
  if (status === 'fresh') return 'Fresh'
  if (status === 'delayed') return 'Delayed'
  return 'Unavailable'
}

function freshnessBadgeVariant(status: string | undefined) {
  if (status === 'fresh') return 'success'
  if (status === 'delayed') return 'warning'
  return 'destructive'
}

function formatPercent(value: number | null) {
  if (value === null) return '-'
  return `${Math.round(value * 10) / 10}%`
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString().slice(0, 16).replace('T', ' ')
}

function humanizeGapReason(reason: string) {
  if (reason === 'event_version_mismatch' || reason === 'wrong_event_version') {
    return 'wrong event version'
  }
  return reason.replace(/_/g, ' ')
}
