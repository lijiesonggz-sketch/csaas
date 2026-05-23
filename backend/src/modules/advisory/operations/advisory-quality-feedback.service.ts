import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { AdvisoryOutputRatingRepository } from '../outputs/advisory-output-rating.repository'
import { QuickConsultRecommendationFeedbackRepository } from '../quick-consult/quick-consult-recommendation-feedback.repository'
import {
  AdvisoryQualityFeedbackAppliedFilters,
  AdvisoryQualityFeedbackDashboard,
  AdvisoryQualityFeedbackQuery,
  AdvisoryQualityFeedbackRatingSummary,
  AdvisoryQualityFeedbackSourceQuery,
  AdvisoryQualityFeedbackTimeBucket,
  AdvisoryQualityFreshness,
  AdvisoryQualityInstrumentationGap,
  AdvisoryQualityLowQualityTrend,
  AdvisoryQualityOutputRatingRow,
  AdvisoryQualityOutputRatingSource,
  AdvisoryQualityRecommendationFeedbackRow,
  AdvisoryQualityRecommendationFeedbackSource,
  AdvisoryQualityRecommendationTypeGroup,
  AdvisoryQualityTenantGroup,
  AdvisoryQualityWorkflowGroup,
} from './advisory-quality-feedback.types'
import { AdvisoryOperationsMeasurementStatus } from './advisory-operations.types'

const DEFAULT_WINDOW_DAYS = 30
const FRESHNESS_DELAY_HOURS = 48
const LOW_QUALITY_THRESHOLD = 0.4
const MAX_QUALITY_WINDOW_DAYS = 90

type SourceType = 'recommendation_feedback' | 'output_ratings'

interface NormalizedFilters {
  tenantId: string
  dateFrom: Date
  dateTo: Date
  workflowType: string | null
  recommendationType: string | null
  groupBy: Set<string>
  timeBucket: AdvisoryQualityFeedbackTimeBucket
  appliedFilters: AdvisoryQualityFeedbackAppliedFilters
}

interface RatingEntry {
  source: SourceType
  recordId: string
  tenantId: string
  rating: number
  workflowKey: string
  workflowLabel: string
  recommendationType: string | null
  recommendationLabel: string | null
  feedbackTextPresent: boolean
  occurredAt: Date
}

@Injectable()
export class AdvisoryQualityFeedbackService {
  constructor(
    @Inject(QuickConsultRecommendationFeedbackRepository)
    private readonly recommendationFeedbackSource: AdvisoryQualityRecommendationFeedbackSource,
    @Inject(AdvisoryOutputRatingRepository)
    private readonly outputRatingSource: AdvisoryQualityOutputRatingSource,
  ) {}

  static fromRepositories(
    recommendationFeedbackRepository: QuickConsultRecommendationFeedbackRepository,
    outputRatingRepository: AdvisoryOutputRatingRepository,
  ) {
    return new AdvisoryQualityFeedbackService(
      recommendationFeedbackRepository,
      outputRatingRepository,
    )
  }

  async getQualityFeedback(
    query: AdvisoryQualityFeedbackQuery,
  ): Promise<AdvisoryQualityFeedbackDashboard> {
    const filters = this.normalizeFilters(query)
    const generatedAt = (query.now ?? new Date()).toISOString()
    const sourceQuery: AdvisoryQualityFeedbackSourceQuery = {
      tenantId: filters.tenantId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    }

    let recommendationRows: AdvisoryQualityRecommendationFeedbackRow[]
    let outputRows: AdvisoryQualityOutputRatingRow[]
    try {
      ;[recommendationRows, outputRows] = await Promise.all([
        this.recommendationFeedbackSource.findForQualityAggregation(sourceQuery),
        this.outputRatingSource.findForQualityAggregation(sourceQuery),
      ])
    } catch (error) {
      return this.buildUnavailableDashboard(filters.appliedFilters, generatedAt, error)
    }

    return this.aggregateRows(
      recommendationRows,
      outputRows,
      filters,
      query.now ?? new Date(),
      generatedAt,
    )
  }

