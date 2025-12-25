# Tech-Spec: Csaas Phase 1 - 核心基础设施

**Created:** 2025-12-25
**Status:** Ready for Development
**Phase:** Month 1 (Week 1-4)
**Author:** Barry (Quick Flow Solo Dev)
**Reviewers:** Winston (Architect), Sally (UX Designer)

---

## Overview

### Problem Statement

Csaas是一个AI驱动的IT咨询成熟度评估SaaS平台，采用三模型协同架构（GPT-4 + Claude + 国产模型）。在开始构建AI生成引擎和审核界面之前，**必须先建立稳固的技术基础设施**，包括：

1. **项目脚手架** - 前后端开发环境、代码规范、CI/CD流程
2. **数据库设计** - 支持多租户、项目管理、AI任务存储的Schema
3. **用户认证系统** - 支持三种角色（主咨询师、企业PM、被调研者）的权限管理
4. **三模型并行调用架构** - 异步任务队列、降级策略、实时进度反馈

**核心挑战**：
- 如何设计可扩展的数据库schema，支持未来的行业对标和数据飞轮功能？
- 如何实现高可靠性的三模型并行调用（处理API超时、失败、部分成功等场景）？
- 如何在MVP阶段快速搭建，同时为Growth阶段的多租户扩展预留空间？

### Solution

**采用前后端分离、事件驱动架构：**

1. **前端**：Next.js 14 (App Router) + React 18 + TypeScript + Ant Design 5.x + Tailwind CSS 3.x
2. **后端**：Node.js 20 + Nest.js (TypeScript) + PostgreSQL 15 + Redis
3. **AI任务调度**：BullMQ (Redis-based) + 自定义Orchestrator
4. **认证**：NextAuth.js (支持邮箱密码登录，预留OAuth扩展)
5. **部署**：Vercel (前端) + AWS EC2 (后端) + AWS RDS (PostgreSQL) + ElastiCache (Redis)

**技术亮点**：
- **事件溯源（Event Sourcing）**：完整记录AI生成过程（三模型输出、相似度计算、投票逻辑、人工审核）
- **多级降级策略**：Level 1-4自动降级，确保单个模型失败不影响整体任务
- **实时进度反馈**：WebSocket推送任务进度，用户无需刷新页面

### Scope (In/Out)

#### ✅ Phase 1 In-Scope

**Week 1-2: 项目搭建、数据库设计、用户认证**
- [x] 前端项目脚手架（Next.js 14 + TypeScript + Ant Design + Tailwind）
- [x] 后端项目脚手架（Nest.js + TypeScript + ESLint + Prettier）
- [x] PostgreSQL数据库Schema设计（用户、项目、AI任务、审计日志）
- [x] NextAuth.js集成（邮箱密码登录、角色权限）
- [x] 基础UI组件库（Layout、Header、Sidebar、Card）
- [x] 环境配置（dev/staging/production）
- [x] CI/CD流程（GitHub Actions + Vercel + AWS CodeDeploy）

**Week 3-4: 三模型并行调用架构**
- [x] BullMQ任务队列集成（Redis配置、队列设计）
- [x] AI Orchestrator实现（三模型并行调用、结果聚合）
- [x] 多级降级策略（Level 1-4，自动重试、超时处理）
- [x] WebSocket实时进度推送（Socket.IO集成）
- [x] AI API客户端封装（OpenAI SDK、Anthropic SDK、通义千问SDK）
- [x] 成本监控与告警（API调用计费、单项目成本追踪）

**基础设施**：
- [x] Docker配置（本地开发环境）
- [x] 日志系统（Winston + 结构化日志）
- [x] 错误监控（Sentry集成）
- [x] 基础测试框架（Jest + React Testing Library + Supertest）

#### ❌ Phase 1 Out-of-Scope

以下功能留待后续Phase实现：
- ❌ AI生成引擎（综述、聚类、矩阵、问卷、落地措施） → Month 2
- ❌ 人工审核界面（渐进式披露、原文对照、一致性评分） → Month 3
- ❌ 问卷填写系统 → Month 4
- ❌ 报告导出功能 → Month 4
- ❌ 行业对标、数据飞轮 → Growth阶段
- ❌ 多租户管理 → Growth阶段
- ❌ OAuth登录（Google、微软、钉钉） → V1.0

---

## Context for Development

### Codebase Patterns

**这是一个Greenfield项目**（全新开发，无现有代码），但需遵循以下约定：

