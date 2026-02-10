# 用户权限分析文档

## 概述

本文档分析系统中两个典型用户的权限差异：**admin@test.com**（管理员）和 **test@example.com**（普通用户）。

---

## 用户角色对比

| 用户 | 角色 (UserRole) | 说明 |
|------|----------------|------|
| **admin@test.com** | `ADMIN` | 系统管理员，拥有平台级权限 |
| **test@example.com** | `RESPONDENT` (默认) 或其他非管理员角色 | 普通用户，仅拥有租户内权限 |

### UserRole 枚举定义

```typescript
// backend/src/database/entities/user.entity.ts
export enum UserRole {
  CONSULTANT = 'consultant', // 主咨询师
  CLIENT_PM = 'client_pm',   // 企业PM
  RESPONDENT = 'respondent', // 被调研者
  ADMIN = 'admin',           // 管理员
}
```

---

## 一、页面访问权限差异

### 1.1 admin@test.com 可访问的专属页面

| 页面路径 | 说明 | 权限控制方式 |
|---------|------|-------------|
| `/admin/dashboard` | 运营仪表板 | `@Roles(UserRole.ADMIN)` |
| `/admin/content-quality` | 内容质量管理 | 页面级 `useEffect` 检查 |
| `/admin/clients` | 客户管理 | 页面级 `useEffect` 检查 |
| `/admin/cost-optimization` | 成本优化 | 页面级 `useEffect` 检查 |
| `/admin/branding` | 品牌配置 | 页面级 `useEffect` 检查 |
| `/admin/radar-sources` | 信息源配置 | 页面级 `useEffect` 检查 |
| `/admin/peer-crawler` | 同业爬虫管理 | 页面级 `useEffect` 检查 |
| `/admin/peer-crawler/health` | 爬虫健康监控 | 页面级 `useEffect` 检查 |

**前端权限检查示例** (`frontend/app/admin/dashboard/page.tsx`):

```typescript
useEffect(() => {
  if (status === 'unauthenticated') {
    router.push('/login')
  } else if (session?.user && session.user.role !== 'admin') {
    router.push('/')  // 非管理员重定向到首页
  }
}, [status, session, router])
```

### 1.2 两个用户都可访问的页面

- `/dashboard` - 工作台
- `/projects` - 项目管理
- `/projects/[projectId]/*` - 项目详情页
- `/radar` - 技术雷达
- `/reports` - 报告中心
- `/team` - 团队管理

这些页面通过 `MainLayout` 进行登录保护，任何已登录用户都可访问。

---

## 二、API 访问权限差异

### 2.1 admin@test.com 专属 API

**基础路径**: `api/v1/admin/*`

| API | 方法 | 功能 | 权限守卫 |
|-----|------|------|---------|
| `/api/v1/admin/dashboard/health` | GET | 系统健康指标 | `@Roles(UserRole.ADMIN)` |
| `/api/v1/admin/dashboard/alerts` | GET | 告警列表 | `@Roles(UserRole.ADMIN)` |
| `/api/v1/admin/dashboard/alerts/:id/resolve` | PUT | 解决告警 | `@Roles(UserRole.ADMIN)` |
| `/api/v1/admin/dashboard/trends` | GET | 健康趋势数据 | `@Roles(UserRole.ADMIN)` |

**后端权限控制示例** (`backend/src/modules/admin/dashboard/dashboard.controller.ts`):

```typescript
@Controller('api/v1/admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class DashboardController {
  // 所有方法都需要 ADMIN 角色
}
```

### 2.2 两个用户都可访问的 API

普通业务 API（项目、雷达、报告等），但数据范围受 **TenantGuard** 限制。

---

## 三、数据访问权限差异

### 3.1 admin@test.com 的数据访问

**实现位置**: `backend/src/modules/organizations/guards/tenant.guard.ts:64-82`

```typescript
// 管理员用户的特殊处理
if (userRole === 'admin') {
  const user = await userRepository.findOne({
    where: { id: userId },
    select: ['id', 'tenantId'],
  })

  request.tenantId = user.tenantId
  request.organizationId = null  // 管理员不需要 organizationId

  return true
}
```

| 特性 | 说明 |
|------|------|
| **数据范围** | 可访问其 `tenantId` 下的所有数据 |
| **跨组织访问** | ✅ 可以访问同一租户下的所有组织数据 |
| **组织关联** | 不需要属于特定组织 |

### 3.2 test@example.com 的数据访问

**实现位置**: `backend/src/modules/organizations/guards/tenant.guard.ts:84-102`

```typescript
// 非管理员用户需要查询组织成员关系
const organization = await organizationService.findByUserId(userId)

if (!organization) {
  throw new ForbiddenException('User does not belong to any organization')
}

request.tenantId = organization.tenantId
request.organizationId = organization.id
```

| 特性 | 说明 |
|------|------|
| **数据范围** | 只能访问其所属组织的数据 |
| **跨组织访问** | ❌ 禁止访问其他组织的数据 |
| **组织关联** | 必须是组织的成员才能访问数据 |

---

## 四、项目管理权限差异

### 4.1 项目成员角色 (ProjectMemberRole)

```typescript
// backend/src/database/entities/project-member.entity.ts
export enum ProjectMemberRole {
  OWNER = 'OWNER',    // 项目所有者
  EDITOR = 'EDITOR',  // 编辑者
  VIEWER = 'VIEWER',  // 查看者
}
```

### 4.2 项目内权限矩阵

