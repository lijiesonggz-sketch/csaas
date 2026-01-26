# 数据库迁移运行指南

## Story 1.1 - AddOrganizations 迁移

**迁移文件**: `1768000000000-AddOrganizations.ts`
**创建日期**: 2026-01-25
**状态**: ✅ 已完成开发，待测试

---

## 📋 迁移内容概览

此迁移实现组织级别的多租户架构，包括：

### 新增表
1. **organizations** - 组织表
2. **organization_members** - 组织成员关系表
3. **weakness_snapshots** - 薄弱项快照表

### 数据库变更
- 新增 2 个 ENUM 类型（organization_member_role_enum, weakness_category_enum）
- projects 表新增 organization_id 外键字段
- 创建 12+ 个索引（包括聚合查询的复合索引）
- 配置 CASCADE 级联删除

### 数据迁移策略
- ✅ **每个用户独立组织**（NOT 全局单一组织）
- ✅ 用户自动成为其组织的 admin
- ✅ 现有项目自动关联到用户的组织

---

## ⚠️ 迁移前检查清单

### 1. 备份数据库（必须）

```bash
# PostgreSQL 备份示例
pg_dump -h localhost -U postgres -d csaas -F c -f csaas_backup_$(date +%Y%m%d_%H%M%S).dump

# 或使用 Docker volume 备份
docker run --rm \
  -v csaas_db_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/csaas_db_backup_$(date +%Y%m%d).tar.gz /data
```

### 2. 检查数据库连接

```bash
# 确保 .env.development 配置正确
cat backend/.env.development | grep DB_

# 测试连接
psql -h $DB_HOST -U $DB_USERNAME -d $DB_DATABASE
```

### 3. 验证现有数据

```bash
# 检查用户数量
psql -c "SELECT COUNT(*) FROM users WHERE deleted_at IS NULL;"

# 检查项目数量
psql -c "SELECT COUNT(*) FROM projects;"
```

### 4. 准备回滚计划

- ✅ 迁移文件包含完整的 `down()` 方法
- ✅ 可以安全回滚所有变更
- ⚠️ **注意**: 回滚会删除新创建的组织数据和关系

---

## 🚀 运行迁移

### 步骤 1: 编译迁移文件

```bash
cd backend
npm run build
```

**预期输出**: 无错误，编译成功

### 步骤 2: 运行迁移（TypeORM）

```bash
# 方式 1: 使用 npm script
npm run migration:run

# 方式 2: 直接执行 typeorm
npx typeorm migration:run -d src/config/typeorm.config.ts
```

**预期输出**:
```
query: CREATE TYPE "organization_member_role_enum" AS ENUM ...
query: CREATE TYPE "weakness_category_enum" AS ENUM ...
query: CREATE TABLE "organizations" ...
Starting data migration: Creating organizations for existing users...
User->organization mapping created
Organizations created for each user
Users linked to their organizations as admins
Projects linked to user organizations
Data migration completed: Organizations created and linked
Migration validation: { org_count: 'X', member_count: 'X', linked_projects: 'Y' }
```

### 步骤 3: 验证迁移结果

```bash
# 运行验证脚本
npx ts-node validate-migration.ts
```

**预期输出**:
```
🔍 Starting migration validation...
✅ Database connection established
📋 Check 1: Validating tables exist...
   Tables found: [ 'organization_members', 'organizations', 'weakness_snapshots' ]
✅ All 3 tables exist

📋 Check 2: Validating ENUM types...
   ENUM types found: [ 'organization_member_role_enum', 'weakness_category_enum' ]
✅ All 2 ENUM types exist

📋 Check 3: Validating one organization per user...
   Organizations: X
   Active users: X
✅ One organization per user validated

... (所有检查通过)

✅ MIGRATION VALIDATION SUCCESSFUL
```

---

## 📊 迁移验证清单

运行迁移后，请确认以下几点：

### 数据完整性检查

```sql
-- 1. 验证组织数量 = 用户数量
SELECT
  (SELECT COUNT(*) FROM organizations) as org_count,
  (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) as user_count;

-- 2. 验证每个用户都是组织成员
SELECT u.id, u.email, om.role, o.name
FROM users u
LEFT JOIN organization_members om ON u.id = om.user_id
LEFT JOIN organizations o ON om.organization_id = o.id
WHERE u.deleted_at IS NULL
LIMIT 10;

-- 3. 验证项目已关联到组织
SELECT
  COUNT(*) as total_projects,
  COUNT(organization_id) as linked_projects,
  COUNT(*) - COUNT(organization_id) as unlinked_projects
FROM projects;

-- 4. 检查是否有孤儿数据（不应该有）
SELECT COUNT(*) FROM organization_members WHERE user_id NOT IN (SELECT id FROM users);
SELECT COUNT(*) FROM organization_members WHERE organization_id NOT IN (SELECT id FROM organizations);
```

### 索引验证

```sql
-- 验证关键索引存在
SELECT tablename, indexname
FROM pg_indexes
WHERE tablename IN ('organizations', 'organization_members', 'weakness_snapshots', 'projects')
  AND indexname LIKE 'IDX_%'
ORDER BY tablename, indexname;
```

**预期索引**:
- `IDX_organizations_name`
- `IDX_organization_members_user_id`
- `IDX_organization_members_organization_id`
- `IDX_weakness_snapshots_org_category` (聚合查询的复合索引)
- `IDX_projects_organization_id`

---

## 🔙 回滚迁移

如果迁移出现问题，执行回滚：

