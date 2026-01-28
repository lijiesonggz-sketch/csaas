# 🏗️ CSAAS 端口架构说明

**更新日期**: 2026-01-26

---

## 📊 当前端口配置

### 标准开发环境

| 服务 | 技术栈 | 端口 | URL | 用途 |
|------|--------|------|-----|------|
| **后端 API** | NestJS | `3000` | http://localhost:3000 | REST API 服务器 |
| **前端 Web** | Next.js | `3001` | http://localhost:3001 | 用户界面 |

---

## 🚀 启动顺序

### 1️⃣ 启动后端 (API 服务器)

```bash
cd backend
npm run start:dev
```

✅ **确认启动成功**:
- 看到: `Nest application successfully started`
- 看到: `Backend server running on http://localhost:3000`
- 访问: http://localhost:3000/health 应该返回健康状态

**提供的服务**:
- `/organizations/*` - 组织管理 API
- `/projects/*` - 项目管理 API
- `/auth/*` - 认证 API
- 等等...

---

### 2️⃣ 启动前端 (Web 界面)

```bash
cd frontend
npm run dev
```

✅ **确认启动成功**:
- 看到: `ready - started server on 0.0.0.0:3001`
- 看到: `- Local: http://localhost:3001`

**提供的服务**:
- `/projects` - 项目列表和详情
- `/radar` - Radar Service 主页
- `/survey/*` - 问卷相关页面
- 等等...

---

## 🌐 访问指南

### ✅ 正确的访问方式

**旧版本 (标准对标)**:
```
http://localhost:3001/projects
```

**新版本 (Radar Service)**:
```
http://localhost:3001/radar?orgId=test-org
```

**其他页面**:
```
http://localhost:3001/projects/{projectId}       - 项目详情
http://localhost:3001/radar/tech                  - 技术雷达
http://localhost:3001/radar/industry              - 行业雷达
http://localhost:3001/radar/compliance            - 合规雷达
```

---

## ⚠️ 常见错误

### ❌ 错误 1: 访问了后端端口

```bash
# ❌ 错误 - 这是后端端口，不提供 Web 界面
http://localhost:3000/radar

# ✅ 正确 - 访问前端端口
http://localhost:3001/radar?orgId=test-org
```

**症状**:
- 看到原始 JSON 响应
- 看到 `Cannot GET /radar` 404 错误
- 页面显示不了

---

### ❌ 错误 2: 前端无法连接后端

**症状**: 前端页面加载，但 API 请求失败

**检查**:
1. 后端是否在运行? 访问 http://localhost:3000/health
2. 查看浏览器控制台 (F12) 的 Network 标签
3. 查看 CORS 错误

**解决**:
```bash
# 确保两个服务器都在运行
# 终端 1: 后端
cd backend && npm run start:dev

# 终端 2: 前端
cd frontend && npm run dev
```

---

### ❌ 错误 3: 端口被占用

**症状**:
```
Error: listen EADDRINUSE: address already in use :::3000
```

**解决**:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID {进程ID} /F

# 或使用其他端口
PORT=3002 npm run start:dev
```

---

## 🔍 架构图

```
┌─────────────────────────────────────────────────────┐
│                                                   │
│  浏览器                                            │
│  http://localhost:3001/radar?orgId=test-org       │
│                                                   │
└────────────────┬────────────────────────────────────┘
                 │
                 │ HTTP 请求
                 ▼
┌─────────────────────────────────────────────────────┐
│                                                   │
│  前端 (Next.js) - 端口 3001                       │
│  - 渲染 React 组件                                │
│  - 处理用户交互                                    │
│  - 管理路由                                        │
│                                                   │
└────────────────┬────────────────────────────────────┘
                 │
                 │ API 调用 (fetch/axios)
                 ▼
┌─────────────────────────────────────────────────────┐
│                                                   │
│  后端 (NestJS) - 端口 3000                        │
│  - REST API                                        │
│  - 数据库操作                                      │
│  - 业务逻辑                                        │
│                                                   │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
           PostgreSQL 数据库
```

---

## 📝 配置文件

### 后端端口配置

**文件**: `backend/src/main.ts`
```typescript
const port = process.env.PORT || 3000
await app.listen(port)
```

**修改端口**:
```bash
# 方式 1: 环境变量
PORT=3002 npm run start:dev

# 方式 2: .env 文件
echo "PORT=3002" >> backend/.env
```

---

### 前端端口配置

**文件**: `frontend/package.json`
```json
{
  "scripts": {
    "dev": "next dev -p 3001",
    "start": "next start -p 3001"
  }
}
```

**修改端口**:
```bash
# 编辑 package.json，改为:
"dev": "next dev -p 3002"

# 或临时使用:
PORT=3002 npm run dev
```

---

## 🔧 开发环境 vs 生产环境

### 开发环境 (Development)

```
前端: http://localhost:3001  (Next.js dev server)
后端: http://localhost:3000  (NestJS dev server)
```

特点:
- 热重载 (Hot Reload)
- 详细错误信息
- Source Maps

---

### 生产环境 (Production)

```
前端: http://your-domain.com  (Nginx/CDN)
后端: http://api.your-domain.com  (PM2/Docker)
```

特点:
- 构建优化
- 压缩资源
- 性能优化

---

## 🧪 测试 API

### 测试后端 API (端口 3000)

```bash
# 健康检查
curl http://localhost:3000/health

# 获取组织列表
curl http://localhost:3000/organizations

# 获取雷达状态
curl http://localhost:3000/organizations/test-org/radar-status
```

### 测试前端页面 (端口 3001)

```bash
# 在浏览器打开
http://localhost:3001
http://localhost:3001/projects
http://localhost:3001/radar?orgId=test-org
```

---

## 📞 故障排除

### 问题 1: 前端启动失败

**检查**:
```bash
cd frontend
npm run dev
```

**常见错误**:
- 端口 3001 被占用 → 关闭占用进程或换端口
- 依赖未安装 → 运行 `npm install`
- 编译错误 → 检查 TypeScript 错误

---

### 问题 2: 后端启动失败

**检查**:
```bash
cd backend
npm run start:dev
```

**常见错误**:
- 数据库未连接 → 检查 PostgreSQL 是否运行
- 端口 3000 被占用 → 关闭占用进程
- 环境变量缺失 → 检查 `.env` 文件

---

### 问题 3: API 跨域错误

**症状**: 浏览器控制台显示 CORS 错误

**检查后端 CORS 配置** (`backend/src/main.ts`):
```typescript
app.enableCors({
  origin: [
    'http://localhost:3000',  // ← 确保包含前端端口
    'http://localhost:3001',  // ← 前端端口
  ],
  credentials: true,
})
```

---

## ✅ 快速验证清单

启动前检查:
- [ ] PostgreSQL 数据库正在运行
- [ ] Redis 服务正在运行 (如果使用 BullMQ)
- [ ] 后端环境变量已配置 (.env.development)
- [ ] 前端依赖已安装 (node_modules)

启动后检查:
- [ ] 后端: http://localhost:3000/health 返回 200
- [ ] 前端: http://localhost:3001 可以访问
- [ ] 浏览器控制台无错误
- [ ] 可以正常登录和访问项目

---

## 📚 相关文档

- **手动验证指南**: `MANUAL_VERIFICATION_GUIDE.md`
- **Story 1.4 修复报告**: `STORY_1.4_CODE_REVIEW_FIX_REPORT.md`
- **后端修复报告**: `BACKEND_COMPILATION_FIX_REPORT.md`

---

**记住**: 前端 = 3001，后端 = 3000 🎯
