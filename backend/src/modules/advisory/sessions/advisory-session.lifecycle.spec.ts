import { ConflictException, NotFoundException } from '@nestjs/common'
import { AuditAction } from '../../../database/entities/audit-log.entity'
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
import { AdvisoryConversationMessageRepository } from './advisory-conversation-message.repository'
import { AdvisorySessionRepository } from './advisory-session.repository'
import { AdvisorySessionService } from './advisory-session.service'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const organizationId = '880e8400-e29b-41d4-a716-446655440000'
const sessionId = '990e8400-e29b-41d4-a716-446655440000'
const outputId = 'aa0e8400-e29b-41d4-a716-446655440000'

const user = {
  id: actorId,
  organizationId,
}

function createSession(overrides: Partial<AdvisoryWorkflowSession> = {}): AdvisoryWorkflowSession {
  return {
    id: sessionId,
    tenantId,
    actorId,
    workflowKey: 'problem-solving',
    workflowDisplayName: 'Problem Solving',
    scenarioLabel: 'Diagnose retention',
    status: AdvisoryWorkflowSessionStatus.Active,
    currentStep: { index: 2, label: 'Map constraints', sourceRef: 'current-step:2' },
    sourceRefs: ['workflow:problem-solving'],
    metadata: { title: 'Retention Diagnosis' },
    failureCode: null,
    failureMessage: null,
    createdAt: new Date('2026-05-21T01:00:00.000Z'),
    updatedAt: new Date('2026-05-21T01:06:00.000Z'),
    ...overrides,
  }
}

function createOutput(overrides: Partial<AdvisoryWorkflowOutput> = {}): AdvisoryWorkflowOutput {
  return {
    id: outputId,
    tenantId,
    sessionId,
    actorId,
    workflowKey: 'problem-solving',
    status: AdvisoryWorkflowOutputStatus.Draft,
    title: 'Retention Diagnosis',
    summary: 'Users drop after setup.',
    contentMarkdown: '# Retention Diagnosis',
    sections: [
      {
        id: 'section-1',
        stepIndex: 2,
        heading: 'Constraints',
        contentMarkdown: '[AI Generated]\n\nRetention drops after setup.',
        aiLabel: '[AI Generated]',
        metadata: {},
        createdAt: '2026-05-21T01:05:00.000Z',
      },
    ],
    aiLabelMetadata: { visible_label: '[AI Generated]' },
    metadata: { section_count: 1, last_step_index: 2 },
    createdAt: new Date('2026-05-21T01:01:00.000Z'),
    updatedAt: new Date('2026-05-21T01:06:00.000Z'),
    ...overrides,
  }
}

function createAssistantMessage(): AdvisoryConversationMessage {
  return {
    id: 'message-assistant-1',
    tenantId,
    sessionId,
    actorId,
    role: AdvisoryConversationMessageRole.Assistant,
    content: 'Key conclusion: setup guidance is missing.',
    sequence: 1,
    workflowKey: 'problem-solving',
    stepIndex: 2,
    decisionOptions: [],
    metadata: {},
    providerMetadata: {},
    createdAt: new Date('2026-05-21T01:04:00.000Z'),
  } as AdvisoryConversationMessage
}

