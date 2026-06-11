/**
 * 条款对齐工具（版本比对核心，纯函数）
 * 提取可对齐单元 → 按归一化ID精确对齐 → 指纹过滤未变 → 相似度匹配重编号
 */
import { createHash } from 'crypto'
import { extractClauseInventoryFromContent, normalizeClauseId } from './clause-id-utils'
import { normalizedSimilarity } from './text-similarity.util'

/** 相似度 ≥ 此值且正文指纹相同 → renumbered（纯移动） */
export const SIM_RENUMBERED_THRESHOLD = 0.85
/** 相似度 ≥ 此值 → 视为同一条款的修改（renumbered_modified 候选） */
export const SIM_CANDIDATE_THRESHOLD = 0.55
/** 提取条目少于此数视为非结构化文档 */
export const MIN_CLAUSE_COUNT = 5
/** 提取条目文本总长低于文档此比例视为提取不完整 */
export const MIN_COVERAGE_RATIO = 0.3
/** 段落降级时的最小段落长度 */
export const MIN_PARAGRAPH_LENGTH = 40
/** 跨桶相似度匹配的规模上限（oldOnly × newOnly） */
export const MAX_CROSS_BUCKET_PAIRS = 40000

export interface AlignableUnit {
  id: string
  text: string
  fingerprint: string
}

export interface ExtractionResult {
  units: AlignableUnit[]
  mode: 'clause' | 'paragraph'
}

export interface RenumberedPair {
  oldId: string
  newId: string
  oldText: string
  newText: string
  similarity: number
  textChanged: boolean
}

export interface AlignmentResult {
  unchanged: Array<{ id: string; text: string }>
  modified: Array<{ id: string; oldText: string; newText: string }>
  renumbered: RenumberedPair[]
  added: AlignableUnit[]
  deleted: AlignableUnit[]
}

/**
 * 指纹归一化：全角→半角、去空白、去中英文标点、小写
 */
