import { Injectable, Logger } from '@nestjs/common'
import { Clause } from '../prompts/clause-extraction.prompts'

/**
 * 条款覆盖率验证服务
 * 使用正则表达式验证AI提取的条款是否完整，并补全缺失条款
 */
@Injectable()
export class ClauseCoverageService {
  private readonly logger = new Logger(ClauseCoverageService.name)

  /**
   * 条款ID正则表达式模式列表
   * 覆盖多种常见的条款编号格式
   */
  private readonly CLAUSE_PATTERNS = [
    // 中文数字条款：第四条、第三十四条
    /第[一二三四五六七八九十百千]+条/g,
    // 阿拉伯数字条款：第4条、第34条
    /\b第\d+条/g,
    // 三级编号：4.2.1、10.3.5
    /\b\d+\.\d+\.\d+\b/g,
    // 二级编号：4.2、10.3
    /\b\d+\.\d+\b/g,
    // 单级编号（可能需要谨慎使用）：4、10
    /\b\d+\s*(?=\.|,|;|\s|$)/g,
  ]

  /**
   * 使用正则表达式统计文档中的条款数量
   * @param documentContent 标准文档内容
   * @returns 统计结果，包含每种模式的匹配数量和唯一条款ID集合
   */
  countClausesByRegex(documentContent: string): {
    totalCount: number
    uniqueClauseIds: Set<string>
    patternMatches: Array<{ pattern: string; count: number }>
  } {
    this.logger.log('Starting regex-based clause counting...')

    const uniqueClauseIds = new Set<string>()
    const patternMatches: Array<{ pattern: string; count: number }> = []

    // 应用每种正则模式
    for (const pattern of this.CLAUSE_PATTERNS) {
      const matches = documentContent.match(pattern)
      const count = matches ? matches.length : 0

      patternMatches.push({
        pattern: pattern.source,
        count,
      })

      // 将匹配的条款ID添加到集合中
      if (matches) {
        matches.forEach((match) => uniqueClauseIds.add(match.trim()))
      }
    }

    this.logger.log(`Regex counting complete. Found ${uniqueClauseIds.size} unique clause IDs`)

    // 记录每种模式的匹配情况
    patternMatches.forEach(({ pattern, count }) => {
      this.logger.debug(`Pattern "${pattern}": ${count} matches`)
    })

    return {
      totalCount: uniqueClauseIds.size,
      uniqueClauseIds,
      patternMatches,
    }
  }

  /**
   * 验证AI提取的条款覆盖率
   * @param documentContent 标准文档内容
   * @param extraction AI提取的结果
   * @returns 验证结果
   */
  validateCoverage(
    documentContent: string,
    extraction: { clauses: Clause[]; total_clauses: number },
  ): {
    isComplete: boolean
    expectedCount: number
    actualCount: number
    coverage: number
    missingClauseIds: string[]
    extractedClauseIds: Set<string>
    allClauseIds: Set<string>
  } {
    this.logger.log(`Validating coverage: AI extracted ${extraction.total_clauses} clauses`)

    // 使用正则统计预期条款数量
    const regexResult = this.countClausesByRegex(documentContent)
    const expectedCount = regexResult.totalCount
    const actualCount = extraction.total_clauses

    // 构建提取的条款ID集合
    const extractedClauseIds = new Set(extraction.clauses.map((c) => c.clause_id.trim()))
    const allClauseIds = regexResult.uniqueClauseIds

    // 找出缺失的条款ID
    const missingClauseIds = Array.from(allClauseIds).filter((id) => !extractedClauseIds.has(id))

    const coverage = expectedCount > 0 ? (actualCount / expectedCount) * 100 : 0
    const isComplete = missingClauseIds.length === 0

    this.logger.log(
      `Coverage validation: ${actualCount}/${expectedCount} (${coverage.toFixed(1)}%)`,
    )

    if (!isComplete) {
      this.logger.warn(`Missing ${missingClauseIds.length} clauses: ${missingClauseIds.join(', ')}`)
    } else {
      this.logger.log('✅ All clauses covered!')
    }

    return {
      isComplete,
      expectedCount,
      actualCount,
      coverage,
      missingClauseIds,
      extractedClauseIds,
      allClauseIds,
    }
  }

