import { Module, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BullModule } from '@nestjs/bullmq'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'

// Story 1.3 entities
import { AITask } from '../../database/entities/ai-task.entity'
import { Project } from '../../database/entities/project.entity'

// Story 2.1 entities
import { RawContent } from '../../database/entities/raw-content.entity'
import { CrawlerLog } from '../../database/entities/crawler-log.entity'

// Story 2.2 entities
import { AnalyzedContent } from '../../database/entities/analyzed-content.entity'
import { Tag } from '../../database/entities/tag.entity'

// Story 1.3 providers
import { AssessmentEventListener } from './assessment-event.listener'
import { OrganizationsModule } from '../organizations/organizations.module'

// Story 2.1 providers
import { RawContentService } from './services/raw-content.service'
import { CrawlerLogService } from './services/crawler-log.service'
import { CrawlerService } from './services/crawler.service'
import { FileWatcherService } from './services/file-watcher.service'
import { CrawlerProcessor } from './processors/crawler.processor'
import { RadarController } from './controllers/radar.controller'

// Story 2.2 providers
import { TagService } from './services/tag.service'
import { AnalyzedContentService } from './services/analyzed-content.service'
import { AIAnalysisService } from './services/ai-analysis.service'
import { AIAnalysisProcessor } from './processors/ai-analysis.processor'

/**
 * Radar Module
 *
 * Story 1.3: Automatic weakness detection after assessment
 * Story 2.1: Crawler and file import mechanism
 *
 * Provides:
 * - Assessment completion event listener (Story 1.3)
 * - Weakness identification and snapshot creation (Story 1.3)
 * - Web crawler for tech/industry/compliance content (Story 2.1)
 * - File import monitoring and processing (Story 2.1)
 * - BullMQ queue integration for async tasks (Story 2.1)
 *
 * @module backend/src/modules/radar
 */
@Module({
  imports: [
    // Story 1.3 entities
    TypeOrmModule.forFeature([AITask, Project]),

    // Story 2.1 entities
    TypeOrmModule.forFeature([RawContent, CrawlerLog]),

    // Story 2.2 entities
    TypeOrmModule.forFeature([AnalyzedContent, Tag]),

    // Story 2.1 BullMQ queues
    BullModule.registerQueue(
      {
        name: 'radar:crawler',
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000, // 2s, 4s, 8s
          },
        },
      },
      {
        name: 'radar:ai-analysis',
      },
    ),

    OrganizationsModule,
  ],
  controllers: [RadarController],
  providers: [
    // Story 1.3 providers
    AssessmentEventListener,

    // Story 2.1 providers
    RawContentService,
    CrawlerLogService,
    CrawlerService,
    FileWatcherService,
    CrawlerProcessor,

    // Story 2.2 providers
    TagService,
    AnalyzedContentService,
    AIAnalysisService,
    AIAnalysisProcessor,
  ],
  exports: [
    // Story 1.3 exports
    AssessmentEventListener,

    // Story 2.1 exports
    RawContentService,
    CrawlerService,

    // Story 2.2 exports
    TagService,
    AnalyzedContentService,
    AIAnalysisService,
  ],
})
export class RadarModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RadarModule.name)

  constructor(
    @InjectQueue('radar:crawler')
    private readonly crawlerQueue: Queue,
    private readonly fileWatcherService: FileWatcherService,
  ) {}

  /**
   * 模块初始化
   * - 启动文件监控
   * - 配置定时爬虫任务
   */
  async onModuleInit() {
    try {
      // 启动文件监控
      await this.fileWatcherService.startWatching()
      this.logger.log('File watcher started successfully')
    } catch (error) {
      this.logger.error('Failed to start file watcher:', error.stack)
      // 继续启动，不阻塞应用
    }

    try {
      // 配置定时爬虫任务
      await this.setupCrawlerJobs()
      this.logger.log('Crawler jobs configured successfully')
    } catch (error) {
      this.logger.error('Failed to setup crawler jobs:', error.stack)
      // 继续启动，不阻塞应用
    }
  }

  /**
   * 模块销毁
   * - 停止文件监控
   */
  async onModuleDestroy() {
    await this.fileWatcherService.stopWatching()
  }

  /**
   * 配置定时爬虫任务
   * 每日凌晨2:00自动触发
   */
  private async setupCrawlerJobs() {
    const sources = [
      {
        source: 'GARTNER',
        url: 'https://www.gartner.com/en/newsroom',
        category: 'tech' as const,
      },
      {
        source: '信通院',
        url: 'http://www.caict.ac.cn/kxyj/qwfb/',
        category: 'tech' as const,
      },
      {
        source: 'IDC',
        url: 'https://www.idc.com/research',
        category: 'tech' as const,
      },
    ]

    for (const { source, url, category } of sources) {
      await this.crawlerQueue.add(
        'crawl-tech',
        { source, category, url },
        {
          repeat: {
            pattern: '0 2 * * *', // 每日凌晨2:00
          },
          jobId: `crawler-${source}`,
        },
      )
    }
  }
}
