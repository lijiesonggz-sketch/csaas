---
epic: epic-11
story: 11-5-auth-migration
status: story-created
---

# Story 11.5: 认证页面迁移

## 用户故事

**As a** 前端开发者,
**I want** 将认证页面（登录、注册）从 Ant Design 迁移到 MUI,
**So that** 统一 UI 框架，为 Story 11-6 清理 Ant Design 依赖做准备。

## 背景与上下文

Story 11-1 至 11-4 已完成以下迁移：
- 11-1: MUI 主题配置（`frontend/lib/theme.ts`）和消息工具（`frontend/lib/message.ts`）
- 11-2: 布局组件迁移（Sidebar, Header, MainLayout）
- 11-3: AI Generation 页面迁移（5 个页面 + 7 个子组件）
- 11-4: Features 组件迁移（剩余 Ant Design 组件 + lucide-react 图标统一）

本 Story 处理 `frontend/app/(auth)/` 目录下的登录和注册页面，这是移除 Ant Design 前的最后一批页面迁移。

## 前置依赖

- [x] Story 11-1 (MUI 主题配置) - 已完成
- [x] Story 11-2 (布局组件迁移) - 已完成
- [ ] Story 11-6 (清理 Ant Design) - 被本 Story 阻塞

## 验收标准

### AC1: 登录页面迁移
**Given** 访问 /login 页面
**When** 页面加载完成
**Then** 所有 Ant Design 导入（`Form`, `Input`, `Button`, `Card`, `message` from `antd`; `MailOutlined`, `LockOutlined` from `@ant-design/icons`）已替换为 MUI 对应组件
**And** 使用 MUI `Card`, `TextField`, `Button`, `InputAdornment` 等组件
**And** 使用 `frontend/lib/message.ts` 的 `message` 工具替代 `antd/message`
**And** 邮箱必填验证和格式验证正常工作
**And** 密码必填验证正常工作
**And** 登录提交调用 `signIn('credentials', ...)` 功能正常
**And** 登录成功后跳转到 /dashboard
**And** 登录失败显示错误提示

### AC2: 注册页面迁移
**Given** 访问 /register 页面
**When** 页面加载完成
**Then** 所有 Ant Design 导入（`Form`, `Input`, `Button`, `Card`, `message`, `Select` from `antd`; `MailOutlined`, `LockOutlined`, `UserOutlined` from `@ant-design/icons`）已替换为 MUI 对应组件
**And** 使用 MUI `Card`, `TextField`, `Button`, `Select`/`MenuItem`, `InputAdornment` 等组件
**And** 使用 `frontend/lib/message.ts` 的 `message` 工具替代 `antd/message`
**And** 姓名必填验证正常工作
**And** 邮箱必填验证和格式验证正常工作
**And** 密码必填验证和最少 8 字符验证正常工作
**And** 确认密码一致性验证正常工作
**And** 角色选择下拉框（主咨询师/企业PM/被调研者）正常工作
**And** 注册提交调用 API `/auth/register` 功能正常
**And** 注册成功后跳转到 /login

### AC3: 视觉一致性
**Given** 迁移后的认证页面
**When** 对比原 Ant Design 版本
**Then** 保持渐变背景（`linear-gradient(135deg, #667eea 0%, #764ba2 100%)`）
**And** 卡片样式保持居中、阴影效果
**And** 表单布局保持垂直排列
**And** 页面间导航链接（"立即注册"/"立即登录"）正常工作

### AC4: 零 Ant Design 残留
**Given** 检查 `frontend/app/(auth)/` 目录下所有文件
**When** 搜索 `from 'antd'` 和 `from '@ant-design/icons'`
**Then** 无任何 Ant Design 导入残留

## 技术规范

### 修改文件

1. **frontend/app/(auth)/login/page.tsx**
   - `Form` + `Form.Item` → 原生 `<form>` + React state 管理表单状态和验证
   - `Input` → MUI `TextField`（带 `InputAdornment` 替代 prefix 图标）
   - `Input.Password` → MUI `TextField` type="password"（带可见性切换）
   - `Button` → MUI `Button`（variant="contained", fullWidth）
   - `Card` → MUI `Card` + `CardContent`
   - `message` from `antd` → `message` from `@/lib/message`
   - `MailOutlined` → `EmailOutlined` from `@mui/icons-material`
   - `LockOutlined` → `LockOutlined` from `@mui/icons-material`
   - 移除 `data-testid` 属性（按项目规范，测试应使用 role/label 选择器）
   - 内联 style → MUI `sx` 属性或 `Box` 组件