#### 前端代码规范
```
/app
  /(auth)
    /login/page.tsx
    /register/page.tsx
  /dashboard/page.tsx
  /projects
    /[id]/page.tsx
    /create/page.tsx
  /layout.tsx
  /globals.css

/components
  /ui             # 基础UI组件（Button、Input、Card等）
  /layout         # 布局组件（Header、Sidebar、Footer）
  /features       # 业务组件（ProjectCard、TaskProgress等）

/lib
  /api            # API调用封装
  /hooks          # 自定义React Hooks
  /utils          # 工具函数
  /types          # TypeScript类型定义

/config
  /theme.ts       # Ant Design主题配置（参考UX设计规范）
```

**命名约定**：
- 组件：PascalCase（`ProjectCard.tsx`）
- 文件夹：kebab-case（`project-details/`）
- 函数：camelCase（`fetchProjects()`）
- 常量：UPPER_SNAKE_CASE（`MAX_FILE_SIZE`）

#### 后端代码规范
```
/src
  /modules
    /auth
      /auth.controller.ts
      /auth.service.ts
      /auth.module.ts
      /dto/login.dto.ts
      /guards/roles.guard.ts
    /projects
    /tasks
    /ai-orchestrator
  /common
    /decorators
    /filters
    /interceptors
    /pipes
  /database
    /entities
    /migrations
  /config
    /database.config.ts
    /redis.config.ts
  main.ts
  app.module.ts
```

**命名约定**：
- 模块：feature.module.ts
- 控制器：feature.controller.ts
- 服务：feature.service.ts
- DTO：kebab-case.dto.ts
- Entity：PascalCase（`User.entity.ts`）

### Files to Reference

**MVP规格文档**：
- `D:\Csaas\_bmad-output\mvp-specification.md` - 完整MVP功能清单、技术栈、验收标准

**UX设计规范**：
- `D:\Csaas\_bmad-output\ux-design-specification.md` - Executive Summary
- `D:\Csaas\_bmad-output\ux\01-foundation.md` - 设计基础（色彩、排版、Ant Design主题）
- `D:\Csaas\_bmad-output\ux\03-implementation-guide.md` - Step 13响应式设计与无障碍

**PRD完整文档**：
- `D:\Csaas\_bmad-output\prd.md` - 产品需求、用户旅程、技术架构决策（ADRs）

### Technical Decisions

#### TD-001: 前端框架选择 - Next.js 14 (App Router)

**决策**：采用Next.js 14的App Router（而非Pages Router）

**理由**：
- **SSR优化**：审核界面需要快速首屏加载，App Router提供更好的流式SSR
- **路由优化**：基于文件系统的路由，支持并行路由和拦截路由
- **数据获取**：Server Components减少客户端JS体积
- **未来兼容**：Next.js官方推荐，长期支持

**权衡**：
- ✅ 优势：性能更好、开发体验优秀、Vercel原生支持
- ⚠️ 劣势：学习曲线（团队需熟悉Server/Client Components）
- ❌ 放弃：Pages Router的成熟生态（但App Router已足够稳定）

#### TD-002: 后端框架选择 - Nest.js

**决策**：采用Nest.js（而非Express或Fastify）

**理由**：
- **模块化架构**：天然支持DI（依赖注入），代码可测试性强
- **TypeScript原生支持**：类型安全，减少运行时错误
- **企业级特性**：内置Guards、Interceptors、Pipes，适合复杂权限管理
- **生态完善**：@nestjs/bull（BullMQ集成）、@nestjs/passport（认证）

**权衡**：
- ✅ 优势：代码结构清晰、可维护性强、适合团队协作
- ⚠️ 劣势：比Express稍重（但性能仍优秀）
- ❌ 放弃：Fastify的极致性能（但Nest.js性能已满足需求）

#### TD-003: 数据库选择 - PostgreSQL 15

**决策**：PostgreSQL作为主数据库（而非MySQL或MongoDB）

**理由**：
- **JSONB支持**：存储AI生成的非结构化结果（三模型输出、相似度详情）
- **事务ACID**：确保AI任务状态一致性
- **全文搜索**：支持标准文档内容检索（避免引入Elasticsearch）
- **扩展性**：未来支持TimescaleDB（时序数据）、PostGIS（地理位置）

**Schema设计原则**：
- **事件溯源**：`ai_generation_events`表存储完整AI生成历史
- **软删除**：所有表包含`deleted_at`字段，支持数据恢复
- **审计日志**：`audit_logs`表记录所有敏感操作

#### TD-004: 任务队列选择 - BullMQ

