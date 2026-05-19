import { BadRequestException } from '@nestjs/common'
import { DeepPartial, FindManyOptions, FindOneOptions, FindOptionsWhere, Repository } from 'typeorm'
import { TenantEntity } from '../interfaces/tenant-entity.interface'

/**
 * BaseRepository
 *
 * Service layer (Layer 2) data filtering for multi-tenant isolation.
 * Automatically adds `WHERE tenantId = :tenantId` to all queries.
 *
 * All service repositories should extend this class to ensure tenant-scoped queries.
 *
 * Usage:
 * ```typescript
 * export class RadarPushRepository extends BaseRepository<RadarPush> {
 *   constructor(
 *     @InjectRepository(RadarPush)
 *     repository: Repository<RadarPush>,
 *   ) {
 *     super(repository)
 *   }
 * }
 * ```
 *
 * @module backend/src/database/repositories/base.repository
 * @story 6-1A
 * @phase Phase 3: Service Layer Data Filtering
 */
export abstract class BaseRepository<T extends TenantEntity> {
  constructor(protected readonly repository: Repository<T>) {}

  protected assertScopeValue(
    value: unknown,
    fieldName: 'tenantId' | 'id',
  ): asserts value is string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${fieldName} is required for tenant-scoped repository access`)
    }
  }

  protected isEmptyWhereArray(where?: FindOptionsWhere<T> | FindOptionsWhere<T>[]): boolean {
    return Array.isArray(where) && where.length === 0
  }

  protected addTenantFilter(
    tenantId: string,
    where?: FindOptionsWhere<T> | FindOptionsWhere<T>[],
    requiredWhere?: FindOptionsWhere<T>,
  ): FindOptionsWhere<T> | FindOptionsWhere<T>[] {
    const applyTenantScope = (branch?: FindOptionsWhere<T>): FindOptionsWhere<T> =>
      ({
        ...((branch ?? {}) as object),
        ...((requiredWhere ?? {}) as object),
        tenantId,
      }) as FindOptionsWhere<T>

    if (Array.isArray(where)) {
      if (where.length === 0) {
        return applyTenantScope()
      }

      return where.map((branch) => applyTenantScope(branch))
    }

    return applyTenantScope(where)
  }

  protected stripTenantId(data: DeepPartial<T>): DeepPartial<T> {
    const safeData = { ...((data ?? {}) as Record<string, unknown>) }
    delete safeData.tenantId
    return safeData as DeepPartial<T>
  }

  protected stripImmutableUpdateFields(data: DeepPartial<T>): DeepPartial<T> {
    const safeData = { ...((data ?? {}) as Record<string, unknown>) }
    delete safeData.id
    delete safeData.tenantId
    delete safeData.createdAt
    return safeData as DeepPartial<T>
  }

  protected async findOneWhere(
    tenantId: string,
    where: FindOptionsWhere<T>,
    options?: FindOneOptions<T>,
  ): Promise<T | null> {
    this.assertScopeValue(tenantId, 'tenantId')

    if (this.isEmptyWhereArray(options?.where as any)) {
      return null
    }

    return this.repository.findOne({
      ...options,
      where: this.addTenantFilter(tenantId, where) as any,
    })
  }

  /**
   * Find all entities for a tenant
   *
   * @param tenantId - Tenant ID to filter by
   * @param options - Additional TypeORM find options
   * @returns Array of entities belonging to the tenant
   */
  async findAll(tenantId: string, options?: FindManyOptions<T>): Promise<T[]> {
    this.assertScopeValue(tenantId, 'tenantId')

    if (this.isEmptyWhereArray(options?.where as any)) {
      return []
    }

    return this.repository.find({
      ...options,
      where: this.addTenantFilter(tenantId, options?.where as any) as any,
    })
  }

  /**
   * Find one entity by ID and tenantId
   *
   * @param tenantId - Tenant ID to filter by
   * @param id - Entity ID
   * @param options - Additional TypeORM find options
   * @returns Entity if found, null otherwise
   */
  async findOne(tenantId: string, id: string, options?: FindOneOptions<T>): Promise<T | null> {
    this.assertScopeValue(tenantId, 'tenantId')
    this.assertScopeValue(id, 'id')

    if (this.isEmptyWhereArray(options?.where as any)) {
      return null
    }

    return this.repository.findOne({
      ...options,
      where: this.addTenantFilter(
        tenantId,
        options?.where as any,
        { id } as FindOptionsWhere<T>,
      ) as any,
    })
  }

  /**
   * Create a new entity with tenantId automatically injected
   *
   * @param tenantId - Tenant ID to associate with the entity
   * @param data - Entity data
   * @returns Created entity
   */
  async create(tenantId: string, data: DeepPartial<T>): Promise<T> {
    this.assertScopeValue(tenantId, 'tenantId')

    const entity = this.repository.create({
      ...this.stripTenantId(data),
      tenantId,
    } as any)
    const saved = await this.repository.save(entity as any)
    return saved as T
  }

  /**
   * Update an entity by ID and tenantId
   *
   * @param tenantId - Tenant ID to filter by
   * @param id - Entity ID
   * @param data - Partial entity data to update
   * @returns Updated entity, or null if not found
   */
  async update(tenantId: string, id: string, data: DeepPartial<T>): Promise<T | null> {
    this.assertScopeValue(tenantId, 'tenantId')
    this.assertScopeValue(id, 'id')

    const safeData = this.stripImmutableUpdateFields(data)

    if (Object.keys(safeData as object).length > 0) {
      await this.repository.update({ id, tenantId } as any, safeData as any)
    }

    return this.findOne(tenantId, id)
  }

  /**
   * Delete an entity by ID and tenantId
   *
   * @param tenantId - Tenant ID to filter by
   * @param id - Entity ID
   */
  async delete(tenantId: string, id: string): Promise<boolean> {
    this.assertScopeValue(tenantId, 'tenantId')
    this.assertScopeValue(id, 'id')

    const result = await this.repository.delete({ id, tenantId } as any)
    return (result.affected ?? 0) > 0
  }

  /**
   * Count entities for a tenant
   *
   * @param tenantId - Tenant ID to filter by
   * @param options - Additional TypeORM find options
   * @returns Count of entities
   */
  async count(tenantId: string, options?: FindManyOptions<T>): Promise<number> {
    this.assertScopeValue(tenantId, 'tenantId')

    if (this.isEmptyWhereArray(options?.where as any)) {
      return 0
    }

    return this.repository.count({
      ...options,
      where: this.addTenantFilter(tenantId, options?.where as any) as any,
    })
  }
}
