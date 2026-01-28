# API 安全开发规范

## 📋 目的

本文档定义 CSAAS 项目的 API 安全开发规范，确保所有 API 端点都有适当的权限保护。

**核心原则**: 所有 API 端点必须经过身份验证，除非明确标记为公开。

---

## 🔐 权限层级

CSAAS 使用三层权限控制：

### 1️⃣ JWT 身份验证 (JwtAuthGuard)
- **所有端点默认需要**
- 验证用户身份
- 提取用户信息到 `@CurrentUser()` decorator

```typescript
@UseGuards(JwtAuthGuard)
@Controller('example')
export class ExampleController {
  @Get('data')
  async getData(@CurrentUser() user: any) {
    const userId = user.userId || user.id
    // 业务逻辑
  }
}
```

### 2️⃣ 组织权限验证 (OrganizationGuard)
- **组织相关端点需要**
- 验证用户是否是组织成员
- 适用于：`/organizations/:id/*`

```typescript
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('organizations')
export class OrganizationsController {
  @Get(':id')
  async getOrganization(@Param('id') id: string) {
    // 自动验证用户是该组织成员
  }
}
```

### 3️⃣ 项目权限验证 (ProjectAccessGuard)
- **项目相关端点需要**
- 验证用户是否有项目访问权限
- 适用于：`/projects/:id/*`（除了列表和创建）

```typescript
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  @Get() // 列表不需要额外权限，只返回用户的项目
  async findAll(@CurrentUser() user: any) {
    const userId = user.userId || user.id
    // 返回用户的项目列表
  }

  @Get(':projectId')
  @UseGuards(ProjectAccessGuard) // 详情需要项目权限
  async findOne(@Param('projectId') projectId: string) {
    // 自动验证用户可以访问该项目
  }
}
```

---

## 📝 Controller 模板

### 标准 Controller 结构

```typescript
import { Controller, Get, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

/**
 * ExampleController
 *
 * Brief description of what this controller manages.
 * All endpoints require JWT authentication.
 *
 * @module backend/src/modules/example
 */
@UseGuards(JwtAuthGuard)
@Controller('example')
export class ExampleController {
  constructor(private readonly exampleService: ExampleService) {}

  /**
   * Endpoint description
   * GET /example
   */
  @Get()
  async findAll(@CurrentUser() user: any) {
    const userId = user.userId || user.id
    return this.exampleService.findAll(userId)
  }
}
```

---

## ✅ 开发检查清单

每个 Story 开发时，必须完成：

### 设计阶段
- [ ] 明确 API 端点的权限需求
- [ ] 确定：公开？需要登录？需要组织权限？需要项目权限？
- [ ] 设计数据隔离方案

### 开发阶段
- [ ] 添加 `@UseGuards(JwtAuthGuard)` 到 Controller
- [ ] 如需要，添加额外 Guards (OrganizationGuard, ProjectAccessGuard)
- [ ] 使用 `@CurrentUser()` decorator 获取用户信息
- [ ] **禁止**从 `req.headers` 获取用户 ID

### 测试阶段
- [ ] 测试未登录访问返回 401
- [ ] 测试已登录访问返回 200
- [ ] 测试越权访问返回 403（如适用）
- [ ] 测试数据隔离（用户只能看到自己的数据）

---

## 🚫 常见错误

### ❌ 错误 1: 完全没有 Guards
```typescript
@Controller('example')
export class ExampleController {
  @Get('data')
  async getData() {
    // ❌ 任何人都可以访问！
  }
}
```

### ✅ 正确 1: 添加 JwtAuthGuard
```typescript
@UseGuards(JwtAuthGuard)
@Controller('example')
export class ExampleController {
  @Get('data')
  async getData(@CurrentUser() user: any) {
    // ✅ 只有登录用户可以访问
  }
}
```

### ❌ 错误 2: 从 header 获取用户 ID
```typescript
@UseGuards(JwtAuthGuard)
@Controller('example')
export class ExampleController {
  @Get('data')
  async getData(@Req() req: any) {
    const userId = req.headers['x-user-id'] // ❌ 不安全！
  }
}
```

