import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { Response } from 'express'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { AuditLogService } from '../../audit/audit-log.service'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { CurrentOrg } from '../../organizations/decorators/current-org.decorator'
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator'
import { OrganizationGuard } from '../../organizations/guards/organization.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { REPORT_PDF_DOWNLOAD_CONTENT_TYPE } from '../constants/report-pdf.constants'
import { ReportCenterQueryDto } from '../dto/report-center-query.dto'
import { ReportPdfService } from '../services/report-pdf.service'
import { ReportCenterService } from '../services/report-center.service'

@ApiTags('Compliance Intelligence - Report Center')
@ApiBearerAuth()
@Controller('compliance-intelligence')
@UseGuards(JwtAuthGuard, TenantGuard, OrganizationGuard)
export class ReportCenterController {
  constructor(
    private readonly reportCenterService: ReportCenterService,
    private readonly reportPdfService: ReportPdfService,
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

  @Get('report-center/:reportId/remediation-priority-list')
  @ApiOperation({ summary: '获取报告整改优先级清单' })
  async getRemediationPriorityList(
    @CurrentTenant() tenantId: string,
    @CurrentOrg() currentOrg: { organizationId: string; userId: string },
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Req() req: Request,
  ) {
    const response = await this.reportCenterService.getRemediationPriorityList(
      currentOrg.organizationId,
      reportId,
    )

    await this.auditLogService.log({
      userId: currentOrg.userId,
      organizationId: currentOrg.organizationId,
      tenantId,
      action: AuditAction.READ,
      entityType: 'ReportRemediationPriorityList',
      entityId: reportId,
      details: {
        reportId,
        itemCount: response.items.length,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return response
  }

  @Post('report-center/:reportId/pdf-jobs')
  @ApiOperation({ summary: '创建报告 PDF 生成任务' })
  async createReportPdfJob(
    @CurrentTenant() tenantId: string,
    @CurrentOrg() currentOrg: { organizationId: string; userId: string },
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Req() req: Request,
  ) {
    const response = await this.reportPdfService.createPdfJob(
      currentOrg.organizationId,
      currentOrg.userId,
      reportId,
    )

    await this.auditLogService.log({
      userId: currentOrg.userId,
      organizationId: currentOrg.organizationId,
      tenantId,
      action: AuditAction.CREATE,
      entityType: 'ReportPdfJob',
      entityId: response.pdfJobId,
      details: {
        reportId,
        status: response.status,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return response
  }

  @Get('report-center/:reportId/pdf-jobs/latest')
  @ApiOperation({ summary: '获取最新报告 PDF 任务' })
  async getLatestReportPdfJob(
    @CurrentTenant() tenantId: string,
    @CurrentOrg() currentOrg: { organizationId: string; userId: string },
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Req() req: Request,
  ) {
    const response = await this.reportPdfService.getLatestPdfJob(currentOrg.organizationId, reportId)

    await this.auditLogService.log({
      userId: currentOrg.userId,
      organizationId: currentOrg.organizationId,
      tenantId,
      action: AuditAction.READ,
      entityType: 'ReportPdfJobLatest',
      entityId: reportId,
      details: {
        hasJob: Boolean(response),
        status: response?.status ?? null,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return response
  }

  @Get('report-center/:reportId/pdf-jobs/:pdfJobId')
  @ApiOperation({ summary: '获取单个报告 PDF 任务状态' })
  async getReportPdfJob(
    @CurrentTenant() tenantId: string,
    @CurrentOrg() currentOrg: { organizationId: string; userId: string },
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Param('pdfJobId', new ParseUUIDPipe()) pdfJobId: string,
    @Req() req: Request,
  ) {
    const response = await this.reportPdfService.getPdfJob(
      currentOrg.organizationId,
      reportId,
      pdfJobId,
    )

    await this.auditLogService.log({
      userId: currentOrg.userId,
      organizationId: currentOrg.organizationId,
      tenantId,
      action: AuditAction.READ,
      entityType: 'ReportPdfJob',
      entityId: pdfJobId,
      details: {
        reportId,
        status: response.status,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return response
  }

  @Get('report-center/:reportId/pdf-jobs/:pdfJobId/download')
  @ApiOperation({ summary: '下载已生成的报告 PDF' })
  async downloadReportPdf(
    @CurrentTenant() tenantId: string,
    @CurrentOrg() currentOrg: { organizationId: string; userId: string },
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Param('pdfJobId', new ParseUUIDPipe()) pdfJobId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.reportPdfService.downloadPdfJob(
      currentOrg.organizationId,
      reportId,
      pdfJobId,
    )

    await this.auditLogService.log({
      userId: currentOrg.userId,
      organizationId: currentOrg.organizationId,
      tenantId,
      action: AuditAction.READ,
      entityType: 'ReportPdfDownload',
      entityId: pdfJobId,
      details: {
        reportId,
        fileName: result.fileName,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    res.setHeader('Content-Type', REPORT_PDF_DOWNLOAD_CONTENT_TYPE)
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`)
    res.send(result.buffer)
  }
}
