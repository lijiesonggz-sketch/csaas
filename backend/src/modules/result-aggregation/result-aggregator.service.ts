import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import {
  AIGenerationResult,
  ConfidenceLevel,
  SelectedModel,
  ReviewStatus,
} from '../../database/entities/ai-generation-result.entity'
import { AITaskType } from '../../database/entities/ai-task.entity'
import { FullValidationReport } from '../quality-validation/quality-validation.service'

type CandidateModelName = 'gpt4' | 'claude' | 'domestic'

interface ModelCandidate {
  name: CandidateModelName
  result: Record<string, any>
}

interface QuestionnaireGroupSelection {
  row_index: number
  cluster_id?: string
  cluster_name?: string
  selected_model: CandidateModelName
  question_count: number
  scores: Record<CandidateModelName, number>
}

const QUESTIONNAIRE_GROUP_SIZE = 5
const MODEL_PRIORITY: CandidateModelName[] = ['gpt4', 'claude', 'domestic']
const QUESTIONNAIRE_STOP_TERMS = new Set([
  '成熟度',
  '要求',
  '标准',
  '能力',
  '等级',
  '管理',
  '情况',
  '组织',
  '是否',
  '进行',
  '对应',
  '当前',
])

export interface AggregationInput {
  taskId: string
  generationType: AITaskType
  gpt4Result: Record<string, any> | null
  claudeResult: Record<string, any> | null
  domesticResult: Record<string, any> | null
  validationReport: FullValidationReport
  standardDocument?: string // 仅聚类任务需要（用于覆盖率检查）
  matrixResult?: { matrix?: any[] } | null // 仅问卷任务需要（用于按矩阵行选择最佳题组）
}

export interface AggregationOutput {
  selectedResult: Record<string, any>
  selectedModel: SelectedModel
  confidenceLevel: ConfidenceLevel
  qualityScores: {
    structural: number
    semantic: number
    detail: number
  }
  consistencyReport: {
    agreements: string[]
    disagreements: string[]
    highRiskDisagreements: string[]
  }
  coverageReport?: {
    totalClauses: number
    coveredClauses: string[]
    missingClauses: string[]
    coverageRate: number
  }
}

/**
 * 结果聚合器服务
 * 负责投票选择最佳AI生成结果并存储到数据库
 */
@Injectable()
export class ResultAggregatorService {
  private readonly logger = new Logger(ResultAggregatorService.name)

  constructor(
    @InjectRepository(AIGenerationResult)
    private readonly generationResultRepository: Repository<AIGenerationResult>,
  ) {}

  /**
   * 聚合三模型的生成结果
   * @param input 聚合输入
   * @returns 聚合输出
   */
  async aggregate(input: AggregationInput): Promise<AggregationOutput> {
    this.logger.log(`Aggregating results for task ${input.taskId}, type: ${input.generationType}`)

    const { validationReport } = input

    // 1. 投票选择最佳结果（基于质量分数）
    const { selectedResult, selectedModel } = this.selectBestResult(input)

    // 2. 确定置信度等级
    const confidenceLevel = this.mapConfidenceLevel(validationReport.confidenceLevel)

    // 3. 构建输出
    const output: AggregationOutput = {
      selectedResult,
      selectedModel,
      confidenceLevel,
      qualityScores: validationReport.qualityScores,
      consistencyReport: {
        agreements: validationReport.consistencyReport.agreements,
        disagreements: validationReport.consistencyReport.disagreements,
        highRiskDisagreements: validationReport.consistencyReport.highRiskDisagreements,
      },
      coverageReport: validationReport.coverageReport
        ? {
            totalClauses: validationReport.coverageReport.totalClauses,
            coveredClauses: validationReport.coverageReport.coveredClauses,
            missingClauses: validationReport.coverageReport.missingClauses,
            coverageRate: validationReport.coverageReport.coverageRate,
          }
        : undefined,
    }

    // 4. 存储到数据库
    await this.saveToDatabase(input, output)

    this.logger.log(
      `Aggregation completed: selected=${this.getDisplayModelName(selectedModel)}, confidence=${confidenceLevel}`,
    )

    return output
  }

