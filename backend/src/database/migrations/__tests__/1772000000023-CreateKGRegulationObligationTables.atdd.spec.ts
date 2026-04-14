/**
 * ATDD Acceptance Tests — Story 3-1: 法规义务表结构建立
 *
 * These tests are intentionally written in RED phase before implementation.
 * They verify:
 *   AC-1: regulation_obligations table schema, indexes, and rollback
 *   AC-2: obligation_control_maps table schema, unique constraint, indexes, and rollback
 */

describe('[AC-1][AC-2] CreateKGRegulationObligationTables migration', () => {
  const loadMigration = async () => {
    const mod = await import('../1772000000023-CreateKGRegulationObligationTables')
    const Ctor = Object.values(mod).find(
      (value) => typeof value === 'function' && /1772000000023/.test(value.name),
    ) as new () => { up: (qr: unknown) => Promise<void>; down: (qr: unknown) => Promise<void> }
    expect(Ctor).toBeDefined()
    return new Ctor()
  }

  const buildQueryRunner = (hasTableResults: boolean[]) => ({
    hasTable: jest.fn().mockImplementation(() => Promise.resolve(hasTableResults.shift() ?? false)),
    query: jest.fn().mockResolvedValue(undefined),
  })

  it('should create regulation_obligations with obligation_type enum and clause FK', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([false, false])
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((call: unknown[]) => String(call[0])).join('\n')
    expect(allSql).toContain('CREATE TABLE "regulation_obligations"')
    expect(allSql).toContain('obligation_id')
    expect(allSql).toContain('obligation_code')
    expect(allSql).toContain('obligation_type')
    expect(allSql).toContain('MANDATORY')
    expect(allSql).toContain('PROHIBITIVE')
    expect(allSql).toContain('RECOMMENDED')
    expect(allSql).toMatch(/REFERENCES\s+"regulation_clauses"\s*\("clause_id"\)/i)
  })

  it('should create regulation_obligations with applicable_sector array, status, and updated_at', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([false, false])
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((call: unknown[]) => String(call[0])).join('\n')
    expect(allSql).toContain('applicable_sector')
    expect(allSql).toMatch(/varchar\(50\)\[\]/i)
    expect(allSql).toContain('status')
    expect(allSql).toContain('updated_at')
  })

  it('should create regulation_obligations indexes for clause, type, and status', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([false, false])
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((call: unknown[]) => String(call[0])).join('\n')
    expect(allSql).toContain('idx_obligations_clause')
    expect(allSql).toContain('idx_obligations_type')
    expect(allSql).toContain('idx_obligations_status')
  })

  it('should create obligation_control_maps with coverage enum and dual FK', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([false, false])
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((call: unknown[]) => String(call[0])).join('\n')
    expect(allSql).toContain('CREATE TABLE "obligation_control_maps"')
    expect(allSql).toContain('obligation_id')
    expect(allSql).toContain('control_id')
    expect(allSql).toContain('coverage')
    expect(allSql).toContain('FULL')
    expect(allSql).toContain('PARTIAL')
    expect(allSql).toMatch(/REFERENCES\s+"regulation_obligations"\s*\("obligation_id"\)/i)
    expect(allSql).toMatch(/REFERENCES\s+"control_points"\s*\("control_id"\)/i)
  })

  it('should create obligation_control_maps unique constraint and indexes', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([false, false])
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((call: unknown[]) => String(call[0])).join('\n')
    expect(allSql).toMatch(/UNIQUE.*obligation_id.*control_id|UNIQUE.*control_id.*obligation_id/is)
    expect(allSql).toContain('idx_ocm_obligation')
    expect(allSql).toContain('idx_ocm_control')
    expect(allSql).toContain('updated_at')
  })

  it('should skip create table SQL when both tables already exist', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([true, true])
    await migration.up(qr as never)

    const allSql = qr.query.mock.calls.map((call: unknown[]) => String(call[0])).join('\n')
    expect(allSql).not.toContain('CREATE TABLE "regulation_obligations"')
    expect(allSql).not.toContain('CREATE TABLE "obligation_control_maps"')
  })

  it('should drop indexes and tables in reverse dependency order on down()', async () => {
    const migration = await loadMigration()
    const qr = buildQueryRunner([true, true])
    await migration.down(qr as never)

    const calls = qr.query.mock.calls.map((call: unknown[]) => String(call[0]))
    const dropMap = calls.findIndex((sql) => sql.includes('DROP TABLE "obligation_control_maps"'))
    const dropObligation = calls.findIndex((sql) => sql.includes('DROP TABLE "regulation_obligations"'))

    expect(dropMap).toBeGreaterThanOrEqual(0)
    expect(dropObligation).toBeGreaterThanOrEqual(0)
    expect(dropMap).toBeLessThan(dropObligation)
    expect(calls.join('\n')).toContain('DROP INDEX IF EXISTS "idx_ocm_control"')
    expect(calls.join('\n')).toContain('DROP INDEX IF EXISTS "idx_obligations_status"')
  })
})
