# Story 3.1 - 手动测试指南

本指南提供了对信息源配置管理功能进行手动测试的详细步骤。

---

## 前置条件

1. ✅ 后端服务运行在 http://localhost:3000
2. ✅ PostgreSQL数据库运行并已创建radar_sources表
3. ✅ 已导入默认数据（7条信息源）
4. ⚠️ 需要CONSULTANT角色的JWT token进行API测试

---

## 测试1: 查看数据库数据

### 使用提供的查询脚本

```bash
cd D:\csaas\backend
node query-radar-sources.js
```

### 预期结果

应该看到7条信息源数据，按类别分组：
- 合规雷达 (compliance): 2条
- 行业雷达 (industry): 2条
- 技术雷达 (tech): 3条

---

## 测试2: 健康检查

### 测试命令

```bash
curl http://localhost:3000/health
```

### 预期结果

```json
{
  "status": "ok",
  "info": { ... },
  "details": { ... }
}
```

状态码: 200

---

## 测试3: API端点认证测试

### 测试命令（无认证）

```bash
curl http://localhost:3000/admin/radar-sources
```

### 预期结果

```json
{
  "message": "Unauthorized",
  "statusCode": 401
}
```

这证明API端点存在且正确要求认证。

---

## 测试4: 获取JWT Token（需要先创建测试用户）

### 步骤1: 创建测试用户

如果还没有CONSULTANT角色的用户，需要先创建：

```sql
-- 连接到数据库
psql -U postgres -d csaas

-- 创建测试用户（如果不存在）
INSERT INTO users (email, password, role, name)
VALUES (
  'admin@test.com',
  '$2b$10$YourHashedPasswordHere', -- 需要使用bcrypt加密
  'CONSULTANT',
  'Test Admin'
);
```

### 步骤2: 登录获取Token

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "your_password"
  }'
```

### 预期结果

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "admin@test.com",
    "role": "CONSULTANT"
  }
}
```

保存`access_token`用于后续测试。

---

## 测试5: 获取所有信息源

### 测试命令

```bash
curl http://localhost:3000/admin/radar-sources \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 预期结果

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "source": "GARTNER",
      "category": "tech",
      "url": "https://www.gartner.com/en/newsroom",
      "type": "website",
      "isActive": true,
      "crawlSchedule": "0 2 * * *",
      "lastCrawlStatus": "pending",
      "createdAt": "...",
      "updatedAt": "..."
    },
    // ... 更多数据
  ],
  "total": 7
}
```

状态码: 200

---

## 测试6: 按类别过滤

### 测试命令

```bash
# 获取技术雷达信息源
curl "http://localhost:3000/admin/radar-sources?category=tech" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# 获取行业雷达信息源
curl "http://localhost:3000/admin/radar-sources?category=industry" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# 获取合规雷达信息源
curl "http://localhost:3000/admin/radar-sources?category=compliance" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 预期结果

每个请求应该只返回对应类别的信息源。

---

## 测试7: 获取单个信息源

### 测试命令

```bash
# 使用实际的ID（从测试5的结果中获取）
curl http://localhost:3000/admin/radar-sources/96aab901-12b3-4590-bf73-f4eaa0951f97 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 预期结果

```json
{
  "success": true,
  "data": {
    "id": "96aab901-12b3-4590-bf73-f4eaa0951f97",
    "source": "GARTNER",
    "category": "tech",
    // ... 完整数据
  }
}
```

状态码: 200

---

## 测试8: 创建新信息源

### 测试命令

```bash
curl -X POST http://localhost:3000/admin/radar-sources \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "测试信息源",
    "category": "tech",
    "url": "https://example.com/test",
    "type": "website",
    "isActive": true,
    "crawlSchedule": "0 3 * * *"
  }'
```

### 预期结果

