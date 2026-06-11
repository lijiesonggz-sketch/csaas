/**
 * 容错 JSON 解析工具
 * 整合 standard-interpretation.generator.ts 的 4 策略解析器，
 * 处理 AI 返回的 markdown 包裹、前后杂文本、尾逗号、截断等常见问题。
 */

type Validator = (value: any) => boolean

/**
 * 多策略容错解析。全部失败返回 null（不抛异常）。
 * @param validator 可选校验器，解析成功但校验失败时尝试下一策略
 */
export function parseJsonWithRecovery<T = any>(
  responseText: string,
  validator?: Validator,
): T | null {
  if (!responseText || typeof responseText !== 'string' || responseText.trim().length === 0) {
    return null
  }

  const strategies: Array<(text: string) => string | null> = [
    extractMarkdownBlock,
    extractCleanJson,
    extractFixedJson,
    extractObjectMatch,
  ]

  for (const strategy of strategies) {
    const candidate = strategy(responseText)
    if (!candidate) continue
    const parsed = tryParse(candidate)
    if (parsed !== null && (!validator || validator(parsed))) {
      return parsed as T
    }
    // 解析失败时尝试截断恢复
    const recovered = tryTruncateAndParse(candidate)
    if (recovered !== null && (!validator || validator(recovered))) {
      return recovered as T
    }
  }

  return null
}

function tryParse(text: string): any | null {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** 策略1：从 ```json 代码块提取 */
function extractMarkdownBlock(text: string): string | null {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/)
  return match?.[1]?.trim() || null
}

/** 策略2：整体就是 JSON */
function extractCleanJson(text: string): string | null {
  const trimmed = text.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed
  }
  return null
}

/** 策略3：截取首个 { 到最后 }，修复尾逗号 */
function extractFixedJson(text: string): string | null {
  const fixed = text.replace(/```json\s*/g, '').replace(/```\s*/g, '')
  const startIdx = fixed.indexOf('{')
  const endIdx = fixed.lastIndexOf('}')
  if (startIdx < 0 || endIdx <= startIdx) return null
  let jsonText = fixed.substring(startIdx, endIdx + 1)
  jsonText = jsonText.replace(/,\s*([}\]])/g, '$1')
  return jsonText
}

/** 策略4：贪婪匹配整个对象 */
function extractObjectMatch(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/)
  return match?.[0] || null
}

/**
 * 截断恢复：扫描括号平衡位置，从后往前尝试截断解析；
 * 仍失败则补齐缺失的闭合括号再试。
 */
function tryTruncateAndParse(jsonText: string): any | null {
  const truncatePositions: number[] = []
  let braceCount = 0
  let bracketCount = 0
  let inString = false
  let escaped = false

  for (let i = 0; i < jsonText.length; i++) {
    const char = jsonText[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (char === '{') braceCount++
    if (char === '}') braceCount--
    if (char === '[') bracketCount++
    if (char === ']') bracketCount--
    if (braceCount >= 0 && bracketCount >= 0 && (char === '}' || char === ']')) {
      truncatePositions.push(i + 1)
    }
  }

  // 从后往前尝试截断解析（截断点后补齐闭合括号）
  for (let i = truncatePositions.length - 1; i >= 0 && i >= truncatePositions.length - 20; i--) {
    const truncated = jsonText.substring(0, truncatePositions[i])
    const closed = appendMissingClosers(truncated)
    const parsed = tryParse(closed)
    if (parsed !== null) {
      return parsed
    }
  }

  // 最后兜底：整体补齐闭合括号
  return tryParse(appendMissingClosers(jsonText))
}

/** 统计未闭合的 {/[，按出现顺序补齐对应闭合符 */
function appendMissingClosers(jsonText: string): string {
  const stack: string[] = []
  let inString = false
  let escaped = false

  for (let i = 0; i < jsonText.length; i++) {
    const char = jsonText[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (char === '{') stack.push('}')
    if (char === '[') stack.push(']')
    if (char === '}' || char === ']') stack.pop()
  }

  let fixed = jsonText
  // 截断点可能停在字符串中间，先闭合字符串
  if (inString) {
    fixed += '"'
  }
  // 去掉可能的尾逗号
  fixed = fixed.replace(/,\s*$/, '')
  while (stack.length > 0) {
    fixed += stack.pop()
  }
  return fixed
}
