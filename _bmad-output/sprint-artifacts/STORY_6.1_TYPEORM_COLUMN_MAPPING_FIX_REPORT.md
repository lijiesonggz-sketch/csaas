# TypeORM 列名映射修复完成报告

**执行日期**: 2026-02-02 21:00
**执行者**: Claude Sonnet 4.5
**任务**: 修复 TypeORM 列名映射问题，使 E2E 测试全部通过

---

## ✅ 修复总结

**测试结果**: ✅ **17/17 测试通过 (100%)**

```
Test Suites: 1 passed, 1 total
Tests:       17 passed, 17 total
```

---

## 🔧 修复的问题

### 问题 1: 数据库命名约定不一致

**根本原因**:
- 原始迁移文件（`CreateRadarInfrastructure.ts`）使用 **camelCase** 命名（`organizationId`, `contentId`, `isRead`）
- 多租户迁移文件（`AddMultiTenantSupport.ts`）使用 **snake_case** 命名（`tenant_id`）
- 实体文件的列名映射不一致，导致 TypeORM 无法正确映射字段

**影响范围**:
- `RadarPush` 实体
- `WatchedTopic` 实体
- `WatchedPeer` 实体
- `Organization` 实体
- `Tenant` 实体

---

## 📝 详细修复内容

### 修复 1: Tenant 实体列名映射

**文件**: `backend/src/database/entities/tenant.entity.ts`

**修改**:
```typescript
// 修复前
@Column({ type: 'varchar', length: 50, default: 'basic' })
subscriptionTier: 'basic' | 'pro'

@Column({ type: 'jsonb', nullable: true })
brandConfig?: { ... }

@Column({ type: 'boolean', default: true })
isActive: boolean

// 修复后
@Column({ name: 'subscription_tier', type: 'varchar', length: 50, default: 'basic' })
subscriptionTier: 'basic' | 'pro'

@Column({ name: 'brand_config', type: 'jsonb', nullable: true })
brandConfig?: { ... }

@Column({ name: 'is_active', type: 'boolean', default: true })
isActive: boolean
```

**原因**: Tenant 表使用 snake_case 命名约定

---

### 修复 2: Organization 实体 tenantId 列名映射

**文件**: `backend/src/database/entities/organization.entity.ts`

**修改**:
```typescript
// 修复前
@Column({ type: 'uuid', nullable: false })
tenantId: string

// 修复后
@Column({ name: 'tenant_id', type: 'uuid', nullable: false })
tenantId: string
```

**原因**: 多租户迁移使用 snake_case（`tenant_id`）

---

### 修复 3: WatchedTopic 实体 tenantId 列名映射

**文件**: `backend/src/database/entities/watched-topic.entity.ts`

**修改**:
```typescript
// 修复前
@Column({ type: 'uuid' })
tenantId: string

// 修复后
@Column({ name: 'tenant_id', type: 'uuid' })
tenantId: string
```

---

### 修复 4: WatchedPeer 实体 tenantId 列名映射

**文件**: `backend/src/database/entities/watched-peer.entity.ts`

**修改**:
```typescript
// 修复前
@Column({ type: 'uuid' })
tenantId: string

// 修复后
@Column({ name: 'tenant_id', type: 'uuid' })
tenantId: string
```

---

### 修复 5: RadarPush 实体保持 camelCase

**文件**: `backend/src/database/entities/radar-push.entity.ts`

**决策**: **保持 camelCase**，因为 `CreateRadarInfrastructure.ts` 迁移使用 camelCase

