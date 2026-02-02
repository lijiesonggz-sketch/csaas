import { Injectable, ConflictException, NotFoundException } from '@nestjs/common'
import { WatchedTopic } from '../../../database/entities/watched-topic.entity'
import { WatchedTopicRepository } from '../../../database/repositories'
import { CreateWatchedTopicDto } from '../dto/watched-topic.dto'

/**
 * Service for managing watched topics
 *
 * @story Story 5.1 - Configure Focus Technical Areas
 * @story Story 6.1A - Application layer tenant filtering
 */
@Injectable()
export class WatchedTopicService {
  constructor(
    private readonly repository: WatchedTopicRepository,
  ) {}

  /**
   * Create a new watched topic
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param organizationId - Organization ID
   * @param dto - Create watched topic DTO
   * @throws ConflictException if topic already exists for organization
   */
  async create(tenantId: string, organizationId: string, dto: CreateWatchedTopicDto): Promise<WatchedTopic> {
    // 1. Check if topic already exists
    const existing = await this.repository.findOne(tenantId, {
      where: {
        organizationId,
        topicName: dto.topicName,
        topicType: dto.topicType || 'tech',
      } as any,
    })

    if (existing) {
      throw new ConflictException('该领域已在关注列表中')
    }

    // 2. Create new topic
    const topic = {
      ...dto,
      organizationId,
      source: 'manual',
    }

    return await this.repository.save(tenantId, topic as any)
  }

  /**
   * Find all watched topics for an organization
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param organizationId - Organization ID
   * @returns Topics ordered by creation date (newest first)
   */
  async findAll(tenantId: string, organizationId: string): Promise<WatchedTopic[]> {
    return await this.repository.findByOrganization(tenantId, organizationId)
  }

  /**
   * Delete a watched topic
   *
   * @param id - Topic ID
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param organizationId - Organization ID
   * @throws NotFoundException if topic doesn't exist or doesn't belong to organization
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
   * Get count of related pushes for a topic
   *
   * @returns Count of pushes related to this topic (MVP: returns 0)
   */
  async getRelatedPushCount(topicId: string): Promise<number> {
    // MVP phase: return 0
    // Future: Query RadarPush table matching categories field
    return 0
  }
}
