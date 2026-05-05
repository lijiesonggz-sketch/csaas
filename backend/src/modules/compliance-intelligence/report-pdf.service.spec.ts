import { getQueueToken } from '@nestjs/bullmq'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Project, ReportPdfJob, SurveyResponse } from '@/database/entities'
import { PackResolverService } from '../applicability-engine/services/pack-resolver.service'
import { MaturityAnalysisService } from '../survey/maturity-analysis.service'
import { ProjectQuestionnaireSnapshotService } from '../survey/project-questionnaire-snapshot.service'
import { ControlReportCompilerService } from './services/control-report-compiler.service'
import { ReportPdfRendererService } from './services/report-pdf-renderer.service'
import { ReportPdfService } from './services/report-pdf.service'

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(Buffer.from('PDF')),
  rm: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn().mockResolvedValue({ size: 3 }),
  writeFile: jest.fn().mockResolvedValue(undefined),
}))

const futureExpiryDate = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

describe('ReportPdfService', () => {
  let service: ReportPdfService

  const reportPdfJobRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  }

  const projectRepository = {
    findOne: jest.fn(),
  }

  const surveyResponseRepository = {
    createQueryBuilder: jest.fn(),
  }

  const reportPdfQueue = {
    add: jest.fn(),
  }

  const packResolverService = {
    resolveByOrganizationId: jest.fn(),
  }

  const maturityAnalysisService = {
    analyzeSurvey: jest.fn(),
  }

  const controlReportCompilerService = {
    compileReport: jest.fn(),
  }

  const reportPdfRendererService = {
    render: jest.fn(),
  }
  const projectQuestionnaireSnapshotService = {
    evaluateDownstreamFreshness: jest.fn(),
  }

  const surveyByIdQueryBuilder = {
    leftJoinAndSelect: jest.fn(),
    where: jest.fn(),
    getOne: jest.fn(),
  }

  const latestSurveyQueryBuilder = {
    leftJoinAndSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    getOne: jest.fn(),
  }

  const latestPdfJobQueryBuilder = {
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    getOne: jest.fn(),
    getMany: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportPdfService,
        {
          provide: getRepositoryToken(ReportPdfJob),
          useValue: reportPdfJobRepository,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: projectRepository,
        },
        {
          provide: getRepositoryToken(SurveyResponse),
          useValue: surveyResponseRepository,
        },
        {
          provide: getQueueToken('report-pdf-generation'),
          useValue: reportPdfQueue,
        },
        {
          provide: PackResolverService,
          useValue: packResolverService,
        },
        {
          provide: MaturityAnalysisService,
          useValue: maturityAnalysisService,
        },
        {
          provide: ControlReportCompilerService,
          useValue: controlReportCompilerService,
        },
        {
          provide: ReportPdfRendererService,
          useValue: reportPdfRendererService,
        },
        {
          provide: ProjectQuestionnaireSnapshotService,
          useValue: projectQuestionnaireSnapshotService,
        },
      ],
    }).compile()

    service = module.get(ReportPdfService)
    jest.clearAllMocks()

    surveyByIdQueryBuilder.leftJoinAndSelect.mockReturnValue(surveyByIdQueryBuilder)
    surveyByIdQueryBuilder.where.mockReturnValue(surveyByIdQueryBuilder)

    latestSurveyQueryBuilder.leftJoinAndSelect.mockReturnValue(latestSurveyQueryBuilder)
    latestSurveyQueryBuilder.where.mockReturnValue(latestSurveyQueryBuilder)
    latestSurveyQueryBuilder.andWhere.mockReturnValue(latestSurveyQueryBuilder)
    latestSurveyQueryBuilder.orderBy.mockReturnValue(latestSurveyQueryBuilder)
    latestSurveyQueryBuilder.addOrderBy.mockReturnValue(latestSurveyQueryBuilder)

    surveyResponseRepository.createQueryBuilder.mockImplementation(() =>
      surveyByIdQueryBuilder.getOne.mock.calls.length === 0
        ? surveyByIdQueryBuilder
        : latestSurveyQueryBuilder,
    )

    latestPdfJobQueryBuilder.where.mockReturnValue(latestPdfJobQueryBuilder)
    latestPdfJobQueryBuilder.andWhere.mockReturnValue(latestPdfJobQueryBuilder)
    latestPdfJobQueryBuilder.orderBy.mockReturnValue(latestPdfJobQueryBuilder)
    reportPdfJobRepository.createQueryBuilder.mockReturnValue(latestPdfJobQueryBuilder)
    projectQuestionnaireSnapshotService.evaluateDownstreamFreshness.mockResolvedValue({
      projectId: 'project-1',
      questionnaireTaskId: 'task-1',
      latestPublishedSnapshotTaskId: 'task-1',
      isStale: false,
      staleTargets: [],
      changeTypes: [],
      message: null,
    })
  })

  function mockFreshReportContext() {
    surveyByIdQueryBuilder.getOne.mockResolvedValue({
      id: 'report-1',
      submittedAt: new Date('2026-03-30T08:00:00.000Z'),
      updatedAt: new Date('2026-03-30T08:30:00.000Z'),
      questionnaireTask: {
        projectId: 'project-1',
      },
    })
    latestSurveyQueryBuilder.getOne.mockResolvedValue({
      id: 'report-1',
    })
    projectRepository.findOne.mockResolvedValue({
      id: 'project-1',
      organizationId: 'org-1',
      name: '项目一',
      clientName: '客户A',
      standardName: 'ISO27001',
      status: 'active',
    })
    packResolverService.resolveByOrganizationId.mockResolvedValue({
      controls: [{ controlId: 'control-1' }],
    })
  }

  it('should create queued pdf jobs and enqueue rendering work', async () => {
    mockFreshReportContext()
    reportPdfJobRepository.create.mockReturnValue({
      organizationId: 'org-1',
      projectId: 'project-1',
      reportId: 'report-1',
      requestedByUserId: 'user-1',
      status: 'queued',
      expiresAt: futureExpiryDate(),
    })
    reportPdfJobRepository.save.mockResolvedValue({
      pdfJobId: 'pdf-job-1',
      organizationId: 'org-1',
      projectId: 'project-1',
      reportId: 'report-1',
      requestedByUserId: 'user-1',
      status: 'queued',
      fileName: null,
      filePath: null,
      fileSizeBytes: null,
      errorSummary: null,
      expiresAt: futureExpiryDate(),
      startedAt: null,
      completedAt: null,
      failedAt: null,
      createdAt: new Date('2026-03-30T09:00:00.000Z'),
      updatedAt: new Date('2026-03-30T09:00:00.000Z'),
    })
    reportPdfQueue.add.mockResolvedValue(undefined)

    const result = await service.createPdfJob('org-1', 'user-1', 'report-1')

    expect(result.status).toBe('queued')
    expect(reportPdfQueue.add).toHaveBeenCalledWith(
      'generate-report-pdf',
      { pdfJobId: 'pdf-job-1' },
      expect.objectContaining({
        jobId: 'report-pdf-pdf-job-1',
      }),
    )
  })

  it('should reject stale reports before creating a pdf job', async () => {
    surveyByIdQueryBuilder.getOne.mockResolvedValue({
      id: 'report-1',
      questionnaireTask: {
        projectId: 'project-1',
      },
    })
    latestSurveyQueryBuilder.getOne.mockResolvedValue({
      id: 'report-2',
    })
    projectRepository.findOne.mockResolvedValue({
      id: 'project-1',
      organizationId: 'org-1',
      name: '项目一',
      status: 'active',
    })

    await expect(service.createPdfJob('org-1', 'user-1', 'report-1')).rejects.toThrow(
      '报告数据已过期，请先重新生成报告',
    )
  })

  it('should render ready jobs and persist file metadata', async () => {
    mockFreshReportContext()
    reportPdfJobRepository.findOne.mockResolvedValue({
      pdfJobId: 'pdf-job-1',
      organizationId: 'org-1',
      projectId: 'project-1',
      reportId: 'report-1',
      requestedByUserId: 'user-1',
      status: 'queued',
      fileName: null,
      filePath: null,
      fileSizeBytes: null,
      errorSummary: null,
      expiresAt: futureExpiryDate(),
      startedAt: null,
      completedAt: null,
      failedAt: null,
      createdAt: new Date('2026-03-30T09:00:00.000Z'),
      updatedAt: new Date('2026-03-30T09:00:00.000Z'),
    })
    maturityAnalysisService.analyzeSurvey.mockResolvedValue({
      overall: { maturityLevel: 3.8, grade: '充分规范级' },
      topShortcomings: [],
      conflicts: { severity: 'LOW', conflictCount: 0 },
    })
    controlReportCompilerService.compileReport.mockResolvedValue({
      sections: [],
    })
    reportPdfRendererService.render.mockResolvedValue({
      buffer: Buffer.from('PDF'),
      contentType: 'application/pdf',
      fileName: 'control-report.pdf',
    })

    await service.renderPdfJob('pdf-job-1')

    expect(reportPdfRendererService.render).toHaveBeenCalled()
    expect(reportPdfJobRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ready',
        fileName: 'control-report.pdf',
        fileSizeBytes: 3,
      }),
    )
  })

  it('should capture renderer failures as failed jobs', async () => {
    mockFreshReportContext()
    reportPdfJobRepository.findOne.mockResolvedValue({
      pdfJobId: 'pdf-job-1',
      organizationId: 'org-1',
      projectId: 'project-1',
      reportId: 'report-1',
      requestedByUserId: 'user-1',
      status: 'queued',
      fileName: null,
      filePath: null,
      fileSizeBytes: null,
      errorSummary: null,
      expiresAt: futureExpiryDate(),
      startedAt: null,
      completedAt: null,
      failedAt: null,
      createdAt: new Date('2026-03-30T09:00:00.000Z'),
      updatedAt: new Date('2026-03-30T09:00:00.000Z'),
    })
    maturityAnalysisService.analyzeSurvey.mockResolvedValue({
      overall: { maturityLevel: 3.8, grade: '充分规范级' },
      topShortcomings: [],
      conflicts: { severity: 'LOW', conflictCount: 0 },
    })
    controlReportCompilerService.compileReport.mockResolvedValue({
      sections: [],
    })
    reportPdfRendererService.render.mockRejectedValue(new Error('browser unavailable'))

    await expect(service.renderPdfJob('pdf-job-1')).rejects.toThrow('browser unavailable')
    expect(reportPdfJobRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorSummary: 'browser unavailable',
      }),
    )
  })

  it('should expose the latest non-expired pdf job as a dto', async () => {
    latestPdfJobQueryBuilder.getOne.mockResolvedValue({
      pdfJobId: 'pdf-job-1',
      organizationId: 'org-1',
      projectId: 'project-1',
      reportId: 'report-1',
      requestedByUserId: 'user-1',
      status: 'ready',
      fileName: 'control-report.pdf',
      filePath: 'D:/tmp/control-report.pdf',
      fileSizeBytes: 123,
      errorSummary: null,
      expiresAt: futureExpiryDate(),
      startedAt: new Date('2026-03-30T09:00:02.000Z'),
      completedAt: new Date('2026-03-30T09:00:12.000Z'),
      failedAt: null,
      createdAt: new Date('2026-03-30T09:00:00.000Z'),
      updatedAt: new Date('2026-03-30T09:00:12.000Z'),
    })

    const result = await service.getLatestPdfJob('org-1', 'report-1')

    expect(result?.downloadUrl).toBe(
      '/compliance-intelligence/report-center/report-1/pdf-jobs/pdf-job-1/download',
    )
    expect(result?.status).toBe('ready')
  })
})
