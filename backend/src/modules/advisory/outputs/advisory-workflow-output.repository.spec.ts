import { Repository } from 'typeorm'
import {
  AdvisoryWorkflowOutput,
  AdvisoryWorkflowOutputSection,
  AdvisoryWorkflowOutputStatus,
} from '../../../database/entities/advisory-workflow-output.entity'
import { AdvisoryWorkflowOutputRepository } from './advisory-workflow-output.repository'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const secondaryTenantId = '660e8400-e29b-41d4-a716-446655440999'
const sessionId = '550e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'

function createSection(
  overrides: Partial<AdvisoryWorkflowOutputSection> = {},
): AdvisoryWorkflowOutputSection {
  return {
    id: 'section-1',
    stepIndex: 1,
    heading: 'Diagnose retention drop-off',
    contentMarkdown: '[AI Generated]\n\nRetention drops after the second session.',
    aiLabel: '[AI Generated]',
    metadata: {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      ai_generated: true,
      workflow_key: 'problem-solving',
      source_session_id: sessionId,
      source_message_id: 'assistant-message-1',
      provider: 'fake',
      model: 'fake-thinktank-model',
    },
    createdAt: '2026-05-20T00:00:00.000Z',
    ...overrides,
  }
}

function createOutput(overrides: Partial<AdvisoryWorkflowOutput> = {}): AdvisoryWorkflowOutput {
  return {
    id: '990e8400-e29b-41d4-a716-446655440000',
    tenantId,
    sessionId,
    actorId,
    workflowKey: 'problem-solving',
    status: AdvisoryWorkflowOutputStatus.Draft,
    title: 'Problem Solving Report Draft',
    summary: 'Live report draft for the problem-solving workflow.',
    contentMarkdown: '',
    sections: [],
    aiLabelMetadata: {
      visible_label: '[AI Generated]',
      ai_generated: true,
      machine_readable: true,
      source_session_id: sessionId,
      workflow_key: 'problem-solving',
      generated_at: '2026-05-20T00:00:00.000Z',
    },
    metadata: {
      section_count: 0,
      last_step_index: null,
    },
    createdAt: new Date('2026-05-20T00:00:00.000Z'),
    updatedAt: new Date('2026-05-20T00:00:00.000Z'),
    ...overrides,
  }
}

