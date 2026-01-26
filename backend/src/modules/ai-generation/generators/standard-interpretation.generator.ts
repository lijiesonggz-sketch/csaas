import { Injectable, Logger } from '@nestjs/common'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'
import { AIClientRequest } from '../../ai-clients/interfaces/ai-client.interface'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'
import {
  fillStandardInterpretationPrompt,
  fillRelatedStandardSearchPrompt,
  fillRelatedStandardSearchForClausePrompt,
  fillVersionComparePrompt,
  fillBatchInterpretationPrompt,
  BatchInterpretationInput,
} from '../prompts/standard-interpretation.prompts'
import { ClauseExtractionGenerator } from './clause-extraction.generator'
import { ClauseCoverageService } from '../services/clause-coverage.service'
import { ClauseExtractionOutput } from '../prompts/clause-extraction.prompts'

/**
 * 标准解读输出接口（优化版）
 */
export interface StandardInterpretationOutput {
  overview: {
    background: string
    scope: string
    core_objectives: string[]
    target_audience: string[]
    key_changes?: string // 与前一版本的主要变化
  }
  key_terms: Array<{
    term: string
    definition: string
    explanation: string
    examples?: string[] // 应用示例
  }>
  key_requirements: Array<{
    clause_id: string
    chapter?: string // 所属章节
    clause_full_text?: string // 条款完整原文
    clause_summary?: string // 条款内容一句话总结
    clause_text: string // 保留旧字段用于兼容
    interpretation: string | InterpretationDetail // 旧字段或新结构
    compliance_criteria: string[] | ComplianceCriteriaDetail
    priority: 'HIGH' | 'MEDIUM' | 'LOW'
    risk_assessment?: RiskAssessment
    implementation_order?: number
    estimated_effort?: string
    dependencies?: string[]
    best_practices?: string[]
    common_mistakes?: string[]
  }>
  implementation_guidance: {
    preparation: string[]
    implementation_steps: Array<{
      phase: string
      steps: string[]
      order?: number
      duration?: string
      objectives?: string[]
      deliverables?: string[]
    }>
    best_practices: string[]
    common_pitfalls: string[]
    timeline_estimate: string
    resource_requirements: string | ResourceDetail
    checklists?: Checklists
    evidence_templates?: EvidenceTemplate[]
  }
  risk_matrix?: RiskMatrix
  implementation_roadmap?: ImplementationRoadmap
}

// 新增的子类型定义
export interface InterpretationDetail {
  what: string
  why: string
  how: string
}

export interface ComplianceCriteriaDetail {
  must_have: string[]
  should_have: string[]
  evidence_required: string[]
  assessment_method: string
}

export interface RiskAssessment {
  non_compliance_risks: Array<{
    risk: string
    consequence: string
    probability: '高' | '中' | '低'
    mitigation: string
  }>
  implementation_risks: Array<{
    risk: string
    consequence: string
    prevention: string
  }>
}

export interface ResourceDetail {
  team: string
  budget: string
  tools: string
}

export interface Checklists {
  document_checklist: string[]
  system_checklist: string[]
  process_checklist: string[]
  interview_preparation: string[]
}

export interface EvidenceTemplate {
  clause: string
  evidence_type: string
  description: string
  sample_reference: string
}

export interface RiskMatrix {
  high_risk_clauses: string[]
  common_failures: Array<{
    clause: string
    failure_point: string
    consequence: string
    mitigation: string
  }>
  audit_focus_areas: string[]
}

export interface ImplementationRoadmap {
  phase_1_foundation: PhaseDetail
  phase_2_digitalization: PhaseDetail
  phase_3_automation: PhaseDetail
  phase_4_optimization: PhaseDetail
}

export interface PhaseDetail {
  name: string
  duration: string
  clauses: string[]
  focus: string
  deliverables: string[]
}

/**
 * 关联标准搜索输出接口
 */
export interface RelatedStandardSearchOutput {
  related_standards: Array<{
    clause_id: string
    clause_text: string
    related_standards: Array<{
      standard_code: string
      standard_name: string
      relation_type: 'REFERENCE' | 'SUPPLEMENT' | 'CONFLICT' | 'SYNERGY'
      relevance_score: number
      description: string
    }>
  }>
  summary: {
    total_related_standards: number
    national_standards_count: number
    industry_standards_count: number
    top_relations: string[]
  }
}

/**
 * 版本比对输出接口
 */
