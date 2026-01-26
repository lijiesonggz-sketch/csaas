---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - 'D:\\csaas\\_bmad-output\\prd-radar-service.md'
  - 'D:\\csaas\\_bmad-output\\ux-design-specification-radar-service.md'
  - 'D:\\csaas\\_bmad-output\\index.md'
  - 'D:\\csaas\\_bmad-output\\project-overview.md'
  - 'D:\\csaas\\_bmad-output\\integration-architecture.md'
workflowType: 'architecture'
lastStep: 5
project_name: 'Radar Service (Csaas Module)'
user_name: '27937'
date: '2026-01-23'
parentSystem: 'Csaas'
integrationType: 'module'
---

# Architecture Decision Document - Radar Service

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

Radar Service 是 Csaas 平台的增值服务模块，提供三大智能雷达系统：

1. **技术雷达（周报，ROI 导向）** - 自动采集权威技术媒体 + AI 分析 + ROI 评估
2. **行业雷达（每日推送，学习标杆）** - 同业案例和标杆实践
3. **合规雷达（每日推送，最高优先级）** - 监管处罚回溯 + 政策预警

**核心机制：三重内容来源**
- 基于评估薄弱项（被动触发）- 与 Csaas 成熟度评估联动
- 主动关注技术领域 - 用户自定义
- 主动关注特定同业 - 持续监控

**Non-Functional Requirements:**
- 系统可用性：≥99.5%（MVP）
- AI 相关性准确率：≥80%
- 单客户月均 AI 成本：<500 元
- 推送延迟：合规 <2h、行业 <4h、技术 <24h
- 多租户数据隔离：4 层防御
- 金融合规：等保 2.0 三级（Growth）

**Scale & Complexity:**
- Primary domain: Full-stack + AI Orchestration + Data Pipeline
- Complexity: High
- MVP 核心：三大雷达、评估集成、基础多租户、ROI 引擎
- Growth 扩展：租户管理后台、白标输出、等保认证

### Technical Constraints & Dependencies

**集成约束：**
- 与 Csaas 深度集成（共享数据库、认证、WebSocket）
- 复用技术栈：NestJS + Next.js + PostgreSQL + Redis
- 遵循三模型 AI 架构

**数据依赖：**
- 薄弱项数据模型：简单标签（"数据安全-2级"）
- 同步机制：WebSocket 实时，5 分钟内可用
- 同步成功率：>99.9%

**外部依赖：**
- 爬虫架构：BullMQ + Worker + Redis
- AI：三模型并行，降级策略
- 推送：MVP 站内消��，Growth 多渠道

### Cross-Cutting Concerns

1. **AI 多模型共识** - 并发调用、超时控制、降级、成本控制
2. **信息采集爬虫** - BullMQ 队列、失败重试、多级降级
3. **ROI 分析引擎** - 数据来源、案例匹配、优先级排序
4. **多租户隔离** - 4 层防御、数据权利、审计日志
5. **白标输出** - 品牌定制、批量管理
6. **推送通知** - 多渠道、频率控制、历史查看
7. **统一导航** - 单一项目上下文、数据联动、引导流程
8. **金融合规** - 等保认证、数据本地化、免责声明
9. **核心数据模型** - 薄弱项、关注领域、同业动态、推送内容、ROI 分析
10. **可测试性** - 黄金测试集、渗透测试、端到端监控、可观测性层

## Technology Stack Decision

### Rationale: Module Integration Approach

Radar Service 是 Csaas 平台的增值服务模块，采用**深度集成模式**而非独立项目。这意味着：

**技术栈继承自父系统：**
- ✅ **Backend**: NestJS 10.4 + TypeORM + PostgreSQL + Redis + BullMQ
- ✅ **Frontend**: Next.js 14.2 + React 18 + Ant Design + Material-UI
- ✅ **AI Integration**: 三模型架构（GPT-4/Claude/Qwen）
- ✅ **Real-time**: Socket.io
- ✅ **Authentication**: 共享 Csaas 认证系统

**集成策略：**
- 共享数据库模式（同一 PostgreSQL 实例）
- 共享认证中间件（NestJS Guards + JWT）
- 共享 WebSocket Gateway（Socket.io）
- 共享 UI 组件库（Ant Design + Material-UI）

