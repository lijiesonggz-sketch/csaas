# Csaas Backend

AI驱动的IT咨询成熟度评估SaaS平台 - 后端API服务

## 技术栈

- **框架**: Nest.js 10
- **语言**: TypeScript
- **数据库**: PostgreSQL 15
- **ORM**: TypeORM
- **缓存/队列**: Redis + BullMQ
- **实时通信**: Socket.IO
- **日志**: Winston
- **监控**: Sentry

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 到 `.env.development`:

```bash
cp .env.example .env.development
```

### 启动数据库（Docker）

```bash
docker-compose up -d
```

### 运行数据库迁移

```bash
npm run migration:run
```

### 启动开发服务器

```bash
npm run start:dev
```

访问 [http://localhost:3001/health](http://localhost:3001/health)

## 项目结构

```
/src
  /modules           # 功能模块
    /auth           # 认证模块
    /projects       # 项目管理
    /tasks          # 任务管理
    /ai-orchestrator # AI编排器
  /common           # 公共模块
    /decorators     # 装饰器
    /filters        # 过滤器
    /interceptors   # 拦截器
    /pipes          # 管道
  /database         # 数据库
    /entities       # 实体
    /migrations     # 迁移
  /config           # 配置
  main.ts           # 入口文件
  app.module.ts     # 根模块
```

## 开发命令

```bash
npm run start:dev       # 启动开发服务器（热重载）
npm run build           # 构建生产版本
npm run start:prod      # 启动生产服务器
npm run lint            # 运行ESLint检查
npm run format          # 格式化代码
npm run test            # 运行单元测试
npm run test:e2e        # 运行端到端测试
npm run migration:generate # 生成迁移文件
npm run migration:run   # 运行迁移
npm run migration:revert # 回滚迁移
```

## API文档

启动开发服务器后访问: `http://localhost:3001/api/docs` (Swagger)

## License

Private
