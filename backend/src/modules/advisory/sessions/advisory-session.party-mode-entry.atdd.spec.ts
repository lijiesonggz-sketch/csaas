import { ConflictException, NotFoundException } from '@nestjs/common'
import { AdvisoryConversationMessageRole } from '../../../database/entities/advisory-conversation-message.entity'
import { AdvisoryWorkflowOutputStatus } from '../../../database/entities/advisory-workflow-output.entity'
import { AdvisoryWorkflowSessionStatus } from '../../../database/entities/advisory-workflow-session.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AdvisoryAccessService } from '../access/advisory-access.service'
import { AdvisoryEventService } from '../events/advisory-event.service'
import { AdvisoryCheckpointService } from '../checkpoints/advisory-checkpoint.service'
import { ThinkTankProviderGatewayService } from '../provider-gateway/thinktank-provider-gateway.service'
import { ThinkTankProviderStreamChunk } from '../provider-gateway/thinktank-provider-gateway.types'
import { ThinkTankPartyModeAdvisorPersonaService } from '../runtime/party-mode-advisor-persona.service'
import { ThinkTankPromptAssemblerService } from '../runtime/prompt-assembler.service'
import { ThinkTankWorkflowRegistryService } from '../runtime/workflow-registry.service'
import { AdvisoryWorkflowOutputRepository } from '../outputs/advisory-workflow-output.repository'
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
  currentStep: { index: 2, label: '根因分解', sourceRef: 'workflow:problem-solving#step-2' },
  sourceRefs: ['workflow:problem-solving', 'workflow:problem-solving#step-2'],
  metadata: { workflow_key: 'problem-solving', source_ref_count: 2, title: 'Retention problem' },
  failureCode: null,
  failureMessage: null,
  createdAt: new Date('2026-05-22T00:00:00.000Z'),
  updatedAt: new Date('2026-05-22T00:00:00.000Z'),
}

