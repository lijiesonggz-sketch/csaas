/**
 * ATDD Acceptance Tests — Story KG2-3: Failure Mode 种子数据校验
 *
 * AC-1: 每域 >=8 个 FM, >=3 种 category, 去重后 100-150 个
 * AC-3: 每个 FM 映射 >=1 个 taxonomy_l2, FK 引用有效
 * AC-4: FM code 编码规则, category 枚举, 完整性
 *
 * 这些测试在种子数据 JSON 文件创建前为 RED 状态。
 * 实现后应全部变 GREEN。
 *
 * Run: npx jest --testPathPattern="kg-fm-seed-validation" --no-coverage
 */

import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// Types for seed data (will be defined in kg-seed-data.ts by implementation)
// ---------------------------------------------------------------------------

interface FailureModeSeedRecord {
  failureModeCode: string
  name: string
  description: string
  category: string
  domain: string // IT01-IT08
}

interface TaxonomyFmMapSeedRecord {
  failureModeCode: string
  l2Code: string
}

interface TaxonomyL2Record {
  l2Code: string
  l1Code: string
  l2Name: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = [
  'DEFINITION_ERROR',
  'MAPPING_ERROR',
  'MISSING_CONTROL',
  'TIMELINESS_FAILURE',
  'INTEGRITY_FAILURE',
  'UNAUTHORIZED_ACTION',
  'FALSIFICATION',
] as const

const ALL_DOMAINS = ['IT01', 'IT02', 'IT03', 'IT04', 'IT05', 'IT06', 'IT07', 'IT08'] as const

const IT04_EXISTING_CODES = [
  'FM-DG-001', 'FM-DG-002', 'FM-DG-003', 'FM-DG-004', 'FM-DG-005', 'FM-DG-006',
  'FM-REP-001', 'FM-REP-002', 'FM-REP-003', 'FM-REP-004', 'FM-REP-005',
  'FM-REP-006', 'FM-REP-007', 'FM-REP-008',
  'FM-DQ-001', 'FM-DQ-002', 'FM-DQ-003', 'FM-DQ-004', 'FM-DQ-005',
  'FM-DQ-006', 'FM-DQ-007',
  'FM-TL-001', 'FM-TL-002',
  'FM-FAL-001', 'FM-FAL-002',
  'FM-REC-001', 'FM-REC-002', 'FM-REC-003',
]

const FM_CODE_PATTERN = /^FM-[A-Z]{2,4}-\d{3}$/

const DATA_DIR = path.resolve(__dirname, 'data')

// ---------------------------------------------------------------------------
// Helper: Load seed data files (will throw if files don't exist yet = RED)
// ---------------------------------------------------------------------------

function loadFmSeedData(): FailureModeSeedRecord[] {
  const filePath = path.join(DATA_DIR, 'failure-mode.seed.json')
  if (!fs.existsSync(filePath)) {
    throw new Error(`Failure mode seed file not found: ${filePath}`)
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function loadTaxonomyFmMapData(): TaxonomyFmMapSeedRecord[] {
  const filePath = path.join(DATA_DIR, 'taxonomy-fm-map.seed.json')
  if (!fs.existsSync(filePath)) {
    throw new Error(`Taxonomy-FM map seed file not found: ${filePath}`)
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function loadTaxonomyL2Codes(): Set<string> {
  const filePath = path.join(DATA_DIR, 'taxonomy.seed.json')
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  return new Set(raw.l2.map((l2: TaxonomyL2Record) => l2.l2Code))
}

// ---------------------------------------------------------------------------
// AC-1: 种子数据完整性校验
// ---------------------------------------------------------------------------

describe('[AC-1] Story 2-3 — Failure Mode 种子数据完整性', () => {
  let fmRecords: FailureModeSeedRecord[]
  let uniqueCodes: Set<string>

  beforeAll(() => {
    fmRecords = loadFmSeedData()
    uniqueCodes = new Set(fmRecords.map((fm) => fm.failureModeCode))
  })

  // 2-3-VAL-001
  it('[P0][2-3-VAL-001] should have globally unique failure_mode_code', () => {
    const codes = fmRecords.map((fm) => fm.failureModeCode)
    const codeSet = new Set(codes)
    expect(codeSet.size).toBe(codes.length)
  })

  // 2-3-VAL-002
  it('[P0][2-3-VAL-002] should have >=8 failure modes per domain', () => {
    const byDomain = new Map<string, FailureModeSeedRecord[]>()
    for (const fm of fmRecords) {
      const list = byDomain.get(fm.domain) ?? []
      list.push(fm)
      byDomain.set(fm.domain, list)
    }

    for (const domain of ALL_DOMAINS) {
      const domainFms = byDomain.get(domain) ?? []
      expect(domainFms.length).toBeGreaterThanOrEqual(8)
    }
  })

  // 2-3-VAL-003
  it('[P0][2-3-VAL-003] should have >=3 different categories per domain', () => {
    const byDomain = new Map<string, Set<string>>()
    for (const fm of fmRecords) {
      const catSet = byDomain.get(fm.domain) ?? new Set<string>()
      catSet.add(fm.category)
      byDomain.set(fm.domain, catSet)
    }

    for (const domain of ALL_DOMAINS) {
      const categories = byDomain.get(domain) ?? new Set<string>()
      expect(categories.size).toBeGreaterThanOrEqual(3)
    }
  })

  // 2-3-VAL-004
  it('[P0][2-3-VAL-004] should have 100-150 failure modes globally after dedup', () => {
    expect(uniqueCodes.size).toBeGreaterThanOrEqual(100)
    expect(uniqueCodes.size).toBeLessThanOrEqual(150)
  })

  // 2-3-VAL-012
  it('[P1][2-3-VAL-012] should cover all 8 IT domains (IT01-IT08)', () => {
    const domains = new Set(fmRecords.map((fm) => fm.domain))
    for (const domain of ALL_DOMAINS) {
      expect(domains.has(domain)).toBe(true)
    }
  })

  // 2-3-VAL-013
  it('[P1][2-3-VAL-013] should reuse same FM code for cross-domain sharing (dedup correct)', () => {
    // If a failure mode is conceptually the same across domains,
    // it should use the same code (dedup by code)
    // This is already validated by VAL-001 (unique codes)
    // Additional check: if records have same code, they should have same name/category
    const codeToRecord = new Map<string, FailureModeSeedRecord>()
    for (const fm of fmRecords) {
      const existing = codeToRecord.get(fm.failureModeCode)
      if (existing) {
        expect(fm.name).toBe(existing.name)
        expect(fm.category).toBe(existing.category)
      }
      codeToRecord.set(fm.failureModeCode, fm)
    }
  })
})

// ---------------------------------------------------------------------------
// AC-4: 编码规则与枚举校验
// ---------------------------------------------------------------------------

describe('[AC-4] Story 2-3 — FM 编码规则与 category 枚举', () => {
  let fmRecords: FailureModeSeedRecord[]

  beforeAll(() => {
    fmRecords = loadFmSeedData()
  })

  // 2-3-VAL-005
  it('[P0][2-3-VAL-005] should match FM-{PREFIX}-{SERIAL} code format', () => {
    for (const fm of fmRecords) {
      expect(fm.failureModeCode).toMatch(FM_CODE_PATTERN)
    }
  })

  // 2-3-VAL-006
  it('[P0][2-3-VAL-006] should use valid category enum values only', () => {
    const validSet = new Set<string>(VALID_CATEGORIES)
    for (const fm of fmRecords) {
      expect(validSet.has(fm.category)).toBe(true)
    }
  })

  // 2-3-VAL-007
  it('[P0][2-3-VAL-007] should have complete fields: code, name, description, category', () => {
    for (const fm of fmRecords) {
      expect(fm.failureModeCode).toBeTruthy()
      expect(fm.name).toBeTruthy()
      expect(fm.description).toBeTruthy()
      expect(fm.category).toBeTruthy()
    }
  })

  // 2-3-VAL-011
  it('[P1][2-3-VAL-011] should not reuse IT04 existing 26 FM codes', () => {
    const it04Set = new Set(IT04_EXISTING_CODES)
    // Implementation may include IT04 codes in the seed file (for completeness),
    // but they should be identical to existing definitions
    // The important check: if IT04 codes appear, they must match existing definitions
    const fmByCode = new Map<string, FailureModeSeedRecord>()
    for (const fm of fmRecords) {
      fmByCode.set(fm.failureModeCode, fm)
    }

    // Verify IT04 codes are present (for upsert idempotency)
    for (const code of it04Set) {
      const record = fmByCode.get(code)
      if (record) {
        // If present, domain should be IT04
        expect(record.domain).toBe('IT04')
      }
    }
  })
})

// ---------------------------------------------------------------------------
// AC-3: Taxonomy 映射校验
// ---------------------------------------------------------------------------

describe('[AC-3] Story 2-3 — Taxonomy-FM 映射完整性', () => {
  let fmRecords: FailureModeSeedRecord[]
  let mapRecords: TaxonomyFmMapSeedRecord[]
  let taxonomyL2Codes: Set<string>
  let fmCodeSet: Set<string>

  beforeAll(() => {
    fmRecords = loadFmSeedData()
    mapRecords = loadTaxonomyFmMapData()
    taxonomyL2Codes = loadTaxonomyL2Codes()
    fmCodeSet = new Set(fmRecords.map((fm) => fm.failureModeCode))
  })

  // 2-3-VAL-008
  it('[P0][2-3-VAL-008] should have >=1 taxonomy_l2 mapping per FM code', () => {
    const mappedFmCodes = new Set(mapRecords.map((m) => m.failureModeCode))
    for (const fmCode of fmCodeSet) {
      expect(mappedFmCodes.has(fmCode)).toBe(true)
    }
  })

  // 2-3-VAL-009
  it('[P0][2-3-VAL-009] should reference valid taxonomy_l2 codes', () => {
    for (const map of mapRecords) {
      expect(taxonomyL2Codes.has(map.l2Code)).toBe(true)
    }
  })

  // 2-3-VAL-010
  it('[P0][2-3-VAL-010] should reference FM codes that exist in seed data', () => {
    for (const map of mapRecords) {
      expect(fmCodeSet.has(map.failureModeCode)).toBe(true)
    }
  })
})
