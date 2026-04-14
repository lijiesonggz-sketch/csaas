import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { Roles } from '../../../common/decorators/roles.decorator'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AuditLogService } from '../../audit/audit-log.service'
import { CurrentUser } from '../../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import {
  CreateFailureModeControlMapDto,
  CreateFailureModeDto,
  CreateTaxonomyFailureModeMapDto,
  QueryFailureModeDto,
  UpdateFailureModeDto,
} from '../dto/failure-mode.dto'
import { FailureModeService } from '../services/failure-mode.service'

@ApiTags('Knowledge Graph - Failure Modes')
@ApiBearerAuth()
@Controller('api/admin/knowledge-graph')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONSULTANT)
export class FailureModeController {
  constructor(
    private readonly failureModeService: FailureModeService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('failure-modes')
  @ApiOperation({ summary: '获取失效模式列表' })
  async findAll(@Query() query: QueryFailureModeDto) {
    return this.failureModeService.findAll(query)
  }

  @Get('failure-modes/by-taxonomy/:l2Code')
  @ApiOperation({ summary: '按分类获取失效模式' })
  async findByL2Code(
    @Param('l2Code') l2Code: string,
    @Query() query: QueryFailureModeDto,
  ) {
    return this.failureModeService.findByL2Code(l2Code, query)
  }

  @Get('failure-modes/:id')
  @ApiOperation({ summary: '获取失效模式详情' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.failureModeService.findById(id)
  }

  @Post('failure-modes')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '创建失效模式' })
  async create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Body() dto: CreateFailureModeDto,
    @Req() req: Request,
  ) {
    const result = await this.failureModeService.create(dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.CREATE,
      entityType: 'FailureMode',
      entityId: result.failureModeId,
      details: {
        failureModeCode: result.failureModeCode,
        status: result.status,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Patch('failure-modes/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '更新失效模式' })
  async update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFailureModeDto,
    @Req() req: Request,
  ) {
    const result = await this.failureModeService.update(id, dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.UPDATE,
      entityType: 'FailureMode',
      entityId: result.failureModeId,
      details: {
        failureModeCode: result.failureModeCode,
        status: result.status,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Get('failure-modes/:id/control-points')
  @ApiOperation({ summary: '获取失效模式关联的控制点' })
  async findControlPoints(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryFailureModeDto,
  ) {
    return this.failureModeService.findControlPointsByFailureMode(id, query)
  }

  @Post('failure-modes/:id/taxonomy-maps')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '为失效模式添加分类映射' })
  async createTaxonomyMap(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTaxonomyFailureModeMapDto,
    @Req() req: Request,
  ) {
    const result = await this.failureModeService.createTaxonomyMap(id, dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.CREATE,
      entityType: 'TaxonomyFailureModeMap',
      entityId: result.id,
      details: { failureModeId: id, l2Code: dto.l2Code },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Delete('failure-modes/:id/taxonomy-maps/:mapId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '删除失效模式的分类映射' })
  async deleteTaxonomyMap(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mapId', ParseUUIDPipe) mapId: string,
    @Req() req: Request,
  ) {
    const result = await this.failureModeService.deleteTaxonomyMap(id, mapId)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.DELETE,
      entityType: 'TaxonomyFailureModeMap',
      entityId: mapId,
      details: { failureModeId: id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Post('failure-modes/:id/control-maps')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '为失效模式添加控制点映射' })
  async createControlMap(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateFailureModeControlMapDto,
    @Req() req: Request,
  ) {
    const result = await this.failureModeService.createControlMap(id, dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.CREATE,
      entityType: 'FailureModeControlMap',
      entityId: result.id,
      details: { failureModeId: id, controlId: dto.controlId, relevance: dto.relevance },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Delete('failure-modes/:id/control-maps/:mapId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '删除失效模式的控制点映射' })
  async deleteControlMap(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mapId', ParseUUIDPipe) mapId: string,
    @Req() req: Request,
  ) {
    const result = await this.failureModeService.deleteControlMap(id, mapId)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.DELETE,
      entityType: 'FailureModeControlMap',
      entityId: mapId,
      details: { failureModeId: id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }
}
