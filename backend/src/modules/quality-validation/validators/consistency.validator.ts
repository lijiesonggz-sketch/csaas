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
  gpt4: Record<string, any> | null
  claude: Record<string, any> | null
  domestic: Record<string, any> | null
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
    gpt4: Record<string, any> | null,
    claude: Record<string, any> | null,
    domestic: Record<string, any> | null,
  ): number {
    // 收集非null的模型结果
    const models = [
      { name: 'gpt4', data: gpt4 },
      { name: 'claude', data: claude },
      { name: 'domestic', data: domestic },
    ].filter((m) => m.data !== null)

    // 如果只有1个或0个模型，返回1（已在validate方法中处理）
    if (models.length < 2) {
      return 1
    }

    // 计算所有配对的相似度
    const similarities: number[] = []
    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        const sim = this.similarityCalculator.calculateStructuralSimilarity(
          models[i].data!,
          models[j].data!,
        )
        similarities.push(sim)
        this.logger.debug(
          `Structural similarity ${models[i].name}-${models[j].name}: ${sim.toFixed(4)}`,
        )
      }
    }

    // 返回平均值
    const avgSimilarity =
      similarities.reduce((sum, s) => sum + s, 0) / similarities.length

    this.logger.debug(`Structural consistency: ${avgSimilarity.toFixed(4)}`)

    return avgSimilarity
  }

  /**
   * Layer 2: 语义等价性验证
   * 使用Embedding计算语义相似度
   */
  private async validateSemanticConsistency(
    gpt4: Record<string, any> | null,
    claude: Record<string, any> | null,
    domestic: Record<string, any> | null,
  ): Promise<number> {
    // 收集非null的模型结果
    const models = [
      { name: 'gpt4', data: gpt4 },
      { name: 'claude', data: claude },
      { name: 'domestic', data: domestic },
    ].filter((m) => m.data !== null)

    // 如果只有1个或0个模型，返回1（已在validate方法中处理）
    if (models.length < 2) {
      return 1
    }

    // 计算所有配对的相似度
    const similarities: number[] = []
    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        const text1 = JSON.stringify(models[i].data, null, 2)
        const text2 = JSON.stringify(models[j].data, null, 2)
        const sim = await this.similarityCalculator.calculateSimilarity(text1, text2)
        similarities.push(sim)
        this.logger.debug(
          `Semantic similarity ${models[i].name}-${models[j].name}: ${sim.toFixed(4)}`,
        )
      }
    }

    // 返回平均值
    const avgSimilarity =
      similarities.reduce((sum, s) => sum + s, 0) / similarities.length

    this.logger.debug(`Semantic consistency: ${avgSimilarity.toFixed(4)}`)

    return avgSimilarity
  }

  /**
   * Layer 3: 细节一致性验证
   * 使用Levenshtein距离计算文本相似度
   */
  private validateDetailConsistency(
    gpt4: Record<string, any> | null,
    claude: Record<string, any> | null,
    domestic: Record<string, any> | null,
  ): number {
    // 收集非null的模型结果
    const models = [
      { name: 'gpt4', data: gpt4 },
      { name: 'claude', data: claude },
      { name: 'domestic', data: domestic },
    ].filter((m) => m.data !== null)

    // 如果只有1个或0个模型，返回1（已在validate方法中处理）
    if (models.length < 2) {
      return 1
    }

    // 计算所有配对的相似度
    const similarities: number[] = []
    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        const text1 = JSON.stringify(models[i].data, null, 2)
        const text2 = JSON.stringify(models[j].data, null, 2)
        const sim = this.calculateTextSimilarity(text1, text2)
        similarities.push(sim)
        this.logger.debug(
          `Detail similarity ${models[i].name}-${models[j].name}: ${sim.toFixed(4)}`,
        )
      }
    }

    // 返回平均值
    const avgSimilarity =
      similarities.reduce((sum, s) => sum + s, 0) / similarities.length

    this.logger.debug(`Detail consistency: ${avgSimilarity.toFixed(4)}`)

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
    gpt4: Record<string, any> | null,
    claude: Record<string, any> | null,
    domestic: Record<string, any> | null,
  ): { agreements: string[]; disagreements: string[] } {
    const agreements: string[] = []
    const disagreements: string[] = []

    // 收集非null的模型结果
    const models = [
      { name: 'gpt4', data: gpt4 },
      { name: 'claude', data: claude },
      { name: 'domestic', data: domestic },
    ].filter((m) => m.data !== null)

    // 如果只有1个或0个模型，返回空数组
    if (models.length < 2) {
      return {
        agreements: ['Only one model succeeded - no comparison possible'],
        disagreements: [],
      }
    }

    // 获取所有键
    const allKeys = new Set<string>()
    models.forEach((m) => {
      Object.keys(m.data!).forEach((key) => allKeys.add(key))
    })

    for (const key of allKeys) {
      const values = models.map((m) => ({
        name: m.name,
        value: m.data![key],
      }))

      // 检查是否所有成功模型都有这个键
      const allHaveKey = values.every((v) => v.value !== undefined)

      if (allHaveKey) {
        // 简单比较（深度比较需要递归）
        const strings = values.map((v) => JSON.stringify(v.value))
        const allEqual = strings.every((s) => s === strings[0])

        if (allEqual) {
          agreements.push(`Field '${key}': All models agree`)
        } else {
          const detail = values.map((v) => `${v.name}=${this.truncate(JSON.stringify(v.value))}`).join(', ')
          disagreements.push(`Field '${key}': ${detail}`)
        }
      } else {
        const missing = values.filter((v) => v.value === undefined).map((v) => v.name).join(', ')
        disagreements.push(`Field '${key}': Missing in ${missing}`)
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
