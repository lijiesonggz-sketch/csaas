import { Injectable, Logger } from '@nestjs/common'
import { SummaryGenerator, SummaryGenerationInput } from './generators/summary.generator'
import { QualityValidationService } from '../quality-validation/quality-validation.service'
import { ResultAggregatorService } from '../result-aggregation/result-aggregator.service'
import { AITaskType } from '../../database/entities/ai-task.entity'

export interface GenerationRequest {
  taskId: string
  generationType: AITaskType
  input: any // 不同类型的生成任务有不同的输入结构
}

export interface GenerationResponse {
  taskId: string
  selectedResult: Record<string, any>
  selectedModel: string
  confidenceLevel: string
  qualityScores: {
    structural: number
    semantic: number
    detail: number
  }
}

/**
 * AI生成服务
 * 统一的AI生成接口，负责调度不同的生成器
 */
@Injectable()
export class AIGenerationService {
  private readonly logger = new Logger(AIGenerationService.name)

  constructor(
    private readonly summaryGenerator: SummaryGenerator,
    private readonly qualityValidation: QualityValidationService,
    private readonly resultAggregator: ResultAggregatorService,
  ) {}

  /**
   * 执行AI生成任务
   * @param request 生成请求
   * @returns 生成响应
   */
  async generateContent(request: GenerationRequest): Promise<GenerationResponse> {
    this.logger.log(
      `Starting content generation: taskId=${request.taskId}, type=${request.generationType}`,
    )

    switch (request.generationType) {
      case AITaskType.SUMMARY:
        return this.generateSummary(request)

      case AITaskType.CLUSTERING:
        throw new Error('Clustering generation not yet implemented')

      case AITaskType.MATRIX:
        throw new Error('Matrix generation not yet implemented')

      case AITaskType.QUESTIONNAIRE:
        throw new Error('Questionnaire generation not yet implemented')

      case AITaskType.ACTION_PLAN:
        throw new Error('Action plan generation not yet implemented')

      default:
        throw new Error(`Unknown generation type: ${request.generationType}`)
    }
  }

  /**
   * 生成综述
   */
  private async generateSummary(request: GenerationRequest): Promise<GenerationResponse> {
    const input = request.input as SummaryGenerationInput

    // 1. 调用三模型生成
    const { gpt4, claude, domestic } = await this.summaryGenerator.generate(input)

    // 2. 质量验证
    const validationReport = await this.qualityValidation.validateQuality({
      gpt4,
      claude,
      domestic,
    })

    // 3. 结果聚合
    const aggregationOutput = await this.resultAggregator.aggregate({
      taskId: request.taskId,
      generationType: request.generationType,
      gpt4Result: gpt4,
      claudeResult: claude,
      domesticResult: domestic,
      validationReport,
    })

    // 4. 构建响应
    const response: GenerationResponse = {
      taskId: request.taskId,
      selectedResult: aggregationOutput.selectedResult,
      selectedModel: aggregationOutput.selectedModel,
      confidenceLevel: aggregationOutput.confidenceLevel,
      qualityScores: aggregationOutput.qualityScores,
    }

    this.logger.log(
      `Summary generation completed: confidence=${response.confidenceLevel}, model=${response.selectedModel}`,
    )

    return response
  }

  /**
   * 获取任务的最终结果
   */
  async getFinalResult(taskId: string): Promise<Record<string, any> | null> {
    return this.resultAggregator.getFinalResult(taskId)
  }
}
