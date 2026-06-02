export type CoverageGranularity = 'leaf_requirement' | 'article' | 'section' | 'generated'

const CHINESE_ARTICLE_PATTERN = /第[零一二三四五六七八九十百千万\d]+条/g
const CHINESE_STRUCTURAL_PATTERN = /第[零一二三四五六七八九十百千万\d]+[章节篇]/g
const NUMERIC_SECTION_PATTERN = /^\d{1,2}(?:\.\d{1,2}){1,3}$/
const NUMERIC_LEAF_PATTERN = /^\d{1,2}(?:\.\d{1,2}){1,3}-[a-z](?:-\d{1,2})?$/

export function normalizeClauseId(value: string): string {
  if (!value) {
    return value
  }

  const compact = value
    .replace(/[．。]/g, '.')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/\s+/g, '')
    .trim()

  const alreadyCanonicalLeaf = compact.match(
    /^(\d{1,2}(?:\.\d{1,2}){1,3})-([a-zA-Z])(?:-(\d{1,2}))?$/
  )
  if (alreadyCanonicalLeaf) {
    return [alreadyCanonicalLeaf[1], alreadyCanonicalLeaf[2].toLowerCase(), alreadyCanonicalLeaf[3]]
      .filter(Boolean)
      .join('-')
  }

  const leaf = compact.match(/^(\d{1,2}(?:\.\d{1,2}){1,3})([a-zA-Z])\)(?:(\d{1,2})\))?$/)
  if (leaf) {
    return [leaf[1], leaf[2].toLowerCase(), leaf[3]].filter(Boolean).join('-')
  }

  return compact
}

export function extractClauseIdsFromContent(content: string): string[] {
  const normalizedContent = normalizeDocumentText(content)
  const sections = extractNumberedSections(normalizedContent)
  const leafIds = extractLeafRequirementIds(sections)

  if (leafIds.length > 0) {
    return unique(leafIds)
  }

  const articleIds = extractArticleIds(normalizedContent)
  if (articleIds.length > 0) {
    return unique(articleIds)
  }

  const sectionIds = sections.map((section) => normalizeClauseId(section.id))
  if (sectionIds.length > 0) {
    return unique(sectionIds)
  }

  return []
}

export function inferCoverageGranularity(
  documentClauseIds: string[],
  clusteredClauseIds: string[]
): CoverageGranularity {
  const documentIds = unique(documentClauseIds.map(normalizeClauseId).filter(Boolean))
  const clusteredIds = unique(clusteredClauseIds.map(normalizeClauseId).filter(Boolean))

  if (documentIds.some(isLeafRequirementId)) {
    return 'leaf_requirement'
  }

  if (documentIds.some(isArticleId)) {
    return 'article'
  }

  if (documentIds.some(isSectionId)) {
    return clusteredIds.some(isStructuredRequirementId) ? 'section' : 'generated'
  }

  return 'generated'
}

export function calculateCoverageFromClauseIds(
  documentClauseIds: string[],
  clusteredClauseIds: string[]
): {
  total_clauses: number
  clustered_clauses: number
  missing_clause_ids: string[]
  coverage_granularity: CoverageGranularity
} {
  const documentIds = unique(documentClauseIds.map(normalizeClauseId).filter(Boolean))
  const clusteredIds = unique(clusteredClauseIds.map(normalizeClauseId).filter(Boolean))
  const clusteredIdSet = new Set(clusteredIds)
  const documentHasLeafIds = documentIds.some(isLeafRequirementId)

  const coveredDocumentIds = documentIds.filter((documentId) => {
    if (clusteredIdSet.has(documentId)) {
      return true
    }

    if (documentHasLeafIds) {
      return false
    }

    return clusteredIds.some((clusteredId) => isDescendantOf(clusteredId, documentId))
  })

  if (documentIds.length > 0 && coveredDocumentIds.length > 0) {
    const coveredSet = new Set(coveredDocumentIds)
    return {
      total_clauses: documentIds.length,
      clustered_clauses: coveredDocumentIds.length,
      missing_clause_ids: documentIds.filter((id) => !coveredSet.has(id)),
      coverage_granularity: inferCoverageGranularity(documentIds, clusteredIds),
    }
  }

  if (clusteredIds.length > 0 && shouldUseGeneratedCoverageFallback(documentIds, clusteredIds)) {
    return {
      total_clauses: Math.max(documentIds.length, clusteredIds.length),
      clustered_clauses: clusteredIds.length,
      missing_clause_ids: [],
      coverage_granularity: 'generated',
    }
  }

  return {
    total_clauses: documentIds.length,
    clustered_clauses: 0,
    missing_clause_ids: documentIds,
    coverage_granularity: inferCoverageGranularity(documentIds, clusteredIds),
  }
}

interface NumberedSection {
  id: string
  title: string
  lines: string[]
}

function normalizeDocumentText(content: string): string {
  return (content || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[．。]/g, '.')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/(\d+)\s*[.]\s*(\d+)/g, '$1.$2')
}

