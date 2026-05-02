import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { Roles } from '../../../common/decorators/roles.decorator'
import { UserRole } from '../../../database/entities/user.entity'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import {
  EvaluateTaxonomyRolloutGateDto,
  TaxonomyRolloutGateDecisionDto,
  TaxonomyRolloutPolicyDetailDto,
  TaxonomyRolloutPolicyListItemDto,
  TaxonomyRolloutPolicySummaryDto,
  TaxonomyRolloutTransitionResultDto,
  TransitionTaxonomyRolloutStateDto,
} from '../dto/taxonomy-rollout.dto'
import { TaxonomyDomainGateService } from '../services/taxonomy-domain-gate.service'
import { DomainRolloutPolicyService } from '../services/taxonomy-classification/domain-rollout-policy.service'

@ApiTags('Knowledge Graph - Taxonomy Rollout')
@ApiBearerAuth()
@Controller('api/admin/knowledge-graph/taxonomy-rollout')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class TaxonomyRolloutController {
  constructor(
    private readonly domainRolloutPolicyService: DomainRolloutPolicyService,
    private readonly taxonomyDomainGateService: TaxonomyDomainGateService,
  ) {}

  private validateL1Code(l1Code: string): string {
    const normalized = l1Code.trim().toUpperCase()
    if (!/^IT\d{2}$/.test(normalized)) {
      throw new BadRequestException('l1Code must match the ITxx domain code format.')
    }
    return normalized
  }

  private buildPolicySummary(policy: {
    l1Code: string
    rolloutState: string
    allowLegacyFallback: boolean
    killSwitchEnabled: boolean
    activeClassifierVersion: string | null
    primaryThreshold: number
    shadowWindowDays: number
    stateChangedAt: Date | null
  }): TaxonomyRolloutPolicySummaryDto {
    return {
      l1Code: policy.l1Code,
      rolloutState: policy.rolloutState as TaxonomyRolloutPolicySummaryDto['rolloutState'],
      allowLegacyFallback: policy.allowLegacyFallback,
      killSwitchEnabled: policy.killSwitchEnabled,
      activeClassifierVersion: policy.activeClassifierVersion,
      primaryThreshold: policy.primaryThreshold,
      shadowWindowDays: policy.shadowWindowDays,
      stateChangedAt: policy.stateChangedAt,
    }
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

  @Post('gates/evaluate')
  @ApiOperation({ summary: '评估指定 domain 的 rollout gate readiness' })
  @ApiBody({ type: EvaluateTaxonomyRolloutGateDto })
  @ApiResponse({
    status: 200,
    description: '成功返回 gate evaluation 结果',
    type: TaxonomyRolloutGateDecisionDto,
  })
  @HttpCode(200)
  async evaluateGate(
    @Body() body: EvaluateTaxonomyRolloutGateDto,
  ): Promise<TaxonomyRolloutGateDecisionDto> {
    const normalizedL1Code = this.validateL1Code(body.l1Code)
    const decision = await this.taxonomyDomainGateService.evaluateDomainReadiness({
      l1Code: normalizedL1Code,
      targetState: body.targetState,
    })
    const policy =
      await this.domainRolloutPolicyService.getOrCreatePolicyForDomain(normalizedL1Code)

    return {
      l1Code: normalizedL1Code,
      currentState: decision.currentState,
      targetState: body.targetState,
      allowed: decision.allowed,
      gateStatus: decision.gateStatus,
      blockingReasons: decision.blockingReasons,
      benchmarkGate: {
        gateStatus: decision.benchmarkGate.gateStatus ?? 'FAIL',
        metrics: decision.benchmarkGate.metrics,
        sourceTier: decision.benchmarkGate.sourceTier,
        sourceMode: decision.benchmarkGate.sourceMode,
      },
      metrics: decision.metrics,
      rolloutGuidance: decision.rolloutGuidance,
      recommendedNextAction: decision.recommendedNextAction,
      policySummary: this.buildPolicySummary(policy),
    }
  }

  @Post('transitions')
  @ApiOperation({ summary: '执行受控 rollout state transition' })
  @ApiBody({ type: TransitionTaxonomyRolloutStateDto })
  @ApiResponse({
    status: 200,
    description: '成功完成 state transition 并返回审计摘要',
    type: TaxonomyRolloutTransitionResultDto,
  })
  @ApiResponse({ status: 409, description: 'Gate fail 或并发冲突导致 transition 被阻止' })
  @HttpCode(200)
  async transitionRolloutState(
    @Body() body: TransitionTaxonomyRolloutStateDto,
    @Req() req: { user?: { id?: string | null } },
  ): Promise<TaxonomyRolloutTransitionResultDto> {
    const normalizedL1Code = this.validateL1Code(body.l1Code)
    const previousPolicy =
      await this.domainRolloutPolicyService.getOrCreatePolicyForDomain(normalizedL1Code)

    let decision
    try {
      decision = await this.taxonomyDomainGateService.transitionRolloutState({
        l1Code: normalizedL1Code,
        targetState: body.targetState,
        updatedBy: req.user?.id ?? null,
        releaseId: body.releaseId ?? null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (
        message.startsWith('Rollout transition blocked:') ||
        /concurrency conflict/i.test(message)
      ) {
        throw new ConflictException(message)
      }
      throw error
    }

    const updatedPolicy =
      await this.domainRolloutPolicyService.getOrCreatePolicyForDomain(normalizedL1Code)

    return {
      l1Code: normalizedL1Code,
      previousState: previousPolicy.rolloutState,
      targetState: body.targetState,
      stateChangedAt: updatedPolicy.stateChangedAt,
      operator: req.user?.id ?? null,
      auditSummary: {
        updatedBy: req.user?.id ?? null,
        releaseId: body.releaseId ?? null,
        rollbackPath: decision.rolloutGuidance.rollbackPath,
      },
      policySummary: this.buildPolicySummary(updatedPolicy),
    }
  }
}
