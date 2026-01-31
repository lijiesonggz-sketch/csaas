# Story 3.1 手工验证指南

**Story**: 3-1-configure-industry-radar-information-sources
**验证日期**: 2026-01-29
**预计验证时间**: 30-45 分钟

---

## 📋 验证前准备

### 1. 环境要求
- ✅ 后端服务运行中（`http://localhost:3000`）
- ✅ 前端服务运行中（`http://localhost:3001` 或对应端口）
- ✅ 数据库连接正常
- ✅ Redis 运行中（BullMQ 需要）

### 2. 启动服务

```bash
# 启动后端
cd backend
npm run start:dev

# 启动前端（新终端）
cd frontend
npm run dev
```

### 3. 准备测试账号
- 需要一个 **CONSULTANT** 角色的账号（管理员权限）
- 如果没有，需要先创建或修改现有账号角色

---

## ✅ 验证清单

### Phase 1: 数据库验证（5分钟）

#### 1.1 验证数据库迁移

**目标**: 确认 `raw_contents` 表已添加新字段

**步骤**:
```bash
# 方法1: 使用数据库客户端（推荐）
# 连接到 PostgreSQL 数据库，执行：
\d raw_contents

# 方法2: 使用 Node.js 脚本
cd backend
node -e "
const { DataSource } = require('typeorm');
const dataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'your_username',
  password: 'your_password',
  database: 'your_database',
});
dataSource.initialize().then(async () => {
  const result = await dataSource.query(
    \"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'raw_contents' AND column_name IN ('contentType', 'peerName')\"
  );
  console.log('New columns:', result);
  await dataSource.destroy();
});
"
```

**预期结果**:
```
✅ contentType | enum ('article', 'recruitment', 'conference')
✅ peerName    | character varying(255)
```

**验证标准**:
- [ ] `contentType` 字段存在，类型为 enum
- [ ] `peerName` 字段存在，类型为 varchar(255)

---

#### 1.2 验证 RadarSource 表

**目标**: 确认信息源配置表存在且有数据

**步骤**:
```sql
-- 查询 radar_sources 表
SELECT id, source, category, type, "isActive", "crawlSchedule"
FROM radar_sources
ORDER BY category, source;
```

**预期结果**:
```
✅ 至少有 7 条记录（3个技术雷达 + 2个行业雷达 + 2个合规雷达）
✅ 包含行业雷达信息源（category='industry'）
```

**验证标准**:
- [ ] 表存在且有数据
- [ ] 至少有 2 个行业雷达信息源（杭州银行、拉勾网）

---

### Phase 2: 管理界面验证（10分钟）

#### 2.1 访问信息源管理页面

**步骤**:
1. 登录系统（使用 CONSULTANT 角色账号）
2. 访问：`http://localhost:3001/admin/radar-sources`

**预期结果**:
```
✅ 页面正常加载
✅ 显示信息源列表
✅ 显示"添加信息源"按钮
✅ 显示筛选选项（雷达类型、状态）
```

**验证标准**:
- [ ] 页面无错误
- [ ] 列表显示现有信息源
- [ ] UI 布局正常

**截图位置**: 保存为 `screenshots/admin-radar-sources-list.png`

---

#### 2.2 创建新的行业雷达信息源

**步骤**:
1. 点击"添加信息源"按钮
2. 填写表单：
   - **信息源名称**: `测试-招商银行金融科技`
   - **雷达类型**: `行业雷达 (industry)`
   - **内容类型**: `公众号 (wechat)`
   - **目标URL**: `https://mp.weixin.qq.com/test`
   - **同业机构**: `招商银行`
   - **爬取频率**: `0 3 * * *`
   - **状态**: ✅ 启用
3. 点击"保存"

**预期结果**:
```
✅ 显示成功提示："信息源已添加！"
✅ 列表中出现新创建的信息源
✅ 信息源状态为"启用"
```

**验证标准**:
- [ ] 创建成功
- [ ] 数据正确显示
- [ ] 无错误提示

**截图位置**: 保存为 `screenshots/create-radar-source.png`

---

#### 2.3 编辑信息源

**步骤**:
1. 找到刚创建的信息源
2. 点击"编辑"按钮
3. 修改"同业机构"为：`招商银行股份有限公司`
4. 点击"保存"

**预期结果**:
```
✅ 显示成功提示："信息源已更新！"
✅ 列表中显示更新后的数据
```

**验证标准**:
- [ ] 编辑成功
- [ ] 数据已更新

---

#### 2.4 切换启用状态

