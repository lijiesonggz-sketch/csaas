import { Repository } from 'typeorm'
import { AdvisoryModuleConfig } from '../../../database/entities/advisory-module-config.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AdvisoryModuleConfigRepository } from './advisory-module-config.repository'
import { THINKTANK_MODULE_KEY } from './advisory-admin.service'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const secondaryTenantId = '660e8400-e29b-41d4-a716-446655440999'

function createConfig(overrides: Partial<AdvisoryModuleConfig> = {}): AdvisoryModuleConfig {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    tenantId,
    moduleKey: THINKTANK_MODULE_KEY,
    enabled: false,
    allowedRoles: [],
    dataRetentionDays: 90,
    privacyConfirmedAt: null,
    privacyConfirmedBy: null,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date('2026-05-19T00:00:00.000Z'),
    updatedAt: new Date('2026-05-19T00:00:00.000Z'),
    ...overrides,
  }
}

describe('AdvisoryModuleConfigRepository', () => {
  let typeormRepository: jest.Mocked<Repository<AdvisoryModuleConfig>>
  let repository: AdvisoryModuleConfigRepository

  beforeEach(() => {
    typeormRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
    } as any

    repository = new AdvisoryModuleConfigRepository(typeormRepository)
  })

  it('finds module config only within the requested tenant scope', async () => {
    const config = createConfig()
    typeormRepository.findOne.mockResolvedValue(config)

    const result = await repository.findByModuleKey(tenantId, THINKTANK_MODULE_KEY)

    expect(result).toBe(config)
    expect(typeormRepository.findOne).toHaveBeenCalledWith({
      where: { moduleKey: THINKTANK_MODULE_KEY, tenantId },
    })
  })

  it('creates config with the current tenant even when caller data contains another tenantId', async () => {
    const config = createConfig()
    typeormRepository.create.mockReturnValue(config)
    typeormRepository.save.mockResolvedValue(config)

    await repository.createForTenant(tenantId, {
      tenantId: secondaryTenantId,
      moduleKey: THINKTANK_MODULE_KEY,
      enabled: true,
      allowedRoles: [UserRole.ADMIN],
    } as never)

    expect(typeormRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        moduleKey: THINKTANK_MODULE_KEY,
      }),
    )
  })

  it('updates config with scoped ownership criteria and ignores tenantId in payload', async () => {
    const config = createConfig({ enabled: true })
    typeormRepository.update.mockResolvedValue({ affected: 1 } as any)
    typeormRepository.findOne.mockResolvedValue(config)

    const result = await repository.updateForTenant(tenantId, config.id, {
      tenantId: secondaryTenantId,
      enabled: true,
      allowedRoles: [UserRole.ADMIN],
    } as never)

    expect(result).toBe(config)
    expect(typeormRepository.update).toHaveBeenCalledWith(
      { id: config.id, tenantId },
      {
        enabled: true,
        allowedRoles: [UserRole.ADMIN],
      },
    )
    expect(typeormRepository.findOne).toHaveBeenCalledWith({
      where: { id: config.id, tenantId },
    })
  })

  it('returns null when a scoped update targets another tenant row', async () => {
    const config = createConfig({ tenantId: secondaryTenantId })
    typeormRepository.update.mockResolvedValue({ affected: 0 } as any)
    typeormRepository.findOne.mockResolvedValue(null)

    const result = await repository.updateForTenant(tenantId, config.id, {
      enabled: true,
    })

    expect(result).toBeNull()
    expect(typeormRepository.update).toHaveBeenCalledWith(
      { id: config.id, tenantId },
      { enabled: true },
    )
  })

  it('deletes config only with scoped tenant ownership criteria', async () => {
    const config = createConfig()
    typeormRepository.delete.mockResolvedValue({ affected: 1 } as any)

    await repository.deleteForTenant(tenantId, config.id)

    expect(typeormRepository.delete).toHaveBeenCalledWith({ id: config.id, tenantId })
  })
})
