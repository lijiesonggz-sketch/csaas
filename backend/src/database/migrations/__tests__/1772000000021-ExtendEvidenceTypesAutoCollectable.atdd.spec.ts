/**
 * ATDD Acceptance Tests — Story 1-3: evidence_types 表扩展
 *
 * These tests are written RED-first (before implementation).
 * They verify:
 *   AC-1: Migration adds auto_collectable field and replaces evidence_category enum with 8 new values
 *
 * Run: npx jest --testPathPattern="1772000000021.*atdd" --no-coverage
 */

// ---------------------------------------------------------------------------
// AC-1: Migration — ALTER TABLE evidence_types / 回滚
// ---------------------------------------------------------------------------

describe('[AC-1] ExtendEvidenceTypesAutoCollectable migration', () => {
  const loadMigration = async () => {
    const mod = await import('../1772000000021-ExtendEvidenceTypesAutoCollectable')
    const Ctor = Object.values(mod).find(
      (v) => typeof v === 'function' && /1772000000021/.test(v.name),
    ) as new () => { up: (qr: unknown) => Promise<void>; down: (qr: unknown) => Promise<void> }
    expect(Ctor).toBeDefined()
    return new Ctor()
  }

  const buildQueryRunner = (hasColumnResults: boolean[]) => ({
    hasColumn: jest.fn().mockImplementation(() => {
      return Promise.resolve(hasColumnResults.shift() ?? false)
    }),
    query: jest.fn().mockResolvedValue(undefined),
  })

  // --- UP: auto_collectable field + evidence_category enum replacement ------

  it('should add auto_collectable field as BOOLEAN NOT NULL DEFAULT false', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([false])
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).toMatch(/auto_collectable/i)
    expect(allSql).toMatch(/BOOLEAN|BOOL/i)
    expect(allSql).toMatch(/NOT NULL/i)
    expect(allSql).toMatch(/DEFAULT\s+(false|FALSE)/i)
  })

  it('should replace evidence_category enum with 8 new values', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([false])
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')

    // All 8 new category values must appear
    const newCategories = [
      'POLICY',
      'PROCESS',
      'SYSTEM',
      'LOG',
      'APPROVAL_RECORD',
      'REPORT',
      'CONFIG',
      'SAMPLE_RECORD',
    ]

    for (const cat of newCategories) {
      expect(allSql).toContain(cat)
    }
  })

  it('should update evidence_category column type/constraint', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([false])
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).toMatch(/evidence_category/i)
    // Should either ALTER TYPE or use CHECK constraint
    expect(allSql).toMatch(/ALTER|CHECK|TYPE/i)
  })

  it('should skip adding auto_collectable if column already exists', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([true])
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    // Should not attempt to add the column again
    expect(allSql).not.toMatch(/ADD COLUMN.*auto_collectable/i)
  })

  // --- DOWN: rollback -------------------------------------------------------

  it('should drop auto_collectable field on down()', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([true])
    await migration.down(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).toMatch(/DROP COLUMN.*auto_collectable/i)
  })

  it('should restore original evidence_category enum values on down()', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([true])
    await migration.down(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')

    // Original 5 values should be restored
    const originalCategories = ['document', 'log', 'approval', 'report', 'record']

    for (const cat of originalCategories) {
      expect(allSql).toContain(cat)
    }
  })

  it('should not drop auto_collectable if column does not exist on down()', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([false])
    await migration.down(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).not.toMatch(/DROP COLUMN/i)
  })
})