**关键字段**:
- `organizationId` → 数据库列名: `organizationId` (camelCase)
- `tenantId` → 数据库列名: `tenant_id` (snake_case，由多租户迁移添加)
- `contentId` → 数据库列名: `contentId` (camelCase)
- `radarType` → 数据库列名: `radarType` (camelCase)
- `relevanceScore` → 数据库列名: `relevanceScore` (camelCase)
- `priorityLevel` → 数据库列名: `priorityLevel` (camelCase)
- `scheduledAt` → 数据库列名: `scheduledAt` (camelCase)
- `sentAt` → 数据库列名: `sentAt` (camelCase)
- `isRead` → 数据库列名: `isRead` (camelCase)
- `readAt` → 数据库列名: `readAt` (camelCase)
- `isBookmarked` → 数据库列名: `isBookmarked` (camelCase)
- `scheduleConfigId` → 数据库列名: `scheduleConfigId` (camelCase)
- `checklistCompletedAt` → 数据库列名: `checklistCompletedAt` (camelCase)
- `playbookStatus` → 数据库列名: `playbookStatus` (camelCase)

**唯一例外**: `tenantId` 使用 `tenant_id`（snake_case），因为它是由多租户迁移添加的

---

### 修复 6: E2E 测试数据准备

**文件**: `backend/test/multi-tenant-isolation.e2e-spec.ts`

**修改内容**:

1. **User 创建修复**:
```typescript
// 修复前
userA = await userRepo.save({
  username: 'user-a@tenant-a.com',
  email: 'user-a@tenant-a.com',
  password: 'hashed-password',
})

// 修复后
userA = await userRepo.save({
  email: 'user-a@tenant-a.com',
  passwordHash: 'hashed-password-a',
  name: 'User A',
})
```

2. **RadarPush 创建修复** - 添加必需的关联数据:
```typescript
// 创建 RawContent
const rawContent = await rawContentRepo.save({
  source: 'Test Source',
  category: 'tech',
  url: 'https://test.com',
  title: 'Test Content',
  fullContent: 'Test content for RadarPush',
  contentHash: 'hash-a-' + Date.now(),
  publishedAt: new Date(),
})

// 创建 AnalyzedContent
contentA = await analyzedContentRepo.save({
  contentId: rawContent.id,
  tags: [],
  keywords: [],
  aiModel: 'test-model',
  tokensUsed: 100,
  analyzedAt: new Date(),
})

// 创建 RadarPush
pushA = await pushRepo.save({
  organizationId: orgA.id,
  tenantId: tenantA.id,
  radarType: 'tech',
  contentId: contentA.id,  // 使用有效的 contentId
  relevanceScore: 0.95,
  priorityLevel: 'high',
  scheduledAt: new Date(),
  status: 'scheduled',
})
```

**修复的字段**:
- ❌ `username` → 不存在的字段
- ✅ `passwordHash` → 正确的字段名
- ❌ `password` → 不存在的字段
- ❌ `analyzedContentId` → 应该是 `contentId`
- ❌ `contentId: null` → 违反 NOT NULL 约束
- ❌ `content` → 应该是 `fullContent`
- ✅ 添加 `contentHash` → 必需字段
- ✅ 添加 `tokensUsed` → 必需字段
- ✅ 添加 `analyzedAt` → 必需字段

---

## 🎯 命名约定总结

### 规则 1: 原始表使用 camelCase
- `radar_pushes` 表的列名使用 camelCase（`organizationId`, `contentId`, `isRead`）
- `analyzed_contents` 表的列名使用 camelCase
- `raw_contents` 表的列名使用 camelCase

### 规则 2: 多租户字段使用 snake_case
- 所有 `tenantId` 字段映射为 `tenant_id`（由 `AddMultiTenantSupport.ts` 迁移添加）

### 规则 3: 新表使用 snake_case
- `tenants` 表使用 snake_case（`subscription_tier`, `brand_config`, `is_active`）
- `watched_topics` 表使用 snake_case（`topic_name`, `topic_type`, `organization_id`, `tenant_id`）
- `watched_peers` 表使用 snake_case（`institution_type`, `organization_id`, `tenant_id`）

---

## 📊 测试覆盖范围

### 通过的测试场景 (17/17)

#### Setup: Create test tenants and users (5/5)
✅ should create Tenant A and Tenant B
✅ should create Organization A (belongs to Tenant A)
✅ should create Organization B (belongs to Tenant B)
✅ should create User A (member of Organization A)
✅ should create User B (member of Organization B)

#### AC 4: Multi-tenant isolation validation

