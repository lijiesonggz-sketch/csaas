import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DeepPartial, In, Repository } from 'typeorm'
import {
  AdvisoryWorkflowOutput,
  AdvisoryWorkflowOutputSection,
  AdvisoryWorkflowOutputStatus,
} from '../../../database/entities/advisory-workflow-output.entity'
import {
  AdvisoryWorkflowSession,
  AdvisoryWorkflowSessionStatus,
} from '../../../database/entities/advisory-workflow-session.entity'
import { BaseRepository } from '../../../database/repositories/base.repository'

export interface AdvisoryOutputHistoryRepositoryQuery {
  q?: string
  workflowKey?: string
  status?: 'all' | 'active' | 'paused' | 'completed' | 'draft'
  from?: Date
  to?: Date
  skip?: number
  take?: number
}

export interface AdvisoryOutputHistoryRepositoryResult {
  items: AdvisoryWorkflowOutput[]
  total: number
}

export interface AdvisoryOutputTombstoneResult {
  output: AdvisoryWorkflowOutput
  previousStatus: AdvisoryWorkflowOutputStatus
}

@Injectable()
export class AdvisoryWorkflowOutputRepository extends BaseRepository<AdvisoryWorkflowOutput> {
  constructor(
    @InjectRepository(AdvisoryWorkflowOutput)
    repository: Repository<AdvisoryWorkflowOutput>,
  ) {
    super(repository)
  }

  async createDraft(
    tenantId: string,
    data: DeepPartial<AdvisoryWorkflowOutput>,
  ): Promise<AdvisoryWorkflowOutput> {
    return this.create(tenantId, {
      ...data,
      status: AdvisoryWorkflowOutputStatus.Draft,
      sections: data.sections ?? [],
      contentMarkdown: data.contentMarkdown ?? '',
      metadata: data.metadata ?? {},
    })
  }

  async findOutputById(tenantId: string, outputId: string): Promise<AdvisoryWorkflowOutput | null> {
    return this.findOne(tenantId, outputId)
  }

  async findActiveDraftForSession(
    tenantId: string,
    sessionId: string,
  ): Promise<AdvisoryWorkflowOutput | null> {
    this.assertScopeValue(sessionId, 'id')

    return this.findOneWhere(
      tenantId,
      {
        sessionId,
        status: AdvisoryWorkflowOutputStatus.Draft,
      } as never,
      {
        order: {
          updatedAt: 'DESC',
          createdAt: 'DESC',
        },
      },
    )
  }

  async findLatestCompletedForSession(
    tenantId: string,
    sessionId: string,
  ): Promise<AdvisoryWorkflowOutput | null> {
    this.assertScopeValue(sessionId, 'id')

    return this.findOneWhere(
      tenantId,
      {
        sessionId,
        status: AdvisoryWorkflowOutputStatus.Completed,
      } as never,
      {
        order: {
          updatedAt: 'DESC',
          createdAt: 'DESC',
        },
      },
    )
  }

  async findOutputsBySession(
    tenantId: string,
    sessionId: string,
  ): Promise<AdvisoryWorkflowOutput[]> {
    this.assertScopeValue(sessionId, 'id')

    return this.findAll(tenantId, {
      where: {
        sessionId,
        status: In([AdvisoryWorkflowOutputStatus.Draft, AdvisoryWorkflowOutputStatus.Completed]),
      } as never,
      order: {
        createdAt: 'DESC',
      },
    })
  }

  async findHistoryOutputsForActor(
    tenantId: string,
    actorId: string,
    query: AdvisoryOutputHistoryRepositoryQuery = {},
  ): Promise<AdvisoryOutputHistoryRepositoryResult> {
    this.assertScopeValue(tenantId, 'tenantId')
    this.assertScopeValue(actorId, 'id')

    const queryBuilder = this.repository
      .createQueryBuilder('output')
      .innerJoin(
        AdvisoryWorkflowSession,
        'session',
        'session.id = output.session_id AND session.tenant_id = output.tenant_id',
      )
      .where('output.tenant_id = :tenantId', { tenantId })
      .andWhere('output.actor_id = :actorId', { actorId })
      .andWhere('session.status <> :deletedSessionStatus', {
        deletedSessionStatus: AdvisoryWorkflowSessionStatus.Deleted,
      })

    if (query.workflowKey) {
      queryBuilder.andWhere('output.workflow_key = :workflowKey', {
        workflowKey: query.workflowKey,
      })
    }
    if (query.status && query.status !== 'all') {
      queryBuilder.andWhere('output.status = :status', { status: query.status })
    } else {
      queryBuilder.andWhere('output.status IN (:...historyStatuses)', {
        historyStatuses: [
          AdvisoryWorkflowOutputStatus.Completed,
          AdvisoryWorkflowOutputStatus.Draft,
        ],
      })
    }
    if (query.from) {
      queryBuilder.andWhere('output.updated_at >= :from', { from: query.from })
    }
    if (query.to) {
      queryBuilder.andWhere('output.updated_at <= :to', { to: query.to })
    }
    if (query.q) {
      const historySearch = `%${this.escapeHistoryLikeTerm(query.q.toLowerCase())}%`
      queryBuilder.andWhere(
        [
          '(',
          "LOWER(output.title) LIKE :historySearch ESCAPE '\\'",
          "OR LOWER(output.summary) LIKE :historySearch ESCAPE '\\'",
          "OR LOWER(output.content_markdown) LIKE :historySearch ESCAPE '\\'",
          'OR EXISTS (',
          'SELECT 1',
          'FROM jsonb_array_elements(output.sections) AS history_section(value)',
          "WHERE LOWER(COALESCE(history_section.value ->> 'heading', '')) LIKE :historySearch ESCAPE '\\'",
          "OR LOWER(COALESCE(history_section.value ->> 'contentMarkdown', '')) LIKE :historySearch ESCAPE '\\'",
          ')',
          "OR LOWER(output.workflow_key) LIKE :historySearch ESCAPE '\\'",
          ')',
        ].join(' '),
        { historySearch },
      )
    }

    queryBuilder
      .orderBy('output.updatedAt', 'DESC')
      .addOrderBy('output.createdAt', 'DESC')
      .addOrderBy('output.id', 'ASC')

    if (query.skip && query.skip > 0) {
      queryBuilder.skip(query.skip)
    }
    if (query.take && query.take > 0) {
      queryBuilder.take(query.take)
    }

    const [items, total] = await queryBuilder.getManyAndCount()

    return { items, total }
  }