  /**
   * 投票选择最佳结果
   * 策略：选择整体质量分数最高的模型结果
   */
  private selectBestResult(input: AggregationInput): {
    selectedResult: Record<string, any>
    selectedModel: SelectedModel
  } {
    // 收集非null的模型结果
    const candidates = this.collectCandidates(
      input.gpt4Result,
      input.claudeResult,
      input.domesticResult,
    )

    if (candidates.length === 0) {
      throw new Error('No valid model results to select from')
    }

    this.logger.log(`Selecting best result from ${candidates.length} successful models`)

    if (input.generationType === AITaskType.QUESTIONNAIRE) {
      return this.selectBestQuestionnaireResult(candidates, input.matrixResult)
    }

    // 优先级顺序：DeepSeek（兼容 gpt4 槽位） > Claude > Domestic
    // 选择第一个成功的模型（按优先级）
    const { selectedResult, selectedModel } = this.selectPriorityCandidate(candidates)

    this.logger.log(
      `Selected model: ${this.getDisplayModelName(selectedModel)} (from ${candidates.length} successful models)`,
    )

    return { selectedResult, selectedModel }
  }

  private collectCandidates(
    gpt4Result: Record<string, any> | null,
    claudeResult: Record<string, any> | null,
    domesticResult: Record<string, any> | null,
  ): ModelCandidate[] {
    const results: Record<CandidateModelName, Record<string, any> | null> = {
      gpt4: gpt4Result,
      claude: claudeResult,
      domestic: domesticResult,
    }

    return MODEL_PRIORITY.map((name) => ({
      name,
      result: results[name],
    })).filter((candidate): candidate is ModelCandidate => candidate.result !== null)
  }

  private selectPriorityCandidate(candidates: ModelCandidate[]): {
    selectedResult: Record<string, any>
    selectedModel: SelectedModel
  } {
    const selected = [...candidates].sort(
      (a, b) => MODEL_PRIORITY.indexOf(a.name) - MODEL_PRIORITY.indexOf(b.name),
    )[0]

    return {
      selectedResult: selected.result,
      selectedModel: this.mapToSelectedModel(selected.name),
    }
  }

