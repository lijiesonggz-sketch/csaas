# Story 2.1: 自动采集技术信息并支持外部导入

**Epic**: Epic 2 - 技术雷达 - ROI导向的技术决策支持
**Story ID**: 2.1
**Story Key**: 2-1-automatically-collect-technical-information-and-support-external-import
**状态**: done
**优先级**: P0 (最高 - Epic 2的基础)
**预计时间**: 4-5天
**依赖**: Epic 1 (已完成 - Organization模型、认证体系、薄弱项识别)

---

## 用户故事

**As a** 系统管理员
**I want** 建立混合信息采集架构（开源爬虫 + 文件导入）
**So that** 系统可以自动采集技术信息，并支持外部数据导入

---

## 业务价值

### 为什么这个故事很重要?

1. **Epic 2的基础设施**: 这是技术雷达的第一个Story，建立信息采集基础架构
2. **可复用性**: Epic 3(行业雷达)和Epic 4(合规雷达)将复用本Story的采集机制
3. **混合策略**: 开源爬虫(自动化) + 文件导入(灵活性)，降低开发风险
4. **降低成本**: 避免从零开发爬虫，利用社区反爬经验

### 成功指标

- ✅ BullMQ定时任务每日凌晨2:00自动触发爬虫
- ✅ 文件监控服务检测到新文件后自动导入
- ✅ RawContent表成功保存采集的内容
- ✅ 爬虫失败时指数退避重试(最多3次)
- ✅ 采集成功后自动创建AI分析任务

---

## 验收标准 (Acceptance Criteria)

### AC 1: 配置爬虫任务

**Given** 系统需要采集GARTNER、信通院、IDC等技术媒体信息
**When** 配置爬虫任务
**Then** 使用BullMQ创建定时任务(cron job)，每日凌晨2:00触发
**And** 爬虫任务包含：source(信息源)、category(tech/industry/compliance)、url(目标网址)

### AC 2: 爬虫任务执行

**Given** 爬虫任务执行
**When** 采集开始
**Then** 使用开源爬虫库(Crawlee或Puppeteer-extra)抓取内容
**And** 解析文章标题、摘要、正文、发布日期、作者
**And** 保存到RawContent表(organizationId为null，表示公共内容)

### AC 3: 爬虫任务失败重试

**Given** 爬虫任务失败
**When** 失败次数 < 3
**Then** 使用指数退避重试(2s, 4s, 8s)
**And** 记录失败日志到CrawlerLog表

### AC 4: 外部数据文件导入

**Given** 外部数据文件放入`backend/data-import/website-crawl/`或`backend/data-import/wechat-articles/`
**When** 文件监控服务(chokidar)检测到新文件
**Then** 解析文件frontmatter(source, category, url, publishDate)
**And** 提取文章内容
**And** 保存到RawContent表
**And** 移动文件到`processed/`子文件夹

### AC 5: 触发AI分析任务

**Given** RawContent保存成功
**When** 保存完成
**Then** 创建BullMQ任务'ai:analyze-content'，传递contentId
**And** 任务进入AI分析队列

### AC 6: 复用机制确认

**Given** 爬虫和文件导入机制建立完成
**When** Epic 3(行业雷达)和Epic 4(合规雷达)需要采集信息
**Then** Epic 3和Epic 4复用本Story建立的爬虫和文件导入机制
**And** 通过配置不同的source和category参数来支持行业雷达和合规雷达的信息采集
**And** 避免重复开发，确保代码复用率

---

## 开发者上下文 (Developer Context)

### 🎯 核心任务

本Story是Epic 2的基础设施，建立**混合信息采集架构**：
- **开源爬虫**: 自动化采集权威技术媒体(GARTNER、信通院、IDC)
- **文件导入**: 支持外部采购的数据文件导入(TXT/MD格式)
- **统一处理**: 两种来源的数据统一保存到RawContent表，触发AI分析