export interface VersionCompareOutput {
  version_info: {
    old_version: string
    new_version: string
    comparison_summary: string
  }
  added_clauses: Array<{
    clause_id: string
    clause_text: string
    impact: string
    action_required: string
  }>
  modified_clauses: Array<{
    clause_id: string
    old_text: string
    new_text: string
    change_type: 'MINOR' | 'MAJOR'
    impact: string
    migration_guide: string
  }>
  deleted_clauses: Array<{
    clause_id: string
    old_text: string
    impact: string
    alternative: string
  }>
  statistics: {
    total_added: number
    total_modified: number
    total_deleted: number
    change_percentage: number
  }
  migration_recommendations: string[]
}

/**
 * 标准解读生成器
 * 提供标准解读、关联标准搜索、版本比对功能
 * 支持两阶段模式：条款提取 + 批量解读
 */
@Injectable()
export class StandardInterpretationGenerator {
  private readonly logger = new Logger(StandardInterpretationGenerator.name)

  constructor(
    private readonly aiOrchestrator: AIOrchestrator,
    private readonly clauseExtractionGenerator: ClauseExtractionGenerator,
    private readonly clauseCoverageService: ClauseCoverageService,
  ) {}

  /**
   * 生成标准解读（优化版）
   */
  async generateInterpretation(
    input: {
      standardDocument: { id: string; name: string; content: string }
      interpretationMode?: 'basic' | 'detailed' | 'enterprise'
      temperature?: number
      maxTokens?: number
    },
  ): Promise<{
    gpt4: StandardInterpretationOutput | null
    claude: StandardInterpretationOutput | null
    domestic: StandardInterpretationOutput | null
  }> {
    this.logger.log('Starting standard interpretation...')

    const {
      standardDocument,
      interpretationMode = 'enterprise',
      temperature = 0.7,
      maxTokens = 80000, // 增加到80000以支持完整的企业级解读输出
    } = input

    // 构建Prompt（传入解读模式）
    const prompt = fillStandardInterpretationPrompt(standardDocument, interpretationMode)

    this.logger.log(
      `Interpretation mode: ${interpretationMode}, maxTokens: ${maxTokens}, content length: ${standardDocument.content.length}`,
    )

    // Debug: Log the prompt structure (first and last 1000 chars)
    this.logger.debug(`Prompt preview (first 1000 chars):\n${prompt.substring(0, 1000)}`)
    this.logger.debug(`Prompt ending (last 500 chars):\n${prompt.substring(prompt.length - 500)}`)

    // Write full prompt to file for debugging
    const fs = require('fs')
    const debugPath = `./debug-interpretation-${Date.now()}.txt`
    try {
      fs.writeFileSync(debugPath, prompt)
      this.logger.log(`Full prompt written to: ${debugPath}`)
    } catch (err) {
      this.logger.warn(`Could not write debug prompt file: ${err.message}`)
    }

    // 准备通义千问的请求
    const domesticRequest: AIClientRequest = {
      prompt,
      temperature,
      maxTokens,
    }

    this.logger.log('Calling Tongyi AI model for interpretation...')

    // 只调用通义千问（避免其他API失败）
    this.logger.log('[1/1] Calling 通义千问...')
    const domesticResult = await this.aiOrchestrator
      .generate(domesticRequest, AIModel.DOMESTIC)
      .catch(err => {
        this.logger.error(`通义千问调用失败: ${err.message}`)
        return { content: '', tokens: { input: 0, output: 0, total: 0 }, cost: 0, model: 'domestic-failed' }
      })

    // Log response lengths
    this.logger.log(
      `AI call completed. Tongyi: ${domesticResult.content.length} chars`,
    )

    // 解析结果
    this.logger.log('Parsing interpretation results...')

    const domesticOutput = this.parseInterpretationResponse(domesticResult.content)

    // 检查模型是否成功
    if (domesticOutput) {
      this.logger.log(`Interpretation parsing completed. Tongyi: ${domesticOutput.key_requirements?.length || 0}条款`)
    } else {
      this.logger.log('Interpretation parsing completed. No valid results')
    }

    // 如果模型失败，抛出异常
    if (!domesticOutput) {
      throw new Error('通义千问模型生成解读结果失败')
    }

    // 返回结果（其他模型为null）
    return {
      gpt4: null,
      claude: null,
      domestic: domesticOutput,
    }
  }

