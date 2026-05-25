import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DeepPartial, In, Repository } from 'typeorm'
import {
  AdvisoryWorkflowOutput,
  AdvisoryWorkflowOutputStatus,
} from '../../../database/entities/advisory-workflow-output.entity'
import {
  AdvisoryWorkflowSession,
  AdvisoryWorkflowSessionStatus,
} from '../../../database/entities/advisory-workflow-session.entity'
import { BaseRepository } from '../../../database/repositories/base.repository'

export interface AdvisorySessionHistoryRepositoryQuery {
  q?: string
  workflowKey?: string
  status?: 'all' | 'active' | 'paused' | 'completed' | 'draft'
  from?: Date
  to?: Date
  skip?: number
  take?: number
}

export interface AdvisorySessionHistoryRepositoryResult {
  items: AdvisoryWorkflowSession[]
  total: number
}

export interface AdvisorySessionLifecycleUpdateResult {
  session: AdvisoryWorkflowSession
  previousStatus: AdvisoryWorkflowSessionStatus
}

export interface AdvisorySessionTombstoneResult extends AdvisorySessionLifecycleUpdateResult {
  outputIds: string[]
  deletedOutputCount: number
}

@Injectable()
export class AdvisorySessionRepository extends BaseRepository<AdvisoryWorkflowSession> {
  constructor(
    @InjectRepository(AdvisoryWorkflowSession)
    repository: Repository<AdvisoryWorkflowSession>,
  ) {
    super(repository)
  }

  async createLaunchSession(
    tenantId: string,
    data: DeepPartial<AdvisoryWorkflowSession>,
  ): Promise<AdvisoryWorkflowSession> {
    return this.create(tenantId, {
      ...data,
      status: data.status ?? AdvisoryWorkflowSessionStatus.Active,
      failureCode: data.failureCode ?? null,
      failureMessage: data.failureMessage ?? null,
    })
  }

  async findSessionById(
    tenantId: string,
    sessionId: string,
  ): Promise<AdvisoryWorkflowSession | null> {
    return this.findOne(tenantId, sessionId)
  }

  async findActiveSessionForActor(
    tenantId: string,
    actorId: string,
  ): Promise<AdvisoryWorkflowSession | null> {
    return this.findOneWhere(tenantId, {
      actorId,
      status: AdvisoryWorkflowSessionStatus.Active,
    } as never)
  }

  async findUnfinishedSessionsForActor(
    tenantId: string,
    actorId: string,
  ): Promise<AdvisoryWorkflowSession[]> {
    this.assertScopeValue(actorId, 'id')

    return this.findAll(tenantId, {
      where: {
        actorId,
        status: In([AdvisoryWorkflowSessionStatus.Active, AdvisoryWorkflowSessionStatus.Paused]),
      } as never,
      order: {
        updatedAt: 'DESC',
        createdAt: 'DESC',
      },
      take: 10,
    })
  }

  async findHistorySessionsForActor(
    tenantId: string,
    actorId: string,
    query: AdvisorySessionHistoryRepositoryQuery = {},
  ): Promise<AdvisorySessionHistoryRepositoryResult> {
    this.assertScopeValue(tenantId, 'tenantId')
    this.assertScopeValue(actorId, 'id')

    const queryBuilder = this.repository
      .createQueryBuilder('session')
      .where('session.tenant_id = :tenantId', { tenantId })
      .andWhere('session.actor_id = :actorId', { actorId })

    if (query.workflowKey) {
      queryBuilder.andWhere('session.workflow_key = :workflowKey', {
        workflowKey: query.workflowKey,
      })
    }

    if (query.status && query.status !== 'all') {
      queryBuilder.andWhere('session.status = :status', { status: query.status })
    } else {
      queryBuilder.andWhere('session.status IN (:...historyStatuses)', {
        historyStatuses: [
          AdvisoryWorkflowSessionStatus.Active,
          AdvisoryWorkflowSessionStatus.Paused,
          AdvisoryWorkflowSessionStatus.Completed,
        ],
      })
    }

    if (query.from) {
      queryBuilder.andWhere('session.updated_at >= :from', { from: query.from })
    }
    if (query.to) {
      queryBuilder.andWhere('session.updated_at <= :to', { to: query.to })
    }
    if (query.q) {
      const historySearch = `%${this.escapeHistoryLikeTerm(query.q.toLowerCase())}%`
      queryBuilder.andWhere(
        [
          '(',
          "LOWER(session.workflow_display_name) LIKE :historySearch ESCAPE '\\'",
          "OR LOWER(session.scenario_label) LIKE :historySearch ESCAPE '\\'",
          "OR LOWER(COALESCE(session.metadata ->> 'title', '')) LIKE :historySearch ESCAPE '\\'",
          "OR LOWER(session.workflow_key) LIKE :historySearch ESCAPE '\\'",
          ')',
        ].join(' '),
        { historySearch },
      )
    }

    queryBuilder
      .orderBy('session.updatedAt', 'DESC')
      .addOrderBy('session.createdAt', 'DESC')
      .addOrderBy('session.id', 'ASC')

    if (query.skip && query.skip > 0) {
      queryBuilder.skip(query.skip)
    }
    if (query.take && query.take > 0) {
      queryBuilder.take(query.take)
    }

    const [items, total] = await queryBuilder.getManyAndCount()

    return { items, total }
  }