  private aggregateRows(
    recommendationRows: AdvisoryQualityRecommendationFeedbackRow[],
    outputRows: AdvisoryQualityOutputRatingRow[],
    filters: NormalizedFilters,
    now: Date,
    generatedAt: string,
  ): AdvisoryQualityFeedbackDashboard {
    const gaps: AdvisoryQualityInstrumentationGap[] = []
    const recommendationEntries = this.normalizeRecommendationEntries(
      recommendationRows,
      filters,
      gaps,
    )
    const outputEntries = this.normalizeOutputEntries(outputRows, filters, gaps)
    const entries = [...recommendationEntries, ...outputEntries]
    const distinctRecommendationEntries = this.distinctRatings(recommendationEntries)
    const distinctOutputEntries = this.distinctRatings(outputEntries)
    const distinctEntries = [...distinctRecommendationEntries, ...distinctOutputEntries]
    const latestEventAt = entries.reduce<Date | null>(
      (latest, entry) => (!latest || entry.occurredAt > latest ? entry.occurredAt : latest),
      null,
    )
    const freshness = this.resolveFreshness(latestEventAt, now, gaps)
    const measurementStatus = freshness.status

    return {
      generatedAt,
      appliedFilters: filters.appliedFilters,
      summary: {
        measurementStatus,
        totalRatings: distinctEntries.length,
        averageRating: this.average(distinctEntries.map((entry) => entry.rating)),
        lowRatingCount: distinctEntries.filter((entry) => this.isLowQuality(entry.rating)).length,
        lowRatingRate: this.rate(
          distinctEntries.filter((entry) => this.isLowQuality(entry.rating)).length,
          distinctEntries.length,
        ),
        recommendationRatings: this.toSummary(distinctRecommendationEntries),
        outputRatings: this.toSummary(distinctOutputEntries),
        reportRatings: this.toSummary(distinctOutputEntries),
        feedbackTextPresentCount: distinctEntries.filter((entry) => entry.feedbackTextPresent)
          .length,
        feedbackTextWithheldCount: distinctEntries.filter((entry) => entry.feedbackTextPresent)
          .length,
        feedbackTextUnavailableReason: distinctEntries.some((entry) => entry.feedbackTextPresent)
          ? 'privacy_policy_withheld'
          : null,
      },
      byWorkflow: this.hasGroup(filters, 'workflow')
        ? this.byWorkflow(entries, measurementStatus)
        : [],
      byRecommendationType: this.hasGroup(filters, 'recommendationType')
        ? this.byRecommendationType(recommendationEntries, measurementStatus)
        : [],
      byTenant: this.hasGroup(filters, 'tenant')
        ? this.byTenant(distinctEntries, filters.tenantId, measurementStatus)
        : [],
      byPeriod: this.hasGroup(filters, 'time')
        ? this.byPeriod(distinctEntries, filters.timeBucket, measurementStatus)
        : [],
      lowQualityTrends: this.lowQualityTrends(entries, filters),
      instrumentationGaps: gaps,
      freshness,
    }
  }

  private normalizeRecommendationEntries(
    rows: AdvisoryQualityRecommendationFeedbackRow[],
    filters: NormalizedFilters,
    gaps: AdvisoryQualityInstrumentationGap[],
  ): RatingEntry[] {
    const entries: RatingEntry[] = []

    for (const row of rows) {
      if (row.tenantId !== filters.tenantId) continue
      if (row.createdAt < filters.dateFrom || row.createdAt > filters.dateTo) continue

      this.recordMalformedMetadataGap(row.metadata, 'recommendation_feedback', gaps)

      if (!this.isValidRating(row.rating)) {
        this.addGap(gaps, 'recommendation_feedback', 'out_of_range_rating')
        continue
      }

      if (this.isRawSensitiveValue(row.primaryProblemType)) {
        this.addGap(gaps, 'recommendation_feedback', 'privacy_unsafe_grouping_metadata')
      }
      const category = this.safeGroupValue(row.primaryProblemType)
      const workflows = Array.isArray(row.workflowKeys)
        ? row.workflowKeys
            .map((workflow) => {
              if (this.isRawSensitiveValue(workflow)) {
                this.addGap(gaps, 'recommendation_feedback', 'privacy_unsafe_grouping_metadata')
              }
              return this.safeGroupValue(workflow)
            })
            .filter(Boolean)
        : []

      if (!workflows.length) {
        this.addGap(gaps, 'recommendation_feedback', 'missing_workflow_key')
        continue
      }

      if (!category) {
        this.addGap(gaps, 'recommendation_feedback', 'missing_recommendation_category')
        continue
      }

      if (filters.recommendationType && category !== filters.recommendationType) continue

      for (const workflowKey of workflows) {
        if (filters.workflowType && workflowKey !== filters.workflowType) continue
        entries.push({
          source: 'recommendation_feedback',
          recordId: row.id,
          tenantId: row.tenantId,
          rating: row.rating,
          workflowKey,
          workflowLabel: this.toLabel(workflowKey),
          recommendationType: category,
          recommendationLabel: this.toLabel(category),
          feedbackTextPresent: row.feedbackTextPresent ?? Boolean(row.feedbackText?.trim()),
          occurredAt: row.createdAt,
        })
      }
    }

    return entries
  }

