/**
 * ATDD Acceptance Tests — Story 1-3: control_evidence_maps 表扩展
 *
 * These tests are written RED-first (before implementation).
 * They verify:
 *   AC-2: Migration adds 3 new fields (frequency, owner_role, sampling_requirement) with enums
 *
 * Run: npx jest --testPathPattern="1772000000022.*atdd" --no-coverage
 */

// ---------------------------------------------------------------------------
// AC-2: Migration — ALTER TABLE control_evidence_maps / 回滚
// ---------------------------------------------------------------------------

describe('[AC-2] ExtendControlEvidenceMapsFrequencyOwner migration', () => {
  const loadMigration = async () => {
    const mod = await import('../1772000000022-ExtendControlEvidenceMapsFrequencyOwner')
    const Ctor = Object.values(mod).find(
      (v) => typeof v === 'function' && /1772000000022/.test(v.name),
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

  const NEW_FIELDS = ['frequency', 'owner_role', 'sampling_requirement'] as const

  // --- UP: 3 new fields -----------------------------------------------------

  it('should add all 3 new fields to control_evidence_maps table', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([false, false, false])
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    for (const field of NEW_FIELDS) {
      expect(allSql).toContain(field)
    }
  })

  it('should add frequency as VARCHAR(30) with 6 enum values', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([false, false, false])
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).toMatch(/frequency/i)
    expect(allSql).toMatch(/VARCHAR.*30|varchar.*30/i)

    // 6 frequency enum values
    const frequencies = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'EVENT_TRIGGERED']
    for (const freq of frequencies) {
      expect(allSql).toContain(freq)
    }
  })

  it('should add owner_role as VARCHAR(100)', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([false, false, false])
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).toMatch(/owner_role/i)
    expect(allSql).toMatch(/VARCHAR.*100|varchar.*100/i)
  })

  it('should add sampling_requirement as VARCHAR(50) with 3 enum values', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([false, false, false])
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).toMatch(/sampling_requirement/i)
    expect(allSql).toMatch(/VARCHAR.*50|varchar.*50/i)

    // 3 sampling requirement enum values
    const samplingReqs = ['FULL', 'SAMPLING', 'KEY_SAMPLE']
    for (const req of samplingReqs) {
      expect(allSql).toContain(req)
    }
  })

  it('should skip adding fields if they already exist', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([true, true, true])
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    // Should not attempt to add columns again
    expect(allSql).not.toMatch(/ADD COLUMN.*frequency/i)
    expect(allSql).not.toMatch(/ADD COLUMN.*owner_role/i)
    expect(allSql).not.toMatch(/ADD COLUMN.*sampling_requirement/i)
  })

  // --- DOWN: rollback -------------------------------------------------------

  it('should drop all 3 new fields on down()', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([true, true, true])
    await migration.down(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    for (const field of NEW_FIELDS) {
      expect(allSql).toMatch(new RegExp(`DROP COLUMN.*${field}`, 'i'))
    }
  })

  it('should not drop fields if they do not exist on down()', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([false, false, false])
    await migration.down(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).not.toMatch(/DROP COLUMN/i)
  })
})
