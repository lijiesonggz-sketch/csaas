export type CoverageGranularity = 'leaf_requirement' | 'article' | 'section' | 'generated'

const CHINESE_ARTICLE_PATTERN = /第[零一二三四五六七八九十百千万\d]+条/g
const CHINESE_STRUCTURAL_PATTERN = /第[零一二三四五六七八九十百千万\d]+[章节篇]/g
const STRUCTURED_SECTION_ID_SOURCE = String.raw`(?:\d{1,2}(?:\.\d{1,2}){1,3}|[A-Z](?:\.\d{1,2}){1,4})`
const STRUCTURED_SECTION_PATTERN = new RegExp(`^${STRUCTURED_SECTION_ID_SOURCE}$`)
const STRUCTURED_LEAF_PATTERN = new RegExp(`^${STRUCTURED_SECTION_ID_SOURCE}-[a-z](?:-\\d{1,2})?$`)

export interface StructuredLeafRequirement {
  id: string
  sectionId: string
  sectionTitle: string
  text: string
}

export interface StructuredRequirementSection {
  id: string
  title: string
  parentId?: string
  parentTitle?: string
  requirements: StructuredLeafRequirement[]
}

export interface ClauseInventoryItem {
  id: string
  text: string
}

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
    new RegExp(`^(${STRUCTURED_SECTION_ID_SOURCE})-([a-zA-Z])(?:-(\\d{1,2}))?$`, 'i'),
  )
  if (alreadyCanonicalLeaf) {
    return [
      normalizeSectionId(alreadyCanonicalLeaf[1]),
      alreadyCanonicalLeaf[2].toLowerCase(),
      alreadyCanonicalLeaf[3],
    ]
      .filter(Boolean)
      .join('-')
  }

  const leaf = compact.match(
    new RegExp(`^(${STRUCTURED_SECTION_ID_SOURCE})([a-zA-Z])\\)(?:(\\d{1,2})\\))?$`, 'i'),
  )
  if (leaf) {
    return [normalizeSectionId(leaf[1]), leaf[2].toLowerCase(), leaf[3]].filter(Boolean).join('-')
  }

  return normalizeSectionId(compact)
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

export function extractClauseInventoryFromContent(content: string): ClauseInventoryItem[] {
  const structuredSections = extractStructuredLeafRequirementsFromContent(content)
  const leafItems = structuredSections.flatMap((section) =>
    section.requirements.map((requirement) => ({
      id: normalizeClauseId(requirement.id),
      text: formatInventoryText(requirement.text),
    })),
  )

  if (leafItems.length > 0) {
    return uniqueInventoryItems(leafItems)
  }

  const normalizedContent = normalizeDocumentText(content)
  const articleItems = extractArticleInventory(normalizedContent)
  if (articleItems.length > 0) {
    return uniqueInventoryItems(articleItems)
  }

  const sectionItems = extractNumberedSectionsWithRawLines(content).map((section) => ({
    id: normalizeClauseId(section.id),
    text: formatInventoryText(
      [`${section.id} ${section.title}`, ...section.lines.map((line) => line.raw)].join('\n'),
    ),
  }))

  return uniqueInventoryItems(sectionItems)
}

export function extractStructuredLeafRequirementsFromContent(
  content: string,
): StructuredRequirementSection[] {
  const sections = extractNumberedSectionsWithRawLines(content)
  const titleBySectionId = new Map(sections.map((section) => [section.id, section.title]))

  return sections
    .map((section) => {
      const requirements = mergeDuplicateStructuredRequirements(
        extractLeafRequirementsFromStructuredSection(section),
      )
      const parentId = findNearestParentSectionId(section.id, titleBySectionId)

      return {
        id: section.id,
        title: section.title,
        parentId,
        parentTitle: parentId ? titleBySectionId.get(parentId) : undefined,
        requirements,
      }
    })
    .filter((section) => section.requirements.length > 0)
}

export function inferCoverageGranularity(
  documentClauseIds: string[],
  clusteredClauseIds: string[],
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
  clusteredClauseIds: string[],
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

interface StructuredSectionLine {
  raw: string
  normalized: string
}

interface StructuredNumberedSection {
  id: string
  title: string
  lines: StructuredSectionLine[]
}

function normalizeDocumentText(content: string): string {
  const normalized = (content || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[．。]/g, '.')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')

  return normalizeDottedSectionSpacing(normalized)
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

    if (isTopLevelNumberedHeading(line) || isAppendixBreakLine(line)) {
      current = null
      continue
    }

    if (current && line) {
      current.lines.push(line)
    }
  }

  return sections
}

