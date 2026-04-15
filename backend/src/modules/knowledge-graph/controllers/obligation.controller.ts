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
  CreateObligationDto,
  CreateObligationControlMapDto,
  QueryObligationDto,
  UpdateObligationDto,
} from '../dto/obligation.dto'
import { ObligationService } from '../services/obligation.service'

@ApiTags('Knowledge Graph - Obligations')
@ApiBearerAuth()
@Controller('api/admin/knowledge-graph')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONSULTANT)
export class ObligationController {
  constructor(
    private readonly obligationService: ObligationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('obligations')
  @ApiOperation({ summary: '获取法规义务列表' })
  async findAll(@Query() query: QueryObligationDto) {
    return this.obligationService.findAll(query)
  }

  @Get('obligations/coverage-analysis')
  @ApiOperation({ summary: '获取法规义务覆盖率分析' })
  async getCoverageAnalysis() {
    return this.obligationService.getCoverageAnalysis()
  }

  @Get('obligations/by-clause/:clauseId')
  @ApiOperation({ summary: '按条文获取法规义务' })
  async findByClauseId(
    @Param('clauseId', ParseUUIDPipe) clauseId: string,
    @Query() query: QueryObligationDto,
  ) {
    return this.obligationService.findByClauseId(clauseId, query)
  }

  @Get('obligations/:id')
  @ApiOperation({ summary: '获取法规义务详情' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.obligationService.findById(id)
  }

  @Post('obligations')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '创建法规义务' })
  async create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Body() dto: CreateObligationDto,
    @Req() req: Request,
  ) {
    const result = await this.obligationService.create(dto)
    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.CREATE,
      entityType: 'RegulationObligation',
      entityId: result.obligationId,
      details: {
        obligationCode: result.obligationCode,
        clauseId: result.clauseId,
        status: result.status,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })
    return result
  }

  @Patch('obligations/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '更新法规义务' })
  async update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateObligationDto,
    @Req() req: Request,
  ) {
    const result = await this.obligationService.update(id, dto)
    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.UPDATE,
      entityType: 'RegulationObligation',
      entityId: result.obligationId,
      details: {
        obligationCode: result.obligationCode,
        clauseId: result.clauseId,
        status: result.status,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })
    return result
  }

  @Get('obligations/:id/control-points')
  @ApiOperation({ summary: '获取法规义务关联的控制点' })
  async findControlPoints(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryObligationDto,
  ) {
    return this.obligationService.findControlPointsByObligation(id, query)
  }

  @Post('obligations/:id/control-maps')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '为法规义务添加控制点映射' })
  async createControlMap(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateObligationControlMapDto,
    @Req() req: Request,
  ) {
    const result = await this.obligationService.createControlMap(id, dto)
    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.CREATE,
      entityType: 'ObligationControlMap',
      entityId: result.id,
      details: {
        obligationId: id,
        controlId: result.controlId,
        coverage: result.coverage,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })
    return result
  }

  @Delete('obligations/:id/control-maps/:mapId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '删除法规义务的控制点映射' })
  async deleteControlMap(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mapId', ParseUUIDPipe) mapId: string,
    @Req() req: Request,
  ) {
    const result = await this.obligationService.deleteControlMap(id, mapId)
    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.DELETE,
      entityType: 'ObligationControlMap',
      entityId: mapId,
      details: {
        obligationId: id,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })
    return result
  }
}