function extractNumberedSections(content: string): NumberedSection[] {
  const lines = content.split('\n')
  const sections: NumberedSection[] = []
  let current: NumberedSection | null = null

  for (const rawLine of lines) {
    const line = normalizeLine(rawLine)
    const heading = parseNumberedHeading(line)

    if (heading) {
      current = {
        id: heading.id,
        title: heading.title,
        lines: [],
      }
      sections.push(current)
      continue
    }

    if (current && line) {
      current.lines.push(line)
    }
  }

  return sections
}

function parseNumberedHeading(line: string): { id: string; title: string } | null {
  if (!line || /\.{3,}|…{2,}/.test(line)) {
    return null
  }

  const match = line.match(/^(\d{1,2}(?:\.\d{1,2}){1,3})(?:\s+|$)(.*)$/)
  if (!match) {
    return null
  }

  const title = match[2].trim()
  if (!title || /^\d+$/.test(title)) {
    return null
  }

  return {
    id: normalizeClauseId(match[1]),
    title,
  }
}

function extractLeafRequirementIds(sections: NumberedSection[]): string[] {
  const ids: string[] = []

  for (const section of sections) {
    ids.push(...extractLeafRequirementIdsFromSection(section))
  }

  return ids
}

function extractLeafRequirementIdsFromSection(section: NumberedSection): string[] {
  const ids: string[] = []
  let currentLetter: string | null = null
  let currentLetterHasChildren = false
  let pendingLetterId: string | null = null

  const flushPendingLetter = () => {
    if (pendingLetterId && !currentLetterHasChildren) {
      ids.push(pendingLetterId)
    }
    pendingLetterId = null
  }

  for (const line of section.lines) {
    const letterMatch = line.match(/^([a-zA-Z])\)\s*(.+)$/)
    if (letterMatch) {
      flushPendingLetter()
      currentLetter = letterMatch[1].toLowerCase()
      currentLetterHasChildren = false
      pendingLetterId = `${section.id}-${currentLetter}`
      continue
    }

    const nestedNumberMatch = line.match(/^(\d{1,2})\)\s*(.+)$/)
    if (nestedNumberMatch && currentLetter) {
      currentLetterHasChildren = true
      ids.push(`${section.id}-${currentLetter}-${nestedNumberMatch[1]}`)
    }
  }

  flushPendingLetter()
  return ids
}

function extractArticleIds(content: string): string[] {
  const ids = new Set<string>()

  for (const pattern of [CHINESE_ARTICLE_PATTERN, CHINESE_STRUCTURAL_PATTERN]) {
    const matches = content.match(pattern) || []
    matches.forEach((match) => ids.add(normalizeClauseId(match)))
  }

  return Array.from(ids)
}

function shouldUseGeneratedCoverageFallback(
  documentIds: string[],
  clusteredIds: string[]
): boolean {
  if (documentIds.length === 0) {
    return true
  }

  return !clusteredIds.some(isStructuredRequirementId)
}

function isStructuredRequirementId(id: string): boolean {
  return isLeafRequirementId(id) || isSectionId(id) || isArticleId(id)
}

function isLeafRequirementId(id: string): boolean {
  return NUMERIC_LEAF_PATTERN.test(id)
}

function isSectionId(id: string): boolean {
  return NUMERIC_SECTION_PATTERN.test(id)
}

function isArticleId(id: string): boolean {
  return /^第[零一二三四五六七八九十百千万\d]+[条章节篇]$/.test(id)
}

function isDescendantOf(childId: string, parentId: string): boolean {
  if (!isSectionId(parentId)) {
    return false
  }

  return childId.startsWith(`${parentId}.`) || childId.startsWith(`${parentId}-`)
}

function normalizeLine(line: string): string {
  return line.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim()
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}

export function normalizeCoverageSummary<
  T extends {
    by_document?: Record<
      string,
      {
        total_clauses: number
        clustered_clauses: number
        missing_clause_ids?: string[]
        coverage_granularity?: CoverageGranularity
      }
    >
    overall?: {
      total_clauses: number
      clustered_clauses: number
      coverage_rate: number
      coverage_granularity?: CoverageGranularity
    }
  },
>(summary: T | undefined): T | undefined {
  if (!summary?.overall) return summary

  const overall = summary.overall
  if (overall.total_clauses > 0 || overall.clustered_clauses <= 0) {
    return summary
  }

  const normalizedByDocument = Object.fromEntries(
    Object.entries(summary.by_document ?? {}).map(([docId, stats]) => [
      docId,
      stats.total_clauses > 0 || stats.clustered_clauses <= 0
        ? stats
        : {
            ...stats,
            total_clauses: stats.clustered_clauses,
            missing_clause_ids: stats.missing_clause_ids ?? [],
            coverage_granularity: stats.coverage_granularity ?? 'generated',
          },
    ])
  )

  return {
    ...summary,
    by_document: normalizedByDocument,
    overall: {
      ...overall,
      total_clauses: overall.clustered_clauses,
      coverage_rate: 1,
      coverage_granularity: overall.coverage_granularity ?? 'generated',
    },
  }
}
