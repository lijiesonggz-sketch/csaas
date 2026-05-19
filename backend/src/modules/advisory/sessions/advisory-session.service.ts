import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import {
  AdvisoryWorkflowSessionCurrentStep,
  AdvisoryWorkflowSessionStatus,
} from '../../../database/entities/advisory-workflow-session.entity'
import { AdvisoryAccessService, AdvisoryAccessUser } from '../access/advisory-access.service'
import { AdvisoryEventService } from '../events/advisory-event.service'
import {
  ThinkTankEventName,
  ThinkTankEventOutcome,
  ThinkTankPrivacyClassification,
  ThinkTankSubjectType,
} from '../events/thinktank-event-contract'
import { ThinkTankPromptAssemblerService } from '../runtime/prompt-assembler.service'
import { ThinkTankRuntimeError, ThinkTankRuntimeErrorCode } from '../runtime/runtime.errors'
import { ThinkTankAssembledPrompt, ThinkTankWorkflowMetadata } from '../runtime/runtime.types'
import { ThinkTankWorkflowRegistryService } from '../runtime/workflow-registry.service'
import { AdvisorySessionRepository } from './advisory-session.repository'

export const THINKTANK_WORKFLOW_START_FAILED_MESSAGE =
  '暂时无法启动该 ThinkTank 工作流，请稍后重试或选择其他工作流。'
export const THINKTANK_WORKFLOW_ALREADY_ACTIVE_MESSAGE =
  '已有活动 ThinkTank 会话，请先完成或退出当前会话后再启动新的工作流。'
const THINKTANK_WORKFLOW_CATALOG_UNAVAILABLE_MESSAGE =
  '暂时无法加载 ThinkTank 工作流目录，请稍后重试。'
const SAFE_CURRENT_STEP_REF = 'current-step:1'
const INVALID_WORKFLOW_AUDIT_KEY = 'invalid-workflow'
const EXPECTED_THINKTANK_WORKFLOW_KEYS = [
  'brainstorming',
  'domain-research',
  'market-research',
  'product-brief',
  'prd',
  'problem-solving',
  'design-thinking',
  'storytelling',
] as const

export interface AdvisoryWorkflowCatalogItem {
  key: string
  displayName: string
  canonicalName: string
  scenarioLabel: string
  description?: string
  sourcePath: string
}

export interface AdvisoryWorkflowCatalogResult {
  workflows: AdvisoryWorkflowCatalogItem[]
}

export interface AdvisoryWorkflowLaunchResult {
  sessionId: string
  workflow: AdvisoryWorkflowCatalogItem
  status: AdvisoryWorkflowSessionStatus.Active
  sourceRefs: string[]
  firstPrompt: string
  currentStep: AdvisoryWorkflowSessionCurrentStep
}

interface AdvisorySessionContext {
  user: AdvisoryAccessUser
  tenantId: string
}

interface AdvisoryWorkflowLaunchContext extends AdvisorySessionContext {
  workflowKey: string
}

@Injectable()
export class AdvisorySessionService {
  constructor(
    private readonly accessService: AdvisoryAccessService,
    private readonly workflowRegistry: ThinkTankWorkflowRegistryService,
    private readonly promptAssembler: ThinkTankPromptAssemblerService,
    private readonly sessionRepository: AdvisorySessionRepository,
    private readonly eventService: AdvisoryEventService,
  ) {}

  async listWorkflows(context: AdvisorySessionContext): Promise<AdvisoryWorkflowCatalogResult> {
    await this.accessService.assertThinkTankModuleAvailable(context.user, context.tenantId)

    const workflows = await this.workflowRegistry.discoverWorkflows()
    this.assertCompleteWorkflowCatalog(workflows)

    return {
      workflows: workflows.map((workflow) => this.toCatalogItem(workflow)),
    }
  }

