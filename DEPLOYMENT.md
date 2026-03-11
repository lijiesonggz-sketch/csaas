# CSAAS 部署指南

## 方案 A：Railway 部署（推荐）

### 准备工作

1. 注册 Railway 账号：https://railway.app
2. 连接 GitHub 账号
3. 准备 AI API Keys（OpenAI、Claude、通义千问等）

### 部署步骤

#### 1. 部署后端 + 数据库

1. 登录 Railway，点击 "New Project"
2. 选择 "Deploy from GitHub repo"
3. 选择 `lijiesonggz-sketch/csaas` 仓库
4. 选择 `backend` 目录
5. Railway 会自动检测 Dockerfile 并开始构建

#### 2. 添加 PostgreSQL 数据库

1. 在项目中点击 "New"
2. 选择 "Database" → "PostgreSQL"
3. Railway 会自动创建数据库并生成连接信息

#### 3. 添加 Redis

1. 在项目中点击 "New"
2. 选择 "Database" → "Redis"
3. Railway 会自动创建 Redis 实例

#### 4. 配置后端环境变量

在后端服务的 "Variables" 标签页添加：

```bash
# 数据库（Railway 自动注入，无需手动配置）
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# AI API Keys
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1

ANTHROPIC_API_KEY=sk-ant-...

TONGYI_API_KEY=sk-...
TONGYI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

ZHIPU_API_KEY=...
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4

# CORS（前端域名，部署后填写）
CORS_ORIGIN=https://your-frontend.vercel.app

# 其他配置
NODE_ENV=production
PORT=3000
```

#### 5. 运行数据库迁移

在 Railway 后端服务的 "Settings" → "Deploy" 中添加：

```bash
# Build Command（保持默认）
npm run build

# Start Command
npm run migration:run && node dist/main
```

#### 6. 部署前端到 Vercel

1. 登录 Vercel：https://vercel.com
2. 点击 "Add New" → "Project"
3. 导入 `lijiesonggz-sketch/csaas` 仓库
4. 配置：
   - Framework Preset: Next.js
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `.next`

5. 添加环境变量：

```bash
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXTAUTH_URL=https://your-frontend.vercel.app
NEXTAUTH_SECRET=your-nextauth-secret-key
```

6. 点击 "Deploy"

#### 7. 更新 CORS 配置

前端部署完成后，回到 Railway 后端服务，更新 `CORS_ORIGIN` 为 Vercel 提供的域名。

---

## 方案 B：阿里云/腾讯云服务器部署

### 准备工作

1. 购买轻量应用服务器（2核4G，¥50-100/月）
2. 安装 Docker 和 Docker Compose
3. 配置域名和 SSL 证书

### 部署步骤

#### 1. 连接服务器

```bash
ssh root@your-server-ip
```

#### 2. 安装 Docker

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | bash

# 启动 Docker
systemctl start docker
systemctl enable docker

# 安装 Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

#### 3. 克隆代码

```bash
cd /opt
git clone https://github.com/lijiesonggz-sketch/csaas.git
cd csaas
```

#### 4. 创建 docker-compose.yml

（见项目根目录的 docker-compose.yml）

#### 5. 配置环境变量

```bash
# 复制环境变量模板
cp backend/.env.example backend/.env.production
cp frontend/.env.example frontend/.env.production

# 编辑配置
vim backend/.env.production
vim frontend/.env.production
```

#### 6. 启动服务

```bash
docker-compose up -d
```

#### 7. 配置 Nginx 反向代理

```bash
# 安装 Nginx
apt install nginx -y

# 配置反向代理（见下方配置文件）
vim /etc/nginx/sites-available/csaas
```

#### 8. 配置 SSL 证书

```bash
# 安装 Certbot
apt install certbot python3-certbot-nginx -y

# 获取证书
certbot --nginx -d your-domain.com
```

---

## 方案 C：Railway 全托管

与方案 A 类似，但前端也部署在 Railway：

1. 在 Railway 项目中添加新服务
2. 选择 `frontend` 目录
3. 配置环境变量
4. 部署

---

## 成本对比

| 方案 | 月成本 | 适合场景 |
|------|--------|----------|
| Railway + Vercel | $0-20 | 测试、小流量 |
| 阿里云轻量服务器 | ¥50-200 | 国内用户、中等流量 |
| Railway 全托管 | $5-30 | 国际用户、快速部署 |

---

## 常见问题

### Q: Railway 免费额度够用吗？
A: 每月 $5 免费额度，适合测试和小流量项目。超出后按使用量计费。

### Q: 数据库在国外会不会很慢？
A: Railway 数据库在美国，国内访问延迟约 200-300ms。如果对速度要求高，建议用阿里云。

### Q: 如何绑定自定义域名？
A: Railway 和 Vercel 都支持自定义域名，在项目设置中添加即可。

### Q: 如何查看日志？
A: Railway 和 Vercel 都提供实时日志查看功能，在控制台即可查看。

---

## 下一步

部署完成后，建议：

1. 配置监控告警（Sentry、Railway Metrics）
2. 设置自动备份（数据库）
3. 配置 CDN 加速（Cloudflare）
4. 添加 CI/CD 自动部署