  private normalizeOutputEntries(
    rows: AdvisoryQualityOutputRatingRow[],
    filters: NormalizedFilters,
    gaps: AdvisoryQualityInstrumentationGap[],
  ): RatingEntry[] {
    const entries: RatingEntry[] = []

    for (const row of rows) {
      if (row.tenantId !== filters.tenantId) continue
      const occurredAt = row.ratedAt ?? row.updatedAt ?? row.createdAt
      if (occurredAt < filters.dateFrom || occurredAt > filters.dateTo) continue

      this.recordMalformedMetadataGap(row.metadata, 'output_ratings', gaps)

      if (row.rating === null || row.rating === undefined) continue

      if (!this.isValidRating(row.rating)) {
        this.addGap(gaps, 'output_ratings', 'out_of_range_rating')
        continue
      }

      if (this.isRawSensitiveValue(row.workflowKey)) {
        this.addGap(gaps, 'output_ratings', 'privacy_unsafe_grouping_metadata')
      }
      const workflowKey = this.safeGroupValue(row.workflowKey)
      if (!workflowKey) {
        this.addGap(gaps, 'output_ratings', 'orphaned_output_rating')
        this.addGap(gaps, 'output_ratings', 'missing_output_workflow_metadata')
        continue
      }

      if (filters.workflowType && workflowKey !== filters.workflowType) continue

      entries.push({
        source: 'output_ratings',
        recordId: row.id,
        tenantId: row.tenantId,
        rating: row.rating as number,
        workflowKey,
        workflowLabel: this.safeGroupValue(row.workflowLabel) ?? this.toLabel(workflowKey),
        recommendationType: null,
        recommendationLabel: null,
        feedbackTextPresent: row.feedbackTextPresent ?? Boolean(row.feedbackText?.trim()),
        occurredAt,
      })
    }

    return entries
  }

  private byWorkflow(
    entries: RatingEntry[],
    measurementStatus: AdvisoryOperationsMeasurementStatus,
  ): AdvisoryQualityWorkflowGroup[] {
    const groups = new Map<string, RatingEntry[]>()
    for (const entry of entries) {
      const key = `${entry.tenantId}:${entry.workflowKey}`
      groups.set(key, [...(groups.get(key) ?? []), entry])
    }

    return [...groups.values()]
      .map((items) => {
        const first = items[0]
        const summary = this.toSummary(items)
        return {
          ...summary,
          workflowKey: first.workflowKey,
          workflowLabel: first.workflowLabel,
          tenantId: first.tenantId,
          ratingCount: summary.sampleSize,
          recommendationSampleSize: items.filter(
            (entry) => entry.source === 'recommendation_feedback',
          ).length,
          outputSampleSize: items.filter((entry) => entry.source === 'output_ratings').length,
          measurementStatus,
        }
      })
      .sort((left, right) => left.workflowKey.localeCompare(right.workflowKey))
  }

  private byRecommendationType(
    entries: RatingEntry[],
    measurementStatus: AdvisoryOperationsMeasurementStatus,
  ): AdvisoryQualityRecommendationTypeGroup[] {
    const groups = new Map<string, RatingEntry[]>()
    for (const entry of entries) {
      if (!entry.recommendationType) continue
      const key = `${entry.tenantId}:${entry.workflowKey}:${entry.recommendationType}`
      groups.set(key, [...(groups.get(key) ?? []), entry])
    }

    return [...groups.values()]
      .map((items) => {
        const first = items[0]
        const summary = this.toSummary(items)
        return {
          ...summary,
          recommendationType: first.recommendationType as string,
          recommendationLabel: first.recommendationLabel as string,
          workflowKey: first.workflowKey,
          tenantId: first.tenantId,
          ratingCount: summary.sampleSize,
          measurementStatus,
        }
      })
      .sort((left, right) => left.recommendationType.localeCompare(right.recommendationType))
  }

