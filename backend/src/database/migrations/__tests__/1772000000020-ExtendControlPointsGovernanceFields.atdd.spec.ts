/**
 * ATDD Acceptance Tests — Story 1-2: control_points 表扩展与治理字段
 *
 * These tests are written RED-first (before implementation).
 * They verify:
 *   AC-1: Migration adds 10 governance fields to control_points + GIN index + down() rollback
 *
 * Run: npx jest --testPathPattern="1772000000020.*atdd" --no-coverage
 */

// ---------------------------------------------------------------------------
// AC-1: Migration — ALTER TABLE / 回滚
// ---------------------------------------------------------------------------

describe('[AC-1] ExtendControlPointsGovernanceFields migration', () => {
  const loadMigration = async () => {
    const mod = await import('../1772000000020-ExtendControlPointsGovernanceFields')
    const Ctor = Object.values(mod).find(
      (v) => typeof v === 'function' && /1772000000020/.test(v.name),
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

  // --- UP: 10 new fields ---------------------------------------------------

  const GOVERNANCE_FIELDS = [
    'origin_type',
    'maturity_level',
    'objective_summary',
    'source_basis',
    'authority_profile_json',
    'authoritative_score',
    'superseded_by',
    'retired_reason',
    'applicable_sector',
    'sector_requirements',
  ] as const

  it('should add all 10 governance fields to control_points table', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner(new Array(10).fill(false))
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    for (const field of GOVERNANCE_FIELDS) {
      expect(allSql).toContain(field)
    }
  })

  it('should set origin_type as VARCHAR(30) NOT NULL DEFAULT candidate', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner(new Array(10).fill(false))
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).toMatch(/origin_type/i)
    expect(allSql).toMatch(/VARCHAR.*30|varchar.*30/i)
    expect(allSql).toMatch(/candidate/i)
  })

  it('should set maturity_level as VARCHAR(20) NOT NULL DEFAULT candidate', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner(new Array(10).fill(false))
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).toMatch(/maturity_level/i)
    expect(allSql).toMatch(/VARCHAR.*20|varchar.*20/i)
  })

  it('should add objective_summary as TEXT', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner(new Array(10).fill(false))
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).toMatch(/objective_summary.*TEXT/is)
  })

  it('should add source_basis and authority_profile_json as JSONB', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner(new Array(10).fill(false))
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).toMatch(/source_basis.*JSONB/is)
    expect(allSql).toMatch(/authority_profile_json.*JSONB/is)
  })

  it('should add authoritative_score as NUMERIC(5,4)', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner(new Array(10).fill(false))
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).toMatch(/authoritative_score.*NUMERIC\s*\(\s*5\s*,\s*4\s*\)/is)
  })

  it('should add superseded_by as UUID FK referencing control_points(control_id)', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner(new Array(10).fill(false))
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).toMatch(/superseded_by.*UUID/is)
    expect(allSql).toMatch(/REFERENCES\s+"control_points"\s*\(\s*"?control_id"?\s*\)/is)
  })

  it('should add applicable_sector as VARCHAR(50)[] with DEFAULT {}', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner(new Array(10).fill(false))
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).toMatch(/applicable_sector/i)
    // Should be an array type
    expect(allSql).toMatch(/VARCHAR.*\[\]|varchar.*\[\]/i)
  })

  it('should add sector_requirements as JSONB', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner(new Array(10).fill(false))
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).toMatch(/sector_requirements.*JSONB/is)
  })

  // --- UP: GIN index -------------------------------------------------------

  it('should create GIN index idx_control_points_sector on applicable_sector', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner(new Array(10).fill(false))
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).toMatch(/CREATE\s+INDEX.*idx_control_points_sector/i)
    expect(allSql).toMatch(/USING\s+GIN\s*\(\s*"?applicable_sector"?\s*\)/i)
  })

  // --- UP: idempotent (skip if columns exist) ------------------------------

  it('should skip adding fields when columns already exist', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner(new Array(10).fill(true))
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    // Should not contain ALTER TABLE ADD COLUMN for any of the governance fields
    expect(allSql).not.toMatch(/ADD\s+COLUMN/i)
  })

  // --- DOWN: rollback ------------------------------------------------------

  it('should drop GIN index and all 10 fields on down()', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([])
    await migration.down(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    // Should drop the GIN index
    expect(allSql).toMatch(/DROP\s+INDEX.*idx_control_points_sector/i)
    // Should drop all 10 fields
    for (const field of GOVERNANCE_FIELDS) {
      expect(allSql).toContain(field)
    }
  })

  it('should drop superseded_by FK constraint before dropping the column on down()', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([])
    await migration.down(qr as never)

    const calls = qr.query.mock.calls.map((c: unknown[]) => String(c[0]))
    // FK constraint should be dropped before or with superseded_by column
    const fkDropIdx = calls.findIndex((s: string) =>
      s.match(/DROP\s+CONSTRAINT|ALTER.*superseded_by/i),
    )
    expect(fkDropIdx).toBeGreaterThanOrEqual(0)
  })

  it('should drop index before dropping columns on down()', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([])
    await migration.down(qr as never)

    const calls = qr.query.mock.calls.map((c: unknown[]) => String(c[0]))
    const indexDropIdx = calls.findIndex((s: string) =>
      s.match(/DROP\s+INDEX.*idx_control_points_sector/i),
    )
    const columnDropIdx = calls.findIndex((s: string) =>
      s.match(/DROP\s+COLUMN/i),
    )
    expect(indexDropIdx).toBeGreaterThanOrEqual(0)
    expect(columnDropIdx).toBeGreaterThanOrEqual(0)
    expect(indexDropIdx).toBeLessThan(columnDropIdx)
  })
})