**决策**：BullMQ（而非AWS SQS或RabbitMQ）

**理由**：
- **Redis原生**：项目已使用Redis，无需额外中间件
- **优先级队列**：支持高风险条款优先处理
- **延迟任务**：支持重试间隔（5分钟、10分钟指数退避）
- **进度跟踪**：内置进度更新API，方便WebSocket推送

**队列设计**：
```typescript
// 三个独立队列，互不阻塞
- ai-generation-gpt4       // GPT-4任务
- ai-generation-claude     // Claude任务
- ai-generation-domestic   // 国产模型任务
- ai-aggregation           // 结果聚合（监听上面三个队列）
```

#### TD-005: 认证方案 - NextAuth.js

**决策**：NextAuth.js（而非自建JWT或Auth0）

**理由**：
- **Next.js原生集成**：零配置支持App Router
- **灵活扩展**：MVP使用Credentials Provider（邮箱密码），V1.0扩展OAuth
- **Session管理**：支持JWT和Database Session（MVP使用JWT，减少DB查询）
- **免费开源**：无第三方服务依赖（避免Auth0高额费用）

**权限模型**：
```typescript
enum UserRole {
  CONSULTANT = 'consultant',      // 主咨询师
  CLIENT_PM = 'client_pm',       // 企业PM
  RESPONDENT = 'respondent'      // 被调研者
}
```

#### TD-006: 多级降级策略设计

**Level 1（理想）**：三模型全部成功 → 正常质量验证流程
```typescript
if (gpt4Success && claudeSuccess && domesticSuccess) {
  return performFullValidation(results);
}
```

**Level 2（可接受）**：两个模型成功 → 降低一致性要求到70%
```typescript
if (successCount === 2) {
  return performPartialValidation(results, threshold: 0.70);
}
```

**Level 3（降级）**：仅一个模型成功 → 标记"低置信度"，强制人工深度审核
```typescript
if (successCount === 1) {
  return {
    status: 'LOW_CONFIDENCE',
    requiresManualReview: true,
    result: successResults[0]
  };
}
```

**Level 4（兜底）**：三个模型全失败 → 提供"手工模式"
```typescript
if (successCount === 0) {
  return {
    status: 'MANUAL_MODE',
    fallback: 'AI辅助检索但不自动生成'
  };
}
```

---

## Implementation Plan

### Tasks

#### Week 1: 项目搭建与开发环境

- [ ] **Task 1.1**: 初始化前端项目
  - 使用`npx create-next-app@latest`创建Next.js 14项目
  - 配置TypeScript、ESLint、Prettier
  - 集成Ant Design 5.x和Tailwind CSS 3.x
  - 配置主题（参考`ux/01-foundation.md` Step 8）
  - **验收**：`npm run dev`启动成功，访问localhost:3000显示默认页面

- [ ] **Task 1.2**: 初始化后端项目
  - 使用`nest new csaas-backend`创建Nest.js项目
  - 配置TypeScript、ESLint、Prettier
  - 安装依赖：`@nestjs/config`, `@nestjs/typeorm`, `pg`, `@nestjs/bull`, `ioredis`
  - 配置环境变量（`.env.development`, `.env.production`）
  - **验收**：`npm run start:dev`启动成功，访问localhost:3000/health返回200

- [ ] **Task 1.3**: Docker本地开发环境
  - 编写`docker-compose.yml`：PostgreSQL 15 + Redis 7
  - 配置数据库初始化脚本（创建数据库、用户、权限）
  - 编写`Makefile`快捷命令（`make dev`, `make db-reset`）
  - **验收**：`docker-compose up -d`启动成功，`psql`连接数据库成功

- [ ] **Task 1.4**: 代码规范与Git工作流
  - 配置Husky + lint-staged（pre-commit自动格式化）
  - 配置Conventional Commits（commit message规范）
  - 创建`.gitignore`（排除node_modules、.env、dist）
  - 编写`CONTRIBUTING.md`（开发规范文档）
  - **验收**：提交代码时自动触发ESLint和Prettier

#### Week 2: 数据库设计与用户认证

- [ ] **Task 2.1**: PostgreSQL Schema设计
  - 创建Migration脚本（使用TypeORM或Prisma）
  - 设计核心表：`users`, `projects`, `ai_tasks`, `ai_generation_events`, `audit_logs`
  - 添加索引（user_id、project_id、task_id、created_at）
  - 添加约束（外键、非空、唯一）
  - **验收**：`npm run migration:run`执行成功，数据库包含所有表

