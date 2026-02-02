import { Controller, Get, Put, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'

import { PushPreferenceService } from '../services/push-preference.service'
import { UpdatePushPreferenceDto, PushPreferenceResponseDto } from '../dto/push-preference.dto'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { OrganizationGuard } from '../../organizations/guards/organization.guard'
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator'
import { CurrentOrg } from '../../organizations/decorators/current-org.decorator'

/**
 * Push Preference Controller
 *
 * Manages organization push notification preferences.
 * All endpoints require JWT authentication, tenant validation, and organization context.
 *
 * @story Story 5.3 - Push Preference Settings
 * @story Story 6.1A - Multi-tenant API/Service Layer Isolation
 */
@UseGuards(JwtAuthGuard, TenantGuard, OrganizationGuard)
@Controller('radar/push-preferences')
export class PushPreferenceController {
  constructor(private readonly pushPreferenceService: PushPreferenceService) {}

  /**
   * Get push preferences for current organization
   *
   * Returns existing preferences or creates default ones if not exists.
   * Default values:
   * - pushStartTime: "09:00"
   * - pushEndTime: "18:00"
   * - dailyPushLimit: 5
   * - relevanceFilter: "high_only"
   */
  @Get()
  async getPreference(
    @CurrentTenant() tenantId: string,
    @CurrentOrg() organizationId: string,
  ): Promise<PushPreferenceResponseDto> {
    return this.pushPreferenceService.getOrCreatePreference(tenantId, organizationId)
  }

  /**
   * Update push preferences for current organization
   *
   * Partial update - only provided fields will be updated.
   * Validates time range and other constraints.
   */
  @Put()
  @HttpCode(HttpStatus.OK)
  async updatePreference(
    @CurrentTenant() tenantId: string,
    @CurrentOrg() organizationId: string,
    @Body() dto: UpdatePushPreferenceDto,
  ): Promise<PushPreferenceResponseDto> {
    return this.pushPreferenceService.updatePreference(tenantId, organizationId, dto)
  }
}
