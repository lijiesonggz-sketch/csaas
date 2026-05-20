import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DeepPartial, Repository } from 'typeorm'
import { AdvisoryQuickConsultContext } from '../../../database/entities/advisory-quick-consult-context.entity'
import { BaseRepository } from '../../../database/repositories/base.repository'

@Injectable()
export class QuickConsultContextRepository extends BaseRepository<AdvisoryQuickConsultContext> {
  constructor(
    @InjectRepository(AdvisoryQuickConsultContext)
    repository: Repository<AdvisoryQuickConsultContext>,
  ) {
    super(repository)
  }

  async createContext(
    tenantId: string,
    data: DeepPartial<AdvisoryQuickConsultContext>,
  ): Promise<AdvisoryQuickConsultContext> {
    return this.create(tenantId, data)
  }

  async findContextForActor(
    tenantId: string,
    contextId: string,
    actorId: string,
  ): Promise<AdvisoryQuickConsultContext | null> {
    return this.findOneWhere(tenantId, { id: contextId, actorId } as never)
  }

  async updateContext(
    tenantId: string,
    contextId: string,
    data: DeepPartial<AdvisoryQuickConsultContext>,
  ): Promise<AdvisoryQuickConsultContext | null> {
    return this.update(tenantId, contextId, data)
  }
}