- [ ] **Task 2.2**: TypeORM Entity定义
  - 定义User Entity（id、email、password_hash、role、created_at、updated_at、deleted_at）
  - 定义Project Entity（id、name、tenant_id、owner_id、status、created_at）
  - 定义AITask Entity（id、project_id、type、status、priority、created_at）
  - 定义AIGenerationEvent Entity（id、task_id、model、input、output、metadata、created_at）
  - **验收**：Entity定义包含所有字段，关系映射正确

- [ ] **Task 2.3**: NextAuth.js集成
  - 安装`next-auth`和`@next-auth/prisma-adapter`（或TypeORM Adapter）
  - 配置`app/api/auth/[...nextauth]/route.ts`
  - 实现Credentials Provider（邮箱密码登录）
  - 配置JWT策略（包含user_id、role）
  - 创建登录页面（`app/(auth)/login/page.tsx`）
  - **验收**：用户可以注册、登录、登出，Session包含正确的role

- [ ] **Task 2.4**: 角色权限中间件
  - 实现RolesGuard（基于NextAuth Session）
  - 实现@Roles装饰器（`@Roles(UserRole.CONSULTANT)`）
  - 测试权限控制（CONSULTANT可访问/api/projects，CLIENT_PM不可访问）
  - **验收**：未授权访问返回403，授权访问返回200

- [ ] **Task 2.5**: 基础UI组件库
  - 创建Layout组件（Header + Sidebar + Content）
  - 创建Header组件（Logo、用户菜单、登出按钮）
  - 创建Sidebar组件（导航菜单、当前页高亮）
  - 创建ProjectCard组件（项目卡片、进度显示）
  - **验收**：访问/dashboard显示完整布局，样式符合UX规范

#### Week 3: 三模型并行调用架构（Part 1）

- [ ] **Task 3.1**: BullMQ集成
  - 安装`@nestjs/bull`、`bull`、`ioredis`
  - 配置Redis连接（`config/redis.config.ts`）
  - 创建三个队列：`ai-generation-gpt4`, `ai-generation-claude`, `ai-generation-domestic`
  - 创建聚合队列：`ai-aggregation`
  - **验收**：启动后端，Redis包含4个队列

- [ ] **Task 3.2**: AI API客户端封装
  - 创建`lib/ai-clients/openai.client.ts`（封装OpenAI SDK）
  - 创建`lib/ai-clients/anthropic.client.ts`（封装Anthropic SDK）
  - 创建`lib/ai-clients/tongyi.client.ts`（封装通义千问SDK）
  - 统一接口：`generate(prompt: string, options?: GenerateOptions): Promise<GenerateResult>`
  - 实现超时处理（默认30秒，可配置）
  - **验收**：调用三个客户端均返回结果，超时抛出异常

- [ ] **Task 3.3**: AI Orchestrator实现
  - 创建`modules/ai-orchestrator/ai-orchestrator.service.ts`
  - 实现`submitTask(taskId, prompt)`方法（提交任务到三个队列）
  - 实现三个Worker（监听各自队列，调用对应AI客户端）
  - 实现结果存储（写入`ai_generation_events`表）
  - **验收**：提交任务后，三个模型并行执行，结果存入数据库

- [ ] **Task 3.4**: 任务状态管理
  - 更新`ai_tasks`表状态（PENDING → RUNNING → COMPLETED/FAILED）
  - 实现任务进度计算（已完成模型数 / 总模型数）
  - 实现任务超时检测（单个模型超过30秒标记为TIMEOUT）
  - **验收**：查询任务状态，返回正确的进度和状态

#### Week 4: 三模型并行调用架构（Part 2）

- [ ] **Task 4.1**: 多级降级策略实现
  - 实现Level 1逻辑（三模型全部成功）
  - 实现Level 2逻辑（两个模型成功，一致性阈值降至70%）
  - 实现Level 3逻辑（一个模型成功，标记LOW_CONFIDENCE）
  - 实现Level 4逻辑（零个模型成功，返回MANUAL_MODE）
  - **验收**：模拟各种失败场景，验证降级逻辑正确

- [ ] **Task 4.2**: 自动重试机制
  - 配置BullMQ重试策略（最多3次，间隔5/10/15分钟指数退避）
  - 实现失败任务重试逻辑
  - 实现API超时自动切换备用密钥（从环境变量读取备用密钥列表）
  - **验收**：模拟API失败，任务自动重试3次，使用备用密钥成功

