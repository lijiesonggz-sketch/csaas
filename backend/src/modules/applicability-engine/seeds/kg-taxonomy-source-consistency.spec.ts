import * as fs from 'fs'
import * as path from 'path'
import * as Papa from 'papaparse'
import { loadAllRulebookManifests } from '../../case-import-orchestrator/services/taxonomy-classification/rulebooks/rulebook-manifest.loader'

type CsvRow = {
  一级编码: string
  二级编码: string
  二级子类型: string
  定义口径: string
}

const CSV_PATH = path.resolve(
  __dirname,
  '../../../../../docs/it-taxonomy-to-kg-semantic-mapping-2026-04-07.csv',
)
const SEED_PATH = path.resolve(__dirname, './data/taxonomy.seed.json')

function sortValues(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right))
}

function loadCsvL2Codes(): string[] {
  const csvText = fs.readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, '')
  const parsed = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  if (parsed.errors.length > 0) {
    throw new Error(
      `taxonomy CSV parse failed: ${parsed.errors
        .map((error) => `${error.code}@${error.row}`)
        .join(', ')}`,
    )
  }

  return sortValues(parsed.data.map((row) => row.二级编码?.trim()).filter(Boolean))
}

function loadCsvTaxonomyRows(): Array<{
  l1Code: string
  l2Code: string
  l2Name: string
  l2Desc: string
}> {
  const csvText = fs.readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, '')
  const parsed = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  if (parsed.errors.length > 0) {
    throw new Error(
      `taxonomy CSV parse failed: ${parsed.errors
        .map((error) => `${error.code}@${error.row}`)
        .join(', ')}`,
    )
  }

  return parsed.data.map((row) => ({
    l1Code: row.一级编码.trim(),
    l2Code: row.二级编码.trim(),
    l2Name: row.二级子类型.trim(),
    l2Desc: row.定义口径.trim(),
  }))
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length
}

function loadSeedL2Codes(): string[] {
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8')) as {
    l2: Array<{ l2Code: string }>
  }

  return sortValues(seed.l2.map((row) => row.l2Code))
}

function loadSeedTaxonomyRows(): Array<{
  l1Code: string
  l2Code: string
  l2Name: string
  l2Desc: string
}> {
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8')) as {
    l2: Array<{ l1Code: string; l2Code: string; l2Name: string; l2Desc?: string | null }>
  }

  return seed.l2.map((row) => ({
    l1Code: row.l1Code,
    l2Code: row.l2Code,
    l2Name: row.l2Name,
    l2Desc: row.l2Desc ?? '',
  }))
}

function loadRulebookL2Codes(): string[] {
  const rulebookManifests = Object.values(loadAllRulebookManifests())

  return sortValues(
    rulebookManifests.flatMap((rulebook) => rulebook.entries.map((entry) => entry.l2Code)),
  )
}

describe('taxonomy source consistency', () => {
  it('should keep taxonomy seed and runtime semantic mapping CSV aligned on the same L2 code universe', () => {
    const csvL2Codes = loadCsvL2Codes()
    const seedL2Codes = loadSeedL2Codes()

    expect(seedL2Codes).toEqual(csvL2Codes)
  })

  it('should ensure every rulebook L2 target exists in both taxonomy seed and runtime semantic mapping CSV', () => {
    const csvL2Codes = new Set(loadCsvL2Codes())
    const seedL2Codes = new Set(loadSeedL2Codes())
    const rulebookL2Codes = loadRulebookL2Codes()

    for (const l2Code of rulebookL2Codes) {
      expect(seedL2Codes.has(l2Code)).toBe(true)
      expect(csvL2Codes.has(l2Code)).toBe(true)
    }
  })

  it('should keep taxonomy seed and runtime semantic mapping CSV aligned on l2 naming and definition semantics', () => {
    const csvRows = loadCsvTaxonomyRows()
    const seedRows = loadSeedTaxonomyRows()

    expect(seedRows).toEqual(csvRows)
  })

  it('should reject duplicate taxonomy L2 codes in runtime semantic mapping CSV', () => {
    const csvRows = loadCsvTaxonomyRows()

    expect(hasDuplicates(csvRows.map((row) => row.l2Code))).toBe(false)
  })
})
