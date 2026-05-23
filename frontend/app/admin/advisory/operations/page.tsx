'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Clock3,
  Database,
  Gauge,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  AdvisoryGovernanceEventTypeGroup,
  AdvisoryGovernanceFilters,
  AdvisoryGovernanceGroup,
  AdvisoryGovernanceView,
  AdvisoryProviderTelemetryGroup,
  AdvisoryProviderTelemetryView,
  AdvisoryQualityFeedbackGroup,
  AdvisoryQualityFeedbackView,
  AdvisoryQualityLowQualityTrend,
  AdvisoryQualityRecommendationTypeGroup,
  AdvisoryOperationsUsageFilters,
  AdvisoryOperationsUsageView,
  AdvisoryOperationsWorkflowUsage,
  fetchAdvisoryOperationsUsage,
  fetchAdvisoryGovernanceReview,
  fetchAdvisoryProviderTelemetry,
  fetchAdvisoryQualityFeedback,
} from '@/lib/advisory/operations'

const DEFAULT_FILTERS = {
  tenantId: 'current',
  dateFrom: '',
  dateTo: '',
  workflowType: 'all',
}

const DEFAULT_GOVERNANCE_FILTERS = {
  actorId: '',
  eventType: 'all',
  outcome: 'all',
}

export default function AdvisoryOperationsPage() {
  const [dashboard, setDashboard] = useState<AdvisoryOperationsUsageView | null>(null)
  const [providerTelemetry, setProviderTelemetry] = useState<AdvisoryProviderTelemetryView | null>(
    null
  )
  const [qualityFeedback, setQualityFeedback] = useState<AdvisoryQualityFeedbackView | null>(null)
  const [governanceReview, setGovernanceReview] = useState<AdvisoryGovernanceView | null>(null)
  const [filters, setFilters] = useState<Required<AdvisoryOperationsUsageFilters>>(DEFAULT_FILTERS)
  const [governanceFilters, setGovernanceFilters] = useState(DEFAULT_GOVERNANCE_FILTERS)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [providerError, setProviderError] = useState<string | null>(null)
  const [qualityError, setQualityError] = useState<string | null>(null)
  const [governanceError, setGovernanceError] = useState<string | null>(null)
  const [selectedWorkflow, setSelectedWorkflow] = useState<AdvisoryOperationsWorkflowUsage | null>(
    null
  )

  useEffect(() => {
    void loadUsage({}, true)
  }, [])

  const tenantOptions = dashboard?.filters.tenants ?? [
    { id: filters.tenantId, name: filters.tenantId },
  ]
  const workflowOptions = dashboard?.filters.workflowTypes ?? [
    { key: 'all', label: 'All workflows' },
  ]
  const unavailable = dashboard?.freshness.status === 'unavailable'
  const delayed = dashboard?.freshness.status === 'delayed'
  const metrics = dashboard?.metrics ?? null
  const providerUnavailable = providerTelemetry?.freshness.status === 'unavailable'
  const providerDelayed = providerTelemetry?.freshness.status === 'delayed'
  const providerMetrics = providerTelemetry?.metrics ?? null
  const qualityUnavailable = qualityFeedback?.freshness.status === 'unavailable'
  const qualityDelayed = qualityFeedback?.freshness.status === 'delayed'
  const qualityMetrics = qualityFeedback?.metrics ?? null
  const governanceUnavailable = governanceReview?.freshness.status === 'unavailable'
  const governanceDelayed = governanceReview?.freshness.status === 'delayed'
  const governanceSourceUnavailable = Boolean(governanceError || governanceUnavailable)
  const governanceMetrics = governanceReview?.metrics ?? null
  const qualityDistribution = qualityFeedback?.ratingDistribution ?? {
    recommendation: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    report: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  }
  const providerGroups = useMemo(
    () => [
      ...(providerTelemetry?.byWorkflow ?? []),
      ...(providerTelemetry?.byExperience ?? []),
      ...(providerTelemetry?.byProvider ?? []),
    ],
    [providerTelemetry]
  )
  const qualityWarningCount = qualityFeedback?.lowQualityTrends.length ?? 0

  const lowCompletionCount = useMemo(
    () => dashboard?.workflowUsage.filter((workflow) => workflow.lowCompletion).length ?? 0,
    [dashboard]
  )

  async function loadUsage(nextFilters: AdvisoryOperationsUsageFilters, initial = false) {
    if (initial) setLoading(true)
    else setRefreshing(true)
    setError(null)
    setProviderError(null)
    setQualityError(null)
    setGovernanceError(null)

    try {
      let providerFilters = nextFilters
      const usageResult = await Promise.resolve(fetchAdvisoryOperationsUsage(nextFilters))
        .then((value) => ({ status: 'fulfilled' as const, value }))
        .catch((reason) => ({ status: 'rejected' as const, reason }))

      if (usageResult.status === 'fulfilled') {
        const loaded = usageResult.value
        setDashboard(loaded)
        setFilters(loaded.filters.selected)
        providerFilters = loaded.filters.selected
      } else {
        setError(
          usageResult.reason instanceof Error
            ? usageResult.reason.message
            : 'Usage data unavailable. No trusted measurements are available.'
        )
      }

      const providerResult = await Promise.resolve(
        fetchAdvisoryProviderTelemetry({
          ...providerFilters,
          groupBy: ['workflow', 'experience', 'provider'],
        })
      )
        .then((value) => ({ status: 'fulfilled' as const, value }))
        .catch((reason) => ({ status: 'rejected' as const, reason }))

      if (providerResult.status === 'fulfilled') {
        setProviderTelemetry(providerResult.value)
      } else {
        setProviderTelemetry(null)
        setProviderError(
          providerResult.reason instanceof Error
            ? providerResult.reason.message
            : 'Provider telemetry unavailable. No trusted measurements are available.'
        )
      }

      const qualityResult = await Promise.resolve(
        fetchAdvisoryQualityFeedback({
          ...providerFilters,
          recommendationType: 'all',
          groupBy: ['workflow', 'recommendationType'],
          timeBucket: 'day',
        })
      )
        .then((value) => ({ status: 'fulfilled' as const, value }))
        .catch((reason) => ({ status: 'rejected' as const, reason }))

      if (qualityResult.status === 'fulfilled') {
        setQualityFeedback(qualityResult.value)
      } else {
        setQualityFeedback(null)
        setQualityError(
          qualityResult.reason instanceof Error
            ? qualityResult.reason.message
            : 'Quality feedback unavailable. No trusted measurements are available.'
        )
      }

      const governanceResult = await Promise.resolve(
        fetchAdvisoryGovernanceReview({
          ...providerFilters,
          ...governanceFilters,
          groupBy: ['eventType', 'outcome', 'actor', 'workflow'],
        })
      )
        .then((value) => ({ status: 'fulfilled' as const, value }))
        .catch((reason) => ({ status: 'rejected' as const, reason }))

      if (governanceResult.status === 'fulfilled') {
        setGovernanceReview(governanceResult.value)
      } else {
        setGovernanceReview(null)
        setGovernanceError(
          governanceResult.reason instanceof Error
            ? governanceResult.reason.message
            : 'Governance review unavailable. No trusted measurements are available.'
        )
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function loadProviderTelemetryOnly(nextFilters: AdvisoryOperationsUsageFilters) {
    setProviderError(null)

    try {
      const loaded = await fetchAdvisoryProviderTelemetry({
        ...nextFilters,
        groupBy: ['workflow', 'experience', 'provider'],
      })
      setProviderTelemetry(loaded)
    } catch (loadError) {
      setProviderTelemetry(null)
      setProviderError(
        loadError instanceof Error
          ? loadError.message
          : 'Provider telemetry unavailable. No trusted measurements are available.'
      )
    }
  }

  async function loadQualityFeedbackOnly(nextFilters: AdvisoryOperationsUsageFilters) {
    setQualityError(null)

    try {
      const loaded = await fetchAdvisoryQualityFeedback({
        ...nextFilters,
        recommendationType: 'all',
        groupBy: ['workflow', 'recommendationType'],
        timeBucket: 'day',
      })
      setQualityFeedback(loaded)
    } catch (loadError) {
      setQualityFeedback(null)
      setQualityError(
        loadError instanceof Error
          ? loadError.message
          : 'Quality feedback unavailable. No trusted measurements are available.'
      )
    }
  }

  async function loadGovernanceOnly(
    nextFilters: AdvisoryOperationsUsageFilters,
    nextGovernanceFilters: Pick<AdvisoryGovernanceFilters, 'actorId' | 'eventType' | 'outcome'>
  ) {
    setGovernanceError(null)

    try {
      const loaded = await fetchAdvisoryGovernanceReview({
        ...nextFilters,
        ...nextGovernanceFilters,
        groupBy: ['eventType', 'outcome', 'actor', 'workflow'],
      })
      setGovernanceReview(loaded)
    } catch (loadError) {
      setGovernanceReview(null)
      setGovernanceError(
        loadError instanceof Error
          ? loadError.message
          : 'Governance review unavailable. No trusted measurements are available.'
      )
    }
  }

  async function loadUsageOnly(nextFilters: AdvisoryOperationsUsageFilters) {
    setError(null)

    try {
      const loaded = await fetchAdvisoryOperationsUsage(nextFilters)
      setDashboard(loaded)
      setFilters(loaded.filters.selected)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Usage data unavailable. No trusted measurements are available.'
      )
    }
  }

  function updateFilter(key: keyof Required<AdvisoryOperationsUsageFilters>, value: string) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function updateGovernanceFilter(key: keyof typeof DEFAULT_GOVERNANCE_FILTERS, value: string) {
    setGovernanceFilters((current) => ({ ...current, [key]: value }))
  }

  function applyFilters() {
    setRefreshing(true)
    Promise.allSettled([
      loadUsageOnly(filters),
      loadProviderTelemetryOnly(filters),
      loadQualityFeedbackOnly(filters),
      loadGovernanceOnly(filters, governanceFilters),
    ]).finally(() => setRefreshing(false))
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
                  dashboard?.freshness.description ??
                  'No trusted measurements are available; try again.'
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

        {(providerError || providerUnavailable) && (
          <Alert variant="destructive" role="alert" aria-label="Provider telemetry unavailable">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {providerError ??
                `Provider telemetry unavailable. ${
                  providerTelemetry?.freshness.description ??
                  'No trusted measurements are available; try again.'
                }`}
            </AlertDescription>
          </Alert>
        )}

        {providerDelayed && (
          <Alert
            role="alert"
            className="border-amber-200 bg-amber-50 text-amber-900"
            aria-label="Provider telemetry delayed"
          >
            <Clock3 className="h-4 w-4" />
            <AlertDescription>
              Delayed provider telemetry. Treat cost, latency, cache, and failure metrics as stale.
            </AlertDescription>
          </Alert>
        )}

        {(qualityError || qualityUnavailable) && (
          <Alert variant="destructive" role="alert" aria-label="Quality feedback unavailable">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {qualityError ??
                `Quality feedback unavailable. ${
                  qualityFeedback?.freshness.description ??
                  'No trusted measurements are available; try again.'
                }`}
            </AlertDescription>
          </Alert>
        )}

        {qualityDelayed && (
          <Alert
            role="alert"
            className="border-amber-200 bg-amber-50 text-amber-900"
            aria-label="Quality feedback delayed"
          >
            <Clock3 className="h-4 w-4" />
            <AlertDescription>
              Delayed quality feedback. Treat recommendation and report quality metrics as partial.
            </AlertDescription>
          </Alert>
        )}

        {(governanceError || governanceUnavailable) && (
          <Alert variant="destructive" role="alert" aria-label="Governance review unavailable">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {governanceError ??
                `Governance review unavailable. ${
                  governanceReview?.freshness.description ??
                  'No trusted measurements are available; try again.'
                }`}
            </AlertDescription>
          </Alert>
        )}

        {governanceDelayed && (
          <Alert
            role="alert"
            className="border-amber-200 bg-amber-50 text-amber-900"
            aria-label="Governance review delayed"
          >
            <Clock3 className="h-4 w-4" />
            <AlertDescription>
              Delayed governance review. Treat audit-derived governance summaries as partial.
            </AlertDescription>
          </Alert>
        )}

        <Card variant="outlined" className="bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_150px_150px_1fr_160px_180px_150px_auto] xl:items-end">
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
              <div className="space-y-1">
                <Label htmlFor="operations-governance-actor">Actor</Label>
                <Input
                  id="operations-governance-actor"
                  value={governanceFilters.actorId}
                  onChange={(event) => updateGovernanceFilter('actorId', event.target.value)}
                  placeholder="actor id"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="operations-governance-event-type">Event type</Label>
                <Select
                  value={governanceFilters.eventType}
                  onValueChange={(value) => updateGovernanceFilter('eventType', value)}
                >
                  <SelectTrigger id="operations-governance-event-type" aria-label="Event type">
                    <SelectValue placeholder="Event type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All events</SelectItem>
                    <SelectItem value="thinktank.output.exported">Exported output</SelectItem>
                    <SelectItem value="thinktank.access.denied">Access denied</SelectItem>
                    <SelectItem value="thinktank.workflow.completed">Workflow completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="operations-governance-outcome">Outcome</Label>
                <Select
                  value={governanceFilters.outcome}
                  onValueChange={(value) => updateGovernanceFilter('outcome', value)}
                >
                  <SelectTrigger id="operations-governance-outcome" aria-label="Outcome">
                    <SelectValue placeholder="Outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All outcomes</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="denied">Denied</SelectItem>
                    <SelectItem value="failure">Failure</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
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

        <section role="region" aria-label="Governance review">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Governance review</h2>
              <p className="text-sm text-slate-600">
                Audit-derived event summaries, AI label evidence, compliance issues, and
                instrumentation gaps.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={freshnessBadgeVariant(governanceReview?.freshness.status)}>
                {freshnessLabel(governanceReview?.freshness.status)}
              </Badge>
              <span className="text-xs text-slate-500">
                {governanceReview?.freshness.latestEventAt
                  ? `last governance event ${formatDateTime(governanceReview.freshness.latestEventAt)}`
                  : 'governance event unavailable'}
              </span>
            </div>
          </div>

          {governanceMetrics ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
                <MetricCard label="Trusted events" value={governanceMetrics.trustedEvents} />
                <MetricCard label="Total events" value={governanceMetrics.totalEvents} />
                <MetricCard label="Malformed events" value={governanceMetrics.malformedEvents} />
                <MetricCard label="Denied actions" value={governanceMetrics.deniedActions} />
                <MetricCard label="Exported outputs" value={governanceMetrics.exportedOutputs} />
                <MetricCard
                  label="Exports missing AI labels"
                  value={governanceMetrics.exportsMissingAiLabelMetadata}
                />
                <MetricCard
                  label="Compliance issues"
                  value={governanceMetrics.complianceIssueCount}
                />
              </div>
            </div>
          ) : (
            <Card variant="outlined" className="bg-white">
              <CardContent className="py-5 text-sm text-slate-600">
                No trusted governance measurements are available for this filter set.
              </CardContent>
            </Card>
          )}
        </section>

        <Card variant="outlined" className="bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Governance events by event type</CardTitle>
          </CardHeader>
          <CardContent>
            <Table aria-label="Governance events by event type">
              <TableHeader>
                <TableRow>
                  <TableHead>Event type</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Events</TableHead>
                  <TableHead className="text-right">Denied</TableHead>
                  <TableHead className="text-right">Failures</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {governanceReview?.byEventType.length ? (
                  governanceReview.byEventType.map((group) => (
                    <GovernanceEventTypeRow key={group.key} group={group} />
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-slate-500">
                      {governanceSourceUnavailable
                        ? 'Governance source unavailable. Event groups cannot be determined.'
                        : 'No trusted governance event groups are available.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-3 xl:grid-cols-3">
          <GovernanceGroupTable
            title="Governance by outcome"
            ariaLabel="Governance events by outcome"
            groups={governanceReview?.byOutcome ?? []}
            unavailable={governanceSourceUnavailable}
          />
          <GovernanceGroupTable
            title="Governance by actor"
            ariaLabel="Governance events grouped by principal"
            groups={governanceReview?.byActor ?? []}
            unavailable={governanceSourceUnavailable}
          />
          <GovernanceGroupTable
            title="Governance by workflow"
            ariaLabel="Governance events by workflow"
            groups={governanceReview?.byWorkflow ?? []}
            unavailable={governanceSourceUnavailable}
          />
        </div>

        <Card variant="outlined" className="bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Exported output AI labeling</CardTitle>
          </CardHeader>
          <CardContent>
            <Table aria-label="Exported output AI labeling">
              <TableHeader>
                <TableRow>
                  <TableHead>Output</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {governanceReview?.exportedOutputs.length ? (
                  governanceReview.exportedOutputs.map((output) => (
                    <TableRow key={output.outputId}>
                      <TableCell className="font-medium">{output.outputId}</TableCell>
                      <TableCell>{output.eventName}</TableCell>
                      <TableCell>
                        {output.aiLabelMetadataPresent ? (
                          <Badge variant="success">AI label metadata present</Badge>
                        ) : (
                          <Badge variant="warning">Missing AI label metadata</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="py-6 text-center text-sm text-slate-500">
                      {governanceSourceUnavailable
                        ? 'Governance source unavailable. Exported output evidence cannot be determined.'
                        : 'No exported output governance events are available.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <section role="region" aria-label="Governance compliance issues">
          <Card variant="outlined" className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Governance compliance issues</CardTitle>
            </CardHeader>
            <CardContent>
              {governanceReview?.complianceIssues.length ? (
                <div className="space-y-2">
                  {governanceReview.complianceIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-medium">{humanizeGapReason(issue.issueType)}</p>
                          <p className="mt-1 text-amber-900">{issue.message}</p>
                          <p className="mt-1 text-xs">
                            {issue.eventName ?? 'event unavailable'} · {issue.owningArea} ·{' '}
                            {issue.owningStory}
                          </p>
                        </div>
                        <Badge variant="warning">Compliance issue</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  {governanceSourceUnavailable
                    ? 'Governance source unavailable. Compliance issues cannot be determined.'
                    : 'No governance compliance issues detected.'}
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <section role="region" aria-label="Governance evidence gaps">
          <Card variant="outlined" className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Governance instrumentation gaps</CardTitle>
            </CardHeader>
            <CardContent>
              {governanceReview?.instrumentationGaps.length ? (
                <div className="space-y-2">
                  {governanceReview.instrumentationGaps.map((gap, index) => (
                    <div
                      key={`${gap.reason}-${gap.eventName ?? index}`}
                      className="flex flex-col gap-1 rounded-sm border border-slate-200 px-3 py-2 text-sm md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-medium">{humanizeGapReason(gap.reason)}</p>
                        <p className="text-slate-600">
                          {gap.eventName ?? 'event unavailable'} · {gap.owningArea} ·{' '}
                          {gap.owningStory}
                        </p>
                      </div>
                      <Badge variant="outline">{gap.count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  {governanceSourceUnavailable
                    ? 'Governance source unavailable. Instrumentation gaps cannot be determined.'
                    : 'No governance instrumentation gaps detected.'}
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <section role="region" aria-label="Quality feedback">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Quality feedback</h2>
              <p className="text-sm text-slate-600">
                Aggregate recommendation and report ratings by workflow, category, tenant, and
                selected date range.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={freshnessBadgeVariant(qualityFeedback?.freshness.status)}>
                {freshnessLabel(qualityFeedback?.freshness.status)}
              </Badge>
              <span className="text-xs text-slate-500">
                {qualityFeedback?.freshness.latestEventAt
                  ? `last quality event ${formatDateTime(qualityFeedback.freshness.latestEventAt)}`
                  : 'quality event unavailable'}
              </span>
            </div>
          </div>
          {qualityMetrics ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <MetricCard
                  label="Average rating"
                  value={formatRating(qualityMetrics.averageRating)}
                />
                <MetricCard
                  label="Low-rating rate"
                  value={formatPercent(qualityMetrics.lowRatingRate)}
                />
                <MetricCard label="Sample size" value={qualityMetrics.totalRatings} />
                <MetricCard
                  label="Recommendation ratings"
                  value={`${qualityMetrics.recommendationRatingCount} / ${formatRating(
                    qualityMetrics.recommendationAverageRating
                  )}`}
                />
                <MetricCard
                  label="Report ratings"
                  value={`${qualityMetrics.reportRatingCount} / ${formatRating(
                    qualityMetrics.reportAverageRating
                  )}`}
                />
                <MetricCard
                  label="Feedback text present"
                  value={qualityMetrics.feedbackTextPresentCount}
                />
                <MetricCard
                  label="Feedback text withheld"
                  value={qualityMetrics.feedbackTextWithheldCount}
                />
              </div>
              <Card variant="outlined" className="bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Rating distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2">
                    <RatingDistribution
                      label="Recommendation ratings"
                      distribution={qualityDistribution.recommendation}
                    />
                    <RatingDistribution
                      label="Report ratings"
                      distribution={qualityDistribution.report}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card variant="outlined" className="bg-white">
              <CardContent className="py-5 text-sm text-slate-600">
                No trusted quality feedback measurements are available for this filter set.
              </CardContent>
            </Card>
          )}
        </section>

        <section role="region" aria-label="Low-quality trends">
          <Card variant="outlined" className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Low-quality trends</CardTitle>
              <Badge variant={qualityWarningCount > 0 ? 'warning' : 'success'}>
                {qualityWarningCount} warning trend
              </Badge>
            </CardHeader>
            <CardContent>
              {qualityFeedback?.lowQualityTrends.length ? (
                <div className="space-y-2">
                  {qualityFeedback.lowQualityTrends.map((trend) => (
                    <QualityTrendRow key={trend.id} trend={trend} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  No low-quality trend warnings detected for this filter set.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <Card variant="outlined" className="bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quality feedback by workflow</CardTitle>
          </CardHeader>
          <CardContent>
            <Table aria-label="Quality feedback by workflow">
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead className="text-right">Ratings</TableHead>
                  <TableHead className="text-right">Average</TableHead>
                  <TableHead className="text-right">Low-rating rate</TableHead>
                  <TableHead className="text-right">Text withheld</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qualityFeedback?.byWorkflow.length ? (
                  qualityFeedback.byWorkflow.map((group) => (
                    <QualityWorkflowRow key={`${group.tenantId}-${group.key}`} group={group} />
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-sm text-slate-500">
                      No trusted workflow quality measurements are available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card variant="outlined" className="bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quality feedback by recommendation type</CardTitle>
          </CardHeader>
          <CardContent>
            <Table aria-label="Quality feedback by recommendation type">
              <TableHeader>
                <TableRow>
                  <TableHead>Recommendation type</TableHead>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead className="text-right">Ratings</TableHead>
                  <TableHead className="text-right">Average</TableHead>
                  <TableHead className="text-right">Low-rating rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qualityFeedback?.byRecommendationType.length ? (
                  qualityFeedback.byRecommendationType.map((group) => (
                    <QualityRecommendationTypeRow
                      key={`${group.tenantId}-${group.workflowKey ?? 'none'}-${group.key}`}
                      group={group}
                    />
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-sm text-slate-500">
                      No trusted recommendation quality measurements are available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <section role="region" aria-label="Provider telemetry metrics">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Provider telemetry</h2>
              <p className="text-sm text-slate-600">
                Aggregate cost, latency, cache, timeout, and failure measurements from provider
                events.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={freshnessBadgeVariant(providerTelemetry?.freshness.status)}>
                {freshnessLabel(providerTelemetry?.freshness.status)}
              </Badge>
              <span className="text-xs text-slate-500">
                {providerTelemetry?.freshness.latestEventAt
                  ? `last provider event ${formatDateTime(providerTelemetry.freshness.latestEventAt)}`
                  : 'provider event unavailable'}
              </span>
            </div>
          </div>
          {providerMetrics ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <MetricCard
                label="Average latency"
                value={formatMilliseconds(providerMetrics.averageLatencyMs)}
                icon={<Gauge className="h-4 w-4 text-emerald-600" />}
              />
              <MetricCard
                label="P95 latency"
                value={formatMilliseconds(providerMetrics.p95LatencyMs)}
                icon={<Clock3 className="h-4 w-4 text-emerald-600" />}
              />
              <MetricCard label="Error rate" value={formatPercent(providerMetrics.errorRate)} />
              <MetricCard label="Timeout rate" value={formatPercent(providerMetrics.timeoutRate)} />
              <MetricCard
                label="Estimated tokens"
                value={formatInteger(providerMetrics.estimatedTokens)}
              />
              <MetricCard
                label="Estimated cost"
                value={formatCost(providerMetrics.estimatedCost)}
              />
              <MetricCard label="Provider calls" value={providerMetrics.terminalCalls} />
              <MetricCard label="Failed calls" value={providerMetrics.failedCalls} />
              <MetricCard label="Retries" value={providerMetrics.retryEvents} />
              <MetricCard label="Cache hits" value={providerMetrics.cacheHits} />
              <MetricCard label="Cache misses" value={providerMetrics.cacheMisses} />
              <MetricCard label="Cache bypasses" value={providerMetrics.cacheBypasses} />
              <MetricCard
                label="Cache hit rate"
                value={formatPercent(providerMetrics.cacheHitRate)}
                icon={<Database className="h-4 w-4 text-emerald-600" />}
              />
            </div>
          ) : (
            <Card variant="outlined" className="bg-white">
              <CardContent className="py-5 text-sm text-slate-600">
                No trusted provider measurements are available for this filter set.
              </CardContent>
            </Card>
          )}
        </section>

        <section role="region" aria-label="Provider threshold breaches">
          <Card variant="outlined" className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Provider threshold breaches</CardTitle>
              <Badge variant={providerTelemetry?.thresholdBreaches.length ? 'warning' : 'success'}>
                {providerTelemetry?.thresholdBreaches.length ?? 0} warning breach
              </Badge>
            </CardHeader>
            <CardContent>
              {providerTelemetry?.thresholdBreaches.length ? (
                <div className="space-y-2">
                  {providerTelemetry.thresholdBreaches.map((breach) => (
                    <div
                      key={breach.id}
                      className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="flex items-center gap-2 font-medium">
                            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                            <span>Warning breach: {breach.metric}</span>
                          </p>
                          <p className="mt-1 text-amber-900">{breach.message}</p>
                        </div>
                        <Badge variant="warning">{breach.severity}</Badge>
                      </div>
                      <div className="mt-2 grid gap-2 text-xs md:grid-cols-5">
                        <span>Actual: {breach.actualValue}</span>
                        <span>Threshold: {breach.thresholdValue}</span>
                        <span>Tenant: {breach.tenantId}</span>
                        <span>Workflow type: {breach.workflowType}</span>
                        <span>Window: {breach.timeWindow}</span>
                      </div>
                      <p className="mt-1 text-xs">Scope: {breach.affectedScope}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  No provider threshold breaches detected for this filter set.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <Card variant="outlined" className="bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Provider telemetry groups</CardTitle>
          </CardHeader>
          <CardContent>
            <Table aria-label="Provider telemetry groups">
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">P95 latency</TableHead>
                  <TableHead className="text-right">Error rate</TableHead>
                  <TableHead className="text-right">Timeout rate</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Cache</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providerGroups.length ? (
                  providerGroups.map((group) => (
                    <ProviderGroupRow key={`${group.scopeLabel}-${group.key}`} group={group} />
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="py-6 text-center text-sm text-slate-500">
                      No trusted provider group measurements are available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

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

        <section role="region" aria-label="Provider telemetry gaps">
          <Card variant="outlined" className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Provider telemetry gaps</CardTitle>
            </CardHeader>
            <CardContent>
              {providerTelemetry?.instrumentationGaps.length ? (
                <div className="space-y-2">
                  {providerTelemetry.instrumentationGaps.map((gap, index) => (
                    <div
                      key={`${gap.reason}-${gap.eventName ?? index}`}
                      className="flex flex-col gap-1 rounded-sm border border-slate-200 px-3 py-2 text-sm md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-medium">{humanizeGapReason(gap.reason)}</p>
                        <p className="text-slate-600">
                          {gap.eventName ?? 'provider event unavailable'} · {gap.owningArea}
                        </p>
                      </div>
                      <Badge variant="outline">{gap.count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">No provider telemetry gaps detected.</p>
              )}
            </CardContent>
          </Card>
        </section>

        <section role="region" aria-label="Quality gaps">
          <Card variant="outlined" className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quality gaps</CardTitle>
            </CardHeader>
            <CardContent>
              {qualityFeedback?.instrumentationGaps.length ? (
                <div className="space-y-2">
                  {qualityFeedback.instrumentationGaps.map((gap, index) => (
                    <div
                      key={`${gap.reason}-${gap.eventName ?? index}`}
                      className="flex flex-col gap-1 rounded-sm border border-slate-200 px-3 py-2 text-sm md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-medium">{humanizeGapReason(gap.reason)}</p>
                        <p className="text-slate-600">
                          {gap.eventName ?? 'quality source unavailable'} · {gap.owningArea}
                        </p>
                      </div>
                      <Badge variant="outline">{gap.count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">No quality gaps detected.</p>
              )}
            </CardContent>
          </Card>
        </section>

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

      <Dialog
        open={Boolean(selectedWorkflow)}
        onOpenChange={(open) => !open && setSelectedWorkflow(null)}
      >
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

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number
  icon?: ReactNode
}) {
  return (
    <Card variant="outlined" className="bg-white">
      <CardContent className="py-4">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-normal text-slate-500">
          {icon}
          <span>{label}</span>
        </p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  )
}

function RatingDistribution({
  label,
  distribution,
}: {
  label: string
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
}) {
  return (
    <div className="rounded-sm border border-slate-200 p-3">
      <p className="text-sm font-medium text-slate-900">{label}</p>
      <div className="mt-3 grid grid-cols-5 gap-2 text-center text-sm">
        {([1, 2, 3, 4, 5] as const).map((rating) => (
          <div key={rating} className="rounded-sm bg-slate-50 px-2 py-2">
            <p className="text-xs text-slate-500">{rating}</p>
            <p className="mt-1 font-semibold text-slate-900">{distribution[rating]}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function QualityTrendRow({ trend }: { trend: AdvisoryQualityLowQualityTrend }) {
  return (
    <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="flex items-center gap-2 font-medium">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            <span>
              {trend.workflowLabel} · {trend.recommendationLabel}
            </span>
          </p>
          <p className="mt-1 text-amber-900">
            Trend {trendDirectionLabel(trend.trendDirection)} from{' '}
            {formatPercent(trend.previousLowRatingRate)} to{' '}
            {formatPercent(trend.currentLowRatingRate)} across {trend.sampleSize} ratings.
          </p>
        </div>
        <Badge variant="warning">{trend.severity}</Badge>
      </div>
      <div className="mt-2 grid gap-2 text-xs md:grid-cols-3">
        <span>Current: {formatPercent(trend.currentLowRatingRate)}</span>
        <span>Previous: {formatPercent(trend.previousLowRatingRate)}</span>
        <span>Tenant: {trend.tenantId}</span>
      </div>
    </div>
  )
}

function QualityWorkflowRow({ group }: { group: AdvisoryQualityFeedbackGroup }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{group.label}</TableCell>
      <TableCell>{group.tenantId}</TableCell>
      <TableCell className="text-right">{group.ratingCount}</TableCell>
      <TableCell className="text-right">{formatRating(group.averageRating)}</TableCell>
      <TableCell className="text-right">{formatPercent(group.lowRatingRate)}</TableCell>
      <TableCell className="text-right">{group.feedbackTextWithheldCount}</TableCell>
    </TableRow>
  )
}

function QualityRecommendationTypeRow({
  group,
}: {
  group: AdvisoryQualityRecommendationTypeGroup
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{group.label}</TableCell>
      <TableCell>{group.workflowKey ?? '-'}</TableCell>
      <TableCell>{group.tenantId}</TableCell>
      <TableCell className="text-right">{group.ratingCount}</TableCell>
      <TableCell className="text-right">{formatRating(group.averageRating)}</TableCell>
      <TableCell className="text-right">{formatPercent(group.lowRatingRate)}</TableCell>
    </TableRow>
  )
}

function GovernanceEventTypeRow({ group }: { group: AdvisoryGovernanceEventTypeGroup }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{group.key}</TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span>{group.owningArea ?? 'ThinkTank governance'}</span>
          <span className="text-xs text-slate-500">{group.owningStory ?? '-'}</span>
        </div>
      </TableCell>
      <TableCell className="text-right">{group.count}</TableCell>
      <TableCell className="text-right">{group.deniedCount}</TableCell>
      <TableCell className="text-right">{group.failureCount}</TableCell>
    </TableRow>
  )
}

function GovernanceGroupTable({
  title,
  ariaLabel,
  groups,
  unavailable,
}: {
  title: string
  ariaLabel: string
  groups: AdvisoryGovernanceGroup[]
  unavailable: boolean
}) {
  return (
    <Card variant="outlined" className="bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table aria-label={ariaLabel}>
          <TableHeader>
            <TableRow>
              <TableHead>Group</TableHead>
              <TableHead className="text-right">Events</TableHead>
              <TableHead className="text-right">Denied</TableHead>
              <TableHead className="text-right">Exports</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length ? (
              groups.map((group) => (
                <TableRow key={group.key}>
                  <TableCell className="font-medium">{group.label}</TableCell>
                  <TableCell className="text-right">{group.count}</TableCell>
                  <TableCell className="text-right">{group.deniedCount}</TableCell>
                  <TableCell className="text-right">{group.exportedOutputCount}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-slate-500">
                  {unavailable
                    ? 'Governance source unavailable. Grouped evidence cannot be determined.'
                    : 'No trusted governance groups are available.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function ProviderGroupRow({ group }: { group: AdvisoryProviderTelemetryGroup }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{group.label}</TableCell>
      <TableCell>
        <Badge variant="outline">{group.scopeLabel}</Badge>
      </TableCell>
      <TableCell className="text-right">{group.terminalCalls}</TableCell>
      <TableCell className="text-right">{formatMilliseconds(group.p95LatencyMs)}</TableCell>
      <TableCell className="text-right">{formatPercent(group.errorRate)}</TableCell>
      <TableCell className="text-right">{formatPercent(group.timeoutRate)}</TableCell>
      <TableCell className="text-right">{formatInteger(group.estimatedTokens)}</TableCell>
      <TableCell className="text-right">{formatCost(group.estimatedCost)}</TableCell>
      <TableCell className="text-right">
        {group.cacheHits}/{group.cacheMisses}/{group.cacheBypasses}
      </TableCell>
    </TableRow>
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

function formatRating(value: number | null) {
  if (value === null) return '-'
  return String(Math.round(value * 10) / 10)
}

function formatMilliseconds(value: number | null) {
  if (value === null) return '-'
  return `${Math.round(value)} ms`
}

function formatInteger(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

function formatCost(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)
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

function trendDirectionLabel(direction: string) {
  if (direction === 'up') return 'up'
  if (direction === 'down') return 'down'
  if (direction === 'flat') return 'flat'
  return 'insufficient data'
}
