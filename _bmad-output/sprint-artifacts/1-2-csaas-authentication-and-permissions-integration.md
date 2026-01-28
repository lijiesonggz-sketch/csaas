# Story 1.2: Csaas认证与权限集成

**Epic**: Epic 1 - 基础设施与Csaas集成
**Story ID**: 1.2
**Story Key**: 1-2-csaas-authentication-and-permissions-integration
**状态**: ready-for-dev
**优先级**: P1 (高)
**预计时间**: 3-5天
**依赖**: Story 1.1 (已完成)

---

## 用户故事

**As a** Csaas用户
**I want** 使用相同的登录凭证访问Radar Service
**So that** 我不需要重新登录或管理多个账号

---

## 业务价值

### 为什么这个故事很重要?
1. **用户体验优化**: 用户无需重新登录,无缝访问Csaas和Radar Service
2. **安全性提升**: 通过JWT token验证,替代当前的header-based临时认证
3. **统一权限管理**: 基于组织的权限控制,确保数据隔离
4. **扩展性**: 为未来的Radar Service功能奠定认证基础

### 成功指标
- ✅ 用户登录Csaas后可直接访问`/radar/*`路由,无需二次认证
- ✅ API返回403 Forbidden当用户尝试访问其他组织的数据
- ✅ WebSocket推送使用现有Socket.io Gateway,新增`radar:push:new`事件
- ✅ 所有认证逻辑通过JWT token验证,无硬编码userId

---

## 验收标准 (Acceptance Criteria)

### AC 1: JWT Token复用验证

**Given** 用户已登录Csaas并持有有效的JWT token
**When** 用户访问`/radar`路由或任何Radar Service API端点
**Then** 系统复用Csaas的JWT token验证用户身份
**And** 不需要重新登录
**And** JWT token包含`userId`, `email`, `role`等信息

### AC 2: OrganizationGuard自动提取organizationId

**Given** 用户访问Radar Service API (如`GET /api/organizations/:id`)
**When** API请求包含有效的JWT token
**Then** OrganizationGuard自动从token中提取`userId`
**And** 查询用户所属的`organizationId` (通过OrganizationMember表)
**And** 将`organizationId`注入到请求上下文(`request.orgId`或`@CurrentOrg()`装饰器)

### AC 3: 跨组织访问返回403 Forbidden

**Given** 用户访问其他组织的数据 (如`GET /api/organizations/OTHER_ORG_ID`)
**When** API请求的`organizationId`与用户所属组织不匹配
**Then** 返回403 Forbidden错误
**And** 错误消息明确:"您不是该组织的成员,无权访问"
**And** 记录审计日志 (`AuditLog`表)

### AC 4: WebSocket复用现有Gateway

**Given** Csaas WebSocket Gateway已存在 (`/tasks` namespace)
**When** Radar Service需要推送通知
**Then** 复用现有的Socket.io Gateway
**And** 使用`radar:push:new`事件名称
**And** 事件payload包含`organizationId`, `push`, `timestamp`

---

## 技术实施计划

### Phase 1: JWT认证基础设施 (1-2天)

#### Task 1.1: 安装JWT依赖并配置
**优先级**: P0 (阻塞项)

**实施步骤**:
1. 安装JWT相关依赖:
   ```bash
   npm install @nestjs/jwt @nestjs/passport passport passport-jwt
   npm install -D @types/passport-jwt
   ```

2. 创建JWT配置 (`backend/src/config/jwt.config.ts`):
   ```typescript
   export const jwtConfig = {
     secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
     signOptions: {
       expiresIn: process.env.JWT_EXPIRES_IN || '7d',
     },
   }
   ```

3. 更新`.env.development`:
   ```env
   JWT_SECRET=your-development-secret-key
   JWT_EXPIRES_IN=7d
   ```

**验收标准**:
- ✅ 依赖安装成功,`npm run build`无错误
- ✅ JWT配置加载成功,可通过`ConfigService`访问

---

#### Task 1.2: 实现JWT认证Service和Strategy
**优先级**: P0 (阻塞项)

