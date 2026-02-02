# Story 6.1: 多租户数据模型与隔离机制

Status: ready-for-dev

## Story

As a 系统架构师,
I want 实现 4 层多租户防御机制（API 层 + 服务层 + 数据库层 + 审计层）,
So that 咨询公司 A 的客户数据对咨询公司 B 完全不可见，确保数据安全。

## Acceptance Criteria

### AC 1: 多租户数据模型设计

**Given** 系统需要支持多租户
**When** 设计数据模型
**Then** 所有核心表（Organization, Project, RadarPush, WatchedTopic, WatchedPeer）包含 tenantId 字段
**And** tenantId 关联到 Tenant 表（咨询公司）

**Implementation Notes:**
- 创建 Tenant 实体表示咨询公司
- 所有组织级别数据必须包含 tenantId 字段
- 建立 Tenant → Organization 的一对多关系
- 确保数据库迁移脚本正确添加 tenantId 列和外键约束

### AC 2: API 层权限校验（Layer 1）

**Given** API 层权限校验
**When** 用户请求 API
**Then** TenantGuard 从 JWT token 中提取 tenantId
**And** 验证用户是否属于该 tenant
**And** 如果不属于，返回 403 Forbidden
**And** 将 tenantId 注入到请求上下文中

**Implementation Notes:**
- 创建 TenantGuard 继承自 NestJS CanActivate
- 从 JWT token 中提取 userId
- 查询 OrganizationMember 表获取用户所属的 organizationId
- 查询 Organization 表获取 tenantId
- 使用 @CurrentTenant() 装饰器注入 tenantId 到控制器方法
- 记录所有权限校验失败到审计日志

### AC 3: 服务层数据过滤（Layer 2）

**Given** 服务层数据过滤
**When** TypeORM Repository 查询数据
**Then** 自动添加 WHERE tenantId = :tenantId 条件
**And** 使用 BaseRepository 封装通用过滤逻辑
**And** 所有查询方法继承 BaseRepository

**Implementation Notes:**
- 创建 BaseRepository<T> 抽象类
- 实现 findAll(tenantId: string) 方法自动添加 tenantId 过滤
- 实现 findOne(tenantId: string, id: string) 方法
- 实现 create(tenantId: string, data: Partial<T>) 方法自动注入 tenantId
- 所有 Service 的 Repository 继承 BaseRepository
- 确保所有查询都经过 tenantId 过滤

### AC 4: 数据库层行级安全（Layer 3）

**Given** 数据库层行级安全（PostgreSQL RLS）
**When** 配置 RLS 策略
**Then** 为所有核心表启用 RLS
**And** 创建策略：USING (tenantId = current_setting('app.current_tenant')::uuid)
**And** 应用连接时设置 SET app.current_tenant = '<tenantId>'

**Implementation Notes:**
- 为以下表启用 RLS：
  - organizations
  - projects
  - radar_pushes
  - watched_topics
  - watched_peers
  - push_preferences
  - compliance_playbooks
- 创建 RLS 策略函数
- 在数据库连接初始化时设置 app.current_tenant
- 确保 RLS 策略不影响系统管理员操作

### AC 5: 审计层操作日志（Layer 4）

**Given** 审计层操作日志
**When** 任何敏感操作执行（创建/更新/删除）
**Then** 记录审计日志：userId、tenantId、操作类型、数据对象、时间戳
**And** 日志保留 1 年，任何人无法篡改或删除
**And** 季度渗透测试跨租户数据访问成功率为 0%

**Implementation Notes:**
- 创建 AuditLog 实体
- 实现 AuditInterceptor 拦截所有敏感操作
- 记录以下信息：
  - userId: 操作用户 ID
  - tenantId: 租户 ID
  - action: 'create' | 'update' | 'delete' | 'read'
  - resource: 资源类型（如 'RadarPush', 'Organization'）
  - resourceId: 资源 ID
  - changes: 变更内容（JSON）
  - ipAddress: 请求 IP
  - userAgent: 用户代理
  - timestamp: 操作时间