  async findLatestPersistedBySessionIds(
    tenantId: string,
    sessionIds: string[],
  ): Promise<AdvisoryWorkflowOutput[]> {
    this.assertScopeValue(tenantId, 'tenantId')
    const safeSessionIds = [...new Set(sessionIds)]
    safeSessionIds.forEach((sessionId) => this.assertScopeValue(sessionId, 'id'))
    if (safeSessionIds.length === 0) return []

    const outputs = await this.repository
      .createQueryBuilder('output')
      .where('output.tenant_id = :tenantId', { tenantId })
      .andWhere('output.session_id IN (:...sessionIds)', { sessionIds: safeSessionIds })
      .andWhere('output.status IN (:...historyStatuses)', {
        historyStatuses: [
          AdvisoryWorkflowOutputStatus.Draft,
          AdvisoryWorkflowOutputStatus.Completed,
        ],
      })
      .orderBy('output.sessionId', 'ASC')
      .addOrderBy("CASE WHEN output.status = 'draft' THEN 0 ELSE 1 END", 'ASC')
      .addOrderBy('output.updatedAt', 'DESC')
      .getMany()
    const latestBySession = new Map<string, AdvisoryWorkflowOutput>()
    outputs.forEach((output) => {
      if (!latestBySession.has(output.sessionId)) {
        latestBySession.set(output.sessionId, output)
      }
    })

    return [...latestBySession.values()]
  }

  private escapeHistoryLikeTerm(value: string): string {
    return value.replace(/[\\%_]/g, (match) => `\\${match}`)
  }

  async appendSection(
    tenantId: string,
    outputId: string,
    section: AdvisoryWorkflowOutputSection,
  ): Promise<AdvisoryWorkflowOutput | null> {
    const manager = this.repository.manager

    if (typeof manager?.transaction !== 'function') {
      return this.appendSectionWithoutTransaction(tenantId, outputId, section)
    }

    return manager.transaction(async (transactionalManager) => {
      const repository = transactionalManager.getRepository(AdvisoryWorkflowOutput)
      const output = await repository.findOne({
        where: { id: outputId, tenantId } as never,
        lock: { mode: 'pessimistic_write' },
      })
      if (!output || output.status !== AdvisoryWorkflowOutputStatus.Draft) return null

      const safeSection = this.toSafeSection(section)
      const sections = [...(output.sections ?? []), safeSection]
      const contentMarkdown = this.composeMarkdown(output.title, sections)
      await repository.update(
        { id: output.id, tenantId } as never,
        {
          sections,
          contentMarkdown,
          metadata: {
            ...(output.metadata ?? {}),
            section_count: sections.length,
            last_step_index: safeSection.stepIndex,
          },
        } as never,
      )

      return repository.findOne({
        where: { id: output.id, tenantId } as never,
      })
    })
  }

  async markCompleted(
    tenantId: string,
    outputId: string,
    data: { outcome: string; completedAt: string },
  ): Promise<AdvisoryWorkflowOutput | null> {
    const output = await this.findOutputById(tenantId, outputId)
    if (!output) return null

    return this.update(tenantId, output.id, {
      status: AdvisoryWorkflowOutputStatus.Completed,
      metadata: {
        ...(output.metadata ?? {}),
        section_count: output.sections?.length ?? 0,
        completed_at: data.completedAt,
        outcome: data.outcome,
      },
    })
  }

