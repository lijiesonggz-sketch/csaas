import { CreateAdvisoryOutputRatings1772000000038 } from '../1772000000038-CreateAdvisoryOutputRatings'

describe('CreateAdvisoryOutputRatings1772000000038', () => {
  let migration: CreateAdvisoryOutputRatings1772000000038

  beforeEach(() => {
    migration = new CreateAdvisoryOutputRatings1772000000038()
  })

  it('[P0][4.4-BE-001][AC1,AC3] creates tenant-scoped output_ratings with duplicate prevention and rating range guard', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)

    const sql = queryRunner.query.mock.calls.map((call: unknown[]) => call[0]).join('\n')

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "output_ratings"')
    expect(sql).toContain('"tenant_id" uuid NOT NULL')
    expect(sql).toContain('"actor_id" uuid NOT NULL')
    expect(sql).toContain('"output_id" uuid NOT NULL')
    expect(sql).toContain('"session_id" uuid NOT NULL')
    expect(sql).toContain('"rating" integer')
    expect(sql).toContain('"feedback_text" text')
    expect(sql).toContain('"is_favorited" boolean NOT NULL DEFAULT false')
    expect(sql).toContain(
      'CONSTRAINT "CHK_output_ratings_rating_range" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5)',
    )
    expect(sql).toContain('ON "output_ratings" ("tenant_id", "actor_id", "output_id")')
  })

  it('[P0][4.4-BE-002][AC2,AC3] creates lookup and aggregation indexes for favorites and future rating dashboards', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)

    const sql = queryRunner.query.mock.calls.map((call: unknown[]) => call[0]).join('\n')

    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_output_ratings_tenant_output"')
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_output_ratings_tenant_actor"')
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_output_ratings_tenant_created"')
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_output_ratings_tenant_rating"')
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_output_ratings_tenant_favorited"')
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_output_ratings_metadata_gin"')
  })

  it('[P1][4.4-BE-003][AC3] drops output_ratings indexes and table on down', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.down(queryRunner as never)

    const sql = queryRunner.query.mock.calls.map((call: unknown[]) => call[0]).join('\n')

    expect(sql).toContain('DROP INDEX IF EXISTS "idx_output_ratings_metadata_gin"')
    expect(sql).toContain('DROP INDEX IF EXISTS "idx_output_ratings_tenant_favorited"')
    expect(sql).toContain('DROP TABLE IF EXISTS "output_ratings"')
  })
})
