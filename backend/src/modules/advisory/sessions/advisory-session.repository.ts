import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DeepPartial, Repository } from 'typeorm'
import {
  AdvisoryWorkflowSession,
  AdvisoryWorkflowSessionStatus,
} from '../../../database/entities/advisory-workflow-session.entity'
import { BaseRepository } from '../../../database/repositories/base.repository'

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
