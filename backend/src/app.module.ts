import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BullModule } from '@nestjs/bullmq'
import { CacheModule } from '@nestjs/cache-manager'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { databaseConfig } from './config/database.config'
import { TestTimezoneController } from './config/test-timezone.controller'
import { TimezoneSubscriber } from './config/timezone.subscriber'
import { AuthModule } from './modules/auth/auth.module'
import { AITasksModule } from './modules/ai-tasks/ai-tasks.module'
import { HealthModule } from './modules/health/health.module'
import { QualityValidationModule } from './modules/quality-validation/quality-validation.module'
import { ResultAggregationModule } from './modules/result-aggregation/result-aggregation.module'
import { AIGenerationModule } from './modules/ai-generation/ai-generation.module'
import { SurveyModule } from './modules/survey/survey.module'
import { ProjectsModule } from './modules/projects/projects.module'
import { FilesModule } from './modules/files/files.module'
import { CurrentStateModule } from './modules/current-state/current-state.module'
import { OrganizationsModule } from './modules/organizations/organizations.module'
import { RadarModule } from './modules/radar/radar.module'
import { AdminModule } from './modules/admin/admin.module'
import { CostOptimizationModule } from './modules/admin/cost-optimization/cost-optimization.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 300000, // 5 minutes default TTL
    }),
    TypeOrmModule.forRootAsync({
      useFactory: databaseConfig,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    AITasksModule,
    HealthModule,
    QualityValidationModule,
    ResultAggregationModule,
    AIGenerationModule,
    SurveyModule,
    ProjectsModule,
    FilesModule,
    CurrentStateModule,
    OrganizationsModule,
    RadarModule,
    AdminModule,
    CostOptimizationModule,
  ],
  controllers: [AppController, TestTimezoneController],
  providers: [AppService, TimezoneSubscriber],
})
export class AppModule {}
