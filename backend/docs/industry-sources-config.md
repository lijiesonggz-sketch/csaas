# 行业雷达信息源配置指南

**Story 3.1: 配置行业雷达的信息来源**

本文档说明如何配置和管理行业雷达的信息源，以便系统自动采集同业技术实践案例。

---

## 概述

行业雷达信息源用于采集金融同业的技术实践、投入成本、实施案例等信息。系统支持以下信息源类型：

1. **同业公众号** - 金融机构的技术类公众号文章
2. **招聘信息** - 从招聘网站推断同业使用的技术栈
3. **技术大会** - 行业技术大会的演讲和议程

---

## 信息源管理界面

### 访问路径

管理员可以通过以下路径访问信息源管理界面：

```
/radar/sources/manage
```

### 功能说明

- **添加信息源** - 配置新的行业雷达信息源
- **编辑信息源** - 修改现有信息源的配置
- **启用/禁用** - 控制信息源是否参与定时爬取
- **测试爬取** - 手动测试单个信息源的爬取功能
- **查看日志** - 查看爬取成功/失败的历史记录

---

## 信息源字段说明

### 基础字段

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| `name` | 字符串 | 是 | 信息源名称（如"杭州银行金融科技公众号"） |
| `category` | 枚举 | 是 | 固定为 `industry`（行业雷达） |
| `sourceType` | 枚举 | 是 | 信息源类型：`wechat`、`recruitment`、`conference` |
| `url` | 字符串 | 是 | 目标网址或搜索关键词 |
| `enabled` | 布尔 | 是 | 是否启用（默认true） |

### 行业雷达专用字段

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| `peerName` | 字符串 | 否 | 同业机构名称（如"杭州银行"） |
| `contentType` | 枚举 | 否 | 内容类型：`article`、`recruitment`、`conference` |

### 爬取配置

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| `crawlFrequency` | 枚举 | 否 | 爬取频率：`daily`、`weekly`、`monthly`（默认daily） |
| `maxRetries` | 数字 | 否 | 最大重试次数（默认3） |
| `timeout` | 数字 | 否 | 超时时间（秒，默认60） |

---

## 添加新信息源

### 示例1：同业公众号

```json
{
  "name": "杭州银行金融科技",
  "category": "industry",
  "sourceType": "wechat",
  "url": "https://mp.weixin.qq.com/profile?id=...",
  "peerName": "杭州银行",
  "contentType": "article",
  "enabled": true,
  "crawlFrequency": "daily"
}
```

**说明**：
- `peerName` 用于标注文章来自哪个同业机构
- 爬取频率设为每日（daily），每日凌晨3:00自动执行
- 爬取的文章将保存到 `RawContent` 表，category='industry'

### 示例2：招聘网站

```json
{
  "name": "拉勾网-金融机构招聘",
  "category": "industry",
  "sourceType": "recruitment",
  "url": "https://www.lagou.com/zhaopin/jinyong/",
  "contentType": "recruitment",
  "enabled": true,
  "crawlFrequency": "weekly"
}
```

**说明**：
- 爬取金融行业的招聘职位
- 系统会从职位描述中提取技术栈关键词（如"熟悉Kubernetes"）
- 推断该机构正在使用或计划使用这些技术
- `peerName` 会从招聘页面自动提取

### 示例3：技术大会

```json
{
  "name": "中国金融科技大会",
  "category": "industry",
  "sourceType": "conference",
  "url": "https://www.chinafintechsummit.com/",
  "contentType": "conference",
  "enabled": true,
  "crawlFrequency": "monthly"
}
```

**说明**：
- 爬取大会官网的议程和演讲内容
- 通常包含多个金融机构的技术分享
- 频率设为每月（monthly），会议相对固定

---

## 爬虫调度机制

### 定时任务配置

行业雷达爬虫使用 BullMQ 定时任务，默认配置：

```typescript
{
  name: 'industry-radar-daily-crawl',
  pattern: '0 3 * * *',  // 每日凌晨3:00执行
  timezone: 'Asia/Shanghai'
}
```