### ✅ 正确 2: 使用 @CurrentUser decorator
```typescript
@UseGuards(JwtAuthGuard)
@Controller('example')
export class ExampleController {
  @Get('data')
  async getData(@CurrentUser() user: any) {
    const userId = user.userId || user.id // ✅ 从 JWT 获取
  }
}
```

### ❌ 错误 3: 组织端点没有 OrganizationGuard
```typescript
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  @Get(':id')
  async getOrganization(@Param('id') id: string) {
    // ❌ 用户可以访问任何组织！
  }
}
```

### ✅ 正确 3: 添加 OrganizationGuard
```typescript
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('organizations')
export class OrganizationsController {
  @Get(':id')
  async getOrganization(@Param('id') id: string) {
    // ✅ 自动验证用户是该组织成员
  }
}
```

---

## 🧪 测试模板

### E2E 测试示例

```typescript
describe('Example API (with auth)', () => {
  let authToken: string
  let testUserId: string

  beforeAll(async () => {
    // 注册/登录获取 token
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'password123' })

    authToken = response.body.accessToken
    testUserId = response.body.user.id
  })

  describe('GET /example/data', () => {
    it('should return 401 without token', async () => {
      const response = await request(app.getHttpServer())
        .get('/example/data')

      expect(response.status).toBe(401)
    })

    it('should return data with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/example/data')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('data')
    })

    it('should return only user\'s own data', async () => {
      const response = await request(app.getHttpServer())
        .get('/example/data')
        .set('Authorization', `Bearer ${authToken}`)

      // 验证数据隔离
      response.body.data.forEach(item => {
        expect(item.userId).toBe(testUserId)
      })
    })
  })
})
```

---

## 📂 相关文件

### Guards (权限守卫)
- `src/modules/auth/guards/jwt-auth.guard.ts` - JWT 身份验证
- `src/modules/organizations/guards/organization.guard.ts` - 组织权限
- `src/modules/projects/guards/project-access.guard.ts` - 项目权限

### Decorators (装饰器)
- `src/modules/auth/decorators/current-user.decorator.ts` - 获取当前用户
- `src/modules/organizations/decorators/current-org.decorator.ts` - 获取当前组织

### 参考实现
- `src/modules/auth/auth.controller.ts` - 认证相关（登录、注册）
- `src/modules/organizations/organizations.controller.ts` - 组织管理（完整权限）
- `src/modules/projects/controllers/projects.controller.ts` - 项目管理（混合权限）
- `src/modules/survey/survey.controller.ts` - 问卷管理（基础权限）

---

## 🔍 审查流程

每个 Story 完成前，必须经过以下审查：

### Code Review 检查项
1. ✅ 所有 Controller 都有 `@UseGuards(JwtAuthGuard)`
2. ✅ 组织/项目相关端点有额外的 Guards
3. ✅ 所有方法使用 `@CurrentUser()` 而非 `req.headers`
4. ✅ 没有 `TODO: Get userId from JWT` 这样的注释
5. ✅ 测试覆盖权限场景

### 自动化检查（未来）
```bash
# 检查是否有未保护的 Controller
grep -L "@UseGuards(JwtAuthGuard)" src/modules/**/*.controller.ts

# 检查是否有不安全的用户 ID 获取
grep -r "req.headers\['x-user-id'\]" src/modules/
```

---

## 🚨 安全事件响应

如果发现权限漏洞：

1. **立即修复**（优先级最高）
2. **通知团队**
3. **审查类似代码**
4. **添加测试用例**
5. **更新文档**

---

## 📚 参考资料

- [NestJS Guards 官方文档](https://docs.nestjs.com/guards)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [JWT 最佳实践](https://tools.ietf.org/html/rfc8725)

---

## 📝 更新日志

| 日期 | 版本 | 变更说明 |
|------|------|---------|
| 2026-01-26 | 1.0 | 初始版本，定义基础规范 |
| | | |

---

_维护者: 开发团队_
_最后更新: 2026-01-26_
