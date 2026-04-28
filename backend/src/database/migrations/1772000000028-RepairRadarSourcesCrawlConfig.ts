import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * RepairRadarSourcesCrawlConfig Migration
 *
 * Purpose:
 * - Self-heal historical environments where the radar_sources.crawlConfig column
 *   or its GIN index drifted away from the entity model even though older
 *   migrations were already recorded as executed.
 */
export class RepairRadarSourcesCrawlConfig1772000000028 implements MigrationInterface {
  name = 'RepairRadarSourcesCrawlConfig1772000000028'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "radar_sources"
      ADD COLUMN IF NOT EXISTS "crawlConfig" jsonb
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_radar_sources_crawl_config"
      ON "radar_sources" USING GIN ("crawlConfig")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_radar_sources_crawl_config"
    `)
  }
}
