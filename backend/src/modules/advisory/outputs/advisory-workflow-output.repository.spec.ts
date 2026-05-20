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
    expect(typeormRepository.find).toHaveBeenCalledWith({
      where: {
        tenantId,
        sessionId,
      },
      order: {
        createdAt: 'DESC',
      },
    })
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
})
