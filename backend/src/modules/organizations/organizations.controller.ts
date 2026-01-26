import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  Logger,
  ParseIntPipe,
  DefaultValuePipe,
  Inject,
} from '@nestjs/common'
import { OrganizationsService } from './organizations.service'
import { OrganizationAutoCreateService } from './organization-auto-create.service'
import { WeaknessSnapshotService } from './weakness-snapshot.service'
import { OrganizationOwnershipGuard } from './guards/organization-ownership.guard'
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  OrganizationStatsDto,
  UserOrganizationResponse,
} from './dto/create-organization.dto'
import { AuditAction } from '../../database/entities/audit-log.entity'

/**
 * OrganizationsController
 *
 * REST API controller for organization management.
 * Provides endpoints for CRUD operations on organizations.
 *
 * SECURITY TODO: Add @UseGuards(AuthGuard) to all endpoints once JWT auth is implemented
 * Current fallback to x-user-id header is TEMPORARY and should be removed
 *
 * @module backend/src/modules/organizations
 */
@Controller('organizations')
export class OrganizationsController {
  private readonly logger = new Logger(OrganizationsController.name)

  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly orgAutoCreateService: OrganizationAutoCreateService,
    private readonly weaknessSnapshotService: WeaknessSnapshotService,
    @Inject('AuditLogService') private readonly auditLogService: any,
  ) {}

  /**
   * Get current user's organization
   * GET /organizations/me
   */
  @Get('me')
  async getCurrentUserOrganization(
    @Request() req,
  ): Promise<UserOrganizationResponse | null> {
    const userId = req.user?.id || req.user?.sub || req.headers['x-user-id'] as string

    return this.organizationsService.getUserOrganization(userId)
  }

  /**
   * Get organization by ID
   * GET /organizations/:id
   */
  @Get(':id')
  async getOrganization(@Param('id') id: string) {
    return this.organizationsService.getOrganizationById(id)
  }

  /**
   * Get organization statistics
   * GET /organizations/:id/stats
   */
  @Get(':id/stats')
  async getStats(@Param('id') id: string): Promise<OrganizationStatsDto> {
    return this.organizationsService.getOrganizationStats(id)
  }

  /**
   * Update organization
   * PUT /organizations/:id
   */
  @Put(':id')
  async updateOrganization(
    @Param('id') id: string,
    @Body() updateDto: UpdateOrganizationDto,
    @Request() req,
  ) {
    const userId = req.user?.id || req.user?.sub || req.headers['x-user-id'] as string
    const result = await this.organizationsService.updateOrganization(
      id,
      updateDto,
    )

    // Log audit
    await this.auditLogService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'Organization',
      entityId: id,
      success: true,
      req,
    })

    return result
  }

  /**
   * Get organization members
   * GET /organizations/:id/members
   */
  @Get(':id/members')
  async getOrganizationMembers(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) {
    return this.organizationsService.getOrganizationMembersPaginated(
      id,
      page,
      limit,
    )
  }

  /**
   * Add a member to an organization
   * POST /organizations/:id/members
   */
  @Post(':id/members')
  async addMember(
    @Param('id') orgId: string,
    @Body() body: { userId: string; role?: 'admin' | 'member' },
  ) {
    return this.organizationsService.addMember(
      orgId,
      body.userId,
      body.role || 'member',
    )
  }

  /**
   * Remove a member from an organization
   * DELETE /organizations/:id/members/:userId
   */
  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id') orgId: string,
    @Param('userId') userId: string,
    @Request() req,
  ): Promise<{ message: string }> {
    const currentUserId = req.user?.id || req.user?.sub || req.headers['x-user-id'] as string

    await this.organizationsService.removeMember(orgId, userId)

    // Log audit
    await this.auditLogService.log({
      userId: currentUserId,
      action: AuditAction.DELETE,
      entityType: 'OrganizationMember',
      entityId: userId,
      success: true,
      req,
    })

    return {
      message: '成员移除成功',
    }
  }

  /**
   * Link a project to user's organization
   * POST /organizations/link-project
   */
  @Post('link-project')
  async linkProject(
    @Request() req,
    @Body() body: { projectId: string },
  ): Promise<{ message: string }> {
    const userId = req.user?.id || req.user?.sub || req.headers['x-user-id'] as string
    const { projectId } = body

    await this.organizationsService.linkProjectToOrganization(
      userId,
      projectId,
    )

    // Log audit
    await this.auditLogService.log({
      userId,
      projectId,
      action: 'LINK_PROJECT',
      entityType: 'Project',
      entityId: projectId,
      success: true,
      req,
    })

    return {
      message: '项目已成功关联到组织',
    }
  }

  /**
   * Get organization projects with pagination
   * GET /organizations/:id/projects
   */
  @Get(':id/projects')
  async getOrganizationProjects(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) {
    return this.organizationsService.getOrganizationProjectsPaginated(
      id,
      page,
      limit,
    )
  }

  /**
   * Get organization weaknesses
   * GET /organizations/:id/weaknesses
   */
  @Get(':id/weaknesses')
  async getOrganizationWeaknesses(@Param('id') id: string) {
    return this.weaknessSnapshotService.getWeaknessesByOrganization(id)
  }

  /**
   * Get aggregated weaknesses for an organization
   * GET /organizations/:id/weaknesses/aggregated
   */
  @Get(':id/weaknesses/aggregated')
  async getAggregatedWeaknesses(
    @Param('id') id: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.weaknessSnapshotService.aggregateWeaknesses(id, projectId)
  }

  /**
   * Create weakness snapshot from assessment result
   * POST /organizations/:id/weaknesses/snapshot
   */
  @Post(':id/weaknesses/snapshot')
  async createWeaknessSnapshot(
    @Param('id') organizationId: string,
    @Body() body: {
      projectId: string
      categories: Array<{
        name: string
        level: number
      }>
    },
  ) {
    return this.weaknessSnapshotService.createSnapshotFromAssessment(
      organizationId,
      body.projectId,
      { categories: body.categories },
    )
  }
}
