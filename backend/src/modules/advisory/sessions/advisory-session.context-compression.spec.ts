import { AdvisoryConversationMessageRole } from '../../../database/entities/advisory-conversation-message.entity'
import {
  AdvisoryWorkflowOutput,
  AdvisoryWorkflowOutputStatus,
} from '../../../database/entities/advisory-workflow-output.entity'
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
import { AdvisoryWorkflowOutputRepository } from '../outputs/advisory-workflow-output.repository'
import { ThinkTankContextCompressionService } from '../context-compression/thinktank-context-compression.service'
import { ThinkTankProviderGatewayService } from '../provider-gateway/thinktank-provider-gateway.service'
import { ThinkTankProviderMessage } from '../provider-gateway/thinktank-provider-gateway.types'
import { ThinkTankPromptAssemblerService } from '../runtime/prompt-assembler.service'
import { ThinkTankWorkflowRegistryService } from '../runtime/workflow-registry.service'
import { AdvisoryConversationMessageRepository } from './advisory-conversation-message.repository'
import { AdvisorySessionRepository } from './advisory-session.repository'
import { AdvisorySessionService } from './advisory-session.service'

const tenantId = '660e8400-e29b-41d4-a716-446655440146'
const actorId = '770e8400-e29b-41d4-a716-446655440146'
const sessionId = '550e8400-e29b-41d4-a716-446655440146'
const organizationId = '880e8400-e29b-41d4-a716-446655440146'
const foreignTenantId = '660e8400-e29b-41d4-a716-446655440999'

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
  currentStep: { index: 2, label: 'Assess constraints', sourceRef: 'current-step:2' },
  sourceRefs: ['workflow:problem-solving', 'current-step:2'],
  metadata: { workflow_key: 'problem-solving', source_ref_count: 2 },
  failureCode: null,
  failureMessage: null,
  createdAt: new Date('2026-05-21T00:00:00.000Z'),
  updatedAt: new Date('2026-05-21T00:00:00.000Z'),
}

const output = {
  id: '990e8400-e29b-41d4-a716-446655440146',
  tenantId,
  sessionId,
  actorId,
  workflowKey: 'problem-solving',
  status: AdvisoryWorkflowOutputStatus.Draft,
  title: 'Enterprise Rollout Diagnosis',
  summary: 'Enterprise rollout remains viable if SOC2 evidence gaps are closed.',
  contentMarkdown: '# Enterprise Rollout Diagnosis',
  sections: [],
  aiLabelMetadata: {},
  metadata: {},
  createdAt: new Date('2026-05-21T00:00:00.000Z'),
  updatedAt: new Date('2026-05-21T00:00:00.000Z'),
} satisfies AdvisoryWorkflowOutput

const persistedMessages = [
  {
    id: 'message-user-1',
    tenantId,
    sessionId,
    actorId,
    role: AdvisoryConversationMessageRole.User,
    content: 'We need a launch decision for enterprise onboarding.',
    sequence: 1,
    workflowKey: 'problem-solving',
    stepIndex: 1,
    decisionOptions: [],
    metadata: {},
    providerMetadata: {},
    createdAt: new Date('2026-05-21T00:01:00.000Z'),
    updatedAt: new Date('2026-05-21T00:01:00.000Z'),
  },
  {
    id: 'message-assistant-1',
    tenantId,
    sessionId,
    actorId,
    role: AdvisoryConversationMessageRole.Assistant,
    content:
      'Key conclusion: Enterprise rollout can continue only if SOC2 evidence gaps are closed first.',
    sequence: 2,
    workflowKey: 'problem-solving',
    stepIndex: 2,
    decisionOptions: [],
    metadata: { ai_generated: true },
    providerMetadata: {},
    createdAt: new Date('2026-05-21T00:02:00.000Z'),
    updatedAt: new Date('2026-05-21T00:02:00.000Z'),
  },
  {
    id: 'message-foreign-1',
    tenantId: foreignTenantId,
    sessionId,
    actorId: '770e8400-e29b-41d4-a716-446655440999',
    role: AdvisoryConversationMessageRole.User,
    content: 'FOREIGN TENANT SECRET: do not leak this into compressed context.',
    sequence: 3,
    workflowKey: 'problem-solving',
    stepIndex: 2,
    decisionOptions: [],
    metadata: {},
    providerMetadata: {},
    createdAt: new Date('2026-05-21T00:03:00.000Z'),
    updatedAt: new Date('2026-05-21T00:03:00.000Z'),
  },
]

const compressedMessages: ThinkTankProviderMessage[] = [
  {
    role: 'user',
    content:
      '已压缩的历史上下文：关键决策：Enterprise rollout can continue only if SOC2 evidence gaps are closed first. 开放问题：Who owns the SOC2 remediation plan?',
  },
  {
    role: 'user',
    content: 'Please continue with the next recommendation.',
  },
]

