import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DeepPartial, Repository } from 'typeorm'
import {
  AdvisoryWorkflowSession,
  AdvisoryWorkflowSessionStatus,
} from '../../../database/entities/advisory-workflow-session.entity'
import { BaseRepository } from '../../../database/repositories/base.repository'

export interface AdvisorySessionHistoryRepositoryQuery {
  q?: string
  workflowKey?: string
  status?: 'all' | 'active' | 'completed' | 'draft'
  from?: Date
  to?: Date
  skip?: number
  take?: number
}

export interface AdvisorySessionHistoryRepositoryResult {
  items: AdvisoryWorkflowSession[]
  total: number
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
        status: AdvisoryWorkflowSessionStatus.Active,
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
      .orderBy('session.updated_at', 'DESC')
      .addOrderBy('session.created_at', 'DESC')
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

  async deleteSession(tenantId: string, sessionId: string): Promise<boolean> {
    return this.delete(tenantId, sessionId)
  }
}
