import { NotFoundException } from '@nestjs/common'
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
import { ThinkTankPromptAssemblerService } from '../runtime/prompt-assembler.service'
import { ThinkTankWorkflowRegistryService } from '../runtime/workflow-registry.service'
import { AdvisorySessionRepository } from './advisory-session.repository'
import { AdvisorySessionService } from './advisory-session.service'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const organizationId = '880e8400-e29b-41d4-a716-446655440000'
const sessionId = '550e8400-e29b-41d4-a716-446655440000'
const outputId = '990e8400-e29b-41d4-a716-446655440000'

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
  metadata: {},
  failureCode: null,
  failureMessage: null,
  createdAt: new Date('2026-05-21T05:00:00.000Z'),
  updatedAt: new Date('2026-05-21T05:00:00.000Z'),
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
    contentMarkdown: '# Retention Diagnosis\n\nUsers drop after setup.',
    sections: [],
    aiLabelMetadata: {
      visible_label: '[AI Generated]',
      ai_generated: true,
      machine_readable: true,
    },
    metadata: { section_count: 1 },
    createdAt: new Date('2026-05-21T05:00:00.000Z'),
    updatedAt: new Date('2026-05-21T05:10:00.000Z'),
    ...overrides,
  }
}

describe('AdvisorySessionService output knowledge-base association', () => {
  let accessService: jest.Mocked<Pick<AdvisoryAccessService, 'assertThinkTankModuleAvailable'>>
  let sessionRepository: jest.Mocked<Pick<AdvisorySessionRepository, 'findSessionById'>>
  let outputRepository: jest.Mocked<
    Pick<
      AdvisoryWorkflowOutputRepository,
      'findOutputById' | 'findActiveDraftForSession' | 'findLatestCompletedForSession'
    >
  >
  let associationRepository: {
    upsertAttempt: jest.Mock
    findStateForOutput: jest.Mock
    findStatesForOutputIds: jest.Mock
  }
  let knowledgeBasePort: {
    associateOutput: jest.Mock
  }
  let eventService: jest.Mocked<Pick<AdvisoryEventService, 'emitTelemetry'>>
  let service: AdvisorySessionService

  beforeEach(() => {
    accessService = {
      assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
    }
    sessionRepository = {
      findSessionById: jest.fn().mockResolvedValue(activeSession),
    }
    outputRepository = {
      findOutputById: jest.fn().mockResolvedValue(createOutput()),
      findActiveDraftForSession: jest.fn().mockResolvedValue(null),
      findLatestCompletedForSession: jest.fn().mockResolvedValue(createOutput()),
    }
    associationRepository = {
      upsertAttempt: jest.fn().mockResolvedValue({
        outputId,
        status: 'pending',
        destinationKey: 'enterprise-knowledge-base',
        externalReferenceId: null,
        message: '知识库暂不可用，报告仍保留在 ThinkTank，可稍后重试。',
        retryCount: 1,
        updatedAt: '2026-05-21T08:00:00.000Z',
        associatedAt: null,
      }),
      findStateForOutput: jest.fn().mockResolvedValue({
        outputId,
        status: null,
        destinationKey: null,
        externalReferenceId: null,
        message: null,
        retryCount: 0,
        updatedAt: null,
        associatedAt: null,
      }),
      findStatesForOutputIds: jest.fn().mockResolvedValue([]),
    }
    knowledgeBasePort = {
      associateOutput: jest.fn().mockResolvedValue({
        status: 'pending',
        message: '知识库暂不可用，报告仍保留在 ThinkTank，可稍后重试。',
      }),
    }
    eventService = {
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
      undefined,
      {} as ThinkTankProviderGatewayService,
      outputRepository as never,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      associationRepository as never,
      knowledgeBasePort as never,
    )
  })

  test('[P0][4.5-BE-005][AC1,AC2] associates an authorized output through KnowledgeBaseAssociationPort using server-owned metadata', async () => {
    await expect(
      service.associateOutputWithKnowledgeBase({
        user,
        tenantId,
        sessionId,
        outputId,
      }),
    ).resolves.toEqual({
      sessionId,
      knowledgeBaseAssociation: expect.objectContaining({
        outputId,
        status: 'pending',
        destinationKey: 'enterprise-knowledge-base',
      }),
    })

    expect(outputRepository.findOutputById).toHaveBeenCalledWith(tenantId, outputId)
    expect(knowledgeBasePort.associateOutput).toHaveBeenCalledWith({
      tenantId,
      userId: actorId,
      outputId,
      title: 'Retention Diagnosis',
      summary: 'Users drop after setup.',
      filePath: `thinktank://tenant/${tenantId}/advisory/outputs/${outputId}`,
      aiMetadata: expect.objectContaining({
        ai_generated: true,
        sourceWorkflow: 'problem-solving',
        destinationKey: 'enterprise-knowledge-base',
        idempotencyKey: `${tenantId}:${outputId}:enterprise-knowledge-base`,
      }),
    })
    expect(associationRepository.upsertAttempt).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        actorId,
        sessionId,
        outputId,
        status: 'pending',
        title: 'Retention Diagnosis',
        summary: 'Users drop after setup.',
        sourceWorkflow: 'problem-solving',
      }),
    )
  })

  test('[P0][4.5-BE-006][AC2] persists retryable pending state when the adapter is unavailable', async () => {
    knowledgeBasePort.associateOutput.mockResolvedValueOnce({
      status: 'failed',
      message: 'Knowledge destination unavailable; retry later.',
    })

    await expect(
      service.associateOutputWithKnowledgeBase({
        user,
        tenantId,
        sessionId,
        outputId,
      }),
    ).resolves.toEqual({
      sessionId,
      knowledgeBaseAssociation: expect.objectContaining({
        outputId,
        status: 'pending',
        message: '知识库暂不可用，报告仍保留在 ThinkTank，可稍后重试。',
      }),
    })

    expect(outputRepository.findLatestCompletedForSession).not.toHaveBeenCalled()
    expect(associationRepository.upsertAttempt).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        status: expect.stringMatching(/pending|failed/),
        outputId,
      }),
    )
  })

  test('[P0][4.5-BE-008][AC2,AC3] returns an existing associated state without downgrading through a retry', async () => {
    associationRepository.findStateForOutput.mockResolvedValueOnce({
      outputId,
      status: 'associated',
      destinationKey: 'enterprise-knowledge-base',
      externalReferenceId: 'kb-ref-1',
      message: null,
      retryCount: 2,
      updatedAt: '2026-05-21T08:05:00.000Z',
      associatedAt: '2026-05-21T08:05:00.000Z',
    })

    await expect(
      service.associateOutputWithKnowledgeBase({
        user,
        tenantId,
        sessionId,
        outputId,
      }),
    ).resolves.toEqual({
      sessionId,
      knowledgeBaseAssociation: expect.objectContaining({
        outputId,
        status: 'associated',
        externalReferenceId: 'kb-ref-1',
      }),
    })

    expect(knowledgeBasePort.associateOutput).not.toHaveBeenCalled()
    expect(associationRepository.upsertAttempt).not.toHaveBeenCalled()
  })

  test('[P0][4.5-BE-009][AC1] rejects non-default knowledge-base destinations in the MVP boundary', async () => {
    await expect(
      service.associateOutputWithKnowledgeBase({
        user,
        tenantId,
        sessionId,
        outputId,
        destinationKey: 'shadow-knowledge-base',
      }),
    ).rejects.toThrow('Unsupported knowledge-base destination.')

    expect(knowledgeBasePort.associateOutput).not.toHaveBeenCalled()
    expect(associationRepository.upsertAttempt).not.toHaveBeenCalled()
  })

  test('[P0][4.5-BE-010][AC1] rejects empty draft outputs before creating a knowledge-base association', async () => {
    outputRepository.findOutputById.mockResolvedValueOnce(
      createOutput({
        status: AdvisoryWorkflowOutputStatus.Draft,
        contentMarkdown: '',
        sections: [],
      }),
    )

    await expect(
      service.associateOutputWithKnowledgeBase({
        user,
        tenantId,
        sessionId,
        outputId,
      }),
    ).rejects.toThrow('报告尚无可复用内容，完成至少一个报告章节后再保存到知识库。')

    expect(knowledgeBasePort.associateOutput).not.toHaveBeenCalled()
    expect(associationRepository.upsertAttempt).not.toHaveBeenCalled()
  })

  test('[P0][4.5-BE-007][AC3] blocks direct output ids outside current session or actor before port invocation', async () => {
    outputRepository.findOutputById.mockResolvedValueOnce(
      createOutput({
        id: 'foreign-output',
        sessionId: 'foreign-session',
        actorId: 'foreign-actor',
        title: 'Foreign report title',
      }),
    )

    await expect(
      service.associateOutputWithKnowledgeBase({
        user,
        tenantId,
        sessionId,
        outputId: 'foreign-output',
      }),
    ).rejects.toThrow(NotFoundException)

    expect(knowledgeBasePort.associateOutput).not.toHaveBeenCalled()
    expect(associationRepository.upsertAttempt).not.toHaveBeenCalled()
  })
})
