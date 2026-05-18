import 'reflect-metadata'
import { UserRole } from '../../../database/entities/user.entity'
import { AdvisoryAdminController } from './advisory-admin.controller'
import { AdvisoryAdminService } from './advisory-admin.service'

describe('AdvisoryAdminController', () => {
  let controller: AdvisoryAdminController
  let service: jest.Mocked<Pick<AdvisoryAdminService, 'getModuleConfig' | 'updateModuleConfig'>>

  const adminUser = {
    id: 'user-1',
    role: UserRole.ADMIN,
    tenantId: 'tenant-1',
    organizationId: 'tenant-1',
  }

  beforeEach(() => {
    service = {
      getModuleConfig: jest.fn().mockResolvedValue({
        id: 'config-1',
        tenantId: 'tenant-1',
        moduleKey: 'thinktank',
        enabled: false,
        allowedRoles: [],
        dataRetentionDays: 90,
        privacyConfirmedAt: null,
        privacyConfirmedBy: null,
        latestAuditSummary: [],
      }),
      updateModuleConfig: jest.fn().mockResolvedValue({
        id: 'config-1',
        tenantId: 'tenant-1',
        moduleKey: 'thinktank',
        enabled: true,
        allowedRoles: [UserRole.ADMIN],
        dataRetentionDays: 90,
        privacyConfirmedAt: '2026-05-19T00:00:00.000Z',
        privacyConfirmedBy: 'user-1',
        latestAuditSummary: [],
      }),
    }

    controller = new AdvisoryAdminController(service as unknown as AdvisoryAdminService)
  })

  it('wraps GET module config in a ThinkTank-owned data envelope', async () => {
    await expect(controller.getModuleConfig(adminUser, 'tenant-1')).resolves.toEqual({
      data: expect.objectContaining({
        moduleKey: 'thinktank',
        enabled: false,
        dataRetentionDays: 90,
      }),
    })
    expect(service.getModuleConfig).toHaveBeenCalledWith('tenant-1')
  })

  it('wraps PUT module config in a data envelope and uses CurrentTenant/CurrentUser', async () => {
    await expect(
      controller.updateModuleConfig(adminUser, 'tenant-1', {
        tenantId: 'other-tenant',
        enabled: true,
        allowedRoles: [UserRole.ADMIN],
        dataRetentionDays: 90,
        privacyConfirmed: true,
      } as never),
    ).resolves.toEqual({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        enabled: true,
      }),
    })

    expect(service.updateModuleConfig).toHaveBeenCalledWith(
      'tenant-1',
      adminUser,
      expect.objectContaining({
        enabled: true,
        allowedRoles: [UserRole.ADMIN],
      }),
    )
  })

  it('marks admin endpoints as admin-only routes', () => {
    expect(Reflect.getMetadata('roles', AdvisoryAdminController.prototype.getModuleConfig)).toEqual(
      [UserRole.ADMIN],
    )
    expect(
      Reflect.getMetadata('roles', AdvisoryAdminController.prototype.updateModuleConfig),
    ).toEqual([UserRole.ADMIN])
  })
})
