import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { WatchedPeerService } from '../services/watched-peer.service'
import { CreateWatchedPeerDto, WatchedPeerResponseDto } from '../dto/watched-peer.dto'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { OrganizationGuard } from '../../organizations/guards/organization.guard'
import { AuditInterceptor } from '../../../common/interceptors/audit.interceptor'
import { CurrentOrg } from '../../organizations/decorators/current-org.decorator'
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator'

/**
 * Controller for managing watched peers
 *
 * @story Story 5.2 - Configure Focus Peer Institutions
 * @story Story 6.1A - Multi-tenant API/Service Layer Isolation
 * @story Story 6.1B - Database Layer RLS & Audit Layer
 */
@Controller('radar/watched-peers')
@UseGuards(JwtAuthGuard, TenantGuard, OrganizationGuard)
@UseInterceptors(AuditInterceptor)
export class WatchedPeerController {
  constructor(private readonly service: WatchedPeerService) {}

  /**
   * Create a new watched peer
   * POST /api/radar/watched-peers
   * AC #2: 添加关注同业功能
   */
  @Post()
  async create(
    @CurrentTenant() tenantId: string,
    @CurrentOrg() orgId: string,
    @Body() dto: CreateWatchedPeerDto,
  ): Promise<WatchedPeerResponseDto> {
    const peer = await this.service.create(tenantId, orgId, dto)
    return this.toResponseDto(peer)
  }

  /**
   * Get all watched peers for current organization
   * GET /api/radar/watched-peers
   * AC #4: 关注同业列表显示
   */
  @Get()
  async findAll(
    @CurrentTenant() tenantId: string,
    @CurrentOrg() orgId: string,
  ): Promise<WatchedPeerResponseDto[]> {
    const peers = await this.service.findAll(tenantId, orgId)
    return peers.map((p) => this.toResponseDto(p))
  }

  /**
   * Delete a watched peer
   * DELETE /api/radar/watched-peers/:id
   * AC #3: 删除关注同业功能
   */
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentOrg() orgId: string,
  ): Promise<{ message: string }> {
    await this.service.delete(id, tenantId, orgId)
    return { message: '已取消关注' }
  }

  /**
   * Convert entity to response DTO
   */
  private toResponseDto(peer: any): WatchedPeerResponseDto {
    return {
      id: peer.id,
      organizationId: peer.organizationId,
      peerName: peer.peerName,
      industry: peer.industry,
      institutionType: peer.institutionType,
      description: peer.description,
      createdAt: peer.createdAt.toISOString(),
      relatedPushCount: 0, // MVP阶段返回0
    }
  }
}
