# Story 2.1 快速验证指南（10分钟版）

**适用场景**: 快速验证核心功能是否正常工作

---

## 🚀 快速验证步骤

### 1️⃣ 数据库验证（2分钟）

```bash
# 连接数据库
psql -U your_username -d your_database

# 验证表结构
\d raw_contents
\d crawler_logs

# 快速检查
SELECT COUNT(*) FROM raw_contents;
SELECT COUNT(*) FROM crawler_logs;
```

**预期结果**:
- ✅ 两个表都存在
- ✅ raw_contents 有基本字段（source, category, title, fullContent, contentHash）
- ✅ crawler_logs 有日志字段（source, status, retryCount）

---

### 2️⃣ 文件导入验证（5分钟）

**创建测试文件**: `backend/data-import/website-crawl/quick-test.md`

```markdown
---
source: "GARTNER"
category: "tech"
url: "https://test.com/article"
publishDate: "2026-01-29"
---

# 快速测试文章

这是一个用于快速验证的测试文章。内容需要超过100个字符才能通过验证。
Kubernetes、Docker、微服务架构是当前最热门的技术趋势。
云原生技术正在改变企业的IT架构，DevOps实践也越来越普及。
```

**等待 10 秒**，然后查询数据库：

```sql
SELECT
  source, category, title,
  LEFT(fullContent, 50) as content_preview,
  status
FROM raw_contents
WHERE source = 'GARTNER'
ORDER BY "createdAt" DESC
LIMIT 1;
```

**预期结果**:
- ✅ 有新记录
- ✅ source = 'GARTNER'
- ✅ category = 'tech'
- ✅ title = '快速测试文章'
- ✅ status = 'pending'

---

### 3️⃣ 爬虫调度验证（3分钟）

```bash
cd backend

# 检查 Redis 连接
redis-cli ping
# 预期: PONG

# 检查爬虫任务
node -e "
const {Queue}=require('bullmq');
new Queue('radar-crawler',{connection:{host:'localhost',port:6379}})
.getRepeatableJobs()
.then(jobs=>{
  console.log('爬虫任务数量:', jobs.length);
  jobs.forEach(j=>console.log('- 任务:', j.name, '频率:', j.pattern));
  process.exit(0);
});
"
```

**预期结果**:
```
爬虫任务数量: 3
- 任务: crawl-tech 频率: 0 2 * * *
- 任务: crawl-tech 频率: 0 2 * * *
- 任务: crawl-tech 频率: 0 2 * * *
```

---

### 4️⃣ AI 队列验证（可选，1分钟）

```bash
node -e "
const {Queue}=require('bullmq');
new Queue('radar-ai-analysis',{connection:{host:'localhost',port:6379}})
.getJobCounts()
.then(counts=>{
  console.log('AI 分析队列:', counts);
  process.exit(0);
});
"
```

**预期结果**:
```
AI 分析队列: { waiting: 1, active: 0, completed: 0, failed: 0 }
```

---

## ✅ 验证通过标准

- [ ] 数据库表存在且结构正确
- [ ] 文件导入成功，数据保存到数据库
- [ ] 爬虫任务已调度（至少3个）
- [ ] AI 分析队列有任务（可选）

**如果以上 3-4 项通过，Story 2.1 验证成功！** 🎉

---

## 🧹 清理测试数据

```sql
-- 删除测试记录
DELETE FROM raw_contents WHERE source = 'GARTNER' AND title = '快速测试文章';

-- 删除测试文件
rm backend/data-import/website-crawl/processed/quick-test.md
```

---

## 🐛 快速问题排查

**问题**: 文件导入不工作
**检查**: 后端日志是否有 "File watcher started"
**解决**: 重启后端服务

**问题**: Redis 连接失败
**检查**: `redis-cli ping`
**解决**: `redis-server` 或 `docker run -d -p 6379:6379 redis:alpine`

**问题**: 爬虫任务为空
**检查**: 后端日志是否有 "Crawler jobs configured"
**解决**: 重启后端服务

---

## 📋 核心功能检查清单

| 功能 | 检查方法 | 状态 |
|------|---------|------|
| 数据库表 | `\d raw_contents` | [ ] |
| 文件监控 | 创建测试文件 | [ ] |
| 数据保存 | 查询数据库 | [ ] |
| 爬虫调度 | 检查 BullMQ 队列 | [ ] |
| AI 触发 | 检查 AI 队列 | [ ] |

---

**验证时间**: 约 10 分钟
**难度**: ⭐⭐☆☆☆ 简单
**推荐**: 开发环境日常检查