**不需要 Starter Template**：在现有 Csaas 项目中添加新模块，而非创建新项目。

## Core Architectural Decisions

### Decision 1: 数据架构 - 组织级别模型

**关键决策：引入 Organization（组织）概念**

Radar Service 是**组织级别**的服务，不是项目级别：
- 一个组织（金融机构）可以有多个评估项目
- 但 Radar Service 是组织级别的，一个组织只有一个雷达入口
- 薄弱项从多个项目聚合到组织级别

**核心实体设计：**

```typescript
// 新增：组织实体
Organization {
  id: string;
  name: string; // "某农商行"
  type: 'financial_institution' | 'consulting_company';
  createdAt: Date;
}

// 修改：Project 关联 Organization
Project {
  id: string;
  organizationId: string; // 新增：关联到组织
  name: string; // "数据安全评估项目"
  ...
}

// 新增：组织成员
OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: 'admin' | 'member' | 'viewer';
}

// 新增：薄弱项快照（组织级别）
WeaknessSnapshot {
  id: string;
  organizationId: string; // 组织级别
  projectId: string; // 来源项目
  category: string; // "数据安全"
  level: number; // 2
  description: string;
  identifiedAt: Date;
}

// 新增：雷达配置（组织级别）
RadarConfiguration {
  id: string;
  organizationId: string; // 组织级别，不是项目
  userId: string; // 配置所有者
  createdAt: Date;
}

// 新增：关注领域
WatchedTopic {
  id: string;
  radarConfigId: string;
  category: string; // "云原生"、"AI应用"
  source: 'manual' | 'auto'; // 手动配置 or 薄弱项自动
}

// 新增：关注同业
WatchedPeer {
  id: string;
  radarConfigId: string;
  peerName: string; // "杭州银行"
  peerType: 'benchmark' | 'competitor';
}

// 新增：推送内容
RadarPush {
  id: string;
  organizationId: string;
  radarType: 'tech' | 'industry' | 'compliance';
  title: string;
  summary: string;
  roiScore: number;
  relevanceScore: number;
  relatedWeaknesses: string[]; // 关联的薄弱项 ID
  pushedAt: Date;
}
```

**薄弱项聚合策略：智能聚合 + 用户可筛选**
- 默认：合并所有项目的薄弱项（取最低成熟度等级）
- 用户可筛选：只看特定项目的推送
- 示例：
  - 数据安全项目：数据安全-2级
  - 运维项目：数据安全-3级
  - 雷达推送：基于数据安全-2级（最薄弱）

**实施影响：**
- 需要创建 Organization 实体
- 需要重构 Project 关联到 Organization
- 需要创建 OrganizationMember 管理组织成员

---

### Decision 2: 信息采集架构 - 混合策略

**关键决策：开源爬虫 + 外部数据导入**

**架构设计：**

1. **爬虫技术选型**
   - 引用 GitHub 高星开源爬虫项目
   - 候选：Crawlee、Puppeteer-extra、Playwright
   - 降低开发风险，利用社区反爬经验

2. **外部数据导入机制**
   - **文件夹 1**: `backend/data-import/website-crawl/` - 外部采购的网站抓取信息（TXT/MD）
   - **文件夹 2**: `backend/data-import/wechat-articles/` - 外部采购的公众号文章（TXT/MD）
   - **文件监控服务**：使用 `chokidar` 监控文件夹变化，自动导入新文件

3. **统一信息处理流程**
   ```
   信息来源（3种）:
   ├── 开源爬虫自动采集 → BullMQ 队列
   ├── 网站抓取文件导入 → 文件监控 → BullMQ 队列
   └── 公众号文章导入 → 文件监控 → BullMQ 队列
                           ↓
                    统一信息处理 Worker
                           ↓
                    AI 分析 + 分类打标
   ```

4. **文件导入格式规范**
   ```markdown
   ---
   source: "GARTNER" | "信通院" | "IDC" | "公众号名称"
   category: "tech" | "industry" | "compliance"
   url: "原文链接"
   publishDate: "2026-01-23"
   ---

   # 文章标题

   文章内容...
   ```

