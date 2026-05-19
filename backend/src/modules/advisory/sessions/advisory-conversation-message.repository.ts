import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DeepPartial, FindOptionsWhere, Repository } from 'typeorm'
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
}
