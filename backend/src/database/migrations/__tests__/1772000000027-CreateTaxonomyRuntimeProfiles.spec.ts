import { CreateTaxonomyRuntimeProfiles1772000000027 } from '../1772000000027-CreateTaxonomyRuntimeProfiles'

describe('CreateTaxonomyRuntimeProfiles1772000000027', () => {
  let migration: CreateTaxonomyRuntimeProfiles1772000000027

  beforeEach(() => {
    migration = new CreateTaxonomyRuntimeProfiles1772000000027()
  })

  it('should create taxonomy_l2_runtime_profiles as a taxonomy_l2 companion table', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(false),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)

    const sql = queryRunner.query.mock.calls.map((call: unknown[]) => call[0]).join('\n')

    expect(sql).toContain('CREATE TABLE "taxonomy_l2_runtime_profiles"')
    expect(sql).toContain('"l2_code" varchar(20) PRIMARY KEY')
    expect(sql).toContain('"l2_code" varchar(20) PRIMARY KEY REFERENCES "taxonomy_l2"("l2_code")')
    expect(sql).toContain('"definition" text NOT NULL')
    expect(sql).toContain('"canonical_theme" varchar(200) NOT NULL')
    expect(sql).toContain('"aliases_json" jsonb NOT NULL DEFAULT \'[]\'::jsonb')
    expect(sql).toContain('"keywords_json" jsonb NOT NULL DEFAULT \'[]\'::jsonb')
    expect(sql).toContain('"source_version" varchar(50) NOT NULL')
    expect(sql).toContain('"created_at" timestamp NOT NULL DEFAULT NOW()')
    expect(sql).toContain('"updated_at" timestamp NOT NULL DEFAULT NOW()')
  })

  it('should create source-version index for runtime profile lookups', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(false),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)

    const sql = queryRunner.query.mock.calls.map((call: unknown[]) => call[0]).join('\n')

    expect(sql).toContain(
      'CREATE INDEX IF NOT EXISTS "idx_taxonomy_runtime_profiles_source_version"',
    )
    expect(sql).toContain('ON "taxonomy_l2_runtime_profiles" ("source_version")')
  })

  it('should drop source-version index and runtime profile table on down', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.down(queryRunner as never)

    const sql = queryRunner.query.mock.calls.map((call: unknown[]) => call[0]).join('\n')

    expect(sql).toContain('DROP INDEX IF EXISTS "idx_taxonomy_runtime_profiles_source_version"')
    expect(sql).toContain('DROP TABLE "taxonomy_l2_runtime_profiles"')
  })
})
