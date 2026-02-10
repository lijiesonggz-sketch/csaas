---
epic: epic-9
story: 9-1-jwt-security-hardening
status: done
---

# Story 9.1: JWT 安全加固

## 用户故事

**As a** 系统管理员,
**I want** JWT 认证机制符合安全最佳实践,
**So that** 系统免受 JWT 相关的安全攻击。

## 验收标准

### AC1: JWT Secret 强制环境变量配置
**Given** 系统启动时
**When** JWT_SECRET 环境变量未设置或长度小于 32 字符
**Then** 抛出错误并阻止系统启动，提示 "JWT_SECRET must be set and at least 32 characters"

### AC2: 移除 JWT Secret 默认值
**Given** 查看 JWT 配置文件
**When** 检查所有 JWT 相关配置
**Then** 不存在任何硬编码的默认 secret（如 'change-this-secret-in-production' 或 'default-secret'）
**And** 仅使用 process.env.JWT_SECRET

### AC3: JWT 会话超时缩短
**Given** 用户登录成功
**When** 系统生成 JWT Token
**Then** Token 有效期为 2 小时（而非原来的 7 天）
**And** JWT_EXPIRES_IN 环境变量默认值为 "2h"

### AC4: 环境变量示例更新
**Given** 查看 .env.example 文件
**When** 检查 JWT 相关配置
**Then** 包含 JWT_SECRET 和 JWT_EXPIRES_IN 的示例值
**And** 包含安全提示注释

## 技术规范

### 修改文件

1. **backend/src/config/jwt.config.ts**
   - 移除 `|| 'change-this-secret-in-production'`
   - 添加 `validateJwtConfig()` 函数，在 JWT_SECRET 未设置或长度<32时抛出错误
   - 默认过期时间 '7d' → '2h'

2. **backend/src/modules/auth/auth.module.ts**
   - 移除 `|| 'default-secret'`
   - 使用 `configService.get<string>('JWT_SECRET')` (无默认值)

3. **backend/src/main.ts**
   - 在 `bootstrap()` 开头调用 `validateJwtConfig()`
   - 如果验证失败，阻止应用启动

4. **backend/src/modules/auth/strategies/jwt.strategy.ts**
   - 检查并移除任何默认 secret

5. **backend/.env.example**
   - 添加 JWT_SECRET=your-32-character-secret-key-here
   - 添加 JWT_EXPIRES_IN=2h

6. **backend/.env.development**
   - JWT_EXPIRES_IN=7d → JWT_EXPIRES_IN=2h

### 安全要求

- JWT Secret 必须至少 32 字符
- 生产环境必须使用强随机字符串
- 禁止在任何配置文件中硬编码 secret

## 相关 Stories

- **Story 9-2:** 登录失败锁定机制 - 本 Story 的 JWT 配置变更会影响 9-2 的登录流程，建议按顺序先实现 9-1

## 测试要求

- 单元测试：验证启动时无 JWT_SECRET 抛出错误
- 单元测试：验证 JWT_SECRET 长度不足抛出错误
- 单元测试：验证 Token 过期时间为 2 小时
- 集成测试：验证登录后 Token 正确生成
- E2E 测试：验证无 JWT_SECRET 时系统拒绝启动
- E2E 测试：验证 Token 2小时后过期

## 任务列表

### 实现任务

- [x] 1. 修改 `backend/src/config/jwt.config.ts`
  - [x] 移除默认 secret `|| 'change-this-secret-in-production'`
  - [x] 添加 `validateJwtConfig()` 函数
  - [x] 默认过期时间 '7d' → '2h'

- [x] 2. 修改 `backend/src/modules/auth/auth.module.ts`
  - [x] 移除 `|| 'default-secret'`
  - [x] 使用无默认值的 `configService.get<string>('JWT_SECRET')`

- [x] 3. 修改 `backend/src/main.ts`
  - [x] 在 `bootstrap()` 开头调用 `validateJwtConfig()`

- [x] 4. 检查 `backend/src/modules/auth/strategies/jwt.strategy.ts`
  - [x] 确认无默认 secret（已验证通过）

- [x] 5. 更新 `backend/.env.example`
  - [x] 添加 JWT_SECRET 示例
  - [x] 添加 JWT_EXPIRES_IN 示例
  - [x] 添加安全提示注释

