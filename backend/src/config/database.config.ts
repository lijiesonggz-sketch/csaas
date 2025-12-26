import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import {
  User,
  Project,
  AITask,
  AIGenerationEvent,
  AIGenerationResult,
  AICostTracking,
  AuditLog,
} from '../database/entities'

export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'csaas',
  entities: [User, Project, AITask, AIGenerationEvent, AIGenerationResult, AICostTracking, AuditLog],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false, // Use migrations for schema changes
  logging: process.env.NODE_ENV === 'development',
})