  /**
   * 补全缺失的条款
   * @param documentContent 标准文档内容
   * @param existingClauses 已提取的条款列表
   * @param missingClauseIds 缺失的条款ID列表
   * @returns 补全后的完整条款列表
   */
  fillMissingClauses(
    documentContent: string,
    existingClauses: Clause[],
    missingClauseIds: string[],
  ): Clause[] {
    this.logger.log(`Filling ${missingClauseIds.length} missing clauses...`)

    const filledClauses = [...existingClauses]

    for (const clauseId of missingClauseIds) {
      this.logger.log(`Extracting missing clause: ${clauseId}`)

      const clauseText = this.extractClauseText(documentContent, clauseId)

      if (clauseText) {
        filledClauses.push({
          clause_id: clauseId,
          clause_full_text: clauseText,
          chapter: undefined, // 可以后续优化，提取章节信息
        })
        this.logger.log(`✅ Extracted: ${clauseId}`)
      } else {
        this.logger.warn(`⚠️ Failed to extract: ${clauseId}`)
      }
    }

    this.logger.log(`Clause filling complete. Total clauses: ${filledClauses.length}`)

    return filledClauses
  }

  /**
   * 从文档中提取指定条款的完整原文
   * @param documentContent 文档内容
   * @param clauseId 条款ID
   * @returns 条款完整原文，如果提取失败返回null
   */
  extractClauseText(documentContent: string, clauseId: string): string | null {
    try {
      // 查找条款ID的位置
      const clauseIndex = documentContent.indexOf(clauseId)

      if (clauseIndex === -1) {
        this.logger.warn(`Clause ID "${clauseId}" not found in document`)
        return null
      }

      // 从条款ID开始提取
      const startIndex = clauseIndex

      // 查找下一个条款ID的位置（条款边界）
      // 尝试所有可能的条款ID模式
      let endIndex = documentContent.length

      for (const pattern of this.CLAUSE_PATTERNS) {
        const regex = new RegExp(pattern.source, 'g')
        regex.lastIndex = startIndex + clauseId.length // 从当前条款之后开始搜索

        const match = regex.exec(documentContent)
        if (match && match.index < endIndex) {
          endIndex = match.index
        }
      }

      // 提取条款文本
      let clauseText = documentContent.substring(startIndex, endIndex).trim()

      // 清理：移除多余的空白行
      clauseText = clauseText.replace(/\n{3,}/g, '\n\n')

      this.logger.debug(`Extracted clause "${clauseId}": ${clauseText.length} characters`)

      return clauseText
    } catch (error) {
      this.logger.error(`Error extracting clause "${clauseId}": ${error.message}`)
      return null
    }
  }

  /**
   * 智能推断条款数量（当正则统计不准确时使用）
   * 基于文档长度和平均条款长度进行估算
   * @param documentContent 文档内容
   * @returns 推断的条款数量范围
   */
  estimateClauseCount(documentContent: string): {
    min: number
    max: number
    likely: number
  } {
    const docLength = documentContent.length

    // 经验值：平均每个条款500-2000字符
    const minClauseLength = 500
    const maxClauseLength = 2000
    const avgClauseLength = 1000

    const min = Math.floor(docLength / maxClauseLength)
    const max = Math.ceil(docLength / minClauseLength)
    const likely = Math.round(docLength / avgClauseLength)

    this.logger.log(`Estimated clause count: min=${min}, max=${max}, likely=${likely}`)

    return { min, max, likely }
  }

  /**
   * 分析条款ID格式分布
   * 帮助理解文档中使用的条款编号格式
   * @param documentContent 文档内容
   * @returns 格式分析结果
   */
  analyzeClauseFormats(documentContent: string): {
    formats: Array<{ pattern: string; count: number; examples: string[] }>
    dominantFormat: string
  } {
    const formats: Array<{
      pattern: string
      count: number
      examples: string[]
    }> = []

    for (const pattern of this.CLAUSE_PATTERNS) {
      const matches = documentContent.match(pattern)
      const uniqueMatches = matches ? Array.from(new Set(matches.map((m) => m.trim()))) : []

      if (uniqueMatches.length > 0) {
        formats.push({
          pattern: pattern.source,
          count: uniqueMatches.length,
          examples: uniqueMatches.slice(0, 5), // 最多显示5个示例
        })
      }
    }

    // 找出主导格式
    const dominantFormat = formats.sort((a, b) => b.count - a.count)[0]?.pattern || 'unknown'

    this.logger.log(
      `Clause format analysis: ${formats.length} formats found, dominant: ${dominantFormat}`,
    )

    return { formats, dominantFormat }
  }
}
