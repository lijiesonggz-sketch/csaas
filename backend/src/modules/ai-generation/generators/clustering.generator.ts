import { Injectable, Logger } from '@nestjs/common'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'
import { AIClientRequest } from '../../ai-clients/interfaces/ai-client.interface'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'
import { fillClusteringPrompt } from '../prompts/clustering.prompts'

/**
 * 输入文档接口
 */
export interface StandardDocument {
  id: string
  name: string
  content: string
}

/**
 * 聚类生成输入
 */
export interface ClusteringGenerationInput {
  documents: StandardDocument[]
  temperature?: number
  maxTokens?: number
}

/**
 * 条款接口（带文档溯源）
 */
export interface ClusterClause {
  source_document_id: string
  source_document_name: string
  clause_id: string
  clause_text: string
  rationale: string
}

/**
 * 聚类接口（第二层：具体的控制要求合并）
 */
export interface Cluster {
  id: string
  name: string
  description: string // 详细描述该聚类合并的条款要求（后续用于生成问卷、成熟度矩阵）
  clauses: ClusterClause[]
  importance: 'HIGH' | 'MEDIUM' | 'LOW'
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW'
}

/**
 * 大归类接口（第一层：领域/类别）
 * 例如："安全管理"、"技术控制"、"组织管理"
 */
export interface Category {
  id: string
  name: string
  description: string // 该领域的范围说明
  clusters: Cluster[] // 该领域下的所有聚类条目
}

/**
 * 文档覆盖率统计
 */
export interface DocumentCoverage {
  total_clauses: number
  clustered_clauses: number
  missing_clause_ids: string[]
}

/**
 * 覆盖率摘要
 */
export interface CoverageSummary {
  by_document: Record<string, DocumentCoverage>
  overall: {
    total_clauses: number
    clustered_clauses: number
    coverage_rate: number
  }
}

/**
 * 聚类生成输出（三层结构）
 */
export interface ClusteringGenerationOutput {
  categories: Category[] // 第一层：大归类
  clustering_logic: string
  coverage_summary: CoverageSummary
}

/**
 * 聚类生成器
 * 使用AI Orchestrator调用三模型生成跨文档聚类
 */
@Injectable()
export class ClusteringGenerator {
  private readonly logger = new Logger(ClusteringGenerator.name)

  constructor(private readonly aiOrchestrator: AIOrchestrator) {}

  /**
   * 生成跨文档聚类
   * @param input 生成输入
   * @returns 生成输出（三模型结果）
   */
  async generate(input: ClusteringGenerationInput): Promise<{
    gpt4: ClusteringGenerationOutput
    claude: ClusteringGenerationOutput
    domestic: ClusteringGenerationOutput
  }> {
    this.logger.log(
      `Starting clustering generation for ${input.documents.length} documents...`,
    )

    const { documents, temperature = 0.7, maxTokens = 8000 } = input

    // 验证输入
    if (!documents || documents.length === 0) {
      throw new Error('At least one document is required for clustering')
    }

    // 填充Prompt模板
    const prompt = fillClusteringPrompt(documents)

    // 构建AI请求
    const aiRequest: AIClientRequest = {
      prompt,
      temperature,
      maxTokens,
      responseFormat: { type: 'json_object' }, // 强制JSON输出
    }

    // 并行调用三模型生成
    const [gpt4Response, claudeResponse, domesticResponse] = await Promise.all([
      this.generateWithModel(aiRequest, AIModel.GPT4),
      this.generateWithModel(aiRequest, AIModel.CLAUDE),
      this.generateWithModel(aiRequest, AIModel.DOMESTIC),
    ])

    // 解析JSON结果 - 使用容错机制
    let gpt4Result: ClusteringGenerationOutput | null = null
    let claudeResult: ClusteringGenerationOutput | null = null
    let domesticResult: ClusteringGenerationOutput | null = null

    try {
      gpt4Result = this.parseJsonResponse(gpt4Response.content, documents)
    } catch (error) {
      this.logger.error(`Failed to parse GPT-4 response: ${error.message}`)
    }

    try {
      claudeResult = this.parseJsonResponse(claudeResponse.content, documents)
    } catch (error) {
      this.logger.error(`Failed to parse Claude response: ${error.message}`)
    }

    try {
      domesticResult = this.parseJsonResponse(domesticResponse.content, documents)
    } catch (error) {
      this.logger.error(`Failed to parse Domestic model response: ${error.message}`)
    }

    // 如果所有模型都失败，抛出错误
    if (!gpt4Result && !claudeResult && !domesticResult) {
      throw new Error('All three models failed to generate valid clustering results')
    }

    // 使用成功的结果填充失败的模型（优先使用Claude，然后GPT-4，最后Domestic）
    const fallbackResult = claudeResult || gpt4Result || domesticResult

    this.logger.log('Clustering generation completed for all three models')

    return {
      gpt4: gpt4Result || fallbackResult,
      claude: claudeResult || fallbackResult,
      domestic: domesticResult || fallbackResult,
    }
  }

