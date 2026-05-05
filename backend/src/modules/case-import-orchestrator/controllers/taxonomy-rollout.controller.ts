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
  Query,
  Req,
  Res,
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
import type { Response } from 'express'
import { Roles } from '../../../common/decorators/roles.decorator'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AuditLogService } from '../../audit/audit-log.service'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import {
  EvaluateTaxonomyRolloutGateDto,
  EvaluateTaxonomyRolloutRetirementDto,
  ExecuteTaxonomyRolloutRetirementDto,
  RollbackTaxonomyRolloutRetirementDto,
  TaxonomyRolloutGateDecisionDto,
  TaxonomyRolloutPolicyDetailDto,
  TaxonomyRolloutPolicyListItemDto,
  TaxonomyRolloutPolicySummaryDto,
  TaxonomyRolloutRetirementDryRunDecisionDto,
  TaxonomyRolloutRetirementExecutionResultDto,
  TaxonomyRolloutRetirementRollbackResultDto,
  TaxonomyRolloutTransitionResultDto,
  TransitionTaxonomyRolloutStateDto,
} from '../dto/taxonomy-rollout.dto'
import { TaxonomyDomainGateService } from '../services/taxonomy-domain-gate.service'
import { TaxonomyDomainRetirementService } from '../services/taxonomy-domain-retirement.service'
import { DomainRolloutPolicyService } from '../services/taxonomy-classification/domain-rollout-policy.service'

type TaxonomyRolloutRequest = {
  user?: { id?: string | null; userId?: string | null }
  tenantId?: string | null
  ip?: string | null
  headers?: Record<string, string | string[] | undefined>
}