- 审计日志表不允许删除和更新操作
- 实现审计日志查询 API（仅管理员可访问）

## Tasks / Subtasks

### Phase 1: 数据模型设计与迁移 (1天)

- [ ] **Task 1.1: 创建 Tenant 实体** (AC: #1)
  - [ ] 文件: `backend/src/database/entities/tenant.entity.ts`
  - [ ] 字段设计:
    ```typescript
    @Entity('tenants')
    export class Tenant {
      @PrimaryGeneratedColumn('uuid')
      id: string;

      @Column({ type: 'varchar', length: 255 })
      name: string; // 咨询公司名称

      @Column({ type: 'varchar', length: 50, default: 'basic' })
      subscriptionTier: 'basic' | 'pro';

      @Column({ type: 'jsonb', nullable: true })
      brandConfig: {
        logo?: string;
        companyName?: string;
        themeColor?: string;
      };

      @Column({ type: 'boolean', default: true })
      isActive: boolean;

      @CreateDateColumn()
      createdAt: Date;

      @UpdateDateColumn()
      updatedAt: Date;

      @OneToMany(() => Organization, org => org.tenant)
      organizations: Organization[];
    }
    ```
  - [ ] 添加单元测试
  - [ ] **完成标准**: Tenant 实体定义完整，关系正确

- [ ] **Task 1.2: 修改 Organization 实体添加 tenantId** (AC: #1)
  - [ ] 文件: `backend/src/database/entities/organization.entity.ts`
  - [ ] 添加字段:
    ```typescript
    @Column({ type: 'uuid', nullable: true }) // MVP 阶段允许 null，Growth 阶段改为 NOT NULL
    tenantId: string;

    @ManyToOne(() => Tenant, tenant => tenant.organizations)
    @JoinColumn({ name: 'tenant_id' })
    tenant: Tenant;
    ```
  - [ ] **完成标准**: Organization 实体更新完成

- [ ] **Task 1.3: 创建数据库迁移脚本** (AC: #1)
  - [ ] 文件: `backend/src/database/migrations/YYYYMMDDHHMMSS-AddMultiTenantSupport.ts`
  - [ ] 迁移内容:
    - 创建 tenants 表
    - 为 organizations 表添加 tenant_id 列（nullable）
    - 为 projects 表添加 tenant_id 列（nullable）
    - 为 radar_pushes 表添加 tenant_id 列（nullable）
    - 为 watched_topics 表添加 tenant_id 列（nullable）
    - 为 watched_peers 表添加 tenant_id 列（nullable）
    - 为 push_preferences 表添加 tenant_id 列（nullable）
    - 为 compliance_playbooks 表添加 tenant_id 列（nullable）
    - 添加外键约束
    - 添加索引: idx_organizations_tenant_id, idx_radar_pushes_tenant_id 等
  - [ ] **完成标准**: 迁移脚本可成功执行，数据库结构正确

- [ ] **Task 1.4: 创建 AuditLog 实体** (AC: #5)
  - [ ] 文件: `backend/src/database/entities/audit-log.entity.ts`
  - [ ] 字段设计:
    ```typescript
    @Entity('audit_logs')
    export class AuditLog {
      @PrimaryGeneratedColumn('uuid')
      id: string;

      @Column({ type: 'uuid' })
      userId: string;

      @Column({ type: 'uuid', nullable: true })
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
  - [ ] **完成标准**: AuditLog 实体定义完整

### Phase 2: API 层权限校验 (1天)

- [ ] **Task 2.1: 创建 TenantGuard** (AC: #2)
  - [ ] 文件: `backend/src/modules/organizations/guards/tenant.guard.ts`
  - [ ] 实现逻辑:
    ```typescript
    @Injectable()
    export class TenantGuard implements CanActivate {
      constructor(
        private readonly organizationService: OrganizationService,
      ) {}

      async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const userId = request.user?.id; // 从 JWT 提取

        if (!userId) {
          throw new UnauthorizedException('User not authenticated');
        }

        // 查询用户所属组织
        const organization = await this.organizationService.findByUserId(userId);

        if (!organization) {
          throw new ForbiddenException('User does not belong to any organization');
        }

        // 注入 tenantId 到请求上下文
        request.tenantId = organization.tenantId;
        request.organizationId = organization.id;

        return true;
      }
    }
    ```
  - [ ] **完成标准**: TenantGuard 实现完整，单元测试通过

- [ ] **Task 2.2: 创建 @CurrentTenant() 装饰器** (AC: #2)
  - [ ] 文件: `backend/src/modules/organizations/decorators/current-tenant.decorator.ts`
  - [ ] 实现:
    ```typescript
    export const CurrentTenant = createParamDecorator(
      (data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        return request.tenantId;
      },
    );
    ```
  - [ ] **完成标准**: 装饰器可正确提取 tenantId

- [ ] **Task 2.3: 应用 TenantGuard 到所有 Radar 控制器** (AC: #2)
  - [ ] 文件:
    - `backend/src/modules/radar/controllers/radar-push.controller.ts`
    - `backend/src/modules/radar/controllers/watched-topic.controller.ts`
    - `backend/src/modules/radar/controllers/watched-peer.controller.ts`
    - `backend/src/modules/radar/controllers/push-preference.controller.ts`
  - [ ] 添加 `@UseGuards(TenantGuard)` 到控制器类
  - [ ] 使用 `@CurrentTenant()` 装饰器注入 tenantId
  - [ ] **完成标准**: 所有 Radar API 都受 TenantGuard 保护

### Phase 3: 服务层数据过滤 (1天)

- [ ] **Task 3.1: 创建 BaseRepository** (AC: #3)
  - [ ] 文件: `backend/src/database/repositories/base.repository.ts`
  - [ ] 实现通用过滤方法:
    ```typescript
    export abstract class BaseRepository<T> {
      constructor(
        protected readonly repository: Repository<T>,
      ) {}

      async findAll(tenantId: string, options?: FindManyOptions<T>): Promise<T[]> {
        return this.repository.find({
          ...options,
          where: {
            ...options?.where,
            tenantId,
          },
        });
      }

      async findOne(tenantId: string, id: string): Promise<T | null> {
        return this.repository.findOne({
          where: { id, tenantId } as any,
        });
      }

      async create(tenantId: string, data: Partial<T>): Promise<T> {
        const entity = this.repository.create({
          ...data,
          tenantId,
        } as any);
        return this.repository.save(entity);
      }

      async update(tenantId: string, id: string, data: Partial<T>): Promise<T> {
        await this.repository.update(
          { id, tenantId } as any,
          data,
        );
        return this.findOne(tenantId, id);
      }

      async delete(tenantId: string, id: string): Promise<void> {
        await this.repository.delete({ id, tenantId } as any);
      }
    }
    ```
  - [ ] **完成标准**: BaseRepository 实现完整，单元测试通过

- [ ] **Task 3.2: 重构所有 Service 使用 BaseRepository** (AC: #3)
  - [ ] 文件:
    - `backend/src/modules/radar/services/radar-push.service.ts`
    - `backend/src/modules/radar/services/watched-topic.service.ts`
    - `backend/src/modules/radar/services/watched-peer.service.ts`
    - `backend/src/modules/radar/services/push-preference.service.ts`
  - [ ] 修改所有查询方法添加 tenantId 参数
  - [ ] 使用 BaseRepository 的方法替代直接 Repository 调用
  - [ ] **完成标准**: 所有 Service 都使用 BaseRepository，单元测试通过

### Phase 4: 数据库层行级安全 (0.5天)

- [ ] **Task 4.1: 创建 RLS 策略迁移脚本** (AC: #4)
  - [ ] 文件: `backend/src/database/migrations/YYYYMMDDHHMMSS-EnableRowLevelSecurity.ts`
  - [ ] 迁移内容:
    ```sql
    -- 启用 RLS
    ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
    ALTER TABLE radar_pushes ENABLE ROW LEVEL SECURITY;
    ALTER TABLE watched_topics ENABLE ROW LEVEL SECURITY;
    ALTER TABLE watched_peers ENABLE ROW LEVEL SECURITY;
    ALTER TABLE push_preferences ENABLE ROW LEVEL SECURITY;
    ALTER TABLE compliance_playbooks ENABLE ROW LEVEL SECURITY;

    -- 创建 RLS 策略
    CREATE POLICY tenant_isolation_policy ON organizations
      USING (tenant_id = current_setting('app.current_tenant')::uuid);

    CREATE POLICY tenant_isolation_policy ON projects
      USING (tenant_id = current_setting('app.current_tenant')::uuid);

    -- ... 为其他表创建类似策略
    ```
  - [ ] **完成标准**: RLS 策略迁移脚本可成功执行

- [ ] **Task 4.2: 配置数据库连接设置 app.current_tenant** (AC: #4)
  - [ ] 文件: `backend/src/database/database.module.ts`
  - [ ] 在连接初始化时设置 current_tenant:
    ```typescript
    TypeOrmModule.forRootAsync({
      useFactory: async () => ({
        // ... 其他配置
        extra: {
          // 设置默认 tenant（系统管理员）
          application_name: 'csaas-radar',
        },
      }),
    }),
    ```
  - [ ] 在每个请求中动态设置 tenant:
    ```typescript
    // 在 TenantGuard 中
    await this.dataSource.query(
      `SET app.current_tenant = '${tenantId}'`
    );
    ```
  - [ ] **完成标准**: RLS 策略生效，跨租户查询被阻止

### Phase 5: 审计层实现 (1天)

- [ ] **Task 5.1: 创建 AuditInterceptor** (AC: #5)
  - [ ] 文件: `backend/src/common/interceptors/audit.interceptor.ts`
  - [ ] 实现逻辑:
    ```typescript
    @Injectable()
    export class AuditInterceptor implements NestInterceptor {
      constructor(
        private readonly auditLogService: AuditLogService,
      ) {}

      intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const { user, tenantId, method, url, body } = request;

        const action = this.mapMethodToAction(method);
        const resource = this.extractResourceFromUrl(url);

        return next.handle().pipe(
          tap(async (response) => {
            await this.auditLogService.log({
              userId: user?.id,
              tenantId,
              action,
              resource,
              resourceId: response?.id,
              changes: body,
              ipAddress: request.ip,
              userAgent: request.headers['user-agent'],
            });
          }),
        );
      }

      private mapMethodToAction(method: string): string {
        const mapping = {
          POST: 'create',
          PUT: 'update',
          PATCH: 'update',
          DELETE: 'delete',
          GET: 'read',
        };
        return mapping[method] || 'unknown';
      }

      private extractResourceFromUrl(url: string): string {
        // 从 URL 提取资源类型
        // 例如: /api/radar/pushes -> RadarPush
        const match = url.match(/\/api\/radar\/(\w+)/);
        return match ? match[1] : 'unknown';
      }
    }
    ```
  - [ ] **完成标准**: AuditInterceptor 实现完整

- [ ] **Task 5.2: 创建 AuditLogService** (AC: #5)
  - [ ] 文件: `backend/src/modules/audit/audit-log.service.ts`
  - [ ] 实现方法:
    - `log(data: CreateAuditLogDto): Promise<void>`
    - `findAll(tenantId: string, query: QueryAuditLogDto): Promise<AuditLog[]>`
    - `findByResource(tenantId: string, resource: string, resourceId: string): Promise<AuditLog[]>`
  - [ ] **完成标准**: AuditLogService 实现完整，单元测试通过

- [ ] **Task 5.3: 应用 AuditInterceptor 到敏感操作** (AC: #5)
  - [ ] 文件: 所有 Radar 控制器
  - [ ] 添加 `@UseInterceptors(AuditInterceptor)` 到敏感操作方法
  - [ ] 敏感操作包括:
    - 创建/更新/删除 RadarPush
    - 创建/更新/删除 WatchedTopic
    - 创建/更新/删除 WatchedPeer
    - 创建/更新/删除 PushPreference
  - [ ] **完成标准**: 所有敏感操作都被审计

- [ ] **Task 5.4: 创建审计日志查询 API** (AC: #5)
  - [ ] 文件: `backend/src/modules/audit/audit-log.controller.ts`
  - [ ] 端点设计:
    - `GET /api/audit/logs` - 查询审计日志（仅管理员）
    - `GET /api/audit/logs/:resourceId` - 查询特定资源的审计日志
  - [ ] 使用 AdminGuard 保护端点
  - [ ] **完成标准**: 审计日志 API 实现完整

### Phase 6: 测试与验证 (1天)

- [ ] **Task 6.1: 单元测试**
  - [ ] 测试文件:
    - `backend/src/modules/organizations/guards/tenant.guard.spec.ts`
    - `backend/src/database/repositories/base.repository.spec.ts`
    - `backend/src/modules/audit/audit-log.service.spec.ts`
  - [ ] 测试用例:
    - TenantGuard 应该正确提取 tenantId
    - TenantGuard 应该拒绝无效用户
    - BaseRepository 应该自动添加 tenantId 过滤
    - AuditLogService 应该正确记录审计日志
  - [ ] **完成标准**: 单元测试覆盖率≥80%，所有测试通过

- [ ] **Task 6.2: 集成测试 - 多租户隔离**
  - [ ] 测试文件: `backend/test/multi-tenant-isolation.e2e-spec.ts`
  - [ ] 测试场景:
    - 租户 A 不能访问租户 B 的数据
    - 租户 A 创建的数据自动关联到租户 A
    - 租户 B 查询时看不到租户 A 的数据
    - RLS 策略生效，直接 SQL 查询也被阻止
  - [ ] **完成标准**: 多租户隔离测试 100% 通过

- [ ] **Task 6.3: 渗透测试**
  - [ ] 测试场景:
    - 尝试通过修改 API 参数访问其他租户数据
    - 尝试通过 SQL 注入绕过 tenantId 过滤
    - 尝试通过直接数据库连接访问其他租户数据
  - [ ] **完成标准**: 跨租户数据访问成功率为 0%

- [ ] **Task 6.4: 性能测试**
  - [ ] 测试场景:
    - 测试 RLS 策略对查询性能的影响
    - 测试 AuditInterceptor 对 API 响应时间的影响
    - 测试多租户场景下的并发性能
  - [ ] **完成标准**: 性能退化 < 10%

## Dev Notes

### 架构上下文

**多租户架构设计原则:**
- 本 Story 实现 4 层防御机制，确保咨询公司 A 的客户数据对咨询公司 B 完全不可见
- 采用混合模式：MVP 阶段 Organization 级别隔离，Growth 阶段引入 Tenant 实体
- 所有核心表必须包含 tenantId 字段，确保数据隔离
- 使用 PostgreSQL RLS（行级安全）作为最后一道防线

**与现有系统的集成:**
- 复用 Csaas 的认证系统（JWT + NestJS Guards）
- 扩展 OrganizationGuard 为 TenantGuard
- 所有 Radar Service 的 API 都必须应用 TenantGuard
- 审计日志记录所有敏感操作，保留 1 年

### 技术栈与依赖

**后端技术栈:**
- NestJS 10.4 + TypeORM + PostgreSQL + Redis
- 使用 NestJS Guards 实现 API 层权限校验
- 使用 TypeORM Repository 实现服务层数据过滤
- 使用 PostgreSQL RLS 实现数据库层行级安全
- 使用 NestJS Interceptors 实现审计层

**关键依赖:**
- `@nestjs/common`: Guards, Interceptors, Decorators
- `@nestjs/typeorm`: Repository, Entity
- `typeorm`: QueryBuilder, FindOptions
- `pg`: PostgreSQL 驱动

### 数据模型详细设计

**Tenant 实体 (新增):**
```typescript
// backend/src/database/entities/tenant.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Organization } from './organization.entity';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string; // 咨询公司名称

  @Column({ type: 'varchar', length: 50, default: 'basic' })
  subscriptionTier: 'basic' | 'pro';

  @Column({ type: 'jsonb', nullable: true })
  brandConfig: {
    logo?: string;
    companyName?: string;
    themeColor?: string;
  };

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Organization, org => org.tenant)
  organizations: Organization[];
}
```

**Organization 实体修改:**
```typescript
// backend/src/database/entities/organization.entity.ts
// 添加以下字段

