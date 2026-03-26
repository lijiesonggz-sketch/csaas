import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { AuditLogService } from '../../audit/audit-log.service'
import { CurrentUser } from '../../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator'
import { OrganizationGuard } from '../../organizations/guards/organization.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { CompileControlReportDto } from '../dto/compile-control-report.dto'
import { ControlReportCompilerService } from '../services/control-report-compiler.service'

@ApiTags('Compliance Intelligence - Control Report')
@ApiBearerAuth()
@Controller('compliance-intelligence')
@UseGuards(JwtAuthGuard, TenantGuard, OrganizationGuard)
export class ControlReportController {
  constructor(
    private readonly controlReportCompilerService: ControlReportCompilerService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post('compile-control-report')
  @ApiOperation({ summary: '编译控制报告层级结构' })
  async compileControlReport(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Body() body: CompileControlReportDto,
    @Req() req: Request,
  ) {
    const result = await this.controlReportCompilerService.compileReport(body)
    const controlCount = result.sections.reduce(
      (sum, section) =>
        sum +
        section.l2Sections.reduce(
          (l2Sum, l2Section) => l2Sum + l2Section.controls.length,
          0,
        ),
      0,
    )

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      organizationId: body.organizationId,
      action: AuditAction.READ,
      entityType: 'ControlReport',
      entityId: body.surveyResponseId,
      details: {
        organizationId: body.organizationId,
        surveyResponseId: body.surveyResponseId,
        requestedControlCount: body.controlIds.length,
        compiledControlCount: controlCount,
        sectionCount: result.sections.length,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }
}
