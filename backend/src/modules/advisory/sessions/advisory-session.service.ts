import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { randomUUID } from 'crypto'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import {
  AdvisoryConversationDecisionOption,
  AdvisoryConversationMessage,
  AdvisoryConversationMessageRole,
} from '../../../database/entities/advisory-conversation-message.entity'
import {
  AdvisoryWorkflowOutput,
  AdvisoryWorkflowOutputSection,
  AdvisoryWorkflowOutputStatus,
} from '../../../database/entities/advisory-workflow-output.entity'
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
import { AdvisoryWorkflowOutputRepository } from '../outputs/advisory-workflow-output.repository'
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
export const THINKTANK_OUTPUT_SECTION_INVALID_MESSAGE = 'Output section content is required.'
export const THINKTANK_OUTPUT_NOT_FOUND_MESSAGE = 'ThinkTank output draft not found.'
export const THINKTANK_OUTPUT_LABEL_MISSING_MESSAGE =
  'ThinkTank output cannot be completed without AI labeling metadata.'
export const THINKTANK_OUTPUT_EMPTY_MESSAGE =
  'ThinkTank output cannot be completed before a report section exists.'
export const THINKTANK_OUTPUT_SOURCE_MESSAGE_INVALID_MESSAGE =
  'ThinkTank output source message was not found.'
export const THINKTANK_OUTPUT_OUTCOME_INVALID_MESSAGE =
  'ThinkTank output completion outcome must be success or failure.'
export const THINKTANK_OUTPUT_SECTION_TOO_LONG_MESSAGE = 'Output section content is too long.'
const THINKTANK_OUTPUT_SECTION_MAX_LENGTH = 20000
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

export interface AdvisorySessionOutputResult {
  sessionId: string
  output: AdvisoryWorkflowOutput
}

export interface AdvisorySessionOutputsResult {
  sessionId: string
  outputs: AdvisoryWorkflowOutput[]
}

export interface AdvisoryOutputAppendResult extends AdvisorySessionOutputResult {
  section: AdvisoryWorkflowOutputSection
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

interface AdvisoryAppendOutputSectionContext extends AdvisorySessionMessageContext {
  stepIndex: number
  stepLabel?: string
  contentMarkdown: string
  sourceMessageId?: string
  providerMetadata?: Record<string, unknown>
}

interface AdvisoryCompleteOutputContext extends AdvisorySessionMessageContext {
  outcome: string
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
    private readonly outputRepository?: AdvisoryWorkflowOutputRepository,
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

  async getSessionOutput(
    context: AdvisorySessionMessageContext,
  ): Promise<AdvisorySessionOutputResult> {
    await this.accessService.assertThinkTankModuleAvailable(context.user, context.tenantId)
    const session = await this.getTenantSession(context.tenantId, context.sessionId)
    const outputRepository = this.requireOutputRepository()
    const existingDraft = await outputRepository.findActiveDraftForSession(
      context.tenantId,
      session.id,
    )
    const completedOutput = existingDraft
      ? null
      : await outputRepository.findLatestCompletedForSession(context.tenantId, session.id)
    const output =
      existingDraft ??
      completedOutput ??
      (await this.createActiveDraftForSession(context.tenantId, session))

    return {
      sessionId: session.id,
      output,
    }
  }

  async listSessionOutputs(
    context: AdvisorySessionMessageContext,
  ): Promise<AdvisorySessionOutputsResult> {
    await this.accessService.assertThinkTankModuleAvailable(context.user, context.tenantId)
    const session = await this.getTenantSession(context.tenantId, context.sessionId)
    const outputs = await this.requireOutputRepository().findOutputsBySession(
      context.tenantId,
      session.id,
    )

    return {
      sessionId: session.id,
      outputs,
    }
  }

  async appendOutputSection(
    context: AdvisoryAppendOutputSectionContext,
  ): Promise<AdvisoryOutputAppendResult> {
    await this.accessService.assertThinkTankModuleAvailable(context.user, context.tenantId)
    const session = await this.getTenantSession(context.tenantId, context.sessionId)
    this.assertActiveOutputSession(session)
    const sourceMessage = await this.resolveOutputSourceMessage(context, session)
    const contentMarkdown = this.normalizeOutputSectionContent(sourceMessage.content)
    const outputRepository = this.requireOutputRepository()
    const draft =
      (await outputRepository.findActiveDraftForSession(context.tenantId, session.id)) ??
      (await this.createActiveDraftForSession(context.tenantId, session))
    const stepIndex = this.normalizeStepIndex(context.stepIndex, session.currentStep.index)
    const stepLabel = this.normalizeStepLabel(
      context.stepLabel ?? session.currentStep.label,
      stepIndex,
    )
    const providerMetadata = this.toSafeProviderMetadata(sourceMessage.providerMetadata ?? {})
    const section: AdvisoryWorkflowOutputSection = {
      id: randomUUID(),
      stepIndex,
      heading: stepLabel,
      contentMarkdown: `[AI Generated]\n\n${contentMarkdown}`,
      aiLabel: '[AI Generated]',
      metadata: {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        ai_generated: true,
        machine_readable: true,
        workflow_key: session.workflowKey,
        source_session_id: session.id,
        source_message_id: this.optionalText(context.sourceMessageId),
        step_label: stepLabel,
        step_index: stepIndex,
        generated_at: new Date().toISOString(),
        ...providerMetadata,
      },
      createdAt: new Date().toISOString(),
    }
    const output = await outputRepository.appendSection(context.tenantId, draft.id, section)

    if (!output) {
      throw new NotFoundException(THINKTANK_OUTPUT_NOT_FOUND_MESSAGE)
    }

    return {
      sessionId: session.id,
      output,
      section,
    }
  }

