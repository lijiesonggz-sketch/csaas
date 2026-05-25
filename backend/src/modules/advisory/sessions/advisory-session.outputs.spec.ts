import { BadRequestException, NotFoundException } from '@nestjs/common'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { AdvisoryConversationMessageRole } from '../../../database/entities/advisory-conversation-message.entity'
import {
  AdvisoryWorkflowOutput,
  AdvisoryWorkflowOutputStatus,
} from '../../../database/entities/advisory-workflow-output.entity'
import { AdvisoryWorkflowSessionStatus } from '../../../database/entities/advisory-workflow-session.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AdvisoryAccessService } from '../access/advisory-access.service'
import { AdvisoryEventService } from '../events/advisory-event.service'
import {
  ThinkTankEventName,
  ThinkTankEventOutcome,
  ThinkTankPrivacyClassification,
  ThinkTankSubjectType,
} from '../events/thinktank-event-contract'
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
  currentStep: {
    index: 1,
    label: 'Diagnose retention',
    sourceRef: 'current-step:1',
    totalSteps: 1,
    isFinal: true,
    isFinalStep: true,
  },
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
      generated_at: '2026-05-20T00:00:00.000Z',
    },
    metadata: {
      section_count: 0,
      last_step_index: null,
    },
    createdAt: new Date('2026-05-20T00:00:00.000Z'),
    updatedAt: new Date('2026-05-20T00:00:00.000Z'),
    ...overrides,
  }
}