### 错峰执行策略

为避免资源冲突，不同雷达类型的爬虫错峰执行：

- **技术雷达爬虫** - 凌晨2:00执行
- **行业雷达爬虫** - 凌晨3:00执行（本Story）
- **合规雷达爬虫** - 凌晨4:00执行（未来实现）

### 爬取流程

1. **任务触发** - 定时任务每日凌晨3:00触发
2. **加载配置** - 从数据库加载所有启用的行业雷达信息源
3. **并发爬取** - 最多3个任务并发执行
4. **内容解析** - 根据 `sourceType` 选择不同的解析器
5. **保存数据** - 保存到 `RawContent` 表，设置 category='industry'
6. **触发分析** - 自动创建 AI 分析任务 `ai:analyze-content`
7. **记录日志** - 记录爬取成功/失败到 `CrawlerLog` 表

### 重试策略

爬取失败时，系统会自动重试：

- **重试次数** - 默认3次（可在信息源配置中修改）
- **重试间隔** - 指数退避（1分钟 → 2分钟 → 4分钟）
- **最终失败** - 记录到日志，管理员可查看失败原因

---

## 内容解析规则

### 招聘信息解析

系统会从招聘职位描述中提取技术栈：

**匹配模式**：
```regex
/(?:熟悉|精通|掌握|了解|使用|开发|应用)[\s:：]*([^。；,，\n]+)/g
```

**示例**：
```
职位描述：熟悉Kubernetes、Docker、微服务架构、分布式系统、Go语言

提取结果：["Kubernetes", "Docker", "微服务架构", "分布式系统", "Go语言"]
```

### 同业信息提取

系统会从文章内容中提取以下信息：

#### 1. 同业机构名称

从 `source` 字段推断：

```
"杭州银行金融科技公众号" → "杭州银行"
"招商银行数字化转型" → "招商银行"
```

#### 2. 投入成本

匹配模式：
```regex
/(?:投入|预算|花费|成本)[\s约为:：]*([0-9.-]+)\s*万/
```

示例：
- "投入120万" → 提取 "120万"
- "预算约80万" → 提取 "80万"

#### 3. 实施周期

匹配模式：
```regex
/(?:历时|用时|耗时|周期)[\s约为:：]*([0-9-]+)\s*(个月|月|周|天)/
```

示例：
- "历时6个月" → 提取 "6个月"
- "用时3周" → 提取 "3周"

#### 4. 技术效果

匹配关键词：`提升`、`降低`、`节省`、`缩短`、`提高`、`优化`

示例：
- "应用部署时间从2小时缩短到10分钟" → 提取该句
- "系统性能提升40%" → 提取该句

---

## 文件导入机制

除了爬虫自动采集，系统还支持**手动导入外部数据**。

### 导入目录

将 Markdown 文件放入以下目录：

```
backend/data-import/wechat-articles/    # 公众号文章
backend/data-import/website-crawl/      # 网站内容
```

### 文件格式

文件必须包含 **frontmatter** 元数据：

```markdown
---
source: "杭州银行金融科技公众号"
category: "industry"
url: "https://mp.weixin.qq.com/..."
publishDate: "2026-01-20"
peerName: "杭州银行"
contentType: "article"
---

# 杭州银行容器化改造实践

杭州银行于2025年启动容器化改造项目，投入120万，历时6个月...
```

### 必填字段

- `source` - 信息源名称
- `category` - 必须为 `industry`

### 可选字段

- `peerName` - 同业机构名称
- `contentType` - 内容类型（article/recruitment/conference）
- `url` - 原文链接
- `publishDate` - 发布日期
- `author` - 作者

### 处理流程

1. **文件监控** - chokidar 监控导入目录
2. **解析 frontmatter** - 提取元数据
3. **内容验证** - 检查必填字段、最小长度（100字符）
4. **保存数据** - 保存到 `RawContent` 表
5. **触发分析** - 创建 AI 分析任务
6. **移动文件** - 成功 → `processed/`，失败 → `failed/`

