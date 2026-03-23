import { TypeOrmModuleOptions } from '@nestjs/typeorm'
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
  WatchedItem,
  // Story 2.1 entities
  RawContent,
  CrawlerLog,
  // Story 2.2 entities
  AnalyzedContent,
  Tag,
  // Story 2.3 entities
  RadarPush,
  PushScheduleConfig,
  PushLog,
  // Story 3.1 entities
  RadarSource,
  // Story 4.2 entities
  CompliancePlaybook,
  ComplianceChecklistSubmission,
  // Story 5.3 entities
  PushPreference,
  // Story 6.2 entities
  ClientGroup,
  ClientGroupMembership,
  // Story 7.1 entities
  SystemHealthLog,
  Alert,
  // Story 7.2 entities
  PushFeedback,
  // Story 7.3 entities
  CustomerActivityLog,
  CustomerIntervention,
  // Story 7.4 entities
  AIUsageLog,
  // Story 8.2 entities
  PeerCrawlerTask,
} from '../database/entities'

export const databaseConfig = (): TypeOrmModuleOptions => ({
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
    WatchedItem,
    // Story 2.1 entities
    RawContent,
    CrawlerLog,
    // Story 2.2 entities
    AnalyzedContent,
    Tag,
    // Story 2.3 entities
    RadarPush,
    PushScheduleConfig,
    PushLog,
    // Story 3.1 entities
    RadarSource,
    // Story 4.2 entities
    CompliancePlaybook,
    ComplianceChecklistSubmission,
    // Story 5.3 entities
    PushPreference,
    // Story 6.2 entities
    ClientGroup,
    ClientGroupMembership,
    // Story 7.1 entities
    SystemHealthLog,
    Alert,
    // Story 7.2 entities
    PushFeedback,
    // Story 7.3 entities
    CustomerActivityLog,
    CustomerIntervention,
    // Story 7.4 entities
    AIUsageLog,
    // Story 8.2 entities
    PeerCrawlerTask,
  ],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false, // Use migrations for schema changes
  logging: process.env.NODE_ENV === 'development',
  logger: new CustomTypeORMLogger(), // 使用自定义日志器，将 UTC 时间显示为北京时间
  extra: {
    // 设置时区为中国时区
    options: '--timezone=Asia/Shanghai',
  },
})
