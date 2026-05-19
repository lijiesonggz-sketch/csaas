import { Repository } from 'typeorm'
import {
  AdvisoryConversationMessage,
  AdvisoryConversationMessageRole,
} from '../../../database/entities/advisory-conversation-message.entity'
import { AdvisoryConversationMessageRepository } from './advisory-conversation-message.repository'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const secondaryTenantId = '660e8400-e29b-41d4-a716-446655440999'
const sessionId = '550e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'

function createMessage(
  overrides: Partial<AdvisoryConversationMessage> = {},
): AdvisoryConversationMessage {
  return {
    id: '990e8400-e29b-41d4-a716-446655440000',
    tenantId,
    sessionId,
    actorId,
    role: AdvisoryConversationMessageRole.User,
    content: 'We need to diagnose the retention problem.',
    sequence: 1,
    workflowKey: 'problem-solving',
    stepIndex: 1,
    decisionOptions: [],
    metadata: {
      workflow_key: 'problem-solving',
      step_index: 1,
    },
    providerMetadata: {},
    createdAt: new Date('2026-05-20T00:00:00.000Z'),
    updatedAt: new Date('2026-05-20T00:00:00.000Z'),
    ...overrides,
  }
}

describe('AdvisoryConversationMessageRepository', () => {
  let typeormRepository: jest.Mocked<Repository<AdvisoryConversationMessage>>
  let repository: AdvisoryConversationMessageRepository

  beforeEach(() => {
    typeormRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      maximum: jest.fn(),
    } as never

    repository = new AdvisoryConversationMessageRepository(typeormRepository)
  })

  test('[P0] creates messages with current tenant scope and strips caller tenantId', async () => {
    const message = createMessage()
    typeormRepository.create.mockReturnValue(message)
    typeormRepository.save.mockResolvedValue(message)

    await repository.createMessage(tenantId, {
      tenantId: secondaryTenantId,
      sessionId,
      actorId,
      role: AdvisoryConversationMessageRole.User,
      content: message.content,
      sequence: 1,
      workflowKey: 'problem-solving',
      stepIndex: 1,
      metadata: {
        workflow_key: 'problem-solving',
        step_index: 1,
      },
    } as never)

    expect(typeormRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        sessionId,
        actorId,
        role: AdvisoryConversationMessageRole.User,
        content: message.content,
      }),
    )
  })

  test('[P0] lists session messages only within tenant scope in sequence order', async () => {
    const messages = [
      createMessage({ sequence: 1 }),
      createMessage({
        id: '990e8400-e29b-41d4-a716-446655440001',
        role: AdvisoryConversationMessageRole.Assistant,
        content: 'Here is a structured summary.',
        sequence: 2,
      }),
    ]
    typeormRepository.find.mockResolvedValue(messages)

    const result = await repository.findMessagesBySession(tenantId, sessionId)

    expect(result).toEqual(messages)
    expect(typeormRepository.find).toHaveBeenCalledWith({
      where: {
        tenantId,
        sessionId,
      },
      order: {
        sequence: 'ASC',
        createdAt: 'ASC',
      },
    })
  })

  test('[P0] calculates next sequence from the current maximum sequence', async () => {
    typeormRepository.maximum.mockResolvedValue(7)

    await expect(repository.nextSequenceForSession(tenantId, sessionId)).resolves.toBe(8)
    expect(typeormRepository.maximum).toHaveBeenCalledWith('sequence', {
      tenantId,
      sessionId,
    })
  })

  test('[P0] updates and deletes messages with tenant ownership criteria only', async () => {
    const message = createMessage()
    typeormRepository.update.mockResolvedValue({ affected: 1 } as never)
    typeormRepository.findOne.mockResolvedValue(message)
    typeormRepository.delete.mockResolvedValue({ affected: 1 } as never)

    await repository.updateMessage(tenantId, message.id, {
      tenantId: secondaryTenantId,
      sessionId: 'other-session',
      actorId: 'other-actor',
      content: 'Updated summary',
      metadata: { workflow_key: 'problem-solving', step_index: 1 },
    } as never)
    await repository.deleteMessage(tenantId, message.id)

    expect(typeormRepository.update).toHaveBeenCalledWith(
      { id: message.id, tenantId },
      {
        content: 'Updated summary',
        metadata: { workflow_key: 'problem-solving', step_index: 1 },
      },
    )
    expect(typeormRepository.delete).toHaveBeenCalledWith({ id: message.id, tenantId })
  })

  test('[P0] rejects cross-tenant reads, updates, and deletes without inference', async () => {
    const message = createMessage({ tenantId: secondaryTenantId })
    typeormRepository.findOne.mockResolvedValue(null)
    typeormRepository.update.mockResolvedValue({ affected: 0 } as never)
    typeormRepository.delete.mockResolvedValue({ affected: 0 } as never)

    await expect(repository.findMessageById(tenantId, message.id)).resolves.toBeNull()
    await expect(
      repository.updateMessage(tenantId, message.id, { content: 'No leak' }),
    ).resolves.toBeNull()
    await expect(repository.deleteMessage(tenantId, message.id)).resolves.toBe(false)

    expect(typeormRepository.findOne).toHaveBeenCalledWith({
      where: { id: message.id, tenantId },
    })
    expect(typeormRepository.update).toHaveBeenCalledWith(
      { id: message.id, tenantId },
      { content: 'No leak' },
    )
    expect(typeormRepository.delete).toHaveBeenCalledWith({ id: message.id, tenantId })
  })
})