**实施步骤**:

1. 扩展`AuthService` (`backend/src/modules/auth/auth.service.ts`):
   ```typescript
   import { JwtService } from '@nestjs/jwt'

   @Injectable()
   export class AuthService {
     constructor(
       @InjectRepository(User)
       private userRepository: Repository<User>,
       private jwtService: JwtService,
     ) {}

     async login(loginDto: LoginDto) {
       const user = await this.validateUser(loginDto)

       const payload = {
         sub: user.id,
         email: user.email,
         role: user.role,
       }

       return {
         access_token: this.jwtService.sign(payload),
         user: {
           id: user.id,
           email: user.email,
           name: user.name,
           role: user.role,
         },
       }
     }

     // ... 其他方法保持不变
   }
   ```

2. 创建JWT Strategy (`backend/src/modules/auth/strategies/jwt.strategy.ts`):
   ```typescript
   import { Injectable } from '@nestjs/common'
   import { PassportStrategy } from '@nestjs/passport'
   import { ExtractJwt, Strategy } from 'passport-jwt'
   import { ConfigService } from '@nestjs/config'

   @Injectable()
   export class JwtStrategy extends PassportStrategy(Strategy) {
     constructor(private configService: ConfigService) {
       super({
         jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
         ignoreExpiration: false,
         secretOrKey: configService.get('JWT_SECRET'),
       })
     }

     async validate(payload: any) {
       return {
         userId: payload.sub,
         email: payload.email,
         role: payload.role,
       }
     }
   }
   ```

3. 创建JWT Guard (`backend/src/modules/auth/guards/jwt-auth.guard.ts`):
   ```typescript
   import { Injectable } from '@nestjs/common'
   import { AuthGuard } from '@nestjs/passport'

   @Injectable()
   export class JwtAuthGuard extends AuthGuard('jwt') {}
   ```

4. 创建Current User装饰器 (`backend/src/modules/auth/decorators/current-user.decorator.ts`):
   ```typescript
   import { createParamDecorator, ExecutionContext } from '@nestjs/common'

   export const CurrentUser = createParamDecorator(
     (data: unknown, ctx: ExecutionContext) => {
       const request = ctx.switchToHttp().getRequest()
       return request.user
     },
   )
   ```

**验收标准**:
- ✅ JWT Strategy成功验证token并提取用户信息
- ✅ `JwtAuthGuard`应用到controller后,未认证请求返回401
- ✅ `@CurrentUser()`装饰器可获取当前用户信息

---

#### Task 1.3: 更新Auth Controller返回JWT Token
**优先级**: P0 (阻塞项)

**实施步骤**:

更新`backend/src/modules/auth/auth.controller.ts`:
```typescript
import { UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from './guards/jwt-auth.guard'

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto)
    return {
      success: true,
      data: result,
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@CurrentUser() user: any) {
    return {
      success: true,
      data: user,
    }
  }
}
```

**验收标准**:
- ✅ POST `/api/auth/login`返回JWT token
- ✅ GET `/api/auth/profile`使用JWT guard验证
- ✅ 未认证请求返回401 Unauthorized

---

### Phase 2: Organization级别的权限控制 (1-2天)

#### Task 2.1: 实现OrganizationGuard
**优先级**: P0 (阻塞项)

**实施步骤**:

创建`backend/src/modules/organizations/guards/organization.guard.ts`:
```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OrganizationMember } from '@/database/entities/organization-member.entity'

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(
    @InjectRepository(OrganizationMember)
    private readonly memberRepository: Repository<OrganizationMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const user = request.user

    // 如果没有user信息,说明JWT guard未通过
    if (!user || !user.userId) {
      throw new ForbiddenException('用户未认证')
    }

    // 从多个可能的来源提取organizationId
    const orgId = request.params.id ||
                  request.params.orgId ||
                  request.params.organizationId ||
                  request.body?.organizationId

    // 如果请求中没有organizationId,返回false
    if (!orgId) {
      return false
    }

    // 查询用户是否是该组织的成员
    const member = await this.memberRepository.findOne({
      where: {
        userId: user.userId,
        organizationId: orgId,
      },
    })

    if (!member) {
      throw new ForbiddenException(
        '您不是该组织的成员,无权访问',
      )
    }

    // 将organizationId和member信息注入到请求中
    request.orgId = orgId
    request.orgMember = member

    return true
  }
}
```