  private selectBestQuestionnaireResult(
    candidates: ModelCandidate[],
    matrixResult?: { matrix?: any[] } | null,
  ): { selectedResult: Record<string, any>; selectedModel: SelectedModel } {
    const questionnaireCandidates = candidates.filter(
      (candidate) => this.getQuestionnaire(candidate.result).length > 0,
    )

    if (questionnaireCandidates.length === 0) {
      throw new Error('No valid questionnaire results to select from')
    }

    if (questionnaireCandidates.length < 3) {
      const selected = this.selectPriorityCandidate(questionnaireCandidates)
      this.logger.log(
        `Questionnaire fallback selected ${this.getDisplayModelName(selected.selectedModel)}: only ${questionnaireCandidates.length} model result(s) available`,
      )
      return selected
    }

    if (this.countDistinctQuestionnaireResults(questionnaireCandidates) < 3) {
      const selected = this.selectPriorityCandidate(questionnaireCandidates)
      this.logger.log(
        `Questionnaire fallback selected ${this.getDisplayModelName(selected.selectedModel)}: fewer than 3 independent questionnaire payloads`,
      )
      return selected
    }

    const matrixRows = Array.isArray(matrixResult?.matrix) ? matrixResult.matrix : []
    const groupedQuestions = new Map<CandidateModelName, Map<number, Record<string, any>[]>>()

    for (const candidate of questionnaireCandidates) {
      groupedQuestions.set(
        candidate.name,
        this.groupQuestionnaireByMatrixRow(this.getQuestionnaire(candidate.result)),
      )
    }

    const groupCount =
      matrixRows.length > 0
        ? matrixRows.length
        : this.getMaxQuestionnaireGroupCount(groupedQuestions)

    if (groupCount === 0) {
      return this.selectPriorityCandidate(questionnaireCandidates)
    }

    const selectedQuestions: Record<string, any>[] = []
    const selections: QuestionnaireGroupSelection[] = []
    const selectedGroupCounts: Record<CandidateModelName, number> = {
      gpt4: 0,
      claude: 0,
      domestic: 0,
    }

    for (let rowIndex = 0; rowIndex < groupCount; rowIndex += 1) {
      const expectedRow = matrixRows[rowIndex]
      const scoredCandidates = questionnaireCandidates
        .map((candidate) => {
          const group = groupedQuestions.get(candidate.name)?.get(rowIndex) || []
          const peerGroups = questionnaireCandidates
            .filter((peer) => peer.name !== candidate.name)
            .map((peer) => groupedQuestions.get(peer.name)?.get(rowIndex) || [])
            .filter((peerGroup) => peerGroup.length > 0)

          return {
            candidate,
            group,
            score: this.scoreQuestionnaireGroup(group, expectedRow, peerGroups),
          }
        })
        .sort((a, b) => {
          const scoreDelta = b.score - a.score
          if (scoreDelta !== 0) {
            return scoreDelta
          }
          return MODEL_PRIORITY.indexOf(a.candidate.name) - MODEL_PRIORITY.indexOf(b.candidate.name)
        })

      const selected = scoredCandidates[0]
      if (!selected || selected.group.length === 0) {
        continue
      }

      selectedGroupCounts[selected.candidate.name] += 1
      selectedQuestions.push(...selected.group)
      selections.push({
        row_index: rowIndex + 1,
        cluster_id: expectedRow?.cluster_id || selected.group[0]?.cluster_id,
        cluster_name: expectedRow?.cluster_name || selected.group[0]?.cluster_name,
        selected_model: selected.candidate.name,
        question_count: selected.group.length,
        scores: scoredCandidates.reduce(
          (scores, scored) => ({
            ...scores,
            [scored.candidate.name]: this.roundScore(scored.score),
          }),
          { gpt4: 0, claude: 0, domestic: 0 } as Record<CandidateModelName, number>,
        ),
      })
    }

    if (selectedQuestions.length === 0) {
      return this.selectPriorityCandidate(questionnaireCandidates)
    }

    const dominantModel = this.selectDominantQuestionnaireModel(selectedGroupCounts)
    const dominantCandidate =
      questionnaireCandidates.find((candidate) => candidate.name === dominantModel) ||
      questionnaireCandidates[0]
    const renumberedQuestions = this.renumberQuestionnaire(selectedQuestions)
    const selectedResult = {
      ...this.cloneJson(dominantCandidate.result),
      questionnaire: renumberedQuestions,
      questionnaire_metadata: {
        ...(dominantCandidate.result.questionnaire_metadata || {}),
        total_questions: renumberedQuestions.length,
        estimated_time_minutes: Math.ceil(renumberedQuestions.length * 0.5),
        coverage_map: this.buildQuestionnaireCoverageMap(renumberedQuestions),
        model_selection: {
          strategy: 'per_matrix_row_quality_scoring',
          group_size: QUESTIONNAIRE_GROUP_SIZE,
          selected_group_counts: selectedGroupCounts,
          row_selections: selections,
        },
      },
    }

    this.logger.log(
      `Questionnaire aggregation built per-row result: questions=${renumberedQuestions.length}, dominant=${this.getDisplayModelName(dominantModel)}`,
    )

    return {
      selectedResult,
      selectedModel: this.mapToSelectedModel(dominantModel),
    }
  }

  private getQuestionnaire(result: Record<string, any>): Record<string, any>[] {
    return Array.isArray(result?.questionnaire) ? result.questionnaire : []
  }