@Column({ type: 'uuid', nullable: true }) // MVP 阶段允许 null
tenantId: string;

@ManyToOne(() => Tenant, tenant => tenant.organizations)
@JoinColumn({ name: 'tenant_id' })
tenant: Tenant;
```

**AuditLog 实体 (新增):**
```typescript
// backend/src/database/entities/audit-log.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  tenantId: string;

  @Column({ type: 'varchar', length: 50 })
  action: 'create' | 'update' | 'delete' | 'read';

  @Column({ type: 'varchar', length: 100 })
  resource: string;

  @Column({ type: 'uuid', nullable: true })
  resourceId: string;

  @Column({ type: 'jsonb', nullable: true })
  changes: any;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  userAgent: string;

  @CreateDateColumn()
  timestamp: Date;
}
```

### API 层实现模式

**TenantGuard 实现:**
```typescript
// backend/src/modules/organizations/guards/tenant.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { OrganizationService } from '../organizations.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly organizationService: OrganizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    // 查询用户所属组织
    const organization = await this.organizationService.findByUserId(userId);

    if (!organization) {
      throw new ForbiddenException('User does not belong to any organization');
    }

    // 注入 tenantId 和 organizationId 到请求上下文
    request.tenantId = organization.tenantId;
    request.organizationId = organization.id;

    return true;
  }
}
```

**@CurrentTenant() 装饰器:**
```typescript
// backend/src/modules/organizations/decorators/current-tenant.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantId;
  },
);
```

**控制器使用示例:**
```typescript
// backend/src/modules/radar/controllers/radar-push.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { TenantGuard } from '../../organizations/guards/tenant.guard';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import { CurrentOrg } from '../../organizations/decorators/current-org.decorator';