  async completeDraftAndSession(
    tenantId: string,
    outputId: string,
    sessionId: string,
    data: {
      outcome: string
      completedAt: string
      sessionMetadata: Record<string, unknown>
    },
  ): Promise<AdvisoryWorkflowOutput | null> {
    const manager = this.repository.manager

    if (typeof manager?.transaction !== 'function') {
      const completed = await this.markCompleted(tenantId, outputId, data)
      return completed
    }

    return manager.transaction(async (transactionalManager) => {
      const outputRepository = transactionalManager.getRepository(AdvisoryWorkflowOutput)
      const sessionRepository = transactionalManager.getRepository(AdvisoryWorkflowSession)
      const output = await outputRepository.findOne({
        where: { id: outputId, tenantId, sessionId } as never,
        lock: { mode: 'pessimistic_write' },
      })
      if (!output || output.status !== AdvisoryWorkflowOutputStatus.Draft) return null
      const session = await sessionRepository.findOne({
        where: {
          id: sessionId,
          tenantId,
          status: AdvisoryWorkflowSessionStatus.Active,
        } as never,
        lock: { mode: 'pessimistic_write' },
      })
      if (!session) return null

      await outputRepository.update(
        { id: output.id, tenantId } as never,
        {
          status: AdvisoryWorkflowOutputStatus.Completed,
          metadata: {
            ...(output.metadata ?? {}),
            section_count: output.sections?.length ?? 0,
            completed_at: data.completedAt,
            outcome: data.outcome,
          },
        } as never,
      )
      const sessionUpdate = await sessionRepository.update(
        {
          id: sessionId,
          tenantId,
          status: AdvisoryWorkflowSessionStatus.Active,
        } as never,
        {
          status: AdvisoryWorkflowSessionStatus.Completed,
          metadata: data.sessionMetadata,
        } as never,
      )
      if ((sessionUpdate.affected ?? 0) !== 1) return null

      return outputRepository.findOne({
        where: { id: output.id, tenantId } as never,
      })
    })
  }

  async tombstoneOutputForSession(context: {
    tenantId: string
    actorId: string
    sessionId: string
    outputId: string
    deletedAt: string
  }): Promise<AdvisoryOutputTombstoneResult | null> {
    this.assertScopeValue(context.tenantId, 'tenantId')
    this.assertScopeValue(context.actorId, 'id')
    this.assertScopeValue(context.sessionId, 'id')
    this.assertScopeValue(context.outputId, 'id')

    const output = await this.repository.findOne({
      where: {
        id: context.outputId,
        tenantId: context.tenantId,
        sessionId: context.sessionId,
        actorId: context.actorId,
        status: In([AdvisoryWorkflowOutputStatus.Draft, AdvisoryWorkflowOutputStatus.Completed]),
      } as never,
    })
    if (!output) return null

    const previousStatus = output.status
    const result = await this.repository.update(
      {
        id: output.id,
        tenantId: context.tenantId,
        sessionId: context.sessionId,
        actorId: context.actorId,
        status: In([AdvisoryWorkflowOutputStatus.Draft, AdvisoryWorkflowOutputStatus.Completed]),
      } as never,
      {
        status: AdvisoryWorkflowOutputStatus.Deleted,
        metadata: {
          ...(output.metadata ?? {}),
          deleted_at: context.deletedAt,
          deleted_by: context.actorId,
          delete_source: 'user_destructive_action',
          previous_status: previousStatus,
        },
      } as never,
    )
    if ((result.affected ?? 0) !== 1) return null

    const deleted = await this.repository.findOne({
      where: {
        id: output.id,
        tenantId: context.tenantId,
        sessionId: context.sessionId,
        actorId: context.actorId,
        status: AdvisoryWorkflowOutputStatus.Deleted,
      } as never,
    })

    return deleted ? { output: deleted, previousStatus } : null
  }

  private async appendSectionWithoutTransaction(
    tenantId: string,
    outputId: string,
    section: AdvisoryWorkflowOutputSection,
  ): Promise<AdvisoryWorkflowOutput | null> {
    const output = await this.findOutputById(tenantId, outputId)
    if (!output || output.status !== AdvisoryWorkflowOutputStatus.Draft) return null

    const safeSection = this.toSafeSection(section)
    const sections = [...(output.sections ?? []), safeSection]
    const contentMarkdown = this.composeMarkdown(output.title, sections)

    return this.update(tenantId, output.id, {
      sections,
      contentMarkdown,
      metadata: {
        ...(output.metadata ?? {}),
        section_count: sections.length,
        last_step_index: safeSection.stepIndex,
      },
    })
  }

  private toSafeSection(section: AdvisoryWorkflowOutputSection): AdvisoryWorkflowOutputSection {
    return {
      id: section.id,
      stepIndex: section.stepIndex,
      heading: section.heading,
      contentMarkdown: section.contentMarkdown,
      aiLabel: section.aiLabel,
      metadata: section.metadata ?? {},
      createdAt: section.createdAt,
    }
  }

  private composeMarkdown(title: string, sections: AdvisoryWorkflowOutputSection[]): string {
    const body = sections
      .map((section) => [`## ${section.heading}`, section.contentMarkdown].join('\n\n'))
      .join('\n\n')

    return [`# ${title}`, body].filter(Boolean).join('\n\n')
  }
}
