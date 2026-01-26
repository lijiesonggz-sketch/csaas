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
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { Throttler } from '@nestjs/throttler'
import { OrganizationsService } from './organizations.service'
import { OrganizationAutoCreateService } from './organization-auto-create.service'
import { OrganizationOwnershipGuard } from './guards/organization-ownership.guard'
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  OrganizationStatsDto,
  UserOrganizationResponse,
} from './dto/create-organization.dto'

/**
 * OrganizationsController
 *
 * REST API controller for organization management.
 * Provides endpoints for CRUD operations on organizations.
 *
 * @module backend/src/modules/organizations
 */
@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
@UseGuards(OrganizationOwnershipGuard) // Apply guard globally to all routes
export class OrganizationsController {
  private readonly logger = new Logger(OrganizationsController.name)

  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly orgAutoCreateService: OrganizationAutoCreateService,
  ) {}

  /**
   * Get current user's organization
   * GET /organizations/me
   */
  @Get('me')
  @ApiOperation({ summary: '获取当前用户的组织' })
  @ApiResponse({ status: 200, description: '成功返回用户组织' })
  @ApiResponse({ status: 401, description: '未认证' })
  @ApiResponse({ status: 404, description: '用户没有组织' })
  async getCurrentUserOrganization(
    @Request() req,
  ): Promise<UserOrganizationResponse | null> {
    const userId = req.user?.id || req.user?.sub

    return this.organizationsService.getUserOrganization(userId)
  }

  /**
   * Get organization by ID
   * GET /organizations/:id
   */
  @Get(':id')
  @ApiOperation({ summary: '获取组织详情' })
  @ApiResponse({ status: 200, description: '成功返回组织信息' })
  @ApiResponse({ status: 403, description: '无权访问该组织' })
  @ApiResponse({ status: 404, description: '组织不存在' })
  async getOrganization(@Param('id') id: string) {
    return this.organizationsService.getOrganizationById(id)
  }

  /**
   * Get organization statistics
   * GET /organizations/:id/stats
   */
  @Get(':id/stats')
  @ApiOperation({ summary: '获取组织统计信息' })
  @ApiResponse({ status: 200, description: '成功返回统计信息' })
  async getStats(@Param('id') id: string): Promise<OrganizationStatsDto> {
    return this.organizationsService.getOrganizationStats(id)
  }

  /**
   * Update organization
   * PUT /organizations/:id
   */
  @Put(':id')
  @ApiOperation({ summary: '更新组织信息' })
  @ApiResponse({ status: 200, description: '成功更新组织' })
  @ApiResponse({ status: 400, description: '验证失败' })
  @ApiResponse({ status: 403, description: '无权修改（仅管理员）' })
  async updateOrganization(
    @Param('id') id: string,
    @Body() updateDto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.updateOrganization(id, updateDto)
  }

  /**
   * Get organization members
   * GET /organizations/:id/members
   */
  @Get(':id/members')
  @ApiOperation({ summary: '获取组织成员列表' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: '成功返回成员列表' })
  async getOrganizationMembers(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) {
    // TODO: Implement member list with pagination
    return this.organizationsService.getOrganizationById(id)
  }

  /**
   * Add a member to an organization
   * POST /organizations/:id/members
   *
   * Rate limited: 10 requests per minute
   */
  @Post(':id/members')
  @Throttler({ limit: 10, ttl: 60000 }) // 10 requests per minute
  @ApiOperation({ summary: '添加组织成员' })
  @ApiResponse({ status: 201, description: '成功添加成员' })
  @ApiResponse({ status: 400, description: '验证失败或用户已是成员' })
  @ApiResponse({ status: 403, description: '无权添加成员（仅管理员）' })
  @ApiResponse({ status: 404, description: '组织或用户不存在' })
  @ApiResponse({ status: 429, description: '超过速率限制' })
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
  @ApiOperation({ summary: '移除组织成员' })
  @ApiResponse({ status: 200, description: '成功移除成员' })
  @ApiResponse({ status: 403, description: '无权移除成员（仅管理员）' })
  @ApiResponse({ status: 404, description: '成员不存在' })
  async removeMember(
    @Param('id') orgId: string,
    @Param('userId') userId: string,
  ): Promise<{ message: string }> {
    await this.organizationsService.removeMember(orgId, userId)

    return {
      message: '成员移除成功',
    }
  }

  /**
   * Link a project to user's organization
   * POST /organizations/link-project
   *
   * Rate limited: 20 requests per minute
   */
  @Post('link-project')
  @Throttler({ limit: 20, ttl: 60000 }) // 20 requests per minute
  @ApiOperation({ summary: '关联项目到组织' })
  @ApiResponse({ status: 200, description: '项目关联成功' })
  @ApiResponse({ status: 400, description: '项目不存在' })
  @ApiResponse({ status: 404, description: '用户没有组织' })
  @ApiResponse({ status: 429, description: '超过速率限制' })
  async linkProject(
    @Request() req,
    @Body() body: { projectId: string },
  ): Promise<{ message: string }> {
    const userId = req.user?.id || req.user?.sub

    await this.organizationsService.linkProjectToOrganization(
      userId,
      body.projectId,
    )

    return {
      message: '项目已成功关联到组织',
    }
  }

  /**
   * Get organization projects with pagination
   * GET /organizations/:id/projects
   */
  @Get(':id/projects')
  @ApiOperation({ summary: '获取组织项目列表（分页）' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: '成功返回项目列表' })
  async getOrganizationProjects(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) {
    // TODO: Implement with pagination
    return this.organizationsService.getOrganizationById(id)
  }
}
