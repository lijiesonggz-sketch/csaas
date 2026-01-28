import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AITasksService } from './ai-tasks.service'
import { AITask } from '../../database/entities/ai-task.entity'
import { QuestionnaireGenerator } from '../ai-generation/generators/questionnaire.generator'
import { AIOrchestrator } from '../ai-clients/ai-orchestrator.service'
import { TasksGateway } from './gateways/tasks.gateway'
import { ResultAggregatorService } from '../result-aggregation/result-aggregator.service'
import { QualityValidationService } from '../quality-validation/quality-validation.service'
import { Queue } from 'bullmq'

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

  // Mock数据
  const mockTaskId = 'test-task-id'
  const mockProjectId = 'test-project-id'
  const mockMatrixTaskId = 'test-matrix-task-id'

  const mockMatrixResult = {
    matrix: [
      { cluster_id: 'cluster_1', cluster_name: '聚类1' },
      { cluster_id: 'cluster_2', cluster_name: '聚类2' },
      { cluster_id: 'cluster_3', cluster_name: '聚类3' },
    ],
  }

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
  })

  describe('POST /ai-tasks/:id/regenerate-cluster - 重新生成单个聚类', () => {
    it('应该重新生成指定的聚类', async () => {
      // Arrange
      const clusterId = 'cluster_1'
      aiTaskRepo.findOne = jest.fn().mockResolvedValue(mockCompletedTask)

      const newQuestions = [
        { question_id: 'Q001', cluster_id: clusterId, question_text: '新问题1' },
        { question_id: 'Q002', cluster_id: clusterId, question_text: '新问题2' },
      ]

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
})