@Controller('radar/pushes')
@UseGuards(TenantGuard) // 应用 TenantGuard
export class RadarPushController {
  constructor(private readonly radarPushService: RadarPushService) {}

  @Get()
  async findAll(
    @CurrentTenant() tenantId: string, // 自动注入 tenantId
    @CurrentOrg() organizationId: string, // 自动注入 organizationId
  ) {
    return this.radarPushService.findAll(tenantId, organizationId);
  }
}
```

### 服务层实现模式

**BaseRepository 实现:**
```typescript
// backend/src/database/repositories/base.repository.ts
import { Repository, FindManyOptions, FindOneOptions } from 'typeorm';

export abstract class BaseRepository<T> {
  constructor(
    protected readonly repository: Repository<T>,
  ) {}

  async findAll(tenantId: string, options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find({
      ...options,
      where: {
        ...options?.where,
        tenantId,
      },
    });
  }

  async findOne(tenantId: string, id: string): Promise<T | null> {
    return this.repository.findOne({
      where: { id, tenantId } as any,
    });
  }

  async create(tenantId: string, data: Partial<T>): Promise<T> {
    const entity = this.repository.create({
      ...data,
      tenantId,
    } as any);
    return this.repository.save(entity);
  }

  async update(tenantId: string, id: string, data: Partial<T>): Promise<T> {
    await this.repository.update(
      { id, tenantId } as any,
      data,
    );
    return this.findOne(tenantId, id);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.repository.delete({ id, tenantId } as any);
  }
}
```

**Service 使用 BaseRepository 示例:**
```typescript
// backend/src/modules/radar/services/radar-push.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RadarPush } from '../../database/entities/radar-push.entity';
import { BaseRepository } from '../../database/repositories/base.repository';