function extractNumberedSectionsWithRawLines(content: string): StructuredNumberedSection[] {
  const lines = (content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const sections: StructuredNumberedSection[] = []
  let current: StructuredNumberedSection | null = null

  for (const rawLine of lines) {
    const raw = normalizeRawLine(rawLine)
    const normalized = normalizeLine(normalizeDocumentText(rawLine))
    const heading = parseNumberedHeading(normalized)

    if (heading) {
      current = {
        id: heading.id,
        title: heading.title,
        lines: [],
      }
      sections.push(current)
      continue
    }

    if (isTopLevelNumberedHeading(normalized) || isAppendixBreakLine(normalized)) {
      current = null
      continue
    }

    if (isDocumentArtifactLine(normalized)) {
      continue
    }

    if (current && normalized) {
      current.lines.push({ raw, normalized })
    }
  }

  return sections
}

function parseNumberedHeading(line: string): { id: string; title: string } | null {
  if (!line || /\.{3,}|…{2,}/.test(line)) {
    return null
  }

  const match = line.match(new RegExp(`^(${STRUCTURED_SECTION_ID_SOURCE})(?:\\s+|$)(.*)$`, 'i'))
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

function isTopLevelNumberedHeading(line: string): boolean {
  if (!line || /\.{3,}|…{2,}/.test(line)) {
    return false
  }

  const match = line.match(/^(\d{1,2})(?:\s+|$)(.+)$/)
  if (!match) {
    return false
  }

  const title = match[2].trim()
  return Boolean(title && !/^\d+$/.test(title))
}

function isAppendixBreakLine(line: string): boolean {
  return /^附\s*录\s*[A-Z](?:\s|$)/i.test(line) || /^[A-Z]\s+附录(?:\s|$)/i.test(line)
}

function isDocumentArtifactLine(line: string): boolean {
  const compact = line.replace(/\s+/g, '')

  return (
    /^--\s*\d+\s+of\s+\d+\s*--$/i.test(line) ||
    /^GB\/T[\dA-Z]+[—-][\dA-Z]+$/i.test(compact) ||
    /^\d{1,3}$/.test(line)
  )
}

function extractLeafRequirementIds(sections: NumberedSection[]): string[] {
  const ids: string[] = []

  for (const section of sections) {
    ids.push(...extractLeafRequirementIdsFromSection(section))
  }

  return ids
}

function extractLeafRequirementIdsFromSection(section: NumberedSection): string[] {
  return extractLeafRequirementsFromSection(section).map((requirement) => requirement.id)
}

function extractLeafRequirementsFromSection(section: NumberedSection): StructuredLeafRequirement[] {
  const requirements: StructuredLeafRequirement[] = []
  const lines = section.lines

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const letterMatch = line.match(/^([a-zA-Z])\)\s*(.+)$/)
    if (!letterMatch) {
      continue
    }

    const letterId = letterMatch[1].toLowerCase()
    const nextLetterIndex = findNextLineIndex(lines, index + 1, (candidate) =>
      /^([a-zA-Z])\)\s*(.+)$/.test(candidate),
    )
    const letterLines = lines.slice(index, nextLetterIndex > -1 ? nextLetterIndex : lines.length)
    const nestedNumberIndexes = letterLines
      .map((candidate, candidateIndex) => ({
        candidateIndex,
        match: candidate.match(/^(\d{1,2})\)\s*(.+)$/),
      }))
      .filter((candidate) => candidate.match)

    if (nestedNumberIndexes.length === 0) {
      requirements.push({
        id: `${section.id}-${letterId}`,
        sectionId: section.id,
        sectionTitle: section.title,
        text: joinRequirementLines(letterLines),
      })
      continue
    }

    nestedNumberIndexes.forEach((nestedNumber, nestedIndex) => {
      const nestedNumberId = nestedNumber.match![1]
      const nextNestedNumber = nestedNumberIndexes[nestedIndex + 1]
      const nestedLines = letterLines.slice(
        nestedNumber.candidateIndex,
        nextNestedNumber ? nextNestedNumber.candidateIndex : letterLines.length,
      )

      requirements.push({
        id: `${section.id}-${letterId}-${nestedNumberId}`,
        sectionId: section.id,
        sectionTitle: section.title,
        text: joinRequirementLines([letterLines[0], ...nestedLines]),
      })
    })
  }

  return requirements
}

function extractLeafRequirementsFromStructuredSection(
  section: StructuredNumberedSection,
): StructuredLeafRequirement[] {
  const requirements: StructuredLeafRequirement[] = []
  const lines = section.lines

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const letterMatch = line.normalized.match(/^([a-zA-Z])\)\s*(.+)$/)
    if (!letterMatch) {
      continue
    }

    const letterId = letterMatch[1].toLowerCase()
    const nextLetterIndex = findNextStructuredLineIndex(lines, index + 1, (candidate) =>
      /^([a-zA-Z])\)\s*(.+)$/.test(candidate.normalized),
    )
    const letterLines = lines.slice(index, nextLetterIndex > -1 ? nextLetterIndex : lines.length)
    const nestedNumberIndexes = letterLines
      .map((candidate, candidateIndex) => ({
        candidateIndex,
        match: candidate.normalized.match(/^(\d{1,2})\)\s*(.+)$/),
      }))
      .filter((candidate) => candidate.match)

    if (nestedNumberIndexes.length === 0) {
      requirements.push({
        id: `${section.id}-${letterId}`,
        sectionId: section.id,
        sectionTitle: section.title,
        text: joinStructuredRequirementLines(letterLines),
      })
      continue
    }

    nestedNumberIndexes.forEach((nestedNumber, nestedIndex) => {
      const nestedNumberId = nestedNumber.match![1]
      const nextNestedNumber = nestedNumberIndexes[nestedIndex + 1]
      const nestedLines = letterLines.slice(
        nestedNumber.candidateIndex,
        nextNestedNumber ? nextNestedNumber.candidateIndex : letterLines.length,
      )

      requirements.push({
        id: `${section.id}-${letterId}-${nestedNumberId}`,
        sectionId: section.id,
        sectionTitle: section.title,
        text: joinStructuredRequirementLines([letterLines[0], ...nestedLines]),
      })
    })
  }

  return requirements
}

