# Csaas 开发规范

## 代码规范

### 命名约定

**前端（Next.js + React）**：
- 组件：PascalCase（`ProjectCard.tsx`）
- 文件夹：kebab-case（`project-details/`）
- 函数：camelCase（`fetchProjects()`）
- 常量：UPPER_SNAKE_CASE（`MAX_FILE_SIZE`）
- CSS类名：kebab-case（`project-card`）

**后端（Nest.js）**：
- 模块：feature.module.ts
- 控制器：feature.controller.ts
- 服务：feature.service.ts
- DTO：kebab-case.dto.ts（`create-project.dto.ts`）
- Entity：PascalCase（`User.entity.ts`）

### 代码风格

项目使用ESLint + Prettier统一代码风格：

```bash
# 前端格式化
cd frontend && npm run format

# 后端格式化
cd backend && npm run format

# 前端检查
cd frontend && npm run lint

# 后端检查
cd backend && npm run lint
```

**关键规则**：
- 使用2空格缩进
- 使用单引号（JavaScript/TypeScript）
- 每行最大长度100字符
- 使用分号结尾
- 使用箭头函数（除非需要`this`绑定）

## Git工作流

### Commit规范

本项目遵循[Conventional Commits](https://www.conventionalcommits.org/)规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type类型**：
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式（不影响代码运行的变动）
- `refactor`: 重构（既不是新增功能，也不是修复bug）
- `perf`: 性能优化
- `test`: 增加测试
- `chore`: 构建过程或辅助工具的变动
- `revert`: 回滚
- `build`: 构建系统或外部依赖项的更改
- `ci`: CI配置文件和脚本的更改

**示例**：

```bash
# 新功能
feat(auth): 实现用户登录功能

# Bug修复
fix(api): 修复AI任务状态更新失败的问题

# 文档更新
docs(readme): 更新安装指南

# 重构
refactor(database): 优化数据库查询性能

# 性能优化
perf(frontend): 优化项目列表页面加载速度
```

### 分支管理

**主要分支**：
- `main`: 生产环境代码
- `develop`: 开发环境代码

**功能分支**：
- `feature/<feature-name>`: 新功能开发
- `bugfix/<bug-name>`: Bug修复
- `hotfix/<hotfix-name>`: 紧急修复

**工作流程**：

```bash
# 1. 从develop创建功能分支
git checkout develop
git pull origin develop
git checkout -b feature/user-authentication

# 2. 开发并提交
git add .
git commit -m "feat(auth): implement user registration"

# 3. 推送到远程
git push origin feature/user-authentication

# 4. 创建Pull Request到develop分支
```

### Pre-commit检查

项目配置了Husky + lint-staged，提交代码时会自动：

1. **代码格式化**：自动运行Prettier
2. **代码检查**：自动运行ESLint并修复
3. **提交信息验证**：检查commit message是否符合规范

如果检查失败，提交会被阻止。请修复错误后重新提交。

## 目录结构

### 前端（frontend/）

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
  /theme.ts       # Ant Design主题配置
```

### 后端（backend/）

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

## 开发流程

### 1. 启动开发环境

```bash
# 启动Docker（PostgreSQL + Redis）
docker compose up -d

# 终端1 - 后端
cd backend
npm run start:dev

# 终端2 - 前端
cd frontend
npm run dev
```

### 2. 数据库Migration

```bash
# 生成Migration
cd backend
npm run migration:generate -- src/database/migrations/CreateUserTable

# 运行Migration
npm run migration:run

# 回滚Migration
npm run migration:revert
```

### 3. 运行测试

```bash
# 前端单元测试
cd frontend
npm run test

# 后端单元测试
cd backend
npm run test

# 后端E2E测试
npm run test:e2e

# 测试覆盖率
npm run test:cov
```

## 代码审查清单

提交Pull Request前，请确保：

- [ ] 代码符合命名规范和代码风格
- [ ] 添加了必要的注释（复杂逻辑）
- [ ] 更新了相关文档
- [ ] 添加了单元测试（核心业务逻辑）
- [ ] 所有测试通过
- [ ] 没有console.log等调试代码
- [ ] 没有硬编码的配置（使用环境变量）
- [ ] 没有安全漏洞（API密钥、SQL注入、XSS等）
- [ ] Commit message符合规范

## 常见问题

### Pre-commit检查失败

**问题**：提交时显示ESLint错误
**解决**：
```bash
# 自动修复
cd frontend && npm run lint
cd backend && npm run lint

# 格式化代码
cd frontend && npm run format
cd backend && npm run format
```

### Commit message不符合规范

**问题**：`subject may not be empty [subject-empty]`
**解决**：使用正确的commit格式：
```bash
git commit -m "feat(auth): implement user login"
```

### TypeScript类型错误

**问题**：Property 'xxx' does not exist on type 'YYY'
**解决**：
1. 检查类型定义是否正确
2. 添加必要的类型注解
3. 使用`@ts-ignore`（仅作最后手段，需添加注释说明原因）

## 联系方式

如有问题，请：
1. 查看[SETUP.md](./SETUP.md)快速启动指南
2. 查看[README.md](./README.md)项目文档
3. 在团队群组提问

---

**最后更新**: 2025-12-25
**维护者**: Csaas开发团队
