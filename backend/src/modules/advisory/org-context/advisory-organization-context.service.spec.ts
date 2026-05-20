import { BadRequestException, ForbiddenException } from '@nestjs/common'
import {
  ADVISORY_ORGANIZATION_CONTEXT_ENTERPRISE_BACKGROUND,
  AdvisoryOrganizationContext,
} from '../../../database/entities/advisory-organization-context.entity'
import { AdvisoryOrganizationContextService } from './advisory-organization-context.service'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const contextId = '990e8400-e29b-41d4-a716-446655440036'
const user = {
  id: actorId,
  organizationId: '880e8400-e29b-41d4-a716-446655440000',
  role: 'consultant',
}

function createEntity(
  overrides: Partial<AdvisoryOrganizationContext> = {},
): AdvisoryOrganizationContext {
  return {
    id: contextId,
    tenantId,
    contextType: ADVISORY_ORGANIZATION_CONTEXT_ENTERPRISE_BACKGROUND,
    contextData: {
      organizationName: 'Tenant A Security Group',
      industry: 'Data security',
      size: '201-500',
    },
    completenessScore: 100,
    completenessMetadata: {
      requiredFieldsComplete: true,
      suppliedFields: ['organizationName', 'industry', 'size'],
      missingFields: [],
      updatedAt: '2026-05-20T15:33:04.000Z',
    },
    createdAt: new Date('2026-05-20T15:30:00.000Z'),
    updatedAt: new Date('2026-05-20T15:33:04.000Z'),
    ...overrides,
  } as AdvisoryOrganizationContext
}

function createRepository(record: AdvisoryOrganizationContext | null = null) {
  return {
    findEnterpriseBackground: jest.fn().mockResolvedValue(record),
    createEnterpriseBackground: jest
      .fn()
      .mockImplementation(async (_tenantId: string, data: Partial<AdvisoryOrganizationContext>) =>
        createEntity({
          tenantId: _tenantId,
          ...data,
          updatedAt: new Date('2026-05-20T15:33:04.000Z'),
        }),
      ),
    updateEnterpriseBackground: jest
      .fn()
      .mockImplementation(
        async (_tenantId: string, _contextId: string, data: Partial<AdvisoryOrganizationContext>) =>
          createEntity({
            id: _contextId,
            tenantId: _tenantId,
            ...data,
            updatedAt: new Date('2026-05-20T15:40:00.000Z'),
          }),
      ),
  }
}

function createAccessService() {
  return {
    assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
  }
}

function createService(repository: ReturnType<typeof createRepository>) {
  const accessService = createAccessService()
  const service = new AdvisoryOrganizationContextService(
    repository as never,
    accessService as never,
  )

  return { service, accessService }
}

