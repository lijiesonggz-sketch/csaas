# CSAAS - AI驱动的IT咨询成熟度评估平台

> 三模型协同架构 (GPT-4 + Claude + 国产模型) 的企业级 SaaS 平台

[![License](https://img.shields.io/badge/license-Private-red.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-red.svg)](https://nestjs.com/)

## 项目简介

CSAAS 是一个基于 AI 的企业级咨询工具平台，专注于 IT 咨询、数据安全合规和智能运维领域。通过自然语言处理和机器学习技术，帮助企业快速完成标准解读、差距分析和行动计划制定。

### 核心功能

- 📄 **文档解析与条款提取** - 智能识别和提取标准文档中的关键条款
- 🔍 **标准聚类与合并** - 自动分析相似条款，优化问卷结构
- 📋 **问卷生成与管理** - 基于标准自动生成评估问卷
- 📊 **差距分析** - 对比现状与标准要求，识别合规差距
- 🎯 **行动计划** - 生成可执行的改进建议和实施路线图
- 🔐 **多租户架构** - 支持企业级权限管理和数据隔离
- 📡 **合规雷达** - 实时监控行业合规动态和技术趋势

## 技术栈

### 前端
- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript 5.0
- **UI**: shadcn/ui + Tailwind CSS 3.x (正在从 Ant Design 迁移)
- **认证**: NextAuth.js
- **状态管理**: React Hooks + Context API
- **实时通信**: Socket.IO Client
- **测试**: Playwright (E2E)

### 后端
- **框架**: NestJS 10
- **语言**: TypeScript 5.0
- **数据库**: PostgreSQL 15 + TypeORM
- **缓存/队列**: Redis + Bull
- **AI SDK**: OpenAI, Anthropic, 通义千问, 智谱 GLM
- **WebSocket**: Socket.IO
- **日志**: Winston
- **监控**: Sentry
- **测试**: Jest

## 快速开始

### 1. 安装依赖

```bash
make install
```

或手动安装：

```bash
cd frontend && npm install
cd ../backend && npm install
```

### 2. 启动数据库

```bash
make db-up
```

等待PostgreSQL和Redis启动完成。

### 3. 配置环境变量

**前端** (frontend/.env.local):
```bash
cp frontend/.env.example frontend/.env.local
# 编辑 .env.local 填写配置
```

**后端** (backend/.env.development):
```bash
cp backend/.env.example backend/.env.development
# 编辑 .env.development 填写AI API密钥等配置
```

### 4. 运行数据库迁移

```bash
cd backend
npm run migration:run
```

### 5. 启动开发服务器

**终端1 - 前端**:
```bash
make dev-frontend
```

**终端2 - 后端**:
```bash
make dev-backend
```

访问:
- 前端: http://localhost:3001
- 后端: http://localhost:3000
- 健康检查: http://localhost:3000/health

## 项目结构

```
csaas/
├── frontend/              # Next.js前端应用
│   ├── app/              # App Router页面
│   ├── components/       # React组件
│   ├── lib/              # 工具库
│   └── config/           # 配置文件
├── backend/              # Nest.js后端应用
│   ├── src/
│   │   ├── modules/     # 功能模块
│   │   ├── common/      # 公共模块
│   │   ├── database/    # 数据库
│   │   └── config/      # 配置
│   └── test/            # 测试文件
├── _bmad/               # BMAD工作流文件
├── _bmad-output/        # 项目文档和规格
├── docker-compose.yml   # Docker配置
└── Makefile             # 开发命令
```

## 开发命令

```bash
make help          # 显示所有可用命令
make install       # 安装依赖
make dev           # 启动开发环境（显示指引）
make dev-frontend  # 启动前端
make dev-backend   # 启动后端
make db-up         # 启动数据库
make db-down       # 停止数据库
make db-reset      # 重置数据库
make clean         # 清理构建文件
```

## 文档

详细文档位于 `_bmad-output/` 目录：
- `mvp-specification.md` - MVP功能规格
- `prd.md` - 产品需求文档
- `ux-design-specification.md` - UX设计规范
- `tech-spec-phase1-foundation.md` - Phase 1技术规格

## 开发规范

### 前端
- 组件: PascalCase (`ProjectCard.tsx`)
- 文件夹: kebab-case (`project-details/`)
- 函数: camelCase (`fetchProjects()`)
- 常量: UPPER_SNAKE_CASE (`MAX_FILE_SIZE`)

### 后端
- 模块: feature.module.ts
- 控制器: feature.controller.ts
- 服务: feature.service.ts
- DTO: kebab-case.dto.ts

## License

Private - All Rights Reserved

## 联系方式

- 项目地址: https://github.com/lijiesonggz-sketch/csaas
- 问题反馈: https://github.com/lijiesonggz-sketch/csaas/issues

---

⚡ Powered by AI & Modern Web Technologies
