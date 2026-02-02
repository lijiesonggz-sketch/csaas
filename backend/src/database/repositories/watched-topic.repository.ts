import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WatchedTopic } from '../entities/watched-topic.entity';
import { BaseTenantRepository } from './base-tenant.repository';

/**
 * WatchedTopicRepository
 *
 * 监控主题Repository，继承BaseTenantRepository自动添加tenantId过滤
 *
 * @module backend/src/database/repositories/watched-topic.repository
 * @story 6-1A
 */
@Injectable()
export class WatchedTopicRepository extends BaseTenantRepository<WatchedTopic> {
  constructor(
    @InjectRepository(WatchedTopic)
    repository: Repository<WatchedTopic>,
  ) {
    super(repository, 'WatchedTopic');
  }

  /**
   * 根据组织ID查找监控主题
   */
  async findByOrganization(tenantId: string, organizationId: string): Promise<WatchedTopic[]> {
    return this.find(tenantId, {
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 根据主题类型查找
   */
  async findByType(tenantId: string, topicType: 'tech' | 'industry'): Promise<WatchedTopic[]> {
    return this.find(tenantId, {
      where: { topicType } as any,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 查找未删除的监控主题
   */
  async findActive(tenantId: string): Promise<WatchedTopic[]> {
    return this.find(tenantId, {
      where: { deletedAt: null } as any,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 根据组织和类型查找
   */
  async findByOrganizationAndType(
    tenantId: string,
    organizationId: string,
    topicType: 'tech' | 'industry',
  ): Promise<WatchedTopic[]> {
    return this.find(tenantId, {
      where: { organizationId, topicType } as any,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 查找指定组织的未删除主题
   */
  async findActiveByOrganization(
    tenantId: string,
    organizationId: string,
  ): Promise<WatchedTopic[]> {
    const qb = this.createQueryBuilder(tenantId, 'topic');
    return qb
      .where('topic.organizationId = :organizationId', { organizationId })
      .andWhere('topic.deletedAt IS NULL')
      .orderBy('topic.createdAt', 'DESC')
      .getMany();
  }
}