  async completeOutput(
    context: AdvisoryCompleteOutputContext,
  ): Promise<AdvisorySessionOutputResult> {
    await this.accessService.assertThinkTankModuleAvailable(context.user, context.tenantId)
    const session = await this.getTenantSession(context.tenantId, context.sessionId)
    this.assertActiveOutputSession(session)
    const outputRepository = this.requireOutputRepository()
    const draft = await outputRepository.findActiveDraftForSession(context.tenantId, session.id)
    const outcome = this.normalizeOutputCompletionOutcome(context.outcome)

    if (!draft) {
      throw new NotFoundException(THINKTANK_OUTPUT_NOT_FOUND_MESSAGE)
    }

    if (!this.hasRequiredAiLabelMetadata(draft)) {
      throw new BadRequestException(THINKTANK_OUTPUT_LABEL_MISSING_MESSAGE)
    }

    if (!this.hasReportContent(draft)) {
      throw new BadRequestException(THINKTANK_OUTPUT_EMPTY_MESSAGE)
    }

    const completedAt = new Date().toISOString()
    const output = await outputRepository.completeDraftAndSession(
      context.tenantId,
      draft.id,
      session.id,
      {
        outcome,
        completedAt,
        sessionMetadata: {
          ...(session.metadata ?? {}),
          output_id: draft.id,
          completed_at: completedAt,
        },
      },
    )

    if (!output) {
      throw new NotFoundException(THINKTANK_OUTPUT_NOT_FOUND_MESSAGE)
    }

    await this.emitWorkflowCompleted({
      tenantId: context.tenantId,
      user: context.user,
      sessionId: session.id,
      workflowKey: session.workflowKey,
      output,
      outcome,
    })

    return {
      sessionId: session.id,
      output,
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

  private requireOutputRepository(): AdvisoryWorkflowOutputRepository {
    if (!this.outputRepository) {
      throw new ServiceUnavailableException(THINKTANK_OUTPUT_NOT_FOUND_MESSAGE)
    }

    return this.outputRepository
  }

  private assertActiveOutputSession(session: { status: AdvisoryWorkflowSessionStatus }): void {
    if (session.status !== AdvisoryWorkflowSessionStatus.Active) {
      throw new NotFoundException(THINKTANK_OUTPUT_NOT_FOUND_MESSAGE)
    }
  }

  private async createActiveDraftForSession(
    tenantId: string,
    session: {
      id: string
      actorId: string
      workflowKey: string
      workflowDisplayName: string
      status: AdvisoryWorkflowSessionStatus
    },
  ): Promise<AdvisoryWorkflowOutput> {
    this.assertActiveOutputSession(session)
    const outputRepository = this.requireOutputRepository()

    try {
      return await outputRepository.createDraft(tenantId, {
        sessionId: session.id,
        actorId: session.actorId,
        workflowKey: session.workflowKey,
        status: AdvisoryWorkflowOutputStatus.Draft,
        title: this.createOutputTitle(session.workflowDisplayName),
        summary: `Live report draft for the ${session.workflowKey} workflow.`,
        contentMarkdown: '',
        sections: [],
        aiLabelMetadata: this.createOutputAiLabelMetadata(session),
        metadata: {
          section_count: 0,
          last_step_index: null,
        },
      })
    } catch (error) {
      if (!this.isUniqueConstraintViolation(error)) {
        throw error
      }

      const existingDraft = await outputRepository.findActiveDraftForSession(tenantId, session.id)
      if (existingDraft) return existingDraft
      throw error
    }
  }

  private async resolveOutputSourceMessage(
    context: AdvisoryAppendOutputSectionContext,
    session: { id: string },
  ): Promise<AdvisoryConversationMessage> {
    const sourceMessageId = this.optionalText(context.sourceMessageId)
    if (!sourceMessageId) {
      throw new BadRequestException(THINKTANK_OUTPUT_SOURCE_MESSAGE_INVALID_MESSAGE)
    }

    const sourceMessage = await this.requireMessageRepository().findMessageById(
      context.tenantId,
      sourceMessageId,
    )

    if (
      !sourceMessage ||
      sourceMessage.sessionId !== session.id ||
      sourceMessage.role !== AdvisoryConversationMessageRole.Assistant
    ) {
      throw new BadRequestException(THINKTANK_OUTPUT_SOURCE_MESSAGE_INVALID_MESSAGE)
    }

    return sourceMessage
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

  private normalizeOutputSectionContent(content: string): string {
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new BadRequestException(THINKTANK_OUTPUT_SECTION_INVALID_MESSAGE)
    }

    const normalized = content.trim()
    if (normalized.length > THINKTANK_OUTPUT_SECTION_MAX_LENGTH) {
      throw new BadRequestException(THINKTANK_OUTPUT_SECTION_TOO_LONG_MESSAGE)
    }

    return normalized
  }

  private normalizeStepIndex(value: unknown, fallback: number): number {
    return Number.isInteger(value) && (value as number) > 0 ? (value as number) : fallback
  }

  private normalizeStepLabel(value: string, stepIndex: number): string {
    const label = typeof value === 'string' && value.trim() ? value.trim() : `Step ${stepIndex}`

    return label.length > 120 ? label.slice(0, 120) : label
  }

  private optionalText(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  private normalizeOutputCompletionOutcome(outcome: string): ThinkTankEventOutcome {
    if (outcome === ThinkTankEventOutcome.Success || outcome === 'success') {
      return ThinkTankEventOutcome.Success
    }
    if (outcome === ThinkTankEventOutcome.Failure || outcome === 'failure') {
      return ThinkTankEventOutcome.Failure
    }

    throw new BadRequestException(THINKTANK_OUTPUT_OUTCOME_INVALID_MESSAGE)
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === '23505'
    )
  }

  private createOutputTitle(workflowDisplayName: string): string {
    return `${workflowDisplayName} Report Draft`
  }

  private createOutputAiLabelMetadata(session: {
    id: string
    workflowKey: string
  }): Record<string, unknown> {
    return {
      visible_label: '[AI Generated]',
      label: 'AI Generated',
      ai_generated: true,
      machine_readable: true,
      generator: 'ThinkTank',
      source_session_id: session.id,
      workflow_key: session.workflowKey,
      generated_at: new Date().toISOString(),
    }
  }

  private toSafeProviderMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const safe: Record<string, unknown> = {}
    const copyText = (sourceKey: string, targetKey = sourceKey) => {
      const value = metadata[sourceKey]
      if (typeof value === 'string' && value.trim()) {
        safe[targetKey] = value.trim()
      }
    }
    const copyNumber = (sourceKey: string, targetKey = sourceKey) => {
      const value = metadata[sourceKey]
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        safe[targetKey] = value
      }
    }

    copyText('provider')
    copyText('model')
    copyNumber('latencyMs', 'latency_ms')
    copyNumber('latency_ms', 'latency_ms')
    copyNumber('inputTokens', 'input_tokens')
    copyNumber('input_tokens', 'input_tokens')
    copyNumber('outputTokens', 'output_tokens')
    copyNumber('output_tokens', 'output_tokens')
    copyNumber('totalTokens', 'total_tokens')
    copyNumber('total_tokens', 'total_tokens')
    copyNumber('estimatedCost', 'estimated_cost')
    copyNumber('estimated_cost', 'estimated_cost')

    return safe
  }

