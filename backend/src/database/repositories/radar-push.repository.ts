import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RadarPush } from '../entities/radar-push.entity';
import { BaseTenantRepository } from './base-tenant.repository';

/**
 * RadarPushRepository
 *
 * 雷达推送Repository，继承BaseTenantRepository自动添加tenantId过滤
 *
 * 使用示例：
 * ```typescript
 * // 在Service中
 * constructor(private readonly radarPushRepo: RadarPushRepository) {}
 *
 * async findAll(tenantId: string) {
 *   // 自动添加tenantId过滤
 *   return this.radarPushRepo.find(tenantId);
 * }
 *
 * async findById(tenantId: string, id: string) {
 *   // 自动添加tenantId过滤
 *   return this.radarPushRepo.findById(tenantId, id);
 * }
 *
 * async create(tenantId: string, data: Partial<RadarPush>) {
 *   // 自动设置tenantId
 *   return this.radarPushRepo.save(tenantId, data);
 * }
 * ```
 *
 * @module backend/src/database/repositories/radar-push.repository
 * @story 6-1A
 */
@Injectable()
export class RadarPushRepository extends BaseTenantRepository<RadarPush> {
  constructor(
    @InjectRepository(RadarPush)
    repository: Repository<RadarPush>,
  ) {
    super(repository, 'RadarPush');
  }

  /**
   * 查找指定组织的推送
   */
  async findByOrganization(tenantId: string, organizationId: string): Promise<RadarPush[]> {
    return this.find(tenantId, {
      where: { organizationId },
      order: { scheduledAt: 'DESC' },
    });
  }

  /**
   * 查找待发送的推送
   */
  async findPending(tenantId: string): Promise<RadarPush[]> {
    return this.find(tenantId, {
      where: { status: 'scheduled' },
      order: { scheduledAt: 'ASC' },
    });
  }

  /**
   * 使用QueryBuilder进行复杂查询
   */
  async findWithFilters(
    tenantId: string,
    filters: {
      organizationId?: string;
      radarType?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<RadarPush[]> {
    const qb = this.createQueryBuilder(tenantId, 'push');

    if (filters.organizationId) {
      qb.andWhere('push.organizationId = :organizationId', {
        organizationId: filters.organizationId,
      });
    }

    if (filters.radarType) {
      qb.andWhere('push.radarType = :radarType', { radarType: filters.radarType });
    }

    if (filters.status) {
      qb.andWhere('push.status = :status', { status: filters.status });
    }

    if (filters.startDate) {
      qb.andWhere('push.scheduledAt >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      qb.andWhere('push.scheduledAt <= :endDate', { endDate: filters.endDate });
    }

    return qb.orderBy('push.scheduledAt', 'DESC').getMany();
  }
}