@Injectable()
export class RadarPushService extends BaseRepository<RadarPush> {
  constructor(
    @InjectRepository(RadarPush)
    private readonly radarPushRepository: Repository<RadarPush>,
  ) {
    super(radarPushRepository);
  }

  // 所有方法都自动包含 tenantId 过滤
  async findAll(tenantId: string, organizationId: string): Promise<RadarPush[]> {
    return super.findAll(tenantId, {
      where: { organizationId },
      order: { sentAt: 'DESC' },
    });
  }
}
```

### 数据库层 RLS 实现

**RLS 策略迁移脚本:**
```sql
-- backend/src/database/migrations/YYYYMMDDHHMMSS-EnableRowLevelSecurity.ts

-- 启用 RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar_pushes ENABLE ROW LEVEL SECURITY;
ALTER TABLE watched_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE watched_peers ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_playbooks ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
CREATE POLICY tenant_isolation_policy ON organizations
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_policy ON projects
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_policy ON radar_pushes
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_policy ON watched_topics
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_policy ON watched_peers
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_policy ON push_preferences
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_policy ON compliance_playbooks
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

**在 TenantGuard 中设置 current_tenant:**
```typescript
// backend/src/modules/organizations/guards/tenant.guard.ts
import { DataSource } from 'typeorm';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly dataSource: DataSource, // 注入 DataSource
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ... 前面的逻辑

    // 设置 PostgreSQL session 变量
    if (organization.tenantId) {
      await this.dataSource.query(
        `SET app.current_tenant = '${organization.tenantId}'`
      );
    }

    request.tenantId = organization.tenantId;
    request.organizationId = organization.id;

    return true;
  }
}
```