**步骤**:
1. 找到刚创建的信息源
2. 点击"禁用"按钮
3. 观察状态变化
4. 再次点击"启用"按钮

**预期结果**:
```
✅ 第一次点击：状态变为"禁用"，按钮变为"启用"
✅ 第二次点击：状态变为"启用"，按钮变为"禁用"
```

**验证标准**:
- [ ] 状态切换正常
- [ ] UI 实时更新

---

#### 2.5 删除信息源

**步骤**:
1. 找到刚创建的测试信息源
2. 点击"删除"按钮
3. 确认删除

**预期结果**:
```
✅ 显示确认对话框
✅ 确认后，信息源从列表中消失
✅ 显示成功提示："信息源已删除！"
```

**验证标准**:
- [ ] 删除成功
- [ ] 列表已更新

---

### Phase 3: 文件导入验证（10分钟）

#### 3.1 准备测试文件

**步骤**:
1. 创建测试文件：`backend/data-import/wechat-articles/test-industry-content.md`

**文件内容**:
```markdown
---
source: "杭州银行金融科技公众号"
category: "industry"
url: "https://mp.weixin.qq.com/test-article"
publishDate: "2026-01-29"
contentType: "article"
peerName: "杭州银行"
---

# 杭州银行容器化改造实践

杭州银行于2025年启动容器化改造项目，投入120万，历时6个月，成功将核心业务系统迁移到Kubernetes平台。

## 技术栈
项目采用了以下技术：
- 熟悉Kubernetes容器编排
- 精通Docker容器技术
- 掌握微服务架构设计
- 了解DevOps实践

## 实施效果
通过容器化改造，应用部署时间从2小时缩短到10分钟，资源利用率提升40%，运维成本降低30%。
```

2. 保存文件

**验证标准**:
- [ ] 文件创建成功
- [ ] frontmatter 格式正确

---

#### 3.2 验证文件监控服务

**步骤**:
1. 等待 5-10 秒（文件监控服务会自动检测）
2. 检查后端日志

**预期日志**:
```
[FileWatcherService] File detected: test-industry-content.md
[FileWatcherService] File processed successfully: test-industry-content.md
[FileWatcherService] AI analysis task queued for content: <content-id>
[FileWatcherService] File moved to processed: test-industry-content.md
```

**验证标准**:
- [ ] 文件被检测到
- [ ] 文件处理成功
- [ ] AI 分析任务已创建
- [ ] 文件移动到 `processed/` 目录

---

#### 3.3 验证数据库记录

**步骤**:
```sql
-- 查询最新的 raw_content 记录
SELECT
  id, source, category, title,
  "contentType", "peerName", status
FROM raw_contents
WHERE category = 'industry'
ORDER BY "createdAt" DESC
LIMIT 1;
```

**预期结果**:
```
✅ source: "杭州银行金融科技公众号"
✅ category: "industry"
✅ title: "杭州银行容器化改造实践"
✅ contentType: "article"
✅ peerName: "杭州银行"
✅ status: "pending"
```

**验证标准**:
- [ ] 记录已创建
- [ ] `contentType` 字段正确
- [ ] `peerName` 字段正确
- [ ] 所有字段值正确

---

### Phase 4: 爬虫功能验证（10分钟）

#### 4.1 验证爬虫调度配置

**步骤**:
```bash
# 检查 BullMQ 队列
cd backend
node -e "
const { Queue } = require('bullmq');
const queue = new Queue('radar-crawler', {
  connection: { host: 'localhost', port: 6379 }
});
queue.getRepeatableJobs().then(jobs => {
  console.log('Scheduled crawler jobs:', jobs.length);
  jobs.forEach(job => {
    console.log('- Job:', job.name, 'Pattern:', job.pattern);
  });
  process.exit(0);
});
"
```

**预期结果**:
```
✅ 显示多个定时任务
✅ 包含行业雷达爬虫任务（pattern: '0 3 * * *'）
```

**验证标准**:
- [ ] 爬虫任务已调度
- [ ] cron 表达式正确

---

#### 4.2 手动触发爬虫测试（可选）

**注意**: 这需要实际的网络请求，可能失败

**步骤**:
1. 在管理界面找到一个行业雷达信息源
2. 点击"测试爬虫"按钮
3. 观察结果

**预期结果**:
```
✅ 显示"爬虫任务已触发"
✅ 后端日志显示爬虫执行
```

**验证标准**:
- [ ] 测试功能可用
- [ ] 有反馈信息

---

