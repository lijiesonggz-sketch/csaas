import {
  scoreTextSimilarity,
  extractWeightedTokens,
  normalizedSimilarity,
  DOMAIN_SIMILARITY_TERMS,
} from './text-similarity.util'

describe('text-similarity.util', () => {
  describe('extractWeightedTokens', () => {
    it('should extract domain terms with high weight', () => {
      const tokens = extractWeightedTokens('开展数据分类分级工作')
      expect(tokens.get('分类分级')).toBe(8)
    })

    it('should extract chinese 2-3 gram tokens', () => {
      const tokens = extractWeightedTokens('风险评估机制')
      expect(tokens.size).toBeGreaterThan(0)
      expect(tokens.get('风险评估')).toBe(8)
    })

    it('should skip generic tokens', () => {
      const tokens = extractWeightedTokens('数据安全')
      expect(tokens.has('数据')).toBe(false)
      expect(tokens.has('安全')).toBe(false)
    })

    it('should handle empty input', () => {
      expect(extractWeightedTokens('').size).toBe(0)
      expect(extractWeightedTokens(null as any).size).toBe(0)
    })
  })

  describe('scoreTextSimilarity', () => {
    it('should return positive score for similar texts', () => {
      const a = '建立数据分类分级制度，明确重要数据目录'
      const b = '组织应制定数据分类分级管理办法，识别重要数据'
      expect(scoreTextSimilarity(a, b)).toBeGreaterThan(0)
    })

    it('should return 0 for completely different texts', () => {
      expect(scoreTextSimilarity('abc', 'xyz')).toBe(0)
    })
  })

  describe('normalizedSimilarity', () => {
    it('should return 1 for identical texts', () => {
      const text = '建立数据分类分级制度，开展风险评估'
      expect(normalizedSimilarity(text, text)).toBe(1)
    })

    it('should return value in [0,1] for partial overlap', () => {
      const a = '建立数据分类分级制度，开展风险评估和日志审计'
      const b = '组织应建立分类分级机制并定期开展风险评估'
      const sim = normalizedSimilarity(a, b)
      expect(sim).toBeGreaterThan(0)
      expect(sim).toBeLessThanOrEqual(1)
    })

    it('should return 0 for no overlap', () => {
      expect(normalizedSimilarity('abc', 'xyz')).toBe(0)
    })

    it('should return 0 for empty inputs', () => {
      expect(normalizedSimilarity('', '')).toBe(0)
      expect(normalizedSimilarity('数据分类分级', '')).toBe(0)
    })

    it('should be higher for more similar texts', () => {
      const base = '网络运营者应当建立数据分类分级制度，对重要数据进行备份和加密'
      const close = '网络运营者应建立数据分类分级制度，对重要数据实施备份加密'
      const far = '员工培训应当每年开展一次，记录培训档案'
      expect(normalizedSimilarity(base, close)).toBeGreaterThan(normalizedSimilarity(base, far))
    })
  })

  describe('DOMAIN_SIMILARITY_TERMS', () => {
    it('should export the domain terms list', () => {
      expect(DOMAIN_SIMILARITY_TERMS).toContain('分类分级')
      expect(DOMAIN_SIMILARITY_TERMS.length).toBeGreaterThan(30)
    })
  })
})
