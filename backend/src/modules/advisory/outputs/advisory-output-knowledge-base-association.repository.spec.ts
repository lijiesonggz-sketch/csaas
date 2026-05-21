import { AdvisoryOutputKnowledgeBaseAssociationRepository } from './advisory-output-knowledge-base-association.repository'

describe('AdvisoryOutputKnowledgeBaseAssociationRepository', () => {
  const tenantId = '660e8400-e29b-41d4-a716-446655440000'
  const actorId = '770e8400-e29b-41d4-a716-446655440000'
  const sessionId = '550e8400-e29b-41d4-a716-446655440000'
  const outputId = '990e8400-e29b-41d4-a716-446655440000'

  function createRepository(queryResult: Record<string, unknown>[] = []) {
    const repository = {
      query: jest.fn().mockResolvedValue(queryResult),
      createQueryBuilder: jest.fn(),
    }

    return {
      repository,
      subject: new AdvisoryOutputKnowledgeBaseAssociationRepository(repository as never),
    }
  }

  test('[P0][4.5-BE-003][AC1,AC2] atomically upserts association attempts by tenant output and destination', async () => {
    const { subject, repository } = createRepository([
      {
        id: 'association-1',
        tenantId,
        actorId,
        outputId,
        sessionId,
        destinationKey: 'enterprise-knowledge-base',
        status: 'pending',
        title: 'Retention Diagnosis',
        summary: 'Users drop after setup.',
        sourceWorkflow: 'problem-solving',
        filePath: `thinktank://tenant/${tenantId}/advisory/outputs/${outputId}`,
        aiMetadata: { ai_generated: true, sourceWorkflow: 'problem-solving' },
        externalReferenceId: null,
        message: '知识库暂不可用，报告仍保留在 ThinkTank，可稍后重试。',
        retryCount: 1,
        lastAttemptAt: '2026-05-21T08:00:00.000Z',
        associatedAt: null,
        metadata: { messageCategory: 'adapter_unavailable' },
        createdAt: '2026-05-21T08:00:00.000Z',
        updatedAt: '2026-05-21T08:00:00.000Z',
      },
    ])

    await expect(
      subject.upsertAttempt(tenantId, {
        actorId,
        sessionId,
        outputId,
        destinationKey: 'enterprise-knowledge-base',
        status: 'pending',
        title: 'Retention Diagnosis',
        summary: 'Users drop after setup.',
        sourceWorkflow: 'problem-solving',
        filePath: `thinktank://tenant/${tenantId}/advisory/outputs/${outputId}`,
        aiMetadata: { ai_generated: true, sourceWorkflow: 'problem-solving' },
        message: '知识库暂不可用，报告仍保留在 ThinkTank，可稍后重试。',
        metadata: { messageCategory: 'adapter_unavailable' },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        outputId,
        status: 'pending',
        retryCount: 1,
      }),
    )

    expect(repository.query.mock.calls[0][0]).toContain(
      'ON CONFLICT ("tenant_id", "output_id", "destination_key") DO UPDATE',
    )
    expect(repository.query.mock.calls[0][0]).toContain(
      '"retry_count" = "output_knowledge_base_associations"."retry_count" + 1',
    )
    expect(repository.query.mock.calls[0][0]).toContain(
      `WHEN "output_knowledge_base_associations"."status" = 'associated'`,
    )
  })

  test('[P0][4.5-BE-004][AC3] batch-loads current tenant association states without N+1 queries', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          outputId,
          destinationKey: 'enterprise-knowledge-base',
          status: 'associated',
          externalReferenceId: 'kb-ref-1',
          message: null,
          retryCount: 1,
          updatedAt: new Date('2026-05-21T08:05:00.000Z'),
          associatedAt: new Date('2026-05-21T08:05:00.000Z'),
        },
      ]),
    }
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    }
    const subject = new AdvisoryOutputKnowledgeBaseAssociationRepository(repository as never)

    await expect(subject.findStatesForOutputIds(tenantId, [outputId, outputId])).resolves.toEqual([
      expect.objectContaining({
        outputId,
        status: 'associated',
        externalReferenceId: 'kb-ref-1',
      }),
    ])

    expect(queryBuilder.where).toHaveBeenCalledWith('association.tenant_id = :tenantId', {
      tenantId,
    })
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('association.output_id IN (:...outputIds)', {
      outputIds: [outputId],
    })
  })
})