---

## 数据库表结构

### RawContent 表

行业雷达新增字段：

```typescript
@Column({ type: 'varchar', length: 50, nullable: true })
contentType?: string; // 'article' | 'recruitment' | 'conference'

@Column({ type: 'varchar', length: 255, nullable: true })
peerName?: string; // 同业机构名称
```

### 数据示例

```typescript
{
  id: "uuid",
  source: "拉勾网-金融机构招聘",
  category: "industry",
  title: "杭州银行 - 云原生架构师 (推断技术栈)",
  summary: "招聘要求：Kubernetes、Docker、微服务架构、分布式系统、Go",
  fullContent: "职位描述全文...",
  contentType: "recruitment",
  peerName: "杭州银行",
  organizationId: null,  // 公共内容
  status: "pending",     // 待AI分析
  createdAt: "2026-01-29T10:00:00Z"
}
```

---

## 最佳实践

### 1. 信息源命名规范

- 公众号：`{机构名称}金融科技公众号`
- 招聘网站：`{网站名称}-金融机构招聘`
- 技术大会：`{大会名称}`

### 2. URL 配置建议

- **公众号** - 使用公众号主页链接（需要实际测试爬取可行性）
- **招聘网站** - 使用搜索结果页URL，加上筛选条件（如"金融+科技"）
- **技术大会** - 使用官网首页或议程页面

### 3. 爬取频率设置

- **公众号** - 每日爬取（daily），及时获取最新文章
- **招聘网站** - 每周爬取（weekly），职位变化相对较慢
- **技术大会** - 每月爬取（monthly），大会相对固定

### 4. 同业机构维护

建议维护一个同业机构映射表，确保 `peerName` 一致性：

```typescript
const PEER_NAME_MAPPING = {
  '杭州银行金融科技': '杭州银行',
  '招商银行数字化转型': '招商银行',
  '建设银行科技创新': '建设银行',
  // ...更多映射
};
```

### 5. 监控和维护

- **定期检查日志** - 查看爬取失败的信息源，调整配置
- **评估解析准确性** - 招聘信息技术栈提取准确率应 ≥90%
- **更新URL** - 网站结构变化时及时更新URL配置
- **扩展信息源** - 根据业务需求定期添加新的同业信息源

---

## 故障排查

### 问题1：爬取失败

**可能原因**：
- 网站反爬虫机制（IP封禁、验证码）
- URL失效或网站结构变化
- 网络连接超时

**解决方案**：
- 检查 `CrawlerLog` 表中的错误信息
- 使用"测试爬取"功能手动验证
- 调整 User-Agent 或增加请求间隔
- 考虑使用代理IP池

### 问题2：技术栈提取不准确

**可能原因**：
- 职位描述格式不规范
- 正则表达式匹配不精确

**解决方案**：
- 检查实际的招聘页面HTML结构
- 扩展或调整正则表达式规则
- 添加更多测试用例验证准确性

### 问题3：文件导入失败

**可能原因**：
- frontmatter 格式错误
- 缺少必填字段
- 内容长度不足（<100字符）

**解决方案**：
- 检查 `data-import/*/failed/` 目录
- 查看 `.error.txt` 错误日志文件
- 按照文档格式修正文件后重新放入导入目录

---

## 相关文档

- [技术雷达信息采集架构](./tech-radar-collection.md) - Story 2.1
- [AI分析引擎设计](./ai-analysis-engine.md) - Story 2.2
- [雷达推送机制](./radar-push-mechanism.md) - Story 2.4

---

## 技术支持

如有疑问或需要技术支持，请联系：

- **开发团队** - dev@example.com
- **产品团队** - product@example.com
- **文档更新** - 2026-01-29

---

**版本**: 1.0.0
**Story**: 3.1 - 配置行业雷达的信息来源
**状态**: 已完成
