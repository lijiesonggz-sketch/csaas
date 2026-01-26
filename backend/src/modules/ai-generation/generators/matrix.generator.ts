import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'
import { AIClientRequest } from '../../ai-clients/interfaces/ai-client.interface'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'
import { fillMatrixPrompt, fillSingleClusterMatrixPrompt } from '../prompts/matrix.prompts'
import { ClusteringGenerationOutput } from './clustering.generator'

/**
 * 成熟度级别接口
 */
export interface MaturityLevel {
  name: string // "初始级", "可重复级", "已定义级", "可管理级", "优化级"
  description: string // 该级别的详细描述（100-200字）
  key_practices: string[] // 关键实践列表（3-5个）
}

/**
 * 矩阵行接口（一个聚类对应一行）
 */
export interface MatrixRow {
  cluster_id: string
  cluster_name: string
  levels: {
    level_1: MaturityLevel
    level_2: MaturityLevel
    level_3: MaturityLevel
    level_4: MaturityLevel
    level_5: MaturityLevel
  }
}

/**
 * 成熟度矩阵生成输出
 */
export interface MatrixGenerationOutput {
  matrix: MatrixRow[] // 矩阵数据（N行 × 5列）
  maturity_model_description: string // 成熟度模型说明
}

/**
 * 成熟度矩阵生成输入
 */
export interface MatrixGenerationInput {
  clusteringResult: ClusteringGenerationOutput
  temperature?: number
  maxTokens?: number
}

/**
 * 成熟度矩阵生成器
 * 基于聚类结果生成5级成熟度矩阵
 */
@Injectable()
export class MatrixGenerator {
  private readonly logger = new Logger(MatrixGenerator.name)
  private readonly generationTimeout: number

  constructor(
    private readonly aiOrchestrator: AIOrchestrator,
    private readonly configService: ConfigService,
  ) {
    // 获取超时配置（默认10分钟）
    this.generationTimeout =
      this.configService.get<number>('MODEL_GENERATION_TIMEOUT') || 600000

    this.logger.log(
      `MatrixGenerator initialized with timeout: ${this.generationTimeout}ms (${(this.generationTimeout / 60000).toFixed(1)} minutes)`,
    )
  }

  /**
   * 生成成熟度矩阵（分批次优化）
   * @param input 生成输入
   * @returns 生成输出（三模型结果）
   */
  async generate(input: MatrixGenerationInput): Promise<{
    gpt4: MatrixGenerationOutput
    claude: MatrixGenerationOutput
    domestic: MatrixGenerationOutput
  }> {
    this.logger.log('Starting matrix generation with batch optimization...')

    const { clusteringResult, temperature = 0.7, maxTokens = 8000 } = input

    // 验证输入
    if (!clusteringResult || !clusteringResult.categories) {
      throw new Error('Valid clustering result is required for matrix generation')
    }

    // 提取所有聚类
    const allClusters = []
    for (const category of clusteringResult.categories) {
      if (category.clusters && Array.isArray(category.clusters)) {
        allClusters.push(...category.clusters)
      }
    }

    const totalClusters = allClusters.length
    this.logger.log(`Generating matrix for ${totalClusters} clusters (batch by batch)...`)

    // 初始化三个模型的结果数组
    const gpt4Rows: MatrixRow[] = []
    const claudeRows: MatrixRow[] = []
    const domesticRows: MatrixRow[] = []

    // 逐个聚类生成成熟度（分批次）
    for (let i = 0; i < allClusters.length; i++) {
      const cluster = allClusters[i]
      this.logger.log(`Processing cluster ${i + 1}/${totalClusters}: ${cluster.name}`)

      try {
        // 调用单聚类生成方法
        const singleResult = await this.generateSingleCluster(cluster, temperature, maxTokens)

        // 将结果添加到各模型的数组中
        gpt4Rows.push(singleResult.gpt4)
        claudeRows.push(singleResult.claude)
        domesticRows.push(singleResult.domestic)

        this.logger.log(`Completed cluster ${i + 1}/${totalClusters}`)
      } catch (error) {
        this.logger.error(
          `Failed to generate maturity for cluster ${cluster.name}: ${error.message}`,
        )
        // 跳过失败的聚类，继续处理下一个
      }
    }

    // 检查是否有成功的结果
    if (gpt4Rows.length === 0 && claudeRows.length === 0 && domesticRows.length === 0) {
      throw new Error('Failed to generate maturity for all clusters')
    }

    // 构建最终输出
    const maturityModelDescription =
      '本成熟度模型基于CMMI（能力成熟度模型集成）的5级成熟度理念，结合IT安全管理最佳实践设计。模型从初始级的临时性管理逐步提升至优化级的持续改进，帮助组织系统化提升IT安全管理能力。每个聚类的成熟度定义均基于原始标准文档条目的明确要求，确保可操作性和可验证性。'

    const gpt4Result: MatrixGenerationOutput = {
      matrix: gpt4Rows,
      maturity_model_description: maturityModelDescription,
    }

    const claudeResult: MatrixGenerationOutput = {
      matrix: claudeRows,
      maturity_model_description: maturityModelDescription,
    }

    const domesticResult: MatrixGenerationOutput = {
      matrix: domesticRows,
      maturity_model_description: maturityModelDescription,
    }

    this.logger.log(
      `Matrix generation completed: GPT-4(${gpt4Rows.length}), Claude(${claudeRows.length}), Domestic(${domesticRows.length})`,
    )

    return {
      gpt4: gpt4Result,
      claude: claudeResult,
      domestic: domesticResult,
    }
  }

