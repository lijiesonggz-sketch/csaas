import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { AdvisoryQuickConsultContext } from '../../../database/entities/advisory-quick-consult-context.entity'
import { AdvisoryRecommendationFeedback } from '../../../database/entities/advisory-recommendation-feedback.entity'
import { AdvisoryAccessUser } from '../access/advisory-access.service'
import { AdvisoryEventService } from '../events/advisory-event.service'
import {
  ThinkTankEventName,
  ThinkTankEventOutcome,
  ThinkTankPrivacyClassification,
  ThinkTankSubjectType,
} from '../events/thinktank-event-contract'
import { QUICK_CONSULT_RECOMMENDATION_FEEDBACK_MAX_LENGTH } from './dto/submit-recommendation-feedback.dto'
import { QuickConsultContextRepository } from './quick-consult.repository'
import { QuickConsultRecommendationFeedbackRepository } from './quick-consult-recommendation-feedback.repository'

export interface SubmitRecommendationFeedbackInput {
  user: AdvisoryAccessUser
  tenantId: string
  quickConsultContextId: unknown
  rating: unknown
  feedbackText?: unknown
  recommendationIds?: unknown
}

interface RecommendationMetadata {
  ids: string[]
  workflowKeys: string[]
  confidence?: string
  sourceRefCount?: number
}

interface ClassificationMetadata {
  ids: string[]
  primaryProblemType: string | null
}

@Injectable()
export class QuickConsultRecommendationFeedbackService {
  private readonly logger = new Logger(QuickConsultRecommendationFeedbackService.name)

  constructor(
    private readonly contextRepository: QuickConsultContextRepository,
    private readonly feedbackRepository: QuickConsultRecommendationFeedbackRepository,
    private readonly eventService: AdvisoryEventService,
  ) {}

  async submitRecommendationFeedback(
    input: SubmitRecommendationFeedbackInput,
  ): Promise<AdvisoryRecommendationFeedback> {
    const tenantId = this.requireText(input.tenantId, 'tenantId')
    const actorId = this.requireText(input.user?.id, 'actorId')
    const quickConsultContextId = this.requireText(
      input.quickConsultContextId,
      'quickConsultContextId',
    )
    const rating = this.requireRating(input.rating)
    const feedbackText = this.normalizeFeedbackText(input.feedbackText)
    const quickConsultContext = await this.contextRepository.findContextForActor(
      tenantId,
      quickConsultContextId,
      actorId,
    )

    if (!quickConsultContext) {
      throw new BadRequestException('Quick Consult context is not available for feedback.')
    }

    const existingFeedback = await this.feedbackRepository.findFeedbackForContext(
      tenantId,
      actorId,
      quickConsultContextId,
    )
    if (existingFeedback) {
      return existingFeedback
    }

    const classification = this.readClassificationMetadata(quickConsultContext)
    const recommendations = this.readRecommendationMetadata(quickConsultContext)
    const selectedRecommendationIds = this.resolveRecommendationIds(
      input.recommendationIds,
      recommendations.ids,
    )
    const selectedWorkflowKeys = this.resolveWorkflowKeys(
      selectedRecommendationIds,
      recommendations,
    )
    const feedbackTextLength = feedbackText?.length ?? 0

    const feedback = await this.feedbackRepository.createFeedback(tenantId, {
      actorId,
      quickConsultContextId,
      rating,
      feedbackText,
      problemTypeIds: classification.ids,
      primaryProblemType: classification.primaryProblemType,
      recommendationIds: selectedRecommendationIds,
      workflowKeys: selectedWorkflowKeys,
      metadata: {
        recommendationConfidence: recommendations.confidence ?? null,
        sourceRefCount: recommendations.sourceRefCount ?? 0,
        feedbackTextLength,
      },
    })

    await this.eventService
      .emitTelemetry({
        eventName: ThinkTankEventName.RecommendationFeedbackSubmitted,
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.QuickConsult,
        subjectId: quickConsultContextId,
        outcome: ThinkTankEventOutcome.Success,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        telemetry: {
          entityType: 'ThinkTankRecommendationFeedback',
          organizationId: input.user.organizationId ?? null,
        },
        metadata: {
          rating,
          feedbackTextPresent: feedbackTextLength > 0,
          feedbackTextLength,
          problemTypeIds: classification.ids,
          primaryProblemType: classification.primaryProblemType,
          recommendationIds: selectedRecommendationIds,
          recommendationCount: selectedRecommendationIds.length,
          workflowKeys: selectedWorkflowKeys,
          recommendationConfidence: recommendations.confidence,
        },
      })
      .catch((error) => {
        this.logger.warn(
          `Recommendation feedback telemetry failed for context ${quickConsultContextId}`,
          error instanceof Error ? error.stack : undefined,
        )
      })

    return feedback
  }