export function normalizeForFingerprint(text: string): string {
  return (text || '')
    .replace(/[．。]/g, '.')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[，、；：""''!？?！…—·,;:'"()\[\]<>《》【】.\-]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

/** 文本指纹（sha1） */
export function computeFingerprint(text: string): string {
  return createHash('sha1').update(normalizeForFingerprint(text)).digest('hex')
}

/** 剥离条款 ID 前缀（如 "4.1.1 " / "第十二条 " / "a) "），用于正文比较 */
export function stripClauseIdPrefix(text: string): string {
  return (text || '')
    .replace(/^第[零一二三四五六七八九十百千万\d]+条[\s：:.、]*/, '')
    .replace(/^[A-Z]?\d{1,2}(?:\.\d{1,2}){0,3}(?:-[a-z](?:-\d{1,2})?)?[\s：:.、]*/, '')
    .replace(/^[a-z]\)[\s]*/, '')
    .trim()
}

/**
 * 提取可对齐单元：复用条款清单提取（叶子/法条/章节三级降级），
 * 提取不足时降级为段落模式
 */
export function extractAlignableUnits(content: string): ExtractionResult {
  const trimmed = (content || '').trim()
  if (!trimmed) {
    return { units: [], mode: 'clause' }
  }

  const inventory = extractClauseInventoryFromContent(content)
  const inventoryTextLength = inventory.reduce((sum, item) => sum + item.text.length, 0)
  const coverageOk =
    inventory.length >= MIN_CLAUSE_COUNT &&
    inventoryTextLength >= trimmed.length * MIN_COVERAGE_RATIO

  if (coverageOk) {
    return {
      units: inventory.map((item) => ({
        id: item.id,
        text: item.text,
        fingerprint: computeFingerprint(stripClauseIdPrefix(item.text)),
      })),
      mode: 'clause',
    }
  }

  return { units: extractParagraphUnits(trimmed), mode: 'paragraph' }
}

/** 段落降级：按空行切段，短行并入前段 */
function extractParagraphUnits(content: string): AlignableUnit[] {
  const rawBlocks = content
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const merged: string[] = []
  for (const block of rawBlocks) {
    if (block.length < MIN_PARAGRAPH_LENGTH && merged.length > 0) {
      merged[merged.length - 1] += ' ' + block
    } else {
      merged.push(block)
    }
  }

  return merged.map((text, index) => ({
    id: `P${index + 1}`,
    text,
    fingerprint: computeFingerprint(text),
  }))
}

/**
 * 对齐两版单元：
 * 1) 归一化ID精确匹配 → 同ID对（指纹同=unchanged，异=modified）
 * 2) 未匹配集合做相似度匹配 → renumbered / 真增 / 真删
 */
export function alignUnits(oldUnits: AlignableUnit[], newUnits: AlignableUnit[]): AlignmentResult {
  const result: AlignmentResult = {
    unchanged: [],
    modified: [],
    renumbered: [],
    added: [],
    deleted: [],
  }

  const newById = new Map<string, AlignableUnit>()
  newUnits.forEach((unit) => newById.set(normalizeClauseId(unit.id), unit))

  const oldOnly: AlignableUnit[] = []
  const matchedNewIds = new Set<string>()

  for (const oldUnit of oldUnits) {
    const normalizedId = normalizeClauseId(oldUnit.id)
    const newUnit = newById.get(normalizedId)
    if (newUnit) {
      matchedNewIds.add(normalizedId)
      if (oldUnit.fingerprint === newUnit.fingerprint) {
        result.unchanged.push({ id: newUnit.id, text: newUnit.text })
      } else {
        result.modified.push({ id: newUnit.id, oldText: oldUnit.text, newText: newUnit.text })
      }
    } else {
      oldOnly.push(oldUnit)
    }
  }

  const newOnly = newUnits.filter((unit) => !matchedNewIds.has(normalizeClauseId(unit.id)))

  // 相似度二次匹配（重编号兜底）
  const { renumbered, unmatchedOld, unmatchedNew } = matchRenumbered(oldOnly, newOnly)
  result.renumbered = renumbered
  result.deleted = unmatchedOld
  result.added = unmatchedNew

  return result
}

interface CandidatePair {
  oldIndex: number
  newIndex: number
  similarity: number
}

/** 取顶级章节号作为桶键（"4.1.2"→"4"，"第十二条"→"article"，段落→"para"） */
function bucketKey(id: string): string {
  const numeric = id.match(/^[A-Z]?(\d{1,2})(?:[.\-]|$)/)
  if (numeric) return numeric[1]
  if (/^P\d+$/.test(id)) return 'para'
  return 'article'
}

/**
 * 重编号匹配：计算相似度候选对，贪心取全局最大，每单元只配一次。
 * 规模超限时只做同桶匹配。
 */
function matchRenumbered(
  oldOnly: AlignableUnit[],
  newOnly: AlignableUnit[],
): { renumbered: RenumberedPair[]; unmatchedOld: AlignableUnit[]; unmatchedNew: AlignableUnit[] } {
  if (oldOnly.length === 0 || newOnly.length === 0) {
    return { renumbered: [], unmatchedOld: oldOnly, unmatchedNew: newOnly }
  }

  const sameBucketOnly = oldOnly.length * newOnly.length > MAX_CROSS_BUCKET_PAIRS
  const candidates: CandidatePair[] = []

  for (let i = 0; i < oldOnly.length; i++) {
    const oldBody = stripClauseIdPrefix(oldOnly[i].text)
    const oldBucket = bucketKey(normalizeClauseId(oldOnly[i].id))
    for (let j = 0; j < newOnly.length; j++) {
      if (sameBucketOnly && bucketKey(normalizeClauseId(newOnly[j].id)) !== oldBucket) {
        continue
      }
      const similarity = normalizedSimilarity(oldBody, stripClauseIdPrefix(newOnly[j].text))
      if (similarity >= SIM_CANDIDATE_THRESHOLD) {
        candidates.push({ oldIndex: i, newIndex: j, similarity })
      }
    }
  }

  // 贪心：按相似度降序锁定，同桶优先（相似度相同时）
  candidates.sort((a, b) => b.similarity - a.similarity)
  const usedOld = new Set<number>()
  const usedNew = new Set<number>()
  const renumbered: RenumberedPair[] = []

  for (const pair of candidates) {
    if (usedOld.has(pair.oldIndex) || usedNew.has(pair.newIndex)) continue
    usedOld.add(pair.oldIndex)
    usedNew.add(pair.newIndex)
    const oldUnit = oldOnly[pair.oldIndex]
    const newUnit = newOnly[pair.newIndex]
    const textChanged = oldUnit.fingerprint !== newUnit.fingerprint
    renumbered.push({
      oldId: oldUnit.id,
      newId: newUnit.id,
      oldText: oldUnit.text,
      newText: newUnit.text,
      similarity: Math.round(pair.similarity * 100) / 100,
      textChanged,
    })
  }

  return {
    renumbered,
    unmatchedOld: oldOnly.filter((_, i) => !usedOld.has(i)),
    unmatchedNew: newOnly.filter((_, j) => !usedNew.has(j)),
  }
}
