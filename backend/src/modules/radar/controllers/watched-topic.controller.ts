import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../organizations/guards/tenant.guard';
import { OrganizationGuard } from '../../organizations/guards/organization.guard';
import { AuditInterceptor } from '../../../common/interceptors/audit.interceptor';
import { WatchedTopicService } from '../services/watched-topic.service';
import {
  CreateWatchedTopicDto,
  WatchedTopicResponseDto,
} from '../dto/watched-topic.dto';
import { WatchedTopic } from '../../../database/entities/watched-topic.entity';
import { CurrentOrg } from '../../organizations/decorators/current-org.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';

/**
 * Controller for managing watched topics
 *
 * @story Story 5.1 - Configure Focus Technical Areas
 * @story Story 6.1A - Multi-tenant API/Service Layer Isolation
 * @story Story 6.1B - Database Layer RLS & Audit Layer
 */
@Controller('radar/watched-topics')
@UseGuards(JwtAuthGuard, TenantGuard, OrganizationGuard)
@UseInterceptors(AuditInterceptor)
export class WatchedTopicController {
  constructor(private readonly service: WatchedTopicService) {}

  /**
   * Create a new watched topic
   *
   * POST /api/radar/watched-topics
   */
  @Post()
  async create(
    @CurrentTenant() tenantId: string,
    @CurrentOrg() currentOrg: { organizationId: string; userId: string },
    @Body() dto: CreateWatchedTopicDto,
  ): Promise<WatchedTopicResponseDto> {
    const topic = await this.service.create(tenantId, currentOrg.organizationId, dto);
    return this.toResponseDto(topic);
  }

  /**
   * Get all watched topics for current organization
   *
   * GET /api/radar/watched-topics
   */
  @Get()
  async findAll(
    @CurrentTenant() tenantId: string,
    @CurrentOrg() currentOrg: { organizationId: string; userId: string },
  ): Promise<WatchedTopicResponseDto[]> {
    const topics = await this.service.findAll(tenantId, currentOrg.organizationId);
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
    @CurrentTenant() tenantId: string,
    @CurrentOrg() currentOrg: { organizationId: string; userId: string },
  ): Promise<{ message: string }> {
    await this.service.delete(id, tenantId, currentOrg.organizationId);
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
