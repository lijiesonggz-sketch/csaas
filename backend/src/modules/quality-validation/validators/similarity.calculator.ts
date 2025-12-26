import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'

/**
 * 相似度计算器
 * 使用OpenAI Embedding API计算文本语义相似度
 */
@Injectable()
export class SimilarityCalculator {
  private readonly logger = new Logger(SimilarityCalculator.name)
  private readonly openai: OpenAI
  private readonly embeddingModel: string

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY')
    const baseURL = this.configService.get<string>('OPENAI_BASE_URL')

    this.openai = new OpenAI({
      apiKey: apiKey || 'dummy-key',
      baseURL,
    })

    this.embeddingModel =
      this.configService.get<string>('OPENAI_EMBEDDING_MODEL') ||
      'text-embedding-3-small'
  }

  /**
   * 计算两段文本的语义相似度
   * @param text1 文本1
   * @param text2 文本2
   * @returns 相似度分数 (0-1)
   */
  async calculateSimilarity(text1: string, text2: string): Promise<number> {
    try {
      // 获取两段文本的embedding
      const [embedding1, embedding2] = await Promise.all([
        this.getEmbedding(text1),
        this.getEmbedding(text2),
      ])

      // 计算余弦相似度
      const similarity = this.cosineSimilarity(embedding1, embedding2)

      this.logger.debug(
        `Calculated similarity: ${similarity.toFixed(4)} (text1: ${text1.substring(0, 50)}..., text2: ${text2.substring(0, 50)}...)`,
      )

      return similarity
    } catch (error) {
      this.logger.warn(
        `OpenAI Embedding API unavailable, falling back to text-based similarity: ${error.message}`,
      )

      // 降级：使用简单的文本相似度算法
      const fallbackSimilarity = this.calculateTextSimilarity(text1, text2)

      this.logger.debug(
        `Fallback similarity: ${fallbackSimilarity.toFixed(4)} (text-based)`,
      )

      return fallbackSimilarity
    }
  }

  /**
   * 基于文本的简单相似度计算（降级方案）
   * 使用Jaccard相似度 + 字符级别的相似度
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    // 1. Jaccard相似度（基于词）
    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))

    const intersection = new Set([...words1].filter((x) => words2.has(x)))
    const union = new Set([...words1, ...words2])

    const jaccardSimilarity =
      union.size > 0 ? intersection.size / union.size : 0

    // 2. 字符级相似度（Levenshtein距离归一化）
    const maxLength = Math.max(text1.length, text2.length)
    const levenshteinDistance = this.levenshtein(text1, text2)
    const charSimilarity =
      maxLength > 0 ? 1 - levenshteinDistance / maxLength : 0

    // 3. 长度相似度
    const lengthSimilarity =
      1 - Math.abs(text1.length - text2.length) / Math.max(text1.length, text2.length, 1)

    // 加权平均（Jaccard 50%, 字符相似度 30%, 长度相似度 20%）
    const finalSimilarity =
      jaccardSimilarity * 0.5 +
      charSimilarity * 0.3 +
      lengthSimilarity * 0.2

    return finalSimilarity
  }

  /**
   * 计算Levenshtein距离（编辑距离）
   */
  private levenshtein(str1: string, str2: string): number {
    const len1 = str1.length
    const len2 = str2.length

    // 创建距离矩阵
    const matrix: number[][] = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(0))

    // 初始化第一行和第一列
    for (let i = 0; i <= len1; i++) matrix[i][0] = i
    for (let j = 0; j <= len2; j++) matrix[0][j] = j

    // 动态规划填充矩阵
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // 删除
          matrix[i][j - 1] + 1, // 插入
          matrix[i - 1][j - 1] + cost, // 替换
        )
      }
    }

    return matrix[len1][len2]
  }

  /**
   * 批量计算多段文本之间的平均相似度
   * @param texts 文本数组
   * @returns 平均相似度分数 (0-1)
   */
  async calculateAverageSimilarity(texts: string[]): Promise<number> {
    if (texts.length < 2) {
      throw new Error('At least 2 texts are required for similarity calculation')
    }

    const similarities: number[] = []

    // 计算所有文本��之间的相似度
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const similarity = await this.calculateSimilarity(texts[i], texts[j])
        similarities.push(similarity)
      }
    }

    // 返回平均相似度
    const averageSimilarity =
      similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length

    this.logger.log(
      `Calculated average similarity: ${averageSimilarity.toFixed(4)} for ${texts.length} texts`,
    )

    return averageSimilarity
  }

  /**
   * 计算两个JSON对象的结构相似度
   * @param obj1 对象1
   * @param obj2 对象2
   * @returns 结构相似度分数 (0-1)
   */
  calculateStructuralSimilarity(
    obj1: Record<string, any>,
    obj2: Record<string, any>,
  ): number {
    try {
      // 获取两个对象的键集合
      const keys1 = this.getAllKeys(obj1)
      const keys2 = this.getAllKeys(obj2)

      // 计算交集和并集
      const intersection = keys1.filter((key) => keys2.includes(key))
      const union = [...new Set([...keys1, ...keys2])]

      // Jaccard相似度：交集/并集
      const similarity = union.length > 0 ? intersection.length / union.length : 0

      this.logger.debug(
        `Structural similarity: ${similarity.toFixed(4)} (keys1: ${keys1.length}, keys2: ${keys2.length}, intersection: ${intersection.length})`,
      )

      return similarity
    } catch (error) {
      this.logger.error(
        `Failed to calculate structural similarity: ${error.message}`,
      )
      return 0
    }
  }

  /**
   * 获取文本的embedding向量
   * @param text 文本内容
   * @returns embedding向量
   */
  private async getEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: this.embeddingModel,
      input: text,
      encoding_format: 'float',
    })

    return response.data[0].embedding
  }

  /**
   * 计���两个向量的余弦相似度
   * @param vec1 向量1
   * @param vec2 向量2
   * @returns 余弦相似度 (0-1)
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same dimension')
    }

    // 计算点积
    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0)

    // 计算模长
    const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0))
    const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0))

    // 避免除以0
    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0
    }

    // 计算余弦相似度并归一化到0-1
    const similarity = dotProduct / (magnitude1 * magnitude2)

    // 余弦相似度的范围是[-1, 1]，我们将其归一化到[0, 1]
    return (similarity + 1) / 2
  }

  /**
   * 递归获取对象的所有键路径
   * @param obj 对象
   * @param prefix 键路径前缀
   * @returns 所有键路径数组
   */
  private getAllKeys(obj: any, prefix: string = ''): string[] {
    const keys: string[] = []

    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue

      const fullKey = prefix ? `${prefix}.${key}` : key

      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        // 递归处理嵌套对象
        keys.push(...this.getAllKeys(obj[key], fullKey))
      } else {
        keys.push(fullKey)
      }
    }

    return keys
  }
}