function mergeDuplicateStructuredRequirements(
  requirements: StructuredLeafRequirement[],
): StructuredLeafRequirement[] {
  const merged: StructuredLeafRequirement[] = []
  const byId = new Map<string, StructuredLeafRequirement>()

  for (const requirement of requirements) {
    const id = normalizeClauseId(requirement.id)
    const normalizedRequirement = {
      ...requirement,
      id,
    }
    const existing = byId.get(id)

    if (!existing) {
      byId.set(id, normalizedRequirement)
      merged.push(normalizedRequirement)
      continue
    }

    if (normalizedRequirement.text && !existing.text.includes(normalizedRequirement.text)) {
      existing.text = [existing.text, normalizedRequirement.text].filter(Boolean).join('\n')
    }
  }

  return merged
}

function findNextLineIndex(
  lines: string[],
  startIndex: number,
  predicate: (line: string) => boolean,
): number {
  for (let index = startIndex; index < lines.length; index++) {
    if (predicate(lines[index])) {
      return index
    }
  }

  return -1
}

function findNextStructuredLineIndex(
  lines: StructuredSectionLine[],
  startIndex: number,
  predicate: (line: StructuredSectionLine) => boolean,
): number {
  for (let index = startIndex; index < lines.length; index++) {
    if (predicate(lines[index])) {
      return index
    }
  }

  return -1
}

function joinRequirementLines(lines: string[]): string {
  return lines.filter(Boolean).join('\n').trim()
}

function joinStructuredRequirementLines(lines: StructuredSectionLine[]): string {
  return lines
    .map((line) => line.raw)
    .filter(Boolean)
    .join('\n')
    .trim()
}

function findNearestParentSectionId(
  sectionId: string,
  titleBySectionId: Map<string, string>,
): string | undefined {
  const parts = sectionId.split('.')

  while (parts.length > 1) {
    parts.pop()
    const candidate = parts.join('.')
    if (titleBySectionId.has(candidate)) {
      return candidate
    }
  }

  return undefined
}

function extractArticleIds(content: string): string[] {
  const ids = new Set<string>()

  for (const pattern of [CHINESE_ARTICLE_PATTERN, CHINESE_STRUCTURAL_PATTERN]) {
    const matches = content.match(pattern) || []
    matches.forEach((match) => ids.add(normalizeClauseId(match)))
  }

  return Array.from(ids)
}

function extractArticleInventory(content: string): ClauseInventoryItem[] {
  const matches = Array.from(content.matchAll(/第[零一二三四五六七八九十百千万\d]+[条章节篇]/g))

  return matches.map((match, index) => {
    const startIndex = match.index ?? 0
    const nextMatch = matches[index + 1]
    const endIndex = nextMatch?.index ?? content.length

    return {
      id: normalizeClauseId(match[0]),
      text: formatInventoryText(content.substring(startIndex, endIndex)),
    }
  })
}

function formatInventoryText(text: string): string {
  return (text || '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniqueInventoryItems(items: ClauseInventoryItem[]): ClauseInventoryItem[] {
  const byId = new Map<string, ClauseInventoryItem>()

  for (const item of items) {
    const id = normalizeClauseId(item.id)
    if (id && !byId.has(id)) {
      byId.set(id, {
        id,
        text: item.text,
      })
    }
  }

  return Array.from(byId.values())
}

function shouldUseGeneratedCoverageFallback(
  documentIds: string[],
  clusteredIds: string[],
): boolean {
  if (documentIds.length === 0) {
    return true
  }

  if (documentIds.some((id) => isLeafRequirementId(id) || isArticleId(id))) {
    return false
  }

  return !clusteredIds.some(isStructuredRequirementId)
}

function isStructuredRequirementId(id: string): boolean {
  return isLeafRequirementId(id) || isSectionId(id) || isArticleId(id)
}

function isLeafRequirementId(id: string): boolean {
  return STRUCTURED_LEAF_PATTERN.test(normalizeClauseId(id))
}

function isSectionId(id: string): boolean {
  return STRUCTURED_SECTION_PATTERN.test(normalizeClauseId(id))
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

function normalizeRawLine(line: string): string {
  return line.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalizeDottedSectionSpacing(text: string): string {
  return text.replace(/([A-Za-z0-9])\s*[.]\s*(?=\d)/g, '$1.')
}

function normalizeSectionId(value: string): string {
  return value.replace(/^([a-zA-Z])(?=\.)/, (letter) => letter.toUpperCase())
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}
