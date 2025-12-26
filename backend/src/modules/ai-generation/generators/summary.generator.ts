import { Injectable, Logger } from '@nestjs/common'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'
import { AIClientRequest } from '../../ai-clients/interfaces/ai-client.interface'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'
import { fillSummaryPrompt } from '../prompts/summary.prompts'

export interface SummaryGenerationInput {
  standardDocument: string
  temperature?: number
  maxTokens?: number
}

export interface SummaryGenerationOutput {
  title: string
  overview: string
  key_areas: Array<{
    name: string
    description: string
    importance: 'HIGH' | 'MEDIUM' | 'LOW'
  }>
  scope: string
  key_requirements: string[]
  compliance_level: string
}

/**
 * 综述生成器
 * 使用AI Orchestrator调用三模型生成标准文档综述
 */
@Injectable()
export class SummaryGenerator {
  private readonly logger = new Logger(SummaryGenerator.name)

  constructor(private readonly aiOrchestrator: AIOrchestrator) {}

  /**
   * 生成标准文档综述
   * @param input 生成输入
   * @returns 生成输出（三模型结果）
   */
  async generate(input: SummaryGenerationInput): Promise<{
    gpt4: SummaryGenerationOutput
    claude: SummaryGenerationOutput
    domestic: SummaryGenerationOutput
  }> {
    this.logger.log('Starting summary generation...')

    const { standardDocument, temperature = 0.7, maxTokens = 2000 } = input

    // 填充Prompt模板
    const prompt = fillSummaryPrompt(standardDocument)

    // 构建AI请求
    const aiRequest: AIClientRequest = {
      prompt,
      temperature,
      maxTokens,
      // 注意：OpenAI和Anthropic都支持JSON模式，通义千问可能需要额外处理
      responseFormat: { type: 'json_object' }, // 强制JSON输出
    }

    // 并行调用三模型生成
    const [gpt4Response, claudeResponse, domesticResponse] = await Promise.all([
      this.generateWithModel(aiRequest, AIModel.GPT4),
      this.generateWithModel(aiRequest, AIModel.CLAUDE),
      this.generateWithModel(aiRequest, AIModel.DOMESTIC),
    ])

    // 解析JSON结果
    const gpt4Result = this.parseJsonResponse(gpt4Response.content)
    const claudeResult = this.parseJsonResponse(claudeResponse.content)
    const domesticResult = this.parseJsonResponse(domesticResponse.content)

    this.logger.log('Summary generation completed for all three models')

    return {
      gpt4: gpt4Result,
      claude: claudeResult,
      domestic: domesticResult,
    }
  }

  /**
   * 使用指定模型生成
   */
  private async generateWithModel(request: AIClientRequest, model: AIModel) {
    try {
      const response = await this.aiOrchestrator.generate(request, model)
      this.logger.debug(`Model ${model} generated successfully`)
      return response
    } catch (error) {
      this.logger.error(`Model ${model} generation failed: ${error.message}`)
      throw new Error(`${model} generation failed: ${error.message}`)
    }
  }

  /**
   * 解析JSON响应
   */
  private parseJsonResponse(content: string): SummaryGenerationOutput {
    try {
      // 1. 移除markdown代码块标记（如果存在）
      let cleanedContent = content.trim()

      // 移除 ```json 和 ``` 标记
      if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
      }

      // 2. 尝试直接解析清理后的JSON
      const parsed = JSON.parse(cleanedContent)

      // 3. 验证必需字段
      this.validateSummaryOutput(parsed)

      return parsed as SummaryGenerationOutput
    } catch (error) {
      this.logger.error(`Failed to parse JSON response: ${error.message}`)

      // 4. 最后尝试：提取大括号之间的内容
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          this.validateSummaryOutput(parsed)
          return parsed as SummaryGenerationOutput
        } catch (e) {
          this.logger.error(`Failed to extract and parse JSON: ${e.message}`)
        }
      }

      throw new Error(`Invalid JSON response: ${error.message}. Content preview: ${content.substring(0, 100)}...`)
    }
  }

  /**
   * 验证综述输出的结构
   */
  private validateSummaryOutput(output: any): void {
    const requiredFields = [
      'title',
      'overview',
      'key_areas',
      'scope',
      'key_requirements',
      'compliance_level',
    ]

    for (const field of requiredFields) {
      if (!(field in output)) {
        throw new Error(`Missing required field: ${field}`)
      }
    }

    // 验证key_areas数组
    if (!Array.isArray(output.key_areas) || output.key_areas.length === 0) {
      throw new Error('key_areas must be a non-empty array')
    }

    // 验证key_requirements数组
    if (!Array.isArray(output.key_requirements) || output.key_requirements.length === 0) {
      throw new Error('key_requirements must be a non-empty array')
    }

    // 验证key_areas的每个元素
    for (const area of output.key_areas) {
      if (!area.name || !area.description || !area.importance) {
        throw new Error('Each key_area must have name, description, and importance')
      }
    }
  }

  /**
   * 生成综述摘要（用于日志和预览）
   */
  generateSummary(output: SummaryGenerationOutput): string {
    return `${output.title}\n\n${output.overview}\n\nKey Areas (${output.key_areas.length}): ${output.key_areas.map((a) => a.name).join(', ')}`
  }
}
