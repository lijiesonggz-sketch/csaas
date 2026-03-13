import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddRadarPushCompositeIndexes1768900000001 implements MigrationInterface {
  name = 'AddRadarPushCompositeIndexes1768900000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('radar_pushes'))) {
      return
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_radar_pushes_radar_status_scheduled"
      ON "radar_pushes" ("radarType", "status", "scheduledAt")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_radar_pushes_org_content_scheduled"
      ON "radar_pushes" ("organizationId", "contentId", "scheduledAt")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_radar_pushes_org_content_scheduled"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_radar_pushes_radar_status_scheduled"`)
  }
}
