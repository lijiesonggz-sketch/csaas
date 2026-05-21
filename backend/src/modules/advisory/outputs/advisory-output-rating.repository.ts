import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import {
  AdvisoryOutputRating,
  AdvisoryOutputRatingMetadata,
} from '../../../database/entities/advisory-output-rating.entity'
import { BaseRepository } from '../../../database/repositories/base.repository'

export interface AdvisoryOutputAssetState {
  outputId: string
  rating: number | null
  feedbackTextPresent: boolean
  isFavorited: boolean
  updatedAt: string | null
}

export interface AdvisoryOutputRatingUpsertInput {
  actorId: string
  sessionId: string
  outputId: string
  rating: number
  feedbackText?: string | null
  feedbackTextProvided?: boolean
  metadata?: AdvisoryOutputRatingMetadata
}

export interface AdvisoryOutputFavoriteUpsertInput {
  actorId: string
  sessionId: string
  outputId: string
  isFavorited: boolean
  metadata?: AdvisoryOutputRatingMetadata
}

@Injectable()
export class AdvisoryOutputRatingRepository extends BaseRepository<AdvisoryOutputRating> {
  constructor(
    @InjectRepository(AdvisoryOutputRating)
    repository: Repository<AdvisoryOutputRating>,
  ) {
    super(repository)
  }

  async upsertRating(
    tenantId: string,
    input: AdvisoryOutputRatingUpsertInput,
  ): Promise<AdvisoryOutputRating> {
    this.assertValidRating(input.rating)
    this.assertScopeValue(tenantId, 'tenantId')
    this.assertScopeValue(input.actorId, 'id')
    this.assertScopeValue(input.sessionId, 'id')
    this.assertScopeValue(input.outputId, 'id')
    const feedbackTextProvided = input.feedbackTextProvided ?? input.feedbackText !== undefined

    const rows = await this.repository.query(
      `
        INSERT INTO "output_ratings" (
          "tenant_id",
          "actor_id",
          "session_id",
          "output_id",
          "rating",
          "feedback_text",
          "is_favorited",
          "rated_at",
          "favorited_at",
          "metadata"
        )
        VALUES ($1, $2, $3, $4, $5, $6, false, now(), NULL, $7::jsonb)
        ON CONFLICT ("tenant_id", "actor_id", "output_id") DO UPDATE
        SET
          "session_id" = EXCLUDED."session_id",
          "rating" = EXCLUDED."rating",
          "feedback_text" = CASE
            WHEN $8::boolean THEN EXCLUDED."feedback_text"
            ELSE "output_ratings"."feedback_text"
          END,
          "rated_at" = now(),
          "metadata" = "output_ratings"."metadata" || EXCLUDED."metadata",
          "updated_at" = now()
        RETURNING
          "id",
          "tenant_id" AS "tenantId",
          "actor_id" AS "actorId",
          "output_id" AS "outputId",
          "session_id" AS "sessionId",
          "rating",
          "feedback_text" AS "feedbackText",
          "is_favorited" AS "isFavorited",
          "rated_at" AS "ratedAt",
          "favorited_at" AS "favoritedAt",
          "metadata",
          "created_at" AS "createdAt",
          "updated_at" AS "updatedAt"
      `,
      [
        tenantId,
        input.actorId,
        input.sessionId,
        input.outputId,
        input.rating,
        input.feedbackText ?? null,
        JSON.stringify(input.metadata ?? {}),
        feedbackTextProvided,
      ],
    )

    return this.toRatingEntity(rows[0])
  }

