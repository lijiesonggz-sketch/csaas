import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WatchedTopicService } from '../services/watched-topic.service';
import {
  CreateWatchedTopicDto,
  WatchedTopicResponseDto,
} from '../dto/watched-topic.dto';
import { WatchedTopic } from '../../../database/entities/watched-topic.entity';
import { OrganizationGuard } from '../../organizations/guards/organization.guard';
import { CurrentOrg } from '../../organizations/decorators/current-org.decorator';

/**
 * Controller for managing watched topics
 *
 * @story Story 5.1 - Configure Focus Technical Areas
 */
@Controller('radar/watched-topics')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class WatchedTopicController {
  constructor(private readonly service: WatchedTopicService) {}

  /**
   * Create a new watched topic
   *
   * POST /api/radar/watched-topics
   */
  @Post()
  async create(
    @CurrentOrg() orgId: string,
    @Body() dto: CreateWatchedTopicDto,
  ): Promise<WatchedTopicResponseDto> {
    const topic = await this.service.create(orgId, dto);
    return this.toResponseDto(topic);
  }

  /**
   * Get all watched topics for current organization
   *
   * GET /api/radar/watched-topics
   */
  @Get()
  async findAll(
    @CurrentOrg() orgId: string,
  ): Promise<WatchedTopicResponseDto[]> {
    const topics = await this.service.findAll(orgId);
    return topics.map((t) => this.toResponseDto(t));
  }

  /**
   * Delete a watched topic
   *
   * DELETE /api/radar/watched-topics/:id
   */
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentOrg() orgId: string,
  ): Promise<{ message: string }> {
    await this.service.delete(id, orgId);
    return { message: '已取消关注' };
  }

  /**
   * Convert entity to response DTO
   */
  private toResponseDto(topic: WatchedTopic): WatchedTopicResponseDto {
    return {
      id: topic.id,
      organizationId: topic.organizationId,
      topicName: topic.topicName,
      topicType: topic.topicType,
      description: topic.description,
      createdAt: topic.createdAt.toISOString(),
      relatedPushCount: 0, // MVP: always 0
    };
  }
}
