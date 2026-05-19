import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { AdvisoryAccessUser } from '../access/advisory-access.service'
import { AdvisorySessionService } from './advisory-session.service'

@Controller('advisory')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AdvisorySessionController {
  constructor(private readonly advisorySessionService: AdvisorySessionService) {}

  @Get('workflows')
  async getWorkflows(@CurrentUser() user: AdvisoryAccessUser, @CurrentTenant() tenantId: string) {
    const catalog = await this.advisorySessionService.listWorkflows({ user, tenantId })

    return { data: catalog }
  }

  @Post('workflows/:workflowKey/launch')
  async launchWorkflow(
    @Param('workflowKey') workflowKey: string,
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
  ) {
    const launch = await this.advisorySessionService.launchWorkflow({
      user,
      tenantId,
      workflowKey,
    })

    return { data: launch }
  }
}
