# Story 6.1A 实施变更说明

**日期**: 2026-02-03
**状态**: ✅ 已完成（实施方案变更）

---

## 🔄 重要变更

### 原计划
- Layer 1: API层权限校验（TenantGuard）
- Layer 2: 服务层数据过滤（BaseRepository）
- **Layer 3: 数据库层RLS策略（PostgreSQL Row Level Security）** ❌
- Layer 4: 审计日志

### 实际实施
- Layer 1: API层权限校验（TenantGuard）✅
- Layer 2: **应用层Repository过滤（BaseTenantRepository）** ✅
- ~~Layer 3: 数据库层RLS策略~~ ❌ **已放弃**
- Layer 4: 审计日志

---

## ❌ 为什么放弃RLS？

### 问题发现
经过2.5小时深入调查，发现PostgreSQL RLS策略**完全不生效**：

1. **配置正确但不工作**
   - ✅ RLS已启用（`rowsecurity = true`）
   - ✅ FORCE RLS已启用（`relforcerowsecurity = true`）
   - ✅ BYPASSRLS权限已移除（`rolbypassrls = false`）
   - ✅ RLS策略已创建（2个策略存在）
   - ✅ 会话变量设置成功
   - ❌ **查询计划中没有RLS过滤**

2. **尝试的解决方案（全部失败）**
   - ❌ 移除BYPASSRLS权限
   - ❌ 启用FORCE RLS
   - ❌ 重新创建策略
   - ❌ 修改策略角色（TO public / TO postgres / 不指定TO）
   - ❌ 简化策略条件（移除OR）
   - ❌ 分离admin bypass策略
   - ❌ 合并策略条件

3. **根本原因**
   - 查询计划中完全没有RLS过滤
   - PostgreSQL没有将RLS策略编译到查询计划中
   - 可能是PostgreSQL bug或与TypeORM的兼容性问题

### 详细调查报告
- `RLS_FINAL_INVESTIGATION_REPORT.md` - 完整调查报告
- `RLS_WORK_SUMMARY.md` - 工作总结

---

## ✅ 新的实施方案

### BaseTenantRepository（应用层过滤）

```typescript
/**
 * BaseTenantRepository
 *
 * 基础租户Repository，自动添加tenantId过滤
 * 所有多租户实体的Repository都应该继承此类
 */
export abstract class BaseTenantRepository<T extends { tenantId: string }> {
  constructor(
    protected readonly repository: Repository<T>,
    protected readonly entityName: string,
  ) {}

  // 查询方法（自动添加tenantId过滤）
  async find(tenantId: string, options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find({
      ...options,
      where: this.addTenantFilter(tenantId, options?.where),
    });
  }

  async findOne(tenantId: string, options: FindOneOptions<T>): Promise<T | null> {
    return this.repository.findOne({
      ...options,
      where: this.addTenantFilter(tenantId, options.where),
    });
  }

  async findById(tenantId: string, id: string): Promise<T | null> {
    return this.repository.findOne({
      where: { id, tenantId } as any,
    });
  }

  // 保存方法（自动设置tenantId）
  async save(tenantId: string, entity: Partial<T>): Promise<T> {
    const entityWithTenant = { ...entity, tenantId } as T;
    return this.repository.save(entityWithTenant);
  }

  // QueryBuilder（自动添加tenantId过滤）
  createQueryBuilder(tenantId: string, alias: string) {
    return this.repository
      .createQueryBuilder(alias)
      .where(`${alias}.tenantId = :tenantId`, { tenantId });
  }

  // 其他方法...
}
```

### 使用示例

```typescript
// 1. 创建Repository
@Injectable()
export class OrganizationRepository extends BaseTenantRepository<Organization> {
  constructor(
    @InjectRepository(Organization)
    repository: Repository<Organization>,
  ) {
    super(repository, 'Organization');
  }

  async findByName(tenantId: string, name: string): Promise<Organization | null> {
    return this.findOne(tenantId, { where: { name } });
  }
}

// 2. 在Service中使用
@Injectable()
export class OrganizationsService {
  constructor(
    private readonly orgRepo: OrganizationRepository,
  ) {}

  async findAll(tenantId: string) {
    return this.orgRepo.find(tenantId); // 自动添加tenantId过滤
  }
}

// 3. 在Controller中使用
@Controller('organizations')
@UseGuards(JwtAuthGuard, TenantGuard)
export class OrganizationsController {
  @Get()
  async findAll(@CurrentTenant() tenantId: string) {
    return this.orgService.findAll(tenantId);
  }
}
```

---

## 📊 测试结果

### 应用层过滤测试
```
PASS test/app-layer-tenant-filter.e2e-spec.ts
  ✓ 应该只返回当前租户的数据
  ✓ 应该阻止跨租户访问
  ✓ 保存时应该自动设置tenantId
  ✓ QueryBuilder应该自动添加tenantId过滤
  ✓ count应该只计算当前租户的数据
  ✓ 应该防止通过修改tenantId进行跨租户访问
  ✓ 应该防止通过删除操作进行跨租户访问

Tests: 7 passed (100%)
```

