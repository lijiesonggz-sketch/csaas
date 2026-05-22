import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common'
import { UserRole } from '../../../database/entities/user.entity'
import { CurrentUser } from '../../auth/decorators/current-user.decorator'
import { Roles } from '../../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { AdvisoryOperationsService } from './advisory-operations.service'
import { AdvisoryOperationsActor } from './advisory-operations.types'

interface AdvisoryOperationsUsageQueryDto {
  tenantId?: string
  dateFrom?: string
  dateTo?: string
  workflowType?: string
}

@Controller('advisory/admin/operations')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class AdvisoryOperationsController {
  constructor(private readonly advisoryOperationsService: AdvisoryOperationsService) {}

  @Get('usage')
  @Roles(UserRole.ADMIN)
  async getUsage(
    @CurrentUser() actor: AdvisoryOperationsActor,
    @CurrentTenant() currentTenantId: string,
    @Query() query: AdvisoryOperationsUsageQueryDto,
  ) {
    const defaults = this.defaultWindow()
    const requestedTenantId = this.resolveRequestedTenantId(query.tenantId, currentTenantId)

    return {
      data: await this.advisoryOperationsService.getUsageDashboard({
        actor,
        currentTenantId,
        tenantId: requestedTenantId,
        dateFrom: query.dateFrom ?? defaults.dateFrom,
        dateTo: query.dateTo ?? defaults.dateTo,
        workflowType: query.workflowType,
      }),
    }
  }

  private resolveRequestedTenantId(tenantId: string | undefined, currentTenantId: string): string {
    const requestedTenantId = tenantId?.trim()
    if (!requestedTenantId || requestedTenantId === 'current') {
      return currentTenantId
    }
    if (requestedTenantId !== currentTenantId) {
      throw new ForbiddenException('当前账号无权查看其他租户的 ThinkTank 运营数据。')
    }
    return requestedTenantId
  }

  private defaultWindow() {
    const dateTo = new Date()
    const dateFrom = new Date(dateTo.getTime() - 30 * 24 * 60 * 60 * 1000)
    return {
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
    }
  }
}
