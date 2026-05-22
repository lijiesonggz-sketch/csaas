import { ConflictException } from '@nestjs/common'
import { AdvisoryConversationMessageRole } from '../../../database/entities/advisory-conversation-message.entity'
import {
  AdvisoryWorkflowOutput,
  AdvisoryWorkflowOutputStatus,
} from '../../../database/entities/advisory-workflow-output.entity'
import { AdvisoryWorkflowSessionStatus } from '../../../database/entities/advisory-workflow-session.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AdvisoryAccessService } from '../access/advisory-access.service'
import { AdvisoryEventService } from '../events/advisory-event.service'
import { AdvisoryWorkflowOutputRepository } from '../outputs/advisory-workflow-output.repository'
import { ThinkTankProviderGatewayService } from '../provider-gateway/thinktank-provider-gateway.service'
import { ThinkTankProviderRequest } from '../provider-gateway/thinktank-provider-gateway.types'
import { ThinkTankPromptAssemblerService } from '../runtime/prompt-assembler.service'
import { ThinkTankWorkflowRegistryService } from '../runtime/workflow-registry.service'
import { AdvisoryConversationMessageRepository } from './advisory-conversation-message.repository'
import { AdvisorySessionRepository } from './advisory-session.repository'
import { AdvisorySessionService } from './advisory-session.service'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const sessionId = '550e8400-e29b-41d4-a716-446655440000'
const outputId = '990e8400-e29b-41d4-a716-446655440000'

const user = {
  id: actorId,
  role: UserRole.CONSULTANT,
  organizationId: '880e8400-e29b-41d4-a716-446655440000',
}

const partyModeMetadata = {
  workflow_key: 'problem-solving',
  party_mode_active: true,
  party_mode_status: 'context-created',
  party_mode_context_id: `party-context:${sessionId}:message-user-party-entry`,
  party_mode_context_history_pointer: `conversation_messages:${sessionId}`,
  party_mode_problem_context_pointer: `conversation_messages:${sessionId}`,
  party_mode_context_last_message_id: 'message-user-party-entry',
  party_mode_selected_advisor_ids: 'creative-problem-solver|architect|pm',
  party_mode_selected_advisor_names: 'Dr. Quinn|Winston|John',
  party_mode_selected_advisor_roles:
    'Systematic Problem-Solving Expert|System Architect|Product Manager',
  party_mode_selected_advisor_perspectives: '系统性问题诊断|技术架构可行性|产品价值与优先级',
  party_mode_selected_advisor_source_paths:
    '_bmad/cis/agents/creative-problem-solver.md|_bmad/bmm/agents/architect.md|_bmad/bmm/agents/pm.md',
  party_mode_selected_advisor_source_hashes:
    'problem-solver-source-hash|architect-source-hash|pm-source-hash',
  party_mode_selected_advisor_reasons:
    '当前步骤需要 root cause diagnosis|补充 implementation feasibility|补充 user value and prioritization',
  party_mode_selected_advisor_role_families: 'problem-solving|technical|product',
  party_mode_output_id: outputId,
}

const activePartyModeSession = {
  id: sessionId,
  tenantId,
  actorId,
  workflowKey: 'problem-solving',
  workflowDisplayName: 'Problem Solving',
  scenarioLabel: 'Systematic diagnosis and solution design',
  status: AdvisoryWorkflowSessionStatus.Active,
  currentStep: { index: 2, label: '根因分解', sourceRef: 'workflow:problem-solving#step-2' },
  sourceRefs: ['workflow:problem-solving', 'workflow:problem-solving#step-2'],
  metadata: partyModeMetadata,
  failureCode: null,
  failureMessage: null,
  createdAt: new Date('2026-05-22T00:00:00.000Z'),
  updatedAt: new Date('2026-05-22T00:00:00.000Z'),
}

