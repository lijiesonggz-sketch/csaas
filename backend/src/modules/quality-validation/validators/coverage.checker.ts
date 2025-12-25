import { Injectable, Logger } from '@nestjs/common'
import { SimilarityCalculator } from './similarity.calculator'

export interface CoverageReport {
  totalClauses: number // 标准文档总条款数
  coveredClauses: string[] // 已覆盖的条款ID
  missingClauses: string[] // 遗漏的条款ID
  coverageRate: number // 覆盖率 (0-1)
  semanticallyCoveredClauses?: string[] // 语义匹配的条款
}

export interface ClusteringResult {
  clusters: Array<{
    id: string
    name: string
    clauses: Array<{
      clause_id: string
      clause_text: string
      rationale?: string
    }>
  }>
}

/**
 * 覆盖率检查器
 * 检查AI聚类是否覆盖标准文档的所有条款
 */
@Injectable()
export class CoverageChecker {
  private readonly logger = new Logger(CoverageChecker.name)

  // 条款ID正则表达式（支持多种格式）
  private readonly CLAUSE_ID_PATTERNS = [
    /\b\d+\.\d+\.\d+\b/g, // 格式：1.2.3
    /\b\d+\.\d+\b/g, // 格式：1.2
    /\b[A-Z]\.\d+\.\d+\b/g, // 格式：A.1.2
    /\b[A-Z]\d+\.\d+\b/g, // 格式：A1.2
  ]

  // 语义相似度阈值（用于兜底匹配）
  private readonly SEMANTIC_THRESHOLD = 0.9

  constructor(private readonly similarityCalculator: SimilarityCalculator) {}

  /**
   * 检查聚类结果的覆盖率
   * @param standardDocument 标准文档原文
   * @param clusteringResult 聚类结果
   * @returns 覆盖率报告
   */
  async checkCoverage(
    standardDocument: string,
    clusteringResult: ClusteringResult,
  ): Promise<CoverageReport> {
    this.logger.log('Starting coverage check...')

    // 1. 提取标准文档的所有条款ID
    const allClauseIds = this.extractClauseIds(standardDocument)

    // 2. 提取聚类结果中的条款ID
    const coveredClauseIds = this.extractCoveredClauseIds(clusteringResult)

    // 3. 精确匹配：计算遗漏条款
    const missingClauseIds = allClauseIds.filter(
      (id) => !coveredClauseIds.includes(id),
    )

    // 4. 语义匹配：对遗漏条款进行兜底检查
    const semanticallyCoveredClauses = await this.findSemanticallyCoveredClauses(
      standardDocument,
      missingClauseIds,
      clusteringResult,
    )

    // 5. 最终遗漏条款（排除语义匹配的）
    const finalMissingClauses = missingClauseIds.filter(
      (id) => !semanticallyCoveredClauses.includes(id),
    )

    // 6. 计算覆盖率
    const coverageRate = allClauseIds.length > 0
      ? (allClauseIds.length - finalMissingClauses.length) / allClauseIds.length
      : 0

    const report: CoverageReport = {
      totalClauses: allClauseIds.length,
      coveredClauses: coveredClauseIds,
      missingClauses: finalMissingClauses,
      coverageRate,
      semanticallyCoveredClauses,
    }

    this.logger.log(
      `Coverage check completed: total=${allClauseIds.length}, covered=${coveredClauseIds.length}, missing=${finalMissingClauses.length}, rate=${(coverageRate * 100).toFixed(2)}%`,
    )

    return report
  }

  /**
   * 从标准文档中提取所有条款ID
   * @param document 标准文档文本
   * @returns 条款ID数组
   */
  private extractClauseIds(document: string): string[] {
    const clauseIds = new Set<string>()

    // 尝试所有模式
    for (const pattern of this.CLAUSE_ID_PATTERNS) {
      const matches = document.match(pattern)
      if (matches) {
        matches.forEach((id) => clauseIds.add(id))
      }
    }

    const result = Array.from(clauseIds).sort()

    this.logger.debug(`Extracted ${result.length} clause IDs from standard document`)

    return result
  }

  /**
   * 从聚类结果中提取已覆盖的条款ID
   * @param clusteringResult 聚类结果
   * @returns 已覆盖的条款ID数组
   */
  private extractCoveredClauseIds(clusteringResult: ClusteringResult): string[] {
    const coveredIds = new Set<string>()

    for (const cluster of clusteringResult.clusters) {
      for (const clause of cluster.clauses) {
        // 添加条款ID
        coveredIds.add(clause.clause_id)

        // 也尝试从条款文本中提取ID（处理AI提取错误的情况）
        const extractedIds = this.extractClauseIds(clause.clause_text)
        extractedIds.forEach((id) => coveredIds.add(id))
      }
    }

    const result = Array.from(coveredIds).sort()

    this.logger.debug(`Extracted ${result.length} covered clause IDs from clustering result`)

    return result
  }

