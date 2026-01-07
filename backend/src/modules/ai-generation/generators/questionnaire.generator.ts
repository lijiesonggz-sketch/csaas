import { Injectable, Logger } from '@nestjs/common'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'
import { AIClientRequest } from '../../ai-clients/interfaces/ai-client.interface'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'
import {
  fillQuestionnairePrompt,
  fillSingleClusterQuestionnairePrompt,
} from '../prompts/questionnaire.prompts'
import { MatrixGenerationOutput } from './matrix.generator'

/**
 * 问卷选项接口
 */
export interface QuestionOption {
  option_id: string // "A", "B", "C", "D", "E" 等
  text: string // 选项文本
  score: number // 选项得分（1-5）
  level?: string // 对应的成熟度级别（单选题）："level_1"到"level_5"
  description?: string // 选项描述（说明对应的成熟度特征）
}

/**
 * 问卷题目接口
 */
export interface Question {
  question_id: string // "Q001", "Q002", ...
  cluster_id: string // 对应的聚类ID
  cluster_name: string // 聚类名称
  dimension?: string // 题目维度（用于交叉验证）："政策与制度层面"、"执行与实施层面"等
  question_text: string // 题目文本
  question_type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'RATING' // 题目类型
  options: QuestionOption[] // 选项列表
  required: boolean // 是否必答
  guidance: string // 填写引导
}

/**
 * 问卷元数据接口
 */
export interface QuestionnaireMetadata {
  total_questions: number // 总题数
  estimated_time_minutes: number // 预估填写时间（分钟）
  coverage_map: Record<string, number> // 每个聚类的题目数量
}

/**
 * 问卷生成输出
 */
export interface QuestionnaireGenerationOutput {
  questionnaire: Question[] // 问卷题目列表
  questionnaire_metadata: QuestionnaireMetadata // 问卷元数据
}

/**
 * 问卷生成输入
 */
export interface QuestionnaireGenerationInput {
  matrixResult: MatrixGenerationOutput
  temperature?: number
  maxTokens?: number
}

/**
 * 问卷生成器
 * 基于成熟度矩阵生成调研问卷
 */
@Injectable()
export class QuestionnaireGenerator {
  private readonly logger = new Logger(QuestionnaireGenerator.name)

  constructor(private readonly aiOrchestrator: AIOrchestrator) {}

