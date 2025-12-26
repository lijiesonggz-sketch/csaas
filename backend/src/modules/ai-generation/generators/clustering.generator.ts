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
      const parsed = JSON.parse(cleanedContent)

      // 3. 验证必需字段
      this.validateClusteringOutput(parsed, documents)

      return parsed as ClusteringGenerationOutput
    } catch (error) {
      this.logger.error(`Failed to parse JSON response: ${error.message}`)

      // 4. 最后尝试：提取大括号之间的内容
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
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
   * 验证聚类输出的结构
   */
  private validateClusteringOutput(output: any, documents: StandardDocument[]): void {
    // 验证顶层字段
    const requiredFields = ['clusters', 'clustering_logic', 'coverage_summary']

    for (const field of requiredFields) {
      if (!(field in output)) {
        throw new Error(`Missing required field: ${field}`)
      }
    }

    // 验证clusters数组
    if (!Array.isArray(output.clusters) || output.clusters.length === 0) {
      throw new Error('clusters must be a non-empty array')
    }

    // 验证聚类数量（12-15个）
    if (output.clusters.length < 12 || output.clusters.length > 15) {
      this.logger.warn(
        `Clustering count ${output.clusters.length} is outside recommended range (12-15)`,
      )
    }

    // 验证每个聚类的结构
    for (const cluster of output.clusters) {
      if (!cluster.id || !cluster.name || !cluster.description || !Array.isArray(cluster.clauses)) {
        throw new Error('Each cluster must have id, name, description, and clauses array')
      }

      // 验证每个条款的结构
      for (const clause of cluster.clauses) {
        if (
          !clause.source_document_id ||
          !clause.source_document_name ||
          !clause.clause_id ||
          !clause.clause_text ||
          !clause.rationale
        ) {
          throw new Error(
            'Each clause must have source_document_id, source_document_name, clause_id, clause_text, and rationale',
          )
        }
      }
    }

    // 验证覆盖率摘要
    if (!output.coverage_summary.by_document || !output.coverage_summary.overall) {
      throw new Error('coverage_summary must have by_document and overall fields')
    }

    // 验证每个文档的覆盖率统计
    for (const doc of documents) {
      if (!output.coverage_summary.by_document[doc.id]) {
        this.logger.warn(`Missing coverage summary for document: ${doc.id}`)
      }
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
