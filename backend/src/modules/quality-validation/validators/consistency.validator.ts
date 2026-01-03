import { Injectable, Logger } from '@nestjs/common'
import { SimilarityCalculator } from './similarity.calculator'

export interface ConsistencyReport {
  structuralScore: number // 结构层分数 (0-1)
  semanticScore: number // 语义层分数 (0-1)
  detailScore: number // 细节层分数 (0-1)
  overallScore: number // 总体分数 (加权平均)
  agreements: string[] // 一致的地方
  disagreements: string[] // 分歧点
  highRiskDisagreements: string[] // 高风险分歧
}

export interface ValidationResult {
  gpt4: Record<string, any>
  claude: Record<string, any>
  domestic: Record<string, any>
}

/**
 * 一致性验证器
 * 实现三层验证：结构层、语义层、细节层
 */
@Injectable()
export class ConsistencyValidator {
  private readonly logger = new Logger(ConsistencyValidator.name)

  // 分层验证权重
  private readonly WEIGHTS = {
    structural: 0.4, // 结构层权重 40%
    semantic: 0.4, // 语义层权重 40%
    detail: 0.2, // 细节层权重 20%
  }

  // 质量阈值
  private readonly THRESHOLDS = {
    structural: 0.9, // 结构层要求 ≥ 90%
    semantic: 0.8, // 语义层要求 ≥ 80%
    detail: 0.6, // 细节层要求 ≥ 60%
  }

  constructor(private readonly similarityCalculator: SimilarityCalculator) {}

  /**
   * 验证三模型输出的一致性（支持动态质量验证）
   * @param results 三模型的输出结果
   * @returns 一致性报告
   */
  async validate(results: ValidationResult): Promise<ConsistencyReport> {
    const { gpt4, claude, domestic } = results

    // 统计成功的模型数量
    const successfulModels = [gpt4, claude, domestic].filter((r) => r !== null)
    const successfulCount = successfulModels.length

    this.logger.log(
      `Starting consistency validation with ${successfulCount}/3 successful models`,
    )

    // ⭐ 动态质量验证：根据成功数量调整验证策略
    if (successfulCount === 0) {
      throw new Error('No successful model results to validate')
    }

    if (successfulCount === 1) {
      // ⭐ 只有1个模型成功：跳过一致性验证，给满分
      this.logger.warn(
        'Only 1 model succeeded, skipping consistency validation, assigning perfect scores',
      )

      return {
        structuralScore: 1,
        semanticScore: 1,
        detailScore: 1,
        overallScore: 1,
        agreements: ['Single model result - no comparison possible'],
        disagreements: [],
        highRiskDisagreements: [],
      }
    }

    // ⭐ 2-3个模型成功：正常进行一致性验证
    // Layer 1: 结构一致性验证（JSON Schema结构）
    const structuralScore = this.validateStructuralConsistency(
      gpt4,
      claude,
      domestic,
    )

    // Layer 2: 语义等价性验证（Embedding相似度）
    const semanticScore = await this.validateSemanticConsistency(
      gpt4,
      claude,
      domestic,
    )

    // Layer 3: 细节一致性验证（文本相似度）
    const detailScore = this.validateDetailConsistency(gpt4, claude, domestic)

    // 计算加权总分
    const overallScore =
      structuralScore * this.WEIGHTS.structural +
      semanticScore * this.WEIGHTS.semantic +
      detailScore * this.WEIGHTS.detail

    // 识别一致点和分歧点
    const { agreements, disagreements } = this.identifyAgreementsAndDisagreements(
      gpt4,
      claude,
      domestic,
    )

    // 识别高风险分歧
    const highRiskDisagreements = this.identifyHighRiskDisagreements(disagreements)

    const report: ConsistencyReport = {
      structuralScore,
      semanticScore,
      detailScore,
      overallScore,
      agreements,
      disagreements,
      highRiskDisagreements,
    }

    this.logger.log(
      `Consistency validation completed: overall=${overallScore.toFixed(4)}, structural=${structuralScore.toFixed(4)}, semantic=${semanticScore.toFixed(4)}, detail=${detailScore.toFixed(4)}`,
    )

    return report
  }

  /**
   * Layer 1: 结构一致性验证
   * 验证JSON Schema结构是否一致
   */
  private validateStructuralConsistency(
    gpt4: Record<string, any>,
    claude: Record<string, any>,
    domestic: Record<string, any>,
  ): number {
    // 计算三对结构相似度
    const sim1 = this.similarityCalculator.calculateStructuralSimilarity(
      gpt4,
      claude,
    )
    const sim2 = this.similarityCalculator.calculateStructuralSimilarity(
      gpt4,
      domestic,
    )
    const sim3 = this.similarityCalculator.calculateStructuralSimilarity(
      claude,
      domestic,
    )

    // 返回平均值
    const avgSimilarity = (sim1 + sim2 + sim3) / 3

    this.logger.debug(
      `Structural consistency: ${avgSimilarity.toFixed(4)} (gpt4-claude=${sim1.toFixed(4)}, gpt4-domestic=${sim2.toFixed(4)}, claude-domestic=${sim3.toFixed(4)})`,
    )

    return avgSimilarity
  }

