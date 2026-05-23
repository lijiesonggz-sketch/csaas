import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DeepPartial, Repository } from 'typeorm'
import { AdvisoryRecommendationFeedback } from '../../../database/entities/advisory-recommendation-feedback.entity'
import { BaseRepository } from '../../../database/repositories/base.repository'
import {
  AdvisoryQualityFeedbackSourceQuery,
  AdvisoryQualityRecommendationFeedbackRow,
} from '../operations/advisory-quality-feedback.types'

@Injectable()
export class QuickConsultRecommendationFeedbackRepository extends BaseRepository<AdvisoryRecommendationFeedback> {
  constructor(
    @InjectRepository(AdvisoryRecommendationFeedback)
    repository: Repository<AdvisoryRecommendationFeedback>,
  ) {
    super(repository)
  }

  async createFeedback(
    tenantId: string,
    data: DeepPartial<AdvisoryRecommendationFeedback>,
  ): Promise<AdvisoryRecommendationFeedback> {
    return this.create(tenantId, data)
  }

  async findFeedbackForContext(
    tenantId: string,
    actorId: string,
    quickConsultContextId: string,
  ): Promise<AdvisoryRecommendationFeedback | null> {
    return this.findOneWhere(tenantId, {
      actorId,
      quickConsultContextId,
    } as never)
  }

  async findForQualityAggregation(
    query: AdvisoryQualityFeedbackSourceQuery,
  ): Promise<AdvisoryQualityRecommendationFeedbackRow[]> {
    this.assertScopeValue(query.tenantId, 'tenantId')

    const rows = await this.repository.query(
      `
        SELECT
          "id",
          "tenant_id" AS "tenantId",
          "actor_id" AS "actorId",
          "rating",
          ("feedback_text" IS NOT NULL AND length(trim("feedback_text")) > 0) AS "feedbackTextPresent",
          "primary_problem_type" AS "primaryProblemType",
          "recommendation_ids" AS "recommendationIds",
          "workflow_keys" AS "workflowKeys",
          "metadata",
          "created_at" AS "createdAt",
          "updated_at" AS "updatedAt"
        FROM "recommendation_feedback"
        WHERE "tenant_id" = $1
          AND "created_at" >= $2
          AND "created_at" <= $3
        ORDER BY "created_at" ASC
      `,
      [query.tenantId, query.dateFrom, query.dateTo],
    )

    return rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      tenantId: row.tenantId as string,
      actorId: (row.actorId as string | null) ?? null,
      rating: row.rating as number,
      feedbackTextPresent: row.feedbackTextPresent === true,
      primaryProblemType: (row.primaryProblemType as string | null) ?? null,
      recommendationIds: Array.isArray(row.recommendationIds)
        ? (row.recommendationIds as string[])
        : [],
      workflowKeys: Array.isArray(row.workflowKeys) ? (row.workflowKeys as string[]) : [],
      metadata: row.metadata,
      createdAt: this.toRequiredDate(row.createdAt),
      updatedAt: this.toOptionalDate(row.updatedAt),
    }))
  }

  private toOptionalDate(value: unknown): Date | null {
    if (!value) return null
    if (value instanceof Date) return value
    return new Date(value as string)
  }

  private toRequiredDate(value: unknown): Date {
    if (value instanceof Date) return value
    return new Date(value as string)
  }
}