### 审计层实现

**AuditInterceptor 实现:**
```typescript
// backend/src/common/interceptors/audit.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from '../../modules/audit/audit-log.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { user, tenantId, method, url, body } = request;

    const action = this.mapMethodToAction(method);
    const resource = this.extractResourceFromUrl(url);

    return next.handle().pipe(
      tap(async (response) => {
        await this.auditLogService.log({
          userId: user?.id,
          tenantId,
          action,
          resource,
          resourceId: response?.id,
          changes: body,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });
      }),
    );
  }

  private mapMethodToAction(method: string): string {
    const mapping = {
      POST: 'create',
      PUT: 'update',
      PATCH: 'update',
      DELETE: 'delete',
      GET: 'read',
    };
    return mapping[method] || 'unknown';
  }

  private extractResourceFromUrl(url: string): string {
    const match = url.match(/\/api\/radar\/(\w+)/);
    return match ? match[1] : 'unknown';
  }
}
```

**AuditLogService 实现:**
```typescript
// backend/src/modules/audit/audit-log.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(data: Partial<AuditLog>): Promise<void> {
    const auditLog = this.auditLogRepository.create(data);
    await this.auditLogRepository.save(auditLog);
  }

  async findAll(tenantId: string, query: any): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { tenantId },
      order: { timestamp: 'DESC' },
      take: query.limit || 100,
      skip: query.offset || 0,
    });
  }

  async findByResource(tenantId: string, resource: string, resourceId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { tenantId, resource, resourceId },
      order: { timestamp: 'DESC' },
    });
  }
}
```

