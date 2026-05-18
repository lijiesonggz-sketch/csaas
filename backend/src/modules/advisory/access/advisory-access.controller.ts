import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import {
  AdvisoryAccessService,
  AdvisoryAccessUser,
  THINKTANK_ACCESS_DENIED_MESSAGE,
  THINKTANK_MODULE_KEY,
} from './advisory-access.service'

@Controller('advisory')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AdvisoryAccessController {
  constructor(private readonly advisoryAccessService: AdvisoryAccessService) {}

  @Get('access')
  async getAccess(@CurrentUser() user: AdvisoryAccessUser, @CurrentTenant() tenantId: string) {
    const evaluation = await this.advisoryAccessService.evaluateAccess(user, tenantId)

    if (evaluation.allowed) {
      await this.advisoryAccessService.recordAccessOpened({
        user,
        tenantId,
      })

      return {
        data: {
          allowed: true,
          module: THINKTANK_MODULE_KEY,
        },
      }
    }

    await this.advisoryAccessService.recordAccessDenied({
      user,
      tenantId,
      reason: evaluation.reason ?? this.advisoryAccessService.getDeniedReason(user),
    })

    throw new ForbiddenException(evaluation.message ?? THINKTANK_ACCESS_DENIED_MESSAGE)
  }
}
