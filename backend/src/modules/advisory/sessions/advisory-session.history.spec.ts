import { NotFoundException } from '@nestjs/common'
import { AdvisoryConversationMessageRole } from '../../../database/entities/advisory-conversation-message.entity'
import {
  AdvisoryWorkflowOutput,
  AdvisoryWorkflowOutputStatus,
} from '../../../database/entities/advisory-workflow-output.entity'
import { AdvisoryWorkflowSessionStatus } from '../../../database/entities/advisory-workflow-session.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AdvisoryAccessService } from '../access/advisory-access.service'
import { AdvisoryOutputRatingRepository } from '../outputs/advisory-output-rating.repository'
import { AdvisoryWorkflowOutputRepository } from '../outputs/advisory-workflow-output.repository'
import { ThinkTankProviderGatewayService } from '../provider-gateway/thinktank-provider-gateway.service'
import { ThinkTankPromptAssemblerService } from '../runtime/prompt-assembler.service'
import { ThinkTankWorkflowRegistryService } from '../runtime/workflow-registry.service'
import { AdvisoryConversationMessageRepository } from './advisory-conversation-message.repository'
import { AdvisorySessionRepository } from './advisory-session.repository'
import { AdvisorySessionService } from './advisory-session.service'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const otherActorId = '770e8400-e29b-41d4-a716-446655440999'
const sessionId = '550e8400-e29b-41d4-a716-446655440000'
const outputId = '990e8400-e29b-41d4-a716-446655440000'

const user = {
  id: actorId,
  role: UserRole.CONSULTANT,
  organizationId: '880e8400-e29b-41d4-a716-446655440000',
}

