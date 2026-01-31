# Story 2.1 手工验证指南

**Story**: 2-1-automatically-collect-technical-information-and-support-external-import
**验证日期**: 2026-01-29
**预计验证时间**: 30-40 分钟

---

## 📋 验证前准备

### 1. 环境要求
- ✅ 后端服务运行中（`http://localhost:3000`）
- ✅ 数据库连接正常（PostgreSQL）
- ✅ Redis 运行中（BullMQ 需要）
- ✅ 文件系统可写权限

### 2. 启动服务

```bash
# 启动 Redis（如果未运行）
redis-server

# 启动后端
cd backend
npm run start:dev
```

### 3. 检查服务状态

```bash
# 检查 Redis
redis-cli ping
# 预期输出: PONG

# 检查后端日志
# 应该看到: "File watcher started successfully"
# 应该看到: "Crawler jobs configured successfully"
```

---

## ✅ 验证清单

### Phase 1: 数据库验证（5分钟）

#### 1.1 验证核心表结构

**目标**: 确认 RawContent 和 CrawlerLog 表存在

**步骤**:
```sql
-- 连接数据库
psql -U your_username -d your_database

-- 验证 raw_contents 表
\d raw_contents

-- 验证 crawler_logs 表
\d crawler_logs
```

**预期结果**:
```
✅ raw_contents 表存在，包含字段：
   - id (uuid)
   - source (varchar)
   - category (enum: tech/industry/compliance)
   - title (varchar)
   - summary (text)
   - fullContent (text)
   - url (varchar)
   - publishDate (timestamp)
   - author (varchar)
   - contentHash (varchar, unique)
   - status (enum: pending/analyzing/analyzed/failed)
   - organizationId (uuid, nullable)
   - createdAt, updatedAt

✅ crawler_logs 表存在，包含字段：
   - id (uuid)
   - source (varchar)
   - category (enum)
   - url (varchar)
   - status (enum: success/failed)
   - errorMessage (text)
   - retryCount (int)
   - executedAt (timestamp)
```

**验证标准**:
- [ ] raw_contents 表结构正确
- [ ] crawler_logs 表结构正确
- [ ] 索引已创建（contentHash unique, status+category）

---

### Phase 2: 文件导入验证（10分钟）

#### 2.1 准备测试文件 - 技术文章

**步骤**:
1. 创建目录（如果不存在）:
```bash
mkdir -p backend/data-import/website-crawl
mkdir -p backend/data-import/wechat-articles
```

2. 创建测试文件：`backend/data-import/website-crawl/test-gartner-article.md`

**文件内容**:
```markdown
---
source: "GARTNER"
category: "tech"
url: "https://www.gartner.com/test-article"
publishDate: "2026-01-29"
author: "Gartner Analyst"
---

# 2026年十大战略技术趋势

Gartner发布了2026年十大战略技术趋势报告，重点关注AI、云原生和可持续计算。

## 趋势1: 生成式AI的企业化应用

生成式AI正在从实验阶段进入企业级应用，预计2026年将有60%的企业部署生成式AI解决方案。

## 趋势2: 云原生架构演进

Kubernetes和服务网格技术持续演进，边缘计算与云原生的融合成为新趋势。

## 趋势3: 可持续计算

绿色IT和碳中和成为企业技术战略的重要组成部分，预计可降低30%的能源消耗。
```

3. 保存文件

**验证标准**:
- [ ] 文件创建成功
- [ ] frontmatter 格式正确（YAML）
- [ ] 内容长度 ≥ 100 字符

---

#### 2.2 验证文件监控服务

**步骤**:
1. 等待 5-10 秒（文件监控服务会自动检测）
2. 检查后端日志

**预期日志输出**:
```
[FileWatcherService] File detected: test-gartner-article.md
[FileWatcherService] Processing file: test-gartner-article.md
[FileWatcherService] File processed successfully: test-gartner-article.md
[FileWatcherService] AI analysis task queued for content: <uuid>
[FileWatcherService] File moved to processed: test-gartner-article.md
```

**验证标准**:
- [ ] 文件被检测到
- [ ] 文件处理成功
- [ ] AI 分析任务已创建
- [ ] 文件移动到 `processed/` 目录

---

#### 2.3 验证数据库记录

**步骤**:
```sql
-- 查询最新的 raw_content 记录
SELECT
  id, source, category, title,
  LEFT(summary, 50) as summary_preview,
  status, "organizationId",
  "createdAt"
FROM raw_contents
WHERE source = 'GARTNER'
ORDER BY "createdAt" DESC
LIMIT 1;
```