describe('AdvisoryOrganizationContextService', () => {
  it('returns a first-use envelope for the current tenant when no context exists', async () => {
    const repository = createRepository(null)
    const { service, accessService } = createService(repository)

    await expect(service.getOrganizationContext({ user, tenantId })).resolves.toEqual({
      context: null,
      completenessScore: 0,
      completeness: {
        requiredFieldsComplete: false,
        missingFields: ['organizationName', 'industry', 'size'],
        updatedAt: null,
      },
      appliedToPrompts: false,
    })
    expect(accessService.assertThinkTankModuleAvailable).toHaveBeenCalledWith(user, tenantId)
    expect(repository.findEnterpriseBackground).toHaveBeenCalledWith(tenantId)
  })

  it('rejects missing trusted tenant or actor before access checks and repository reads', async () => {
    const repository = createRepository(null)
    const { service, accessService } = createService(repository)

    await expect(service.getOrganizationContext({ user, tenantId: '' })).rejects.toThrow(
      BadRequestException,
    )
    await expect(
      service.upsertOrganizationContext({
        user: { ...user, id: '' },
        tenantId,
        organizationName: 'Tenant A Security Group',
      }),
    ).rejects.toThrow(BadRequestException)

    expect(accessService.assertThinkTankModuleAvailable).not.toHaveBeenCalled()
    expect(repository.findEnterpriseBackground).not.toHaveBeenCalled()
    expect(repository.createEnterpriseBackground).not.toHaveBeenCalled()
    expect(repository.updateEnterpriseBackground).not.toHaveBeenCalled()
  })

  it('propagates ThinkTank module access denial without reading or writing organization context', async () => {
    const repository = createRepository(null)
    const { service, accessService } = createService(repository)
    accessService.assertThinkTankModuleAvailable.mockRejectedValue(
      new ForbiddenException('ThinkTank unavailable'),
    )

    await expect(service.getOrganizationContext({ user, tenantId })).rejects.toThrow(
      ForbiddenException,
    )
    await expect(
      service.upsertOrganizationContext({
        user,
        tenantId,
        organizationName: 'Tenant A Security Group',
      }),
    ).rejects.toThrow(ForbiddenException)

    expect(repository.findEnterpriseBackground).not.toHaveBeenCalled()
    expect(repository.createEnterpriseBackground).not.toHaveBeenCalled()
    expect(repository.updateEnterpriseBackground).not.toHaveBeenCalled()
  })

  it('creates a tenant enterprise background record with trimmed fields and server-owned completeness', async () => {
    const repository = createRepository(null)
    const { service } = createService(repository)

    const result = await service.upsertOrganizationContext({
      user,
      tenantId,
      organizationName: '  Tenant A Security Group  ',
      industry: '  Data security  ',
      size: '   ',
      tenantIdFromBody: '111e8400-e29b-41d4-a716-446655440000',
      actorIdFromBody: 'attacker-actor',
      contextType: 'attacker_context_type',
      completenessScore: 100,
    } as never)

    expect(repository.createEnterpriseBackground).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        contextType: ADVISORY_ORGANIZATION_CONTEXT_ENTERPRISE_BACKGROUND,
        contextData: {
          organizationName: 'Tenant A Security Group',
          industry: 'Data security',
          size: null,
        },
        completenessScore: 67,
        completenessMetadata: expect.objectContaining({
          requiredFieldsComplete: true,
          suppliedFields: ['organizationName', 'industry'],
          missingFields: ['size'],
        }),
      }),
    )
    expect(JSON.stringify(repository.createEnterpriseBackground.mock.calls)).not.toContain(
      '111e8400-e29b-41d4-a716-446655440000',
    )
    expect(result).toEqual(
      expect.objectContaining({
        id: contextId,
        organizationName: 'Tenant A Security Group',
        industry: 'Data security',
        size: null,
        completenessScore: 67,
        completeness: expect.objectContaining({
          requiredFieldsComplete: true,
          missingFields: ['size'],
        }),
        appliedToPrompts: false,
      }),
    )
  })

  it('rejects missing, blank, and over-limit organization names before repository writes', async () => {
    const repository = createRepository(null)
    const { service } = createService(repository)

    for (const organizationName of [undefined, null, '', '   ']) {
      await expect(
        service.upsertOrganizationContext({
          user,
          tenantId,
          organizationName,
        } as never),
      ).rejects.toThrow(BadRequestException)
    }

    await expect(
      service.upsertOrganizationContext({
        user,
        tenantId,
        organizationName: 'A'.repeat(501),
      }),
    ).rejects.toThrow(BadRequestException)

    expect(repository.createEnterpriseBackground).not.toHaveBeenCalled()
    expect(repository.updateEnterpriseBackground).not.toHaveBeenCalled()
  })

  it('treats control-character-only optional fields as absent for completeness and prompts', async () => {
    const repository = createRepository(null)
    const { service } = createService(repository)

    const result = await service.upsertOrganizationContext({
      user,
      tenantId,
      organizationName: 'Tenant A Security Group',
      industry: '\u200b\u200c',
      size: '201-500',
    })

    expect(repository.createEnterpriseBackground).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        contextData: {
          organizationName: 'Tenant A Security Group',
          industry: null,
          size: '201-500',
        },
        completenessScore: 67,
        completenessMetadata: expect.objectContaining({
          suppliedFields: ['organizationName', 'size'],
          missingFields: ['industry'],
        }),
      }),
    )
    expect(result.industry).toBeNull()
  })

  it('stores single-line visible organization fields before they can be applied to prompts', async () => {
    const repository = createRepository(null)
    const { service } = createService(repository)

    await service.upsertOrganizationContext({
      user,
      tenantId,
      organizationName: 'Tenant\nA\u200b Security\tGroup',
      industry: 'Data\nsecurity',
      size: '\u200b201-500\u200c',
    })

    expect(repository.createEnterpriseBackground).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        contextData: {
          organizationName: 'Tenant A Security Group',
          industry: 'Data security',
          size: '201-500',
        },
      }),
    )
  })

  it('retries as an update when concurrent first-use creates hit the tenant context uniqueness guard', async () => {
    const existing = createEntity({
      contextData: {
        organizationName: 'Tenant A Security Group',
        industry: null,
        size: null,
      },
    })
    const uniqueViolation = Object.assign(new Error('duplicate key'), { code: '23505' })
    const repository = createRepository(null)
    repository.createEnterpriseBackground.mockRejectedValueOnce(uniqueViolation)
    repository.findEnterpriseBackground.mockResolvedValueOnce(null).mockResolvedValueOnce(existing)
    const { service } = createService(repository)

    await service.upsertOrganizationContext({
      user,
      tenantId,
      organizationName: 'Tenant A Security Group',
      industry: 'Data security',
      size: '201-500',
    })

    expect(repository.updateEnterpriseBackground).toHaveBeenCalledWith(
      tenantId,
      contextId,
      expect.objectContaining({
        contextData: {
          organizationName: 'Tenant A Security Group',
          industry: 'Data security',
          size: '201-500',
        },
      }),
    )
  })

  it('updates only the current tenant owned context and recomputes completeness', async () => {
    const repository = createRepository(
      createEntity({
        contextData: {
          organizationName: 'Tenant A Security Group',
          industry: null,
          size: null,
        },
        completenessScore: 34,
        completenessMetadata: {
          requiredFieldsComplete: true,
          suppliedFields: ['organizationName'],
          missingFields: ['industry', 'size'],
          updatedAt: '2026-05-20T15:30:00.000Z',
        },
      }),
    )
    const { service } = createService(repository)

    const result = await service.upsertOrganizationContext({
      user,
      tenantId,
      organizationName: ' Tenant A Security Group ',
      industry: ' Compliance ',
      size: ' 201-500 ',
      id: 'attacker-id',
      tenantIdFromBody: '111e8400-e29b-41d4-a716-446655440000',
    } as never)

    expect(repository.findEnterpriseBackground).toHaveBeenCalledWith(tenantId)
    expect(repository.updateEnterpriseBackground).toHaveBeenCalledWith(
      tenantId,
      contextId,
      expect.objectContaining({
        contextType: ADVISORY_ORGANIZATION_CONTEXT_ENTERPRISE_BACKGROUND,
        contextData: {
          organizationName: 'Tenant A Security Group',
          industry: 'Compliance',
          size: '201-500',
        },
        completenessScore: 100,
        completenessMetadata: expect.objectContaining({
          suppliedFields: ['organizationName', 'industry', 'size'],
          missingFields: [],
        }),
      }),
    )
    expect(result).toEqual(
      expect.objectContaining({
        organizationName: 'Tenant A Security Group',
        industry: 'Compliance',
        size: '201-500',
        completenessScore: 100,
        completeness: expect.objectContaining({ missingFields: [] }),
      }),
    )
  })

  it('returns prompt context for the requested tenant only and null when absent', async () => {
    const repository = createRepository(createEntity())
    const { service } = createService(repository)

    await expect(service.getPromptContext(tenantId)).resolves.toEqual({
      contextId,
      organizationName: 'Tenant A Security Group',
      industry: 'Data security',
      size: '201-500',
      completenessScore: 100,
      completeness: {
        requiredFieldsComplete: true,
        missingFields: [],
        updatedAt: '2026-05-20T15:33:04.000Z',
      },
    })
    expect(repository.findEnterpriseBackground).toHaveBeenCalledWith(tenantId)

    repository.findEnterpriseBackground.mockResolvedValueOnce(null)
    await expect(service.getPromptContext(tenantId)).resolves.toBeNull()
  })

  it('does not expose corrupted persisted context without a visible organization name', async () => {
    const repository = createRepository(
      createEntity({
        contextData: {
          organizationName: '\u200b',
          industry: 'Data security',
          size: '201-500',
        },
      }),
    )
    const { service } = createService(repository)

    await expect(service.getOrganizationContext({ user, tenantId })).resolves.toEqual({
      context: null,
      completenessScore: 0,
      completeness: {
        requiredFieldsComplete: false,
        missingFields: ['organizationName', 'industry', 'size'],
        updatedAt: null,
      },
      appliedToPrompts: false,
    })
    await expect(service.getPromptContext(tenantId)).resolves.toBeNull()
  })
})
