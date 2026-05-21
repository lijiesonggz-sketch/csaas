import { Repository } from 'typeorm'
import { AdvisoryWorkflowCheckpoint } from '../../../database/entities/advisory-workflow-checkpoint.entity'
import { AdvisoryWorkflowCheckpointRepository } from './advisory-workflow-checkpoint.repository'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const secondaryTenantId = '660e8400-e29b-41d4-a716-446655440999'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const sessionId = '550e8400-e29b-41d4-a716-446655440000'

function createCheckpoint(
  overrides: Partial<AdvisoryWorkflowCheckpoint> = {},
): AdvisoryWorkflowCheckpoint {
  return {
    id: 'checkpoint-1',
    tenantId,
    sessionId,
    actorId,
    workflowKey: 'problem-solving',
    workflowType: 'Problem Solving',
    stepIndex: 1,
    sequence: 1,
    checkpointType: 'message_completed',
    currentStep: { index: 1, label: 'Diagnose retention', sourceRef: 'current-step:1' },
    conversationState: {
      messageCount: 2,
      lastMessageId: 'assistant-message-1',
      historyPointer: `conversation_messages:${sessionId}`,
    },
    documentState: {
      outputId: 'output-1',
      status: 'draft',
      sectionCount: 1,
    },
    stateSnapshot: {
      tenantId,
      actorId,
      sessionId,
      workflowKey: 'problem-solving',
      workflowType: 'Problem Solving',
      currentStep: { index: 1, label: 'Diagnose retention', sourceRef: 'current-step:1' },
      conversation: {
        messageCount: 2,
        lastMessageId: 'assistant-message-1',
        historyPointer: `conversation_messages:${sessionId}`,
      },
      documentState: {
        outputId: 'output-1',
        status: 'draft',
        sectionCount: 1,
      },
      lastActivityAt: '2026-05-21T00:00:00.000Z',
    },
    summary: 'Problem Solving | step 1 | 2 messages | 1 sections',
    metadata: {},
    lastActivityAt: new Date('2026-05-21T00:00:00.000Z'),
    createdAt: new Date('2026-05-21T00:00:00.000Z'),
    updatedAt: new Date('2026-05-21T00:00:00.000Z'),
    ...overrides,
  }
}

describe('AdvisoryWorkflowCheckpointRepository', () => {
  let typeormRepository: jest.Mocked<Repository<AdvisoryWorkflowCheckpoint>>
  let repository: AdvisoryWorkflowCheckpointRepository

  beforeEach(() => {
    typeormRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
    } as never
    repository = new AdvisoryWorkflowCheckpointRepository(typeormRepository)
  })

  test('[P0][4.1-BE-002][AC2] archives checkpoints under server-side tenant scope', async () => {
    const saved = createCheckpoint()
    typeormRepository.create.mockReturnValue(saved)
    typeormRepository.save.mockResolvedValue(saved)

    await repository.archiveCheckpoint(tenantId, {
      tenantId: secondaryTenantId,
      sessionId,
      actorId,
      workflowKey: 'problem-solving',
      workflowType: 'Problem Solving',
      currentStep: saved.currentStep,
      conversationState: saved.conversationState,
      documentState: saved.documentState,
      stateSnapshot: saved.stateSnapshot,
      metadata: {},
      lastActivityAt: saved.lastActivityAt,
    } as never)

    expect(typeormRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        sessionId,
        actorId,
        workflowKey: 'problem-solving',
        workflowType: 'Problem Solving',
        currentStep: expect.objectContaining({ index: 1 }),
        conversationState: expect.objectContaining({ messageCount: 2 }),
        documentState: expect.objectContaining({ sectionCount: 1 }),
      }),
    )
    expect(typeormRepository.create.mock.calls[0][0]).not.toMatchObject({
      tenantId: secondaryTenantId,
    })
  })

  test('[P0][4.1-BE-003][AC3] reads latest checkpoint by tenant and session only', async () => {
    const checkpoint = createCheckpoint()
    typeormRepository.findOne.mockResolvedValueOnce(checkpoint)

    await expect(repository.findLatestCheckpoint(tenantId, sessionId)).resolves.toBe(checkpoint)

    expect(typeormRepository.findOne).toHaveBeenCalledWith({
      where: {
        tenantId,
        sessionId,
      },
      order: {
        lastActivityAt: 'DESC',
        createdAt: 'DESC',
        sequence: 'DESC',
      },
    })
  })

  test('[P0][4.1-BE-003][AC3] rejects checkpoint archives when session does not belong to tenant', async () => {
    Object.defineProperty(typeormRepository, 'manager', {
      value: {
        count: jest.fn().mockResolvedValue(0),
      },
    })

    await expect(
      repository.archiveCheckpoint(tenantId, {
        sessionId,
        actorId,
        workflowKey: 'problem-solving',
        workflowType: 'Problem Solving',
      } as never),
    ).rejects.toThrow('sessionId must belong to tenantId')
  })

  test('[P0][4.1-BE-003][AC3] returns null for cross-tenant checkpoint lookup by same session id', async () => {
    typeormRepository.findOne.mockResolvedValueOnce(null)

    await expect(repository.findLatestCheckpoint(tenantId, sessionId)).resolves.toBeNull()

    expect(typeormRepository.findOne).toHaveBeenCalledWith({
      where: {
        tenantId,
        sessionId,
      },
      order: expect.any(Object),
    })
    expect(typeormRepository.findOne).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: secondaryTenantId,
        }),
      }),
    )
  })
})
