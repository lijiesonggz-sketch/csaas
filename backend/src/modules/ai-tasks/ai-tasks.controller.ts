import {
  Controller,
  Post,
  Get,
  Param,
  Body,
} from '@nestjs/common'
import { AITasksService } from './ai-tasks.service'
import { CreateAITaskDto } from './dto/create-ai-task.dto'

@Controller('ai-tasks')
export class AITasksController {
  constructor(private readonly aiTasksService: AITasksService) {}

  @Post()
  async createTask(@Body() dto: CreateAITaskDto) {
    // TODO: Add JWT authentication back later
    const userId = 'system'
    return this.aiTasksService.createTask(dto, userId)
  }

  @Get(':id')
  async getTask(@Param('id') id: string) {
    return this.aiTasksService.getTask(id)
  }

  @Get('project/:projectId')
  async getTasksByProject(@Param('projectId') projectId: string) {
    return this.aiTasksService.getTasksByProject(projectId)
  }

  @Post(':id/retry')
  async retryTask(@Param('id') id: string) {
    await this.aiTasksService.retryFailedTask(id)
    return { message: 'Task retry initiated' }
  }

  @Get('queue/stats')
  async getQueueStats() {
    return this.aiTasksService.getQueueStats()
  }
}