  async upsertFavorite(
    tenantId: string,
    input: AdvisoryOutputFavoriteUpsertInput,
  ): Promise<AdvisoryOutputRating> {
    this.assertScopeValue(tenantId, 'tenantId')
    this.assertScopeValue(input.actorId, 'id')
    this.assertScopeValue(input.sessionId, 'id')
    this.assertScopeValue(input.outputId, 'id')

    const rows = await this.repository.query(
      `
        INSERT INTO "output_ratings" (
          "tenant_id",
          "actor_id",
          "session_id",
          "output_id",
          "rating",
          "feedback_text",
          "is_favorited",
          "rated_at",
          "favorited_at",
          "metadata"
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          NULL,
          NULL,
          $5,
          NULL,
          CASE WHEN $5::boolean THEN now() ELSE NULL END,
          $6::jsonb
        )
        ON CONFLICT ("tenant_id", "actor_id", "output_id") DO UPDATE
        SET
          "session_id" = EXCLUDED."session_id",
          "is_favorited" = EXCLUDED."is_favorited",
          "favorited_at" = EXCLUDED."favorited_at",
          "metadata" = "output_ratings"."metadata" || EXCLUDED."metadata",
          "updated_at" = now()
        RETURNING
          "id",
          "tenant_id" AS "tenantId",
          "actor_id" AS "actorId",
          "output_id" AS "outputId",
          "session_id" AS "sessionId",
          "rating",
          "feedback_text" AS "feedbackText",
          "is_favorited" AS "isFavorited",
          "rated_at" AS "ratedAt",
          "favorited_at" AS "favoritedAt",
          "metadata",
          "created_at" AS "createdAt",
          "updated_at" AS "updatedAt"
      `,
      [
        tenantId,
        input.actorId,
        input.sessionId,
        input.outputId,
        input.isFavorited,
        JSON.stringify(input.metadata ?? {}),
      ],
    )

    return this.toRatingEntity(rows[0])
  }

  async findStateForOutput(
    tenantId: string,
    actorId: string,
    outputId: string,
  ): Promise<AdvisoryOutputAssetState> {
    const rating = await this.findRatingRecord(tenantId, actorId, outputId)

    return this.toAssetState(outputId, rating)
  }

  async findStatesForOutputIds(
    tenantId: string,
    actorId: string,
    outputIds: string[],
  ): Promise<AdvisoryOutputAssetState[]> {
    this.assertScopeValue(tenantId, 'tenantId')
    this.assertScopeValue(actorId, 'id')
    const uniqueOutputIds = [
      ...new Set(outputIds.filter((outputId) => this.isNonEmptyText(outputId))),
    ]
    uniqueOutputIds.forEach((outputId) => this.assertScopeValue(outputId, 'id'))
    if (uniqueOutputIds.length === 0) return []

    const ratings = await this.repository
      .createQueryBuilder('rating')
      .where('rating.tenant_id = :tenantId', { tenantId })
      .andWhere('rating.actor_id = :actorId', { actorId })
      .andWhere('rating.output_id IN (:...outputIds)', { outputIds: uniqueOutputIds })
      .getMany()

    return ratings.map((rating) => this.toAssetState(rating.outputId, rating))
  }

  toAssetState(
    outputId: string,
    rating: AdvisoryOutputRating | null | undefined,
  ): AdvisoryOutputAssetState {
    return {
      outputId,
      rating: rating?.rating ?? null,
      feedbackTextPresent: Boolean(rating?.feedbackText?.trim()),
      isFavorited: rating?.isFavorited === true,
      updatedAt: rating?.updatedAt ? rating.updatedAt.toISOString() : null,
    }
  }

  private async findRatingRecord(
    tenantId: string,
    actorId: string,
    outputId: string,
  ): Promise<AdvisoryOutputRating | null> {
    this.assertScopeValue(tenantId, 'tenantId')
    this.assertScopeValue(actorId, 'id')
    this.assertScopeValue(outputId, 'id')

    return this.repository.findOne({
      where: { tenantId, actorId, outputId },
    })
  }

  private assertValidRating(rating: unknown): asserts rating is number {
    if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) {
      throw new BadRequestException('ThinkTank output rating must be an integer from 1 to 5.')
    }
  }

  private toRatingEntity(row: Record<string, unknown> | undefined): AdvisoryOutputRating {
    if (!row) {
      throw new BadRequestException('ThinkTank output rating could not be persisted.')
    }

    return {
      id: row.id as string,
      tenantId: row.tenantId as string,
      actorId: row.actorId as string,
      outputId: row.outputId as string,
      sessionId: row.sessionId as string,
      rating: (row.rating as number | null) ?? null,
      feedbackText: (row.feedbackText as string | null) ?? null,
      isFavorited: row.isFavorited === true,
      ratedAt: this.toOptionalDate(row.ratedAt),
      favoritedAt: this.toOptionalDate(row.favoritedAt),
      metadata:
        row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as AdvisoryOutputRatingMetadata)
          : {},
      createdAt: this.toRequiredDate(row.createdAt),
      updatedAt: this.toRequiredDate(row.updatedAt),
    } as AdvisoryOutputRating
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

  private isNonEmptyText(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0
  }
}