  private escapeHistoryLikeTerm(value: string): string {
    return value.replace(/[\\%_]/g, (match) => `\\${match}`)
  }

  async updateSession(
    tenantId: string,
    sessionId: string,
    data: DeepPartial<AdvisoryWorkflowSession>,
  ): Promise<AdvisoryWorkflowSession | null> {
    const safeData = { ...((data ?? {}) as Record<string, unknown>) }
    delete safeData.actorId
    delete safeData.workflowKey
    delete safeData.workflowDisplayName
    delete safeData.scenarioLabel

    return this.update(tenantId, sessionId, safeData as DeepPartial<AdvisoryWorkflowSession>)
  }

  async claimPartyModeStart(
    tenantId: string,
    sessionId: string,
    actorId: string,
    metadata: Record<string, unknown>,
  ): Promise<AdvisoryWorkflowSession | null> {
    this.assertScopeValue(tenantId, 'tenantId')
    this.assertScopeValue(sessionId, 'id')
    this.assertScopeValue(actorId, 'id')

    const result = await this.repository
      .createQueryBuilder()
      .update(AdvisoryWorkflowSession)
      .set({
        metadata: () => `COALESCE("metadata", '{}'::jsonb) || CAST(:metadata AS jsonb)`,
      } as never)
      .where('"id" = :sessionId')
      .andWhere('"tenant_id" = :tenantId')
      .andWhere('"actor_id" = :actorId')
      .andWhere('"status" = :status')
      .andWhere(`COALESCE("metadata" ->> 'party_mode_active', 'false') <> 'true'`)
      .setParameters({
        tenantId,
        sessionId,
        actorId,
        status: AdvisoryWorkflowSessionStatus.Active,
        metadata: JSON.stringify(metadata),
      })
      .execute()

    if ((result.affected ?? 0) !== 1) return null

    return this.findSessionById(tenantId, sessionId)
  }

  async finalizePartyModeStart(
    tenantId: string,
    sessionId: string,
    actorId: string,
    metadata: Record<string, unknown>,
  ): Promise<AdvisoryWorkflowSession | null> {
    return this.mergePartyModeMetadata(
      tenantId,
      sessionId,
      actorId,
      metadata,
      `COALESCE("metadata" ->> 'party_mode_active', 'false') = 'true'`,
      `"metadata" ->> 'party_mode_status' = :partyModeStatus`,
      { partyModeStatus: 'starting' },
    )
  }

  async rollbackPartyModeStart(
    tenantId: string,
    sessionId: string,
    actorId: string,
    metadata: Record<string, unknown>,
  ): Promise<boolean> {
    const session = await this.mergePartyModeMetadata(
      tenantId,
      sessionId,
      actorId,
      metadata,
      `COALESCE("metadata" ->> 'party_mode_active', 'false') = 'true'`,
      `"metadata" ->> 'party_mode_status' = :partyModeStatus`,
      { partyModeStatus: 'starting' },
    )

    return Boolean(session)
  }

  async claimPartyModeReturn(
    tenantId: string,
    sessionId: string,
    actorId: string,
    metadata: Record<string, unknown>,
  ): Promise<AdvisoryWorkflowSession | null> {
    return this.mergePartyModeMetadata(
      tenantId,
      sessionId,
      actorId,
      metadata,
      `COALESCE("metadata" ->> 'party_mode_active', 'false') = 'true'`,
      `"metadata" ->> 'party_mode_status' = :partyModeStatus`,
      { partyModeStatus: 'context-created' },
    )
  }

  async finalizePartyModeReturn(
    tenantId: string,
    sessionId: string,
    actorId: string,
    metadata: Record<string, unknown>,
  ): Promise<AdvisoryWorkflowSession | null> {
    return this.mergePartyModeMetadata(
      tenantId,
      sessionId,
      actorId,
      metadata,
      `COALESCE("metadata" ->> 'party_mode_active', 'false') = 'true'`,
      `"metadata" ->> 'party_mode_status' = :partyModeStatus`,
      { partyModeStatus: 'returning' },
    )
  }