**调度机制：**
- BullMQ 定时任务（cron job）每日触发
- 单 Worker + 动态并发控制（MVP）
- Growth 阶段可扩展为专用 Worker

**失败处理：**
- 主源失败 → 备用源 → 人工标记
- 指数退避重试（3 次）
- 失败记录 + 自动告警

---

### Decision 3: AI 分析流程 - 单模型简化

**关键决策：使用通义千问（Qwen）单模型**

**架构设计：**

1. **模型选择**
   - 使用通义千问（Qwen）作为唯一 AI 模型
   - 优势：
     - ✅ 成本低（相比 GPT-4/Claude）
     - ✅ 响应快（无需等待三模型共识）
     - ✅ 中文支持好（金融行业中文内容为主）
     - ✅ 简化架构（无需共识验证逻辑）

2. **与 Csaas 三模型架构的差异**
   - Csaas 核心评估：使用三模型共识（高准确性要求）
   - Radar Service 推送：使用单模型（速度和成本优先）

3. **质量保证机制**
   - 缓存 AI 结果（Redis，24 小时 TTL）
   - 人工抽查机制（MVP 阶段 10% 抽查率）
   - 用户反馈收集（推送内容评分）

4. **成本控制**
   - 预估：通义千问成本约为 GPT-4 的 1/10
   - 单客户月均成本：<50 元（远低于 500 元目标）
   - 批量处理：非实时任务合并调用

**AI 分析任务：**
- 内容分类打标（技术/行业/合规）
- 相关性评分（基于薄弱项匹配）
- ROI 分析（投入、收益、ROI 计算）
- 同业案例匹配

---

### Decision 4: 推送系统架构 - MVP 简化

**关键决策：MVP 仅站内消息**

**推送调度策略：**
- 技术雷达：每周五下午 5:00 推送
- 行业雷达：每日早上 9:00 推送
- 合规雷达：高相关内容立即推送（24/7）

**推送渠道：**
- **MVP 阶段**：仅站内消息（WebSocket）
  - 复用 Csaas 的 Socket.io Gateway
  - 推送到前端，显示在通知中心
- **Growth 阶段**：站内消息 + 邮件通知

**推送频率控制：**
- 单日推送上限：5 条（避免信息过载）
- 用户可配置推送时段（如：工作时间 9:00-18:00）
- 推送优先级：合规 > 行业 > 技术

**推送内容结构：**
```typescript
{
  id: string;
  organizationId: string;
  radarType: 'tech' | 'industry' | 'compliance';
  title: string;
  summary: string;
  roiScore: number;
  relevanceScore: number;
  priorityLevel: 1 | 2 | 3;
  relatedWeaknesses: string[];
  pushedAt: Date;
}
```

---

### Decision 5: 多租户隔离 - 混合模式

**关键决策：组织级别租户 + 4 层防御**

**租户模型：**
- **MVP 阶段**：Organization 级别隔离
- **Growth 阶段**：引入 Tenant 和 ConsultingCompany 实体
  ```typescript
  Tenant {
    id: string;
    consultingCompanyId: string; // 关联咨询公司
    organizationId: string; // 关联金融机构
    brandConfig: {
      logo: string;
      companyName: string;
      themeColor: string;
    };
  }

  ConsultingCompany {
    id: string;
    name: string;
    subscriptionTier: 'basic' | 'pro';
  }
  ```

**4 层防御机制：**
1. **Layer 1 - API 层**：NestJS Guards 校验 organizationId
   ```typescript
   @UseGuards(OrganizationGuard)
   @Get('/radar/pushes')
   async getPushes(@CurrentOrg() orgId: string) {
     // 自动注入当前用户的组织 ID
   }
   ```

2. **Layer 2 - 服务层**：TypeORM Repository 自动注入租户过滤
   ```typescript
   findAll(orgId: string) {
     return this.repository.find({
       where: { organizationId: orgId }
     });
   }
   ```

3. **Layer 3 - 数据库层**：PostgreSQL 行级安全策略（RLS）
   ```sql
   CREATE POLICY org_isolation ON radar_push
   USING (organization_id = current_setting('app.current_org_id')::uuid);
   ```

4. **Layer 4 - 审计层**：所有数据访问记录审计日志
   ```typescript
   AuditLog {
     userId: string;
     organizationId: string;
     action: 'read' | 'write' | 'delete';
     resource: string;
     timestamp: Date;
   }
   ```

