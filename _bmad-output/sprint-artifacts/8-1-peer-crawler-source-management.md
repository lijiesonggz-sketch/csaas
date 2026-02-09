---
epic: epic-8
story: 8-1-peer-crawler-source-management
status: story-created
---

# Story 8.1: 同业采集源管理

## 用户故事

**As a** 平台管理员,
**I want** 配置和管理同业采集源（官网、公众号、知乎、会议等）,
**So that** 系统可以自动采集关注同业的技术动态。

## 验收标准

### AC1: 采集源列表展示
**Given** 管理员访问同业采集管理后台
**When** 页面加载
**Then** 显示采集源列表，包含：同业机构名称、来源类型、采集URL、状态、上次采集时间、成功率
**And** 列表仅显示 `category = 'industry'` 的雷达源
**And** 支持按来源类型（website/wechat/recruitment/conference）筛选

### AC2: 创建采集源
**Given** 管理员添加新的采集源
**When** 填写表单并提交
**Then** 创建 RadarSource 记录，category 固定为 'industry'：
  - source: 同业机构名称
  - type: 来源类型（website/wechat/recruitment/conference）
  - url: 采集URL
  - crawlConfig: 选择器配置（JSONB）
  - crawlSchedule: cron表达式（如"0 */6 * * *"表示每6小时）
  - isActive: 是否启用
**And** 支持选择器配置（CSS selector用于内容提取）
**And** 提示："采集源已创建"
**And** 如果 isActive=true，自动加入爬虫调度队列

### AC3: 编辑采集源
**Given** 管理员编辑采集源
**When** 修改配置并保存
**Then** 更新 RadarSource 记录
**And** 如果修改了 crawlSchedule，重新调度定时任务
**And** 如果 isActive 从 false 改为 true，立即加入爬虫队列
**And** 如果 isActive 从 true 改为 false，从爬虫队列中移除

### AC4: 删除采集源
**Given** 管理员删除采集源
**When** 确认删除
**Then** 软删除 RadarSource 记录（设置 deletedAt）
**And** 取消相关的定时任务
**And** 保留历史采集数据（RawContent 记录不受影响）

### AC5: 测试采集源
**Given** 管理员测试采集源
**When** 点击"测试采集"按钮
**Then** 调用 CrawlerService.crawlWebsite() 立即执行一次采集任务
**And** 显示测试结果：
  - 成功/失败状态
  - 采集到的内容预览（标题、摘要、正文前500字）
  - 错误信息（如有）
  - 采集耗时
**And** 测试采集的内容不保存到 RawContent（仅预览）
**And** 更新 RadarSource.lastCrawlStatus 和 lastCrawlError

### AC6: 错误处理
**Given** 采集任务执行失败
**When** 系统捕获到异常
**Then** 记录错误到 CrawlerLog 表
**And** 更新 RadarSource.lastCrawlStatus = 'failed' 和 lastCrawlError
**And** 如果连续失败超过3次，自动禁用该采集源（isActive = false）
**And** 发送告警通知管理员

## 技术规范

### 复用现有组件

**IMPORTANT: 本功能基于现有雷达采集基础设施构建，必须复用以下组件：**

1. **RadarSource 实体** (`backend/src/database/entities/radar-source.entity.ts`)
   - 已存在的信息源配置表
   - 本故事的 PeerCrawlerSource 应作为 RadarSource 的扩展或专用实例
   - 使用 `category: 'industry'` 标识同业采集源

2. **CrawlerService** (`backend/src/modules/radar/services/crawler.service.ts`)
   - 使用现有的 CheerioCrawler 实现
   - 复用 User-Agent 轮换和反爬虫机制
   - 复用 parseArticleFromCheerio 方法进行内容提取

3. **CrawlerLog 实体** (`backend/src/database/entities/crawler-log.entity.ts`)
   - 使用现有爬虫日志表记录采集结果
   - 复用成功率/失败率统计

4. **RawContent 实体** (`backend/src/database/entities/raw-content.entity.ts`)
   - 采集的内容应存储到 RawContent 表
   - 使用 `category: 'industry'` 和 `contentType: 'article'`

### 数据库实体

**方案：扩展 RadarSource 实体，添加同业采集专用配置字段**

```typescript
@Entity('radar_sources')
export class RadarSource {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 255 })
  source: string  // 同业机构名称，如"杭州银行金融科技"

  @Column({
    type: 'enum',
    enum: ['tech', 'industry', 'compliance'],
  })
  category: 'tech' | 'industry' | 'compliance'  // 同业采集使用 'industry'

  @Column({ type: 'varchar', length: 1000 })
  url: string  // 采集URL

  @Column({
    type: 'enum',
    enum: ['wechat', 'recruitment', 'conference', 'website'],
  })
  type: 'wechat' | 'recruitment' | 'conference' | 'website'  // 来源类型

  @Column({ type: 'varchar', length: 255, nullable: true })
  peerName?: string  // 同业机构名称

  @Column({ type: 'boolean', default: true })
  isActive: boolean  // 是否启用

  @Column({ type: 'varchar', length: 100, default: '0 3 * * *' })
  crawlSchedule: string  // cron表达式，如"0 */6 * * *"表示每6小时

  @Column({ type: 'timestamp', nullable: true })
  lastCrawledAt?: Date  // 上次采集时间

  @Column({
    type: 'enum',
    enum: ['pending', 'success', 'failed'],
    default: 'pending',
  })
  lastCrawlStatus: 'pending' | 'success' | 'failed'  // 上次采集状态

  @Column({ type: 'text', nullable: true })
  lastCrawlError?: string  // 上次采集错误信息

  // 同业采集专用配置（新增字段）
  @Column({ type: 'jsonb', nullable: true })
  crawlConfig?: {
    selector?: string           // 内容选择器
    listSelector?: string       // 列表选择器
    titleSelector?: string      // 标题选择器
    contentSelector?: string    // 正文选择器
    dateSelector?: string       // 日期选择器
    authorSelector?: string     // 作者选择器
    paginationPattern?: string  // 分页模式
    maxPages?: number           // 最大页数
  }

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
```

