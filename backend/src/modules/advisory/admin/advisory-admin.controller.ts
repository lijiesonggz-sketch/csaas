import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common'
import { Roles } from '../../auth/decorators/roles.decorator'
import { CurrentUser } from '../../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { UserRole } from '../../../database/entities/user.entity'
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { AdvisoryAdminService, AdvisoryModuleConfigActor } from './advisory-admin.service'
import { UpdateAdvisoryModuleConfigDto } from './dto/update-advisory-module-config.dto'

@Controller('advisory/admin')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class AdvisoryAdminController {
  constructor(private readonly advisoryAdminService: AdvisoryAdminService) {}

  @Get('module-config')
  @Roles(UserRole.ADMIN)
  async getModuleConfig(
    @CurrentUser() user: AdvisoryModuleConfigActor,
    @CurrentTenant() tenantId: string,
  ) {
    return {
      data: await this.advisoryAdminService.getModuleConfig(tenantId),
    }
  }

  @Put('module-config')
  @Roles(UserRole.ADMIN)
  async updateModuleConfig(
    @CurrentUser() user: AdvisoryModuleConfigActor,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateAdvisoryModuleConfigDto,
  ) {
    return {
      data: await this.advisoryAdminService.updateModuleConfig(tenantId, user, dto),
    }
  }
}
