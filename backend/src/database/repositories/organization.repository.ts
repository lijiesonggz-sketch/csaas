import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../entities/organization.entity';
import { BaseTenantRepository } from './base-tenant.repository';

/**
 * OrganizationRepository
 *
 * 组织Repository，继承BaseTenantRepository自动添加tenantId过滤
 *
 * @module backend/src/database/repositories/organization.repository
 * @story 6-1A
 */
@Injectable()
export class OrganizationRepository extends BaseTenantRepository<Organization> {
  constructor(
    @InjectRepository(Organization)
    repository: Repository<Organization>,
  ) {
    super(repository, 'Organization');
  }

  /**
   * 根据名称查找组织
   */
  async findByName(tenantId: string, name: string): Promise<Organization | null> {
    return this.findOne(tenantId, { where: { name } });
  }

  /**
   * 查找激活的组织
   */
  async findActive(tenantId: string): Promise<Organization[]> {
    return this.find(tenantId, {
      where: { deletedAt: null } as any,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 根据行业查找组织
   */
  async findByIndustry(tenantId: string, industryType: string): Promise<Organization[]> {
    return this.find(tenantId, {
      where: { industryType },
      order: { name: 'ASC' },
    });
  }

  /**
   * 查找启用雷达的组织
   */
  async findWithRadarActivated(tenantId: string): Promise<Organization[]> {
    return this.find(tenantId, {
      where: { radarActivated: true },
      order: { name: 'ASC' },
    });
  }

  /**
   * Find all organizations (platform-level, no tenant filter)
   * For admin operations that need to see all clients
   */
  async findAllPlatform(options?: { select?: string[] }): Promise<Organization[]> {
    const qb = this.getRawRepository().createQueryBuilder('org');

    if (options?.select) {
      qb.select(options.select.map(field => `org.${field}`));
    }

    return qb.getMany();
  }

  /**
   * Find organization by ID (platform-level, no tenant filter)
   */
  async findByIdPlatform(id: string): Promise<Organization | null> {
    return this.getRawRepository().findOne({
      where: { id },
    });
  }

  /**
   * Update organization (platform-level, no tenant filter)
   */
  async updatePlatform(id: string, data: Partial<Organization>): Promise<void> {
    await this.getRawRepository().update(id, data);
  }
}
