import { resolve } from 'node:path'
import {
  AdvisoryConversationMessage,
  AdvisoryConversationMessageRole,
} from '../../../database/entities/advisory-conversation-message.entity'
import {
  AdvisoryWorkflowOutput,
  AdvisoryWorkflowOutputStatus,
} from '../../../database/entities/advisory-workflow-output.entity'
import {
  AdvisoryWorkflowSession,
  AdvisoryWorkflowSessionStatus,
} from '../../../database/entities/advisory-workflow-session.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AdvisoryAccessService } from '../access/advisory-access.service'
import { AdvisoryEventService } from '../events/advisory-event.service'
import { ThinkTankProviderGatewayService } from '../provider-gateway/thinktank-provider-gateway.service'
import {
  ThinkTankProviderRequest,
  ThinkTankProviderStreamChunk,
} from '../provider-gateway/thinktank-provider-gateway.types'
import { ThinkTankBrandMapperService } from '../runtime/brand-mapper.service'
import { ThinkTankPromptAssemblerService } from '../runtime/prompt-assembler.service'
import { ThinkTankRuntimeFileProviderService } from '../runtime/runtime-file-provider.service'
import { ThinkTankWorkflowParserService } from '../runtime/workflow-parser.service'
import { ThinkTankWorkflowRegistryService } from '../runtime/workflow-registry.service'
import { ThinkTankWorkflowStepResolverService } from '../runtime/workflow-step-resolver.service'
import { AdvisoryWorkflowOutputRepository } from '../outputs/advisory-workflow-output.repository'
import { AdvisoryConversationMessageRepository } from './advisory-conversation-message.repository'
import { AdvisorySessionRepository } from './advisory-session.repository'
import { AdvisorySessionService } from './advisory-session.service'

const repoRoot = resolve(__dirname, '../../../../..')
const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const organizationId = '880e8400-e29b-41d4-a716-446655440000'
const user = {
  id: actorId,
  role: UserRole.CONSULTANT,
  organizationId,
}

function createRuntimeServices() {
  const fileProvider = new ThinkTankRuntimeFileProviderService({ repoRoot })
  const brandMapper = new ThinkTankBrandMapperService()
  const parser = new ThinkTankWorkflowParserService()
  const registry = new ThinkTankWorkflowRegistryService(fileProvider, brandMapper, parser)
  const assembler = new ThinkTankPromptAssemblerService(fileProvider, brandMapper, registry, parser)
  const stepResolver = new ThinkTankWorkflowStepResolverService(fileProvider, brandMapper)

  return { registry, assembler, parser, stepResolver }
}

