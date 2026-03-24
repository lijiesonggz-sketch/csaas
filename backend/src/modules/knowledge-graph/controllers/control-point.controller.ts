import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
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
  CreateControlPointDto,
  QueryControlPointDto,
  UpdateControlPointDto,
  UpdateControlPointStatusDto,
} from '../dto/control-point.dto'
import { ControlPointService } from '../services/control-point.service'

@ApiTags('Knowledge Graph - Control Points')
@ApiBearerAuth()
@Controller('api/admin/knowledge-graph/control-points')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONSULTANT)
export class ControlPointController {
  constructor(
    private readonly controlPointService: ControlPointService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取 control points 列表' })
  @ApiResponse({ status: 200, description: '成功返回 control points 列表' })
  async findAll(@Query() query: QueryControlPointDto) {
    return this.controlPointService.findAll(query)
  }

  @Get(':controlId')
  @ApiOperation({ summary: '获取 control point 详情' })
  async findOne(@Param('controlId') controlId: string) {
    return this.controlPointService.findOne(controlId)
  }

  @Post()
  @ApiOperation({ summary: '创建 control point' })
  async create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Body() dto: CreateControlPointDto,
    @Req() req: Request,
  ) {
    const result = await this.controlPointService.create(dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.CREATE,
      entityType: 'ControlPoint',
      entityId: result.controlId,
      details: {
        controlCode: result.controlCode,
        l1Code: result.l1Code,
        l2Code: result.l2Code,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Put(':controlId')
  @ApiOperation({ summary: '更新 control point' })
  async update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('controlId') controlId: string,
    @Body() dto: UpdateControlPointDto,
    @Req() req: Request,
  ) {
    const result = await this.controlPointService.update(controlId, dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.UPDATE,
      entityType: 'ControlPoint',
      entityId: result.controlId,
      details: {
        controlCode: result.controlCode,
        l1Code: result.l1Code,
        l2Code: result.l2Code,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Patch(':controlId/status')
  @ApiOperation({ summary: '更新 control point 状态' })
  async updateStatus(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('controlId') controlId: string,
    @Body() dto: UpdateControlPointStatusDto,
    @Req() req: Request,
  ) {
    const result = await this.controlPointService.updateStatus(controlId, dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.UPDATE,
      entityType: 'ControlPoint',
      entityId: result.controlId,
      details: {
        changedField: 'status',
        toStatus: result.status,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }
}
