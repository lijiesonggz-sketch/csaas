/**
 * ATDD Acceptance Tests — Story 1-1: 失效模式核心表结构建立
 *
 * These tests are written RED-first (before implementation).
 * They verify:
 *   AC-1: Migration creates 3 tables with enums, FKs, unique constraints, indexes, and down() rollback
 *   AC-2: Entities express all fields, enum constraints, and relations (@ManyToOne/@OneToMany)
 *   AC-3: DTOs use class-validator with @IsEnum() for enum fields
 *
 * Run: npx jest --testPathPattern="1772000000019.*atdd" --no-coverage
 */

// ---------------------------------------------------------------------------
// AC-1: Migration — 建表 / 回滚
// ---------------------------------------------------------------------------

describe('[AC-1] CreateKGFailureModeCoreTables migration', () => {
  // We import lazily so the test file itself compiles even before the
  // migration source file exists (RED phase).
  const loadMigration = async () => {
    const mod = await import('../1772000000019-CreateKGFailureModeCoreTables')
    const Ctor = Object.values(mod).find(
      (v) => typeof v === 'function' && /1772000000019/.test(v.name),
    ) as new () => { up: (qr: unknown) => Promise<void>; down: (qr: unknown) => Promise<void> }
    expect(Ctor).toBeDefined()
    return new Ctor()
  }

  const buildQueryRunner = (hasTableResults: boolean[]) => ({
    hasTable: jest.fn().mockImplementation(() => {
      return Promise.resolve(hasTableResults.shift() ?? false)
    }),
    query: jest.fn().mockResolvedValue(undefined),
  })

  // --- UP -------------------------------------------------------------------

  it('should create failure_modes table with category enum values', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([false, false, false])
    await migration.up(qr as never)

    expect(qr.query).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE "failure_modes"'))
    // 7 category enum values must appear somewhere in the CREATE or as a CHECK/type
    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    for (const cat of [
      'DEFINITION_ERROR',
      'MAPPING_ERROR',
      'MISSING_CONTROL',
      'TIMELINESS_FAILURE',
      'INTEGRITY_FAILURE',
      'UNAUTHORIZED_ACTION',
      'FALSIFICATION',
    ]) {
      expect(allSql).toContain(cat)
    }
  })

  it('should create failure_modes with failure_mode_id PK and failure_mode_code UNIQUE', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([false, false, false])
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).toContain('failure_mode_id')
    expect(allSql).toContain('failure_mode_code')
    expect(allSql).toMatch(/UNIQUE.*failure_mode_code|failure_mode_code.*UNIQUE/is)
  })

  it('should create taxonomy_failure_mode_maps with l2_code FK and updated_at', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([false, false, false])
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).toContain('CREATE TABLE "taxonomy_failure_mode_maps"')
    expect(allSql).toContain('l2_code')
    expect(allSql).toMatch(/REFERENCES\s+"taxonomy_l2"/i)
    expect(allSql).toContain('updated_at')
  })

  it('should create taxonomy_failure_mode_maps with (l2_code, failure_mode_id) UNIQUE constraint', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([false, false, false])
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    // Unique on the pair
    expect(allSql).toMatch(/UNIQUE.*l2_code.*failure_mode_id|UNIQUE.*failure_mode_id.*l2_code/is)
  })

  it('should create failure_mode_control_maps with relevance enum (PRIMARY/SECONDARY)', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([false, false, false])
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).toContain('CREATE TABLE "failure_mode_control_maps"')
    expect(allSql).toContain('PRIMARY')
    expect(allSql).toContain('SECONDARY')
    expect(allSql).toContain('relevance')
  })

  it('should create failure_mode_control_maps with (failure_mode_id, control_id) UNIQUE and updated_at', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([false, false, false])
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).toMatch(/UNIQUE.*failure_mode_id.*control_id|UNIQUE.*control_id.*failure_mode_id/is)
    expect(allSql).toContain('updated_at')
  })

  it('should create indexes on mapping tables', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([false, false, false])
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    // taxonomy_failure_mode_maps indexes
    expect(allSql).toMatch(/CREATE INDEX.*taxonomy_failure_mode_maps|idx_tfm/i)
    // failure_mode_control_maps indexes
    expect(allSql).toMatch(/CREATE INDEX.*failure_mode_control_maps|idx_fmcm/i)
  })

  it('should skip table creation when tables already exist', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([true, true, true])
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).not.toContain('CREATE TABLE "failure_modes"')
    expect(allSql).not.toContain('CREATE TABLE "taxonomy_failure_mode_maps"')
    expect(allSql).not.toContain('CREATE TABLE "failure_mode_control_maps"')
  })

  // --- DOWN -----------------------------------------------------------------

  it('should drop all 3 tables and indexes in reverse order on down()', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([true, true, true])
    await migration.down(qr as never)

    const calls = qr.query.mock.calls.map((c: unknown[]) => String(c[0]))

    // failure_mode_control_maps dropped before taxonomy_failure_mode_maps before failure_modes
    const dropFmcm = calls.findIndex((s: string) => s.includes('DROP TABLE "failure_mode_control_maps"'))
    const dropTfm = calls.findIndex((s: string) => s.includes('DROP TABLE "taxonomy_failure_mode_maps"'))
    const dropFm = calls.findIndex((s: string) => s.includes('DROP TABLE "failure_modes"'))

    expect(dropFmcm).toBeGreaterThanOrEqual(0)
    expect(dropTfm).toBeGreaterThanOrEqual(0)
    expect(dropFm).toBeGreaterThanOrEqual(0)
    // Reverse dependency order
    expect(dropFmcm).toBeLessThan(dropTfm)
    expect(dropTfm).toBeLessThan(dropFm)
  })

  it('should not drop tables that do not exist on down()', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([false, false, false])
    await migration.down(qr as never)

    const allSql = qr.query.mock.calls.map((c: unknown[]) => c[0]).join('\n')
    expect(allSql).not.toContain('DROP TABLE')
  })
})
