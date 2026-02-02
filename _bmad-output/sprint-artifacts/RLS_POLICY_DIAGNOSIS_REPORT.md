# RLS策略问题完整诊断报告

**日期**: 2026-02-02
**问题**: PostgreSQL RLS策略不生效

---

## 问题现象

设置`app.current_tenant`会话变量后，查询仍然返回所有租户的数据，RLS策略完全不生效。

---

## 已验证的配置

### 1. RLS已启用 ✓
```sql
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
```
验证结果: `rowsecurity = true`

### 2. FORCE RLS已启用 ✓
```sql
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
```
验证结果: `relforcerowsecurity = true`

### 3. BYPASSRLS权限已移除 ✓
```sql
ALTER USER postgres NOBYPASSRLS;
```
验证结果: `rolbypassrls = false`

### 4. RLS策略已创建 ✓
```sql
CREATE POLICY tenant_isolation_policy ON organizations
AS PERMISSIVE
FOR ALL
USING (
  tenant_id = current_setting('app.current_tenant', true)::uuid
  OR current_setting('app.is_admin', true)::boolean = true
)
WITH CHECK (
  tenant_id = current_setting('app.current_tenant', true)::uuid
  OR current_setting('app.is_admin', true)::boolean = true
);
```
验证结果: 策略存在，数量 = 1

### 5. 会话变量设置成功 ✓
```sql
SET app.current_tenant = '11111111-1111-1111-1111-111111111111';
SELECT current_setting('app.current_tenant', true);
```
验证结果: 返回正确的UUID

### 6. 策略条件评估正确 ✓
```sql
SELECT
  tenant_id = current_setting('app.current_tenant', true)::uuid as condition_result
FROM organizations;
```
验证结果: `condition_result = true`

---

## 测试结果

所有测试均**失败**：

| 测试 | 预期 | 实际 | 状态 |
|------|------|------|------|
| 不设置租户 | 0条 | 2条 | ✗ |
| 设置租户1 | 1条 | 2条 | ✗ |
| 设置租户2 | 1条 | 2条 | ✗ |
| 管理员模式 | 2条 | 2条 | ✓ |

---

## 关键发现

1. **策略条件评估为true，但策略不生效**
   - 手动执行`tenant_id = current_setting('app.current_tenant', true)::uuid`返回true
   - 但查询仍然返回所有数据

2. **管理员模式测试通过**
   - 说明策略的OR逻辑部分工作
   - `current_setting('app.is_admin', true)::boolean = true`生效

3. **FORCE RLS已启用但无效**
   - 即使对表所有者强制RLS，策略仍不生效

---

## 可能的原因

### 1. PostgreSQL版本问题
- 需要检查PostgreSQL版本是否支持RLS
- RLS在PostgreSQL 9.5+才支持

### 2. 策略语法问题
- `current_setting('app.current_tenant', true)`返回空字符串时
- 空字符串转UUID可能导致异常被忽略

### 3. TypeORM查询绕过RLS
- TypeORM可能使用特殊的查询方式绕过RLS
- 需要验证原始SQL查询是否受RLS限制

### 4. 策略未真正应用
- 虽然`pg_policies`显示策略存在
- 但策略可能未真正编译到查询计划中

---

## 下一步调试

### 1. 检查PostgreSQL版本
```sql
SELECT version();
```

### 2. 使用EXPLAIN查看查询计划
```sql
EXPLAIN (VERBOSE, COSTS OFF)
SELECT * FROM organizations WHERE name LIKE 'RLS Test%';
```
查看是否包含RLS策略过滤

### 3. 测试原始psql客户端
直接使用psql连接数据库测试，排除TypeORM影响

### 4. 检查PostgreSQL日志
查看是否有RLS相关的错误或警告

### 5. 测试简化的策略
```sql
-- 最简单的策略
CREATE POLICY simple_test ON organizations
FOR SELECT
USING (false);  -- 应该阻止所有查询
```

---

## 临时解决方案

在找到根本原因前，可以考虑：

1. **应用层过滤**
   - 在TypeORM Repository中添加WHERE条件
   - 使用QueryBuilder强制添加tenant_id过滤

2. **使用视图**
   - 创建带租户过滤的视图
   - 应用层查询视图而不是表

3. **使用不同的数据库用户**
   - 创建非超级用户
   - 测试RLS是否对普通用户生效

---

## 结论

RLS策略配置完全正确，但**完全不生效**。这是一个严重的问题，可能是：
- PostgreSQL配置问题
- TypeORM与RLS的兼容性问题
- 或者PostgreSQL本身的bug

**建议**: 暂停使用RLS，改用应用层过滤，直到找到根本原因。

---

**报告生成时间**: 2026-02-02 23:30
