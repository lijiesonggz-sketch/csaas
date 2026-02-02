import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { BaseTenantRepository } from './base-tenant.repository';

/**
 * ProjectRepository
 *
 * 项目Repository，继承BaseTenantRepository自动添加tenantId过滤
 *
 * @module backend/src/database/repositories/project.repository
 * @story 6-1A
 */
@Injectable()
export class ProjectRepository extends BaseTenantRepository<Project> {
  constructor(
    @InjectRepository(Project)
    repository: Repository<Project>,
  ) {
    super(repository, 'Project');
  }

  /**
   * 根据组织ID查找项目
   */
  async findByOrganization(tenantId: string, organizationId: string): Promise<Project[]> {
    return this.find(tenantId, {
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 根据名称查找项目
   */
  async findByName(tenantId: string, name: string): Promise<Project | null> {
    return this.findOne(tenantId, { where: { name } });
  }

  /**
   * 查找激活的项目
   */
  async findActive(tenantId: string): Promise<Project[]> {
    return this.find(tenantId, {
      where: { deletedAt: null } as any,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 查找指定组织的激活项目
   */
  async findActiveByOrganization(
    tenantId: string,
    organizationId: string,
  ): Promise<Project[]> {
    const qb = this.createQueryBuilder(tenantId, 'project');
    return qb
      .where('project.organizationId = :organizationId', { organizationId })
      .andWhere('project.deletedAt IS NULL')
      .orderBy('project.createdAt', 'DESC')
      .getMany();
  }
}