@ApiTags('Knowledge Graph - Taxonomy Rollout')
@ApiBearerAuth()
@Controller('api/admin/knowledge-graph/taxonomy-rollout')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class TaxonomyRolloutController {
  constructor(
    private readonly domainRolloutPolicyService: DomainRolloutPolicyService,
    private readonly taxonomyDomainGateService: TaxonomyDomainGateService,
    private readonly taxonomyDomainRetirementService: TaxonomyDomainRetirementService,
    private readonly auditLogService: AuditLogService,
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

  private buildLatestExecutionSummary(policy: {
    retirementEvidenceJson: {
      lastLegacyOffAt?: string | null
      lastLegacyOffReleaseId?: string | null
      lastSmokeVerifiedAt?: string | null
      lastRollbackVerifiedAt?: string | null
      lastRetirementReportPath?: string | null
    }
  }) {
    return {
      lastLegacyOffAt: policy.retirementEvidenceJson.lastLegacyOffAt ?? null,
      lastLegacyOffReleaseId: policy.retirementEvidenceJson.lastLegacyOffReleaseId ?? null,
      lastSmokeVerifiedAt: policy.retirementEvidenceJson.lastSmokeVerifiedAt ?? null,
      lastRollbackVerifiedAt: policy.retirementEvidenceJson.lastRollbackVerifiedAt ?? null,
      lastRetirementReportPath: policy.retirementEvidenceJson.lastRetirementReportPath ?? null,
    }
  }

  private assertConfirmationText(l1Code: string, confirmationText: string): void {
    if (confirmationText.trim().toUpperCase() !== l1Code) {
      throw new BadRequestException('confirmationText must exactly match the selected l1Code.')
    }
  }

  private normalizeReleaseId(releaseId: string): string {
    const normalized = releaseId.trim()
    if (!/^[A-Za-z0-9._-]{1,80}$/.test(normalized)) {
      throw new BadRequestException(
        'releaseId must be 1-80 characters and contain only letters, numbers, dots, underscores, or hyphens.',
      )
    }
    return normalized
  }

  private resolveOperatorId(req?: TaxonomyRolloutRequest): string | null {
    return req?.user?.id ?? req?.user?.userId ?? null
  }

  private resolveAuditUserId(req?: TaxonomyRolloutRequest): string {
    return this.resolveOperatorId(req) ?? '00000000-0000-0000-0000-000000000000'
  }

  private resolveUserAgent(req?: TaxonomyRolloutRequest): string | null {
    const header = req?.headers?.['user-agent']
    if (Array.isArray(header)) return header.join(' ')
    return header ?? null
  }

  private isConflictErrorMessage(message: string): boolean {
    return (
      message.startsWith('Retirement blocked:') ||
      message.startsWith('Rollback blocked:') ||
      message.startsWith('Rollout transition blocked:') ||
      /concurrency conflict/i.test(message) ||
      /smoke verification failed/i.test(message) ||
      /requires smoke verifier/i.test(message)
    )
  }

  private async writeRetirementAudit(
    req: TaxonomyRolloutRequest | undefined,
    details: Record<string, unknown> & {
      operation: 'dry-run' | 'execute' | 'rollback' | 'report-view'
      l1Code: string
      outcome: 'success' | 'blocked' | 'failed'
    },
    action: AuditAction = AuditAction.UPDATE,
  ): Promise<void> {
    const auditLogPayload = {
      userId: this.resolveAuditUserId(req),
      tenantId: req?.tenantId ?? null,
      organizationId: null,
      action,
      entityType: 'TaxonomyRolloutRetirement',
      entityId: null,
      details,
      ipAddress: req?.ip ?? null,
      userAgent: this.resolveUserAgent(req),
    }

    if (
      'logStrict' in this.auditLogService &&
      typeof this.auditLogService.logStrict === 'function'
    ) {
      await this.auditLogService.logStrict(auditLogPayload)
      return
    }

    await this.auditLogService.log(auditLogPayload)
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
    const releaseId =
      body.releaseId === undefined || body.releaseId === null
        ? null
        : this.normalizeReleaseId(body.releaseId)
    const previousPolicy =
      await this.domainRolloutPolicyService.getOrCreatePolicyForDomain(normalizedL1Code)

    let decision
    try {
      decision = await this.taxonomyDomainGateService.transitionRolloutState({
        l1Code: normalizedL1Code,
        targetState: body.targetState,
        updatedBy: req.user?.id ?? null,
        releaseId,
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
        releaseId,
        rollbackPath: decision.rolloutGuidance.rollbackPath,
      },
      policySummary: this.buildPolicySummary(updatedPolicy),
    }
  }

  @Post('retirement/dry-run')
  @ApiOperation({ summary: '执行 legacy-off dry-run readiness evaluation' })
  @ApiBody({ type: EvaluateTaxonomyRolloutRetirementDto })
  @ApiResponse({
    status: 200,
    description: '成功返回 retirement dry-run readiness 结果',
    type: TaxonomyRolloutRetirementDryRunDecisionDto,
  })
  @HttpCode(200)
  async evaluateRetirementDryRun(
    @Body() body: EvaluateTaxonomyRolloutRetirementDto,
    @Req() req?: TaxonomyRolloutRequest,
  ): Promise<TaxonomyRolloutRetirementDryRunDecisionDto> {
    const normalizedL1Code = this.validateL1Code(body.l1Code)
    const dryRun = await this.taxonomyDomainRetirementService.evaluateRetirementDryRun({
      l1Code: normalizedL1Code,
    })
    const policy =
      await this.domainRolloutPolicyService.getOrCreatePolicyForDomain(normalizedL1Code)

    await this.writeRetirementAudit(
      req,
      {
        operation: 'dry-run',
        l1Code: normalizedL1Code,
        currentState: dryRun.currentState,
        targetState: 'legacy-off',
        outcome: 'success',
        allowed: dryRun.allowed,
        blockingReasons: dryRun.blockingReasons,
      },
      AuditAction.READ,
    )

    return {
      l1Code: normalizedL1Code,
      currentState: dryRun.currentState,
      targetState: 'legacy-off',
      allowed: dryRun.allowed,
      gateStatus: dryRun.gateStatus,
      prerequisites: dryRun.prerequisites,
      blockingReasons: dryRun.blockingReasons,
      metrics: dryRun.metrics,
      rolloutGuidance: dryRun.rolloutGuidance,
      recommendedNextAction: dryRun.allowed
        ? `Execute legacy-off for ${normalizedL1Code}.`
        : `Resolve blocking reasons before retiring ${normalizedL1Code}.`,
      cleanupReadiness: dryRun.cleanupReadiness,
      latestExecution: this.buildLatestExecutionSummary(policy),
      policySummary: this.buildPolicySummary(policy),
    }
  }

  @Get('retirement/report')
  @ApiOperation({ summary: '查看 taxonomy retirement report artifact' })
  @ApiResponse({ status: 200, description: '成功返回 retirement report JSON' })
  @ApiResponse({ status: 400, description: 'Report path 非法或缺失' })
  async getRetirementReport(
    @Query('path') reportPath: string,
    @Req() req: TaxonomyRolloutRequest,
    @Res() res: Response,
  ): Promise<void> {
    if (!reportPath || typeof reportPath !== 'string') {
      throw new BadRequestException('report path is required.')
    }

    try {
      const report = await this.taxonomyDomainRetirementService.readRetirementReport(reportPath)
      await this.writeRetirementAudit(
        req,
        {
          operation: 'report-view',
          l1Code: 'REPORT',
          outcome: 'success',
          reportPath,
          fileName: report.fileName,
        },
        AuditAction.READ,
      )
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Content-Disposition', `inline; filename="${report.fileName}"`)
      res.send(report.content)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new BadRequestException(message)
    }
  }

  @Post('retirement/execute')
  @ApiOperation({ summary: '执行正式 legacy-off retirement' })
  @ApiBody({ type: ExecuteTaxonomyRolloutRetirementDto })
  @ApiResponse({
    status: 200,
    description: '成功执行 legacy-off 并返回 smoke/report/cleanup 摘要',
    type: TaxonomyRolloutRetirementExecutionResultDto,
  })
  @ApiResponse({ status: 409, description: 'Retirement blocked or smoke verification failed' })
  @HttpCode(200)
  async executeRetirement(
    @Body() body: ExecuteTaxonomyRolloutRetirementDto,
    @Req() req: TaxonomyRolloutRequest,
  ): Promise<TaxonomyRolloutRetirementExecutionResultDto> {
    const normalizedL1Code = this.validateL1Code(body.l1Code)
    this.assertConfirmationText(normalizedL1Code, body.confirmationText)
    const releaseId = this.normalizeReleaseId(body.releaseId)
    const operatorId = this.resolveOperatorId(req)

    const previousPolicy =
      await this.domainRolloutPolicyService.getOrCreatePolicyForDomain(normalizedL1Code)

    await this.writeRetirementAudit(req, {
      operation: 'execute',
      l1Code: normalizedL1Code,
      previousState: previousPolicy.rolloutState,
      targetState: 'legacy-off',
      releaseId,
      outcome: 'success',
      stage: 'requested',
    })

    let report
    try {
      report = await this.taxonomyDomainRetirementService.executeRetirement({
        l1Code: normalizedL1Code,
        releaseId,
        updatedBy: operatorId,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.writeRetirementAudit(req, {
        operation: 'execute',
        l1Code: normalizedL1Code,
        previousState: previousPolicy.rolloutState,
        targetState: 'legacy-off',
        releaseId,
        outcome: this.isConflictErrorMessage(message) ? 'blocked' : 'failed',
        reason: message,
      })
      if (this.isConflictErrorMessage(message)) {
        throw new ConflictException(message)
      }
      throw error
    }

    const updatedPolicy =
      await this.domainRolloutPolicyService.getOrCreatePolicyForDomain(normalizedL1Code)

    const response: TaxonomyRolloutRetirementExecutionResultDto = {
      l1Code: normalizedL1Code,
      previousState: previousPolicy.rolloutState,
      targetState: 'legacy-off',
      stateChangedAt: updatedPolicy.stateChangedAt,
      operator: operatorId,
      smokeVerification: report.smokeVerification,
      reportPath: report.reportPath,
      finalFallbackRate: report.finalFallbackRate,
      cleanupReadiness: {
        allowed: report.gateResults.cleanup === 'READY',
        blockingReasons: report.blockingReasons,
      },
      rollbackReadiness: report.rollbackReadiness,
      auditSummary: {
        updatedBy: operatorId,
        releaseId,
        rollbackPath: report.rollbackReadiness.path,
      },
      policySummary: this.buildPolicySummary(updatedPolicy),
    }

    await this.writeRetirementAudit(req, {
      operation: 'execute',
      l1Code: normalizedL1Code,
      previousState: previousPolicy.rolloutState,
      targetState: 'legacy-off',
      releaseId,
      outcome: 'success',
      reportPath: response.reportPath,
      finalFallbackRate: response.finalFallbackRate,
      cleanupReadiness: response.cleanupReadiness,
      smokeVerification: response.smokeVerification,
    })

    return response
  }

  @Post('retirement/rollback')
  @ApiOperation({ summary: '执行 retirement rollback' })
  @ApiBody({ type: RollbackTaxonomyRolloutRetirementDto })
  @ApiResponse({
    status: 200,
    description: '成功 rollback 并返回 restored state / evidence 摘要',
    type: TaxonomyRolloutRetirementRollbackResultDto,
  })
  @ApiResponse({ status: 409, description: 'Rollback blocked' })
  @HttpCode(200)
  async rollbackRetirement(
    @Body() body: RollbackTaxonomyRolloutRetirementDto,
    @Req() req: TaxonomyRolloutRequest,
  ): Promise<TaxonomyRolloutRetirementRollbackResultDto> {
    const normalizedL1Code = this.validateL1Code(body.l1Code)
    this.assertConfirmationText(normalizedL1Code, body.confirmationText)
    const operatorId = this.resolveOperatorId(req)

    await this.writeRetirementAudit(req, {
      operation: 'rollback',
      l1Code: normalizedL1Code,
      targetState: body.targetState ?? 'domain-primary',
      outcome: 'success',
      stage: 'requested',
    })

    const result = await this.taxonomyDomainRetirementService
      .rollbackRetirement({
        l1Code: normalizedL1Code,
        targetState: body.targetState,
        updatedBy: operatorId,
        restoreLegacyFallback: body.restoreLegacyFallback ?? true,
      })
      .catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        await this.writeRetirementAudit(req, {
          operation: 'rollback',
          l1Code: normalizedL1Code,
          targetState: body.targetState ?? 'domain-primary',
          outcome: this.isConflictErrorMessage(message) ? 'blocked' : 'failed',
          reason: message,
        })
        if (this.isConflictErrorMessage(message)) {
          throw new ConflictException(message)
        }
        throw error
      })

    const updatedPolicy =
      await this.domainRolloutPolicyService.getOrCreatePolicyForDomain(normalizedL1Code)

    const response: TaxonomyRolloutRetirementRollbackResultDto = {
      l1Code: normalizedL1Code,
      previousState: result.previousState,
      targetState: result.targetState,
      stateChangedAt: updatedPolicy.stateChangedAt,
      operator: operatorId,
      legacyFallbackRestored: result.legacyFallbackRestored,
      rollbackPath: result.rollbackPath,
      reportPath: result.reportPath,
      evidenceSummary: result.evidenceSummary,
      auditSummary: {
        updatedBy: operatorId,
        rollbackPath: result.rollbackPath,
      },
      policySummary: this.buildPolicySummary(updatedPolicy),
    }

    await this.writeRetirementAudit(req, {
      operation: 'rollback',
      l1Code: normalizedL1Code,
      previousState: result.previousState,
      targetState: result.targetState,
      outcome: 'success',
      reportPath: result.reportPath,
      rollbackPath: result.rollbackPath,
      legacyFallbackRestored: result.legacyFallbackRestored,
    })

    return response
  }
}
