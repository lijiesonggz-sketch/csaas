/**
 * 文本相似度工具
 * 从 clustering.generator.ts 提取的域名词加权相似度算法，
 * 供聚类补齐、版本比对重编号匹配、多标准交叉分析共用。
 */

export const DOMAIN_SIMILARITY_TERMS = [
  '分类分级',
  '重要数据',
  '核心数据',
  '风险评估',
  '风险监测',
  '事件处置',
  '应急处置',
  '数据收集',
  '数据存储',
  '数据传输',
  '数据提供',
  '数据删除',
  '数据销毁',
  '访问控制',
  '身份鉴别',
  '权限管理',
  '日志审计',
  '接口安全',
  '数据脱敏',
  '数据备份',
  '灾难恢复',
  '开发测试',
  '生产环境',
  '个人信息',
  '敏感个人信息',
  '告知同意',
  '委托处理',
  '跨境传输',
  '安全审计',
  '组织架构',
  '保密协议',
  '法律责任',
  '投诉举报',
  '制度',
  '责任',
  '评估',
  '审计',
  '分类',
  '分级',
  '备份',
  '恢复',
  '传输',
  '收集',
  '存储',
  '销毁',
  '删除',
  '脱敏',
  '访问',
  '授权',
  '权限',
  '日志',
  '接口',
  '监测',
  '预警',
  '事件',
  '报告',
  '监管',
  '处罚',
  '培训',
  '岗位',
  '保密',
  '同意',
  '告知',
  '委托',
  '跨境',
  '出境',
  '投诉',
  '举报',
]

export const GENERIC_SIMILARITY_TOKENS = new Set([
  '数据',
  '安全',
  '要求',
  '组织',
  '开展',
  '进行',
  '建立',
  '应当',
  '应',
  '相关',
  '管理',
  '处理',
  '活动',
  '措施',
  '保护',
  '明确',
  '制定',
  '落实',
])

function addWeightedToken(tokens: Map<string, number>, token: string, weight: number): void {
  tokens.set(token, Math.max(tokens.get(token) || 0, weight))
}

/**
 * 提取加权 token（域名词权重8/4，英文数字串权重2，中文2-3gram权重1）
 */
export function extractWeightedTokens(value: string): Map<string, number> {
  const tokens = new Map<string, number>()
  const text = (value || '').toLowerCase()
  DOMAIN_SIMILARITY_TERMS.forEach((term) => {
    if (text.includes(term.toLowerCase())) {
      addWeightedToken(tokens, term.toLowerCase(), term.length >= 4 ? 8 : 4)
    }
  })

  Array.from(text.matchAll(/[a-z0-9][a-z0-9._-]{1,}/g)).forEach((match) => {
    addWeightedToken(tokens, match[0], 2)
  })

  Array.from(text.matchAll(/[一-鿿]{2,}/g)).forEach((match) => {
    const segment = match[0]
    for (let size = 2; size <= 3; size += 1) {
      for (let index = 0; index <= segment.length - size; index += 1) {
        const token = segment.substring(index, index + size)
        if (!GENERIC_SIMILARITY_TOKENS.has(token)) {
          addWeightedToken(tokens, token, 1)
        }
      }
    }
  })

  return tokens
}

/**
 * 无界相似度评分（token 权重交集求和），保持与 clustering 原实现一致
 */
export function scoreTextSimilarity(source: string, target: string): number {
  return scoreTokenMaps(extractWeightedTokens(source), extractWeightedTokens(target))
}

function scoreTokenMaps(
  sourceTokens: Map<string, number>,
  targetTokens: Map<string, number>,
): number {
  let score = 0
  sourceTokens.forEach((sourceWeight, token) => {
    const targetWeight = targetTokens.get(token)
    if (targetWeight) {
      score += Math.min(sourceWeight, targetWeight)
    }
  })
  return score
}

/**
 * 归一化相似度 ∈ [0,1]：sim(a,b) = score(a,b) / max(score(a,a), score(b,b))
 * 自相似 = 1，无重叠 = 0
 */
export function normalizedSimilarity(a: string, b: string): number {
  const tokensA = extractWeightedTokens(a)
  const tokensB = extractWeightedTokens(b)
  const selfA = scoreTokenMaps(tokensA, tokensA)
  const selfB = scoreTokenMaps(tokensB, tokensB)
  const denominator = Math.max(selfA, selfB)
  if (denominator === 0) {
    return 0
  }
  return scoreTokenMaps(tokensA, tokensB) / denominator
}
