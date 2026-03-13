import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddTaskProgressFields1767291591745 implements MigrationInterface {
  name = 'AddTaskProgressFields1767291591745'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'ai_tasks_generation_stage_enum'
            AND n.nspname = 'public'
        ) THEN
          CREATE TYPE "public"."ai_tasks_generation_stage_enum" AS ENUM(
            'pending',
            'generating_models',
            'quality_validation',
            'aggregating',
            'completed',
            'failed'
          );
        END IF;
      END $$;
    `)

    if (!(await queryRunner.hasTable('ai_tasks'))) {
      return
    }

    await queryRunner.query(`
      ALTER TABLE "ai_tasks"
      ADD COLUMN IF NOT EXISTS "generation_stage" "public"."ai_tasks_generation_stage_enum" NOT NULL DEFAULT 'pending'
    `)

    await queryRunner.query(`
      ALTER TABLE "ai_tasks"
      ADD COLUMN IF NOT EXISTS "progress_details" jsonb
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('ai_tasks')) {
      await queryRunner.query(`ALTER TABLE "ai_tasks" DROP COLUMN IF EXISTS "progress_details"`)
      await queryRunner.query(`ALTER TABLE "ai_tasks" DROP COLUMN IF EXISTS "generation_stage"`)
    }

    await queryRunner.query(`DROP TYPE IF EXISTS "public"."ai_tasks_generation_stage_enum"`)
  }
}
