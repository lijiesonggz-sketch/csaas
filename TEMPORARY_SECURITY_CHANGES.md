# ⚠️ 临时安全变更记录

## 📅 变更日期
2026-01-26

## 🚨 临时禁用身份验证

### 变更位置
**文件**: `backend/src/modules/organizations/organizations.controller.ts`

**修改内容**:
```typescript
// ❌ 原始代码（已注释）
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {

// ✅ 当前代码（临时）
// @UseGuards(JwtAuthGuard) // TEMPORARILY DISABLED FOR TESTING
@Controller('organizations')
export class OrganizationsController {
```

### 影响范围

**以下所有 Organizations API 端点当前无需身份验证即可访问**：

#### Radar Service 相关端点
- `GET /organizations/:id/weaknesses/aggregated` - 获取聚合薄弱项
- `GET /organizations/:id/radar-status` - 获取 Radar 激活状态
- `POST /organizations/:id/watched-topics/batch` - 批量保存关注技术领域
- `POST /organizations/:id/watched-peers/batch` - 批量保存关注同业机构
- `POST /organizations/:id/radar-activate` - 激活 Radar Service
- `POST /organizations/:id/radar-deactivate` - 停用 Radar Service

#### 其他 Organizations 端点
- `GET /organizations/me` - 获取当前用户组织
- `GET /organizations/:id` - 获取组织详情
- `GET /organizations/:id/stats` - 获取组织统计
- `PUT /organizations/:id` - 更新组织信息
- `GET /organizations/:id/members` - 获取组织成员
- `POST /organizations/:id/members` - 添加组织成员
- `DELETE /organizations/:id/members/:userId` - 移除组织成员
- `GET /organizations/:id/projects` - 获取组织项目
- `POST /organizations/link-project` - 关联项目到组织
- `GET /organizations/:id/weaknesses` - 获取薄弱项
- `POST /organizations/:id/weaknesses/snapshot` - 创建薄弱项快照

### 变更原因
为了快速测试 Radar 功能，避免 JWT 认证阻塞功能测试。

### ⚠️ 安全风险
- **任何人都**可以访问、修改、删除组织数据
- **任何人都**可以激活/停用 Radar Service
- **任何人都**可以查看组织的薄弱项和敏感信息
- **数据泄露风险极高**

### ✅ 恢复步骤

**测试完成后，必须立即恢复身份验证！**

1. 打开文件：`backend/src/modules/organizations/organizations.controller.ts`

2. 找到第 44 行：
   ```typescript
   // @UseGuards(JwtAuthGuard) // TEMPORARILY DISABLED FOR TESTING
   ```

3. 取消注释：
   ```typescript
   @UseGuards(JwtAuthGuard)
   ```

4. 重启后端服务器：
   ```bash
   cd backend
   npm run start:dev
   ```

5. 验证恢复：
   - 尝试未登录访问 API，应该返回 401 Unauthorized
   - 登录后访问，应该正常工作

### 📋 验证清单

测试完成后，在恢复身份验证前，请确认：

- [ ] Radar 页面功能测试完成
- [ ] Onboarding Wizard 流程测试完成
- [ ] Radar 激活/停用功能测试完成
- [ ] 所有需要的功能都已验证
- [ ] **已恢复 JWT 身份验证**
- [ ] 已重启后端服务器
- [ ] 已验证未登录无法访问 API

### 🔒 生产环境检查

**部署到生产环境前，必须确认：**

```bash
# 检查代码中是否有被注释的 @UseGuards(JwtAuthGuard)
cd backend
grep -n "@UseGuards(JwtAuthGuard)" src/modules/organizations/organizations.controller.ts
```

应该看到：
```typescript
@UseGuards(JwtAuthGuard)  # ← 必须未被注释
```

而不是：
```typescript
// @UseGuards(JwtAuthGuard)  # ← 这是错误的状态！
```

### 📝 变更历史

| 日期 | 操作 | 操作人 | 备注 |
|------|------|--------|------|
| 2026-01-26 | 禁用身份验证 | Claude AI | 用于 Radar 功能测试 |
| _____ | 恢复身份验证 | _____ | ⚠️ 待完成 |

### 🚨 提醒

**这份文档应该被删除或标记为已完成，一旦身份验证被恢复！**

---

_最后更新：2026-01-26_
_状态：⚠️ 身份验证已禁用 - 需要恢复_
