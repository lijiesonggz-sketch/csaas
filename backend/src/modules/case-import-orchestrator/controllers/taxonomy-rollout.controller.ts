import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../../common/decorators/roles.decorator'
import { UserRole } from '../../../database/entities/user.entity'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import {
  TaxonomyRolloutPolicyDetailDto,
  TaxonomyRolloutPolicyListItemDto,
} from '../dto/taxonomy-rollout.dto'
import { DomainRolloutPolicyService } from '../services/taxonomy-classification/domain-rollout-policy.service'

@ApiTags('Knowledge Graph - Taxonomy Rollout')
@ApiBearerAuth()
@Controller('api/admin/knowledge-graph/taxonomy-rollout')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class TaxonomyRolloutController {
  constructor(private readonly domainRolloutPolicyService: DomainRolloutPolicyService) {}

  private validateL1Code(l1Code: string): string {
    const normalized = l1Code.trim().toUpperCase()
    if (!/^IT\d{2}$/.test(normalized)) {
      throw new BadRequestException('l1Code must match the ITxx domain code format.')
    }
    return normalized
  }

  @Get('policies')
  @ApiOperation({ summary: '获取所有 domain rollout policies' })
  @ApiResponse({
    status: 200,
    description: '成功返回所有 domain policies',
    type: [TaxonomyRolloutPolicyListItemDto],
  })
  async getPolicies(): Promise<TaxonomyRolloutPolicyListItemDto[]> {
    const policies = await this.domainRolloutPolicyService.findAll()
    return policies.map((policy) => {
      const readiness = this.domainRolloutPolicyService.getReadinessSummary(policy)

      return {
        id: policy.id,
        l1Code: policy.l1Code,
        rolloutState: policy.rolloutState,
        allowLegacyFallback: policy.allowLegacyFallback,
        killSwitchEnabled: policy.killSwitchEnabled,
        activeClassifierVersion: policy.activeClassifierVersion,
        primaryThreshold: policy.primaryThreshold,
        shadowWindowDays: policy.shadowWindowDays,
        stateChangedAt: policy.stateChangedAt,
        stateAllowsPrimary: readiness.stateAllowsPrimary,
        stateAllowsLegacyFallback: readiness.stateAllowsLegacyFallback,
        hasRetirementEvidence: readiness.hasRetirementEvidence,
      }
    })
  }

  @Get('policies/:l1Code')
  @ApiOperation({ summary: '获取单个 domain rollout policy 详情' })
  @ApiParam({ name: 'l1Code', example: 'IT04' })
  @ApiResponse({
    status: 200,
    description: '成功返回 domain policy 详情',
    type: TaxonomyRolloutPolicyDetailDto,
  })
  @ApiResponse({ status: 404, description: 'Domain policy 不存在' })
  async getPolicyByL1Code(
    @Param('l1Code') l1Code: string,
  ): Promise<TaxonomyRolloutPolicyDetailDto> {
    const normalizedL1Code = this.validateL1Code(l1Code)
    const policy = await this.domainRolloutPolicyService.findByL1Code(normalizedL1Code)

    if (!policy) {
      throw new NotFoundException(`No rollout policy found for domain ${normalizedL1Code}`)
    }

    const readiness = this.domainRolloutPolicyService.getReadinessSummary(policy)

    return {
      id: policy.id,
      l1Code: policy.l1Code,
      rolloutState: policy.rolloutState,
      allowLegacyFallback: policy.allowLegacyFallback,
      killSwitchEnabled: policy.killSwitchEnabled,
      activeClassifierVersion: policy.activeClassifierVersion,
      primaryThreshold: policy.primaryThreshold,
      shadowWindowDays: policy.shadowWindowDays,
      stateChangedAt: policy.stateChangedAt,
      stateAllowsPrimary: readiness.stateAllowsPrimary,
      stateAllowsLegacyFallback: readiness.stateAllowsLegacyFallback,
      hasRetirementEvidence: readiness.hasRetirementEvidence,
      mappingOwner: policy.mappingOwner,
      rulebookOwner: policy.rulebookOwner,
      benchmarkOwner: policy.benchmarkOwner,
      gateApprover: policy.gateApprover,
      rollbackApprover: policy.rollbackApprover,
      cutoverThresholdsJson: policy.cutoverThresholdsJson,
      retirementThresholdsJson: policy.retirementThresholdsJson,
      retirementEvidenceJson: policy.retirementEvidenceJson,
      updatedAt: policy.updatedAt,
    }
  }
}