**验收标准**:
- ✅ Guard成功验证组织成员身份
- ✅ 非成员访问返回403 Forbidden
- ✅ 将`orgId`注入到request上下文

---

#### Task 2.2: 创建@CurrentOrg装饰器
**优先级**: P1 (高)

**实施步骤**:

创建`backend/src/modules/organizations/decorators/current-org.decorator.ts`:
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export const CurrentOrg = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest()
    return request.orgId
  },
)
```

**验收标准**:
- ✅ 装饰器成功提取`organizationId`
- ✅ 可在controller方法中直接使用

---

#### Task 2.3: 应用Guard到OrganizationsController
**优先级**: P1 (高)

**实施步骤**:

更新`backend/src/modules/organizations/organizations.controller.ts`:
```typescript
import { UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard'
import { OrganizationGuard } from './guards/organization.guard'
import { CurrentUser, CurrentOrg } from './decorators/current-org.decorator'

@Controller('organizations')
@UseGuards(JwtAuthGuard) // 全局应用JWT认证
export class OrganizationsController {
  constructor(private organizationsService: OrganizationsService) {}

  @Get(':id')
  @UseGuards(OrganizationGuard) // 组织级别权限
  async findOne(
    @Param('id') id: string,
    @CurrentOrg() orgId: string, // 自动注入当前用户的organizationId
    @CurrentUser() user: any,
  ) {
    // orgId会自动与请求的id进行对比验证
    return this.organizationsService.findOne(id)
  }

  @Get(':id/members')
  @UseGuards(OrganizationGuard)
  async getMembers(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.organizationsService.getMembers(id, { page, limit })
  }

  @Get(':id/weaknesses/aggregated')
  @UseGuards(OrganizationGuard)
  async getAggregatedWeaknesses(@Param('id') id: string) {
    return this.organizationsService.getAggregatedWeaknesses(id)
  }

  // ... 其他端点类似处理
}
```

**验收标准**:
- ✅ 所有端点使用JWT认证
- ✅ 组织相关端点使用OrganizationGuard
- ✅ 跨组织访问返回403

---

#### Task 2.4: 实现审计日志记录
**优先级**: P2 (中)

**实施步骤**:

创建`backend/src/modules/audit/audit.service.ts`:
```typescript
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLog } from '@/database/entities/audit-log.entity'

