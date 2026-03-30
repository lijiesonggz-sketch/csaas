import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import {
  AuditAction,
  AIGenerationResult,
  ControlPoint,
  Project,
  ProjectMember,
  RegulationClause,
} from '@/database/entities'
import { AITask, AITaskType, TaskStatus } from '../../../database/entities/ai-task.entity'
import {
  AuditWorkbenchCitationChainDto,
  AuditWorkbenchFiltersAppliedDto,
  AuditWorkbenchListItemDto,
  AuditWorkbenchListResponseDto,
  AuditWorkbenchProvenanceStatus,
  AuditWorkbenchRiskLevel,
  AuditWorkbenchSortBy,
  AuditWorkbenchSortOrder,
} from '../../compliance-intelligence/dto/audit-workbench-aggregate.dto'
import { AuditLogService } from './audit-log.service'
import {
  ProjectReviewBulkApproveDto,
  ProjectReviewBulkApproveResponseDto,
} from '../dto/project-review-bulk-approve.dto'
import { ProjectReviewQueryDto } from '../dto/project-review-query.dto'

type RequestMeta = {
  ipAddress?: string
  userAgent?: string
  query?: ProjectReviewQueryDto
}

type ClauseLookup = {
  byId: Map<string, RegulationClause>
  byCode: Map<string, RegulationClause>
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
    @InjectRepository(ControlPoint)
    private readonly controlPointRepo: Repository<ControlPoint>,
    @InjectRepository(RegulationClause)
    private readonly regulationClauseRepo: Repository<RegulationClause>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async assertAccess(projectId: string, userId: string, meta?: RequestMeta): Promise<Project> {
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
        query: meta?.query,
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
    const { items: sortedItems, filtersApplied } = await this.buildSortedReviewItems(project, query)

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

  async bulkApprove(
    project: Project,
    userId: string,
    query: ProjectReviewBulkApproveDto,
    meta?: Omit<RequestMeta, 'query'>,
  ): Promise<ProjectReviewBulkApproveResponseDto> {
    if (!query.reviewStage) {
      throw new BadRequestException('批量通过前必须先选择单一审核阶段')
    }

    const { items: latestBatchItems, filtersApplied } = await this.buildSortedReviewItems(project, {
      reviewStatus: query.reviewStatus,
      riskLevel: query.riskLevel,
      reviewStage: query.reviewStage,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    })

    const blockedReviewItemIds = latestBatchItems
      .filter((item) => item.highRiskFlag && item.reviewStatus === 'pending')
      .map((item) => item.reviewItemId)

    if (blockedReviewItemIds.length > 0) {
      await this.auditLogService.log({
        userId,
        organizationId: project.organizationId ?? undefined,
        action: AuditAction.UPDATE,
        entityType: 'ProjectReviewBulkApprove',
        entityId: project.id,
        details: {
          projectId: project.id,
          reviewStage: filtersApplied.reviewStage,
          filtersApplied,
          blockedReviewItemIds,
          approvedReviewItemIds: [],
        },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      })

      return {
        reviewStage: query.reviewStage,
        filtersApplied,
        blockedReviewItemIds,
        approvedReviewItemIds: [],
      }
    }

    const approvedReviewItemIds = latestBatchItems
      .filter((item) => item.reviewStatus === 'pending')
      .map((item) => item.reviewItemId)

    if (approvedReviewItemIds.length > 0) {
      const reviewedAt = new Date()
      await this.generationResultRepo.manager.transaction(async (manager) => {
        await manager.update(
          AIGenerationResult,
          { id: In(approvedReviewItemIds) },
          {
            reviewStatus: 'approved' as AIGenerationResult['reviewStatus'],
            reviewedBy: userId,
            reviewedAt,
          },
        )
      })
    }

    await this.auditLogService.log({
      userId,
      organizationId: project.organizationId ?? undefined,
      action: AuditAction.UPDATE,
      entityType: 'ProjectReviewBulkApprove',
      entityId: project.id,
      details: {
        projectId: project.id,
        reviewStage: filtersApplied.reviewStage,
        filtersApplied,
        blockedReviewItemIds: [],
        approvedReviewItemIds,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    })

    return {
      reviewStage: query.reviewStage,
      filtersApplied,
      blockedReviewItemIds: [],
      approvedReviewItemIds,
    }
  }

  private async buildSortedReviewItems(
    project: Project,
    query: Pick<
      ProjectReviewQueryDto,
      'reviewStatus' | 'riskLevel' | 'reviewStage' | 'sortBy' | 'sortOrder'
    >,
  ): Promise<{
    items: AuditWorkbenchListItemDto[]
    filtersApplied: AuditWorkbenchFiltersAppliedDto
  }> {
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
      return { items: [], filtersApplied }
    }

    const results = await this.generationResultRepo.find({
      where: {
        taskId: In(latestTaskIds),
      },
      order: { createdAt: 'DESC' },
    })

    const taskById = new Map(tasks.map((task) => [task.id, task]))
    const controlPointById = await this.loadControlPointMap(tasks, results)
    const clauseLookup = await this.loadClauseLookup(tasks, results)

    const transformedItems = results
      .map((result) => {
        const task = taskById.get(result.taskId)
        if (!task) {
          return null
        }
        return this.toReviewItem(project, task, result, controlPointById, clauseLookup)
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

    return {
      items: sortedItems,
      filtersApplied,
    }
  }

  private buildFiltersApplied(
    query: Pick<
      ProjectReviewQueryDto,
      'reviewStatus' | 'riskLevel' | 'reviewStage' | 'sortBy' | 'sortOrder'
    >,
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
    controlPointById: Map<string, ControlPoint>,
    clauseLookup: ClauseLookup,
  ): AuditWorkbenchListItemDto {
    const riskLevel = this.getRiskLevel(result, task)
    const sourcePreview = this.buildSourcePreview(project, task, result)
    const matchedControls = this.resolveMatchedControls(task, result, controlPointById)
    const provenance = this.buildProvenance(result, sourcePreview, clauseLookup, matchedControls)

    return {
      reviewItemId: result.id,
      sourceResultId: result.id,
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
      controlId: matchedControls.length === 1 ? matchedControls[0].controlId : null,
      matchedControls,
      sourceModule: 'audit',
      sourceRecordId: result.id,
      sourceRoute: `/projects/${project.id}/review`,
      riskLevel,
      degradationReasons: this.getDegradationReasons(result, task),
      provenanceStatus: provenance.provenanceStatus,
      citationChain: provenance.citationChain,
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

  private getRiskLevel(result: AIGenerationResult, task: AITask): AuditWorkbenchRiskLevel {
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
    _project: Project,
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

    return {
      aiExcerpt,
      sourceExcerpt: null,
      sourceDocumentName: null,
      extractionQuality: 'missing',
    }
  }

  private buildAIExcerpt(currentResult: unknown): string {
    if (!currentResult) {
      return '暂无 AI 输出摘要'
    }

    if (typeof currentResult === 'string') {
      return currentResult.slice(0, 280)
    }

    if (
      typeof currentResult === 'object' &&
      currentResult !== null &&
      typeof (currentResult as Record<string, unknown>).overview === 'string'
    ) {
      const record = currentResult as Record<string, unknown>
      return (record.overview as string).slice(0, 280)
    }

    if (
      typeof currentResult === 'object' &&
      currentResult !== null &&
      typeof (currentResult as Record<string, unknown>).title === 'string'
    ) {
      const record = currentResult as Record<string, unknown>
      return (record.title as string).slice(0, 280)
    }

    if (
      typeof currentResult === 'object' &&
      currentResult !== null &&
      Array.isArray((currentResult as Record<string, unknown>).categories)
    ) {
      const record = currentResult as Record<string, unknown>
      const categoryNames = (record.categories as Array<Record<string, unknown>>)
        .map((category) => category.name)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .slice(0, 3)
      return categoryNames.length > 0 ? `聚类类别：${categoryNames.join('、')}` : '聚类结果已生成'
    }

    if (
      typeof currentResult === 'object' &&
      currentResult !== null &&
      Array.isArray((currentResult as Record<string, unknown>).matrix)
    ) {
      const record = currentResult as Record<string, unknown>
      return `成熟度矩阵共 ${(record.matrix as unknown[]).length} 行`
    }

    if (
      typeof currentResult === 'object' &&
      currentResult !== null &&
      Array.isArray((currentResult as Record<string, unknown>).questionnaire)
    ) {
      const record = currentResult as Record<string, unknown>
      return `问卷条目共 ${(record.questionnaire as unknown[]).length} 题`
    }

    if (
      typeof currentResult === 'object' &&
      currentResult !== null &&
      Array.isArray((currentResult as Record<string, unknown>).measures)
    ) {
      const record = currentResult as Record<string, unknown>
      return `改进措施共 ${(record.measures as unknown[]).length} 项`
    }

    if (typeof currentResult === 'object' && currentResult !== null) {
      return JSON.stringify(currentResult).slice(0, 280)
    }

    return String(currentResult).slice(0, 280)
  }

  private buildProvenance(
    result: AIGenerationResult,
    sourcePreview: AuditWorkbenchListItemDto['sourcePreview'],
    clauseLookup: ClauseLookup,
    matchedControls: AuditWorkbenchListItemDto['matchedControls'],
  ): {
    provenanceStatus: AuditWorkbenchProvenanceStatus
    citationChain: AuditWorkbenchCitationChainDto | null
  } {
    const citationChain = this.resolveCitationChain(result, clauseLookup, matchedControls)
    if (citationChain) {
      return {
        provenanceStatus: 'citation_chain',
        citationChain,
      }
    }

    const hasPreview =
      Boolean(sourcePreview.sourceExcerpt?.trim()) ||
      Boolean(sourcePreview.sourceDocumentName?.trim()) ||
      sourcePreview.extractionQuality !== 'missing'
    const hasLocationHints =
      this.hasLocationHints(result.selectedResult) || this.hasLocationHints(result.modifiedResult)

    return {
      provenanceStatus: hasPreview || hasLocationHints ? 'degraded_preview' : 'missing',
      citationChain: null,
    }
  }

  private resolveCitationChain(
    result: AIGenerationResult,
    clauseLookup: ClauseLookup,
    matchedControls: AuditWorkbenchListItemDto['matchedControls'],
  ): AuditWorkbenchCitationChainDto | null {
    if (matchedControls.length === 0) {
      return null
    }

    const matchedControlIds = new Set(matchedControls.map((item) => item.controlId))
    const references = [
      ...this.collectClauseReferences(result.modifiedResult),
      ...this.collectClauseReferences(result.selectedResult),
    ]

    for (const reference of references) {
      if (reference.clauseId) {
        const clauseById = clauseLookup.byId.get(reference.clauseId)
        if (clauseById && this.clauseMatchesCurrentControls(clauseById, matchedControlIds)) {
          return this.toCitationChain(clauseById)
        }
      }

      if (reference.clauseCode) {
        const clauseByCode = clauseLookup.byCode.get(reference.clauseCode)
        if (clauseByCode && this.clauseMatchesCurrentControls(clauseByCode, matchedControlIds)) {
          return this.toCitationChain(clauseByCode)
        }
      }
    }

    return null
  }

  private toCitationChain(clause: RegulationClause): AuditWorkbenchCitationChainDto {
    return {
      sourceId: clause.sourceId,
      sourceName: clause.source?.sourceName ?? '未命名来源',
      clauseId: clause.clauseId ?? null,
      clauseCode: clause.clauseCode ?? null,
      articleNo: clause.articleNo ?? null,
      rawText: clause.clauseText ?? null,
    }
  }

  private clauseMatchesCurrentControls(
    clause: RegulationClause,
    matchedControlIds: Set<string>,
  ): boolean {
    const clauseControlMaps = clause.clauseControlMaps ?? []
    if (clauseControlMaps.length === 0) {
      return false
    }

    return clauseControlMaps.some((mapping) => matchedControlIds.has(mapping.controlId))
  }

  private normalizeScore(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  private async loadClauseLookup(
    tasks: AITask[],
    results: AIGenerationResult[],
  ): Promise<ClauseLookup> {
    const taskById = new Map(tasks.map((task) => [task.id, task] as const))
    const clauseIds = new Set<string>()
    const clauseCodes = new Set<string>()

    for (const result of results) {
      const task = taskById.get(result.taskId)
      if (!task) {
        continue
      }

      this.collectClauseLookupCandidates(task.input, clauseIds, clauseCodes)
      this.collectClauseLookupCandidates(result.selectedResult, clauseIds, clauseCodes)
      this.collectClauseLookupCandidates(result.modifiedResult, clauseIds, clauseCodes)
    }

    const whereClauses: Array<Record<string, unknown>> = []
    if (clauseIds.size > 0) {
      whereClauses.push({ clauseId: In(Array.from(clauseIds)) })
    }
    if (clauseCodes.size > 0) {
      whereClauses.push({ clauseCode: In(Array.from(clauseCodes)) })
    }

    if (whereClauses.length === 0) {
      return {
        byId: new Map(),
        byCode: new Map(),
      }
    }

    const clauses = await this.regulationClauseRepo.find({
      where: whereClauses,
      relations: ['source', 'clauseControlMaps'],
    })

    return {
      byId: new Map(clauses.map((clause) => [clause.clauseId, clause])),
      byCode: new Map(clauses.map((clause) => [clause.clauseCode, clause])),
    }
  }

  private collectClauseLookupCandidates(
    value: unknown,
    clauseIds: Set<string>,
    clauseCodes: Set<string>,
    seen: Set<unknown> = new Set(),
  ): void {
    const normalizedValue = this.parseStructuredValue(value)

    if (normalizedValue === null || normalizedValue === undefined) {
      return
    }

    if (typeof normalizedValue !== 'object') {
      return
    }

    if (seen.has(normalizedValue)) {
      return
    }
    seen.add(normalizedValue)

    if (Array.isArray(normalizedValue)) {
      normalizedValue.forEach((item) =>
        this.collectClauseLookupCandidates(item, clauseIds, clauseCodes, seen),
      )
      return
    }

    const record = normalizedValue as Record<string, unknown>
    const clauseId = this.asCandidateString(record.clauseId ?? record.clause_id)
    const clauseCode = this.asCandidateString(record.clauseCode ?? record.clause_code)

    if (clauseId) {
      clauseIds.add(clauseId)
    }
    if (clauseCode) {
      clauseCodes.add(clauseCode)
    }

    Object.values(record).forEach((child) =>
      this.collectClauseLookupCandidates(child, clauseIds, clauseCodes, seen),
    )
  }

  private collectClauseReferences(
    value: unknown,
    seen: Set<unknown> = new Set(),
    results: Array<{ clauseId?: string; clauseCode?: string }> = [],
    dedupe: Set<string> = new Set(),
  ): Array<{ clauseId?: string; clauseCode?: string }> {
    const normalizedValue = this.parseStructuredValue(value)

    if (normalizedValue === null || normalizedValue === undefined) {
      return results
    }

    if (typeof normalizedValue !== 'object') {
      return results
    }

    if (seen.has(normalizedValue)) {
      return results
    }
    seen.add(normalizedValue)

    if (Array.isArray(normalizedValue)) {
      normalizedValue.forEach((item) => this.collectClauseReferences(item, seen, results, dedupe))
      return results
    }

    const record = normalizedValue as Record<string, unknown>
    const clauseId = this.asCandidateString(record.clauseId ?? record.clause_id)
    const clauseCode = this.asCandidateString(record.clauseCode ?? record.clause_code)

    if (clauseId || clauseCode) {
      const key = `${clauseId ?? ''}::${clauseCode ?? ''}`
      if (!dedupe.has(key)) {
        dedupe.add(key)
        results.push({
          clauseId: clauseId ?? undefined,
          clauseCode: clauseCode ?? undefined,
        })
      }
    }

    Object.values(record).forEach((child) =>
      this.collectClauseReferences(child, seen, results, dedupe),
    )

    return results
  }

  private hasLocationHints(value: unknown, seen: Set<unknown> = new Set()): boolean {
    const normalizedValue = this.parseStructuredValue(value)

    if (normalizedValue === null || normalizedValue === undefined) {
      return false
    }

    if (typeof normalizedValue !== 'object') {
      return false
    }

    if (seen.has(normalizedValue)) {
      return false
    }
    seen.add(normalizedValue)

    if (Array.isArray(normalizedValue)) {
      return normalizedValue.some((item) => this.hasLocationHints(item, seen))
    }

    const record = normalizedValue as Record<string, unknown>
    const hintValue = [
      record.clauseId,
      record.clause_id,
      record.clauseCode,
      record.clause_code,
      record.articleNo,
      record.article_no,
      record.sourceName,
      record.source_name,
      record.sourceDocumentName,
      record.source_document_name,
    ].some((candidate) => Boolean(this.asCandidateString(candidate)))

    if (hintValue) {
      return true
    }

    return Object.values(record).some((child) => this.hasLocationHints(child, seen))
  }

  private parseStructuredValue(value: unknown): unknown {
    if (typeof value !== 'string') {
      return value
    }

    const trimmed = value.trim()
    if (
      !(trimmed.startsWith('{') && trimmed.endsWith('}')) &&
      !(trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      return value
    }

    try {
      return JSON.parse(trimmed)
    } catch {
      return value
    }
  }

  private asCandidateString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null
    }

    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
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
        comparison = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
        break
      case 'updatedAt':
        comparison = new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()
        break
      case 'confidenceLevel':
        comparison =
          (confidenceRank[left.confidenceLevel ?? 'low'] ?? 0) -
          (confidenceRank[right.confidenceLevel ?? 'low'] ?? 0)
        break
      case 'reviewStatus':
        comparison =
          (reviewStatusRank[left.reviewStatus] ?? 0) - (reviewStatusRank[right.reviewStatus] ?? 0)
        break
      case 'riskLevel':
        comparison = riskRank[left.riskLevel] - riskRank[right.riskLevel]
        break
      case 'title':
        comparison = left.title.localeCompare(right.title, 'zh-CN')
        break
    }

    if (comparison === 0) {
      comparison = new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()
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

  private async loadControlPointMap(
    tasks: AITask[],
    results: AIGenerationResult[],
  ): Promise<Map<string, ControlPoint>> {
    const taskById = new Map(tasks.map((task) => [task.id, task] as const))
    const candidateIds = new Set<string>()

    for (const result of results) {
      const task = taskById.get(result.taskId)
      if (!task) {
        continue
      }

      this.collectCandidateControlIds(task.input, candidateIds)
      this.collectCandidateControlIds(result.selectedResult, candidateIds)
      this.collectCandidateControlIds(result.modifiedResult, candidateIds)
    }

    if (candidateIds.size === 0) {
      return new Map()
    }

    const controlPoints = await this.controlPointRepo.find({
      where: {
        controlId: In(Array.from(candidateIds)),
      },
    })

    return new Map(controlPoints.map((controlPoint) => [controlPoint.controlId, controlPoint]))
  }

  private resolveMatchedControls(
    task: AITask,
    result: AIGenerationResult,
    controlPointById: Map<string, ControlPoint>,
  ): AuditWorkbenchListItemDto['matchedControls'] {
    const candidateIds = new Set<string>()
    this.collectCandidateControlIds(task.input, candidateIds)
    this.collectCandidateControlIds(result.selectedResult, candidateIds)
    this.collectCandidateControlIds(result.modifiedResult, candidateIds)

    return Array.from(candidateIds)
      .map((controlId) => controlPointById.get(controlId))
      .filter((controlPoint): controlPoint is ControlPoint => Boolean(controlPoint))
      .map((controlPoint) => ({
        controlId: controlPoint.controlId,
        controlName: controlPoint.controlName,
        packSource: controlPoint.controlFamily,
        priority: controlPoint.riskLevelDefault,
      }))
  }

  private collectCandidateControlIds(
    value: unknown,
    candidates: Set<string>,
    seen: Set<unknown> = new Set(),
  ): void {
    if (value === null || value === undefined) {
      return
    }

    if (typeof value !== 'object') {
      return
    }

    if (seen.has(value)) {
      return
    }
    seen.add(value)

    if (Array.isArray(value)) {
      value.forEach((item) => this.collectCandidateControlIds(item, candidates, seen))
      return
    }

    const record = value as Record<string, unknown>
    this.addControlIdCandidate(record.controlId, candidates)
    this.addControlIdCandidate(record.cluster_id, candidates)
    this.addControlIdCandidate(record.clusterId, candidates)
    this.addControlIdCandidates(record.controlIds, candidates)
    this.addControlIdCandidates(record.sourceControlIds, candidates)

    Object.values(record).forEach((child) =>
      this.collectCandidateControlIds(child, candidates, seen),
    )
  }

  private addControlIdCandidate(value: unknown, candidates: Set<string>): void {
    if (typeof value !== 'string') {
      return
    }

    const candidate = value.trim()
    if (!candidate) {
      return
    }

    candidates.add(candidate)
  }

  private addControlIdCandidates(value: unknown, candidates: Set<string>): void {
    if (!Array.isArray(value)) {
      return
    }

    value.forEach((item) => this.addControlIdCandidate(item, candidates))
  }
}
