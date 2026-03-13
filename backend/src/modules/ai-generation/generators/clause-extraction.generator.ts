import { Injectable, Logger } from '@nestjs/common'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'
import { AIClientRequest } from '../../ai-clients/interfaces/ai-client.interface'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'
import {
  fillClauseExtractionPrompt,
  ClauseExtractionOutput,
  ClauseExtractionInput,
} from '../prompts/clause-extraction.prompts'

/**
 * 清理JSON字符串，尝试修复常见的JSON格式问题
 */
function cleanJsonString(jsonStr: string): string {
  // 移除BOM标记
  let cleaned = jsonStr.replace(/^\uFEFF/, '')

  // 移除可能的前后空白字符
  cleaned = cleaned.trim()

  // 尝试修复未闭合的字符串（在截断的情况下）
  // 找到最后一个未闭合的引号并在其后添加闭合引号
  const openQuotes = (cleaned.match(/"/g) || []).length
  if (openQuotes % 2 !== 0) {
    // 找到最后一个未转义的引号
    let lastQuoteIndex = -1
    for (let i = cleaned.length - 1; i >= 0; i--) {
      if (cleaned[i] === '"' && (i === 0 || cleaned[i - 1] !== '\\')) {
        lastQuoteIndex = i
        break
      }
    }
    if (lastQuoteIndex !== -1) {
      cleaned = cleaned.substring(0, lastQuoteIndex + 1) + '"'
    }
  }

  return cleaned
}

/**
 * 尝试从截断的JSON中提取有效数据
 */
function extractPartialJson(jsonStr: string): any {
  const cleaned = cleanJsonString(jsonStr)

  try {
    return JSON.parse(cleaned)
  } catch (e) {
    // 如果还是失败，尝试找到最后一个完整的对象
    // 查找clauses数组的最后一个完整元素
    const clausesMatch = cleaned.match(/"clauses":\s*\[([\s\S]*)/)
    if (clausesMatch) {
      const arrayContent = clausesMatch[1]

      // 尝试找到一个完整的对象结尾
      let lastCompleteIndex = -1
      let braceCount = 0
      let inString = false
      let escapeNext = false

      for (let i = 0; i < arrayContent.length; i++) {
        const char = arrayContent[i]

        if (escapeNext) {
          escapeNext = false
          continue
        }

        if (char === '\\') {
          escapeNext = true
          continue
        }

        if (char === '"') {
          inString = !inString
          continue
        }

        if (!inString) {
          if (char === '{') {
            braceCount++
          } else if (char === '}') {
            braceCount--
            if (braceCount === 0) {
              lastCompleteIndex = i
            }
          }
        }
      }

      if (lastCompleteIndex > 0) {
        // 构建一个完整的JSON对象
        const partialClauses = JSON.parse(
          '[' + arrayContent.substring(0, lastCompleteIndex + 1) + ']',
        )

        // 尝试从原始字符串中提取total_clauses
        const totalMatch = cleaned.match(/"total_clauses":\s*(\d+)/)
        const totalClauses = totalMatch ? parseInt(totalMatch[1]) : partialClauses.length

        return {
          total_clauses: totalClauses,
          clauses: partialClauses,
          _partial: true, // 标记这是部分数据
        }
      }
    }

    throw new Error('Could not extract valid partial JSON')
  }
}

/**
 * 条款提取生成器
 * 负责从标准文档中提取完整的条款清单
 */
@Injectable()
export class ClauseExtractionGenerator {
  private readonly logger = new Logger(ClauseExtractionGenerator.name)

  constructor(private readonly aiOrchestrator: AIOrchestrator) {}

  /**
   * 提取条款清单（三个AI模型串行调用）
   */
  async extractClauses(input: ClauseExtractionInput): Promise<{
    gpt4: ClauseExtractionOutput | null
    claude: ClauseExtractionOutput | null
    domestic: ClauseExtractionOutput | null
  }> {
    const {
      standardDocument,
      expectedClauseCount,
      temperature = 0.3, // 降低温度以提高提取准确性
      maxTokens = 80000, // 增加到80000以支持完整输出
    } = input

    this.logger.log(
      `Starting clause extraction for standard: ${standardDocument.name} ` +
        `(expected: ${expectedClauseCount || 'unknown'})...`,
    )

    // 构建Prompt
    const prompt = fillClauseExtractionPrompt(standardDocument, expectedClauseCount)

    // 准备智谱AI的请求
    const openaiRequest: AIClientRequest = { prompt, temperature, maxTokens }

    // 只调用智谱AI（OpenAI配置已切换到智谱）
    this.logger.log('[1/1] Calling Zhipu AI for clause extraction...')
    this.logger.log(`Request params: temperature=${temperature}, maxTokens=${maxTokens}, promptLength=${prompt.length}`)

    let openaiResult = null
    try {
      openaiResult = await this.aiOrchestrator.generate(openaiRequest, AIModel.GPT4)
      this.logger.log(`Zhipu AI extraction completed: ${openaiResult.content?.substring(0, 100)}...`)
    } catch (err) {
      this.logger.error(`Zhipu AI extraction failed: ${err.message}`, err.stack)
      throw new Error(`条款提取AI调用失败: ${err.message}`)
    }

    // 解析结果
    const openaiOutput = openaiResult
      ? this.parseExtractionResponse(openaiResult.content)
      : null

    // 验证提取的完整性
    if (expectedClauseCount) {
      this.logger.log(
        `Validating extraction results against expected count: ${expectedClauseCount}`,
      )
      this.validateExtractionCount(openaiOutput, expectedClauseCount, 'Zhipu AI')
    }

    this.logger.log(
      `Clause extraction completed. ` + `Zhipu AI: ${openaiOutput?.total_clauses || 0} clauses`,
    )

    return {
      gpt4: openaiOutput,
      claude: null,
      domestic: null,
    }
  }

  /**
   * 解析提取响应 - 带错误恢复的鲁棒解析器
   */
  private parseExtractionResponse(responseText: string): ClauseExtractionOutput | null {
    const parsers = [
      // 尝试1: 从Markdown代码块中提取JSON
      () => {
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/)
        if (jsonMatch && jsonMatch[1]) {
          return JSON.parse(jsonMatch[1])
        }
        throw new Error('No markdown code block found')
      },
      // 尝试2: 直接解析JSON
      () => JSON.parse(responseText),
      // 尝试3: 清理后解析JSON
      () => JSON.parse(cleanJsonString(responseText)),
      // 尝试4: 提取部分JSON（处理截断响应）
      () => extractPartialJson(responseText),
    ]

    for (let i = 0; i < parsers.length; i++) {
      try {
        const parsed = parsers[i]()
        if (parsed && parsed.clauses && Array.isArray(parsed.clauses)) {
          const isPartial = parsed._partial || false
          delete parsed._partial // 移除内部标记

          this.logger.log(
            `Successfully parsed extraction using method ${i + 1}: ` +
              `${parsed.total_clauses} clauses${isPartial ? ' (partial recovery)' : ''}`,
          )

          if (isPartial) {
            this.logger.warn(
              `Response was truncated. Recovered ${parsed.clauses.length} of ${parsed.total_clauses} clauses. ` +
                `Consider increasing maxTokens parameter.`,
            )
          }

          return parsed as ClauseExtractionOutput
        }
      } catch (error) {
        // 继续尝试下一个解析方法
        if (i === parsers.length - 1) {
          // 最后一个方法也失败了
          this.logger.error(`Failed to parse extraction response: ${error.message}`)
          this.logger.debug(`Response text (first 500 chars): ${responseText.substring(0, 500)}`)
          this.logger.debug(
            `Response text (last 500 chars): ${responseText.substring(Math.max(0, responseText.length - 500))}`,
          )
          return null
        }
      }
    }

    this.logger.warn('No valid JSON structure found in extraction response')
    return null
  }

  /**
   * 验证提取的条款数量
   */
  private validateExtractionCount(
    output: ClauseExtractionOutput | null,
    expectedCount: number,
    modelName: string,
  ): void {
    if (!output) {
      this.logger.warn(`${modelName}: No output to validate`)
      return
    }

    if (output.total_clauses !== expectedCount) {
      this.logger.warn(
        `${modelName}: Expected ${expectedCount} clauses, but got ${output.total_clauses}. ` +
          `Difference: ${expectedCount - output.total_clauses} missing`,
      )
    } else {
      this.logger.log(`${modelName}: ✅ Clause count validation passed (${expectedCount} clauses)`)
    }
  }

  /**
   * 选择最佳提取结果
   * 使用智谱AI (GPT4) 的结果
   */
  selectBestExtraction(
    results: {
      gpt4: ClauseExtractionOutput | null
      claude: ClauseExtractionOutput | null
      domestic: ClauseExtractionOutput | null
    },
    expectedCount?: number,
  ): ClauseExtractionOutput | null {
    // 使用智谱AI的结果（通过OpenAI客户端调用）
    if (results.gpt4) {
      this.logger.log(`Selected extraction: ${results.gpt4.total_clauses} clauses (from Zhipu AI)`)
      return results.gpt4
    }

    this.logger.error('智谱AI提取条款失败')
    return null
  }
}
