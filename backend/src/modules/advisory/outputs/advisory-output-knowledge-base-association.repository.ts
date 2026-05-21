import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import {
  ADVISORY_OUTPUT_KB_ASSOCIATION_STATUSES,
  AdvisoryOutputKnowledgeBaseAssociation,
  AdvisoryOutputKnowledgeBaseAssociationAiMetadata,
  AdvisoryOutputKnowledgeBaseAssociationMetadata,
  AdvisoryOutputKnowledgeBaseAssociationStatus,
} from '../../../database/entities/advisory-output-knowledge-base-association.entity'
import { BaseRepository } from '../../../database/repositories/base.repository'

export const DEFAULT_KNOWLEDGE_BASE_DESTINATION_KEY = 'enterprise-knowledge-base'

export interface AdvisoryOutputKnowledgeBaseAssociationState {
  outputId: string
  status: AdvisoryOutputKnowledgeBaseAssociationStatus | null
  destinationKey: string | null
  externalReferenceId: string | null
  message: string | null
  retryCount: number
  updatedAt: string | null
  associatedAt: string | null
}

export interface AdvisoryOutputKnowledgeBaseAssociationUpsertInput {
  actorId: string
  sessionId: string
  outputId: string
  destinationKey?: string
  status: AdvisoryOutputKnowledgeBaseAssociationStatus
  title: string
  summary: string
  sourceWorkflow: string
  filePath: string
  aiMetadata: AdvisoryOutputKnowledgeBaseAssociationAiMetadata
  externalReferenceId?: string | null
  message?: string | null
  metadata?: AdvisoryOutputKnowledgeBaseAssociationMetadata
}

@Injectable()
export class AdvisoryOutputKnowledgeBaseAssociationRepository extends BaseRepository<AdvisoryOutputKnowledgeBaseAssociation> {
  constructor(
    @InjectRepository(AdvisoryOutputKnowledgeBaseAssociation)
    repository: Repository<AdvisoryOutputKnowledgeBaseAssociation>,
  ) {
    super(repository)
  }

