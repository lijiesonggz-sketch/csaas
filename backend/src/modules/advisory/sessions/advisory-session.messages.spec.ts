import { NotFoundException } from '@nestjs/common'
import { AdvisoryWorkflowSessionStatus } from '../../../database/entities/advisory-workflow-session.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AdvisoryConversationMessageRole } from '../../../database/entities/advisory-conversation-message.entity'
import { AdvisoryAccessService } from '../access/advisory-access.service'
import { AdvisoryEventService } from '../events/advisory-event.service'
import { AdvisoryWorkflowOutputRepository } from '../outputs/advisory-workflow-output.repository'
import { ThinkTankProviderGatewayService } from '../provider-gateway/thinktank-provider-gateway.service'
import { ThinkTankProviderStreamChunk } from '../provider-gateway/thinktank-provider-gateway.types'
import { ThinkTankPromptAssemblerService } from '../runtime/prompt-assembler.service'
import { ThinkTankWorkflowRegistryService } from '../runtime/workflow-registry.service'
import { AdvisoryConversationMessageRepository } from './advisory-conversation-message.repository'
import { AdvisorySessionRepository } from './advisory-session.repository'
import { AdvisorySessionService } from './advisory-session.service'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const sessionId = '550e8400-e29b-41d4-a716-446655440000'
const organizationId = '880e8400-e29b-41d4-a716-446655440000'

const user = {
  id: actorId,
  role: UserRole.CONSULTANT,
  organizationId,
}

const activeSession = {
  id: sessionId,
  tenantId,
  actorId,
  workflowKey: 'problem-solving',
  workflowDisplayName: 'Problem Solving',
  scenarioLabel: 'Systematic diagnosis and solution design',
  status: AdvisoryWorkflowSessionStatus.Active,
  currentStep: { index: 1, label: '当前步骤', sourceRef: 'current-step:1' },
  sourceRefs: ['workflow:problem-solving', 'current-step:1'],
  metadata: { workflow_key: 'problem-solving', source_ref_count: 2 },
  failureCode: null,
  failureMessage: null,
  createdAt: new Date('2026-05-20T00:00:00.000Z'),
  updatedAt: new Date('2026-05-20T00:00:00.000Z'),
}

