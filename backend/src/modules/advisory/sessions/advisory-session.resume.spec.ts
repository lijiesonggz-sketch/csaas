import { AdvisoryConversationMessageRole } from '../../../database/entities/advisory-conversation-message.entity'
import {
  AdvisoryWorkflowOutput,
  AdvisoryWorkflowOutputStatus,
} from '../../../database/entities/advisory-workflow-output.entity'
import { AdvisoryWorkflowSessionStatus } from '../../../database/entities/advisory-workflow-session.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AdvisoryAccessService } from '../access/advisory-access.service'
import { AdvisoryCheckpointService } from '../checkpoints/advisory-checkpoint.service'
import { AdvisoryWorkflowOutputRepository } from '../outputs/advisory-workflow-output.repository'
import { ThinkTankProviderGatewayService } from '../provider-gateway/thinktank-provider-gateway.service'
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
  currentStep: { index: 2, label: 'Map constraints', sourceRef: 'current-step:2' },
  sourceRefs: ['workflow:problem-solving', 'current-step:2'],
  metadata: { workflow_key: 'problem-solving', source_ref_count: 2 },
  failureCode: null,
  failureMessage: null,
  createdAt: new Date('2026-05-20T00:00:00.000Z'),
  updatedAt: new Date('2026-05-21T01:00:00.000Z'),
}

function createOutput(overrides: Partial<AdvisoryWorkflowOutput> = {}): AdvisoryWorkflowOutput {
  return {
    id: '990e8400-e29b-41d4-a716-446655440000',
    tenantId,
    sessionId,
    actorId,
    workflowKey: 'problem-solving',
    status: AdvisoryWorkflowOutputStatus.Draft,
    title: 'Retention Diagnosis',
    summary: 'Users drop after the second onboarding session.',
    contentMarkdown:
      '# Retention Diagnosis\n\n## Map constraints\n\nTrial users lack setup guidance.',
    sections: [
      {
        id: 'section-1',
        stepIndex: 2,
        heading: 'Map constraints',
        contentMarkdown: '[AI Generated]\n\nTrial users lack setup guidance.',
        aiLabel: '[AI Generated]',
        metadata: { step_index: 2 },
        createdAt: '2026-05-21T01:05:00.000Z',
      },
    ],
    aiLabelMetadata: {
      visible_label: '[AI Generated]',
      ai_generated: true,
      machine_readable: true,
      source_session_id: sessionId,
      workflow_key: 'problem-solving',
    },
    metadata: {
      section_count: 1,
      last_step_index: 2,
    },
    createdAt: new Date('2026-05-20T00:00:00.000Z'),
    updatedAt: new Date('2026-05-21T01:06:00.000Z'),
    ...overrides,
  }
}

const persistedMessages = [
  {
    id: 'message-user-1',
    tenantId,
    sessionId,
    actorId,
    role: AdvisoryConversationMessageRole.User,
    content: 'We lose trial users after setup.',
    sequence: 1,
    workflowKey: 'problem-solving',
    stepIndex: 1,
    decisionOptions: [],
    metadata: {},
    providerMetadata: {},
    createdAt: new Date('2026-05-21T01:01:00.000Z'),
    updatedAt: new Date('2026-05-21T01:01:00.000Z'),
  },
  {
    id: 'message-assistant-1',
    tenantId,
    sessionId,
    actorId,
    role: AdvisoryConversationMessageRole.Assistant,
    content: 'Key conclusion: setup guidance is the likely constraint.',
    sequence: 2,
    workflowKey: 'problem-solving',
    stepIndex: 2,
    decisionOptions: [{ key: 'continue', action: 'continue', label: '继续', enabled: true }],
    metadata: { ai_generated: true },
    providerMetadata: {},
    createdAt: new Date('2026-05-21T01:04:00.000Z'),
    updatedAt: new Date('2026-05-21T01:04:00.000Z'),
  },
]

