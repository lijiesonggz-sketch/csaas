/**
 * 文档格式规范化工具
 * 将各种格式的文档转换为统一的条款格式
 */

/**
 * 中文数字映射表（支持到99）
 */
const CHINESE_NUMBERS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '二十一', '二十二', '二十三', '二十四', '二十五', '二十六', '二十七', '二十八', '二十九', '三十',
  '三十一', '三十二', '三十三', '三十四', '三十五', '三十六', '三十七', '三十八', '三十九', '四十',
  '四十一', '四十二', '四十三', '四十四', '四十五', '四十六', '四十七', '四十八', '四十九', '五十',
  '五十一', '五十二', '五十三', '五十四', '五十五', '五十六', '五十七', '五十八', '五十九', '六十',
  '六十一', '六十二', '六十三', '六十四', '六十五', '六十六', '六十七', '六十八', '六十九', '七十',
  '七十一', '七十二', '七十三', '七十四', '七十五', '七十六', '七十七', '七十八', '七十九', '八十',
  '八十一', '八十二', '八十三', '八十四', '八十五', '八十六', '八十七', '八十八', '八十九', '九十',
  '九十一', '九十二', '九十三', '九十四', '九十五', '九十六', '九十七', '九十八', '九十九']

/**
 * 文档结构信息
 */
export interface DocumentStructure {
  totalClauses: number
  identifiedClauses: number
  hasStandardFormat: boolean
  formatType: 'standard' | 'numbered' | 'bulleted' | 'mixed' | 'unknown'
  confidence: number
  issues: string[]
}

/**
 * 分析文档结构
 */
export function analyzeDocumentStructure(content: string): DocumentStructure {
  const issues: string[] = []

  // 统计各种格式的出现频率
  const standardClauses = (content.match(/第[零一二三四五六七八九十百千万]+条/g) || []).length
  const numberedClauses = (content.match(/^\d+\.\s+/gm) || []).length
  const chineseNumberedClauses = (content.match(/^[一二三四五六七八九十]+[、．.]\s*/gm) || []).length
  const bulletedItems = (content.match(/^[•·]\s*/gm) || []).length

  // 检测章节标题
  const standardSections = (content.match(/第[零一二三四五六七八九十百千万]+[章节篇]/g) || []).length
  const bulletedSections = (content.match(/^[•·]\s*[章节篇]|^[•·]\s*总\s*则|^[•·]\s*附\s*则/gm) || []).length

  const totalClauses = Math.max(standardClauses, numberedClauses + chineseNumberedClauses, bulletedItems)

  let formatType: DocumentStructure['formatType'] = 'unknown'
  let hasStandardFormat = false
  let confidence = 0

  // 判断文档格式类型
  if (standardClauses > totalClauses * 0.5) {
    formatType = 'standard'
    hasStandardFormat = true
    confidence = 0.95
  } else if (numberedClauses + chineseNumberedClauses > totalClauses * 0.5) {
    formatType = 'numbered'
    hasStandardFormat = true
    confidence = 0.85
  } else if (bulletedItems > totalClauses * 0.5) {
    formatType = 'bulleted'
    hasStandardFormat = false
    confidence = 0.6
    issues.push('文档使用圆点项目符号，需要转换为标准条款格式')
  } else if (standardSections > 0 || bulletedSections > 0) {
    formatType = 'mixed'
    hasStandardFormat = false
    confidence = 0.5
    issues.push('文档格式混合，包含章节标题但缺少标准条款编号')
  } else {
    formatType = 'unknown'
    hasStandardFormat = false
    confidence = 0.3
    issues.push('无法识别文档格式，可能需要手动调整')
  }

  // 检查其他问题
  if (totalClauses < 10) {
    issues.push('检测到的条款数量较少，可能存在格式识别问题')
  }

  if (standardSections === 0 && bulletedSections === 0) {
    issues.push('缺少明确的章节结构')
  }

  return {
    totalClauses,
    identifiedClauses: totalClauses,
    hasStandardFormat,
    formatType,
    confidence,
    issues,
  }
}

/**
 * 规范化文档格式
 * 将各种格式转换为标准的"第X条"格式
 */
