import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WatchedPeer } from '../entities/watched-peer.entity';
import { BaseTenantRepository } from './base-tenant.repository';

/**
 * WatchedPeerRepository
 *
 * 监控同业Repository，继承BaseTenantRepository自动添加tenantId过滤
 *
 * @module backend/src/database/repositories/watched-peer.repository
 * @story 6-1A
 */
@Injectable()
export class WatchedPeerRepository extends BaseTenantRepository<WatchedPeer> {
  constructor(
    @InjectRepository(WatchedPeer)
    repository: Repository<WatchedPeer>,
  ) {
    super(repository, 'WatchedPeer');
  }

  /**
   * 根据组织ID查找监控同业
   */
  async findByOrganization(tenantId: string, organizationId: string): Promise<WatchedPeer[]> {
    return this.find(tenantId, {
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 根据同业类型查找
   */
  async findByType(tenantId: string, peerType: string): Promise<WatchedPeer[]> {
    return this.find(tenantId, {
      where: { peerType } as any,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 查找未删除的监控同业
   */
  async findActive(tenantId: string): Promise<WatchedPeer[]> {
    return this.find(tenantId, {
      where: { deletedAt: null } as any,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 根据同业名称查找
   */
  async findByPeerName(tenantId: string, peerName: string): Promise<WatchedPeer | null> {
    return this.findOne(tenantId, { where: { peerName } as any });
  }

  /**
   * 查找指定组织的未删除同业
   */
  async findActiveByOrganization(
    tenantId: string,
    organizationId: string,
  ): Promise<WatchedPeer[]> {
    const qb = this.createQueryBuilder(tenantId, 'peer');
    return qb
      .where('peer.organizationId = :organizationId', { organizationId })
      .andWhere('peer.deletedAt IS NULL')
      .orderBy('peer.createdAt', 'DESC')
      .getMany();
  }
}
