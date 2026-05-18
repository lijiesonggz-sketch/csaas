import { Repository } from 'typeorm'
import { BaseRepository } from './base.repository'
import { TenantEntity } from '../interfaces/tenant-entity.interface'

// Mock entity for testing
interface TestEntity extends TenantEntity {
  id: string
  tenantId: string
  name: string
}

class TestRepository extends BaseRepository<TestEntity> {
  constructor(repository: Repository<TestEntity>) {
    super(repository)
  }
}

describe('BaseRepository', () => {
  let repository: jest.Mocked<Repository<TestEntity>>
  let baseRepository: TestRepository

  beforeEach(() => {
    repository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    } as any

    baseRepository = new TestRepository(repository)
  })

  describe('findAll', () => {
    it('should automatically add tenantId filter', async () => {
      const tenantId = 'tenant-123'
      const mockEntities = [
        { id: '1', tenantId, name: 'Entity 1' },
        { id: '2', tenantId, name: 'Entity 2' },
      ]

      repository.find.mockResolvedValue(mockEntities as any)

      const result = await baseRepository.findAll(tenantId)

      expect(result).toEqual(mockEntities)
      expect(repository.find).toHaveBeenCalledWith({
        where: { tenantId },
      })
    })

    it('should merge tenantId with additional where conditions', async () => {
      const tenantId = 'tenant-123'
      const mockEntities = [{ id: '1', tenantId, name: 'Active Entity' }]

      repository.find.mockResolvedValue(mockEntities as any)

      await baseRepository.findAll(tenantId, {
        where: { name: 'Active Entity' } as any,
      })

      expect(repository.find).toHaveBeenCalledWith({
        where: { name: 'Active Entity', tenantId },
      })
    })

    it('should inject tenantId into every array where branch', async () => {
      const tenantId = 'tenant-123'

      repository.find.mockResolvedValue([])

      await baseRepository.findAll(tenantId, {
        where: [{ name: 'Alpha' }, { name: 'Beta' }] as any,
      })

      expect(repository.find).toHaveBeenCalledWith({
        where: [
          { name: 'Alpha', tenantId },
          { name: 'Beta', tenantId },
        ],
      })
    })

    it('should preserve tenant filtering when an empty array where is supplied', async () => {
      const tenantId = 'tenant-123'

      repository.find.mockResolvedValue([])

      await baseRepository.findAll(tenantId, {
        where: [] as any,
      })

      expect(repository.find).toHaveBeenCalledWith({
        where: { tenantId },
      })
    })
  })

  describe('findOne', () => {
    it('should find entity by id and tenantId', async () => {
      const tenantId = 'tenant-123'
      const entityId = 'entity-456'
      const mockEntity = { id: entityId, tenantId, name: 'Test Entity' }

      repository.findOne.mockResolvedValue(mockEntity as any)

      const result = await baseRepository.findOne(tenantId, entityId)

      expect(result).toEqual(mockEntity)
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: entityId, tenantId },
      })
    })

    it('should return null if entity not found', async () => {
      repository.findOne.mockResolvedValue(null)

      const result = await baseRepository.findOne('tenant-123', 'non-existent')

      expect(result).toBeNull()
    })

    it('should inject id and tenantId into every array where branch', async () => {
      const tenantId = 'tenant-123'
      const entityId = 'entity-456'

      repository.findOne.mockResolvedValue(null)

      await baseRepository.findOne(tenantId, entityId, {
        where: [{ name: 'Alpha' }, { name: 'Beta' }] as any,
      })

      expect(repository.findOne).toHaveBeenCalledWith({
        where: [
          { name: 'Alpha', id: entityId, tenantId },
          { name: 'Beta', id: entityId, tenantId },
        ],
      })
    })

    it('should preserve id and tenant filtering when an empty array where is supplied', async () => {
      const tenantId = 'tenant-123'
      const entityId = 'entity-456'

      repository.findOne.mockResolvedValue(null)

      await baseRepository.findOne(tenantId, entityId, {
        where: [] as any,
      })

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: entityId, tenantId },
      })
    })
  })

  describe('create', () => {
    it('should automatically inject tenantId when creating entity', async () => {
      const tenantId = 'tenant-123'
      const data = { name: 'New Entity' }
      const createdEntity = { id: 'new-id', tenantId, name: 'New Entity' }

      repository.create.mockReturnValue(createdEntity as any)
      repository.save.mockResolvedValue(createdEntity as any)

      const result = await baseRepository.create(tenantId, data)

      expect(result).toEqual(createdEntity)
      expect(repository.create).toHaveBeenCalledWith({
        ...data,
        tenantId,
      })
      expect(repository.save).toHaveBeenCalledWith(createdEntity)
    })

    it('should overwrite a caller-supplied tenantId when creating entity', async () => {
      const tenantId = 'tenant-123'
      const maliciousTenantId = 'tenant-999'
      const createdEntity = { id: 'new-id', tenantId, name: 'New Entity' }

      repository.create.mockReturnValue(createdEntity as any)
      repository.save.mockResolvedValue(createdEntity as any)

      await baseRepository.create(tenantId, {
        tenantId: maliciousTenantId,
        name: 'New Entity',
      } as any)

      expect(repository.create).toHaveBeenCalledWith({
        name: 'New Entity',
        tenantId,
      })
    })
  })

  describe('update', () => {
    it('should update entity with tenantId filter', async () => {
      const tenantId = 'tenant-123'
      const entityId = 'entity-456'
      const updateData = { name: 'Updated Name' }
      const updatedEntity = { id: entityId, tenantId, name: 'Updated Name' }

      repository.update.mockResolvedValue({ affected: 1 } as any)
      repository.findOne.mockResolvedValue(updatedEntity as any)

      const result = await baseRepository.update(tenantId, entityId, updateData)

      expect(result).toEqual(updatedEntity)
      expect(repository.update).toHaveBeenCalledWith({ id: entityId, tenantId }, updateData)
    })

    it('should strip tenantId from update payload so callers cannot move records across tenants', async () => {
      const tenantId = 'tenant-123'
      const entityId = 'entity-456'
      const maliciousTenantId = 'tenant-999'
      const updatedEntity = { id: entityId, tenantId, name: 'Updated Name' }

      repository.update.mockResolvedValue({ affected: 1 } as any)
      repository.findOne.mockResolvedValue(updatedEntity as any)

      await baseRepository.update(tenantId, entityId, {
        tenantId: maliciousTenantId,
        name: 'Updated Name',
      } as any)

      expect(repository.update).toHaveBeenCalledWith(
        { id: entityId, tenantId },
        { name: 'Updated Name' },
      )
    })

    it('should return null if entity not found after update', async () => {
      repository.update.mockResolvedValue({ affected: 0 } as any)
      repository.findOne.mockResolvedValue(null)

      const result = await baseRepository.update('tenant-123', 'non-existent', { name: 'Test' })

      expect(result).toBeNull()
    })
  })

  describe('delete', () => {
    it('should delete entity with tenantId filter', async () => {
      const tenantId = 'tenant-123'
      const entityId = 'entity-456'

      repository.delete.mockResolvedValue({ affected: 1 } as any)

      await baseRepository.delete(tenantId, entityId)

      expect(repository.delete).toHaveBeenCalledWith({ id: entityId, tenantId })
    })
  })

  describe('count', () => {
    it('should count entities with tenantId filter', async () => {
      const tenantId = 'tenant-123'

      repository.count.mockResolvedValue(5)

      const result = await baseRepository.count(tenantId)

      expect(result).toBe(5)
      expect(repository.count).toHaveBeenCalledWith({
        where: { tenantId },
      })
    })

    it('should inject tenantId into every array where branch when counting', async () => {
      const tenantId = 'tenant-123'

      repository.count.mockResolvedValue(2)

      await baseRepository.count(tenantId, {
        where: [{ name: 'Alpha' }, { name: 'Beta' }] as any,
      })

      expect(repository.count).toHaveBeenCalledWith({
        where: [
          { name: 'Alpha', tenantId },
          { name: 'Beta', tenantId },
        ],
      })
    })

    it('should preserve tenant filtering when counting with an empty array where', async () => {
      const tenantId = 'tenant-123'

      repository.count.mockResolvedValue(0)

      await baseRepository.count(tenantId, {
        where: [] as any,
      })

      expect(repository.count).toHaveBeenCalledWith({
        where: { tenantId },
      })
    })
  })
})