  private byTenant(
    entries: RatingEntry[],
    tenantId: string,
    measurementStatus: AdvisoryOperationsMeasurementStatus,
  ): AdvisoryQualityTenantGroup[] {
    const summary = this.toSummary(entries)
    return entries.length
      ? [
          {
            ...summary,
            tenantId,
            tenantLabel: tenantId,
            ratingCount: summary.sampleSize,
            measurementStatus,
          },
        ]
      : []
  }

  private byPeriod(
    entries: RatingEntry[],
    timeBucket: AdvisoryQualityFeedbackTimeBucket,
    measurementStatus: AdvisoryOperationsMeasurementStatus,
  ) {
    const groups = new Map<string, RatingEntry[]>()
    for (const entry of entries) {
      const period = this.periodKey(entry.occurredAt, timeBucket)
      groups.set(period, [...(groups.get(period) ?? []), entry])
    }

    return [...groups.entries()]
      .map(([period, items]) => {
        const summary = this.toSummary(items)
        return {
          ...summary,
          period,
          ratingCount: summary.sampleSize,
          measurementStatus,
        }
      })
      .sort((left, right) => left.period.localeCompare(right.period))
  }

  private lowQualityTrends(
    entries: RatingEntry[],
    filters: NormalizedFilters,
  ): AdvisoryQualityLowQualityTrend[] {
    const midpoint = new Date(
      filters.dateFrom.getTime() + (filters.dateTo.getTime() - filters.dateFrom.getTime()) / 2,
    )
    const groups = new Map<string, RatingEntry[]>()
    for (const entry of entries) {
      const categoryKey =
        entry.source === 'output_ratings' ? 'report-output' : entry.recommendationType
      if (!categoryKey) continue
      const key = `${entry.source}:${entry.workflowKey}:${categoryKey}`
      groups.set(key, [...(groups.get(key) ?? []), entry])
    }

    return [...groups.values()]
      .map((items) => {
        const current = items.filter((entry) => entry.occurredAt >= midpoint)
        const previous = items.filter((entry) => entry.occurredAt < midpoint)
        const currentRate = this.rate(
          current.filter((entry) => this.isLowQuality(entry.rating)).length,
          current.length,
        )
        const previousRate = this.rate(
          previous.filter((entry) => this.isLowQuality(entry.rating)).length,
          previous.length,
        )
        const first = items[0]
        const categoryKey =
          first.source === 'output_ratings' ? 'report-output' : first.recommendationType
        const categoryLabel =
          first.source === 'output_ratings' ? 'Report Output' : first.recommendationLabel
        const direction = this.trendDirection(currentRate, previousRate)
        return {
          id: `${first.source}-${first.workflowKey}-${categoryKey}`,
          source: first.source,
          workflowKey: first.workflowKey,
          workflowLabel: first.workflowLabel,
          recommendationType: categoryKey,
          recommendationLabel: categoryLabel,
          tenantId: first.tenantId,
          direction,
          trendDirection: direction,
          currentLowQualityRate: currentRate,
          previousLowQualityRate: previousRate,
          currentLowRatingRate: currentRate,
          previousLowRatingRate: previousRate,
          sampleSize: items.length,
          threshold: LOW_QUALITY_THRESHOLD,
          severity: 'warning' as const,
        }
      })
      .filter(
        (trend) =>
          trend.currentLowQualityRate !== null &&
          trend.currentLowQualityRate >= LOW_QUALITY_THRESHOLD,
      )
      .sort((left, right) => right.sampleSize - left.sampleSize)
  }

  private toSummary(entries: RatingEntry[]): AdvisoryQualityFeedbackRatingSummary {
    const values = entries.map((entry) => entry.rating)
    const lowQualityCount = values.filter((rating) => this.isLowQuality(rating)).length
    const feedbackTextPresentCount = entries.filter((entry) => entry.feedbackTextPresent).length
    return {
      sampleSize: values.length,
      count: values.length,
      averageRating: this.average(values),
      lowQualityCount,
      lowRatingCount: lowQualityCount,
      lowQualityRate: this.rate(lowQualityCount, values.length),
      lowRatingRate: this.rate(lowQualityCount, values.length),
      distribution: {
        1: values.filter((rating) => rating === 1).length,
        2: values.filter((rating) => rating === 2).length,
        3: values.filter((rating) => rating === 3).length,
        4: values.filter((rating) => rating === 4).length,
        5: values.filter((rating) => rating === 5).length,
      },
      feedbackTextPresentCount,
      feedbackTextWithheldCount: feedbackTextPresentCount,
      feedbackTextUnavailableReason: feedbackTextPresentCount > 0 ? 'privacy_policy' : null,
    }
  }