2. **frontend/app/(auth)/register/page.tsx**
   - 同 login 页面的组件映射
   - `Select` + `Option` → MUI `Select` + `MenuItem`（或 `TextField` select 模式）
   - `UserOutlined` → `PersonOutlined` from `@mui/icons-material`
   - 密码确认验证逻辑需用 React state 手动实现（Ant Design Form 的 `dependencies` + `getFieldValue` 不再可用）

### 组件映射

| Ant Design | MUI | 备注 |
|------------|-----|------|
| Form + Form.Item | 原生 form + React state | 需手动管理验证状态 |
| Input | TextField | variant="outlined" |
| Input.Password | TextField type="password" | 可添加可见性切换 |
| Button | Button | variant="contained" |
| Card | Card + CardContent | |
| Select + Option | Select + MenuItem | 或 TextField select |
| message | message from @/lib/message | 已在 Story 11-1 创建 |

### 图标映射

| Ant Design Icons | MUI Icons | 用途 |
|------------------|-----------|------|
| MailOutlined | EmailOutlined | 邮箱输入框图标 |
| LockOutlined | LockOutlined | 密码输入框图标 |
| UserOutlined | PersonOutlined | 姓名输入框图标 |

### 表单验证迁移策略

Ant Design Form 内置验证系统需迁移为 React state 手动管理：

```typescript
// 验证状态管理示例
const [errors, setErrors] = useState<Record<string, string>>({});

const validateEmail = (email: string) => {
  if (!email) return '请输入邮箱';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '请输入有效的邮箱地址';
  return '';
};

// 在 TextField 上使用
<TextField
  error={!!errors.email}
  helperText={errors.email}
  ...
/>
```

### 关键注意事项

1. **保留 `signIn` 调用**：登录页面使用 `next-auth/react` 的 `signIn`，此逻辑不变
2. **保留 API 调用**：注册页面直接调用 `${process.env.NEXT_PUBLIC_API_URL}/auth/register`，此逻辑不变
3. **使用已有 message 工具**：`frontend/lib/message.ts` 已在 Story 11-1 中创建，直接导入使用
4. **使用已有主题**：`frontend/lib/theme.ts` 已配置主色调 `#667eea`，MUI 组件会自动应用

## 任务清单

### 开发任务

- [x] 1. 迁移登录页面 (`frontend/app/(auth)/login/page.tsx`)
  - [x] 1.1 替换 Ant Design 导入为 MUI 导入
  - [x] 1.2 实现 React state 表单状态管理和验证
  - [x] 1.3 替换 Form + Form.Item 为原生 form + TextField
  - [x] 1.4 替换 Card 为 MUI Card + CardContent
  - [x] 1.5 替换 Button 为 MUI Button
  - [x] 1.6 替换图标为 MUI Icons
  - [x] 1.7 替换 message 为 lib/message
  - [x] 1.8 将内联 style 迁移为 MUI sx 属性
  - [x] 1.9 验证登录功能正常

- [x] 2. 迁移注册页面 (`frontend/app/(auth)/register/page.tsx`)
  - [x] 2.1 替换 Ant Design 导入为 MUI 导入
  - [x] 2.2 实现 React state 表单状态管理和验证（含密码确认）
  - [x] 2.3 替换 Form + Form.Item 为原生 form + TextField
  - [x] 2.4 替换 Select + Option 为 MUI Select + MenuItem
  - [x] 2.5 替换 Card 为 MUI Card + CardContent
  - [x] 2.6 替换 Button 为 MUI Button
  - [x] 2.7 替换图标为 MUI Icons
  - [x] 2.8 替换 message 为 lib/message
  - [x] 2.9 将内联 style 迁移为 MUI sx 属性
  - [x] 2.10 验证注册功能正常

- [x] 3. 验证零 Ant Design 残留
  - [x] 3.1 搜索 `frontend/app/(auth)/` 目录确认无 antd 导入

### 测试任务

- [x] 4. 编写单元测试
  - [x] 4.1 登录页面单元测试（表单渲染、验证逻辑、提交行为）
  - [x] 4.2 注册页面单元测试（表单渲染、验证逻辑、密码确认、角色选择、提交行为）

- [x] 5. 编写 E2E 测试
  - [x] 5.1 创建 `frontend/e2e/auth-migration.spec.ts`
  - [x] 5.2 登录页面 E2E 测试（页面加载、表单验证、登录流程）
  - [x] 5.3 注册页面 E2E 测试（页面加载、表单验证、注册流程）
  - [x] 5.4 页面间导航测试（登录 ↔ 注册链接）

