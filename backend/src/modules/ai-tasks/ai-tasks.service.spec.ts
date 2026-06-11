import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AITasksService } from './ai-tasks.service'
import { AITask } from '../../database/entities/ai-task.entity'
import { AIGenerationResult } from '../../database/entities/ai-generation-result.entity'
import { QuestionnaireGenerator } from '../ai-generation/generators/questionnaire.generator'
import { AIOrchestrator } from '../ai-clients/ai-orchestrator.service'
import { TasksGateway } from './gateways/tasks.gateway'
import { ResultAggregatorService } from '../result-aggregation/result-aggregator.service'
import { QualityValidationService } from '../quality-validation/quality-validation.service'

/**
 * 问卷断点续跑功能的测试套件
 *
 * 测试场景：
 * 1. 继续生成：从上次失败的位置继续
 * 2. 单聚类重生成：重新生成特定聚类的问题
 * 3. 状态管理：正确跟踪已完成/待生成的聚类
 */

describe('Questionnaire Resume Generation (TDD)', () => {
  let service: AITasksService
  let aiTaskRepo: Repository<AITask>
  let generationResultRepo: Repository<AIGenerationResult>

  // Mock数据
  const mockTaskId = 'test-task-id'
  const mockProjectId = 'test-project-id'
  const mockMatrixTaskId = 'test-matrix-task-id'

  const mockPartialResult = {
    questionnaire: [
      // 只有cluster_1完成了5题
      { question_id: 'Q001', cluster_id: 'cluster_1', question_text: '问题1' },
      { question_id: 'Q002', cluster_id: 'cluster_1', question_text: '问题2' },
      { question_id: 'Q003', cluster_id: 'cluster_1', question_text: '问题3' },
      { question_id: 'Q004', cluster_id: 'cluster_1', question_text: '问题4' },
      { question_id: 'Q005', cluster_id: 'cluster_1', question_text: '问题5' },
    ],
    questionnaire_metadata: {
      total_questions: 5,
      coverage_map: { cluster_1: 5 },
    },
  }

  const mockCompletedTask = {
    id: mockTaskId,
    projectId: mockProjectId,
    type: 'questionnaire',
    status: 'completed',
    input: { matrixTaskId: mockMatrixTaskId },
    result: mockPartialResult,
    clusterGenerationStatus: {
      totalClusters: 3,
      completedClusters: ['cluster_1'],
      failedClusters: [],
      pendingClusters: ['cluster_2', 'cluster_3'],
      clusterProgress: {
        cluster_1: {
          clusterId: 'cluster_1',
          clusterName: '聚类1',
          status: 'completed',
          questionsGenerated: 5,
          questionsExpected: 5,
        },
        cluster_2: {
          clusterId: 'cluster_2',
          clusterName: '聚类2',
          status: 'pending',
          questionsGenerated: 0,
          questionsExpected: 5,
        },
        cluster_3: {
          clusterId: 'cluster_3',
          clusterName: '聚类3',
          status: 'pending',
          questionsGenerated: 0,
          questionsExpected: 5,
        },
      },
    },
  }

  beforeEach(async () => {
    // Mock repository methods
    const mockRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    }
    const mockGenerationResultRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
    }

    // Mock save to return the task
    mockRepo.save.mockImplementation((task) => Promise.resolve(task))
    // Mock create to return the input
    mockRepo.create.mockImplementation((input) => input)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AITasksService,
        {
          provide: getRepositoryToken(AITask),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(AIGenerationResult),
          useValue: mockGenerationResultRepo,
        },
        {
          provide: 'BullQueue_ai-tasks',
          useValue: {
            add: jest.fn(),
            getWaitingCount: jest.fn(),
            getActiveCount: jest.fn(),
          },
        },
        {
          provide: QuestionnaireGenerator,
          useValue: {
            generateSingleCluster: jest.fn(),
          },
        },
        {
          provide: AIOrchestrator,
          useValue: {},
        },
        {
          provide: TasksGateway,
          useValue: {
            emitTaskProgress: jest.fn(),
          },
        },
        {
          provide: ResultAggregatorService,
          useValue: {},
        },
        {
          provide: QualityValidationService,
          useValue: {},
        },
      ],
    }).compile()

    service = module.get<AITasksService>(AITasksService)
    aiTaskRepo = module.get<Repository<AITask>>(getRepositoryToken(AITask))
    generationResultRepo = module.get<Repository<AIGenerationResult>>(
      getRepositoryToken(AIGenerationResult),
    )
  })

  describe('GET /ai-tasks/:id - 结果质量元数据', () => {
    it('should merge latest generation quality metadata into task result when task result lacks it', async () => {
      aiTaskRepo.findOne = jest.fn().mockResolvedValue({
        ...mockCompletedTask,
        result: mockPartialResult,
      })
      generationResultRepo.findOne = jest.fn().mockResolvedValue({
        taskId: mockTaskId,
        selectedModel: 'claude',
        confidenceLevel: 'medium',
        qualityScores: {
          structural: 1,
          semantic: 0.7178,
          detail: 0.998,
        },
        consistencyReport: {
          agreements: ['Field questionnaire: structurally aligned'],
          disagreements: [],
          highRiskDisagreements: [],
        },
        selectedResult: {
          questionnaire: [{ question_id: 'Q001' }],
        },
      })

      const task = await service.getTask(mockTaskId)

      expect(task.result?.questionnaire).toEqual(mockPartialResult.questionnaire)
      expect(task.result?.qualityScores).toEqual({
        structural: 1,
        semantic: 0.7178,
        detail: 0.998,
      })
      expect(task.result?.selectedModel).toBe('claude')
      expect(task.result?.confidenceLevel).toBe('medium')
      expect(task.result?.consistencyReport?.agreements).toHaveLength(1)
    })
  })

  describe('POST /ai-tasks/:id/resume - 继续生成问卷', () => {
    it('应该从上次中断的位置继续生成', async () => {
      // Arrange
      aiTaskRepo.findOne = jest.fn().mockResolvedValue(mockCompletedTask)

      // Act
      const result = await service.resumeQuestionnaireGeneration(mockTaskId)

      // Assert
      expect(result).toBeDefined()
      expect(result.clustersToGenerate).toHaveLength(2)
      expect(result.clustersToGenerate).toEqual(['cluster_2', 'cluster_3'])
    })

    it('应该正确计算进度：已完成1/3，剩余2/3', async () => {
      // Arrange
      aiTaskRepo.findOne = jest.fn().mockResolvedValue(mockCompletedTask)

      // Act
      const status = await service.getClusterGenerationStatus(mockTaskId)

      // Assert
      expect(status.totalClusters).toBe(3)
      expect(status.completedClusters).toHaveLength(1)
      expect(status.pendingClusters).toHaveLength(2)
      expect(status.completedClusters).toContain('cluster_1')
    })

    it('如果没有待生成的聚类，应该抛出错误', async () => {
      // Arrange - 所有聚类都已完成
      const allCompletedTask = {
        ...mockCompletedTask,
        clusterGenerationStatus: {
          ...mockCompletedTask.clusterGenerationStatus,
          completedClusters: ['cluster_1', 'cluster_2', 'cluster_3'],
          pendingClusters: [],
          clusterProgress: {
            cluster_1: {
              ...mockCompletedTask.clusterGenerationStatus.clusterProgress.cluster_1,
              status: 'completed',
            },
            cluster_2: {
              ...mockCompletedTask.clusterGenerationStatus.clusterProgress.cluster_2,
              status: 'completed',
              questionsGenerated: 5,
            },
            cluster_3: {
              ...mockCompletedTask.clusterGenerationStatus.clusterProgress.cluster_3,
              status: 'completed',
              questionsGenerated: 5,
            },
          },
        },
      }
      aiTaskRepo.findOne = jest.fn().mockResolvedValue(allCompletedTask)

      // Act & Assert
      await expect(service.resumeQuestionnaireGeneration(mockTaskId)).rejects.toThrow(
        '所有聚类已生成完成，无需继续',
      )
    })

    it('应该从pendingClusters开始生成', async () => {
      // Arrange
      aiTaskRepo.findOne = jest.fn().mockResolvedValue(mockCompletedTask)

      // Act
      const result = await service.resumeQuestionnaireGeneration(mockTaskId)

      // Assert
      expect(result.nextClusterId).toBe('cluster_2')
      expect(result.message).toContain('继续生成 2 个聚类')
    })

    it('当任务没有持久化题目结果时应该重新生成全部聚类', async () => {
      const interruptedTask = {
        ...mockCompletedTask,
        result: null,
      }
      aiTaskRepo.findOne = jest.fn().mockResolvedValue(interruptedTask)

      const result = await service.resumeQuestionnaireGeneration(mockTaskId)

      expect(result.clustersToGenerate).toEqual(['cluster_1', 'cluster_2', 'cluster_3'])
      expect(result.nextClusterId).toBe('cluster_1')
    })
  })

  describe('POST /ai-tasks/:id/regenerate-cluster - 重新生成单个聚类', () => {
    it('应该重新生成指定的聚类', async () => {
      // Arrange
      const clusterId = 'cluster_1'
      aiTaskRepo.findOne = jest.fn().mockResolvedValue(mockCompletedTask)

      // Act
      const result = await service.regenerateCluster(mockTaskId, clusterId)

      // Assert
      expect(result).toBeDefined()
      expect(result.clusterId).toBe(clusterId)
    })

    it('如果聚类ID不存在，应该抛出错误', async () => {
      // Arrange
      const invalidClusterId = 'cluster_999'
      aiTaskRepo.findOne = jest.fn().mockResolvedValue(mockCompletedTask)

      // Act & Assert
      await expect(service.regenerateCluster(mockTaskId, invalidClusterId)).rejects.toThrow(
        '聚类 cluster_999 不存在',
      )
    })
  })

  describe('GET /ai-tasks/:id/cluster-status - 获取聚类生成状态', () => {
    it('应该返回完整的聚类生成状态', async () => {
      // Arrange
      aiTaskRepo.findOne = jest.fn().mockResolvedValue(mockCompletedTask)

      // Act
      const status = await service.getClusterGenerationStatus(mockTaskId)

      // Assert
      expect(status).toEqual({
        totalClusters: 3,
        completedClusters: ['cluster_1'],
        pendingClusters: ['cluster_2', 'cluster_3'],
        failedClusters: [],
        clusterProgress: {
          cluster_1: {
            clusterId: 'cluster_1',
            clusterName: '聚类1',
            status: 'completed',
            questionsGenerated: 5,
            questionsExpected: 5,
          },
          cluster_2: {
            clusterId: 'cluster_2',
            clusterName: '聚类2',
            status: 'pending',
            questionsGenerated: 0,
            questionsExpected: 5,
          },
          cluster_3: {
            clusterId: 'cluster_3',
            clusterName: '聚类3',
            status: 'pending',
            questionsGenerated: 0,
            questionsExpected: 5,
          },
        },
      })
    })

    it('应该正确计算进度百分比', async () => {
      // Arrange
      aiTaskRepo.findOne = jest.fn().mockResolvedValue(mockCompletedTask)

      // Act
      const status = await service.getClusterGenerationStatus(mockTaskId)

      // Assert
      const completedCount = status.completedClusters.length
      const totalCount = status.totalClusters
      const progressPercentage = Math.round((completedCount / totalCount) * 100)

      expect(progressPercentage).toBe(33) // 1/3 ≈ 33%
    })

    it('应该规范化重复或过期的聚类状态列表', async () => {
      const dirtyStatusTask = {
        ...mockCompletedTask,
        clusterGenerationStatus: {
          totalClusters: 3,
          completedClusters: ['cluster_1'],
          failedClusters: [],
          pendingClusters: ['cluster_1', 'cluster_2', 'cluster_2', 'cluster_3'],
          clusterProgress: {
            cluster_1: {
              clusterId: 'cluster_1',
              clusterName: '聚类1',
              status: 'completed',
              questionsGenerated: 5,
              questionsExpected: 5,
            },
            cluster_2: {
              clusterId: 'cluster_2',
              clusterName: '聚类2',
              status: 'pending',
              questionsGenerated: 0,
              questionsExpected: 5,
            },
            cluster_3: {
              clusterId: 'cluster_3',
              clusterName: '聚类3',
              status: 'failed',
              questionsGenerated: 0,
              questionsExpected: 5,
              error: 'AI调用失败',
            },
          },
        },
      }
      aiTaskRepo.findOne = jest.fn().mockResolvedValue(dirtyStatusTask)

      const status = await service.getClusterGenerationStatus(mockTaskId)

      expect(status.completedClusters).toEqual(['cluster_1'])
      expect(status.pendingClusters).toEqual(['cluster_2'])
      expect(status.failedClusters).toEqual(['cluster_3'])
    })
  })

  describe('集成测试：完整的断点续跑流程', () => {
    it('场景1：部分完成后继续生成剩余聚类', async () => {
      // Arrange: 模拟cluster_1已完成，cluster_2失败，cluster_3待生成
      const partialFailedTask = {
        ...mockCompletedTask,
        clusterGenerationStatus: {
          totalClusters: 3,
          completedClusters: ['cluster_1'],
          failedClusters: ['cluster_2'],
          pendingClusters: ['cluster_3'],
          clusterProgress: {
            cluster_1: { status: 'completed', questionsGenerated: 5 },
            cluster_2: { status: 'failed', error: 'AI调用超时', questionsGenerated: 0 },
            cluster_3: { status: 'pending', questionsGenerated: 0 },
          },
        },
      }

      aiTaskRepo.findOne = jest.fn().mockResolvedValue(partialFailedTask)

      // Act: 继续生成
      const result = await service.resumeQuestionnaireGeneration(mockTaskId)

      // Assert: 应该跳过cluster_1（已完成），重试cluster_2（失败），生成cluster_3（待生成）
      expect(result.clustersToGenerate).toHaveLength(2)
      expect(result.clustersToGenerate).toContain('cluster_2')
      expect(result.clustersToGenerate).toContain('cluster_3')
      expect(result.clustersToGenerate).not.toContain('cluster_1')
    })
  })
  describe('Standard Interpretation Status Messaging', () => {
    it('should mark stale standard interpretation extraction task as failed instead of reporting processing', async () => {
      const taskId = 'stale-standard-extraction-task-id'
      aiTaskRepo.findOne = jest.fn().mockResolvedValue({
        id: taskId,
        projectId: mockProjectId,
        type: 'standard_interpretation',
        status: 'processing',
        generationStage: 'generating_models',
        createdAt: new Date(Date.now() - 120 * 60000).toISOString(),
        updatedAt: new Date(Date.now() - 45 * 60000).toISOString(),
        completedAt: null,
        errorMessage: null,
        progressDetails: {
          gpt4: {
            status: 'generating',
            message: '正在提取条款清单...',
          },
          totalClauses: 161,
          totalBatches: 0,
          currentBatch: 0,
          phase: 'extraction',
          stage: 'extracting_clauses',
          stageMessage: '检测到161个条款，开始提取...',
          percentage: 5,
        },
      })

      const status = await service.getTaskStatus(taskId)

      expect(status.status).toBe('failed')
      expect(status.stage).toBe('failed')
      expect(status.message).toContain('标准解读失败')
      expect(status.message).toContain('任务已中断')
      expect(status.details?.phase).toBe('extraction')
      expect(status.details?.totalClauses).toBe(161)
      expect(aiTaskRepo.update).toHaveBeenCalledWith(
        taskId,
        expect.objectContaining({
          status: 'failed',
          generationStage: 'failed',
          errorMessage: expect.stringContaining('任务已中断'),
        }),
      )
      const persistedUpdate = (aiTaskRepo.update as jest.Mock).mock.calls[0][1]
      expect(persistedUpdate.progressDetails.phase).toBe('extraction')
      expect(persistedUpdate.progressDetails.gpt4.status).toBe('failed')
      expect(persistedUpdate.progressDetails.gpt4.error).toContain('任务已中断')
    })

    it('should mark stale standard interpretation batch task as failed instead of reporting processing', async () => {
      const taskId = 'stale-standard-task-id'
      aiTaskRepo.findOne = jest.fn().mockResolvedValue({
        id: taskId,
        projectId: mockProjectId,
        type: 'standard_interpretation',
        status: 'processing',
        generationStage: 'generating_models',
        createdAt: new Date(Date.now() - 120 * 60000).toISOString(),
        updatedAt: new Date(Date.now() - 45 * 60000).toISOString(),
        completedAt: null,
        errorMessage: null,
        progressDetails: {
          gpt4: {
            status: 'generating',
            message: 'DeepSeek 批次 18/33 完成',
          },
          totalClauses: 161,
          totalBatches: 33,
          currentBatch: 18,
          phase: 'interpretation',
          stage: 'interpreting_batches',
          stageMessage: '批次进度: 18/33',
          percentage: 59,
        },
      })

      const status = await service.getTaskStatus(taskId)

      expect(status.status).toBe('failed')
      expect(status.stage).toBe('failed')
      expect(status.message).toContain('标准解读失败')
      expect(status.message).toContain('任务已中断')
      expect(status.details?.currentBatch).toBe(18)
      expect(status.details?.totalBatches).toBe(33)
      expect(aiTaskRepo.update).toHaveBeenCalledWith(
        taskId,
        expect.objectContaining({
          status: 'failed',
          generationStage: 'failed',
          errorMessage: expect.stringContaining('任务已中断'),
        }),
      )
      const persistedUpdate = (aiTaskRepo.update as jest.Mock).mock.calls[0][1]
      expect(persistedUpdate.progressDetails.currentBatch).toBe(18)
      expect(persistedUpdate.progressDetails.gpt4.status).toBe('failed')
      expect(persistedUpdate.progressDetails.gpt4.error).toContain('任务已中断')
    })

    it('should return interpretation-specific processing message when progress details are still minimal', async () => {
      aiTaskRepo.findOne = jest.fn().mockResolvedValue({
        id: 'standard-task-id',
        projectId: mockProjectId,
        type: 'standard_interpretation',
        status: 'processing',
        generationStage: 'generating_models',
        createdAt: new Date(Date.now() - 60000).toISOString(),
        progressDetails: {
          gpt4: {
            status: 'generating',
            message: '正在解读标准内容...',
          },
          stage: 'interpreting_standard',
          stageMessage: '正在解读标准内容...',
          percentage: 15,
        },
      })

      const status = await service.getTaskStatus('standard-task-id')

      expect(status.status).toBe('processing')
      expect(status.message).toBe('正在解读标准内容...')
      expect(status.stage).toBe('generating_models')
      expect(status.progress.percentage).toBe(15)
    })

    it('should return matrix-specific progress message when matrix generation is running', async () => {
      aiTaskRepo.findOne = jest.fn().mockResolvedValue({
        id: 'matrix-task-id',
        projectId: mockProjectId,
        type: 'matrix',
        status: 'processing',
        generationStage: 'generating_models',
        createdAt: new Date(Date.now() - 60000).toISOString(),
        progressDetails: {
          percentage: 58,
          stage: 'generating_matrix',
          stageMessage: '正在生成成熟度矩阵 (1/2)：8.1.2 过程描述',
          currentCluster: 1,
          totalClusters: 2,
          clusterName: '8.1.2 过程描述',
        },
      })

      const status = await service.getTaskStatus('matrix-task-id')

      expect(status.status).toBe('processing')
      expect(status.message).toBe('正在生成成熟度矩阵 (1/2)：8.1.2 过程描述')
      expect(status.progress.percentage).toBe(58)
      expect(status.details?.currentCluster).toBe(1)
      expect(status.details?.totalClusters).toBe(2)
    })
  })

  describe('Questionnaire stale task handling', () => {
    it('should mark stale questionnaire task as failed when loading project tasks', async () => {
      const taskId = 'stale-questionnaire-task-id'
      aiTaskRepo.find = jest.fn().mockResolvedValue([
        {
          id: taskId,
          projectId: mockProjectId,
          type: 'questionnaire',
          status: 'processing',
          generationStage: 'generating_models',
          input: { matrixTaskId: mockMatrixTaskId },
          result: null,
          createdAt: new Date(Date.now() - 120 * 60000).toISOString(),
          updatedAt: new Date(Date.now() - 45 * 60000).toISOString(),
          clusterGenerationStatus: {
            totalClusters: 2,
            completedClusters: ['cluster_1__row_1'],
            failedClusters: [],
            pendingClusters: ['cluster_2__row_2'],
            clusterProgress: {
              cluster_1__row_1: {
                clusterId: 'cluster_1__row_1',
                clusterName: '聚类1',
                status: 'completed',
                questionsGenerated: 5,
                questionsExpected: 5,
              },
              cluster_2__row_2: {
                clusterId: 'cluster_2__row_2',
                clusterName: '聚类2',
                status: 'generating',
                questionsGenerated: 0,
                questionsExpected: 5,
              },
            },
          },
        },
      ])

      const tasks = await service.getTasksByProject(mockProjectId)

      expect(tasks[0].status).toBe('failed')
      expect(tasks[0].generationStage).toBe('failed')
      expect(tasks[0].errorMessage).toContain('问卷生成任务已中断')
      expect(tasks[0].clusterGenerationStatus?.pendingClusters).toEqual([
        'cluster_1__row_1',
        'cluster_2__row_2',
      ])
      expect(aiTaskRepo.update).toHaveBeenCalledWith(
        taskId,
        expect.objectContaining({
          status: 'failed',
          generationStage: 'failed',
          errorMessage: expect.stringContaining('问卷生成任务已中断'),
        }),
      )
    })

    it('should not report completed questionnaire clusters when failed task has no persisted questions', async () => {
      aiTaskRepo.find = jest.fn().mockResolvedValue([
        {
          id: 'failed-with-progress-only',
          projectId: mockProjectId,
          type: 'questionnaire',
          status: 'failed',
          generationStage: 'failed',
          input: { matrixTaskId: mockMatrixTaskId },
          result: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          clusterGenerationStatus: {
            totalClusters: 2,
            completedClusters: ['cluster_1__row_1'],
            failedClusters: [],
            pendingClusters: ['cluster_2__row_2'],
            clusterProgress: {
              cluster_1__row_1: {
                clusterId: 'cluster_1__row_1',
                clusterName: '聚类1',
                status: 'completed',
                questionsGenerated: 5,
                questionsExpected: 5,
              },
              cluster_2__row_2: {
                clusterId: 'cluster_2__row_2',
                clusterName: '聚类2',
                status: 'generating',
                questionsGenerated: 0,
                questionsExpected: 5,
              },
            },
          },
        },
      ])

      const tasks = await service.getTasksByProject(mockProjectId)

      expect(tasks[0].clusterGenerationStatus?.completedClusters).toEqual([])
      expect(tasks[0].clusterGenerationStatus?.failedClusters).toEqual([])
      expect(tasks[0].clusterGenerationStatus?.pendingClusters).toEqual([
        'cluster_1__row_1',
        'cluster_2__row_2',
      ])
      expect(tasks[0].clusterGenerationStatus?.clusterProgress.cluster_1__row_1.status).toBe(
        'pending',
      )
      expect(
        tasks[0].clusterGenerationStatus?.clusterProgress.cluster_1__row_1.questionsGenerated,
      ).toBe(0)
    })
  })
})