describe('AdvisorySessionService workflow runtime runner', () => {
  let accessService: jest.Mocked<Pick<AdvisoryAccessService, 'assertThinkTankModuleAvailable'>>
  let repository: jest.Mocked<
    Pick<
      AdvisorySessionRepository,
      'createLaunchSession' | 'findActiveSessionForActor' | 'findSessionById' | 'updateSession'
    >
  >
  let eventService: jest.Mocked<Pick<AdvisoryEventService, 'emitAudit'>>
  let messageRepository: jest.Mocked<
    Pick<
      AdvisoryConversationMessageRepository,
      'findMessagesBySession' | 'createMessageWithNextSequence' | 'findMessageById'
    >
  >
  let outputRepository: jest.Mocked<
    Pick<
      AdvisoryWorkflowOutputRepository,
      'findActiveDraftForSession' | 'createDraft' | 'appendSection' | 'completeDraftAndSession'
    >
  >
  let providerGateway: jest.Mocked<Pick<ThinkTankProviderGatewayService, 'stream'>>
  let service: AdvisorySessionService

  beforeEach(() => {
    const { registry, assembler, parser, stepResolver } = createRuntimeServices()
    accessService = {
      assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
    }
    repository = {
      findActiveSessionForActor: jest.fn().mockResolvedValue(null),
      createLaunchSession: jest.fn(async (_tenant, input) =>
        createSession({
          id: `session-${input.workflowKey}`,
          workflowKey: String(input.workflowKey),
          workflowDisplayName: String(input.workflowDisplayName),
          scenarioLabel: String(input.scenarioLabel),
          currentStep: input.currentStep as AdvisoryWorkflowSession['currentStep'],
          sourceRefs: input.sourceRefs as string[],
          metadata: input.metadata as AdvisoryWorkflowSession['metadata'],
        }),
      ),
      findSessionById: jest.fn(),
      updateSession: jest.fn(),
    }
    eventService = {
      emitAudit: jest.fn().mockResolvedValue(undefined),
    }
    messageRepository = {
      findMessagesBySession: jest.fn().mockResolvedValue([]),
      findMessageById: jest.fn(),
      createMessageWithNextSequence: jest.fn(
        async (_tenant, sessionId, input) =>
          ({
            id: `message-${messageRepository.createMessageWithNextSequence.mock.calls.length}`,
            tenantId,
            sessionId,
            actorId: input.actorId,
            role: input.role,
            content: input.content,
            sequence: messageRepository.createMessageWithNextSequence.mock.calls.length,
            workflowKey: input.workflowKey,
            stepIndex: input.stepIndex,
            decisionOptions: input.decisionOptions,
            metadata: input.metadata,
            providerMetadata: input.providerMetadata,
            createdAt: new Date('2026-05-24T00:00:00.000Z'),
            updatedAt: new Date('2026-05-24T00:00:00.000Z'),
          }) as AdvisoryConversationMessage,
      ),
    }
    outputRepository = {
      findActiveDraftForSession: jest.fn().mockResolvedValue(createOutput()),
      createDraft: jest.fn().mockResolvedValue(createOutput()),
      appendSection: jest.fn().mockImplementation(async (_tenant, _outputId, section) =>
        createOutput({
          sections: [section],
          contentMarkdown: `# Brainstorming Report Draft\n\n## ${section.heading}\n\n${section.contentMarkdown}`,
          metadata: {
            section_count: 1,
            last_step_index: section.stepIndex,
          },
        }),
      ),
      completeDraftAndSession: jest.fn(),
    }
    providerGateway = {
      stream: jest.fn(async function* (
        input: ThinkTankProviderRequest,
      ): AsyncIterable<ThinkTankProviderStreamChunk> {
        void input
        yield {
          index: 0,
          delta: '已进入技术推荐步骤。',
          done: true,
          provider: 'fake' as const,
          model: 'fake',
          latencyMs: 1,
          finishReason: 'stop',
        }
      }),
    }
    service = new AdvisorySessionService(
      accessService as never,
      registry,
      assembler,
      repository as never,
      eventService as never,
      messageRepository as never,
      providerGateway as never,
      outputRepository as never,
      undefined,
      parser,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      stepResolver,
    )
  })

  it('initializes launched sessions with file-driven runtime step state without leaking raw sources', async () => {
    const result = await service.launchWorkflow({ user, tenantId, workflowKey: 'brainstorming' })
    const launchInput = repository.createLaunchSession.mock.calls.at(-1)?.[1]

    expect(launchInput).toEqual(
      expect.objectContaining({
        currentStep: expect.objectContaining({
          index: 1,
          label: expect.stringContaining('Step 1'),
          sourceRef: 'current-step:1',
        }),
        metadata: expect.objectContaining({
          runtime_state_version: 'workflow-step-runner-v1',
          runtime_current_step_source:
            '_bmad/core/skills/bmad-brainstorming/steps/step-01-session-setup.md',
          runtime_current_step_index: 1,
        }),
      }),
    )
    expect(result.currentStep).toEqual(
      expect.objectContaining({
        index: 1,
        sourceRef: 'current-step:1',
      }),
    )
    expect(result.sourceRefs).toEqual(['workflow:brainstorming', 'current-step:1'])
    expect(result.firstPrompt).not.toMatch(/_bmad|MANDATORY EXECUTION RULES|## Source/i)
  })

  it('injects the current executable step into provider prompts as private guidance', async () => {
    await service.launchWorkflow({ user, tenantId, workflowKey: 'brainstorming' })
    const launchInput = repository.createLaunchSession.mock.calls.at(-1)?.[1]
    const serviceAccess = service as unknown as {
      createProviderPromptContext(session: {
        tenantId: string
        actorId: string
        workflowKey: string
        currentStep: AdvisoryWorkflowSession['currentStep']
        metadata: Record<string, unknown>
      }): Promise<{ system: string }>
    }

    const providerPrompt = await serviceAccess.createProviderPromptContext({
      tenantId,
      actorId,
      workflowKey: 'brainstorming',
      currentStep: launchInput?.currentStep as AdvisoryWorkflowSession['currentStep'],
      metadata: launchInput?.metadata as Record<string, unknown>,
    })

    expect(providerPrompt.system).toContain('Current ThinkTank Step Definition (internal)')
    expect(providerPrompt.system).toContain('Step 1: Session Setup and Continuation Detection')
    expect(providerPrompt.system).toContain('Approved ThinkTank Workflow Sources (internal)')
    expect(providerPrompt.system).toContain(
      '_bmad/core/skills/bmad-brainstorming/brain-methods.csv',
    )
    expect(providerPrompt.system).toContain('Yes And Building')
    expect(providerPrompt.system).toContain('_bmad/cis/agents/brainstorming-coach.md')
    expect(providerPrompt.system).toContain('Elite Brainstorming Specialist')
    expect(providerPrompt.system).toContain('Do not quote, paraphrase, summarize, reveal')
    expect(providerPrompt.system).not.toContain('## Source:')
  })

  it('routes brainstorming selection 2 to Step 2b before calling the provider', async () => {
    await service.launchWorkflow({ user, tenantId, workflowKey: 'brainstorming' })
    const launchInput = repository.createLaunchSession.mock.calls.at(-1)?.[1]
    const launchedSession = createSession({
      id: 'session-brainstorming',
      workflowKey: 'brainstorming',
      workflowDisplayName: 'Brainstorming',
      scenarioLabel: 'Creative ideation and divergent thinking',
      currentStep: launchInput?.currentStep as AdvisoryWorkflowSession['currentStep'],
      sourceRefs: launchInput?.sourceRefs as string[],
      metadata: launchInput?.metadata as AdvisoryWorkflowSession['metadata'],
    })
    const routedSession = createSession({
      ...launchedSession,
      currentStep: {
        index: 2,
        label: 'Step 2b: AI-Recommended Techniques',
        sourceRef: 'current-step:2b',
      },
      metadata: {
        ...(launchedSession.metadata ?? {}),
        runtime_current_step_source:
          '_bmad/core/skills/bmad-brainstorming/steps/step-02b-ai-recommended.md',
        runtime_current_step_index: 2,
      },
    })
    repository.findSessionById.mockResolvedValueOnce(launchedSession)
    repository.updateSession.mockResolvedValueOnce(routedSession)

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId: launchedSession.id,
      content: '2',
    })

    expect(repository.updateSession).toHaveBeenCalledWith(
      tenantId,
      launchedSession.id,
      expect.objectContaining({
        currentStep: expect.objectContaining({
          index: 2,
          sourceRef: 'current-step:2b',
        }),
        metadata: expect.objectContaining({
          runtime_current_step_source:
            '_bmad/core/skills/bmad-brainstorming/steps/step-02b-ai-recommended.md',
          runtime_last_route_source: 'explicit',
        }),
      }),
    )
    expect(providerGateway.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('Step 2b: AI-Recommended Techniques'),
        metadata: expect.objectContaining({
          workflow_key: 'brainstorming',
          step_index: 2,
        }),
      }),
    )
    expect(result.currentStep).toEqual(
      expect.objectContaining({
        index: 2,
        sourceRef: 'current-step:2b',
      }),
    )
    expect(result.assistantMessage.stepIndex).toBe(2)
    expect(result.assistantMessage.content).toBe('已进入技术推荐步骤。')
  })

  it('persists the previous BMAD step output in the backend before routing to the next step', async () => {
    await service.launchWorkflow({ user, tenantId, workflowKey: 'market-research' })
    const launchInput = repository.createLaunchSession.mock.calls.at(-1)?.[1]
    const launchedSession = createSession({
      id: 'session-market-research',
      workflowKey: 'market-research',
      workflowDisplayName: 'Market Research',
      scenarioLabel: 'Market, competitor, and customer research',
      currentStep: launchInput?.currentStep as AdvisoryWorkflowSession['currentStep'],
      sourceRefs: launchInput?.sourceRefs as string[],
      metadata: launchInput?.metadata as AdvisoryWorkflowSession['metadata'],
    })
    const previousAssistant = createAssistantMessage({
      id: 'assistant-market-step-1',
      sessionId: launchedSession.id,
      workflowKey: launchedSession.workflowKey,
      stepIndex: launchedSession.currentStep.index,
      content: '## Research Scope\n\nWe will research AI consulting efficiency.',
      sequence: 2,
    })
    const routedSession = createSession({
      ...launchedSession,
      currentStep: {
        index: 2,
        label: 'Step 2: Customer Behavior Analysis',
        sourceRef: 'current-step:2',
      },
      metadata: {
        ...(launchedSession.metadata ?? {}),
        runtime_current_step_source:
          '_bmad/bmm/workflows/1-analysis/research/bmad-market-research/steps/step-02-customer-behavior.md',
        runtime_current_step_index: 2,
      },
    })

    messageRepository.findMessagesBySession.mockResolvedValueOnce([previousAssistant])
    repository.findSessionById
      .mockResolvedValueOnce(launchedSession)
      .mockResolvedValueOnce(launchedSession)
    repository.updateSession.mockResolvedValueOnce(routedSession)
    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(
      createOutput({ sessionId: launchedSession.id, workflowKey: 'market-research' }),
    )

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId: launchedSession.id,
      content: 'C',
    })

    expect(outputRepository.appendSection).toHaveBeenCalledWith(
      tenantId,
      'output-session-market-research',
      expect.objectContaining({
        stepIndex: 1,
        heading: expect.stringContaining('Step 1'),
        contentMarkdown: expect.stringContaining('Research Scope'),
        metadata: expect.objectContaining({
          source_message_id: previousAssistant.id,
          workflow_key: 'market-research',
        }),
      }),
    )
    expect(repository.updateSession.mock.invocationCallOrder[0]).toBeGreaterThan(
      outputRepository.appendSection.mock.invocationCallOrder[0],
    )
    expect(result.output).toEqual(
      expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({
            metadata: expect.objectContaining({ source_message_id: previousAssistant.id }),
          }),
        ]),
      }),
    )
    expect(outputRepository.completeDraftAndSession).not.toHaveBeenCalled()
  })

  it('persists final provider output without automatically completing the session', async () => {
    const finalSession = createSession({
      id: 'session-storytelling',
      workflowKey: 'storytelling',
      workflowDisplayName: 'Storytelling',
      scenarioLabel: 'Narrative framing and communication',
      currentStep: {
        index: 10,
        label: 'Step 10: Generate final output',
        sourceRef: 'current-step:10',
        totalSteps: 10,
        isFinal: true,
        isFinalStep: true,
      },
      sourceRefs: ['workflow:storytelling', 'current-step:10'],
      metadata: {
        workflow_key: 'storytelling',
        runtime_state_version: 'workflow-step-runner-v1',
        runtime_step_count: 10,
        runtime_current_step_source:
          '_bmad/cis/workflows/bmad-cis-storytelling/workflow.md#step-10',
        runtime_current_step_index: 10,
        runtime_current_step_append_provider_response: true,
      },
    })
    repository.findSessionById
      .mockResolvedValueOnce(finalSession)
      .mockResolvedValueOnce(finalSession)
    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(
      createOutput({ sessionId: finalSession.id, workflowKey: 'storytelling' }),
    )
    providerGateway.stream.mockImplementationOnce(async function* () {
      yield {
        index: 0,
        delta: 'Story complete. Your narrative has been saved.',
        done: true,
        provider: 'fake' as const,
        model: 'fake',
        latencyMs: 1,
        finishReason: 'stop',
      }
    })

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId: finalSession.id,
      content: '生成最终稿',
    })

    expect(outputRepository.appendSection).toHaveBeenCalledWith(
      tenantId,
      'output-session-storytelling',
      expect.objectContaining({
        stepIndex: 10,
        heading: 'Step 10: Generate final output',
        contentMarkdown: expect.stringContaining('Story complete'),
        metadata: expect.objectContaining({
          source_message_id: result.assistantMessage.id,
          workflow_key: 'storytelling',
        }),
      }),
    )
    expect(result.output).toEqual(
      expect.objectContaining({ status: AdvisoryWorkflowOutputStatus.Draft }),
    )
    expect(outputRepository.completeDraftAndSession).not.toHaveBeenCalled()
    expect(repository.updateSession).not.toHaveBeenCalledWith(
      tenantId,
      finalSession.id,
      expect.objectContaining({ status: AdvisoryWorkflowSessionStatus.Completed }),
    )
  })
})

