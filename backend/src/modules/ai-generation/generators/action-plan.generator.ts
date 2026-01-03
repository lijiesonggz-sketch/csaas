import { Injectable, Logger } from '@nestjs/common'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'
import { AIClientRequest } from '../../ai-clients/interfaces/ai-client.interface'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'
// import { fillActionPlanPrompt } from '../prompts/action-plan.prompts' // 已废弃,使用新的 action-plan-generation.service.ts
import { MatrixGenerationOutput } from './matrix.generator'
import { QuestionnaireGenerationOutput } from './questionnaire.generator'

/**
 * 改进措施项接口
 */
export interface ActionItem {
  action_id: string // "A001", "A002"
  cluster_id: string // 对应的聚类
  cluster_name: string
  gap_description: string // 差距描述
  current_level: number // 当前成熟度级别 (1-5)
  target_level: number // 目标成熟度级别 (1-5)
  gap_score: number // 差距分数
  priority: 'HIGH' | 'MEDIUM' | 'LOW' // 优先级
  action_items: string[] // 具体改进措施（3-5条）
  expected_impact: string // 预期影响
  estimated_effort: string // 预估工作量
  estimated_cost?: string // 预估成本
  dependencies: string[] // 依赖的其他改进项
  quick_wins?: string // 快速见效的措施
  risks?: string // 风险提示
}

/**
 * 实施路线图阶段
 */
export interface RoadmapPhase {
  timeframe: string // 时间范围
  priority: string // 优先级描述
  action_ids: string[] // 包含的措施ID列表
  expected_outcome: string // 预期成果
}

/**
 * 预算估算
 */
export interface BudgetEstimation {
  phase_1: string
  phase_2: string
  phase_3: string
  total: string
}

/**
 * 成熟度分布
 */
export interface MaturityDistribution {
  level_1: number
  level_2: number
  level_3: number
  level_4: number
  level_5: number
}

/**
 * 落地措施生成输出
 */
export interface ActionPlanGenerationOutput {
  gap_analysis_summary: string // 总体差距分析
  overall_maturity_level: number // 总体成熟度水平 (1-5)
  current_maturity_distribution: MaturityDistribution // 成熟度分布
  action_plan: ActionItem[] // 改进措施列表（20-30条，按优先级排序）
  implementation_roadmap: {
    phase_1_immediate: RoadmapPhase
    phase_2_short_term: RoadmapPhase
    phase_3_mid_term: RoadmapPhase
  }
  budget_estimation: BudgetEstimation
  key_success_factors: string[] // 关键成功要素（3-5条）
  risk_mitigation: string[] // 风险缓解措施（3-5条）
}

/**
 * 落地措施生成输入
 */
export interface ActionPlanGenerationInput {
  matrixResult: MatrixGenerationOutput // 成熟度矩阵
  questionnaireResult: QuestionnaireGenerationOutput // 问卷结果
  temperature?: number
  maxTokens?: number
}

/**
 * 落地措施生成器
 * 基于问卷结果和成熟度矩阵生成差距分析和改进建议
 */
@Injectable()
export class ActionPlanGenerator {
  private readonly logger = new Logger(ActionPlanGenerator.name)

  constructor(private readonly aiOrchestrator: AIOrchestrator) {}

  /**
   * 生成落地措施
   * @param input 生成输入
   * @returns 生成输出（三模型结果）
   */
  async generate(input: ActionPlanGenerationInput): Promise<{
    gpt4: ActionPlanGenerationOutput
    claude: ActionPlanGenerationOutput
    domestic: ActionPlanGenerationOutput
  }> {
    this.logger.log('Starting action plan generation...')

    const { matrixResult, questionnaireResult, temperature = 0.7, maxTokens = 12000 } = input

    // 验证输入
    if (!matrixResult || !matrixResult.matrix) {
      throw new Error('Valid matrix result is required for action plan generation')
    }

    if (!questionnaireResult || !questionnaireResult.questionnaire) {
      throw new Error('Valid questionnaire result is required for action plan generation')
    }

    this.logger.log(
      `Generating action plan based on ${matrixResult.matrix.length} clusters and ${questionnaireResult.questionnaire.length} questions...`,
    )

    // 生成提示词
    // const prompt = fillActionPlanPrompt(matrixResult, questionnaireResult) // 已废弃
    const prompt = '' // TODO: 此生成器已废弃,请使用 action-plan-generation.service.ts

    // 三模型并行生成
    const [gpt4Result, claudeResult, domesticResult] = await Promise.all([
      this.generateWithModel(prompt, 'gpt4', temperature, maxTokens),
      this.generateWithModel(prompt, 'claude', temperature, maxTokens),
      this.generateWithModel(prompt, 'domestic', temperature, maxTokens),
    ])

    this.logger.log('Action plan generation completed for all three models')

    return {
      gpt4: gpt4Result,
      claude: claudeResult,
      domestic: domesticResult,
    }
  }

  /**
   * 使用指定模型生成落地措施
   */
  private async generateWithModel(
    prompt: string,
    modelType: 'gpt4' | 'claude' | 'domestic',
    temperature: number,
    maxTokens: number,
  ): Promise<ActionPlanGenerationOutput> {
    this.logger.debug(`Generating action plan with model: ${modelType}`)

    const request: AIClientRequest = {
      prompt,
      temperature,
      maxTokens,
      model:
        modelType === 'gpt4'
          ? AIModel.GPT4
          : modelType === 'claude'
            ? AIModel.CLAUDE
            : AIModel.DOMESTIC,
    }

    try {
      const response = await this.aiOrchestrator.generate(request)
      this.logger.debug(`Model ${modelType} generated action plan successfully`)

      // 解析JSON响应
      const parsedResult = this.parseActionPlanResult(response.content)
      return parsedResult
    } catch (error) {
      this.logger.error(
        `Failed to generate action plan with ${modelType}: ${error.message}`,
      )
      throw error
    }
  }

  /**
   * 解析AI生成的落地措施结果
   */
  private parseActionPlanResult(content: string): ActionPlanGenerationOutput {
    try {
      // 移除可能的markdown代码块标记
      let cleanedContent = content.trim()

      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/```\s*$/, '')
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/```\s*$/, '')
      }

      const parsed = JSON.parse(cleanedContent)

      // 验证必要字段
      if (!parsed.gap_analysis_summary) {
        throw new Error('Missing gap_analysis_summary field')
      }

      if (typeof parsed.overall_maturity_level !== 'number') {
        throw new Error('Invalid overall_maturity_level field')
      }

      if (!Array.isArray(parsed.action_plan) || parsed.action_plan.length === 0) {
        throw new Error('Invalid or empty action_plan array')
      }

      if (!parsed.implementation_roadmap) {
        throw new Error('Missing implementation_roadmap field')
      }

      this.logger.debug(
        `Successfully parsed action plan with ${parsed.action_plan.length} action items`,
      )

      return parsed as ActionPlanGenerationOutput
    } catch (error) {
      this.logger.error(`Failed to parse action plan result: ${error.message}`)
      this.logger.debug(`Raw content: ${content.substring(0, 500)}...`)
      throw new Error(`Failed to parse action plan JSON: ${error.message}`)
    }
  }
}
