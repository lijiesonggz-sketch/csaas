import { Body, Controller, Post, Req, UseFilters, UseGuards } from '@nestjs/common'
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
import { ImportComplianceCasesDto } from '../dto/import-compliance-cases.dto'
import { CaseImportAuditFilter } from '../filters/case-import-audit.filter'
import { CaseImportQueueService } from '../services/case-import-queue.service'

@ApiTags('Knowledge Graph - Case Import')
@ApiBearerAuth()
@Controller('api/admin/knowledge-graph')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@UseFilters(CaseImportAuditFilter)
@Roles(UserRole.ADMIN, UserRole.CONSULTANT)
export class CaseImportController {
  constructor(
    private readonly caseImportQueueService: CaseImportQueueService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post('cases/import')
  @ApiOperation({ summary: '创建处罚案例导入任务' })
  async createImportJob(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Body() dto: ImportComplianceCasesDto,
    @Req() req: Request,
  ) {
    const result = await this.caseImportQueueService.enqueueImport(dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.CREATE,
      entityType: 'ComplianceCaseImportJob',
      entityId: result.jobId,
      details: {
        batchId: result.batchId,
        filePath: result.filePath,
        regulatorCode: result.regulatorCode,
        status: result.status,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }
}
