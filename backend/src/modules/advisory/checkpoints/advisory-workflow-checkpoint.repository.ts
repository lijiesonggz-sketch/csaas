import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DeepPartial, EntityManager, Repository } from 'typeorm'
import { AdvisoryWorkflowSession } from '../../../database/entities/advisory-workflow-session.entity'
import { AdvisoryWorkflowCheckpoint } from '../../../database/entities/advisory-workflow-checkpoint.entity'
import { BaseRepository } from '../../../database/repositories/base.repository'

@Injectable()
export class AdvisoryWorkflowCheckpointRepository extends BaseRepository<AdvisoryWorkflowCheckpoint> {
  constructor(
    @InjectRepository(AdvisoryWorkflowCheckpoint)
    repository: Repository<AdvisoryWorkflowCheckpoint>,
  ) {
    super(repository)
  }

  async archiveCheckpoint(
    tenantId: string,
    data: DeepPartial<AdvisoryWorkflowCheckpoint>,
  ): Promise<AdvisoryWorkflowCheckpoint> {
    this.assertScopeValue(tenantId, 'tenantId')
    this.assertScopeValue(data.sessionId, 'id')
    await this.assertSessionBelongsToTenant(tenantId, data.sessionId)

    const safeData = { ...((data ?? {}) as Record<string, unknown>) }
    delete safeData.id
    delete safeData.createdAt
    delete safeData.updatedAt
    delete safeData.sequence

    const manager = this.repository.manager
    if (typeof manager?.transaction !== 'function') {
      return this.archiveCheckpointWithoutTransaction(tenantId, safeData)
    }

    return manager.transaction(async (transactionalManager) => {
      await this.lockCheckpointSequence(transactionalManager, tenantId, data.sessionId as string)
      const scopedRepository = transactionalManager.getRepository(AdvisoryWorkflowCheckpoint)
      const maxSequence = await scopedRepository.maximum('sequence', {
        tenantId,
        sessionId: data.sessionId as string,
      })
      const entity = scopedRepository.create({
        ...safeData,
        tenantId,
        sequence: (maxSequence ?? 0) + 1,
        lastActivityAt: data.lastActivityAt ?? new Date(),
        metadata: data.metadata ?? {},
      } as DeepPartial<AdvisoryWorkflowCheckpoint>)

      return scopedRepository.save(entity)
    })
  }

  async findLatestCheckpoint(
    tenantId: string,
    sessionId: string,
  ): Promise<AdvisoryWorkflowCheckpoint | null> {
    this.assertScopeValue(sessionId, 'id')

    return this.findOneWhere(
      tenantId,
      {
        sessionId,
      } as never,
      {
        order: {
          lastActivityAt: 'DESC',
          createdAt: 'DESC',
          sequence: 'DESC',
        },
      },
    )
  }

  private async assertSessionBelongsToTenant(tenantId: string, sessionId: string): Promise<void> {
    const manager = this.repository.manager
    if (typeof manager?.count !== 'function') return

    const count = await manager.count(AdvisoryWorkflowSession, {
      where: {
        id: sessionId,
        tenantId,
      },
    })

    if (count < 1) {
      throw new BadRequestException('sessionId must belong to tenantId for checkpoint archive')
    }
  }

  private async archiveCheckpointWithoutTransaction(
    tenantId: string,
    data: Record<string, unknown>,
  ): Promise<AdvisoryWorkflowCheckpoint> {
    const maxSequence = await this.repository.maximum?.('sequence', {
      tenantId,
      sessionId: data.sessionId as string,
    } as never)

    return this.create(tenantId, {
      ...data,
      sequence: (maxSequence ?? 0) + 1,
      lastActivityAt: data.lastActivityAt ?? new Date(),
      metadata: data.metadata ?? {},
    } as DeepPartial<AdvisoryWorkflowCheckpoint>)
  }

  private async lockCheckpointSequence(
    manager: EntityManager,
    tenantId: string,
    sessionId: string,
  ): Promise<void> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `workflow_checkpoints:${tenantId}:${sessionId}`,
    ])
  }
}