export enum AuditAction {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  ACCESS_DENIED = 'access_denied',
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log({
    userId,
    organizationId,
    action,
    resource,
    details,
  }: {
    userId: string
    organizationId?: string
    action: AuditAction
    resource: string
    details?: Record<string, any>
  }) {
    const log = this.auditLogRepository.create({
      userId,
      organizationId,
      action,
      resource,
      details,
      timestamp: new Date(),
    })

    await this.auditLogRepository.save(log)
  }
}
```

在`OrganizationGuard`中添加审计日志:
```typescript
// 在ForbiddenException抛出前
await this.auditService.log({
  userId: user.userId,
  organizationId: orgId,
  action: AuditAction.ACCESS_DENIED,
  resource: `${context.getClass().name}:${context.getHandler().name()}`,
  details: {
    attemptedOrgId: orgId,
    userRole: user.role,
  },
})
```

**验收标准**:
- ✅ 所有拒绝访问事件记录到审计日志
- ✅ 审计日志包含userId, organizationId, action, resource, timestamp
- ✅ 日志保留1年(数据库层面配置)

---

### Phase 3: WebSocket集成 (1天)

#### Task 3.1: 扩展TasksGateway支持Radar推送
**优先级**: P1 (高)

**实施步骤**:

1. 定义Radar推送事件类型 (`backend/src/modules/ai-tasks/gateways/tasks.gateway.ts`):
   ```typescript
   export interface RadarPushEvent {
     organizationId: string
     push: {
       id: string
       radarType: 'tech' | 'industry' | 'compliance'
       title: string
       summary: string
       relevanceScore: number
       priorityLevel: 1 | 2 | 3
     }
     timestamp: string
   }
   ```

2. 在`TasksGateway`中添加Radar推送方法:
   ```typescript
   export class TasksGateway implements OnGatewayConnection, OnGatewayDisconnect {
     // ... 现有代码

     /**
      * 发送Radar推送通知
      */
     emitRadarPush(event: RadarPushEvent) {
       this.logger.log(
         `Radar push for org ${event.organizationId}: ${event.push.title}`,
       )

       // 发送到组织特定的房间
       this.server.to(`org:${event.organizationId}`).emit('radar:push:new', event)
     }

     /**
      * 订阅组织推送
      */
     @SubscribeMessage('subscribe:organization')
     handleSubscribeOrganization(
       @MessageBody() data: { organizationId: string },
       @ConnectedSocket() client: Socket,
     ) {
       const { organizationId } = data

       // 加入组织房间
       client.join(`org:${organizationId}`)

       this.logger.debug(`Client ${client.id} subscribed to organization ${organizationId}`)

       return { success: true, organizationId }
     }
   }
   ```

**验收标准**:
- ✅ `emitRadarPush`方法成功发送`radar:push:new`事件
- ✅ 客户端可通过`subscribe:organization`订阅组织推送
- ✅ 事件payload符合AC 4规范

---

#### Task 3.2: 前端WebSocket客户端集成
**优先级**: P2 (中)

**实施步骤**:

创建`frontend/src/lib/websocket/radar-client.ts`:
```typescript
import { io, Socket } from 'socket.io-client'

export interface RadarPushEvent {
  organizationId: string
  push: {
    id: string
    radarType: 'tech' | 'industry' | 'compliance'
    title: string
    summary: string
    relevanceScore: number
    priorityLevel: 1 | 2 | 3
  }
  timestamp: string
}

export class RadarWebSocketClient {
  private socket: Socket | null = null