### Phase 5: 代码质量验证（5分钟）

#### 5.1 验证常量使用

**步骤**:
```bash
# 检查常量文件
cat backend/src/modules/radar/constants/content.constants.ts
```

**预期内容**:
```typescript
export const MAX_CONTENT_TYPE_LENGTH = 50
export const MAX_PEER_NAME_LENGTH = 255
export const MAX_TECH_KEYWORDS = 20
export const VALID_CONTENT_TYPES = ['article', 'recruitment', 'conference']
```

**验证标准**:
- [ ] 常量文件存在
- [ ] 所有常量已定义

---

#### 5.2 验证错误处理

**步骤**:
1. 创建一个无效的测试文件（缺少必填字段）

**文件内容**:
```markdown
---
source: "测试"
category: "invalid-category"
---

# 测试内容
```

2. 观察后端日志

**预期结果**:
```
✅ 显示错误日志
✅ 文件移动到 failed/ 目录
✅ 不会导致服务崩溃
```

**验证标准**:
- [ ] 错误被正确捕获
- [ ] 有错误日志
- [ ] 服务继续运行

---

## 📊 验证结果汇总

### 验证通过标准

**必须通过** (Critical):
- [ ] 数据库迁移成功（Phase 1.1）
- [ ] 管理界面可访问（Phase 2.1）
- [ ] 可以创建信息源（Phase 2.2）
- [ ] 文件导入功能正常（Phase 3）

**应该通过** (Important):
- [ ] 可以编辑/删除信息源（Phase 2.3-2.5）
- [ ] 爬虫调度配置正确（Phase 4.1）
- [ ] 常量文件存在（Phase 5.1）

**可选验证** (Nice to have):
- [ ] 测试爬虫功能（Phase 4.2）
- [ ] 错误处理验证（Phase 5.2）

---

## 🐛 常见问题排查

### 问题1: 管理页面 404

**原因**: 前端路由未配置或服务未启动

**解决**:
```bash
# 检查前端服务
cd frontend
npm run dev

# 检查路由文件
ls -la app/admin/radar-sources/
```

---

### 问题2: 数据库字段不存在

**原因**: 迁移未执行

**解决**:
```bash
cd backend
npm run migration:run
```

---

### 问题3: 文件导入不工作

**原因**: 文件监控服务未启动或路径错误

**解决**:
1. 检查后端日志是否有 "File watcher started" 消息
2. 确认文件放在正确的目录：`backend/data-import/wechat-articles/`
3. 检查文件权限

---

### 问题4: 权限不足

**原因**: 账号不是 CONSULTANT 角色

**解决**:
```sql
-- 更新用户角色
UPDATE users
SET role = 'CONSULTANT'
WHERE email = 'your-email@example.com';
```

---

## 📸 验证截图清单

建议保存以下截图作为验证证据：

1. `screenshots/admin-radar-sources-list.png` - 信息源列表页面
2. `screenshots/create-radar-source.png` - 创建信息源表单
3. `screenshots/database-columns.png` - 数据库新字段
4. `screenshots/file-import-log.png` - 文件导入日志
5. `screenshots/crawler-jobs.png` - 爬虫调度任务

---

## ✅ 验证完成确认

完成所有验证后，请填写：

**验证人**: _______________
**验证日期**: _______________
**验证结果**: [ ] 通过 / [ ] 失败
**备注**: _______________

---

## 📝 验证报告模板

```markdown
# Story 3.1 验证报告

**验证日期**: 2026-01-29
**验证人**: [你的名字]
**环境**: Development

## 验证结果

### Phase 1: 数据库验证
- [x] 数据库迁移成功
- [x] 新字段存在且类型正确
- [x] RadarSource 表有数据

### Phase 2: 管理界面验证
- [x] 页面可访问
- [x] 创建功能正常
- [x] 编辑功能正常
- [x] 删除功能正常
- [x] 状态切换正常

### Phase 3: 文件导入验证
- [x] 文件监控服务工作正常
- [x] 数据正确保存到数据库
- [x] contentType 和 peerName 字段正确

### Phase 4: 爬虫功能验证
- [x] 爬虫任务已调度
- [ ] 测试爬虫功能（可选）

### Phase 5: 代码质量验证
- [x] 常量文件存在
- [x] 错误处理正常

## 总体评价

✅ **验证通过** - 所有核心功能正常工作

## 发现的问题

无

## 建议

建议部署到生产环境前再次验证爬虫功能。
```

---

**验证指南版本**: 1.0
**最后更新**: 2026-01-29
