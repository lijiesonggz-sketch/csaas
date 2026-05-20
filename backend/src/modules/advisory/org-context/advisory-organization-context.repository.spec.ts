import { AdvisoryOrganizationContextRepository } from './advisory-organization-context.repository'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const tenantB = '111e8400-e29b-41d4-a716-446655440000'
const contextId = '990e8400-e29b-41d4-a716-446655440036'

describe('AdvisoryOrganizationContextRepository', () => {
  it('uses BaseRepository tenant scoping for enterprise background find and update', async () => {
    const typeormRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((entity) => entity),
      save: jest.fn(async (entity) => ({ id: contextId, ...entity })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    }
    const repository = new AdvisoryOrganizationContextRepository(typeormRepository as never)

    await repository.findEnterpriseBackground(tenantId)
    expect(typeormRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId,
          contextType: 'enterprise_background',
        }),
      }),
    )

    await repository.updateEnterpriseBackground(tenantId, contextId, {
      id: 'attacker-id',
      tenantId: tenantB,
      createdAt: new Date('2026-05-19T00:00:00.000Z'),
      updatedAt: new Date('2026-05-19T00:00:00.000Z'),
      contextType: 'enterprise_background',
      contextData: { organizationName: 'Tenant A', industry: null, size: null },
      completenessScore: 34,
    } as never)

    expect(typeormRepository.update).toHaveBeenCalledWith(
      { id: contextId, tenantId },
      expect.not.objectContaining({
        id: 'attacker-id',
        tenantId: tenantB,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    )
  })

  it('strips immutable fields from enterprise background create payloads', async () => {
    const typeormRepository = {
      create: jest.fn((entity) => entity),
      save: jest.fn(async (entity) => ({ id: contextId, ...entity })),
    }
    const repository = new AdvisoryOrganizationContextRepository(typeormRepository as never)

    await repository.createEnterpriseBackground(tenantId, {
      id: 'attacker-id',
      tenantId: tenantB,
      createdAt: new Date('2026-05-19T00:00:00.000Z'),
      updatedAt: new Date('2026-05-19T00:00:00.000Z'),
      contextType: 'enterprise_background',
      contextData: { organizationName: 'Tenant A', industry: null, size: null },
    } as never)

    expect(typeormRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        contextType: 'enterprise_background',
      }),
    )
    expect(typeormRepository.create).toHaveBeenCalledWith(
      expect.not.objectContaining({
        id: 'attacker-id',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    )
  })
})