**白标输出实现（Growth）：**
- 前端动态加载租户品牌配置（logo、主题色）
- 推送内容显示咨询公司品牌
- 完全隐藏 Csaas 标识

---

### Decision 6: 前端集成 - 组织级别路由

**关键决策：组织级别独立路由**

**路由结构：**
```
/dashboard                    # 总览（所有项目 + 雷达入口）
/radar/*                      # 雷达服务（组织级别）
  ├── /radar/dashboard        # 雷达总览（三大雷达入口）
  ├── /radar/tech             # 技术雷达
  ├── /radar/industry         # 行业雷达
  ├── /radar/compliance       # 合规雷达
  ├── /radar/history          # 推送历史
  └── /radar/settings         # 配置管理
/projects/:projectId/*        # 具体项目（评估）
```

**状态管理：**
- 复用 Csaas 的 Zustand stores
- 添加 `radarStore`：
  ```typescript
  interface RadarStore {
    currentOrganization: Organization;
    radarConfig: RadarConfiguration;
    pushes: RadarPush[];
    weaknesses: WeaknessSnapshot[];
    selectedProjects: string[]; // 用户筛选的项目
  }
  ```

**统一导航集成：**
- Dashboard 添加"雷达服务"入口卡片
- 顶部导航添加"雷达服务"菜单项
- 面包屑导航：`Dashboard / 雷达服务 / 技术雷达`

**薄弱项聚合 UI：**
- 默认显示：所有项目的合并薄弱项
- 筛选器：用户可选择特定项目
  ```
  [所有项目 ▼] [数据安全项目] [运维项目]

  当前薄弱项：
  - 数据安全-2级（来自：数据安全项目）
  - 网络安全-3级（来自：运维项目）
  ```

**UI 组件复用：**
- 复用 Csaas 的 Ant Design + Material-UI 组件
- 复用 Layout、Header、Sidebar 组件
- 保持视觉一致性

---

### Decision Impact Analysis

**实施顺序：**
1. **Phase 1 - 数据模型**：创建 Organization、WeaknessSnapshot、RadarConfiguration 等实体
2. **Phase 2 - 信息采集**：实现文件导入 + 开源爬虫集成
3. **Phase 3 - AI 分析**：集成通义千问 API + 缓存机制
4. **Phase 4 - 推送系统**：实现推送调度 + WebSocket 推送
5. **Phase 5 - 前端集成**：实现组织级别路由 + 雷达页面

**跨组件依赖：**
- Organization 实体是所有其他组件的基础
- WeaknessSnapshot 依赖 Project 评估数据
- 推送系统依赖 AI 分析结果
- 前端依赖后端 API 完成

**关键风险：**
- Organization 重构可能影响现有 Csaas 功能
- 需要数据迁移策略（现有 Project 关联到 Organization）

## Implementation Patterns & Consistency Rules

### Pattern Categories Overview

**识别的关键冲突点：** 12 个领域需要明确的一致性规则

### Naming Patterns

**Database Naming Conventions (继承自 Csaas):**
- 表名：snake_case 复数形式（`organizations`, `radar_pushes`, `weakness_snapshots`）
- 列名：snake_case（`organization_id`, `created_at`, `radar_type`）
- 外键：`{table}_id` 格式（`organization_id`, `project_id`）
- 索引：`idx_{table}_{column}` 格式（`idx_radar_pushes_organization_id`）
- 枚举类型：snake_case（`radar_type_enum`, `organization_type_enum`）

**API Naming Conventions (继承自 Csaas):**
- REST 端点：复数形式（`/api/radar/pushes`, `/api/radar/configurations`）
- 路由参数：`:id` 格式（`/api/radar/pushes/:id`）
- 查询参数：camelCase（`?organizationId=xxx&radarType=tech`）
- HTTP 方法：标准 RESTful（GET, POST, PUT, DELETE）