**Scenario 1: Tenant A creates RadarPush (3/3)**
✅ should create RadarPush for Tenant A
✅ Tenant A should be able to query their own RadarPush
✅ Tenant B should NOT be able to query Tenant A's RadarPush

**Scenario 2: Tenant B creates WatchedTopic (3/3)**
✅ should create WatchedTopic for Tenant B
✅ Tenant B should be able to query their own WatchedTopic
✅ Tenant A should NOT be able to query Tenant B's WatchedTopic

**Scenario 3: Cross-tenant data isolation (2/2)**
✅ Tenant A should only see their own RadarPushes
✅ Tenant B should only see their own WatchedTopics

**Scenario 4: Update and Delete operations respect tenant isolation (2/2)**
✅ Tenant A cannot update Tenant B's data
✅ Tenant A cannot delete Tenant B's data

#### Edge Cases (2/2)
✅ should handle user belonging to multiple organizations (same tenant)
✅ should prevent creating data without tenantId

---

## 🔍 技术洞察

### 1. TypeORM 列名映射机制

TypeORM 使用 `@Column({ name: 'column_name' })` 来映射实体字段名到数据库列名：

```typescript
// 实体字段名（camelCase）
@Column({ name: 'database_column_name' })
entityFieldName: string
```

如果不指定 `name` 参数，TypeORM 会直接使用字段名作为列名。

### 2. 数据库命名约定的重要性

**问题**: 项目中存在两种命名约定：
- 早期迁移使用 camelCase
- 后期迁移使用 snake_case

**影响**:
- 增加了维护复杂度
- 容易出现列名映射错误
- 需要在实体中显式指定列名映射

**建议**:
- 统一使用 snake_case（PostgreSQL 最佳实践）
- 或者统一使用 camelCase（TypeORM 默认）
- 避免混合使用两种约定

### 3. 外键约束的重要性

`RadarPush` 表的 `contentId` 字段有 NOT NULL 约束和外键约束：

```sql
"contentId" uuid NOT NULL,
CONSTRAINT "FK_radar_pushes_content"
  FOREIGN KEY ("contentId")
  REFERENCES "analyzed_contents"("id")
  ON DELETE CASCADE
```

这意味着：
- 必须先创建 `RawContent` 和 `AnalyzedContent`
- 然后才能创建 `RadarPush`
- 不能使用 `null` 值

---

## 📈 修复进度

| 阶段 | 状态 | 完成度 |
|------|------|--------|
| TypeORM 配置修复 | ✅ 完成 | 100% |
| 实体列名映射修复 | ✅ 完成 | 100% |
| E2E 测试数据准备 | ✅ 完成 | 100% |
| 多租户隔离测试 | ✅ 通过 | 100% (17/17) |

---

## 🎉 结论

✅ **所有 TypeORM 列名映射问题已修复**
✅ **所有 17 个多租户隔离 E2E 测试通过**
✅ **数据库命名约定已明确**
✅ **测试数据准备流程已完善**

---

## 📋 下一步建议

### 立即执行

1. **运行其他 E2E 测试套件**:
```bash
cd backend
npm run test:e2e -- --testPathPattern="rls-policy"
npm run test:e2e -- --testPathPattern="performance-test"
```

2. **运行完整的单元测试**:
```bash
npm run test
```

### 长期优化

1. **统一数据库命名约定**:
   - 创建迁移将所有 camelCase 列名改为 snake_case
   - 或者保持 camelCase 并在所有新迁移中使用 camelCase

2. **添加 TypeORM 配置**:
```typescript
// typeorm.config.ts
{
  namingStrategy: new SnakeCaseNamingStrategy(), // 自动转换为 snake_case
}
```

3. **改进测试数据工厂**:
   - 创建 `TestDataFactory` 类
   - 封装复杂的测试数据创建逻辑
   - 避免在每个测试中重复创建关联数据

---

**报告生成时间**: 2026-02-02 21:00
**报告生成者**: Claude Sonnet 4.5
**修复完成度**: 100%
**测试通过率**: 100% (17/17)
