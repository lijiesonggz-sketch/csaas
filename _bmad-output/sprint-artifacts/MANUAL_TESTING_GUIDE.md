# Story 6.2 & 6.3 手工验证指南

**日期**: 2026-02-03
**状态**: 准备就绪
**测试环境**: 本地开发环境

---

## 前置条件

### 1. 启动服务

```bash
# 启动 PostgreSQL (已启动)
# 启动 Redis (已启动)

# 启动后端服务
cd backend
npm run start:dev

# 启动前端服务 (可选)
cd frontend
npm run dev
```

### 2. 创建测试数据

```bash
# 进入 backend 目录
cd backend

# 使用 psql 或数据库工具执行以下 SQL
```

```sql
-- 1. 创建测试租户
INSERT INTO tenants (id, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'Test Consulting Company')
ON CONFLICT (id) DO NOTHING;

-- 2. 创建管理员用户
INSERT INTO users (id, email, password_hash, name, role, tenant_id, created_at, updated_at)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'admin@test.com',
  '$2b$10$YourHashedPasswordHere', -- 密码: admin123
  'Admin User',
  'admin',
  '11111111-1111-1111-1111-111111111111',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 3. 创建测试客户组织
INSERT INTO organizations (id, name, tenant_id, industry_type, scale, status, contact_person, contact_email, created_at, updated_at)
VALUES
  ('33333333-3333-3333-3333-333333333333', '测试银行A', '11111111-1111-1111-1111-111111111111', 'banking', 'large', 'active', '张三', 'zhangsan@bank-a.com', NOW(), NOW()),
  ('44444444-4444-4444-4444-444444444444', '测试银行B', '11111111-1111-1111-1111-111111111111', 'banking', 'medium', 'trial', '李四', 'lisi@bank-b.com', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
```

---

## Story 6.2: 客户管理后台验证

### API 测试 (使用 curl)

#### 1. 获取 JWT Token

```bash
# 登录获取 token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "admin123"
  }'

# 保存返回的 token
export TOKEN="your_jwt_token_here"
```

#### 2. 获取客户列表

```bash
# 获取所有客户
curl -X GET http://localhost:3000/api/v1/admin/clients \
  -H "Authorization: Bearer $TOKEN" \
  | jq .

# 预期结果: 返回客户列表，包含 name, contactPerson, contactEmail, industryType, scale, status
```

#### 3. 创建新客户

```bash
curl -X POST http://localhost:3000/api/v1/admin/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "新测试银行",
    "contactPerson": "王五",
    "contactEmail": "wangwu@newbank.com",
    "industryType": "banking",
    "scale": "small"
  }' \
  | jq .

# 预期结果: 返回 201，包含新创建的客户信息和 id
```

#### 4. 获取客户详情

```bash
# 使用上一步返回的客户 ID
export CLIENT_ID="客户ID"

curl -X GET http://localhost:3000/api/v1/admin/clients/$CLIENT_ID \
  -H "Authorization: Bearer $TOKEN" \
  | jq .

# 预期结果: 返回客户详细信息，包括统计数据
```

#### 5. 更新客户状态

```bash
curl -X PUT http://localhost:3000/api/v1/admin/clients/$CLIENT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "active"
  }' \
  | jq .

# 预期结果: 返回更新后的客户信息，status 变为 active，activatedAt 有值
```

#### 6. 批量配置客户

```bash
curl -X POST http://localhost:3000/api/v1/admin/clients/bulk-config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationIds": ["33333333-3333-3333-3333-333333333333", "44444444-4444-4444-4444-444444444444"],
    "pushPreferences": {
      "pushStartTime": "09:00:00",
      "pushEndTime": "18:00:00",
      "dailyPushLimit": 10,
      "relevanceFilter": "high_medium"
    }
  }' \
  | jq .

# 预期结果: 返回批量更新的结果
```

#### 7. 创建客户分组

```bash
curl -X POST http://localhost:3000/api/v1/admin/client-groups \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "城商行客户组",
    "description": "所有城市商业银行客户"
  }' \
  | jq .

# 预期结果: 返回 201，包含新创建的分组信息
export GROUP_ID="分组ID"
```

#### 8. 添加客户到分组

```bash
curl -X POST http://localhost:3000/api/v1/admin/client-groups/$GROUP_ID/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationIds": ["33333333-3333-3333-3333-333333333333"]
  }' \
  | jq .

# 预期结果: 返回成功消息
```

#### 9. 获取客户统计

```bash
curl -X GET http://localhost:3000/api/v1/admin/clients/statistics/overview \
  -H "Authorization: Bearer $TOKEN" \
  | jq .

# 预期结果: 返回统计信息
# {
#   "total": 3,
#   "active": 2,
#   "inactive": 0,
#   "trial": 1,
#   "byIndustry": { "banking": 3 },
#   "byScale": { "large": 1, "medium": 1, "small": 1 }
# }
```

