import { AITaskType, TaskStatus } from '@/database/entities'
import { TaskRerunService } from './task-rerun.service'

describe('TaskRerunService', () => {
  function createService() {
    const currentTask = {
      id: 'current-matrix-task',
      projectId: 'project-1',
      type: AITaskType.MATRIX,
      input: { clusteringTaskId: 'clustering-task-1' },
      result: { selectedResult: { matrix: [{ cluster_id: 'cluster-1' }] } },
      status: TaskStatus.COMPLETED,
      backupResult: null,
      backupCreatedAt: null,
    }
    const newTask = {
      id: 'new-matrix-task',
      projectId: 'project-1',
      type: AITaskType.MATRIX,
      input: currentTask.input,
      status: TaskStatus.PENDING,
      backupResult: null,
      backupCreatedAt: null,
    }
    const aiTaskRepo = {
      findOne: jest.fn().mockResolvedValue(currentTask),
      save: jest.fn().mockImplementation(async (task) => task),
      update: jest.fn().mockImplementation(async () => ({ affected: 1 })),
    }
    const aiTasksService = {
      createTask: jest.fn().mockResolvedValue(newTask),
    }

    return {
      service: new TaskRerunService(aiTaskRepo as any, aiTasksService as any),
      aiTaskRepo,
      aiTasksService,
      currentTask,
      newTask,
    }
  }

  it('backs up the current result and creates a queued rerun task for the same project', async () => {
    const { service, aiTaskRepo, aiTasksService, currentTask, newTask } = createService()

    await expect(
      service.rerunWithBackup('project-1', AITaskType.MATRIX, 'user-1'),
    ).resolves.toEqual(newTask)

    expect(currentTask.backupResult).toEqual(currentTask.result)
    expect(currentTask.backupCreatedAt).toBeInstanceOf(Date)
    expect(aiTaskRepo.save).toHaveBeenCalledWith(currentTask)
    expect(aiTaskRepo.update).toHaveBeenCalledWith(newTask.id, {
      backupResult: currentTask.result,
      backupCreatedAt: currentTask.backupCreatedAt,
    })
    expect(newTask.backupResult).toEqual(currentTask.result)
    expect(newTask.backupCreatedAt).toBe(currentTask.backupCreatedAt)
    expect(aiTasksService.createTask).toHaveBeenCalledWith(
      {
        projectId: 'project-1',
        type: AITaskType.MATRIX,
        input: currentTask.input,
      },
      'user-1',
    )
  })
})
