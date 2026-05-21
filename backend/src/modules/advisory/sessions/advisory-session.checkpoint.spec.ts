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
  currentStep: { index: 1, label: 'Diagnose retention', sourceRef: 'current-step:1' },
  sourceRefs: ['workflow:problem-solving', 'current-step:1'],
  metadata: { workflow_key: 'problem-solving', source_ref_count: 2 },
  failureCode: null,
  failureMessage: null,
  createdAt: new Date('2026-05-20T00:00:00.000Z'),
  updatedAt: new Date('2026-05-20T00:00:00.000Z'),
}

function createOutput(overrides: Partial<AdvisoryWorkflowOutput> = {}): AdvisoryWorkflowOutput {
  return {
    id: '990e8400-e29b-41d4-a716-446655440000',
    tenantId,
    sessionId,
    actorId,
    workflowKey: 'problem-solving',
    status: AdvisoryWorkflowOutputStatus.Draft,
    title: 'Problem Solving Report Draft',
    summary: 'Live report draft for the problem-solving workflow.',
    contentMarkdown: '',
    sections: [],
    aiLabelMetadata: {
      visible_label: '[AI Generated]',
      ai_generated: true,
      machine_readable: true,
      source_session_id: sessionId,
      workflow_key: 'problem-solving',
    },
    metadata: {
      section_count: 0,
    },
    createdAt: new Date('2026-05-20T00:00:00.000Z'),
    updatedAt: new Date('2026-05-20T00:00:00.000Z'),
    ...overrides,
  }
}

const createWorkflow = (key: string) => ({
  key,
  displayName: 'Problem Solving',
  scenarioLabel: 'Systematic diagnosis and solution design',
  sourcePath: `_bmad/runtime/${key}/workflow.md`,
  supportedFileType: '.md' as const,
  firstPromptSource: `_bmad/runtime/${key}/steps/step-01.md`,
  methodLibraryPaths: [],
  agentSourcePaths: [],
  description: `${key} description`,
})

