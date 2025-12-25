import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'
import { BullModule } from '@nestjs/bullmq'
import { HealthController } from './health.controller'
import { RedisHealthIndicator } from './indicators/redis.health'
import { AI_TASK_QUEUE } from '../ai-tasks/constants/queue.constants'

@Module({
  imports: [
    TerminusModule,
    BullModule.registerQueue({
      name: AI_TASK_QUEUE,
    }),
  ],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
