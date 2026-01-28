# 浏览器测试指南

## ✅ 后端 API 测试结果

所有 API 已通过测试：

| 测试项 | 状态码 | 结果 |
|--------|--------|------|
| 组织详情 | 200 | ✅ |
| Radar 状态 | 200 | ✅ (已激活) |
| 关注技术领域 | 200 | ✅ |
| 关注同业机构 | 200 | ✅ |
| 项目列表 | 200 | ✅ |
| 创建技术领域 | 201 | ✅ |
| 激活 Radar | 201 | ✅ |

---

## 🌐 浏览器测试步骤

### 第 1 步：登录

**URL**: http://localhost:3001/auth/signin

**测试账号**:
```
邮箱: radar-test@example.com
密码: Test123456
```

**预期结果**:
- ✅ 登录成功
- ✅ 跳转到首页或显示登录成功提示

---

### 第 2 步：访问 Radar 页面

**URL**: http://localhost:3001/radar?orgId=908a1134-8210-4fcb-90ee-37e194878822

**预期结果**:
- ✅ 页面正常加载
- ✅ 显示三个雷达卡片：
  - 技术雷达（蓝色）
  - 行业雷达（橙色）
  - 合规雷达（红色）
- ✅ 显示 "✓ Radar已激活" 绿色徽章
- ✅ 不会弹出引导向导
- ✅ 显示组织 ID: 908a1134-8210-4fcb-90ee-37e194878822

---

### 第 3 步：验证 Network 标签

打开浏览器开发者工具 (F12) → **Network** 标签

**检查 API 请求**:

1. **radar-status 请求**
   ```
   GET http://localhost:3000/organizations/908a1134-8210-4fcb-90ee-37e194878822/radar-status
   ```

   **应该看到**:
   - Status: 200 OK
   - Request Headers:
     ```
     Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
     ```

2. **watched-topics 请求**
   ```
   GET http://localhost:3000/organizations/908a1134-8210-4fcb-90ee-37e194878822/watched-topics
   ```

   **应该看到**:
   - Status: 200 OK
   - Response: 技术领域列表

3. **watched-peers 请求**
   ```
   GET http://localhost:3000/organizations/908a1134-8210-4fcb-90ee-37e194878822/watched-peers
   ```

   **应该看到**:
   - Status: 200 OK
   - Response: 同业机构列表

---

### 第 4 步：测试导航

点击雷达卡片上的 "进入雷达" 按钮：

**技术雷达**:
```
URL: http://localhost:3001/radar/tech?orgId=908a1134-8210-4fcb-90ee-37e194878822
```

**行业雷达**:
```
URL: http://localhost:3001/radar/industry?orgId=908a1134-8210-4fcb-90ee-37e194878822
```

**合规雷达**:
```
URL: http://localhost:3001/radar/compliance?orgId=908a1134-8210-4fcb-90ee-37e194878822
```

**预期结果**:
- ✅ 页面正常跳转
- ✅ orgId 参数正确传递
- ✅ 没有 401/403 错误

---

### 第 5 步：测试重新引导（可选）

如果想测试引导向导，需要：

1. **清除 localStorage**
   ```javascript
   // 在浏览器 Console 中执行
   localStorage.removeItem('radar-onboarded')
   localStorage.removeItem(`radar-activated-${orgId}`)
   ```

2. **刷新页面**
   ```
   URL: http://localhost:3001/radar?orgId=908a1134-8210-4fcb-90ee-37e194878822
   ```

3. **预期结果**
   - ✅ 弹出引导向导
   - ✅ 可以完成三步引导
   - ✅ 完成后显示 "✓ Radar已激活"

---

## 🐛 可能的问题和解决方案

### 问题 1: 登录后仍然看到 401

**原因**: 浏览器缓存了旧的数据

**解决方案**:
```
1. 打开开发者工具 (F12)
2. 右键点击刷新按钮
3. 选择 "清空缓存并硬性重新加载"
```

### 问题 2: Network 标签没有看到 Authorization header

**原因**: JWT token 没有正确传递

**检查步骤**:
1. 打开 Application 标签
2. 查看 Cookies → 检查是否有 `next-auth.session-token`
3. 如果没有，重新登录

### 问题 3: Radar 激活状态显示错误

**原因**: 数据库中的 `radar_activated` 字段

**检查**:
```javascript
// 在浏览器 Console 中执行
fetch('/api/auth/session').then(r=>r.json()).then(console.log)
```

**应该看到用户信息**

### 问题 4: 组织成员权限问题

**原因**: 用户不在组织中

**检查**:
```bash
cd backend
node -e "
const { Client } = require('pg');
const client = new Client({
  host: 'localhost', port: 5432, user: 'postgres',
  password: 'postgres', database: 'csaas'
});
client.connect().then(() =>
  client.query('SELECT * FROM \"organization_members\" WHERE \"organization_id\" = \$1', ['908a1134-8210-4fcb-90ee-37e194878822'])
).then(result => {
  console.log('组织成员:', result.rows);
  return client.end();
}).catch(console.error);
"
```

---

## 📊 完整测试检查清单

- [ ] 第 1 步：成功登录
- [ ] 第 2 步：Radar 页面正常显示
- [ ] 第 3 步：Network 标签显示 Authorization header
- [ ] 第 4 步：API 请求返回 200
- [ ] 第 5 步：三个雷达卡片正常显示
- [ ] 第 6 步：显示 "✓ Radar已激活" 徽章
- [ ] 第 7 步：导航到子页面正常
- [ ] 第 8 步：没有 Console 错误
- [ ] 第 9 步：没有 401/403 错误
- [ ] 第 10 步：数据正确加载

---

## 🎓 开发者调试技巧

### 查看 JWT Token

```javascript
// 在浏览器 Console 中执行
fetch('/api/auth/session')
  .then(r => r.json())
  .then(data => {
    console.log('User:', data.user)
    console.log('Access Token:', data.accessToken)
    console.log('Expires:', data.expires)
  })
```

### 手动测试 API

```javascript
// 使用 fetch 测试 API
const orgId = '908a1134-8210-4fcb-90ee-37e194878822'

fetch(`/api/organizations/${orgId}/radar-status`, {
  headers: {
    'Content-Type': 'application/json'
  }
})
  .then(r => r.json())
  .then(data => console.log('Radar 状态:', data))
```

### 检查组织激活状态

```javascript
const orgId = '908a1134-8210-4fcb-90ee-37e194878822'

fetch(`/api/organizations/${orgId}`)
  .then(r => r.json())
  .then(org => {
    console.log('组织名称:', org.name)
    console.log('Radar 已激活:', org.radarActivated)
  })
```

---

## ✨ 完成标准

**测试通过的标准**:
1. ✅ 所有 10 项检查清单都通过
2. ✅ 没有 Console 错误
3. ✅ 没有 Network 错误
4. ✅ 所有功能正常工作

**如果遇到问题**:
1. 检查后端服务器是否运行 (http://localhost:3000/health)
2. 检查前端服务器是否运行 (http://localhost:3001)
3. 查看 Console 错误信息
4. 查看 Network 请求失败原因
5. 尝试清除缓存并硬刷新

---

_测试准备完成时间: 2026-01-26 17:15_
_测试账号: radar-test@example.com / Test123456_
_组织ID: 908a1134-8210-4fcb-90ee-37e194878822_
