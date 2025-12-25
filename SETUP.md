# Csaas 快速启动指南

## ✅ 已完成的准备工作

1. ✅ 前端项目已初始化（508个npm包已安装）
2. ✅ 后端项目已初始化（941个npm包已安装）
3. ✅ 数据库Schema已设计（6个核心实体）
4. ✅ 认证系统基础已实现
5. ✅ Docker配置文件已创建
6. ✅ 环境变量文件已创建

## 🚀 下一步操作

### 1. 启动Docker Desktop

**Windows用户**：
- 打开 Docker Desktop 应用
- 等待Docker引擎启动完成（右下角图标变绿）

**验证Docker是否运行**：
```bash
docker --version
docker ps
```

### 2. 启动数据库服务

在项目根目录运行：
```bash
docker compose up -d
```

验证数据库启动：
```bash
docker compose ps
```

应该看到：
- csaas-postgres (running)
- csaas-redis (running)

### 3. 配置AI API密钥（可选）

编辑 `backend/.env.development`，填写你的API密钥：
```env
OPENAI_API_KEY=sk-your-real-key
ANTHROPIC_API_KEY=sk-ant-your-real-key
TONGYI_API_KEY=your-real-key
```

**注意**：如果暂时没有API密钥，可以先跳过，后端仍可启动。

### 4. 启动后端服务

**终端1** - 后端：
```bash
cd backend
npm run start:dev
```

等待看到：
```
🚀 Backend server running on http://localhost:3001
```

测试健康检查：
```bash
curl http://localhost:3001/health
```

应该返回：
```json
{
  "status": "ok",
  "timestamp": "...",
  "service": "csaas-backend"
}
```

### 5. 启动前端服务

**终端2** - 前端：
```bash
cd frontend
npm run dev
```

等待看到：
```
✓ Ready in 3.2s
Local:   http://localhost:3000
```

打开浏览器访问：http://localhost:3000

## 📋 当前可用的功能

### 后端API
- `GET /health` - 健康检查
- `POST /auth/register` - 用户注册
- `POST /auth/login` - 用户登录

### 前端页面
- `/` - 首页
- `/login` - 登录（占位页面）
- `/register` - 注册（占位页面）

## 🐛 常见问题

### Docker启动失败
**问题**：`docker: command not found`
**解决**：确保Docker Desktop已安装并运行

### 端口被占用
**问题**：`Port 3001 is already in use`
**解决**：
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# 或修改 backend/.env.development 中的 PORT=3002
```

### 数据库连接失败
**问题**：`Connection refused` 或 `ECONNREFUSED`
**解决**：
1. 确认Docker容器运行：`docker compose ps`
2. 重启数据库：`docker compose restart postgres`
3. 检查端口：`netstat -ano | findstr :5432`

## 📊 项目状态

当前进度：**Phase 1 Week 2 完成 - 基础设施搭建（100%）**

✅ Week 1-2 已完成：
- ✅ 项目脚手架（前后端）
- ✅ Git仓库 + 代码规范（Husky + Commitlint）
- ✅ 数据库设计 + Migration（6张核心表）
- ✅ Docker环境（PostgreSQL + Redis 运行中）
- ✅ NextAuth.js认证系统
- ✅ 基础UI组件库（Layout + Dashboard）
- ✅ 数据库Migration执行成功

⏳ Week 3-4 待完成：
- ⏳ BullMQ任务队列
- ⏳ AI API客户端封装
- ⏳ AI Orchestrator核心逻辑
- ⏳ WebSocket实时推送
- ⏳ 成本监控与告警

## 📞 需要帮助？

如果遇到问题，告诉我：
1. 具体的错误信息
2. 运行的命令
3. 使用的操作系统

我会帮你解决！
