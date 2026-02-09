---
stepsCompleted: [1, 2, 3, 'all-stories-completed']
inputDocuments:
  - 'D:\csaas\_bmad-output\prd-unified.md'
  - 'D:\csaas\_bmad-output\epics.md'
completionDate: '2026-02-08'
epicId: 'epic-8'
epicName: '关注同业自动监控与智能分析'
---

# Epic 8: 关注同业自动监控与智能分析

## 概述

实现完整的关注同业自动监控功能，让系统能够主动采集用户关注的同业机构的技术动态、采购公告、案例报道，通过AI分析提取关键信息（技术方案、投入成本、实施效果），并生成个性化的同业动态推送。

## 背景与动机

### 当前状态
- 关注同业的基础CRUD已实现（添加/删除/列表）
- 但缺少**自动监控**功能：系统不会主动采集关注同业的信息
- 行业雷达的相关性匹配已存在，但依赖手动导入内容

### 目标
实现完整的关注同业自动监控功能，包括：
1. 自动采集关注同业的技术动态、采购公告、案例报道
2. AI分析提取关键信息（技术方案、投入成本、实施效果）
3. 生成个性化的同业动态推送
4. 管理后台监控爬虫健康度

## 关联的现有 EPIC

- **Epic 3: 行业雷达 - 同业标杆学习** - 本功能是对 Epic 3 的增强
- **Epic 5: 用户配置与推送管理** - 复用关注同业配置（Story 5.2）
- **Epic 7: 运营管理与成本优化** - 复用监控和告警机制

---

## 需求清单

### 功能需求 (FRs)

**FR-R16-1**: 系统必须支持配置同业采集源，包括官网、公众号、知乎、会议等来源类型

**FR-R16-2**: 系统必须自动定期采集关注同业的公开信息（每4小时检查一次）

**FR-R16-3**: 系统必须使用三模型AI共识机制分析采集的同业内容，提取技术方案、投入成本、实施效果

**FR-R16-4**: 系统必须根据AI分析结果生成个性化的同业动态推送

**FR-R16-5**: 系统必须提供管理后台监控爬虫健康度，包括成功率统计、异常告警

**FR-R16-6**: 系统必须支持采集源的测试、启用/停用管理

### 非功能需求 (NFRs)

**NFR-R16-1**: 爬虫采集成功率必须 ≥ 95%

**NFR-R16-2**: AI分析响应时间必须 < 30秒（三模型并行）

**NFR-R16-3**: 推送生成延迟必须 < 5秒

**NFR-R16-4**: 采集任务失败必须自动重试（最多3次，指数退避）

### 架构需求 (ARs)

**AR-R16-1**: 复用现有的 CrawlerService 和 BullMQ 队列架构

**AR-R16-2**: 复用现有的三模型AI共识机制（AIOrchestrator）

**AR-R16-3**: 新增 PeerCrawler 专用队列，与现有雷达队列隔离

**AR-R16-4**: 数据库实体必须支持多租户（tenantId字段）

---

## Story 列表

### Story R16.1: 同业采集源管理

**As a** 平台管理员,
**I want** 配置和管理同业采集源（官网、公众号、知乎、会议等）,
**So that** 系统可以自动采集关注同业的技术动态。

**Acceptance Criteria:**

**Given** 管理员访问同业采集管理后台
**When** 页面加载
**Then** 显示采集源列表，包含：同业机构名称、来源类型、采集URL、状态、上次采集时间、成功率

**Given** 管理员添加新的采集源
**When** 填写表单并提交
**Then** 创建 PeerCrawlerSource 记录：peerName、sourceType、sourceUrl、crawlConfig、crawlIntervalHours、isActive
**And** 支持选择器配置（CSS selector用于内容提取）
**And** 提示："采集源已创建"

**Given** 管理员编辑采集源
**When** 修改配置并保存
**Then** 更新 PeerCrawlerSource 记录
**And** 如果修改了采集间隔，重新调度定时任务

