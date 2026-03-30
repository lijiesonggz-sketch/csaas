import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Project, SurveyResponse } from '@/database/entities'
import { PackResolverService } from '../applicability-engine/services/pack-resolver.service'
import { MaturityAnalysisService } from '../survey/maturity-analysis.service'
import { ControlReportCompilerService } from './services/control-report-compiler.service'
import { ReportCenterService } from './services/report-center.service'

describe('ReportCenterService', () => {
  let service: ReportCenterService

  const projectRepo = {
    createQueryBuilder: jest.fn(),
  }

  const surveyResponseRepo = {
    createQueryBuilder: jest.fn(),
  }

  const maturityAnalysisService = {
    analyzeSurvey: jest.fn(),
  }

  const packResolverService = {
    resolveByOrganizationId: jest.fn(),
  }

  const controlReportCompilerService = {
    compileReport: jest.fn(),
  }

  const projectQueryBuilder = {
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    getMany: jest.fn(),
  }

  const surveyQueryBuilder = {
    leftJoinAndSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    getMany: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportCenterService,
        {
          provide: getRepositoryToken(Project),
          useValue: projectRepo,
        },
        {
          provide: getRepositoryToken(SurveyResponse),
          useValue: surveyResponseRepo,
        },
        {
          provide: MaturityAnalysisService,
          useValue: maturityAnalysisService,
        },
        {
          provide: PackResolverService,
          useValue: packResolverService,
        },
        {
          provide: ControlReportCompilerService,
          useValue: controlReportCompilerService,
        },
      ],
    }).compile()

    service = module.get(ReportCenterService)
    jest.clearAllMocks()

    projectQueryBuilder.where.mockReturnValue(projectQueryBuilder)
    projectQueryBuilder.andWhere.mockReturnValue(projectQueryBuilder)
    projectQueryBuilder.orderBy.mockReturnValue(projectQueryBuilder)
    projectRepo.createQueryBuilder.mockReturnValue(projectQueryBuilder)

    surveyQueryBuilder.leftJoinAndSelect.mockReturnValue(surveyQueryBuilder)
    surveyQueryBuilder.where.mockReturnValue(surveyQueryBuilder)
    surveyQueryBuilder.andWhere.mockReturnValue(surveyQueryBuilder)
    surveyQueryBuilder.orderBy.mockReturnValue(surveyQueryBuilder)
    surveyQueryBuilder.addOrderBy.mockReturnValue(surveyQueryBuilder)
    surveyResponseRepo.createQueryBuilder.mockReturnValue(surveyQueryBuilder)
  })

  it('should return ready items with analysis-derived summaries when survey and controls exist', async () => {
    projectQueryBuilder.getMany.mockResolvedValue([
      {
        id: 'project-1',
        name: '项目一',
        organizationId: 'org-1',
        clientName: '客户A',
        standardName: 'ISO27001',
        status: 'active',
        updatedAt: new Date('2026-03-30T09:00:00.000Z'),
      },
    ])
    surveyQueryBuilder.getMany.mockResolvedValue([
      {
        id: 'survey-1',
        submittedAt: new Date('2026-03-30T08:00:00.000Z'),
        updatedAt: new Date('2026-03-30T08:30:00.000Z'),
        questionnaireTask: {
          projectId: 'project-1',
        },
      },
    ])
    packResolverService.resolveByOrganizationId.mockResolvedValue({
      controls: [{ controlId: 'control-1' }],
    })
    maturityAnalysisService.analyzeSurvey.mockResolvedValue({
      overall: {
        maturityLevel: 3.6,
        grade: '充分规范级',
      },
      topShortcomings: [
        { cluster_id: 'cluster-1', cluster_name: '身份与访问控制', gap: 1.2 },
      ],
      conflicts: {
        severity: 'MEDIUM',
        conflictCount: 2,
      },
    })

    const response = await service.getReportCenter('org-1', {
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    })

    expect(response.summary).toEqual({
      totalItems: 1,
      readyCount: 1,
      notReadyCount: 0,
      failedCount: 0,
    })
    expect(response.items[0]).toMatchObject({
      projectId: 'project-1',
      projectName: '项目一',
      reportId: 'survey-1',
      latestSurveyResponseId: 'survey-1',
      reportStatus: 'ready',
      availableActions: { viewReport: true },
      gapSummary: {
        overallMaturity: 3.6,
        overallGrade: '充分规范级',
        topShortcomings: [
          {
            clusterId: 'cluster-1',
            clusterName: '身份与访问控制',
            gap: 1.2,
          },
        ],
      },
      riskSummary: {
        conflictSeverity: 'MEDIUM',
        conflictCount: 2,
        topRiskClusters: ['身份与访问控制'],
      },
    })
  })

  it('should mark projects without survey data as not_ready empty states', async () => {
    projectQueryBuilder.getMany.mockResolvedValue([
      {
        id: 'project-1',
        name: '项目一',
        organizationId: 'org-1',
        clientName: null,
        standardName: null,
        status: 'draft',
        updatedAt: new Date('2026-03-30T09:00:00.000Z'),
      },
    ])
    surveyQueryBuilder.getMany.mockResolvedValue([])
    packResolverService.resolveByOrganizationId.mockResolvedValue({
      controls: [{ controlId: 'control-1' }],
    })

    const response = await service.getReportCenter('org-1', {
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    })

    expect(response.items[0]).toMatchObject({
      reportStatus: 'not_ready',
      reportId: null,
      availableActions: { viewReport: false },
      emptyStateReason: '尚未完成问卷并生成可读报告数据',
    })
  })

  it('should mark projects as failed when analysis generation breaks', async () => {
    projectQueryBuilder.getMany.mockResolvedValue([
      {
        id: 'project-1',
        name: '项目一',
        organizationId: 'org-1',
        clientName: '客户A',
        standardName: 'ISO27001',
        status: 'active',
        updatedAt: new Date('2026-03-30T09:00:00.000Z'),
      },
    ])
    surveyQueryBuilder.getMany.mockResolvedValue([
      {
        id: 'survey-1',
        submittedAt: new Date('2026-03-30T08:00:00.000Z'),
        updatedAt: new Date('2026-03-30T08:30:00.000Z'),
        questionnaireTask: {
          projectId: 'project-1',
        },
      },
    ])
    packResolverService.resolveByOrganizationId.mockResolvedValue({
      controls: [{ controlId: 'control-1' }],
    })
    maturityAnalysisService.analyzeSurvey.mockRejectedValue(new Error('boom'))

    const response = await service.getReportCenter('org-1', {
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    })

    expect(response.items[0]).toMatchObject({
      reportStatus: 'failed',
      reportId: null,
      availableActions: { viewReport: false },
      emptyStateReason: '最新报告数据分析失败，请重新生成',
    })
  })

  it('should apply project, status and date filters after aggregation', async () => {
    projectQueryBuilder.getMany.mockResolvedValue([
      {
        id: 'project-ready',
        name: '就绪项目',
        organizationId: 'org-1',
        clientName: '客户A',
        standardName: 'ISO27001',
        status: 'active',
        updatedAt: new Date('2026-03-30T09:00:00.000Z'),
      },
      {
        id: 'project-empty',
        name: '空态项目',
        organizationId: 'org-1',
        clientName: '客户B',
        standardName: 'ISO27001',
        status: 'draft',
        updatedAt: new Date('2026-03-28T09:00:00.000Z'),
      },
    ])
    surveyQueryBuilder.getMany.mockResolvedValue([
      {
        id: 'survey-ready',
        submittedAt: new Date('2026-03-30T08:00:00.000Z'),
        updatedAt: new Date('2026-03-30T08:30:00.000Z'),
        questionnaireTask: {
          projectId: 'project-ready',
        },
      },
    ])
    packResolverService.resolveByOrganizationId.mockResolvedValue({
      controls: [{ controlId: 'control-1' }],
    })
    maturityAnalysisService.analyzeSurvey.mockResolvedValue({
      overall: {
        maturityLevel: 4.1,
        grade: '量化管理级',
      },
      topShortcomings: [],
      conflicts: {
        severity: 'LOW',
        conflictCount: 0,
      },
    })

    const response = await service.getReportCenter('org-1', {
      projectId: 'project-ready',
      status: ['ready'],
      dateFrom: '2026-03-30',
      dateTo: '2026-03-30',
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    })

    expect(response.items).toHaveLength(1)
    expect(response.items[0].projectId).toBe('project-ready')
    expect(response.filtersApplied).toMatchObject({
      projectId: 'project-ready',
      status: ['ready'],
      dateFrom: '2026-03-30',
      dateTo: '2026-03-30',
    })
  })

  it('should compile report detail using the latest organization control scope', async () => {
    packResolverService.resolveByOrganizationId.mockResolvedValue({
      controls: [{ controlId: 'control-1' }, { controlId: 'control-2' }],
    })
    controlReportCompilerService.compileReport.mockResolvedValue({
      sections: [{ l1Code: 'IT01', l1Name: '身份安全', l2Sections: [] }],
    })

    const response = await service.getReportDetail(
      'org-1',
      '11111111-1111-4111-8111-111111111111',
    )

    expect(controlReportCompilerService.compileReport).toHaveBeenCalledWith({
      organizationId: 'org-1',
      surveyResponseId: '11111111-1111-4111-8111-111111111111',
      controlIds: ['control-1', 'control-2'],
    })
    expect(response.sections).toHaveLength(1)
  })
})
