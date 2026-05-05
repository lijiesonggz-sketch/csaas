import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  InternalServerErrorException,
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
import {
  BackfillTaxonomyRolloutRecoveryDto,
  ReclassifyTaxonomyRolloutRecoveryDto,
  TaxonomyRolloutRecoveryOperationResultDto,
  TaxonomyRolloutReportHistoryQueryDto,
  TaxonomyRolloutReportHistoryResponseDto,
} from '../dto/taxonomy-rollout.dto'
import { ComplianceCaseBackfillService } from '../services/compliance-case-backfill.service'
import { ComplianceCaseReclassificationService } from '../services/compliance-case-reclassification.service'
import { TaxonomyDomainGateService } from '../services/taxonomy-domain-gate.service'
import { TaxonomyDomainRetirementService } from '../services/taxonomy-domain-retirement.service'
import { DomainRolloutPolicyService } from '../services/taxonomy-classification/domain-rollout-policy.service'

type TaxonomyRolloutRequest = {
  user?: { id?: string | null; userId?: string | null }
  tenantId?: string | null
  ip?: string | null
  headers?: Record<string, string | string[] | undefined>
}

type RecoveryOperation = 'reclassify' | 'backfill'
type RecoveryOutcome = 'success' | 'blocked' | 'failed'

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
    private readonly complianceCaseReclassificationService: ComplianceCaseReclassificationService,
    private readonly complianceCaseBackfillService: ComplianceCaseBackfillService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private validateL1Code(l1Code: string | null | undefined): string {
    if (typeof l1Code !== 'string') {
      throw new BadRequestException(
        'l1Code is required and must match the ITxx domain code format.',
      )
    }
    const normalized = l1Code.trim().toUpperCase()
    if (!/^IT\d{2}$/.test(normalized)) {
      throw new BadRequestException('l1Code must match the ITxx domain code format.')
    }
    return normalized
  }

  private normalizeOptionalString(value: string | null | undefined): string | null {
    if (typeof value !== 'string') return null
    const normalized = value.trim()
    return normalized ? normalized : null
  }

  private normalizeCaseIds(value: unknown): string[] {
    if (value === undefined || value === null) return []
    if (!Array.isArray(value)) {
      throw new BadRequestException('caseIds must be an array of case id strings.')
    }

    const normalized = value
      .map((caseId) => (typeof caseId === 'string' ? caseId.trim() : ''))
      .filter((caseId) => caseId.length > 0)

    if (normalized.length === 0) {
      throw new BadRequestException(
        'caseIds must contain at least one non-empty case id when provided.',
      )
    }

    return Array.from(new Set(normalized))
  }

  private assertRecoveryExecutionScope(params: {
    operation: RecoveryOperation
    dryRun: boolean
    batchId: string | null
    caseIds: string[]
  }): void {
    if (params.dryRun) return
    if (params.batchId || params.caseIds.length > 0) return

    throw new BadRequestException(
      `${params.operation} execute requires batchId or caseIds scope; domain-only execute is not allowed.`,
    )
  }

  private parsePositiveInteger(
    value: string | number | undefined,
    fallback: number,
    max: number,
  ): number {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && value.trim()
          ? Number(value)
          : fallback

    if (!Number.isFinite(parsed) || parsed < 1) return fallback
    return Math.min(Math.floor(parsed), max)
  }

  private parseOptionalDate(value: string | undefined, fieldName: string): Date | undefined {
    const normalized = this.normalizeOptionalString(value)
    if (!normalized) return undefined
    const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    const date =
      dateOnlyMatch && fieldName === 'dateTo'
        ? new Date(`${normalized}T23:59:59.999Z`)
        : dateOnlyMatch && fieldName === 'dateFrom'
          ? new Date(`${normalized}T00:00:00.000Z`)
          : new Date(normalized)
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid ISO date string.`)
    }
    return date
  }

  private assertTenantScope(req?: TaxonomyRolloutRequest): string {
    const tenantId = this.normalizeOptionalString(req?.tenantId)
    if (!tenantId) {
      throw new ForbiddenException('tenant scope is required for taxonomy rollout history.')
    }
    return tenantId
  }

  private buildRecoveryReportPath(
    operation: RecoveryOperation,
    l1Code: string,
    dryRun: boolean,
  ): string {
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '').replace('T', 'T')
    const mode = dryRun ? 'dry-run' : 'execute'
    return `/reports/taxonomy-recovery/${operation}/${l1Code}-${timestamp}-${mode}.json`
  }

  private buildRecoverySummary(params: {
    operation: RecoveryOperation
    l1Code: string
    dryRun: boolean
    processedCount: number
  }): string {
    const mode = params.dryRun ? 'Dry-run' : 'Execute'
    const verb = params.operation === 'reclassify' ? 'reclassified' : 'backfilled'
    return `${mode} ${verb} ${params.processedCount} cases for ${params.l1Code}.`
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse()
      if (typeof response === 'string') return response
      if (typeof response === 'object' && response !== null && 'message' in response) {
        const message = (response as { message?: unknown }).message
        if (Array.isArray(message)) return message.join(' ')
        if (typeof message === 'string') return message
      }
    }

    if (error instanceof Error) return error.message
    return String(error)
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

  private isRecoveryBlockedErrorMessage(message: string): boolean {
    return (
      message.startsWith('Recovery operation blocked:') ||
      /currently supports dry-run readiness only/i.test(message) ||
      /blocked/i.test(message)
    )
  }

  private async writeRecoveryReportArtifact(payload: {
    operation: RecoveryOperation
    l1Code: string
    dryRun: boolean
    summary: string
    recoveryResult: Record<string, unknown>
  }): Promise<string> {
    const reportWriter = this.taxonomyDomainRetirementService as TaxonomyDomainRetirementService & {
      writeRecoveryReport?: (payload: {
        operation: RecoveryOperation
        l1Code: string
        dryRun: boolean
        summary: string
        recoveryResult: Record<string, unknown>
      }) => Promise<string>
    }

    if (typeof reportWriter.writeRecoveryReport === 'function') {
      return reportWriter.writeRecoveryReport(payload)
    }

    return this.buildRecoveryReportPath(payload.operation, payload.l1Code, payload.dryRun)
  }

  private throwRecoveryHttpException(params: {
    message: string
    outcome: RecoveryOutcome
    auditId: string | null
    error: unknown
  }): never {
    const code = params.outcome === 'blocked' ? 'RECOVERY_BLOCKED' : 'RECOVERY_FAILED'
    const body = {
      code,
      message: params.message,
      auditId: params.auditId,
    }

    if (params.outcome === 'blocked') {
      throw new ConflictException(body)
    }

    if (params.error instanceof BadRequestException) {
      throw new BadRequestException(body)
    }

    throw new InternalServerErrorException(body)
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

  private async writeRecoveryAudit(
    req: TaxonomyRolloutRequest | undefined,
    details: Record<string, unknown> & {
      operation: RecoveryOperation
      l1Code: string
      outcome: RecoveryOutcome
    },
    action: AuditAction = AuditAction.UPDATE,
  ): Promise<string | null> {
    const auditLogPayload = {
      userId: this.resolveAuditUserId(req),
      tenantId: req?.tenantId ?? null,
      organizationId: null,
      action,
      entityType: 'TaxonomyRolloutRecovery',
      entityId: null,
      details,
      ipAddress: req?.ip ?? null,
      userAgent: this.resolveUserAgent(req),
    }

    const auditLogger = this.auditLogService as AuditLogService & {
      logStrict?: (data: typeof auditLogPayload) => Promise<{ id?: string } | void>
    }

    if (typeof auditLogger.logStrict === 'function') {
      const saved = await auditLogger.logStrict(auditLogPayload)
      return saved && typeof saved.id === 'string' ? saved.id : null
    }

    await this.auditLogService.log(auditLogPayload)
    return null
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

  @Post('reclassify')
  @ApiOperation({ summary: '执行受控 taxonomy reclassification recovery 操作' })
  @ApiBody({ type: ReclassifyTaxonomyRolloutRecoveryDto })
  @ApiResponse({
    status: 200,
    description: '成功返回 reclassify recovery 摘要',
    type: TaxonomyRolloutRecoveryOperationResultDto,
  })
  @ApiResponse({ status: 400, description: 'scope 或 l1Code 非法' })
  @ApiResponse({ status: 409, description: 'reclassify 被 service contract 阻止' })
  @HttpCode(200)
  async reclassifyTaxonomyCases(
    @Body() body: ReclassifyTaxonomyRolloutRecoveryDto,
    @Req() req: TaxonomyRolloutRequest,
  ): Promise<TaxonomyRolloutRecoveryOperationResultDto> {
    const operation: RecoveryOperation = 'reclassify'
    let normalizedL1Code = 'UNKNOWN'
    let batchId: string | null = null
    let caseIds: string[] = []
    let classifierVersion: string | null = null
    let dryRun = true
    let shadowOnly = false
    let forceLatestPointer = false

    try {
      normalizedL1Code = this.validateL1Code(body.l1Code)
      batchId = this.normalizeOptionalString(body.batchId)
      caseIds = this.normalizeCaseIds(body.caseIds)
      classifierVersion = this.normalizeOptionalString(body.classifierVersion)
      dryRun = body.dryRun !== false
      shadowOnly = body.shadowOnly === true
      forceLatestPointer = body.forceLatestPointer === true

      if (!dryRun) {
        this.assertConfirmationText(normalizedL1Code, body.confirmationText ?? '')
      }
      this.assertRecoveryExecutionScope({ operation, dryRun, batchId, caseIds })

      await this.writeRecoveryAudit(req, {
        operation,
        l1Code: normalizedL1Code,
        outcome: 'success',
        stage: 'requested',
        dryRun,
        shadowOnly,
        classifierVersion,
        scope: {
          batchId,
          caseIds,
          l1Code: normalizedL1Code,
          shadowOnly,
          forceLatestPointer,
        },
      })

      const report = await this.complianceCaseReclassificationService.reclassify({
        l1Code: normalizedL1Code,
        ...(batchId ? { batchId } : {}),
        ...(caseIds.length > 0 ? { caseIds } : {}),
        classifierVersion,
        shadowOnly,
        forceLatestPointer,
        dryRun,
      })
      const processedCount = report.caseCount
      const summary = this.buildRecoverySummary({
        operation,
        l1Code: normalizedL1Code,
        dryRun: report.dryRun,
        processedCount,
      })
      const reportPath = await this.writeRecoveryReportArtifact({
        operation,
        l1Code: normalizedL1Code,
        dryRun: report.dryRun,
        summary,
        recoveryResult: {
          ...report,
          latestPointerUpdated: report.dryRun ? false : report.latestPointerUpdated,
        },
      })
      const auditId = await this.writeRecoveryAudit(req, {
        operation,
        l1Code: normalizedL1Code,
        outcome: 'success',
        dryRun: report.dryRun,
        shadowOnly,
        classifierVersion,
        processedCount,
        affectedDomains: report.affectedDomains,
        latestPointerUpdated: report.dryRun ? false : report.latestPointerUpdated,
        scope: report.scope,
        reportPath,
        summary,
      })

      return {
        operation,
        l1Code: normalizedL1Code,
        dryRun: report.dryRun,
        shadowOnly,
        processedCount,
        affectedDomains: report.affectedDomains,
        latestPointerUpdated: report.dryRun ? false : report.latestPointerUpdated,
        classifierVersion: report.classifierVersion,
        summary,
        reportPath,
        scope: report.scope,
        auditSummary: {
          updatedBy: this.resolveOperatorId(req),
          outcome: 'success',
          auditId,
        },
      }
    } catch (error) {
      const message = this.extractErrorMessage(error)
      const outcome: RecoveryOutcome = this.isRecoveryBlockedErrorMessage(message)
        ? 'blocked'
        : 'failed'
      let auditId: string | null = null
      try {
        auditId = await this.writeRecoveryAudit(req, {
          operation,
          l1Code: normalizedL1Code,
          outcome,
          dryRun,
          shadowOnly,
          classifierVersion,
          scope: {
            batchId,
            caseIds,
            l1Code: normalizedL1Code,
            shadowOnly,
            forceLatestPointer,
          },
          reason: message,
        })
      } catch {
        auditId = null
      }

      this.throwRecoveryHttpException({ message, outcome, auditId, error })
    }
  }

  @Post('backfill')
  @ApiOperation({ summary: '执行受控 taxonomy backfill recovery 操作' })
  @ApiBody({ type: BackfillTaxonomyRolloutRecoveryDto })
  @ApiResponse({
    status: 200,
    description: '成功返回 backfill recovery 摘要',
    type: TaxonomyRolloutRecoveryOperationResultDto,
  })
  @ApiResponse({ status: 400, description: 'scope 或 l1Code 非法' })
  @ApiResponse({ status: 409, description: 'backfill 被 service contract 阻止' })
  @HttpCode(200)
  async backfillTaxonomyCases(
    @Body() body: BackfillTaxonomyRolloutRecoveryDto,
    @Req() req: TaxonomyRolloutRequest,
  ): Promise<TaxonomyRolloutRecoveryOperationResultDto> {
    const operation: RecoveryOperation = 'backfill'
    let normalizedL1Code = 'UNKNOWN'
    let batchId: string | null = null
    let caseIds: string[] = []
    let classifierVersion: string | null = null
    let dryRun = true
    let shadowOnly = false
    let includeRetirementReadiness = true

    try {
      normalizedL1Code = this.validateL1Code(body.l1Code)
      batchId = this.normalizeOptionalString(body.batchId)
      caseIds = this.normalizeCaseIds(body.caseIds)
      classifierVersion = this.normalizeOptionalString(body.classifierVersion)
      dryRun = body.dryRun !== false
      shadowOnly = body.shadowOnly === true
      includeRetirementReadiness = body.includeRetirementReadiness !== false

      if (!dryRun) {
        this.assertConfirmationText(normalizedL1Code, body.confirmationText ?? '')
      }
      this.assertRecoveryExecutionScope({ operation, dryRun, batchId, caseIds })

      const scope = {
        batchId,
        caseIds,
        l1Code: normalizedL1Code,
        shadowOnly,
      }

      await this.writeRecoveryAudit(req, {
        operation,
        l1Code: normalizedL1Code,
        outcome: 'success',
        stage: 'requested',
        dryRun,
        shadowOnly,
        classifierVersion,
        scope,
      })

      const report = await this.complianceCaseBackfillService.backfill({
        l1Code: normalizedL1Code,
        ...(batchId ? { batchId } : {}),
        ...(caseIds.length > 0 ? { caseIds } : {}),
        includeRetirementReadiness,
        dryRun,
      })
      const processedCount = report.requestedCount
      const summary = this.buildRecoverySummary({
        operation,
        l1Code: normalizedL1Code,
        dryRun,
        processedCount,
      })
      const backfillSummary = {
        requestedCount: report.requestedCount,
        resetCount: report.resetCount,
        skippedReviewedCount: report.skippedReviewedCount,
        skippedMissingBatchCount: report.skippedMissingBatchCount,
        extractedCount: report.extractedCount,
        clusteredCount: report.clusteredCount,
        rollbackCompatible: report.rollbackCompatible,
        requiresLegacyCodeRestore: report.requiresLegacyCodeRestore,
        batchIds: report.batchIds,
      }
      const reportPath = await this.writeRecoveryReportArtifact({
        operation,
        l1Code: normalizedL1Code,
        dryRun,
        summary,
        recoveryResult: {
          ...report,
          classifierVersion,
          shadowOnly,
          latestPointerUpdated: false,
          scope,
          backfillSummary,
        },
      })
      const auditId = await this.writeRecoveryAudit(req, {
        operation,
        l1Code: normalizedL1Code,
        outcome: 'success',
        dryRun,
        shadowOnly,
        classifierVersion,
        scope,
        processedCount,
        affectedDomains: report.affectedDomains,
        latestPointerUpdated: false,
        backfillSummary,
        reportPath,
        summary,
      })

      return {
        operation,
        l1Code: normalizedL1Code,
        dryRun,
        processedCount,
        affectedDomains: report.affectedDomains,
        latestPointerUpdated: false,
        classifierVersion,
        shadowOnly,
        summary,
        reportPath,
        scope,
        auditSummary: {
          updatedBy: this.resolveOperatorId(req),
          outcome: 'success',
          auditId,
        },
        backfillSummary,
      }
    } catch (error) {
      const message = this.extractErrorMessage(error)
      const outcome: RecoveryOutcome = this.isRecoveryBlockedErrorMessage(message)
        ? 'blocked'
        : 'failed'
      let auditId: string | null = null
      try {
        auditId = await this.writeRecoveryAudit(req, {
          operation,
          l1Code: normalizedL1Code,
          outcome,
          dryRun,
          shadowOnly,
          classifierVersion,
          scope: {
            batchId,
            caseIds,
            l1Code: normalizedL1Code,
            shadowOnly,
          },
          reason: message,
        })
      } catch {
        auditId = null
      }

      this.throwRecoveryHttpException({ message, outcome, auditId, error })
    }
  }

  @Get('reports')
  @ApiOperation({ summary: '查询 taxonomy rollout recovery / retirement report history' })
  @ApiResponse({
    status: 200,
    description: '成功返回分页 report history',
    type: TaxonomyRolloutReportHistoryResponseDto,
  })
  async getTaxonomyRolloutReports(
    @Query() query: TaxonomyRolloutReportHistoryQueryDto,
    @Req() req: TaxonomyRolloutRequest,
  ): Promise<TaxonomyRolloutReportHistoryResponseDto> {
    const l1Code = query.l1Code ? this.validateL1Code(query.l1Code) : undefined
    const page = this.parsePositiveInteger(query.page, 1, 10000)
    const limit = this.parsePositiveInteger(query.limit, 20, 50)
    const dateFrom = this.parseOptionalDate(query.dateFrom, 'dateFrom')
    const dateTo = this.parseOptionalDate(query.dateTo, 'dateTo')

    if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) {
      throw new BadRequestException('dateFrom must be earlier than or equal to dateTo.')
    }

    return this.auditLogService.findTaxonomyRolloutReports({
      tenantId: this.assertTenantScope(req),
      l1Code,
      page,
      limit,
      dateFrom,
      dateTo,
    })
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
