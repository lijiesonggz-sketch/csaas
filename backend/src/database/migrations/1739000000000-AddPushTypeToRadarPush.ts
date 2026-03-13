import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPushTypeToRadarPush1739000000000 implements MigrationInterface {
  name = 'AddPushTypeToRadarPush1739000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'radar_push_type_enum'
            AND n.nspname = 'public'
        ) THEN
          CREATE TYPE "radar_push_type_enum" AS ENUM ('regular', 'peer-monitoring', 'compliance-playbook');
        END IF;
      END $$;
    `)

    if (!(await queryRunner.hasTable('radar_pushes'))) {
      return
    }

    if (!(await queryRunner.hasColumn('radar_pushes', 'push_type'))) {
      await queryRunner.query(`
        ALTER TABLE "radar_pushes"
        ADD COLUMN "push_type" "radar_push_type_enum" NOT NULL DEFAULT 'regular'
      `)
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_radar_pushes_push_type" ON "radar_pushes" ("push_type")
    `)

    if (await queryRunner.hasColumn('radar_pushes', 'organization_id')) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_radar_pushes_org_push_type"
        ON "radar_pushes" ("organization_id", "push_type")
      `)
    } else if (await queryRunner.hasColumn('radar_pushes', 'organizationId')) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_radar_pushes_org_push_type"
        ON "radar_pushes" ("organizationId", "push_type")
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_radar_pushes_org_push_type"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_radar_pushes_push_type"`)

    if (await queryRunner.hasTable('radar_pushes')) {
      await queryRunner.query(`ALTER TABLE "radar_pushes" DROP COLUMN IF EXISTS "push_type"`)
    }

    await queryRunner.query(`DROP TYPE IF EXISTS "radar_push_type_enum"`)
  }
}