**Given** 管理员删除采集源
**When** 确认删除
**Then** 软删除 PeerCrawlerSource 记录
**And** 取消相关的定时任务

**Given** 管理员测试采集源
**When** 点击"测试采集"按钮
**Then** 立即执行一次采集任务
**And** 显示测试结果：成功/失败、采集到的内容预览、错误信息（如有）

---

### Story R16.2: 同业采集任务调度与执行

**As a** 系统,
**I want** 定期为关注同业创建和执行采集任务,
**So that** 自动获取同业的最新技术动态。

**Acceptance Criteria:**

**Given** 定时任务触发（每4小时）
**When** 任务执行
**Then** 查询所有活跃的 PeerCrawlerSource
**And** 检查每个 source 的 lastCrawlAt，判断是否需要新任务
**And** 创建 PeerCrawlerTask 记录：sourceId、peerName、tenantId、status='pending'、sourceType、targetUrl
**And** 将任务加入 radar-peer-crawler 队列

**Given** 采集任务从队列中取出
**When** Worker 开始处理
**Then** 更新 task status='running'
**And** 使用 CrawlerService 爬取目标URL内容
**And** 根据 crawlConfig 解析内容（标题、正文、发布日期、作者）

**Given** 采集成功
**When** 内容解析完成
**Then** 创建 RawContent 记录：source='peer-crawler'、category='industry'、peerName、contentType
**And** 更新 task status='completed'、crawlResult、rawContentId
**And** 更新 PeerCrawlerSource：lastCrawlAt、successCount++
**And** 触发AI分析任务

**Given** 采集失败
**When** 失败发生
**Then** 更新 task status='failed'、errorMessage
**And** 更新 PeerCrawlerSource：failCount++
**And** 如果 retryCount < 3，重新入队重试（指数退避）
**And** 如果重试耗尽，记录错误日志并通知管理员

---

### Story R16.3: 同业内容三模型AI分析

**As a** 系统,
**I want** 使用三模型AI共识机制分析同业内容,
**So that** 提取高质量的技术方案、成本、效果信息。

**Acceptance Criteria:**

**Given** 新的同业 RawContent 创建
**When** AI分析任务触发
**Then** 并行调用三个模型：GPT-4、Claude、通义千问
**And** 使用同业分析专用Prompt，要求提取：practiceDescription、estimatedCost、implementationPeriod、technicalEffect

**Given** 三模型返回分析结果
**When** 结果聚合
**Then** 执行三层质量验证：
  - Level 1: 结构一致性（字段完整性 ≥ 90%）
  - Level 2: 语义等价性（embedding相似度 ≥ 80%）
  - Level 3: 数值一致性（成本、周期数值差异 < 20%）
**And** 投票选择最佳结果

**Given** 质量验证通过
**When** 确定置信度
**Then** 计算 overallSimilarity
**And** 确定 confidence 等级：high(≥90%)、medium(70-90%)、low(<70%)
**And** 创建 AnalyzedContent 记录，包含AI分析结果

**Given** 质量验证不通过
**When** 置信度低
**Then** 触发半自动诊断流程
**And** 记录差异点供运营人员审核
**And** 使用通义千问单模型结果作为降级方案

---

### Story R16.4: 同业动态推送生成

**As a** 系统,
**I want** 基于AI分析结果生成个性化的同业动态推送,
**So that** 用户收到与其关注同业相关的内容。

**Acceptance Criteria:**

**Given** AnalyzedContent 创建完成（来自同业采集）
**When** 推送生成任务执行
**Then** 查询所有关注该同业的组织（WatchedPeer.peerName 匹配）
**And** 计算相关性评分：关注同业匹配权重 0.6、技术领域匹配权重 0.2、薄弱项匹配权重 0.2

**Given** 相关性计算完成
**When** 找到高相关的组织
**Then** 创建 RadarPush 记录：
  - radarType='industry'
  - pushType='peer-monitoring'（新增类型标识）
  - peerName
  - relevanceScore
  - priorityLevel
  - scheduledAt
  - status='scheduled'

