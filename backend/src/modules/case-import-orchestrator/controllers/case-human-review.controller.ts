import { Body, Controller, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common'
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
import { CaseHumanReviewDto } from '../dto/case-human-review.dto'
import { CaseHumanReviewService } from '../services/case-human-review.service'

@ApiTags('Knowledge Graph - Case Human Review')
@ApiBearerAuth()
@Controller('api/admin/knowledge-graph')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONSULTANT)
export class CaseHumanReviewController {
  constructor(
    private readonly caseHumanReviewService: CaseHumanReviewService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post('compliance-cases/:caseId/human-review')
  @HttpCode(200)
  @ApiOperation({ summary: '人工审核并确认处罚案例控制点映射' })
  async reviewCase(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('caseId') caseId: string,
    @Body() dto: CaseHumanReviewDto,
    @Req() req: Request,
  ) {
    const reviewerId = user.id || user.userId
    const result = await this.caseHumanReviewService.reviewCase(caseId, reviewerId!, dto)

    await this.auditLogService.log({
      userId: reviewerId,
      tenantId,
      action: AuditAction.UPDATE,
      entityType: 'ComplianceCase',
      entityId: caseId,
      details: {
        approvedCount: result.approvedCount,
        rejectedCount: result.rejectedCount,
        manualMappingCount: result.manualMappingCount,
        status: result.status,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }
}
