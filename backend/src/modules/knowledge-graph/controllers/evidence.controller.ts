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
  CreateControlEvidenceMapDto,
  CreateEvidenceTypeDto,
  QueryControlEvidenceMapDto,
  QueryEvidenceTypeDto,
  UpdateControlEvidenceMapDto,
  UpdateEvidenceTypeDto,
} from '../dto/evidence.dto'
import { EvidenceService } from '../services/evidence.service'

@ApiTags('Knowledge Graph - Evidence')
@ApiBearerAuth()
@Controller('api/admin/knowledge-graph')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONSULTANT)
export class EvidenceController {
  constructor(
    private readonly evidenceService: EvidenceService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('evidence-types')
  @ApiOperation({ summary: '获取 evidence type 列表' })
  async findAllEvidenceTypes(@Query() query: QueryEvidenceTypeDto) {
    return this.evidenceService.findAllEvidenceTypes(query)
  }

  @Post('evidence-types')
  @ApiOperation({ summary: '创建 evidence type' })
  async createEvidenceType(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Body() dto: CreateEvidenceTypeDto,
    @Req() req: Request,
  ) {
    const result = await this.evidenceService.createEvidenceType(dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.CREATE,
      entityType: 'EvidenceType',
      entityId: result.evidenceId,
      details: {
        evidenceCode: result.evidenceCode,
        status: result.status,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Put('evidence-types/:evidenceId')
  @ApiOperation({ summary: '更新 evidence type' })
  async updateEvidenceType(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('evidenceId') evidenceId: string,
    @Body() dto: UpdateEvidenceTypeDto,
    @Req() req: Request,
  ) {
    const result = await this.evidenceService.updateEvidenceType(evidenceId, dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.UPDATE,
      entityType: 'EvidenceType',
      entityId: result.evidenceId,
      details: {
        evidenceCode: result.evidenceCode,
        status: result.status,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Get('control-evidence-maps')
  @ApiOperation({ summary: '获取控制点证据映射列表' })
  async findAllControlEvidenceMaps(@Query() query: QueryControlEvidenceMapDto) {
    return this.evidenceService.findAllControlEvidenceMaps(query)
  }

  @Post('control-evidence-maps')
  @ApiOperation({ summary: '创建控制点证据映射' })
  async createControlEvidenceMap(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Body() dto: CreateControlEvidenceMapDto,
    @Req() req: Request,
  ) {
    const result = await this.evidenceService.createControlEvidenceMap(dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.CREATE,
      entityType: 'ControlEvidenceMap',
      entityId: result.id,
      details: {
        controlId: result.controlId,
        evidenceId: result.evidenceId,
        requiredLevel: result.requiredLevel,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Put('control-evidence-maps/:id')
  @ApiOperation({ summary: '更新控制点证据映射' })
  async updateControlEvidenceMap(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('id') id: string,
    @Body() dto: UpdateControlEvidenceMapDto,
    @Req() req: Request,
  ) {
    const result = await this.evidenceService.updateControlEvidenceMap(id, dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.UPDATE,
      entityType: 'ControlEvidenceMap',
      entityId: result.id,
      details: {
        controlId: result.controlId,
        evidenceId: result.evidenceId,
        requiredLevel: result.requiredLevel,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Get('control-points/:controlId/evidences')
  @ApiOperation({ summary: '按控制点获取证据清单' })
  async findEvidencesByControlId(@Param('controlId') controlId: string) {
    return this.evidenceService.findEvidencesByControlId(controlId)
  }
}