  /**
   * 使用指定模型生成
   */
  private async generateWithModel(request: AIClientRequest, model: AIModel) {
    try {
      const response = await this.aiOrchestrator.generate(request, model)
      this.logger.debug(`Model ${model} generated clustering successfully`)
      return response
    } catch (error) {
      this.logger.error(`Model ${model} clustering generation failed: ${error.message}`)
      throw new Error(`${model} clustering generation failed: ${error.message}`)
    }
  }

  /**
   * 解析JSON响应
   */
  private parseJsonResponse(
    content: string,
    documents: StandardDocument[],
  ): ClusteringGenerationOutput {
    try {
      // 1. 移除markdown代码块标记（如果存在）
      let cleanedContent = content.trim()

      // 移除 ```json 和 ``` 标记
      if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent
          .replace(/^```(?:json)?\s*\n?/, '')
          .replace(/\n?```\s*$/, '')
      }

      // 1.5. 修复常见的JSON格式问题
      cleanedContent = this.sanitizeJsonString(cleanedContent)

      // 2. 尝试直接解析清理后的JSON
      let parsed = JSON.parse(cleanedContent)

      // 3. 修复过度转义的嵌套数组（某些AI模型会将clauses序列化成字符串）
      parsed = this.fixEscapedArrays(parsed)

      // 4. 验证必需字段
      this.validateClusteringOutput(parsed, documents)

      return parsed as ClusteringGenerationOutput
    } catch (error) {
      this.logger.error(`Failed to parse JSON response: ${error.message}`)

      // 记录更多调试信息
      this.logger.debug(`Content length: ${content.length} characters`)
      this.logger.debug(`Content preview (first 500 chars): ${content.substring(0, 500)}`)
      this.logger.debug(`Content preview (last 500 chars): ${content.substring(Math.max(0, content.length - 500))}`)

      // 5. 最后尝试：提取大括号之间的内容并修复
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          this.logger.log('Attempting to extract and repair JSON from braces match...')
          let extractedContent = jsonMatch[0]

          // 对提取的内容也应用清理
          extractedContent = this.sanitizeJsonString(extractedContent)

          let parsed = JSON.parse(extractedContent)
          parsed = this.fixEscapedArrays(parsed)
          this.validateClusteringOutput(parsed, documents)

          this.logger.log('Successfully parsed JSON after extraction and repair')
          return parsed as ClusteringGenerationOutput
        } catch (e) {
          this.logger.error(`Failed to extract and parse JSON: ${e.message}`)
          this.logger.debug(`Extracted content length: ${jsonMatch[0].length}`)
        }
      }

      throw new Error(
        `Invalid JSON response: ${error.message}. Content preview: ${content.substring(0, 200)}...`,
      )
    }
  }

  /**
   * 清理JSON字符串，修复常见格式问题
   * 使用字符扫描方式处理未转义的控制字符和未终止的字符串
   */
  private sanitizeJsonString(jsonStr: string): string {
    // 1. 移除BOM
    let input = jsonStr
    if (input.charCodeAt(0) === 0xfeff) {
      input = input.substring(1)
    }

    // 2. 移除尾部逗号
    input = input.replace(/,(\s*[}\]])/g, '$1')

    // 3. 逐字符扫描，修复字符串值中的控制字符
    const output = []
    let inString = false
    let escaped = false
    let stringStartPos = -1 // 记录字符串开始位置，用于检测未终止字符串

    for (let i = 0; i < input.length; i++) {
      const char = input[i]

      if (escaped) {
        // 前一个字符是反斜杠，当前字符已被转义
        output.push(char)
        escaped = false
        continue
      }

      if (char === '\\') {
        // 反斜杠：标记下一个字符被转义
        output.push(char)
        escaped = true
        continue
      }

      if (char === '"') {
        // 双引号：切换字符串内外状态
        output.push(char)
        if (!inString) {
          // 进入字符串
          stringStartPos = i
          inString = true
        } else {
          // 退出字符串
          stringStartPos = -1
          inString = false
        }
        continue
      }

      if (!inString) {
        // 在字符串外部，直接输出
        output.push(char)
        continue
      }

      // 在字符串内部，检查并转义控制字符
      // 同时检测可能导致字符串未终止的问题字符
      if (char === '\n') {
        output.push('\\', 'n')
      } else if (char === '\r') {
        output.push('\\', 'r')
      } else if (char === '\t') {
        output.push('\\', 't')
      } else if (char === '\b') {
        output.push('\\', 'b')
      } else if (char === '\f') {
        output.push('\\', 'f')
      } else {
        output.push(char)
      }
    }

    // 4. 检测未终止的字符串
    if (inString && stringStartPos !== -1) {
      this.logger.warn(
        `Detected unterminated string starting at position ${stringStartPos}. ` +
        `Adding closing quote. Context: ...${input.substring(Math.max(0, stringStartPos - 50), Math.min(input.length, stringStartPos + 100))}...`
      )
      // 添加缺失的结束引号
      output.push('"')
    }

    return output.join('')
  }

  /**
   * 修复过度转义的数组字段
   * 某些AI模型会将嵌套的数组序列化成字符串，需要递归反序列化
   */
  private fixEscapedArrays(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj
    }

    // 处理数组
    if (Array.isArray(obj)) {
      return obj.map((item) => this.fixEscapedArrays(item))
    }

    // 处理对象
    if (typeof obj === 'object') {
      const fixed: any = {}
      for (const key in obj) {
        const value = obj[key]

        // 如果值是字符串且看起来像JSON数组，尝试解析
        if (typeof value === 'string') {
          const trimmed = value.trim()
          if (
            (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
            (trimmed.startsWith('{') && trimmed.endsWith('}'))
          ) {
            try {
              fixed[key] = this.fixEscapedArrays(JSON.parse(value))
              this.logger.debug(`Fixed escaped ${key} field`)
            } catch (e) {
              // 不是有效JSON，保持原样
              fixed[key] = value
            }
          } else {
            fixed[key] = value
          }
        } else {
          // 递归处理嵌套对象/数组
          fixed[key] = this.fixEscapedArrays(value)
        }
      }
      return fixed
    }

    // 原始类型直接返回
    return obj
  }

  /**
   * 验证聚类输出的结构（三层结构）
   */
  private validateClusteringOutput(output: any, documents: StandardDocument[]): void {
    // 验证并填充缺失的顶层字段
    if (!output.categories) {
      throw new Error('Missing required field: categories (三层结构要求)')
    }

    // 如果缺少clustering_logic，使用默认值
    if (!output.clustering_logic) {
      this.logger.warn('Missing clustering_logic, using default value')
      output.clustering_logic = 'AI模型基于语义相似度和控制目标对条款进行三层智能分类和合并：第一层按安全领域划分大类，第二层在每个大类中合并相似要求，第三层保留原始条款溯源'
    }

    // 验证categories数组
    if (!Array.isArray(output.categories) || output.categories.length === 0) {
      throw new Error('categories must be a non-empty array')
    }

    // 过滤并修复每个大类和聚类的结构
    const validCategories = []
    let totalClusters = 0

    for (const category of output.categories) {
      // 检查必需字段
      if (!category.id || !category.name || !category.description) {
        this.logger.warn(`Skipping category with missing basic fields: ${JSON.stringify(category).substring(0, 100)}`)
        continue
      }

      // 检查clusters字段
      if (!Array.isArray(category.clusters)) {
        this.logger.warn(`Category ${category.id} has invalid clusters field, initializing as empty array`)
        category.clusters = []
      }

      // 过滤并验证每个聚类
      const validClusters = []

      for (const cluster of category.clusters) {
        // 检查必需字段
        if (!cluster.id || !cluster.name || !cluster.description) {
          this.logger.warn(`Skipping cluster with missing basic fields in category ${category.id}`)
          continue
        }

        // 检查clauses字段
        if (!Array.isArray(cluster.clauses)) {
          this.logger.warn(`Cluster ${cluster.id} has invalid clauses field, initializing as empty array`)
          cluster.clauses = []
        }

        // 过滤有效的条款
        const validClauses = cluster.clauses.filter((clause: any) => {
          if (
            !clause.source_document_id ||
            !clause.source_document_name ||
            !clause.clause_id ||
            !clause.clause_text ||
            !clause.rationale
          ) {
            this.logger.warn(`Skipping invalid clause in cluster ${cluster.id}`)
            return false
          }
          return true
        })

        cluster.clauses = validClauses

        // 只保留有有效条款的聚类
        if (validClauses.length > 0) {
          validClusters.push(cluster)
        } else {
          this.logger.warn(`Skipping cluster ${cluster.id} - no valid clauses`)
        }
      }

      // 更新category中的clusters为过滤后的有效clusters
      category.clusters = validClusters

      // 只保留有有效聚类的大类
      if (validClusters.length > 0) {
        validCategories.push(category)
        totalClusters += validClusters.length
      } else {
        this.logger.warn(`Skipping category ${category.id} - no valid clusters`)
      }
    }

    // 更新output中的categories为过滤后的有效categories
    output.categories = validCategories

    // 验证至少有一些有效的大类和聚类
    if (validCategories.length === 0) {
      throw new Error('No valid categories found in AI response')
    }

    // 记录聚类统计信息（不再限制数量）
    this.logger.log(
      `Validated ${validCategories.length} categories with ${totalClusters} total clusters`,
    )

    // 如果缺少coverage_summary，使用默认值
    if (!output.coverage_summary) {
      this.logger.warn('Missing coverage_summary, generating default coverage')
      output.coverage_summary = this.generateDefaultCoverage(output.categories, documents)
    }

    // 验证覆盖率摘要（此时已经填充了默认值，所以只需要验证结构）
    if (output.coverage_summary) {
      if (!output.coverage_summary.by_document || !output.coverage_summary.overall) {
        this.logger.warn('Invalid coverage_summary structure, regenerating')
        output.coverage_summary = this.generateDefaultCoverage(output.categories, documents)
      }

      // 验证每个文档的覆盖率统计
      for (const doc of documents) {
        if (!output.coverage_summary.by_document[doc.id]) {
          this.logger.warn(`Missing coverage summary for document: ${doc.id}`)
        }
      }
    }
  }

  /**
   * 生成默认覆盖率摘要（当AI未返回时）
   */
  private generateDefaultCoverage(
    categories: Category[],
    documents: StandardDocument[],
  ): CoverageSummary {
    const byDocument: Record<string, DocumentCoverage> = {}
    let totalClauses = 0
    let clusteredClauses = 0

    for (const doc of documents) {
      // 从三层结构中提取条款：categories → clusters → clauses
      const docClauses = categories
        .flatMap((category) => category.clusters || [])
        .flatMap((cluster) => cluster.clauses || [])
        .filter((clause: any) => clause.source_document_id === doc.id)

      byDocument[doc.id] = {
        total_clauses: docClauses.length,
        clustered_clauses: docClauses.length,
        missing_clause_ids: [],
      }

      totalClauses += docClauses.length
      clusteredClauses += docClauses.length
    }

    return {
      by_document: byDocument,
      overall: {
        total_clauses: totalClauses,
        clustered_clauses: clusteredClauses,
        coverage_rate: totalClauses > 0 ? clusteredClauses / totalClauses : 0,
      },
    }
  }

  /**
   * 生成聚类摘要（用于日志和预览）
   */
  generateSummary(output: ClusteringGenerationOutput): string {
    const { categories, coverage_summary } = output
    const totalClusters = categories.reduce((sum, cat) => sum + cat.clusters.length, 0)
    const categoryNames = categories.map((c) => c.name).join(', ')
    return `Generated ${categories.length} categories with ${totalClusters} total clusters: ${categoryNames}\nOverall coverage: ${(coverage_summary.overall.coverage_rate * 100).toFixed(1)}%`
  }
}