  private readClassificationMetadata(context: AdvisoryQuickConsultContext): ClassificationMetadata {
    const classification = this.readRecord(context.metadata?.classification)
    const ids = this.normalizeStringArray(classification?.ids)
    const primaryProblemType = this.normalizeOptionalText(classification?.primaryProblemType)

    return {
      ids,
      primaryProblemType: primaryProblemType ?? ids[0] ?? null,
    }
  }

  private readRecommendationMetadata(context: AdvisoryQuickConsultContext): RecommendationMetadata {
    const recommendations = this.readRecord(context.metadata?.recommendations)
    const ids = this.normalizeStringArray(recommendations?.ids)

    if (ids.length < 2) {
      throw new BadRequestException(
        'Recommendation feedback requires a generated recommendation set.',
      )
    }

    return {
      ids,
      workflowKeys: this.normalizeStringArray(recommendations?.workflowKeys),
      confidence: this.normalizeOptionalText(recommendations?.confidence),
      sourceRefCount: this.normalizeOptionalNumber(recommendations?.sourceRefCount),
    }
  }

  private resolveRecommendationIds(value: unknown, serverRecommendationIds: string[]): string[] {
    const requestedIds = this.normalizeStringArray(value)
    const serverIds = new Set(serverRecommendationIds)
    const unknownIds = requestedIds.filter((recommendationId) => !serverIds.has(recommendationId))
    if (unknownIds.length > 0) {
      throw new BadRequestException('Recommendation feedback contains unknown recommendation ids.')
    }

    return serverRecommendationIds
  }

  private resolveWorkflowKeys(
    recommendationIds: string[],
    recommendations: RecommendationMetadata,
  ): string[] {
    if (recommendations.workflowKeys.length > 0) {
      return recommendations.workflowKeys
    }

    return this.normalizeStringArray(
      recommendationIds.map((recommendationId) => recommendationId.split(':')[1]),
    )
  }

  private requireRating(value: unknown): number {
    if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 5) {
      throw new BadRequestException(
        'Recommendation feedback rating must be an integer from 1 to 5.',
      )
    }

    return value as number
  }

  private requireText(value: unknown, fieldName: string): string {
    const text = this.normalizeOptionalText(value)
    if (!text) {
      throw new BadRequestException(`${fieldName} is required.`)
    }

    return text
  }

  private normalizeFeedbackText(value: unknown): string | null {
    const text = this.normalizeOptionalText(value)
    if (!text) return null
    if (text.length > QUICK_CONSULT_RECOMMENDATION_FEEDBACK_MAX_LENGTH) {
      throw new BadRequestException(
        `Recommendation feedback text must be ${QUICK_CONSULT_RECOMMENDATION_FEEDBACK_MAX_LENGTH} characters or fewer.`,
      )
    }

    return text
  }

  private normalizeOptionalText(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }

  private normalizeStringArray(value: unknown): string[] {
    const values = Array.isArray(value) ? value : []
    const seen = new Set<string>()

    return values
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim())
      .filter((item) => {
        if (seen.has(item)) return false
        seen.add(item)
        return true
      })
  }

  private normalizeOptionalNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
  }

  private readRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined
    }

    return value as Record<string, unknown>
  }
}
