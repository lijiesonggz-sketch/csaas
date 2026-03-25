import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
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
  CreateControlPackItemDto,
  QueryControlApplicabilityContextDto,
  QueryControlPackItemDto,
  UpdateControlPackItemDto,
} from '../dto/control-pack-link.dto'
import { ControlPackLinkService } from '../services/control-pack-link.service'

@ApiTags('Knowledge Graph - Control Pack Links')
@ApiBearerAuth()
@Controller('api/admin/knowledge-graph')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONSULTANT)
export class ControlPackLinkController {
  constructor(
    private readonly controlPackLinkService: ControlPackLinkService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('control-pack-items')
  @ApiOperation({ summary: '获取 control pack items 列表' })
  async findAll(@Query() query: QueryControlPackItemDto) {
    return this.controlPackLinkService.findAll(query)
  }

  @Post('control-pack-items')
  @ApiOperation({ summary: '创建 control pack item' })
  async create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Body() dto: CreateControlPackItemDto,
    @Req() req: Request,
  ) {
    const result = await this.controlPackLinkService.create(dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.CREATE,
      entityType: 'ControlPackItem',
      entityId: result.id,
      details: {
        packId: result.packId,
        controlId: result.controlId,
        itemRole: result.itemRole,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Put('control-pack-items/:id')
  @ApiOperation({ summary: '更新 control pack item' })
  async update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('id') id: string,
    @Body() dto: UpdateControlPackItemDto,
    @Req() req: Request,
  ) {
    const result = await this.controlPackLinkService.update(id, dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.UPDATE,
      entityType: 'ControlPackItem',
      entityId: result.id,
      details: {
        packId: result.packId,
        controlId: result.controlId,
        itemRole: result.itemRole,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Get('control-points/:controlId/pack-links')
  @ApiOperation({ summary: '按控制点获取静态 pack 关联' })
  async findPackLinksByControlId(@Param('controlId') controlId: string) {
    return this.controlPackLinkService.findPackLinksByControlId(controlId)
  }

  @Get('control-points/:controlId/applicability-context')
  @ApiOperation({ summary: '按控制点和机构上下文获取 explain-ready applicability context' })
  async buildApplicabilityContext(
    @Param('controlId') controlId: string,
    @Query() query: QueryControlApplicabilityContextDto,
  ) {
    return this.controlPackLinkService.buildApplicabilityContext(controlId, query)
  }
}
