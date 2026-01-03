import {
  Controller,
  Post,
  Get,
  Param,
  Body,
} from '@nestjs/common'
import { AITasksService } from './ai-tasks.service'
import { TasksGateway } from './gateways/tasks.gateway'
import { CostMonitoringService } from './services/cost-monitoring.service'
import { CreateAITaskDto } from './dto/create-ai-task.dto'

@Controller('ai-tasks')
export class AITasksController {
  constructor(
    private readonly aiTasksService: AITasksService,
    private readonly tasksGateway: TasksGateway,
    private readonly costMonitoring: CostMonitoringService,
  ) {}

  @Post()
  async createTask(@Body() dto: CreateAITaskDto) {
    // TODO: Add JWT authentication back later
    const userId = 'system'
    const task = await this.aiTasksService.createTask(dto, userId)
    return {
      success: true,
      data: task,
    }
  }

  @Get(':id')
  async getTask(@Param('id') id: string) {
    const task = await this.aiTasksService.getTask(id)
    return {
      success: true,
      data: task,
    }
  }

  @Get(':id/status')
  async getTaskStatus(@Param('id') id: string) {
    const status = await this.aiTasksService.getTaskStatus(id)
    return {
      success: true,
      data: status,
    }
  }

  @Get('project/:projectId')
  async getTasksByProject(@Param('projectId') projectId: string) {
    const tasks = await this.aiTasksService.getTasksByProject(projectId)
    return {
      success: true,
      data: tasks,
    }
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

  @Get('websocket/stats')
  async getWebSocketStats() {
    return this.tasksGateway.getSubscriptionStats()
  }

  /**
   * 获取项目成本统计
   */
  @Get('cost/project/:projectId')
  async getProjectCost(@Param('projectId') projectId: string) {
    return this.costMonitoring.getProjectCostStats(projectId)
  }

  /**
   * 获取任务成本统计
   */
  @Get('cost/task/:taskId')
  async getTaskCost(@Param('taskId') taskId: string) {
    return this.costMonitoring.getTaskCostStats(taskId)
  }

  /**
   * 获取所有项目成本概览
   */
  @Get('cost/overview')
  async getAllProjectsCost() {
    return this.costMonitoring.getAllProjectsCostOverview()
  }

  /**
   * 检查项目成本告警
   */
  @Get('cost/alert/:projectId')
  async checkProjectAlert(@Param('projectId') projectId: string) {
    return this.costMonitoring.checkProjectCostAlert(projectId)
  }

  /**
   * 获取改进措施的详细列表（从 action_plan_measures 表）
   * GET /ai-tasks/:id/measures
   */
  @Get(':id/measures')
  async getActionPlanMeasures(@Param('id') id: string) {
    const measures = await this.aiTasksService.getActionPlanMeasures(id)
    return {
      success: true,
      data: measures,
    }
  }
}
