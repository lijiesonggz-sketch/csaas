import {
  AdvisoryCheckpointService,
  THINKTANK_CHECKPOINT_TTL_SECONDS,
  createAdvisoryCheckpointHotKey,
} from './advisory-checkpoint.service'
import { AdvisoryWorkflowCheckpointRepository } from './advisory-workflow-checkpoint.repository'
import { AdvisoryEventService } from '../events/advisory-event.service'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const secondaryTenantId = '660e8400-e29b-41d4-a716-446655440999'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const sessionId = '550e8400-e29b-41d4-a716-446655440000'

function createCheckpointInput(overrides: Record<string, unknown> = {}) {
  return {
    tenantId,
    actorId,
    sessionId,
    workflowKey: 'problem-solving',
    workflowType: 'Problem Solving',
    currentStep: {
      index: 1,
      label: 'Diagnose retention',
      sourceRef: 'current-step:1',
    },
    conversation: {
      messageCount: 2,
      lastMessageId: 'assistant-message-1',
      historyPointer: `conversation_messages:${sessionId}`,
    },
    documentState: {
      outputId: 'output-1',
      status: 'draft',
      title: 'Problem Solving Report Draft',
      summary: 'Live report draft',
      sectionCount: 1,
    },
    lastActivityAt: '2026-05-21T00:00:00.000Z',
    metadata: {
      checkpointReason: 'message_completed',
    },
    ...overrides,
  }
}

