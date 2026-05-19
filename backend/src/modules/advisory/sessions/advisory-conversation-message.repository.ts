import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DeepPartial, EntityManager, FindOptionsWhere, Repository } from 'typeorm'
import { AdvisoryConversationMessage } from '../../../database/entities/advisory-conversation-message.entity'
import { BaseRepository } from '../../../database/repositories/base.repository'

@Injectable()
export class AdvisoryConversationMessageRepository extends BaseRepository<AdvisoryConversationMessage> {
  constructor(
    @InjectRepository(AdvisoryConversationMessage)
    repository: Repository<AdvisoryConversationMessage>,
  ) {
    super(repository)
  }

  async createMessage(
    tenantId: string,
    data: DeepPartial<AdvisoryConversationMessage>,
  ): Promise<AdvisoryConversationMessage> {
    return this.create(tenantId, data)
  }

  async createMessageWithNextSequence(
    tenantId: string,
    sessionId: string,
    data: DeepPartial<AdvisoryConversationMessage>,
  ): Promise<AdvisoryConversationMessage> {
    this.assertScopeValue(tenantId, 'tenantId')
    this.assertScopeValue(sessionId, 'id')

    return this.repository.manager.transaction(async (manager) => {
      await this.lockSessionSequence(manager, tenantId, sessionId)
      const scopedRepository = manager.getRepository(AdvisoryConversationMessage)
      const maxSequence = await scopedRepository.maximum('sequence', {
        tenantId,
        sessionId,
      })
      const entity = scopedRepository.create({
        ...this.stripTenantId(data),
        tenantId,
        sessionId,
        sequence: (maxSequence ?? 0) + 1,
      } as DeepPartial<AdvisoryConversationMessage>)

      return scopedRepository.save(entity)
    })
  }

  async findMessageById(
    tenantId: string,
    messageId: string,
  ): Promise<AdvisoryConversationMessage | null> {
    return this.findOne(tenantId, messageId)
  }

  async findMessagesBySession(
    tenantId: string,
    sessionId: string,
  ): Promise<AdvisoryConversationMessage[]> {
    this.assertScopeValue(sessionId, 'id')

    return this.findAll(tenantId, {
      where: {
        sessionId,
      },
      order: {
        sequence: 'ASC',
        createdAt: 'ASC',
      },
    })
  }

  async nextSequenceForSession(tenantId: string, sessionId: string): Promise<number> {
    this.assertScopeValue(sessionId, 'id')

    const criteria: FindOptionsWhere<AdvisoryConversationMessage> = {
      tenantId,
      sessionId,
    }
    const maxSequence = await this.repository.maximum('sequence', criteria)

    return (maxSequence ?? 0) + 1
  }

  async updateMessage(
    tenantId: string,
    messageId: string,
    data: DeepPartial<AdvisoryConversationMessage>,
  ): Promise<AdvisoryConversationMessage | null> {
    const safeData = { ...((data ?? {}) as Record<string, unknown>) }
    delete safeData.actorId
    delete safeData.role
    delete safeData.sessionId
    delete safeData.sequence
    delete safeData.stepIndex
    delete safeData.workflowKey

    return this.update(tenantId, messageId, safeData as DeepPartial<AdvisoryConversationMessage>)
  }

  async deleteMessage(tenantId: string, messageId: string): Promise<boolean> {
    return this.delete(tenantId, messageId)
  }

  private async lockSessionSequence(
    manager: EntityManager,
    tenantId: string,
    sessionId: string,
  ): Promise<void> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `conversation_messages:${tenantId}:${sessionId}`,
    ])
  }
}
