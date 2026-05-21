import { Repository } from 'typeorm'
import {
  AdvisoryWorkflowSession,
  AdvisoryWorkflowSessionStatus,
} from '../../../database/entities/advisory-workflow-session.entity'
import { AdvisorySessionRepository } from './advisory-session.repository'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const secondaryTenantId = '660e8400-e29b-41d4-a716-446655440999'

function createSession(overrides: Partial<AdvisoryWorkflowSession> = {}): AdvisoryWorkflowSession {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    tenantId,
    actorId: '770e8400-e29b-41d4-a716-446655440000',
    workflowKey: 'brainstorming',
    workflowDisplayName: 'Brainstorming',
    scenarioLabel: 'Creative ideation',
    status: AdvisoryWorkflowSessionStatus.Active,
    currentStep: {
      index: 1,
      label: '当前步骤',
      sourceRef: '_bmad/core/skills/bmad-brainstorming/steps/step-01-session-setup.md',
    },
    sourceRefs: [
      '_bmad/core/skills/bmad-brainstorming/workflow.md',
      '_bmad/core/skills/bmad-brainstorming/steps/step-01-session-setup.md',
    ],
    metadata: {
      workflow_key: 'brainstorming',
      source_ref_count: 2,
    },
    failureCode: null,
    failureMessage: null,
    createdAt: new Date('2026-05-20T00:00:00.000Z'),
    updatedAt: new Date('2026-05-20T00:00:00.000Z'),
    ...overrides,
  }
}

describe('AdvisorySessionRepository', () => {
  let typeormRepository: jest.Mocked<Repository<AdvisoryWorkflowSession>>
  let repository: AdvisorySessionRepository

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

    repository = new AdvisorySessionRepository(typeormRepository)
  })

  it('creates launch sessions with current tenant scope even if caller passes another tenantId', async () => {
    const session = createSession()
    typeormRepository.create.mockReturnValue(session)
    typeormRepository.save.mockResolvedValue(session)

    await repository.createLaunchSession(tenantId, {
      tenantId: secondaryTenantId,
      actorId: session.actorId,
      workflowKey: session.workflowKey,
      workflowDisplayName: session.workflowDisplayName,
      scenarioLabel: session.scenarioLabel,
      status: AdvisoryWorkflowSessionStatus.Active,
      currentStep: session.currentStep,
      sourceRefs: session.sourceRefs,
      metadata: session.metadata,
    } as never)

    expect(typeormRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        actorId: session.actorId,
        workflowKey: 'brainstorming',
      }),
    )
  })

  it('reads sessions only within the requested tenant scope', async () => {
    const session = createSession()
    typeormRepository.findOne.mockResolvedValue(session)

    const result = await repository.findSessionById(tenantId, session.id)

    expect(result).toBe(session)
    expect(typeormRepository.findOne).toHaveBeenCalledWith({
      where: { id: session.id, tenantId },
    })
  })

  it('finds active sessions by tenant and actor before launch', async () => {
    const session = createSession()
    typeormRepository.findOne.mockResolvedValue(session)

    const result = await repository.findActiveSessionForActor(tenantId, session.actorId)

    expect(result).toBe(session)
    expect(typeormRepository.findOne).toHaveBeenCalledWith({
      where: {
        tenantId,
        actorId: session.actorId,
        status: AdvisoryWorkflowSessionStatus.Active,
      },
    })
  })

  it('[P0][4.2-BE-008][AC1] finds unfinished sessions by tenant actor active status and newest activity', async () => {
    const session = createSession()
    typeormRepository.find.mockResolvedValue([session])

    const result = await repository.findUnfinishedSessionsForActor(tenantId, session.actorId)

    expect(result).toEqual([session])
    expect(typeormRepository.find).toHaveBeenCalledWith({
      where: {
        tenantId,
        actorId: session.actorId,
        status: AdvisoryWorkflowSessionStatus.Active,
      },
      order: {
        updatedAt: 'DESC',
        createdAt: 'DESC',
      },
      take: 10,
    })
  })

  it('[P0][4.2-BE-009][AC1] rejects unfinished session lookup without a scoped actor id', async () => {
    await expect(repository.findUnfinishedSessionsForActor(tenantId, '')).rejects.toThrow(
      'id is required for tenant-scoped repository access',
    )
    expect(typeormRepository.find).not.toHaveBeenCalled()
  })

  it('updates sessions with scoped ownership criteria and strips create-only fields', async () => {
    const session = createSession({ status: AdvisoryWorkflowSessionStatus.Active })
    typeormRepository.update.mockResolvedValue({ affected: 1 } as never)
    typeormRepository.findOne.mockResolvedValue(session)

    await repository.updateSession(tenantId, session.id, {
      id: 'other-id',
      tenantId: secondaryTenantId,
      actorId: 'new-actor',
      workflowKey: 'prd',
      workflowDisplayName: 'PRD',
      scenarioLabel: 'Product requirements',
      status: AdvisoryWorkflowSessionStatus.Active,
      metadata: { workflow_key: 'brainstorming', source_ref_count: 2 },
    } as never)

    expect(typeormRepository.update).toHaveBeenCalledWith(
      { id: session.id, tenantId },
      {
        status: AdvisoryWorkflowSessionStatus.Active,
        metadata: { workflow_key: 'brainstorming', source_ref_count: 2 },
      },
    )
    expect(typeormRepository.findOne).toHaveBeenCalledWith({
      where: { id: session.id, tenantId },
    })
  })

  it('does not infer cross-tenant session existence during update or delete', async () => {
    const session = createSession({ tenantId: secondaryTenantId })
    typeormRepository.update.mockResolvedValue({ affected: 0 } as never)
    typeormRepository.findOne.mockResolvedValue(null)
    typeormRepository.delete.mockResolvedValue({ affected: 0 } as never)

    await expect(
      repository.updateSession(tenantId, session.id, {
        status: AdvisoryWorkflowSessionStatus.Active,
      }),
    ).resolves.toBeNull()
    await expect(repository.deleteSession(tenantId, session.id)).resolves.toBe(false)

    expect(typeormRepository.update).toHaveBeenCalledWith(
      { id: session.id, tenantId },
      { status: AdvisoryWorkflowSessionStatus.Active },
    )
    expect(typeormRepository.delete).toHaveBeenCalledWith({ id: session.id, tenantId })
  })
})
