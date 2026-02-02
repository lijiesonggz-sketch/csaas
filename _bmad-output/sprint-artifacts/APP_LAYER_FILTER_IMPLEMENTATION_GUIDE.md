# 应用层租户过滤实施指南

**日期**: 2026-02-02
**原因**: RLS策略完全不生效，改用应用层过滤
**优先级**: 🔴 P0 - 必须立即实施

---

## 📋 实施清单

### ✅ 已完成

1. ✓ 更新TenantGuard移除RLS会话变量设置
2. ✓ 创建BaseTenantRepository基类
3. ✓ 创建RadarPushRepository示例
4. ✓ 创建测试套件

### 🔄 待完成

5. [ ] 为所有多租户实体创建Repository
6. [ ] 更新所有Service使用新的Repository
7. [ ] 运行测试验证
8. [ ] 更新文档

---

## 🎯 需要创建Repository的实体

### 优先级1: 核心实体（必须）

1. **OrganizationRepository** - Organizations表
2. **ProjectRepository** - Projects表
3. **RadarPushRepository** - RadarPushes表 ✓ 已完成
4. **WatchedTopicRepository** - WatchedTopics表
5. **WatchedPeerRepository** - WatchedPeers表

### 优先级2: 扩展实体（重要）

6. **PushPreferenceRepository** - PushPreferences表
7. **CompliancePlaybookRepository** - CompliancePlaybooks表
8. **AnalyzedContentRepository** - AnalyzedContent表（如果有tenantId）
9. **RawContentRepository** - RawContent表（如果有tenantId）

---

## 📝 实施步骤

### 步骤1: 创建Repository（每个15分钟）

```typescript
// 示例：OrganizationRepository
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../entities/organization.entity';
import { BaseTenantRepository } from './base-tenant.repository';

@Injectable()
export class OrganizationRepository extends BaseTenantRepository<Organization> {
  constructor(
    @InjectRepository(Organization)
    repository: Repository<Organization>,
  ) {
    super(repository, 'Organization');
  }

  // 添加特定的查询方法
  async findByName(tenantId: string, name: string): Promise<Organization | null> {
    return this.findOne(tenantId, { where: { name } });
  }
}
```

### 步骤2: 注册Repository到Module

```typescript
// 在相应的Module中
import { OrganizationRepository } from './repositories/organization.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Organization])],
  providers: [OrganizationRepository],
  exports: [OrganizationRepository],
})
export class OrganizationsModule {}
```

### 步骤3: 更新Service使用Repository

```typescript
// 旧代码（直接使用TypeORM Repository）
@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
  ) {}

  async findAll() {
    return this.orgRepo.find(); // ❌ 没有tenantId过滤
  }
}

// 新代码（使用BaseTenantRepository）
@Injectable()
export class OrganizationsService {
  constructor(
    private readonly orgRepo: OrganizationRepository,
  ) {}

  async findAll(tenantId: string) {
    return this.orgRepo.find(tenantId); // ✓ 自动添加tenantId过滤
  }
}
```

### 步骤4: 更新Controller获取tenantId

```typescript
// 使用@CurrentTenant装饰器
import { CurrentTenant } from '../decorators/current-tenant.decorator';

@Controller('organizations')
@UseGuards(JwtAuthGuard, TenantGuard)
export class OrganizationsController {
  constructor(private readonly orgService: OrganizationsService) {}

  @Get()
  async findAll(@CurrentTenant() tenantId: string) {
    return this.orgService.findAll(tenantId);
  }
}
```

---

## 🧪 测试验证

### 运行测试

```bash
# 运行应用层过滤测试
npm run test:e2e -- app-layer-tenant-filter.e2e-spec.ts

# 运行多租户隔离测试
npm run test:e2e -- multi-tenant-isolation.e2e-spec.ts

# 运行所有E2E测试
npm run test:e2e
```

### 验证清单

