import 'reflect-metadata'
import { AdvisoryWorkflowSessionStatus } from '../../../database/entities/advisory-workflow-session.entity'
import { AdvisoryConversationMessageRole } from '../../../database/entities/advisory-conversation-message.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AdvisoryAccessService } from '../access/advisory-access.service'
import { AdvisoryEventService } from '../events/advisory-event.service'
import { ThinkTankProviderGatewayService } from '../provider-gateway/thinktank-provider-gateway.service'
import { ThinkTankProviderStreamChunk } from '../provider-gateway/thinktank-provider-gateway.types'
import { ThinkTankPromptAssemblerService } from '../runtime/prompt-assembler.service'
import { ThinkTankWorkflowRegistryService } from '../runtime/workflow-registry.service'
import { AdvisoryConversationMessageRepository } from './advisory-conversation-message.repository'
import { AdvisorySessionRepository } from './advisory-session.repository'
import { AdvisorySessionService } from './advisory-session.service'

const tenantId = '660e8400-e29b-41d4-a716-446655440212'
const actorId = '770e8400-e29b-41d4-a716-446655440212'
const sessionId = '550e8400-e29b-41d4-a716-446655440212'
const organizationId = '880e8400-e29b-41d4-a716-446655440212'

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
  currentStep: { index: 1, label: 'Current step', sourceRef: 'current-step:1' },
  sourceRefs: ['_bmad/runtime/problem-solving/workflow.md'],
  metadata: { workflow_key: 'problem-solving', source_ref_count: 2 },
  failureCode: null,
  failureMessage: null,
  createdAt: new Date('2026-05-20T00:00:00.000Z'),
  updatedAt: new Date('2026-05-20T00:00:00.000Z'),
}

const assembledPrompt = {
  workflow: {
    key: 'problem-solving',
    displayName: 'Problem Solving',
    scenarioLabel: 'Systematic diagnosis and solution design',
    sourcePath: '_bmad/runtime/problem-solving/workflow.md',
    supportedFileType: '.md' as const,
    firstPromptSource: '_bmad/runtime/problem-solving/steps/step-01.md',
    methodLibraryPaths: ['_bmad/runtime/problem-solving/methods.csv'],
    agentSourcePaths: ['_bmad/runtime/problem-solving/agent.md'],
  },
  visiblePrompt: [
    '# ThinkTank Runtime Workflow: Problem Solving',
    '## Source: `_bmad/runtime/problem-solving/workflow.md`',
    'Stable workflow definition.',
    '## Source: `_bmad/runtime/problem-solving/agent.md`',
    'Stable persona content.',
  ].join('\n'),
  sourceRefs: [
    '_bmad/runtime/problem-solving/workflow.md',
    '_bmad/runtime/problem-solving/steps/step-01.md',
    '_bmad/runtime/problem-solving/agent.md',
  ],
  sources: [
    {
      relativePath: '_bmad/runtime/problem-solving/workflow.md',
      content: 'Stable workflow definition.',
      contentHash: 'workflow-hash-210',
      extension: '.md' as const,
      modifiedAt: new Date('2026-05-20T00:00:00.000Z'),
    },
    {
      relativePath: '_bmad/runtime/problem-solving/steps/step-01.md',
      content: 'Stable first prompt.',
      contentHash: 'step-hash-210',
      extension: '.md' as const,
      modifiedAt: new Date('2026-05-20T00:00:00.000Z'),
    },
    {
      relativePath: '_bmad/runtime/problem-solving/agent.md',
      content: 'Stable persona content.',
      contentHash: 'agent-hash-210',
      extension: '.md' as const,
      modifiedAt: new Date('2026-05-20T00:00:00.000Z'),
    },
  ],
}

