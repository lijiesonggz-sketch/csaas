# 数据库连接问题诊断报告

**日期**: 2026-01-27
**问题**: ECONNRESET - 数据库连接被重置

---

## 🔍 问题诊断

### 错误信息
```
Error: read ECONNRESET
Error code: ECONNRESET
```

### 可能的原因

1. **PostgreSQL服务未运行** ⭐ 最可能
   - Windows服务中的PostgreSQL服务可能已停止
   - 或者PostgreSQL从未启动

2. **端口冲突**
   - 5432端口被其他程序占用
   - PostgreSQL监听在不同的端口

3. **防火墙阻止**
   - Windows防火墙阻止了localhost连接
   - 杀毒软件阻止了数据库连接

4. **PostgreSQL配置问题**
   - pg_hba.conf配置不允许本地连接
   - postgresql.conf中listen_addresses配置错误

---

## ✅ 解决方案

### 方案1：启动PostgreSQL服务（推荐）

#### Windows系统：

**方法A：使用服务管理器**
1. 按 `Win + R`，输入 `services.msc`，回车
2. 找到 `postgresql-x64-xx` 服务（xx是版本号，如14、15等）
3. 右键点击 → 启动
4. 设置启动类型为"自动"（避免下次重启后需要手动启动）

**方法B：使用命令行（管理员权限）**
```cmd
# 查看PostgreSQL服务状态
sc query postgresql-x64-14

# 启动PostgreSQL服务
net start postgresql-x64-14

# 或者使用pg_ctl（如果安装了PostgreSQL命令行工具）
pg_ctl start -D "C:\Program Files\PostgreSQL\14\data"
```

**方法C：使用pgAdmin**
1. 打开pgAdmin
2. 右键点击服务器 → 连接
3. 如果无法连接，检查服务是否运行

---

### 方案2：检查端口占用

```cmd
# 检查5432端口是否被占用
netstat -ano | findstr :5432

# 如果端口被占用，查看是哪个进程
tasklist | findstr <PID>
```

如果5432端口被其他程序占用：
- 选项A：停止占用端口的程序
- 选项B：修改PostgreSQL端口（不推荐）

---

### 方案3：检查PostgreSQL安装

如果PostgreSQL未安装或安装不完整：

**下载PostgreSQL**
- 官网：https://www.postgresql.org/download/windows/
- 推荐版本：PostgreSQL 14 或 15

**安装步骤**
1. 下载安装程序
2. 运行安装程序
3. 设置密码（建议使用 `postgres`，与.env配置一致）
4. 端口保持默认 `5432`
5. 完成安装后，服务会自动启动

---

### 方案4：使用Docker运行PostgreSQL（替代方案）

如果不想安装PostgreSQL，可以使用Docker：

```bash
# 拉取PostgreSQL镜像
docker pull postgres:14

# 运行PostgreSQL容器
docker run --name csaas-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=csaas \
  -p 5432:5432 \
  -d postgres:14

# 检查容器状态
docker ps

# 查看日志
docker logs csaas-postgres
```

---

## 🧪 验证修复

修复后，运行以下命令验证连接：

```bash
cd backend
node test-db-connection.js
```

**期望输出**：
```
✅ Database connection successful!
PostgreSQL version: PostgreSQL 14.x on x86_64-pc-windows-msvc...

📊 Existing tables:
  - organizations
  - users
  - projects
  - ...
```

---

## 🚀 修复后的下一步

一旦数据库连接成功：

### 1. 运行Migration
```bash
cd backend
npm run migration:run
```

**期望输出**：
```
query: SELECT * FROM "migrations" ...
8 migrations are already loaded in the database.
1 migrations were found in the source code.
1 migrations are new migrations that needs to be executed.

query: START TRANSACTION
Migration CreateRadarInfrastructure1738000000000 has been executed successfully.
query: COMMIT
```

### 2. 验证表创建
```bash
node test-db-connection.js
```

应该看到新增的表：
- tags
- watched_items
- raw_contents
- analyzed_contents
- content_tags
- radar_pushes
- push_schedule_configs
- crawler_logs

### 3. 验证编译
```bash
npm run build
```

### 4. 启动开发服务器
```bash
npm run start:dev
```

---

## 📝 常见问题

### Q1: 找不到PostgreSQL服务
**A**: 可能PostgreSQL未安装或安装路径不在系统PATH中
- 检查 `C:\Program Files\PostgreSQL\` 目录是否存在
- 如果不存在，需要重新安装PostgreSQL

### Q2: 服务启动失败
**A**: 可能是端口冲突或数据目录损坏
- 检查Windows事件查看器中的错误日志
- 查看PostgreSQL日志：`C:\Program Files\PostgreSQL\14\data\log\`

### Q3: 密码错误
**A**: .env中的密码与PostgreSQL实际密码不匹配
- 修改.env中的DB_PASSWORD
- 或者重置PostgreSQL密码

### Q4: 数据库不存在
**A**: csaas数据库未创建
```sql
-- 使用pgAdmin或psql创建数据库
CREATE DATABASE csaas;
```

---

## 📞 需要帮助？

如果以上方案都无法解决问题，请提供以下信息：

1. Windows版本
2. PostgreSQL是否已安装？版本是多少？
3. 运行 `services.msc` 后，是否能看到PostgreSQL服务？
4. 运行 `netstat -ano | findstr :5432` 的输出
5. PostgreSQL日志文件内容（如果有）

---

**生成时间**: 2026-01-27
**状态**: 等待用户修复数据库连接