```json
{
  "success": true,
  "data": {
    "id": "新生成的UUID",
    "source": "测试信息源",
    "category": "tech",
    "url": "https://example.com/test",
    "type": "website",
    "isActive": true,
    "crawlSchedule": "0 3 * * *",
    "lastCrawlStatus": "pending",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "message": "Radar source created successfully"
}
```

状态码: 201

保存返回的`id`用于后续测试。

---

## 测试9: 更新信息源

### 测试命令

```bash
curl -X PUT http://localhost:3000/admin/radar-sources/YOUR_NEW_ID \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "更新后的测试信息源",
    "url": "https://example.com/updated",
    "isActive": false
  }'
```

### 预期结果

```json
{
  "success": true,
  "data": {
    "id": "YOUR_NEW_ID",
    "source": "更新后的测试信息源",
    "url": "https://example.com/updated",
    "isActive": false,
    // ... 其他字段
  },
  "message": "Radar source updated successfully"
}
```

状态码: 200

---

## 测试10: 切换启用状态

### 测试命令

```bash
curl -X PATCH http://localhost:3000/admin/radar-sources/YOUR_NEW_ID/toggle \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 预期结果

```json
{
  "success": true,
  "data": {
    "id": "YOUR_NEW_ID",
    "isActive": true, // 从false切换到true
    // ... 其他字段
  },
  "message": "Radar source enabled successfully"
}
```

状态码: 200

再次调用应该切换回false。

---

## 测试11: 获取统计信息

### 测试命令

```bash
curl http://localhost:3000/admin/radar-sources/stats/by-category \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 预期结果

```json
{
  "success": true,
  "data": {
    "tech": {
      "total": 4,
      "active": 3,
      "inactive": 1
    },
    "industry": {
      "total": 2,
      "active": 2,
      "inactive": 0
    },
    "compliance": {
      "total": 2,
      "active": 2,
      "inactive": 0
    }
  }
}
```

状态码: 200

---

## 测试12: 测试爬虫

### 测试命令

```bash
curl -X POST http://localhost:3000/admin/radar-sources/YOUR_NEW_ID/test-crawl \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 预期结果

```json
{
  "success": true,
  "data": {
    "sourceId": "YOUR_NEW_ID",
    "source": "测试信息源",
    "url": "https://example.com/test",
    "status": "test_pending",
    "message": "Test crawl job has been queued"
  }
}
```

状态码: 200

注意: 当前实现返回模拟响应，实际爬虫功能需要进一步实现。

---

## 测试13: 删除信息源

### 测试命令

```bash
curl -X DELETE http://localhost:3000/admin/radar-sources/YOUR_NEW_ID \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 预期结果

```json
{
  "success": true,
  "message": "Radar source deleted successfully"
}
```

状态码: 204 或 200

验证删除成功：

```bash
curl http://localhost:3000/admin/radar-sources/YOUR_NEW_ID \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

应该返回404 Not Found。

---

## 测试14: 数据验证测试

### 测试14.1: 缺少必填字段

```bash
curl -X POST http://localhost:3000/admin/radar-sources \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "测试"
  }'
```

**预期结果**: 400 Bad Request，包含验证错误信息

### 测试14.2: 无效的URL

```bash
curl -X POST http://localhost:3000/admin/radar-sources \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "测试信息源",
    "category": "tech",
    "url": "not-a-valid-url",
    "type": "website"
  }'
```

**预期结果**: 400 Bad Request，URL验证失败

### 测试14.3: 无效的枚举值

```bash
curl -X POST http://localhost:3000/admin/radar-sources \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "测试信息源",
    "category": "invalid_category",
    "url": "https://example.com",
    "type": "website"
  }'
```

**预期结果**: 400 Bad Request，category枚举验证失败

### 测试14.4: 无效的Cron表达式

```bash
curl -X POST http://localhost:3000/admin/radar-sources \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "测试信息源",
    "category": "tech",
    "url": "https://example.com",
    "type": "website",
    "crawlSchedule": "invalid cron"
  }'
