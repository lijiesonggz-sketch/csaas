import { UserRole } from '../../../database/entities/user.entity'
import { AdvisoryOperationsMeasurementStatus } from './advisory-operations.types'

export type AdvisoryQualityFeedbackGroupBy = 'workflow' | 'recommendationType' | 'tenant' | 'time'

export type AdvisoryQualityFeedbackTimeBucket = 'day' | 'week' | 'month'

export interface AdvisoryQualityFeedbackActor {
  id: string
  role?: UserRole | string | null
  tenantId?: string | null
  organizationId?: string | null
}

export interface AdvisoryQualityFeedbackQuery {
  tenantId?: string | null
  currentTenantId?: string | null
  dateFrom?: string | Date | null
  dateTo?: string | Date | null
  workflowType?: string | null
  recommendationType?: string | null
  groupBy?: readonly AdvisoryQualityFeedbackGroupBy[] | null
  timeBucket?: AdvisoryQualityFeedbackTimeBucket | null
  actor?: AdvisoryQualityFeedbackActor | null
  now?: Date
}

export interface AdvisoryQualityFeedbackSourceQuery {
  tenantId: string
  dateFrom: Date
  dateTo: Date
}

export interface AdvisoryQualityRecommendationFeedbackRow {
  id: string
  tenantId: string
  actorId?: string | null
  rating: number
  feedbackText?: string | null
  feedbackTextPresent?: boolean
  primaryProblemType: string | null
  recommendationIds?: string[] | null
  workflowKeys: string[]
  metadata?: unknown
  createdAt: Date
  updatedAt?: Date | null
}

export interface AdvisoryQualityOutputRatingRow {
  id: string
  tenantId: string
  actorId?: string | null
  outputId: string
  sessionId: string
  rating: number | null
  feedbackText?: string | null
  feedbackTextPresent?: boolean
  metadata?: unknown
  ratedAt: Date | null
  createdAt: Date
  updatedAt: Date
  workflowKey?: string | null
  workflowLabel?: string | null
}

export interface AdvisoryQualityRecommendationFeedbackSource {
  findForQualityAggregation(
    query: AdvisoryQualityFeedbackSourceQuery,
  ): Promise<AdvisoryQualityRecommendationFeedbackRow[]>
}

export interface AdvisoryQualityOutputRatingSource {
  findForQualityAggregation(
    query: AdvisoryQualityFeedbackSourceQuery,
  ): Promise<AdvisoryQualityOutputRatingRow[]>
}

export interface AdvisoryQualityFeedbackAppliedFilters {
  tenantId: string
  dateFrom: string
  dateTo: string
  workflowType?: string
  recommendationType?: string
  groupBy?: AdvisoryQualityFeedbackGroupBy[]
  timeBucket?: AdvisoryQualityFeedbackTimeBucket
}

export interface AdvisoryQualityFeedbackRatingSummary {
  sampleSize: number
  count: number
  averageRating: number | null
  lowQualityCount: number
  lowRatingCount: number
  lowQualityRate: number | null
  lowRatingRate: number | null
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
  feedbackTextPresentCount: number
  feedbackTextWithheldCount: number
  feedbackTextUnavailableReason: 'privacy_policy' | null
}

export interface AdvisoryQualityFeedbackSummary {
  measurementStatus: AdvisoryOperationsMeasurementStatus
  totalRatings: number
  averageRating: number | null
  lowRatingCount: number
  lowRatingRate: number | null
  recommendationRatings: AdvisoryQualityFeedbackRatingSummary
  outputRatings: AdvisoryQualityFeedbackRatingSummary
  reportRatings: AdvisoryQualityFeedbackRatingSummary
  feedbackTextPresentCount: number
  feedbackTextWithheldCount: number
  feedbackTextUnavailableReason: 'privacy_policy_withheld' | null
}

export interface AdvisoryQualityWorkflowGroup extends AdvisoryQualityFeedbackRatingSummary {
  workflowKey: string
  workflowLabel: string
  tenantId: string
  ratingCount: number
  recommendationSampleSize: number
  outputSampleSize: number
  measurementStatus: AdvisoryOperationsMeasurementStatus
}

export interface AdvisoryQualityRecommendationTypeGroup extends AdvisoryQualityFeedbackRatingSummary {
  recommendationType: string
  recommendationLabel: string
  workflowKey: string | null
  tenantId: string
  ratingCount: number
  measurementStatus: AdvisoryOperationsMeasurementStatus
}

export interface AdvisoryQualityTenantGroup extends AdvisoryQualityFeedbackRatingSummary {
  tenantId: string
  tenantLabel: string
  ratingCount: number
  measurementStatus: AdvisoryOperationsMeasurementStatus
}

export interface AdvisoryQualityPeriodGroup extends AdvisoryQualityFeedbackRatingSummary {
  period: string
  ratingCount: number
  measurementStatus: AdvisoryOperationsMeasurementStatus
}

export interface AdvisoryQualityLowQualityTrend {
  id: string
  source: 'recommendation_feedback' | 'output_ratings'
  workflowKey: string
  workflowLabel: string
  recommendationType: string | null
  recommendationLabel: string | null
  tenantId: string
  direction: 'up' | 'down' | 'flat' | 'insufficient_data'
  trendDirection: 'up' | 'down' | 'flat' | 'insufficient_data'
  currentLowQualityRate: number | null
  previousLowQualityRate: number | null
  currentLowRatingRate: number | null
  previousLowRatingRate: number | null
  sampleSize: number
  threshold: number
  severity: 'warning'
}

export interface AdvisoryQualityInstrumentationGap {
  source?: string
  eventName?: string
  reason: string
  owner?: string
  owningArea?: string
  count?: number
}

export interface AdvisoryQualityFreshness {
  source: 'quality_feedback' | 'recommendation_feedback' | 'output_ratings'
  status: AdvisoryOperationsMeasurementStatus
  latestEventAt: string | null
  description: string
}

export interface AdvisoryQualityFeedbackDashboard {
  generatedAt: string
  appliedFilters: AdvisoryQualityFeedbackAppliedFilters
  summary: AdvisoryQualityFeedbackSummary
  byWorkflow: AdvisoryQualityWorkflowGroup[]
  byRecommendationType: AdvisoryQualityRecommendationTypeGroup[]
  byTenant: AdvisoryQualityTenantGroup[]
  byPeriod: AdvisoryQualityPeriodGroup[]
  lowQualityTrends: AdvisoryQualityLowQualityTrend[]
  instrumentationGaps: AdvisoryQualityInstrumentationGap[]
  freshness: AdvisoryQualityFreshness
}
