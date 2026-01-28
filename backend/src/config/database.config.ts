import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import {
  User,
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
  // Story 2.1 entities
  RawContent,
  CrawlerLog,
  // Story 2.2 entities
  AnalyzedContent,
  Tag,
  // Story 2.3 entities
  RadarPush,
  PushScheduleConfig,
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
    // Story 2.1 entities
    RawContent,
    CrawlerLog,
    // Story 2.2 entities
    AnalyzedContent,
    Tag,
    // Story 2.3 entities
    RadarPush,
    PushScheduleConfig,
  ],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false, // Use migrations for schema changes
  logging: process.env.NODE_ENV === 'development',
})
