import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { AuditLogService } from '../../audit/audit-log.service'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { CurrentOrg } from '../../organizations/decorators/current-org.decorator'
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator'
import { OrganizationGuard } from '../../organizations/guards/organization.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { ReportCenterQueryDto } from '../dto/report-center-query.dto'
import { ReportCenterService } from '../services/report-center.service'

@ApiTags('Compliance Intelligence - Report Center')
@ApiBearerAuth()
@Controller('compliance-intelligence')
@UseGuards(JwtAuthGuard, TenantGuard, OrganizationGuard)
export class ReportCenterController {
  constructor(
    private readonly reportCenterService: ReportCenterService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('report-center')
  @ApiOperation({ summary: '获取报告中心聚合列表' })
  async getReportCenter(
    @CurrentTenant() tenantId: string,
    @CurrentOrg() currentOrg: { organizationId: string; userId: string },
    @Query() query: ReportCenterQueryDto,
    @Req() req: Request,
  ) {
    const response = await this.reportCenterService.getReportCenter(
      currentOrg.organizationId,
      query,
    )

    await this.auditLogService.log({
      userId: currentOrg.userId,
      organizationId: currentOrg.organizationId,
      tenantId,
      action: AuditAction.READ,
      entityType: 'ReportCenter',
      entityId: currentOrg.organizationId,
      details: {
        filtersApplied: response.filtersApplied,
        summary: response.summary,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return response
  }

  @Get('report-center/:reportId')
  @ApiOperation({ summary: '获取单份报告详情的编译结果' })
  async getReportDetail(
    @CurrentTenant() tenantId: string,
    @CurrentOrg() currentOrg: { organizationId: string; userId: string },
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Req() req: Request,
  ) {
    const response = await this.reportCenterService.getReportDetail(
      currentOrg.organizationId,
      reportId,
    )

    await this.auditLogService.log({
      userId: currentOrg.userId,
      organizationId: currentOrg.organizationId,
      tenantId,
      action: AuditAction.READ,
      entityType: 'ReportCenterDetail',
      entityId: reportId,
      details: {
        reportId,
        sectionCount: response.sections.length,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return response
  }
}
