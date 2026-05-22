import { AdvisoryConversationMessageRole } from '../../../database/entities/advisory-conversation-message.entity'
import { AdvisoryWorkflowSessionStatus } from '../../../database/entities/advisory-workflow-session.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AdvisoryAccessService } from '../access/advisory-access.service'
import { AdvisoryCheckpointService } from '../checkpoints/advisory-checkpoint.service'
import { AdvisoryEventService } from '../events/advisory-event.service'
import {
  ThinkTankEventName,
  ThinkTankEventOutcome,
  ThinkTankPrivacyClassification,
  ThinkTankSubjectType,
} from '../events/thinktank-event-contract'
import { ThinkTankProviderGatewayService } from '../provider-gateway/thinktank-provider-gateway.service'
import {
  ThinkTankProviderGatewayError,
  ThinkTankProviderRequest,
} from '../provider-gateway/thinktank-provider-gateway.types'
import { ThinkTankPromptAssemblerService } from '../runtime/prompt-assembler.service'
import { ThinkTankWorkflowRegistryService } from '../runtime/workflow-registry.service'
import { AdvisoryConversationMessageRepository } from './advisory-conversation-message.repository'
import { AdvisorySessionRepository } from './advisory-session.repository'
import { AdvisorySessionService } from './advisory-session.service'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const sessionId = '550e8400-e29b-41d4-a716-446655440000'

const user = {
  id: actorId,
  role: UserRole.CONSULTANT,
  organizationId: '880e8400-e29b-41d4-a716-446655440000',
}

const partyModeMetadata = {
  workflow_key: 'problem-solving',
  party_mode_active: true,
  party_mode_status: 'context-created',
  party_mode_context_id: `party-context:${sessionId}:message-user-party-entry`,
  party_mode_context_history_pointer: `conversation_messages:${sessionId}`,
  party_mode_problem_context_pointer: `conversation_messages:${sessionId}`,
  party_mode_context_last_message_id: 'message-user-party-entry',
  party_mode_selected_advisor_ids: 'creative-problem-solver|architect|pm',
  party_mode_selected_advisor_names: 'Dr. Quinn|Winston|John',
  party_mode_selected_advisor_roles:
    'Systematic Problem-Solving Expert|System Architect|Product Manager',
  party_mode_selected_advisor_perspectives: '系统性问题诊断|技术架构可行性|产品价值与优先级',
  party_mode_selected_advisor_source_paths:
    '_bmad/cis/agents/creative-problem-solver.md|_bmad/bmm/agents/architect.md|_bmad/bmm/agents/pm.md',
  party_mode_selected_advisor_source_hashes:
    'problem-solver-source-hash|architect-source-hash|pm-source-hash',
  party_mode_selected_advisor_reasons:
    '当前步骤需要 root cause diagnosis|补充 implementation feasibility|补充 user value and prioritization',
  party_mode_selected_advisor_role_families: 'problem-solving|technical|product',
}

const activePartyModeSession = {
  id: sessionId,
  tenantId,
  actorId,
  workflowKey: 'problem-solving',
  workflowDisplayName: 'Problem Solving',
  scenarioLabel: 'Systematic diagnosis and solution design',
  status: AdvisoryWorkflowSessionStatus.Active,
  currentStep: { index: 2, label: '根因分解', sourceRef: 'workflow:problem-solving#step-2' },
  sourceRefs: ['workflow:problem-solving', 'workflow:problem-solving#step-2'],
  metadata: partyModeMetadata,
  failureCode: null,
  failureMessage: null,
  createdAt: new Date('2026-05-22T00:00:00.000Z'),
  updatedAt: new Date('2026-05-22T00:00:00.000Z'),
}

function createMessage(overrides: Record<string, unknown>) {
  return {
    id: 'message-history-1',
    tenantId,
    sessionId,
    actorId,
    role: AdvisoryConversationMessageRole.User,
    content: 'We need to decide whether retention loss is onboarding or pricing.',
    sequence: 1,
    workflowKey: 'problem-solving',
    stepIndex: 2,
    decisionOptions: [],
    metadata: { workflow_key: 'problem-solving', step_index: 2 },
    providerMetadata: {},
    createdAt: new Date('2026-05-22T00:00:00.000Z'),
    updatedAt: new Date('2026-05-22T00:00:00.000Z'),
    ...overrides,
  }
}

