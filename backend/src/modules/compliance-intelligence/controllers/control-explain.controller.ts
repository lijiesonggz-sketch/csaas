import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { AuditLogService } from '../../audit/audit-log.service'
import { CurrentUser } from '../../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator'
import { OrganizationGuard } from '../../organizations/guards/organization.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { QueryControlExplainDto } from '../dto/control-explain.dto'
import { ControlExplainService } from '../services/control-explain.service'

@ApiTags('Compliance Intelligence - Control Explain')
@ApiBearerAuth()
@Controller('compliance-intelligence')
@UseGuards(JwtAuthGuard, TenantGuard, OrganizationGuard)
export class ControlExplainController {
  constructor(
    private readonly controlExplainService: ControlExplainService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('control-explain/:controlId')
  @ApiOperation({ summary: '获取控制点完整解释详情' })
  async getControlExplain(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('controlId') controlId: string,
    @Query() query: QueryControlExplainDto,
    @Req() req: Request,
  ) {
    const result = await this.controlExplainService.getControlExplain(controlId, query)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.READ,
      entityType: 'ControlExplain',
      entityId: controlId,
      details: {
        organizationId: query.organizationId,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }
}
