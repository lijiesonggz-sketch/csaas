import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import {
  AuditAction,
  AIGenerationResult,
  ControlPoint,
  Project,
  ProjectMember,
  RegulationClause,
} from '@/database/entities'
import { AITask, AITaskType, TaskStatus } from '../../database/entities/ai-task.entity'
import { ProjectReviewService } from './services/project-review.service'
import { AuditLogService } from './services/audit-log.service'

describe('ProjectReviewService', () => {
  let service: ProjectReviewService

  const projectRepo = {
    findOne: jest.fn(),
  }

  const projectMemberRepo = {
    findOne: jest.fn(),
  }

  const aiTaskRepo = {
    find: jest.fn(),
  }

  const generationResultRepo = {
    find: jest.fn(),
    manager: {
      transaction: jest.fn(),
    },
  }

  const controlPointRepo = {
    find: jest.fn(),
  }

  const regulationClauseRepo = {
    find: jest.fn(),
  }

  const auditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectReviewService,
        {
          provide: getRepositoryToken(Project),
          useValue: projectRepo,
        },
        {
          provide: getRepositoryToken(ProjectMember),
          useValue: projectMemberRepo,
        },
        {
          provide: getRepositoryToken(AITask),
          useValue: aiTaskRepo,
        },
        {
          provide: getRepositoryToken(AIGenerationResult),
          useValue: generationResultRepo,
        },
        {
          provide: getRepositoryToken(ControlPoint),
          useValue: controlPointRepo,
        },
        {
          provide: getRepositoryToken(RegulationClause),
          useValue: regulationClauseRepo,
        },
        {
          provide: AuditLogService,
          useValue: auditLogService,
        },
      ],
    }).compile()

    service = module.get(ProjectReviewService)
    jest.clearAllMocks()
    generationResultRepo.manager.transaction.mockImplementation(
      async (callback: (manager: { update: jest.Mock }) => Promise<void> | void) => {
        const manager = {
          update: jest.fn().mockResolvedValue(undefined),
        }
        await callback(manager)
        return undefined
      },
    )
  })

  it('should deny access for non-owner and non-member users and write access_denied audit', async () => {
    projectRepo.findOne.mockResolvedValue({
      id: 'project-1',
      ownerId: 'owner-1',
      organizationId: 'org-1',
    })
    projectMemberRepo.findOne.mockResolvedValue(null)

    await expect(
      service.assertAccess('project-1', 'outsider-1', {
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
        query: {
          page: 2,
          pageSize: 10,
          reviewStatus: ['pending'],
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.ACCESS_DENIED,
        entityType: 'ProjectReviewList',
        entityId: 'project-1',
        details: expect.objectContaining({
          query: expect.objectContaining({
            page: 2,
            pageSize: 10,
            reviewStatus: ['pending'],
          }),
        }),
      }),
    )
  })

  it('should return paginated review items with derived risk, rerun capability and null-safe scores', async () => {
    const project = {
      id: 'project-1',
      ownerId: 'owner-1',
      organizationId: 'org-1',
      metadata: {},
    } as unknown as Project

    aiTaskRepo.find.mockResolvedValue([
      {
        id: 'task-clustering-new',
        projectId: 'project-1',
        type: AITaskType.CLUSTERING,
        status: TaskStatus.COMPLETED,
        input: {
          documentIds: ['doc-1'],
          sourceControlIds: ['control-clustering-1'],
        },
        createdAt: new Date('2026-03-29T09:00:00.000Z'),
      },
      {
        id: 'task-summary',
        projectId: 'project-1',
        type: AITaskType.SUMMARY,
        status: TaskStatus.LOW_CONFIDENCE,
        input: {
          standardDocument:
            '这是用于综述任务的组合标准文档内容，长度足够让 source preview 返回 complete 状态。',
        },
        createdAt: new Date('2026-03-29T08:00:00.000Z'),
      },
      {
        id: 'task-clustering-old',
        projectId: 'project-1',
        type: AITaskType.CLUSTERING,
        status: TaskStatus.COMPLETED,
        input: { documentIds: ['doc-0'] },
        createdAt: new Date('2026-03-28T08:00:00.000Z'),
      },
    ])

    generationResultRepo.find.mockResolvedValue([
      {
        id: 'result-summary',
        taskId: 'task-summary',
        generationType: AITaskType.SUMMARY,
        selectedResult: { title: '综述标题', overview: '综述摘要内容' },
        modifiedResult: null,
        qualityScores: {
          structural: 0.82,
          semantic: 0.77,
          detail: undefined,
        },
        consistencyReport: {
          highRiskDisagreements: ['风险点A'],
        },
        coverageReport: null,
        confidenceLevel: 'low',
        reviewStatus: 'pending',
        createdAt: new Date('2026-03-29T08:01:00.000Z'),
        updatedAt: new Date('2026-03-29T08:02:00.000Z'),
      },
      {
        id: 'result-clustering',
        taskId: 'task-clustering-new',
        generationType: AITaskType.CLUSTERING,
        selectedResult: {
          clauseId: 'clause-1',
          categories: [{ name: '身份与访问控制' }, { name: '数据治理' }],
        },
        modifiedResult: null,
        qualityScores: {
          structural: 0.95,
          semantic: 0.93,
          detail: 0.9,
        },
        consistencyReport: {
          highRiskDisagreements: [],
        },
        coverageReport: {
          coverageRate: 0.96,
        },
        confidenceLevel: 'high',
        reviewStatus: 'approved',
        createdAt: new Date('2026-03-29T09:01:00.000Z'),
        updatedAt: new Date('2026-03-29T09:03:00.000Z'),
      },
    ])
    controlPointRepo.find.mockResolvedValue([
      {
        controlId: 'control-clustering-1',
        controlName: '身份与访问控制',
        controlFamily: 'governance',
        riskLevelDefault: 'HIGH',
      },
    ])
    regulationClauseRepo.find.mockResolvedValue([
      {
        clauseId: 'clause-1',
        clauseCode: 'CLAUSE-001',
        articleNo: '第十条',
        clauseText: '真实条文原文',
        sourceId: 'source-1',
        clauseControlMaps: [{ controlId: 'control-clustering-1' }],
        source: {
          sourceId: 'source-1',
          sourceName: '监管报送办法',
        },
      },
    ])

    const response = await service.getReviewItems(project, {
      page: 1,
      pageSize: 10,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    })

    expect(response.pagination).toMatchObject({
      totalItems: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    })
    expect(response.items[0]).toMatchObject({
      reviewItemId: 'result-clustering',
      sourceResultId: 'result-clustering',
      taskId: 'task-clustering-new',
      reviewStage: AITaskType.CLUSTERING,
      title: '聚类分析',
      controlId: 'control-clustering-1',
      riskLevel: 'medium',
      canRerun: true,
      sourceModule: 'audit',
      provenanceStatus: 'citation_chain',
      citationChain: {
        sourceId: 'source-1',
        sourceName: '监管报送办法',
        clauseId: 'clause-1',
        clauseCode: 'CLAUSE-001',
        articleNo: '第十条',
        rawText: '真实条文原文',
      },
    })
    expect(response.items[1]).toMatchObject({
      reviewItemId: 'result-summary',
      sourceResultId: 'result-summary',
      riskLevel: 'high',
      canRerun: true,
      confidenceLevel: 'low',
      provenanceStatus: 'degraded_preview',
      citationChain: null,
    })
    expect(response.items[1].consistencyScores.detail).toBeNull()
    expect(response.items[1].degradationReasons).toEqual(
      expect.arrayContaining(['当前结果置信度为 LOW']),
    )
    expect(response.items[1].sourcePreview.sourceDocumentName).toBe('组合标准文档')
    expect(response.items[0].matchedControls).toEqual([
      expect.objectContaining({
        controlId: 'control-clustering-1',
        controlName: '身份与访问控制',
        packSource: 'governance',
        priority: 'HIGH',
      }),
    ])
    expect(response.items[1].matchedControls).toEqual([])
  })

  it('should not treat unrelated project uploads as degraded preview evidence', async () => {
    const project = {
      id: 'project-1',
      ownerId: 'owner-1',
      organizationId: 'org-1',
      metadata: {
        uploadedDocuments: [
          {
            name: 'project-level-source.pdf',
            content: '这是项目级上传文档，但不代表当前审核项具备可用来源预览。',
          },
        ],
      },
    } as unknown as Project

    aiTaskRepo.find.mockResolvedValue([
      {
        id: 'task-summary',
        projectId: 'project-1',
        type: AITaskType.SUMMARY,
        status: TaskStatus.COMPLETED,
        input: {},
        createdAt: new Date('2026-03-29T08:00:00.000Z'),
      },
    ])

    generationResultRepo.find.mockResolvedValue([
      {
        id: 'result-summary',
        taskId: 'task-summary',
        generationType: AITaskType.SUMMARY,
        selectedResult: { title: '综述标题' },
        modifiedResult: null,
        qualityScores: null,
        consistencyReport: { highRiskDisagreements: [] },
        coverageReport: null,
        confidenceLevel: 'high',
        reviewStatus: 'pending',
        createdAt: new Date('2026-03-29T08:01:00.000Z'),
        updatedAt: new Date('2026-03-29T08:02:00.000Z'),
      },
    ])
    controlPointRepo.find.mockResolvedValue([])
    regulationClauseRepo.find.mockResolvedValue([])

    const response = await service.getReviewItems(project, {
      page: 1,
      pageSize: 10,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    })

    expect(response.items).toHaveLength(1)
    expect(response.items[0]).toMatchObject({
      reviewItemId: 'result-summary',
      provenanceStatus: 'missing',
      citationChain: null,
      sourcePreview: {
        sourceExcerpt: null,
        sourceDocumentName: null,
        extractionQuality: 'missing',
      },
    })
  })

  it('should not elevate clause references to citation_chain without matched control linkage', async () => {
    const project = {
      id: 'project-1',
      ownerId: 'owner-1',
      organizationId: 'org-1',
      metadata: {},
    } as unknown as Project

    aiTaskRepo.find.mockResolvedValue([
      {
        id: 'task-summary',
        projectId: 'project-1',
        type: AITaskType.SUMMARY,
        status: TaskStatus.COMPLETED,
        input: {
          clauseId: 'clause-input-only',
          standardDocument:
            '这是用于综述任务的组合标准文档内容，长度足够让 source preview 返回 complete 状态。',
        },
        createdAt: new Date('2026-03-29T08:00:00.000Z'),
      },
    ])

    generationResultRepo.find.mockResolvedValue([
      {
        id: 'result-summary',
        taskId: 'task-summary',
        generationType: AITaskType.SUMMARY,
        selectedResult: {
          clauseId: 'clause-1',
          title: '综述标题',
        },
        modifiedResult: null,
        qualityScores: null,
        consistencyReport: { highRiskDisagreements: [] },
        coverageReport: null,
        confidenceLevel: 'medium',
        reviewStatus: 'pending',
        createdAt: new Date('2026-03-29T08:01:00.000Z'),
        updatedAt: new Date('2026-03-29T08:02:00.000Z'),
      },
    ])
    controlPointRepo.find.mockResolvedValue([])
    regulationClauseRepo.find.mockResolvedValue([
      {
        clauseId: 'clause-1',
        clauseCode: 'CLAUSE-001',
        articleNo: '第十条',
        clauseText: '真实条文原文',
        sourceId: 'source-1',
        clauseControlMaps: [{ controlId: 'control-unrelated' }],
        source: {
          sourceId: 'source-1',
          sourceName: '监管报送办法',
        },
      },
    ])

    const response = await service.getReviewItems(project, {
      page: 1,
      pageSize: 10,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    })

    expect(response.items).toHaveLength(1)
    expect(response.items[0]).toMatchObject({
      reviewItemId: 'result-summary',
      provenanceStatus: 'degraded_preview',
      citationChain: null,
    })
  })

  it('should apply status / risk / stage filters before pagination', async () => {
    const project = {
      id: 'project-1',
      ownerId: 'owner-1',
      organizationId: 'org-1',
      metadata: {},
    } as unknown as Project

    aiTaskRepo.find.mockResolvedValue([
      {
        id: 'task-summary',
        projectId: 'project-1',
        type: AITaskType.SUMMARY,
        status: TaskStatus.COMPLETED,
        input: {},
        createdAt: new Date('2026-03-29T08:00:00.000Z'),
      },
      {
        id: 'task-matrix',
        projectId: 'project-1',
        type: AITaskType.MATRIX,
        status: TaskStatus.COMPLETED,
        input: {},
        createdAt: new Date('2026-03-29T09:00:00.000Z'),
      },
    ])

    generationResultRepo.find.mockResolvedValue([
      {
        id: 'result-summary',
        taskId: 'task-summary',
        generationType: AITaskType.SUMMARY,
        selectedResult: { title: '综述' },
        modifiedResult: null,
        qualityScores: null,
        consistencyReport: { highRiskDisagreements: ['x'] },
        coverageReport: null,
        confidenceLevel: 'medium',
        reviewStatus: 'pending',
        createdAt: new Date('2026-03-29T08:01:00.000Z'),
        updatedAt: new Date('2026-03-29T08:02:00.000Z'),
      },
      {
        id: 'result-matrix',
        taskId: 'task-matrix',
        generationType: AITaskType.MATRIX,
        selectedResult: { matrix: [] },
        modifiedResult: null,
        qualityScores: null,
        consistencyReport: { highRiskDisagreements: [] },
        coverageReport: null,
        confidenceLevel: 'high',
        reviewStatus: 'approved',
        createdAt: new Date('2026-03-29T09:01:00.000Z'),
        updatedAt: new Date('2026-03-29T09:02:00.000Z'),
      },
    ])
    controlPointRepo.find.mockResolvedValue([])

    const response = await service.getReviewItems(project, {
      page: 1,
      pageSize: 10,
      reviewStatus: ['pending'],
      riskLevel: ['high'],
      reviewStage: AITaskType.SUMMARY,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    })

    expect(response.items).toHaveLength(1)
    expect(response.items[0]).toMatchObject({
      reviewItemId: 'result-summary',
      riskLevel: 'high',
      reviewStatus: 'pending',
      reviewStage: AITaskType.SUMMARY,
    })
    expect(response.filtersApplied).toMatchObject({
      reviewStatus: ['pending'],
      riskLevel: ['high'],
      reviewStage: AITaskType.SUMMARY,
    })
  })

  it('should reject bulk approve when reviewStage is missing', async () => {
    const project = {
      id: 'project-1',
      ownerId: 'owner-1',
      organizationId: 'org-1',
      metadata: {},
    } as unknown as Project

    await expect(
      service.bulkApprove(project, 'user-1', {
        reviewStage: undefined as unknown as AITaskType,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(generationResultRepo.manager.transaction).not.toHaveBeenCalled()
    expect(auditLogService.log).not.toHaveBeenCalled()
  })

  it('should block bulk approve when pending high-risk items remain and write batch audit', async () => {
    const project = {
      id: 'project-1',
      ownerId: 'owner-1',
      organizationId: 'org-1',
      metadata: {},
    } as unknown as Project

    aiTaskRepo.find.mockResolvedValue([
      {
        id: 'task-summary',
        projectId: 'project-1',
        type: AITaskType.SUMMARY,
        status: TaskStatus.COMPLETED,
        input: {},
        createdAt: new Date('2026-03-29T08:00:00.000Z'),
      },
    ])

    generationResultRepo.find.mockResolvedValue([
      {
        id: 'result-summary',
        taskId: 'task-summary',
        generationType: AITaskType.SUMMARY,
        selectedResult: { title: '综述' },
        modifiedResult: null,
        qualityScores: null,
        consistencyReport: { highRiskDisagreements: ['x'] },
        coverageReport: null,
        confidenceLevel: 'medium',
        reviewStatus: 'pending',
        createdAt: new Date('2026-03-29T08:01:00.000Z'),
        updatedAt: new Date('2026-03-29T08:02:00.000Z'),
      },
    ])
    controlPointRepo.find.mockResolvedValue([])

    const response = await service.bulkApprove(project, 'user-1', {
      reviewStage: AITaskType.SUMMARY,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    })

    expect(response).toEqual({
      reviewStage: AITaskType.SUMMARY,
      filtersApplied: expect.objectContaining({
        reviewStage: AITaskType.SUMMARY,
      }),
      blockedReviewItemIds: ['result-summary'],
      approvedReviewItemIds: [],
    })
    expect(generationResultRepo.manager.transaction).not.toHaveBeenCalled()
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATE,
        entityType: 'ProjectReviewBulkApprove',
        details: expect.objectContaining({
          blockedReviewItemIds: ['result-summary'],
          approvedReviewItemIds: [],
        }),
      }),
    )
  })

  it('should bulk approve remaining low-risk pending items and write batch audit', async () => {
    const project = {
      id: 'project-1',
      ownerId: 'owner-1',
      organizationId: 'org-1',
      metadata: {},
    } as unknown as Project

    aiTaskRepo.find.mockResolvedValue([
      {
        id: 'task-summary',
        projectId: 'project-1',
        type: AITaskType.SUMMARY,
        status: TaskStatus.COMPLETED,
        input: {},
        createdAt: new Date('2026-03-29T08:00:00.000Z'),
      },
    ])

    generationResultRepo.find.mockResolvedValue([
      {
        id: 'result-approved-high',
        taskId: 'task-summary',
        generationType: AITaskType.SUMMARY,
        selectedResult: { title: '综述' },
        modifiedResult: null,
        qualityScores: null,
        consistencyReport: { highRiskDisagreements: ['x'] },
        coverageReport: null,
        confidenceLevel: 'medium',
        reviewStatus: 'approved',
        createdAt: new Date('2026-03-29T08:01:00.000Z'),
        updatedAt: new Date('2026-03-29T08:02:00.000Z'),
      },
      {
        id: 'result-pending-low',
        taskId: 'task-summary',
        generationType: AITaskType.SUMMARY,
        selectedResult: { title: '综述' },
        modifiedResult: null,
        qualityScores: null,
        consistencyReport: { highRiskDisagreements: [] },
        coverageReport: null,
        confidenceLevel: 'high',
        reviewStatus: 'pending',
        createdAt: new Date('2026-03-29T08:03:00.000Z'),
        updatedAt: new Date('2026-03-29T08:04:00.000Z'),
      },
    ])
    controlPointRepo.find.mockResolvedValue([])

    const response = await service.bulkApprove(project, 'user-1', {
      reviewStage: AITaskType.SUMMARY,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    })

    expect(generationResultRepo.manager.transaction).toHaveBeenCalledTimes(1)
    expect(generationResultRepo.manager.transaction).toHaveBeenCalledWith(expect.any(Function))
    expect(response).toEqual({
      reviewStage: AITaskType.SUMMARY,
      filtersApplied: expect.objectContaining({
        reviewStage: AITaskType.SUMMARY,
      }),
      blockedReviewItemIds: [],
      approvedReviewItemIds: ['result-pending-low'],
    })
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          blockedReviewItemIds: [],
          approvedReviewItemIds: ['result-pending-low'],
        }),
      }),
    )
  })
})
