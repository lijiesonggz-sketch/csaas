import { InjectQueue } from '@nestjs/bullmq'
import {
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { Queue } from 'bullmq'
import { mkdir, readFile, rm, stat, writeFile } from 'fs/promises'
import * as path from 'path'
import { Repository } from 'typeorm'
import { Project, ReportPdfJob, SurveyResponse, SurveyStatus } from '@/database/entities'
import { PackResolverService } from '../../applicability-engine/services/pack-resolver.service'
import { MaturityAnalysisService } from '../../survey/maturity-analysis.service'
import { ProjectQuestionnaireSnapshotService } from '../../survey/project-questionnaire-snapshot.service'
import type { ReportCenterGapSummaryDto, ReportCenterRiskSummaryDto } from '../dto/report-center.dto'
import type {
  ReportPdfJobDto,
  ReportPdfQueueJobData,
  ReportPdfRenderContext,
} from '../dto/report-pdf.dto'
import { ControlReportCompilerService } from './control-report-compiler.service'
import {
  REPORT_PDF_GENERATE_JOB_NAME,
  REPORT_PDF_QUEUE,
  REPORT_PDF_RETENTION_DAYS,
  REPORT_PDF_STALE_MESSAGE,
} from '../constants/report-pdf.constants'
import { ReportPdfRendererService } from './report-pdf-renderer.service'

type ReportFreshnessContext = {
  project: Project
  survey: SurveyResponse
  controlIds: string[]
}

@Injectable()
export class ReportPdfService {
  private readonly logger = new Logger(ReportPdfService.name)
  private readonly storageRoot = path.resolve(process.cwd(), '.generated', 'report-pdfs')

  constructor(
    @InjectRepository(ReportPdfJob)
    private readonly reportPdfJobRepository: Repository<ReportPdfJob>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(SurveyResponse)
    private readonly surveyResponseRepository: Repository<SurveyResponse>,
    @InjectQueue(REPORT_PDF_QUEUE)
    private readonly reportPdfQueue: Queue<ReportPdfQueueJobData>,
    private readonly packResolverService: PackResolverService,
    private readonly maturityAnalysisService: MaturityAnalysisService,
    private readonly controlReportCompilerService: ControlReportCompilerService,
    private readonly reportPdfRendererService: ReportPdfRendererService,
    private readonly projectQuestionnaireSnapshotService: ProjectQuestionnaireSnapshotService,
  ) {}

  async createPdfJob(organizationId: string, userId: string, reportId: string): Promise<ReportPdfJobDto> {
    const context = await this.ensureReportFreshness(organizationId, reportId)
    const job = await this.reportPdfJobRepository.save(
      this.reportPdfJobRepository.create({
        organizationId,
        projectId: context.project.id,
        reportId,
        requestedByUserId: userId,
        status: 'queued',
        expiresAt: this.computeExpiryDate(),
      }),
    )

    try {
      await this.reportPdfQueue.add(
        REPORT_PDF_GENERATE_JOB_NAME,
        {
          pdfJobId: job.pdfJobId,
        },
        {
          jobId: `report-pdf-${job.pdfJobId}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      )
    } catch (error) {
      job.status = 'failed'
      job.errorSummary = 'PDF 生成任务提交失败，请稍后重试'
      job.failedAt = new Date()
      await this.reportPdfJobRepository.save(job)
      this.logger.error(`Failed to enqueue report pdf job ${job.pdfJobId}`, error)
    }

    return this.toDto(job)
  }

  async getLatestPdfJob(organizationId: string, reportId: string): Promise<ReportPdfJobDto | null> {
    const job = await this.reportPdfJobRepository
      .createQueryBuilder('job')
      .where('job.organization_id = :organizationId', { organizationId })
      .andWhere('job.report_id = :reportId', { reportId })
      .andWhere('job.expires_at > :now', { now: new Date() })
      .orderBy('job.created_at', 'DESC')
      .getOne()

    return job ? this.toDto(job) : null
  }

  async getPdfJob(organizationId: string, reportId: string, pdfJobId: string): Promise<ReportPdfJobDto> {
    return this.toDto(await this.requirePdfJob(organizationId, reportId, pdfJobId))
  }

  async downloadPdfJob(
    organizationId: string,
    reportId: string,
    pdfJobId: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const job = await this.requirePdfJob(organizationId, reportId, pdfJobId)

    if (job.expiresAt.getTime() <= Date.now()) {
      throw new GoneException('PDF 已过期，请重新生成')
    }

    if (job.status !== 'ready' || !job.filePath || !job.fileName) {
      throw new ConflictException('PDF 尚未生成完成')
    }

    try {
      const buffer = await readFile(job.filePath)
      return {
        buffer,
        fileName: job.fileName,
      }
    } catch {
      throw new NotFoundException('PDF 文件不存在，请重新生成')
    }
  }

  async renderPdfJob(pdfJobId: string): Promise<void> {
    const job = await this.reportPdfJobRepository.findOne({
      where: { pdfJobId },
    })

    if (!job) {
      throw new NotFoundException(`report pdf job ${pdfJobId} not found`)
    }

    job.status = 'rendering'
    job.startedAt = new Date()
    job.errorSummary = null
    job.failedAt = null
    await this.reportPdfJobRepository.save(job)

    try {
      const renderContext = await this.buildRenderContext(job.organizationId, job.reportId)
      const rendered = await this.reportPdfRendererService.render(renderContext)
      const storageDir = path.join(this.storageRoot, job.organizationId, job.reportId)
      const filePath = path.join(storageDir, `${job.pdfJobId}.pdf`)

      await mkdir(storageDir, { recursive: true })
      await writeFile(filePath, rendered.buffer)

      const metadata = await stat(filePath)

      job.status = 'ready'
      job.fileName = rendered.fileName
      job.filePath = filePath
      job.fileSizeBytes = Number(metadata.size)
      job.completedAt = new Date()
      job.failedAt = null
      job.errorSummary = null
      await this.reportPdfJobRepository.save(job)
    } catch (error) {
      job.status = 'failed'
      job.errorSummary = this.normalizeErrorSummary(error)
      job.failedAt = new Date()
      await this.reportPdfJobRepository.save(job)
      throw error
    }
  }

  @Cron('0 3 * * *')
  async cleanupExpiredJobs(): Promise<number> {
    const expiredJobs = await this.reportPdfJobRepository
      .createQueryBuilder('job')
      .where('job.expires_at <= :now', { now: new Date() })
      .getMany()

    for (const job of expiredJobs) {
      if (job.filePath) {
        await rm(job.filePath, { force: true }).catch(() => undefined)
      }
    }

    if (expiredJobs.length > 0) {
      await this.reportPdfJobRepository.remove(expiredJobs)
    }

    return expiredJobs.length
  }

  private async buildRenderContext(
    organizationId: string,
    reportId: string,
  ): Promise<ReportPdfRenderContext> {
    const context = await this.ensureReportFreshness(organizationId, reportId)

    const [analysis, compiled] = await Promise.all([
      this.maturityAnalysisService.analyzeSurvey(reportId),
      this.controlReportCompilerService.compileReport({
        organizationId,
        surveyResponseId: reportId,
        controlIds: context.controlIds,
      }),
    ])

    const gapSummary: ReportCenterGapSummaryDto = {
      overallMaturity: analysis.overall?.maturityLevel ?? null,
      overallGrade: analysis.overall?.grade ?? null,
      topShortcomings: (analysis.topShortcomings ?? []).slice(0, 5).map((item: Record<string, unknown>) => ({
        clusterId: String(item.cluster_id ?? ''),
        clusterName: String(item.cluster_name ?? '未命名聚类'),
        gap: Number(item.gap ?? 0),
      })),
    }

    const riskSummary: ReportCenterRiskSummaryDto = {
      conflictSeverity:
        analysis.conflicts?.severity === 'LOW' ||
        analysis.conflicts?.severity === 'MEDIUM' ||
        analysis.conflicts?.severity === 'HIGH'
          ? analysis.conflicts.severity
          : 'NONE',
      conflictCount: Number(analysis.conflicts?.conflictCount ?? 0),
      topRiskClusters: (analysis.topShortcomings ?? [])
        .slice(0, 5)
        .map((item: Record<string, unknown>) => String(item.cluster_name ?? ''))
        .filter((item: string) => item.length > 0),
    }

    return {
      reportId,
      projectName: context.project.name,
      generatedAt: (context.survey.submittedAt ?? context.survey.updatedAt).toISOString(),
      projectSummary: {
        clientName: context.project.clientName ?? null,
        standardName: context.project.standardName ?? null,
        projectStatus: context.project.status,
      },
      gapSummary,
      riskSummary,
      sections: compiled.sections,
    }
  }

  private async ensureReportFreshness(
    organizationId: string,
    reportId: string,
  ): Promise<ReportFreshnessContext> {
    const survey = await this.surveyResponseRepository
      .createQueryBuilder('survey')
      .leftJoinAndSelect('survey.questionnaireTask', 'task')
      .where('survey.id = :reportId', { reportId })
      .getOne()

    if (!survey?.questionnaireTask?.projectId) {
      throw new NotFoundException('未找到对应报告')
    }

    const project = await this.projectRepository.findOne({
      where: {
        id: survey.questionnaireTask.projectId,
        organizationId,
      },
    })

    if (!project) {
      throw new NotFoundException('未找到对应报告')
    }

    const latestSurvey = await this.surveyResponseRepository
      .createQueryBuilder('survey')
      .leftJoinAndSelect('survey.questionnaireTask', 'task')
      .where('task.project_id = :projectId', { projectId: project.id })
      .andWhere('survey.status IN (:...statuses)', {
        statuses: [SurveyStatus.SUBMITTED, SurveyStatus.COMPLETED],
      })
      .orderBy('survey.submitted_at', 'DESC', 'NULLS LAST')
      .addOrderBy('survey.updated_at', 'DESC')
      .getOne()

    if (!latestSurvey || latestSurvey.id !== reportId) {
      throw new ConflictException(REPORT_PDF_STALE_MESSAGE)
    }

    const freshness = await this.projectQuestionnaireSnapshotService.evaluateDownstreamFreshness(
      project.id,
      survey.questionnaireTaskId,
    )

    if (freshness.isStale && freshness.staleTargets.includes('report')) {
      throw new ConflictException(freshness.message ?? REPORT_PDF_STALE_MESSAGE)
    }

    const resolvedControls = await this.packResolverService
      .resolveByOrganizationId(organizationId)
      .catch(() => ({
        controls: [],
      }))

    const controlIds = resolvedControls.controls.map((control) => control.controlId)

    if (controlIds.length === 0) {
      throw new ConflictException(REPORT_PDF_STALE_MESSAGE)
    }

    return {
      project,
      survey,
      controlIds,
    }
  }

  private async requirePdfJob(
    organizationId: string,
    reportId: string,
    pdfJobId: string,
  ): Promise<ReportPdfJob> {
    const job = await this.reportPdfJobRepository.findOne({
      where: {
        pdfJobId,
        organizationId,
        reportId,
      },
    })

    if (!job) {
      throw new NotFoundException('未找到对应 PDF 任务')
    }

    return job
  }

  private computeExpiryDate(): Date {
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + REPORT_PDF_RETENTION_DAYS)
    return expiryDate
  }

  private normalizeErrorSummary(error: unknown): string {
    const message = error instanceof Error ? error.message : 'PDF 生成失败'
    return message.slice(0, 500)
  }

  private toDto(job: ReportPdfJob): ReportPdfJobDto {
    const isReadyAndValid = job.status === 'ready' && job.expiresAt.getTime() > Date.now()

    return {
      pdfJobId: job.pdfJobId,
      reportId: job.reportId,
      status: job.status,
      fileName: job.fileName,
      fileSizeBytes: job.fileSizeBytes,
      downloadUrl: isReadyAndValid
        ? `/compliance-intelligence/report-center/${job.reportId}/pdf-jobs/${job.pdfJobId}/download`
        : null,
      errorSummary: job.errorSummary,
      expiresAt: job.expiresAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      failedAt: job.failedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    }
  }
}
