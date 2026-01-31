# Story 3.1 快速测试指南

## 前置条件

1. ✅ 数据库已创建 `radar_sources` 表
2. ✅ 后端服务正在运行
3. ✅ 前端服务正在运行
4. ✅ 已登录为管理员用户（CONSULTANT 角色）

## 快速测试步骤

### 1. 启动服务

```bash
# 终端1: 启动后端
cd D:\csaas\backend
npm run start:dev

# 终端2: 启动前端
cd D:\csaas\frontend
npm run dev
```

### 2. 访问管理界面

1. 打开浏览器访问: `http://localhost:3000`
2. 登录系统（使用管理员账号）
3. 点击侧边栏 **"系统设置"** → **"信息源配置"**
4. 应该看到信息源管理页面

### 3. 测试创建信息源

1. 点击 **"添加信息源"** 按钮
2. 填写表单：
   - **信息源名称**: `测试信息源`
   - **雷达类别**: 选择 `技术雷达`
   - **URL**: `https://example.com/test`
   - **内容类型**: 选择 `网站`
   - **爬取频率**: `0 3 * * *`
   - **启用状态**: 勾选
3. 点击 **"创建"** 按钮
4. ✅ 应该看到成功提示，列表中出现新的信息源

### 4. 测试编辑信息源

1. 在列表中找到刚创建的信息源
2. 点击 **"编辑"** 图标（铅笔图标）
3. 修改 **信息源名称** 为 `测试信息源（已修改）`
4. 点击 **"保存"** 按钮
5. ✅ 应该看到成功提示，列表中名称已更新

### 5. 测试启用/禁用

1. 在列表中找到信息源
2. 点击 **"启用状态"** 开关
3. ✅ 应该看到成功提示，开关状态改变

### 6. 测试删除信息源

1. 在列表中找到信息源
2. 点击 **"删除"** 图标（垃圾桶图标）
3. 在确认对话框中点击 **"确定"**
4. ✅ 应该看到成功提示，信息源从列表中消失

### 7. 测试表单验证

1. 点击 **"添加信息源"** 按钮
2. 尝试提交空表单
3. ✅ 应该看到必填字段的错误提示
4. 输入无效的URL（例如 `invalid-url`）
5. ✅ 应该看到 "URL格式不正确" 的错误提示
6. 输入无效的Cron表达式（例如 `invalid`）
7. ✅ 应该看到 "Cron表达式格式不正确" 的错误提示

### 8. 测试API端点（可选）

使用 Postman 或 curl 测试：

```bash
# 获取所有信息源
curl -X GET http://localhost:3001/api/admin/radar-sources \
  -H "Authorization: Bearer YOUR_TOKEN"

# 创建信息源
curl -X POST http://localhost:3001/api/admin/radar-sources \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "API测试信息源",
    "category": "tech",
    "url": "https://example.com/api-test",
    "type": "website",
    "crawlSchedule": "0 3 * * *"
  }'

# 切换启用状态
curl -X PATCH http://localhost:3001/api/admin/radar-sources/{id}/toggle \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 9. 验证爬虫调度器集成

1. 查看后端日志
2. 应该看到类似以下的日志：
   ```
   [RadarModule] Setting up crawler jobs from database: X sources
   [RadarModule] Scheduled crawler job: 测试信息源 (tech) - 0 3 * * *
   ```
3. ✅ 确认爬虫调度器已从数据库读取配置

### 10. 测试向后兼容性

1. 清空数据库中的所有信息源
2. 重启后端服务
3. 查看后端日志
4. 应该看到：
   ```
   [RadarModule] No sources found in database, using default configuration
   [RadarModule] Scheduled default crawler jobs
   ```
5. ✅ 确认系统回退到默认配置

## 预期结果

所有测试步骤都应该成功完成，没有错误。

## 常见问题

### Q1: 无法访问管理页面
**A**: 确认已登录为管理员用户（CONSULTANT 角色）

### Q2: API返回401错误
**A**: 检查JWT token是否有效，是否已登录

### Q3: 表单验证不工作
**A**: 检查浏览器控制台是否有JavaScript错误

### Q4: 数据库连接失败
**A**: 检查 `.env` 文件中的数据库配置

### Q5: 爬虫调度器未读取数据库配置
**A**: 重启后端服务，查看日志确认

## 测试完成检查清单

- [ ] 可以访问管理页面
- [ ] 可以创建信息源
- [ ] 可以编辑信息源
- [ ] 可以删除信息源
- [ ] 可以切换启用状态
- [ ] 表单验证正常工作
- [ ] 错误提示正常显示
- [ ] 成功消息正常显示
- [ ] 爬虫调度器读取数据库配置
- [ ] 向后兼容性正常工作

---

**测试完成后，请在实施报告中标记测试状态。**
