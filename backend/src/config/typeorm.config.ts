import { DataSource } from 'typeorm'
import { config } from 'dotenv'
import {
  User,
  Tenant,
  Organization,
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
  ],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false, // Migrations will handle schema changes
  logging: true,
  extra: {
    // 解决Windows PostgreSQL连接ECONNRESET问题
    max: 10, // 最大连接数
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    // 设置时区为中国时区
    options: '--timezone=Asia/Shanghai',
  },
})
