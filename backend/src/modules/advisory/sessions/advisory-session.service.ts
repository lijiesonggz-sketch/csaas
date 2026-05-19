import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import {
  AdvisoryConversationDecisionOption,
  AdvisoryConversationMessage,
  AdvisoryConversationMessageRole,
} from '../../../database/entities/advisory-conversation-message.entity'
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
import { ThinkTankProviderGatewayService } from '../provider-gateway/thinktank-provider-gateway.service'
import {
  ThinkTankProviderMessage,
  ThinkTankProviderStreamChunk,
} from '../provider-gateway/thinktank-provider-gateway.types'
import { ThinkTankPromptAssemblerService } from '../runtime/prompt-assembler.service'
import { ThinkTankRuntimeError, ThinkTankRuntimeErrorCode } from '../runtime/runtime.errors'
import { ThinkTankAssembledPrompt, ThinkTankWorkflowMetadata } from '../runtime/runtime.types'
import { ThinkTankWorkflowRegistryService } from '../runtime/workflow-registry.service'
import { AdvisoryConversationMessageRepository } from './advisory-conversation-message.repository'
import { AdvisorySessionRepository } from './advisory-session.repository'
import { THINKTANK_MESSAGE_MAX_LENGTH } from './dto/submit-advisory-message.dto'

export const THINKTANK_WORKFLOW_START_FAILED_MESSAGE =
  '暂时无法启动该 ThinkTank 工作流，请稍后重试或选择其他工作流。'
export const THINKTANK_WORKFLOW_ALREADY_ACTIVE_MESSAGE =
  '已有活动 ThinkTank 会话，请先完成或退出当前会话后再启动新的工作流。'
export const THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE =
  '暂时无法生成 ThinkTank 顾问回复，请稍后重试。'
export const THINKTANK_EMPTY_MESSAGE_MESSAGE = '请输入你的回答后再提交。'
export const THINKTANK_MESSAGE_TOO_LONG_MESSAGE = '内容过长，请精简到 5000 字符以内。'
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

export interface AdvisoryConversationStreamChunk {
  index: number
  delta: string
  done: boolean
  provider?: string
  model?: string
  latencyMs?: number
  finishReason?: string
}

export interface AdvisoryConversationMessagesResult {
  sessionId: string
  currentStep: AdvisoryWorkflowSessionCurrentStep
  messages: AdvisoryConversationMessage[]
}

export interface AdvisoryConversationSubmitResult extends AdvisoryConversationMessagesResult {
  assistantMessage: AdvisoryConversationMessage
  stream: AdvisoryConversationStreamChunk[]
  decisionOptions: AdvisoryConversationDecisionOption[]
}

export type AdvisoryConversationStreamingEvent =
  | {
      event: 'message.started'
      data: {
        sessionId: string
        currentStep: AdvisoryWorkflowSessionCurrentStep
      }
    }
  | {
      event: 'message.delta'
      data: {
        index: number
        delta: string
      }
    }
  | {
      event: 'message.completed'
      data: {
        sessionId: string
        currentStep: AdvisoryWorkflowSessionCurrentStep
        assistantMessage: AdvisoryConversationMessage
        decisionOptions: AdvisoryConversationDecisionOption[]
        usage?: ThinkTankProviderStreamChunk['usage']
      }
    }
  | {
      event: 'message.error'
      data: {
        code: string
        message: string
        retryable: boolean
      }
    }

interface AdvisorySessionContext {
  user: AdvisoryAccessUser
  tenantId: string
}

interface AdvisoryWorkflowLaunchContext extends AdvisorySessionContext {
  workflowKey: string
}

interface AdvisorySessionMessageContext extends AdvisorySessionContext {
  sessionId: string
}

interface AdvisorySubmitMessageContext extends AdvisorySessionMessageContext {
  content: string
  decisionAction?: string
  signal?: AbortSignal
}