- [ ] **Task 4.3**: WebSocket实时进度推送
  - 安装`@nestjs/websockets`、`socket.io`
  - 创建WebSocket Gateway（`modules/tasks/tasks.gateway.ts`）
  - 实现进度推送事件（`task:progress`, `task:completed`, `task:failed`）
  - 前端集成Socket.IO客户端
  - **验收**：前端连接WebSocket，实时显示任务进度（0% → 33% → 66% → 100%）

- [ ] **Task 4.4**: 成本监控与告警
  - 创建`ai_cost_tracking`表（task_id、model、tokens、cost、created_at）
  - 实现成本计算（基于token数和模型定价）
  - 实现单项目成本告警（超过30元发送通知）
  - 创建成本统计API（`GET /api/projects/:id/cost`）
  - **验收**：完成任务后，`ai_cost_tracking`表包含成本记录，超过阈值触发告警

- [ ] **Task 4.5**: 日志与监控
  - 配置Winston结构化日志（JSON格式）
  - 集成Sentry错误监控
  - 创建Health Check端点（`GET /api/health`，检查DB、Redis连接）
  - 配置CloudWatch日志推送（生产环境）
  - **验收**：访问/api/health返回200，Sentry记录错误，CloudWatch显示日志

- [ ] **Task 4.6**: 单元测试与集成测试
  - 编写AI Orchestrator单元测试（覆盖降级逻辑）
  - 编写API客户端Mock测试
  - 编写认证中间件集成测试
  - 配置Jest覆盖率目标（核心模块 ≥ 60%）
  - **验收**：`npm run test`通过，覆盖率达标

### Acceptance Criteria

#### 功能验收

- [ ] **AC-F1**: 用户可以注册、登录、登出，Session包含正确的role
  - **Given** 用户访问/login页面
  - **When** 输入有效的邮箱和密码
  - **Then** 登录成功，跳转到/dashboard，Session包含user_id和role

- [ ] **AC-F2**: 主咨询师可以创建项目，企业PM不可创建项目
  - **Given** 主咨询师登录
  - **When** 访问/projects/create并提交表单
  - **Then** 项目创建成功，数据库包含新项目记录
  - **And** 企业PM访问/projects/create时返回403

- [ ] **AC-F3**: 提交AI任务后，三个模型并行执行，实时显示进度
  - **Given** 主咨询师在项目详情页点击"生成综述"
  - **When** 提交任务后
  - **Then** 前端显示进度：0% → 33%（GPT-4完成）→ 66%（Claude完成）→ 100%（国产模型完成）
  - **And** 数据库包含三条`ai_generation_events`记录

- [ ] **AC-F4**: 单个模型失败时，任务继续执行并触发降级策略
  - **Given** 提交AI任务，模拟Claude API超时
  - **When** 任务执行
  - **Then** GPT-4和国产模型成功执行，任务状态为COMPLETED（Level 2降级）
  - **And** 前端显示警告："Claude模型失败，已使用两模型验证（置信度70%）"

- [ ] **AC-F5**: 三个模型全部失败时，系统提供手工模式
  - **Given** 提交AI任务，模拟所有API失败
  - **When** 任务执行3次重试后仍失败
  - **Then** 任务状态为MANUAL_MODE
  - **And** 前端显示："AI生成失败，请使用手工模式"，提供标准文档检索界面

#### 性能验收

- [ ] **AC-P1**: 单个AI任务执行时间P50 ≤ 25分钟，P95 ≤ 35分钟
  - **测试方法**：提交10个任务，记录完成时间
  - **验收标准**：中位数 ≤ 25分钟，95分位 ≤ 35分钟

- [ ] **AC-P2**: 前端页面首屏加载时间 ≤ 3秒（Fast 3G网络）
  - **测试方法**：使用Lighthouse测试
  - **验收标准**：Performance Score ≥ 80

- [ ] **AC-P3**: WebSocket推送延迟 ≤ 2秒
  - **测试方法**：AI模型完成后，前端收到推送的时间差
  - **验收标准**：延迟 ≤ 2秒

#### 安全验收

- [ ] **AC-S1**: 所有API端点需要认证，未登录返回401
  - **测试方法**：访问/api/projects不带Token
  - **验收标准**：返回401 Unauthorized

- [ ] **AC-S2**: 密码使用bcrypt加密，加盐轮数 ≥ 10
  - **测试方法**：查看数据库`users.password_hash`字段
  - **验收标准**：以`$2b$10$`开头