describe('AdvisoryWorkflowOutputRepository (ATDD RED)', () => {
  let typeormRepository: jest.Mocked<Repository<AdvisoryWorkflowOutput>>
  let repository: AdvisoryWorkflowOutputRepository

  beforeEach(() => {
    typeormRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as never

    repository = new AdvisoryWorkflowOutputRepository(typeormRepository)
  })

  test('[P0] creates workflow output drafts with current tenant scope and strips caller tenantId', async () => {
    const draft = createOutput()
    typeormRepository.create.mockReturnValue(draft)
    typeormRepository.save.mockResolvedValue(draft)

    await repository.createDraft(tenantId, {
      tenantId: secondaryTenantId,
      sessionId,
      actorId,
      workflowKey: 'problem-solving',
      status: AdvisoryWorkflowOutputStatus.Draft,
      title: 'Problem Solving Report Draft',
      summary: 'Live report draft for the problem-solving workflow.',
      contentMarkdown: '',
      sections: [],
      aiLabelMetadata: draft.aiLabelMetadata,
      metadata: draft.metadata,
    } as never)

    expect(typeormRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        sessionId,
        actorId,
        workflowKey: 'problem-solving',
        status: AdvisoryWorkflowOutputStatus.Draft,
        title: 'Problem Solving Report Draft',
        sections: [],
        aiLabelMetadata: expect.objectContaining({
          visible_label: '[AI Generated]',
          ai_generated: true,
          machine_readable: true,
        }),
      }),
    )
    expect(typeormRepository.create.mock.calls[0][0]).not.toMatchObject({
      tenantId: secondaryTenantId,
    })
  })

  test('[P0] reads active draft and lists outputs only inside tenant and session scope', async () => {
    const draft = createOutput()
    const completed = createOutput({
      id: '990e8400-e29b-41d4-a716-446655440001',
      status: AdvisoryWorkflowOutputStatus.Completed,
    })
    typeormRepository.findOne.mockResolvedValue(draft)
    typeormRepository.find.mockResolvedValue([completed, draft])

    await expect(repository.findActiveDraftForSession(tenantId, sessionId)).resolves.toBe(draft)
    await expect(repository.findOutputsBySession(tenantId, sessionId)).resolves.toEqual([
      completed,
      draft,
    ])

    expect(typeormRepository.findOne).toHaveBeenCalledWith({
      where: {
        tenantId,
        sessionId,
        status: AdvisoryWorkflowOutputStatus.Draft,
      },
      order: {
        updatedAt: 'DESC',
        createdAt: 'DESC',
      },
    })
    const findOptions = typeormRepository.find.mock.calls[0][0] as unknown as {
      where: { status: { _type: string; _value: AdvisoryWorkflowOutputStatus[] } }
    }
    expect(typeormRepository.find).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId,
        sessionId,
      }),
      order: {
        createdAt: 'DESC',
      },
    })
    expect(findOptions.where.status._type).toBe('in')
    expect(findOptions.where.status._value).toEqual([
      AdvisoryWorkflowOutputStatus.Draft,
      AdvisoryWorkflowOutputStatus.Completed,
    ])
  })

  test('[P0] appends a labeled section by direct output id without accepting nested tenant or output ownership fields', async () => {
    const draft = createOutput()
    const section = {
      ...createSection(),
      tenantId: secondaryTenantId,
      outputId: 'attacker-output',
    } as never
    const appended = createOutput({
      sections: [createSection()],
      contentMarkdown:
        '# Problem Solving Report Draft\n\n[AI Generated]\n\nRetention drops after the second session.',
      metadata: {
        section_count: 1,
        last_step_index: 1,
      },
    })
    typeormRepository.findOne.mockResolvedValueOnce(draft).mockResolvedValueOnce(appended)
    typeormRepository.update.mockResolvedValue({ affected: 1 } as never)

    await expect(repository.appendSection(tenantId, draft.id, section)).resolves.toBe(appended)

    expect(typeormRepository.findOne).toHaveBeenNthCalledWith(1, {
      where: { id: draft.id, tenantId },
    })
    expect(typeormRepository.update).toHaveBeenCalledWith(
      { id: draft.id, tenantId },
      expect.objectContaining({
        sections: [
          expect.objectContaining({
            id: 'section-1',
            stepIndex: 1,
            aiLabel: '[AI Generated]',
            metadata: expect.objectContaining({
              ai_generated: true,
              workflow_key: 'problem-solving',
            }),
          }),
        ],
        contentMarkdown: expect.stringContaining('[AI Generated]'),
        metadata: expect.objectContaining({
          section_count: 1,
          last_step_index: 1,
        }),
      }),
    )
    expect(JSON.stringify(typeormRepository.update.mock.calls[0][1])).not.toContain(
      secondaryTenantId,
    )
    expect(JSON.stringify(typeormRepository.update.mock.calls[0][1])).not.toContain(
      'attacker-output',
    )
  })

  test('[P0] marks an output completed with tenant-scoped ownership criteria and completion metadata', async () => {
    const draft = createOutput({ sections: [createSection()] })
    const completed = createOutput({
      status: AdvisoryWorkflowOutputStatus.Completed,
      sections: [createSection()],
      metadata: {
        section_count: 1,
        last_step_index: 1,
        completed_at: '2026-05-20T00:03:00.000Z',
        outcome: 'success',
      },
    })
    typeormRepository.findOne.mockResolvedValueOnce(draft).mockResolvedValueOnce(completed)
    typeormRepository.update.mockResolvedValue({ affected: 1 } as never)

    await expect(
      repository.markCompleted(tenantId, draft.id, {
        outcome: 'success',
        completedAt: '2026-05-20T00:03:00.000Z',
      }),
    ).resolves.toBe(completed)

    expect(typeormRepository.update).toHaveBeenCalledWith(
      { id: draft.id, tenantId },
      expect.objectContaining({
        status: AdvisoryWorkflowOutputStatus.Completed,
        metadata: expect.objectContaining({
          section_count: 1,
          completed_at: '2026-05-20T00:03:00.000Z',
          outcome: 'success',
        }),
      }),
    )
  })

  test('[P0] returns null for cross-tenant direct-id read, append, and complete attempts without leaking metadata', async () => {
    const foreignOutput = createOutput({ tenantId: secondaryTenantId })
    typeormRepository.findOne.mockResolvedValue(null)
    typeormRepository.update.mockResolvedValue({ affected: 0 } as never)

    await expect(repository.findOutputById(tenantId, foreignOutput.id)).resolves.toBeNull()
    await expect(
      repository.appendSection(tenantId, foreignOutput.id, createSection()),
    ).resolves.toBeNull()
    await expect(
      repository.markCompleted(tenantId, foreignOutput.id, {
        outcome: 'success',
        completedAt: '2026-05-20T00:04:00.000Z',
      }),
    ).resolves.toBeNull()

    expect(typeormRepository.findOne).toHaveBeenCalledWith({
      where: { id: foreignOutput.id, tenantId },
    })
    expect(typeormRepository.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: secondaryTenantId }),
      expect.anything(),
    )
  })

  test('[P0][4.3-BE-005][AC2] searches output history inside tenant actor scope without unbounded loads', async () => {
    const completed = createOutput({
      status: AdvisoryWorkflowOutputStatus.Completed,
      title: 'Retention Diagnosis',
      summary: 'Users drop after setup.',
      contentMarkdown: '# Retention Diagnosis\n\nGuided setup is missing.',
      updatedAt: new Date('2026-05-21T01:08:00.000Z'),
    })
    const queryBuilder = createSelectQueryBuilderMock([completed], 1)
    typeormRepository.createQueryBuilder.mockReturnValue(queryBuilder as never)

    await expect(
      repository.findHistoryOutputsForActor(tenantId, actorId, {
        q: 'setup',
        workflowKey: 'problem-solving',
        status: 'completed',
        from: new Date('2026-05-20T00:00:00.000Z'),
        to: new Date('2026-05-22T00:00:00.000Z'),
        take: 20,
      }),
    ).resolves.toEqual({ items: [completed], total: 1 })

    expect(typeormRepository.createQueryBuilder).toHaveBeenCalledWith('output')
    expect(queryBuilder.innerJoin).toHaveBeenCalled()
    expect(queryBuilder.where).toHaveBeenCalledWith('output.tenant_id = :tenantId', {
      tenantId,
    })
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('output.actor_id = :actorId', {
      actorId,
    })
    const whereCalls = JSON.stringify(queryBuilder.andWhere.mock.calls)
    expect(whereCalls).toContain('content_markdown')
    expect(whereCalls).toContain('contentMarkdown')
    expect(whereCalls).toContain('LOWER')
    expect(whereCalls).toContain('ESCAPE')
    expect(whereCalls).not.toContain('sections::text')
    expect(queryBuilder.take).toHaveBeenCalledWith(20)
    expect(queryBuilder.getManyAndCount).toHaveBeenCalled()
    expect(typeormRepository.find).not.toHaveBeenCalled()
  })

  test('[P0][4.7-BE-004][AC2,AC3] refuses stale output tombstone updates after a concurrent delete', async () => {
    const output = createOutput({ status: AdvisoryWorkflowOutputStatus.Completed })
    typeormRepository.findOne.mockResolvedValueOnce(output)
    typeormRepository.update.mockResolvedValueOnce({ affected: 0 } as never)

    await expect(
      repository.tombstoneOutputForSession({
        tenantId,
        actorId,
        sessionId,
        outputId: output.id,
        deletedAt: '2026-05-21T01:12:00.000Z',
      }),
    ).resolves.toBeNull()

    expect(typeormRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: output.id,
        tenantId,
        sessionId,
        actorId,
      }),
      expect.objectContaining({
        status: AdvisoryWorkflowOutputStatus.Deleted,
      }),
    )
    expect(typeormRepository.findOne).toHaveBeenCalledTimes(1)
  })

  test('[P0][4.3-BE-005][AC2] escapes output search wildcards without searching section metadata', async () => {
    const queryBuilder = createSelectQueryBuilderMock([], 0)
    typeormRepository.createQueryBuilder.mockReturnValue(queryBuilder as never)

    await repository.findHistoryOutputsForActor(tenantId, actorId, {
      q: '50%_done\\',
      take: 10,
    })

    const whereCalls = JSON.stringify(queryBuilder.andWhere.mock.calls)
    const searchCall = queryBuilder.andWhere.mock.calls.find((call) =>
      JSON.stringify(call).includes('historySearch'),
    )
    expect(searchCall?.[1]).toEqual({ historySearch: '%50\\%\\_done\\\\%' })
    expect(whereCalls).toContain("history_section.value ->> 'contentMarkdown'")
    expect(whereCalls).not.toContain('metadata')
    expect(whereCalls).not.toContain('sections::text')
  })

  test('[P0][4.3-BE-005][AC1] batches latest persisted outputs for history session cards', async () => {
    const draft = createOutput({
      id: '990e8400-e29b-41d4-a716-446655440001',
      status: AdvisoryWorkflowOutputStatus.Draft,
      updatedAt: new Date('2026-05-21T01:10:00.000Z'),
    })
    const olderCompleted = createOutput({
      id: '990e8400-e29b-41d4-a716-446655440002',
      status: AdvisoryWorkflowOutputStatus.Completed,
      updatedAt: new Date('2026-05-21T01:08:00.000Z'),
    })
    const queryBuilder = createSelectQueryBuilderMock([draft, olderCompleted], 2)
    typeormRepository.createQueryBuilder.mockReturnValue(queryBuilder as never)

    await expect(
      repository.findLatestPersistedBySessionIds(tenantId, [sessionId, sessionId]),
    ).resolves.toEqual([draft])

    const whereCalls = JSON.stringify(queryBuilder.andWhere.mock.calls)
    expect(whereCalls).toContain('session_id IN')
    expect(whereCalls).toContain('historyStatuses')
    expect(queryBuilder.getMany).toHaveBeenCalled()
  })

  test('[P0][4.3-BE-006][AC2] rejects output search without a scoped actor id', async () => {
    await expect(repository.findHistoryOutputsForActor(tenantId, '', { take: 10 })).rejects.toThrow(
      'id is required for tenant-scoped repository access',
    )
    expect(typeormRepository.createQueryBuilder).not.toHaveBeenCalled()
  })
})

function createSelectQueryBuilderMock<T>(items: T[], total: number) {
  return {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([items, total]),
    getMany: jest.fn().mockResolvedValue(items),
  }
}
