import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'
import { AIClientRequest, AIClientResponse } from '../../ai-clients/interfaces/ai-client.interface'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'
import { AIGenerationEvent } from '../../../database/entities/ai-generation-event.entity'
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
  private readonly generationTimeout: number

  constructor(
    private readonly aiOrchestrator: AIOrchestrator,
    private readonly configService: ConfigService,
    @InjectRepository(AIGenerationEvent)
    private readonly eventRepo: Repository<AIGenerationEvent>,
  ) {
    // 获取超时配置（默认15分钟）
    this.generationTimeout =
      this.configService.get<number>('MODEL_GENERATION_TIMEOUT') || 900000

    this.logger.log(
      `ClusteringGenerator initialized with timeout: ${this.generationTimeout}ms (${(this.generationTimeout / 60000).toFixed(1)} minutes)`,
    )
  }

  /**
   * 生成跨文档聚类
   * @param input 生成输入
   * @param taskId 任务ID（用于记录AI生成事件）
   * @param onProgress 进度回调函数（可选）
   * @returns 生成输出（三模型结果）
   */
  async generate(
    input: ClusteringGenerationInput,
    taskId?: string,
    onProgress?: (progress: {
      stage: string
      model?: string
      status: string
      details?: any
    }) => void,
  ): Promise<{
    gpt4: ClusteringGenerationOutput
    claude: ClusteringGenerationOutput
    domestic: ClusteringGenerationOutput
  }> {
    this.logger.log(
      `Starting clustering generation for ${input.documents.length} documents...`,
    )

    // 通知开始模型生成
    if (onProgress) {
      onProgress({
        stage: 'generating_models',
        status: 'starting',
        details: { message: '开始并行调用三个AI模型' },
      })
    }

    const { documents, temperature = 0.7, maxTokens = 32768 } = input

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

    // ⭐ 方案3：混合策略 - Promise.allSettled + 超时 + 动态质量验证
    this.logger.log(
      `Starting parallel generation with ${this.generationTimeout}ms timeout...`,
    )

    const generationStartTime = Date.now()
    const modelProgress = {
      gpt4: { status: 'pending' as const, started_at: new Date().toISOString() },
      // claude: { status: 'pending' as const, started_at: new Date().toISOString() }, // 暂时禁用Claude
      domestic: { status: 'pending' as const, started_at: new Date().toISOString() },
    }

    // ⚠️ 临时禁用Claude模型，只使用GPT-4和Qwen（因为Claude API返回404）
    // 并行调用两模型生成，添加超时控制
    const results = await Promise.allSettled([
      this.addTimeout(
        this.generateWithModel(aiRequest, AIModel.GPT4, taskId, onProgress, modelProgress),
        this.generationTimeout,
        'GPT-4',
      ),
      // this.addTimeout(
      //   this.generateWithModel(aiRequest, AIModel.CLAUDE, taskId, onProgress, modelProgress),
      //   this.generationTimeout,
      //   'Claude',
      // ),
      this.addTimeout(
        this.generateWithModel(aiRequest, AIModel.DOMESTIC, taskId, onProgress, modelProgress),
        this.generationTimeout,
        'Qwen',
      ),
    ])

    const generationElapsed = Date.now() - generationStartTime

    const gpt4Response = results[0].status === 'fulfilled' ? results[0].value : null
    // const claudeResponse = results[1].status === 'fulfilled' ? results[1].value : null // 禁用Claude
    const claudeResponse = null // ⚠️ 临时禁用
    const domesticResponse = results[1].status === 'fulfilled' ? results[1].value : null // 注意索引变化

    // 统计成功数量
    const successfulCount = [gpt4Response, domesticResponse].filter(
      (r) => r !== null,
    ).length

    this.logger.log(
      `Generation completed in ${(generationElapsed / 1000).toFixed(1)}s. Successful models: ${successfulCount}/2 (Claude disabled)`,
    )

    // 记录失败的模型
    if (!gpt4Response) {
      this.logger.warn(
        `GPT-4 model generation failed: ${results[0].status === 'rejected' ? results[0].reason : 'unknown error'}`,
      )
    }
    // ⚠️ Claude已禁用，跳过检查
    // if (!claudeResponse) {
    //   this.logger.warn(
    //     `Claude model generation failed: ${results[1].status === 'rejected' ? results[1].reason : 'unknown error'}`,
    //   )
    // }
    if (!domesticResponse) {
      this.logger.warn(
        `Domestic (Qwen) model generation failed: ${results[1].status === 'rejected' ? results[1].reason : 'unknown error'}`,
      )
    }

    // 解析JSON结果 - 使用容错机制
    let gpt4Result: ClusteringGenerationOutput | null = null
    let claudeResult: ClusteringGenerationOutput | null = null // ⚠️ 临时禁用
    let domesticResult: ClusteringGenerationOutput | null = null

    try {
      gpt4Result = this.parseJsonResponse(gpt4Response.content, documents)
    } catch (error) {
      this.logger.error(`Failed to parse GPT-4 response: ${error.message}`)
    }

    // ⚠️ Claude已禁用，跳过解析
    // try {
    //   claudeResult = this.parseJsonResponse(claudeResponse.content, documents)
    // } catch (error) {
    //   this.logger.error(`Failed to parse Claude response: ${error.message}`)
    // }

    try {
      domesticResult = this.parseJsonResponse(domesticResponse.content, documents)
    } catch (error) {
      this.logger.error(`Failed to parse Qwen response: ${error.message}`)
    }

    // 如果所有模型都失败，抛出错误（只检查GPT-4和Qwen）
    if (!gpt4Result && !domesticResult) {
      throw new Error('All available models failed to generate valid clustering results')
    }

    // 使用成功的结果填充失败的模型（优先使用GPT-4，然后Qwen）
    const fallbackResult = gpt4Result || domesticResult

    this.logger.log('Clustering generation completed for available models (GPT-4 + Qwen, Claude disabled)')

    return {
      gpt4: gpt4Result || fallbackResult,
      claude: claudeResult || fallbackResult, // 返回fallback以保持兼容性
      domestic: domesticResult || fallbackResult,
    }
  }

  /**
   * 使用指定模型生成
   * @returns 成功时返回response，失败时返回null（而不是抛出错误）
   */
  private async generateWithModel(
    request: AIClientRequest,
    model: AIModel,
    taskId: string | undefined,
    onProgress?: (progress: {
      stage: string
      model?: string
      status: string
      details?: any
    }) => void,
    modelProgress?: any,
  ): Promise<AIClientResponse | null> {
    let event: AIGenerationEvent | null = null

    try {
      // 创建AI生成事件记录
      if (taskId) {
        event = this.eventRepo.create({
          taskId,
          model,
          input: request,
        })
        await this.eventRepo.save(event)
        this.logger.log(`📝 [ClusteringGenerator] 创建AI生成事件: ${event.id} for model ${model}`)
      }

      // 更新模型状态为generating
      if (modelProgress && modelProgress[model]) {
        modelProgress[model].status = 'generating'
        if (onProgress) {
          onProgress({
            stage: 'generating_models',
            model,
            status: 'generating',
            details: modelProgress,
          })
        }
      }

      const startTime = Date.now()
      this.logger.log(`🚀 [ClusteringGenerator] 开始调用模型: ${model}`)
      const response = await this.aiOrchestrator.generate(request, model)
      const elapsed = Date.now() - startTime

      this.logger.log(`✅ [ClusteringGenerator] 模型 ${model} 生成成功 - 耗时: ${elapsed}ms, Tokens: ${response.tokens?.total || 0}, Cost: ¥${response.cost?.toFixed(4) || 0}`)

      // 更新AI生成事件
      if (event) {
        await this.eventRepo.update(event.id, {
          output: response as any, // 转换为any以绕过类型检查
          executionTimeMs: elapsed,
        })
        this.logger.log(`📝 [ClusteringGenerator] 更新AI生成事件: ${event.id}`)
      }

      // 更新模型状态为completed
      if (modelProgress && modelProgress[model]) {
        modelProgress[model].status = 'completed'
        modelProgress[model].completed_at = new Date().toISOString()
        modelProgress[model].duration_ms = elapsed
        modelProgress[model].tokens = response.tokens?.total
        modelProgress[model].cost = response.cost

        if (onProgress) {
          onProgress({
            stage: 'generating_models',
            model,
            status: 'completed',
            details: modelProgress,
          })
        }
      }

      return response
    } catch (error) {
      // 更新AI生成事件记录错误
      if (event) {
        await this.eventRepo.update(event.id, {
          errorMessage: error.message,
        })
        this.logger.log(`📝 [ClusteringGenerator] 更新AI生成事件错误: ${event.id} - ${error.message}`)
      }

      // 更新模型状态为failed
      if (modelProgress && modelProgress[model]) {
        modelProgress[model].status = 'failed'
        modelProgress[model].error = error.message
        modelProgress[model].completed_at = new Date().toISOString()

        if (onProgress) {
          onProgress({
            stage: 'generating_models',
            model,
            status: 'failed',
            details: modelProgress,
          })
        }
      }

      // ✅ 修复：不再抛出错误，而是记录日志并返回null
      // 这样Promise.allSettled可以捕获到结果，降级机制才能正常工作
      this.logger.warn(`Model ${model} clustering generation failed: ${error.message}`)
      return null
    }
  }

  /**
   * 为Promise添加超时控制
   * @param promise 要包装的Promise
   * @param timeoutMs 超时时间（毫秒）
   * @param modelName 模型名称（用于日志）
   * @returns 带超时的Promise
   */
  private async addTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    modelName: string,
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `${modelName} generation timeout after ${(timeoutMs / 1000).toFixed(1)}s`,
          ),
        )
      }, timeoutMs)
    })

    return Promise.race([promise, timeoutPromise])
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

    // ✅ 总是重新计算coverage_summary，确保准确性（AI返回的可能不准确）
    this.logger.debug('Recalculating coverage_summary to ensure accuracy')
    output.coverage_summary = this.generateDefaultCoverage(output.categories, documents)

    // ✅ 验证覆盖率：如果任何文档覆盖率<95%，记录错误（但不拒绝，允许人工审核）
    const coverageIssues: string[] = []
    for (const doc of documents) {
      const docCoverage = output.coverage_summary.by_document[doc.id]
      if (docCoverage) {
        const rate = docCoverage.total_clauses > 0
          ? docCoverage.clustered_clauses / docCoverage.total_clauses
          : 0
        if (rate < 0.95) {
          const missing = docCoverage.missing_clause_ids?.slice(0, 5).join(', ') || ''
          coverageIssues.push(
            `${doc.name}: ${(rate * 100).toFixed(1)}% (${docCoverage.clustered_clauses}/${docCoverage.total_clauses}), 缺失: ${missing}${docCoverage.missing_clause_ids?.length > 5 ? '...' : ''}`,
          )
        }
      }
    }

    if (coverageIssues.length > 0) {
      this.logger.error(
        `⚠️ 聚类结果覆盖率不足95%:\n  - ${coverageIssues.join('\n  - ')}\n建议: 1) 重新生成 2) 人工审核补充缺失条款`,
      )
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

      // ✅ 修复：统计文档中实际的条款数（通过"第XX条"匹配，并去重）
      const allClauseMatches = doc.content.match(/第[一二三四五六七八九十百千]+条/g) || []
      const allClauseIds = [...new Set(allClauseMatches)] // 去重
      const actualClauseCount = allClauseIds.length // ✅ 修复：使用去重后的数量

      // ✅ 修复：去重统计唯一clause_id（同一条款可能在多个聚类）
      const uniqueClauseIds = new Set<string>()
      const clauseIdMap = new Map<string, any>() // clause_id → clause

      docClauses.forEach((clause: any) => {
        uniqueClauseIds.add(clause.clause_id)
        clauseIdMap.set(clause.clause_id, clause)
      })

      const uniqueClusteredCount = uniqueClauseIds.size

      // ✅ 找出缺失的clause_id
      const missingClauseIds = allClauseIds.filter(id => !uniqueClauseIds.has(id))

      byDocument[doc.id] = {
        total_clauses: actualClauseCount, // ✅ 修复：文档实际唯一条款数（去重）
        clustered_clauses: uniqueClusteredCount, // ✅ 唯一提取的条款数（去重）
        missing_clause_ids: missingClauseIds, // ✅ 缺失的条款ID
      }

      totalClauses += actualClauseCount
      clusteredClauses += uniqueClusteredCount

      // ⚠️ 如果覆盖率过低，记录警告
      const coverageRate = actualClauseCount > 0 ? uniqueClusteredCount / actualClauseCount : 0
      if (coverageRate < 0.95) { // ✅ 阈值提高到95%
        this.logger.warn(
          `⚠️ 文档 "${doc.name}" 覆盖率不足: ${(coverageRate * 100).toFixed(1)}% (${uniqueClusteredCount}/${actualClauseCount} 条款被提取)`,
        )
        if (missingClauseIds.length > 0 && missingClauseIds.length <= 10) {
          this.logger.warn(
            `   缺失条款: ${missingClauseIds.join(', ')}`,
          )
        }
      }
    }

    const overallCoverageRate = totalClauses > 0 ? clusteredClauses / totalClauses : 0

    // ⚠️ 整体覆盖率警告
    if (overallCoverageRate < 0.9) {
      this.logger.warn(
        `⚠️ 整体覆盖率过低: ${(overallCoverageRate * 100).toFixed(1)}% (${clusteredClauses}/${totalClauses} 条款被提取)`,
      )
    }

    return {
      by_document: byDocument,
      overall: {
        total_clauses: totalClauses,
        clustered_clauses: clusteredClauses,
        coverage_rate: overallCoverageRate,
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