**Code Naming Conventions (继承自 Csaas):**
- 实体文件：kebab-case（`radar-push.entity.ts`, `weakness-snapshot.entity.ts`）
- 服务文件：kebab-case（`radar-push.service.ts`, `info-crawler.service.ts`）
- 控制器文件：kebab-case（`radar.controller.ts`）
- 组件文件：PascalCase（`RadarDashboard.tsx`, `PushHistoryList.tsx`）
- 类名：PascalCase（`RadarPush`, `WeaknessSnapshot`, `InfoCrawlerService`）
- 函数名：camelCase（`aggregateWeaknesses`, `calculateROI`, `sendPushNotification`）
- 变量名：camelCase（`organizationId`, `radarConfig`, `pushContent`）

### Structure Patterns

**Backend Module Organization (NestJS):**
```
backend/src/modules/radar/
├── entities/
│   ├── organization.entity.ts
│   ├── radar-configuration.entity.ts
│   ├── weakness-snapshot.entity.ts
│   ├── radar-push.entity.ts
│   ├── watched-topic.entity.ts
│   └── watched-peer.entity.ts
├── services/
│   ├── radar-push.service.ts
│   ├── weakness-aggregator.service.ts
│   ├── roi-analyzer.service.ts
│   └── push-scheduler.service.ts
├── controllers/
│   └── radar.controller.ts
├── dto/
│   ├── create-radar-config.dto.ts
│   └── push-response.dto.ts
└── radar.module.ts

backend/src/modules/info-crawler/
├── services/
│   ├── crawler-scheduler.service.ts
│   ├── file-import.service.ts
│   └── info-processor.service.ts
├── workers/
│   └── info-crawler.worker.ts
└── info-crawler.module.ts

backend/data-import/
├── website-crawl/          # 外部采购的网站抓取
└── wechat-articles/        # 外部采购的公众号文章
```

**Frontend Component Organization (Next.js):**
```
frontend/app/radar/
├── dashboard/
│   └── page.tsx            # 雷达总览
├── tech/
│   └── page.tsx            # 技术雷达
├── industry/
│   └── page.tsx            # 行业雷达
├── compliance/
│   └── page.tsx            # 合规雷达
├── history/
│   └── page.tsx            # 推送历史
└── settings/
    └── page.tsx            # 配置管理

frontend/components/radar/
├── RadarDashboard.tsx
├── PushCard.tsx
├── WeaknessAggregator.tsx
├── TopicSelector.tsx
└── PeerSelector.tsx

frontend/lib/stores/
└── radarStore.ts           # Zustand store
```

**Test Organization (继承自 Csaas):**
- 单元测试：与源文件同目录（`radar-push.service.spec.ts`）
- E2E 测试：`backend/test/` 目录
- 前端测试：`frontend/__tests__/` 目录

### Format Patterns

**API Response Format (继承自 Csaas):**
```typescript
// 成功响应
{
  data: {
    id: "uuid",
    organizationId: "uuid",
    radarType: "tech",
    title: "零信任架构推荐",
    summary: "...",
    roiScore: 8.5,
    relevanceScore: 0.92,
    pushedAt: "2026-01-23T10:00:00Z"
  }
}

// 错误响应
{
  error: {
    code: "RADAR_001",
    message: "Organization not found",
    details: {...}
  }
}

// 分页响应
{
  data: [...],
  meta: {
    total: 100,
    page: 1,
    pageSize: 20
  }
}
```

**Date/Time Format:**
- API 传输：ISO 8601 字符串（`2026-01-23T10:00:00Z`）
- 数据库存储：PostgreSQL TIMESTAMP WITH TIME ZONE
- 前端显示：根据用户时区格式化

**JSON Field Naming:**
- API 响应：camelCase（`organizationId`, `radarType`, `pushedAt`）
- 数据库：snake_case（`organization_id`, `radar_type`, `pushed_at`）
- TypeORM 自动转换：使用 `@Column({ name: 'organization_id' })`

### Radar Service Specific Patterns

**薄弱项聚合规则：**
```typescript
// 聚合逻辑：取最低成熟度等级
function aggregateWeaknesses(
  projectWeaknesses: WeaknessSnapshot[]
): WeaknessSnapshot[] {
  const grouped = groupBy(projectWeaknesses, 'category');

  return Object.entries(grouped).map(([category, items]) => ({
    category,
    level: Math.min(...items.map(w => w.level)), // 取最低
    projects: items.map(w => w.projectId)
  }));
}
```

