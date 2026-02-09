import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration: Add pushType to radar_pushes table
 *
 * Story 8.4: 同业动态推送生成
 * Adds pushType field to distinguish between regular, peer-monitoring, and compliance-playbook pushes
 */
export class AddPushTypeToRadarPush1739000000000 implements MigrationInterface {
  name = 'AddPushTypeToRadarPush1739000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for push_type
    await queryRunner.query(`
      CREATE TYPE "radar_push_type_enum" AS ENUM ('regular', 'peer-monitoring', 'compliance-playbook')
    `)

    // Add pushType column with default value 'regular'
    await queryRunner.query(`
      ALTER TABLE "radar_pushes"
      ADD COLUMN "push_type" "radar_push_type_enum" NOT NULL DEFAULT 'regular'
    `)

    // Create index for pushType queries
    await queryRunner.query(`
      CREATE INDEX "IDX_radar_pushes_push_type" ON "radar_pushes" ("push_type")
    `)

    // Create composite index for organization + pushType queries
    await queryRunner.query(`
      CREATE INDEX "IDX_radar_pushes_org_push_type" ON "radar_pushes" ("organization_id", "push_type")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_radar_pushes_org_push_type"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_radar_pushes_push_type"`)

    // Drop column
    await queryRunner.query(`ALTER TABLE "radar_pushes" DROP COLUMN IF EXISTS "push_type"`)

    // Drop enum type
    await queryRunner.query(`DROP TYPE IF EXISTS "radar_push_type_enum"`)
  }
}
