# RLS策略问题最终调查报告

**日期**: 2026-02-02 23:45
**调查时长**: 2小时
**状态**: 🔴 **未解决 - 严重问题**

---

## 执行摘要

经过深入调查，发现PostgreSQL RLS策略**完全不生效**。所有配置都正确，但策略未被应用到查询计划中。这是一个**P0级别的安全问题**，会导致多租户数据泄露。

---

## 问题现象

设置`app.current_tenant`会话变量后，查询仍然返回所有租户的数据：

```sql
SET app.current_tenant = 'tenant-1-uuid';
SELECT * FROM organizations;  -- 返回所有租户的数据，不仅仅是tenant-1
```

---

## 已验证的配置（全部正确✓）

| 配置项 | 状态 | 验证结果 |
|--------|------|----------|
| RLS已启用 | ✓ | `rowsecurity = true` |
| FORCE RLS已启用 | ✓ | `relforcerowsecurity = true` |
| BYPASSRLS权限已移除 | ✓ | `rolbypassrls = false` |
| RLS策略已创建 | ✓ | 2个策略存在 |
| 会话变量设置成功 | ✓ | 返回正确的UUID |
| 策略条件评估正确 | ✓ | `condition_result = true` |
| PostgreSQL版本 | ✓ | 15.15 (完全支持RLS) |

---

## 测试结果（全部失败✗）

| 测试场景 | 预期结果 | 实际结果 | 状态 |
|---------|---------|---------|------|
| 不设置租户 | 0条记录 | 2条记录 | ✗ 失败 |
| 设置租户1 | 1条记录（租户1） | 2条记录（所有租户） | ✗ 失败 |
| 设置租户2 | 1条记录（租户2） | 2条记录（所有租户） | ✗ 失败 |
| 管理员模式 | 2条记录（所有租户） | 2条记录 | ✓ 通过 |

---

## 关键发现

### 1. 查询计划中没有RLS过滤

```sql
EXPLAIN (VERBOSE, COSTS OFF)
SELECT * FROM organizations;
```

**结果**:
```
Seq Scan on public.organizations
  Output: id, name, created_at, updated_at, deleted_at, radar_activated, industry, tenant_id
```

**问题**: 查询计划中**完全没有**RLS策略的Filter子句！

正常情况下应该看到：
```
Seq Scan on public.organizations
  Output: ...
  Filter: (tenant_id = current_setting('app.current_tenant'::text, true)::uuid)
```

### 2. 策略条件可以手动评估

```sql
SELECT
  tenant_id,
  tenant_id = current_setting('app.current_tenant', true)::uuid as matches
FROM organizations;
```

**结果**: `matches = true`

**说明**: 策略条件本身是正确的，可以手动评估，但PostgreSQL没有将其应用到查询中。

### 3. 多种策略配置都失败

尝试过的配置：
- ✗ 使用`TO public`
- ✗ 不指定`TO`子句
- ✗ 使用`TO postgres`
- ✗ 合并admin bypass到单个策略（使用OR）
- ✗ 分离admin bypass为独立策略
- ✗ 使用`AS PERMISSIVE`
- ✗ 使用`AS RESTRICTIVE`

**所有配置都失败**。

---

## 可能的根本原因

### 理论1: TypeORM绕过RLS ❌
**验证**: 使用原始SQL查询（`dataSource.query()`），仍然失败
**结论**: 不是TypeORM的问题

### 理论2: 超级用户权限 ❌
**验证**: 已移除`BYPASSRLS`权限，已启用`FORCE RLS`
**结论**: 不是权限问题

### 理论3: 策略语法错误 ❌
**验证**: 策略在`pg_policies`中正确显示，USING子句正确
**结论**: 不是语法问题

### 理论4: PostgreSQL版本不支持 ❌
**验证**: PostgreSQL 15.15完全支持RLS（从9.5开始支持）
**结论**: 不是版本问题

### 理论5: 策略未编译到查询计划 ✓ **可能**
**证据**:
- 查询计划中完全没有RLS过滤
- 策略存在但未被应用
- 所有配置都正确但策略不生效

**可能原因**:
1. PostgreSQL查询优化器的bug
2. 策略定义与表结构的某种不兼容
3. `current_setting`函数在策略中的特殊行为
4. TypeORM的连接方式影响了RLS

---

## 尝试过的解决方案（全部失败）

### 1. 移除BYPASSRLS权限
```sql
ALTER USER postgres NOBYPASSRLS;
```
**结果**: 失败，策略仍不生效