**推送内容结构：**
```typescript
interface RadarPushContent {
  // 基础信息
  id: string;
  organizationId: string;
  radarType: 'tech' | 'industry' | 'compliance';

  // 内容
  title: string;
  summary: string;
  fullContent: string;
  sourceUrl: string;

  // 评分
  roiScore: number;        // 0-10
  relevanceScore: number;  // 0-1
  priorityLevel: 1 | 2 | 3;

  // 关联
  relatedWeaknesses: string[];  // WeaknessSnapshot IDs
  relatedProjects: string[];    // Project IDs

  // 元数据
  pushedAt: Date;
  readAt: Date | null;
  source: string;
}
```

**文件导入格式规范：**
```markdown
---
source: "GARTNER" | "信通院" | "IDC" | "公众号名称"
category: "tech" | "industry" | "compliance"
url: "https://..."
publishDate: "2026-01-23"
author: "作者名称"
---

# 文章标题

## 摘要
简短摘要...

## 正文
详细内容...

## 关键词
云原生, 零信任, 数据安全
```

**Redis 缓存键命名：**
```typescript
// AI 分析结果缓存
`radar:ai:analysis:${contentHash}` // TTL: 24h

// 薄弱项缓存
`radar:weaknesses:${organizationId}` // TTL: 1h

// 推送内容缓存
`radar:pushes:${organizationId}:${radarType}` // TTL: 30min

// 用户配置缓存
`radar:config:${userId}` // TTL: 1h
```

### Communication Patterns

**WebSocket Event Naming (继承自 Csaas):**
```typescript
// 推送通知事件
'radar:push:new' // 新推送
'radar:push:read' // 推送已读
'radar:weakness:updated' // 薄弱项更新

// 事件 Payload
interface RadarPushEvent {
  type: 'radar:push:new';
  data: {
    organizationId: string;
    push: RadarPushContent;
  };
  timestamp: string;
}
```

**BullMQ Job Naming:**
```typescript
// 爬虫任务
'crawler:tech-radar'
'crawler:industry-radar'
'crawler:compliance-radar'

// 文件导入任务
'import:website-crawl'
'import:wechat-articles'

// AI 分析任务
'ai:analyze-content'
'ai:calculate-roi'

// 推送任务
'push:schedule-tech'
'push:schedule-industry'
'push:schedule-compliance'
```

**State Management (Zustand):**
```typescript
interface RadarStore {
  // 状态
  currentOrganization: Organization | null;
  radarConfig: RadarConfiguration | null;
  pushes: RadarPush[];
  weaknesses: WeaknessSnapshot[];
  selectedProjects: string[];

  // Actions
  setOrganization: (org: Organization) => void;
  loadPushes: (orgId: string) => Promise<void>;
  aggregateWeaknesses: (projectIds: string[]) => void;
  markPushAsRead: (pushId: string) => Promise<void>;
}
```

### Process Patterns

**Error Handling:**
```typescript
// 自定义错误类
class RadarServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
  }
}

// 错误码规范
'RADAR_001' // Organization not found
'RADAR_002' // Weakness aggregation failed
'RADAR_003' // AI analysis timeout
'RADAR_004' // Push delivery failed
'RADAR_005' // File import format invalid

// 错误处理
try {
  await radarService.sendPush(pushContent);
} catch (error) {
  if (error instanceof RadarServiceError) {
    logger.error(`Radar error: ${error.code}`, error.details);
    throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
  }
  throw error;
}
```

**Loading State Patterns:**
```typescript
// 前端 Loading 状态
interface LoadingState {
  isLoading: boolean;
  loadingMessage?: string;
  progress?: number; // 0-100
}

// 使用示例
const [loading, setLoading] = useState<LoadingState>({
  isLoading: false
});

// 加载推送
setLoading({ isLoading: true, loadingMessage: '加载推送内容...' });
await loadPushes();
setLoading({ isLoading: false });
```

**Retry Patterns:**
```typescript
// 爬虫失败重试
const RETRY_CONFIG = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000 // 2s, 4s, 8s
  }
};

// AI API 调用重试
const AI_RETRY_CONFIG = {
  attempts: 2,
  timeout: 5 * 60 * 1000 // 5 分钟
};
```