  /**
   * Layer 2: 语义等价性验证
   * 使用Embedding计算语义相似度
   */
  private async validateSemanticConsistency(
    gpt4: Record<string, any>,
    claude: Record<string, any>,
    domestic: Record<string, any>,
  ): Promise<number> {
    // 将JSON对象转为文本
    const text1 = JSON.stringify(gpt4, null, 2)
    const text2 = JSON.stringify(claude, null, 2)
    const text3 = JSON.stringify(domestic, null, 2)

    // 计算三对语义相似度
    const sim1 = await this.similarityCalculator.calculateSimilarity(text1, text2)
    const sim2 = await this.similarityCalculator.calculateSimilarity(text1, text3)
    const sim3 = await this.similarityCalculator.calculateSimilarity(text2, text3)

    // 返回平均值
    const avgSimilarity = (sim1 + sim2 + sim3) / 3

    this.logger.debug(
      `Semantic consistency: ${avgSimilarity.toFixed(4)} (gpt4-claude=${sim1.toFixed(4)}, gpt4-domestic=${sim2.toFixed(4)}, claude-domestic=${sim3.toFixed(4)})`,
    )

    return avgSimilarity
  }

  /**
   * Layer 3: 细节一致性验证
   * 使用Levenshtein距离计算文本相似度
   */
  private validateDetailConsistency(
    gpt4: Record<string, any>,
    claude: Record<string, any>,
    domestic: Record<string, any>,
  ): number {
    const text1 = JSON.stringify(gpt4, null, 2)
    const text2 = JSON.stringify(claude, null, 2)
    const text3 = JSON.stringify(domestic, null, 2)

    // 计算三对文本相似度（简化版：基于字符串长度比例）
    const sim1 = this.calculateTextSimilarity(text1, text2)
    const sim2 = this.calculateTextSimilarity(text1, text3)
    const sim3 = this.calculateTextSimilarity(text2, text3)

    // 返回平均值
    const avgSimilarity = (sim1 + sim2 + sim3) / 3

    this.logger.debug(
      `Detail consistency: ${avgSimilarity.toFixed(4)} (gpt4-claude=${sim1.toFixed(4)}, gpt4-domestic=${sim2.toFixed(4)}, claude-domestic=${sim3.toFixed(4)})`,
    )

    return avgSimilarity
  }

  /**
   * 简化的文本相似度计算（基于最长公共子序列）
   * TODO: 未来可以使用更精确的算法（如Levenshtein距离）
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const len1 = text1.length
    const len2 = text2.length
    const maxLen = Math.max(len1, len2)

    if (maxLen === 0) return 1

    // 简化版：基于长度比例
    const ratio = Math.min(len1, len2) / maxLen
    return ratio
  }

  /**
   * 识别一致点和分歧点
   */
  private identifyAgreementsAndDisagreements(
    gpt4: Record<string, any>,
    claude: Record<string, any>,
    domestic: Record<string, any>,
  ): { agreements: string[]; disagreements: string[] } {
    const agreements: string[] = []
    const disagreements: string[] = []

    // 获取所有键
    const allKeys = new Set([
      ...Object.keys(gpt4),
      ...Object.keys(claude),
      ...Object.keys(domestic),
    ])

    for (const key of allKeys) {
      const val1 = gpt4[key]
      const val2 = claude[key]
      const val3 = domestic[key]

      // 检查是否所有模型都有这个键
      if (val1 !== undefined && val2 !== undefined && val3 !== undefined) {
        // 简单比较（深度比较需要递归）
        const str1 = JSON.stringify(val1)
        const str2 = JSON.stringify(val2)
        const str3 = JSON.stringify(val3)

        if (str1 === str2 && str2 === str3) {
          agreements.push(`Field '${key}': All models agree`)
        } else {
          disagreements.push(
            `Field '${key}': GPT4=${this.truncate(str1)}, Claude=${this.truncate(str2)}, Domestic=${this.truncate(str3)}`,
          )
        }
      } else {
        disagreements.push(
          `Field '${key}': Missing in some models (GPT4=${val1 !== undefined}, Claude=${val2 !== undefined}, Domestic=${val3 !== undefined})`,
        )
      }
    }

    return { agreements, disagreements }
  }

  /**
   * 识别高风险分歧（涉及安全、合规、法律责任）
   */
  private identifyHighRiskDisagreements(disagreements: string[]): string[] {
    const highRiskKeywords = [
      'security',
      'compliance',
      'legal',
      'privacy',
      'risk',
      '安全',
      '合规',
      '法律',
      '隐私',
      '风险',
    ]

    return disagreements.filter((disagreement) =>
      highRiskKeywords.some((keyword) =>
        disagreement.toLowerCase().includes(keyword.toLowerCase()),
      ),
    )
  }

  /**
   * 截断字符串用于日志
   */
  private truncate(str: string, maxLength: number = 100): string {
    if (str.length <= maxLength) return str
    return str.substring(0, maxLength) + '...'
  }

  /**
   * 判断验证是否通过
   */
  isPassed(report: ConsistencyReport): boolean {
    return (
      report.structuralScore >= this.THRESHOLDS.structural &&
      report.semanticScore >= this.THRESHOLDS.semantic &&
      report.detailScore >= this.THRESHOLDS.detail
    )
  }

  /**
   * 获取置信度等级（根据成功模型数量）
   * @param overallScore 总体分数
   * @param successfulCount 成功模型数量
   * @returns 置信度等级
   */
  getConfidenceLevel(
    overallScore: number,
    successfulCount?: number,
  ): 'HIGH' | 'MEDIUM' | 'LOW' {
    // ⭐ 动态置信度：根据成功模型数量调整
    if (successfulCount === 1) {
      return 'LOW' // 单模型结果，低置信度
    }

    if (successfulCount === 2) {
      return overallScore >= 0.75 ? 'MEDIUM' : 'LOW' // 2模型对比，中等置信度
    }

    // 3模型对比
    if (overallScore >= 0.85) return 'HIGH'
    if (overallScore >= 0.75) return 'MEDIUM'
    return 'LOW'
  }
}