**预期结果**:
```
✅ source: "GARTNER"
✅ category: "tech"
✅ title: "2026年十大战略技术趋势"
✅ summary: 包含文章摘要
✅ fullContent: 包含完整内容
✅ status: "pending"
✅ organizationId: null (公共内容)
✅ contentHash: 非空（SHA-256）
```

**验证标准**:
- [ ] 记录已创建
- [ ] 所有字段值正确
- [ ] contentHash 已生成（用于去重）
- [ ] organizationId 为 null

---

#### 2.4 验证去重机制

**步骤**:
1. 复制同一个测试文件到导入目录（重命名为 `test-gartner-article-duplicate.md`）
2. 等待 5-10 秒
3. 检查后端日志

**预期日志输出**:
```
[FileWatcherService] File detected: test-gartner-article-duplicate.md
[FileWatcherService] Processing file: test-gartner-article-duplicate.md
[FileWatcherService] Failed to process file: Duplicate content detected
[FileWatcherService] File moved to failed: test-gartner-article-duplicate.md
```

**验证标准**:
- [ ] 重复内容被检测到
- [ ] 文件移动到 `failed/` 目录
- [ ] 数据库中没有重复记录

---

#### 2.5 测试微信公众号文章导入

**步骤**:
1. 创建测试文件：`backend/data-import/wechat-articles/test-wechat-article.md`

**文件内容**:
```markdown
---
source: "InfoQ"
category: "tech"
url: "https://www.infoq.cn/test-article"
publishDate: "2026-01-28"
author: "InfoQ编辑部"
---

# Kubernetes 1.30 发布：新特性解读

Kubernetes 1.30 版本正式发布，带来了多项重要更新。

## 新特性1: 增强的安全性

新版本加强了 Pod 安全标准，提供了更细粒度的权限控制。

## 新特性2: 性能优化

调度器性能提升40%，支持更大规模的集群部署。
```

2. 等待处理并验证数据库

**验证标准**:
- [ ] 文件被正确处理
- [ ] 数据保存到 raw_contents 表
- [ ] source 为 "InfoQ"

---

### Phase 3: 爬虫功能验证（10分钟）

#### 3.1 验证爬虫调度配置

**步骤**:
```bash
# 方法1: 检查 BullMQ 队列（推荐）
cd backend
node -e "
const { Queue } = require('bullmq');
const queue = new Queue('radar-crawler', {
  connection: { host: 'localhost', port: 6379 }
});
queue.getRepeatableJobs().then(jobs => {
  console.log('=== Scheduled Crawler Jobs ===');
  console.log('Total jobs:', jobs.length);
  jobs.forEach(job => {
    console.log('');
    console.log('Job Name:', job.name);
    console.log('Cron Pattern:', job.pattern);
    console.log('Next Run:', new Date(job.next));
  });
  process.exit(0);
});
"
```

**预期输出**:
```
=== Scheduled Crawler Jobs ===
Total jobs: 3

Job Name: crawl-tech
Cron Pattern: 0 2 * * *
Next Run: 2026-01-30T02:00:00.000Z

Job Name: crawl-tech
Cron Pattern: 0 2 * * *
Next Run: 2026-01-30T02:00:00.000Z

Job Name: crawl-tech
Cron Pattern: 0 2 * * *
Next Run: 2026-01-30T02:00:00.000Z
```

**验证标准**:
- [ ] 至少有 3 个爬虫任务（GARTNER、信通院、IDC）
- [ ] Cron 表达式为 `0 2 * * *`（每日凌晨2点）
- [ ] 下次执行时间正确

---

#### 3.2 手动触发爬虫任务（可选）

**注意**: 这会发起真实的网络请求，可能失败或被反爬虫拦截

**步骤**:
```bash
cd backend
node -e "
const { Queue } = require('bullmq');
const queue = new Queue('radar-crawler', {
  connection: { host: 'localhost', port: 6379 }
});
queue.add('crawl-tech', {
  source: 'GARTNER',
  category: 'tech',
  url: 'https://www.gartner.com/en/newsroom'
}).then(() => {
  console.log('Crawler job added to queue');
  process.exit(0);
});
"
```

**预期结果**:
```
✅ 显示 "Crawler job added to queue"
✅ 后端日志显示爬虫开始执行
✅ 可能成功或失败（取决于网络和反爬虫）
```

**验证标准**:
- [ ] 任务成功添加到队列
- [ ] 后端日志显示处理过程
- [ ] 如果成功，数据保存到 raw_contents 表

---

#### 3.3 验证爬虫日志

**步骤**:
```sql
-- 查询爬虫日志
SELECT
  source, category, url,
  status, "retryCount",
  "errorMessage",
  "executedAt"
FROM crawler_logs
ORDER BY "executedAt" DESC
LIMIT 5;
```