### 关键实现注意事项

**1. MVP 阶段 tenantId 可为 null:**
- 现有数据可能没有 tenantId
- 迁移脚本中 tenantId 列设置为 nullable
- Growth 阶段再强制要求 NOT NULL

**2. TenantGuard 与 OrganizationGuard 的关系:**
- TenantGuard 是 OrganizationGuard 的扩展
- TenantGuard 同时注入 tenantId 和 organizationId
- 所有 Radar API 都应该使用 TenantGuard

**3. BaseRepository 的泛型约束:**
- 所有使用 BaseRepository 的实体必须包含 tenantId 字段
- 使用 `as any` 类型断言处理 TypeScript 类型检查

**4. RLS 策略的性能影响:**
- RLS 策略会增加查询开销（约 5-10%）
- 通过索引优化：为所有表的 tenant_id 列添加索引
- 复合索引：`(tenant_id, organization_id)`, `(tenant_id, sent_at)` 等

**5. 审计日志的性能优化:**
- 审计日志写入使用异步处理，不阻塞主请求
- 考虑使用消息队列（BullMQ）异步写入审计日志
- 定期归档旧审计日志（保留 1 年）

### 测试策略

**单元测试重点:**
- TenantGuard 正确提取和验证 tenantId
- BaseRepository 自动添加 tenantId 过滤
- AuditLogService 正确记录审计日志

