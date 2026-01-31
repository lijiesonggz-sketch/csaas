import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WatchedTopic } from '../../../database/entities/watched-topic.entity';
import { CreateWatchedTopicDto } from '../dto/watched-topic.dto';

/**
 * Service for managing watched topics
 *
 * @story Story 5.1 - Configure Focus Technical Areas
 */
@Injectable()
export class WatchedTopicService {
  constructor(
    @InjectRepository(WatchedTopic)
    private readonly repository: Repository<WatchedTopic>,
  ) {}

  /**
   * Create a new watched topic
   *
   * @throws ConflictException if topic already exists for organization
   */
  async create(
    organizationId: string,
    dto: CreateWatchedTopicDto,
  ): Promise<WatchedTopic> {
    // 1. Check if topic already exists
    const existing = await this.repository.findOne({
      where: {
        organizationId,
        topicName: dto.topicName,
        topicType: dto.topicType || 'tech',
      },
    });

    if (existing) {
      throw new ConflictException('该领域已在关注列表中');
    }

    // 2. Create new topic
    const topic = this.repository.create({
      ...dto,
      organizationId,
      source: 'manual',
    });

    return await this.repository.save(topic);
  }

  /**
   * Find all watched topics for an organization
   *
   * @returns Topics ordered by creation date (newest first)
   */
  async findAll(organizationId: string): Promise<WatchedTopic[]> {
    return await this.repository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Delete a watched topic
   *
   * @throws NotFoundException if topic doesn't exist or doesn't belong to organization
   */
  async delete(id: string, organizationId: string): Promise<void> {
    const result = await this.repository.delete({
      id,
      organizationId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('关注领域不存在');
    }
  }

  /**
   * Get count of related pushes for a topic
   *
   * @returns Count of pushes related to this topic (MVP: returns 0)
   */
  async getRelatedPushCount(topicId: string): Promise<number> {
    // MVP phase: return 0
    // Future: Query RadarPush table matching categories field
    return 0;
  }
}