  private countDistinctQuestionnaireResults(candidates: ModelCandidate[]): number {
    const payloads = new Set(
      candidates.map((candidate) => JSON.stringify(this.getQuestionnaire(candidate.result))),
    )
    return payloads.size
  }

  private groupQuestionnaireByMatrixRow(
    questions: Record<string, any>[],
  ): Map<number, Record<string, any>[]> {
    const groups = new Map<number, Record<string, any>[]>()

    questions.forEach((question, index) => {
      const rowIndex = this.resolveQuestionMatrixRowIndex(question, index)
      const group = groups.get(rowIndex) || []
      group.push(question)
      groups.set(rowIndex, group)
    })

    return groups
  }

  private resolveQuestionMatrixRowIndex(
    question: Record<string, any>,
    fallbackIndex: number,
  ): number {
    const idValue = String(question?.question_id || '')
    const idMatch = idValue.match(/(\d+)/)
    const questionNumber = idMatch ? Number(idMatch[1]) : NaN

    if (Number.isInteger(questionNumber) && questionNumber > 0) {
      return Math.floor((questionNumber - 1) / QUESTIONNAIRE_GROUP_SIZE)
    }

    return Math.floor(fallbackIndex / QUESTIONNAIRE_GROUP_SIZE)
  }

  private getMaxQuestionnaireGroupCount(
    groupedQuestions: Map<CandidateModelName, Map<number, Record<string, any>[]>>,
  ): number {
    let maxGroupIndex = -1

    for (const groups of groupedQuestions.values()) {
      for (const groupIndex of groups.keys()) {
        maxGroupIndex = Math.max(maxGroupIndex, groupIndex)
      }
    }

    return maxGroupIndex + 1
  }

  private scoreQuestionnaireGroup(
    group: Record<string, any>[],
    expectedRow: Record<string, any> | undefined,
    peerGroups: Record<string, any>[][],
  ): number {
    if (group.length === 0) {
      return Number.NEGATIVE_INFINITY
    }

    let score = 0
    score += Math.min(group.length, QUESTIONNAIRE_GROUP_SIZE) * 8
    score -= Math.abs(group.length - QUESTIONNAIRE_GROUP_SIZE) * 12

    for (const question of group) {
      score += this.scoreQuestionStructure(question, expectedRow)
    }

    score += this.scoreQuestionClusterConsistency(group, expectedRow)
    score += this.scoreQuestionTextDiversity(group)
    score += this.scoreQuestionMatrixAlignment(group, expectedRow)
    score += this.scoreQuestionConsensus(group, peerGroups)

    return score
  }

  private scoreQuestionStructure(
    question: Record<string, any>,
    expectedRow: Record<string, any> | undefined,
  ): number {
    let score = 0

    score += this.isFilledString(question.question_id) ? 2 : -4
    score += this.isFilledString(question.cluster_id) ? 4 : -8
    score += this.isFilledString(question.cluster_name) ? 3 : -6

    if (this.isFilledString(expectedRow?.cluster_id)) {
      score += String(question.cluster_id) === String(expectedRow?.cluster_id) ? 4 : -5
    }

    if (this.isFilledString(question.question_text)) {
      const questionTextLength = String(question.question_text).trim().length
      score += questionTextLength >= 12 ? 8 : 3
    } else {
      score -= 14
    }

    score += ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'RATING'].includes(question.question_type)
      ? 3
      : -8
    score += typeof question.required === 'boolean' ? 1 : -1
    score += this.isFilledString(question.guidance) ? 2 : -2
    score += this.scoreQuestionOptions(question)

