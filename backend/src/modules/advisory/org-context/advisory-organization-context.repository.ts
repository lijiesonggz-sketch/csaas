import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DeepPartial, Repository } from 'typeorm'
import {
  ADVISORY_ORGANIZATION_CONTEXT_ENTERPRISE_BACKGROUND,
  AdvisoryOrganizationContext,
} from '../../../database/entities/advisory-organization-context.entity'
import { BaseRepository } from '../../../database/repositories/base.repository'

@Injectable()
export class AdvisoryOrganizationContextRepository extends BaseRepository<AdvisoryOrganizationContext> {
  constructor(
    @InjectRepository(AdvisoryOrganizationContext)
    repository: Repository<AdvisoryOrganizationContext>,
  ) {
    super(repository)
  }

  async findEnterpriseBackground(tenantId: string): Promise<AdvisoryOrganizationContext | null> {
    return this.findOneWhere(tenantId, {
      contextType: ADVISORY_ORGANIZATION_CONTEXT_ENTERPRISE_BACKGROUND,
    } as never)
  }

  async createEnterpriseBackground(
    tenantId: string,
    data: DeepPartial<AdvisoryOrganizationContext>,
  ): Promise<AdvisoryOrganizationContext> {
    return this.create(tenantId, this.stripImmutableOrganizationContextFields(data))
  }

  async updateEnterpriseBackground(
    tenantId: string,
    contextId: string,
    data: DeepPartial<AdvisoryOrganizationContext>,
  ): Promise<AdvisoryOrganizationContext | null> {
    return this.update(tenantId, contextId, this.stripImmutableOrganizationContextFields(data))
  }

  private stripImmutableOrganizationContextFields(
    data: DeepPartial<AdvisoryOrganizationContext>,
  ): DeepPartial<AdvisoryOrganizationContext> {
    const safeData = { ...((data ?? {}) as Record<string, unknown>) }
    delete safeData.id
    delete safeData.tenantId
    delete safeData.createdAt
    delete safeData.updatedAt
    return safeData as DeepPartial<AdvisoryOrganizationContext>
  }
}