---

## Story 6.3: 白标输出功能验证

### API 测试

#### 1. 获取当前品牌配置

```bash
curl -X GET http://localhost:3000/api/v1/admin/branding \
  -H "Authorization: Bearer $TOKEN" \
  | jq .

# 预期结果: 返回当前品牌配置
# {
#   "companyName": "Csaas",
#   "logoUrl": null,
#   "primaryColor": "#1890ff",
#   "secondaryColor": null,
#   "contactEmail": null,
#   "contactPhone": null,
#   "emailSignature": null
# }
```

#### 2. 更新品牌配置

```bash
curl -X PUT http://localhost:3000/api/v1/admin/branding \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "测试咨询公司",
    "logo": "https://example.com/logo.png",
    "themeColor": "#FF6B6B",
    "secondaryColor": "#4ECDC4",
    "contactEmail": "contact@test.com",
    "contactPhone": "400-123-4567",
    "emailSignature": "测试咨询公司 - 专业的技术咨询服务"
  }' \
  | jq .

# 预期结果: 返回更新后的品牌配置
```

#### 3. 获取公开品牌配置 (无需认证)

```bash
# 使用租户 ID
curl -X GET http://localhost:3000/api/v1/tenant/branding?tenantId=11111111-1111-1111-1111-111111111111 \
  | jq .

# 预期结果: 返回品牌配置，无需 token
# {
#   "companyName": "测试咨询公司",
#   "logoUrl": "https://example.com/logo.png",
#   "primaryColor": "#FF6B6B",
#   "secondaryColor": "#4ECDC4"
# }
```

#### 4. 重置品牌配置

```bash
curl -X POST http://localhost:3000/api/v1/admin/branding/reset \
  -H "Authorization: Bearer $TOKEN" \
  | jq .

# 预期结果: 返回默认品牌配置
```

---

## 前端验证 (如果前端已实现)

### 1. 访问客户管理页面

```
http://localhost:3001/admin/clients
```

**验证点**:
- ✅ 显示客户列表表格
- ✅ 可以按状态、行业类型筛选
- ✅ 显示客户数量统计
- ✅ 点击"添加客户"按钮打开表单

### 2. 创建客户

**操作步骤**:
1. 点击"添加客户"按钮
2. 填写表单:
   - 客户名称: 测试客户
   - 联系人: 测试联系人
   - 联系邮箱: test@example.com
   - 行业类型: 银行业
   - 机构规模: 中型
3. 点击"保存"

**验证点**:
- ✅ 表单验证正常（邮箱格式、必填项）
- ✅ 保存成功后显示成功提示
- ✅ 列表自动刷新显示新客户

### 3. 访问品牌配置页面

```
http://localhost:3001/admin/branding
```

**验证点**:
- ✅ 显示品牌配置表单
- ✅ 显示实时预览区域
- ✅ 可以上传 Logo
- ✅ 可以选择主题色（颜色选择器）
- ✅ 可以输入公司信息

### 4. 更新品牌配置

