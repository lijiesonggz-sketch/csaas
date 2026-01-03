import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BullModule } from '@nestjs/bullmq'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { databaseConfig } from './config/database.config'
import { AuthModule } from './modules/auth/auth.module'
import { AITasksModule } from './modules/ai-tasks/ai-tasks.module'
import { HealthModule } from './modules/health/health.module'
import { QualityValidationModule } from './modules/quality-validation/quality-validation.module'
import { ResultAggregationModule } from './modules/result-aggregation/result-aggregation.module'
import { AIGenerationModule } from './modules/ai-generation/ai-generation.module'
import { SurveyModule } from './modules/survey/survey.module'
import { ProjectsModule } from './modules/projects/projects.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