  private hasRequiredAiLabelMetadata(output: AdvisoryWorkflowOutput): boolean {
    const metadata = output.aiLabelMetadata ?? {}

    return (
      metadata.visible_label === '[AI Generated]' &&
      metadata.ai_generated === true &&
      metadata.machine_readable === true
    )
  }

  private hasReportContent(output: AdvisoryWorkflowOutput): boolean {
    return (
      Array.isArray(output.sections) &&
      output.sections.some(
        (section) =>
          section.aiLabel === '[AI Generated]' &&
          typeof section.contentMarkdown === 'string' &&
          section.contentMarkdown.trim().replace('[AI Generated]', '').trim().length > 0,
      )
    )
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

  private async emitWorkflowCompleted(context: {
    tenantId: string
    user: AdvisoryAccessUser
    sessionId: string
    workflowKey: string
    output: AdvisoryWorkflowOutput
    outcome: string
  }): Promise<void> {
    await this.eventService.emitAudit({
      eventName: ThinkTankEventName.WorkflowCompleted,
      tenantId: context.tenantId,
      actorId: context.user.id,
      subjectType: ThinkTankSubjectType.Output,
      subjectId: context.output.id,
      outcome:
        context.outcome === ThinkTankEventOutcome.Failure
          ? ThinkTankEventOutcome.Failure
          : ThinkTankEventOutcome.Success,
      privacyClassification: ThinkTankPrivacyClassification.Operational,
      optional: {
        sessionId: context.sessionId,
        outputId: context.output.id,
        workflowType: context.workflowKey,
      },
      audit: {
        action: AuditAction.UPDATE,
        entityType: 'ThinkTankWorkflowOutput',
        entityId: context.output.id,
        organizationId: context.user.organizationId ?? null,
      },
      metadata: {
        workflow_key: context.workflowKey,
        section_count: context.output.sections?.length ?? 0,
        ai_label_metadata_present: this.hasRequiredAiLabelMetadata(context.output),
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
