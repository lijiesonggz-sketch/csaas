import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushPreference } from '../entities/push-preference.entity';
import { BaseTenantRepository } from './base-tenant.repository';

/**
 * PushPreferenceRepository
 *
 * 推送偏好Repository，继承BaseTenantRepository自动添加tenantId过滤
 *
 * @module backend/src/database/repositories/push-preference.repository
 * @story 6-1A
 */
@Injectable()
export class PushPreferenceRepository extends BaseTenantRepository<PushPreference> {
  constructor(
    @InjectRepository(PushPreference)
    repository: Repository<PushPreference>,
  ) {
    super(repository, 'PushPreference');
  }

  /**
   * 根据组织ID查找推送偏好
   */
  async findByOrganization(tenantId: string, organizationId: string): Promise<PushPreference | null> {
    return this.findOne(tenantId, { where: { organizationId } });
  }

  /**
   * 根据组织ID和雷达类型查找
   */
  async findByOrganizationAndType(
    tenantId: string,
    organizationId: string,
    radarType: string,
  ): Promise<PushPreference | null> {
    return this.findOne(tenantId, {
      where: { organizationId, radarType } as any,
    });
  }

  /**
   * 查找启用推送的组织
   */
  async findEnabledOrganizations(tenantId: string): Promise<PushPreference[]> {
    const qb = this.createQueryBuilder(tenantId, 'pref');
    return qb
      .where('pref.pushEnabled = :enabled', { enabled: true })
      .orderBy('pref.createdAt', 'DESC')
      .getMany();
  }
}