export function normalizeDocumentFormat(content: string): {
  normalized: string
  changes: string[]
} {
  let normalized = content
  const changes: string[] = []

  // 1. 规范化章节标题
  const sectionResult = normalizeSections(normalized)
  if (sectionResult.changes.length > 0) {
    normalized = sectionResult.normalized
    changes.push(...sectionResult.changes)
  }

  // 2. 处理圆点项目符号（优先级最高）
  if (/^[•·]\s*/gm.test(normalized)) {
    const bulletResult = convertBulletsToStandard(normalized)
    normalized = bulletResult.normalized
    changes.push(`已将 ${bulletResult.convertedCount} 个圆点项目转换为标准格式`)
  }

  // 3. 处理中文数字编号
  const chineseNumResult = convertChineseNumberedToClauses(normalized)
  if (chineseNumResult.convertedCount > 0) {
    normalized = chineseNumResult.normalized
    changes.push(`已转换 ${chineseNumResult.convertedCount} 个中文数字编号`)
  }

  // 4. 处理阿拉伯数字编号
  const numResult = convertNumberedToClauses(normalized)
  if (numResult.convertedCount > 0) {
    normalized = numResult.normalized
    changes.push(`已转换 ${numResult.convertedCount} 个数字编号`)
  }

  // 5. 清理多余的空行
  const beforeClean = normalized
  normalized = normalized.replace(/\n{3,}/g, '\n\n')
  if (beforeClean !== normalized) {
    changes.push('已清理多余空行')
  }

  // 6. 标准化空格
  normalized = normalized.replace(/[ \t]+/g, ' ') // 多个空格/制表符替换为单个空格
  normalized = normalized.replace(/^ +/gm, '') // 去除行首空格
  normalized = normalized.replace(/ +$/gm, '') // 去除行尾空格

  return { normalized, changes }
}

/**
 * 规范化章节标题
 */
function normalizeSections(content: string): { normalized: string; changes: string[] } {
  let normalized = content
  const changes: string[] = []
  let sectionCounter = 1

  // 处理特殊章节标题
  const specialSections = [
    { pattern: /^•\s*总\s*则\s*$/gm, replacement: '第一章 总则' },
    { pattern: /^•\s*附\s*则\s*$/gm, replacement: `第${CHINESE_NUMBERS[99]}章 附则` },
  ]

  for (const section of specialSections) {
    const matches = normalized.match(section.pattern)
    if (matches && matches.length > 0) {
      normalized = normalized.replace(section.pattern, section.replacement)
      changes.push(`已转换 ${matches.length} 个特殊章节标题`)
    }
  }

  // 处理其他圆点开头的章节标题
  normalized = normalized.replace(/^•\s*(.+?)$/gm, (match, title) => {
    // 如果标题较短且不包含句号，可能是章节
    if (title.length < 50 && !title.includes('。') && !title.includes('第') && !title.includes('条')) {
      const sectionTitle = `第${CHINESE_NUMBERS[sectionCounter]}章 ${title}`
      sectionCounter++
      return sectionTitle
    }
    return match
  })

  return { normalized, changes }
}

/**
 * 将圆点项目转换为标准条款
 */
function convertBulletsToStandard(content: string): { normalized: string; convertedCount: number } {
  const lines = content.split('\n')
  const result: string[] = []
  let clauseCounter = 1
  let sectionCounter = 1
  let convertedCount = 0
  let lastWasSection = false

  for (const line of lines) {
    const trimmed = line.trim()

    // 跳过空行
    if (!trimmed) {
      result.push('')
      continue
    }

    // 检查是否是圆点开头的行
    if (trimmed.startsWith('•') || trimmed.startsWith('·')) {
      const contentText = trimmed.substring(1).trim()

      // 判断是否是章节标题
      if (isSectionTitle(contentText)) {
        result.push(`第${CHINESE_NUMBERS[sectionCounter]}章 ${contentText}`)
        sectionCounter++
        lastWasSection = true
        convertedCount++
      } else if (isClauseContent(contentText)) {
        // 是条款内容
        result.push(`第${CHINESE_NUMBERS[clauseCounter]}条 ${contentText}`)
        clauseCounter++
        lastWasSection = false
        convertedCount++
      } else {
        // 保持原样
        result.push(line)
      }
    } else if (trimmed.match(/^第[零一二三四五六七八九十百千万]+条/) || trimmed.match(/^第[零一二三四五六七八九十百千万]+章/)) {
      // 已经是标准格式
      result.push(trimmed)
      lastWasSection = false

      // 更新计数器
      const clauseMatch = trimmed.match(/^第([零一二三四五六七八九十百千万]+)条/)
      const sectionMatch = trimmed.match(/^第([零一二三四五六七八九十百千万]+)章/)
      if (clauseMatch) {
        clauseCounter = CHINESE_NUMBERS.indexOf(clauseMatch[1]) + 2
      } else if (sectionMatch) {
        sectionCounter = CHINESE_NUMBERS.indexOf(sectionMatch[1]) + 2
      }
    } else if (lastWasSection && !trimmed.startsWith('第')) {
      // 章节后的说明文字，添加到前一个章节
      const lastIdx = result.length - 1
      if (lastIdx >= 0) {
        result[lastIdx] = result[lastIdx] + '\n' + trimmed
      }
    } else {
      // 其他内容保持原样
      result.push(line)
      lastWasSection = false
    }
  }

  return { normalized: result.join('\n'), convertedCount }
}

