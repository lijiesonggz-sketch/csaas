# 手工验证工具使用说明

本目录包含了 Story 6.2 和 6.3 的手工验证工具和文档。

## 📁 文件说明

| 文件 | 说明 |
|------|------|
| `MANUAL_TESTING_GUIDE.md` | 详细的手工验证指南，包含所有测试场景 |
| `quick-test.bat` | Windows 快速验证脚本 |
| `quick-test.sh` | Linux/Mac 快速验证脚本 |
| `setup-test-data.sql` | 测试数据初始化 SQL 脚本 |

## 🚀 快速开始

### 步骤 1: 准备环境

确保以下服务已启动：
- ✅ PostgreSQL (端口 5432)
- ✅ Redis (端口 6379)
- ✅ 后端服务 (端口 3000)

```bash
# 启动后端服务
cd backend
npm run start:dev
```

### 步骤 2: 初始化测试数据

```bash
# 使用 psql 执行 SQL 脚本
psql -U postgres -d csaas -f setup-test-data.sql

# 或者手动执行 SQL
# 打开 setup-test-data.sql 文件，复制 SQL 语句到数据库工具中执行
```

**重要**: 需要生成正确的密码哈希：

```bash
# 生成密码哈希 (密码: admin123)
node -e "console.log(require('bcrypt').hashSync('admin123', 10))"

# 将生成的哈希值替换到 setup-test-data.sql 中的 password_hash 字段
```

### 步骤 3: 运行快速验证

**Windows:**
```cmd
quick-test.bat
```

**Linux/Mac:**
```bash
chmod +x quick-test.sh
./quick-test.sh
```

### 步骤 4: 查看详细验证指南

打开 `MANUAL_TESTING_GUIDE.md` 查看完整的验证步骤和测试场景。

## 📋 验证清单

### Story 6.2: 客户管理

- [ ] 获取客户列表
- [ ] 创建新客户
- [ ] 获取客户详情
- [ ] 更新客户信息
- [ ] 批量配置客户
- [ ] 创建客户分组
- [ ] 添加客户到分组
- [ ] 获取统计信息
- [ ] 多租户隔离验证

### Story 6.3: 白标输出

- [ ] 获取品牌配置
- [ ] 更新品牌配置
- [ ] 公开品牌接口（无需认证）
- [ ] 重置品牌配置
- [ ] 品牌配置持久化

## 🔧 手工 API 测试

如果自动化脚本无法运行，可以使用以下工具手工测试：

### 使用 curl

```bash
# 1. 登录
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin123"}'

# 2. 保存 token
export TOKEN="your_token_here"

# 3. 测试 API
curl -X GET http://localhost:3000/api/v1/admin/clients \
  -H "Authorization: Bearer $TOKEN"
```

### 使用 Postman

1. 导入 API 端点到 Postman
2. 设置环境变量:
   - `baseUrl`: http://localhost:3000
   - `token`: (登录后获取)
3. 按照 `MANUAL_TESTING_GUIDE.md` 中的步骤测试

### 使用 Swagger UI

访问: http://localhost:3000/api

在 Swagger UI 中可以直接测试所有 API 端点。

## 🐛 常见问题

### Q: 服务器未运行

**解决方法:**
```bash
cd backend
npm run start:dev
```

### Q: 登录失败 (401)

**可能原因:**
1. 管理员用户未创建
2. 密码哈希不正确
3. JWT_SECRET 配置错误

**解决方法:**
```bash
# 重新生成密码哈希
node -e "console.log(require('bcrypt').hashSync('admin123', 10))"

# 更新数据库中的密码
UPDATE users SET password_hash = '新的哈希值' WHERE email = 'admin@test.com';
```

### Q: API 返回 404

**可能原因:**
1. 路由未正确注册
2. 模块未导入到 AppModule

**解决方法:**
检查 `backend/src/app.module.ts` 是否导入了 `AdminModule`

### Q: 数据库连接失败

**解决方法:**
检查 `backend/.env.development` 文件中的数据库配置：
```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=csaas
```

## 📊 验证报告

验证完成后，请记录结果：

| 功能 | 状态 | 备注 |
|------|------|------|
| 客户列表 | ✅/❌ | |
| 创建客户 | ✅/❌ | |
| 客户详情 | ✅/❌ | |
| 批量配置 | ✅/❌ | |
| 客户分组 | ✅/❌ | |
| 品牌配置 | ✅/❌ | |
| 公开接口 | ✅/❌ | |

## 📞 支持

如果遇到问题，请查看：
1. 后端日志: `backend/server.log`
2. 数据库日志
3. 浏览器控制台 (前端问题)

---

**最后更新**: 2026-02-03