  connect(organizationId: string, token: string) {
    this.socket = io(`${process.env.NEXT_PUBLIC_API_URL}/tasks`, {
      auth: {
        token,
      },
    })

    this.socket.emit('subscribe:organization', { organizationId })

    this.socket.on('radar:push:new', (event: RadarPushEvent) => {
      this.handleRadarPush(event)
    })

    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  onRadarPush(callback: (event: RadarPushEvent) => void) {
    if (this.socket) {
      this.socket.on('radar:push:new', callback)
    }
  }

  private handleRadarPush(event: RadarPushEvent) {
    // 可以在这里显示toast通知
    console.log('New radar push:', event.push.title)
  }
}

export const radarWsClient = new RadarWebSocketClient()
```

**验收标准**:
- ✅ 前端成功连接WebSocket
- ✅ 接收`radar:push:new`事件并显示通知
- ✅ JWT token用于WebSocket认证

---

### Phase 4: 测试 (1天)

#### Task 4.1: 单元测试

**JWT认证测试** (`backend/src/modules/auth/auth.service.spec.ts`):
```typescript
describe('AuthService - JWT', () => {
  it('should generate JWT token on login', async () => {
    const loginDto = { email: 'test@example.com', password: 'password123' }
    const result = await authService.login(loginDto)

    expect(result.access_token).toBeDefined()
    expect(result.user.email).toBe(loginDto.email)
  })

  it('should validate JWT token', async () => {
    const token = jwtService.sign({ sub: 'user-id', email: 'test@example.com' })
    const payload = jwtService.verify(token)

    expect(payload.sub).toBe('user-id')
  })
})
```

**OrganizationGuard测试** (`backend/src/modules/organizations/guards/organization.guard.spec.ts`):
```typescript
describe('OrganizationGuard', () => {
  it('should allow access for organization member', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: 'user-1' },
          params: { id: 'org-1' },
        }),
      }),
    }

    jest.spyOn(memberRepository, 'findOne').mockResolvedValue({
      userId: 'user-1',
      organizationId: 'org-1',
    })

    const result = await guard.canActivate(mockContext)
    expect(result).toBe(true)
  })

  it('should deny access for non-member', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: 'user-1' },
          params: { id: 'org-2' },
        }),
      }),
    }

    jest.spyOn(memberRepository, 'findOne').mockResolvedValue(null)

    await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException)
  })
})
```

**验收标准**:
- ✅ 单元测试覆盖率 >80%
- ✅ 所有critical path有测试覆盖

---

#### Task 4.2: E2E测试

创建`backend/test/organization-auth.e2e-spec.ts`:
```typescript
describe('Organization Authentication (E2E)', () => {
  let app: INestApplication
  let authToken: string
  let userId: string
  let organizationId: string

  beforeAll(async () => {
    // ... 创建测试用户并登录
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password123' })

    authToken = response.body.data.access_token
    userId = response.body.data.user.id
  })

  describe('JWT Authentication', () => {
    it('should access protected endpoint with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.data.email).toBe('test@example.com')
    })

    it('should reject request without token', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .expect(401)
    })

    it('should reject request with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)
    })
  })

  describe('Organization Permissions', () => {
    it('should allow access to own organization', async () => {
      const response = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.data.id).toBe(organizationId)
    })

    it('should deny access to other organization', async () => {
      await request(app.getHttpServer())
        .get('/organizations/other-org-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403)
    })
  })
})
```

**验收标准**:
- ✅ 所有AC通过E2E测试
- ✅ 测试隔离无问题(使用事务回滚)

---

## 依赖和约束

### 前置依赖
- ✅ Story 1.1已完成 (Organization, OrganizationMember, WeaknessSnapshot实体已创建)
- ✅ Csaas基础认证功能已存在 (AuthService, AuthController)
- ✅ WebSocket Gateway已实现 (TasksGateway)

### 技术约束
1. **JWT Secret管理**: 生产环境必须使用环境变量,不能硬编码
2. **Token过期时间**: 默认7天,可通过配置调整
3. **Guard性能**: OrganizationGuard需要查询数据库,考虑添加Redis缓存
4. **向后兼容**: 需要保留`x-user-id` header支持(过渡期)

### 数据模型变更
**无新增实体**,但需确保以下实体已存在:
- `User` (已存在)
- `Organization` (Story 1.1创建)
- `OrganizationMember` (Story 1.1创建)
- `AuditLog` (需创建,参考Task 2.4)

---

## 风险和缓解措施

### 风险1: JWT Secret泄露导致安全漏洞
**缓解措施**:
- 生产环境使用强随机密钥(>32字符)
- 定期轮换JWT secret(每季度)
- 使用环境变量管理secret,不提交到代码仓库

### 风险2: OrganizationGuard性能问题(每次请求查询数据库)
**缓解措施**:
- MVP阶段:接受性能开销(组织成员关系通常不频繁变更)
- Growth阶段:添加Redis缓存用户组织关系(key: `user:${userId}:org`, TTL: 1h)
- 考虑在JWT payload中包含organizationId(如果用户只属于一个组织)

### 风险3: WebSocket认证与HTTP认证不一致
**缓解措施**:
- 使用相同的JWT验证逻辑
- WebSocket连接时通过auth参数传递token
- 参考: https://socket.io/docs/v4/middleware/#sending-credentials

---

## 实施检查清单

### Phase 1: JWT认证基础设施
- [ ] 安装JWT依赖包
- [ ] 创建JWT配置文件
- [ ] 实现JWT Strategy
- [ ] 创建JwtAuthGuard
- [ ] 创建@CurrentUser装饰器
- [ ] 更新AuthService.login()返回JWT token
- [ ] 更新AuthController支持login返回token
- [ ] 编写JWT单元测试

### Phase 2: Organization级别权限控制
- [ ] 实现OrganizationGuard
- [ ] 创建@CurrentOrg装饰器
- [ ] 应用JWT AuthGuard到OrganizationsController
- [ ] 应用OrganizationGuard到组织相关端点
- [ ] 实现审计日志记录
- [ ] 编写OrganizationGuard单元测试
- [ ] 测试跨组织访问返回403

### Phase 3: WebSocket集成
- [ ] 定义RadarPushEvent类型
- [ ] 在TasksGateway添加emitRadarPush方法
- [ ] 实现subscribe:organization事件处理
- [ ] 创建前端RadarWebSocketClient
- [ ] 测试WebSocket推送通知

### Phase 4: 测试和文档
- [ ] 编写单元测试(目标覆盖率>80%)
- [ ] 编写E2E测试(覆盖所有AC)
- [ ] 更新API文档(添加JWT认证说明)
- [ ] 创建开发者指南(如何使用JWT)
- [ ] 性能测试(OrganizationGuard响应时间<100ms)

---

## 开发者注意事项

### 1. JWT最佳实践
- **Secret密钥**: 使用`openssl rand -base64 32`生成强密钥
- **Token过期**: 平衡安全性和用户体验,建议7天
- **Payload大小**: 只包含必要信息(userId, email, role),避免过大
- **刷新机制**: MVP阶段不实现refresh token,Growth阶段考虑

### 2. Guard使用顺序
```typescript
@UseGuards(JwtAuthGuard, OrganizationGuard) // ✅ 先验证JWT,再验证组织权限
```

### 3. 错误处理一致性
- 401 Unauthorized: JWT token无效或过期
- 403 Forbidden: 用户已认证但无权限访问该资源
- 错误消息格式: `{ success: false, error: "错误消息" }`

### 4. 审计日志完整性
- 记录所有敏感操作(创建、更新、删除)
- 记录所有拒绝访问事件
- 日志不可删除,只能归档

### 5. 前端Token存储
- **推荐**: 使用HttpOnly cookie (防止XSS)
- **备选**: localStorage (需要自行防范XSS)
- **不要**: 在URL中传递token (会记录到日志)

---

## 完成定义 (Definition of Done)

Story 1.2被认为完成当且仅当:

### 代码质量
- ✅ 所有Phase的Tasks已完成
- ✅ 代码通过ESLint检查(`npm run lint`)
- ✅ 代码通过Prettier格式化
- ✅ 单元测试覆盖率 >80%
- ✅ 所有AC通过E2E测试
- ✅ Code Review通过(至少1个reviewer批准)

### 功能完整性
- ✅ 用户登录后获得JWT token
- ✅ 所有API端点使用JWT认证
- ✅ OrganizationGuard正常工作,跨组织访问返回403
- ✅ 审计日志记录拒绝访问事件
- ✅ WebSocket支持Radar推送事件

### 文档完整性
- ✅ API文档更新(包含JWT认证示例)
- ✅ 开发者指南创建(如何使用JWT)
- ✅ Story文档更新(标记为completed)

### Git提交规范
```bash
git commit -m "feat(auth): implement JWT authentication for Story 1.2

- Add JWT strategy and guard
- Implement OrganizationGuard for permission control
- Add audit logging for access denial
- Extend WebSocket gateway for radar pushes
- Add comprehensive unit and E2E tests

Closes #1-2"
```

---

## 参考资料

### NestJS JWT文档
- https://docs.nestjs.com/security/authentication
- https://docs.nestjs.com/techniques/performance

### TypeORM查询优化
- https://typeorm.io/#/select-query-builder
- 考虑使用query builder减少N+1查询

### JWT最佳实践
- https://tools.ietf.org/html/rfc7519
- https://auth0.com/docs/secure/tokens/json-web-tokens

### Socket.io认证
- https://socket.io/docs/v4/middleware/#sending-credentials

---

**Story状态**: ready-for-dev
**创建日期**: 2026-01-26
**最后更新**: 2026-01-26