**关键设计原则**:
1. **可复用性**: Epic 3和Epic 4将复用本Story的采集机制
2. **降低风险**: 使用开源爬虫库，避免从零开发
3. **灵活性**: 文件导入机制支持外部数据源

---

### 🏗️ 架构决策与约束

#### 1. 数据模型设计

**核心实体**: RawContent (原始内容表)

```typescript
// backend/src/database/entities/raw-content.entity.ts
@Entity('raw_content')
export class RawContent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  source: string; // "GARTNER" | "信通院" | "IDC" | "公众号名称"

  @Column({ type: 'enum', enum: ['tech', 'industry', 'compliance'] })
  category: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  url: string; // 原文链接

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ type: 'text' })
  fullContent: string;

  @Column({ type: 'timestamp', nullable: true })
  publishDate: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  author: string;

  @Column({ type: 'uuid', nullable: true })
  organizationId: string; // null表示公共内容

  @Column({ type: 'enum', enum: ['pending', 'analyzed', 'failed'], default: 'pending' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

**核心实体**: CrawlerLog (爬虫日志表)

```typescript
// backend/src/database/entities/crawler-log.entity.ts
@Entity('crawler_log')
export class CrawlerLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  source: string;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'enum', enum: ['success', 'failed'] })
  status: string;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
```

#### 2. 爬虫技术选型

**推荐**: Crawlee (https://crawlee.dev/)
- ✅ 高星开源项目(10k+ stars)
- ✅ 内置反爬虫机制(自动重试、代理轮换、User-Agent轮换)
- ✅ 支持Puppeteer和Playwright
- ✅ 社区活跃，文档完善

**备选**: Puppeteer-extra (https://github.com/berstend/puppeteer-extra)
- ✅ 插件化架构(stealth plugin反爬虫)
- ✅ 基于Puppeteer，稳定性高

**安装命令**:
```bash
npm install crawlee puppeteer
```

#### 3. BullMQ队列架构

**队列设计**:
```typescript
// backend/src/modules/radar/queues/crawler.queue.ts
export const CRAWLER_QUEUE = 'radar:crawler';
export const AI_ANALYSIS_QUEUE = 'radar:ai-analysis';

// 定时任务配置
export const CRAWLER_CRON_SCHEDULE = '0 2 * * *'; // 每日凌晨2:00
```

**任务结构**:
```typescript
interface CrawlerJobData {
  source: string;
  category: 'tech' | 'industry' | 'compliance';
  url: string;
}

interface AIAnalysisJobData {
  contentId: string;
}
```

#### 4. 文件导入格式规范

**Frontmatter格式**:
```markdown
---
source: "GARTNER"
category: "tech"
url: "https://www.gartner.com/..."
publishDate: "2026-01-23"
author: "John Doe"
---

# 文章标题