**Given** 推送调度时间到达
**When** 准备发送推送
**Then** 查询所有待发送的同业动态推送
**And** 按 organizationId 分组，每个组织最多推送 3 条
**And** 通过 WebSocket 发送 'radar:push:new' 事件
**And** 更新 RadarPush.status='sent'

**Given** 推送内容包含同业信息
**When** 推送事件发送
**Then** 事件包含：
  - peerName（同业机构名称）
  - practiceDescription（实践描述）
  - estimatedCost（投入成本）
  - implementationPeriod（实施周期）
  - technicalEffect（技术效果）
  - pushType='peer-monitoring'（标识为同业监控推送）

---

### Story R16.5: 爬虫健康度监控与告警

**As a** 平台管理员,
**I want** 监控同业采集爬虫的健康度,
**So that** 及时发现和处理采集异常。

**Acceptance Criteria:**

**Given** 管理员访问爬虫健康度仪表板
**When** 页面加载
**Then** 显示整体状态卡片：healthy / warning / critical
**And** 显示采集源统计：总数、活跃数、停用数
**And** 显示最近任务统计：完成数、失败数、待执行数
**And** 显示24小时统计：采集次数、成功率、新内容数

**Given** 健康度计算
**When** 实时计算
**Then** 基于以下指标：
  - 成功率 < 90% → warning
  - 成功率 < 80% → critical
  - 连续失败 > 5次 → critical
  - 24小时无成功采集 → warning

**Given** 检测到异常
**When** 异常条件触发
**Then** 创建 Alert 记录：type='crawler'、severity、message、organizationId（如适用）
**And** 发送告警通知到管理员
**And** 在仪表板显示告警列表

**Given** 管理员查看采集任务日志
**When** 访问任务列表页面
**Then** 显示所有 PeerCrawlerTask 记录
**And** 支持筛选：status、peerName、dateRange
**And** 支持查看任务详情和错误日志

**Given** 管理员查看采集统计
**When** 访问统计页面
**Then** 显示成功率趋势图（最近30天）
**And** 显示各采集源的成功/失败对比
**And** 显示内容类型分布（文章/招聘/会议）

---

### Story R16.6: 同业动态前端展示增强

**As a** 金融机构 IT 总监,
**I want** 在行业雷达页面看到与我关注同业相关的动态,
**So that** 我可以及时了解标杆机构的技术实践。

**Acceptance Criteria:**

**Given** 用户访问 /radar/industry
**When** 页面加载
**Then** 显示同业动态推送卡片
**And** 卡片显示"与您关注的XX银行相关"标签
**And** 卡片显示同业实践详情：成本、周期、效果

**Given** 同业动态推送卡片显示
**When** 渲染卡片
**Then** 卡片包含：
  - 同业机构名称和logo（如有）
  - "同业动态"标签（区别于普通行业雷达内容）
  - 实践描述摘要
  - 投入成本、实施周期、技术效果
  - 相关性标注
  - 查看详情按钮

**Given** 用户点击"查看详情"
**When** 详情弹窗打开
**Then** 显示完整同业案例信息：
  - 同业机构背景
  - 技术实践详细描述
  - 投入成本/实施周期/效果
  - 可借鉴点总结
  - 信息来源和发布日期
  - 相关技术标签

**Given** 用户筛选关注同业
**When** 使用筛选器
**Then** 仅显示 peerName 匹配 WatchedPeer 的推送
**And** 高亮显示关注的同业机构名称

---

## 数据库设计

### 新实体：PeerCrawlerSource（同业采集源配置）