describe('AdvisorySessionService guided messages', () => {
  let accessService: jest.Mocked<Pick<AdvisoryAccessService, 'assertThinkTankModuleAvailable'>>
  let sessionRepository: jest.Mocked<
    Pick<AdvisorySessionRepository, 'findSessionById' | 'updateSession'>
  >
  let messageRepository: jest.Mocked<
    Pick<
      AdvisoryConversationMessageRepository,
      'findMessagesBySession' | 'createMessageWithNextSequence'
    >
  >
  let providerGateway: jest.Mocked<Pick<ThinkTankProviderGatewayService, 'stream'>>
  let outputRepository: jest.Mocked<
    Pick<
      AdvisoryWorkflowOutputRepository,
      'findActiveDraftForSession' | 'createDraft' | 'appendSection'
    >
  >
  let eventService: jest.Mocked<Pick<AdvisoryEventService, 'emitAudit' | 'emitTelemetry'>>
  let service: AdvisorySessionService

  beforeEach(() => {
    accessService = {
      assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
    }
    sessionRepository = {
      findSessionById: jest.fn().mockResolvedValue(activeSession),
      updateSession: jest.fn(),
    }
    messageRepository = {
      findMessagesBySession: jest.fn().mockResolvedValue([]),
      createMessageWithNextSequence: jest.fn(
        async (_tenantId, _sessionId, input) =>
          ({
            id:
              input.role === AdvisoryConversationMessageRole.User
                ? 'message-user-1'
                : 'message-assistant-1',
            tenantId,
            sessionId,
            actorId: input.actorId,
            role: input.role,
            content: input.content,
            sequence: input.role === AdvisoryConversationMessageRole.User ? 1 : 2,
            workflowKey: input.workflowKey,
            stepIndex: input.stepIndex,
            decisionOptions: (input.decisionOptions ?? []) as never,
            metadata: input.metadata ?? {},
            providerMetadata: input.providerMetadata ?? {},
            createdAt: new Date('2026-05-20T00:00:00.000Z'),
            updatedAt: new Date('2026-05-20T00:00:00.000Z'),
          }) as never,
      ),
    }
    providerGateway = {
      stream: jest.fn(async function* (input): AsyncIterable<ThinkTankProviderStreamChunk> {
        void input
        yield {
          index: 0,
          delta: 'Summary: retention is likely blocked by onboarding friction.',
          done: false,
          provider: 'fake' as const,
          model: 'fake-thinktank-model',
        }
        yield {
          index: 1,
          delta: ' Next options: continue, deepen, revise.',
          done: true,
          provider: 'fake' as const,
          model: 'fake-thinktank-model',
          usage: {
            inputTokens: 10,
            outputTokens: 8,
            totalTokens: 18,
          },
          estimatedCost: 0,
          latencyMs: 12,
          finishReason: 'stop',
        }
      }),
    }
    outputRepository = {
      findActiveDraftForSession: jest.fn().mockResolvedValue({
        id: 'output-draft-1',
        tenantId,
        sessionId,
        actorId,
        workflowKey: 'domain-research',
        status: 'draft',
        title: 'Domain Research Report Draft',
        summary: '',
        contentMarkdown: '',
        sections: [],
        aiLabelMetadata: {
          visible_label: '[AI Generated]',
          ai_generated: true,
          machine_readable: true,
          source_session_id: sessionId,
          workflow_key: 'domain-research',
        },
        metadata: {},
        createdAt: new Date('2026-05-20T00:00:00.000Z'),
        updatedAt: new Date('2026-05-20T00:00:00.000Z'),
      }),
      createDraft: jest.fn(),
      appendSection: jest.fn().mockImplementation(async (_tenantId, _outputId, section) => ({
        id: 'output-draft-1',
        tenantId,
        sessionId,
        actorId,
        workflowKey: 'domain-research',
        status: 'draft',
        title: 'Domain Research Report Draft',
        summary: '',
        contentMarkdown: section.contentMarkdown,
        sections: [section],
        aiLabelMetadata: {
          visible_label: '[AI Generated]',
          ai_generated: true,
          machine_readable: true,
          source_session_id: sessionId,
          workflow_key: 'domain-research',
        },
        metadata: { section_count: 1 },
        createdAt: new Date('2026-05-20T00:00:00.000Z'),
        updatedAt: new Date('2026-05-20T00:00:00.000Z'),
      })),
    }
    eventService = {
      emitAudit: jest.fn().mockResolvedValue(undefined),
      emitTelemetry: jest.fn().mockResolvedValue(undefined),
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
    )
  })

  test('[P0] persists a user answer, streams the advisor response, and stores AI decision options', async () => {
    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Retention drops after the second session.',
    })

    expect(accessService.assertThinkTankModuleAvailable).toHaveBeenCalledWith(user, tenantId)
    expect(sessionRepository.findSessionById).toHaveBeenCalledWith(tenantId, sessionId)
    expect(messageRepository.createMessageWithNextSequence).toHaveBeenNthCalledWith(
      1,
      tenantId,
      sessionId,
      expect.objectContaining({
        sessionId,
        actorId,
        role: AdvisoryConversationMessageRole.User,
        content: 'Retention drops after the second session.',
        workflowKey: 'problem-solving',
        stepIndex: 1,
      }),
    )
    expect(providerGateway.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        actorId,
        subjectId: sessionId,
        stream: true,
        messages: [
          {
            role: 'user',
            content: 'Retention drops after the second session.',
          },
        ],
        metadata: expect.objectContaining({
          workflow_key: 'problem-solving',
          step_index: 1,
          message_count: 1,
        }),
      }),
    )
    const providerMetadata = providerGateway.stream.mock.calls[0][0].metadata as Record<
      string,
      unknown
    >
    expect(JSON.stringify(providerMetadata)).not.toContain(
      'Retention drops after the second session',
    )
    expect(providerMetadata).not.toHaveProperty('prompt')
    expect(providerMetadata).not.toHaveProperty('content')
    expect(providerMetadata).not.toHaveProperty('conversation')
    expect(providerMetadata).not.toHaveProperty('report')
    expect(providerMetadata).not.toHaveProperty('document')
    expect(messageRepository.createMessageWithNextSequence).toHaveBeenNthCalledWith(
      2,
      tenantId,
      sessionId,
      expect.objectContaining({
        role: AdvisoryConversationMessageRole.Assistant,
        content:
          'Summary: retention is likely blocked by onboarding friction. Next options: continue, deepen, revise.',
        workflowKey: 'problem-solving',
        stepIndex: 1,
        decisionOptions: expect.arrayContaining([
          expect.objectContaining({ action: 'continue', shortcut: 'C' }),
          expect.objectContaining({ action: 'deepen' }),
          expect.objectContaining({ action: 'revise' }),
        ]),
        metadata: expect.objectContaining({
          ai_generated: true,
          workflow_key: 'problem-solving',
          step_index: 1,
        }),
      }),
    )
    expect(result).toEqual(
      expect.objectContaining({
        sessionId,
        currentStep: activeSession.currentStep,
        assistantMessage: expect.objectContaining({
          role: AdvisoryConversationMessageRole.Assistant,
          content:
            'Summary: retention is likely blocked by onboarding friction. Next options: continue, deepen, revise.',
        }),
        stream: expect.arrayContaining([
          expect.objectContaining({
            delta: 'Summary: retention is likely blocked by onboarding friction.',
          }),
        ]),
      }),
    )
  })

  test('[P0] retrieves conversation messages through tenant-scoped repository access', async () => {
    const persisted = [
      {
        id: 'message-user-1',
        tenantId,
        sessionId,
        actorId,
        role: AdvisoryConversationMessageRole.User,
        content: 'What should we investigate first?',
        sequence: 1,
        workflowKey: 'problem-solving',
        stepIndex: 1,
        decisionOptions: [],
        metadata: { workflow_key: 'problem-solving', step_index: 1 },
        providerMetadata: {},
        createdAt: new Date('2026-05-20T00:00:00.000Z'),
        updatedAt: new Date('2026-05-20T00:00:00.000Z'),
      },
    ]
    messageRepository.findMessagesBySession.mockResolvedValueOnce(persisted)

    const result = await service.listMessages({ user, tenantId, sessionId })

    expect(sessionRepository.findSessionById).toHaveBeenCalledWith(tenantId, sessionId)
    expect(messageRepository.findMessagesBySession).toHaveBeenCalledWith(tenantId, sessionId)
    expect(result).toEqual({
      sessionId,
      currentStep: activeSession.currentStep,
      messages: persisted,
    })
  })

  test('[P0] rejects cross-tenant or inactive sessions without calling the provider', async () => {
    sessionRepository.findSessionById.mockResolvedValueOnce(null)

    await expect(
      service.submitMessage({
        user,
        tenantId,
        sessionId,
        content: 'Tenant B should not see this.',
      }),
    ).rejects.toThrow(NotFoundException)

    expect(providerGateway.stream).not.toHaveBeenCalled()
    expect(messageRepository.createMessageWithNextSequence).not.toHaveBeenCalled()
  })

  test('[P0] does not advance workflow currentStep until the user confirms continuation', async () => {
    await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'The current step is ready, but I want to ask one more question.',
    })

    expect(sessionRepository.updateSession).not.toHaveBeenCalledWith(
      tenantId,
      sessionId,
      expect.objectContaining({
        currentStep: expect.objectContaining({ index: 2 }),
      }),
    )
  })

  test('[P0] streams started, ordered deltas, and completed events while persisting the final assistant message', async () => {
    const events = []

    for await (const event of service.streamMessage({
      user,
      tenantId,
      sessionId,
      content: 'Stream this answer incrementally.',
    })) {
      events.push(event)
    }

    expect(events.map((event) => event.event)).toEqual([
      'message.started',
      'message.delta',
      'message.delta',
      'message.completed',
    ])
    expect(events[0]).toEqual({
      event: 'message.started',
      data: {
        sessionId,
        currentStep: activeSession.currentStep,
      },
    })
    expect(events[1]).toEqual({
      event: 'message.delta',
      data: {
        index: 0,
        delta: 'Summary: retention is likely blocked by onboarding friction.',
      },
    })
    expect(events[3]).toEqual({
      event: 'message.completed',
      data: expect.objectContaining({
        sessionId,
        currentStep: activeSession.currentStep,
        assistantMessage: expect.objectContaining({
          id: 'message-assistant-1',
          role: AdvisoryConversationMessageRole.Assistant,
          content:
            'Summary: retention is likely blocked by onboarding friction. Next options: continue, deepen, revise.',
        }),
        decisionOptions: expect.arrayContaining([
          expect.objectContaining({ action: 'continue', shortcut: 'C' }),
        ]),
      }),
    })
    expect(messageRepository.createMessageWithNextSequence).toHaveBeenNthCalledWith(
      1,
      tenantId,
      sessionId,
      expect.objectContaining({
        role: AdvisoryConversationMessageRole.User,
        content: 'Stream this answer incrementally.',
      }),
    )
    expect(messageRepository.createMessageWithNextSequence).toHaveBeenNthCalledWith(
      2,
      tenantId,
      sessionId,
      expect.objectContaining({
        role: AdvisoryConversationMessageRole.Assistant,
      }),
    )
  })

  test('[P0] streams rehydrated final-step metadata for resumed runtime sessions', async () => {
    sessionRepository.findSessionById.mockResolvedValueOnce({
      ...activeSession,
      workflowKey: 'storytelling',
      currentStep: {
        index: 10,
        label: 'Step 10: Generate final output',
        sourceRef: 'current-step:10',
      },
      metadata: {
        workflow_key: 'storytelling',
        runtime_step_count: 10,
        runtime_current_step_index: 10,
      },
    })
    const events = []

    for await (const event of service.streamMessage({
      user,
      tenantId,
      sessionId,
      content: '全部确认，生成最终文档。',
    })) {
      events.push(event)
    }

    expect(events[0]).toEqual({
      event: 'message.started',
      data: {
        sessionId,
        currentStep: expect.objectContaining({
          index: 10,
          totalSteps: 10,
          isFinal: true,
          isFinalStep: true,
        }),
      },
    })
    expect(events.at(-1)).toEqual(
      expect.objectContaining({
        event: 'message.completed',
        data: expect.objectContaining({
          currentStep: expect.objectContaining({
            index: 10,
            totalSteps: 10,
            isFinal: true,
            isFinalStep: true,
          }),
        }),
      }),
    )
  })

  test('[P0] emits a stream error instead of completing when the provider returns no content', async () => {
    providerGateway.stream.mockImplementationOnce(async function* () {
      // empty provider stream
    })

    const events = []
    for await (const event of service.streamMessage({
      user,
      tenantId,
      sessionId,
      content: 'Trigger empty provider output.',
    })) {
      events.push(event)
    }

    expect(events.map((event) => event.event)).toEqual(['message.started', 'message.error'])
    expect(messageRepository.createMessageWithNextSequence).toHaveBeenCalledTimes(1)
    expect(messageRepository.createMessageWithNextSequence).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      expect.objectContaining({
        role: AdvisoryConversationMessageRole.User,
        content: 'Trigger empty provider output.',
      }),
    )
  })

  test('[P1] passes abort signals to the provider stream and stops without storing assistant content', async () => {
    const abortController = new AbortController()
    providerGateway.stream.mockImplementationOnce(async function* (_input, signal?: AbortSignal) {
      expect(signal).toBe(abortController.signal)
      yield {
        index: 0,
        delta: 'Partial response before abort.',
        done: false,
        provider: 'fake',
        model: 'fake-thinktank-model',
      }
      abortController.abort()
      yield {
        index: 1,
        delta: 'Should not be consumed.',
        done: true,
        provider: 'fake',
        model: 'fake-thinktank-model',
      }
    })

    const events = []
    for await (const event of service.streamMessage({
      user,
      tenantId,
      sessionId,
      content: 'Abort while streaming.',
      signal: abortController.signal,
    })) {
      events.push(event)
    }

    expect(events.map((event) => event.event)).toEqual(['message.started', 'message.delta'])
    expect(messageRepository.createMessageWithNextSequence).toHaveBeenCalledTimes(1)
  })

  test('[P0] emits a recoverable stream error event without storing a corrupted assistant message', async () => {
    providerGateway.stream.mockImplementationOnce(async function* () {
      yield {
        index: 0,
        delta: 'Partial unsafe response',
        done: false,
        provider: 'fake',
        model: 'fake-thinktank-model',
      }
      throw new Error('Provider disconnected')
    })

    const events = []
    for await (const event of service.streamMessage({
      user,
      tenantId,
      sessionId,
      content: 'Trigger provider failure.',
    })) {
      events.push(event)
    }

    expect(events.map((event) => event.event)).toEqual([
      'message.started',
      'message.delta',
      'message.error',
    ])
    expect(events.at(-1)).toEqual({
      event: 'message.error',
      data: {
        code: 'THINKTANK_STREAM_FAILED',
        message: '暂时无法生成 ThinkTank 顾问回复，请稍后重试。',
        retryable: true,
      },
    })
    expect(messageRepository.createMessageWithNextSequence).toHaveBeenCalledTimes(1)
    expect(messageRepository.createMessageWithNextSequence).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      expect.objectContaining({
        role: AdvisoryConversationMessageRole.User,
        content: 'Trigger provider failure.',
      }),
    )
  })

  test('[P0] does not append a max-token truncated final response to the report draft', async () => {
    sessionRepository.findSessionById.mockResolvedValueOnce({
      ...activeSession,
      workflowKey: 'domain-research',
      workflowDisplayName: 'Domain Research',
      currentStep: {
        index: 6,
        label: 'Domain Research Step 6: Research Synthesis and Completion',
        sourceRef: 'current-step:6',
        totalSteps: 6,
        isFinal: true,
        isFinalStep: true,
      },
      metadata: {
        workflow_key: 'domain-research',
        runtime_step_count: 6,
      },
    })
    providerGateway.stream.mockImplementationOnce(async function* () {
      yield {
        index: 0,
        delta:
          '# 领域研究综合报告\n\n## 3. 技术全景与创新趋势\n\n- 可一次性处理整份年报或长篇招股书\n- �',
        done: true,
        provider: 'glm',
        model: 'glm-5.1',
        usage: {
          inputTokens: 6866,
          outputTokens: 2000,
          totalTokens: 8866,
        },
        estimatedCost: 0.006433,
        latencyMs: 67800,
        finishReason: 'max_tokens',
      }
    })

    const events = []
    for await (const event of service.streamMessage({
      user,
      tenantId,
      sessionId,
      content: 'c',
    })) {
      events.push(event)
    }

    expect(events.map((event) => event.event)).toEqual([
      'message.started',
      'message.delta',
      'message.completed',
    ])
    expect(events.at(-1)).toEqual(
      expect.objectContaining({
        event: 'message.completed',
        data: expect.not.objectContaining({
          appendedSection: expect.anything(),
          output: expect.anything(),
        }),
      }),
    )
    expect(outputRepository.appendSection).not.toHaveBeenCalled()
    expect(messageRepository.createMessageWithNextSequence).toHaveBeenNthCalledWith(
      2,
      tenantId,
      sessionId,
      expect.objectContaining({
        role: AdvisoryConversationMessageRole.Assistant,
        metadata: expect.objectContaining({
          finish_reason: 'max_tokens',
        }),
      }),
    )
  })
})
