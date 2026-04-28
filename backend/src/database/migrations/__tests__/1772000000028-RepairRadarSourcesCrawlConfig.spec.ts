import { RepairRadarSourcesCrawlConfig1772000000028 } from '../1772000000028-RepairRadarSourcesCrawlConfig'

describe('RepairRadarSourcesCrawlConfig1772000000028', () => {
  let migration: RepairRadarSourcesCrawlConfig1772000000028

  beforeEach(() => {
    migration = new RepairRadarSourcesCrawlConfig1772000000028()
  })

  it('should repair the crawlConfig JSONB column on radar_sources', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)

    const sql = queryRunner.query.mock.calls.map((call: unknown[]) => call[0]).join('\n')

    expect(sql).toContain('ALTER TABLE "radar_sources"')
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "crawlConfig" jsonb')
  })

  it('should ensure the crawlConfig GIN index exists', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)

    const sql = queryRunner.query.mock.calls.map((call: unknown[]) => call[0]).join('\n')

    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_radar_sources_crawl_config"')
    expect(sql).toContain('ON "radar_sources" USING GIN ("crawlConfig")')
  })

  it('should only drop the repair index on down without deleting existing crawlConfig data', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.down(queryRunner as never)

    const sql = queryRunner.query.mock.calls.map((call: unknown[]) => call[0]).join('\n')

    expect(sql).toContain('DROP INDEX IF EXISTS "idx_radar_sources_crawl_config"')
    expect(sql).not.toContain('DROP COLUMN IF EXISTS "crawlConfig"')
  })
})