  async upsertAttempt(
    tenantId: string,
    input: AdvisoryOutputKnowledgeBaseAssociationUpsertInput,
  ): Promise<AdvisoryOutputKnowledgeBaseAssociation> {
    this.assertScopeValue(tenantId, 'tenantId')
    this.assertScopeValue(input.actorId, 'id')
    this.assertScopeValue(input.sessionId, 'id')
    this.assertScopeValue(input.outputId, 'id')
    const destinationKey = this.normalizeDestinationKey(input.destinationKey)
    const status = this.normalizeStatus(input.status)
    const associatedAtSql = status === 'associated' ? 'now()' : 'NULL'

    const rows = await this.repository.query(
      `
        INSERT INTO "output_knowledge_base_associations" (
          "tenant_id",
          "actor_id",
          "output_id",
          "session_id",
          "destination_key",
          "status",
          "title",
          "summary",
          "source_workflow",
          "file_path",
          "ai_metadata",
          "external_reference_id",
          "message",
          "last_attempt_at",
          "associated_at",
          "retry_count",
          "metadata"
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, now(),
          ${associatedAtSql},
          1,
          $14::jsonb
        )
        ON CONFLICT ("tenant_id", "output_id", "destination_key") DO UPDATE
        SET
          "actor_id" = EXCLUDED."actor_id",
          "session_id" = EXCLUDED."session_id",
          "status" = CASE
            WHEN "output_knowledge_base_associations"."status" = 'associated'
              AND EXCLUDED."status" <> 'associated'
              THEN "output_knowledge_base_associations"."status"
            ELSE EXCLUDED."status"
          END,
          "title" = EXCLUDED."title",
          "summary" = EXCLUDED."summary",
          "source_workflow" = EXCLUDED."source_workflow",
          "file_path" = EXCLUDED."file_path",
          "ai_metadata" = EXCLUDED."ai_metadata",
          "external_reference_id" = CASE
            WHEN "output_knowledge_base_associations"."status" = 'associated'
              AND EXCLUDED."status" <> 'associated'
              THEN "output_knowledge_base_associations"."external_reference_id"
            ELSE EXCLUDED."external_reference_id"
          END,
          "message" = CASE
            WHEN "output_knowledge_base_associations"."status" = 'associated'
              AND EXCLUDED."status" <> 'associated'
              THEN "output_knowledge_base_associations"."message"
            ELSE EXCLUDED."message"
          END,
          "last_attempt_at" = now(),
          "associated_at" = CASE
            WHEN EXCLUDED."status" = 'associated' THEN now()
            ELSE "output_knowledge_base_associations"."associated_at"
          END,
          "retry_count" = "output_knowledge_base_associations"."retry_count" + 1,
          "metadata" = "output_knowledge_base_associations"."metadata" || EXCLUDED."metadata",
          "updated_at" = now()
        RETURNING
          "id",
          "tenant_id" AS "tenantId",
          "actor_id" AS "actorId",
          "output_id" AS "outputId",
          "session_id" AS "sessionId",
          "destination_key" AS "destinationKey",
          "status",
          "title",
          "summary",
          "source_workflow" AS "sourceWorkflow",
          "file_path" AS "filePath",
          "ai_metadata" AS "aiMetadata",
          "external_reference_id" AS "externalReferenceId",
          "message",
          "last_attempt_at" AS "lastAttemptAt",
          "associated_at" AS "associatedAt",
          "retry_count" AS "retryCount",
          "metadata",
          "created_at" AS "createdAt",
          "updated_at" AS "updatedAt"
      `,
      [
        tenantId,
        input.actorId,
        input.outputId,
        input.sessionId,
        destinationKey,
        status,
        this.truncateText(input.title, 500, 'title'),
        input.summary ?? '',
        this.truncateText(input.sourceWorkflow, 120, 'sourceWorkflow'),
        input.filePath,
        JSON.stringify(input.aiMetadata ?? {}),
        input.externalReferenceId ?? null,
        input.message ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    )

    return this.toAssociationEntity(rows[0])
  }

  async findStateForOutput(
    tenantId: string,
    outputId: string,
    destinationKey = DEFAULT_KNOWLEDGE_BASE_DESTINATION_KEY,
  ): Promise<AdvisoryOutputKnowledgeBaseAssociationState> {
    this.assertScopeValue(tenantId, 'tenantId')
    this.assertScopeValue(outputId, 'id')
    const association = await this.repository.findOne({
      where: { tenantId, outputId, destinationKey: this.normalizeDestinationKey(destinationKey) },
    })

    return this.toAssociationState(outputId, association)
  }

  async findStatesForOutputIds(
    tenantId: string,
    outputIds: string[],
    destinationKey = DEFAULT_KNOWLEDGE_BASE_DESTINATION_KEY,
  ): Promise<AdvisoryOutputKnowledgeBaseAssociationState[]> {
    this.assertScopeValue(tenantId, 'tenantId')
    const uniqueOutputIds = [
      ...new Set(outputIds.filter((outputId) => this.isNonEmptyText(outputId))),
    ]
    uniqueOutputIds.forEach((outputId) => this.assertScopeValue(outputId, 'id'))
    if (uniqueOutputIds.length === 0) return []

    const associations = await this.repository
      .createQueryBuilder('association')
      .where('association.tenant_id = :tenantId', { tenantId })
      .andWhere('association.output_id IN (:...outputIds)', { outputIds: uniqueOutputIds })
      .andWhere('association.destination_key = :destinationKey', {
        destinationKey: this.normalizeDestinationKey(destinationKey),
      })
      .getMany()

    return associations.map((association) =>
      this.toAssociationState(association.outputId, association),
    )
  }

  toAssociationState(
    outputId: string,
    association: AdvisoryOutputKnowledgeBaseAssociation | null | undefined,
  ): AdvisoryOutputKnowledgeBaseAssociationState {
    if (!association) {
      return {
        outputId,
        status: null,
        destinationKey: null,
        externalReferenceId: null,
        message: null,
        retryCount: 0,
        updatedAt: null,
        associatedAt: null,
      }
    }

    return {
      outputId,
      status: association.status,
      destinationKey: association.destinationKey,
      externalReferenceId: association.externalReferenceId,
      message: association.message,
      retryCount: association.retryCount,
      updatedAt: association.updatedAt ? association.updatedAt.toISOString() : null,
      associatedAt: association.associatedAt ? association.associatedAt.toISOString() : null,
    }
  }

  private normalizeStatus(
    status: AdvisoryOutputKnowledgeBaseAssociationStatus,
  ): AdvisoryOutputKnowledgeBaseAssociationStatus {
    if (!(ADVISORY_OUTPUT_KB_ASSOCIATION_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestException('Invalid knowledge-base association status.')
    }

    return status
  }

  private normalizeDestinationKey(value: unknown): string {
    const normalized =
      typeof value === 'string' && value.trim()
        ? value.trim()
        : DEFAULT_KNOWLEDGE_BASE_DESTINATION_KEY
    if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(normalized) || normalized.length > 128) {
      throw new BadRequestException('Invalid knowledge-base destination key.')
    }

    return normalized
  }

  private toAssociationEntity(
    row: Record<string, unknown> | undefined,
  ): AdvisoryOutputKnowledgeBaseAssociation {
    if (!row) {
      throw new BadRequestException('ThinkTank knowledge-base association could not be persisted.')
    }

    return {
      id: row.id as string,
      tenantId: row.tenantId as string,
      actorId: row.actorId as string,
      outputId: row.outputId as string,
      sessionId: row.sessionId as string,
      destinationKey: row.destinationKey as string,
      status: row.status as AdvisoryOutputKnowledgeBaseAssociationStatus,
      title: row.title as string,
      summary: row.summary as string,
      sourceWorkflow: row.sourceWorkflow as string,
      filePath: row.filePath as string,
      aiMetadata:
        row.aiMetadata && typeof row.aiMetadata === 'object'
          ? (row.aiMetadata as AdvisoryOutputKnowledgeBaseAssociationAiMetadata)
          : {},
      externalReferenceId: (row.externalReferenceId as string | null) ?? null,
      message: (row.message as string | null) ?? null,
      lastAttemptAt: this.toOptionalDate(row.lastAttemptAt),
      associatedAt: this.toOptionalDate(row.associatedAt),
      retryCount: typeof row.retryCount === 'number' ? row.retryCount : Number(row.retryCount ?? 0),
      metadata:
        row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as AdvisoryOutputKnowledgeBaseAssociationMetadata)
          : {},
      createdAt: this.toRequiredDate(row.createdAt),
      updatedAt: this.toRequiredDate(row.updatedAt),
    } as AdvisoryOutputKnowledgeBaseAssociation
  }

  private truncateText(value: unknown, maxLength: number, fieldName: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${fieldName} is required.`)
    }

    return value.trim().slice(0, maxLength)
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
