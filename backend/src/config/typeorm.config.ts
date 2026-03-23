import { DataSource } from 'typeorm'
import { config } from 'dotenv'
import { CustomTypeORMLogger } from './typeorm-logger.config'
import {
  User,
  Tenant,
  Organization,
  OrganizationProfile,
  ControlPack,
  ApplicabilityRule,
  OrganizationMember,
  Project,
  AITask,
  AIGenerationEvent,
  AIGenerationResult,
  AICostTracking,
  AuditLog,
  SurveyResponse,
  ActionPlanMeasure,
  ProjectMember,
  SystemUser,
  StandardDocument,
  InterpretationResult,
  CurrentStateDescription,
  WeaknessSnapshot,
  WatchedTopic,
  WatchedPeer,
  // Epic 2: 技术雷达实体
  Tag,
  WatchedItem,
  RawContent,
  AnalyzedContent,
  RadarPush,
  PushLog,
  PushScheduleConfig,
  PushPreference,
  CrawlerLog,
  RadarSource,
  // Epic 4: 合规雷达实体
  CompliancePlaybook,
  ComplianceChecklistSubmission,
  // Epic 6: 咨询公司多租户与白标输出
  ClientGroup,
  ClientGroupMembership,
  // Epic 7: 运营管理与成本优化
  SystemHealthLog,
  Alert,
  PushFeedback,
  CustomerActivityLog,
  CustomerIntervention,
  AIUsageLog,
  // Epic 8: 同业情报雷达
  PeerCrawlerTask,
} from '../database/entities'

// Load environment variables
config({ path: '.env.development' })

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'csaas',
  entities: [
    User,
    Tenant,
    Organization,
    OrganizationProfile,
    ControlPack,
    ApplicabilityRule,
    OrganizationMember,
    Project,
    AITask,
    AIGenerationEvent,
    AIGenerationResult,
    AICostTracking,
    AuditLog,
    SurveyResponse,
    ActionPlanMeasure,
    ProjectMember,
    SystemUser,
    StandardDocument,
    InterpretationResult,
    CurrentStateDescription,
    WeaknessSnapshot,
    WatchedTopic,
    WatchedPeer,
    // Epic 2: 技术雷达实体
    Tag,
    WatchedItem,
    RawContent,
    AnalyzedContent,
    RadarPush,
    PushLog,
    PushScheduleConfig,
    PushPreference,
    CrawlerLog,
    RadarSource,
    // Epic 4: 合规雷达实体
    CompliancePlaybook,
    ComplianceChecklistSubmission,
    // Epic 6: 咨询公司多租户与白标输出
    ClientGroup,
    ClientGroupMembership,
    // Epic 7: 运营管理与成本优化
    SystemHealthLog,
    Alert,
    PushFeedback,
    CustomerActivityLog,
    CustomerIntervention,
    AIUsageLog,
    // Epic 8: 同业情报雷达
    PeerCrawlerTask,
  ],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false, // Migrations will handle schema changes
  logging: true,
  logger: new CustomTypeORMLogger(), // 使用自定义日志器，将 UTC 时间显示为北京时间
  extra: {
    // 解决Windows PostgreSQL连接ECONNRESET问题
    max: 10, // 最大连接数
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    // 设置时区为中国时区
    options: '--timezone=Asia/Shanghai',
  },
})