    return score
  }

  private scoreQuestionOptions(question: Record<string, any>): number {
    const options = Array.isArray(question.options) ? question.options : []

    if (options.length === 0) {
      return -24
    }

    let score = Math.min(options.length, QUESTIONNAIRE_GROUP_SIZE) * 2
    const optionScores = options
      .map((option) => Number(option?.score))
      .filter((optionScore) => Number.isFinite(optionScore))

    for (const option of options) {
      score += this.isFilledString(option?.option_id) ? 1 : -1
      score += this.isFilledString(option?.text) ? 3 : -4
      score += Number.isFinite(Number(option?.score)) ? 2 : -4
      score += this.isFilledString(option?.level) ? 1 : 0
    }

    if (question.question_type === 'SINGLE_CHOICE') {
      score += options.length === QUESTIONNAIRE_GROUP_SIZE ? 8 : -Math.abs(options.length - 5) * 5

      const uniqueScores = new Set(optionScores)
      const coversMaturityLevels = [1, 2, 3, 4, 5].every((level) => uniqueScores.has(level))
      score += coversMaturityLevels ? 12 : -6
    }

    const scoresInRange = optionScores.every((optionScore) => optionScore >= 1 && optionScore <= 5)
    score += scoresInRange ? 5 : -8
    score += this.isMonotonic(optionScores) ? 3 : -2

    return score
  }

  private scoreQuestionClusterConsistency(
    group: Record<string, any>[],
    expectedRow: Record<string, any> | undefined,
  ): number {
    const clusterIds = group
      .map((question) => question.cluster_id)
      .filter(Boolean)
      .map(String)
    const clusterNames = group
      .map((question) => question.cluster_name)
      .filter(Boolean)
      .map(String)

    let score = 0
    score += clusterIds.length === group.length ? 5 : -5
    score += clusterNames.length === group.length ? 4 : -4

    const uniqueClusterIds = new Set(clusterIds)
    const uniqueClusterNames = new Set(clusterNames)
    score += uniqueClusterIds.size <= 1 ? 8 : -6 * (uniqueClusterIds.size - 1)
    score += uniqueClusterNames.size <= 1 ? 5 : -4 * (uniqueClusterNames.size - 1)

    if (this.isFilledString(expectedRow?.cluster_id)) {
      const matchingCount = clusterIds.filter(
        (clusterId) => clusterId === String(expectedRow?.cluster_id),
      ).length
      score += matchingCount * 2
      score -= (group.length - matchingCount) * 3
    }

    return score
  }

  private scoreQuestionTextDiversity(group: Record<string, any>[]): number {
    const normalizedTexts = group
      .map((question) => this.normalizeSearchText(String(question.question_text || '')))
      .filter(Boolean)
    const uniqueTexts = new Set(normalizedTexts)

    if (normalizedTexts.length === 0) {
      return -10
    }

    const diversityRate = uniqueTexts.size / normalizedTexts.length
    return diversityRate >= 0.8 ? 8 : -12 * (1 - diversityRate)
  }

  private scoreQuestionMatrixAlignment(
    group: Record<string, any>[],
    expectedRow: Record<string, any> | undefined,
  ): number {
    if (!expectedRow) {
      return 0
    }

    const rowTerms = this.extractMeaningfulTerms(this.stringifyForScoring(expectedRow)).slice(0, 80)
    if (rowTerms.length === 0) {
      return 0
    }

    const groupText = this.normalizeSearchText(this.stringifyForScoring(group))
    const matchedTermCount = rowTerms.filter((term) =>
      groupText.includes(this.normalizeSearchText(term)),
    ).length

    if (matchedTermCount === 0) {
      return -12
    }

    return Math.min(24, matchedTermCount * 4)
  }

  private scoreQuestionConsensus(
    group: Record<string, any>[],
    peerGroups: Record<string, any>[][],
  ): number {
    if (peerGroups.length === 0) {
      return 0
    }

    const similarities = peerGroups.map((peerGroup) =>
      this.calculateTokenOverlap(
        this.stringifyForScoring(group),
        this.stringifyForScoring(peerGroup),
      ),
    )
    const averageSimilarity =
      similarities.reduce((total, similarity) => total + similarity, 0) / similarities.length

    return averageSimilarity * 10
  }

  private calculateTokenOverlap(left: string, right: string): number {
    const leftTokens = new Set(this.extractMeaningfulTerms(left))
    const rightTokens = new Set(this.extractMeaningfulTerms(right))

    if (leftTokens.size === 0 || rightTokens.size === 0) {
      return 0
    }

    let intersectionCount = 0
    for (const token of leftTokens) {
      if (rightTokens.has(token)) {
        intersectionCount += 1
      }
    }

    const unionCount = new Set([...leftTokens, ...rightTokens]).size
    return unionCount === 0 ? 0 : intersectionCount / unionCount
  }

  private extractMeaningfulTerms(value: string): string[] {
    const normalized = this.normalizeSearchText(value)
    const terms = new Set<string>()
    const chunks = normalized.split(/[^\u4e00-\u9fa5a-zA-Z0-9]+/).filter(Boolean)

    for (const chunk of chunks) {
      if (/^[a-zA-Z0-9]+$/.test(chunk)) {
        if (chunk.length >= 4) {
          terms.add(chunk.toLowerCase())
        }
        continue
      }

      if (!/[\u4e00-\u9fa5]/.test(chunk)) {
        continue
      }

      if (chunk.length >= 2 && !QUESTIONNAIRE_STOP_TERMS.has(chunk)) {
        terms.add(chunk.slice(0, 12))
      }

      for (let size = 4; size >= 2; size -= 1) {
        if (chunk.length < size) {
          continue
        }
        for (let index = 0; index <= chunk.length - size; index += 1) {
          const term = chunk.slice(index, index + size)
          if (!QUESTIONNAIRE_STOP_TERMS.has(term)) {
            terms.add(term)
          }
        }
      }
    }

    return [...terms]
  }

  private stringifyForScoring(value: unknown): string {
    if (value === null || value === undefined) {
      return ''
    }

    if (typeof value === 'string') {
      return value
    }

    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }

  private normalizeSearchText(value: string): string {
    return value
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[，。；：、,.!?;:()[\]{}"'`~@#$%^&*_+=|\\/<>-]/g, '')
  }

  private isFilledString(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0
  }

  private isMonotonic(values: number[]): boolean {
    if (values.length <= 1) {
      return true
    }

    return values.every((value, index) => index === 0 || value >= values[index - 1])
  }

  private selectDominantQuestionnaireModel(
    selectedGroupCounts: Record<CandidateModelName, number>,
  ): CandidateModelName {
    return [...MODEL_PRIORITY].sort((left, right) => {
      const countDelta = selectedGroupCounts[right] - selectedGroupCounts[left]
      if (countDelta !== 0) {
        return countDelta
      }
      return MODEL_PRIORITY.indexOf(left) - MODEL_PRIORITY.indexOf(right)
    })[0]
  }

  private renumberQuestionnaire(questions: Record<string, any>[]): Record<string, any>[] {
    return questions.map((question, index) => ({
      ...this.cloneJson(question),
      question_id: `Q${(index + 1).toString().padStart(3, '0')}`,
    }))
  }

  private buildQuestionnaireCoverageMap(questions: Record<string, any>[]): Record<string, number> {
    return questions.reduce<Record<string, number>>((coverageMap, question) => {
      if (question.cluster_id) {
        coverageMap[question.cluster_id] = (coverageMap[question.cluster_id] || 0) + 1
      }
      return coverageMap
    }, {})
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value))
  }

  private roundScore(score: number): number {
    if (!Number.isFinite(score)) {
      return score
    }
    return Math.round(score * 100) / 100
  }

  /**
   * 映射模型名称到SelectedModel枚举
   */
  private mapToSelectedModel(name: string): SelectedModel {
    switch (name) {
      case 'gpt4':
        return SelectedModel.GPT4
      case 'claude':
        return SelectedModel.CLAUDE
      case 'domestic':
        return SelectedModel.DOMESTIC
      default:
        throw new Error(`Unknown model name: ${name}`)
    }
  }

  private getDisplayModelName(name: string): string {
    switch (name.toLowerCase()) {
      case 'gpt4':
      case 'gpt-4':
        return 'DeepSeek'
      case 'claude':
        return 'Claude'
      case 'domestic':
      case 'tongyi':
        return 'Tongyi'
      default:
        return name
    }
  }

  /**
   * 映射置信度等级
   */
  private mapConfidenceLevel(level: 'HIGH' | 'MEDIUM' | 'LOW'): ConfidenceLevel {
    switch (level) {
      case 'HIGH':
        return ConfidenceLevel.HIGH
      case 'MEDIUM':
        return ConfidenceLevel.MEDIUM
      case 'LOW':
        return ConfidenceLevel.LOW
    }
  }

  /**
   * 存储聚合结果到数据库
   */
  private async saveToDatabase(input: AggregationInput, output: AggregationOutput): Promise<void> {
    const generationResult = this.generationResultRepository.create({
      taskId: input.taskId,
      generationType: input.generationType,
      gpt4Result: input.gpt4Result,
      claudeResult: input.claudeResult,
      domesticResult: input.domesticResult,
      qualityScores: output.qualityScores,
      consistencyReport: output.consistencyReport,
      coverageReport: output.coverageReport,
      selectedResult: output.selectedResult,
      selectedModel: output.selectedModel,
      confidenceLevel: output.confidenceLevel,
    })

    await this.generationResultRepository.save(generationResult)

    this.logger.debug(`Saved generation result to database: id=${generationResult.id}`)
  }

  /**
   * 根据任务ID获取生成结果
   */
  async getResultByTaskId(taskId: string): Promise<AIGenerationResult | null> {
    return this.generationResultRepository.findOne({
      where: { taskId },
      relations: ['task', 'reviewer'],
    })
  }

  /**
   * 更新人工审核状态
   */
  async updateReviewStatus(
    resultId: string,
    reviewStatus: 'APPROVED' | 'MODIFIED' | 'REJECTED',
    reviewedBy: string,
    modifiedResult?: Record<string, any>,
    reviewNotes?: string,
  ): Promise<void> {
    const result = await this.generationResultRepository.findOne({
      where: { id: resultId },
    })

    if (!result) {
      throw new Error(`Generation result not found: ${resultId}`)
    }

    result.reviewStatus = reviewStatus as any
    result.reviewedBy = reviewedBy
    result.reviewedAt = new Date()
    result.reviewNotes = reviewNotes

    if (modifiedResult) {
      result.modifiedResult = modifiedResult
      result.version = result.version + 1
    }

    await this.generationResultRepository.save(result)

    this.logger.log(`Updated review status for result ${resultId}: ${reviewStatus}`)
  }

  /**
   * 获取最终结果（考虑人工修改）
   */
  async getFinalResult(taskId: string): Promise<Record<string, any> | null> {
    const result = await this.getResultByTaskId(taskId)

    if (!result) {
      return null
    }

    // 如果有人工修改版本，返回修改后的结果
    if (result.modifiedResult) {
      return result.modifiedResult
    }

    // 否则返回AI选择的结果
    return result.selectedResult
  }

  /**
   * 更新生成结果的内容（用户手工修改）
   * @param resultId 结果ID
   * @param updatedContent 更新后的内容（JSON字符串）
   * @param reviewStatus 审核状态（MODIFIED/APPROVED）
   */
  async updateResultContent(
    resultId: string,
    updatedContent: string,
    reviewStatus: ReviewStatus = ReviewStatus.MODIFIED,
  ): Promise<void> {
    this.logger.log(`Updating result content for result ${resultId}`)

    // 解析更新后的内容
    const updatedResult = JSON.parse(updatedContent)

    // 更新数据库记录
    await this.generationResultRepository.update(resultId, {
      selectedResult: updatedContent as any, // 类型转换，存储JSON字符串
      modifiedResult: updatedResult, // 同时保存到modifiedResult
      reviewStatus: reviewStatus,
      version: () => 'version + 1', // 版本号+1
      updatedAt: new Date(),
    })

    this.logger.log(`Result content updated successfully for result ${resultId}`)
  }
}
