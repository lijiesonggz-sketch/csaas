import { Injectable, ConflictException, NotFoundException } from '@nestjs/common'
import { WatchedPeer } from '../../../database/entities/watched-peer.entity'
import { WatchedPeerRepository } from '../../../database/repositories'
import { CreateWatchedPeerDto } from '../dto/watched-peer.dto'

/**
 * Service for managing watched peers
 *
 * @story Story 5.2 - Configure Focus Peer Institutions
 * @story Story 6.1A - Application layer tenant filtering
 */
@Injectable()
export class WatchedPeerService {
  constructor(
    private readonly repository: WatchedPeerRepository,
  ) {}

  /**
   * Create a new watched peer
   * AC #2: 添加关注同业功能
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param organizationId - Organization ID
   * @param dto - Create watched peer DTO
   */
  async create(tenantId: string, organizationId: string, dto: CreateWatchedPeerDto): Promise<WatchedPeer> {
    // 1. 检查是否已存在
    const existing = await this.repository.findOne(tenantId, {
      where: {
        organizationId,
        peerName: dto.peerName,
      } as any,
    })

    if (existing) {
      throw new ConflictException('该同业机构已在关注列表中')
    }

    // 2. 创建记录
    const peer = {
      ...dto,
      organizationId,
    }

    return await this.repository.save(tenantId, peer as any)
  }

  /**
   * Find all watched peers for an organization
   * AC #4: 关注同业列表显示
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param organizationId - Organization ID
   */
  async findAll(tenantId: string, organizationId: string): Promise<WatchedPeer[]> {
    return await this.repository.findByOrganization(tenantId, organizationId)
  }

  /**
   * Delete a watched peer
   * AC #3: 删除关注同业功能
   *
   * @param id - Peer ID
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param organizationId - Organization ID
   */
  async delete(id: string, tenantId: string, organizationId: string): Promise<void> {
    await this.repository.delete(tenantId, {
      id,
      organizationId,
    } as any)

    // Note: Repository.delete doesn't return affected count
    // If we need to check existence, we should findById first
  }

  /**
   * Get related push count for a peer (MVP: returns 0)
   * AC #4: 相关推送数量统计(可选)
   */
  async getRelatedPushCount(peerId: string): Promise<number> {
    // MVP 阶段返回0
    // 后续可查询 RadarPush 表,匹配 peerName 字段
    return 0
  }
}
