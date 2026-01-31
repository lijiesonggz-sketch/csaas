import { Injectable, ConflictException, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { WatchedPeer } from '../../../database/entities/watched-peer.entity'
import { CreateWatchedPeerDto } from '../dto/watched-peer.dto'

@Injectable()
export class WatchedPeerService {
  constructor(
    @InjectRepository(WatchedPeer)
    private readonly repository: Repository<WatchedPeer>,
  ) {}

  /**
   * Create a new watched peer
   * AC #2: 添加关注同业功能
   */
  async create(
    organizationId: string,
    dto: CreateWatchedPeerDto,
  ): Promise<WatchedPeer> {
    // 1. 检查是否已存在
    const existing = await this.repository.findOne({
      where: {
        organizationId,
        peerName: dto.peerName,
      },
    })

    if (existing) {
      throw new ConflictException('该同业机构已在关注列表中')
    }

    // 2. 创建记录
    const peer = this.repository.create({
      ...dto,
      organizationId,
    })

    return await this.repository.save(peer)
  }

  /**
   * Find all watched peers for an organization
   * AC #4: 关注同业列表显示
   */
  async findAll(organizationId: string): Promise<WatchedPeer[]> {
    return await this.repository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    })
  }

  /**
   * Delete a watched peer
   * AC #3: 删除关注同业功能
   */
  async delete(id: string, organizationId: string): Promise<void> {
    const result = await this.repository.delete({
      id,
      organizationId,
    })

    if (result.affected === 0) {
      throw new NotFoundException('关注同业不存在')
    }
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