function createMessage(overrides: Record<string, unknown>) {
  return {
    id: 'message-history-1',
    tenantId,
    sessionId,
    actorId,
    role: AdvisoryConversationMessageRole.User,
    content: 'We need to decide whether retention loss is onboarding or pricing.',
    sequence: 1,
    workflowKey: 'problem-solving',
    stepIndex: 2,
    decisionOptions: [],
    metadata: { workflow_key: 'problem-solving', step_index: 2 },
    providerMetadata: {},
    createdAt: new Date('2026-05-22T00:00:00.000Z'),
    updatedAt: new Date('2026-05-22T00:00:00.000Z'),
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
    title: 'Problem Solving Report Draft',
    summary: 'Live report draft for the problem-solving workflow.',
    contentMarkdown: '# Problem Solving Report Draft',
    sections: [],
    aiLabelMetadata: {
      visible_label: '[AI Generated]',
      ai_generated: true,
      machine_readable: true,
      source_session_id: sessionId,
      workflow_key: 'problem-solving',
      generated_at: '2026-05-22T00:00:00.000Z',
    },
    metadata: {
      section_count: 0,
      last_step_index: null,
    },
    createdAt: new Date('2026-05-22T00:00:00.000Z'),
    updatedAt: new Date('2026-05-22T00:00:00.000Z'),
    ...overrides,
  }
}

