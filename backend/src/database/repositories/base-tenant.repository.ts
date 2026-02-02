import { Repository, FindOptionsWhere, FindManyOptions, FindOneOptions } from 'typeorm';
import { Logger } from '@nestjs/common';

/**
 * BaseTenantRepository
 *
 * 基础租户Repository，自动添加tenantId过滤
 * 所有多租户实体的Repository都应该继承此类
 *
 * 使用方法：
 * ```typescript
 * @Injectable()
 * export class OrganizationRepository extends BaseTenantRepository<Organization> {
 *   constructor(
 *     @InjectRepository(Organization)
 *     repository: Repository<Organization>,
 *   ) {
 *     super(repository, 'Organization');
 *   }
 * }
 * ```
 *
 * @module backend/src/database/repositories/base-tenant.repository
 * @story 6-1A
 */
export abstract class BaseTenantRepository<T extends { tenantId: string }> {
  protected readonly logger: Logger;

  constructor(
    protected readonly repository: Repository<T>,
    protected readonly entityName: string,
  ) {
    this.logger = new Logger(`${entityName}Repository`);
  }

  /**
   * 添加tenantId过滤到查询条件
   */
  private addTenantFilter(
    tenantId: string,
    where?: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): FindOptionsWhere<T> | FindOptionsWhere<T>[] {
    if (!where) {
      return { tenantId } as FindOptionsWhere<T>;
    }

    if (Array.isArray(where)) {
      return where.map((w) => ({ ...w, tenantId } as FindOptionsWhere<T>));
    }

    return { ...where, tenantId } as FindOptionsWhere<T>;
  }

  /**
   * 查找所有记录（自动添加tenantId过滤）
   */
  async find(tenantId: string, options?: FindManyOptions<T>): Promise<T[]> {
    this.logger.debug(`find: tenantId=${tenantId}`);

    return this.repository.find({
      ...options,
      where: this.addTenantFilter(tenantId, options?.where),
    });
  }

  /**
   * 查找一条记录（自动添加tenantId过滤）
   */
  async findOne(tenantId: string, options: FindOneOptions<T>): Promise<T | null> {
    this.logger.debug(`findOne: tenantId=${tenantId}`);

    return this.repository.findOne({
      ...options,
      where: this.addTenantFilter(tenantId, options.where),
    });
  }

  /**
   * 根据ID查找（自动添加tenantId过滤）
   */
  async findById(tenantId: string, id: string): Promise<T | null> {
    this.logger.debug(`findById: tenantId=${tenantId}, id=${id}`);

    return this.repository.findOne({
      where: { id, tenantId } as any,
    });
  }

  /**
   * 计数（自动添加tenantId过滤）
   */
  async count(tenantId: string, options?: FindManyOptions<T>): Promise<number> {
    this.logger.debug(`count: tenantId=${tenantId}`);

    return this.repository.count({
      ...options,
      where: this.addTenantFilter(tenantId, options?.where),
    });
  }

  /**
   * 保存（自动设置tenantId）
   */
  async save(tenantId: string, entity: Partial<T>): Promise<T> {
    this.logger.debug(`save: tenantId=${tenantId}`);

    // 确保tenantId被设置
    const entityWithTenant = {
      ...entity,
      tenantId,
    } as T;

    return this.repository.save(entityWithTenant);
  }

  /**
   * 批量保存（自动设置tenantId）
   */
  async saveMany(tenantId: string, entities: Partial<T>[]): Promise<T[]> {
    this.logger.debug(`saveMany: tenantId=${tenantId}, count=${entities.length}`);

    // 确保所有实体都有tenantId
    const entitiesWithTenant = entities.map((entity) => ({
      ...entity,
      tenantId,
    })) as T[];

    return this.repository.save(entitiesWithTenant);
  }

  /**
   * 更新（自动添加tenantId过滤）
   */
  async update(
    tenantId: string,
    criteria: FindOptionsWhere<T>,
    partialEntity: Partial<T>,
  ): Promise<void> {
    this.logger.debug(`update: tenantId=${tenantId}`);

    await this.repository.update(
      this.addTenantFilter(tenantId, criteria),
      partialEntity as any,
    );
  }

  /**
   * 删除（自动添加tenantId过滤）
   */
  async delete(tenantId: string, criteria: FindOptionsWhere<T>): Promise<void> {
    this.logger.debug(`delete: tenantId=${tenantId}`);

    await this.repository.delete(this.addTenantFilter(tenantId, criteria));
  }

  /**
   * 软删除（自动添加tenantId过滤）
   */
  async softDelete(tenantId: string, criteria: FindOptionsWhere<T>): Promise<void> {
    this.logger.debug(`softDelete: tenantId=${tenantId}`);

    await this.repository.softDelete(this.addTenantFilter(tenantId, criteria));
  }

  /**
   * 创建QueryBuilder（自动添加tenantId过滤）
   */
  createQueryBuilder(tenantId: string, alias: string) {
    this.logger.debug(`createQueryBuilder: tenantId=${tenantId}, alias=${alias}`);

    return this.repository
      .createQueryBuilder(alias)
      .where(`${alias}.tenantId = :tenantId`, { tenantId });
  }

  /**
   * 获取原始Repository（用于特殊情况，不推荐）
   *
   * ⚠️ 警告：使用原始Repository会绕过tenantId过滤，可能导致数据泄露
   * 只在确实需要跨租户操作时使用（如系统管理员功能）
   */
  getRawRepository(): Repository<T> {
    this.logger.warn('getRawRepository: 使用原始Repository，绕过tenantId过滤');
    return this.repository;
  }
}
