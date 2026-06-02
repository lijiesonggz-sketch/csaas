import { AITaskProcessor } from './ai-task.processor'
import { AITaskType } from '@/database/entities/ai-task.entity'

describe('AITaskProcessor document loading', () => {
  function createProcessor(overrides: Record<string, any> = {}) {
    const aiTaskRepo = {
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
    }
    const eventRepo = {
      create: jest.fn((value) => value),
      save: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    }
    const costRepo = {
      save: jest.fn().mockResolvedValue(undefined),
    }
    const projectRepo = {
      findOne: jest.fn().mockResolvedValue({
        metadata: {
          uploadedDocuments: [],
        },
      }),
    }
    const standardDocumentRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'doc-1',
          name: 'GB/T 33136',
          content: 'standard document content',
          metadata: {
            original_filename: 'GBT+33136-2024.pdf',
          },
        },
      ]),
    }
    const aiOrchestrator = {
      generate: jest.fn(),
    }
    const tasksGateway = {
      emitTaskProgress: jest.fn(),
      emitTaskCompleted: jest.fn(),
      emitTaskFailed: jest.fn(),
    }
    const costMonitoring = {
      checkTaskCostAlert: jest.fn().mockResolvedValue(null),
      checkProjectCostAlert: jest.fn().mockResolvedValue(null),
      sendCostAlert: jest.fn().mockResolvedValue(undefined),
    }
    const clusteringGenerator = {
      generate: jest.fn().mockResolvedValue({
        gpt4: { categories: [] },
        claude: { categories: [] },
        domestic: { categories: [] },
      }),
    }
    const matrixGenerator = {
      generate: jest.fn(),
    }
    const questionnaireGenerator = {
      generate: jest.fn(),
    }
    const standardInterpretationGenerator = {
      generate: jest.fn(),
    }
    const qualityValidation = {
      validateQuality: jest.fn().mockResolvedValue({
        overallScore: 0.91,
        confidenceLevel: 'high',
        passed: true,
      }),
    }
    const resultAggregator = {
      aggregate: jest.fn().mockResolvedValue({
        selectedModel: 'gpt4',
        selectedResult: {
          categories: [],
          clustering_logic: 'test logic',
        },
        qualityScores: {},
        confidenceLevel: 'high',
        consistencyReport: {},
      }),
    }
    const eventEmitter = {
      emit: jest.fn(),
    }

    const mocks = {
      aiTaskRepo,
      eventRepo,
      costRepo,
      projectRepo,
      standardDocumentRepo,
      aiOrchestrator,
      tasksGateway,
      costMonitoring,
      clusteringGenerator,
      matrixGenerator,
      questionnaireGenerator,
      standardInterpretationGenerator,
      qualityValidation,
      resultAggregator,
      eventEmitter,
      ...overrides,
    }

    const processor = new AITaskProcessor(
      mocks.aiTaskRepo as any,
      mocks.eventRepo as any,
      mocks.costRepo as any,
      mocks.projectRepo as any,
      mocks.standardDocumentRepo as any,
      mocks.aiOrchestrator as any,
      mocks.tasksGateway as any,
      mocks.costMonitoring as any,
      mocks.clusteringGenerator as any,
      mocks.matrixGenerator as any,
      mocks.questionnaireGenerator as any,
      mocks.standardInterpretationGenerator as any,
      mocks.qualityValidation as any,
      mocks.resultAggregator as any,
      mocks.eventEmitter as any,
    )

    return { processor, mocks }
  }

  it('应该在项目 metadata 缺失文档时从 standard_documents 加载聚类文档', async () => {
    const { processor, mocks } = createProcessor()

    await processor.process({
      data: {
        taskId: 'task-1',
        type: AITaskType.CLUSTERING,
        projectId: 'project-1',
        input: {
          documentIds: ['doc-1'],
          maxTokens: 60000,
        },
      },
      updateProgress: jest.fn().mockResolvedValue(undefined),
    } as any)

    expect(mocks.standardDocumentRepo.find).toHaveBeenCalledWith({
      where: {
        id: expect.anything(),
        projectId: 'project-1',
      },
    })
    expect(mocks.clusteringGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        documents: [
          expect.objectContaining({
            id: 'doc-1',
            name: 'GB/T 33136',
            content: 'standard document content',
          }),
        ],
      }),
      'task-1',
      expect.any(Function),
    )
  })

  it('应该把聚类生成模式传递给 ClusteringGenerator', async () => {
    const { processor, mocks } = createProcessor()

    await processor.process({
      data: {
        taskId: 'task-1',
        type: AITaskType.CLUSTERING,
        projectId: 'project-1',
        input: {
          documentIds: ['doc-1'],
          maxTokens: 60000,
          clusteringMode: 'ai',
        },
      },
      updateProgress: jest.fn().mockResolvedValue(undefined),
    } as any)

    expect(mocks.clusteringGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        clusteringMode: 'ai',
      }),
      'task-1',
      expect.any(Function),
    )
  })

  it('应该在矩阵逐聚类生成时写入可恢复进度', async () => {
    const matrixGenerator = {
      generate: jest.fn(async (_input, onProgress) => {
        await onProgress({
          current: 1,
          total: 2,
          clusterName: '8.1.2 过程描述',
          message: '正在生成成熟度矩阵 (1/2)：8.1.2 过程描述',
        })

        return {
          gpt4: { matrix: [] },
          claude: { matrix: [] },
          domestic: { matrix: [] },
        }
      }),
    }
    const resultAggregator = {
      aggregate: jest.fn().mockResolvedValue({
        selectedModel: 'gpt4',
        selectedResult: {
          matrix: [],
          maturity_model_description: 'test model',
        },
        qualityScores: {},
        confidenceLevel: 'high',
        consistencyReport: {},
      }),
    }
    const { processor, mocks } = createProcessor({
      matrixGenerator,
      resultAggregator,
    })

    mocks.aiTaskRepo.findOne.mockResolvedValue({
      id: 'clustering-task-1',
      result: {
        categories: [
          {
            clusters: [{ id: 'cluster-1', name: '8.1.2 过程描述', clauses: [] }],
          },
        ],
      },
    })

    await processor.process({
      data: {
        taskId: 'matrix-task-1',
        type: AITaskType.MATRIX,
        projectId: 'project-1',
        input: {
          clusteringTaskId: 'clustering-task-1',
        },
      },
      updateProgress: jest.fn().mockResolvedValue(undefined),
    } as any)

    expect(mocks.aiTaskRepo.update).toHaveBeenCalledWith(
      'matrix-task-1',
      expect.objectContaining({
        progress: 58,
        progressDetails: expect.objectContaining({
          percentage: 58,
          stage: 'generating_matrix',
          stageMessage: '正在生成成熟度矩阵 (1/2)：8.1.2 过程描述',
          currentCluster: 1,
          totalClusters: 2,
          clusterName: '8.1.2 过程描述',
        }),
      }),
    )
    expect(mocks.tasksGateway.emitTaskProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'matrix-task-1',
        progress: 58,
        message: '正在生成成熟度矩阵 (1/2)：8.1.2 过程描述',
        currentStep: 'generating_matrix',
      }),
    )
  })
})