@Injectable()
export class AdvisorySessionService {
  constructor(
    private readonly accessService: AdvisoryAccessService,
    private readonly workflowRegistry: ThinkTankWorkflowRegistryService,
    private readonly promptAssembler: ThinkTankPromptAssemblerService,
    private readonly sessionRepository: AdvisorySessionRepository,
    private readonly eventService: AdvisoryEventService,
    private readonly messageRepository?: AdvisoryConversationMessageRepository,
    private readonly providerGateway?: ThinkTankProviderGatewayService,
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

  async listMessages(
    context: AdvisorySessionMessageContext,
  ): Promise<AdvisoryConversationMessagesResult> {
    await this.accessService.assertThinkTankModuleAvailable(context.user, context.tenantId)
    const session = await this.getTenantSession(context.tenantId, context.sessionId)
    const messages = await this.requireMessageRepository().findMessagesBySession(
      context.tenantId,
      session.id,
    )

    return {
      sessionId: session.id,
      currentStep: session.currentStep,
      messages,
    }
  }

  async submitMessage(
    context: AdvisorySubmitMessageContext,
  ): Promise<AdvisoryConversationSubmitResult> {
    await this.accessService.assertThinkTankModuleAvailable(context.user, context.tenantId)
    const content = this.normalizeMessageContent(context.content)
    const session = await this.getTenantSession(context.tenantId, context.sessionId)

    if (session.status !== AdvisoryWorkflowSessionStatus.Active) {
      throw new NotFoundException('ThinkTank session not found')
    }

    const messageRepository = this.requireMessageRepository()
    const providerGateway = this.requireProviderGateway()
    const history = await messageRepository.findMessagesBySession(context.tenantId, session.id)
    const userMessage = await messageRepository.createMessageWithNextSequence(
      context.tenantId,
      session.id,
      {
        sessionId: session.id,
        actorId: context.user.id,
        role: AdvisoryConversationMessageRole.User,
        content,
        workflowKey: session.workflowKey,
        stepIndex: session.currentStep.index,
        decisionOptions: [],
        metadata: this.createMessageMetadata(session.workflowKey, session.currentStep.index, {
          decision_action: context.decisionAction ?? null,
        }),
        providerMetadata: {},
      },
    )
    const providerMessages = this.toProviderMessages([...history, userMessage])
    const providerChunks: ThinkTankProviderStreamChunk[] = []
    let assistantContent = ''

    try {
      for await (const chunk of providerGateway.stream({
        tenantId: context.tenantId,
        actorId: context.user.id,
        subjectId: session.id,
        stream: true,
        system: this.createProviderSystemPrompt(session.workflowKey, session.currentStep),
        messages: providerMessages,
        metadata: {
          workflow_key: session.workflowKey,
          step_index: session.currentStep.index,
          message_count: providerMessages.length,
          decision_action: context.decisionAction ?? null,
        },
      })) {
        providerChunks.push(chunk)
        assistantContent += chunk.delta
      }
    } catch (error) {
      throw this.toMessageSubmitException(error)
    }

    if (!assistantContent.trim()) {
      throw new ServiceUnavailableException(THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE)
    }

    const decisionOptions = this.createDecisionOptions()
    const lastChunk = providerChunks.at(-1)
    const assistantMessage = await messageRepository.createMessageWithNextSequence(
      context.tenantId,
      session.id,
      {
        sessionId: session.id,
        actorId: context.user.id,
        role: AdvisoryConversationMessageRole.Assistant,
        content: assistantContent.trim(),
        workflowKey: session.workflowKey,
        stepIndex: session.currentStep.index,
        decisionOptions,
        metadata: this.createMessageMetadata(session.workflowKey, session.currentStep.index, {
          ai_generated: true,
          finish_reason: lastChunk?.finishReason ?? null,
        }),
        providerMetadata: {
          provider: lastChunk?.provider ?? null,
          model: lastChunk?.model ?? null,
          latency_ms: lastChunk?.latencyMs ?? null,
          estimated_cost: lastChunk?.estimatedCost ?? null,
          input_tokens: lastChunk?.usage?.inputTokens ?? null,
          output_tokens: lastChunk?.usage?.outputTokens ?? null,
          total_tokens: lastChunk?.usage?.totalTokens ?? null,
        },
      },
    )

    return {
      sessionId: session.id,
      currentStep: session.currentStep,
      messages: [...history, userMessage, assistantMessage],
      assistantMessage,
      stream: providerChunks.map((chunk) => ({
        index: chunk.index,
        delta: chunk.delta,
        done: chunk.done,
        provider: chunk.provider,
        model: chunk.model,
        latencyMs: chunk.latencyMs,
        finishReason: chunk.finishReason,
      })),
      decisionOptions,
    }
  }

  async *streamMessage(
    context: AdvisorySubmitMessageContext,
  ): AsyncIterable<AdvisoryConversationStreamingEvent> {
    await this.accessService.assertThinkTankModuleAvailable(context.user, context.tenantId)
    const content = this.normalizeMessageContent(context.content)
    const session = await this.getTenantSession(context.tenantId, context.sessionId)

    if (session.status !== AdvisoryWorkflowSessionStatus.Active) {
      throw new NotFoundException('ThinkTank session not found')
    }

    const messageRepository = this.requireMessageRepository()
    const providerGateway = this.requireProviderGateway()
    const history = await messageRepository.findMessagesBySession(context.tenantId, session.id)
    const userMessage = await messageRepository.createMessageWithNextSequence(
      context.tenantId,
      session.id,
      {
        sessionId: session.id,
        actorId: context.user.id,
        role: AdvisoryConversationMessageRole.User,
        content,
        workflowKey: session.workflowKey,
        stepIndex: session.currentStep.index,
        decisionOptions: [],
        metadata: this.createMessageMetadata(session.workflowKey, session.currentStep.index, {
          decision_action: context.decisionAction ?? null,
        }),
        providerMetadata: {},
      },
    )
    const providerMessages = this.toProviderMessages([...history, userMessage])
    const providerChunks: ThinkTankProviderStreamChunk[] = []
    let assistantContent = ''

    yield {
      event: 'message.started',
      data: {
        sessionId: session.id,
        currentStep: session.currentStep,
      },
    }

    try {
      for await (const chunk of providerGateway.stream(
        {
          tenantId: context.tenantId,
          actorId: context.user.id,
          subjectId: session.id,
          stream: true,
          system: this.createProviderSystemPrompt(session.workflowKey, session.currentStep),
          messages: providerMessages,
          metadata: {
            workflow_key: session.workflowKey,
            step_index: session.currentStep.index,
            message_count: providerMessages.length,
            decision_action: context.decisionAction ?? null,
          },
        },
        context.signal,
      )) {
        if (context.signal?.aborted) {
          return
        }
        providerChunks.push(chunk)
        assistantContent += chunk.delta
        yield {
          event: 'message.delta',
          data: {
            index: chunk.index,
            delta: chunk.delta,
          },
        }
      }
    } catch {
      if (context.signal?.aborted) {
        return
      }
      yield {
        event: 'message.error',
        data: {
          code: 'THINKTANK_STREAM_FAILED',
          message: THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE,
          retryable: true,
        },
      }
      return
    }

    if (context.signal?.aborted) {
      return
    }

    if (!assistantContent.trim()) {
      yield {
        event: 'message.error',
        data: {
          code: 'THINKTANK_STREAM_FAILED',
          message: THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE,
          retryable: true,
        },
      }
      return
    }

    const decisionOptions = this.createDecisionOptions()
    const lastChunk = providerChunks.at(-1)
    const assistantMessage = await messageRepository.createMessageWithNextSequence(
      context.tenantId,
      session.id,
      {
        sessionId: session.id,
        actorId: context.user.id,
        role: AdvisoryConversationMessageRole.Assistant,
        content: assistantContent.trim(),
        workflowKey: session.workflowKey,
        stepIndex: session.currentStep.index,
        decisionOptions,
        metadata: this.createMessageMetadata(session.workflowKey, session.currentStep.index, {
          ai_generated: true,
          finish_reason: lastChunk?.finishReason ?? null,
        }),
        providerMetadata: {
          provider: lastChunk?.provider ?? null,
          model: lastChunk?.model ?? null,
          latency_ms: lastChunk?.latencyMs ?? null,
          estimated_cost: lastChunk?.estimatedCost ?? null,
          input_tokens: lastChunk?.usage?.inputTokens ?? null,
          output_tokens: lastChunk?.usage?.outputTokens ?? null,
          total_tokens: lastChunk?.usage?.totalTokens ?? null,
        },
      },
    )

    yield {
      event: 'message.completed',
      data: {
        sessionId: session.id,
        currentStep: session.currentStep,
        assistantMessage,
        decisionOptions,
        ...(lastChunk?.usage ? { usage: lastChunk.usage } : {}),
      },
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

  private async getTenantSession(tenantId: string, sessionId: string) {
    const session = await this.sessionRepository.findSessionById(tenantId, sessionId)

    if (!session) {
      throw new NotFoundException('ThinkTank session not found')
    }

    return session
  }

  private requireMessageRepository(): AdvisoryConversationMessageRepository {
    if (!this.messageRepository) {
      throw new ServiceUnavailableException(THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE)
    }

    return this.messageRepository
  }

  private requireProviderGateway(): ThinkTankProviderGatewayService {
    if (!this.providerGateway) {
      throw new ServiceUnavailableException(THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE)
    }

    return this.providerGateway
  }

  private normalizeMessageContent(content: string): string {
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new BadRequestException(THINKTANK_EMPTY_MESSAGE_MESSAGE)
    }

    const normalized = content.trim()
    if (normalized.length > THINKTANK_MESSAGE_MAX_LENGTH) {
      throw new BadRequestException(THINKTANK_MESSAGE_TOO_LONG_MESSAGE)
    }

    return normalized
  }

  private createProviderSystemPrompt(
    workflowKey: string,
    currentStep: AdvisoryWorkflowSessionCurrentStep,
  ): string {
    return [
      'You are the governed ThinkTank advisor for the active CSAAS workflow.',
      `Workflow key: ${workflowKey}.`,
      `Current step index: ${currentStep.index}.`,
      'Guide the user with concise questions, a summary, and explicit continuation choices.',
      'Do not advance workflow steps unless the user explicitly confirms continuation.',
    ].join('\n')
  }

  private toProviderMessages(messages: AdvisoryConversationMessage[]): ThinkTankProviderMessage[] {
    return messages.map((message) => ({
      role:
        message.role === AdvisoryConversationMessageRole.Assistant
          ? AdvisoryConversationMessageRole.Assistant
          : AdvisoryConversationMessageRole.User,
      content: message.content,
    }))
  }

  private createMessageMetadata(
    workflowKey: string,
    stepIndex: number,
    extra: Record<string, string | number | boolean | null>,
  ) {
    return {
      workflow_key: workflowKey,
      step_index: stepIndex,
      ...extra,
    }
  }

  private createDecisionOptions(): AdvisoryConversationDecisionOption[] {
    return [
      {
        key: 'continue',
        action: 'continue',
        label: '继续',
        shortcut: 'C',
        enabled: true,
        description: '确认当前步骤并继续',
      },
      {
        key: 'deepen',
        action: 'deepen',
        label: '深入',
        shortcut: 'A',
        enabled: true,
        description: '围绕当前步骤继续追问',
      },
      {
        key: 'revise',
        action: 'revise',
        label: '修订',
        shortcut: 'R',
        enabled: true,
        description: '修订当前回答或方向',
      },
      {
        key: 'party-mode',
        action: 'party-mode',
        label: 'Party Mode',
        shortcut: 'P',
        enabled: false,
        description: 'Party Mode 专家讨论由后续 Epic 5 接入',
      },
    ]
  }

  private toMessageSubmitException(error: unknown) {
    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      return error
    }

    return new ServiceUnavailableException(THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE)
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