```typescript
@Entity('peer_crawler_sources')
export class PeerCrawlerSource {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  peerName: string // 同业机构名称

  @Column({ type: 'enum', enum: ['website', 'wechat', 'zhihu', 'conference'] })
  sourceType: string

  @Column()
  sourceUrl: string // 采集URL

  @Column({ type: 'jsonb', nullable: true })
  crawlConfig: {
    selector?: string // CSS选择器
    listSelector?: string // 列表页选择器
    titleSelector?: string
    contentSelector?: string
    dateSelector?: string
    authorSelector?: string
    paginationPattern?: string // 分页模式
    maxPages?: number
  }

  @Column({ type: 'int', default: 24 })
  crawlIntervalHours: number // 采集间隔

  @Column({ type: 'boolean', default: true })
  isActive: boolean

  @Column({ type: 'timestamp', nullable: true })
  lastCrawlAt: Date

  @Column({ type: 'int', default: 0 })
  successCount: number

  @Column({ type: 'int', default: 0 })
  failCount: number

  @Column({ type: 'uuid' })
  tenantId: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @DeleteDateColumn()
  deletedAt: Date
}
```

### 新实体：PeerCrawlerTask（同业采集任务）

```typescript
@Entity('peer_crawler_tasks')
export class PeerCrawlerTask {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  sourceId: string // 关联 PeerCrawlerSource

  @Column()
  peerName: string // 同业机构名称（冗余存储便于查询）

  @Column({ type: 'uuid' })
  tenantId: string

  @Column({ type: 'enum', enum: ['pending', 'running', 'completed', 'failed'] })
  status: string

  @Column({ type: 'enum', enum: ['website', 'wechat', 'zhihu', 'conference'] })
  sourceType: string

  @Column()
  targetUrl: string

  @Column({ type: 'jsonb', nullable: true })
  crawlResult: {
    title: string
    content: string
    publishDate: string
    author?: string
  }

  @Column({ type: 'uuid', nullable: true })
  rawContentId: string // 关联 RawContent

  @Column({ type: 'int', default: 0 })
  retryCount: number

  @Column({ type: 'text', nullable: true })
  errorMessage: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @DeleteDateColumn()
  deletedAt: Date
}
```

## API 设计

### 管理后台 API

```typescript
// GET /api/admin/peer-crawler/sources
// 获取同业采集源列表（支持筛选：peerName, sourceType, isActive）

// POST /api/admin/peer-crawler/sources
// 创建采集源
interface CreatePeerCrawlerSourceDto {
  peerName: string
  sourceType: 'website' | 'wechat' | 'zhihu' | 'conference'
  sourceUrl: string
  crawlConfig: object
  crawlIntervalHours: number
}

// PUT /api/admin/peer-crawler/sources/:id
// 更新采集源

// DELETE /api/admin/peer-crawler/sources/:id
// 删除采集源

// POST /api/admin/peer-crawler/sources/:id/test
// 测试采集源（立即执行一次采集）

// GET /api/admin/peer-crawler/tasks
// 获取采集任务列表（支持筛选：status, peerName, dateRange）

// GET /api/admin/peer-crawler/stats
// 获取采集统计（成功率、内容数量、趋势）

// GET /api/admin/peer-crawler/health
// 爬虫健康度检查
interface CrawlerHealthDto {
  overallStatus: 'healthy' | 'warning' | 'critical'
  sources: {
    total: number
    active: number
    inactive: number
  }
  recentTasks: {
    completed: number
    failed: number
    pending: number
  }
  last24h: {
    crawlCount: number
    successRate: number
    newContentCount: number
  }
}
```

## 定时任务配置

```typescript
// 使用 @nestjs/schedule

@Injectable()
export class PeerCrawlerScheduler {
  constructor(
    private readonly peerCrawlerService: PeerCrawlerService,
  ) {}

  // 每4小时检查一次，为需要采集的同业创建任务
  @Cron('0 */4 * * *')
  async schedulePeerCrawling() {
    await this.peerCrawlerService.createCrawlTasksForAllPeers()
  }

  // 每日凌晨生成同业动态推送
  @Cron('0 6 * * *')
  async generatePeerPushes() {
    await this.peerPushScheduler.generateDailyPeerPushes()
  }
}
```

## 文件清单

### 后端文件（12个）