- [x] 6. 更新 `backend/.env.development`
  - [x] JWT_EXPIRES_IN=7d → JWT_EXPIRES_IN=2h

### 测试任务

- [x] 7. 创建单元测试 `backend/src/config/jwt.config.spec.ts`
  - [x] 验证启动时无 JWT_SECRET 抛出错误
  - [x] 验证 JWT_SECRET 长度不足抛出错误
  - [x] 验证 Token 默认过期时间为 2 小时
  - [x] 验证无默认 secret

- [x] 8. 运行所有现有测试
  - [x] 验证 auth.service.jwt.spec.ts 通过
  - [x] 验证 auth.controller.jwt.spec.ts 通过
  - [x] 验证 jwt.strategy.spec.ts 通过

## 文件变更列表

### 修改的文件

1. `backend/src/config/jwt.config.ts` - 添加 validateJwtConfig() 函数，移除默认 secret，修改默认过期时间
2. `backend/src/modules/auth/auth.module.ts` - 移除默认 secret
3. `backend/src/main.ts` - 添加 validateJwtConfig() 调用
4. `backend/.env.example` - 添加 JWT 配置示例
5. `backend/.env.development` - 修改 JWT_EXPIRES_IN 为 2h

### 新增的文件

1. `backend/src/config/jwt.config.spec.ts` - JWT 配置单元测试

## Dev Agent Record

### 实现计划

采用 red-green-refactor 循环实现：
1. 首先修改配置文件，添加 validateJwtConfig() 函数
2. 更新所有使用 JWT_SECRET 的地方，移除默认值
3. 更新环境变量文件
4. 编写单元测试验证所有场景

### 调试日志

- TypeScript 类型检查通过
- 所有 JWT 相关单元测试通过 (24 tests)
- 验证 JWT_SECRET 长度检查逻辑正确（32字符边界测试通过）

### Code Review 修复记录

**Reviewer:** Claude Code (Code Review Agent)
**Review Date:** 2026-02-09
**Issues Found:** 2 High, 3 Medium, 2 Low
**Issues Fixed:** 5 (All HIGH and MEDIUM)

#### 修复的问题：

1. **[HIGH] AuthModule 缺少 JWT_SECRET 验证** (backend/src/modules/auth/auth.module.ts:15-26)
   - 问题：AuthModule 直接使用 configService.get() 而不验证 secret 是否存在
   - 修复：添加运行时检查，如果 secret 未配置则抛出明确的错误

2. **[HIGH] 开发环境 JWT_SECRET 格式不当** (backend/.env.development:48)
   - 问题：原 secret 看起来像生产环境 secret
   - 修复：改为 `test-only-jwt-secret-for-dev-environment-32`，明确表示仅用于测试

3. **[MEDIUM] 错误消息不一致** (backend/src/config/jwt.config.ts:27,31)
   - 问题：两种不同错误条件使用相同的错误消息
   - 修复：区分 "not set" 和 "too short" 的错误消息，并包含实际长度信息

4. **[MEDIUM] 缺少最大长度检查** (backend/src/config/jwt.config.ts:34-36)
   - 问题：未限制 JWT_SECRET 的最大长度，可能导致 DoS
   - 修复：添加 512 字符最大长度限制

5. **[MEDIUM] 类型安全问题** (backend/src/modules/auth/auth.module.ts:23)
   - 问题：使用 `as any` 绕过类型检查
   - 修复：使用正确的类型断言 `${number}h` | `${number}d` | `${number}m` | `${number}s`

#### 新增测试：
- 验证 JWT_SECRET 超过 512 字符时抛出错误
- 验证 JWT_SECRET 恰好 512 字符时通过

### 完成说明

所有验收标准已满足：
- AC1: 系统启动时验证 JWT_SECRET，未设置或长度<32时抛出错误
- AC2: 所有默认 secret 已移除
- AC3: 默认过期时间改为 2h
- AC4: .env.example 已更新，包含安全提示

**Code Review 后：** 所有 HIGH 和 MEDIUM 问题已修复，测试通过 (26/26)

## 部署注意事项

生成生产环境 JWT_SECRET:
```bash
openssl rand -base64 32
```

---

**状态:** done
**最后更新:** 2026-02-09
