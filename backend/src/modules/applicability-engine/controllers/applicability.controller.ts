import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { Request } from 'express'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { AuditLogService } from '../../audit/audit-log.service'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { CurrentOrg } from '../../organizations/decorators/current-org.decorator'
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator'
import { OrganizationGuard } from '../../organizations/guards/organization.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import {
  ResolveControlsRequestDto,
  ResolveControlsResponseDto,
} from '../dto/resolve-controls.dto'
import { AppliedEffect, PackResolutionDebugEntry } from '../types/applicability.types'
import { PackResolverService } from '../services/pack-resolver.service'

type CurrentOrgContext = {
  organizationId: string
  userId: string
}

@ApiTags('Applicability Engine')
@ApiBearerAuth()
@Controller('applicability-engine')
@UseGuards(JwtAuthGuard, TenantGuard, OrganizationGuard)
export class ApplicabilityController {
  constructor(
    private readonly packResolverService: PackResolverService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post('resolve-controls')
  @ApiOperation({
    summary: '解析机构适用控制点集合',
    description: '根据当前组织上下文返回适用控制包、规则与控制点结果',
  })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: '成功返回适用控制点结果' })
  @ApiResponse({ status: 400, description: '请求参数非法' })
  @ApiResponse({ status: 401, description: '未认证' })
  @ApiResponse({ status: 403, description: '无权访问该组织' })
  @ApiResponse({ status: 404, description: '机构画像不存在' })
  async resolveControls(
    @CurrentTenant() tenantId: string,
    @CurrentOrg() currentOrg: CurrentOrgContext,
    @Body() dto: ResolveControlsRequestDto,
    @Req() request: Request,
  ): Promise<ResolveControlsResponseDto> {
    if (dto.organizationId !== currentOrg.organizationId) {
      throw new BadRequestException(
        'organizationId does not match the resolved organization context',
      )
    }

    const resolved = await this.packResolverService.resolveByOrganizationId(
      currentOrg.organizationId,
    )

    if (!resolved) {
      throw new NotFoundException(
        `Organization profile not found for organization ${currentOrg.organizationId}`,
      )
    }

    const response: ResolveControlsResponseDto = {
      organizationId: currentOrg.organizationId,
      scene: dto.scene,
      influencingProfileFields: this.collectInfluencingProfileFields(resolved.debugLog),
      matchedPacks: resolved.matchedPacks,
      matchedRules: resolved.matchedRules,
      controls: resolved.controls,
      summary: resolved.summary,
      debugLog: resolved.debugLog,
    }

    const userAgentHeader = request.headers['user-agent']
    const userAgent = typeof userAgentHeader === 'string' ? userAgentHeader : null

    await this.auditLogService.log({
      userId: currentOrg.userId,
      organizationId: currentOrg.organizationId,
      tenantId,
      action: AuditAction.READ,
      entityType: 'ApplicabilityResolution',
      entityId: currentOrg.organizationId,
      details: {
        scene: dto.scene,
        matchedPacks: resolved.matchedPacks.length,
        matchedRules: resolved.matchedRules.length,
        totalControls: resolved.summary.totalControls,
      },
      ipAddress: request.ip,
      userAgent,
    })

    return response
  }

  private collectInfluencingProfileFields(
    debugLog: PackResolutionDebugEntry[],
  ): string[] {
    const fields = new Set<string>()

    debugLog.forEach((entry) => {
      if (!entry.matched || !this.hasActualEffect(entry.appliedEffect)) {
        return
      }

      entry.traceEntries.forEach((traceEntry) => {
        if (traceEntry.matched && traceEntry.field) {
          fields.add(traceEntry.field)
        }
      })
    })

    return Array.from(fields).sort((left, right) => left.localeCompare(right))
  }

  private hasActualEffect(appliedEffect: AppliedEffect): boolean {
    return (
      appliedEffect.addedPackCodes.length > 0 ||
      appliedEffect.addedControlCodes.length > 0 ||
      appliedEffect.strengthenedControlCodes.length > 0 ||
      appliedEffect.excludedControlCodes.length > 0
    )
  }
}