describe('AdvisoryCheckpointService', () => {
  let hotStore: {
    writeHash: jest.Mock
    readHash: jest.Mock
  }
  let repository: jest.Mocked<
    Pick<AdvisoryWorkflowCheckpointRepository, 'archiveCheckpoint' | 'findLatestCheckpoint'>
  >
  let eventService: jest.Mocked<Pick<AdvisoryEventService, 'emitTelemetry'>>
  let service: AdvisoryCheckpointService

  beforeEach(() => {
    hotStore = {
      writeHash: jest.fn().mockResolvedValue(undefined),
      readHash: jest.fn().mockResolvedValue(null),
    }
    repository = {
      archiveCheckpoint: jest.fn(async (_tenant, input) => ({
        id: 'checkpoint-1',
        tenantId,
        sessionId: input.sessionId,
        actorId: input.actorId,
        workflowKey: input.workflowKey,
        workflowType: input.workflowType,
        currentStep: input.currentStep,
        conversationState: input.conversationState,
        documentState: input.documentState,
        stateSnapshot: input.stateSnapshot,
        metadata: input.metadata ?? {},
        lastActivityAt: input.lastActivityAt,
        createdAt: new Date('2026-05-21T00:00:00.000Z'),
        updatedAt: new Date('2026-05-21T00:00:00.000Z'),
      })),
      findLatestCheckpoint: jest.fn().mockResolvedValue(null),
    } as never
    eventService = {
      emitTelemetry: jest.fn().mockResolvedValue(undefined),
    }
    service = new AdvisoryCheckpointService(hotStore, repository as never, eventService as never)
  })

  test('[P0][4.1-BE-001][AC1,AC2] saves hot state with exact key and renews the 4-hour TTL', async () => {
    const result = await service.saveCheckpoint(createCheckpointInput())

    expect(result.checkpointWarning).toBeUndefined()
    expect(createAdvisoryCheckpointHotKey(tenantId, sessionId)).toBe(
      `thinktank:${tenantId}:session:${sessionId}`,
    )
    expect(THINKTANK_CHECKPOINT_TTL_SECONDS).toBe(14400)
    expect(hotStore.writeHash).toHaveBeenCalledWith(
      `thinktank:${tenantId}:session:${sessionId}`,
      expect.objectContaining({
        checkpoint_id: expect.any(String),
        checkpoint_type: 'message_completed',
        tenant_id: tenantId,
        session_id: sessionId,
        workflow_key: 'problem-solving',
        workflow_type: 'Problem Solving',
        current_step: expect.any(String),
        conversation_state: expect.any(String),
        conversation: expect.any(String),
        document_state: expect.any(String),
        state_snapshot: expect.any(String),
        last_activity: '2026-05-21T00:00:00.000Z',
        last_activity_at: '2026-05-21T00:00:00.000Z',
        archival_status: 'pending',
      }),
      14400,
    )
    const fields = hotStore.writeHash.mock.calls[0][1] as Record<string, string>
    expect(JSON.parse(fields.current_step)).toEqual({
      index: 1,
      label: 'Diagnose retention',
      sourceRef: 'current-step:1',
    })
  })

  test('[P0][4.1-BE-002][AC2] archives a cold checkpoint with recovery-safe state fields', async () => {
    await service.saveCheckpoint(createCheckpointInput())

    expect(repository.archiveCheckpoint).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        sessionId,
        actorId,
        workflowKey: 'problem-solving',
        workflowType: 'Problem Solving',
        currentStep: expect.objectContaining({ index: 1 }),
        conversationState: expect.objectContaining({
          messageCount: 2,
          lastMessageId: 'assistant-message-1',
          historyPointer: `conversation_messages:${sessionId}`,
        }),
        documentState: expect.objectContaining({
          outputId: 'output-1',
          status: 'draft',
          sectionCount: 1,
        }),
        lastActivityAt: new Date('2026-05-21T00:00:00.000Z'),
      }),
    )
  })

  test('[P0][4.1-BE-003][AC3] restores hot checkpoints only for the matching tenant and session', async () => {
    hotStore.readHash.mockResolvedValueOnce({
      tenant_id: tenantId,
      session_id: sessionId,
      state_snapshot: JSON.stringify(createCheckpointInput()),
    })

    await expect(service.restoreCheckpoint({ tenantId, sessionId })).resolves.toEqual(
      expect.objectContaining({
        source: 'hot',
        state: expect.objectContaining({
          tenantId,
          sessionId,
          workflowKey: 'problem-solving',
        }),
      }),
    )

    hotStore.readHash.mockResolvedValueOnce({
      tenant_id: secondaryTenantId,
      session_id: sessionId,
      state_snapshot: JSON.stringify(
        createCheckpointInput({
          tenantId: secondaryTenantId,
        }),
      ),
    })

    await expect(service.restoreCheckpoint({ tenantId, sessionId })).resolves.toEqual(
      expect.objectContaining({
        source: null,
        state: null,
        checkpointWarning: expect.objectContaining({
          errorCategory: 'corrupted_hot_state',
        }),
      }),
    )
    expect(repository.findLatestCheckpoint).toHaveBeenLastCalledWith(tenantId, sessionId)
  })

  test('[P1][4.1-BE-004][AC3] falls back to the latest cold archive when hot state is malformed', async () => {
    hotStore.readHash.mockResolvedValueOnce({
      tenant_id: tenantId,
      session_id: sessionId,
      state_snapshot: '{bad json',
    })
    repository.findLatestCheckpoint.mockResolvedValueOnce({
      id: 'checkpoint-cold-1',
      tenantId,
      sessionId,
      actorId,
      workflowKey: 'problem-solving',
      workflowType: 'Problem Solving',
      currentStep: { index: 1, label: 'Diagnose retention', sourceRef: 'current-step:1' },
      conversationState: { messageCount: 2, historyPointer: `conversation_messages:${sessionId}` },
      documentState: { status: 'draft', sectionCount: 1 },
      stateSnapshot: createCheckpointInput(),
      metadata: {},
      lastActivityAt: new Date('2026-05-21T00:00:00.000Z'),
      createdAt: new Date('2026-05-21T00:00:00.000Z'),
      updatedAt: new Date('2026-05-21T00:00:00.000Z'),
    } as never)

    await expect(service.restoreCheckpoint({ tenantId, sessionId })).resolves.toEqual(
      expect.objectContaining({
        source: 'cold',
        state: expect.objectContaining({
          tenantId,
          sessionId,
          workflowKey: 'problem-solving',
        }),
        checkpointWarning: expect.objectContaining({
          errorCategory: 'corrupted_hot_state',
        }),
      }),
    )
  })

  test('[P0][4.1-BE-005][AC4] returns safe warning metadata and records persistence failures', async () => {
    hotStore.writeHash.mockRejectedValueOnce(new Error('redis unavailable'))
    repository.archiveCheckpoint.mockRejectedValueOnce(new Error('postgres unavailable'))

    const result = await service.saveCheckpoint(createCheckpointInput())

    expect(result).toEqual({
      checkpointWarning: expect.objectContaining({
        code: 'THINKTANK_CHECKPOINT_PERSISTENCE_DEGRADED',
        errorCategory: 'hot_and_cold_checkpoint_failed',
        recoveryGuidance: expect.stringContaining('progress'),
      }),
    })
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        actorId,
        subjectId: sessionId,
        optional: expect.objectContaining({
          sessionId,
          workflowType: 'problem-solving',
        }),
        metadata: expect.objectContaining({
          checkpoint_error_category: 'hot_and_cold_checkpoint_failed',
          checkpoint_operation: 'save',
        }),
      }),
    )
    expect(JSON.stringify(result)).not.toMatch(
      /redis unavailable|postgres unavailable|prompt|report/i,
    )
  })

  test('[P1][4.1-BE-006][AC1,AC4] sanitizes checkpoint state instead of storing raw prompts or report content', async () => {
    await service.saveCheckpoint(
      createCheckpointInput({
        metadata: {
          rawPrompt: 'hidden system prompt',
          providerPayload: { prompt: 'provider prompt' },
          safeFlag: true,
        },
        documentState: {
          outputId: 'output-1',
          status: 'draft',
          sectionCount: 1,
          contentMarkdown: 'full report body must not be checkpointed',
          rawReportContent: 'secret report',
        },
      }),
    )

    const fields = hotStore.writeHash.mock.calls[0][1] as Record<string, string>
    const archived = repository.archiveCheckpoint.mock.calls[0][1] as Record<string, unknown>
    expect(JSON.stringify(fields)).not.toMatch(
      /hidden system prompt|provider prompt|full report body|secret report|rawPrompt|providerPayload|contentMarkdown|rawReportContent/,
    )
    expect(JSON.stringify(archived)).not.toMatch(
      /hidden system prompt|provider prompt|full report body|secret report|rawPrompt|providerPayload|contentMarkdown|rawReportContent/,
    )
    expect(archived.metadata).toEqual({
      safeFlag: true,
      checkpoint_id: expect.any(String),
    })
  })

  test('[P0][4.1-BE-002][AC1,AC2] reports a bounded warning while a cold archive continues in the background', async () => {
    let archiveStarted = false
    repository.archiveCheckpoint.mockImplementationOnce(
      () =>
        new Promise(() => {
          archiveStarted = true
        }) as never,
    )

    await expect(service.saveCheckpoint(createCheckpointInput())).resolves.toEqual({
      checkpointWarning: expect.objectContaining({
        errorCategory: 'cold_archive',
      }),
    })

    expect(archiveStarted).toBe(true)
    expect(repository.archiveCheckpoint).toHaveBeenCalledTimes(1)
  })

  test('[P0][4.1-BE-005][AC4] reports a cold archive warning when PostgreSQL archive fails immediately', async () => {
    repository.archiveCheckpoint.mockRejectedValueOnce(new Error('postgres unavailable'))

    await expect(service.saveCheckpoint(createCheckpointInput())).resolves.toEqual({
      checkpointWarning: expect.objectContaining({
        errorCategory: 'cold_archive',
      }),
    })
  })

  test('[P0][4.1-BE-004][AC3] rebuilds cold restore state from columns when snapshot is incomplete', async () => {
    repository.findLatestCheckpoint.mockResolvedValueOnce({
      id: 'checkpoint-cold-1',
      tenantId,
      sessionId,
      actorId,
      workflowKey: 'problem-solving',
      workflowType: 'Problem Solving',
      stepIndex: 1,
      sequence: 1,
      checkpointType: 'message_completed',
      currentStep: { index: 1, label: 'Diagnose retention', sourceRef: 'current-step:1' },
      conversationState: { messageCount: 4, historyPointer: `conversation_messages:${sessionId}` },
      documentState: { outputId: 'output-1', status: 'draft', sectionCount: 2 },
      stateSnapshot: {
        tenantId,
        actorId,
        sessionId,
      },
      metadata: {},
      lastActivityAt: new Date('2026-05-21T00:00:00.000Z'),
      createdAt: new Date('2026-05-21T00:00:00.000Z'),
      updatedAt: new Date('2026-05-21T00:00:00.000Z'),
    } as never)

    await expect(service.restoreCheckpoint({ tenantId, sessionId })).resolves.toEqual(
      expect.objectContaining({
        source: 'cold',
        state: expect.objectContaining({
          currentStep: expect.objectContaining({ index: 1 }),
          conversation: expect.objectContaining({ messageCount: 4 }),
          documentState: expect.objectContaining({ sectionCount: 2 }),
        }),
      }),
    )
  })
})