describe('AdvisorySessionService safe exit and destructive lifecycle', () => {
  let accessService: jest.Mocked<Pick<AdvisoryAccessService, 'assertThinkTankModuleAvailable'>>
  let sessionRepository: jest.Mocked<
    Pick<
      AdvisorySessionRepository,
      | 'findSessionById'
      | 'pauseActiveSessionForActor'
      | 'findActiveSessionForActor'
      | 'reactivatePausedSessionForActor'
      | 'tombstoneSessionWithOutputs'
    >
  >
  let messageRepository: jest.Mocked<
    Pick<AdvisoryConversationMessageRepository, 'findMessagesBySession'>
  >
  let outputRepository: jest.Mocked<
    Pick<
      AdvisoryWorkflowOutputRepository,
      'findActiveDraftForSession' | 'findLatestCompletedForSession' | 'tombstoneOutputForSession'
    >
  >
  let eventService: jest.Mocked<Pick<AdvisoryEventService, 'emitAudit'>>
  let checkpointService: jest.Mocked<Pick<AdvisoryCheckpointService, 'saveCheckpoint'>>
  let service: AdvisorySessionService

  beforeEach(() => {
    accessService = {
      assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
    }
    sessionRepository = {
      findSessionById: jest.fn().mockResolvedValue(createSession()),
      pauseActiveSessionForActor: jest.fn().mockResolvedValue({
        session: createSession({
          status: AdvisoryWorkflowSessionStatus.Paused,
          updatedAt: new Date('2026-05-21T01:10:00.000Z'),
        }),
        previousStatus: AdvisoryWorkflowSessionStatus.Active,
      }),
      findActiveSessionForActor: jest.fn().mockResolvedValue(null),
      reactivatePausedSessionForActor: jest.fn().mockResolvedValue(createSession()),
      tombstoneSessionWithOutputs: jest.fn().mockResolvedValue({
        session: createSession({
          status: AdvisoryWorkflowSessionStatus.Deleted,
          updatedAt: new Date('2026-05-21T01:11:00.000Z'),
        }),
        previousStatus: AdvisoryWorkflowSessionStatus.Paused,
        outputIds: [outputId],
        deletedOutputCount: 1,
      }),
    }
    messageRepository = {
      findMessagesBySession: jest.fn().mockResolvedValue([createAssistantMessage()]),
    }
    outputRepository = {
      findActiveDraftForSession: jest.fn().mockResolvedValue(createOutput()),
      findLatestCompletedForSession: jest.fn().mockResolvedValue(null),
      tombstoneOutputForSession: jest.fn().mockResolvedValue({
        output: createOutput({
          status: AdvisoryWorkflowOutputStatus.Deleted,
          updatedAt: new Date('2026-05-21T01:12:00.000Z'),
        }),
        previousStatus: AdvisoryWorkflowOutputStatus.Completed,
      }),
    }
    eventService = {
      emitAudit: jest.fn().mockResolvedValue(undefined),
    }
    checkpointService = {
      saveCheckpoint: jest.fn().mockResolvedValue({}),
    }

    service = new AdvisorySessionService(
      accessService as never,
      {} as never,
      {} as never,
      sessionRepository as never,
      eventService as never,
      messageRepository as never,
      undefined,
      outputRepository as never,
      undefined,
      undefined,
      undefined,
      checkpointService as never,
    )
  })

  it('[P0][4.7-BE-GREEN-001][AC1] safe-exits an active session by checkpointing and pausing it', async () => {
    await expect(service.safeExitSession({ user, tenantId, sessionId })).resolves.toEqual(
      expect.objectContaining({
        sessionId,
        status: AdvisoryWorkflowSessionStatus.Paused,
        updatedAt: '2026-05-21T01:10:00.000Z',
      }),
    )

    expect(accessService.assertThinkTankModuleAvailable).toHaveBeenCalledWith(user, tenantId)
    expect(checkpointService.saveCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        actorId,
        sessionId,
        metadata: expect.objectContaining({
          checkpoint_reason: 'safe_exit',
        }),
      }),
    )
    expect(sessionRepository.pauseActiveSessionForActor).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      actorId,
      expect.objectContaining({
        exit_reason: 'user_safe_exit',
      }),
    )
  })

  it('[P0][4.7-BE-GREEN-002][AC1] resumes a paused session after checking active uniqueness', async () => {
    sessionRepository.findSessionById.mockResolvedValueOnce(
      createSession({ status: AdvisoryWorkflowSessionStatus.Paused }),
    )

    const result = await service.resumeSession({ user, tenantId, sessionId })

    expect(sessionRepository.findActiveSessionForActor).toHaveBeenCalledWith(tenantId, actorId)
    expect(sessionRepository.reactivatePausedSessionForActor).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      actorId,
      expect.objectContaining({
        resume_source: 'paused_safe_exit',
      }),
    )
    expect(result.session.status).toBe(AdvisoryWorkflowSessionStatus.Active)
    expect(result.messages).toHaveLength(1)
  })

  it('[P0][4.7-BE-GREEN-002][AC1] maps concurrent active-session uniqueness races to Conflict', async () => {
    sessionRepository.findSessionById.mockResolvedValueOnce(
      createSession({ status: AdvisoryWorkflowSessionStatus.Paused }),
    )
    sessionRepository.reactivatePausedSessionForActor.mockRejectedValueOnce({ code: '23505' })

    await expect(service.resumeSession({ user, tenantId, sessionId })).rejects.toThrow(
      ConflictException,
    )
  })

  it('[P0][4.7-BE-GREEN-003][AC2,AC3] tombstones an unfinished session and emits privacy-safe audit', async () => {
    const result = await service.deleteSession({ user, tenantId, sessionId })

    expect(result).toEqual({
      sessionId,
      status: AdvisoryWorkflowSessionStatus.Deleted,
      outputIds: [outputId],
      updatedAt: '2026-05-21T01:11:00.000Z',
    })
    expect(sessionRepository.tombstoneSessionWithOutputs).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        actorId,
        sessionId,
      }),
    )
    expect(eventService.emitAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.SessionDeleted,
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.Session,
        subjectId: sessionId,
        outcome: ThinkTankEventOutcome.Success,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        audit: expect.objectContaining({
          action: AuditAction.DELETE,
          entityType: 'ThinkTankWorkflowSession',
          entityId: sessionId,
        }),
        metadata: {
          workflow_key: 'problem-solving',
          previous_status: AdvisoryWorkflowSessionStatus.Paused,
          deleted_output_count: 1,
          source: 'user_destructive_action',
        },
      }),
    )
    expect(JSON.stringify(eventService.emitAudit.mock.calls)).not.toMatch(
      /prompt|message|content|report|document|summary/i,
    )
  })

  it('[P0][4.7-BE-GREEN-004][AC2,AC3] tombstones a scoped output and emits privacy-safe audit', async () => {
    const result = await service.deleteOutput({ user, tenantId, sessionId, outputId })

    expect(result).toEqual({
      sessionId,
      outputId,
      status: AdvisoryWorkflowOutputStatus.Deleted,
      updatedAt: '2026-05-21T01:12:00.000Z',
    })
    expect(outputRepository.tombstoneOutputForSession).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        actorId,
        sessionId,
        outputId,
      }),
    )
    expect(eventService.emitAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.OutputDeleted,
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.Output,
        subjectId: outputId,
        audit: expect.objectContaining({
          action: AuditAction.DELETE,
          entityType: 'ThinkTankWorkflowOutput',
          entityId: outputId,
        }),
        metadata: {
          workflow_key: 'problem-solving',
          previous_status: AdvisoryWorkflowOutputStatus.Completed,
          section_count: 1,
          source: 'user_destructive_action',
        },
      }),
    )
    expect(JSON.stringify(eventService.emitAudit.mock.calls)).not.toMatch(
      /prompt|message|content|report|document|summary/i,
    )
  })

  it('[P0][4.7-BE-GREEN-005][AC1,AC2] returns NotFound for non-owned or deleted lifecycle actions', async () => {
    sessionRepository.findSessionById.mockResolvedValueOnce(
      createSession({ actorId: 'other-actor' }),
    )

    await expect(service.safeExitSession({ user, tenantId, sessionId })).rejects.toThrow(
      NotFoundException,
    )

    sessionRepository.tombstoneSessionWithOutputs.mockResolvedValueOnce(null)
    await expect(service.deleteSession({ user, tenantId, sessionId })).rejects.toThrow(
      NotFoundException,
    )

    outputRepository.tombstoneOutputForSession.mockResolvedValueOnce(null)
    await expect(service.deleteOutput({ user, tenantId, sessionId, outputId })).rejects.toThrow(
      NotFoundException,
    )
  })
})