### Enforcement Guidelines

**所有 AI 代理必须遵守：**

1. **数据库实体必须使用 TypeORM 装饰器**
   ```typescript
   @Entity('radar_pushes')
   export class RadarPush {
     @PrimaryGeneratedColumn('uuid')
     id: string;

     @Column({ name: 'organization_id' })
     organizationId: string;
   }
   ```

2. **API 端点必须使用 NestJS 装饰器和 DTO 验证**
   ```typescript
   @Controller('radar')
   export class RadarController {
     @Get('pushes')
     @UseGuards(OrganizationGuard)
     async getPushes(@CurrentOrg() orgId: string) {
       return this.radarService.findPushes(orgId);
     }
   }
   ```

3. **前端组件必须使用 TypeScript 严格模式**
   ```typescript
   interface RadarDashboardProps {
     organizationId: string;
     initialPushes?: RadarPush[];
   }

   export default function RadarDashboard({
     organizationId,
     initialPushes = []
   }: RadarDashboardProps) {
     // ...
   }
   ```

4. **所有异步操作必须有错误处理**
   ```typescript
   try {
     const result = await aiService.analyzeContent(content);
     return result;
   } catch (error) {
     logger.error('AI analysis failed', error);
     throw new RadarServiceError('RADAR_003', 'AI analysis timeout');
   }
   ```

5. **多租户数据访问必须包含 organizationId 过滤**
   ```typescript
   // ❌ 错误：没有租户过滤
   await this.repository.find();

   // ✅ 正确：包含租户过滤
   await this.repository.find({
     where: { organizationId }
   });
   ```

**Pattern Verification:**
- ESLint 规则强制命名规范
- TypeScript 严格模式检查类型
- 代码审查检查多租户隔离
- 单元测试验证错误处理

### Pattern Examples

**Good Example - 创建推送内容：**
```typescript
// ✅ 正确的实现
@Injectable()
export class RadarPushService {
  async createPush(
    organizationId: string,
    pushData: CreatePushDto
  ): Promise<RadarPush> {
    // 1. 验证组织存在
    const org = await this.orgRepository.findOne({
      where: { id: organizationId }
    });
    if (!org) {
      throw new RadarServiceError('RADAR_001', 'Organization not found');
    }

    // 2. 创建推送
    const push = this.repository.create({
      ...pushData,
      organizationId,
      pushedAt: new Date()
    });

    // 3. 保存并发送通知
    await this.repository.save(push);
    await this.notificationService.sendPush(organizationId, push);

    return push;
  }
}
```

**Anti-Pattern - 避免的错误：**
```typescript
// ❌ 错误 1：没有租户隔离
async getAllPushes() {
  return this.repository.find(); // 会返回所有组织的数据！
}

// ❌ 错误 2：硬编码错误消息
throw new Error('Something went wrong'); // 应该使用错误码

// ❌ 错误 3：不一致的命名
const user_id = req.params.userId; // 混用 snake_case 和 camelCase

// ❌ 错误 4：没有错误处理
const result = await aiService.analyze(content); // 如果失败会崩溃

// ❌ 错误 5：直接暴露内部结构
return push; // 应该使用 DTO 转换
```

**Good Example - 薄弱项聚合：**
```typescript
// ✅ 正确的实现
@Injectable()
export class WeaknessAggregatorService {
  async aggregateForOrganization(
    organizationId: string,
    projectIds?: string[]
  ): Promise<WeaknessSnapshot[]> {
    // 1. 获取组织的所有项目（或指定项目）
    const projects = projectIds
      ? await this.projectRepository.findByIds(projectIds)
      : await this.projectRepository.find({
          where: { organizationId }
        });

    // 2. 获取所有项目的薄弱项
    const allWeaknesses = await this.weaknessRepository.find({
      where: {
        organizationId,
        projectId: In(projects.map(p => p.id))
      }
    });

    // 3. 按类别聚合，取最低成熟度
    const grouped = groupBy(allWeaknesses, 'category');

    return Object.entries(grouped).map(([category, items]) => ({
      category,
      level: Math.min(...items.map(w => w.level)),
      organizationId,
      projectIds: items.map(w => w.projectId),
      identifiedAt: new Date()
    }));
  }
}
```
