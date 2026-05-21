import { Injectable } from '@nestjs/common'

export const KNOWLEDGE_BASE_ASSOCIATION_PORT = Symbol('KNOWLEDGE_BASE_ASSOCIATION_PORT')

export interface KnowledgeBaseAssociationInput {
  tenantId: string
  userId: string
  outputId: string
  title: string
  summary: string
  filePath: string
  aiMetadata: Record<string, unknown>
}

export interface KnowledgeBaseAssociationResult {
  status: 'associated' | 'pending' | 'failed'
  externalReferenceId?: string
  message?: string
}

export interface KnowledgeBaseAssociationPort {
  associateOutput(input: KnowledgeBaseAssociationInput): Promise<KnowledgeBaseAssociationResult>
}

@Injectable()
export class PendingKnowledgeBaseAssociationAdapter implements KnowledgeBaseAssociationPort {
  async associateOutput(): Promise<KnowledgeBaseAssociationResult> {
    return {
      status: 'pending',
      message: '知识库暂不可用，报告仍保留在 ThinkTank，可稍后重试。',
    }
  }
}