```bash
# 方式 1: 使用 npm script
npm run migration:revert

# 方式 2: 直接执行 typeorm
npx typeorm migration:revert -d src/config/typeorm.config.ts
```

**回滚影响**:
- ⚠️ 删除 `weakness_snapshots` 表
- ⚠️ 删除 `organization_members` 表
- ⚠️ 删除 `organizations` 表
- ⚠️ 移除 `projects.organization_id` 字段
- ⚠️ **数据无法恢复**（除非从备份恢复）

### 回滚后验证

```sql
-- 确认表已删除
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('organizations', 'organization_members', 'weakness_snapshots');
-- 应该返回 0 行

-- 确认 projects 表已移除 organization_id
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'projects' AND column_name = 'organization_id';
-- 应该返回 0 行
```

---

## 🐛 故障排查

### 问题 1: 迁移执行失败 - "relation already exists"

**原因**: 迁移已经部分执行过

**解决方案**:
```bash
# 检查迁移状态
psql -c "SELECT * FROM migrations ORDER BY id DESC LIMIT 5;"

# 如果迁移记录存在但表缺失，手动删除记录
psql -c "DELETE FROM migrations WHERE name = 'AddOrganizations1768000000000';"

# 重新运行迁移
npm run migration:run
```

### 问题 2: 数据迁移失败 - "violates foreign key constraint"

**原因**: 用户或项目数据不一致

**解决方案**:
```sql
-- 检查孤立项目
SELECT id, name, owner_id
FROM projects p
WHERE owner_id NOT IN (SELECT id FROM users WHERE deleted_at IS NULL);

-- 修复孤立项目（设为 NULL 或删除）
UPDATE projects SET owner_id = NULL WHERE owner_id NOT IN (SELECT id FROM users);
```

### 问题 3: 验证脚本失败 - "Expected X organizations, found Y"

**原因**: 数据迁移逻辑错误

**解决方案**:
1. 回滚迁移
2. 检查迁移日志中的 console.log 输出
3. 修正 SQL 逻辑
4. 重新运行迁移

### 问题 4: 性能问题 - 迁移执行时间过长

**原因**: 数据量过大

**解决方案**:
```sql
-- 检查当前数据量
SELECT 'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'projects', COUNT(*) FROM projects;

-- 如果数据量 > 100,000，考虑分批迁移
-- （需要自定义迁移脚本）
```

---

## 📈 生产环境部署建议

### 部署流程

1. **Staging 环境测试** (必须)
   ```bash
   # 在 staging 数据库运行
   npm run migration:run
   npx ts-node validate-migration.ts
   ```

2. **创建生产备份** (必须)
   ```bash
   # 生产数据库完整备份
   pg_dump -h $PROD_DB_HOST -U $PROD_DB_USER -d csaas_prod -F c \
     -f /backups/csaas_prod_pre_migration_$(date +%Y%m%d).dump
   ```

3. **低峰期执行** (推荐)
   - 选择业务低峰时段（如凌晨 2-4 点）
   - 预估停机时间：5-15 分钟

4. **监控迁移执行**
   ```bash
   # 实时监控迁移日志
   npm run migration:run | tee migration.log

   # 在另一个终端监控数据库连接
   watch -n 1 "psql -c 'SELECT count(*) FROM organizations;'"
   ```

5. **部署后验证**
   ```bash
   # 运行验证脚本
   npx ts-node validate-migration.ts

   # 检查应用日志
   tail -f logs/application.log
   ```

### 回滚预案

如果生产环境出现问题：

1. **立即停止应用**
   ```bash
   # 停止所有应用实例
   pm2 stop all
   # 或
   kubectl scale deployment csaas-backend --replicas=0
   ```

2. **回滚数据库**
   ```bash
   npm run migration:revert
   ```

3. **恢复备份**（如果回滚失败）
   ```bash
   pg_restore -h $PROD_DB_HOST -U $PROD_DB_USER -d csaas_prod \
     /backups/csaas_prod_pre_migration_YYYYMMDD.dump
   ```

4. **重启应用**
   ```bash
   pm2 start all
   ```

---

## 📝 迁移完成检查

### 立即检查（迁移后 5 分钟内）

- [ ] 迁移脚本执行完成，无错误
- [ ] 验证脚本通过所有检查
- [ ] 应用启动成功，无错误日志
- [ ] 数据库连接正常

### 功能检查（迁移后 30 分钟内）

- [ ] 用户可以正常登录
- [ ] 用户可以查看自己的组织
- [ ] 项目列表显示正常
- [ ] 创建新项目功能正常
- [ ] 新项目自动关联到用户组织

### 数据一致性检查（迁移后 24 小时内）

- [ ] 所有用户都有对应的组织
- [ ] 所有项目都关联到组织
- [ ] 无孤儿记录（orphan records）
- [ ] 索引正常工作（查询性能正常）

---

## 📚 相关文档

- **迁移文件**: `src/database/migrations/1768000000000-AddOrganizations.ts`
- **验证脚本**: `validate-migration.ts`
- **Story 文档**: `_bmad-output/sprint-artifacts/1-1-system-automatically-creates-organization-and-associates-projects.md`
- **实体定义**:
  - `src/database/entities/organization.entity.ts`
  - `src/database/entities/organization-member.entity.ts`
  - `src/database/entities/weakness-snapshot.entity.ts`

---

## 🆘 获取帮助

如遇到问题，请联系：
- **技术负责人**: [姓名]
- **DBA**: [姓名]
- **紧急联系**: [电话/Slack]

---

**最后更新**: 2026-01-25
**文档版本**: 1.0
**状态**: ✅ 就绪
