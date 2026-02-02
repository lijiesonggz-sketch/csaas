# 现在应该怎么办 - 行动计划

**时间**: 2026-02-02 23:55
**紧急程度**: 🔴 P0 - 立即执行

---

## 🎯 核心决策

**放弃RLS策略，改用应用层过滤**

原因：
- RLS策略完全不生效，原因未知
- 已尝试所有可能的解决方案，全部失败
- 继续调试会浪费时间
- 应用层过滤更可靠、更容易测试

---

## ⏰ 今晚必须完成（3小时）

### 1. 创建核心Repository（1小时）

已创建：
- ✅ `BaseTenantRepository` - 基类
- ✅ `RadarPushRepository` - 示例

需要创建：
- [ ] `OrganizationRepository`
- [ ] `ProjectRepository`
- [ ] `WatchedTopicRepository`

**操作**：
```bash
# 复制示例文件
cp backend/src/database/repositories/radar-push.repository.ts \
   backend/src/database/repositories/organization.repository.ts

# 修改类名和实体名
# 重复3次，创建3个Repository
```

### 2. 更新核心Service（1小时）

需要修改：
- `OrganizationsService`
- `ProjectsService`
- `WatchedTopicService`

**模式**：
```typescript
// 旧代码
constructor(
  @InjectRepository(Organization)
  private readonly repo: Repository<Organization>,
) {}

async findAll() {
  return this.repo.find(); // ❌ 没有tenantId过滤
}

// 新代码
constructor(
  private readonly repo: OrganizationRepository,
) {}

async findAll(tenantId: string) {
  return this.repo.find(tenantId); // ✓ 自动过滤
}
```

### 3. 运行测试验证（1小时）

```bash
# 运行应用层过滤测试
cd backend
npm run test:e2e -- app-layer-tenant-filter.e2e-spec.ts

# 如果通过，运行多租户隔离测试
npm run test:e2e -- multi-tenant-isolation.e2e-spec.ts
```

---

## 📅 明天完成（9小时）

### 4. 创建剩余Repository（1.5小时）
- WatchedPeerRepository
- PushPreferenceRepository
- CompliancePlaybookRepository
- AnalyzedContentRepository
- RawContentRepository

### 5. 更新所有Service（2.5小时）
- 约20个Service需要更新
- 每个10分钟

### 6. 更新所有Controller（1.5小时）
- 约15个Controller需要更新
- 每个5分钟

### 7. 编写完整测试（3小时）
- 为每个Repository编写测试
- 验证租户隔离

### 8. 最终验证（1小时）
- 运行所有E2E测试
- 修复发现的问题

---

## 🚨 关键注意事项

### 1. 不要上线，直到：

- ✅ 所有核心Repository创建完成
- ✅ 所有核心Service更新完成
- ✅ 应用层过滤测试通过
- ✅ 多租户隔离测试通过
- ✅ 无数据泄露风险

### 2. 优先级

**今晚必须完成**：
1. Organizations（最核心）
2. Projects（核心）
3. WatchedTopics（核心）

**明天完成**：
4. 其他实体

### 3. 测试驱动

每创建一个Repository，立即：
1. 编写测试
2. 运行测试
3. 验证通过
4. 再继续下一个

---

## 📊 进度追踪

### 今晚目标

| 任务 | 状态 | 预计耗时 |
|------|------|---------|
| 创建OrganizationRepository | ⏳ 待开始 | 20分钟 |
| 创建ProjectRepository | ⏳ 待开始 | 20分钟 |
| 创建WatchedTopicRepository | ⏳ 待开始 | 20分钟 |
| 更新OrganizationsService | ⏳ 待开始 | 20分钟 |
| 更新ProjectsService | ⏳ 待开始 | 20分钟 |
| 更新WatchedTopicService | ⏳ 待开始 | 20分钟 |
| 运行测试验证 | ⏳ 待开始 | 60分钟 |
| **总计** | - | **3小时** |

### 完成标准

今晚完成后，应该能够：
- ✅ Organizations表有租户过滤
- ✅ Projects表有租户过滤
- ✅ WatchedTopics表有租户过滤
- ✅ 测试验证无数据泄露

---

## 🎯 立即开始

### 第一步：创建OrganizationRepository

```bash
cd backend/src/database/repositories

# 复制示例
cp radar-push.repository.ts organization.repository.ts

# 编辑文件，替换：
# RadarPush -> Organization
# radarPush -> organization
# findByOrganization -> findByName
# findPending -> findActive
```

### 第二步：注册到Module

```typescript
// backend/src/modules/organizations/organizations.module.ts
import { OrganizationRepository } from '../../database/repositories/organization.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Organization])],
  providers: [OrganizationRepository, OrganizationsService],
  exports: [OrganizationRepository],
})
```

### 第三步：更新Service

```typescript
// backend/src/modules/organizations/organizations.service.ts
constructor(
  private readonly orgRepo: OrganizationRepository, // 改这里
) {}

async findAll(tenantId: string) { // 添加tenantId参数
  return this.orgRepo.find(tenantId); // 传入tenantId
}
```

---

## 💡 需要帮助？

如果遇到问题：

1. **查看示例**：`radar-push.repository.ts`
2. **查看测试**：`app-layer-tenant-filter.e2e-spec.ts`
3. **查看指南**：`APP_LAYER_FILTER_IMPLEMENTATION_GUIDE.md`

---

## ✅ 今晚完成后的状态

- 🟢 核心实体有租户过滤
- 🟢 测试验证通过
- 🟢 无数据泄露风险
- 🟡 剩余实体明天完成
- 🟡 完整测试明天完成

**可以安全地继续开发其他功能**。

---

**创建时间**: 2026-02-02 23:55
**预计今晚完成时间**: 2026-02-03 02:55
**预计全部完成时间**: 2026-02-04
