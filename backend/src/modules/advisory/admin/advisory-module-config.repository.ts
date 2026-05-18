import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DeepPartial, Repository } from 'typeorm'
import { AdvisoryModuleConfig } from '../../../database/entities/advisory-module-config.entity'
import { BaseRepository } from '../../../database/repositories/base.repository'

@Injectable()
export class AdvisoryModuleConfigRepository extends BaseRepository<AdvisoryModuleConfig> {
  constructor(
    @InjectRepository(AdvisoryModuleConfig)
    repository: Repository<AdvisoryModuleConfig>,
  ) {
    super(repository)
  }

  async findByModuleKey(tenantId: string, moduleKey: string): Promise<AdvisoryModuleConfig | null> {
    return this.findOneWhere(tenantId, { moduleKey } as never)
  }

  async createForTenant(
    tenantId: string,
    data: DeepPartial<AdvisoryModuleConfig>,
  ): Promise<AdvisoryModuleConfig> {
    return this.create(tenantId, data)
  }

  async updateForTenant(
    tenantId: string,
    id: string,
    data: DeepPartial<AdvisoryModuleConfig>,
  ): Promise<AdvisoryModuleConfig | null> {
    return this.update(tenantId, id, data)
  }

  async deleteForTenant(tenantId: string, id: string): Promise<void> {
    await this.delete(tenantId, id)
  }
}