describe('AdvisorySessionService checkpoint wiring', () => {
  let accessService: jest.Mocked<Pick<AdvisoryAccessService, 'assertThinkTankModuleAvailable'>>
  let registry: jest.Mocked<
    Pick<ThinkTankWorkflowRegistryService, 'discoverWorkflows' | 'findWorkflow'>
  >
  let assembler: jest.Mocked<Pick<ThinkTankPromptAssemblerService, 'assemblePrompt'>>
  let sessionRepository: jest.Mocked<
    Pick<
      AdvisorySessionRepository,
      'findActiveSessionForActor' | 'createLaunchSession' | 'findSessionById' | 'updateSession'
    >
  >
  let eventService: jest.Mocked<Pick<AdvisoryEventService, 'emitAudit' | 'emitTelemetry'>>
  let messageRepository: jest.Mocked<
    Pick<
      AdvisoryConversationMessageRepository,
      'findMessagesBySession' | 'createMessageWithNextSequence' | 'findMessageById'
    >
  >
  let providerGateway: jest.Mocked<Pick<ThinkTankProviderGatewayService, 'stream'>>
  let outputRepository: jest.Mocked<
    Pick<
      AdvisoryWorkflowOutputRepository,
      | 'findActiveDraftForSession'
      | 'findLatestCompletedForSession'
      | 'createDraft'
      | 'appendSection'
    >
  >
  let checkpointService: jest.Mocked<
    Pick<AdvisoryCheckpointService, 'saveCheckpoint' | 'restoreCheckpoint'>
  >
  let service: AdvisorySessionService

  beforeEach(() => {
    accessService = {
      assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
    }
    registry = {
      discoverWorkflows: jest.fn(),
      findWorkflow: jest.fn(async (key: string) => createWorkflow(key)),
    }
    assembler = {
      assemblePrompt: jest.fn(async ({ workflowKey }) => ({
        workflow: createWorkflow(workflowKey),
        visiblePrompt: 'Start safely.',
        sourceRefs: [`_bmad/runtime/${workflowKey}/workflow.md`, `step-01.md`],
        sources: [
          {
            relativePath: `_bmad/runtime/${workflowKey}/steps/step-01.md`,
            content: 'Start safely.',
            contentHash: 'hash',
            extension: '.md',
            modifiedAt: new Date('2026-05-20T00:00:00.000Z'),
          },
        ],
      })),
    } as never
    sessionRepository = {
      findActiveSessionForActor: jest.fn().mockResolvedValue(null),
      createLaunchSession: jest.fn(async (_tenant, input) => ({
        ...activeSession,
        id: `session-${input.workflowKey}`,
        workflowKey: input.workflowKey,
        workflowDisplayName: input.workflowDisplayName,
        scenarioLabel: input.scenarioLabel,
        currentStep: input.currentStep,
        sourceRefs: input.sourceRefs,
        metadata: input.metadata,
      })),
      findSessionById: jest.fn().mockResolvedValue(activeSession),
      updateSession: jest.fn(),
    } as never
    eventService = {
      emitAudit: jest.fn().mockResolvedValue(undefined),
      emitTelemetry: jest.fn().mockResolvedValue(undefined),
    }
    messageRepository = {
      findMessagesBySession: jest.fn().mockResolvedValue([]),
      createMessageWithNextSequence: jest.fn(async (_tenant, _session, input) => ({
        id:
          input.role === AdvisoryConversationMessageRole.User
            ? 'message-user-1'
            : 'message-assistant-1',
        tenantId,
        sessionId,
        actorId,
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
      })),
      findMessageById: jest.fn().mockResolvedValue({
        id: 'message-assistant-1',
        tenantId,
        sessionId,
        actorId,
        role: AdvisoryConversationMessageRole.Assistant,
        content: 'Retention drops after the second session.',
        sequence: 2,
        workflowKey: 'problem-solving',
        stepIndex: 1,
        decisionOptions: [],
        metadata: { ai_generated: true },
        providerMetadata: {},
        createdAt: new Date('2026-05-20T00:00:00.000Z'),
        updatedAt: new Date('2026-05-20T00:00:00.000Z'),
      } as never),
    } as never
    providerGateway = {
      stream: jest.fn(async function* (
        _input,
        _signal?: AbortSignal,
      ): AsyncIterable<ThinkTankProviderStreamChunk> {
        yield {
          index: 0,
          delta: 'Checkpoint-aware response.',
          done: true,
          provider: 'fake',
          model: 'fake-thinktank-model',
          finishReason: 'stop',
        }
      }),
    }
    outputRepository = {
      findActiveDraftForSession: jest.fn().mockResolvedValue(createOutput()),
      findLatestCompletedForSession: jest.fn().mockResolvedValue(null),
      createDraft: jest.fn().mockResolvedValue(createOutput()),
      appendSection: jest.fn().mockImplementation(async (_tenant, _outputId, section) =>
        createOutput({
          sections: [section],
          metadata: {
            section_count: 1,
            last_step_index: section.stepIndex,
          },
        }),
      ),
    } as never
    checkpointService = {
      saveCheckpoint: jest.fn().mockResolvedValue({}),
      restoreCheckpoint: jest.fn().mockResolvedValue({
        source: 'cold',
        state: {
          tenantId,
          actorId,
          sessionId,
          workflowKey: 'problem-solving',
          workflowType: 'Problem Solving',
          currentStep: activeSession.currentStep,
          conversation: {
            messageCount: 2,
            historyPointer: `conversation_messages:${sessionId}`,
          },
          documentState: {
            outputId: 'output-1',
            status: 'draft',
            sectionCount: 1,
          },
          lastActivityAt: '2026-05-21T00:00:00.000Z',
        },
      }),
    }

    service = new AdvisorySessionService(
      accessService as never,
      registry as never,
      assembler as never,
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

  test('[P0][4.1-BE-005][AC1] launchWorkflow saves an initial checkpoint after session creation', async () => {
    const result = await service.launchWorkflow({ user, tenantId, workflowKey: 'problem-solving' })

    expect(result.sessionId).toBe('session-problem-solving')
    expect(checkpointService.saveCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        actorId,
        sessionId: 'session-problem-solving',
        workflowKey: 'problem-solving',
        workflowType: 'Problem Solving',
        currentStep: expect.objectContaining({ index: 1 }),
        conversation: expect.objectContaining({
          messageCount: 0,
          historyPointer: 'conversation_messages:session-problem-solving',
        }),
        documentState: expect.objectContaining({
          sectionCount: 0,
        }),
      }),
    )
  })

  test('[P0][4.1-BE-005][AC4] submitMessage succeeds and exposes safe warning metadata when checkpoint save fails', async () => {
    checkpointService.saveCheckpoint.mockResolvedValueOnce({
      checkpointWarning: {
        code: 'THINKTANK_CHECKPOINT_PERSISTENCE_DEGRADED',
        errorCategory: 'hot_store',
        recoveryGuidance: 'Your response was saved, but recovery checkpointing is degraded.',
      },
    })

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Please analyze retention.',
    })

    expect(result.assistantMessage.content).toBe('Checkpoint-aware response.')
    expect(result.checkpointWarning).toEqual(
      expect.objectContaining({
        code: 'THINKTANK_CHECKPOINT_PERSISTENCE_DEGRADED',
        errorCategory: 'hot_store',
      }),
    )
    expect(checkpointService.saveCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        actorId,
        sessionId,
        workflowKey: 'problem-solving',
        conversation: expect.objectContaining({
          messageCount: 2,
          lastMessageId: 'message-assistant-1',
        }),
        documentState: expect.objectContaining({
          outputId: '990e8400-e29b-41d4-a716-446655440000',
          status: 'draft',
          sectionCount: 0,
        }),
      }),
    )
  })

  test('[P0][4.1-BE-005][AC1,AC4] launchWorkflow uses a bounded wait and warns when checkpoint save remains pending', async () => {
    checkpointService.saveCheckpoint.mockImplementationOnce(() => new Promise(() => undefined))

    await expect(
      service.launchWorkflow({ user, tenantId, workflowKey: 'problem-solving' }),
    ).resolves.toEqual(
      expect.objectContaining({
        sessionId: 'session-problem-solving',
        checkpointWarning: expect.objectContaining({
          errorCategory: 'hot_and_cold_checkpoint_failed',
        }),
      }),
    )

    expect(checkpointService.saveCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        sessionId: 'session-problem-solving',
      }),
    )
  })

  test('[P0][4.1-BE-005][AC4] submitMessage warns and skips checkpoint write when complete state cannot be resolved', async () => {
    outputRepository.findActiveDraftForSession.mockRejectedValueOnce(new Error('output store down'))

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Please analyze retention.',
    })

    expect(result.assistantMessage.content).toBe('Checkpoint-aware response.')
    expect(result.checkpointWarning).toEqual(
      expect.objectContaining({
        errorCategory: 'hot_and_cold_checkpoint_failed',
      }),
    )
    expect(checkpointService.saveCheckpoint).not.toHaveBeenCalled()
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'thinktank.checkpoint.persistence_failed',
        tenantId,
        subjectId: sessionId,
      }),
    )
  })

  test('[P0][4.1-BE-005][AC1] appendOutputSection checkpoints output id, status, and section count', async () => {
    await service.appendOutputSection({
      user,
      tenantId,
      sessionId,
      stepIndex: 1,
      stepLabel: 'Diagnose retention',
      contentMarkdown: 'Retention drops after the second session.',
      sourceMessageId: 'message-assistant-1',
    })

    expect(checkpointService.saveCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        actorId,
        sessionId,
        workflowKey: 'problem-solving',
        workflowType: 'Problem Solving',
        documentState: expect.objectContaining({
          outputId: '990e8400-e29b-41d4-a716-446655440000',
          status: 'draft',
          title: 'Problem Solving Report Draft',
          sectionCount: 1,
        }),
      }),
    )
  })

  test('[P0][4.1-BE-003][AC2,AC3] getSessionCheckpoint returns only the tenant-scoped latest checkpoint', async () => {
    const result = await service.getSessionCheckpoint({ user, tenantId, sessionId })

    expect(sessionRepository.findSessionById).toHaveBeenCalledWith(tenantId, sessionId)
    expect(checkpointService.restoreCheckpoint).toHaveBeenCalledWith({
      tenantId,
      sessionId,
    })
    expect(result).toEqual({
      sessionId,
      source: 'cold',
      checkpoint: expect.objectContaining({
        tenantId,
        sessionId,
        workflowKey: 'problem-solving',
      }),
    })
  })
})