function createService(
  compressionResult: {
    decision: 'execute' | 'defer'
    providerMessages?: ThinkTankProviderMessage[]
  } = { decision: 'execute', providerMessages: compressedMessages },
) {
  const accessService = {
    assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<Pick<AdvisoryAccessService, 'assertThinkTankModuleAvailable'>>
  const sessionRepository = {
    findSessionById: jest.fn().mockResolvedValue(activeSession),
  } as unknown as jest.Mocked<Pick<AdvisorySessionRepository, 'findSessionById'>>
  const messageRepository = {
    findMessagesBySession: jest.fn().mockResolvedValue(persistedMessages),
    createMessageWithNextSequence: jest.fn(
      async (_tenant, _session, input) =>
        ({
          id:
            input.role === AdvisoryConversationMessageRole.User
              ? 'message-user-current'
              : 'message-assistant-current',
          tenantId,
          sessionId,
          actorId: input.actorId,
          role: input.role,
          content: input.content,
          sequence: input.role === AdvisoryConversationMessageRole.User ? 4 : 5,
          workflowKey: input.workflowKey,
          stepIndex: input.stepIndex,
          decisionOptions: input.decisionOptions ?? [],
          metadata: input.metadata ?? {},
          providerMetadata: input.providerMetadata ?? {},
          createdAt: new Date('2026-05-21T00:04:00.000Z'),
          updatedAt: new Date('2026-05-21T00:04:00.000Z'),
        }) as never,
    ),
  } as unknown as jest.Mocked<
    Pick<
      AdvisoryConversationMessageRepository,
      'findMessagesBySession' | 'createMessageWithNextSequence'
    >
  >
  const promptAssembler = {
    assemblePrompt: jest.fn().mockResolvedValue({
      workflow: {
        key: 'problem-solving',
        displayName: 'Problem Solving',
        scenarioLabel: 'Systematic diagnosis and solution design',
        sourcePath: '_bmad/runtime/problem-solving/workflow.md',
        supportedFileType: '.md',
      },
      visiblePrompt: '# Problem Solving\nStable workflow prompt.',
      sourceRefs: ['_bmad/runtime/problem-solving/workflow.md'],
      sources: [
        {
          relativePath: '_bmad/runtime/problem-solving/workflow.md',
          content: 'Stable workflow prompt.',
          contentHash: 'workflow-hash-46',
          extension: '.md',
          modifiedAt: new Date('2026-05-21T00:00:00.000Z'),
        },
      ],
    }),
  } as unknown as jest.Mocked<Pick<ThinkTankPromptAssemblerService, 'assemblePrompt'>>
  const providerGateway = {
    stream: jest.fn(async function* () {
      yield {
        index: 0,
        delta: 'Continue with SOC2 remediation ownership.',
        done: true,
        provider: 'fake',
        model: 'fake-thinktank-model',
        finishReason: 'stop',
      }
    }),
  } as unknown as jest.Mocked<Pick<ThinkTankProviderGatewayService, 'stream'>>
  const outputRepository = {
    findActiveDraftForSession: jest.fn().mockResolvedValue(output),
    findLatestCompletedForSession: jest.fn().mockResolvedValue(null),
  } as unknown as jest.Mocked<
    Pick<
      AdvisoryWorkflowOutputRepository,
      'findActiveDraftForSession' | 'findLatestCompletedForSession'
    >
  >
  const eventService = {
    emitAudit: jest.fn().mockResolvedValue(undefined),
    emitTelemetry: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<Pick<AdvisoryEventService, 'emitAudit' | 'emitTelemetry'>>
  const checkpointService = {
    saveCheckpoint: jest.fn().mockResolvedValue({}),
  } as unknown as jest.Mocked<Pick<AdvisoryCheckpointService, 'saveCheckpoint'>>
  const contextCompressionService = {
    evaluate: jest.fn((input) => {
      const tenantScopedProviderMessages = input.messages.map(
        (message: ThinkTankProviderMessage) => ({
          role: message.role,
          content: message.content,
        }),
      )
      const providerMessages =
        compressionResult.providerMessages ??
        (compressionResult.decision === 'defer' ? tenantScopedProviderMessages : compressedMessages)

      return {
        decision: compressionResult.decision,
        reason: compressionResult.decision === 'execute' ? 'threshold_reached' : 'below_threshold',
        estimatedTokens: compressionResult.decision === 'execute' ? 150 : 20,
        thresholdTokens: 100,
        summary:
          compressionResult.decision === 'execute'
            ? '关键决策：Enterprise rollout can continue only if SOC2 evidence gaps are closed first. 开放问题：Who owns the SOC2 remediation plan?'
            : null,
        providerMessages,
        metadata: {
          policyDecision: compressionResult.decision,
          reason:
            compressionResult.decision === 'execute' ? 'threshold_reached' : 'below_threshold',
          estimatedTokens: compressionResult.decision === 'execute' ? 150 : 20,
          thresholdTokens: 100,
          compressedEstimatedTokens: compressionResult.decision === 'execute' ? 58 : null,
          summaryPresent: compressionResult.decision === 'execute',
          summaryLength: compressionResult.decision === 'execute' ? 142 : 0,
          originalMessageCount: input.messages.length,
          providerMessageCount: providerMessages.length,
        },
        checkpointMetadata:
          compressionResult.decision === 'execute'
            ? {
                context_compression: {
                  decision: 'execute',
                  reason: 'threshold_reached',
                  estimated_tokens: 150,
                  threshold_tokens: 100,
                  summary:
                    '关键决策：Enterprise rollout can continue only if SOC2 evidence gaps are closed first. 开放问题：Who owns the SOC2 remediation plan?',
                  important_decisions: [
                    'Enterprise rollout can continue only if SOC2 evidence gaps are closed first.',
                  ],
                  open_questions: ['Who owns the SOC2 remediation plan?'],
                },
              }
            : {},
      }
    }),
  } as unknown as jest.Mocked<Pick<ThinkTankContextCompressionService, 'evaluate'>>

  const service = new AdvisorySessionService(
    accessService as never,
    {
      discoverWorkflows: jest.fn(),
      findWorkflow: jest.fn(),
    } as unknown as ThinkTankWorkflowRegistryService,
    promptAssembler as never,
    sessionRepository as never,
    eventService as never,
    messageRepository as never,
    providerGateway as never,
    outputRepository as never,
    undefined,
    undefined,
    undefined,
    checkpointService as never,
    undefined,
    undefined,
    undefined,
    contextCompressionService as never,
  )

  return {
    service,
    messageRepository,
    providerGateway,
    eventService,
    checkpointService,
    contextCompressionService,
  }
}

describe('AdvisorySessionService context compression boundary', () => {
  test('[P0][4.6-BE-004][AC1][AC3] submitMessage uses compressed provider context, emits telemetry, and checkpoints summary', async () => {
    const { service, providerGateway, eventService, checkpointService, contextCompressionService } =
      createService()

    await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Please continue with the next recommendation.',
    })

    expect(contextCompressionService.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        actorId,
        sessionId,
        workflowKey: 'problem-solving',
        currentStep: activeSession.currentStep,
        messages: expect.arrayContaining([
          expect.objectContaining({
            content:
              'Key conclusion: Enterprise rollout can continue only if SOC2 evidence gaps are closed first.',
          }),
          expect.objectContaining({
            content: 'Please continue with the next recommendation.',
          }),
        ]),
        documentSummary: 'Enterprise rollout remains viable if SOC2 evidence gaps are closed.',
      }),
    )
    expect(JSON.stringify(contextCompressionService.evaluate.mock.calls[0][0])).not.toContain(
      'FOREIGN TENANT SECRET',
    )
    expect(providerGateway.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: compressedMessages,
        metadata: expect.objectContaining({
          context_compression_decision: 'execute',
          context_compression_reason: 'threshold_reached',
          context_compression_estimated_tokens: 150,
          context_compression_threshold_tokens: 100,
          context_compression_summary_present: true,
        }),
      }),
    )
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.ContextCompressionExecuted,
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.Session,
        subjectId: sessionId,
        outcome: ThinkTankEventOutcome.Success,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        optional: expect.objectContaining({
          sessionId,
          workflowType: 'problem-solving',
          estimatedTokens: 150,
        }),
        metadata: expect.objectContaining({
          thresholdTokens: 100,
          policyDecision: 'execute',
          reason: 'threshold_reached',
          summaryPresent: true,
          summaryLength: 142,
        }),
      }),
    )
    expect(JSON.stringify(eventService.emitTelemetry.mock.calls)).not.toMatch(
      /Enterprise rollout can continue|FOREIGN TENANT SECRET|Please continue with the next recommendation/,
    )
    expect(checkpointService.saveCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          context_compression: expect.objectContaining({
            decision: 'execute',
            summary: expect.stringContaining('SOC2 evidence gaps'),
          }),
        }),
      }),
    )
  })

  test('[P0][4.6-BE-010][AC2] telemetry failures do not block message submission', async () => {
    const { service, providerGateway, eventService } = createService({
      decision: 'defer',
    })
    eventService.emitTelemetry.mockRejectedValueOnce(new Error('telemetry unavailable'))

    await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Please continue with the next recommendation.',
    })

    expect(providerGateway.stream).toHaveBeenCalled()
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.ContextCompressionDeferred,
      }),
    )
  })

  test('[P0][4.6-BE-005][AC2] below-threshold submitMessage emits deferred telemetry and keeps full tenant-scoped context', async () => {
    const { service, providerGateway, eventService, contextCompressionService } = createService({
      decision: 'defer',
    })

    await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Please continue with the next recommendation.',
    })

    const compressionInput = contextCompressionService.evaluate.mock.calls[0][0]
    expect(compressionInput.messages).toHaveLength(3)
    expect(JSON.stringify(compressionInput.messages)).not.toContain('FOREIGN TENANT SECRET')
    expect(providerGateway.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: compressionInput.messages.map((message: ThinkTankProviderMessage) => ({
          role: message.role,
          content: message.content,
        })),
        metadata: expect.objectContaining({
          context_compression_decision: 'defer',
          context_compression_reason: 'below_threshold',
          context_compression_estimated_tokens: 20,
          context_compression_threshold_tokens: 100,
          context_compression_summary_present: false,
        }),
      }),
    )
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.ContextCompressionDeferred,
        outcome: ThinkTankEventOutcome.Success,
        optional: expect.objectContaining({
          estimatedTokens: 20,
        }),
        metadata: expect.objectContaining({
          thresholdTokens: 100,
          policyDecision: 'defer',
          reason: 'below_threshold',
          summaryPresent: false,
        }),
      }),
    )
  })

  test('[P0][4.6-BE-006][AC1] streamMessage applies the same compression policy before provider streaming', async () => {
    const { service, providerGateway, eventService, checkpointService } = createService()
    const events = []

    for await (const event of service.streamMessage({
      user,
      tenantId,
      sessionId,
      content: 'Please continue with the next recommendation.',
    })) {
      events.push(event)
    }

    expect(providerGateway.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: compressedMessages,
        metadata: expect.objectContaining({
          context_compression_decision: 'execute',
        }),
      }),
      undefined,
    )
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.ContextCompressionExecuted,
        optional: expect.objectContaining({
          estimatedTokens: 150,
        }),
      }),
    )
    expect(events.map((event) => event.event)).toEqual([
      'message.started',
      'message.delta',
      'message.completed',
    ])
    expect(checkpointService.saveCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation: expect.objectContaining({
          messageCount: 3,
          lastMessageId: 'message-user-current',
        }),
        metadata: expect.objectContaining({
          context_compression: expect.objectContaining({
            decision: 'execute',
          }),
          checkpoint_reason: 'context_compression_ready',
        }),
      }),
    )
  })

  test('[P0][4.6-BE-011][AC2] streamMessage below threshold emits deferred telemetry and keeps full tenant-scoped context', async () => {
    const { service, providerGateway, eventService, contextCompressionService } = createService({
      decision: 'defer',
    })
    const events = []

    for await (const event of service.streamMessage({
      user,
      tenantId,
      sessionId,
      content: 'Please continue with the next recommendation.',
    })) {
      events.push(event)
    }

    const compressionInput = contextCompressionService.evaluate.mock.calls[0][0]
    expect(compressionInput.messages).toHaveLength(3)
    expect(JSON.stringify(compressionInput.messages)).not.toContain('FOREIGN TENANT SECRET')
    expect(providerGateway.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: compressionInput.messages.map((message: ThinkTankProviderMessage) => ({
          role: message.role,
          content: message.content,
        })),
        metadata: expect.objectContaining({
          context_compression_decision: 'defer',
          context_compression_reason: 'below_threshold',
          context_compression_summary_present: false,
        }),
      }),
      undefined,
    )
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.ContextCompressionDeferred,
        optional: expect.objectContaining({
          estimatedTokens: 20,
        }),
      }),
    )
    expect(events.map((event) => event.event)).toEqual([
      'message.started',
      'message.delta',
      'message.completed',
    ])
  })

  test('[P0][4.6-BE-012][AC3] stream abort still preserves compressed recovery checkpoint', async () => {
    const { service, providerGateway, checkpointService } = createService()
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
      content: 'Please continue with the next recommendation.',
      signal: abortController.signal,
    })) {
      events.push(event)
    }

    expect(events.map((event) => event.event)).toEqual(['message.started', 'message.delta'])
    expect(checkpointService.saveCheckpoint).toHaveBeenCalledTimes(1)
    expect(checkpointService.saveCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation: expect.objectContaining({
          messageCount: 3,
          lastMessageId: 'message-user-current',
          historyPointer: `conversation_messages:${sessionId}`,
        }),
        metadata: expect.objectContaining({
          context_compression: expect.objectContaining({
            decision: 'execute',
            summary: expect.stringContaining('SOC2 evidence gaps'),
          }),
          checkpoint_reason: 'context_compression_ready',
        }),
      }),
    )
  })
})
