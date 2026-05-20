import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { AdvisoryAccessUser } from '../access/advisory-access.service'
import { UpsertOrganizationContextDto } from './dto/upsert-organization-context.dto'
import { AdvisoryOrganizationContextService } from './advisory-organization-context.service'

@Controller('advisory/organization-context')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AdvisoryOrganizationContextController {
  constructor(private readonly organizationContextService: AdvisoryOrganizationContextService) {}

  @Get()
  async getOrganizationContext(
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
  ) {
    const context = await this.organizationContextService.getOrganizationContext({
      user,
      tenantId,
    })

    return { data: context }
  }

  @Put()
  async upsertOrganizationContext(
    @CurrentUser() user: AdvisoryAccessUser,
    @CurrentTenant() tenantId: string,
    @Body() body: UpsertOrganizationContextDto,
  ) {
    const context = await this.organizationContextService.upsertOrganizationContext({
      user,
      tenantId,
      organizationName: this.toOptionalText(body?.organizationName),
      industry: this.toOptionalText(body?.industry),
      size: this.toOptionalText(body?.size),
    })

    return { data: context }
  }

  private toOptionalText(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }
}