  private distinctRatings(entries: RatingEntry[]): RatingEntry[] {
    const byRecord = new Map<string, RatingEntry>()
    for (const entry of entries) {
      const key = `${entry.source}:${entry.recordId}`
      if (!byRecord.has(key)) {
        byRecord.set(key, entry)
      }
    }
    return [...byRecord.values()]
  }

  private buildUnavailableDashboard(
    appliedFilters: AdvisoryQualityFeedbackAppliedFilters,
    generatedAt: string,
    error: unknown,
  ): AdvisoryQualityFeedbackDashboard {
    const source = /output/i.test(error instanceof Error ? error.message : '')
      ? 'output_ratings'
      : 'recommendation_feedback'
    const emptySummary = this.toSummary([])
    return {
      generatedAt,
      appliedFilters,
      summary: {
        measurementStatus: 'unavailable',
        totalRatings: 0,
        averageRating: null,
        lowRatingCount: 0,
        lowRatingRate: null,
        recommendationRatings: emptySummary,
        outputRatings: emptySummary,
        reportRatings: emptySummary,
        feedbackTextPresentCount: 0,
        feedbackTextWithheldCount: 0,
        feedbackTextUnavailableReason: null,
      },
      byWorkflow: [],
      byRecommendationType: [],
      byTenant: [],
      byPeriod: [],
      lowQualityTrends: [],
      instrumentationGaps: [
        {
          reason: 'quality_feedback_source_unavailable',
          source,
          owner: 'thinktank_quality_feedback',
          owningArea: 'thinktank_quality_feedback',
        },
      ],
      freshness: {
        source: 'quality_feedback',
        status: 'unavailable',
        latestEventAt: null,
        description:
          'Quality feedback source is unavailable. No trusted measurements are available.',
      },
    }
  }

  private normalizeFilters(query: AdvisoryQualityFeedbackQuery): NormalizedFilters {
    const now = query.now ?? new Date()
    const dateTo = this.normalizeDate(query.dateTo, 'to') ?? now
    const dateFrom =
      this.normalizeDate(query.dateFrom, 'from') ?? this.daysBefore(dateTo, DEFAULT_WINDOW_DAYS)
    const currentTenantId = this.readString(query.currentTenantId)
    const requestedTenantId = this.readString(query.tenantId)
    const actorTenantId = this.readString(query.actor?.tenantId)
    const scopedTenantId = currentTenantId ?? actorTenantId
    if (!scopedTenantId) {
      throw new BadRequestException('tenantId is required for ThinkTank quality feedback.')
    }
    if (
      requestedTenantId &&
      requestedTenantId !== 'current' &&
      requestedTenantId !== scopedTenantId
    ) {
      throw new ForbiddenException('当前账号无权查看其他租户的 ThinkTank 运营数据。')
    }
    const tenantId = scopedTenantId
    const workflowType = this.readString(query.workflowType)
    const recommendationType = this.readString(query.recommendationType)
    const groupBy = new Set(query.groupBy ?? [])
    const timeBucket = query.timeBucket ?? 'day'

    if (dateFrom > dateTo) {
      throw new BadRequestException('dateFrom must be before dateTo.')
    }
    if (dateTo.getTime() - dateFrom.getTime() > MAX_QUALITY_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
      throw new BadRequestException(`date window must not exceed ${MAX_QUALITY_WINDOW_DAYS} days.`)
    }

    return {
      tenantId,
      dateFrom,
      dateTo,
      workflowType: workflowType && workflowType !== 'all' ? workflowType : null,
      recommendationType:
        recommendationType && recommendationType !== 'all' ? recommendationType : null,
      groupBy,
      timeBucket,
      appliedFilters: {
        tenantId,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
        ...(workflowType && workflowType !== 'all' ? { workflowType } : {}),
        ...(recommendationType && recommendationType !== 'all' ? { recommendationType } : {}),
        ...(query.groupBy?.length ? { groupBy: [...query.groupBy] } : {}),
        timeBucket,
      },
    }
  }

