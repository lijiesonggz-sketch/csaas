import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { AITask, TaskStatus } from '../../database/entities/ai-task.entity'
import { AI_TASK_QUEUE, AITaskJobType } from './constants/queue.constants'
import { AITaskJobData } from './interfaces/queue-job.interface'
import { AIModel } from '../../database/entities/ai-generation-event.entity'
import { CreateAITaskDto } from './dto/create-ai-task.dto'

@Injectable()
export class AITasksService {
  private readonly logger = new Logger(AITasksService.name)

  constructor(
    @InjectRepository(AITask)
    private readonly aiTaskRepo: Repository<AITask>,
    @InjectQueue(AI_TASK_QUEUE)
    private readonly aiTaskQueue: Queue<AITaskJobData>,
  ) {}

  async createTask(dto: CreateAITaskDto, userId: string): Promise<AITask> {
    // 创建任务记录
    const task = this.aiTaskRepo.create({
      projectId: dto.projectId,
      type: dto.type as any, // Type will be validated by DTO
      input: dto.input,
      status: TaskStatus.PENDING,
      priority: dto.priority || 1,
    })

    await this.aiTaskRepo.save(task)
    this.logger.log(`Created AI task ${task.id}`)

    // 添加到队列
    const jobData: AITaskJobData = {
      taskId: task.id,
      projectId: dto.projectId,
      type: dto.type,
      input: dto.input,
      model: dto.model || AIModel.GPT4,
      priority: dto.priority,
      userId,
    }

    await this.aiTaskQueue.add(AITaskJobType.PROCESS_TASK, jobData, {
      priority: dto.priority,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    })

    this.logger.log(`Added task ${task.id} to queue`)

    return task
  }

  async getTask(taskId: string): Promise<AITask> {
    const task = await this.aiTaskRepo.findOne({
      where: { id: taskId },
      relations: ['events', 'costs'],
    })

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`)
    }

    return task
  }

  async getTasksByProject(projectId: string): Promise<AITask[]> {
    return this.aiTaskRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
      relations: ['events', 'costs'],
    })
  }

  async retryFailedTask(taskId: string): Promise<void> {
    const task = await this.getTask(taskId)

    if (task.status !== TaskStatus.FAILED) {
      throw new Error(`Task ${taskId} is not in failed state`)
    }

    // 重置任务状态
    await this.aiTaskRepo.update(taskId, {
      status: TaskStatus.PENDING,
      errorMessage: null,
    })

    // 重新添加到队列
    const jobData: AITaskJobData = {
      taskId: task.id,
      projectId: task.projectId,
      type: task.type,
      input: task.input,
      model: AIModel.GPT4, // TODO: 从任务历史中获取上次使用的模型
      priority: task.priority,
    }

    await this.aiTaskQueue.add(AITaskJobType.RETRY_FAILED, jobData, {
      priority: task.priority + 1, // 重试任务优先级提高
    })

    this.logger.log(`Retrying task ${taskId}`)
  }

  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.aiTaskQueue.getWaitingCount(),
      this.aiTaskQueue.getActiveCount(),
      this.aiTaskQueue.getCompletedCount(),
      this.aiTaskQueue.getFailedCount(),
    ])

    return {
      waiting,
      active,
      completed,
      failed,
    }
  }
}
