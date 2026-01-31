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

// Story 2.3 entities
import { RadarPush } from '../../database/entities/radar-push.entity'
import { PushLog } from '../../database/entities/push-log.entity'
import { WeaknessSnapshot } from '../../database/entities/weakness-snapshot.entity'
import { WatchedTopic } from '../../database/entities/watched-topic.entity'
import { WatchedPeer } from '../../database/entities/watched-peer.entity'
import { Organization } from '../../database/entities/organization.entity'
import { OrganizationMember } from '../../database/entities/organization-member.entity'

// Story 3.1 entities
import { RadarSource } from '../../database/entities/radar-source.entity'

// Story 4.2 entities
import { CompliancePlaybook } from '../../database/entities/compliance-playbook.entity'
import { ComplianceChecklistSubmission } from '../../database/entities/compliance-checklist-submission.entity'

// Story 1.3 providers
import { AssessmentEventListener } from './assessment-event.listener'
import { OrganizationsModule } from '../organizations/organizations.module'
import { AITasksModule } from '../ai-tasks/ai-tasks.module'
import { AIClientsModule } from '../ai-clients/ai-clients.module'
// import { ProjectsModule } from '../projects/projects.module' // 暂时禁用以避免循环依赖

// Story 2.1 providers
import { RawContentService } from './services/raw-content.service'
import { CrawlerLogService } from './services/crawler-log.service'
import { CrawlerService } from './services/crawler.service'
import { FileWatcherService } from './services/file-watcher.service'
import { CrawlerProcessor } from './processors/crawler.processor'
import { RadarController } from './controllers/radar.controller'
import { RadarPushController } from './controllers/radar-push.controller'

// Story 3.1 providers
import { RadarSourceService } from './services/radar-source.service'
import { RadarSourceController } from './controllers/radar-source.controller'

// Story 4.2 providers
import { CompliancePlaybookService } from './services/compliance-playbook.service'
import { CompliancePlaybookController } from './controllers/compliance-playbook.controller'

// Story 5.1 providers
import { WatchedTopicService } from './services/watched-topic.service'
import { WatchedTopicController } from './controllers/watched-topic.controller'

// Story 5.2 providers
import { WatchedPeerService } from './services/watched-peer.service'
import { WatchedPeerController } from './controllers/watched-peer.controller'

// Story 2.2 providers
import { TagService } from './services/tag.service'
import { AnalyzedContentService } from './services/analyzed-content.service'
import { AIAnalysisService } from './services/ai-analysis.service'
import { AIAnalysisProcessor } from './processors/ai-analysis.processor'