| 文件 | 类型 | 说明 |
|------|------|------|
| `database/entities/peer-crawler-task.entity.ts` | 实体 | 采集任务实体 |
| `database/entities/peer-crawler-source.entity.ts` | 实体 | 采集源实体 |
| `database/repositories/peer-crawler-task.repository.ts` | 仓库 | 任务仓库 |
| `database/repositories/peer-crawler-source.repository.ts` | 仓库 | 采集源仓库 |
| `modules/radar/services/peer-crawler.service.ts` | 服务 | 同业采集核心服务 |
| `modules/radar/services/peer-content-analyzer.service.ts` | 服务 | 三模型AI分析 |
| `modules/radar/services/peer-push-scheduler.service.ts` | 服务 | 同业推送调度 |
| `modules/radar/processors/peer-monitoring.processor.ts` | 处理器 | BullMQ任务处理器 |
| `modules/radar/controllers/peer-crawler.controller.ts` | 控制器 | 管理后台API |
| `modules/radar/dto/peer-crawler-source.dto.ts` | DTO | 采集源DTO |
| `modules/radar/dto/peer-crawler-task.dto.ts` | DTO | 任务DTO |
| `modules/radar/schedulers/peer-crawler.scheduler.ts` | 调度器 | 定时任务 |

### 前端文件（3个）

| 文件 | 类型 | 说明 |
|------|------|------|
| `app/(admin)/admin/peer-crawler/page.tsx` | 页面 | 同业采集管理后台 |
| `components/radar/PeerCrawlerSourceForm.tsx` | 组件 | 采集源表单 |
| `components/radar/PeerCrawlerHealthDashboard.tsx` | 组件 | 健康度仪表板 |

### 修改文件（4个）

| 文件 | 修改内容 |
|------|----------|
| `lib/api/radar.ts` | 新增同业采集API方法 |
| `modules/radar/radar.module.ts` | 注册新服务、处理器、控制器 |
| `database/database.module.ts` | 注册新实体和仓库 |
| `app/radar/industry/page.tsx` | 增强同业动态展示 |

## 实施阶段

### 阶段1：核心采集（2周）
- PeerCrawlerService
- PeerMonitoringProcessor
- 管理后台API

### 阶段2：AI分析（1周）
- PeerContentAnalyzerService（三模型）
- 与现有AI模块集成

### 阶段3：推送集成（1周）
- PeerPushScheduler
- 与现有推送系统集成
- 前端展示增强

### 阶段4：监控完善（3天）
- 健康度仪表板
- 告警机制
- 性能优化

**总计：约4周**

---

## 验证计划

### 功能测试

1. **采集源管理**
   - [ ] 创建采集源成功
   - [ ] 测试采集源成功
   - [ ] 编辑采集源成功
   - [ ] 删除采集源成功

2. **自动采集**
   - [ ] 定时任务触发正常
   - [ ] 采集任务入队正常
   - [ ] 采集执行成功
   - [ ] 失败重试机制正常

3. **AI分析**
   - [ ] 三模型并行调用正常
   - [ ] 质量验证正常
   - [ ] 结果聚合正常
   - [ ] 置信度计算正常

4. **推送生成**
   - [ ] 相关性匹配正常
   - [ ] 推送生成正常
   - [ ] 用户接收推送正常

5. **管理后台**
   - [ ] 健康度显示正常
   - [ ] 统计数据准确
   - [ ] 告警机制正常

### 性能测试

- [ ] 100个关注同业的采集任务并发执行
- [ ] 三模型AI分析响应时间 < 30秒
- [ ] 推送生成时间 < 5秒

---

## 风险与应对

| 风险 | 概率 | 影响 | 应对策略 |
|------|------|------|----------|
| 爬虫被封禁 | 中 | 高 | 使用代理池、User-Agent轮换、请求频率控制 |
| 三模型成本过高 | 中 | 中 | 实现缓存机制、低置信度内容降级处理 |
| 采集内容质量低 | 中 | 中 | 增强AI提取Prompt、人工审核机制 |
| 同业网站结构变化 | 高 | 低 | 监控采集失败率、自动告警 |
