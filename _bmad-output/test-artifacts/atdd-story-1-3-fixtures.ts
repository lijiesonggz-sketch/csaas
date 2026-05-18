import { Repository } from 'typeorm'

export interface TenantRecordFixture {
  id: string
  tenantId: string
  name: string
  status?: string
}

export interface AdvisoryModuleConfigFixture {
  id: string
  tenantId: string
  moduleKey: 'thinktank'
  enabled: boolean
  allowedRoles: string[]
  dataRetentionDays: number
}

export function createTenantRecord(
  overrides: Partial<TenantRecordFixture> = {},
): TenantRecordFixture {
  return {
    id: 'record-1',
    tenantId: 'tenant-a',
    name: 'tenant scoped record',
    status: 'active',
    ...overrides,
  }
}

export function createAdvisoryModuleConfig(
  overrides: Partial<AdvisoryModuleConfigFixture> = {},
): AdvisoryModuleConfigFixture {
  return {
    id: 'config-1',
    tenantId: 'tenant-a',
    moduleKey: 'thinktank',
    enabled: false,
    allowedRoles: [],
    dataRetentionDays: 90,
    ...overrides,
  }
}

export function createMockRepository<T>(): jest.Mocked<
  Pick<Repository<T>, 'find' | 'findOne' | 'create' | 'save' | 'update' | 'delete' | 'count'>
> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((input) => input as T),
    save: jest.fn(async (input) => input as T),
    update: jest.fn(async () => ({ affected: 1 }) as never),
    delete: jest.fn(async () => ({ affected: 1 }) as never),
    count: jest.fn(),
  }
}