  async launchWorkflow(
    context: AdvisoryWorkflowLaunchContext,
  ): Promise<AdvisoryWorkflowLaunchResult> {
    await this.accessService.assertThinkTankModuleAvailable(context.user, context.tenantId)

    let workflowKey = this.toSafeWorkflowKey(context.workflowKey)

    try {
      workflowKey = this.normalizeWorkflowKey(context.workflowKey)

      const activeSession = await this.sessionRepository.findActiveSessionForActor(
        context.tenantId,
        context.user.id,
      )
      if (activeSession) {
        throw new ConflictException(THINKTANK_WORKFLOW_ALREADY_ACTIVE_MESSAGE)
      }

      const workflow = await this.workflowRegistry.findWorkflow(workflowKey)
      if (!workflow) {
        throw new ThinkTankRuntimeError(
          ThinkTankRuntimeErrorCode.WorkflowNotFound,
          'ThinkTank runtime workflow was not found',
          { sourcePath: workflowKey },
        )
      }

      const assembledPrompt = await this.promptAssembler.assemblePrompt({
        workflowKey,
        includeMethodLibraries: true,
        includeAgentSources: true,
      })
      const currentStep = this.createCurrentStepSnapshot()
      const firstPrompt = this.extractVisibleFirstPrompt(assembledPrompt, workflow)
      const responseSourceRefs = this.toSafeResponseSourceRefs(workflow)
      const session = await this.sessionRepository.createLaunchSession(context.tenantId, {
        actorId: context.user.id,
        workflowKey: workflow.key,
        workflowDisplayName: workflow.displayName,
        scenarioLabel: workflow.scenarioLabel,
        status: AdvisoryWorkflowSessionStatus.Active,
        currentStep,
        sourceRefs: assembledPrompt.sourceRefs,
        metadata: {
          workflow_key: workflow.key,
          source_ref_count: assembledPrompt.sourceRefs.length,
        },
      })

      await this.emitWorkflowStarted({
        tenantId: context.tenantId,
        user: context.user,
        sessionId: session.id,
        workflowKey: workflow.key,
        sourceRefCount: assembledPrompt.sourceRefs.length,
      }).catch(() => undefined)

      return {
        sessionId: session.id,
        workflow: this.toCatalogItem(workflow),
        status: AdvisoryWorkflowSessionStatus.Active,
        sourceRefs: responseSourceRefs,
        firstPrompt,
        currentStep,
      }
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error
      }

      await this.emitWorkflowStartFailed({
        tenantId: context.tenantId,
        user: context.user,
        workflowKey,
        error,
      }).catch(() => undefined)

      throw this.toLaunchException(error)
    }
  }

  private assertCompleteWorkflowCatalog(workflows: ThinkTankWorkflowMetadata[]): void {
    const keys = new Set(workflows.map((workflow) => workflow.key))
    const complete =
      workflows.length === EXPECTED_THINKTANK_WORKFLOW_KEYS.length &&
      EXPECTED_THINKTANK_WORKFLOW_KEYS.every((key) => keys.has(key))

    if (!complete) {
      throw new ServiceUnavailableException(THINKTANK_WORKFLOW_CATALOG_UNAVAILABLE_MESSAGE)
    }
  }

  private toCatalogItem(workflow: ThinkTankWorkflowMetadata): AdvisoryWorkflowCatalogItem {
    return {
      key: workflow.key,
      displayName: workflow.displayName,
      canonicalName: workflow.displayName,
      scenarioLabel: workflow.scenarioLabel,
      description: workflow.description,
      sourcePath: workflow.sourcePath,
    }
  }

  private createCurrentStepSnapshot(): AdvisoryWorkflowSessionCurrentStep {
    return {
      index: 1,
      label: '当前步骤',
      sourceRef: SAFE_CURRENT_STEP_REF,
    }
  }

  private extractVisibleFirstPrompt(
    assembledPrompt: ThinkTankAssembledPrompt,
    workflow: ThinkTankWorkflowMetadata,
  ): string {
    const firstPromptSource = assembledPrompt.sources.find(
      (source) => source.relativePath === workflow.firstPromptSource,
    )
    const prompt = firstPromptSource?.content.trim()

    if (!prompt) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.WorkflowMalformed,
        'ThinkTank runtime workflow is missing a first prompt source',
        { sourcePath: workflow.firstPromptSource },
      )
    }

    return prompt
  }

  private toSafeResponseSourceRefs(workflow: ThinkTankWorkflowMetadata): string[] {
    return [`workflow:${workflow.key}`, SAFE_CURRENT_STEP_REF]
  }

  private normalizeWorkflowKey(workflowKey: string): string {
    if (typeof workflowKey !== 'string' || workflowKey.trim().length === 0) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.InvalidWorkflowKey,
        'ThinkTank workflow key must be a non-empty string',
      )
    }

    const normalizedKey = workflowKey
      .trim()
      .toLowerCase()
      .replace(/[_\s]+/g, '-')

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedKey)) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.InvalidWorkflowKey,
        'ThinkTank workflow key contains unsupported characters',
      )
    }

    return normalizedKey
  }

  private toSafeWorkflowKey(workflowKey: string): string {
    if (typeof workflowKey !== 'string') {
      return INVALID_WORKFLOW_AUDIT_KEY
    }

    const normalizedKey = workflowKey
      .trim()
      .toLowerCase()
      .replace(/[_\s]+/g, '-')

    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedKey)
      ? normalizedKey
      : INVALID_WORKFLOW_AUDIT_KEY
  }

  private async emitWorkflowStarted(context: {
    tenantId: string
    user: AdvisoryAccessUser
    sessionId: string
    workflowKey: string
    sourceRefCount: number
  }): Promise<void> {
    await this.eventService.emitAudit({
      eventName: ThinkTankEventName.WorkflowStarted,
      tenantId: context.tenantId,
      actorId: context.user.id,
      subjectType: ThinkTankSubjectType.Session,
      subjectId: context.sessionId,
      outcome: ThinkTankEventOutcome.Success,
      privacyClassification: ThinkTankPrivacyClassification.Operational,
      optional: {
        sessionId: context.sessionId,
        workflowType: context.workflowKey,
      },
      audit: {
        action: AuditAction.CREATE,
        entityType: 'ThinkTankWorkflowSession',
        entityId: context.sessionId,
        organizationId: context.user.organizationId ?? null,
      },
      metadata: {
        workflow_key: context.workflowKey,
        source_ref_count: context.sourceRefCount,
      },
    })
  }

  private async emitWorkflowStartFailed(context: {
    tenantId: string
    user: AdvisoryAccessUser
    workflowKey: string
    error: unknown
  }): Promise<void> {
    await this.eventService.emitAudit({
      eventName: ThinkTankEventName.WorkflowStartFailed,
      tenantId: context.tenantId,
      actorId: context.user.id,
      subjectType: ThinkTankSubjectType.Workflow,
      subjectId: context.workflowKey,
      outcome: ThinkTankEventOutcome.Failure,
      privacyClassification: ThinkTankPrivacyClassification.Operational,
      optional: {
        workflowType: context.workflowKey,
      },
      audit: {
        action: AuditAction.CREATE,
        entityType: 'ThinkTankWorkflow',
        entityId: null,
        organizationId: context.user.organizationId ?? null,
      },
      metadata: {
        workflow_key: context.workflowKey,
        runtime_error_code: this.readRuntimeErrorCode(context.error),
      },
    })
  }

  private readRuntimeErrorCode(error: unknown): string {
    if (error instanceof ThinkTankRuntimeError) {
      return error.code
    }

    if (error instanceof Error) {
      return error.name
    }

    return 'THINKTANK_RUNTIME_UNKNOWN_ERROR'
  }

  private toLaunchException(error: unknown) {
    if (error instanceof ThinkTankRuntimeError) {
      if (error.code === ThinkTankRuntimeErrorCode.InvalidWorkflowKey) {
        return new BadRequestException(THINKTANK_WORKFLOW_START_FAILED_MESSAGE)
      }

      if (error.code === ThinkTankRuntimeErrorCode.WorkflowNotFound) {
        return new NotFoundException(THINKTANK_WORKFLOW_START_FAILED_MESSAGE)
      }
    }

    return new ServiceUnavailableException(THINKTANK_WORKFLOW_START_FAILED_MESSAGE)
  }
}
