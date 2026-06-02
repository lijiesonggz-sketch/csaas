import { ConflictException } from '@nestjs/common'
import { AdvisoryConversationMessageRole } from '../../../database/entities/advisory-conversation-message.entity'
import { AdvisoryWorkflowSessionStatus } from '../../../database/entities/advisory-workflow-session.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AdvisoryAccessService } from '../access/advisory-access.service'
import { AdvisoryEventService } from '../events/advisory-event.service'
import { ThinkTankProviderGatewayService } from '../provider-gateway/thinktank-provider-gateway.service'
import { ThinkTankProviderRequest } from '../provider-gateway/thinktank-provider-gateway.types'
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

describe('Story 5.3 ATDD - Party Mode serial expert discussion backend', () => {
  let accessService: jest.Mocked<Pick<AdvisoryAccessService, 'assertThinkTankModuleAvailable'>>
  let sessionRepository: jest.Mocked<Pick<AdvisorySessionRepository, 'findSessionById'>>
  let messageRepository: jest.Mocked<
    Pick<
      AdvisoryConversationMessageRepository,
      'findMessagesBySession' | 'createMessageWithNextSequence' | 'deleteMessage'
    >
  >
  let providerGateway: jest.Mocked<Pick<ThinkTankProviderGatewayService, 'stream'>>
  let service: AdvisorySessionService

  beforeEach(() => {
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
              key: 'continue-party-mode',
              action: 'continue-party-mode',
              label: '开始讨论',
              enabled: true,
            },
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
        }
      }),
    }
    service = new AdvisorySessionService(
      accessService as never,
      {
        discoverWorkflows: jest.fn(),
        findWorkflow: jest.fn(),
      } as unknown as ThinkTankWorkflowRegistryService,
      { assemblePrompt: jest.fn() } as unknown as ThinkTankPromptAssemblerService,
      sessionRepository as never,
      { emitAudit: jest.fn(), emitTelemetry: jest.fn() } as unknown as AdvisoryEventService,
      messageRepository as never,
      providerGateway as never,
    )
  })

  test('[P0][5.3-BE-001][AC1,AC2] creates serial advisor messages with round, order, identity, current-speaker, and shared context metadata', async () => {
    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Please discuss whether onboarding or pricing is the bigger retention risk.',
    } as never)

    expect(messageRepository.createMessageWithNextSequence).toHaveBeenCalledTimes(4)
    const advisorCalls = messageRepository.createMessageWithNextSequence.mock.calls.slice(1)
    expect(
      advisorCalls.map(
        (call) => (call[2].metadata as Record<string, unknown>).party_mode_advisor_id,
      ),
    ).toEqual(['creative-problem-solver', 'architect', 'pm'])
    expect(advisorCalls.map((call) => call[2].metadata)).toEqual([
      expect.objectContaining({
        party_mode_message: true,
        party_mode_round: 1,
        party_mode_speaker_index: 1,
        party_mode_advisor_name: 'Dr. Quinn',
        party_mode_advisor_role: 'Systematic Problem-Solving Expert',
        party_mode_current_speaker: false,
        party_mode_shared_context_pointer: `conversation_messages:${sessionId}`,
      }),
      expect.objectContaining({ party_mode_advisor_name: 'Winston', party_mode_speaker_index: 2 }),
      expect.objectContaining({ party_mode_advisor_name: 'John', party_mode_speaker_index: 3 }),
    ])
    expect(JSON.stringify(result)).not.toContain('<agent>')
  })

  test('[P0] instructs later Party Mode advisors to cross-talk with prior expert viewpoints', async () => {
    await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Please discuss whether onboarding or pricing is the bigger retention risk.',
    } as never)

    const firstSystem = providerGateway.stream.mock.calls[0][0].system
    const secondSystem = providerGateway.stream.mock.calls[1][0].system
    const thirdSystem = providerGateway.stream.mock.calls[2][0].system

    expect(firstSystem).toContain('open with a clear frame')
    expect(secondSystem).toContain('Read the prior Party Mode expert messages in this round')
    expect(secondSystem).toContain('Explicitly reference at least one prior expert')
    expect(secondSystem).toContain('agree, disagree, reframe, or add a missing angle')
    expect(secondSystem).toContain('Build on prior points instead of restating')
    expect(thirdSystem).toContain('You are participating in a natural multi-agent discussion')
    expect(thirdSystem).toContain('You may ask another expert')
    expect(thirdSystem).toContain('Do not output UI choice menus')
    expect(thirdSystem).toContain('[A], [P], [C], [R], [M]')
  })

  test('[P0] starts the first advisor round from the Party Mode start decision option', async () => {
    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: '开始讨论',
      decisionAction: 'continue-party-mode',
    } as never)

    expect(providerGateway.stream).toHaveBeenCalledTimes(3)
    expect(result.partyModeTurn?.advisorOrder).toEqual([
      'creative-problem-solver',
      'architect',
      'pm',
    ])
    expect(result.decisionOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'integrate-party-mode', enabled: true }),
        expect.objectContaining({ action: 'return-to-workflow', enabled: true }),
      ]),
    )
  })

  test('[P0] streams the first advisor round from the Party Mode start decision option', async () => {
    const events = []
    for await (const event of service.streamMessage({
      user,
      tenantId,
      sessionId,
      content: '开始讨论',
      decisionAction: 'continue-party-mode',
    } as never)) {
      events.push(event)
    }

    expect(providerGateway.stream).toHaveBeenCalledTimes(3)
    expect(events.map((event) => event.event)).toEqual([
      'message.started',
      'party_mode.current_speaker',
      'message.delta',
      'message.completed',
      'party_mode.current_speaker',
      'message.delta',
      'message.completed',
      'party_mode.current_speaker',
      'message.delta',
      'message.completed',
    ])
    expect(events.at(-1)?.data).toEqual(
      expect.objectContaining({
        partyModeTurnComplete: true,
        decisionOptions: expect.arrayContaining([
          expect.objectContaining({ action: 'integrate-party-mode', enabled: true }),
          expect.objectContaining({
            action: 'continue-party-mode',
            label: '继续下一轮',
            enabled: true,
          }),
          expect.objectContaining({ action: 'return-to-workflow', enabled: true }),
        ]),
      }),
    )
  })

  test('[P0] streams the next advisor round from the explicit continue Party Mode decision option', async () => {
    messageRepository.findMessagesBySession.mockResolvedValue([
      createMessage({ id: 'message-user-party-entry', sequence: 1 }),
      createMessage({
        id: 'message-assistant-party-intro',
        role: AdvisoryConversationMessageRole.Assistant,
        content: 'Party Mode 上下文已创建。Dr. Quinn、Winston、John 将加入。',
        sequence: 2,
        metadata: { ai_generated: true, party_mode_started: true },
      }),
      createMessage({
        id: 'message-advisor-creative-problem-solver',
        role: AdvisoryConversationMessageRole.Assistant,
        content: 'Dr. Quinn says onboarding is the sharper diagnostic path.',
        sequence: 3,
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
        id: 'message-advisor-architect',
        role: AdvisoryConversationMessageRole.Assistant,
        content: 'Winston says the architecture risk is measurable.',
        sequence: 4,
        metadata: {
          party_mode_message: true,
          party_mode_round: 1,
          party_mode_speaker_index: 2,
          party_mode_advisor_id: 'architect',
          party_mode_advisor_name: 'Winston',
          party_mode_advisor_role: 'System Architect',
        },
      }),
      createMessage({
        id: 'message-advisor-pm',
        role: AdvisoryConversationMessageRole.Assistant,
        content: 'John says prioritize the highest retention leverage first.',
        sequence: 5,
        metadata: {
          party_mode_message: true,
          party_mode_round: 1,
          party_mode_speaker_index: 3,
          party_mode_advisor_id: 'pm',
          party_mode_advisor_name: 'John',
          party_mode_advisor_role: 'Product Manager',
        },
        decisionOptions: [
          {
            key: 'integrate-party-mode',
            action: 'integrate-party-mode',
            label: '进入观点整合',
            enabled: true,
          },
          {
            key: 'continue-party-mode',
            action: 'continue-party-mode',
            label: '继续下一轮',
            enabled: true,
          },
          {
            key: 'return-to-workflow',
            action: 'return-to-workflow',
            label: '返回工作流',
            enabled: true,
          },
        ],
      }),
    ])

    const events = []
    for await (const event of service.streamMessage({
      user,
      tenantId,
      sessionId,
      content: '继续下一轮',
      decisionAction: 'continue-party-mode',
      addressedMessageId: 'message-advisor-pm',
    } as never)) {
      events.push(event)
    }

    expect(providerGateway.stream).toHaveBeenCalledTimes(3)
    expect(
      events
        .filter((event) => event.event === 'party_mode.current_speaker')
        .map((event) => event.data),
    ).toEqual([
      expect.objectContaining({ advisorId: 'creative-problem-solver', round: 2, speakerIndex: 1 }),
      expect.objectContaining({ advisorId: 'architect', round: 2, speakerIndex: 2 }),
      expect.objectContaining({ advisorId: 'pm', round: 2, speakerIndex: 3 }),
    ])
    const advisorMessageInputs = messageRepository.createMessageWithNextSequence.mock.calls
      .map((call) => call[2])
      .filter((input) => input.metadata?.party_mode_message === true)
    expect(advisorMessageInputs.map((input) => input.metadata?.party_mode_round)).toEqual([2, 2, 2])
    expect(events.at(-1)?.data).toEqual(
      expect.objectContaining({
        partyModeTurnComplete: true,
        decisionOptions: expect.arrayContaining([
          expect.objectContaining({
            action: 'continue-party-mode',
            label: '继续下一轮',
            enabled: true,
          }),
        ]),
      }),
    )
  })

  test('[P0][5.3-BE-002][AC2] streams current-speaker events before each advisor response', async () => {
    const events = []
    for await (const event of service.streamMessage({
      user,
      tenantId,
      sessionId,
      content: 'Stream the Party Mode discussion.',
    } as never)) {
      events.push(event)
    }

    expect(events.map((event) => event.event)).toEqual([
      'message.started',
      'party_mode.current_speaker',
      'message.delta',
      'message.completed',
      'party_mode.current_speaker',
      'message.delta',
      'message.completed',
      'party_mode.current_speaker',
      'message.delta',
      'message.completed',
    ])
    expect(
      events
        .filter((event) => event.event === 'party_mode.current_speaker')
        .map((event) => event.data),
    ).toEqual([
      expect.objectContaining({
        advisorId: 'creative-problem-solver',
        advisorName: 'Dr. Quinn',
        round: 1,
        speakerIndex: 1,
      }),
      expect.objectContaining({
        advisorId: 'architect',
        advisorName: 'Winston',
        round: 1,
        speakerIndex: 2,
      }),
      expect.objectContaining({ advisorId: 'pm', advisorName: 'John', round: 1, speakerIndex: 3 }),
    ])
    expect(
      events.filter((event) => event.event === 'message.completed').map((event) => event.data),
    ).toEqual([
      expect.objectContaining({ partyModeTurnComplete: false }),
      expect.objectContaining({ partyModeTurnComplete: false }),
      expect.objectContaining({ partyModeTurnComplete: true }),
    ])
  })

  test('[P0][5.3-BE-003][AC3] validates addressed expert replies and makes the addressed advisor speak first', async () => {
    messageRepository.findMessagesBySession.mockResolvedValue([
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
      createMessage({
        id: 'message-advisor-architect',
        role: AdvisoryConversationMessageRole.Assistant,
        content: 'I see API feasibility risk in session orchestration.',
        sequence: 3,
        metadata: {
          party_mode_message: true,
          party_mode_round: 1,
          party_mode_speaker_index: 2,
          party_mode_advisor_id: 'architect',
          party_mode_advisor_name: 'Winston',
          party_mode_advisor_role: 'System Architect',
        },
      }),
    ])
    await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Winston, deepen the API feasibility risks before others add follow-up.',
      addressedAdvisorId: 'architect',
      addressedMessageId: 'message-advisor-architect',
    } as never)

    const advisorCalls = messageRepository.createMessageWithNextSequence.mock.calls.slice(1)
    expect(
      advisorCalls.map(
        (call) => (call[2].metadata as Record<string, unknown>).party_mode_advisor_id,
      ),
    ).toEqual(['architect', 'creative-problem-solver', 'pm'])
    expect(advisorCalls[0][2].metadata).toEqual(
      expect.objectContaining({
        party_mode_addressed_advisor_id: 'architect',
        party_mode_addressed_first: true,
      }),
    )
  })

  test('[P0][5.3-BE-004][AC3] rejects forged, stale, or non-Party-Mode addressed expert references before persistence/provider calls', async () => {
    await expect(
      service.submitMessage({
        user,
        tenantId,
        sessionId,
        content: 'Fake expert, answer first.',
        addressedAdvisorId: 'unselected-advisor',
      } as never),
    ).rejects.toThrow(ConflictException)

    expect(messageRepository.createMessageWithNextSequence).not.toHaveBeenCalled()
    expect(providerGateway.stream).not.toHaveBeenCalled()
  })

  test('[P0][5.3-BE-006][AC3] rejects forged addressed expert references before streaming SSE starts', async () => {
    const stream = service.streamMessage({
      user,
      tenantId,
      sessionId,
      content: 'Fake expert, answer first.',
      addressedAdvisorId: 'unselected-advisor',
    } as never)

    await expect(stream[Symbol.asyncIterator]().next()).rejects.toThrow(ConflictException)
    expect(messageRepository.createMessageWithNextSequence).not.toHaveBeenCalled()
    expect(providerGateway.stream).not.toHaveBeenCalled()
  })

  test('[P0][5.3-BE-007][AC2] serializes concurrent Party Mode turns so rounds do not duplicate', async () => {
    const storedMessages = [
      createMessage({ id: 'message-user-party-entry', sequence: 1 }),
      createMessage({
        id: 'message-assistant-party-intro',
        role: AdvisoryConversationMessageRole.Assistant,
        content: 'Party Mode 上下文已创建。',
        sequence: 2,
        metadata: { ai_generated: true, party_mode_started: true },
      }),
    ]
    messageRepository.findMessagesBySession.mockImplementation(async () => storedMessages as never)
    messageRepository.createMessageWithNextSequence.mockImplementation(
      async (_tenant, _session, input) => {
        const message = createMessage({
          id: `message-${input.role}-${storedMessages.length + 1}`,
          role: input.role,
          content: input.content,
          sequence: storedMessages.length + 1,
          workflowKey: input.workflowKey,
          stepIndex: input.stepIndex,
          decisionOptions: input.decisionOptions ?? [],
          metadata: input.metadata ?? {},
          providerMetadata: input.providerMetadata ?? {},
        })
        storedMessages.push(message)
        return message as never
      },
    )

    await Promise.all([
      service.submitMessage({
        user,
        tenantId,
        sessionId,
        content: 'First concurrent turn.',
      } as never),
      service.submitMessage({
        user,
        tenantId,
        sessionId,
        content: 'Second concurrent turn.',
      } as never),
    ])

    const partyModeRounds = storedMessages
      .map((message) => (message.metadata as Record<string, unknown> | undefined)?.party_mode_round)
      .filter((round): round is number => typeof round === 'number')
    expect(partyModeRounds).toEqual([1, 1, 1, 1, 2, 2, 2, 2])
  })

  test('[P1][5.3-BE-005][AC1,AC3] keeps provider and message metadata free of raw persona content and source paths', async () => {
    await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Continue Party Mode without leaking persona files.',
    } as never)

    const serializedProviderCalls = JSON.stringify(providerGateway.stream.mock.calls)
    const serializedMessageInputs = JSON.stringify(
      messageRepository.createMessageWithNextSequence.mock.calls,
    )
    for (const serialized of [serializedProviderCalls, serializedMessageInputs]) {
      expect(serialized).not.toContain('<agent>')
      expect(serialized).not.toContain('_bmad/cis/agents/creative-problem-solver.md')
      expect(serialized).not.toContain('_bmad/bmm/agents/architect.md')
      expect(serialized).not.toContain('_bmad/bmm/agents/pm.md')
    }
  })
})