describe('Story 5.4 ATDD - Party Mode differentiated frameworks and integrated conclusion', () => {
  let accessService: jest.Mocked<Pick<AdvisoryAccessService, 'assertThinkTankModuleAvailable'>>
  let sessionRepository: jest.Mocked<
    Pick<
      AdvisorySessionRepository,
      | 'findSessionById'
      | 'claimPartyModeReturn'
      | 'finalizePartyModeReturn'
      | 'rollbackPartyModeReturn'
    >
  >
  let messageRepository: jest.Mocked<
    Pick<
      AdvisoryConversationMessageRepository,
      | 'findMessagesBySession'
      | 'findMessageById'
      | 'createMessageWithNextSequence'
      | 'deleteMessage'
    >
  >
  let outputRepository: jest.Mocked<
    Pick<
      AdvisoryWorkflowOutputRepository,
      'findActiveDraftForSession' | 'findLatestCompletedForSession' | 'createDraft' | 'appendSection'
    >
  >
  let providerGateway: jest.Mocked<Pick<ThinkTankProviderGatewayService, 'stream'>>
  let service: AdvisorySessionService

  beforeEach(() => {
    accessService = { assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined) }
    sessionRepository = {
      findSessionById: jest.fn().mockResolvedValue(activePartyModeSession),
      claimPartyModeReturn: jest.fn().mockResolvedValue({
        ...activePartyModeSession,
        metadata: { ...partyModeMetadata, party_mode_status: 'returning' },
      }),
      finalizePartyModeReturn: jest.fn().mockResolvedValue({
        ...activePartyModeSession,
        metadata: { ...partyModeMetadata, party_mode_active: false, party_mode_status: 'returned' },
      }),
      rollbackPartyModeReturn: jest.fn().mockResolvedValue(undefined),
    }
    messageRepository = {
      findMessagesBySession: jest.fn().mockResolvedValue([
        createMessage({ id: 'message-user-party-entry', sequence: 1 }),
        createMessage({
          id: 'message-assistant-party-intro',
          role: AdvisoryConversationMessageRole.Assistant,
          content: 'Party Mode 上下文已创建。Dr. Quinn、Winston、John 将加入。',
          sequence: 2,
          metadata: { ai_generated: true, party_mode_started: true },
          decisionOptions: [
            { key: 'return-to-workflow', action: 'return-to-workflow', label: '返回工作流', enabled: true },
          ],
        }),
      ]),
      findMessageById: jest.fn(),
      createMessageWithNextSequence: jest.fn(async (_tenant, _session, input) =>
        createMessage({
          id: `message-${input.role}-${messageRepository.createMessageWithNextSequence.mock.calls.length}`,
          role: input.role,
          content: input.content,
          sequence: messageRepository.createMessageWithNextSequence.mock.calls.length,
          workflowKey: input.workflowKey,
          stepIndex: input.stepIndex,
          decisionOptions: input.decisionOptions ?? [],
          metadata: input.metadata ?? {},
          providerMetadata: input.providerMetadata ?? {},
        }) as never,
      ),
      deleteMessage: jest.fn().mockResolvedValue(true),
    }
    outputRepository = {
      findActiveDraftForSession: jest.fn().mockResolvedValue(createOutput()),
      findLatestCompletedForSession: jest.fn().mockResolvedValue(null),
      createDraft: jest.fn().mockResolvedValue(createOutput()),
      appendSection: jest.fn().mockImplementation(async (_tenant, _outputId, section) =>
        createOutput({
          sections: [section],
          contentMarkdown: `# Problem Solving Report Draft\n\n## ${section.heading}\n\n${section.contentMarkdown}`,
          metadata: { section_count: 1, last_step_index: section.stepIndex },
        }),
      ),
    }
    providerGateway = {
      stream: jest.fn(async function* (input: ThinkTankProviderRequest) {
        if (input.metadata?.party_mode_integration === true) {
          yield {
            index: 0,
            delta:
              'Consensus: onboarding is the primary retention blocker.\nDisagreements: pricing remains a secondary risk.\nRisks: roadmap distraction.\nNext steps: test guided setup this week.',
            done: true,
            provider: 'fake' as const,
            model: 'fake-thinktank-model',
            finishReason: 'stop',
          }
          return
        }
        const advisorId = String(input.metadata?.party_mode_advisor_id ?? 'advisor')
        yield {
          index: 0,
          delta: `Advisor ${advisorId} applies a distinct lens to retention.`,
          done: true,
          provider: 'fake' as const,
          model: 'fake-thinktank-model',
          finishReason: 'stop',
        }
      }),
    }
    service = new AdvisorySessionService(
      accessService as never,
      { discoverWorkflows: jest.fn(), findWorkflow: jest.fn() } as unknown as ThinkTankWorkflowRegistryService,
      { assemblePrompt: jest.fn() } as unknown as ThinkTankPromptAssemblerService,
      sessionRepository as never,
      { emitAudit: jest.fn(), emitTelemetry: jest.fn() } as unknown as AdvisoryEventService,
      messageRepository as never,
      providerGateway as never,
      outputRepository as never,
    )
  })

  test('[P0][5.4-BE-001][AC1] assigns differentiated frameworks to advisor prompts and message metadata', async () => {
    await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Please challenge the retention decision from different frameworks.',
    } as never)

    const providerCalls = providerGateway.stream.mock.calls.map((call) => call[0])
    const advisorProviderCalls = providerCalls.filter((input) => input.metadata?.party_mode_message === true)
    expect(advisorProviderCalls).toHaveLength(3)
    expect(
      new Set(advisorProviderCalls.map((input) => input.metadata?.party_mode_analysis_framework)),
    ).toEqual(
      new Set([
        'Root cause decomposition',
        'Technical feasibility and architecture',
        'Product value and prioritization',
      ]),
    )
    expect(advisorProviderCalls.map((input) => input.system)).toEqual([
      expect.stringContaining('Analysis framework: Root cause decomposition'),
      expect.stringContaining('Analysis framework: Technical feasibility and architecture'),
      expect.stringContaining('Analysis framework: Product value and prioritization'),
    ])

    const advisorMessageInputs = messageRepository.createMessageWithNextSequence.mock.calls.slice(1)
    expect(advisorMessageInputs.map((call) => call[2].metadata)).toEqual([
      expect.objectContaining({ party_mode_analysis_framework: 'Root cause decomposition' }),
      expect.objectContaining({ party_mode_analysis_framework: 'Technical feasibility and architecture' }),
      expect.objectContaining({ party_mode_analysis_framework: 'Product value and prioritization' }),
    ])
    expect(advisorMessageInputs.at(-1)?.[2].decisionOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'integrate-party-mode', enabled: true }),
        expect.objectContaining({ action: 'return-to-workflow', enabled: true }),
      ]),
    )
  })

  test('[P0][5.4-BE-005][AC1] keeps frameworks differentiated when advisors share the same role family', async () => {
    sessionRepository.findSessionById.mockResolvedValueOnce({
      ...activePartyModeSession,
      metadata: {
        ...partyModeMetadata,
        party_mode_selected_advisor_ids: 'architect-1|architect-2|architect-3',
        party_mode_selected_advisor_names: 'Winston|Ada|Linus',
        party_mode_selected_advisor_roles: 'System Architect|Technical Architect|Engineering Architect',
        party_mode_selected_advisor_perspectives: '技术架构|技术实现|系统设计',
        party_mode_selected_advisor_role_families: 'technical|technical|technical',
      },
    } as never)

    await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Please challenge this from non-overlapping frameworks.',
    } as never)

    const advisorProviderCalls = providerGateway.stream.mock.calls
      .map((call) => call[0])
      .filter((input) => input.metadata?.party_mode_message === true)
    const frameworks = advisorProviderCalls.map(
      (input) => input.metadata?.party_mode_analysis_framework,
    )
    expect(new Set(frameworks).size).toBe(3)
    expect(JSON.stringify(messageRepository.createMessageWithNextSequence.mock.calls)).not.toContain(
      'party_mode_framework_instruction',
    )
  })

  test('[P0][5.4-BE-002][AC2] creates an AI-labeled integrated conclusion from Party Mode viewpoints', async () => {
    messageRepository.findMessagesBySession.mockResolvedValue([
      createMessage({ id: 'message-user-party-entry', sequence: 1 }),
      createMessage({
        id: 'message-advisor-1',
        role: AdvisoryConversationMessageRole.Assistant,
        content: 'Root cause lens: onboarding is weak.',
        sequence: 2,
        metadata: {
          party_mode_message: true,
          party_mode_round: 1,
          party_mode_advisor_id: 'creative-problem-solver',
          party_mode_analysis_framework: 'Root cause decomposition',
        },
      }),
      createMessage({
        id: 'message-advisor-2',
        role: AdvisoryConversationMessageRole.Assistant,
        content: 'Technical lens: instrumentation is feasible.',
        sequence: 3,
        metadata: {
          party_mode_message: true,
          party_mode_round: 1,
          party_mode_advisor_id: 'architect',
          party_mode_analysis_framework: 'Technical feasibility and architecture',
        },
      }),
      createMessage({
        id: 'message-advisor-3',
        role: AdvisoryConversationMessageRole.Assistant,
        content: 'Product lens: pricing is a secondary risk.',
        sequence: 4,
        metadata: {
          party_mode_message: true,
          party_mode_round: 1,
          party_mode_advisor_id: 'pm',
          party_mode_analysis_framework: 'Product value and prioritization',
        },
        decisionOptions: [
          { key: 'integrate-party-mode', action: 'integrate-party-mode', label: '进入观点整合', enabled: true },
          { key: 'return-to-workflow', action: 'return-to-workflow', label: '返回工作流', enabled: true },
        ],
      }),
    ])

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: '进入观点整合',
      decisionAction: 'integrate-party-mode',
    } as never)

    const integrationProviderCall = providerGateway.stream.mock.calls[0][0]
    expect(integrationProviderCall.metadata).toEqual(
      expect.objectContaining({
        party_mode_integration: true,
        party_mode_source_round: 1,
      }),
    )
    expect(integrationProviderCall.system).toEqual(expect.stringContaining('consensus'))
    expect(integrationProviderCall.system).toEqual(expect.stringContaining('disagreements'))
    expect(integrationProviderCall.system).toEqual(expect.stringContaining('risks'))
    expect(integrationProviderCall.system).toEqual(expect.stringContaining('recommended next steps'))

    expect(result.assistantMessage).toEqual(
      expect.objectContaining({
        role: AdvisoryConversationMessageRole.Assistant,
        content: expect.stringContaining('Consensus: onboarding is the primary retention blocker.'),
        decisionOptions: expect.arrayContaining([
          expect.objectContaining({ action: 'accept-party-mode-conclusion', enabled: true }),
          expect.objectContaining({ action: 'return-to-workflow', enabled: true }),
        ]),
        metadata: expect.objectContaining({
          ai_generated: true,
          party_mode_integration: true,
          party_mode_integration_status: 'draft',
          ai_label_visible: '[AI Generated]',
          party_mode_source_round: 1,
          party_mode_source_message_ids: expect.stringContaining('message-advisor-3'),
          party_mode_frameworks: expect.stringContaining('Root cause decomposition'),
        }),
      }),
    )
    expect(JSON.stringify(result.assistantMessage.metadata)).not.toContain('_bmad/bmm/agents')
  })

  test('[P0][5.4-BE-006][AC2] streams integration started and delta events before completion', async () => {
    messageRepository.findMessagesBySession.mockResolvedValue([
      createMessage({ id: 'message-user-party-entry', sequence: 1 }),
      createMessage({
        id: 'message-advisor-1',
        role: AdvisoryConversationMessageRole.Assistant,
        content: 'Root cause lens: onboarding is weak.',
        sequence: 2,
        metadata: {
          party_mode_message: true,
          party_mode_round: 1,
          party_mode_advisor_id: 'creative-problem-solver',
          party_mode_analysis_framework: 'Root cause decomposition',
        },
      }),
      createMessage({
        id: 'message-advisor-2',
        role: AdvisoryConversationMessageRole.Assistant,
        content: 'Technical lens: instrumentation is feasible.',
        sequence: 3,
        metadata: {
          party_mode_message: true,
          party_mode_round: 1,
          party_mode_advisor_id: 'architect',
          party_mode_analysis_framework: 'Technical feasibility and architecture',
        },
      }),
      createMessage({
        id: 'message-advisor-3',
        role: AdvisoryConversationMessageRole.Assistant,
        content: 'Product lens: pricing is a secondary risk.',
        sequence: 4,
        metadata: {
          party_mode_message: true,
          party_mode_round: 1,
          party_mode_advisor_id: 'pm',
          party_mode_analysis_framework: 'Product value and prioritization',
        },
        decisionOptions: [
          { key: 'integrate-party-mode', action: 'integrate-party-mode', label: '进入观点整合', enabled: true },
          { key: 'return-to-workflow', action: 'return-to-workflow', label: '返回工作流', enabled: true },
        ],
      }),
    ])

    const events = []
    for await (const event of service.streamMessage({
      user,
      tenantId,
      sessionId,
      content: '进入观点整合',
      decisionAction: 'integrate-party-mode',
      addressedMessageId: 'message-advisor-3',
    } as never)) {
      events.push(event)
    }

    expect(events.map((event) => event.event)).toEqual([
      'message.started',
      'message.delta',
      'message.completed',
    ])
    expect(events[1]).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          delta: expect.stringContaining('Consensus: onboarding'),
        }),
      }),
    )
  })

  test('[P0][5.4-BE-003][AC3] accepts the integrated conclusion, appends it to the report draft, and returns to workflow', async () => {
    const integrationMessage = createMessage({
      id: 'message-integration-1',
      role: AdvisoryConversationMessageRole.Assistant,
      content: 'Consensus: onboarding is the primary retention blocker.',
      sequence: 5,
      metadata: {
        ai_generated: true,
        party_mode_integration: true,
        party_mode_integration_status: 'draft',
        party_mode_source_round: 1,
        ai_label_visible: '[AI Generated]',
      },
      providerMetadata: { provider: 'fake', model: 'fake-thinktank-model' },
      decisionOptions: [
        {
          key: 'accept-party-mode-conclusion',
          action: 'accept-party-mode-conclusion',
          label: '接受整合结论',
          enabled: true,
        },
        { key: 'return-to-workflow', action: 'return-to-workflow', label: '返回工作流', enabled: true },
      ],
    })
    messageRepository.findMessagesBySession.mockResolvedValue([
      createMessage({ id: 'message-user-party-entry', sequence: 1 }),
      integrationMessage,
    ])
    messageRepository.findMessageById.mockResolvedValue(integrationMessage as never)

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: '接受整合结论',
      decisionAction: 'accept-party-mode-conclusion',
    } as never)

    expect(outputRepository.appendSection).toHaveBeenCalledWith(
      tenantId,
      outputId,
      expect.objectContaining({
        heading: '根因分解 - Party Mode 整合结论',
        contentMarkdown: expect.stringMatching(/^\[AI Generated\]\n\nConsensus: onboarding/),
        metadata: expect.objectContaining({
          ai_generated: true,
          source_message_id: 'message-integration-1',
          step_label: '根因分解 - Party Mode 整合结论',
          provider: 'fake',
          model: 'fake-thinktank-model',
        }),
      }),
    )
    expect(sessionRepository.claimPartyModeReturn).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      actorId,
      expect.objectContaining({ party_mode_status: 'returning' }),
    )
    expect(sessionRepository.finalizePartyModeReturn).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      actorId,
      expect.objectContaining({
        party_mode_active: false,
        party_mode_status: 'returned',
        party_mode_integrated_conclusion_message_id: 'message-integration-1',
        party_mode_output_id: outputId,
      }),
    )
    expect(result.assistantMessage).toEqual(
      expect.objectContaining({
        content: expect.stringContaining('已返回原工作流'),
        metadata: expect.objectContaining({
          party_mode_returned: true,
          decision_action: 'accept-party-mode-conclusion',
          party_mode_integrated_conclusion_accepted: true,
        }),
      }),
    )
  })

  test('[P0][5.4-BE-007][AC3] accepts conclusion idempotently when the output section was already appended', async () => {
    const integrationMessage = createMessage({
      id: 'message-integration-1',
      role: AdvisoryConversationMessageRole.Assistant,
      content: 'Consensus: onboarding is the primary retention blocker.',
      sequence: 5,
      metadata: {
        ai_generated: true,
        party_mode_integration: true,
        party_mode_integration_status: 'draft',
        party_mode_source_round: 1,
        ai_label_visible: '[AI Generated]',
      },
      providerMetadata: { provider: 'fake', model: 'fake-thinktank-model' },
      decisionOptions: [
        {
          key: 'accept-party-mode-conclusion',
          action: 'accept-party-mode-conclusion',
          label: '接受整合结论',
          enabled: true,
        },
      ],
    })
    messageRepository.findMessagesBySession.mockResolvedValue([
      createMessage({ id: 'message-user-party-entry', sequence: 1 }),
      integrationMessage,
    ])
    messageRepository.findMessageById.mockResolvedValue(integrationMessage as never)
    outputRepository.findActiveDraftForSession.mockResolvedValueOnce(
      createOutput({
        sections: [
          {
            id: 'section-existing',
            stepIndex: 2,
            heading: '根因分解 - Party Mode 整合结论',
            contentMarkdown: '[AI Generated]\n\nConsensus: onboarding is the primary retention blocker.',
            aiLabel: '[AI Generated]',
            metadata: { source_message_id: 'message-integration-1' },
            createdAt: '2026-05-22T00:00:00.000Z',
          },
        ],
      }),
    )

    await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: '接受整合结论',
      decisionAction: 'accept-party-mode-conclusion',
      addressedMessageId: 'message-integration-1',
    } as never)

    expect(outputRepository.appendSection).not.toHaveBeenCalled()
    expect(sessionRepository.finalizePartyModeReturn).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      actorId,
      expect.objectContaining({
        party_mode_integrated_conclusion_message_id: 'message-integration-1',
        party_mode_output_id: outputId,
      }),
    )
  })

  test('[P0][5.4-BE-004][AC2,AC3] rejects stale integration actions before persistence, provider calls, or report append', async () => {
    await expect(
      service.submitMessage({
        user,
        tenantId,
        sessionId,
        content: '接受整合结论',
        decisionAction: 'accept-party-mode-conclusion',
      } as never),
    ).rejects.toThrow(ConflictException)

    expect(messageRepository.createMessageWithNextSequence).not.toHaveBeenCalled()
    expect(providerGateway.stream).not.toHaveBeenCalled()
    expect(outputRepository.appendSection).not.toHaveBeenCalled()
    expect(sessionRepository.claimPartyModeReturn).not.toHaveBeenCalled()
  })
})