function createSession(overrides: Record<string, unknown> = {}) {
  return {
    id: sessionId,
    tenantId,
    actorId,
    workflowKey: 'problem-solving',
    workflowDisplayName: 'Problem Solving',
    scenarioLabel: 'Systematic diagnosis and solution design',
    status: AdvisoryWorkflowSessionStatus.Active,
    currentStep: {
      index: 2,
      label: 'Map constraints',
      sourceRef: '_bmad/core/skills/bmad-problem-solving/steps/step-02.md',
    },
    sourceRefs: ['_bmad/core/skills/bmad-problem-solving/workflow.md'],
    metadata: {
      workflow_key: 'problem-solving',
      title: 'Retention Diagnosis',
    },
    failureCode: null,
    failureMessage: null,
    createdAt: new Date('2026-05-20T00:00:00.000Z'),
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
    status: AdvisoryWorkflowOutputStatus.Completed,
    title: 'Retention Diagnosis',
    summary: 'Users drop after setup.',
    contentMarkdown: '# Retention Diagnosis\n\nGuided setup is missing.',
    sections: [
      {
        id: 'section-1',
        stepIndex: 2,
        heading: 'Map constraints',
        contentMarkdown: '[AI Generated]\n\nGuided setup is missing.',
        aiLabel: '[AI Generated]',
        metadata: {
          sourceRef: '_bmad/core/skills/bmad-problem-solving/steps/step-02.md',
        },
        createdAt: '2026-05-21T01:08:00.000Z',
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
      completed_at: '2026-05-21T01:09:00.000Z',
      section_count: 1,
      last_step_index: 2,
    },
    createdAt: new Date('2026-05-20T00:05:00.000Z'),
    updatedAt: new Date('2026-05-21T01:08:00.000Z'),
    ...overrides,
  }
}

describe('AdvisorySessionService conversation history and search', () => {
  let accessService: jest.Mocked<Pick<AdvisoryAccessService, 'assertThinkTankModuleAvailable'>>
  let sessionRepository: jest.Mocked<
    Pick<AdvisorySessionRepository, 'findHistorySessionsForActor' | 'findSessionById'>
  >
  let messageRepository: jest.Mocked<
    Pick<AdvisoryConversationMessageRepository, 'findMessagesBySession'>
  >
  let outputRepository: jest.Mocked<
    Pick<
      AdvisoryWorkflowOutputRepository,
      | 'findHistoryOutputsForActor'
      | 'findLatestPersistedBySessionIds'
      | 'findOutputById'
      | 'findActiveDraftForSession'
      | 'findLatestCompletedForSession'
    >
  >
  let service: AdvisorySessionService

  beforeEach(() => {
    accessService = {
      assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
    }
    sessionRepository = {
      findHistorySessionsForActor: jest.fn().mockResolvedValue({
        items: [createSession()],
        total: 1,
      }),
      findSessionById: jest.fn().mockResolvedValue(createSession()),
    } as never
    messageRepository = {
      findMessagesBySession: jest.fn().mockResolvedValue([
        {
          id: 'message-assistant-1',
          tenantId,
          sessionId,
          actorId,
          role: AdvisoryConversationMessageRole.Assistant,
          content: 'Key conclusion: guided setup is missing.',
          sequence: 1,
          workflowKey: 'problem-solving',
          stepIndex: 2,
          decisionOptions: [],
          metadata: { stepLabel: 'Map constraints' },
          providerMetadata: {},
          createdAt: new Date('2026-05-21T01:07:00.000Z'),
          updatedAt: new Date('2026-05-21T01:07:00.000Z'),
        },
      ]),
    } as never
    outputRepository = {
      findHistoryOutputsForActor: jest.fn().mockResolvedValue({
        items: [createOutput()],
        total: 1,
      }),
      findLatestPersistedBySessionIds: jest.fn().mockResolvedValue([createOutput()]),
      findOutputById: jest.fn().mockResolvedValue(createOutput()),
      findActiveDraftForSession: jest.fn().mockResolvedValue(null),
      findLatestCompletedForSession: jest.fn().mockResolvedValue(createOutput()),
    } as never

    service = new AdvisorySessionService(
      accessService as never,
      {} as jest.Mocked<ThinkTankWorkflowRegistryService>,
      {} as jest.Mocked<ThinkTankPromptAssemblerService>,
      sessionRepository as never,
      { emitAudit: jest.fn(), emitTelemetry: jest.fn() } as never,
      messageRepository as never,
      {} as jest.Mocked<ThinkTankProviderGatewayService>,
      outputRepository as never,
    )
  })

  test('[P0][4.3-BE-007][AC1] returns newest mixed history scoped by tenant and actor', async () => {
    const result = await service.listSessionHistory({
      user,
      tenantId,
      query: {
        type: 'all',
        workflowKey: 'problem-solving',
        status: 'all',
        page: 1,
        limit: 20,
      },
    })

    expect(accessService.assertThinkTankModuleAvailable).toHaveBeenCalledWith(user, tenantId)
    expect(sessionRepository.findHistorySessionsForActor).toHaveBeenCalledWith(
      tenantId,
      actorId,
      expect.objectContaining({
        workflowKey: 'problem-solving',
        take: 20,
      }),
    )
    expect(outputRepository.findHistoryOutputsForActor).toHaveBeenCalledWith(
      tenantId,
      actorId,
      expect.objectContaining({
        workflowKey: 'problem-solving',
        take: 20,
      }),
    )
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 2 })
    expect(result.items.map((item) => item.resultType)).toEqual(['output', 'session'])
    expect(outputRepository.findLatestPersistedBySessionIds).toHaveBeenCalledWith(tenantId, [
      sessionId,
    ])
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: outputId,
        resultType: 'output',
        sessionId,
        outputId,
        workflowKey: 'problem-solving',
        workflowType: 'Problem Solving',
        title: 'Retention Diagnosis',
        summary: 'Users drop after setup.',
        status: 'completed',
        timestamp: '2026-05-21T01:08:00.000Z',
        openTarget: 'view-output',
      }),
    )
    expect(JSON.stringify(result.items)).not.toContain('_bmad')
  })

  test('[P0] rehydrates final-step metadata for active resumed workflow history items', async () => {
    const finalSession = createSession({
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
    })
    const finalDraft = createOutput({
      workflowKey: 'storytelling',
      status: AdvisoryWorkflowOutputStatus.Draft,
      title: 'Storytelling Report Draft',
      summary: '',
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
    })
    sessionRepository.findHistorySessionsForActor.mockResolvedValueOnce({
      items: [finalSession],
      total: 1,
    } as never)
    outputRepository.findHistoryOutputsForActor.mockResolvedValueOnce({
      items: [],
      total: 0,
    } as never)
    outputRepository.findLatestPersistedBySessionIds.mockResolvedValueOnce([finalDraft])

    const result = await service.listSessionHistory({
      user,
      tenantId,
      query: {
        type: 'session',
        workflowKey: 'storytelling',
        status: 'active',
        page: 1,
        limit: 20,
      },
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        resultType: 'session',
        workflowKey: 'storytelling',
        status: 'active',
        openTarget: 'resume-session',
        lastStep: expect.objectContaining({
          index: 10,
          label: 'Step 10: Generate final output',
          totalSteps: 10,
          isFinal: true,
          isFinalStep: true,
        }),
      }),
    )
  })

  test('[P0][4.4-BE-016][AC2,AC3,AC4] batch-loads history asset state with current tenant actor and authorized outputs only', async () => {
    const ratingRepository = {
      findStatesForOutputIds: jest.fn().mockResolvedValue([
        {
          outputId,
          rating: 5,
          feedbackTextPresent: true,
          isFavorited: true,
          updatedAt: '2026-05-21T06:10:00.000Z',
        },
        {
          outputId: 'foreign-output',
          rating: 1,
          feedbackTextPresent: false,
          isFavorited: true,
          updatedAt: '2026-05-21T06:11:00.000Z',
        },
      ]),
    } as jest.Mocked<Pick<AdvisoryOutputRatingRepository, 'findStatesForOutputIds'>>
    const serviceWithRatingState = new AdvisorySessionService(
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
      undefined,
      ratingRepository as never,
    )

    const result = await serviceWithRatingState.listSessionHistory({
      user,
      tenantId,
      query: { type: 'all', status: 'all' },
    })

    expect(ratingRepository.findStatesForOutputIds).toHaveBeenCalledWith(tenantId, actorId, [
      outputId,
    ])
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outputId,
          assetState: {
            outputId,
            rating: 5,
            feedbackTextPresent: true,
            isFavorited: true,
            updatedAt: '2026-05-21T06:10:00.000Z',
          },
        }),
      ]),
    )
    expect(JSON.stringify(result.items)).not.toContain('foreign-output')
  })

  test('[P0][4.3-BE-007][AC1] skips entity-incompatible status filters before querying repositories', async () => {
    await service.listSessionHistory({
      user,
      tenantId,
      query: {
        type: 'all',
        status: 'draft',
      },
    })

    expect(sessionRepository.findHistorySessionsForActor).not.toHaveBeenCalled()
    expect(outputRepository.findHistoryOutputsForActor).toHaveBeenCalledWith(
      tenantId,
      actorId,
      expect.objectContaining({ status: 'draft' }),
    )

    jest.clearAllMocks()
    await service.listSessionHistory({
      user,
      tenantId,
      query: {
        type: 'all',
        status: 'active',
      },
    })

    expect(sessionRepository.findHistorySessionsForActor).toHaveBeenCalledWith(
      tenantId,
      actorId,
      expect.objectContaining({ status: 'active' }),
    )
    expect(outputRepository.findHistoryOutputsForActor).not.toHaveBeenCalled()
  })

  test.each([
    [
      'requires a non-empty search query for search',
      () => service.searchSessionHistory({ user, tenantId, query: { q: '   ' } }),
      'Search query is required.',
    ],
    [
      'rejects unsafe hidden search tokens',
      () =>
        service.listSessionHistory({ user, tenantId, query: { q: '_bmad/sourceRef/rawPrompt' } }),
      'History search query is invalid.',
    ],
    [
      'rejects invalid history type',
      () => service.listSessionHistory({ user, tenantId, query: { type: 'report' as never } }),
      'History type filter is invalid.',
    ],
    [
      'rejects invalid history status',
      () => service.listSessionHistory({ user, tenantId, query: { status: 'deleted' as never } }),
      'History status filter is invalid.',
    ],
    [
      'rejects invalid workflow key',
      () =>
        service.listSessionHistory({
          user,
          tenantId,
          query: { workflowKey: 'problem-solving/../rawPrompt' },
        }),
      'History workflowKey is invalid.',
    ],
    [
      'rejects invalid from date',
      () => service.listSessionHistory({ user, tenantId, query: { from: 'not-a-date' } }),
      'History from date is invalid.',
    ],
    [
      'rejects inverted date range',
      () =>
        service.listSessionHistory({
          user,
          tenantId,
          query: { from: '2026-05-22', to: '2026-05-20' },
        }),
      'History from date must be before to date.',
    ],
    [
      'rejects invalid page',
      () => service.listSessionHistory({ user, tenantId, query: { page: 0 } }),
      'History page is invalid.',
    ],
    [
      'rejects invalid limit',
      () => service.listSessionHistory({ user, tenantId, query: { limit: 'many' } }),
      'History limit is invalid.',
    ],
  ])('[P0][4.3-BE-011][AC1,AC2] %s', async (_caseName, action, message) => {
    await expect(action()).rejects.toThrow(message)
    expect(sessionRepository.findHistorySessionsForActor).not.toHaveBeenCalled()
    expect(outputRepository.findHistoryOutputsForActor).not.toHaveBeenCalled()
  })

  test('[P0][4.3-BE-008][AC2] searches output content and returns safe open targets', async () => {
    sessionRepository.findHistorySessionsForActor.mockClear()

    const result = await service.searchSessionHistory({
      user,
      tenantId,
      query: {
        q: 'guided setup',
        type: 'output',
        status: 'completed',
      },
    })

    expect(sessionRepository.findHistorySessionsForActor).not.toHaveBeenCalled()
    expect(outputRepository.findHistoryOutputsForActor).toHaveBeenCalledWith(
      tenantId,
      actorId,
      expect.objectContaining({
        q: 'guided setup',
        status: 'completed',
      }),
    )
    expect(result.items).toEqual([
      expect.objectContaining({
        resultType: 'output',
        title: 'Retention Diagnosis',
        workflowType: 'Problem Solving',
        timestamp: '2026-05-21T01:08:00.000Z',
        openTarget: 'view-output',
      }),
    ])
    expect(JSON.stringify(result.items)).not.toContain('provider')
    expect(JSON.stringify(result.items)).not.toContain('_bmad')
  })

  test('[P0][4.3-BE-008][AC2] opens the requested output id only when it belongs to the same session actor', async () => {
    const output = createOutput({ id: '990e8400-e29b-41d4-a716-446655440001' })
    outputRepository.findOutputById.mockResolvedValueOnce(output)

    const result = await service.getSessionOutput({
      user,
      tenantId,
      sessionId,
      outputId: output.id,
    })

    expect(result).toEqual({
      sessionId,
      output: expect.objectContaining(output),
    })
    expect(result.output.knowledgeBaseAssociation).toEqual({
      outputId: output.id,
      status: null,
      destinationKey: null,
      externalReferenceId: null,
      message: null,
      retryCount: 0,
      updatedAt: null,
      associatedAt: null,
    })

    expect(outputRepository.findOutputById).toHaveBeenCalledWith(tenantId, output.id)
    expect(outputRepository.findActiveDraftForSession).not.toHaveBeenCalled()
  })

  test('[P0][4.3-BE-009][AC2] denies direct-open messages for another actor without leaking state', async () => {
    sessionRepository.findSessionById.mockResolvedValueOnce(
      createSession({ actorId: otherActorId }) as never,
    )

    await expect(service.listMessages({ user, tenantId, sessionId })).rejects.toThrow(
      new NotFoundException('ThinkTank session not found'),
    )
    expect(messageRepository.findMessagesBySession).not.toHaveBeenCalled()
  })

  test('[P0][4.3-BE-010][AC2] denies direct-open output for another actor without creating drafts', async () => {
    sessionRepository.findSessionById.mockResolvedValueOnce(
      createSession({ actorId: otherActorId }) as never,
    )

    await expect(service.getSessionOutput({ user, tenantId, sessionId })).rejects.toThrow(
      new NotFoundException('ThinkTank session not found'),
    )
    expect(outputRepository.findActiveDraftForSession).not.toHaveBeenCalled()
    expect(outputRepository.findLatestCompletedForSession).not.toHaveBeenCalled()
  })
})