  /**
   * 查找语义匹配的条款（兜底策略）
   * 对于遗漏的条款ID，检查聚类中是否有语义相似的条款
   * @param standardDocument 标准文档
   * @param missingClauseIds 遗漏的条款ID
   * @param clusteringResult 聚类结果
   * @returns 语义匹配的条款ID数组
   */
  private async findSemanticallyCoveredClauses(
    standardDocument: string,
    missingClauseIds: string[],
    clusteringResult: ClusteringResult,
  ): Promise<string[]> {
    if (missingClauseIds.length === 0) {
      return []
    }

    this.logger.debug(
      `Checking semantic coverage for ${missingClauseIds.length} missing clauses...`,
    )

    const semanticallyCovered: string[] = []

    // 为每个遗漏条款查找原文
    for (const clauseId of missingClauseIds) {
      const clauseText = this.extractClauseText(standardDocument, clauseId)

      if (!clauseText) {
        this.logger.warn(`Could not extract text for clause ${clauseId}`)
        continue
      }

      // 在聚类结果中查找语义相似的条款
      const isCovered = await this.isSemanticallyCovered(
        clauseText,
        clusteringResult,
      )

      if (isCovered) {
        semanticallyCovered.push(clauseId)
      }
    }

    this.logger.debug(
      `Found ${semanticallyCovered.length} semantically covered clauses`,
    )

    return semanticallyCovered
  }

  /**
   * 从标准文档中提取指定条款的文本
   * @param document 标准文档
   * @param clauseId 条款ID
   * @returns 条款文本
   */
  private extractClauseText(document: string, clauseId: string): string {
    // 简化版：查找条款ID附近的文本
    const lines = document.split('\n')
    let clauseText = ''

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(clauseId)) {
        // 提取当前行及后续2行（简化）
        clauseText = lines.slice(i, i + 3).join(' ')
        break
      }
    }

    return clauseText.trim()
  }

  /**
   * 检查条款是否在聚类结果中语义覆盖
   * @param clauseText 条款���本
   * @param clusteringResult 聚类结果
   * @returns 是否覆盖
   */
  private async isSemanticallyCovered(
    clauseText: string,
    clusteringResult: ClusteringResult,
  ): Promise<boolean> {
    // 遍历所有聚类中的条款
    for (const cluster of clusteringResult.clusters) {
      for (const clause of cluster.clauses) {
        const similarity = await this.similarityCalculator.calculateSimilarity(
          clauseText,
          clause.clause_text,
        )

        if (similarity >= this.SEMANTIC_THRESHOLD) {
          this.logger.debug(
            `Found semantic match: similarity=${similarity.toFixed(4)} between "${clauseText.substring(0, 50)}..." and "${clause.clause_text.substring(0, 50)}..."`,
          )
          return true
        }
      }
    }

    return false
  }

  /**
   * 判断覆盖率是否达标
   * @param report 覆盖率报告
   * @param threshold 覆盖率阈值（默认0.95）
   * @returns 是否达标
   */
  isPassed(report: CoverageReport, threshold: number = 0.95): boolean {
    return report.coverageRate >= threshold
  }

  /**
   * 生成覆盖率详细报告（人类可读）
   */
  generateDetailedReport(report: CoverageReport): string {
    const lines: string[] = []

    lines.push(`=== Coverage Report ===`)
    lines.push(`Total Clauses: ${report.totalClauses}`)
    lines.push(
      `Covered Clauses: ${report.coveredClauses.length} (${(report.coverageRate * 100).toFixed(2)}%)`,
    )
    lines.push(`Missing Clauses: ${report.missingClauses.length}`)

    if (report.missingClauses.length > 0) {
      lines.push(`\nMissing Clause IDs:`)
      report.missingClauses.forEach((id) => lines.push(`  - ${id}`))
    }

    if (report.semanticallyCoveredClauses && report.semanticallyCoveredClauses.length > 0) {
      lines.push(`\nSemantically Covered (not explicitly listed):`)
      report.semanticallyCoveredClauses.forEach((id) => lines.push(`  - ${id}`))
    }

    return lines.join('\n')
  }
}
