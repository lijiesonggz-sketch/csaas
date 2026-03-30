import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Project, SurveyResponse, SurveyStatus } from '@/database/entities'
import { PackResolverService } from '../../applicability-engine/services/pack-resolver.service'
import { MaturityAnalysisService } from '../../survey/maturity-analysis.service'
import type { CompileControlReportResponseDto } from '../dto/compile-control-report.dto'
import type {
  ReportCenterFiltersAppliedDto,
  ReportCenterItemDto,
  ReportCenterListResponseDto,
  ReportCenterRiskSummaryDto,
} from '../dto/report-center.dto'
import type {
  ReportCenterQueryDto,
  ReportCenterSortBy,
  ReportCenterSortOrder,
} from '../dto/report-center-query.dto'
import { ControlReportCompilerService } from './control-report-compiler.service'

type LatestSurveyByProject = Map<string, SurveyResponse>

@Injectable()
export class ReportCenterService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(SurveyResponse)
    private readonly surveyResponseRepo: Repository<SurveyResponse>,
    private readonly maturityAnalysisService: MaturityAnalysisService,
    private readonly packResolverService: PackResolverService,
    private readonly controlReportCompilerService: ControlReportCompilerService,
  ) {}

  async getReportCenter(
    organizationId: string,
    query: ReportCenterQueryDto,
  ): Promise<ReportCenterListResponseDto> {
    const sortBy = query.sortBy ?? 'updatedAt'
    const sortOrder = query.sortOrder ?? 'desc'
    const filtersApplied = this.buildFiltersApplied(query, sortBy, sortOrder)

    const projects = await this.projectRepo
      .createQueryBuilder('project')
      .where('project.organization_id = :organizationId', { organizationId })
      .andWhere('project.deleted_at IS NULL')
      .orderBy('project.updated_at', 'DESC')
      .getMany()

    if (projects.length === 0) {
      return {
        items: [],
        summary: {
          totalItems: 0,
          readyCount: 0,
          notReadyCount: 0,
          failedCount: 0,
        },
        filtersApplied,
      }
    }

    const latestSurveyByProject = await this.loadLatestSurveyResponses(
      projects.map((project) => project.id),
    )
    const resolvedControlIds = await this.loadResolvedControlIds(organizationId)

    const items = await Promise.all(
      projects.map((project) =>
        this.buildItem(project, latestSurveyByProject.get(project.id) ?? null, resolvedControlIds),
      ),
    )

    const filteredItems = items
      .filter((item) => this.matchesProjectFilter(item, query))
      .filter((item) => this.matchesStatusFilter(item, query))
      .filter((item) => this.matchesDateFilter(item, query))
      .sort((left, right) => this.compareItems(left, right, sortBy, sortOrder))

    return {
      items: filteredItems,
      summary: {
        totalItems: filteredItems.length,
        readyCount: filteredItems.filter((item) => item.reportStatus === 'ready').length,
        notReadyCount: filteredItems.filter((item) => item.reportStatus === 'not_ready').length,
        failedCount: filteredItems.filter((item) => item.reportStatus === 'failed').length,
      },
      filtersApplied,
    }
  }

  async getReportDetail(
    organizationId: string,
    reportId: string,
  ): Promise<CompileControlReportResponseDto> {
    const controlIds = await this.loadResolvedControlIds(organizationId)

    if (controlIds.length === 0) {
      return {
        sections: [],
      }
    }

    return this.controlReportCompilerService.compileReport({
      organizationId,
      surveyResponseId: reportId,
      controlIds,
    })
  }

  private buildFiltersApplied(
    query: ReportCenterQueryDto,
    sortBy: ReportCenterSortBy,
    sortOrder: ReportCenterSortOrder,
  ): ReportCenterFiltersAppliedDto {
    return {
      projectId: query.projectId,
      status: query.status,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      sortBy,
      sortOrder,
    }
  }

  private async loadLatestSurveyResponses(projectIds: string[]): Promise<LatestSurveyByProject> {
    if (projectIds.length === 0) {
      return new Map()
    }

    const surveys = await this.surveyResponseRepo
      .createQueryBuilder('survey')
      .leftJoinAndSelect('survey.questionnaireTask', 'task')
      .where('task.project_id IN (:...projectIds)', { projectIds })
      .andWhere('survey.status IN (:...statuses)', {
        statuses: [SurveyStatus.SUBMITTED, SurveyStatus.COMPLETED],
      })
      .orderBy('survey.submitted_at', 'DESC', 'NULLS LAST')
      .addOrderBy('survey.updated_at', 'DESC')
      .getMany()

    const latestByProject = new Map<string, SurveyResponse>()

    for (const survey of surveys) {
      const projectId = survey.questionnaireTask?.projectId
      if (!projectId) {
        continue
      }

      if (!latestByProject.has(projectId)) {
        latestByProject.set(projectId, survey)
      }
    }

    return latestByProject
  }

  private async loadResolvedControlIds(organizationId: string): Promise<string[]> {
    try {
      const resolved = await this.packResolverService.resolveByOrganizationId(organizationId)
      return resolved.controls.map((control) => control.controlId)
    } catch {
      return []
    }
  }

  private async buildItem(
    project: Project,
    survey: SurveyResponse | null,
    resolvedControlIds: string[],
  ): Promise<ReportCenterItemDto> {
    const baseItem: ReportCenterItemDto = {
      projectId: project.id,
      projectName: project.name,
      organizationId: project.organizationId ?? null,
      reportId: null,
      reportStatus: 'not_ready',
      latestSurveyResponseId: survey?.id ?? null,
      generatedAt: this.getGeneratedAt(survey),
      updatedAt: project.updatedAt.toISOString(),
      projectSummary: {
        clientName: project.clientName ?? null,
        standardName: project.standardName ?? null,
        projectStatus: project.status,
      },
      gapSummary: {
        overallMaturity: null,
        overallGrade: null,
        topShortcomings: [],
      },
      riskSummary: {
        conflictSeverity: 'NONE',
        conflictCount: 0,
        topRiskClusters: [],
      },
      emptyStateReason: null,
      availableActions: {
        viewReport: false,
      },
    }

    if (!survey) {
      return {
        ...baseItem,
        reportStatus: 'not_ready',
        emptyStateReason: '尚未完成问卷并生成可读报告数据',
      }
    }

    if (resolvedControlIds.length === 0) {
      return {
        ...baseItem,
        reportStatus: 'not_ready',
        emptyStateReason: '当前机构尚未解析出适用控制点',
      }
    }

    try {
      const analysis = await this.maturityAnalysisService.analyzeSurvey(survey.id)
      const topShortcomings = (analysis.topShortcomings ?? []).slice(0, 3).map((item) => ({
        clusterId: item.cluster_id,
        clusterName: item.cluster_name,
        gap: item.gap,
      }))

      return {
        ...baseItem,
        reportId: survey.id,
        reportStatus: 'ready',
        latestSurveyResponseId: survey.id,
        gapSummary: {
          overallMaturity: analysis.overall?.maturityLevel ?? null,
          overallGrade: analysis.overall?.grade ?? null,
          topShortcomings,
        },
        riskSummary: this.buildRiskSummary(analysis),
        availableActions: {
          viewReport: true,
        },
      }
    } catch {
      return {
        ...baseItem,
        reportStatus: 'failed',
        emptyStateReason: '最新报告数据分析失败，请重新生成',
      }
    }
  }

  private buildRiskSummary(analysis: Record<string, any>): ReportCenterRiskSummaryDto {
    const conflicts = analysis.conflicts ?? {}
    const severity = typeof conflicts.severity === 'string' ? conflicts.severity : 'NONE'
    const topRiskClusters = (analysis.topShortcomings ?? [])
      .slice(0, 3)
      .map((item: Record<string, any>) => item.cluster_name)
      .filter((name: unknown): name is string => typeof name === 'string' && name.length > 0)

    return {
      conflictSeverity:
        severity === 'LOW' || severity === 'MEDIUM' || severity === 'HIGH' ? severity : 'NONE',
      conflictCount: conflicts.conflictCount ?? 0,
      topRiskClusters,
    }
  }

  private getGeneratedAt(survey: SurveyResponse | null): string | null {
    if (!survey) {
      return null
    }

    return (survey.submittedAt ?? survey.updatedAt).toISOString()
  }

  private matchesProjectFilter(item: ReportCenterItemDto, query: ReportCenterQueryDto): boolean {
    if (!query.projectId) {
      return true
    }

    return item.projectId === query.projectId
  }

  private matchesStatusFilter(item: ReportCenterItemDto, query: ReportCenterQueryDto): boolean {
    if (!query.status?.length) {
      return true
    }

    return query.status.includes(item.reportStatus)
  }

  private matchesDateFilter(item: ReportCenterItemDto, query: ReportCenterQueryDto): boolean {
    if (!item.generatedAt) {
      return !query.dateFrom && !query.dateTo
    }

    const generatedDate = item.generatedAt.slice(0, 10)

    if (query.dateFrom && generatedDate < query.dateFrom) {
      return false
    }

    if (query.dateTo && generatedDate > query.dateTo) {
      return false
    }

    return true
  }

  private compareItems(
    left: ReportCenterItemDto,
    right: ReportCenterItemDto,
    sortBy: ReportCenterSortBy,
    sortOrder: ReportCenterSortOrder,
  ): number {
    const statusRank = {
      ready: 5,
      ready_to_generate: 4,
      generating: 3,
      not_ready: 2,
      failed: 1,
    }

    let comparison = 0

    switch (sortBy) {
      case 'generatedAt':
        comparison =
          new Date(left.generatedAt ?? 0).getTime() - new Date(right.generatedAt ?? 0).getTime()
        break
      case 'projectName':
        comparison = left.projectName.localeCompare(right.projectName, 'zh-CN')
        break
      case 'reportStatus':
        comparison = statusRank[left.reportStatus] - statusRank[right.reportStatus]
        break
      case 'updatedAt':
      default:
        comparison = new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()
        break
    }

    if (comparison === 0) {
      comparison = left.projectId.localeCompare(right.projectId, 'en')
    }

    return sortOrder === 'asc' ? comparison : comparison * -1
  }
}
