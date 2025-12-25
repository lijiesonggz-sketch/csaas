import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BullModule } from '@nestjs/bullmq'
import { AITasksController } from './ai-tasks.controller'
import { AITasksService } from './ai-tasks.service'
import { AITaskProcessor } from './processors/ai-task.processor'
import { TasksGateway } from './gateways/tasks.gateway'
import { CostMonitoringService } from './services/cost-monitoring.service'
import { AITask } from '../../database/entities/ai-task.entity'
import { AIGenerationEvent } from '../../database/entities/ai-generation-event.entity'
import { AICostTracking } from '../../database/entities/ai-cost-tracking.entity'
import { AI_TASK_QUEUE } from './constants/queue.constants'
import { AIClientsModule } from '../ai-clients/ai-clients.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([AITask, AIGenerationEvent, AICostTracking]),
    BullModule.registerQueue({
      name: AI_TASK_QUEUE,
    }),
    AIClientsModule,
  ],
  controllers: [AITasksController],
  providers: [
    AITasksService,
    AITaskProcessor,
    TasksGateway,
    CostMonitoringService,
  ],
  exports: [AITasksService, TasksGateway, CostMonitoringService],
})
export class AITasksModule {}