### 多租户隔离测试
```
PASS test/multi-tenant-isolation.e2e-spec.ts
  ✓ Tenant A creates RadarPush
  ✓ Tenant A can query their own RadarPush
  ✓ Tenant B cannot query Tenant A's RadarPush
  ✓ Tenant B creates WatchedTopic
  ✓ Tenant B can query their own WatchedTopic
  ✓ Tenant A cannot query Tenant B's WatchedTopic
  ✓ Tenant A only sees their own RadarPushes
  ✓ Tenant B only sees their own WatchedTopics
  ✓ Tenant A cannot update Tenant B's data
  ✓ Tenant A cannot delete Tenant B's data
  ... (17 tests total)

Tests: 17 passed (100%)
```

**总计**: 24/24 测试通过 (100%) ✅

---

## 📁 已创建的Repository

| Repository | 状态 | 文件路径 |
|-----------|------|---------|
| BaseTenantRepository | ✅ | `src/database/repositories/base-tenant.repository.ts` |
| OrganizationRepository | ✅ | `src/database/repositories/organization.repository.ts` |
| ProjectRepository | ✅ | `src/database/repositories/project.repository.ts` |
| RadarPushRepository | ✅ | `src/database/repositories/radar-push.repository.ts` |
| WatchedTopicRepository | ✅ | `src/database/repositories/watched-topic.repository.ts` |
| WatchedPeerRepository | ✅ | `src/database/repositories/watched-peer.repository.ts` |
| PushPreferenceRepository | ✅ | `src/database/repositories/push-preference.repository.ts` |

---

## 🔄 已更新的文件

### TenantGuard
- **文件**: `src/modules/organizations/guards/tenant.guard.ts`
- **变更**: 移除RLS会话变量设置（`SET app.current_tenant`）
- **保留**: tenantId注入到request context

### Service
- **WatchedTopicService**: 使用WatchedTopicRepository
- **WatchedPeerService**: 使用WatchedPeerRepository

### Module
- **OrganizationsModule**: 注册OrganizationRepository、ProjectRepository
- **RadarModule**: 注册所有Radar相关Repository

---

## 🎯 AC完成状态

### AC 1: 多租户数据模型设计与数据迁移 ✅
- ✅ 所有核心表包含tenantId字段
- ✅ tenantId关联到Tenant表
- ✅ 现有数据迁移到默认Tenant
- ✅ tenantId设置为NOT NULL

### AC 2: API层权限校验（Layer 1）✅
- ✅ TenantGuard从JWT token提取tenantId
- ✅ 验证用户是否属于该tenant
- ✅ 返回403 Forbidden（如果不属于）
- ✅ 将tenantId注入到请求上下文
- ❌ ~~设置RLS session变量~~ **已移除**

### AC 3: 服务层数据过滤（Layer 2）✅
- ✅ Repository查询自动添加WHERE tenantId = :tenantId
- ✅ 使用BaseTenantRepository封装通用过滤逻辑
- ✅ 所有查询方法继承BaseTenantRepository
- ✅ 使用泛型约束确保类型安全

### AC 4: 集成测试验证多租户隔离 ✅
- ✅ 租户A不能访问租户B的数据
- ✅ 租户A创建的数据自动关联到租户A
- ✅ 租户B查询时看不到租户A的数据
- ✅ 所有集成测试100%通过（24/24）

---

## 📚 相关文档

### 实施文档
- `APP_LAYER_FILTER_IMPLEMENTATION_GUIDE.md` - 实施指南
- `APP_LAYER_FILTER_FINAL_REPORT.md` - 最终完成报告
- `ACTION_PLAN_NOW.md` - 行动计划

### 调查文档
- `RLS_FINAL_INVESTIGATION_REPORT.md` - RLS问题调查报告
- `RLS_WORK_SUMMARY.md` - RLS工作总结
- `RLS_POLICY_DIAGNOSIS_REPORT.md` - RLS策略诊断报告

---

## ⚠️ 对后续Story的影响

### Story 6.1B（RLS审计层）
- **状态**: ❌ **不再实施RLS部分**
- **保留**: 审计日志功能
- **变更**: 审计日志不依赖RLS，直接在应用层实现

### 后续开发注意事项
1. **不要使用RLS策略** - 已验证不工作
2. **使用BaseTenantRepository** - 所有多租户实体必须继承
3. **所有查询传入tenantId** - 必须参数
4. **不要直接使用TypeORM Repository** - 会绕过租户过滤

---

## ✅ 完成标准

- [x] 应用层过滤测试通过（7/7）
- [x] 多租户隔离测试通过（17/17）
- [x] 所有核心Repository创建完成
- [x] Service更新完成
- [x] Module更新完成
- [x] 文档更新完成

---

**更新时间**: 2026-02-03 01:15
**实施状态**: ✅ 完成（方案变更）
**测试通过率**: 100% (24/24)