  /**
   * 搜索关联标准（逐条处理模式）
   */
  async searchRelatedStandards(
    input: {
      standardDocument: { id: string; name: string; content: string }
      interpretationResult?: any
      temperature?: number
      maxTokens?: number
    },
  ): Promise<{
    gpt4: RelatedStandardSearchOutput
    claude: RelatedStandardSearchOutput
    domestic: RelatedStandardSearchOutput
  }> {
    this.logger.log('Starting related standards search...')

    const { standardDocument, interpretationResult, temperature = 0.7, maxTokens = 80000 } = input

    // 如果有解读结果，使用逐条处理模式
    if (interpretationResult?.key_requirements && interpretationResult.key_requirements.length > 0) {
      return this.searchRelatedStandardsByClause({
        standardDocument,
        interpretationResult,
        temperature,
        maxTokens,
      })
    }

    // 否则使用一次性处理模式（降级处理）
    this.logger.warn('No interpretation result provided, using fallback mode with standard content only')
    const prompt = fillRelatedStandardSearchPrompt(standardDocument, null)

    // 准备三个AI模型的请求
    const gpt4Request: AIClientRequest = {
      prompt,
      temperature,
      maxTokens,
    }

    const claudeRequest: AIClientRequest = {
      prompt,
      temperature,
      maxTokens,
    }

    const domesticRequest: AIClientRequest = {
      prompt,
      temperature,
      maxTokens,
    }

    this.logger.log('Calling three AI models sequentially for related standards (fallback mode)...')

    // 串行调用三个模型（避免并发限制）
    const gpt4Result = await this.aiOrchestrator
      .generate(gpt4Request, AIModel.GPT4)
      .catch(err => {
        this.logger.error(`GPT4 call failed: ${err.message}`)
        return { content: '', tokens: { input: 0, output: 0, total: 0 }, cost: 0, model: 'gpt4-failed' }
      })

    await new Promise(resolve => setTimeout(resolve, 1000))

    const claudeResult = await this.aiOrchestrator
      .generate(claudeRequest, AIModel.CLAUDE)
      .catch(err => {
        this.logger.error(`Claude call failed: ${err.message}`)
        return { content: '', tokens: { input: 0, output: 0, total: 0 }, cost: 0, model: 'claude-failed' }
      })

    await new Promise(resolve => setTimeout(resolve, 1000))

    const domesticResult = await this.aiOrchestrator
      .generate(domesticRequest, AIModel.DOMESTIC)
      .catch(err => {
        this.logger.error(`Domestic call failed: ${err.message}`)
        return { content: '', tokens: { input: 0, output: 0, total: 0 }, cost: 0, model: 'domestic-failed' }
      })

    // 解析结果
    this.logger.log('Parsing related standards results...')

    const gpt4Output = this.parseRelatedStandardsResponse(gpt4Result.content)
    const claudeOutput = this.parseRelatedStandardsResponse(claudeResult.content)
    const domesticOutput = this.parseRelatedStandardsResponse(domesticResult.content)

    this.logger.log(
      `Related standards search completed. GPT4: ${gpt4Output.related_standards?.length || 0} clauses, Claude: ${claudeOutput.related_standards?.length || 0} clauses, Domestic: ${domesticOutput.related_standards?.length || 0} clauses`,
    )

    return {
      gpt4: gpt4Output,
      claude: claudeOutput,
      domestic: domesticOutput,
    }
  }

