import { Repository, FindManyOptions, FindOneOptions, DeepPartial } from 'typeorm'
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

  /**
   * Find all entities for a tenant
   *
   * @param tenantId - Tenant ID to filter by
   * @param options - Additional TypeORM find options
   * @returns Array of entities belonging to the tenant
   */
  async findAll(tenantId: string, options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find({
      ...options,
      where: {
        ...((options?.where as object) || {}),
        tenantId,
      } as any,
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
  async findOne(
    tenantId: string,
    id: string,
    options?: FindOneOptions<T>,
  ): Promise<T | null> {
    return this.repository.findOne({
      ...options,
      where: {
        ...((options?.where as object) || {}),
        id,
        tenantId,
      } as any,
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
    const entity = this.repository.create({
      ...data,
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
    await this.repository.update(
      { id, tenantId } as any,
      data as any,
    )
    return this.findOne(tenantId, id)
  }

  /**
   * Delete an entity by ID and tenantId
   *
   * @param tenantId - Tenant ID to filter by
   * @param id - Entity ID
   */
  async delete(tenantId: string, id: string): Promise<void> {
    await this.repository.delete({ id, tenantId } as any)
  }

  /**
   * Count entities for a tenant
   *
   * @param tenantId - Tenant ID to filter by
   * @param options - Additional TypeORM find options
   * @returns Count of entities
   */
  async count(tenantId: string, options?: FindManyOptions<T>): Promise<number> {
    return this.repository.count({
      ...options,
      where: {
        ...((options?.where as object) || {}),
        tenantId,
      } as any,
    })
  }
}