  async rollbackPartyModeReturn(
    tenantId: string,
    sessionId: string,
    actorId: string,
    metadata: Record<string, unknown>,
  ): Promise<boolean> {
    const session = await this.mergePartyModeMetadata(
      tenantId,
      sessionId,
      actorId,
      metadata,
      `COALESCE("metadata" ->> 'party_mode_active', 'false') = 'true'`,
      `"metadata" ->> 'party_mode_status' = :partyModeStatus`,
      { partyModeStatus: 'returning' },
    )

    return Boolean(session)
  }

  async deleteSession(tenantId: string, sessionId: string): Promise<boolean> {
    return this.delete(tenantId, sessionId)
  }

  private async mergePartyModeMetadata(
    tenantId: string,
    sessionId: string,
    actorId: string,
    metadata: Record<string, unknown>,
    activePredicate: string,
    statusPredicate: string,
    statusParameters: Record<string, unknown>,
  ): Promise<AdvisoryWorkflowSession | null> {
    this.assertScopeValue(tenantId, 'tenantId')
    this.assertScopeValue(sessionId, 'id')
    this.assertScopeValue(actorId, 'id')

    const result = await this.repository
      .createQueryBuilder()
      .update(AdvisoryWorkflowSession)
      .set({
        metadata: () => `COALESCE("metadata", '{}'::jsonb) || CAST(:metadata AS jsonb)`,
      } as never)
      .where('"id" = :sessionId')
      .andWhere('"tenant_id" = :tenantId')
      .andWhere('"actor_id" = :actorId')
      .andWhere('"status" = :status')
      .andWhere(activePredicate)
      .andWhere(statusPredicate)
      .setParameters({
        tenantId,
        sessionId,
        actorId,
        status: AdvisoryWorkflowSessionStatus.Active,
        metadata: JSON.stringify(metadata),
        ...statusParameters,
      })
      .execute()

    if ((result.affected ?? 0) !== 1) return null

    return this.findSessionById(tenantId, sessionId)
  }

  async pauseActiveSessionForActor(
    tenantId: string,
    sessionId: string,
    actorId: string,
    metadata: Record<string, unknown>,
  ): Promise<AdvisorySessionLifecycleUpdateResult | null> {
    this.assertScopeValue(tenantId, 'tenantId')
    this.assertScopeValue(sessionId, 'id')
    this.assertScopeValue(actorId, 'id')

    const session = await this.repository.findOne({
      where: {
        id: sessionId,
        tenantId,
        actorId,
        status: AdvisoryWorkflowSessionStatus.Active,
      } as never,
    })
    if (!session) return null

    const previousStatus = session.status
    const result = await this.repository.update(
      { id: session.id, tenantId, actorId, status: AdvisoryWorkflowSessionStatus.Active } as never,
      {
        status: AdvisoryWorkflowSessionStatus.Paused,
        metadata: {
          ...(session.metadata ?? {}),
          ...metadata,
          previous_status: previousStatus,
        },
      } as never,
    )
    if ((result.affected ?? 0) !== 1) return null

    const paused = await this.repository.findOne({
      where: {
        id: session.id,
        tenantId,
        actorId,
        status: AdvisoryWorkflowSessionStatus.Paused,
      } as never,
    })

    return paused ? { session: paused, previousStatus } : null
  }

  async reactivatePausedSessionForActor(
    tenantId: string,
    sessionId: string,
    actorId: string,
    metadata: Record<string, unknown>,
  ): Promise<AdvisoryWorkflowSession | null> {
    this.assertScopeValue(tenantId, 'tenantId')
    this.assertScopeValue(sessionId, 'id')
    this.assertScopeValue(actorId, 'id')

    const result = await this.repository.update(
      { id: sessionId, tenantId, actorId, status: AdvisoryWorkflowSessionStatus.Paused } as never,
      {
        status: AdvisoryWorkflowSessionStatus.Active,
        metadata: metadata as never,
      } as never,
    )
    if ((result.affected ?? 0) === 0) return null

    return this.findSessionById(tenantId, sessionId)
  }

