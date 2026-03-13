import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddRadarOrganizationForeignKeys1768000000001 implements MigrationInterface {
  name = 'AddRadarOrganizationForeignKeys1768000000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'organizations'
        ) THEN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'watched_items'
          ) AND NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'FK_watched_items_organization'
          ) THEN
            ALTER TABLE "watched_items"
            ADD CONSTRAINT "FK_watched_items_organization"
            FOREIGN KEY ("organizationId")
            REFERENCES "organizations"("id")
            ON DELETE CASCADE;
          END IF;

          IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'push_schedule_configs'
          ) AND NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'FK_push_schedule_configs_organization'
          ) THEN
            ALTER TABLE "push_schedule_configs"
            ADD CONSTRAINT "FK_push_schedule_configs_organization"
            FOREIGN KEY ("organizationId")
            REFERENCES "organizations"("id")
            ON DELETE CASCADE;
          END IF;

          IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'radar_pushes'
          ) AND NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'FK_radar_pushes_organization'
          ) THEN
            ALTER TABLE "radar_pushes"
            ADD CONSTRAINT "FK_radar_pushes_organization"
            FOREIGN KEY ("organizationId")
            REFERENCES "organizations"("id")
            ON DELETE CASCADE;
          END IF;
        END IF;
      END $$;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "radar_pushes"
      DROP CONSTRAINT IF EXISTS "FK_radar_pushes_organization";
    `)

    await queryRunner.query(`
      ALTER TABLE "push_schedule_configs"
      DROP CONSTRAINT IF EXISTS "FK_push_schedule_configs_organization";
    `)

    await queryRunner.query(`
      ALTER TABLE "watched_items"
      DROP CONSTRAINT IF EXISTS "FK_watched_items_organization";
    `)
  }
}