const finalChunk: ThinkTankProviderStreamChunk = {
  index: 1,
  delta: ' cache aware response.',
  done: true,
  provider: 'fake',
  model: 'fake-thinktank-smoke',
  usage: {
    inputTokens: 120,
    outputTokens: 20,
    totalTokens: 140,
    cacheReadInputTokens: 96,
    cacheCreationInputTokens: 0,
    cachedInputTokens: 96,
    cacheEligibleInputTokens: 120,
  } as never,
  estimatedCost: 0.003,
  latencyMs: 14,
  finishReason: 'stop',
  cacheStatus: 'hit',
  cacheStrategy: 'provider-auto',
  cacheKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
} as never

const createService = () => {
  const accessService = {
    assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<Pick<AdvisoryAccessService, 'assertThinkTankModuleAvailable'>>
  const sessionRepository = {
    findSessionById: jest.fn().mockResolvedValue(activeSession),
  } as unknown as jest.Mocked<Pick<AdvisorySessionRepository, 'findSessionById'>>
  const messageRepository = {
    findMessagesBySession: jest.fn().mockResolvedValue([]),
    createMessageWithNextSequence: jest.fn(
      async (_tenant, _session, input) =>
        ({
          id:
            input.role === AdvisoryConversationMessageRole.User
              ? 'message-user-cache'
              : 'message-assistant-cache',
          tenantId,
          sessionId,
          actorId: input.actorId,
          role: input.role,
          content: input.content,
          sequence: input.role === AdvisoryConversationMessageRole.User ? 1 : 2,
          workflowKey: input.workflowKey,
          stepIndex: input.stepIndex,
          decisionOptions: input.decisionOptions ?? [],
          metadata: input.metadata ?? {},
          providerMetadata: input.providerMetadata ?? {},
          createdAt: new Date('2026-05-20T00:00:00.000Z'),
          updatedAt: new Date('2026-05-20T00:00:00.000Z'),
        }) as never,
    ),
  } as unknown as jest.Mocked<
    Pick<
      AdvisoryConversationMessageRepository,
      'findMessagesBySession' | 'createMessageWithNextSequence'
    >
  >
  const promptAssembler = {
    assemblePrompt: jest.fn().mockResolvedValue(assembledPrompt),
  } as unknown as jest.Mocked<Pick<ThinkTankPromptAssemblerService, 'assemblePrompt'>>
  const providerGateway = {
    stream: jest.fn(async function* (): AsyncIterable<ThinkTankProviderStreamChunk> {
      yield {
        index: 0,
        delta: 'ThinkTank',
        done: false,
        provider: 'fake',
        model: 'fake-thinktank-smoke',
      }
      yield finalChunk
    }),
  } as unknown as jest.Mocked<Pick<ThinkTankProviderGatewayService, 'stream'>>
  const service = new AdvisorySessionService(
    accessService as never,
    {
      discoverWorkflows: jest.fn(),
      findWorkflow: jest.fn(),
    } as unknown as ThinkTankWorkflowRegistryService,
    promptAssembler as never,
    sessionRepository as never,
    { emitAudit: jest.fn(), emitTelemetry: jest.fn() } as unknown as AdvisoryEventService,
    messageRepository as never,
    providerGateway as never,
  )

  return { service, promptAssembler, providerGateway, messageRepository }
}

describe('AdvisorySessionService prompt cache ATDD', () => {
  test('[P0] submitMessage assembles runtime prompt, sends cache policy, and persists safe cache metadata', async () => {
    const { service, promptAssembler, providerGateway, messageRepository } = createService()

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Continue this workflow.',
    })

    expect(promptAssembler.assemblePrompt).toHaveBeenCalledWith({
      workflowKey: 'problem-solving',
      includeMethodLibraries: true,
      includeAgentSources: true,
    })
    expect(providerGateway.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('# ThinkTank Runtime Workflow: Problem Solving'),
        promptCache: expect.objectContaining({
          strategy: 'provider-auto',
          cacheKey: expect.any(String),
          sourceHashes: ['workflow-hash-210', 'step-hash-210', 'agent-hash-210'],
        }),
        metadata: expect.objectContaining({
          workflow_key: 'problem-solving',
          step_index: 1,
          cache_strategy: 'provider-auto',
        }),
      }),
    )
    expect(messageRepository.createMessageWithNextSequence).toHaveBeenNthCalledWith(
      2,
      tenantId,
      sessionId,
      expect.objectContaining({
        role: AdvisoryConversationMessageRole.Assistant,
        providerMetadata: expect.objectContaining({
          provider: 'fake',
          model: 'fake-thinktank-smoke',
          latency_ms: 14,
          estimated_cost: 0.003,
          input_tokens: 120,
          output_tokens: 20,
          total_tokens: 140,
          cache_status: 'hit',
          cache_strategy: 'provider-auto',
          cache_key: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          cache_read_input_tokens: 96,
          cache_creation_input_tokens: 0,
          cached_input_tokens: 96,
          cache_eligible_input_tokens: 120,
        }),
      }),
    )
    expect(result.assistantMessage.providerMetadata).toMatchObject({
      cache_status: 'hit',
      cache_read_input_tokens: 96,
    })
  })

  test('[P0] streamMessage persists the same cache metadata on the completed SSE assistant message', async () => {
    const { service, messageRepository } = createService()
    const events = []

    for await (const event of service.streamMessage({
      user,
      tenantId,
      sessionId,
      content: 'Stream this workflow call.',
    })) {
      events.push(event)
    }

    expect(events.at(-1)).toEqual(
      expect.objectContaining({
        event: 'message.completed',
        data: expect.objectContaining({
          assistantMessage: expect.objectContaining({
            providerMetadata: expect.objectContaining({
              cache_status: 'hit',
              cache_strategy: 'provider-auto',
              cache_key: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
              cache_read_input_tokens: 96,
            }),
          }),
          usage: expect.objectContaining({
            inputTokens: 120,
            outputTokens: 20,
            totalTokens: 140,
            cacheReadInputTokens: 96,
          }),
        }),
      }),
    )
    expect(messageRepository.createMessageWithNextSequence).toHaveBeenNthCalledWith(
      2,
      tenantId,
      sessionId,
      expect.objectContaining({
        providerMetadata: expect.objectContaining({
          cache_status: 'hit',
          cache_read_input_tokens: 96,
        }),
      }),
    )
  })

  test('[P1] provider request metadata and persisted providerMetadata omit raw prompt and user content', async () => {
    const { service, providerGateway, messageRepository } = createService()

    await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Sensitive enterprise detail should stay out of telemetry metadata.',
    })

    const providerInput = providerGateway.stream.mock.calls[0][0] as unknown as Record<
      string,
      unknown
    >
    expect(JSON.stringify(providerInput.metadata)).not.toMatch(
      /Sensitive enterprise detail|Stable workflow definition|Stable persona content|prompt|content|messages|conversation|report|document/i,
    )
    const assistantInput = messageRepository.createMessageWithNextSequence.mock.calls[1][2]
    expect(JSON.stringify(assistantInput.providerMetadata)).not.toMatch(
      /Sensitive enterprise detail|Stable workflow definition|Stable persona content|prompt|content|messages|conversation|report|document/i,
    )
  })

  test('[P1] falls back to disabled cache policy so gateway can emit bypass miss telemetry', async () => {
    const { service, promptAssembler, providerGateway } = createService()
    promptAssembler.assemblePrompt.mockRejectedValueOnce(new Error('runtime source unavailable'))

    await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Continue with fallback prompt.',
    })

    expect(providerGateway.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        promptCache: expect.objectContaining({
          strategy: 'disabled',
          bypassReason: 'no_static_prompt',
        }),
        metadata: expect.objectContaining({
          cache_strategy: 'disabled',
          cache_bypass_reason: 'no_static_prompt',
        }),
      }),
    )
  })
})