describe('AdvisorySessionService resume interrupted sessions', () => {
  let accessService: jest.Mocked<Pick<AdvisoryAccessService, 'assertThinkTankModuleAvailable'>>
  let sessionRepository: jest.Mocked<
    Pick<AdvisorySessionRepository, 'findSessionById' | 'findUnfinishedSessionsForActor'>
  >
  let messageRepository: jest.Mocked<
    Pick<AdvisoryConversationMessageRepository, 'findMessagesBySession'>
  >
  let outputRepository: jest.Mocked<
    Pick<
      AdvisoryWorkflowOutputRepository,
      'findActiveDraftForSession' | 'findLatestCompletedForSession'
    >
  >
  let checkpointService: jest.Mocked<Pick<AdvisoryCheckpointService, 'restoreCheckpoint'>>
  let service: AdvisorySessionService

  beforeEach(() => {
    accessService = {
      assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
    }
    sessionRepository = {
      findSessionById: jest.fn().mockResolvedValue(activeSession),
      findUnfinishedSessionsForActor: jest.fn().mockResolvedValue([activeSession]),
    } as never
    messageRepository = {
      findMessagesBySession: jest.fn().mockResolvedValue(persistedMessages),
    } as never
    outputRepository = {
      findActiveDraftForSession: jest.fn().mockResolvedValue(createOutput()),
      findLatestCompletedForSession: jest.fn().mockResolvedValue(null),
    } as never
    checkpointService = {
      restoreCheckpoint: jest.fn().mockResolvedValue({
        source: 'hot',
        state: {
          tenantId,
          actorId,
          sessionId,
          workflowKey: 'problem-solving',
          workflowType: 'Problem Solving',
          currentStep: activeSession.currentStep,
          conversation: {
            messageCount: 2,
            lastMessageId: 'message-assistant-1',
            historyPointer: `conversation_messages:${sessionId}`,
          },
          documentState: {
            outputId: '990e8400-e29b-41d4-a716-446655440000',
            status: 'draft',
            title: 'Retention Diagnosis',
            summary: 'Users drop after the second onboarding session.',
            sectionCount: 1,
          },
          lastActivityAt: '2026-05-21T01:06:00.000Z',
          metadata: { checkpoint_id: 'checkpoint-1' },
        },
      }),
    }

    service = new AdvisorySessionService(
      accessService as never,
      {} as jest.Mocked<ThinkTankWorkflowRegistryService>,
      {} as jest.Mocked<ThinkTankPromptAssemblerService>,
      sessionRepository as never,
      { emitAudit: jest.fn(), emitTelemetry: jest.fn() } as never,
      messageRepository as never,
      {} as jest.Mocked<ThinkTankProviderGatewayService>,
      outputRepository as never,
      undefined,
      undefined,
      undefined,
      checkpointService as never,
    )
  })

  test('[P0][4.2-BE-001][AC1] lists unfinished sessions for the current tenant actor with resume card fields', async () => {
    const staleSession = {
      ...activeSession,
      id: '550e8400-e29b-41d4-a716-446655440001',
      currentStep: { index: 1, label: 'Frame problem', sourceRef: 'current-step:1' },
      updatedAt: new Date('2026-05-21T01:00:00.000Z'),
    }
    const recentSession = {
      ...activeSession,
      id: '550e8400-e29b-41d4-a716-446655440002',
      currentStep: { index: 3, label: 'Prioritize fixes', sourceRef: 'current-step:3' },
      updatedAt: new Date('2026-05-21T03:00:00.000Z'),
    }
    const completedSession = {
      ...activeSession,
      id: '550e8400-e29b-41d4-a716-446655440003',
      status: AdvisoryWorkflowSessionStatus.Completed,
    }
    const otherActorSession = {
      ...activeSession,
      id: '550e8400-e29b-41d4-a716-446655440004',
      actorId: '770e8400-e29b-41d4-a716-446655440999',
    }
    sessionRepository.findUnfinishedSessionsForActor.mockResolvedValueOnce([
      staleSession,
      completedSession,
      otherActorSession,
      recentSession,
    ] as never)
    checkpointService.restoreCheckpoint.mockResolvedValueOnce({
      source: null,
      state: null,
    })
    checkpointService.restoreCheckpoint.mockResolvedValueOnce({
      source: null,
      state: null,
    })
    outputRepository.findActiveDraftForSession.mockResolvedValue(null)
    outputRepository.findLatestCompletedForSession.mockResolvedValue(null)
    messageRepository.findMessagesBySession.mockResolvedValue([])

    const result = await service.listUnfinishedSessions({ user, tenantId })

    expect(sessionRepository.findUnfinishedSessionsForActor).toHaveBeenCalledWith(tenantId, actorId)
    expect(checkpointService.restoreCheckpoint).toHaveBeenCalledTimes(2)
    expect(result.sessions).toHaveLength(2)
    expect(result.sessions.map((session) => session.sessionId)).toEqual([
      recentSession.id,
      staleSession.id,
    ])
    expect(result.sessions[0]).toEqual(
      expect.objectContaining({
        workflowKey: 'problem-solving',
        workflowType: 'Problem Solving',
        title: 'Problem Solving 会话',
        status: AdvisoryWorkflowSessionStatus.Active,
        statusSummary: expect.stringContaining('未完成'),
        lastStep: expect.objectContaining({ index: 3, label: 'Prioritize fixes' }),
        lastActivityAt: '2026-05-21T03:00:00.000Z',
        checkpointSource: 'fallback',
      }),
    )
  })

  test('[P0] restores final-step metadata for unfinished resumed sessions', async () => {
    const finalSession = {
      ...activeSession,
      workflowKey: 'storytelling',
      workflowDisplayName: 'Storytelling',
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
    }
    sessionRepository.findUnfinishedSessionsForActor.mockResolvedValueOnce([finalSession] as never)
    checkpointService.restoreCheckpoint.mockResolvedValueOnce({
      source: null,
      state: null,
    })
    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(
      createOutput({
        workflowKey: 'storytelling',
        sections: [
          {
            id: 'section-final',
            stepIndex: 10,
            heading: 'Step 10: Generate final output',
            contentMarkdown: '[AI Generated]\n\nFinal narrative.',
            aiLabel: '[AI Generated]',
            metadata: {},
            createdAt: '2026-05-25T01:27:48.000Z',
          },
        ],
        metadata: {
          section_count: 1,
          last_step_index: 10,
        },
      }),
    )
    outputRepository.findLatestCompletedForSession.mockResolvedValueOnce(null)
    messageRepository.findMessagesBySession.mockResolvedValueOnce([])

    const result = await service.listUnfinishedSessions({ user, tenantId })

    expect(result.sessions).toHaveLength(1)
    expect(result.sessions[0].lastStep).toEqual(
      expect.objectContaining({
        index: 10,
        label: 'Step 10: Generate final output',
        totalSteps: 10,
        isFinal: true,
        isFinalStep: true,
      }),
    )
  })

  test('[P0][4.2-BE-002][AC2] resumes from checkpoint and returns recovery message with continue and document actions', async () => {
    const result = await service.resumeSession({ user, tenantId, sessionId })

    expect(sessionRepository.findSessionById).toHaveBeenCalledWith(tenantId, sessionId)
    expect(checkpointService.restoreCheckpoint).toHaveBeenCalledWith({ tenantId, sessionId })
    expect(messageRepository.findMessagesBySession).toHaveBeenCalledWith(tenantId, sessionId)
    expect(outputRepository.findActiveDraftForSession).toHaveBeenCalledWith(tenantId, sessionId)
    expect(result).toEqual(
      expect.objectContaining({
        checkpointSource: 'hot',
        messages: persistedMessages,
        output: expect.objectContaining({ title: 'Retention Diagnosis' }),
        recoveryMessage: expect.objectContaining({
          content: expect.stringContaining('Map constraints'),
          keyConclusions: expect.arrayContaining([expect.stringContaining('setup guidance')]),
          actions: [
            { key: 'continue', label: '继续' },
            { key: 'review-document', label: '先查看文档' },
          ],
        }),
        recoveredState: expect.objectContaining({
          recoveredFrom: 'checkpoint',
          messageCount: 2,
          outputSectionCount: 1,
        }),
        missingState: [],
      }),
    )
  })

  test('[P0][4.2-BE-003][AC3] falls back to persisted conversation and report state when checkpoint is corrupted', async () => {
    checkpointService.restoreCheckpoint.mockResolvedValueOnce({
      source: null,
      state: null,
      checkpointWarning: {
        code: 'THINKTANK_CHECKPOINT_PERSISTENCE_DEGRADED',
        errorCategory: 'corrupted_hot_state',
        recoveryGuidance: 'Checkpoint was corrupted; persisted state was used.',
      },
    })

    const result = await service.resumeSession({ user, tenantId, sessionId })

    expect(result.checkpointSource).toBe('fallback')
    expect(result.recoveredState).toEqual(
      expect.objectContaining({
        recoveredFrom: 'persisted-state',
        lastStep: 'Map constraints',
        messageCount: 2,
        outputSectionCount: 1,
      }),
    )
    expect(result.missingState).toContain('checkpoint')
    expect(result.recoveryMessage.content).toContain('已从最近保存的对话和报告草稿恢复')
    expect(result.checkpointWarning).toEqual(
      expect.objectContaining({
        errorCategory: 'corrupted_hot_state',
      }),
    )
  })

  test('[P0][4.6-BE-007][AC3] includes compressed decisions and open questions in recovery summary', async () => {
    checkpointService.restoreCheckpoint.mockResolvedValueOnce({
      source: 'cold',
      state: {
        tenantId,
        actorId,
        sessionId,
        workflowKey: 'problem-solving',
        workflowType: 'Problem Solving',
        currentStep: activeSession.currentStep,
        conversation: {
          messageCount: 18,
          lastMessageId: 'message-assistant-9',
          historyPointer: `conversation_messages:${sessionId}`,
        },
        documentState: {
          outputId: '990e8400-e29b-41d4-a716-446655440000',
          status: 'draft',
          title: 'Retention Diagnosis',
          summary: '',
          sectionCount: 1,
        },
        lastActivityAt: '2026-05-21T01:06:00.000Z',
        metadata: {
          context_compression: {
            decision: 'execute',
            reason: 'threshold_reached',
            estimated_tokens: 18000,
            threshold_tokens: 12000,
            summary:
              '关键决策：继续企业版上线，但先关闭 SOC2 evidence gap。开放问题：谁负责法务确认？',
            important_decisions: ['继续企业版上线，但先关闭 SOC2 evidence gap'],
            open_questions: ['谁负责法务确认？'],
          },
        },
      },
    })
    messageRepository.findMessagesBySession.mockResolvedValueOnce([])
    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(null)
    outputRepository.findLatestCompletedForSession.mockResolvedValueOnce(null)

    const result = await service.resumeSession({ user, tenantId, sessionId })

    expect(result.recoveryMessage.keyConclusions).toEqual(
      expect.arrayContaining([
        '继续企业版上线，但先关闭 SOC2 evidence gap',
        '待确认：谁负责法务确认？',
      ]),
    )
    expect(result.recoveryMessage.content).toContain('SOC2 evidence gap')
    expect(result.recoveryMessage.content).toContain('谁负责法务确认')
    expect(JSON.stringify(result.recoveryMessage)).not.toContain('FOREIGN TENANT SECRET')
  })

  test('[P0][4.6-BE-008][AC3] filters foreign repository messages during resume recovery', async () => {
    messageRepository.findMessagesBySession.mockResolvedValueOnce([
      ...persistedMessages,
      {
        id: 'message-foreign-1',
        tenantId: '660e8400-e29b-41d4-a716-446655449999',
        sessionId,
        actorId: '770e8400-e29b-41d4-a716-446655449999',
        role: AdvisoryConversationMessageRole.Assistant,
        content: 'Key conclusion: FOREIGN TENANT SECRET marker-form conclusion must not leak.',
        sequence: 3,
        workflowKey: 'problem-solving',
        stepIndex: 3,
        decisionOptions: [],
        metadata: { ai_generated: true },
        providerMetadata: {},
        createdAt: new Date('2026-05-21T01:08:00.000Z'),
        updatedAt: new Date('2026-05-21T01:08:00.000Z'),
      },
    ])

    const result = await service.resumeSession({ user, tenantId, sessionId })

    expect(result.messages).toHaveLength(2)
    expect(result.recoveredState.messageCount).toBe(2)
    expect(JSON.stringify(result)).not.toContain('FOREIGN TENANT SECRET')
  })

  test('[P0][4.2-BE-004][AC3] derives fallback last step from persisted report output instead of stale session state', async () => {
    sessionRepository.findSessionById.mockResolvedValueOnce({
      ...activeSession,
      currentStep: { index: 0, label: 'Launch workflow', sourceRef: 'current-step:0' },
    } as never)
    checkpointService.restoreCheckpoint.mockResolvedValueOnce({
      source: null,
      state: null,
      checkpointWarning: {
        code: 'THINKTANK_CHECKPOINT_PERSISTENCE_DEGRADED',
        errorCategory: 'corrupted_hot_state',
        recoveryGuidance: 'Checkpoint was corrupted; persisted state was used.',
      },
    })
    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(
      createOutput({
        sections: [
          {
            id: 'section-1',
            stepIndex: 1,
            heading: 'Frame problem',
            contentMarkdown: '[AI Generated]\n\nTrial users lack setup guidance.',
            aiLabel: '[AI Generated]',
            metadata: { step_index: 1 },
            createdAt: '2026-05-21T01:05:00.000Z',
          },
          {
            id: 'section-3',
            stepIndex: 3,
            heading: 'Prioritize fixes',
            contentMarkdown: '[AI Generated]\n\nGuided setup is the highest leverage fix.',
            aiLabel: '[AI Generated]',
            metadata: { step_index: 3 },
            createdAt: '2026-05-21T01:12:00.000Z',
          },
        ],
        metadata: {
          section_count: 2,
          last_step_index: 3,
        },
      }),
    )

    const result = await service.resumeSession({ user, tenantId, sessionId })

    expect(result.recoveredState).toEqual(
      expect.objectContaining({
        recoveredFrom: 'persisted-state',
        lastStep: 'Prioritize fixes',
      }),
    )
    expect(result.session.lastStep).toEqual(
      expect.objectContaining({
        index: 3,
        label: 'Prioritize fixes',
        sourceRef: 'output-section:section-3',
      }),
    )
  })

  test('[P0][4.2-BE-005][AC3] derives fallback last step from persisted messages when no report output exists', async () => {
    sessionRepository.findSessionById.mockResolvedValueOnce({
      ...activeSession,
      currentStep: { index: 0, label: 'Launch workflow', sourceRef: 'current-step:0' },
    } as never)
    checkpointService.restoreCheckpoint.mockResolvedValueOnce({
      source: null,
      state: null,
      checkpointWarning: {
        code: 'THINKTANK_CHECKPOINT_PERSISTENCE_DEGRADED',
        errorCategory: 'corrupted_hot_state',
        recoveryGuidance: 'Checkpoint was corrupted; persisted state was used.',
      },
    })
    messageRepository.findMessagesBySession.mockResolvedValueOnce([
      ...persistedMessages,
      {
        id: 'message-assistant-3',
        tenantId,
        sessionId,
        actorId,
        role: AdvisoryConversationMessageRole.Assistant,
        content: 'Key conclusion: guided setup should be shipped first.',
        sequence: 3,
        workflowKey: 'problem-solving',
        stepIndex: 3,
        decisionOptions: [],
        metadata: { stepLabel: 'Prioritize fixes' },
        providerMetadata: {},
        createdAt: new Date('2026-05-21T01:10:00.000Z'),
        updatedAt: new Date('2026-05-21T01:10:00.000Z'),
      },
    ])
    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(null)
    outputRepository.findLatestCompletedForSession.mockResolvedValueOnce(null)

    const result = await service.resumeSession({ user, tenantId, sessionId })

    expect(result.recoveredState).toEqual(
      expect.objectContaining({
        recoveredFrom: 'persisted-state',
        lastStep: 'Prioritize fixes',
        outputSectionCount: 0,
      }),
    )
    expect(result.session.lastStep).toEqual(
      expect.objectContaining({
        index: 3,
        label: 'Prioritize fixes',
        sourceRef: 'conversation-message:message-assistant-3',
      }),
    )
  })

  test('[P0][4.2-BE-010][AC2] denies resume for another actor without exposing session state', async () => {
    sessionRepository.findSessionById.mockResolvedValueOnce({
      ...activeSession,
      actorId: '770e8400-e29b-41d4-a716-446655440999',
    } as never)

    await expect(service.resumeSession({ user, tenantId, sessionId })).rejects.toThrow(
      'ThinkTank session not found',
    )
    expect(checkpointService.restoreCheckpoint).not.toHaveBeenCalled()
    expect(messageRepository.findMessagesBySession).not.toHaveBeenCalled()
  })

  test('[P0][4.2-BE-011][AC2] denies resume for completed sessions as not unfinished', async () => {
    sessionRepository.findSessionById.mockResolvedValueOnce({
      ...activeSession,
      status: AdvisoryWorkflowSessionStatus.Completed,
    } as never)

    await expect(service.resumeSession({ user, tenantId, sessionId })).rejects.toThrow(
      'ThinkTank session not found',
    )
    expect(checkpointService.restoreCheckpoint).not.toHaveBeenCalled()
    expect(messageRepository.findMessagesBySession).not.toHaveBeenCalled()
  })

  test('[P0][4.2-BE-012][AC2] stops resume before lookup when ThinkTank access is denied', async () => {
    accessService.assertThinkTankModuleAvailable.mockRejectedValueOnce(
      new Error('ThinkTank module disabled'),
    )

    await expect(service.resumeSession({ user, tenantId, sessionId })).rejects.toThrow(
      'ThinkTank module disabled',
    )
    expect(sessionRepository.findSessionById).not.toHaveBeenCalled()
    expect(checkpointService.restoreCheckpoint).not.toHaveBeenCalled()
  })

  test('[P0][4.2-BE-013][AC3] falls back cleanly when checkpoint is missing and persisted state is empty', async () => {
    checkpointService.restoreCheckpoint.mockResolvedValueOnce({
      source: null,
      state: null,
    })
    messageRepository.findMessagesBySession.mockResolvedValueOnce([])
    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(null)
    outputRepository.findLatestCompletedForSession.mockResolvedValueOnce(null)

    const result = await service.resumeSession({ user, tenantId, sessionId })

    expect(result.checkpointSource).toBe('fallback')
    expect(result.recoveredState).toEqual(
      expect.objectContaining({
        recoveredFrom: 'persisted-state',
        lastStep: 'Map constraints',
        messageCount: 0,
        outputSectionCount: 0,
      }),
    )
    expect(result.missingState).toEqual(['checkpoint', 'conversation', 'document'])
    expect(result.recoveryMessage.content).toContain('可能需要重新补充')
    expect(result.checkpointWarning).toBeUndefined()
  })

  test('[P1][4.2-BE-014][AC3] converts checkpoint restore exceptions into safe fallback warnings', async () => {
    checkpointService.restoreCheckpoint.mockRejectedValueOnce(new Error('redis payload invalid'))
    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(null)
    outputRepository.findLatestCompletedForSession.mockResolvedValueOnce(null)

    const result = await service.resumeSession({ user, tenantId, sessionId })

    expect(result.checkpointSource).toBe('fallback')
    expect(result.recoveredState.recoveredFrom).toBe('persisted-state')
    expect(result.checkpointWarning).toEqual(
      expect.objectContaining({
        errorCategory: 'corrupted_hot_state',
      }),
    )
  })
})
