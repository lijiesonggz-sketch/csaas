import {
  Body,
  Controller,
  Delete,
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
  CreateClauseControlMapDto,
  CreateRegulationClauseDto,
  CreateRegulationSourceDto,
  QueryClauseControlMapDto,
  QueryRegulationClauseDto,
  QueryRegulationSourceDto,
  UpdateClauseControlMapDto,
  UpdateRegulationClauseDto,
  UpdateRegulationSourceDto,
} from '../dto/regulation.dto'
import { ComplianceCaseService } from '../services/compliance-case.service'
import { ControlPointService } from '../services/control-point.service'
import { ObligationService } from '../services/obligation.service'
import { RegulationService } from '../services/regulation.service'

@ApiTags('Knowledge Graph - Regulation')
@ApiBearerAuth()
@Controller('api/admin/knowledge-graph')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONSULTANT)
export class RegulationController {
  constructor(
    private readonly regulationService: RegulationService,
    private readonly obligationService: ObligationService,
    private readonly complianceCaseService: ComplianceCaseService,
    private readonly controlPointService: ControlPointService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('regulation-sources')
  @ApiOperation({ summary: '获取法规来源列表' })
  async findAllSources(@Query() query: QueryRegulationSourceDto) {
    return this.regulationService.findAllSources(query)
  }

  @Post('regulation-sources')
  @ApiOperation({ summary: '创建法规来源' })
  async createSource(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Body() dto: CreateRegulationSourceDto,
    @Req() req: Request,
  ) {
    const result = await this.regulationService.createSource(dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.CREATE,
      entityType: 'RegulationSource',
      entityId: result.sourceId,
      details: {
        sourceCode: result.sourceCode,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Put('regulation-sources/:sourceId')
  @ApiOperation({ summary: '更新法规来源' })
  async updateSource(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('sourceId') sourceId: string,
    @Body() dto: UpdateRegulationSourceDto,
    @Req() req: Request,
  ) {
    const result = await this.regulationService.updateSource(sourceId, dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.UPDATE,
      entityType: 'RegulationSource',
      entityId: result.sourceId,
      details: {
        sourceCode: result.sourceCode,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Get('regulation-clauses')
  @ApiOperation({ summary: '获取法规条款列表' })
  async findAllClauses(@Query() query: QueryRegulationClauseDto) {
    return this.regulationService.findAllClauses(query)
  }

  @Post('regulation-clauses')
  @ApiOperation({ summary: '创建法规条款' })
  async createClause(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Body() dto: CreateRegulationClauseDto,
    @Req() req: Request,
  ) {
    const result = await this.regulationService.createClause(dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.CREATE,
      entityType: 'RegulationClause',
      entityId: result.clauseId,
      details: {
        clauseCode: result.clauseCode,
        sourceId: result.sourceId,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Put('regulation-clauses/:clauseId')
  @ApiOperation({ summary: '更新法规条款' })
  async updateClause(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('clauseId') clauseId: string,
    @Body() dto: UpdateRegulationClauseDto,
    @Req() req: Request,
  ) {
    const result = await this.regulationService.updateClause(clauseId, dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.UPDATE,
      entityType: 'RegulationClause',
      entityId: result.clauseId,
      details: {
        clauseCode: result.clauseCode,
        sourceId: result.sourceId,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Get('clause-control-maps')
  @ApiOperation({ summary: '获取条款到控制点映射列表' })
  async findAllClauseControlMaps(@Query() query: QueryClauseControlMapDto) {
    return this.regulationService.findAllClauseControlMaps(query)
  }

  @Post('clause-control-maps')
  @ApiOperation({ summary: '创建条款到控制点映射' })
  async createClauseControlMap(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Body() dto: CreateClauseControlMapDto,
    @Req() req: Request,
  ) {
    const result = await this.regulationService.createClauseControlMap(dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.CREATE,
      entityType: 'ClauseControlMap',
      entityId: result.id,
      details: {
        clauseId: result.clauseId,
        controlId: result.controlId,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Put('clause-control-maps/:id')
  @ApiOperation({ summary: '更新条款到控制点映射' })
  async updateClauseControlMap(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('id') id: string,
    @Body() dto: UpdateClauseControlMapDto,
    @Req() req: Request,
  ) {
    const result = await this.regulationService.updateClauseControlMap(id, dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.UPDATE,
      entityType: 'ClauseControlMap',
      entityId: result.id,
      details: {
        clauseId: result.clauseId,
        controlId: result.controlId,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Delete('clause-control-maps/:id')
  @ApiOperation({ summary: '删除条款到控制点映射' })
  async deleteClauseControlMap(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const result = await this.regulationService.deleteClauseControlMap(id)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.DELETE,
      entityType: 'ClauseControlMap',
      entityId: id,
      details: {
        id,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Get('control-points/:controlId/regulatory-links')
  @ApiOperation({ summary: '按控制点获取法规和案例支撑信息' })
  async getControlRegulatoryLinks(@Param('controlId') controlId: string) {
    await this.controlPointService.findOne(controlId)

    const [regulatoryLinks, cases] = await Promise.all([
      this.obligationService.findRegulatoryLinksByControlId(controlId),
      this.complianceCaseService.findCasesByControlId(controlId),
    ])

    return {
      controlId,
      obligations: regulatoryLinks.obligations,
      clauses: regulatoryLinks.clauses,
      cases,
    }
  }
}