  /**
   * 逐条搜索关联标准（推荐模式）
   */
  private async searchRelatedStandardsByClause(
    input: {
      standardDocument: { id: string; name: string; content: string }
      interpretationResult: any
      temperature?: number
      maxTokens?: number
    },
  ): Promise<{
    gpt4: RelatedStandardSearchOutput
    claude: RelatedStandardSearchOutput
    domestic: RelatedStandardSearchOutput
  }> {
    const { standardDocument, interpretationResult, temperature = 0.7, maxTokens = 4000 } = input
    const clauses = interpretationResult.key_requirements || []

    this.logger.log(`Processing ${clauses.length} clauses individually for related standards search...`)

    // 初始化结果结构
    const results = {
      gpt4: [] as any[],
      claude: [] as any[],
      domestic: [] as any[],
    }

    // 统计信息
    let processedCount = 0
    const totalClauses = clauses.length

    // 逐条处理每个条款
    for (const clause of clauses) {
      processedCount++
      this.logger.log(`Processing clause ${processedCount}/${totalClauses}: ${clause.clause_id}`)

      // 为单个条款构建 prompt（使用完整标准内容作为上下文）
      const prompt = fillRelatedStandardSearchForClausePrompt(standardDocument, clause)

      // 准备三个模型的请求
      const gpt4Request: AIClientRequest = { prompt, temperature, maxTokens }
      const claudeRequest: AIClientRequest = { prompt, temperature, maxTokens }
      const domesticRequest: AIClientRequest = { prompt, temperature, maxTokens }

      try {
        // 并行调用三个模型
        const [gpt4Result, claudeResult, domesticResult] = await Promise.all([
          this.aiOrchestrator.generate(gpt4Request, AIModel.GPT4).catch(err => {
            this.logger.error(`GPT4 failed for clause ${clause.clause_id}: ${err.message}`)
            return null
          }),
          this.aiOrchestrator.generate(claudeRequest, AIModel.CLAUDE).catch(err => {
            this.logger.error(`Claude failed for clause ${clause.clause_id}: ${err.message}`)
            return null
          }),
          this.aiOrchestrator.generate(domesticRequest, AIModel.DOMESTIC).catch(err => {
            this.logger.error(`Domestic failed for clause ${clause.clause_id}: ${err.message}`)
            return null
          }),
        ])

        // 解析单个条款的结果
        if (gpt4Result) {
          const parsed = this.parseSingleClauseResponse(gpt4Result.content, clause)
          if (parsed) results.gpt4.push(parsed)
        }
        if (claudeResult) {
          const parsed = this.parseSingleClauseResponse(claudeResult.content, clause)
          if (parsed) results.claude.push(parsed)
        }
        if (domesticResult) {
          const parsed = this.parseSingleClauseResponse(domesticResult.content, clause)
          if (parsed) results.domestic.push(parsed)
        }

        this.logger.log(`Clause ${clause.clause_id} completed: GPT4=${!!gpt4Result}, Claude=${!!claudeResult}, Domestic=${!!domesticResult}`)
      } catch (error) {
        this.logger.error(`Failed to process clause ${clause.clause_id}: ${error.message}`)
      }
    }

    // 构建统计信息
    const buildSummary = (clauseResults: any[]) => ({
      total_related_standards: clauseResults.reduce(
        (sum, r) => sum + (r.related_standards?.length || 0),
        0,
      ),
      national_standards_count: clauseResults.reduce(
        (sum, r) =>
          sum +
          (r.related_standards?.filter((s: any) => s.standard_code?.startsWith('GB')).length || 0),
        0,
      ),
      industry_standards_count: clauseResults.reduce(
        (sum, r) =>
          sum +
          (r.related_standards?.filter((s: any) => !s.standard_code?.startsWith('GB')).length || 0),
        0,
      ),
      top_relations: clauseResults
        .sort((a, b) => (b.related_standards?.length || 0) - (a.related_standards?.length || 0))
        .slice(0, 5)
        .map((r: any) => r.clause_id),
    })

    this.logger.log(
      `Related standards search completed. GPT4: ${results.gpt4.length} clauses, Claude: ${results.claude.length} clauses, Domestic: ${results.domestic.length} clauses`,
    )

    return {
      gpt4: { related_standards: results.gpt4, summary: buildSummary(results.gpt4) },
      claude: { related_standards: results.claude, summary: buildSummary(results.claude) },
      domestic: { related_standards: results.domestic, summary: buildSummary(results.domestic) },
    }
  }

