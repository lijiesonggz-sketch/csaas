import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
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
  CreateCaseControlMapDto,
  CreateComplianceCaseDto,
  QueryCaseControlMapDto,
  QueryComplianceCaseDto,
  UpdateCaseControlMapDto,
  UpdateComplianceCaseDto,
} from '../dto/compliance-case.dto'
import { ComplianceCaseService } from '../services/compliance-case.service'

@ApiTags('Knowledge Graph - Compliance Cases')
@ApiBearerAuth()
@Controller('api/admin/knowledge-graph')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONSULTANT)
export class ComplianceCaseController {
  constructor(
    private readonly complianceCaseService: ComplianceCaseService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('compliance-cases')
  @ApiOperation({ summary: '获取处罚案例列表' })
  async findAllCases(@Query() query: QueryComplianceCaseDto) {
    return this.complianceCaseService.findAllCases(query)
  }

  @Post('compliance-cases')
  @ApiOperation({ summary: '创建处罚案例' })
  async createCase(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Body() dto: CreateComplianceCaseDto,
    @Req() req: Request,
  ) {
    const result = await this.complianceCaseService.createCase(dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.CREATE,
      entityType: 'ComplianceCase',
      entityId: result.caseId,
      details: {
        caseCode: result.caseCode,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Put('compliance-cases/:caseId')
  @ApiOperation({ summary: '更新处罚案例' })
  async updateCase(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('caseId') caseId: string,
    @Body() dto: UpdateComplianceCaseDto,
    @Req() req: Request,
  ) {
    const result = await this.complianceCaseService.updateCase(caseId, dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.UPDATE,
      entityType: 'ComplianceCase',
      entityId: result.caseId,
      details: {
        caseCode: result.caseCode,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Get('compliance-cases/:caseId/extraction')
  @ApiOperation({ summary: '获取处罚案例提取结果' })
  async getCaseExtractionResult(@Param('caseId') caseId: string) {
    return this.complianceCaseService.getCaseExtractionResult(caseId)
  }

  @Get('compliance-cases/:caseId/clustering')
  @ApiOperation({ summary: '获取处罚案例聚类结果与映射草稿' })
  async getCaseClusteringResult(@Param('caseId') caseId: string) {
    return this.complianceCaseService.getCaseClusteringResult(caseId)
  }

  @Get('case-control-maps')
  @ApiOperation({ summary: '获取案例到控制点映射列表' })
  async findAllCaseControlMaps(@Query() query: QueryCaseControlMapDto) {
    return this.complianceCaseService.findAllCaseControlMaps(query)
  }

  @Post('case-control-maps')
  @ApiOperation({ summary: '创建案例到控制点映射' })
  async createCaseControlMap(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Body() dto: CreateCaseControlMapDto,
    @Req() req: Request,
  ) {
    const result = await this.complianceCaseService.createCaseControlMap(dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.CREATE,
      entityType: 'CaseControlMap',
      entityId: result.id,
      details: {
        caseId: result.caseId,
        controlId: result.controlId,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Put('case-control-maps/:id')
  @ApiOperation({ summary: '更新案例到控制点映射' })
  async updateCaseControlMap(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('id') id: string,
    @Body() dto: UpdateCaseControlMapDto,
    @Req() req: Request,
  ) {
    const result = await this.complianceCaseService.updateCaseControlMap(id, dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.UPDATE,
      entityType: 'CaseControlMap',
      entityId: result.id,
      details: {
        caseId: result.caseId,
        controlId: result.controlId,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }
}