- [x] 6. TypeScript 编译验证
  - [x] 6.1 运行 `npx tsc --noEmit` 确认无类型错误（auth 页面无错误，其他页面有预存错误）

## 测试要求

- **单元测试**：验证表单渲染、验证逻辑、提交行为
- **E2E 测试**：验证登录/注册完整流程，文件位置 `frontend/e2e/auth-migration.spec.ts`
- **回归测试**：确保现有测试不受影响

## 风险与注意事项

1. **表单验证迁移复杂度**：Ant Design Form 有内置验证系统（rules, dependencies, getFieldValue），迁移到 MUI 需要手动用 React state 管理验证状态，这是本 Story 的主要技术挑战
2. **密码确认验证**：注册页面的 `confirmPassword` 字段依赖 `password` 字段值，需要特别处理跨字段验证
3. **`data-testid` 属性**：当前登录页面有 `data-testid` 属性，按项目规范应移除，测试应使用 `getByRole`/`getByLabel` 选择器

## File List

### 修改文件
- `frontend/app/(auth)/login/page.tsx` - 登录页面 MUI 迁移
- `frontend/app/(auth)/register/page.tsx` - 注册页面 MUI 迁移

### 新增测试文件
- `frontend/e2e/auth-migration.spec.ts` - 认证页面 E2E 测试
- `frontend/app/(auth)/__tests__/login.test.tsx` - 登录页面单元测试
- `frontend/app/(auth)/__tests__/register.test.tsx` - 注册页面单元测试

## Dev Agent Record

### 文件变更列表

#### 修改文件
- `frontend/app/(auth)/login/page.tsx` - 已迁移到 MUI（无 Ant Design 导入）
- `frontend/app/(auth)/register/page.tsx` - 已迁移到 MUI（无 Ant Design 导入）

#### 新增测试文件
- `frontend/app/(auth)/__tests__/login.test.tsx` - 登录页面单元测试（20 个测试用例）
- `frontend/app/(auth)/__tests__/register.test.tsx` - 注册页面单元测试（20 个测试用例）
- `frontend/e2e/auth-migration.spec.ts` - 认证页面 E2E 测试（33 个测试用例）

#### 依赖变更
- 添加了 `@testing-library/dom` 开发依赖（用于单元测试）

### 变更日志

1. **登录页面迁移完成**
   - 所有 Ant Design 组件已替换为 MUI 等效组件
   - Form + Form.Item → 原生 form + React state 管理
   - Input → TextField（带 InputAdornment 图标）
   - Input.Password → TextField type="password"（带可见性切换）
   - Button → MUI Button
   - Card → MUI Card + CardContent
   - message from antd → message from @/lib/message
   - MailOutlined → EmailOutlined from @mui/icons-material
   - LockOutlined → LockOutlined from @mui/icons-material
   - 内联 style → MUI sx 属性

2. **注册页面迁移完成**
   - 所有 Ant Design 组件已替换为 MUI 等效组件
   - Select + Option → MUI Select + MenuItem（TextField select 模式）
   - UserOutlined → PersonOutlined from @mui/icons-material
   - 密码确认验证使用 React state 手动实现
   - 角色选择下拉框使用 MUI Select 实现

3. **单元测试完成**
   - 登录页面：20 个测试用例，覆盖表单渲染、验证逻辑、提交行为
   - 注册页面：20 个测试用例，覆盖表单渲染、验证逻辑、密码确认、角色选择、提交行为
   - 所有测试通过

4. **E2E 测试完成**
   - 创建 auth-migration.spec.ts，包含 33 个测试用例
   - 覆盖登录页面、注册页面、表单验证、页面导航、响应式设计、无障碍访问
   - 零 Ant Design 残留验证

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-10 | 故事创建 | AI Agent |
| 2026-02-10 | 故事验证和增强 - 补充完整验收标准、任务清单、文件列表、技术细节 | AI Agent |
| 2026-02-10 | 完成 Story 11-5：认证页面 MUI 迁移、单元测试（40 个）、E2E 测试（33 个） | AI Agent |
| 2026-02-10 | Code Review完成 - 8个问题已修复（添加id/name/autoComplete属性，使用theme颜色） | AI Agent |

## Status

**Current Status:** done

**Status Definitions:**
- story-created: 故事已创建，待验证
- ready-for-dev: 准备开发
- in-progress: 开发中
- review: 待审查
- done: 已完成