**集成测试重点:**
- 多租户隔离：租户 A 不能访问租户 B 的数据
- RLS 策略生效：直接 SQL 查询也被阻止
- 审计日志完整性：所有敏感操作都被记录

**渗透测试重点:**
- 尝试通过修改 API 参数访问其他租户数据
- 尝试通过 SQL 注入绕过 tenantId 过滤
- 尝试通过直接数据库连接访问其他租户数据

### 性能优化建议

**数据库索引:**
```sql
-- 为所有表的 tenant_id 列添加索引
CREATE INDEX idx_organizations_tenant_id ON organizations(tenant_id);
CREATE INDEX idx_projects_tenant_id ON projects(tenant_id);
CREATE INDEX idx_radar_pushes_tenant_id ON radar_pushes(tenant_id);
CREATE INDEX idx_watched_topics_tenant_id ON watched_topics(tenant_id);
CREATE INDEX idx_watched_peers_tenant_id ON watched_peers(tenant_id);
CREATE INDEX idx_push_preferences_tenant_id ON push_preferences(tenant_id);
CREATE INDEX idx_compliance_playbooks_tenant_id ON compliance_playbooks(tenant_id);

-- 复合索引优化常见查询
CREATE INDEX idx_radar_pushes_tenant_org_sent ON radar_pushes(tenant_id, organization_id, sent_at DESC);
CREATE INDEX idx_watched_topics_tenant_org ON watched_topics(tenant_id, organization_id);
```

**查询优化:**
- 使用 QueryBuilder 而非 find() 方法，减少不必要的 JOIN
- 使用 select() 指定需要的字段，避免加载所有列
- 使用分页查询，避免一次加载大量数据

**缓存策略:**
- 缓存用户的 tenantId 和 organizationId（Redis，TTL 1小时）
- 减少 TenantGuard 中的数据库查询次数

### 安全最佳实践

**1. 永远不要信任客户端传递的 tenantId:**
- tenantId 必须从服务端查询，不能从请求参数获取
- TenantGuard 从 JWT token 提取 userId，再查询 tenantId

**2. 所有查询都必须包含 tenantId 过滤:**
- 使用 BaseRepository 确保所有查询都包含 tenantId
- 代码审查时重点检查是否遗漏 tenantId 过滤

**3. RLS 作为最后一道防线:**
- 即使代码层面遗漏了 tenantId 过滤，RLS 也能阻止跨租户访问
- 定期进行渗透测试，验证 RLS 策略有效性

**4. 审计日志不可篡改:**
- AuditLog 表不允许 UPDATE 和 DELETE 操作
- 使用数据库触发器阻止篡改审计日志

### 参考资料

**架构文档:**
- [Source: D:\csaas\_bmad-output\architecture-radar-service.md#Decision 5: 多租户隔离 - 混合模式]
- [Source: D:\csaas\_bmad-output\prd-radar-service.md#咨询公司利益保护机制]

**相关 Stories:**
- Story 1.2: Csaas 认证与权限集成 - OrganizationGuard 实现
- Story 6.2: 咨询公司批量客户管理后台 - Tenant 管理界面
- Story 6.3: 白标输出功能 - 品牌配置

**技术参考:**
- NestJS Guards: https://docs.nestjs.com/guards
- TypeORM Repository: https://typeorm.io/repository-api
- PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

### Completion Notes List

### File List