  /**
   * 解析单个条款的关联标准响应
   */
  private parseSingleClauseResponse(responseText: string, clause: any): any | null {
    try {
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/)

      if (!jsonMatch) {
        this.logger.warn(`No JSON found in response for clause ${clause.clause_id}`)
        return null
      }

      const jsonText = jsonMatch[1] || jsonMatch[0]
      const parsed = JSON.parse(jsonText)

      // 返回单条款结果
      return {
        clause_id: clause.clause_id,
        clause_text: clause.clause_text || clause.clause_summary || '',
        related_standards: parsed.related_standards || [],
      }
    } catch (error) {
      this.logger.error(`Failed to parse response for clause ${clause.clause_id}: ${error.message}`)
      return null
    }
  }

  /**
   * 比对版本差异
   */
  async compareVersions(
    input: {
      oldVersion: { id: string; name: string; content: string }
      newVersion: { id: string; name: string; content: string }
      temperature?: number
      maxTokens?: number
    },
  ): Promise<{
    gpt4: VersionCompareOutput
    claude: VersionCompareOutput
    domestic: VersionCompareOutput
  }> {
    this.logger.log('Starting version comparison...')

    const { oldVersion, newVersion, temperature = 0.7, maxTokens = 80000 } = input

    // 构建Prompt
    const prompt = fillVersionComparePrompt(oldVersion, newVersion)

    // 准备三个AI模型的请求
    const gpt4Request: AIClientRequest = {
      prompt,
      temperature,
      maxTokens,
    }

    const claudeRequest: AIClientRequest = {
      prompt,
      temperature,
      maxTokens,
    }

    const domesticRequest: AIClientRequest = {
      prompt,
      temperature,
      maxTokens,
    }

    this.logger.log('Calling three AI models sequentially for version comparison...')

    // 串行调用三个模型（避免并发限制）
    const gpt4Result = await this.aiOrchestrator
      .generate(gpt4Request, AIModel.GPT4)
      .catch(err => {
        this.logger.error(`GPT4 call failed: ${err.message}`)
        return { content: '', tokens: { input: 0, output: 0, total: 0 }, cost: 0, model: 'gpt4-failed' }
      })

    await new Promise(resolve => setTimeout(resolve, 1000))

    const claudeResult = await this.aiOrchestrator
      .generate(claudeRequest, AIModel.CLAUDE)
      .catch(err => {
        this.logger.error(`Claude call failed: ${err.message}`)
        return { content: '', tokens: { input: 0, output: 0, total: 0 }, cost: 0, model: 'claude-failed' }
      })

    await new Promise(resolve => setTimeout(resolve, 1000))

    const domesticResult = await this.aiOrchestrator
      .generate(domesticRequest, AIModel.DOMESTIC)
      .catch(err => {
        this.logger.error(`Domestic call failed: ${err.message}`)
        return { content: '', tokens: { input: 0, output: 0, total: 0 }, cost: 0, model: 'domestic-failed' }
      })

    // 解析结果
    this.logger.log('Parsing version comparison results...')

    const gpt4Output = this.parseVersionCompareResponse(gpt4Result.content)
    const claudeOutput = this.parseVersionCompareResponse(claudeResult.content)
    const domesticOutput = this.parseVersionCompareResponse(domesticResult.content)

    this.logger.log(
      `Version comparison completed. GPT4: ${gpt4Output.statistics?.total_added || 0} added, ${gpt4Output.statistics?.total_modified || 0} modified, ${gpt4Output.statistics?.total_deleted || 0} deleted`,
    )

    return {
      gpt4: gpt4Output,
      claude: claudeOutput,
      domestic: domesticOutput,
    }
  }

  /**
   * 解析标准解读响应（增强版，带容错）
   */
  private parseInterpretationResponse(responseText: string): StandardInterpretationOutput | null {
    if (!responseText || responseText.trim().length === 0) {
      this.logger.error('Empty response text')
      return null
    }

    // 尝试多种解析策略
    const strategies = [
      () => this.parseWithMarkdownBlock(responseText),
      () => this.parseWithCleanJson(responseText),
      () => this.parseWithFixedJson(responseText),
      () => this.parseWithExtractedObject(responseText),
    ]

    for (let i = 0; i < strategies.length; i++) {
      try {
        const result = strategies[i]()
        if (result) {
          this.logger.log(`Successfully parsed with strategy ${i + 1}`)
          return result
        }
      } catch (error) {
        if (i === strategies.length - 1) {
          // 最后一个策略也失败了，记录错误
          this.logger.error(`Failed to parse interpretation response: ${error.message}`)
          this.logger.error(`Response preview (first 500 chars): ${responseText.substring(0, 500)}`)
        }
      }
    }

    return null
  }

  /**
   * 策略1: 从Markdown代码块中提取JSON
   */
  private parseWithMarkdownBlock(responseText: string): StandardInterpretationOutput | null {
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch && jsonMatch[1]) {
      const jsonText = jsonMatch[1].trim()
      return this.validateAndParse(jsonText)
    }
    return null
  }

  /**
   * 策略2: 直接解析（假设响应就是纯JSON）
   */
  private parseWithCleanJson(responseText: string): StandardInterpretationOutput | null {
    const trimmed = responseText.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return this.validateAndParse(trimmed)
    }
    return null
  }

  /**
   * 策略3: 修复常见的JSON格式问题
   */
  private parseWithFixedJson(responseText: string): StandardInterpretationOutput | null {
    let fixed = responseText

    // 移除markdown代码块标记
    fixed = fixed.replace(/```json\s*/g, '').replace(/```\s*/g, '')

    // 尝试找到JSON对象的开始和结束
    const startIdx = fixed.indexOf('{')
    const endIdx = fixed.lastIndexOf('}')

    if (startIdx >= 0 && endIdx > startIdx) {
      let jsonText = fixed.substring(startIdx, endIdx + 1)

      // 尝试修复常见问题
      // 1. 移除多余的逗号
      jsonText = jsonText.replace(/,\s*([}\]])/g, '$1')

      // 2. 修复未闭合的字符串
      const lines = jsonText.split('\n')
      const fixedLines: string[] = []
      let inString = false
      let stringChar = ''

      for (const line of lines) {
        let fixedLine = line
        for (let i = 0; i < fixedLine.length; i++) {
          const char = fixedLine[i]
          if ((char === '"' || char === "'") && (i === 0 || fixedLine[i - 1] !== '\\')) {
            if (!inString) {
              inString = true
              stringChar = char
            } else if (char === stringChar) {
              inString = false
              stringChar = ''
            }
          }
        }
        fixedLines.push(fixedLine)
      }

      jsonText = fixedLines.join('\n')

      return this.validateAndParse(jsonText)
    }

    return null
  }

  /**
   * 策略4: 提取JSON对象（处理嵌套情况）
   */
  private parseWithExtractedObject(responseText: string): StandardInterpretationOutput | null {
    const match = responseText.match(/\{[\s\S]*\}/)
    if (match) {
      return this.validateAndParse(match[0])
    }
    return null
  }

  /**
   * 验证并解析JSON
   */
  private validateAndParse(jsonText: string): StandardInterpretationOutput | null {
    try {
      const parsed = JSON.parse(jsonText)

      // 验证必需字段
      if (!parsed.overview || !parsed.key_requirements) {
        throw new Error('Missing required fields: overview or key_requirements')
      }

      // 验证是否是有效的结果（不是降级的空结构）
      if (!parsed.key_requirements || parsed.key_requirements.length === 0) {
        throw new Error('Empty key_requirements array')
      }

      return parsed as StandardInterpretationOutput
    } catch (error) {
      // 重新抛出，让上层策略处理
      throw error
    }
  }

  /**
   * 解析关联标准搜索响应
   */
  private parseRelatedStandardsResponse(responseText: string): RelatedStandardSearchOutput {
    try {
      // 提取JSON部分
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/)

      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const jsonText = jsonMatch[1] || jsonMatch[0]
      const parsed = JSON.parse(jsonText)

      // 验证必需字段
      if (!parsed.related_standards || !parsed.summary) {
        throw new Error('Missing required fields in related standards response')
      }

      return parsed as RelatedStandardSearchOutput
    } catch (error) {
      this.logger.error('Failed to parse related standards response: ' + error.message)

      // 返回一个空的结构作为降级处理
      return {
        related_standards: [],
        summary: {
          total_related_standards: 0,
          national_standards_count: 0,
          industry_standards_count: 0,
          top_relations: [],
        },
      }
    }
  }

  /**
   * 解析版本比对响应
   */
  private parseVersionCompareResponse(responseText: string): VersionCompareOutput {
    try {
      // 提取JSON部分
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/)

      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const jsonText = jsonMatch[1] || jsonMatch[0]
      const parsed = JSON.parse(jsonText)

      // 验证必需字段
      if (!parsed.version_info || !parsed.statistics) {
        throw new Error('Missing required fields in version compare response')
      }

      return parsed as VersionCompareOutput
    } catch (error) {
      this.logger.error('Failed to parse version compare response: ' + error.message)

      // 返回一个空的结构作为降级处理
      return {
        version_info: {
          old_version: '',
          new_version: '',
          comparison_summary: '解析失败',
        },
        added_clauses: [],
        modified_clauses: [],
        deleted_clauses: [],
        statistics: {
          total_added: 0,
          total_modified: 0,
          total_deleted: 0,
          change_percentage: 0,
        },
        migration_recommendations: [],
      }
    }
  }

  /**
   * 两阶段模式：批量解读
   * 阶段1：提取条款清单
   * 阶段2：分批进行解读
   *
   * @param input 批量解读输入参数
   * @returns 三个AI模型的解读结果
   */
  async generateBatchInterpretation(input: {
    standardDocument: { id: string; name: string; content: string }
    interpretationMode?: 'basic' | 'detailed' | 'enterprise'
    batchSize?: number
    temperature?: number
    maxTokens?: number
    onProgress?: (progress: {
      current: number
      total: number
      batch: number
      totalBatches: number
      message: string
    }) => void
  }): Promise<{
    gpt4: StandardInterpretationOutput | null
    claude: StandardInterpretationOutput | null
    domestic: StandardInterpretationOutput | null
  }> {
    this.logger.log('Starting two-phase batch interpretation...')

    const {
      standardDocument,
      interpretationMode = 'enterprise',
      batchSize = 10,
      temperature = 0.7,
      maxTokens = 30000, // 增加到30000以支持企业级模式的大量字段
      onProgress,
    } = input

    // ============================================================
    // 阶段1：提取条款清单
    // ============================================================
    this.logger.log('[Phase 1/2] Extracting clause list...')

    onProgress?.({
      current: 0,
      total: 100,
      batch: 0,
      totalBatches: 0,
      message: '正在提取条款清单...',
    })

    // 使用正则表达式统计预期条款数量
    const regexResult = this.clauseCoverageService.countClausesByRegex(standardDocument.content)
    const expectedClauseCount = regexResult.totalCount

    this.logger.log(`Regex detected ${expectedClauseCount} unique clause IDs`)
    onProgress?.({
      current: 5,
      total: 100,
      batch: 0,
      totalBatches: 0,
      message: `检测到${expectedClauseCount}个条款，开始提取...`,
    })

    // 调用3个AI模型提取条款
    const extractionResults = await this.clauseExtractionGenerator.extractClauses({
      standardDocument,
      expectedClauseCount,
      temperature: 0.3, // 使用较低温度提高准确性
      maxTokens: 4000, // 条款提取不需要太多tokens
    })

    // 选择最佳提取结果
    const selectedExtraction = this.clauseExtractionGenerator.selectBestExtraction(
      extractionResults,
      expectedClauseCount
    )

    if (!selectedExtraction) {
      throw new Error('All AI models failed to extract clauses')
    }

    this.logger.log(`Selected extraction: ${selectedExtraction.total_clauses} clauses`)

    // 验证提取完整性
    const validation = this.clauseCoverageService.validateCoverage(
      standardDocument.content,
      selectedExtraction
    )

    // 如果有缺失条款，自动补全
    if (!validation.isComplete) {
      this.logger.warn(
        `Found ${validation.missingClauseIds.length} missing clauses, filling...`
      )
      selectedExtraction.clauses = this.clauseCoverageService.fillMissingClauses(
        standardDocument.content,
        selectedExtraction.clauses,
        validation.missingClauseIds
      )
      selectedExtraction.total_clauses = selectedExtraction.clauses.length
      this.logger.log(
        `After filling: ${selectedExtraction.total_clauses} clauses (100% coverage)`
      )
    }

    onProgress?.({
      current: 10,
      total: 100,
      batch: 0,
      totalBatches: 0,
      message: `条款提取完成：${selectedExtraction.total_clauses}个条款`,
    })

    // ============================================================
    // 阶段2：批量解读
    // ============================================================
    this.logger.log('[Phase 2/2] Starting batch interpretation...')

    const totalBatches = Math.ceil(selectedExtraction.clauses.length / batchSize)
    this.logger.log(
      `Total clauses: ${selectedExtraction.clauses.length}, Batch size: ${batchSize}, Total batches: ${totalBatches}`
    )

    onProgress?.({
      current: 10,
      total: 100,
      batch: 0,
      totalBatches,
      message: `开始批量解读：共${totalBatches}批次`,
    })

    // 对3个AI模型分别进行批量解读
    const results = {
      gpt4: null as StandardInterpretationOutput | null,
      claude: null as StandardInterpretationOutput | null,
      domestic: null as StandardInterpretationOutput | null,
    }

    // 只使用通义千问大模型（避免其他API失败）
    const models = [
      { name: 'Tongyi', model: AIModel.DOMESTIC, key: 'domestic' as const },
    ]

    for (const modelInfo of models) {
      this.logger.log(`[Batch Interpretation] Processing ${modelInfo.name}...`)

      try {
        const interpretedClauses: StandardInterpretationOutput['key_requirements'] = []

        // 分批处理
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const startIdx = batchIndex * batchSize
          const endIdx = Math.min(startIdx + batchSize, selectedExtraction.clauses.length)
          const batchClauses = selectedExtraction.clauses.slice(startIdx, endIdx)

          this.logger.log(
            `[${modelInfo.name}] Batch ${batchIndex + 1}/${totalBatches}: ${batchClauses.length} clauses (${startIdx + 1}-${endIdx})`
          )

          // 构建批次解读prompt
          const batchPrompt = fillBatchInterpretationPrompt(
            {
              clauses: batchClauses,
              standardDocument: { id: standardDocument.id, name: standardDocument.name },
              interpretationMode,
              totalClauseCount: selectedExtraction.clauses.length,
              currentBatchIndex: batchIndex + 1,
              totalBatches,
            },
            interpretationMode
          )

          // 调用AI模型
          const batchResult = await this.aiOrchestrator
            .generate({ prompt: batchPrompt, temperature, maxTokens }, modelInfo.model)
            .catch(err => {
              this.logger.error(
                `${modelInfo.name} batch ${batchIndex + 1} failed: ${err.message}`
              )
              return null
            })

          if (!batchResult) {
            this.logger.warn(
              `${modelInfo.name} batch ${batchIndex + 1} failed, skipping...`
            )
            continue
          }

          // 解析批次结果
          const batchParsed = this.parseBatchInterpretationResponse(batchResult.content)

          if (!batchParsed || !batchParsed.key_requirements) {
            this.logger.warn(
              `${modelInfo.name} batch ${batchIndex + 1} parsing failed, skipping...`
            )
            continue
          }

          // 验证批次结果数量
          if (batchParsed.key_requirements.length !== batchClauses.length) {
            this.logger.warn(
              `${modelInfo.name} batch ${batchIndex + 1} returned ${batchParsed.key_requirements.length} clauses, expected ${batchClauses.length}`
            )
          }

          // 追加到总结果
          interpretedClauses.push(...batchParsed.key_requirements)

          // 更新进度
          const progressPercent = 10 + Math.floor((90 * (batchIndex + 1)) / totalBatches)
          onProgress?.({
            current: progressPercent,
            total: 100,
            batch: batchIndex + 1,
            totalBatches,
            message: `${modelInfo.name} 批次 ${batchIndex + 1}/${totalBatches} 完成`,
          })

          // 延迟500ms避免限流
          await new Promise(resolve => setTimeout(resolve, 500))
        }

        // 构建完整的解读结果
        if (interpretedClauses.length > 0) {
          results[modelInfo.key] = this.buildCompleteInterpretation(
            standardDocument,
            interpretedClauses,
            interpretationMode
          )
          this.logger.log(
            `${modelInfo.name} batch interpretation completed: ${interpretedClauses.length} clauses`
          )
        }
      } catch (error) {
        this.logger.error(`${modelInfo.name} batch interpretation failed: ${error.message}`)
      }
    }

    // 检查是否有任何成功的模型
    const successModels = Object.entries(results)
      .filter(([_, result]) => result !== null)
      .map(([name, result]) => `${name}(${result!.key_requirements.length}条款)`)

    this.logger.log(
      `Batch interpretation completed. Successful models: ${successModels.join(', ') || 'NONE'}`
    )

    if (!results.domestic) {
      throw new Error('通义千问模型生成批量解读结果失败')
    }

    return results
  }

  /**
   * 解析批量解读响应
   */
  private parseBatchInterpretationResponse(responseText: string): {
    key_requirements: StandardInterpretationOutput['key_requirements']
  } | null {
    try {
      // 尝试从Markdown代码块中提取JSON
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch && jsonMatch[1]) {
        const parsed = JSON.parse(jsonMatch[1])
        if (parsed.key_requirements && Array.isArray(parsed.key_requirements)) {
          return parsed
        }
      }

      // 尝试直接解析JSON
      const parsed = JSON.parse(responseText)
      if (parsed.key_requirements && Array.isArray(parsed.key_requirements)) {
        return parsed
      }

      this.logger.warn('No valid key_requirements found in batch interpretation response')
      return null
    } catch (error) {
      this.logger.error(`Failed to parse batch interpretation response: ${error.message}`)
      this.logger.debug(`Response preview (first 500 chars): ${responseText.substring(0, 500)}`)
      return null
    }
  }

  /**
   * 构建完整的解读结果（包含overview, key_terms, implementation_guidance等）
   */
  private buildCompleteInterpretation(
    standardDocument: { id: string; name: string; content: string },
    interpretedClauses: StandardInterpretationOutput['key_requirements'],
    interpretationMode: 'basic' | 'detailed' | 'enterprise'
  ): StandardInterpretationOutput {
    // 构建基础结构
    const result: StandardInterpretationOutput = {
      overview: {
        background: `${standardDocument.name}标准解读`,
        scope: '适用于所有相关组织',
        core_objectives: ['确保合规性', '提升管理水平', '保障信息安全'],
        target_audience: ['企业管理层', '合规负责人', 'IT部门'],
      },
      key_terms: [],
      key_requirements: interpretedClauses,
      implementation_guidance: {
        preparation: ['了解标准要求', '评估现状', '制定实施计划'],
        implementation_steps: [
          {
            phase: '标准解读与理解',
            steps: ['学习标准要求', '识别差距', '制定改进措施'],
          },
          {
            phase: '实施与改进',
            steps: ['建立管理制度', '部署技术措施', '开展培训'],
          },
          {
            phase: '评估与优化',
            steps: ['内部审核', '管理评审', '持续改进'],
          },
        ],
        best_practices: ['高层重视', '全员参与', '持续改进'],
        common_pitfalls: ['理解不深', '执行不力', '文档不全'],
        timeline_estimate: '3-12个月',
        resource_requirements: {
          team: '合规团队、IT团队、业务团队',
          budget: '根据组织规模而定',
          tools: '文档管理系统、安全设备',
        },
      },
    }

    // 如果是企业模式，添加额外字段
    if (interpretationMode === 'enterprise') {
      result.overview.key_changes = '详见标准条文'

      result.implementation_guidance.checklists = {
        document_checklist: ['□ 管理制度', '□ 操作规程', '□ 记录表单'],
        system_checklist: ['□ 技术措施', '□ 监控系统', '□ 审计系统'],
        process_checklist: ['□ 流程规范', '□ 责任分工', '□ 沟通机制'],
        interview_preparation: ['□ 准备问题清单', '□ 安排访谈时间', '□ 准备证据材料'],
      }

      result.implementation_guidance.evidence_templates = []
    }

    return result
  }
}