  /**
   * 生成单个聚类的成熟度（分批次优化）
   * @param cluster 单个聚类（包含clauses原始条目）
   * @param temperature 温度参数
   * @param maxTokens 最大token数
   * @returns 单个聚类的成熟度行（三模型结果）
   */
  async generateSingleCluster(
    cluster: any,
    temperature = 0.7,
    maxTokens = 8000,
  ): Promise<{
    gpt4: MatrixRow
    claude: MatrixRow
    domestic: MatrixRow
  }> {
    this.logger.log(`Generating maturity levels for cluster: ${cluster.name}`)

    // 填充单聚类Prompt模板
    const prompt = fillSingleClusterMatrixPrompt(cluster)

    // 构建AI请求
    const aiRequest: AIClientRequest = {
      prompt,
      temperature,
      maxTokens,
      responseFormat: { type: 'json_object' },
    }

    // ⚠️ 临时禁用Claude模型，只使用GPT-4和Qwen（因为Claude API返回404）
    // 并行调用两模型生成，添加超时控制
    this.logger.log(`Starting parallel generation with ${this.generationTimeout}ms timeout...`)

    const results = await Promise.allSettled([
      this.addTimeout(
        this.generateWithModel(aiRequest, AIModel.GPT4),
        this.generationTimeout,
        'GPT-4',
      ),
      // ⚠️ Claude已禁用
      // this.addTimeout(
      //   this.generateWithModel(aiRequest, AIModel.CLAUDE),
      //   this.generationTimeout,
      //   'Claude',
      // ),
      this.addTimeout(
        this.generateWithModel(aiRequest, AIModel.DOMESTIC),
        this.generationTimeout,
        'Qwen',
      ),
    ])

    const gpt4Response = results[0].status === 'fulfilled' ? results[0].value : null
    const claudeResponse = null // ⚠️ 临时禁用Claude
    const domesticResponse = results[1].status === 'fulfilled' ? results[1].value : null // 注意索引变化

    // 统计成功数量
    const successfulCount = [gpt4Response, domesticResponse].filter((r) => r !== null).length
    this.logger.log(`Matrix cluster generation completed: ${successfulCount}/2 models successful (Claude disabled)`)

    // 解析JSON结果
    let gpt4Row: MatrixRow | null = null
    let claudeRow: MatrixRow | null = null
    let domesticRow: MatrixRow | null = null

    if (gpt4Response) {
      try {
        const parsed = this.parseSingleClusterResponse(gpt4Response.content, cluster)
        gpt4Row = parsed
      } catch (error) {
        this.logger.error(`Failed to parse GPT-4 single cluster response: ${error.message}`)
      }
    }

    // ⚠️ Claude已禁用，跳过解析
    // if (claudeResponse) {
    //   try {
    //     const parsed = this.parseSingleClusterResponse(claudeResponse.content, cluster)
    //     claudeRow = parsed
    //   } catch (error) {
    //     this.logger.error(`Failed to parse Claude single cluster response: ${error.message}`)
    //   }
    // }

    if (domesticResponse) {
      try {
        const parsed = this.parseSingleClusterResponse(domesticResponse.content, cluster)
        domesticRow = parsed
      } catch (error) {
        this.logger.error(`Failed to parse Domestic model single cluster response: ${error.message}`)
      }
    }

    // 如果所有模型都失败，抛出错误（只检查GPT-4和Qwen）
    if (!gpt4Row && !domesticRow) {
      throw new Error(`All available models failed to generate maturity for cluster: ${cluster.name}`)
    }

    // 使用成功的结果填充失败的模型（优先使用GPT-4，然后Qwen）
    const fallbackRow = gpt4Row || domesticRow

    return {
      gpt4: gpt4Row || fallbackRow,
      claude: claudeRow || fallbackRow, // 返回fallback以保持兼容性
      domestic: domesticRow || fallbackRow,
    }
  }