- [ ] **AC-S3**: AI API密钥存储在环境变量，不提交到代码仓库
  - **测试方法**：搜索代码仓库
  - **验收标准**：无硬编码API密钥，`.env`文件在`.gitignore`

- [ ] **AC-S4**: 审计日志记录所有敏感操作（创建项目、删除任务、修改权限）
  - **测试方法**：执行敏感操作后查询`audit_logs`表
  - **验收标准**：包含操作类型、用户ID、时间戳、IP地址

#### 可靠性验收

- [ ] **AC-R1**: 数据库连接失败时，Health Check返回503
  - **测试方法**：停止PostgreSQL容器，访问/api/health
  - **验收标准**：返回503 Service Unavailable

- [ ] **AC-R2**: Redis连接失败时，任务提交失败并返回明确错误信息
  - **测试方法**：停止Redis容器，提交AI任务
  - **验收标准**：返回500，错误信息："任务队列不可用，请稍后重试"

- [ ] **AC-R3**: Sentry记录所有500错误
  - **测试方法**：触发未捕获异常，检查Sentry Dashboard
  - **验收标准**：Sentry显示错误堆栈和上下文

---

## Additional Context

### Dependencies

**前端依赖（package.json）**：
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "antd": "^5.12.0",
    "tailwindcss": "^3.4.0",
    "next-auth": "^4.24.0",
    "socket.io-client": "^4.6.0",
    "zustand": "^4.4.0",
    "recharts": "^2.10.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "typescript": "^5.3.0",
    "eslint": "^8.55.0",
    "prettier": "^3.1.0"
  }
}
```

**后端依赖（package.json）**：
```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/config": "^3.1.0",
    "@nestjs/typeorm": "^10.0.0",
    "@nestjs/bull": "^10.0.0",
    "@nestjs/websockets": "^10.0.0",
    "typeorm": "^0.3.0",
    "pg": "^8.11.0",
    "bull": "^4.12.0",
    "ioredis": "^5.3.0",
    "socket.io": "^4.6.0",
    "bcrypt": "^5.1.0",
    "openai": "^4.20.0",
    "@anthropic-ai/sdk": "^0.9.0",
    "@alicloud/openapi-client": "^0.4.0",
    "winston": "^3.11.0",
    "@sentry/node": "^7.91.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "jest": "^29.7.0",
    "supertest": "^6.3.0",
    "eslint": "^8.55.0",
    "prettier": "^3.1.0"
  }
}
```

### Testing Strategy

**单元测试**：
- 测试框架：Jest + React Testing Library（前端）、Jest + Supertest（后端）
- 覆盖率目标：核心业务逻辑 ≥ 60%
- Mock策略：AI API使用Mock（避免真实调用），数据库使用内存SQLite

**集成测试**：
- 测试真实API流程（使用测试数据库）
- 测试三模型并行调用完整流程
- 测试降级策略（模拟API失败）

**E2E测试**：
- 框架：Playwright
- 覆盖核心用户旅程：注册 → 登录 → 创建项目 → 提交AI任务 → 查看进度

### Notes

**技术风险与缓解**：

1. **风险：三模型API成本超预算**
   - **缓解**：实现成本监控告警，单项目超过30元时通知
   - **Plan B**：切换到更便宜的模型（GPT-4 → GPT-4o-mini）

2. **风险：API稳定性问题导致任务失败率高**
   - **缓解**：多级降级策略 + 自动重试 + 备用API密钥
   - **Plan B**：手工模式兜底

3. **风险：WebSocket连接不稳定**
   - **缓解**：实现心跳检测和自动重连
   - **Plan B**：降级为轮询方式（每5秒查询任务状态）

**开发优先级**：
1. 先完成认证和权限（阻塞后续所有功能）
2. 再完成AI Orchestrator核心逻辑（最高技术风险）
3. 最后完成UI和WebSocket（可并行开发）

**交付物检查清单**：
- [ ] 前端项目可本地启动（`npm run dev`）
- [ ] 后端项目可本地启动（`npm run start:dev`）
- [ ] 数据库Migration成功执行
- [ ] 所有单元测试通过（`npm run test`）
- [ ] 所有验收标准通过
- [ ] 代码已提交到Git仓库
- [ ] 环境变量已配置（.env.example提供模板）
- [ ] README.md包含启动指南

---

**Tech-Spec生成时间**: 2025-12-25
**预计开发时间**: 4周（2025-01-01 ~ 2025-01-31）
**下一阶段**: Phase 2 - AI生成引擎（Month 2）