**注意：**
- 复用现有 `radar_sources` 表，不创建新表
- 通过 `category = 'industry'` 区分同业采集源
- 通过 `type` 字段区分官网、公众号、知乎、会议等来源
- `crawlConfig` 字段为 JSONB 类型，存储选择器配置

### API 端点

**复用现有 RadarSourceController 端点** (`backend/src/modules/radar/controllers/radar-source.controller.ts`):

- `GET /api/radar/sources?category=industry` - 获取同业采集源列表（添加 category 过滤）
- `POST /api/radar/sources` - 创建同业采集源（category 固定为 'industry'）
- `PUT /api/radar/sources/:id` - 更新采集源
- `DELETE /api/radar/sources/:id` - 删除采集源
- `POST /api/radar/sources/:id/test` - 测试采集源（新增端点）

**新增 DTO 字段**: 在 `CreateRadarSourceDto` 和 `UpdateRadarSourceDto` 中添加 `crawlConfig` JSONB 字段支持。

**权限控制**: 使用 `@Roles('admin')` 限制仅平台管理员可访问。

## 任务拆分

### Task 1: 后端开发
- [ ] 扩展 RadarSource 实体，添加 crawlConfig JSONB 字段
- [ ] 创建数据库迁移脚本（添加 crawl_config 列）
- [ ] 更新 CreateRadarSourceDto，添加 crawlConfig 字段验证
- [ ] 更新 UpdateRadarSourceDto，添加 crawlConfig 字段验证
- [ ] 在 RadarSourceController 添加测试采集端点 `POST /api/radar/sources/:id/test`
- [ ] 在 RadarSourceService 实现 testCrawl() 方法：
  - 调用 CrawlerService.crawlWebsite() 执行采集
  - 返回预览数据，不保存到 RawContent
  - 更新 RadarSource 的 lastCrawlStatus 和 lastCrawlError
- [ ] 实现定时任务调度（基于 Bull Queue）：
  - 创建时：如果 isActive=true，添加到调度队列
  - 更新时：如果 crawlSchedule 变更，重新调度
  - 删除时：从调度队列中移除
- [ ] 实现错误处理和自动禁用逻辑（连续失败3次自动禁用）

### Task 2: 前端开发
- [ ] 创建同业采集管理后台页面 `/admin/peer-crawler`
- [ ] 实现采集源列表组件：
  - 调用 `GET /api/radar/sources?category=industry` 获取列表
  - 显示：同业机构名称、来源类型、采集URL、状态、上次采集时间、成功率
  - 支持按来源类型筛选
- [ ] 实现采集源表单组件（创建/编辑）：
  - 字段：source（机构名称）、type（来源类型）、url、crawlSchedule、crawlConfig（JSON编辑器）、isActive
  - 创建时 category 固定为 'industry'
- [ ] 实现测试采集功能：
  - 调用 `POST /api/radar/sources/:id/test`
  - 显示测试结果弹窗（标题、摘要、正文预览、错误信息、耗时）
- [ ] 复用现有雷达源管理组件（如适用）

### Task 3: 集成测试
- [ ] 测试采集源 CRUD 操作（使用现有 RadarSource 端点）
- [ ] 测试采集源测试功能（testCrawl 端点）
- [ ] 测试定时任务调度（创建/更新/删除时队列行为）
- [ ] 测试错误处理和自动禁用逻辑
- [ ] 验证与现有 CrawlerService 集成

## 实现注意事项

### 关键设计决策

1. **复用 RadarSource 而非创建新表**
   - 理由：同业采集与雷达采集本质相同，都是定时爬取外部内容
   - 通过 `category = 'industry'` 区分，避免数据冗余
   - 复用现有基础设施（CrawlerService、CrawlerLog、定时任务队列）

2. **crawlSchedule 使用 cron 表达式而非小时数**
   - 理由：提供更灵活的调度能力（如工作日执行、特定时间点）
   - 与现有 RadarSource 设计保持一致
   - 前端可提供常用选项（每6小时、每天、每周）映射到 cron

3. **测试采集不保存数据**
   - 理由：避免测试数据污染生产数据
   - 仅预览验证配置是否正确
   - 正式采集仍通过定时任务执行

### 常见陷阱

- **不要**创建新的实体类或数据库表 - 复用 RadarSource
- **不要**创建新的 Service 处理采集逻辑 - 复用 CrawlerService
- **不要**修改 CrawlerService 的核心爬取逻辑 - 使用 crawlConfig 传递选择器配置
- **注意** CrawlerService.crawlWebsite 的 category 参数应传入 'industry'
- **注意** 定时任务使用 Bull Queue，需要正确处理重复任务（使用 jobId = sourceId）