  async tombstoneSessionWithOutputs(context: {
    tenantId: string
    sessionId: string
    actorId: string
    deletedAt: string
  }): Promise<AdvisorySessionTombstoneResult | null> {
    this.assertScopeValue(context.tenantId, 'tenantId')
    this.assertScopeValue(context.sessionId, 'id')
    this.assertScopeValue(context.actorId, 'id')

    const manager = this.repository.manager
    if (typeof manager?.transaction !== 'function') {
      return this.tombstoneSessionWithOutputsWithoutTransaction(context)
    }

    return manager.transaction(async (transactionalManager) => {
      const sessionRepository = transactionalManager.getRepository(AdvisoryWorkflowSession)
      const outputRepository = transactionalManager.getRepository(AdvisoryWorkflowOutput)
      const session = await sessionRepository.findOne({
        where: {
          id: context.sessionId,
          tenantId: context.tenantId,
          actorId: context.actorId,
          status: In([AdvisoryWorkflowSessionStatus.Active, AdvisoryWorkflowSessionStatus.Paused]),
        } as never,
        lock: { mode: 'pessimistic_write' },
      })
      if (!session) return null

      const outputs = await outputRepository.find({
        where: {
          tenantId: context.tenantId,
          sessionId: session.id,
          actorId: context.actorId,
          status: In([AdvisoryWorkflowOutputStatus.Draft, AdvisoryWorkflowOutputStatus.Completed]),
        } as never,
      })
      const outputIds = outputs.map((output) => output.id)

      if (outputIds.length > 0) {
        await outputRepository
          .createQueryBuilder()
          .update(AdvisoryWorkflowOutput)
          .set({
            status: AdvisoryWorkflowOutputStatus.Deleted,
            metadata: () =>
              `COALESCE("metadata", '{}'::jsonb) || jsonb_build_object('deleted_at', CAST(:deletedAt AS text), 'deleted_by', CAST(:deletedBy AS text), 'delete_source', CAST(:deleteSource AS text), 'previous_status', "status")`,
          } as never)
          .where('tenant_id = :tenantId', { tenantId: context.tenantId })
          .andWhere('session_id = :sessionId', { sessionId: session.id })
          .andWhere('actor_id = :actorId', { actorId: context.actorId })
          .andWhere('status IN (:...statuses)', {
            statuses: [AdvisoryWorkflowOutputStatus.Draft, AdvisoryWorkflowOutputStatus.Completed],
          })
          .setParameters({
            deletedAt: context.deletedAt,
            deletedBy: context.actorId,
            deleteSource: 'session_delete',
          })
          .execute()
      }

      await sessionRepository.update(
        { id: session.id, tenantId: context.tenantId, actorId: context.actorId } as never,
        {
          status: AdvisoryWorkflowSessionStatus.Deleted,
          metadata: {
            ...(session.metadata ?? {}),
            deleted_at: context.deletedAt,
            deleted_by: context.actorId,
            delete_source: 'user_destructive_action',
            previous_status: session.status,
            deleted_output_count: outputIds.length,
          },
        } as never,
      )
      const deleted = await sessionRepository.findOne({
        where: { id: session.id, tenantId: context.tenantId } as never,
      })

      return deleted
        ? {
            session: deleted,
            previousStatus: session.status,
            outputIds,
            deletedOutputCount: outputIds.length,
          }
        : null
    })
  }

  private async tombstoneSessionWithOutputsWithoutTransaction(context: {
    tenantId: string
    sessionId: string
    actorId: string
    deletedAt: string
  }): Promise<AdvisorySessionTombstoneResult | null> {
    const session = await this.repository.findOne({
      where: {
        id: context.sessionId,
        tenantId: context.tenantId,
        actorId: context.actorId,
        status: In([AdvisoryWorkflowSessionStatus.Active, AdvisoryWorkflowSessionStatus.Paused]),
      } as never,
    })
    if (!session) return null

    const outputRepository = this.repository.manager.getRepository(AdvisoryWorkflowOutput)
    const outputs = await outputRepository.find({
      where: {
        tenantId: context.tenantId,
        sessionId: session.id,
        actorId: context.actorId,
        status: In([AdvisoryWorkflowOutputStatus.Draft, AdvisoryWorkflowOutputStatus.Completed]),
      } as never,
    })
    const outputIds = outputs.map((output) => output.id)

    await Promise.all(
      outputs.map((output) =>
        outputRepository.update(
          { id: output.id, tenantId: context.tenantId } as never,
          {
            status: AdvisoryWorkflowOutputStatus.Deleted,
            metadata: {
              ...(output.metadata ?? {}),
              deleted_at: context.deletedAt,
              deleted_by: context.actorId,
              delete_source: 'session_delete',
              previous_status: output.status,
            },
          } as never,
        ),
      ),
    )

    await this.repository.update(
      { id: session.id, tenantId: context.tenantId, actorId: context.actorId } as never,
      {
        status: AdvisoryWorkflowSessionStatus.Deleted,
        metadata: {
          ...(session.metadata ?? {}),
          deleted_at: context.deletedAt,
          deleted_by: context.actorId,
          delete_source: 'user_destructive_action',
          previous_status: session.status,
          deleted_output_count: outputIds.length,
        },
      } as never,
    )
    const deleted = await this.findSessionById(context.tenantId, session.id)

    return deleted
      ? {
          session: deleted,
          previousStatus: session.status,
          outputIds,
          deletedOutputCount: outputIds.length,
        }
      : null
  }
}