  private resolveFreshness(
    latestEventAt: Date | null,
    now: Date,
    gaps: AdvisoryQualityInstrumentationGap[],
  ): AdvisoryQualityFreshness {
    if (!latestEventAt) {
      return {
        source: 'quality_feedback',
        status: 'unavailable',
        latestEventAt: null,
        description: 'No trusted quality feedback rows were found for this operational window.',
      }
    }
    if (
      gaps.length > 0 ||
      now.getTime() - latestEventAt.getTime() > FRESHNESS_DELAY_HOURS * 60 * 60 * 1000
    ) {
      return {
        source: 'quality_feedback',
        status: 'delayed',
        latestEventAt: latestEventAt.toISOString(),
        description:
          'Quality feedback contains instrumentation gaps or delayed rows. Treat metrics as partial.',
      }
    }
    return {
      source: 'quality_feedback',
      status: 'fresh',
      latestEventAt: latestEventAt.toISOString(),
      description: `Quality feedback is current through ${latestEventAt.toISOString()}.`,
    }
  }

  private addGap(
    gaps: AdvisoryQualityInstrumentationGap[],
    source: SourceType,
    reason: string,
  ): void {
    const owner = source === 'recommendation_feedback' ? 'quick_consult_feedback' : 'output_rating'
    const existing = gaps.find(
      (gap) => gap.source === source && gap.reason === reason && gap.owningArea === owner,
    )
    if (existing) {
      existing.count = (existing.count ?? 1) + 1
      return
    }
    gaps.push({
      source,
      reason,
      owner,
      owningArea: owner,
      count: 1,
    })
  }

  private recordMalformedMetadataGap(
    metadata: unknown,
    source: SourceType,
    gaps: AdvisoryQualityInstrumentationGap[],
  ): void {
    if (metadata === null || metadata === undefined) return
    if (typeof metadata === 'object' && !Array.isArray(metadata)) return
    this.addGap(gaps, source, 'malformed_metadata')
  }

  private hasGroup(filters: NormalizedFilters, group: string): boolean {
    return filters.groupBy.size === 0 || filters.groupBy.has(group)
  }

  private trendDirection(
    currentRate: number | null,
    previousRate: number | null,
  ): 'up' | 'down' | 'flat' | 'insufficient_data' {
    if (currentRate === null || previousRate === null) return 'insufficient_data'
    if (currentRate > previousRate) return 'up'
    if (currentRate < previousRate) return 'down'
    return 'flat'
  }

  private normalizeDate(
    value: string | Date | null | undefined,
    boundary: 'from' | 'to',
  ): Date | null {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) throw new BadRequestException('Invalid date filter.')
      return value
    }
    const text = this.readString(value)
    if (!text) return null
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text)
    const parsed = isDateOnly
      ? new Date(`${text}T${boundary === 'to' ? '23:59:59.999' : '00:00:00.000'}Z`)
      : new Date(text)
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Invalid date filter.')
    return parsed
  }

  private periodKey(date: Date, bucket: AdvisoryQualityFeedbackTimeBucket): string {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    if (bucket === 'month') return `${year}-${month}`
    if (bucket === 'week') {
      const weekStart = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate()))
      weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay())
      return weekStart.toISOString().slice(0, 10)
    }
    return `${year}-${month}-${day}`
  }

  private safeGroupValue(value: unknown): string | null {
    const text = this.readString(value)
    if (!text || this.containsRawSensitiveText(text)) return null
    return text
  }

  private isRawSensitiveValue(value: unknown): boolean {
    const text = this.readString(value)
    return Boolean(text && this.containsRawSensitiveText(text))
  }

  private containsRawSensitiveText(value: string): boolean {
    return /PRIVATE_|raw[_\s-]*(conversation|content|prompt|report|feedback|provider|payload)|provider[_\s-]*(raw|payload)|cache[_\s-]*key|actor[_\s-]*id|user[_\s-]*id|conversation|prompt|report content/i.test(
      value,
    )
  }

  private isValidRating(value: unknown): value is number {
    return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 5
  }

  private isLowQuality(rating: number): boolean {
    return rating <= 2
  }

  private average(values: number[]): number | null {
    if (!values.length) return null
    return this.round(values.reduce((total, value) => total + value, 0) / values.length)
  }

  private rate(numerator: number, denominator: number): number | null {
    if (denominator <= 0) return null
    return this.round(numerator / denominator)
  }

  private round(value: number): number {
    return Math.round(value * 10000) / 10000
  }

  private daysBefore(date: Date, days: number): Date {
    return new Date(date.getTime() - days * 24 * 60 * 60 * 1000)
  }

  private toLabel(value: string): string {
    return value
      .split(/[-_]/g)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ')
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }
}