/**
 * 判断是否是章节标题
 */
function isSectionTitle(text: string): boolean {
  // 短文本且不包含句号
  if (text.length > 50 || text.includes('。')) return false

  // 包含章节关键词
  const sectionKeywords = ['总则', '附则', '原则', '要求', '管理', '保护', '定义', '范围', '目的', '职责']
  return sectionKeywords.some(keyword => text.includes(keyword))
}

/**
 * 判断是否是条款内容
 */
function isClauseContent(text: string): boolean {
  // 较长文本且包含句号
  return text.length > 10 && text.includes('。')
}

/**
 * 将阿拉伯数字编号转换为条款
 */
function convertNumberedToClauses(content: string): { normalized: string; convertedCount: number } {
  let convertedCount = 0
  const normalized = content.replace(/^(\d+)\.\s*/gm, (match, num) => {
    convertedCount++
    return `第${CHINESE_NUMBERS[parseInt(num)] || num}条 `
  })

  return { normalized, convertedCount }
}

/**
 * 将中文数字编号转换为条款
 */
function convertChineseNumberedToClauses(content: string): { normalized: string; convertedCount: number } {
  let convertedCount = 0
  const normalized = content.replace(/^([一二三四五六七八九十]+)[、．.]\s*/gm, (match, num) => {
    convertedCount++
    return `第${num}条 `
  })

  return { normalized, convertedCount }
}

/**
 * 检测文档是否需要规范化
 */
export function needsNormalization(content: string): boolean {
  const structure = analyzeDocumentStructure(content)

  // 任何一种情况都需要规范化
  return structure.confidence < 0.9 ||
         structure.formatType === 'bulleted' ||
         structure.issues.length > 0
}

/**
 * 获取规范化建议
 */
export function getNormalizationSuggestions(content: string): string[] {
  const structure = analyzeDocumentStructure(content)
  const suggestions: string[] = []

  if (!structure.hasStandardFormat) {
    suggestions.push('📋 建议使用自动规范化功能，将文档转换为标准格式')
  }

  if (structure.formatType === 'bulleted') {
    suggestions.push('✅ 检测到圆点格式，可以自动转换为"第X条"格式')
  }

  if (structure.formatType === 'numbered') {
    suggestions.push('✅ 检测到数字编号，可以自动转换为中文条款格式')
  }

  if (structure.confidence < 0.5) {
    suggestions.push('⚠️ 文档结构不清晰，建议手动检查后上传')
  }

  if (structure.issues.length > 0) {
    suggestions.push(`📝 发现 ${structure.issues.length} 个格式问题：`)
    structure.issues.forEach(issue => {
      suggestions.push(`   - ${issue}`)
    })
  }

  // 添加预期效果
  if (suggestions.length > 0) {
    suggestions.push('')
    suggestions.push('💡 规范化后的预期效果：')
    suggestions.push('   - AI识别准确率提升至95%+')
    suggestions.push('   - 聚类覆盖率显著提高')
    suggestions.push('   - 减少遗漏条款')
  }

  return suggestions
}

/**
 * 生成规范化预览（前1000字符）
 */
export function generateNormalizationPreview(content: string): {
  original: string
  normalized: string
  changes: string[]
} {
  const previewLength = 1000
  const original = content.substring(0, previewLength)
  const { normalized, changes } = normalizeDocumentFormat(content)

  return {
    original,
    normalized: normalized.substring(0, previewLength),
    changes,
  }
}
