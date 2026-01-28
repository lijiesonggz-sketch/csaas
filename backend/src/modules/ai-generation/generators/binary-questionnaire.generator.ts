import { Injectable, Logger } from '@nestjs/common'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'
import { AIClientRequest } from '../../ai-clients/interfaces/ai-client.interface'
import { fillBinaryQuestionnairePrompt } from '../prompts/binary-questionnaire.prompts'
import { ClusteringGenerationOutput } from './clustering.generator'

/**
 * 判断题题目接口
 */
export interface BinaryQuestion {
  question_id: string // "Q001", "Q002", ...
  cluster_id: string // 对应的聚类ID
  cluster_name: string // 聚类名称
  category_name: string // 分类名称
  clause_id: string // 条款ID
  clause_text: string // 条款内容
  question_text: string // 题目文本
  expected_answer: boolean // 期望答案（true表示"有"）
  guidance: string // 判断指引
}

/**
 * 判断题问卷元数据接口
 */
export interface BinaryQuestionnaireMetadata {
  total_questions: number // 总题数
  coverage_map: Record<string, number> // 每个聚类的题目数量
  categories_summary?: Array<{
    category_name: string
    total_questions: number
    clusters_count: number
  }>
}

/**
 * 判断题问卷生成输出
 */
export interface BinaryQuestionnaireGenerationOutput {
  questionnaire: BinaryQuestion[]
  questionnaire_metadata: BinaryQuestionnaireMetadata
}

/**
 * 判断题问卷生成输入
 */
export interface BinaryQuestionnaireInput {
  clusteringResult: ClusteringGenerationOutput
  temperature?: number
  maxTokens?: number
}

/**
 * 判断题问卷生成器
 * 基于聚类结果生成判断题问卷（有/没有）
 */
@Injectable()
export class BinaryQuestionnaireGenerator {
  private readonly logger = new Logger(BinaryQuestionnaireGenerator.name)

  constructor(private readonly aiOrchestrator: AIOrchestrator) {}

  /**
   * 生成判断题问卷
   * @param input 生成输入
   * @returns 生成输出（三模型结果）
   */
  async generate(input: BinaryQuestionnaireInput): Promise<{
    gpt4: BinaryQuestionnaireGenerationOutput
    claude: BinaryQuestionnaireGenerationOutput
    domestic: BinaryQuestionnaireGenerationOutput
  }> {
    this.logger.log('Starting binary questionnaire generation...')

    const { clusteringResult, temperature = 0.7, maxTokens = 16000 } = input

    // 验证输入
    if (!clusteringResult || !clusteringResult.categories) {
      throw new Error('Valid clustering result is required for binary questionnaire generation')
    }

    this.logger.log(
      `Generating binary questionnaire for ${clusteringResult.categories.length} categories...`,
    )

    // 构建Prompt
    const prompt = fillBinaryQuestionnairePrompt(clusteringResult)

    // 准备三个AI模型的请求
    const gpt4Request: AIClientRequest = {
      prompt,
      temperature,
      maxTokens,
      model: 'gpt4',
    }

    const claudeRequest: AIClientRequest = {
      prompt,
      temperature,
      maxTokens,
      model: 'claude',
    }

    const domesticRequest: AIClientRequest = {
      prompt,
      temperature,
      maxTokens,
      model: 'domestic',
    }

    this.logger.log('Calling three AI models in parallel...')

    // 并行调用三个模型
    const [gpt4Result, claudeResult, domesticResult] = await Promise.all([
      this.aiOrchestrator.generate(gpt4Request, 'gpt4' as any),
      this.aiOrchestrator.generate(claudeRequest, 'claude' as any),
      this.aiOrchestrator.generate(domesticRequest, 'domestic' as any),
    ])

    // 解析结果
    this.logger.log('Parsing AI model responses...')

    const gpt4Output = this.parseResponse(gpt4Result.content)
    const claudeOutput = this.parseResponse(claudeResult.content)
    const domesticOutput = this.parseResponse(domesticResult.content)

    this.logger.log(
      `Binary questionnaire generation completed. GPT4: ${gpt4Output.questionnaire.length} questions, Claude: ${claudeOutput.questionnaire.length} questions, Domestic: ${domesticOutput.questionnaire.length} questions`,
    )

    return {
      gpt4: gpt4Output,
      claude: claudeOutput,
      domestic: domesticOutput,
    }
  }

  /**
   * 解析AI响应
   * @param responseText AI响应文本
   * @returns 解析后的问卷输出
   */
  private parseResponse(responseText: string): BinaryQuestionnaireGenerationOutput {
    try {
      // 尝试直接解析JSON
      const cleaned = responseText.trim()

      // 提取JSON部分（如果响应包含其他文本）
      const jsonMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/) || cleaned.match(/\{[\s\S]*\}/)

      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const jsonText = jsonMatch[1] || jsonMatch[0]
      const parsed = JSON.parse(jsonText)

      // 验证必需字段
      if (!parsed.questionnaire || !Array.isArray(parsed.questionnaire)) {
        throw new Error('Missing or invalid questionnaire field')
      }

      if (!parsed.questionnaire_metadata) {
        throw new Error('Missing questionnaire_metadata field')
      }

      return parsed as BinaryQuestionnaireGenerationOutput
    } catch (error) {
      this.logger.error(`Failed to parse AI response: ${error.message}`)
      this.logger.error(`Response text: ${responseText.substring(0, 500)}...`)

      // 返回一个空的问卷结构作为降级处理
      return {
        questionnaire: [],
        questionnaire_metadata: {
          total_questions: 0,
          coverage_map: {},
        },
      }
    }
  }

  /**
   * 验证问卷输出
   * @param output 问卷输出
   * @returns 是否有效
   */
  validateOutput(output: BinaryQuestionnaireGenerationOutput): boolean {
    if (!output.questionnaire || output.questionnaire.length === 0) {
      this.logger.warn('Validation failed: Empty questionnaire')
      return false
    }

    if (!output.questionnaire_metadata || output.questionnaire_metadata.total_questions === 0) {
      this.logger.warn('Validation failed: Invalid metadata')
      return false
    }

    // 检查每个问题的必需字段
    for (const question of output.questionnaire) {
      if (
        !question.question_id ||
        !question.cluster_id ||
        !question.question_text ||
        question.expected_answer === undefined
      ) {
        this.logger.warn(
          `Validation failed: Missing required fields in question ${question.question_id}`,
        )
        return false
      }
    }

    return true
  }
}
