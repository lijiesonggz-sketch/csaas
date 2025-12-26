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
 * 聚类接口
 */
export interface Cluster {
  id: string
  name: string
  description: string
  clauses: ClusterClause[]
  importance: 'HIGH' | 'MEDIUM' | 'LOW'
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW'
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
 * 聚类生成输出
 */
export interface ClusteringGenerationOutput {
  clusters: Cluster[]
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

    // 解析JSON结果
    const gpt4Result = this.parseJsonResponse(gpt4Response.content, documents)
    const claudeResult = this.parseJsonResponse(claudeResponse.content, documents)
    const domesticResult = this.parseJsonResponse(domesticResponse.content, documents)

    this.logger.log('Clustering generation completed for all three models')

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

      // 2. 尝试直接解析清理后的JSON
      let parsed = JSON.parse(cleanedContent)

      // 3. 修复过度转义的嵌套数组（某些AI模型会将clauses序列化成字符串）
      parsed = this.fixEscapedArrays(parsed)

      // 4. 验证必需字段
      this.validateClusteringOutput(parsed, documents)

      return parsed as ClusteringGenerationOutput
    } catch (error) {
      this.logger.error(`Failed to parse JSON response: ${error.message}`)

      // 5. 最后尝试：提取大括号之间的内容
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          let parsed = JSON.parse(jsonMatch[0])
          parsed = this.fixEscapedArrays(parsed)
          this.validateClusteringOutput(parsed, documents)
          return parsed as ClusteringGenerationOutput
        } catch (e) {
          this.logger.error(`Failed to extract and parse JSON: ${e.message}`)
        }
      }

      throw new Error(
        `Invalid JSON response: ${error.message}. Content preview: ${content.substring(0, 200)}...`,
      )
    }
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
   * 验证聚类输出的结构
   */
  private validateClusteringOutput(output: any, documents: StandardDocument[]): void {
    // 验证并填充缺失的顶层字段
    if (!output.clusters) {
      throw new Error('Missing required field: clusters')
    }

    // 如果缺少clustering_logic，使用默认值
    if (!output.clustering_logic) {
      this.logger.warn('Missing clustering_logic, using default value')
      output.clustering_logic = 'AI模型基于语义相似度和控制目标对条款进行智能分类和合并'
    }

    // 如果缺少coverage_summary，使用默认值
    if (!output.coverage_summary) {
      this.logger.warn('Missing coverage_summary, generating default coverage')
      output.coverage_summary = this.generateDefaultCoverage(output.clusters, documents)
    }

    // 验证clusters数组
    if (!Array.isArray(output.clusters) || output.clusters.length === 0) {
      throw new Error('clusters must be a non-empty array')
    }

    // 过滤并修复每个聚类的结构（而不是抛出错误）
    const validClusters = []

    for (const cluster of output.clusters) {
      // 检查必需字段
      if (!cluster.id || !cluster.name || !cluster.description) {
        this.logger.warn(`Skipping cluster with missing basic fields: ${JSON.stringify(cluster).substring(0, 100)}`)
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

    // 更新output中的clusters为过滤后的有效clusters
    output.clusters = validClusters

    // 验证至少有一些有效的聚类
    if (validClusters.length === 0) {
      throw new Error('No valid clusters found in AI response')
    }

    // 验证聚类数量（12-15个为推荐，但不强制）
    if (validClusters.length < 12 || validClusters.length > 15) {
      this.logger.warn(
        `Clustering count ${validClusters.length} is outside recommended range (12-15)`,
      )
    }

    // 验证覆盖率摘要（此时已经填充了默认值，所以只需要验证结构）
    if (output.coverage_summary) {
      if (!output.coverage_summary.by_document || !output.coverage_summary.overall) {
        this.logger.warn('Invalid coverage_summary structure, regenerating')
        output.coverage_summary = this.generateDefaultCoverage(output.clusters, documents)
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
    clusters: any[],
    documents: StandardDocument[],
  ): CoverageSummary {
    const byDocument: Record<string, DocumentCoverage> = {}
    let totalClauses = 0
    let clusteredClauses = 0

    for (const doc of documents) {
      const docClauses = clusters
        .flatMap((c) => c.clauses || [])
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
    const { clusters, coverage_summary } = output
    const clusterNames = clusters.map((c) => c.name).join(', ')
    return `Generated ${clusters.length} clusters: ${clusterNames}\nOverall coverage: ${(coverage_summary.overall.coverage_rate * 100).toFixed(1)}%`
  }
}
