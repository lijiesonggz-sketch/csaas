import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AuditLogService } from '../../audit/audit-log.service'
import { CurrentUser } from '../../auth/decorators/current-user.decorator'
import { Roles } from '../../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { ControlExplainService } from '../services/control-explain.service'

@ApiTags('Knowledge Graph - Admin Control Full Context')
@ApiBearerAuth()
@Controller('api/admin/knowledge-graph/control-points')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminControlFullContextController {
  constructor(
    private readonly controlExplainService: ControlExplainService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get(':controlId/full-context')
  @ApiOperation({ summary: '获取管理端控制点 full-context 详情' })
  async getAdminControlExplain(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('controlId') controlId: string,
    @Req() req: Request,
  ) {
    const result = await this.controlExplainService.getAdminControlExplain(controlId)
    const effectiveUserId = user.id ?? user.userId

    if (!effectiveUserId) {
      return result
    }

    try {
      await this.auditLogService.log({
        userId: effectiveUserId,
        tenantId,
        action: AuditAction.READ,
        entityType: 'ControlExplain',
        entityId: controlId,
        details: {
          scope: 'admin-full-context',
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
      })
    } catch {
      // Do not fail a successful full-context read because audit persistence is unavailable.
    }

    return result
  }
}