- [ ] 测试1: 只返回当前租户的数据
- [ ] 测试2: 阻止跨租户访问
- [ ] 测试3: 保存时自动设置tenantId
- [ ] 测试4: QueryBuilder自动添加过滤
- [ ] 测试5: count只计算当前租户数据
- [ ] 测试6: 防止通过修改tenantId跨租户访问
- [ ] 测试7: 防止通过删除操作跨租户访问

---

## ⚠️ 注意事项

### 1. 所有查询都必须传入tenantId

```typescript
// ❌ 错误：没有传入tenantId
const orgs = await this.orgRepo.find();

// ✓ 正确：传入tenantId
const orgs = await this.orgRepo.find(tenantId);
```

### 2. 不要直接使用TypeORM Repository

```typescript
// ❌ 错误：直接使用TypeORM Repository
@InjectRepository(Organization)
private readonly orgRepo: Repository<Organization>

// ✓ 正确：使用自定义Repository
private readonly orgRepo: OrganizationRepository
```

### 3. 特殊情况：需要跨租户查询

```typescript
// 如果确实需要跨租户查询（如系统管理员功能）
const rawRepo = this.orgRepo.getRawRepository();
const allOrgs = await rawRepo.find(); // ⚠️ 绕过tenantId过滤

// 但要记录日志
this.logger.warn('使用getRawRepository进行跨租户查询');
```

### 4. 迁移现有代码

优先级：
1. 先迁移核心实体（Organizations, Projects, RadarPushes）
2. 再迁移扩展实体
3. 最后迁移辅助实体

---

## 📊 预计工作量

| 任务 | 数量 | 单个耗时 | 总耗时 |
|------|------|---------|--------|
| 创建Repository | 9个 | 15分钟 | 2小时15分钟 |
| 更新Service | ~20个 | 10分钟 | 3小时20分钟 |
| 更新Controller | ~15个 | 5分钟 | 1小时15分钟 |
| 编写测试 | 9个 | 20分钟 | 3小时 |
| 运行测试和修复 | - | - | 2小时 |
| **总计** | - | - | **约12小时** |

---

## 🚀 快速开始

### 今晚完成（3小时）

1. **创建核心Repository**（1小时）
   - OrganizationRepository
   - ProjectRepository
   - WatchedTopicRepository

2. **更新核心Service**（1小时）
   - OrganizationsService
   - ProjectsService
   - WatchedTopicService

3. **运行测试验证**（1小时）
   - 运行应用层过滤测试
   - 修复发现的问题
   - 验证多租户隔离

### 明天完成（9小时）

4. **创建剩余Repository**（1小时15分钟）
5. **更新剩余Service**（2小时20分钟）
6. **更新所有Controller**（1小时15分钟）
7. **编写完整测试**（3小时）
8. **最终验证**（1小时）

---

## ✅ 完成标准

### 功能完成

- [ ] 所有多租户实体都有对应的Repository
- [ ] 所有Service都使用新的Repository
- [ ] 所有Controller都传入tenantId
- [ ] 所有测试都通过

### 安全验证

- [ ] 无法跨租户访问数据
- [ ] 无法通过修改tenantId绕过过滤
- [ ] 无法通过删除操作跨租户访问
- [ ] 审计日志记录所有跨租户操作

### 性能验证

- [ ] 查询性能没有明显下降
- [ ] 数据库索引正确（tenantId字段有索引）
- [ ] 没有N+1查询问题

---

## 📚 参考资料

### 相关文件

- `backend/src/database/repositories/base-tenant.repository.ts` - 基类
- `backend/src/database/repositories/radar-push.repository.ts` - 示例
- `backend/test/app-layer-tenant-filter.e2e-spec.ts` - 测试
- `backend/src/modules/organizations/guards/tenant.guard.ts` - TenantGuard

### 相关文档

- `RLS_FINAL_INVESTIGATION_REPORT.md` - RLS问题调查报告
- `RLS_WORK_SUMMARY.md` - RLS工作总结

---

**创建时间**: 2026-02-02 23:55
**预计完成时间**: 2026-02-04
**负责人**: 开发团队
