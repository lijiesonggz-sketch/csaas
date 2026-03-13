import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPushPreferencesOrganizationForeignKey1768000000002 implements MigrationInterface {
  name = 'AddPushPreferencesOrganizationForeignKey1768000000002'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'push_preferences'
        ) AND EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'organizations'
        ) AND NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_PUSH_PREFERENCE_ORGANIZATION'
        ) THEN
          ALTER TABLE "push_preferences"
          ADD CONSTRAINT "FK_PUSH_PREFERENCE_ORGANIZATION"
          FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id")
          ON DELETE CASCADE;
        END IF;
      END $$;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'push_preferences'
        ) THEN
          ALTER TABLE "push_preferences"
          DROP CONSTRAINT IF EXISTS "FK_PUSH_PREFERENCE_ORGANIZATION";
        END IF;
      END $$;
    `)
  }
}