const draftOutput = {
  id: 'output-party-entry',
  tenantId,
  sessionId,
  actorId,
  workflowKey: 'problem-solving',
  status: AdvisoryWorkflowOutputStatus.Draft,
  title: 'Problem Solving 决策报告草稿',
  summary: '阶段性报告草稿。',
  contentMarkdown: '## 1. 背景\n\n已有报告内容。',
  sections: [
    {
      id: 'section-1',
      stepIndex: 1,
      heading: '1. 背景',
      contentMarkdown: '已有报告内容。',
      aiLabel: '[AI Generated]' as const,
      metadata: { workflowKey: 'problem-solving', stepLabel: '背景' },
      createdAt: '2026-05-22T00:00:00.000Z',
    },
  ],
  aiLabelMetadata: {
    label: 'AI Generated',
    visibleLabel: '[AI Generated]',
    generator: 'ThinkTank',
    provider: 'fake',
    model: 'fake-thinktank-model',
    generatedAt: '2026-05-22T00:00:00.000Z',
    workflowKey: 'problem-solving',
    sessionId,
  },
  metadata: { section_count: 1, last_step_index: 1 },
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

describe('Story 5.1 ATDD - Party Mode entry from workflow', () => {
  let originalEnv: NodeJS.ProcessEnv
  let accessService: jest.Mocked<Pick<AdvisoryAccessService, 'assertThinkTankModuleAvailable'>>
  let sessionRepository: jest.Mocked<
    Pick<
      AdvisorySessionRepository,
      | 'findSessionById'
      | 'updateSession'
      | 'claimPartyModeStart'
      | 'finalizePartyModeStart'
      | 'rollbackPartyModeStart'
      | 'claimPartyModeReturn'
      | 'finalizePartyModeReturn'
      | 'rollbackPartyModeReturn'
    >
  >
  let messageRepository: jest.Mocked<
    Pick<
      AdvisoryConversationMessageRepository,
      'findMessagesBySession' | 'createMessageWithNextSequence' | 'deleteMessage'
    >
  >
  let providerGateway: jest.Mocked<Pick<ThinkTankProviderGatewayService, 'stream'>>
  let outputRepository: jest.Mocked<
    Pick<
      AdvisoryWorkflowOutputRepository,
      'findActiveDraftForSession' | 'findLatestCompletedForSession'
    >
  >
  let eventService: jest.Mocked<Pick<AdvisoryEventService, 'emitAudit' | 'emitTelemetry'>>
  let checkpointService: jest.Mocked<Pick<AdvisoryCheckpointService, 'saveCheckpoint'>>
  let partyModeAdvisorPersonas: jest.Mocked<
    Pick<ThinkTankPartyModeAdvisorPersonaService, 'selectAdvisors'>
  >
  let service: AdvisorySessionService

  beforeEach(() => {
    originalEnv = { ...process.env }
    accessService = {
      assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
    }
    sessionRepository = {
      findSessionById: jest.fn().mockResolvedValue(activeSession),
      claimPartyModeStart: jest.fn(
        async (_tenantId, _sessionId, _actorId, metadata) =>
          ({
            ...activeSession,
            metadata: {
              ...activeSession.metadata,
              ...metadata,
            },
          }) as never,
      ),
      finalizePartyModeStart: jest.fn(
        async (_tenantId, _sessionId, _actorId, metadata) =>
          ({
            ...activeSession,
            metadata: {
              ...activeSession.metadata,
              party_mode_active: true,
              party_mode_status: 'starting',
              ...metadata,
            },
          }) as never,
      ),
      rollbackPartyModeStart: jest.fn().mockResolvedValue(true),
      claimPartyModeReturn: jest.fn(
        async (_tenantId, _sessionId, _actorId, metadata) =>
          ({
            ...activeSession,
            metadata: {
              ...activeSession.metadata,
              party_mode_active: true,
              party_mode_status: 'returning',
              ...metadata,
            },
          }) as never,
      ),
      finalizePartyModeReturn: jest.fn(
        async (_tenantId, _sessionId, _actorId, metadata) =>
          ({
            ...activeSession,
            metadata: {
              ...activeSession.metadata,
              party_mode_active: true,
              party_mode_status: 'returning',
              ...metadata,
            },
          }) as never,
      ),
      rollbackPartyModeReturn: jest.fn().mockResolvedValue(true),
      updateSession: jest.fn(
        async (_tenantId, _sessionId, input) =>
          ({
            ...activeSession,
            ...input,
            metadata: input.metadata ?? activeSession.metadata,
          }) as never,
      ),
    }
    messageRepository = {
      findMessagesBySession: jest.fn().mockResolvedValue([
        createMessage({ id: 'message-user-previous', sequence: 1 }),
        createMessage({
          id: 'message-assistant-previous',
          role: AdvisoryConversationMessageRole.Assistant,
          content: 'We should inspect onboarding friction first.',
          sequence: 2,
          decisionOptions: [
            {
              key: 'party-mode',
              action: 'party-mode',
              label: 'Party Mode',
              shortcut: 'P',
              enabled: true,
              description: '启动多角色顾问讨论',
            },
          ],
        }),
      ]),
      createMessageWithNextSequence: jest.fn(
        async (_tenantId, _sessionId, input) =>
          createMessage({
            id:
              input.role === AdvisoryConversationMessageRole.User
                ? 'message-user-party-entry'
                : 'message-assistant-party-entry',
            role: input.role,
            content: input.content,
            sequence: input.role === AdvisoryConversationMessageRole.User ? 3 : 4,
            workflowKey: input.workflowKey,
            stepIndex: input.stepIndex,
            decisionOptions: input.decisionOptions ?? [],
            metadata: input.metadata ?? {},
            providerMetadata: input.providerMetadata ?? {},
          }) as never,
      ),
      deleteMessage: jest.fn().mockResolvedValue(true),
    }
    providerGateway = {
      stream: jest.fn(
        async function* (input, signal?): AsyncIterable<ThinkTankProviderStreamChunk> {
          void input
          void signal
          yield {
            index: 0,
            delta: 'Single advisor response.',
            done: true,
            provider: 'fake',
            model: 'fake-thinktank-model',
          }
        },
      ),
    }
    outputRepository = {
      findActiveDraftForSession: jest.fn().mockResolvedValue(draftOutput),
      findLatestCompletedForSession: jest.fn().mockResolvedValue(null),
    }
    eventService = {
      emitAudit: jest.fn().mockResolvedValue(undefined),
      emitTelemetry: jest.fn().mockResolvedValue(undefined),
    }
    checkpointService = {
      saveCheckpoint: jest.fn().mockResolvedValue({}),
    }
    partyModeAdvisorPersonas = {
      selectAdvisors: jest.fn().mockResolvedValue({
        advisors: [
          {
            id: 'creative-problem-solver',
            displayName: 'Dr. Quinn',
            role: 'Systematic Problem-Solving Expert',
            identity: 'Systems problem solver',
            communicationStyle: 'Deductive',
            principles: 'Find root causes',
            capabilities: ['TRIZ', 'root cause analysis'],
            module: 'cis',
            sourcePath: '_bmad/cis/agents/creative-problem-solver.md',
            sourceHash: 'problem-solver-source-hash',
            perspective: '系统性问题诊断',
            roleFamily: 'problem-solving',
            selectionReason: '当前步骤需要 root cause diagnosis',
          },
          {
            id: 'architect',
            displayName: 'Winston',
            role: 'System Architect',
            identity: 'Technical architect',
            communicationStyle: 'Calm',
            principles: 'Design simple solutions',
            capabilities: ['distributed systems', 'API design'],
            module: 'bmm',
            sourcePath: '_bmad/bmm/agents/architect.md',
            sourceHash: 'architect-source-hash',
            perspective: '技术架构可行性',
            roleFamily: 'technical',
            selectionReason: '补充 implementation feasibility',
          },
          {
            id: 'pm',
            displayName: 'John',
            role: 'Product Manager',
            identity: 'Product veteran',
            communicationStyle: 'Asks why',
            principles: 'User value first',
            capabilities: ['PRD creation', 'stakeholder alignment'],
            module: 'bmm',
            sourcePath: '_bmad/bmm/agents/pm.md',
            sourceHash: 'pm-source-hash',
            perspective: '产品价值与优先级',
            roleFamily: 'product',
            selectionReason: '补充 user value and prioritization',
          },
        ],
        omittedAdvisors: [],
        visibleSummary:
          'Party Mode 上下文已创建。3 位 ThinkTank 顾问将加入：Dr. Quinn（系统性问题诊断）、Winston（技术架构可行性）、John（产品价值与优先级）。',
        metadata: {
          party_mode_advisor_count: 3,
          party_mode_selected_advisor_ids: 'creative-problem-solver|architect|pm',
          party_mode_selected_advisor_names: 'Dr. Quinn|Winston|John',
          party_mode_selected_advisor_roles:
            'Systematic Problem-Solving Expert|System Architect|Product Manager',
          party_mode_selected_advisor_perspectives:
            '系统性问题诊断|技术架构可行性|产品价值与优先级',
          party_mode_selected_advisor_source_paths:
            '_bmad/cis/agents/creative-problem-solver.md|_bmad/bmm/agents/architect.md|_bmad/bmm/agents/pm.md',
          party_mode_selected_advisor_source_hashes:
            'problem-solver-source-hash|architect-source-hash|pm-source-hash',
          party_mode_selected_advisor_reasons:
            '当前步骤需要 root cause diagnosis|补充 implementation feasibility|补充 user value and prioritization',
          party_mode_omitted_advisor_count: 0,
          party_mode_omitted_advisors: null,
          party_mode_omission_reasons: null,
          party_mode_status: 'hacked-by-advisor-metadata',
          party_mode_context_id: 'hacked-by-advisor-metadata',
        },
      }),
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
      providerGateway as never,
      outputRepository as never,
      undefined,
      undefined,
      undefined,
      checkpointService as never,
      undefined,
      undefined,
      undefined,
      undefined,
      partyModeAdvisorPersonas as never,
    )
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('[P0] exposes Party Mode globally when no feature flag or tenant allowlist is configured', async () => {
    delete process.env.THINKTANK_PARTY_MODE_ENABLED
    delete process.env.THINKTANK_PARTY_MODE_TENANTS

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'What should we do next?',
    })

    expect(result.decisionOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'party-mode',
          shortcut: 'P',
          enabled: true,
          description: expect.stringContaining('多角色'),
        }),
      ]),
    )
  })

  test('[P0][5.1-BE-001][AC1,AC2] honors explicit Party Mode feature flag and tenant allowlist configuration', async () => {
    process.env.THINKTANK_PARTY_MODE_ENABLED = 'true'
    process.env.THINKTANK_PARTY_MODE_TENANTS = tenantId

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'What should we do next?',
    })

    expect(result.decisionOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'party-mode',
          shortcut: 'P',
          enabled: true,
          description: expect.stringContaining('多角色'),
        }),
      ]),
    )
    expect(result.decisionOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'continue', enabled: true }),
        expect.objectContaining({ action: 'deepen', enabled: true }),
      ]),
    )
  })

  test('[P0] keeps Party Mode unavailable when the global feature flag is explicitly disabled', async () => {
    process.env.THINKTANK_PARTY_MODE_ENABLED = 'false'
    process.env.THINKTANK_PARTY_MODE_TENANTS = '*'

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Continue with the normal advisor.',
    })

    expect(result.decisionOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'party-mode',
          enabled: false,
          description: expect.stringContaining('未启用'),
        }),
      ]),
    )
    expect(providerGateway.stream).toHaveBeenCalled()
  })

  test('[P0][5.1-BE-002][AC2] keeps Party Mode unavailable when tenant configuration disables it while single-advisor actions work', async () => {
    process.env.THINKTANK_PARTY_MODE_ENABLED = 'true'
    process.env.THINKTANK_PARTY_MODE_TENANTS = '00000000-0000-4000-8000-000000000000'

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Continue with the normal advisor.',
    })

    expect(result.decisionOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'party-mode',
          enabled: false,
          description: expect.stringContaining('未启用'),
        }),
        expect.objectContaining({ action: 'continue', enabled: true }),
        expect.objectContaining({ action: 'deepen', enabled: true }),
        expect.objectContaining({ action: 'revise', enabled: true }),
      ]),
    )
    expect(providerGateway.stream).toHaveBeenCalled()
  })

  test('[P0][5.1-BE-003][AC3] starts Party Mode from decisionAction and stores sanitized return context without calling provider', async () => {
    process.env.THINKTANK_PARTY_MODE_ENABLED = 'true'
    process.env.THINKTANK_PARTY_MODE_TENANTS = tenantId

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: '启动 Party Mode',
      decisionAction: 'party-mode',
    })

    expect(providerGateway.stream).not.toHaveBeenCalled()
    expect(sessionRepository.claimPartyModeStart).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      actorId,
      expect.objectContaining({
        party_mode_active: true,
        party_mode_status: 'starting',
      }),
    )
    expect(sessionRepository.finalizePartyModeStart).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      actorId,
      expect.objectContaining({
        party_mode_active: true,
        party_mode_status: 'context-created',
        party_mode_context_id: `party-context:${sessionId}:message-user-party-entry`,
        party_mode_session_id: `party-context:${sessionId}:message-user-party-entry`,
        party_mode_origin_workflow_key: 'problem-solving',
        party_mode_origin_step_index: 2,
        party_mode_origin_step_label: '根因分解',
        party_mode_context_message_count: 3,
        party_mode_context_last_message_id: 'message-user-party-entry',
        party_mode_problem_source: 'conversation',
        party_mode_problem_context_pointer: `conversation_messages:${sessionId}`,
        party_mode_output_id: draftOutput.id,
        party_mode_output_section_count: 1,
      }),
    )
    expect(sessionRepository.updateSession).not.toHaveBeenCalled()
    expect(checkpointService.saveCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        actorId,
        sessionId,
        metadata: expect.objectContaining({
          checkpoint_source: 'advisory_session_service',
          party_mode_active: true,
          party_mode_status: 'context-created',
          party_mode_context_id: `party-context:${sessionId}:message-user-party-entry`,
          party_mode_problem_context_pointer: `conversation_messages:${sessionId}`,
        }),
      }),
    )
    expect(
      JSON.stringify(checkpointService.saveCheckpoint.mock.calls[0][0].metadata),
    ).not.toContain('We need to decide')
    expect(result.assistantMessage.content).toContain('Party Mode')
    expect(result.assistantMessage.metadata).toEqual(
      expect.objectContaining({
        ai_generated: true,
        party_mode_started: true,
        decision_action: 'party-mode',
      }),
    )
    expect(JSON.stringify(result.assistantMessage.providerMetadata)).not.toContain(
      'We need to decide',
    )
  })

  test('[P0] starts Party Mode from the latest enabled P shortcut when decisionAction is omitted', async () => {
    process.env.THINKTANK_PARTY_MODE_ENABLED = 'true'
    process.env.THINKTANK_PARTY_MODE_TENANTS = tenantId

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'P',
    })

    expect(providerGateway.stream).not.toHaveBeenCalled()
    expect(sessionRepository.claimPartyModeStart).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      actorId,
      expect.objectContaining({
        party_mode_active: true,
        party_mode_status: 'starting',
      }),
    )
    expect(result.assistantMessage.metadata).toEqual(
      expect.objectContaining({
        party_mode_started: true,
        decision_action: 'party-mode',
      }),
    )
  })

  test('[P0][5.1-BE-005][AC1,AC2] rejects forged or disabled Party Mode actions before persisting workflow history', async () => {
    process.env.THINKTANK_PARTY_MODE_ENABLED = 'true'
    process.env.THINKTANK_PARTY_MODE_TENANTS = tenantId
    messageRepository.findMessagesBySession.mockResolvedValueOnce([
      createMessage({ id: 'message-user-previous', sequence: 1 }),
      createMessage({
        id: 'message-assistant-disabled-party',
        role: AdvisoryConversationMessageRole.Assistant,
        sequence: 2,
        decisionOptions: [
          {
            key: 'party-mode',
            action: 'party-mode',
            label: 'Party Mode',
            shortcut: 'P',
            enabled: false,
          },
        ],
      }),
    ])

    await expect(
      service.submitMessage({
        user,
        tenantId,
        sessionId,
        content: '启动 Party Mode',
        decisionAction: 'party-mode',
      }),
    ).rejects.toThrow(ConflictException)

    expect(messageRepository.createMessageWithNextSequence).not.toHaveBeenCalled()
    expect(sessionRepository.claimPartyModeStart).not.toHaveBeenCalled()
    expect(sessionRepository.finalizePartyModeStart).not.toHaveBeenCalled()
    expect(providerGateway.stream).not.toHaveBeenCalled()
  })

  test('[P0][5.1-BE-007][AC1,AC2] rejects stale Party Mode actions when the latest decision message no longer offers it', async () => {
    process.env.THINKTANK_PARTY_MODE_ENABLED = 'true'
    process.env.THINKTANK_PARTY_MODE_TENANTS = tenantId
    messageRepository.findMessagesBySession.mockResolvedValueOnce([
      createMessage({ id: 'message-user-previous', sequence: 1 }),
      createMessage({
        id: 'message-assistant-old-party',
        role: AdvisoryConversationMessageRole.Assistant,
        sequence: 2,
        decisionOptions: [
          {
            key: 'party-mode',
            action: 'party-mode',
            label: 'Party Mode',
            shortcut: 'P',
            enabled: true,
          },
        ],
      }),
      createMessage({
        id: 'message-assistant-latest-options',
        role: AdvisoryConversationMessageRole.Assistant,
        sequence: 3,
        decisionOptions: [
          {
            key: 'continue',
            action: 'continue',
            label: '继续',
            shortcut: 'C',
            enabled: true,
          },
        ],
      }),
    ])

    await expect(
      service.submitMessage({
        user,
        tenantId,
        sessionId,
        content: '启动 Party Mode',
        decisionAction: 'party-mode',
      }),
    ).rejects.toThrow(ConflictException)

    expect(messageRepository.createMessageWithNextSequence).not.toHaveBeenCalled()
    expect(sessionRepository.claimPartyModeStart).not.toHaveBeenCalled()
    expect(sessionRepository.finalizePartyModeStart).not.toHaveBeenCalled()
    expect(providerGateway.stream).not.toHaveBeenCalled()
  })

  test('[P0][5.1-BE-008][AC3] rejects a concurrent Party Mode retry before writing conversation history', async () => {
    process.env.THINKTANK_PARTY_MODE_ENABLED = 'true'
    process.env.THINKTANK_PARTY_MODE_TENANTS = tenantId
    sessionRepository.claimPartyModeStart.mockResolvedValueOnce(null)

    await expect(
      service.submitMessage({
        user,
        tenantId,
        sessionId,
        content: '启动 Party Mode',
        decisionAction: 'party-mode',
      }),
    ).rejects.toThrow(ConflictException)

    expect(messageRepository.createMessageWithNextSequence).not.toHaveBeenCalled()
    expect(sessionRepository.finalizePartyModeStart).not.toHaveBeenCalled()
    expect(sessionRepository.rollbackPartyModeStart).not.toHaveBeenCalled()
    expect(providerGateway.stream).not.toHaveBeenCalled()
  })

  test('[P0][5.1-BE-011][AC3] rolls back a claimed Party Mode start when later persistence fails', async () => {
    process.env.THINKTANK_PARTY_MODE_ENABLED = 'true'
    process.env.THINKTANK_PARTY_MODE_TENANTS = tenantId
    messageRepository.createMessageWithNextSequence.mockRejectedValueOnce(
      new Error('message write failed'),
    )

    await expect(
      service.submitMessage({
        user,
        tenantId,
        sessionId,
        content: '启动 Party Mode',
        decisionAction: 'party-mode',
      }),
    ).rejects.toThrow()

    expect(sessionRepository.claimPartyModeStart).toHaveBeenCalled()
    expect(sessionRepository.rollbackPartyModeStart).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      actorId,
      expect.objectContaining({
        party_mode_active: false,
        party_mode_status: 'start-failed',
      }),
    )
    expect(sessionRepository.finalizePartyModeStart).not.toHaveBeenCalled()
    expect(providerGateway.stream).not.toHaveBeenCalled()
  })

  test('[P0][5.1-BE-015][AC3] removes Party Mode start messages when finalize fails so retry remains possible', async () => {
    process.env.THINKTANK_PARTY_MODE_ENABLED = 'true'
    process.env.THINKTANK_PARTY_MODE_TENANTS = tenantId
    sessionRepository.finalizePartyModeStart.mockResolvedValueOnce(null)

    await expect(
      service.submitMessage({
        user,
        tenantId,
        sessionId,
        content: '启动 Party Mode',
        decisionAction: 'party-mode',
      }),
    ).rejects.toThrow(ConflictException)

    expect(messageRepository.createMessageWithNextSequence).toHaveBeenCalledTimes(2)
    expect(messageRepository.deleteMessage).toHaveBeenCalledWith(
      tenantId,
      'message-assistant-party-entry',
    )
    expect(messageRepository.deleteMessage).toHaveBeenCalledWith(
      tenantId,
      'message-user-party-entry',
    )
    expect(sessionRepository.rollbackPartyModeStart).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      actorId,
      expect.objectContaining({
        party_mode_active: false,
        party_mode_status: 'start-failed',
      }),
    )
    expect(providerGateway.stream).not.toHaveBeenCalled()
  })

  test('[P0][5.1-BE-006][AC3] streams Party Mode start as terminal started/completed events without provider work', async () => {
    process.env.THINKTANK_PARTY_MODE_ENABLED = 'true'
    process.env.THINKTANK_PARTY_MODE_TENANTS = tenantId

    const events = []
    for await (const event of service.streamMessage({
      user,
      tenantId,
      sessionId,
      content: '启动 Party Mode',
      decisionAction: 'party-mode',
    })) {
      events.push(event)
    }

    expect(events.map((event) => event.event)).toEqual(['message.started', 'message.completed'])
    expect(providerGateway.stream).not.toHaveBeenCalled()
    expect(sessionRepository.finalizePartyModeStart).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      actorId,
      expect.objectContaining({
        party_mode_active: true,
        party_mode_status: 'context-created',
        party_mode_context_id: `party-context:${sessionId}:message-user-party-entry`,
      }),
    )
    expect(events[1]).toEqual(
      expect.objectContaining({
        event: 'message.completed',
        data: expect.objectContaining({
          assistantMessage: expect.objectContaining({
            content: expect.stringContaining('Party Mode'),
            providerMetadata: {},
          }),
        }),
      }),
    )
  })

  test('[P0][5.1-BE-004][AC3] rejects Party Mode start for cross-tenant or inactive sessions before context creation', async () => {
    sessionRepository.findSessionById.mockResolvedValueOnce(null)

    await expect(
      service.submitMessage({
        user,
        tenantId,
        sessionId,
        content: '启动 Party Mode',
        decisionAction: 'party-mode',
      }),
    ).rejects.toThrow(NotFoundException)

    expect(sessionRepository.claimPartyModeStart).not.toHaveBeenCalled()
    expect(sessionRepository.finalizePartyModeStart).not.toHaveBeenCalled()
    expect(providerGateway.stream).not.toHaveBeenCalled()
  })

  test('[P0][5.1-BE-012][AC3] returns from Party Mode to the original workflow through a server-owned decision action', async () => {
    process.env.THINKTANK_PARTY_MODE_ENABLED = 'true'
    process.env.THINKTANK_PARTY_MODE_TENANTS = tenantId
    sessionRepository.findSessionById.mockResolvedValueOnce({
      ...activeSession,
      metadata: {
        ...activeSession.metadata,
        party_mode_active: true,
        party_mode_status: 'context-created',
      },
    } as never)
    messageRepository.findMessagesBySession.mockResolvedValueOnce([
      createMessage({ id: 'message-user-party', sequence: 1 }),
      createMessage({
        id: 'message-assistant-party-started',
        role: AdvisoryConversationMessageRole.Assistant,
        sequence: 2,
        decisionOptions: [
          {
            key: 'return-to-workflow',
            action: 'return-to-workflow',
            label: '返回工作流',
            enabled: true,
          },
        ],
      }),
    ])

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: '返回工作流',
      decisionAction: 'return-to-workflow',
    })

    expect(providerGateway.stream).not.toHaveBeenCalled()
    expect(sessionRepository.claimPartyModeReturn).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      actorId,
      expect.objectContaining({
        party_mode_active: true,
        party_mode_status: 'returning',
      }),
    )
    expect(sessionRepository.finalizePartyModeReturn).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      actorId,
      expect.objectContaining({
        party_mode_active: false,
        party_mode_status: 'returned',
        party_mode_return_message_id: 'message-assistant-party-entry',
      }),
    )
    expect(result.assistantMessage.content).toContain('已返回原工作流')
    expect(result.decisionOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'continue', enabled: true }),
        expect.objectContaining({ action: 'party-mode', enabled: true }),
      ]),
    )
  })

  test('[P0][5.1-BE-016][AC3] removes Party Mode return messages when finalize fails so return can be retried', async () => {
    process.env.THINKTANK_PARTY_MODE_ENABLED = 'true'
    process.env.THINKTANK_PARTY_MODE_TENANTS = tenantId
    sessionRepository.findSessionById.mockResolvedValueOnce({
      ...activeSession,
      metadata: {
        ...activeSession.metadata,
        party_mode_active: true,
        party_mode_status: 'context-created',
      },
    } as never)
    messageRepository.findMessagesBySession.mockResolvedValueOnce([
      createMessage({ id: 'message-user-party', sequence: 1 }),
      createMessage({
        id: 'message-assistant-party-started',
        role: AdvisoryConversationMessageRole.Assistant,
        sequence: 2,
        decisionOptions: [
          {
            key: 'return-to-workflow',
            action: 'return-to-workflow',
            label: '返回工作流',
            enabled: true,
          },
        ],
      }),
    ])
    sessionRepository.finalizePartyModeReturn.mockResolvedValueOnce(null)

    await expect(
      service.submitMessage({
        user,
        tenantId,
        sessionId,
        content: '返回工作流',
        decisionAction: 'return-to-workflow',
      }),
    ).rejects.toThrow(ConflictException)

    expect(messageRepository.createMessageWithNextSequence).toHaveBeenCalledTimes(2)
    expect(messageRepository.deleteMessage).toHaveBeenCalledWith(
      tenantId,
      'message-assistant-party-entry',
    )
    expect(messageRepository.deleteMessage).toHaveBeenCalledWith(
      tenantId,
      'message-user-party-entry',
    )
    expect(sessionRepository.rollbackPartyModeReturn).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      actorId,
      expect.objectContaining({
        party_mode_active: true,
        party_mode_status: 'context-created',
      }),
    )
    expect(providerGateway.stream).not.toHaveBeenCalled()
  })

  test('[P0][5.2-BE-001][AC1,AC2] explains selected ThinkTank advisor personas before Party Mode discussion begins', async () => {
    process.env.THINKTANK_PARTY_MODE_ENABLED = 'true'
    process.env.THINKTANK_PARTY_MODE_TENANTS = tenantId

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: '启动 Party Mode',
      decisionAction: 'party-mode',
    })

    expect(providerGateway.stream).not.toHaveBeenCalled()
    expect(partyModeAdvisorPersonas.selectAdvisors).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowKey: 'problem-solving',
        currentStepLabel: '根因分解',
        currentStepSourceRef: 'workflow:problem-solving#step-2',
        latestUserMessage: '启动 Party Mode',
      }),
    )
    expect(result.assistantMessage.content).toContain('ThinkTank 顾问')
    expect(result.assistantMessage.content).toContain('Dr. Quinn')
    expect(result.assistantMessage.content).toContain('Winston')
    expect(result.assistantMessage.content).toContain('John')
    expect(result.assistantMessage.content).not.toContain('_bmad/')
    expect(result.assistantMessage.content).not.toContain('<agent>')
    expect(sessionRepository.finalizePartyModeStart).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      actorId,
      expect.objectContaining({
        party_mode_advisor_count: 3,
        party_mode_selected_advisor_ids: 'creative-problem-solver|architect|pm',
        party_mode_selected_advisor_source_paths:
          '_bmad/cis/agents/creative-problem-solver.md|_bmad/bmm/agents/architect.md|_bmad/bmm/agents/pm.md',
      }),
    )
    expect(JSON.stringify(result.assistantMessage.providerMetadata)).not.toContain(
      'Systems problem solver',
    )
  })

  test('[P0][5.2-BE-002][AC3] keeps Party Mode start retryable when advisor loading falls below the minimum viable set', async () => {
    process.env.THINKTANK_PARTY_MODE_ENABLED = 'true'
    process.env.THINKTANK_PARTY_MODE_TENANTS = tenantId
    partyModeAdvisorPersonas.selectAdvisors.mockRejectedValueOnce(
      new Error('minimum viable advisor set unavailable'),
    )

    await expect(
      service.submitMessage({
        user,
        tenantId,
        sessionId,
        content: '启动 Party Mode',
        decisionAction: 'party-mode',
      }),
    ).rejects.toThrow()

    expect(messageRepository.createMessageWithNextSequence).toHaveBeenCalledTimes(1)
    expect(messageRepository.deleteMessage).toHaveBeenCalledWith(
      tenantId,
      'message-user-party-entry',
    )
    expect(sessionRepository.finalizePartyModeStart).not.toHaveBeenCalled()
    expect(sessionRepository.rollbackPartyModeStart).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      actorId,
      expect.objectContaining({
        party_mode_active: false,
        party_mode_status: 'start-failed',
      }),
    )
    expect(providerGateway.stream).not.toHaveBeenCalled()
  })

  test('[P1][5.2-BE-003][AC3] surfaces omitted advisor names without exposing source paths or stack traces', async () => {
    process.env.THINKTANK_PARTY_MODE_ENABLED = 'true'
    process.env.THINKTANK_PARTY_MODE_TENANTS = tenantId
    partyModeAdvisorPersonas.selectAdvisors.mockResolvedValueOnce({
      advisors: [
        {
          id: 'creative-problem-solver',
          displayName: 'Dr. Quinn',
          role: 'Systematic Problem-Solving Expert',
          identity: 'Systems problem solver',
          communicationStyle: 'Deductive',
          principles: 'Find root causes',
          capabilities: ['TRIZ', 'root cause analysis'],
          module: 'cis',
          sourcePath: '_bmad/cis/agents/creative-problem-solver.md',
          sourceHash: 'problem-solver-source-hash',
          perspective: '系统性问题诊断',
          roleFamily: 'problem-solving',
          selectionReason: '当前步骤需要 root cause diagnosis',
        },
        {
          id: 'analyst',
          displayName: 'Mary',
          role: 'Business Analyst',
          identity: 'Business analyst',
          communicationStyle: 'Evidence-led',
          principles: 'Ground findings',
          capabilities: ['market research', 'requirements'],
          module: 'bmm',
          sourcePath: '_bmad/bmm/agents/analyst.md',
          sourceHash: 'analyst-source-hash',
          perspective: '业务证据分析',
          roleFamily: 'research',
          selectionReason: '补充 evidence analysis',
        },
        {
          id: 'pm',
          displayName: 'John',
          role: 'Product Manager',
          identity: 'Product veteran',
          communicationStyle: 'Asks why',
          principles: 'User value first',
          capabilities: ['PRD creation', 'stakeholder alignment'],
          module: 'bmm',
          sourcePath: '_bmad/bmm/agents/pm.md',
          sourceHash: 'pm-source-hash',
          perspective: '产品价值与优先级',
          roleFamily: 'product',
          selectionReason: '补充 user value',
        },
      ],
      omittedAdvisors: [
        {
          id: 'architect',
          displayName: 'Winston',
          reason: '顾问源文件不可用，本次先由其余 ThinkTank 顾问继续。',
          sourcePath: '_bmad/bmm/agents/architect.md',
        },
      ],
      visibleSummary:
        'Party Mode 上下文已创建。3 位 ThinkTank 顾问将加入。已略过 Winston：顾问源文件不可用，本次先由其余 ThinkTank 顾问继续。',
      metadata: {
        party_mode_advisor_count: 3,
        party_mode_selected_advisor_ids: 'creative-problem-solver|analyst|pm',
        party_mode_selected_advisor_names: 'Dr. Quinn|Mary|John',
        party_mode_selected_advisor_roles:
          'Systematic Problem-Solving Expert|Business Analyst|Product Manager',
        party_mode_selected_advisor_perspectives: '系统性问题诊断|业务证据分析|产品价值与优先级',
        party_mode_selected_advisor_source_paths:
          '_bmad/cis/agents/creative-problem-solver.md|_bmad/bmm/agents/analyst.md|_bmad/bmm/agents/pm.md',
        party_mode_selected_advisor_source_hashes:
          'problem-solver-source-hash|analyst-source-hash|pm-source-hash',
        party_mode_selected_advisor_reasons:
          '当前步骤需要 root cause diagnosis|补充 evidence analysis|补充 user value',
        party_mode_omitted_advisor_count: 1,
        party_mode_omitted_advisors: 'Winston',
        party_mode_omission_reasons: '顾问源文件不可用，本次先由其余 ThinkTank 顾问继续。',
      },
    } as never)

    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: '启动 Party Mode',
      decisionAction: 'party-mode',
    })

    expect(result.assistantMessage.content).toContain('已略过 Winston')
    expect(result.assistantMessage.content).not.toContain('_bmad/bmm/agents/architect.md')
    expect(result.assistantMessage.content).not.toContain('Error:')
    expect(sessionRepository.finalizePartyModeStart).toHaveBeenCalledWith(
      tenantId,
      sessionId,
      actorId,
      expect.objectContaining({
        party_mode_omitted_advisor_count: 1,
        party_mode_omitted_advisors: 'Winston',
      }),
    )
  })
})
