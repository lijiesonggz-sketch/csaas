---
epic: epic-8
story: 8-2-peer-crawler-task-scheduling
status: story-created
---

# Story 8.2: 同业采集任务调度与执行

## 用户故事

**As a** 系统,
**I want** 定期为关注同业创建和执行采集任务,
**So that** 自动获取同业的最新技术动态。

## 验收标准

### AC1: 定时任务调度
**Given** 定时任务触发（每4小时）
**When** 任务执行
**Then** 查询所有活跃的 RadarSource（category='industry'）
**And** 检查每个 source 的 lastCrawledAt 和 crawlSchedule，判断是否需要新任务
**And** 创建 PeerCrawlerTask 记录：sourceId、peerName、tenantId、status='pending'、sourceType、targetUrl
**And** 将任务加入 radar-crawl 队列（复用 Story 8.1 队列）

### AC2: 采集任务执行
**Given** 采集任务从队列中取出
**When** Worker 开始处理
**Then** 更新 task status='running'
**And** 使用 CrawlerService 爬取目标URL内容
**And** 根据 crawlConfig 解析内容（标题、正文、发布日期、作者）

### AC3: 采集成功处理
**Given** 采集成功
**When** 内容解析完成
**Then** 创建 RawContent 记录：
  - source = 'peer-crawler'
  - category = 'industry'
  - contentType = 'article'
  - metadata.peerName = 同业机构名称
**And** 更新 PeerCrawlerTask：
  - status = 'completed'
  - crawlResult = 解析结果（标题、正文、发布日期、作者）
  - rawContentId = 新创建的 RawContent.id
  - completedAt = 当前时间
**And** 更新 RadarSource（Story 8.1 实体）：
  - lastCrawledAt = 当前时间
  - lastCrawlStatus = 'success'
**And** 触发 Story 8.3 AI分析任务（创建 AI 分析队列任务）

### AC4: 采集失败处理
**Given** 采集失败
**When** 失败发生
**Then** 更新 PeerCrawlerTask：
  - status = 'failed'
  - errorMessage = 错误详情
  - retryCount++
**And** 更新 RadarSource（Story 8.1 实体）：
  - lastCrawlStatus = 'failed'
  - lastCrawlError = 错误摘要
**And** 创建 CrawlerLog 记录（复用现有日志表）
**And** 如果 retryCount < 3：
  - 使用 BullMQ 的 exponential backoff 重新入队
  - 延迟时间：2^retryCount 秒（2s, 4s, 8s）
**And** 如果 retryCount >= 3：
  - 记录错误日志
  - 触发 Story 8.5 告警机制（创建 Alert 记录）
  - 如果连续失败超过3次，自动禁用 RadarSource.isActive = false（复用 Story 8.1 逻辑）

## 技术规范

### 复用现有组件

**IMPORTANT: 本功能复用 Story 8.1 建立的采集基础设施，必须遵循以下复用规范：**

1. **RadarSource 实体** (`backend/src/database/entities/radar-source.entity.ts`)
   - Story 8.1 已扩展 RadarSource 支持同业采集
   - 使用 `category = 'industry'` 查询同业采集源
   - 复用 `crawlConfig` 字段获取选择器配置
   - 复用 `crawlSchedule` 字段获取调度配置

2. **Bull Queue 基础设施** (Story 8.1 已建立)
   - 复用现有的 `radar-crawl` 队列（不要创建新队列）
   - 复用 `RadarCrawlProcessor` 处理器模式
   - 复用队列配置（并发数、重试策略）

3. **CrawlerService** (`backend/src/modules/radar/services/crawler.service.ts`)
   - 复用 `crawlWebsite()` 方法执行采集
   - 复用 `parseArticleFromCheerio()` 进行内容解析
   - 复用 User-Agent 轮换和反爬虫机制

4. **CrawlerLog 实体** (`backend/src/database/entities/crawler-log.entity.ts`)
   - 使用现有日志表记录采集结果
   - 复用成功率/失败率统计逻辑