**预期结果**:
```
✅ 有日志记录
✅ status 为 'success' 或 'failed'
✅ retryCount 记录重试次数
✅ 失败时有 errorMessage
```

**验证标准**:
- [ ] 日志表有记录
- [ ] 成功和失败都有记录
- [ ] 时间戳正确

---

### Phase 4: AI 分析任务触发验证（5分钟）

#### 4.1 验证 AI 分析队列

**步骤**:
```bash
cd backend
node -e "
const { Queue } = require('bullmq');
const queue = new Queue('radar-ai-analysis', {
  connection: { host: 'localhost', port: 6379 }
});
queue.getJobs(['waiting', 'active', 'completed']).then(jobs => {
  console.log('=== AI Analysis Queue ===');
  console.log('Waiting jobs:', jobs.filter(j => j.state === 'waiting').length);
  console.log('Active jobs:', jobs.filter(j => j.state === 'active').length);
  console.log('Completed jobs:', jobs.filter(j => j.state === 'completed').length);
  process.exit(0);
});
"
```

**预期结果**:
```
=== AI Analysis Queue ===
Waiting jobs: 2
Active jobs: 0
Completed jobs: 0
```

**验证标准**:
- [ ] 队列中有待处理的任务
- [ ] 任务数量 = 导入的文件数量

---

#### 4.2 验证任务数据

**步骤**:
```bash
cd backend
node -e "
const { Queue } = require('bullmq');
const queue = new Queue('radar-ai-analysis', {
  connection: { host: 'localhost', port: 6379 }
});
queue.getJobs(['waiting']).then(jobs => {
  console.log('=== AI Analysis Tasks ===');
  jobs.forEach((job, index) => {
    console.log(\`Task \${index + 1}:\`);
    console.log('  Content ID:', job.data.contentId);
    console.log('  Created:', new Date(job.timestamp));
  });
  process.exit(0);
});
"
```

**预期结果**:
```
=== AI Analysis Tasks ===
Task 1:
  Content ID: <uuid>
  Created: 2026-01-29T...
Task 2:
  Content ID: <uuid>
  Created: 2026-01-29T...
```

**验证标准**:
- [ ] 每个任务有 contentId
- [ ] contentId 对应 raw_contents 表的记录

---

### Phase 5: 错误处理验证（5分钟）

#### 5.1 测试无效文件格式

**步骤**:
1. 创建无效文件：`backend/data-import/website-crawl/invalid-file.md`

**文件内容**:
```markdown
---
source: "测试"
category: "invalid-category"
---

# 无效内容
```

2. 等待处理并检查日志

**预期日志**:
```
[FileWatcherService] File detected: invalid-file.md
[FileWatcherService] Failed to process file: Invalid category
[FileWatcherService] File moved to failed: invalid-file.md
```

**验证标准**:
- [ ] 错误被正确捕获
- [ ] 文件移动到 `failed/` 目录
- [ ] 服务继续运行（不崩溃）

---

#### 5.2 测试内容过短

**步骤**:
1. 创建过短文件：`backend/data-import/website-crawl/too-short.md`

**文件内容**:
```markdown
---
source: "GARTNER"
category: "tech"
---

# 短内容
```

2. 等待处理并检查日志

**预期日志**:
```
[FileWatcherService] Failed to process file: Content too short (minimum 100 characters required)
[FileWatcherService] File moved to failed: too-short.md
```

**验证标准**:
- [ ] 内容长度验证生效
- [ ] 文件移动到 `failed/` 目录

---

### Phase 6: 复用机制验证（5分钟）

#### 6.1 验证架构可复用性

**目标**: 确认架构设计支持 Epic 3 和 Epic 4 复用

**检查点**:
```bash
# 检查代码结构
ls -la backend/src/modules/radar/services/
# 应该看到:
# - crawler.service.ts (通用爬虫服务)
# - file-watcher.service.ts (通用文件监控)
# - raw-content.service.ts (通用内容保存)

# 检查配置文件
cat backend/src/modules/radar/radar.module.ts
# 应该看到 category 参数支持 'tech' | 'industry' | 'compliance'
```

**验证标准**:
- [ ] 服务设计通用化（支持不同 category）
- [ ] 没有硬编码 'tech' 类型
- [ ] 配置可扩展

---

## 📊 验证结果汇总

### 验证通过标准

**必须通过** (Critical):
- [ ] 数据库表结构正确（Phase 1）
- [ ] 文件导入功能正常（Phase 2.1-2.3）
- [ ] 去重机制工作（Phase 2.4）
- [ ] 爬虫调度配置正确（Phase 3.1）
- [ ] AI 分析任务触发（Phase 4）