```

**预期结果**: 400 Bad Request，cron表达式验证失败

---

## 测试15: 爬虫集成验证

### 检查爬虫队列配置

查看后端日志，应该看到类似以下的日志：

```
[RadarModule] Setting up crawler jobs from database: 7 sources
[RadarModule] Scheduled crawler job: GARTNER (tech) - 0 2 * * *
[RadarModule] Scheduled crawler job: 信通院 (tech) - 0 2 * * *
[RadarModule] Scheduled crawler job: IDC (tech) - 0 2 * * *
[RadarModule] Scheduled crawler job: 杭州银行金融科技 (industry) - 0 3 * * *
[RadarModule] Scheduled crawler job: 拉勾网-金融机构招聘 (industry) - 0 4 * * *
[RadarModule] Scheduled crawler job: 中国人民银行 (compliance) - 0 5 * * *
[RadarModule] Scheduled crawler job: 银保监会 (compliance) - 0 5 * * *
[RadarModule] Crawler jobs configured successfully
```

这证明爬虫调度器正确读取了数据库配置。

---

## 测试16: 向后兼容性测试

### 测试场景: 数据库为空

1. 清空radar_sources表：
```sql
DELETE FROM radar_sources;
```

2. 重启后端服务

3. 检查日志，应该看到：
```
[RadarModule] No sources found in database, using default configuration
[RadarModule] Scheduled default crawler jobs
```

4. 验证默认配置生效（3个技术雷达信息源）

5. 恢复数据：
```bash
cd D:\csaas\backend
npx ts-node scripts/seed-radar-sources.ts
```

---

## 测试清单

使用以下清单跟踪测试进度：

- [ ] 测试1: 查看数据库数据
- [ ] 测试2: 健康检查
- [ ] 测试3: API端点认证测试
- [ ] 测试4: 获取JWT Token
- [ ] 测试5: 获取所有信息源
- [ ] 测试6: 按类别过滤
- [ ] 测试7: 获取单个信息源
- [ ] 测试8: 创建新信息源
- [ ] 测试9: 更新信息源
- [ ] 测试10: 切换启用状态
- [ ] 测试11: 获取统计信息
- [ ] 测试12: 测试爬虫
- [ ] 测试13: 删除信息源
- [ ] 测试14.1: 缺少必填字段验证
- [ ] 测试14.2: 无效URL验证
- [ ] 测试14.3: 无效枚举值验证
- [ ] 测试14.4: 无效Cron表达式验证
- [ ] 测试15: 爬虫集成验证
- [ ] 测试16: 向后兼容性测试

---

## 常见问题

### Q1: 如何获取JWT Token？

A: 需要先创建一个CONSULTANT角色的用户，然后通过`/auth/login`端点登录获取token。

### Q2: API路径是 /api/admin/radar-sources 还是 /admin/radar-sources？

A: 正确的路径是 `/admin/radar-sources`（没有/api前缀）。

### Q3: 如何重置测试数据？

A:
```sql
DELETE FROM radar_sources;
```
然后运行seed脚本：
```bash
npx ts-node scripts/seed-radar-sources.ts
```

### Q4: 测试爬虫功能返回模拟响应？

A: 是的，当前`/test-crawl`端点返回模拟响应。实际的爬虫执行需要进一步实现。

---

## 辅助工具

### 查询数据库脚本

```bash
cd D:\csaas\backend
node query-radar-sources.js
```

### 运行完整自动化测试

```bash
cd D:\csaas\backend
node test-radar-sources-complete.js
```

### 重新导入默认数据

```bash
cd D:\csaas\backend
npx ts-node scripts/seed-radar-sources.ts
```

---

## 测试报告

完成测试后，请记录：

1. 所有测试的通过/失败状态
2. 发现的任何问题或bug
3. 性能观察（响应时间等）
4. 改进建议

---

**文档版本**: 1.0
**最后更新**: 2026-01-29
