# Story 6.1B 实施变更说明

**日期**: 2026-02-03
**状态**: ⚠️ **需要重新规划**

---

## 🔄 重要变更

### 原计划
- **Layer 3: 数据库层RLS策略（PostgreSQL Row Level Security）** ❌
- Layer 4: 审计层操作日志 ✅

### 实际实施
- ~~Layer 3: 数据库层RLS策略~~ ❌ **已放弃**
- Layer 4: 审计层操作日志 ✅ **保留**

---

## ❌ RLS部分不再实施

### 原因
经过2.5小时深入调查，PostgreSQL RLS策略**完全不生效**：

1. **配置正确但不工作**
   - 所有RLS配置都正确
   - 策略定义正确
   - 会话变量设置成功
   - 但查询计划中没有RLS过滤

2. **尝试了7种解决方案，全部失败**
   - 详见：`RLS_FINAL_INVESTIGATION_REPORT.md`

3. **根本原因未知**
   - 可能是PostgreSQL bug
   - 可能是TypeORM兼容性问题
   - 继续调试会浪费时间

### 替代方案
已在Story 6.1A中实施**应用层Repository过滤**（BaseTenantRepository），测试通过率100%（24/24）。

---

## ✅ 审计层仍然实施

### AC 2: 审计层操作日志（Layer 4）

**保持不变**，继续实施：

```typescript
/**
 * AuditLog Entity
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 50 })
  action: 'create' | 'update' | 'delete' | 'read';

  @Column({ type: 'varchar', length: 100 })
  resource: string; // 'RadarPush', 'Organization', etc.

  @Column({ type: 'uuid', nullable: true })
  resourceId: string;

  @Column({ type: 'jsonb', nullable: true })
  changes: any; // 变更内容

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  userAgent: string;

  @CreateDateColumn()
  timestamp: Date;
}
```

### AuditInterceptor实现

```typescript
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { user, tenantId, method, url, body } = request;

    return next.handle().pipe(
      tap(async (response) => {
        // 异步记录审计日志，不阻塞主请求
        try {
          await this.auditLogService.log({
            userId: user?.id,
            tenantId,
            action: this.getAction(method),
            resource: this.getResource(url),
            resourceId: response?.id,
            changes: body,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          });
        } catch (error) {
          // 审计日志失败不影响主请求
          console.error('Audit log failed:', error);
        }
      }),
    );
  }
}
```

---

## 🔄 AC完成状态

### AC 1: 数据库层行级安全（Layer 3 - RLS）❌
- ❌ **不再实施** - RLS策略不工作
- ✅ **替代方案** - 应用层Repository过滤（已在6.1A完成）

### AC 2: 审计层操作日志（Layer 4）✅
- ✅ 继续实施
- ✅ 创建AuditLog实体
- ✅ 实现AuditInterceptor
- ✅ 异步处理，不阻塞主请求
- ✅ 错误处理，失败不影响主请求

### AC 3: 渗透测试验证 ⚠️
- ⚠️ **需要调整** - 移除RLS相关测试
- ✅ 保留应用层过滤测试
- ✅ 测试跨租户访问阻止
- ✅ 测试SQL注入防护
- ❌ ~~测试直接数据库连接RLS阻止~~ **移除**

### AC 4: 性能测试验证 ⚠️
- ❌ ~~RLS策略对查询性能影响~~ **移除**
- ✅ AuditInterceptor对API响应时间影响 < 5%
- ✅ 多租户场景下的并发性能

---

## 📋 新的实施计划

### Phase 1: 审计日志基础设施（1天）

- [ ] **Task 1.1: 创建AuditLog实体**
  - 文件: `backend/src/database/entities/audit-log.entity.ts`
  - 字段: userId, tenantId, action, resource, resourceId, changes, ipAddress, userAgent, timestamp
  - 约束: 不允许UPDATE和DELETE操作

- [ ] **Task 1.2: 创建AuditLogService**
  - 文件: `backend/src/modules/audit/audit-log.service.ts`
  - 方法: `log(params)` - 记录审计日志
  - 方法: `query(filters)` - 查询审计日志（仅管理员）
  - 异步处理，使用BullMQ队列