// Story 2.3 providers
import { RelevanceService } from './services/relevance.service'
import { PushFrequencyControlService } from './services/push-frequency-control.service'
import { PushSchedulerService } from './services/push-scheduler.service'
import { PushLogService } from './services/push-log.service'
import { PushProcessor } from './processors/push.processor'

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

    // Story 2.3 entities
    TypeOrmModule.forFeature([
      RadarPush,
      PushLog,
      WeaknessSnapshot,
      WatchedTopic,
      WatchedPeer,
      Organization,
      OrganizationMember,
    ]),

    // Story 3.1 entities
    TypeOrmModule.forFeature([RadarSource]),

    // Story 4.2 entities
    TypeOrmModule.forFeature([CompliancePlaybook, ComplianceChecklistSubmission]),

    // Story 2.1 BullMQ queues
    BullModule.registerQueue(
      {
        name: 'radar-crawler',
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000, // 2s, 4s, 8s
          },
        },
      },
      {
        name: 'radar-ai-analysis',
      },
      // Story 2.3 push queue
      {
        name: 'radar-push',
        defaultJobOptions: {
          attempts: 2, // 失败后重试1次
          backoff: {
            type: 'fixed',
            delay: 300000, // 5分钟后重试
          },
        },
      },
      // Story 4.2: 合规剧本生成队列
      {
        name: 'radar-playbook-generation',
        defaultJobOptions: {
          attempts: 2,
          backoff: {
            type: 'fixed',
            delay: 60000, // 1分钟后重试
          },
        },
      },
    ),

    OrganizationsModule,
    AITasksModule, // Story 2.3 - 用于WebSocket推送
    AIClientsModule, // Story 2.2 - AI分析服务依赖
    // ProjectsModule, // 暂时禁用以避免循环依赖
  ],
  controllers: [RadarController, RadarPushController, RadarSourceController, CompliancePlaybookController, WatchedTopicController, WatchedPeerController],
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

    // Story 2.3 providers
    RelevanceService,
    PushFrequencyControlService,
    PushSchedulerService,
    PushLogService,
    PushProcessor,

    // Story 3.1 providers
    RadarSourceService,

    // Story 4.2 providers
    CompliancePlaybookService,

    // Story 5.1 providers
    WatchedTopicService,

    // Story 5.2 providers
    WatchedPeerService,
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
    @InjectQueue('radar-crawler')
    private readonly crawlerQueue: Queue,
    @InjectQueue('radar-push')
    private readonly pushQueue: Queue,
    private readonly fileWatcherService: FileWatcherService,
    private readonly radarSourceService: RadarSourceService,
  ) {}

  /**
   * 模块初始化
   * - 启动文件监控
   * - 配置定时爬虫任务
   * - 配置定时推送任务
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

    try {
      // 配置定时推送任务
      await this.setupPushSchedules()
      this.logger.log('Push schedules configured successfully')
    } catch (error) {
      this.logger.error('Failed to setup push schedules:', error.stack)
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
   *
   * Story 3.1: 从数据库读取信息源配置
   * - 优先从 radar_sources 表读取配置
   * - 如果数据库为空，使用硬编码的默认配置（向后兼容）
   */
  private async setupCrawlerJobs() {
    try {
      // 尝试从数据库读取所有启用的信息源
      const dbSources = await this.radarSourceService.findAll(undefined, true)

      if (dbSources.length > 0) {
        // 使用数据库配置
        this.logger.log(
          `Setting up crawler jobs from database: ${dbSources.length} sources`,
        )

        for (const source of dbSources) {
          await this.crawlerQueue.add(
            `crawl-${source.category}`,
            {
              source: source.source,
              category: source.category,
              url: source.url,
            },
            {
              repeat: {
                pattern: source.crawlSchedule,
              },
              jobId: `crawler-${source.id}`,
            },
          )

          this.logger.log(
            `Scheduled crawler job: ${source.source} (${source.category}) - ${source.crawlSchedule}`,
          )
        }
      } else {
        // 数据库为空，使用默认配置（向后兼容）
        this.logger.warn(
          'No sources found in database, using default configuration',
        )

        const defaultSources = [
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

        for (const { source, url, category } of defaultSources) {
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

        this.logger.log('Scheduled default crawler jobs')
      }
    } catch (error) {
      this.logger.error('Failed to setup crawler jobs from database:', error)
      // 如果数据库查询失败，回退到默认配置
      this.logger.warn('Falling back to default crawler configuration')

      const defaultSources = [
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

      for (const { source, url, category } of defaultSources) {
        await this.crawlerQueue.add(
          'crawl-tech',
          { source, category, url },
          {
            repeat: {
              pattern: '0 2 * * *',
            },
            jobId: `crawler-${source}`,
          },
        )
      }
    }
  }

  /**
   * 配置定时推送任务
   *
   * Story 2.3: 推送系统与调度 - Phase 3 Task 3.3
   * Story 3.2: 行业雷达推送调度 - Task 2.3
   *
   * 三大雷达的推送调度时间：
   * - 技术雷达: 每周五17:00
   * - 行业雷达: 每日9:00 (Story 3.2 - 改为每日推送)
   * - 合规雷达: 每日9:00
   */
  private async setupPushSchedules() {
    const schedules = [
      {
        radarType: 'tech',
        cronPattern: '0 17 * * 5', // 每周五17:00
        jobId: 'push-tech-radar',
        description: '技术雷达周报推送',
      },
      {
        radarType: 'industry',
        cronPattern: '0 9 * * *', // 每日9:00 (Story 3.2 Task 2.3)
        jobId: 'push-industry-radar',
        description: '行业雷达每日推送',
      },
      {
        radarType: 'compliance',
        cronPattern: '0 9 * * *', // 每日9:00
        jobId: 'push-compliance-radar',
        description: '合规雷达每日推送',
      },
    ]

    for (const schedule of schedules) {
      await this.pushQueue.add(
        'execute-push',
        { radarType: schedule.radarType },
        {
          repeat: { pattern: schedule.cronPattern },
          jobId: schedule.jobId,
        },
      )

      this.logger.log(
        `Scheduled ${schedule.description}: ${schedule.cronPattern}`,
      )
    }
  }
}