describe('Story 5.5 ATDD - Party Mode resource and failure controls backend', () => {
  let originalEnv: NodeJS.ProcessEnv
  let accessService: jest.Mocked<Pick<AdvisoryAccessService, 'assertThinkTankModuleAvailable'>>
  let sessionRepository: jest.Mocked<Pick<AdvisorySessionRepository, 'findSessionById'>>
  let messageRepository: jest.Mocked<
    Pick<
      AdvisoryConversationMessageRepository,
      'findMessagesBySession' | 'createMessageWithNextSequence' | 'deleteMessage'
    >
  >
  let providerGateway: jest.Mocked<Pick<ThinkTankProviderGatewayService, 'stream'>>
  let eventService: jest.Mocked<Pick<AdvisoryEventService, 'emitAudit' | 'emitTelemetry'>>
  let checkpointService: jest.Mocked<Pick<AdvisoryCheckpointService, 'saveCheckpoint'>>
  let outputRepository: {
    findActiveDraftForSession: jest.Mock
    findLatestCompletedForSession: jest.Mock
  }
  let service: AdvisorySessionService

  beforeEach(() => {
    originalEnv = { ...process.env }
    process.env.THINKTANK_PARTY_MODE_MAX_TOKENS = '180'
    process.env.THINKTANK_PARTY_MODE_MAX_COST = '0.18'
    accessService = { assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined) }
    sessionRepository = { findSessionById: jest.fn().mockResolvedValue(activePartyModeSession) }
    messageRepository = {
      findMessagesBySession: jest.fn().mockResolvedValue([
        createMessage({ id: 'message-user-party-entry', sequence: 1 }),
        createMessage({
          id: 'message-assistant-party-intro',
          role: AdvisoryConversationMessageRole.Assistant,
          content: 'Party Mode 上下文已创建。Dr. Quinn、Winston、John 将加入。',
          sequence: 2,
          metadata: { ai_generated: true, party_mode_started: true },
          decisionOptions: [
            {
              key: 'return-to-workflow',
              action: 'return-to-workflow',
              label: '返回工作流',
              enabled: true,
            },
          ],
        }),
      ]),
      createMessageWithNextSequence: jest.fn(
        async (_tenant, _session, input) =>
          createMessage({
            id: `message-${input.role}-${messageRepository.createMessageWithNextSequence.mock.calls.length}`,
            role: input.role,
            content: input.content,
            sequence: messageRepository.createMessageWithNextSequence.mock.calls.length,
            workflowKey: input.workflowKey,
            stepIndex: input.stepIndex,
            decisionOptions: input.decisionOptions ?? [],
            metadata: input.metadata ?? {},
            providerMetadata: input.providerMetadata ?? {},
          }) as never,
      ),
      deleteMessage: jest.fn().mockResolvedValue(true),
    }
    providerGateway = {
      stream: jest.fn(async function* (input: ThinkTankProviderRequest) {
        const advisorId = String(input.metadata?.party_mode_advisor_id ?? 'advisor')
        yield {
          index: 0,
          delta: `Advisor ${advisorId} says: deepen retention diagnosis.`,
          done: true,
          provider: 'fake' as const,
          model: 'fake-thinktank-model',
          usage: { inputTokens: 20, outputTokens: 25, totalTokens: 45 },
          estimatedCost: 0.045,
          latencyMs: 12,
          finishReason: 'stop',
        }
      }),
    }
    eventService = {
      emitAudit: jest.fn().mockResolvedValue(undefined),
      emitTelemetry: jest.fn().mockResolvedValue(undefined),
    }
    checkpointService = { saveCheckpoint: jest.fn().mockResolvedValue({}) }
    outputRepository = {
      findActiveDraftForSession: jest.fn().mockResolvedValue(null),
      findLatestCompletedForSession: jest.fn().mockResolvedValue(null),
    }
    service = new AdvisorySessionService(
      accessService as never,
      {
        discoverWorkflows: jest.fn(),
        findWorkflow: jest.fn(),
      } as unknown as ThinkTankWorkflowRegistryService,
      { assemblePrompt: jest.fn() } as unknown as ThinkTankPromptAssemblerService,
      sessionRepository as never,
      eventService as never,
      messageRepository as never,
      providerGateway as never,
      outputRepository as never,
      undefined,
      undefined,
      undefined,
      checkpointService as never,
    )
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('[P0][5.5-BE-001][AC1,AC3] accounts provider usage and exposes remaining Party Mode budget in advisor and checkpoint metadata', async () => {
    await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Run a deterministic Party Mode discussion.',
    } as never)

    expect(providerGateway.stream).toHaveBeenCalledTimes(3)
    const advisorInputs = messageRepository.createMessageWithNextSequence.mock.calls
      .slice(1)
      .map((call) => call[2])
    expect(advisorInputs).toHaveLength(3)
    expect(advisorInputs.map((input) => input.metadata)).toEqual([
      expect.objectContaining({
        party_mode_budget_max_tokens: 180,
        party_mode_budget_consumed_tokens: 45,
        party_mode_budget_remaining_tokens: 135,
        party_mode_budget_consumed_cost: 0.045,
        party_mode_budget_remaining_cost: 0.135,
        party_mode_budget_exceeded: false,
      }),
      expect.objectContaining({
        party_mode_budget_consumed_tokens: 90,
        party_mode_budget_remaining_tokens: 90,
      }),
      expect.objectContaining({
        party_mode_budget_consumed_tokens: 135,
        party_mode_budget_remaining_tokens: 45,
      }),
    ])
    expect(checkpointService.saveCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          party_mode_budget_max_tokens: 180,
          party_mode_budget_consumed_tokens: 135,
          party_mode_budget_remaining_tokens: 45,
          party_mode_budget_max_cost: 0.18,
          party_mode_budget_consumed_cost: 0.135,
          party_mode_budget_remaining_cost: 0.045,
        }),
      }),
    )
  })

  test('[P0][5.5-BE-002][AC1] stops additional advisors when budget is exceeded and emits operational telemetry without raw content', async () => {
    process.env.THINKTANK_PARTY_MODE_MAX_TOKENS = '70'
    process.env.THINKTANK_PARTY_MODE_MAX_COST = '0.07'
    providerGateway.stream.mockImplementation(async function* (input: ThinkTankProviderRequest) {
      const advisorId = String(input.metadata?.party_mode_advisor_id ?? 'advisor')
      yield {
        index: 0,
        delta: `Advisor ${advisorId} uses most of the budget.`,
        done: true,
        provider: 'fake' as const,
        model: 'fake-thinktank-model',
        usage: { inputTokens: 34, outputTokens: 36, totalTokens: 70 },
        estimatedCost: 0.07,
        latencyMs: 9,
        finishReason: 'stop',
      }
    })

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Discuss until the budget boundary is reached.',
    } as never)

    expect(providerGateway.stream).toHaveBeenCalledTimes(1)
    const persisted = messageRepository.createMessageWithNextSequence.mock.calls.map(
      (call) => call[2],
    )
    expect(persisted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: AdvisoryConversationMessageRole.Assistant,
          content: expect.stringContaining('预算'),
          decisionOptions: expect.arrayContaining([
            expect.objectContaining({ action: 'continue-party-mode', enabled: false }),
            expect.objectContaining({ action: 'return-to-workflow', enabled: true }),
          ]),
          metadata: expect.objectContaining({
            party_mode_budget_exceeded: true,
            party_mode_budget_remaining_tokens: 0,
            party_mode_omitted_advisor_ids: 'architect|pm',
          }),
        }),
      ]),
    )
    expect(result.assistantMessage.metadata).toEqual(
      expect.objectContaining({ party_mode_budget_exceeded: true }),
    )
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.PartyModeBudgetExceeded,
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.Session,
        subjectId: sessionId,
        outcome: ThinkTankEventOutcome.Blocked,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        optional: expect.objectContaining({ sessionId, estimatedTokens: 70, estimatedCost: 0.07 }),
        metadata: expect.objectContaining({
          party_mode_round: 1,
          budget_max_tokens: 70,
          budget_remaining_tokens: 0,
          omitted_advisor_ids: 'architect|pm',
        }),
      }),
    )
    expect(JSON.stringify(eventService.emitTelemetry.mock.calls)).not.toContain('Discuss until')
    expect(JSON.stringify(eventService.emitTelemetry.mock.calls)).not.toContain(
      'Advisor creative-problem-solver',
    )
  })

  test('[P0][5.5-BE-003][AC2,AC3] preserves prior advisor messages when a later advisor times out, emits advisor_failed, and exposes recovery decisions', async () => {
    providerGateway.stream.mockImplementation(async function* (input: ThinkTankProviderRequest) {
      const advisorId = String(input.metadata?.party_mode_advisor_id ?? 'advisor')
      if (advisorId === 'architect') {
        yield {
          index: 0,
          delta: 'Partial technical analysis before timeout.',
          done: false,
          provider: 'fake' as const,
          model: 'fake-thinktank-model',
        }
        throw new ThinkTankProviderGatewayError({
          code: 'THINKTANK_PROVIDER_TIMEOUT',
          category: 'timeout',
          provider: 'fake',
          status: 'timeout',
          retryable: true,
          message: 'provider timed out after deterministic test delay',
        })
      }
      yield {
        index: 0,
        delta: `Advisor ${advisorId} completed first.`,
        done: true,
        provider: 'fake' as const,
        model: 'fake-thinktank-model',
        usage: { inputTokens: 10, outputTokens: 12, totalTokens: 22 },
        estimatedCost: 0.022,
        finishReason: 'stop',
      }
    })

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Continue even if one expert fails.',
    } as never)

    const assistantWrites = messageRepository.createMessageWithNextSequence.mock.calls
      .map((call) => call[2])
      .filter((input) => input.role === AdvisoryConversationMessageRole.Assistant)
    expect(assistantWrites).toHaveLength(2)
    expect(assistantWrites[0]).toEqual(
      expect.objectContaining({
        content: expect.stringContaining('creative-problem-solver completed first'),
        metadata: expect.objectContaining({
          party_mode_advisor_id: 'creative-problem-solver',
          party_mode_round: 1,
        }),
      }),
    )
    expect(assistantWrites[1]).toEqual(
      expect.objectContaining({
        content: expect.stringContaining('Winston'),
        decisionOptions: expect.arrayContaining([
          expect.objectContaining({ action: 'retry-party-mode-advisor', enabled: true }),
          expect.objectContaining({ action: 'continue-party-mode', enabled: true }),
          expect.objectContaining({ action: 'return-to-workflow', enabled: true }),
        ]),
        metadata: expect.objectContaining({
          party_mode_failure: true,
          party_mode_failed_advisor_id: 'architect',
          party_mode_failed_advisor_name: 'Winston',
          party_mode_failed_advisor_role: 'System Architect',
          party_mode_failure_category: 'timeout',
          party_mode_failure_retryable: true,
          party_mode_omitted_advisor_ids: 'pm',
        }),
      }),
    )
    expect(messageRepository.deleteMessage).not.toHaveBeenCalledWith(
      tenantId,
      assistantWrites[0].id,
    )
    expect(result.assistantMessage.metadata).toEqual(
      expect.objectContaining({ party_mode_failure: true }),
    )
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.PartyModeAdvisorFailed,
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.Session,
        subjectId: sessionId,
        outcome: ThinkTankEventOutcome.Partial,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        optional: expect.objectContaining({
          sessionId,
          provider: 'fake',
          errorCategory: 'timeout',
        }),
        metadata: expect.objectContaining({
          party_mode_round: 1,
          advisor_id: 'architect',
          advisor_name: 'Winston',
          advisor_role: 'System Architect',
          retryable: true,
        }),
      }),
    )
    expect(JSON.stringify(eventService.emitTelemetry.mock.calls)).not.toContain(
      'Partial technical analysis',
    )
    expect(JSON.stringify(eventService.emitTelemetry.mock.calls)).not.toContain('Continue even if')
  })

  test('[P1][5.5-BE-004][AC3] deterministic fake provider success path remains unaffected and emits no resource failure telemetry', async () => {
    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Normal fake-provider Party Mode success.',
    } as never)

    expect(providerGateway.stream).toHaveBeenCalledTimes(3)
    expect(result.assistantMessage.metadata).toEqual(
      expect.objectContaining({
        party_mode_advisor_id: 'pm',
        party_mode_budget_exceeded: false,
      }),
    )
    const emittedNames = eventService.emitTelemetry.mock.calls.map((call) => call[0]?.eventName)
    expect(emittedNames).not.toContain(ThinkTankEventName.PartyModeBudgetExceeded)
    expect(emittedNames).not.toContain(ThinkTankEventName.PartyModeAdvisorFailed)
  })

  test('[P0][5.5-BE-006][AC2,AC3] retry recovery resumes the failed and omitted advisor segment without replaying completed experts', async () => {
    messageRepository.findMessagesBySession.mockResolvedValue([
      createMessage({ id: 'message-user-party-entry', sequence: 1 }),
      createMessage({
        id: 'advisor-message-creative',
        role: AdvisoryConversationMessageRole.Assistant,
        content: 'Dr. Quinn completed earlier.',
        sequence: 2,
        metadata: {
          party_mode_message: true,
          party_mode_round: 1,
          party_mode_speaker_index: 1,
          party_mode_advisor_id: 'creative-problem-solver',
          party_mode_advisor_name: 'Dr. Quinn',
          party_mode_advisor_role: 'Systematic Problem-Solving Expert',
        },
      }),
      createMessage({
        id: 'party-failure-message-1',
        role: AdvisoryConversationMessageRole.Assistant,
        content: 'Winston failed; John was omitted.',
        sequence: 3,
        metadata: {
          party_mode_message: true,
          party_mode_failure: true,
          party_mode_round: 1,
          party_mode_failed_advisor_id: 'architect',
          party_mode_failed_advisor_name: 'Winston',
          party_mode_failed_advisor_role: 'System Architect',
          party_mode_failure_category: 'timeout',
          party_mode_failure_retryable: true,
          party_mode_omitted_advisor_ids: 'pm',
        },
        decisionOptions: [
          {
            key: 'retry-party-mode-advisor',
            action: 'retry-party-mode-advisor',
            label: '重试Winston',
            enabled: true,
          },
          {
            key: 'continue-party-mode',
            action: 'continue-party-mode',
            label: '继续讨论',
            enabled: true,
          },
          {
            key: 'return-to-workflow',
            action: 'return-to-workflow',
            label: '返回原工作流',
            enabled: true,
          },
        ],
      }),
    ] as never)

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Retry the failed advisor and continue the remaining segment.',
      decisionAction: 'retry-party-mode-advisor',
      addressedMessageId: 'party-failure-message-1',
    } as never)

    expect(
      providerGateway.stream.mock.calls.map((call) => call[0].metadata?.party_mode_advisor_id),
    ).toEqual(['architect', 'pm'])
    expect(result.partyModeTurn?.advisorOrder).toEqual(['architect', 'pm'])
  })

  test('[P0][5.5-BE-007][AC2,AC3] continue recovery resumes only omitted advisors and rejects non-retryable advisor retry', async () => {
    const recoveryHistory = [
      createMessage({ id: 'message-user-party-entry', sequence: 1 }),
      createMessage({
        id: 'advisor-message-creative',
        role: AdvisoryConversationMessageRole.Assistant,
        content: 'Dr. Quinn completed earlier.',
        sequence: 2,
        metadata: {
          party_mode_message: true,
          party_mode_round: 1,
          party_mode_advisor_id: 'creative-problem-solver',
          party_mode_advisor_name: 'Dr. Quinn',
          party_mode_advisor_role: 'Systematic Problem-Solving Expert',
        },
      }),
      createMessage({
        id: 'party-failure-message-1',
        role: AdvisoryConversationMessageRole.Assistant,
        content: 'Winston failed; John was omitted.',
        sequence: 3,
        metadata: {
          party_mode_message: true,
          party_mode_failure: true,
          party_mode_round: 1,
          party_mode_failed_advisor_id: 'architect',
          party_mode_failed_advisor_name: 'Winston',
          party_mode_failed_advisor_role: 'System Architect',
          party_mode_failure_category: 'validation',
          party_mode_failure_retryable: false,
          party_mode_omitted_advisor_ids: 'pm',
        },
        decisionOptions: [
          {
            key: 'retry-party-mode-advisor',
            action: 'retry-party-mode-advisor',
            label: '重试Winston',
            enabled: true,
          },
          {
            key: 'continue-party-mode',
            action: 'continue-party-mode',
            label: '继续讨论',
            enabled: true,
          },
          {
            key: 'return-to-workflow',
            action: 'return-to-workflow',
            label: '返回原工作流',
            enabled: true,
          },
        ],
      }),
    ] as never
    messageRepository.findMessagesBySession.mockResolvedValue(recoveryHistory)

    await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Continue with omitted advisors only.',
      decisionAction: 'continue-party-mode',
      addressedMessageId: 'party-failure-message-1',
    } as never)

    expect(
      providerGateway.stream.mock.calls.map((call) => call[0].metadata?.party_mode_advisor_id),
    ).toEqual(['pm'])

    providerGateway.stream.mockClear()
    messageRepository.findMessagesBySession.mockResolvedValue(recoveryHistory)
    await expect(
      service.submitMessage({
        user,
        tenantId,
        sessionId,
        content: 'Retry a non-retryable advisor.',
        decisionAction: 'retry-party-mode-advisor',
        addressedMessageId: 'party-failure-message-1',
      } as never),
    ).rejects.toThrow('Party Mode 当前不可用')
    expect(providerGateway.stream).not.toHaveBeenCalled()
  })

  test('[P0][5.5-BE-008][AC1] emits budget telemetry when the final advisor consumes the remaining budget', async () => {
    process.env.THINKTANK_PARTY_MODE_MAX_TOKENS = '135'
    process.env.THINKTANK_PARTY_MODE_MAX_COST = '0.135'

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Use exactly the remaining Party Mode budget.',
    } as never)

    expect(providerGateway.stream).toHaveBeenCalledTimes(3)
    expect(result.assistantMessage.metadata).toEqual(
      expect.objectContaining({
        party_mode_advisor_id: 'pm',
        party_mode_budget_exceeded: true,
      }),
    )
    expect(result.assistantMessage.decisionOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'continue-party-mode', enabled: false }),
        expect.objectContaining({ action: 'return-to-workflow', enabled: true }),
      ]),
    )
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.PartyModeBudgetExceeded,
        metadata: expect.objectContaining({
          budget_remaining_tokens: 0,
          omitted_advisor_ids: '',
        }),
      }),
    )
  })

  test('[P0][5.5-BE-009][AC1,AC3] integration action stops before provider calls when Party Mode budget is already exhausted', async () => {
    process.env.THINKTANK_PARTY_MODE_MAX_TOKENS = '135'
    process.env.THINKTANK_PARTY_MODE_MAX_COST = '0.135'
    messageRepository.findMessagesBySession.mockResolvedValue([
      createMessage({ id: 'message-user-party-entry', sequence: 1 }),
      createMessage({
        id: 'advisor-message-pm',
        role: AdvisoryConversationMessageRole.Assistant,
        content: 'Final advisor consumed the remaining budget.',
        sequence: 2,
        metadata: {
          party_mode_message: true,
          party_mode_round: 1,
          party_mode_advisor_id: 'pm',
          party_mode_advisor_name: 'John',
          party_mode_advisor_role: 'Product Manager',
          party_mode_budget_max_tokens: 135,
          party_mode_budget_consumed_tokens: 135,
          party_mode_budget_remaining_tokens: 0,
          party_mode_budget_exceeded: true,
        },
        decisionOptions: [
          {
            key: 'integrate-party-mode',
            action: 'integrate-party-mode',
            label: '进入观点整合',
            enabled: true,
          },
        ],
      }),
    ] as never)

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Integrate despite exhausted budget.',
      decisionAction: 'integrate-party-mode',
      addressedMessageId: 'advisor-message-pm',
    } as never)

    expect(providerGateway.stream).not.toHaveBeenCalled()
    expect(result.assistantMessage.content).toContain('预算')
    expect(result.assistantMessage.metadata).toEqual(
      expect.objectContaining({
        party_mode_budget_exceeded: true,
      }),
    )
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: ThinkTankEventName.PartyModeBudgetExceeded }),
    )
  })

  test('[P1][5.5-BE-005][AC3] single-advisor workflow calls still use the fake provider once and do not inherit Party Mode budget failures', async () => {
    sessionRepository.findSessionById.mockResolvedValueOnce({
      ...activePartyModeSession,
      metadata: { workflow_key: 'problem-solving' },
    } as never)
    messageRepository.findMessagesBySession.mockResolvedValueOnce([
      createMessage({ id: 'message-user-previous', sequence: 1 }),
    ])

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Continue normal workflow.',
    } as never)

    expect(providerGateway.stream).toHaveBeenCalledTimes(1)
    expect(result.assistantMessage.metadata).not.toEqual(
      expect.objectContaining({ party_mode_budget_exceeded: true }),
    )
    expect(result.assistantMessage.metadata).not.toEqual(
      expect.objectContaining({ party_mode_failure: true }),
    )
    expect(eventService.emitTelemetry).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventName: ThinkTankEventName.PartyModeBudgetExceeded }),
    )
    expect(eventService.emitTelemetry).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventName: ThinkTankEventName.PartyModeAdvisorFailed }),
    )
  })
})