| 操作 | OWNER | EDITOR | VIEWER |
|------|-------|--------|--------|
| 添加成员 | ✅ | ❌ | ❌ |
| 修改成员角色 | ✅ | ❌ | ❌ |
| 删除成员 | ✅ | ❌ | ❌ |
| 重跑任务 | ✅ | ✅ | ❌ |
| 回滚任务 | ✅ | ✅ | ❌ |
| 编辑项目 | ✅ | ✅ | ❌ |
| 查看项目 | ✅ | ✅ | ✅ |

> **注意**: 项目创建者自动成为 `OWNER`。

### 4.3 权限检查实现

**添加成员权限检查** (`backend/src/modules/projects/controllers/projects.controller.ts:189-197`):

```typescript
const membership = await this.projectMembersService.findByProjectAndUser(projectId, userId)
if (!membership || membership.role !== ProjectMemberRole.OWNER) {
  return { success: false, message: '只有项目所有者可以添加成员' }
}
```

**重跑任务权限检查** (`backend/src/modules/projects/controllers/projects.controller.ts:277-288`):

```typescript
if (!membership || ![ProjectMemberRole.OWNER, ProjectMemberRole.EDITOR].includes(membership.role)) {
  return { success: false, message: '只有项目所有者和编辑者可以重跑任务' }
}
```

---

## 五、侧边栏菜单显示

### 5.1 当前实现

**文件位置**: `frontend/components/layout/Sidebar.tsx`

```typescript
const menuItems: MenuItem[] = [
  { key: '/dashboard', icon: <DashboardIcon />, label: '工作台' },
  { key: '/projects', icon: <FolderIcon />, label: '项目管理' },
  { key: '/radar', icon: <RadarIcon />, label: '技术雷达' },
  { key: '/reports', icon: <DescriptionIcon />, label: '报告中心' },
  { key: '/team', icon: <PeopleIcon />, label: '团队管理' },
  {
    key: '/admin',
    icon: <SettingsIcon />,
    label: '系统管理',
    children: [
      { key: '/admin/dashboard', label: '运营仪表板' },
      { key: '/admin/content-quality', label: '内容质量管理' },
      // ... 其他管理页面
    ],
  },
]
```

### 5.2 显示对比

| 菜单项 | admin@test.com | test@example.com |
|-------|---------------|------------------|
| 工作台 | ✅ | ✅ |
| 项目管理 | ✅ | ✅ |
| 技术雷达 | ✅ | ✅ |
| 报告中心 | ✅ | ✅ |
| 团队管理 | ✅ | ✅ |
| 系统管理 | ✅ (可用) | ⚠️ (可见但点击后重定向) |

> **注意**: 当前侧边栏对所有用户显示"系统管理"菜单，这是一个 UI/UX 问题。非管理员用户点击后会被重定向到首页。

---

## 六、关键权限控制文件

| 文件路径 | 作用 |
|---------|------|
| `backend/src/database/entities/user.entity.ts` | UserRole 枚举定义 |
| `backend/src/database/entities/project-member.entity.ts` | ProjectMemberRole 枚举定义 |
| `backend/src/database/entities/organization-member.entity.ts` | 组织成员角色定义 |
| `backend/src/modules/auth/guards/jwt-auth.guard.ts` | JWT 认证守卫 |
| `backend/src/modules/auth/guards/roles.guard.ts` | 角色权限守卫 |
| `backend/src/modules/auth/decorators/roles.decorator.ts` | @Roles 装饰器 |
| `backend/src/modules/organizations/guards/tenant.guard.ts` | 多租户数据隔离守卫 |
| `backend/src/modules/organizations/guards/organization.guard.ts` | 组织成员验证守卫 |
| `backend/src/modules/admin/dashboard/dashboard.controller.ts` | 管理员专属 API 控制器 |
| `frontend/lib/auth/auth-options.ts` | 前端认证配置 |
| `frontend/lib/auth/types.ts` | 前端角色类型定义 |
| `frontend/components/layout/Sidebar.tsx` | 侧边栏菜单 |
| `frontend/components/layout/MainLayout.tsx` | 主布局（登录保护） |

---

## 七、权限系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        用户请求                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: JWT 认证 (JwtAuthGuard)                           │
│  - 验证 JWT Token 有效性                                    │
│  - 提取用户信息 (id, email, role, tenantId)                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: 角色检查 (RolesGuard)                             │
│  - 检查用户是否有所需角色 (@Roles 装饰器)                     │
│  - 管理员 API: 仅 ADMIN 角色可访问                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: 租户隔离 (TenantGuard)                            │
│  - 管理员: 直接从 users 表获取 tenantId                      │
│  - 普通用户: 查询 organization_members 获取组织信息          │
│  - 注入 tenantId 和 organizationId 到请求上下文              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: 项目权限 (ProjectMemberRole)                      │
│  - OWNER: 完全控制                                          │
│  - EDITOR: 可编辑，不可管理成员                              │
│  - VIEWER: 只读访问                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 八、总结

| 维度 | admin@test.com | test@example.com |
|------|---------------|------------------|
| **系统管理页面** | ✅ 完全访问 | ❌ 无法访问（会被重定向） |
| **系统管理 API** | ✅ 完全访问 | ❌ 403 Forbidden |
| **业务功能页面** | ✅ 可访问 | ✅ 可访问 |
| **数据访问范围** | 租户级（跨组织） | 组织级（仅限所属组织） |
| **项目权限** | 取决于项目角色 | 取决于项目角色 |
| **组织管理** | 可管理所有组织 | 仅能查看所属组织 |

---

## 九、已知问题

1. **侧边栏菜单显示问题**: 系统管理菜单对所有用户可见，但非管理员点击后会被重定向
2. **ProjectAccessGuard 简化**: 当前仅检查登录状态，未完整实现项目成员验证
3. **缺少前端权限组件**: 没有 `<Permission />` 组件用于条件渲染

---

*文档生成时间: 2026-02-10*
