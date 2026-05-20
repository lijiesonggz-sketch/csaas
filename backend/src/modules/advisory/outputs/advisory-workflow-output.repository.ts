import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DeepPartial, Repository } from 'typeorm'
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
      } as never,
      order: {
        createdAt: 'DESC',
      },
    })
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
      await sessionRepository.update(
        { id: sessionId, tenantId } as never,
        {
          status: AdvisoryWorkflowSessionStatus.Completed,
          metadata: data.sessionMetadata,
        } as never,
      )

      return outputRepository.findOne({
        where: { id: output.id, tenantId } as never,
      })
    })
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
