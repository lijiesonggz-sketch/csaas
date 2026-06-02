import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AITask, AITaskType, TaskStatus } from '@/database/entities'
import { AITasksService } from '../../ai-tasks/ai-tasks.service'

@Injectable()
export class TaskRerunService {
  private readonly logger = new Logger(TaskRerunService.name)

  constructor(
    @InjectRepository(AITask)
    private readonly aiTaskRepo: Repository<AITask>,
    private readonly aiTasksService: AITasksService,
  ) {}

  /**
   * 重跑任务with备份
   * 1. 将当前结果存入backup_result
   * 2. 创建新的AI任务
   * 3. 返回新任务
   */
  async rerunWithBackup(projectId: string, taskType: AITaskType, userId?: string): Promise<AITask> {
    // 1. 查找当前任务
    const currentTask = await this.aiTaskRepo.findOne({
      where: { projectId, type: taskType },
      order: { createdAt: 'DESC' },
    })

    if (!currentTask) {
      throw new NotFoundException('没有可重跑的任务')
    }

    let backupResult: Record<string, any> | null = null
    let backupCreatedAt: Date | null = null

    // 2. 将当前结果存入backup_result
    if (currentTask.result) {
      backupResult = currentTask.result
      backupCreatedAt = new Date()
      currentTask.backupResult = backupResult
      currentTask.backupCreatedAt = backupCreatedAt
      await this.aiTaskRepo.save(currentTask)
      this.logger.log(`Backup created for task ${currentTask.id}`)
    }

    // 3. 创建新的队列任务，沿用当前任务输入
    const newTask = await this.aiTasksService.createTask(
      {
        projectId,
        type: taskType,
        input: currentTask.input,
      },
      userId || 'system',
    )

    if (backupResult && backupCreatedAt) {
      await this.aiTaskRepo.update(newTask.id, {
        backupResult,
        backupCreatedAt,
      })
      newTask.backupResult = backupResult
      newTask.backupCreatedAt = backupCreatedAt
    }

    this.logger.log(`Rerun task ${taskType} for project ${projectId}`)

    return newTask
  }

  /**
   * 回退到备份版本
   * 1. 查找当前任务
   * 2. 检查是否有备份
   * 3. 创建回退任务（result = backup_result）
   * 4. 当前任务的backup_result设为回退前的版本（幂等性）
   */
  async rollbackToBackup(projectId: string, taskType: AITaskType): Promise<AITask> {
    // 1. 查找当前任务
    const currentTask = await this.aiTaskRepo.findOne({
      where: { projectId, type: taskType },
      order: { createdAt: 'DESC' },
    })

    if (!currentTask) {
      throw new NotFoundException('当前没有任务')
    }

    // 2. 检查是否有备份
    if (!currentTask.backupResult) {
      throw new BadRequestException('没有可回退的备份版本')
    }

    // 3. 创建回退任务
    const rollbackTask = this.aiTaskRepo.create({
      projectId,
      type: taskType,
      input: currentTask.input,
      result: currentTask.backupResult, // 复制备份数据
      status: TaskStatus.COMPLETED,
      progress: 100,
      completedAt: new Date(),
      backupResult: currentTask.result, // 交换备份（幂等性）
      backupCreatedAt: currentTask.backupCreatedAt,
    })

    await this.aiTaskRepo.save(rollbackTask)

    this.logger.log(`Rollback task ${taskType} for project ${projectId} to backup`)

    return rollbackTask
  }

  /**
   * 检查是否有备份版本
   */
  async hasBackup(projectId: string, taskType: AITaskType): Promise<boolean> {
    const currentTask = await this.aiTaskRepo.findOne({
      where: { projectId, type: taskType },
      order: { createdAt: 'DESC' },
    })

    return currentTask ? !!currentTask.backupResult : false
  }

  /**
   * 获取备份信息
   */
  async getBackupInfo(projectId: string, taskType: AITaskType) {
    const currentTask = await this.aiTaskRepo.findOne({
      where: { projectId, type: taskType },
      order: { createdAt: 'DESC' },
    })

    if (!currentTask || !currentTask.backupResult) {
      return null
    }

    return {
      hasBackup: true,
      backupCreatedAt: currentTask.backupCreatedAt,
      backupSize: JSON.stringify(currentTask.backupResult).length,
    }
  }
}
