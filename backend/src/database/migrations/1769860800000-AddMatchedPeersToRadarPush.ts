import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddMatchedPeersToRadarPush1769860800000 implements MigrationInterface {
  name = 'AddMatchedPeersToRadarPush1769860800000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('radar_pushes'))) {
      return
    }

    await queryRunner.query(`
      ALTER TABLE "radar_pushes"
      ADD COLUMN IF NOT EXISTS "matched_peers" jsonb
    `)

    if (await queryRunner.hasColumn('radar_pushes', 'matched_peers')) {
      await queryRunner.query(`
        COMMENT ON COLUMN "radar_pushes"."matched_peers"
        IS 'Matched peer organization names for industry radar push'
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('radar_pushes')) {
      await queryRunner.query(`
        ALTER TABLE "radar_pushes"
        DROP COLUMN IF EXISTS "matched_peers"
      `)
    }
  }
}