5. **RawContent 实体** (`backend/src/database/entities/raw-content.entity.ts`)
   - 采集内容存储到 RawContent 表
   - 使用 `category: 'industry'` 和 `contentType: 'article'`

### 数据库实体

**PeerCrawlerTask 实体 - 采集任务追踪**

```typescript
@Entity('peer_crawler_tasks')
export class PeerCrawlerTask {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  sourceId: string  // 关联 RadarSource.id

  @Column({ type: 'varchar', length: 255 })
  peerName: string  // 同业机构名称（冗余存储便于查询）

  @Column({ type: 'uuid' })
  tenantId: string  // 多租户隔离

  @Column({
    type: 'enum',
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending'
  })
  status: 'pending' | 'running' | 'completed' | 'failed'

  @Column({
    type: 'enum',
    enum: ['website', 'wechat', 'recruitment', 'conference']
  })
  sourceType: 'website' | 'wechat' | 'recruitment' | 'conference'

  @Column({ type: 'varchar', length: 1000 })
  targetUrl: string  // 采集目标URL

  @Column({ type: 'jsonb', nullable: true })
  crawlResult: {
    title: string
    content: string
    publishDate?: string
    author?: string
    url: string
  } | null

  @Column({ type: 'uuid', nullable: true })
  rawContentId: string | null  // 关联 RawContent.id

  @Column({ type: 'int', default: 0 })
  retryCount: number  // 当前重试次数

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null  // 失败错误信息

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null  // 任务开始时间

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null  // 任务完成时间

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @DeleteDateColumn()
  deletedAt: Date | null
}
```

**注意：**
- `sourceId` 关联 RadarSource 实体（Story 8.1 已建立）
- `sourceType` 与 RadarSource.type 保持一致（使用 recruitment 而非 zhihu）
- 添加 `startedAt` 和 `completedAt` 用于统计任务执行时长

### 定时任务配置

**PeerCrawlerScheduler - 定时任务调度器**

```typescript
@Injectable()
export class PeerCrawlerScheduler {
  constructor(
    private readonly peerCrawlerService: PeerCrawlerService,
    private readonly radarSourceRepository: RadarSourceRepository,
  ) {}

  /**
   * 每4小时检查一次，为需要采集的同业创建任务
   * 复用 Story 8.1 建立的 RadarSource 配置
   */
  @Cron('0 */4 * * *')
  async schedulePeerCrawling(): Promise<void> {
    const sources = await this.radarSourceRepository.findActiveIndustrySources()

    for (const source of sources) {
      // 检查是否需要采集（基于 crawlSchedule 和 lastCrawledAt）
      if (this.shouldCrawl(source)) {
        await this.peerCrawlerService.createTask(source)
      }
    }
  }

  /**
   * 判断采集源是否需要执行采集
   */
  private shouldCrawl(source: RadarSource): boolean {
    if (!source.lastCrawledAt) return true

    const intervalMs = this.parseCronToMs(source.crawlSchedule)
    const nextCrawlTime = new Date(source.lastCrawledAt.getTime() + intervalMs)

    return new Date() >= nextCrawlTime
  }
}
```

### BullMQ 队列配置

**复用 Story 8.1 建立的队列基础设施：**

- **队列名称**：`radar-crawl`（复用现有队列，不要新建）
- **任务类型**：`peer-crawl`（新增类型标识同业采集任务）
- **并发数**：5（与现有雷达采集共享并发配置）
- **重试策略**：指数退避（2s, 4s, 8s），最多3次

**Job 数据结构：**
```typescript
interface PeerCrawlJob {
  type: 'peer-crawl'
  taskId: string        // PeerCrawlerTask.id
  sourceId: string      // RadarSource.id
  peerName: string      // 同业机构名称
  tenantId: string      // 租户ID
  targetUrl: string     // 采集URL
  crawlConfig: object   // 选择器配置（来自 RadarSource.crawlConfig）
  retryCount: number    // 当前重试次数
}
```