  /**
   * 生成调研问卷（分批次优化）
   * @param input 生成输入
   * @param progressCallback 进度回调函数（可选）
   * @returns 生成输出（三模型结果）
   */
  async generate(
    input: QuestionnaireGenerationInput,
    progressCallback?: (progress: {
      current: number
      total: number
      message: string
      model?: string
      currentClusterId?: string // ✅ 添加聚类ID
    }) => void,
  ): Promise<{
    gpt4: QuestionnaireGenerationOutput
    claude: QuestionnaireGenerationOutput
    domestic: QuestionnaireGenerationOutput
  }> {
    this.logger.log('Starting questionnaire generation with batch optimization...')

    const { matrixResult, temperature = 0.7, maxTokens = 8000 } = input

    // 验证输入
    if (!matrixResult || !matrixResult.matrix) {
      throw new Error('Valid matrix result is required for questionnaire generation')
    }

    const totalClusters = matrixResult.matrix.length

    this.logger.log(
      `Generating questionnaire for ${totalClusters} clusters (5 questions per cluster, batch by batch)...`,
    )

    // 发送初始进度
    if (progressCallback) {
      progressCallback({
        current: 0,
        total: totalClusters,
        message: `开始生成问卷，共${totalClusters}个聚类`,
      })
    }

    // 初始化三个模型的题目数组
    const gpt4Questions: Question[] = []
    const claudeQuestions: Question[] = []
    const domesticQuestions: Question[] = []

    let questionCounter = 1 // 全局question_id计数器

    // 逐个聚类生成问卷（分批次）
    for (let i = 0; i < matrixResult.matrix.length; i++) {
      const cluster = matrixResult.matrix[i]
      this.logger.log(`Processing cluster ${i + 1}/${totalClusters}: ${cluster.cluster_name}`)

      // 发送进度更新
      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total: totalClusters,
          currentClusterId: cluster.cluster_id, // ✅ 添加聚类ID
          message: `正在生成第 ${i + 1}/${totalClusters} 个聚类的问卷: ${cluster.cluster_name}`,
        })
      }

      try {
        // 调用单聚类生成方法（固定生成5题）
        const singleResult = await this.generateSingleCluster(
          cluster,
          i,
          questionCounter,
          temperature,
          maxTokens,
        )

        // 将结果添加到各模型的数组中
        gpt4Questions.push(...singleResult.gpt4)
        claudeQuestions.push(...singleResult.claude)
        domesticQuestions.push(...singleResult.domestic)

        // 更新question_id计数器（每个聚类5题）
        questionCounter += 5

        this.logger.log(`Completed cluster ${i + 1}/${totalClusters}, generated 5 questions`)
      } catch (error) {
        this.logger.error(
          `Failed to generate questions for cluster ${cluster.cluster_name}: ${error.message}`,
        )
        // 跳过失败的聚类，继续处理下一个
      }
    }

    // 发送完成进度
    if (progressCallback) {
      progressCallback({
        current: totalClusters,
        total: totalClusters,
        message: '所有聚类问卷生成完成，正在聚合结果...',
      })
    }

    // 检查是否有成功的结果
    if (gpt4Questions.length === 0 && claudeQuestions.length === 0 && domesticQuestions.length === 0) {
      throw new Error('Failed to generate questions for all clusters')
    }

    // 生成元数据
    const gpt4Metadata = this.generateMetadata(gpt4Questions)
    const claudeMetadata = this.generateMetadata(claudeQuestions)
    const domesticMetadata = this.generateMetadata(domesticQuestions)

    // 构建最终输出
    const gpt4Result: QuestionnaireGenerationOutput = {
      questionnaire: gpt4Questions,
      questionnaire_metadata: gpt4Metadata,
    }

    const claudeResult: QuestionnaireGenerationOutput = {
      questionnaire: claudeQuestions,
      questionnaire_metadata: claudeMetadata,
    }

    const domesticResult: QuestionnaireGenerationOutput = {
      questionnaire: domesticQuestions,
      questionnaire_metadata: domesticMetadata,
    }

    this.logger.log(
      `Questionnaire generation completed: GPT-4(${gpt4Questions.length}), Claude(${claudeQuestions.length}), Domestic(${domesticQuestions.length})`,
    )

    return {
      gpt4: gpt4Result,
      claude: claudeResult,
      domestic: domesticResult,
    }
  }

  /**
   * 生成单个聚类的问卷（固定5题）
   * @param cluster 单个聚类（包含成熟度级别）
   * @param clusterIndex 聚类索引
   * @param startQuestionId 起始question_id编号
   * @param temperature 温度参数
   * @param maxTokens 最大token数
   * @returns 5个问题（三模型结果）
   */
  async generateSingleCluster(
    cluster: any,
    clusterIndex: number,
    startQuestionId: number,
    temperature = 0.7,
    maxTokens = 8000,
  ): Promise<{
    gpt4: Question[]
    claude: Question[]
    domestic: Question[]
  }> {
    this.logger.log(`Generating 5 questions for cluster: ${cluster.cluster_name}`)

    // 填充单聚类Prompt模板
    const prompt = fillSingleClusterQuestionnairePrompt(cluster, clusterIndex)

    // 构建AI请求
    const aiRequest: AIClientRequest = {
      prompt,
      temperature,
      maxTokens,
      responseFormat: { type: 'json_object' },
    }

    // 并行调用三模型生成
    const [gpt4Response, claudeResponse, domesticResponse] = await Promise.all([
      this.generateWithModel(aiRequest, AIModel.GPT4),
      this.generateWithModel(aiRequest, AIModel.CLAUDE),
      this.generateWithModel(aiRequest, AIModel.DOMESTIC),
    ])

    // 解析JSON结果
    let gpt4Questions: Question[] | null = null
    let claudeQuestions: Question[] | null = null
    let domesticQuestions: Question[] | null = null

    try {
      gpt4Questions = this.parseSingleClusterResponse(gpt4Response.content, cluster, startQuestionId)
    } catch (error) {
      this.logger.error(`Failed to parse GPT-4 single cluster response: ${error.message}`)
    }

    try {
      claudeQuestions = this.parseSingleClusterResponse(
        claudeResponse.content,
        cluster,
        startQuestionId,
      )
    } catch (error) {
      this.logger.error(`Failed to parse Claude single cluster response: ${error.message}`)
    }

    try {
      domesticQuestions = this.parseSingleClusterResponse(
        domesticResponse.content,
        cluster,
        startQuestionId,
      )
    } catch (error) {
      this.logger.error(`Failed to parse Domestic model single cluster response: ${error.message}`)
    }

    // 如果所有模型都失败，抛出错误
    if (!gpt4Questions && !claudeQuestions && !domesticQuestions) {
      throw new Error(`All three models failed to generate questions for cluster: ${cluster.cluster_name}`)
    }

    // 使用成功的结果填充失败的模型
    const fallbackQuestions = claudeQuestions || gpt4Questions || domesticQuestions

    return {
      gpt4: gpt4Questions || fallbackQuestions,
      claude: claudeQuestions || fallbackQuestions,
      domestic: domesticQuestions || fallbackQuestions,
    }
  }

  /**
   * 解析单聚类响应（固定5题）
   */
  private parseSingleClusterResponse(
    content: string,
    cluster: any,
    startQuestionId: number,
  ): Question[] {
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

      // 5. 提取questions数组
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error('Missing or invalid questions array')
      }

      const questions = parsed.questions

      // 6. 验证题目数量（必须是5题）
      if (questions.length !== 5) {
        this.logger.warn(
          `Expected 5 questions for cluster ${cluster.cluster_name}, got ${questions.length}`,
        )
      }

      // 7. 标准化question_id
      questions.forEach((q: any, index: number) => {
        const questionNum = startQuestionId + index
        q.question_id = `Q${questionNum.toString().padStart(3, '0')}`
      })

      return questions as Question[]
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

          if (parsed.questions && Array.isArray(parsed.questions)) {
            const questions = parsed.questions
            questions.forEach((q: any, index: number) => {
              const questionNum = startQuestionId + index
              q.question_id = `Q${questionNum.toString().padStart(3, '0')}`
            })
            return questions as Question[]
          }
        } catch (e) {
          this.logger.error(`Failed to extract and parse: ${e.message}`)
        }
      }

      throw new Error(`Invalid single cluster JSON: ${error.message}`)
    }
  }

  /**
   * 生成元数据
   */
  private generateMetadata(questions: Question[]): QuestionnaireMetadata {
    const coverageMap: Record<string, number> = {}

    for (const question of questions) {
      if (question.cluster_id) {
        if (!coverageMap[question.cluster_id]) {
          coverageMap[question.cluster_id] = 0
        }
        coverageMap[question.cluster_id]++
      }
    }

    return {
      total_questions: questions.length,
      estimated_time_minutes: Math.ceil(questions.length * 0.5), // 每题30秒
      coverage_map: coverageMap,
    }
  }

  /**
   * 使用指定模型生成
   */
  private async generateWithModel(request: AIClientRequest, model: AIModel) {
    try {
      const response = await this.aiOrchestrator.generate(request, model)
      this.logger.debug(`Model ${model} generated questionnaire successfully`)
      return response
    } catch (error) {
      this.logger.error(`Model ${model} questionnaire generation failed: ${error.message}`)
      throw new Error(`${model} questionnaire generation failed: ${error.message}`)
    }
  }

  /**
   * 解析JSON响应
   */
  private parseJsonResponse(
    content: string,
    expectedClusters: number,
  ): QuestionnaireGenerationOutput {
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
      this.validateQuestionnaireOutput(parsed, expectedClusters)

      return parsed as QuestionnaireGenerationOutput
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
          this.validateQuestionnaireOutput(parsed, expectedClusters)

          this.logger.log('Successfully parsed JSON after extraction and repair')
          return parsed as QuestionnaireGenerationOutput
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
    let input = jsonStr
    if (input.charCodeAt(0) === 0xfeff) {
      input = input.substring(1)
    }

    input = input.replace(/,(\s*[}\]])/g, '$1')

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
   * 验证问卷输出的结构
   */
  private validateQuestionnaireOutput(output: any, expectedClusters: number): void {
    // 验证顶层字段
    if (!output.questionnaire) {
      throw new Error('Missing required field: questionnaire')
    }

    if (!output.questionnaire_metadata) {
      this.logger.warn('Missing questionnaire_metadata, generating default metadata')
      output.questionnaire_metadata = this.generateDefaultMetadata(
        output.questionnaire,
        expectedClusters,
      )
    }

    // 验证questionnaire数组
    if (!Array.isArray(output.questionnaire) || output.questionnaire.length === 0) {
      throw new Error('questionnaire must be a non-empty array')
    }

    // 验证每个题目
    const validQuestions = []
    const clusterCoverage: Record<string, number> = {}

    for (const question of output.questionnaire) {
      // 检查必需字段
      if (
        !question.question_id ||
        !question.cluster_id ||
        !question.cluster_name ||
        !question.question_text ||
        !question.question_type ||
        !Array.isArray(question.options)
      ) {
        this.logger.warn(
          `Skipping question with missing basic fields: ${JSON.stringify(question).substring(0, 100)}`,
        )
        continue
      }

      // 验证question_type
      if (
        !['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'RATING'].includes(question.question_type)
      ) {
        this.logger.warn(`Invalid question_type: ${question.question_type}`)
        continue
      }

      // 验证选项
      if (question.options.length === 0) {
        this.logger.warn(`Question ${question.question_id} has no options`)
        continue
      }

      // 验证单选题的选项数量（应该是5个，对应5个成熟度级别）
      if (question.question_type === 'SINGLE_CHOICE' && question.options.length !== 5) {
        this.logger.warn(
          `Single choice question ${question.question_id} should have 5 options, got ${question.options.length}`,
        )
      }

      // 填充缺失的字段
      if (question.required === undefined) {
        question.required = true
      }

      if (!question.guidance) {
        question.guidance = '请选择最符合您组织当前状态的选项。'
      }

      validQuestions.push(question)

      // 统计覆盖率
      if (!clusterCoverage[question.cluster_id]) {
        clusterCoverage[question.cluster_id] = 0
      }
      clusterCoverage[question.cluster_id]++
    }

    // 更新output中的questionnaire为过滤后的有效questions
    output.questionnaire = validQuestions

    // 验证至少有一些有效的题目
    if (validQuestions.length === 0) {
      throw new Error('No valid questions found in AI response')
    }

    this.logger.log(
      `Validated ${validQuestions.length} questions covering ${Object.keys(clusterCoverage).length} clusters`,
    )

    // 检查覆盖完整性（每个聚类至少3题）
    const lowCoverageClusters = []
    for (const [clusterId, count] of Object.entries(clusterCoverage)) {
      if (count < 3) {
        lowCoverageClusters.push(`${clusterId}(${count}题)`)
      }
    }

    if (lowCoverageClusters.length > 0) {
      this.logger.warn(
        `Some clusters have low question coverage (<3): ${lowCoverageClusters.join(', ')}`,
      )
    }

    // 更新元数据
    output.questionnaire_metadata.total_questions = validQuestions.length
    output.questionnaire_metadata.estimated_time_minutes = Math.ceil(
      validQuestions.length * 0.5,
    ) // 每题30秒
    output.questionnaire_metadata.coverage_map = clusterCoverage
  }

  /**
   * 生成默认元数据（当AI未返回时）
   */
  private generateDefaultMetadata(
    questions: any[],
    expectedClusters: number,
  ): QuestionnaireMetadata {
    const coverageMap: Record<string, number> = {}

    for (const question of questions) {
      if (question.cluster_id) {
        if (!coverageMap[question.cluster_id]) {
          coverageMap[question.cluster_id] = 0
        }
        coverageMap[question.cluster_id]++
      }
    }

    return {
      total_questions: questions.length,
      estimated_time_minutes: Math.ceil(questions.length * 0.5), // 每题30秒
      coverage_map: coverageMap,
    }
  }

  /**
   * 生成问卷摘要（用于日志和预览）
   */
  generateSummary(output: QuestionnaireGenerationOutput): string {
    const { questionnaire, questionnaire_metadata } = output
    const singleChoice = questionnaire.filter((q) => q.question_type === 'SINGLE_CHOICE').length
    const multipleChoice = questionnaire.filter(
      (q) => q.question_type === 'MULTIPLE_CHOICE',
    ).length
    const rating = questionnaire.filter((q) => q.question_type === 'RATING').length

    return `Generated ${questionnaire_metadata.total_questions} questions (Single: ${singleChoice}, Multiple: ${multipleChoice}, Rating: ${rating}). Estimated time: ${questionnaire_metadata.estimated_time_minutes} minutes. Covering ${Object.keys(questionnaire_metadata.coverage_map).length} clusters.`
  }
}