describe('AdvisorySessionService workflow outputs (ATDD RED)', () => {
  let accessService: jest.Mocked<Pick<AdvisoryAccessService, 'assertThinkTankModuleAvailable'>>
  let sessionRepository: jest.Mocked<
    Pick<AdvisorySessionRepository, 'findSessionById' | 'updateSession'>
  >
  let messageRepository: jest.Mocked<Pick<AdvisoryConversationMessageRepository, 'findMessageById'>>
  let outputRepository: jest.Mocked<
    Pick<
      AdvisoryWorkflowOutputRepository,
      | 'findActiveDraftForSession'
      | 'findLatestCompletedForSession'
      | 'findOutputById'
      | 'findOutputsBySession'
      | 'createDraft'
      | 'appendSection'
      | 'markCompleted'
      | 'completeDraftAndSession'
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
      findMessageById: jest.fn().mockResolvedValue({
        id: 'assistant-message-1',
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
        providerMetadata: {
          provider: 'fake',
          model: 'fake-thinktank-model',
          latency_ms: 12,
          input_tokens: 10,
          output_tokens: 8,
          total_tokens: 18,
          rawPrompt: 'do not copy this prompt',
        },
        createdAt: new Date('2026-05-20T00:00:00.000Z'),
        updatedAt: new Date('2026-05-20T00:00:00.000Z'),
      } as never),
    }
    outputRepository = {
      findActiveDraftForSession: jest.fn().mockResolvedValue(createOutput()),
      findLatestCompletedForSession: jest.fn().mockResolvedValue(null),
      findOutputById: jest.fn().mockResolvedValue(createOutput()),
      findOutputsBySession: jest.fn().mockResolvedValue([createOutput()]),
      createDraft: jest.fn().mockResolvedValue(createOutput()),
      appendSection: jest.fn().mockImplementation(async (_tenantId, _outputId, section) =>
        createOutput({
          sections: [section],
          contentMarkdown: '# Problem Solving Report Draft\n\n' + section.contentMarkdown,
          metadata: {
            section_count: 1,
            last_step_index: section.stepIndex,
          },
        }),
      ),
      markCompleted: jest.fn().mockResolvedValue(
        createOutput({
          status: AdvisoryWorkflowOutputStatus.Completed,
          sections: [
            {
              id: 'section-1',
              stepIndex: 1,
              heading: 'Diagnose retention',
              contentMarkdown: '[AI Generated]\n\nRetention drops after the second session.',
              aiLabel: '[AI Generated]',
              metadata: { ai_generated: true },
              createdAt: '2026-05-20T00:01:00.000Z',
            },
          ],
          metadata: {
            section_count: 1,
            last_step_index: 1,
            completed_at: '2026-05-20T00:03:00.000Z',
            outcome: 'success',
          },
        }),
      ),
      completeDraftAndSession: jest.fn().mockResolvedValue(
        createOutput({
          status: AdvisoryWorkflowOutputStatus.Completed,
          sections: [
            {
              id: 'section-1',
              stepIndex: 1,
              heading: 'Diagnose retention',
              contentMarkdown: '[AI Generated]\n\nRetention drops after the second session.',
              aiLabel: '[AI Generated]',
              metadata: { ai_generated: true },
              createdAt: '2026-05-20T00:01:00.000Z',
            },
          ],
          metadata: {
            section_count: 1,
            last_step_index: 1,
            completed_at: '2026-05-20T00:03:00.000Z',
            outcome: 'success',
          },
        }),
      ),
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
      {} as ThinkTankProviderGatewayService,
      outputRepository as never,
    )
  })

  test('[P0] gets or creates the active draft for a tenant-scoped session with AI label metadata', async () => {
    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(null)
    const createdDraft = createOutput()
    outputRepository.createDraft.mockResolvedValueOnce(createdDraft)

    const result = await service.getSessionOutput({ user, tenantId, sessionId })

    expect(result).toEqual({
      sessionId,
      output: expect.objectContaining(createdDraft),
    })
    expect(result.output.assetState).toEqual({
      outputId: createdDraft.id,
      rating: null,
      feedbackTextPresent: false,
      isFavorited: false,
      updatedAt: null,
    })
    expect(result.output.knowledgeBaseAssociation).toEqual({
      outputId: createdDraft.id,
      status: null,
      destinationKey: null,
      externalReferenceId: null,
      message: null,
      retryCount: 0,
      updatedAt: null,
      associatedAt: null,
    })

    expect(accessService.assertThinkTankModuleAvailable).toHaveBeenCalledWith(user, tenantId)
    expect(sessionRepository.findSessionById).toHaveBeenCalledWith(tenantId, sessionId)
    expect(outputRepository.createDraft).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        sessionId,
        actorId,
        workflowKey: 'problem-solving',
        status: AdvisoryWorkflowOutputStatus.Draft,
        title: 'Problem Solving Report Draft',
        contentMarkdown: '',
        sections: [],
        aiLabelMetadata: expect.objectContaining({
          visible_label: '[AI Generated]',
          ai_generated: true,
          machine_readable: true,
          source_session_id: sessionId,
          workflow_key: 'problem-solving',
        }),
      }),
    )
    expect(JSON.stringify(outputRepository.createDraft.mock.calls[0][1])).not.toMatch(
      /raw_system_prompt|system_prompt|enterprise_context/i,
    )
  })

  test('[P0] lists session outputs through tenant-scoped repository access', async () => {
    const outputs = [
      createOutput({
        id: '990e8400-e29b-41d4-a716-446655440001',
        status: AdvisoryWorkflowOutputStatus.Completed,
      }),
      createOutput(),
    ]
    outputRepository.findOutputsBySession.mockResolvedValueOnce(outputs)

    await expect(service.listSessionOutputs({ user, tenantId, sessionId })).resolves.toEqual({
      sessionId,
      outputs,
    })

    expect(sessionRepository.findSessionById).toHaveBeenCalledWith(tenantId, sessionId)
    expect(outputRepository.findOutputsBySession).toHaveBeenCalledWith(tenantId, sessionId)
  })

  test('[P0] returns the latest completed output for a completed session without creating a new draft', async () => {
    const completed = createOutput({ status: AdvisoryWorkflowOutputStatus.Completed })
    sessionRepository.findSessionById.mockResolvedValueOnce({
      ...activeSession,
      status: AdvisoryWorkflowSessionStatus.Completed,
    })
    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(null)
    outputRepository.findLatestCompletedForSession.mockResolvedValueOnce(completed)

    const result = await service.getSessionOutput({ user, tenantId, sessionId })

    expect(result).toEqual({
      sessionId,
      output: expect.objectContaining(completed),
    })
    expect(result.output.knowledgeBaseAssociation).toEqual({
      outputId: completed.id,
      status: null,
      destinationKey: null,
      externalReferenceId: null,
      message: null,
      retryCount: 0,
      updatedAt: null,
      associatedAt: null,
    })

    expect(outputRepository.createDraft).not.toHaveBeenCalled()
  })

  test('[P0] appends a completed-step section with visible label and JSON-LD style machine metadata', async () => {
    const draft = createOutput()
    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(draft)

    await service.appendOutputSection({
      user,
      tenantId,
      sessionId,
      stepIndex: 1,
      stepLabel: 'Diagnose retention',
      contentMarkdown: 'Retention drops after the second session.',
      sourceMessageId: 'assistant-message-1',
      providerMetadata: {
        provider: 'fake',
        model: 'fake-thinktank-model',
        latencyMs: 12,
        inputTokens: 10,
        outputTokens: 8,
        totalTokens: 18,
        cacheStatus: 'hit',
        cacheStrategy: 'provider-auto',
        cacheKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        cacheBypassReason: 'unsupported',
        cacheReadInputTokens: 6,
        rawPrompt: 'do not copy this prompt',
      } as never,
    })

    expect(outputRepository.appendSection).toHaveBeenCalledWith(
      tenantId,
      draft.id,
      expect.objectContaining({
        stepIndex: 1,
        heading: 'Diagnose retention',
        aiLabel: '[AI Generated]',
        contentMarkdown: expect.stringMatching(/^\[AI Generated\]/),
        metadata: expect.objectContaining({
          '@context': expect.any(String),
          '@type': expect.any(String),
          ai_generated: true,
          workflow_key: 'problem-solving',
          source_session_id: sessionId,
          source_message_id: 'assistant-message-1',
          provider: 'fake',
          model: 'fake-thinktank-model',
          cache_status: 'hit',
          cache_strategy: 'provider-auto',
          cache_key: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          cache_read_input_tokens: 6,
        }),
      }),
    )
    const section = outputRepository.appendSection.mock.calls[0][2] as unknown as Record<
      string,
      unknown
    >
    expect(JSON.stringify(section.metadata)).not.toMatch(
      /rawPrompt|system_prompt|prompt|Retention drops after the second session/i,
    )
    expect(section.metadata).not.toHaveProperty('cache_bypass_reason')
    expect(sessionRepository.updateSession).not.toHaveBeenCalledWith(
      tenantId,
      sessionId,
      expect.objectContaining({
        currentStep: expect.objectContaining({ index: 2 }),
      }),
    )
  })

  test('[P0] rejects cross-tenant output append attempts before touching output records', async () => {
    sessionRepository.findSessionById.mockResolvedValueOnce(null)

    await expect(
      service.appendOutputSection({
        user,
        tenantId,
        sessionId,
        stepIndex: 1,
        stepLabel: 'Diagnose retention',
        contentMarkdown: 'Tenant B should not see this.',
      }),
    ).rejects.toThrow(NotFoundException)

    expect(outputRepository.findActiveDraftForSession).not.toHaveBeenCalled()
    expect(outputRepository.appendSection).not.toHaveBeenCalled()
  })

  test('[P0] rejects append attempts for completed sessions and invalid source messages', async () => {
    sessionRepository.findSessionById.mockResolvedValueOnce({
      ...activeSession,
      status: AdvisoryWorkflowSessionStatus.Completed,
    })

    await expect(
      service.appendOutputSection({
        user,
        tenantId,
        sessionId,
        stepIndex: 1,
        stepLabel: 'Diagnose retention',
        contentMarkdown: 'Retention drops after the second session.',
        sourceMessageId: 'assistant-message-1',
      }),
    ).rejects.toThrow(NotFoundException)

    sessionRepository.findSessionById.mockResolvedValueOnce(activeSession)
    messageRepository.findMessageById.mockResolvedValueOnce({
      id: 'user-message-1',
      tenantId,
      sessionId,
      actorId,
      role: AdvisoryConversationMessageRole.User,
      content: 'Fake section content.',
    } as never)

    await expect(
      service.appendOutputSection({
        user,
        tenantId,
        sessionId,
        stepIndex: 1,
        stepLabel: 'Diagnose retention',
        contentMarkdown: 'Fake section content.',
        sourceMessageId: 'user-message-1',
      }),
    ).rejects.toThrow(BadRequestException)
  })

  test('[P0] completes a draft and emits thinktank.workflow.completed with privacy-safe metadata', async () => {
    const draft = createOutput({
      sections: [
        {
          id: 'section-1',
          stepIndex: 1,
          heading: 'Diagnose retention',
          contentMarkdown: '[AI Generated]\n\nRetention drops after the second session.',
          aiLabel: '[AI Generated]',
          metadata: { ai_generated: true },
          createdAt: '2026-05-20T00:01:00.000Z',
        },
      ],
      metadata: {
        section_count: 1,
        last_step_index: 1,
      },
    })
    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(draft)

    const result = await service.completeOutput({
      user,
      tenantId,
      sessionId,
      outcome: 'success',
    })

    expect(result.output.status).toBe(AdvisoryWorkflowOutputStatus.Completed)
    expect(outputRepository.completeDraftAndSession).toHaveBeenCalledWith(
      tenantId,
      draft.id,
      sessionId,
      expect.objectContaining({
        outcome: 'success',
        completedAt: expect.any(String),
        sessionMetadata: expect.objectContaining({
          output_id: draft.id,
          completed_at: expect.any(String),
        }),
      }),
    )
    expect(eventService.emitAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.WorkflowCompleted,
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.Output,
        subjectId: draft.id,
        outcome: ThinkTankEventOutcome.Success,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        optional: expect.objectContaining({
          sessionId,
          outputId: draft.id,
          workflowType: 'problem-solving',
        }),
        audit: expect.objectContaining({
          action: AuditAction.UPDATE,
          entityType: 'ThinkTankWorkflowOutput',
          entityId: draft.id,
          organizationId,
        }),
        metadata: expect.objectContaining({
          workflow_key: 'problem-solving',
          section_count: 1,
          ai_label_metadata_present: true,
        }),
      }),
    )
    const auditInput = eventService.emitAudit.mock.calls[0][0]
    expect(JSON.stringify(auditInput.metadata)).not.toMatch(
      /Retention drops|content_markdown|contentMarkdown|sections|report|document|prompt/i,
    )
  })

  test('[P0] refuses explicit completion before the workflow reaches its final step', async () => {
    sessionRepository.findSessionById.mockResolvedValueOnce({
      ...activeSession,
      currentStep: { index: 1, label: 'Diagnose retention', sourceRef: 'current-step:1' },
      metadata: { workflow_key: 'problem-solving', runtime_step_count: 9 },
    })
    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(
      createOutput({
        sections: [
          {
            id: 'section-1',
            stepIndex: 1,
            heading: 'Diagnose retention',
            contentMarkdown: '[AI Generated]\n\nRetention drops after the second session.',
            aiLabel: '[AI Generated]',
            metadata: { ai_generated: true },
            createdAt: '2026-05-20T00:01:00.000Z',
          },
        ],
      }),
    )

    await expect(
      service.completeOutput({
        user,
        tenantId,
        sessionId,
        outcome: 'success',
      }),
    ).rejects.toThrow(BadRequestException)

    expect(outputRepository.completeDraftAndSession).not.toHaveBeenCalled()
    expect(eventService.emitAudit).not.toHaveBeenCalled()
  })

  test('[P1] refuses to complete an output when required AI label metadata is missing', async () => {
    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(
      createOutput({
        aiLabelMetadata: {},
        sections: [
          {
            id: 'section-1',
            stepIndex: 1,
            heading: 'Diagnose retention',
            contentMarkdown: 'Retention drops after the second session.',
            aiLabel: '',
            metadata: {},
            createdAt: '2026-05-20T00:01:00.000Z',
          },
        ],
      }),
    )

    await expect(
      service.completeOutput({
        user,
        tenantId,
        sessionId,
        outcome: 'success',
      }),
    ).rejects.toThrow(BadRequestException)

    expect(outputRepository.markCompleted).not.toHaveBeenCalled()
    expect(outputRepository.completeDraftAndSession).not.toHaveBeenCalled()
    expect(eventService.emitAudit).not.toHaveBeenCalled()
  })

  test('[P1] refuses to complete empty drafts or invalid completion outcomes', async () => {
    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(createOutput({ sections: [] }))

    await expect(
      service.completeOutput({
        user,
        tenantId,
        sessionId,
        outcome: 'success',
      }),
    ).rejects.toThrow(BadRequestException)

    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(
      createOutput({
        sections: [
          {
            id: 'section-1',
            stepIndex: 1,
            heading: 'Diagnose retention',
            contentMarkdown: '[AI Generated]\n\nRetention drops after the second session.',
            aiLabel: '[AI Generated]',
            metadata: { ai_generated: true },
            createdAt: '2026-05-20T00:01:00.000Z',
          },
        ],
      }),
    )

    await expect(
      service.completeOutput({
        user,
        tenantId,
        sessionId,
        outcome: 'maybe',
      }),
    ).rejects.toThrow(BadRequestException)

    expect(outputRepository.completeDraftAndSession).not.toHaveBeenCalled()
  })

  test('[P1] surfaces completion audit failures instead of reporting success', async () => {
    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(
      createOutput({
        sections: [
          {
            id: 'section-1',
            stepIndex: 1,
            heading: 'Diagnose retention',
            contentMarkdown: '[AI Generated]\n\nRetention drops after the second session.',
            aiLabel: '[AI Generated]',
            metadata: { ai_generated: true },
            createdAt: '2026-05-20T00:01:00.000Z',
          },
        ],
      }),
    )
    eventService.emitAudit.mockRejectedValueOnce(new Error('audit unavailable'))

    await expect(
      service.completeOutput({
        user,
        tenantId,
        sessionId,
        outcome: 'success',
      }),
    ).rejects.toThrow('audit unavailable')
  })
})
