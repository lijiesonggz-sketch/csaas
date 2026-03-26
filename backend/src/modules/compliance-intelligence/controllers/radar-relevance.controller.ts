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
import { CalculateRadarRelevanceDto } from '../dto/radar-relevance.dto'
import { RadarRelevanceEnhancedService } from '../services/radar-relevance-enhanced.service'

@ApiTags('Compliance Intelligence - Radar Relevance')
@ApiBearerAuth()
@Controller('compliance-intelligence')
@UseGuards(JwtAuthGuard, TenantGuard, OrganizationGuard)
export class RadarRelevanceController {
  constructor(
    private readonly radarRelevanceEnhancedService: RadarRelevanceEnhancedService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post('radar/relevance')
  @ApiOperation({ summary: '获取 KG 增强 radar relevance 结果' })
  async calculateRadarRelevance(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Body() body: CalculateRadarRelevanceDto,
    @Req() req: Request,
  ) {
    const result = await this.radarRelevanceEnhancedService.calculateRadarRelevance(body)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      organizationId: body.organizationId,
      action: AuditAction.READ,
      entityType: 'RadarRelevance',
      entityId: body.contentId,
      details: {
        organizationId: body.organizationId,
        contentId: body.contentId,
        surveyResponseId: body.surveyResponseId ?? null,
        matchedControlCount: result.matchedControls.length,
        suggestedCheckCount: result.suggestedChecks.length,
        priority: result.priority,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }
}
