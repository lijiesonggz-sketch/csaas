import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import {
  AIGenerationResult,
  ConfidenceLevel,
  SelectedModel,
  ReviewStatus,
} from '../../database/entities/ai-generation-result.entity'
import { AITask, AITaskType } from '../../database/entities/ai-task.entity'
import { FullValidationReport } from '../quality-validation/quality-validation.service'

export interface AggregationInput {
  taskId: string
  generationType: AITaskType
  gpt4Result: Record<string, any>
  claudeResult: Record<string, any>
  domesticResult: Record<string, any>
  validationReport: FullValidationReport
  standardDocument?: string // 仅聚类任务需要（用于覆盖率检查）
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
    this.logger.log(
      `Aggregating results for task ${input.taskId}, type: ${input.generationType}`,
    )

    const {
      gpt4Result,
      claudeResult,
      domesticResult,
      validationReport,
    } = input

    // 1. 投票选择最佳结果（基于质量分数）
    const { selectedResult, selectedModel } = this.selectBestResult(
      gpt4Result,
      claudeResult,
      domesticResult,
      validationReport,
    )

    // 2. 确定置信度等级
    const confidenceLevel = this.mapConfidenceLevel(
      validationReport.confidenceLevel,
    )

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
      `Aggregation completed: selected=${selectedModel}, confidence=${confidenceLevel}`,
    )

    return output
  }

  /**
   * 投票选择最佳结果
   * 策略：选择整体质量分数最高的模型结果
   */
  private selectBestResult(
    gpt4Result: Record<string, any>,
    claudeResult: Record<string, any>,
    domesticResult: Record<string, any>,
    validationReport: FullValidationReport,
  ): { selectedResult: Record<string, any>; selectedModel: SelectedModel } {
    // 简化版投票策略：直接选择GPT-4的结果（因为我们假设GPT-4质量最高）
    // TODO: 未来可以实现更复杂的投票策略，如基于单个模型的质量分数

    // 计算每个模型的加权分数（简化：使用总体分数）
    const scores = {
      gpt4: validationReport.overallScore,
      claude: validationReport.overallScore, // 实际应该计算单独的分数
      domestic: validationReport.overallScore, // 实际应该计算单独的分数
    }

    // 找出最高分
    const maxScore = Math.max(...Object.values(scores))

    // 选择得分最高的模型（如果平分，优先选择GPT-4）
    let selectedModel: SelectedModel
    let selectedResult: Record<string, any>

    if (scores.gpt4 === maxScore) {
      selectedModel = SelectedModel.GPT4
      selectedResult = gpt4Result
    } else if (scores.claude === maxScore) {
      selectedModel = SelectedModel.CLAUDE
      selectedResult = claudeResult
    } else {
      selectedModel = SelectedModel.DOMESTIC
      selectedResult = domesticResult
    }

    this.logger.debug(
      `Selected model: ${selectedModel} with score ${maxScore.toFixed(4)}`,
    )

    return { selectedResult, selectedModel }
  }

  /**
   * 映射置信度等级
   */
  private mapConfidenceLevel(
    level: 'HIGH' | 'MEDIUM' | 'LOW',
  ): ConfidenceLevel {
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
  private async saveToDatabase(
    input: AggregationInput,
    output: AggregationOutput,
  ): Promise<void> {
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

    this.logger.debug(
      `Saved generation result to database: id=${generationResult.id}`,
    )
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

    this.logger.log(
      `Updated review status for result ${resultId}: ${reviewStatus}`,
    )
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