文章内容...
```

**文件监控目录**:
- `backend/data-import/website-crawl/` - 网站抓取文件
- `backend/data-import/wechat-articles/` - 公众号文章

**处理后目录**:
- `backend/data-import/website-crawl/processed/`
- `backend/data-import/wechat-articles/processed/`

---

### 📋 技术实施计划

#### Phase 1: 数据模型与迁移 (0.5天)

**Task 1.1: 创建RawContent实体**
- 文件: `backend/src/database/entities/raw-content.entity.ts`
- 字段: id, source, category, url, title, summary, fullContent, publishDate, author, organizationId, status, createdAt, updatedAt
- 索引: idx_raw_content_category, idx_raw_content_status, idx_raw_content_created_at

**Task 1.2: 创建CrawlerLog实体**
- 文件: `backend/src/database/entities/crawler-log.entity.ts`
- 字段: id, source, url, status, errorMessage, retryCount, createdAt
- 索引: idx_crawler_log_status, idx_crawler_log_created_at

**Task 1.3: 创建数据库迁移**
- 文件: `backend/src/database/migrations/*-CreateRawContentAndCrawlerLog.ts`
- 创建两张表及索引

**Task 1.4: 注册实体**
- 修改: `backend/src/database/entities/index.ts`
- 导出RawContent和CrawlerLog

---

#### Phase 2: 爬虫服务实现 (1.5天)

**Task 2.1: 安装依赖**
```bash
npm install crawlee puppeteer chokidar gray-matter
npm install --save-dev @types/chokidar
```

**Task 2.2: 创建爬虫服务**
- 文件: `backend/src/modules/radar/services/crawler.service.ts`
- 方法:
  - `crawlWebsite(source: string, url: string, category: string): Promise<RawContent>`
  - `parseArticle(html: string): { title, summary, fullContent, publishDate, author }`
  - `saveRawContent(data: Partial<RawContent>): Promise<RawContent>`

**实现要点**:
```typescript
import { CheerioCrawler } from 'crawlee';

async crawlWebsite(source: string, url: string, category: string) {
  const crawler = new CheerioCrawler({
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: 60,
    async requestHandler({ $, request }) {
      const title = $('h1').first().text().trim();
      const summary = $('meta[name="description"]').attr('content');
      const fullContent = $('article').text().trim();
      // ... 解析逻辑
    },
  });

  await crawler.run([url]);
}
```

**Task 2.3: 创建爬虫日志服务**
- 文件: `backend/src/modules/radar/services/crawler-log.service.ts`
- 方法:
  - `logSuccess(source: string, url: string): Promise<void>`
  - `logFailure(source: string, url: string, error: string, retryCount: number): Promise<void>`

---

#### Phase 3: 文件导入服务 (1天)

**Task 3.1: 创建文件监控服务**
- 文件: `backend/src/modules/radar/services/file-watcher.service.ts`
- 使用chokidar监控文件夹变化
- 方法:
  - `startWatching(): void`
  - `processFile(filePath: string): Promise<void>`
  - `parseMarkdownFile(filePath: string): Promise<RawContent>`
  - `moveToProcessed(filePath: string): Promise<void>`

**实现要点**:
```typescript
import * as chokidar from 'chokidar';
import * as matter from 'gray-matter';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class FileWatcherService {
  private watcher: chokidar.FSWatcher;

  startWatching() {
    const watchPaths = [
      'backend/data-import/website-crawl',
      'backend/data-import/wechat-articles',
    ];

    this.watcher = chokidar.watch(watchPaths, {
      ignored: /processed/,
      persistent: true,
      ignoreInitial: false,
    });

    this.watcher.on('add', async (filePath) => {
      if (filePath.endsWith('.md') || filePath.endsWith('.txt')) {
        await this.processFile(filePath);
      }
    });
  }

  async processFile(filePath: string) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const { data: frontmatter, content: body } = matter(content);

      const rawContent = await this.rawContentService.create({
        source: frontmatter.source,
        category: frontmatter.category,
        url: frontmatter.url,
        title: this.extractTitle(body),
        summary: frontmatter.summary || null,
        fullContent: body,
        publishDate: frontmatter.publishDate ? new Date(frontmatter.publishDate) : null,
        author: frontmatter.author || null,
        organizationId: null, // 公共内容
        status: 'pending',
      });

      // 触发AI分析任务
      await this.aiAnalysisQueue.add('analyze-content', {
        contentId: rawContent.id,
      });

      // 移动到processed文件夹
      await this.moveToProcessed(filePath);
    } catch (error) {
      this.logger.error(`Failed to process file ${filePath}:`, error);
    }
  }

  async moveToProcessed(filePath: string) {
    const dir = path.dirname(filePath);
    const filename = path.basename(filePath);
    const processedDir = path.join(dir, 'processed');

    await fs.mkdir(processedDir, { recursive: true });
    await fs.rename(filePath, path.join(processedDir, filename));
  }
}
```

**Task 3.2: 创建文件导入目录**
```bash
mkdir -p backend/data-import/website-crawl/processed
mkdir -p backend/data-import/wechat-articles/processed
```

---

#### Phase 4: BullMQ队列集成 (1天)

**Task 4.1: 创建爬虫队列**
- 文件: `backend/src/modules/radar/queues/crawler.queue.ts`
- 定义队列名称和cron配置

**Task 4.2: 创建爬虫Worker**
- 文件: `backend/src/modules/radar/processors/crawler.processor.ts`
- 处理爬虫任务
- 失败重试逻辑(指数退避)

**实现要点**:
```typescript
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('radar:crawler', {
  concurrency: 5, // 并发数
})
export class CrawlerProcessor extends WorkerHost {
  async process(job: Job<CrawlerJobData>) {
    const { source, category, url } = job.data;

    try {
      const rawContent = await this.crawlerService.crawlWebsite(source, url, category);

      // 记录成功日志
      await this.crawlerLogService.logSuccess(source, url);

      // 触发AI分析任务
      await this.aiAnalysisQueue.add('analyze-content', {
        contentId: rawContent.id,
      });

      return { success: true, contentId: rawContent.id };
    } catch (error) {
      // 记录失败日志
      await this.crawlerLogService.logFailure(
        source,
        url,
        error.message,
        job.attemptsMade,
      );

      // 重试逻辑
      if (job.attemptsMade < 3) {
        throw error; // BullMQ自动重试
      }

      return { success: false, error: error.message };
    }
  }
}
```

**Task 4.3: 配置定时任务**
- 文件: `backend/src/modules/radar/radar.module.ts`
- 注册BullMQ队列和定时任务

```typescript
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'radar:crawler',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000, // 2s, 4s, 8s
        },
      },
    }),
    BullModule.registerQueue({
      name: 'radar:ai-analysis',
    }),
  ],
  providers: [
    CrawlerService,
    CrawlerLogService,
    FileWatcherService,
    CrawlerProcessor,
  ],
})
export class RadarModule implements OnModuleInit {
  constructor(
    @InjectQueue('radar:crawler') private crawlerQueue: Queue,
    private fileWatcherService: FileWatcherService,
  ) {}

  async onModuleInit() {
    // 启动文件监控
    this.fileWatcherService.startWatching();

    // 配置定时任务
    await this.crawlerQueue.add(
      'crawl-tech-sources',
      {
        source: 'GARTNER',
        category: 'tech',
        url: 'https://www.gartner.com/...',
      },
      {
        repeat: {
          pattern: '0 2 * * *', // 每日凌晨2:00
        },
      },
    );
  }
}
```

---

#### Phase 5: 测试与验证 (1天)

**Task 5.1: 单元测试**
- 文件: `backend/src/modules/radar/services/crawler.service.spec.ts`
- 测试爬虫解析逻辑
- Mock Crawlee

**Task 5.2: 文件导入测试**
- 文件: `backend/src/modules/radar/services/file-watcher.service.spec.ts`
- 测试文件解析和移动逻辑

**Task 5.3: E2E测试**
- 文件: `backend/test/radar-crawler.e2e-spec.ts`
- 测试场景:
  1. 爬虫任务成功执行并保存RawContent
  2. 爬虫任务失败后重试3次
  3. 文件导入成功并触发AI分析任务
  4. 文件移动到processed文件夹

**测试数据准备**:
```markdown
// backend/test/fixtures/sample-article.md
---
source: "GARTNER"
category: "tech"
url: "https://www.gartner.com/test"
publishDate: "2026-01-23"
author: "Test Author"
---

# Test Article Title

This is a test article content.
```

---

### 🔍 Epic 1经验教训应用

#### 从Story 1.1学到的:
- ✅ **数据迁移策略**: 创建迁移前先设计完整的实体关系
- ✅ **索引优化**: RawContent表需要category、status、createdAt索引
- ✅ **外键约束**: organizationId可为null(公共内容)，但需要正确处理

#### 从Story 1.2学到的:
- ✅ **认证集成**: Radar模块的API需要使用JwtAuthGuard
- ✅ **权限控制**: 爬虫服务是系统级服务，不需要OrganizationGuard
- ✅ **审计日志**: CrawlerLog表记录所有爬虫操作

#### 从Story 1.3学到的:
- ✅ **事件驱动**: 文件导入成功后触发AI分析任务(BullMQ)
- ✅ **异步处理**: 爬虫和文件导入都是异步任务，使用BullMQ队列
- ✅ **错误处理**: 失败重试机制(指数退避)

#### 从Story 1.4学到的:
- ✅ **模块化设计**: Radar模块独立，但复用Csaas的基础设施
- ✅ **测试覆盖**: 单元测试 + E2E测试，覆盖率≥80%

---

### 🔗 与现有模块的集成 (关键改进)

#### 1. 扩展现有Radar模块

**重要**: 数据模型已100%完成！RawContent、CrawlerLog等8张表已通过迁移`1738000000000-CreateRadarInfrastructure.ts`创建。

**当前Radar模块** (`backend/src/modules/radar/radar.module.ts`):
```typescript
// Story 1.3功能: 评估完成后自动识别薄弱项
@Module({
  imports: [
    TypeOrmModule.forFeature([AITask, Project]),
    OrganizationsModule,
  ],
  providers: [AssessmentEventListener],
  exports: [AssessmentEventListener],
})
export class RadarModule {}
```

**Story 2.1扩展方案**:
```typescript
import { BullModule } from '@nestjs/bullmq';
import { RawContent } from '../../database/entities/raw-content.entity';
import { CrawlerLog } from '../../database/entities/crawler-log.entity';

@Module({
  imports: [
    // 保留Story 1.3
    TypeOrmModule.forFeature([AITask, Project]),
    OrganizationsModule,

    // Story 2.1新增 - 注意：实体已存在，只需注册
    TypeOrmModule.forFeature([RawContent, CrawlerLog]),
    BullModule.registerQueue(
      { name: 'radar:crawler' },
      { name: 'radar:ai-analysis' },
    ),
  ],
  providers: [
    AssessmentEventListener,
    // Story 2.1新增
    CrawlerService,
    CrawlerLogService,
    FileWatcherService,
    RawContentService,
    CrawlerProcessor,
  ],
  exports: [
    AssessmentEventListener,
    RawContentService, // 供Story 2.2使用
  ],
})
export class RadarModule implements OnModuleInit, OnModuleDestroy {
  constructor(
    @InjectQueue('radar:crawler') private crawlerQueue: Queue,
    private fileWatcherService: FileWatcherService,
  ) {}

  async onModuleInit() {
    // 启动文件监控
    await this.fileWatcherService.startWatching();

    // 配置定时爬虫任务
    await this.setupCrawlerJobs();
  }

  async onModuleDestroy() {
    // 优雅停止文件监控
    await this.fileWatcherService.stopWatching();
  }

  private async setupCrawlerJobs() {
    const sources = [
      { source: 'GARTNER', url: 'https://www.gartner.com/...' },
      { source: '信通院', url: 'http://www.caict.ac.cn/...' },
      { source: 'IDC', url: 'https://www.idc.com/...' },
    ];

    for (const { source, url } of sources) {
      await this.crawlerQueue.add(
        'crawl-tech',
        { source, category: 'tech', url },
        {
          repeat: { pattern: '0 2 * * *' },
          jobId: `crawler-${source}`,
        },
      );
    }
  }
}
```

#### 2. 与Story 2.2的接口定义

**Story 2.2依赖的数据结构**:
```typescript
// RawContent实体 (已存在)
export interface RawContentForAnalysis {
  id: string;
  source: string;
  category: 'tech' | 'industry' | 'compliance';
  title: string;
  summary: string;
  fullContent: string;
  publishDate: Date;
  status: 'pending' | 'analyzing' | 'analyzed' | 'failed';
}

// AI分析任务payload
export interface AIAnalysisJobData {
  contentId: string;
  priority?: 'high' | 'normal' | 'low';
}

// RawContent状态流转
// pending → analyzing (AI开始) → analyzed (成功) / failed (失败)
```

**Story 2.2交接清单**:
- ✅ RawContent表已创建 (通过迁移1738000000000)
- ✅ CrawlerLog表已创建
- ✅ AI分析队列已配置 (`radar:ai-analysis`)
- ✅ RawContentService已实现
- ⏳ AnalyzedContent表由Story 2.2创建
- ⏳ 相关性计算由Story 2.2实现

---

### 📦 文件结构

**后端新增文件** (预计12个):
```
backend/src/
├── database/
│   ├── entities/
│   │   ├── raw-content.entity.ts (新建)
│   │   ├── crawler-log.entity.ts (新建)
│   │   └── index.ts (修改 - 导出新entities)
│   └── migrations/
│       └── *-CreateRawContentAndCrawlerLog.ts (新建)
├── modules/
│   └── radar/
│       ├── radar.module.ts (新建)
│       ├── services/
│       │   ├── crawler.service.ts (新建)
│       │   ├── crawler-log.service.ts (新建)
│       │   ├── file-watcher.service.ts (新建)
│       │   └── raw-content.service.ts (新建)
│       ├── processors/
│       │   └── crawler.processor.ts (新建)
│       └── queues/
│           └── crawler.queue.ts (新建)
└── app.module.ts (修改 - 注册RadarModule)

backend/test/
├── radar-crawler.e2e-spec.ts (新建)
└── fixtures/
    └── sample-article.md (新建)

backend/data-import/
├── website-crawl/
│   └── processed/
└── wechat-articles/
    └── processed/
```

---

### 🚨 关键风险与缓解

#### 风险1: 爬虫被反爬虫机制阻止
**缓解措施**:
- 使用Crawlee的内置反爬虫机制
- 配置User-Agent轮换
- 添加请求延迟(1-3秒)
- 失败重试机制

#### 风险2: 文件导入格式不规范
**缓解措施**:
- 严格验证frontmatter格式
- 提供示例文件和文档
- 解析失败时记录详细错误日志

#### 风险3: BullMQ队列积压
**缓解措施**:
- 配置合理的并发数(5)
- 监控队列长度
- 设置任务超时时间(60秒)

#### 风险4: 爬虫性能问题
**缓解措施**:
- 使用CheerioCrawler(轻量级)而非PuppeteerCrawler
- 仅在必要时使用Puppeteer(需要JS渲染的网站)
- 限制并发数

---

### 📚 技术参考

#### 开源爬虫库
- **Crawlee**: https://crawlee.dev/
- **Puppeteer-extra**: https://github.com/berstend/puppeteer-extra

#### BullMQ文档
- **官方文档**: https://docs.bullmq.io/
- **NestJS集成**: https://docs.nestjs.com/techniques/queues

#### 文件监控
- **Chokidar**: https://github.com/paulmillr/chokidar
- **Gray-matter**: https://github.com/jonschlinkert/gray-matter

#### 架构参考
- [Source: _bmad-output/architecture-radar-service.md#Decision 2: 信息采集架构]
- [Source: _bmad-output/prd-radar-service.md#技术雷达]

---

### ✅ Definition of Done

1. **代码完成**:
   - ✅ RawContent和CrawlerLog实体创建
   - ✅ 数据库迁移执行成功
   - ✅ 爬虫服务实现并测试通过
   - ✅ 文件监控服务实现并测试通过
   - ✅ BullMQ队列和Worker配置完成

2. **测试通过**:
   - ✅ 单元测试覆盖率≥80%
   - ✅ E2E测试4个场景全部通过
   - ✅ 手动测试: 放入测试文件，验证自动导入

3. **文档完成**:
   - ✅ 文件导入格式文档
   - ✅ 爬虫配置文档
   - ✅ API文档(如有)

4. **代码审查**:
   - ✅ 代码符合NestJS最佳实践
   - ✅ 错误处理完善
   - ✅ 日志记录清晰

---

## Dev Agent Record

### Agent Model Used
Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References
- TDD开发流程：先编写测试（RED），再实现功能（GREEN），最后重构（REFACTOR）
- 所有单元测试通过：26个测试，覆盖率95.27%
- 编译成功：无TypeScript错误
- **Code Review完成**: 修复15个问题（5 High, 6 Medium, 4 Low）

### Completion Notes List
1. ✅ 安装依赖：crawlee, puppeteer, chokidar, gray-matter
2. ✅ 创建RawContentService：管理原始内容CRUD，自动生成contentHash去重
3. ✅ 创建CrawlerLogService：记录爬虫日志，计算成功率
4. ✅ 创建CrawlerService：使用Crawlee爬取网站，解析文章内容
5. ✅ 创建FileWatcherService：监控文件导入目录，自动处理新文件
6. ✅ 创建CrawlerProcessor：BullMQ队列处理器，支持指数退避重试
7. ✅ 扩展RadarModule：集成所有服务，配置定时任务（每日凌晨2:00）
8. ✅ 创建文件导入目录：backend/data-import/website-crawl/, backend/data-import/wechat-articles/
9. ✅ 编写单元测试：26个测试全部通过，覆盖率95.27%
10. ✅ 创建示例文件：演示文件导入格式
11. ✅ **Code Review修复**：删除重复AI分析触发，改进爬虫解析逻辑
12. ✅ **Code Review修复**：添加重复内容检测，修正重试逻辑
13. ✅ **Code Review修复**：添加文件大小验证（10MB限制）和失败文件处理
14. ✅ **Code Review修复**：添加User-Agent轮换和模块启动错误处理
15. ✅ **Code Review修复**：创建RadarController API端点，添加环境变量配置

### File List
**新增文件**:
- backend/src/modules/radar/services/raw-content.service.ts
- backend/src/modules/radar/services/raw-content.service.spec.ts
- backend/src/modules/radar/services/crawler-log.service.ts
- backend/src/modules/radar/services/crawler-log.service.spec.ts
- backend/src/modules/radar/services/crawler.service.ts
- backend/src/modules/radar/services/crawler.service.spec.ts
- backend/src/modules/radar/services/file-watcher.service.ts
- backend/src/modules/radar/services/file-watcher.service.spec.ts
- backend/src/modules/radar/processors/crawler.processor.ts
- backend/src/modules/radar/controllers/radar.controller.ts (Code Review新增)
- backend/test/radar-crawler.e2e-spec.ts
- backend/data-import/website-crawl/example-article.md
- backend/data-import/website-crawl/processed/ (目录)
- backend/data-import/website-crawl/failed/ (目录 - Code Review新增)
- backend/data-import/wechat-articles/processed/ (目录)
- backend/data-import/wechat-articles/failed/ (目录 - Code Review新增)

**修改文件**:
- backend/src/modules/radar/radar.module.ts (扩展集成Story 2.1功能)
- backend/package.json (添加依赖：crawlee, puppeteer, chokidar, gray-matter)
- backend/package-lock.json (依赖锁定文件)

---

## ❓ 常见问题FAQ

### Q1: 数据模型是否需要创建？
**A**: 不需要！RawContent、CrawlerLog等8张表已通过迁移`1738000000000-CreateRadarInfrastructure.ts`创建完成。你只需要：
1. 在radar.module.ts中注册实体: `TypeOrmModule.forFeature([RawContent, CrawlerLog])`
2. 创建对应的Service类来操作这些表

### Q2: 如何处理爬虫被反爬虫阻止？
**A**: 多级降级策略：
- Level 1: 使用Crawlee的CheerioCrawler (轻量级)
- Level 2: 切换到PuppeteerCrawler (支持JS渲染)
- Level 3: 增加请求延迟(1-3秒)和User-Agent轮换
- Level 4: 标记为"待人工处理"，发送告警

### Q3: 文件导入失败如何处理？
**A**: 完整的错误恢复流程：
1. 验证文件大小(<10MB)和编码(自动转UTF-8)
2. 验证frontmatter必填字段(source, category, url)
3. 内容质量检查(最小100字符)
4. 失败时移动到`failed/`文件夹并记录详细错误日志
5. 管理员可查看错误日志，修复后重新放入监控目录

### Q4: 如何调试BullMQ任务？
**A**:
```typescript
// 1. 查看队列状态
const queue = await this.crawlerQueue.getJobCounts();
console.log('Queue status:', queue);

// 2. 查看失败任务
const failed = await this.crawlerQueue.getFailed();
console.log('Failed jobs:', failed);

// 3. 重试失败任务
await job.retry();

// 4. 使用Bull Board可视化监控
npm install @bull-board/api @bull-board/nestjs
```

### Q5: 如何监控爬虫性能？
**A**: CrawlerLog表记录了关键指标：
- `responseTimeMs`: 响应时间
- `status`: 成功/失败状态
- `retryCount`: 重试次数

可以通过SQL查询统计：
```sql
-- 平均响应时间
SELECT source, AVG(responseTimeMs) as avg_time
FROM crawler_log
WHERE status = 'success'
GROUP BY source;

-- 成功率
SELECT source,
  COUNT(CASE WHEN status='success' THEN 1 END) * 100.0 / COUNT(*) as success_rate
FROM crawler_log
GROUP BY source;
```

### Q6: Epic 3和Epic 4如何复用本Story的机制？
**A**: 只需修改配置参数：
```typescript
// Epic 3 - 行业雷达
await this.crawlerQueue.add('crawl-industry', {
  source: '同业公众号',
  category: 'industry', // 改为industry
  url: 'https://...',
});

// Epic 4 - 合规雷达
await this.crawlerQueue.add('crawl-compliance', {
  source: '银保监会',
  category: 'compliance', // 改为compliance
  url: 'https://...',
});
```

### Q7: 如何确保与Story 2.2的顺利交接？
**A**: Story 2.1完成后，确保以下接口可用：
- ✅ `RawContentService.findPending()` - 查询待分析内容
- ✅ `RawContentService.updateStatus(id, 'analyzing')` - 更新状态
- ✅ AI分析队列 `radar:ai-analysis` 已配置
- ✅ 队列payload格式: `{ contentId: string, priority?: string }`

### Q8: 测试时如何清理数据？
**A**: E2E测试后清理：
```typescript
afterEach(async () => {
  await rawContentRepo.delete({});
  await crawlerLogRepo.delete({});
});
```

注意：Epic 1回顾中提到"测试数据清理逻辑不完善"是关键教训，必须在每个测试后清理！

---

## 📊 质量审查结果

**本Story已通过独立质量审查**，应用了31个改进点：
- 🚨 12个关键遗漏已修复
- ⚡ 8个增强功能已添加
- 🤖 5个LLM优化已应用

**质量评分**: 从6/10提升到**8.5/10**

**关键改进**:
1. ✅ 明确了与现有Radar模块的集成方式
2. ✅ 定义了与Story 2.2的清晰接口
3. ✅ 添加了完整的错误处理和降级策略
4. ✅ 补充了Epic 1经验教训的具体应用
5. ✅ 提供了常见问题的解决方案

---

**下一步**: 使用`dev-story`工作流开始TDD开发