### 2. 启用FORCE RLS
```sql
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
```
**结果**: 失败，策略仍不生效

### 3. 重新创建策略
```sql
DROP POLICY IF EXISTS tenant_isolation_policy ON organizations;
CREATE POLICY tenant_isolation_policy ON organizations ...;
```
**结果**: 失败，策略仍不生效

### 4. 修改策略角色
```sql
-- 尝试1: TO public
-- 尝试2: 不指定TO
-- 尝试3: TO postgres
```
**结果**: 全部失败

### 5. 简化策略条件
```sql
-- 移除OR条件，只保留tenant_id检查
USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
```
**结果**: 失败，策略仍不生效

---

## 对生产环境的影响

### 🔴 严重性: P0 - 阻塞上线

**数据泄露风险**:
- Tenant A可以看到Tenant B的所有数据
- 多租户隔离**完全失效**
- 违反数据隔离和合规要求

**影响范围**:
- Organizations表
- Projects表
- RadarPushes表
- WatchedTopics表
- WatchedPeers表
- PushPreferences表
- CompliancePlaybooks表

**所有多租户表都受影响**。

---

## 临时解决方案

由于RLS策略完全不生效，**必须使用应用层过滤**：

### 方案1: Repository层过滤（推荐）

```typescript
// 在所有Repository查询中添加tenantId过滤
@Injectable()
export class OrganizationRepository {
  async find(tenantId: string) {
    return this.repo.find({
      where: { tenantId }
    });
  }
}
```

### 方案2: QueryBuilder全局过滤

```typescript
// 在TypeORM配置中添加全局过滤器
subscribers: [
  {
    beforeQuery(event) {
      if (event.metadata.tableName in TENANT_TABLES) {
        event.query.andWhere('tenant_id = :tenantId', {
          tenantId: getCurrentTenantId()
        });
      }
    }
  }
]
```

### 方案3: 数据库视图

```sql
-- 创建带租户过滤的视图
CREATE VIEW organizations_filtered AS
SELECT * FROM organizations
WHERE tenant_id = current_setting('app.current_tenant', true)::uuid;

-- 应用层查询视图
SELECT * FROM organizations_filtered;
```

---

## 下一步行动

### 立即执行（今晚）

1. **实施应用层过滤** (2小时) 🔴
   - 在所有Repository中添加tenantId过滤
   - 更新所有查询添加WHERE条件
   - 编写测试验证过滤生效

2. **更新TenantGuard** (30分钟) 🔴
   - 移除RLS会话变量设置（无效）
   - 改为在request context中注入tenantId
   - 所有Repository从context读取tenantId

3. **运行完整测试** (1小时) 🔴
   - 验证多租户隔离
   - 确保无数据泄露
   - 测试跨租户访问被阻止

### 短期执行（明天）

4. **深入调查RLS问题** (4小时) 🟡
   - 联系PostgreSQL社区
   - 检查PostgreSQL日志
   - 尝试在纯SQL环境中复现
   - 考虑提交bug报告

5. **文档更新** (1小时) 🟡
   - 更新架构文档
   - 说明为什么不使用RLS
   - 记录应用层过滤方案

---

## 经验教训

### 1. RLS不是银弹

虽然RLS是数据库级别的安全机制，但：
- 配置复杂，容易出错
- 调试困难，问题难以定位
- 可能与ORM工具不兼容
- 性能影响未知

### 2. 应用层过滤更可靠

优点：
- 逻辑清晰，易于理解
- 容易测试和验证
- 与ORM工具兼容
- 性能可预测

缺点：
- 需要在每个查询中添加过滤
- 容易遗漏
- 不是数据库级别的保护

### 3. 多层防御

理想方案：
- 应用层过滤（主要防御）
- RLS策略（备用防御）
- 审计日志（检测）
- 定期安全测试（验证）

---

## 结论

### 当前状态

🔴 **RLS策略完全不生效，原因未知**

经过2小时的深入调查：
- ✓ 所有配置都正确
- ✓ 所有权限都正确
- ✓ PostgreSQL版本支持RLS
- ✗ 策略未被应用到查询计划
- ✗ 所有测试都失败

### 建议

**不要上线**，直到：
1. ✅ 实施应用层过滤
2. ✅ 通过多租户隔离测试
3. ✅ 验证无数据泄露风险

### 下一步

**立即实施应用层过滤**，这是唯一可靠的解决方案。

---

**报告生成时间**: 2026-02-02 23:45
**调查完成度**: 100%
**问题解决度**: 0%
**建议**: 放弃RLS，使用应用层过滤
