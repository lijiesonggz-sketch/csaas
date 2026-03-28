import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { AuditAction, AIGenerationResult, Project, ProjectMember } from '@/database/entities'
import {
  AITask,
  AITaskType,
  TaskStatus,
} from '../../../database/entities/ai-task.entity'
import {
  AuditWorkbenchFiltersAppliedDto,
  AuditWorkbenchListItemDto,
  AuditWorkbenchListResponseDto,
  AuditWorkbenchRiskLevel,
  AuditWorkbenchSortBy,
  AuditWorkbenchSortOrder,
} from '../../compliance-intelligence/dto/audit-workbench-aggregate.dto'
import { AuditLogService } from './audit-log.service'
import { ProjectReviewQueryDto } from '../dto/project-review-query.dto'

type RequestMeta = {
  ipAddress?: string
  userAgent?: string
}

@Injectable()
export class ProjectReviewService {
  private readonly rerunnableTaskTypes = new Set<AITaskType>([
    AITaskType.SUMMARY,
    AITaskType.CLUSTERING,
    AITaskType.MATRIX,
    AITaskType.QUESTIONNAIRE,
    AITaskType.ACTION_PLAN,
  ])

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly projectMemberRepo: Repository<ProjectMember>,
    @InjectRepository(AITask)
    private readonly aiTaskRepo: Repository<AITask>,
    @InjectRepository(AIGenerationResult)
    private readonly generationResultRepo: Repository<AIGenerationResult>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async assertAccess(
    projectId: string,
    userId: string,
    meta?: RequestMeta,
  ): Promise<Project> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
    })

    if (!project) {
      throw new NotFoundException('项目不存在')
    }

    if (project.ownerId === userId) {
      return project
    }

    const membership = await this.projectMemberRepo.findOne({
      where: { projectId, userId },
    })

    if (membership) {
      return project
    }

    await this.auditLogService.log({
      userId,
      organizationId: project.organizationId ?? undefined,
      action: AuditAction.ACCESS_DENIED,
      entityType: 'ProjectReviewList',
      entityId: projectId,
      details: {
        projectId,
        reason: 'project_membership_required',
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    })

    throw new ForbiddenException('您没有权限访问该项目的审核工作台')
  }

  async getReviewItems(
    project: Project,
    query: ProjectReviewQueryDto,
  ): Promise<AuditWorkbenchListResponseDto> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const sortBy = query.sortBy ?? 'updatedAt'
    const sortOrder = query.sortOrder ?? 'desc'

    const tasks = await this.aiTaskRepo.find({
      where: { projectId: project.id },
      order: { createdAt: 'DESC' },
    })

    const latestTaskByType = new Map<AITaskType, AITask>()
    for (const task of tasks) {
      if (!latestTaskByType.has(task.type)) {
        latestTaskByType.set(task.type, task)
      }
    }

    const latestTaskIds = Array.from(latestTaskByType.values()).map((task) => task.id)
    const filtersApplied = this.buildFiltersApplied(query, sortBy, sortOrder)

    if (latestTaskIds.length === 0) {
      return {
        items: [],
        pagination: {
          page,
          pageSize,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        filtersApplied,
      }
    }

    const results = await this.generationResultRepo.find({
      where: {
        taskId: In(latestTaskIds),
      },
      order: { createdAt: 'DESC' },
    })

    const taskById = new Map(tasks.map((task) => [task.id, task]))

    const transformedItems = results
      .map((result) => {
        const task = taskById.get(result.taskId)
        if (!task) {
          return null
        }
        return this.toReviewItem(project, task, result)
      })
      .filter((item): item is AuditWorkbenchListItemDto => item !== null)

    const filteredItems = transformedItems.filter((item) => {
      if (query.reviewStatus?.length && !query.reviewStatus.includes(item.reviewStatus)) {
        return false
      }

      if (query.riskLevel?.length && !query.riskLevel.includes(item.riskLevel)) {
        return false
      }

      if (query.reviewStage && item.reviewStage !== query.reviewStage) {
        return false
      }

      return true
    })

    const sortedItems = [...filteredItems].sort((left, right) =>
      this.compareItems(left, right, sortBy, sortOrder),
    )

    const totalItems = sortedItems.length
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize)
    const startIndex = (page - 1) * pageSize
    const pagedItems = sortedItems.slice(startIndex, startIndex + pageSize)

    return {
      items: pagedItems,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1 && totalPages > 0,
      },
      filtersApplied,
    }
  }

  private buildFiltersApplied(
    query: ProjectReviewQueryDto,
    sortBy: AuditWorkbenchSortBy,
    sortOrder: AuditWorkbenchSortOrder,
  ): AuditWorkbenchFiltersAppliedDto {
    return {
      reviewStatus: query.reviewStatus,
      riskLevel: query.riskLevel,
      reviewStage: query.reviewStage,
      sortBy,
      sortOrder,
    }
  }

  private toReviewItem(
    project: Project,
    task: AITask,
    result: AIGenerationResult,
  ): AuditWorkbenchListItemDto {
    const riskLevel = this.getRiskLevel(result, task)
    const sourcePreview = this.buildSourcePreview(project, task, result)

    return {
      reviewItemId: result.id,
      sourceResultId: result.taskId,
      taskId: task.id,
      taskType: task.type,
      reviewStage: task.type,
      title: this.getTaskTypeLabel(task.type),
      reviewStatus: result.reviewStatus,
      confidenceLevel: result.confidenceLevel,
      consistencyScores: {
        structural: this.normalizeScore(result.qualityScores?.structural),
        semantic: this.normalizeScore(result.qualityScores?.semantic),
        detail: this.normalizeScore(result.qualityScores?.detail),
      },
      highRiskFlag: riskLevel === 'high',
      canRerun: this.canRerun(task),
      controlId: null,
      matchedControls: [],
      sourceModule: 'audit',
      sourceRecordId: result.id,
      sourceRoute: `/projects/${project.id}/review`,
      riskLevel,
      degradationReasons: this.getDegradationReasons(result, task),
      sourcePreview,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    }
  }

  private canRerun(task: AITask): boolean {
    return (
      this.rerunnableTaskTypes.has(task.type) &&
      ![TaskStatus.PENDING, TaskStatus.PROCESSING].includes(task.status)
    )
  }

  private getRiskLevel(
    result: AIGenerationResult,
    task: AITask,
  ): AuditWorkbenchRiskLevel {
    const highRiskDisagreements = result.consistencyReport?.highRiskDisagreements ?? []

    if (highRiskDisagreements.length > 0) {
      return 'high'
    }

    if (result.confidenceLevel === 'low' || task.status === TaskStatus.LOW_CONFIDENCE) {
      return 'high'
    }

    if (task.status === TaskStatus.MANUAL_MODE) {
      return 'high'
    }

    if (result.confidenceLevel === 'medium') {
      return 'medium'
    }

    if ((result.coverageReport?.coverageRate ?? 1) < 1) {
      return 'medium'
    }

    return 'low'
  }

  private getDegradationReasons(result: AIGenerationResult, task: AITask): string[] {
    const reasons: string[] = []
    const highRiskDisagreements = result.consistencyReport?.highRiskDisagreements ?? []

    if (highRiskDisagreements.length > 0) {
      reasons.push(`检测到 ${highRiskDisagreements.length} 个高风险分歧点`)
    }

    if (task.status === TaskStatus.MANUAL_MODE) {
      reasons.push('任务进入 manual_mode 降级')
    }

    if (task.status === TaskStatus.LOW_CONFIDENCE) {
      reasons.push('任务进入 low_confidence 降级')
    }

    if (result.confidenceLevel === 'low') {
      reasons.push('当前结果置信度为 LOW')
    } else if (result.confidenceLevel === 'medium') {
      reasons.push('当前结果置信度为 MEDIUM')
    }

    if (
      typeof result.coverageReport?.coverageRate === 'number' &&
      result.coverageReport.coverageRate < 1
    ) {
      reasons.push(`覆盖率 ${(result.coverageReport.coverageRate * 100).toFixed(1)}%`)
    }

    return reasons
  }

  private buildSourcePreview(
    project: Project,
    task: AITask,
    result: AIGenerationResult,
  ): AuditWorkbenchListItemDto['sourcePreview'] {
    const currentResult = result.modifiedResult ?? result.selectedResult
    const aiExcerpt = this.buildAIExcerpt(currentResult)

    const directStandardDocument =
      typeof task.input?.standardDocument === 'string' ? task.input.standardDocument : null

    if (directStandardDocument) {
      return {
        aiExcerpt,
        sourceExcerpt: directStandardDocument.slice(0, 280),
        sourceDocumentName: '组合标准文档',
        extractionQuality: directStandardDocument.length >= 120 ? 'complete' : 'partial',
      }
    }

    const uploadedDocuments = Array.isArray(project.metadata?.uploadedDocuments)
      ? project.metadata.uploadedDocuments
      : []
    const firstDocument = uploadedDocuments.find(
      (document) =>
        typeof document?.content === 'string' && typeof document?.name === 'string',
    ) as { name: string; content: string } | undefined

    if (!firstDocument) {
      return {
        aiExcerpt,
        sourceExcerpt: null,
        sourceDocumentName: null,
        extractionQuality: 'missing',
      }
    }

    return {
      aiExcerpt,
      sourceExcerpt: firstDocument.content.slice(0, 280),
      sourceDocumentName: firstDocument.name,
      extractionQuality: firstDocument.content.length >= 120 ? 'complete' : 'partial',
    }
  }

  private buildAIExcerpt(currentResult: unknown): string {
    if (!currentResult) {
      return '暂无 AI 输出摘要'
    }

    if (typeof currentResult === 'string') {
      return currentResult.slice(0, 280)
    }

    if (typeof currentResult === 'object' && currentResult !== null && typeof (currentResult as Record<string, any>).overview === 'string') {
      const record = currentResult as Record<string, any>
      return record.overview.slice(0, 280)
    }

    if (typeof currentResult === 'object' && currentResult !== null && typeof (currentResult as Record<string, any>).title === 'string') {
      const record = currentResult as Record<string, any>
      return record.title.slice(0, 280)
    }

    if (
      typeof currentResult === 'object' &&
      currentResult !== null &&
      Array.isArray((currentResult as Record<string, any>).categories)
    ) {
      const record = currentResult as Record<string, any>
      const categoryNames = record.categories
        .map((category: Record<string, any>) => category?.name)
        .filter(Boolean)
        .slice(0, 3)
      return categoryNames.length > 0
        ? `聚类类别：${categoryNames.join('、')}`
        : '聚类结果已生成'
    }

    if (
      typeof currentResult === 'object' &&
      currentResult !== null &&
      Array.isArray((currentResult as Record<string, any>).matrix)
    ) {
      const record = currentResult as Record<string, any>
      return `成熟度矩阵共 ${record.matrix.length} 行`
    }

    if (
      typeof currentResult === 'object' &&
      currentResult !== null &&
      Array.isArray((currentResult as Record<string, any>).questionnaire)
    ) {
      const record = currentResult as Record<string, any>
      return `问卷条目共 ${record.questionnaire.length} 题`
    }

    if (
      typeof currentResult === 'object' &&
      currentResult !== null &&
      Array.isArray((currentResult as Record<string, any>).measures)
    ) {
      const record = currentResult as Record<string, any>
      return `改进措施共 ${record.measures.length} 项`
    }

    if (typeof currentResult === 'object' && currentResult !== null) {
      return JSON.stringify(currentResult).slice(0, 280)
    }

    return String(currentResult).slice(0, 280)
  }

  private normalizeScore(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  private compareItems(
    left: AuditWorkbenchListItemDto,
    right: AuditWorkbenchListItemDto,
    sortBy: AuditWorkbenchSortBy,
    sortOrder: AuditWorkbenchSortOrder,
  ): number {
    const confidenceRank: Record<string, number> = { high: 3, medium: 2, low: 1 }
    const reviewStatusRank: Record<string, number> = {
      pending: 4,
      modified: 3,
      rejected: 2,
      approved: 1,
    }
    const riskRank: Record<AuditWorkbenchRiskLevel, number> = {
      high: 3,
      medium: 2,
      low: 1,
    }

    let comparison = 0

    switch (sortBy) {
      case 'createdAt':
        comparison =
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
        break
      case 'updatedAt':
        comparison =
          new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()
        break
      case 'confidenceLevel':
        comparison =
          (confidenceRank[left.confidenceLevel ?? 'low'] ?? 0) -
          (confidenceRank[right.confidenceLevel ?? 'low'] ?? 0)
        break
      case 'reviewStatus':
        comparison =
          (reviewStatusRank[left.reviewStatus] ?? 0) -
          (reviewStatusRank[right.reviewStatus] ?? 0)
        break
      case 'riskLevel':
        comparison = riskRank[left.riskLevel] - riskRank[right.riskLevel]
        break
      case 'title':
        comparison = left.title.localeCompare(right.title, 'zh-CN')
        break
    }

    if (comparison === 0) {
      comparison =
        new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()
    }

    if (comparison === 0) {
      comparison = left.reviewItemId.localeCompare(right.reviewItemId, 'en')
    }

    return sortOrder === 'asc' ? comparison : comparison * -1
  }

  private getTaskTypeLabel(taskType: AITaskType): string {
    const labels: Record<AITaskType, string> = {
      [AITaskType.SUMMARY]: '综述生成',
      [AITaskType.CLUSTERING]: '聚类分析',
      [AITaskType.MATRIX]: '成熟度矩阵',
      [AITaskType.QUESTIONNAIRE]: '问卷生成',
      [AITaskType.ACTION_PLAN]: '改进措施',
      [AITaskType.STANDARD_INTERPRETATION]: '标准解读',
      [AITaskType.STANDARD_RELATED_SEARCH]: '关联标准搜索',
      [AITaskType.STANDARD_VERSION_COMPARE]: '标准版本比对',
      [AITaskType.BINARY_QUESTIONNAIRE]: '判断题问卷',
      [AITaskType.BINARY_GAP_ANALYSIS]: '判断题差距分析',
      [AITaskType.QUICK_GAP_ANALYSIS]: '超简版差距分析',
    }

    return labels[taskType] ?? taskType
  }
}