**注意：**
- 复用 Story 8.1 的 Bull Queue 配置和连接
- 使用 jobId = `peer-${sourceId}-${timestamp}` 避免重复任务
- 任务处理器需区分 `type` 字段处理不同类型的采集任务

## 任务拆分

### Task 1: 后端开发
- [ ] 创建 PeerCrawlerTask 实体（见技术规范）
- [ ] 创建 PeerCrawlerTaskRepository，实现以下方法：
  - `findPendingTasks()` - 查询待处理任务
  - `findTasksBySourceId(sourceId)` - 按采集源查询
  - `updateTaskStatus(id, status, result?)` - 更新任务状态
- [ ] 实现 PeerCrawlerScheduler（定时任务调度）：
  - 每4小时执行一次
  - 查询 RadarSource（category='industry', isActive=true）
  - 根据 crawlSchedule 判断是否需要采集
  - 创建 PeerCrawlerTask 记录
  - 将任务加入 radar-crawl 队列
- [ ] 扩展 RadarCrawlProcessor（复用 Story 8.1）：
  - 添加对 `type: 'peer-crawl'` 任务的处理
  - 调用 CrawlerService.crawlWebsite() 执行采集
  - 根据 crawlConfig 解析内容
  - 处理成功/失败逻辑

### Task 2: 采集逻辑
- [ ] 实现 PeerCrawlerService：
  - `createTask(source: RadarSource)` - 创建采集任务
  - `executeTask(taskId: string)` - 执行采集任务
  - `parseContent(html, crawlConfig)` - 根据选择器解析内容
- [ ] 实现内容解析逻辑（根据 RadarSource.crawlConfig）：
  - titleSelector - 提取标题
  - contentSelector - 提取正文
  - dateSelector - 提取发布日期
  - authorSelector - 提取作者
- [ ] 实现失败重试机制（复用 BullMQ 指数退避）
- [ ] 实现 RawContent 创建：
  - 使用 `category: 'industry'`
  - 使用 `contentType: 'article'`
  - metadata 包含 peerName

### Task 3: 监控与日志
- [ ] 复用 CrawlerLog 记录采集日志（Story 8.1 已建立）
- [ ] 实现失败告警触发（集成 Story 8.5 告警机制）：
  - 重试耗尽时创建 Alert 记录
  - type='crawler', severity='high'
- [ ] 实现采集统计更新：
  - 更新 RadarSource.lastCrawledAt
  - 更新 RadarSource.lastCrawlStatus
  - 统计成功率/失败率

## 实现注意事项

### 关键设计决策

1. **复用 radar-crawl 队列而非创建新队列**
   - 理由：统一管理采集任务，便于资源控制和监控
   - 通过 job.data.type 区分任务类型（'radar-crawl' vs 'peer-crawl'）
   - 复用 Story 8.1 的队列配置和连接

2. **PeerCrawlerTask 与 RadarSource 的关系**
   - PeerCrawlerTask 记录每次采集任务的执行状态
   - RadarSource 记录采集源的配置和最后状态
   - 一对多关系：一个 RadarSource 可对应多个 PeerCrawlerTask

3. **与 Story 8.3 的集成点**
   - 采集成功后，将 taskId 和 rawContentId 加入 AI 分析队列
   - 触发三模型 AI 分析流程

### 常见陷阱

- **不要**创建新的 Bull Queue - 复用 Story 8.1 的 `radar-crawl` 队列
- **不要**修改 CrawlerService 的核心爬取逻辑 - 使用 crawlConfig 传递选择器
- **注意** sourceType 枚举值与 RadarSource.type 保持一致（使用 'recruitment' 而非 'zhihu'）
- **注意** 多租户隔离 - 所有查询必须包含 tenantId 过滤
- **注意** 任务幂等性 - 使用 jobId = `peer-${sourceId}-${timestamp}` 避免重复
