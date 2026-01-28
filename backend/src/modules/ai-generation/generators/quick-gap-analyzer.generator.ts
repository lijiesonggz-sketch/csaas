import { Injectable, Logger } from '@nestjs/common'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'
import { AIClientRequest } from '../../ai-clients/interfaces/ai-client.interface'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'
import { ClusteringGenerationOutput } from './clustering.generator'

/**
 * 超简版差距分析输出接口
 */
export interface QuickGapAnalysisOutput {
  gap_analysis: {
    overview: string
    compliance_rate: number
    total_requirements: number
    satisfied_requirements: number
    gap_requirements: number
  }

  gap_details: Array<{
    cluster_id: string
    cluster_name: string
    clause_id: string
    clause_text: string
    current_state: string
    gap: string
    priority: 'HIGH' | 'MEDIUM' | 'LOW'
  }>

  action_plan: Array<{
    action_id: string
    cluster_name: string
    gap_clauses: string[]
    priority: string
    action_items: string[]
    expected_impact: string
    estimated_effort: string
  }>
}

/**
 * 超简版差距分析输入接口
 */
export interface QuickGapAnalysisInput {
  currentStateDescription: string
  standardDocument: {
    id: string
    name: string
    content: string
  }
  clusteringResult?: ClusteringGenerationOutput
  temperature?: number
  maxTokens?: number
}

/**
 * 超简版差距分析生成器
 * 直接基于用户现状描述和标准要求生成差距分析和改进措施
 */
@Injectable()
export class QuickGapAnalyzer {
  private readonly logger = new Logger(QuickGapAnalyzer.name)

  constructor(private readonly aiOrchestrator: AIOrchestrator) {}

  /**
   * 生成超简版差距分析
   * @param input 输入参数
   * @returns 差距分析和改进措施
   */
  async analyze(input: QuickGapAnalysisInput): Promise<{
    gpt4: QuickGapAnalysisOutput
    claude: QuickGapAnalysisOutput
    domestic: QuickGapAnalysisOutput
  }> {
    this.logger.log('Starting quick gap analysis...')

    const {
      currentStateDescription,
      standardDocument,
      clusteringResult,
      temperature = 0.7,
      maxTokens = 12000,
    } = input

    // 构建Prompt
    const prompt = this.buildPromptSimple(currentStateDescription, standardDocument)

    // 准备三个AI模型的请求
    const gpt4Request: AIClientRequest = {
      prompt,
      temperature,
      maxTokens,
      model: AIModel.GPT4,
    }

    const claudeRequest: AIClientRequest = {
      prompt,
      temperature,
      maxTokens,
      model: AIModel.CLAUDE,
    }

    const domesticRequest: AIClientRequest = {
      prompt,
      temperature,
      maxTokens,
      model: AIModel.DOMESTIC,
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
      `Quick gap analysis completed. GPT4: ${gpt4Output.gap_details?.length || 0} gaps, Claude: ${claudeOutput.gap_details?.length || 0} gaps, Domestic: ${domesticOutput.gap_details?.length || 0} gaps`,
    )

    return {
      gpt4: gpt4Output,
      claude: claudeOutput,
      domestic: domesticOutput,
    }
  }

  /**
   * 构建简化的Prompt（避免模板字符串嵌套问题）
   */
  private buildPromptSimple(
    currentStateDescription: string,
    standardDocument: { id: string; name: string; content: string },
  ): string {
    let prompt =
      '你是一名IT标准落地专家。请基于用户现状描述和标准要求，快速分析差距并生成改进措施。\n\n'

    prompt += '**用户现状描述**：\n'
    prompt += currentStateDescription + '\n\n'

    prompt += '**标准文档**：\n'
    prompt += standardDocument.name + '\n\n'
    prompt += standardDocument.content.substring(0, 8000) + '\n\n'

    prompt += '**分析要求**：\n'
    prompt += '1. 逐项比对用户现状 vs 标准要求\n'
    prompt += '2. 识别差距条款（用户未满足或部分满足的标准要求）\n'
    prompt += '3. 估算合规率（满足要求条款数 / 总条款数）\n'
    prompt += '4. 为每个差距生成具体的改进措施（包含实施步骤、时间线、预期效果）\n\n'

    prompt += '**输出格式**（严格遵循以下JSON格式）：\n\n'
    prompt += '```json\n'
    prompt += '{\n'
    prompt += '  "gap_analysis": {\n'
    prompt += '    "overview": "总体差距情况概述",\n'
    prompt += '    "compliance_rate": 0.65,\n'
    prompt += '    "total_requirements": 50,\n'
    prompt += '    "satisfied_requirements": 32,\n'
    prompt += '    "gap_requirements": 18\n'
    prompt += '  },\n'
    prompt += '  "gap_details": [\n'
    prompt += '    {\n'
    prompt += '      "cluster_id": "cluster_1_1",\n'
    prompt += '      "cluster_name": "信息安全策略",\n'
    prompt += '      "clause_id": "4.1.1",\n'
    prompt += '      "clause_text": "制定信息安全策略...",\n'
    prompt += '      "current_state": "用户现状描述",\n'
    prompt += '      "gap": "差距描述",\n'
    prompt += '      "priority": "HIGH"\n'
    prompt += '    }\n'
    prompt += '  ],\n'
    prompt += '  "action_plan": [\n'
    prompt += '    {\n'
    prompt += '      "action_id": "A001",\n'
    prompt += '      "cluster_name": "信息安全策略",\n'
    prompt += '      "gap_clauses": ["4.1.1"],\n'
    prompt += '      "priority": "HIGH",\n'
    prompt += '      "action_items": ["具体措施1", "具体措施2"],\n'
    prompt += '      "expected_impact": "预期效果",\n'
    prompt += '      "estimated_effort": "1-2个月"\n'
    prompt += '    }\n'
    prompt += '  ]\n'
    prompt += '}\n'
    prompt += '```\n\n'

    prompt += '**重要约束**：\n'
    prompt += '1. 严格遵循JSON格式\n'
    prompt += '2. 不要在JSON之外添加任何其他文本\n'
    prompt += '3. 识别差距要准确\n'
    prompt += '4. 改进措施要具体、可操作\n\n'

    prompt += '请按照以上要求进行分析。'

    return prompt
  }

  /**
   * 解析AI响应
   */
  private parseResponse(responseText: string): QuickGapAnalysisOutput {
    try {
      // 提取JSON部分
      const jsonMatch =
        responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/)

      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const jsonText = jsonMatch[1] || jsonMatch[0]
      const parsed = JSON.parse(jsonText)

      // 验证必需字段
      if (!parsed.gap_analysis || !parsed.gap_details || !parsed.action_plan) {
        throw new Error('Missing required fields in response')
      }

      return parsed as QuickGapAnalysisOutput
    } catch (error) {
      this.logger.error('Failed to parse AI response: ' + error.message)

      // 返回一个空的结构作为降级处理
      return {
        gap_analysis: {
          overview: '差距分析失败',
          compliance_rate: 0,
          total_requirements: 0,
          satisfied_requirements: 0,
          gap_requirements: 0,
        },
        gap_details: [],
        action_plan: [],
      }
    }
  }
}