function createSession(input: {
  id: string
  workflowKey: string
  workflowDisplayName: string
  scenarioLabel: string
  currentStep: AdvisoryWorkflowSession['currentStep']
  sourceRefs: string[]
  metadata: AdvisoryWorkflowSession['metadata']
}): AdvisoryWorkflowSession {
  return {
    id: input.id,
    tenantId,
    actorId,
    workflowKey: input.workflowKey,
    workflowDisplayName: input.workflowDisplayName,
    scenarioLabel: input.scenarioLabel,
    status: AdvisoryWorkflowSessionStatus.Active,
    currentStep: input.currentStep,
    sourceRefs: input.sourceRefs,
    metadata: input.metadata,
    failureCode: null,
    failureMessage: null,
    createdAt: new Date('2026-05-24T00:00:00.000Z'),
    updatedAt: new Date('2026-05-24T00:00:00.000Z'),
  } as AdvisoryWorkflowSession
}

function createAssistantMessage(input: {
  id: string
  sessionId: string
  workflowKey: string
  stepIndex: number
  content: string
  sequence: number
}): AdvisoryConversationMessage {
  return {
    id: input.id,
    tenantId,
    sessionId: input.sessionId,
    actorId,
    role: AdvisoryConversationMessageRole.Assistant,
    content: input.content,
    sequence: input.sequence,
    workflowKey: input.workflowKey,
    stepIndex: input.stepIndex,
    decisionOptions: [],
    metadata: { workflow_key: input.workflowKey, step_index: input.stepIndex },
    providerMetadata: { provider: 'fake', model: 'fake' },
    createdAt: new Date('2026-05-24T00:00:00.000Z'),
    updatedAt: new Date('2026-05-24T00:00:00.000Z'),
  } as AdvisoryConversationMessage
}

function createOutput(overrides: Partial<AdvisoryWorkflowOutput> = {}): AdvisoryWorkflowOutput {
  const sessionIdValue = overrides.sessionId ?? 'session-brainstorming'
  const workflowKey = overrides.workflowKey ?? sessionIdValue.replace(/^session-/, '')

  return {
    id: `output-${sessionIdValue}`,
    tenantId,
    sessionId: sessionIdValue,
    actorId,
    workflowKey,
    status: AdvisoryWorkflowOutputStatus.Draft,
    title: `${workflowKey} Report Draft`,
    summary: `Live report draft for the ${workflowKey} workflow.`,
    contentMarkdown: '',
    sections: [],
    aiLabelMetadata: {
      visible_label: '[AI Generated]',
      ai_generated: true,
      machine_readable: true,
      source_session_id: sessionIdValue,
      workflow_key: workflowKey,
    },
    metadata: {
      section_count: 0,
      last_step_index: null,
    },
    createdAt: new Date('2026-05-24T00:00:00.000Z'),
    updatedAt: new Date('2026-05-24T00:00:00.000Z'),
    ...overrides,
  }
}