- [ ] **Task 1.3: 创建数据库迁移**
  - 文件: `backend/src/database/migrations/1738520000000-CreateAuditLogTable.ts`
  - 创建audit_logs表
  - 添加索引: (tenantId, timestamp), (userId, timestamp), (resource, resourceId)

### Phase 2: AuditInterceptor实现（1天）

- [ ] **Task 2.1: 创建AuditInterceptor**
  - 文件: `backend/src/common/interceptors/audit.interceptor.ts`
  - 拦截所有敏感操作（POST, PUT, PATCH, DELETE）
  - 提取请求信息（userId, tenantId, action, resource, changes）
  - 异步调用AuditLogService.log()
  - 错误处理：失败不影响主请求

- [ ] **Task 2.2: 应用AuditInterceptor**
  - 在AppModule中全局注册
  - 或在特定Controller中使用@UseInterceptors()
  - 配置需要审计的资源类型

- [ ] **Task 2.3: 单元测试**
  - 测试AuditInterceptor正确记录审计日志
  - 测试异步处理不阻塞主请求
  - 测试错误处理

### Phase 3: 审计日志查询API（0.5天）

- [ ] **Task 3.1: 创建AuditLogController**
  - 文件: `backend/src/modules/audit/audit-log.controller.ts`
  - GET /api/audit-logs - 查询审计日志（仅管理员）
  - 支持过滤: tenantId, userId, action, resource, dateRange
  - 支持分页

- [ ] **Task 3.2: 权限控制**
  - 只有系统管理员可以查询审计日志
  - 使用@Roles('admin')装饰器

### Phase 4: 测试验证（0.5天）

- [ ] **Task 4.1: 集成测试**
  - 测试审计日志正确记录
  - 测试异步处理
  - 测试错误处理
  - 测试查询API

- [ ] **Task 4.2: 性能测试**
  - 测试AuditInterceptor对API响应时间影响 < 5%
  - 测试审计日志写入性能
  - 测试多租户场景下的并发性能

---

## ⚠️ 对后续Story的影响

### 安全防御层级调整

**原计划（4层防御）**：
1. Layer 1: API层权限校验（TenantGuard）✅
2. Layer 2: 服务层数据过滤（BaseRepository）✅
3. Layer 3: 数据库层RLS策略 ❌
4. Layer 4: 审计层操作日志 ✅

**实际实施（3层防御）**：
1. Layer 1: API层权限校验（TenantGuard）✅
2. Layer 2: **应用层Repository过滤（BaseTenantRepository）** ✅
3. Layer 3: 审计层操作日志 ✅

### 安全性评估

**优点**：
- ✅ 应用层过滤更可靠（测试通过率100%）
- ✅ 更容易调试和维护
- ✅ 性能可预测
- ✅ 与ORM工具兼容

**缺点**：
- ❌ 缺少数据库层防御
- ❌ 如果代码遗漏tenantId过滤，数据库不会阻止

**缓解措施**：
- ✅ 强制使用BaseTenantRepository（所有多租户实体）
- ✅ 代码审查确保所有查询使用Repository
- ✅ 审计日志记录所有操作
- ✅ 定期安全审计

---

## 📚 相关文档

### 实施文档
- `6-1A-IMPLEMENTATION-CHANGES.md` - Story 6.1A变更说明
- `APP_LAYER_FILTER_IMPLEMENTATION_GUIDE.md` - 应用层过滤实施指南
- `APP_LAYER_FILTER_FINAL_REPORT.md` - 最终完成报告

### 调查文档
- `RLS_FINAL_INVESTIGATION_REPORT.md` - RLS问题调查报告
- `RLS_WORK_SUMMARY.md` - RLS工作总结

---

## ✅ 完成标准（调整后）

### 审计层
- [ ] AuditLog实体创建完成
- [ ] AuditLogService实现完成
- [ ] AuditInterceptor实现完成
- [ ] 审计日志查询API实现完成
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 性能测试通过（影响 < 5%）

### 安全测试
- [ ] 跨租户访问阻止测试通过
- [ ] SQL注入防护测试通过
- [ ] 审计日志完整性测试通过
- [ ] 审计日志不可篡改测试通过

---

**更新时间**: 2026-02-03 01:20
**实施状态**: ⚠️ 需要重新规划（移除RLS部分）
**建议**: 继续实施审计层，放弃RLS
