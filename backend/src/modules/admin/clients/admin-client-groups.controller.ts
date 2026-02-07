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
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, In } from 'typeorm'
import { ClientGroup } from '../../../database/entities/client-group.entity'
import { ClientGroupMembership } from '../../../database/entities/client-group-membership.entity'
import { Organization } from '../../../database/entities/organization.entity'
import { CreateClientGroupDto, AddClientsToGroupDto } from './dto/create-client-group.dto'
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard'
import { TenantGuard } from '../../../modules/organizations/guards/tenant.guard'
import { RolesGuard } from '../../../modules/auth/guards/roles.guard'
import { Roles } from '../../../common/decorators/roles.decorator'
import { UserRole } from '../../../database/entities'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'

/**
 * Admin Client Groups Controller
 *
 * REST API controller for managing client groups.
 *
 * @story 6-2
 * @route /api/v1/admin/client-groups
 */
@ApiTags('Admin - Client Groups')
@ApiBearerAuth()
@Controller('api/v1/admin/client-groups')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminClientGroupsController {
  constructor(
    @InjectRepository(ClientGroup)
    private readonly clientGroupRepository: Repository<ClientGroup>,
    @InjectRepository(ClientGroupMembership)
    private readonly membershipRepository: Repository<ClientGroupMembership>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取客户分组列表', description: '获取当前租户的所有客户分组' })
  @ApiResponse({ status: 200, description: '成功返回分组列表' })
  async findAll(@Request() req) {
    const tenantId = req.tenantId
    return this.clientGroupRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      relations: ['memberships', 'memberships.organization'],
    })
  }

  @Get(':id')
  @ApiOperation({ summary: '获取分组详情', description: '获取单个客户分组的详细信息' })
  @ApiResponse({ status: 200, description: '成功返回分组详情' })
  @ApiResponse({ status: 404, description: '分组不存在' })
  async findOne(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const tenantId = req.tenantId
    const group = await this.clientGroupRepository.findOne({
      where: { id, tenantId },
      relations: ['memberships', 'memberships.organization'],
    })

    if (!group) {
      throw new NotFoundException('Group not found')
    }

    return group
  }

  @Post()
  @ApiOperation({ summary: '创建客户分组', description: '创建新的客户分组' })
  @ApiResponse({ status: 201, description: '分组创建成功' })
  async create(@Request() req, @Body() dto: CreateClientGroupDto) {
    const tenantId = req.tenantId
    const group = this.clientGroupRepository.create({
      ...dto,
      tenantId,
    })
    return this.clientGroupRepository.save(group)
  }

  @Put(':id')
  @ApiOperation({ summary: '更新客户分组', description: '更新客户分组信息' })
  @ApiResponse({ status: 200, description: '分组更新成功' })
  @ApiResponse({ status: 404, description: '分组不存在' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClientGroupDto,
  ) {
    const tenantId = req.tenantId
    const group = await this.clientGroupRepository.findOne({
      where: { id, tenantId },
    })

    if (!group) {
      throw new NotFoundException('Group not found')
    }

    Object.assign(group, dto)
    return this.clientGroupRepository.save(group)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除客户分组', description: '删除客户分组（级联删除成员关系）' })
  @ApiResponse({ status: 204, description: '分组删除成功' })
  @ApiResponse({ status: 404, description: '分组不存在' })
  async remove(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const tenantId = req.tenantId
    const group = await this.clientGroupRepository.findOne({
      where: { id, tenantId },
    })

    if (!group) {
      throw new NotFoundException('Group not found')
    }

    await this.clientGroupRepository.remove(group)
  }

  @Post(':id/clients')
  @ApiOperation({ summary: '添加客户到分组', description: '将多个客户添加到指定分组' })
  @ApiResponse({ status: 201, description: '客户添加成功' })
  @ApiResponse({ status: 404, description: '分组不存在' })
  @ApiResponse({ status: 400, description: '部分客户不存在' })
  async addClients(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddClientsToGroupDto,
  ) {
    const tenantId = req.tenantId

    // Verify group belongs to tenant
    const group = await this.clientGroupRepository.findOne({
      where: { id, tenantId },
    })

    if (!group) {
      throw new NotFoundException('Group not found')
    }

    // Verify all organizations belong to tenant
    const organizations = await this.organizationRepository.find({
      where: {
        id: In(dto.organizationIds),
        tenantId,
      },
    })

    if (organizations.length !== dto.organizationIds.length) {
      throw new BadRequestException('Some organizations not found or do not belong to this tenant')
    }

    // Create memberships
    const memberships = organizations.map((org) =>
      this.membershipRepository.create({
        groupId: id,
        organizationId: org.id,
      }),
    )

    await this.membershipRepository.save(memberships)

    return { addedCount: memberships.length }
  }

  @Delete(':id/clients/:organizationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '从分组移除客户', description: '将客户从指定分组中移除' })
  @ApiResponse({ status: 204, description: '客户移除成功' })
  @ApiResponse({ status: 404, description: '分组不存在' })
  async removeClient(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    const tenantId = req.tenantId

    // Verify group belongs to tenant
    const group = await this.clientGroupRepository.findOne({
      where: { id, tenantId },
    })

    if (!group) {
      throw new NotFoundException('Group not found')
    }

    // Find and delete membership
    const membership = await this.membershipRepository.findOne({
      where: { groupId: id, organizationId },
    })

    if (membership) {
      await this.membershipRepository.remove(membership)
    }
  }
}
