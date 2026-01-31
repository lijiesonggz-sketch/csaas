# 合规雷达配置指南

**Story**: 4.1 - 配置合规雷达的信息来源
**版本**: 1.0
**最后更新**: 2026-01-30

---

## 📋 目录

1. [概述](#概述)
2. [信息源配置](#信息源配置)
3. [爬虫调度配置](#爬虫调度配置)
4. [文件导入格式](#文件导入格式)
5. [API使用指南](#api使用指南)
6. [监控和日志](#监控和日志)
7. [故障排查](#故障排查)

---

## 概述

合规雷达是Csaas系统三大雷达之一（技术雷达、行业雷达、合规雷达），专门用于监控监管政策和处罚案例。

**核心功能**:
- 自动采集监管机构网站内容（银保监会、人民银行、地方金融监管局）
- 支持外部文件导入（政策文件、处罚通报）
- AI智能分析合规风险和应对措施
- 自动推送给相关组织

**数据类型**:
- `penalty`: 处罚通报 - 监管机构对金融机构的违规处罚
- `policy_draft`: 政策征求意见 - 新政策草案的征求意见

---

## 信息源配置

### 预设信息源

系统已预配置4个合规信息源：

| 信息源 | 类型 | 调度时间 | URL |
|--------|------|----------|-----|
| 银保监会 | penalty | 每日 02:00 | http://www.cbrc.gov.cn |
| 人民银行 | policy_draft | 每日 02:00, 10:00 | http://www.pbc.gov.cn |
| 北京金融监管局 | penalty | 每日 03:00 | http://jrj.beijing.gov.cn |
| 上海金融监管局 | penalty | 每日 03:00 | http://jrj.sh.gov.cn |

### 添加新信息源

#### 方式1: 通过API添加

```bash
POST /api/admin/radar-sources
Authorization: Bearer <token>

{
  "source": "深圳金融监管局",
  "category": "compliance",
  "url": "http://jrj.sz.gov.cn",
  "type": "website",
  "isActive": true,
  "crawlSchedule": "0 4 * * *"
}
```

#### 方式2: 通过数据库直接添加

```sql
INSERT INTO radar_sources (
  source, category, url, type,
  "crawlSchedule", "isActive",
  "lastCrawlStatus", "createdAt", "updatedAt"
) VALUES (
  '深圳金融监管局',
  'compliance',
  'http://jrj.sz.gov.cn',
  'website',
  '0 4 * * *',
  true,
  'pending',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
```

**注意**: `source + category` 组合必须唯一！

---

## 爬虫调度配置

### Cron表达式格式

```
* * * * *
│ │ │ │ │
│ │ │ │ └─ 星期几 (0-7, 0和7都表示周日)
│ │ │ └─── 月份 (1-12)
│ │ └───── 日期 (1-31)
│ └─────── 小时 (0-23)
└───────── 分钟 (0-59)
```

### 推荐调度时间

**处罚通报** (penalty):
- 每日凌晨 2:00 - 4:00：`0 2 * * *` 或 `0 3 * * *`

**政策征求意见** (policy_draft):
- 每日 2:00 和 10:00：`0 2,10 * * *`（更频繁，因为政策更新较快）

### 更新调度时间

```bash
PUT /api/admin/radar-sources/:id
{
  "crawlSchedule": "0 2,10 * * *"  # 每日2:00和10:00
}
```

---

## 文件导入格式

### 文件存放位置

```
backend/data-import/website-crawl/
├── compliance-penalty-example.md
├── compliance-policy-example.md
└── processed/  # 处理后的文件会移动到这里
```

### 处罚通报文件格式

```markdown
---
source: "银保监会"
category: "compliance"
type: "penalty"
url: "http://www.cbrc.gov.cn/penalty/001"
publishDate: "2026-01-15"
penaltyInstitution: "某城市商业银行"
penaltyAmount: "50万元"
penaltyDate: "2026-01-15"
policyBasis: "《银行业金融机构数据治理指引》"
---

# 某城市商业银行数据安全管理违规处罚通报

## 被处罚机构
某城市商业银行股份有限公司

## 处罚原因
经查，该行在数据安全管理方面存在以下违规行为：

1. 客户敏感信息保护不到位
2. 数据治理体系不健全

## 处罚决定
根据《中华人民共和国银行业监督管理法》第四十六条规定，
对该行处以**50万元罚款**，并责令限期整改。
```

### 政策征求意见文件格式

```markdown
---
source: "人民银行"
category: "compliance"
type: "policy_draft"
url: "http://www.pbc.gov.cn/policy/001"
publishDate: "2026-01-20"
commentDeadline: "2026-03-31"
policyTitle: "金融机构网络安全管理办法（征求意见稿）"
---

# 金融机构网络安全管理办法（征求意见稿）

## 政策背景
为加强金融机构网络安全管理，防范网络安全风险，维护金融稳定...

## 主要要求

### 1. 网络安全管理体系
金融机构应当建立健全网络安全管理体系

### 2. 网络分区管理
- 网络分区要求
- 隔离要求
- 访问控制

## 征求意见截止日期
2026年3月31日
```

### 字段说明

#### 通用字段
- `source`: 监管机构名称（必填）
- `category`: 必须是 "compliance"（必填）
- `type`: "penalty" 或 "policy_draft"（必填）
- `url`: 原文链接（必填）
- `publishDate`: 发布日期，格式 "YYYY-MM-DD"（必填）

#### 处罚通报特有字段
- `penaltyInstitution`: 被处罚机构名称
- `penaltyReason`: 处罚原因
- `penaltyAmount`: 处罚金额
- `penaltyDate`: 处罚日期
- `policyBasis`: 政策依据

#### 政策征求意见特有字段
- `policyTitle`: 政策标题
- `commentDeadline`: 征求意见截止日期
- `mainRequirements`: 主要要求
- `expectedImplementationDate`: 预计实施时间

---

## API使用指南

### 1. 获取所有合规信息源

```bash
GET /api/admin/radar-sources?category=compliance
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "source": "银保监会",
      "category": "compliance",
      "url": "http://www.cbrc.gov.cn",
      "type": "website",
      "isActive": true,
      "crawlSchedule": "0 2 * * *",
      "lastCrawledAt": "2026-01-30T02:00:00Z",
      "lastCrawlStatus": "success"
    }
  ],
  "total": 4
}
```

### 2. 创建新信息源

```bash
POST /api/admin/radar-sources
```

**请求体**:
```json
{
  "source": "深圳金融监管局",
  "category": "compliance",
  "url": "http://jrj.sz.gov.cn",
  "type": "website",
  "isActive": true,
  "crawlSchedule": "0 4 * * *"
}
```

### 3. 更新信息源

```bash
PUT /api/admin/radar-sources/:id
```

**请求体**:
```json
{
  "url": "http://jrj.sz.gov.cn/new-url",
  "isActive": false
}
```

### 4. 启用/禁用信息源

```bash
PATCH /api/admin/radar-sources/:id/toggle
```

### 5. 测试爬虫

```bash
POST /api/admin/radar-sources/:id/test-crawl
```

**响应**:
```json
{
  "success": true,
  "data": {
    "sourceId": "uuid",
    "source": "银保监会",
    "url": "http://www.cbrc.gov.cn",
    "status": "success",
    "result": {
      "contentId": "uuid",
      "title": "爬取的标题",
      "contentLength": 1234
    }
  }
}
```

### 6. 查询统计信息

```bash
GET /api/admin/radar-sources/stats/by-category
```

**响应**:
```json
{
  "success": true,
  "data": {
    "tech": { "total": 3, "active": 3, "inactive": 0 },
    "industry": { "total": 2, "active": 2, "inactive": 0 },
    "compliance": { "total": 4, "active": 4, "inactive": 0 }
  }
}
```

---

## 监控和日志

### 查看爬虫日志

爬虫日志存储在 `crawler_logs` 表中。

**字段说明**:
- `source`: 信息源名称
- `category`: 雷达类型
- `url`: 目标URL
- `status`: "success" 或 "failed"
- `contentId`: 关联的内容ID（如果成功）
- `crawlDuration`: 爬取耗时（毫秒）
- `retryCount`: 重试次数
- `crawledAt`: 爬取时间
- `errorMessage`: 错误信息（如果失败）

### 查询最近的爬虫日志

```sql
SELECT
  source,
  category,
  status,
  "crawlDuration",
  "crawledAt",
  "errorMessage"
FROM crawler_logs
WHERE category = 'compliance'
  AND "crawledAt" > NOW() - INTERVAL '24 hours'
ORDER BY "crawledAt" DESC
LIMIT 20;
```

### 失败率计算

```sql
WITH recent_logs AS (
  SELECT
    status,
    COUNT(*) as count
  FROM crawler_logs
  WHERE category = 'compliance'
    AND "crawledAt" > NOW() - INTERVAL '24 hours'
  GROUP BY status
)
SELECT
  SUM(COUNT) FILTER (WHERE status = 'success') as success_count,
  SUM(COUNT) FILTER (WHERE status = 'failed') as failed_count,
  SUM(COUNT) as total_count,
  ROUND(SUM(COUNT) FILTER (WHERE status = 'failed')::numeric / SUM(COUNT) * 100, 2) as failure_rate_percent
FROM recent_logs;
```

**告警阈值**: 如果失败率 > 10%，需要检查爬虫配置。

---

## 故障排查

### 问题1: 文件没有被监控处理

**症状**: 文件放入 `data-import/website-crawl/` 后没有被处理

**排查步骤**:
1. 检查后端服务是否正在运行
2. 检查文件监控服务是否启动：
   ```bash
   # 查看日志中是否有 "File watcher started" 消息
   ```
3. 检查文件格式是否正确（frontmatter是否完整）
4. 检查文件是否在 `processed/` 或 `failed/` 目录中

**解决方案**:
- 确保文件是 `.md` 或 `.txt` 格式
- 确保 frontmatter 包含所有必需字段
- 检查文件大小（最大10MB）

### 问题2: 爬虫执行失败

**症状**: 爬虫一直返回 failed 状态

**排查步骤**:
1. 检查网站URL是否可访问
2. 使用测试爬虫功能：
   ```bash
   POST /api/admin/radar-sources/:id/test-crawl
   ```
3. 查看错误日志：
   ```sql
   SELECT "errorMessage", "crawledAt"
   FROM crawler_logs
   WHERE source = '信息源名称'
     AND status = 'failed'
   ORDER BY "crawledAt" DESC
   LIMIT 5;
   ```

**常见原因**:
- 网站反爬虫机制
- URL错误或网站不可访问
- 网络超时

**解决方案**:
- 更新URL为正确的网址
- 调整 `crawlSchedule` 避开高峰期
- 考虑使用文件导入方式作为备选

### 问题3: AI分析失败

**症状**: 内容已爬取但AI分析一直失败

**排查步骤**:
1. 检查 AI 服务配置
2. 查看 `analyzed_contents` 表的错误信息
3. 检查 Token 使用量是否超限

**解决方案**:
- 检查通义千问API密钥配置
- 查看AI服务日志
- 联系系统管理员

### 问题4: 信息源重复

**症状**: 创建信息源时报错 "duplicate key value violates unique constraint"

**原因**: `source + category` 组合必须唯一

**解决方案**:
- 检查是否已存在同名信息源
- 使用不同的名称
- 或者更新现有信息源而不是创建新的

---

## 最佳实践

### 1. 信息源命名

- 使用完整机构名称，例如："银保监会"、"人民银行"
- 避免使用缩写，例如："CBIRC" → "银保监会"

### 2. 调度时间配置

- 避免所有信息源在同一时间爬取
- 错开高峰期（凌晨2:00 - 6:00最佳）
- 政策征求意见可以更频繁（每日2次）

### 3. 文件导入

- 使用明确的文件名，例如：`2026-01-30-银保监会-处罚-某银行.md`
- 定期清理 `processed/` 目录
- 验证文件格式后再导入

### 4. 监控和告警

- 定期查看失败率（每日）
- 设置告警阈值（失败率 > 10%）
- 定期检查爬虫日志

---

## 附录

### A. 完整的API端点列表

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/admin/radar-sources` | GET | 获取所有信息源 |
| `/api/admin/radar-sources` | POST | 创建新信息源 |
| `/api/admin/radar-sources/:id` | GET | 获取单个信息源 |
| `/api/admin/radar-sources/:id` | PUT | 更新信息源 |
| `/api/admin/radar-sources/:id` | DELETE | 删除信息源 |
| `/api/admin/radar-sources/:id/toggle` | PATCH | 启用/禁用信息源 |
| `/api/admin/radar-sources/:id/test-crawl` | POST | 测试爬虫 |
| `/api/admin/radar-sources/stats/by-category` | GET | 统计信息 |

### B. 数据库表结构

#### radar_sources
```sql
CREATE TABLE radar_sources (
  id UUID PRIMARY KEY,
  source VARCHAR(255) NOT NULL,
  category VARCHAR(20) NOT NULL,
  url VARCHAR(1000) NOT NULL,
  type VARCHAR(20) NOT NULL,
  "peerName" VARCHAR(255),
  "isActive" BOOLEAN DEFAULT true,
  "crawlSchedule" VARCHAR(100) DEFAULT '0 3 * * *',
  "lastCrawledAt" TIMESTAMP,
  "lastCrawlStatus" VARCHAR(20) DEFAULT 'pending',
  "lastCrawlError" TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source, category)
);
```

#### raw_contents (新增字段)
```sql
ALTER TABLE raw_contents
ADD COLUMN complianceData JSONB;
```

#### analyzed_contents (新增字段)
```sql
ALTER TABLE analyzed_contents
ADD COLUMN complianceAnalysis JSONB;
```

### C. 相关文档

- [Story 4.1 完成报告](../STORY_4.1_IMPLEMENTATION_COMPLETE.md)
- [技术雷达配置指南](./tech-radar-setup.md)
- [行业雷达配置指南](./industry-radar-setup.md)

---

**文档维护**: 合规雷达功能变更时请及时更新本文档
**问题反馈**: 请联系系统管理员或开发团队
