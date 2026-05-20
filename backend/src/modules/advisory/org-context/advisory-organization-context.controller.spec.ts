import { AdvisoryOrganizationContextController } from './advisory-organization-context.controller'

describe('AdvisoryOrganizationContextController', () => {
  it('returns the standard envelope using trusted user and tenant context', async () => {
    const service = {
      getOrganizationContext: jest.fn().mockResolvedValue({
        context: null,
        completenessScore: 0,
        completeness: {
          requiredFieldsComplete: false,
          missingFields: ['organizationName', 'industry', 'size'],
          updatedAt: null,
        },
        appliedToPrompts: false,
      }),
    }
    const controller = new AdvisoryOrganizationContextController(service as never)
    const user = { id: 'user-1', organizationId: 'org-1' }

    await expect(controller.getOrganizationContext(user as never, 'tenant-1')).resolves.toEqual({
      data: {
        context: null,
        completenessScore: 0,
        completeness: {
          requiredFieldsComplete: false,
          missingFields: ['organizationName', 'industry', 'size'],
          updatedAt: null,
        },
        appliedToPrompts: false,
      },
    })
    expect(service.getOrganizationContext).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
    })
  })

  it('forwards only organization fields for save and ignores browser-owned scope/completeness fields', async () => {
    const service = {
      upsertOrganizationContext: jest.fn().mockResolvedValue({
        id: 'context-1',
        organizationName: 'Tenant A Security Group',
        industry: 'Data security',
        size: null,
      }),
    }
    const controller = new AdvisoryOrganizationContextController(service as never)
    const user = { id: 'user-1', organizationId: 'org-1' }

    await expect(
      controller.upsertOrganizationContext(user as never, 'tenant-1', {
        organizationName: '  Tenant A Security Group  ',
        industry: '  Data security  ',
        size: '   ',
        tenantId: 'attacker-tenant',
        actorId: 'attacker-actor',
        contextType: 'attacker-type',
        completenessScore: 100,
        completenessMetadata: { missingFields: [] },
      } as never),
    ).resolves.toEqual({
      data: {
        id: 'context-1',
        organizationName: 'Tenant A Security Group',
        industry: 'Data security',
        size: null,
      },
    })

    expect(service.upsertOrganizationContext).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
      organizationName: 'Tenant A Security Group',
      industry: 'Data security',
      size: undefined,
    })
  })
})