  /**
   * 解析单聚类响应
   */
  private parseSingleClusterResponse(content: string, cluster: any): MatrixRow {
    try {
      // 1. 移除markdown代码块标记
      let cleanedContent = content.trim()

      if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent
          .replace(/^```(?:json)?\s*\n?/, '')
          .replace(/\n?```\s*$/, '')
      }

      // 2. 修复常见的JSON格式问题
      cleanedContent = this.sanitizeJsonString(cleanedContent)

      // 3. 尝试直接解析
      let parsed = JSON.parse(cleanedContent)

      // 4. 修复过度转义的嵌套数组
      parsed = this.fixEscapedArrays(parsed)

      // 5. 验证单聚类行结构
      this.validateMatrixRow(parsed, cluster)

      return parsed as MatrixRow
    } catch (error) {
      this.logger.error(`Failed to parse single cluster JSON: ${error.message}`)

      // 最后尝试：提取大括号内容
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          let extractedContent = jsonMatch[0]
          extractedContent = this.sanitizeJsonString(extractedContent)
          let parsed = JSON.parse(extractedContent)
          parsed = this.fixEscapedArrays(parsed)
          this.validateMatrixRow(parsed, cluster)
          return parsed as MatrixRow
        } catch (e) {
          this.logger.error(`Failed to extract and parse: ${e.message}`)
        }
      }

      throw new Error(`Invalid single cluster JSON: ${error.message}`)
    }
  }

  /**
   * 验证单个矩阵行的结构
   */
  private validateMatrixRow(row: any, cluster: any): void {
    // 检查必需字段
    if (!row.cluster_id || !row.cluster_name || !row.levels) {
      throw new Error('Missing required fields: cluster_id, cluster_name, or levels')
    }

    // 检查5个级别的完整性
    const requiredLevels = ['level_1', 'level_2', 'level_3', 'level_4', 'level_5']
    for (const levelKey of requiredLevels) {
      if (!row.levels[levelKey]) {
        throw new Error(`Missing ${levelKey}`)
      }

      const level = row.levels[levelKey]

      // 验证级别的必需字段
      if (!level.name || !level.description || !Array.isArray(level.key_practices)) {
        throw new Error(`Invalid ${levelKey}: missing name, description, or key_practices`)
      }

      // 检查key_practices数量
      if (level.key_practices.length < 1) {
        this.logger.warn(`${levelKey} has no key_practices`)
      }
    }

    this.logger.log(`Validated single cluster row: ${row.cluster_name}`)
  }

  /**
   * 使用指定模型生成
   */
  private async generateWithModel(request: AIClientRequest, model: AIModel) {
    try {
      const response = await this.aiOrchestrator.generate(request, model)
      this.logger.debug(`Model ${model} generated matrix successfully`)
      return response
    } catch (error) {
      this.logger.error(`Model ${model} matrix generation failed: ${error.message}`)
      throw new Error(`${model} matrix generation failed: ${error.message}`)
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
            `${modelName} matrix generation timeout after ${(timeoutMs / 1000).toFixed(1)}s`,
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
    expectedClusters: number,
  ): MatrixGenerationOutput {
    try {
      // 1. 移除markdown代码块标记（如果存在）
      let cleanedContent = content.trim()

      // 移除 ```json 和 ``` 标记
      if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent
          .replace(/^```(?:json)?\s*\n?/, '')
          .replace(/\n?```\s*$/, '')
      }

      // 2. 修复常见的JSON格式问题
      cleanedContent = this.sanitizeJsonString(cleanedContent)

      // 3. 尝试直接解析清理后的JSON
      let parsed = JSON.parse(cleanedContent)

      // 4. 修复过度转义的嵌套数组
      parsed = this.fixEscapedArrays(parsed)

      // 5. 验证必需字段
      this.validateMatrixOutput(parsed, expectedClusters)

      return parsed as MatrixGenerationOutput
    } catch (error) {
      this.logger.error(`Failed to parse JSON response: ${error.message}`)

      // 记录更多调试信息
      this.logger.debug(`Content length: ${content.length} characters`)
      this.logger.debug(`Content preview (first 500 chars): ${content.substring(0, 500)}`)
      this.logger.debug(
        `Content preview (last 500 chars): ${content.substring(Math.max(0, content.length - 500))}`,
      )

      // 6. 最后尝试：提取大括号之间的内容并修复
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          this.logger.log('Attempting to extract and repair JSON from braces match...')
          let extractedContent = jsonMatch[0]

          extractedContent = this.sanitizeJsonString(extractedContent)

          let parsed = JSON.parse(extractedContent)
          parsed = this.fixEscapedArrays(parsed)
          this.validateMatrixOutput(parsed, expectedClusters)

          this.logger.log('Successfully parsed JSON after extraction and repair')
          return parsed as MatrixGenerationOutput
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
   * 清理JSON字符串，修复常见格式问题
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
    let stringStartPos = -1

    for (let i = 0; i < input.length; i++) {
      const char = input[i]

      if (escaped) {
        output.push(char)
        escaped = false
        continue
      }

      if (char === '\\') {
        output.push(char)
        escaped = true
        continue
      }

      if (char === '"') {
        output.push(char)
        if (!inString) {
          stringStartPos = i
          inString = true
        } else {
          stringStartPos = -1
          inString = false
        }
        continue
      }

      if (!inString) {
        output.push(char)
        continue
      }

      // 在字符串内部，检查并转义控制字符
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
        `Detected unterminated string starting at position ${stringStartPos}. Adding closing quote.`,
      )
      output.push('"')
    }

    return output.join('')
  }

  /**
   * 修复过度转义的数组字段
   */
  private fixEscapedArrays(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.fixEscapedArrays(item))
    }

    if (typeof obj === 'object') {
      const fixed: any = {}
      for (const key in obj) {
        const value = obj[key]

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
              fixed[key] = value
            }
          } else {
            fixed[key] = value
          }
        } else {
          fixed[key] = this.fixEscapedArrays(value)
        }
      }
      return fixed
    }

    return obj
  }

  /**
   * 验证矩阵输出的结构
   */
  private validateMatrixOutput(output: any, expectedClusters: number): void {
    // 验证顶层字段
    if (!output.matrix) {
      throw new Error('Missing required field: matrix')
    }

    if (!output.maturity_model_description) {
      this.logger.warn('Missing maturity_model_description, using default value')
      output.maturity_model_description =
        '本成熟度模型基于CMMI的5级成熟度理念设计，帮助组织系统化提升IT安全管理能力。'
    }

    // 验证matrix数组
    if (!Array.isArray(output.matrix) || output.matrix.length === 0) {
      throw new Error('matrix must be a non-empty array')
    }

    // 验证每一行
    const validRows = []

    for (const row of output.matrix) {
      // 检查必需字段
      if (!row.cluster_id || !row.cluster_name || !row.levels) {
        this.logger.warn(
          `Skipping row with missing basic fields: ${JSON.stringify(row).substring(0, 100)}`,
        )
        continue
      }

      // 检查5个级别的完整性
      const requiredLevels = ['level_1', 'level_2', 'level_3', 'level_4', 'level_5']
      let hasAllLevels = true

      for (const levelKey of requiredLevels) {
        if (!row.levels[levelKey]) {
          this.logger.warn(`Row ${row.cluster_id} missing ${levelKey}`)
          hasAllLevels = false
          break
        }

        const level = row.levels[levelKey]

        // 验证级别的必需字段
        if (!level.name || !level.description || !Array.isArray(level.key_practices)) {
          this.logger.warn(
            `Row ${row.cluster_id} has invalid ${levelKey}: ${JSON.stringify(level).substring(0, 100)}`,
          )
          hasAllLevels = false
          break
        }

        // 检查key_practices数量
        if (level.key_practices.length < 1) {
          this.logger.warn(`Row ${row.cluster_id} ${levelKey} has no key_practices`)
          hasAllLevels = false
          break
        }
      }

      if (hasAllLevels) {
        validRows.push(row)
      }
    }

    // 更新output中的matrix为过滤后的有效rows
    output.matrix = validRows

    // 验证至少有一些有效的行
    if (validRows.length === 0) {
      throw new Error('No valid matrix rows found in AI response')
    }

    this.logger.log(
      `Validated ${validRows.length} matrix rows (expected ${expectedClusters} clusters)`,
    )

    // 如果行数明显少于预期，发出警告
    if (validRows.length < expectedClusters * 0.8) {
      this.logger.warn(
        `Matrix coverage is low: ${validRows.length}/${expectedClusters} (${((validRows.length / expectedClusters) * 100).toFixed(1)}%)`,
      )
    }
  }

  /**
   * 生成矩阵摘要（用于日志和预览）
   */
  generateSummary(output: MatrixGenerationOutput): string {
    const { matrix } = output
    const totalRows = matrix.length
    const sampleNames = matrix.slice(0, 3).map((r) => r.cluster_name)
    return `Generated ${totalRows} matrix rows (5 levels each). Sample clusters: ${sampleNames.join(', ')}${totalRows > 3 ? '...' : ''}`
  }
}
