import { NotFoundException } from '@nestjs/common'
import { AdvisoryWorkflowSessionStatus } from '../../../database/entities/advisory-workflow-session.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AdvisoryConversationMessageRole } from '../../../database/entities/advisory-conversation-message.entity'
import { AdvisoryAccessService } from '../access/advisory-access.service'
import { AdvisoryEventService } from '../events/advisory-event.service'
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
  currentStep: { index: 1, label: '当前步骤', sourceRef: 'current-step:1' },
  sourceRefs: ['workflow:problem-solving', 'current-step:1'],
  metadata: { workflow_key: 'problem-solving', source_ref_count: 2 },
  failureCode: null,
  failureMessage: null,
  createdAt: new Date('2026-05-20T00:00:00.000Z'),
  updatedAt: new Date('2026-05-20T00:00:00.000Z'),
}

describe('AdvisorySessionService guided messages', () => {
  let accessService: jest.Mocked<Pick<AdvisoryAccessService, 'assertThinkTankModuleAvailable'>>
  let sessionRepository: jest.Mocked<
    Pick<AdvisorySessionRepository, 'findSessionById' | 'updateSession'>
  >
  let messageRepository: jest.Mocked<
    Pick<
      AdvisoryConversationMessageRepository,
      'findMessagesBySession' | 'createMessage' | 'nextSequenceForSession'
    >
  >
  let providerGateway: jest.Mocked<Pick<ThinkTankProviderGatewayService, 'stream'>>
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
      findMessagesBySession: jest.fn().mockResolvedValue([]),
      nextSequenceForSession: jest.fn().mockResolvedValue(1),
      createMessage: jest.fn(
        async (_tenantId, input) =>
          ({
            id:
              input.role === AdvisoryConversationMessageRole.User
                ? 'message-user-1'
                : 'message-assistant-1',
            tenantId,
            sessionId,
            actorId: input.actorId,
            role: input.role,
            content: input.content,
            sequence: input.sequence,
            workflowKey: input.workflowKey,
            stepIndex: input.stepIndex,
            decisionOptions: (input.decisionOptions ?? []) as never,
            metadata: input.metadata ?? {},
            providerMetadata: input.providerMetadata ?? {},
            createdAt: new Date('2026-05-20T00:00:00.000Z'),
            updatedAt: new Date('2026-05-20T00:00:00.000Z'),
          }) as never,
      ),
    }
    providerGateway = {
      stream: jest.fn(async function* (input): AsyncIterable<ThinkTankProviderStreamChunk> {
        void input
        yield {
          index: 0,
          delta: 'Summary: retention is likely blocked by onboarding friction.',
          done: false,
          provider: 'fake' as const,
          model: 'fake-thinktank-model',
        }
        yield {
          index: 1,
          delta: ' Next options: continue, deepen, revise.',
          done: true,
          provider: 'fake' as const,
          model: 'fake-thinktank-model',
          usage: {
            inputTokens: 10,
            outputTokens: 8,
            totalTokens: 18,
          },
          estimatedCost: 0,
          latencyMs: 12,
          finishReason: 'stop',
        }
      }),
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
      providerGateway as never,
    )
  })

  test('[P0] persists a user answer, streams the advisor response, and stores AI decision options', async () => {
    const result = await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'Retention drops after the second session.',
    })

    expect(accessService.assertThinkTankModuleAvailable).toHaveBeenCalledWith(user, tenantId)
    expect(sessionRepository.findSessionById).toHaveBeenCalledWith(tenantId, sessionId)
    expect(messageRepository.createMessage).toHaveBeenNthCalledWith(
      1,
      tenantId,
      expect.objectContaining({
        sessionId,
        actorId,
        role: AdvisoryConversationMessageRole.User,
        content: 'Retention drops after the second session.',
        sequence: 1,
        workflowKey: 'problem-solving',
        stepIndex: 1,
      }),
    )
    expect(providerGateway.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        actorId,
        subjectId: sessionId,
        stream: true,
        messages: [
          {
            role: 'user',
            content: 'Retention drops after the second session.',
          },
        ],
        metadata: expect.objectContaining({
          workflow_key: 'problem-solving',
          step_index: 1,
          message_count: 1,
        }),
      }),
    )
    const providerMetadata = JSON.stringify(providerGateway.stream.mock.calls[0][0].metadata)
    expect(providerMetadata).not.toContain('Retention drops after the second session')
    expect(providerMetadata).not.toMatch(/prompt|content|conversation|report|document/i)
    expect(messageRepository.createMessage).toHaveBeenNthCalledWith(
      2,
      tenantId,
      expect.objectContaining({
        role: AdvisoryConversationMessageRole.Assistant,
        content:
          'Summary: retention is likely blocked by onboarding friction. Next options: continue, deepen, revise.',
        sequence: 2,
        workflowKey: 'problem-solving',
        stepIndex: 1,
        decisionOptions: expect.arrayContaining([
          expect.objectContaining({ action: 'continue', shortcut: 'C' }),
          expect.objectContaining({ action: 'deepen' }),
          expect.objectContaining({ action: 'revise' }),
        ]),
        metadata: expect.objectContaining({
          ai_generated: true,
          workflow_key: 'problem-solving',
          step_index: 1,
        }),
      }),
    )
    expect(result).toEqual(
      expect.objectContaining({
        sessionId,
        currentStep: activeSession.currentStep,
        assistantMessage: expect.objectContaining({
          role: AdvisoryConversationMessageRole.Assistant,
          content:
            'Summary: retention is likely blocked by onboarding friction. Next options: continue, deepen, revise.',
        }),
        stream: expect.arrayContaining([
          expect.objectContaining({
            delta: 'Summary: retention is likely blocked by onboarding friction.',
          }),
        ]),
      }),
    )
  })

  test('[P0] retrieves conversation messages through tenant-scoped repository access', async () => {
    const persisted = [
      {
        id: 'message-user-1',
        tenantId,
        sessionId,
        actorId,
        role: AdvisoryConversationMessageRole.User,
        content: 'What should we investigate first?',
        sequence: 1,
        workflowKey: 'problem-solving',
        stepIndex: 1,
        decisionOptions: [],
        metadata: { workflow_key: 'problem-solving', step_index: 1 },
        providerMetadata: {},
        createdAt: new Date('2026-05-20T00:00:00.000Z'),
        updatedAt: new Date('2026-05-20T00:00:00.000Z'),
      },
    ]
    messageRepository.findMessagesBySession.mockResolvedValueOnce(persisted)

    const result = await service.listMessages({ user, tenantId, sessionId })

    expect(sessionRepository.findSessionById).toHaveBeenCalledWith(tenantId, sessionId)
    expect(messageRepository.findMessagesBySession).toHaveBeenCalledWith(tenantId, sessionId)
    expect(result).toEqual({
      sessionId,
      currentStep: activeSession.currentStep,
      messages: persisted,
    })
  })

  test('[P0] rejects cross-tenant or inactive sessions without calling the provider', async () => {
    sessionRepository.findSessionById.mockResolvedValueOnce(null)

    await expect(
      service.submitMessage({
        user,
        tenantId,
        sessionId,
        content: 'Tenant B should not see this.',
      }),
    ).rejects.toThrow(NotFoundException)

    expect(providerGateway.stream).not.toHaveBeenCalled()
    expect(messageRepository.createMessage).not.toHaveBeenCalled()
  })

  test('[P0] does not advance workflow currentStep until the user confirms continuation', async () => {
    await service.submitMessage({
      user,
      tenantId,
      sessionId,
      content: 'The current step is ready, but I want to ask one more question.',
    })

    expect(sessionRepository.updateSession).not.toHaveBeenCalledWith(
      tenantId,
      sessionId,
      expect.objectContaining({
        currentStep: expect.objectContaining({ index: 2 }),
      }),
    )
  })
})