**应该通过** (Important):
- [ ] 微信文章导入正常（Phase 2.5）
- [ ] 爬虫日志记录（Phase 3.3）
- [ ] 错误处理正确（Phase 5）

**可选验证** (Nice to have):
- [ ] 手动触发爬虫（Phase 3.2）
- [ ] 复用机制验证（Phase 6）

---

## 🐛 常见问题排查

### 问题1: 文件监控不工作

**症状**: 文件放入目录后没有被处理

**排查步骤**:
1. 检查后端日志是否有 "File watcher started" 消息
2. 检查目录权限：
   ```bash
   ls -la backend/data-import/
   ```
3. 检查文件路径是否正确
4. 重启后端服务

**解决方案**:
```bash
# 确保目录存在
mkdir -p backend/data-import/website-crawl
mkdir -p backend/data-import/wechat-articles

# 重启服务
cd backend
npm run start:dev
```

---

### 问题2: Redis 连接失败

**症状**: 后端日志显示 "ECONNREFUSED 127.0.0.1:6379"

**解决方案**:
```bash
# 启动 Redis
redis-server

# 或使用 Docker
docker run -d -p 6379:6379 redis:alpine
```

---

### 问题3: 数据库表不存在

**症状**: 查询时报错 "relation does not exist"

**解决方案**:
```bash
cd backend
npm run migration:run
```

---

### 问题4: 爬虫任务未调度

**症状**: BullMQ 队列中没有定时任务

**排查步骤**:
1. 检查 Redis 是否运行
2. 检查后端日志是否有 "Crawler jobs configured" 消息
3. 检查 radar.module.ts 的 onModuleInit 方法

**解决方案**:
```bash
# 重启后端服务
cd backend
npm run start:dev
```

---

### 问题5: AI 分析任务未触发

**症状**: raw_contents 有记录，但 AI 队列为空

**排查步骤**:
1. 检查 raw-content.service.ts 的 create 方法
2. 检查是否有错误日志
3. 验证 BullMQ 队列配置

---

## 📸 验证截图清单

建议保存以下截图作为验证证据：

1. `screenshots/story-2.1-database-tables.png` - 数据库表结构
2. `screenshots/story-2.1-file-import-log.png` - 文件导入日志
3. `screenshots/story-2.1-raw-content-data.png` - 数据库记录
4. `screenshots/story-2.1-crawler-jobs.png` - 爬虫调度任务
5. `screenshots/story-2.1-ai-queue.png` - AI 分析队列

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
# Story 2.1 验证报告

**验证日期**: 2026-01-29
**验证人**: [你的名字]
**环境**: Development

## 验证结果

### Phase 1: 数据库验证
- [x] raw_contents 表结构正确
- [x] crawler_logs 表结构正确
- [x] 索引已创建

### Phase 2: 文件导入验证
- [x] 技术文章导入成功
- [x] 数据正确保存
- [x] 去重机制工作
- [x] 微信文章导入成功

### Phase 3: 爬虫功能验证
- [x] 爬虫调度配置正确
- [x] 定时任务已创建
- [ ] 手动触发爬虫（可选）

### Phase 4: AI 分析任务触发验证
- [x] AI 队列有任务
- [x] contentId 正确

### Phase 5: 错误处理验证
- [x] 无效文件被拒绝
- [x] 过短内容被拒绝
- [x] 错误日志正确

### Phase 6: 复用机制验证
- [x] 架构设计通用化
- [x] 支持多种 category

## 总体评价

✅ **验证通过** - 所有核心功能正常工作

## 发现的问题

无

## 建议

1. 建议添加更多的爬虫信息源
2. 考虑添加爬虫成功率监控
```

---

## 🚀 快速验证版本（10分钟）

如果时间有限，可以只执行以下核心验证：

### 快速验证步骤

1. **数据库验证**（2分钟）
   ```sql
   \d raw_contents
   \d crawler_logs
   ```

2. **文件导入验证**（5分钟）
   - 创建一个测试文件
   - 等待处理
   - 查询数据库确认

3. **爬虫调度验证**（3分钟）
   ```bash
   node -e "const {Queue}=require('bullmq');new Queue('radar-crawler',{connection:{host:'localhost',port:6379}}).getRepeatableJobs().then(j=>{console.log('Jobs:',j.length);process.exit(0)});"
   ```

**快速验证通过标准**:
- [ ] 数据库表存在
- [ ] 文件导入成功
- [ ] 爬虫任务已调度

---

**验证指南版本**: 1.0
**最后更新**: 2026-01-29
**适用 Story**: 2.1 - 自动采集技术信息并支持外部导入