**操作步骤**:
1. 修改公司名称为"我的咨询公司"
2. 选择主题色为红色 (#FF0000)
3. 点击"保存"

**验证点**:
- ✅ 预览区域实时更新
- ✅ 保存成功后显示成功提示
- ✅ 刷新页面后配置保持

---

## 数据库验证

### 检查数据是否正确保存

```sql
-- 1. 检查客户数据
SELECT id, name, contact_person, contact_email, industry_type, scale, status, activated_at
FROM organizations
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
ORDER BY created_at DESC;

-- 2. 检查推送偏好
SELECT o.name, pp.push_start_time, pp.push_end_time, pp.daily_push_limit, pp.relevance_filter
FROM push_preferences pp
JOIN organizations o ON pp.organization_id = o.id
WHERE pp.tenant_id = '11111111-1111-1111-1111-111111111111';

-- 3. 检查客户分组
SELECT * FROM client_groups
WHERE tenant_id = '11111111-1111-1111-1111-111111111111';

-- 4. 检查分组成员
SELECT cg.name as group_name, o.name as client_name
FROM client_group_memberships cgm
JOIN client_groups cg ON cgm.group_id = cg.id
JOIN organizations o ON cgm.organization_id = o.id;

-- 5. 检查品牌配置
SELECT name, brand_config
FROM tenants
WHERE id = '11111111-1111-1111-1111-111111111111';
```

---

## 多租户隔离验证

### 创建第二个租户

```sql
-- 创建第二个租户
INSERT INTO tenants (id, name)
VALUES ('99999999-9999-9999-9999-999999999999', 'Another Company')
ON CONFLICT (id) DO NOTHING;

-- 创建第二个租户的管理员
INSERT INTO users (id, email, password_hash, name, role, tenant_id, created_at, updated_at)
VALUES (
  '88888888-8888-8888-8888-888888888888',
  'admin2@test.com',
  '$2b$10$YourHashedPasswordHere',
  'Admin User 2',
  'admin',
  '99999999-9999-9999-9999-999999999999',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 创建第二个租户的客户
INSERT INTO organizations (id, name, tenant_id, industry_type, created_at, updated_at)
VALUES
  ('77777777-7777-7777-7777-777777777777', '租户2的客户', '99999999-9999-9999-9999-999999999999', 'insurance', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
```

### 验证隔离

```bash
# 1. 使用租户1的 token 获取客户列表
curl -X GET http://localhost:3000/api/v1/admin/clients \
  -H "Authorization: Bearer $TOKEN_TENANT1" \
  | jq '.[] | .name'

# 预期结果: 只显示租户1的客户，不包含"租户2的客户"

# 2. 尝试访问其他租户的客户详情
curl -X GET http://localhost:3000/api/v1/admin/clients/77777777-7777-7777-7777-777777777777 \
  -H "Authorization: Bearer $TOKEN_TENANT1"

# 预期结果: 返回 404 Not Found
```

---

## 性能验证

### 批量数据测试

```sql
-- 插入 100 个测试客户
DO $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..100 LOOP
    INSERT INTO organizations (name, tenant_id, industry_type, scale, status, created_at, updated_at)
    VALUES (
      'Test Client ' || i,
      '11111111-1111-1111-1111-111111111111',
      CASE (i % 4)
        WHEN 0 THEN 'banking'
        WHEN 1 THEN 'insurance'
        WHEN 2 THEN 'securities'
        ELSE 'other'
      END,
      CASE (i % 3)
        WHEN 0 THEN 'large'
        WHEN 1 THEN 'medium'
        ELSE 'small'
      END,
      CASE (i % 3)
        WHEN 0 THEN 'active'
        WHEN 1 THEN 'trial'
        ELSE 'inactive'
      END,
      NOW(),
      NOW()
    );
  END LOOP;
END $$;
```

```bash
# 测试列表查询性能
time curl -X GET http://localhost:3000/api/v1/admin/clients \
  -H "Authorization: Bearer $TOKEN" \
  > /dev/null

# 预期结果: 响应时间 < 500ms
```

---

## 错误处理验证

### 1. 无效数据验证

```bash
# 测试无效邮箱格式
curl -X POST http://localhost:3000/api/v1/admin/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试",
    "contactEmail": "invalid-email"
  }'

# 预期结果: 返回 400，包含验证错误信息
```

### 2. 未认证访问

```bash
# 不带 token 访问
curl -X GET http://localhost:3000/api/v1/admin/clients

# 预期结果: 返回 401 Unauthorized
```

### 3. 不存在的资源

```bash
# 访问不存在的客户
curl -X GET http://localhost:3000/api/v1/admin/clients/00000000-0000-0000-0000-000000000000 \
  -H "Authorization: Bearer $TOKEN"

# 预期结果: 返回 404 Not Found
```

---

## Swagger API 文档验证

访问 Swagger UI:
```
http://localhost:3000/api
```

**验证点**:
- ✅ 显示所有 Admin API 端点
- ✅ 可以在线测试 API
- ✅ 显示请求/响应示例
- ✅ 显示参数说明

---

## 验证清单

### Story 6.2: 客户管理

- [ ] ✅ 获取客户列表
- [ ] ✅ 创建新客户
- [ ] ✅ 获取客户详情
- [ ] ✅ 更新客户信息
- [ ] ✅ 批量配置客户
- [ ] ✅ 创建客户分组
- [ ] ✅ 添加客户到分组
- [ ] ✅ 获取统计信息
- [ ] ✅ 多租户隔离
- [ ] ✅ 数据验证
- [ ] ✅ 错误处理

### Story 6.3: 白标输出

- [ ] ✅ 获取品牌配置
- [ ] ✅ 更新品牌配置
- [ ] ✅ 公开品牌接口（无需认证）
- [ ] ✅ 重置品牌配置
- [ ] ✅ 品牌配置持久化
- [ ] ✅ 多租户品牌隔离

---

## 常见问题

### Q: 如何生成密码哈希？

```bash
node -e "console.log(require('bcrypt').hashSync('admin123', 10))"
```

### Q: 如何查看当前 JWT token 内容？

访问 https://jwt.io/ 并粘贴 token

### Q: 数据库连接失败？

检查 `.env.development` 文件中的数据库配置

### Q: API 返回 500 错误？

查看后端日志:
```bash
tail -f backend/server.log
```

---

**验证完成后，请在验证清单中打勾，并记录任何发现的问题。**
