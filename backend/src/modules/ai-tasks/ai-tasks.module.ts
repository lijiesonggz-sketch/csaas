import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BullModule } from '@nestjs/bullmq'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { AITasksController } from './ai-tasks.controller'
import { AITasksService } from './ai-tasks.service'
import { AITaskProcessor } from './processors/ai-task.processor'
import { TasksGateway } from './gateways/tasks.gateway'
import { CostMonitoringService } from './services/cost-monitoring.service'
import { AITask } from '../../database/entities/ai-task.entity'
import { AIGenerationEvent } from '../../database/entities/ai-generation-event.entity'
import { AICostTracking } from '../../database/entities/ai-cost-tracking.entity'
import { Project } from '../../database/entities/project.entity'
import { AI_TASK_QUEUE } from './constants/queue.constants'
import { AIClientsModule } from '../ai-clients/ai-clients.module'
import { AIGenerationModule } from '../ai-generation/ai-generation.module'
import { QualityValidationModule } from '../quality-validation/quality-validation.module'
import { ResultAggregationModule } from '../result-aggregation/result-aggregation.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([AITask, AIGenerationEvent, AICostTracking, Project]),
    EventEmitterModule.forRoot(),
    BullModule.registerQueue({
      name: AI_TASK_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          count: 100,
          age: 24 * 3600, // 24小时
        },
        removeOnFail: {
          count: 500,
          age: 7 * 24 * 3600, // 7天
        },
      },
    }),
    AIClientsModule,
    forwardRef(() => AIGenerationModule),
    QualityValidationModule,
    ResultAggregationModule,
  ],
  controllers: [AITasksController],
  providers: [AITasksService, AITaskProcessor, TasksGateway, CostMonitoringService],
  exports: [AITasksService, TasksGateway, CostMonitoringService],
})
export class AITasksModule {}
